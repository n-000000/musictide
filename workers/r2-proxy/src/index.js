/**
 * musictide-media-proxy
 *
 * S3-compatible reverse proxy between Sveltia CMS and Cloudflare R2.
 *
 * - POST /sign-upload: returns a presigned PUT URL for direct-to-R2 uploads
 *                      (bypasses Worker body size limit for large files)
 * - PutObject:       prepends {collection}/YYYY/MM/DD/ to the key
 * - ListObjectsV2:   returns objects from ±1 day only
 * - DeleteObject:    passes through
 * - HeadObject:      passes through
 *
 * Auth: GitHub OAuth token forwarded from CMS, verified against repo push access.
 * No static secrets in client code.
 */

import { AwsClient } from 'aws4fetch';

const GITHUB_REPO = 'n-000000/musictide';

const ALLOWED_ORIGINS = [
  'https://musictide.pages.dev',
  'http://localhost:1313',
  'http://localhost:3000',
];

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed =
    ALLOWED_ORIGINS.includes(origin) ||
    origin.endsWith('.musictide.pages.dev');
  return {
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, HEAD, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Collection, x-amz-content-sha256, x-amz-date, x-amz-user-agent, x-amz-acl',
    'Access-Control-Expose-Headers': 'ETag',
    'Access-Control-Max-Age': '86400',
  };
}

function respond(body, status, extraHeaders, request) {
  return new Response(body, {
    status,
    headers: { ...corsHeaders(request), ...extraHeaders },
  });
}

/**
 * Verify GitHub token has push access to the repo.
 * Returns true if authenticated and authorised.
 */
async function verifyGitHub(token) {
  if (!token) return false;
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'musictide-media-proxy',
        Accept: 'application/vnd.github+json',
      },
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.permissions?.push === true;
  } catch {
    return false;
  }
}

/** Return [yesterday, today, tomorrow] as YYYY-MM-DD strings. */
function threeDays(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  const prev = new Date(d);
  prev.setUTCDate(d.getUTCDate() - 1);
  const next = new Date(d);
  next.setUTCDate(d.getUTCDate() + 1);
  return [prev, d, next].map((dt) => dt.toISOString().split('T')[0]);
}

/** Build storage prefix: {collection}/YYYY/MM/DD/ */
function buildPrefix(collection, dateStr) {
  return `${collection}/${dateStr.replace(/-/g, '/')}/`;
}

/** Build S3 ListObjectsV2 XML response. */
function listXml(bucketName, objects) {
  const contents = objects
    .map(
      (obj) => `  <Contents>
    <Key>${escapeXml(obj.key)}</Key>
    <LastModified>${obj.uploaded.toISOString()}</LastModified>
    <ETag>"${obj.etag || ''}"</ETag>
    <Size>${obj.size}</Size>
    <StorageClass>STANDARD</StorageClass>
  </Contents>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Name>${escapeXml(bucketName)}</Name>
  <KeyCount>${objects.length}</KeyCount>
  <MaxKeys>1000</MaxKeys>
  <IsTruncated>false</IsTruncated>
${contents}
</ListBucketResult>`;
}

function escapeXml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default {
  // Orphan cleanup disabled — R2 free tier (10GB, no egress) makes it unnecessary
  // and the cron was deleting images uploaded before their article was committed.
  // async scheduled(event, env, ctx) {
  //   ctx.waitUntil(cleanupOrphanedMedia(env));
  // },

  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    // Auth — extract GitHub token from Authorization header
    const authHeader = request.headers.get('Authorization') || '';
    const ghToken = authHeader.replace(/^Bearer\s+/i, '');
    const authorised = await verifyGitHub(ghToken);
    if (!authorised) {
      return respond('Unauthorized — valid GitHub token with repo push access required', 403, {}, request);
    }

    const url = new URL(request.url);

    // ── Presigned upload URL endpoint ──────────────────────────
    if (request.method === 'POST' && url.pathname === '/sign-upload') {
      return await handleSignUpload(request, env);
    }

    // Path: /{bucket}/{key...} or /{bucket}?list-type=2
    const pathParts = url.pathname.slice(1).split('/');
    const key = decodeURIComponent(pathParts.slice(1).join('/'));

    const today = new Date().toISOString().split('T')[0];
    const collection = request.headers.get('X-Collection') || 'posts';

    try {
      switch (request.method) {
        case 'PUT':
          return await handlePut(key, request, env, today, collection);
        case 'GET':
          if (url.searchParams.get('list-type') === '2') {
            return await handleList(request, env, today, collection);
          }
          return await handleGet(key, request, env);
        case 'DELETE':
          return await handleDelete(key, request, env);
        case 'HEAD':
          return await handleHead(key, request, env);
        default:
          return respond('Method Not Allowed', 405, {}, request);
      }
    } catch (err) {
      console.error('Proxy error:', err);
      return respond(`Internal Error: ${err.message}`, 500, {}, request);
    }
  },
};

/**
 * POST /sign-upload — generate a presigned PUT URL for direct-to-R2 upload.
 *
 * Body: { key: "filename.mp4", contentType: "video/mp4", collection: "posts" }
 * Returns: { url: "https://...presigned...", key: "posts/2026/03/28/filename.mp4",
 *            publicUrl: "https://pub-xxx.r2.dev/posts/2026/03/28/filename.mp4" }
 */
async function handleSignUpload(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return respond('Invalid JSON body', 400, {}, request);
  }

  const { key, contentType, collection } = body;
  if (!key) return respond('Missing key', 400, {}, request);

  const today = new Date().toISOString().split('T')[0];
  const prefixedKey = buildPrefix(collection || 'posts', today) + key;

  const r2Client = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    region: 'auto',
    service: 's3',
  });

  const r2Url = new URL(
    `/${env.BUCKET_NAME}/${encodeURIComponent(prefixedKey).replace(/%2F/g, '/')}`,
    `https://${env.ACCOUNT_ID}.r2.cloudflarestorage.com`,
  );

  // Presigned URL valid for 1 hour
  r2Url.searchParams.set('X-Amz-Expires', '3600');

  const signed = await r2Client.sign(r2Url.toString(), {
    method: 'PUT',
    headers: { 'Content-Type': contentType || 'application/octet-stream' },
    aws: { signQuery: true },
  });

  const result = {
    url: signed.url,
    key: prefixedKey,
    publicUrl: `${env.PUBLIC_URL}/${prefixedKey}`,
  };

  return respond(JSON.stringify(result), 200, { 'Content-Type': 'application/json' }, request);
}

/** PUT — upload with collection + date prefix (used for small files proxied through Worker). */
async function handlePut(key, request, env, today, collection) {
  if (!key) return respond('Missing key', 400, {}, request);

  const prefixed = buildPrefix(collection, today) + key;
  const contentType =
    request.headers.get('Content-Type') || 'application/octet-stream';

  const obj = await env.R2.put(prefixed, request.body, {
    httpMetadata: { contentType },
  });

  return respond('', 200, { ETag: `"${obj.etag}"` }, request);
}

/** GET list-type=2 — ListObjectsV2 returning ±1 day, scoped to collection. */
async function handleList(request, env, today, collection) {
  const days = threeDays(today);
  const allObjects = [];

  for (const day of days) {
    const prefix = buildPrefix(collection, day);
    let cursor;
    do {
      const batch = await env.R2.list({ prefix, limit: 1000, cursor });
      allObjects.push(...batch.objects);
      cursor = batch.truncated ? batch.cursor : null;
    } while (cursor);
  }

  // Sort newest first
  allObjects.sort((a, b) => b.uploaded - a.uploaded);

  const xml = listXml(env.BUCKET_NAME, allObjects);
  return respond(xml, 200, { 'Content-Type': 'application/xml' }, request);
}

/** GET /{key} — redirect to public URL. */
async function handleGet(key, request, env) {
  if (!key) return respond('Missing key', 400, {}, request);
  return Response.redirect(`${env.PUBLIC_URL}/${key}`, 302);
}

/** DELETE /{key} — remove from R2. */
async function handleDelete(key, request, env) {
  if (!key) return respond('Missing key', 400, {}, request);
  await env.R2.delete(key);
  return respond('', 204, {}, request);
}

/** HEAD /{key} — check existence + metadata. */
async function handleHead(key, request, env) {
  if (!key) return respond('Missing key', 404, {}, request);
  const obj = await env.R2.head(key);
  if (!obj) return respond('', 404, {}, request);
  return respond('', 200, {
    'Content-Length': obj.size.toString(),
    'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
    ETag: `"${obj.etag}"`,
  }, request);
}

// ── Scheduled Cleanup ──────────────────────────────────────────────
/*

/**
 * Delete R2 objects not referenced in any content file.
 *
 * 1. Get full repo tree from GitHub API
 * 2. Fetch all markdown files under content/
 * 3. Collect every R2 URL or key referenced in their raw text
 * 4. List all R2 keys
 * 5. Delete the difference
 */
async function cleanupOrphanedMedia(env) {
  const publicUrl = env.PUBLIC_URL;

  // 1. Get repo tree (recursive, single API call)
  // Repo is public — no auth token needed (unauthenticated: 60 req/hour, plenty for daily cron)
  const tree = await ghFetch(
    `https://api.github.com/repos/${GITHUB_REPO}/git/trees/main?recursive=1`,
  );
  if (!tree?.tree) {
    console.error('Failed to fetch repo tree');
    return;
  }

  // 2. Find markdown files under content/
  const mdFiles = tree.tree.filter(
    (f) => f.type === 'blob' && f.path.startsWith('content/') && f.path.endsWith('.md'),
  );

  // 3. Fetch each file and collect referenced R2 keys
  const referencedKeys = new Set();

  for (const file of mdFiles) {
    const content = await ghFetchRaw(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${file.path}`,
    );
    if (!content) continue;

    // Match full R2 public URLs → extract the key part.
    // Keys may contain spaces (user-uploaded filenames), so match until
    // newline, quote, or closing paren — then trim trailing whitespace.
    const urlPattern = new RegExp(
      escapeRegex(publicUrl) + '/([^\\n"\'\\)]+)',
      'g',
    );
    for (const match of content.matchAll(urlPattern)) {
      referencedKeys.add(decodeURIComponent(match[1].trim()));
    }
  }

  // 4. List all R2 keys
  const allKeys = [];
  let cursor;
  do {
    const batch = await env.R2.list({ limit: 1000, cursor });
    allKeys.push(...batch.objects.map((o) => o.key));
    cursor = batch.truncated ? batch.cursor : null;
  } while (cursor);

  // 5. Delete orphans
  const orphans = allKeys.filter((key) => !referencedKeys.has(key));

  if (orphans.length === 0) {
    console.log(`Cleanup: all ${allKeys.length} R2 objects are referenced`);
    return;
  }

  // R2 delete supports up to 1000 keys per batch
  for (let i = 0; i < orphans.length; i += 1000) {
    await env.R2.delete(orphans.slice(i, i + 1000));
  }

  console.log(
    `Cleanup: deleted ${orphans.length} orphaned objects out of ${allKeys.length} total`,
  );
}

async function ghFetch(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'musictide-media-proxy',
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) {
    console.error(`GitHub API error: ${res.status} for ${url}`);
    return null;
  }
  return res.json();
}

/** Fetch raw file content from GitHub Contents API. */
async function ghFetchRaw(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'musictide-media-proxy',
      Accept: 'application/vnd.github.raw+json',
    },
  });
  if (!res.ok) return null;
  return res.text();
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
*/
