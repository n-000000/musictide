/**
 * musictide-auth — Google Identity Services proxy for Sveltia CMS
 *
 * Uses Google's GIS SDK (accounts.google.com/gsi/client) instead of a redirect
 * OAuth flow. The popup stays on musictide-auth.leftfield.workers.dev throughout,
 * so window.opener is never severed by Google's COOP headers. The GIS button
 * returns a signed JWT credential; we verify it with Google's tokeninfo API,
 * look up the user in KV by sub_token (HMAC of Google user ID), and postMessage
 * the result back to the opener.
 *
 * Endpoints:
 *   GET /auth?provider=github&site_id=<domain>  — serve GIS login page
 *   POST /verify                                 — verify GIS credential JWT
 *   POST /compute-token                          — compute HMAC token for an email (PAT-auth'd)
 *   POST /sync-users                             — GitHub push webhook → KV sync
 *   OPTIONS *                                    — CORS preflight
 *   GET /                                        — health check
 *
 * Required secrets (wrangler secret put):
 *   GOOGLE_CLIENT_ID, GITHUB_SERVICE_ACCOUNT_PAT, WEBHOOK_SECRET, GLOBAL_SALT
 *   (GOOGLE_CLIENT_SECRET no longer needed — GIS uses client-side flow)
 *
 * KV (USERS binding): key = HMAC-SHA256(GLOBAL_SALT, google_sub), value = {"name":"...","email":"..."}
 *   Legacy keys (HMAC of email) are auto-upgraded to sub-based keys on first login.
 */

const CORS_ORIGIN = 'https://musictide.pages.dev';

// ── Helpers ───────────────────────────────────────────────────────────────────

function isAllowedDomain(siteId, allowedDomains) {
  return (allowedDomains || '')
    .split(',')
    .map(d => d.trim())
    .some(d => d && (siteId === d || siteId.endsWith('.' + d)));
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/**
 * Compute HMAC-SHA256(saltHex, value) and return the result as a hex string.
 * @param {string} saltHex  32-byte salt as 64 hex characters (from GLOBAL_SALT secret).
 * @param {string} value    The string to hash (Google sub or email).
 * @returns {Promise<string>}
 */
async function hmac(saltHex, value) {
  const saltBytes = new Uint8Array(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)));
  const key = await crypto.subtle.importKey(
    'raw',
    saltBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function syncUsers(env) {
  const ghHeaders = {
    'User-Agent': 'musictide-auth',
    'Authorization': 'Bearer ' + env.GITHUB_SERVICE_ACCOUNT_PAT,
  };

  const listRes = await fetch(
    'https://api.github.com/repos/n-000000/musictide/contents/data/cms-users',
    { headers: ghHeaders }
  );
  if (listRes.status === 404) return;
  if (!listRes.ok) throw new Error('GitHub API ' + listRes.status);

  const files = await listRes.json();
  if (!Array.isArray(files)) throw new Error('Unexpected GitHub response for directory listing');

  const desired = new Map();
  await Promise.all(
    files
      .filter(f => f.type === 'file' && f.name.endsWith('.json'))
      .map(async f => {
        const r = await fetch(f.download_url, { headers: ghHeaders });
        if (!r.ok) throw new Error('Failed to fetch ' + f.name + ': ' + r.status);
        const data = await r.json();
        if (data.token) desired.set(data.token, { name: data.name || '' });
      })
  );

  let allKeys = [];
  let cursor;
  do {
    const page = await env.USERS.list({ cursor });
    allKeys.push(...page.keys);
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  const current = new Set(allKeys.map(k => k.name));

  await Promise.all([
    ...[...current].filter(k => !desired.has(k)).map(k => env.USERS.delete(k)),
    ...[...desired.entries()].map(([tok, rec]) => env.USERS.put(tok, JSON.stringify(rec))),
  ]);
}

async function handleSyncUsers(request, env) {
  if (!env.WEBHOOK_SECRET) return new Response('Not configured', { status: 503 });

  const sig = request.headers.get('X-Hub-Signature-256');
  if (!sig) return new Response('Missing signature', { status: 401 });

  const body = await request.arrayBuffer();
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, body);
  const expected = 'sha256=' + Array.from(new Uint8Array(mac))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const cmpKey = crypto.getRandomValues(new Uint8Array(32));
  const cmpCryptoKey = await crypto.subtle.importKey(
    'raw', cmpKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.sign('HMAC', cmpCryptoKey, enc.encode(expected)),
    crypto.subtle.sign('HMAC', cmpCryptoKey, enc.encode(sig)),
  ]);
  const aBytes = new Uint8Array(a);
  const bBytes = new Uint8Array(b);
  if (aBytes.some((byte, i) => byte !== bBytes[i])) {
    return new Response('Invalid signature', { status: 401 });
  }

  const event = request.headers.get('X-GitHub-Event');
  if (event !== 'push') return new Response('OK', { status: 200 });

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(body));
  } catch {
    return new Response('Invalid payload', { status: 400 });
  }

  if (payload.ref !== 'refs/heads/main') return new Response('OK', { status: 200 });

  const commits = Array.isArray(payload.commits) ? payload.commits : [];
  const touchesUsers = commits.some(c =>
    [...(c.added || []), ...(c.modified || []), ...(c.removed || [])]
      .some(p => p.startsWith('data/cms-users/'))
  );
  if (!touchesUsers) return new Response('OK', { status: 200 });

  try {
    await syncUsers(env);
    return new Response('OK', { status: 200 });
  } catch (err) {
    return new Response('Sync failed: ' + err.message, { status: 500 });
  }
}

async function handleAuth(request, env) {
  const url = new URL(request.url);
  const siteId = url.searchParams.get('site_id') || '';

  if (!isAllowedDomain(siteId, env.ALLOWED_DOMAINS)) {
    return new Response('Unauthorized domain', { status: 403 });
  }

  const html = `<!doctype html>
<html lang="pt">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Musictide CMS — Autenticar</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #111;
      color: #eee;
    }
    .card {
      background: #1e1e1e;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 2rem 2.5rem;
      text-align: center;
      min-width: 280px;
    }
    h1 { font-size: 1.1rem; letter-spacing: .05em; margin-bottom: 1.5rem; color: #fff; }
    #status { margin-top: 1rem; font-size: 0.85rem; color: #888; min-height: 1.2em; }
    #status.error { color: #e55; }
    #signin-btn {
      margin-top: 0.5rem;
      padding: 0.65rem 1.4rem;
      background: #fff;
      color: #111;
      border: none;
      border-radius: 4px;
      font-size: 0.95rem;
      font-weight: 500;
      cursor: pointer;
      display: none;
    }
    #signin-btn:active { opacity: 0.85; }
    #gsi-btn { margin-top: 1rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>MUSICTIDE CMS</h1>
    <div id="gsi-btn"></div>
    <button id="signin-btn" onclick="triggerPrompt()">Entrar com Google</button>
    <p id="status"></p>
  </div>

  <script src="https://accounts.google.com/gsi/client" async defer onload="initGIS()"></script>
  <script>
    function initGIS() {
      google.accounts.id.initialize({
        client_id: "${env.GOOGLE_CLIENT_ID}",
        callback: handleCredential,
        cancel_on_tap_outside: false,
        use_fedcm_for_prompt: true,
      });
      google.accounts.id.renderButton(document.getElementById('gsi-btn'), {
        type: 'standard', size: 'large', theme: 'filled_black',
        text: 'signin_with', shape: 'rectangular', logo_alignment: 'left',
      });
    }

    function triggerPrompt() {
      if (window.google && google.accounts) {
        google.accounts.id.prompt();
      }
    }

    document.querySelector('script[src*="gsi/client"]').addEventListener('error', function () {
      document.getElementById('signin-btn').style.display = 'inline-block';
      document.getElementById('status').textContent = 'Google indisponível neste browser.';
    });

    function handleCredential(response) {
      document.getElementById('status').textContent = 'A verificar acesso...';
      document.getElementById('status').className = '';
      document.getElementById('gsi-btn').style.display = 'none';

      fetch('/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.error) {
            document.getElementById('status').textContent = 'Acesso negado: ' + data.error;
            document.getElementById('status').className = 'error';
            return;
          }
          if (window.opener) {
            window.opener.postMessage({ type: 'mt-user-data', user: data.userData }, '*');
            window.opener.postMessage(
              'authorization:github:success:' + JSON.stringify({ token: data.pat }),
              '*'
            );
          }
          window.close();
        })
        .catch(function () {
          document.getElementById('status').textContent = 'Erro de ligação. Tente novamente.';
          document.getElementById('status').className = 'error';
        });
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

async function handleVerify(request, env) {
  let credential;
  try {
    ({ credential } = await request.json());
  } catch {
    return jsonResponse({ error: 'invalid_request' }, 400);
  }

  const verifyRes = await fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential),
  );
  if (!verifyRes.ok) return jsonResponse({ error: 'invalid_token' }, 401);

  const payload = await verifyRes.json();

  if (payload.aud !== env.GOOGLE_CLIENT_ID) return jsonResponse({ error: 'invalid_audience' }, 401);
  if (payload.email_verified !== 'true') return jsonResponse({ error: 'email_not_verified' }, 401);

  // Sub-token lookup (preferred: stable, opaque)
  const subToken = await hmac(env.GLOBAL_SALT, payload.sub);
  let record = await env.USERS.get(subToken, { type: 'json' });

  if (!record) {
    // Email-token fallback (legacy: pre-migration entries)
    const emailToken = await hmac(env.GLOBAL_SALT, payload.email);
    record = await env.USERS.get(emailToken, { type: 'json' });
    if (record) {
      // Auto-upgrade: swap to sub-keyed entry, store email for audit display
      await env.USERS.put(subToken, JSON.stringify({ ...record, email: payload.email }));
      await env.USERS.delete(emailToken);
    }
  }

  if (!record) return jsonResponse({ error: 'access_denied' }, 403);

  return jsonResponse({
    pat: env.GITHUB_SERVICE_ACCOUNT_PAT,
    userData: {
      name: record.name || payload.name,
      email: payload.email,
      avatar: payload.picture || '',
    },
  });
}

async function handleComputeToken(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (auth !== 'Bearer ' + env.GITHUB_SERVICE_ACCOUNT_PAT) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  let email;
  try {
    ({ email } = await request.json());
  } catch {
    return jsonResponse({ error: 'invalid_request' }, 400);
  }

  if (!email || typeof email !== 'string') {
    return jsonResponse({ error: 'email_required' }, 400);
  }

  const token = await hmac(env.GLOBAL_SALT, email);
  return jsonResponse({ token });
}

// ── Router ────────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    if ((pathname === '/auth' || pathname === '/oauth/authorize') && request.method === 'GET') {
      return handleAuth(request, env);
    }

    if (pathname === '/verify' && request.method === 'POST') {
      return handleVerify(request, env);
    }

    if (pathname === '/compute-token' && request.method === 'POST') {
      return handleComputeToken(request, env);
    }

    if (pathname === '/sync-users' && request.method === 'POST') {
      return handleSyncUsers(request, env);
    }

    if (pathname === '/') return new Response('musictide-auth ok', { status: 200 });

    return new Response('Not found', { status: 404 });
  },
};
