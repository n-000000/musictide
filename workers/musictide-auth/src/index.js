/**
 * musictide-auth — Google OAuth proxy for Sveltia CMS
 *
 * Google sets Cross-Origin-Opener-Policy: same-origin on their auth pages,
 * which severs window.opener permanently while the popup is on their domain.
 * Direct postMessage from the callback therefore fails. We solve this with a
 * relay: after successful auth, we redirect the popup back to /admin/?relay=<id>
 * on musictide.pages.dev (same origin as the CMS). That page fetches the relay
 * payload from /relay/:id here, then postMessages to window.opener safely.
 *
 * Endpoints:
 *   GET /auth?provider=github&site_id=<domain>  — initiate Google OAuth
 *   GET /callback?code=<code>&state=<state>      — handle OAuth callback
 *   GET /relay/:id                               — one-time relay payload fetch
 *   OPTIONS *                                    — CORS preflight
 *   GET /                                        — health check
 *
 * Required secrets (wrangler secret put):
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GITHUB_SERVICE_ACCOUNT_PAT
 *
 * KV (USERS binding):
 *   User registry  — key: google email, value: {"name":"...","login":"..."}
 *   Relay tokens   — key: "relay:<uuid>", value: {pat, userData}, TTL 30s
 */

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

const ADMIN_URL = 'https://musictide.pages.dev/admin/';
const CORS_ORIGIN = 'https://musictide.pages.dev';

function isAllowedDomain(siteId, allowedDomains) {
  return (allowedDomains || '')
    .split(',')
    .map(d => d.trim())
    .some(d => d && (siteId === d || siteId.endsWith('.' + d)));
}

function errorPage(reason) {
  return new Response(
    `<!doctype html><html><body>
      <p style="font-family:sans-serif">Authentication failed: <strong>${reason}</strong></p>
      <p style="font-family:sans-serif">Please close this window and try again.</p>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

async function handleAuth(request, env) {
  const url = new URL(request.url);
  const siteId = url.searchParams.get('site_id') || '';

  if (!isAllowedDomain(siteId, env.ALLOWED_DOMAINS)) {
    return new Response('Unauthorized domain', { status: 403 });
  }

  const csrf = crypto.randomUUID().replace(/-/g, '');

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: new URL('/callback', url.origin).href,
    response_type: 'code',
    scope: 'openid email profile',
    state: csrf + '_' + siteId,
    access_type: 'online',
  });

  return new Response(null, {
    status: 302,
    headers: {
      'Location': GOOGLE_AUTH_URL + '?' + params,
      'Set-Cookie': `csrf=${csrf}; HttpOnly; Secure; SameSite=None; Max-Age=600; Path=/`,
    },
  });
}

async function handleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state') || '';
  const oauthError = url.searchParams.get('error');

  if (oauthError) return errorPage(oauthError);
  if (!code) return errorPage('missing_code');

  // Verify CSRF
  const underscoreIdx = state.indexOf('_');
  const stateCsrf = underscoreIdx > 0 ? state.slice(0, underscoreIdx) : '';
  const cookieHeader = request.headers.get('Cookie') || '';
  const csrfCookie = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith('csrf='));
  const cookieCsrf = csrfCookie ? csrfCookie.split('=').slice(1).join('=') : '';

  if (!stateCsrf || !cookieCsrf || stateCsrf !== cookieCsrf) {
    return errorPage('csrf_mismatch');
  }

  // Exchange code for access token
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: new URL('/callback', url.origin).href,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) return errorPage('token_exchange_failed');
  const { access_token } = await tokenRes.json();

  // Get Google user info
  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: 'Bearer ' + access_token },
  });

  if (!userRes.ok) return errorPage('userinfo_failed');
  const googleUser = await userRes.json();

  // Check KV registry
  const record = await env.USERS.get(googleUser.email, { type: 'json' });
  if (!record) return errorPage('unauthorized — ' + googleUser.email + ' is not registered');

  // Store relay payload in KV (30s TTL, single-use)
  const relayId = crypto.randomUUID().replace(/-/g, '');
  await env.USERS.put('relay:' + relayId, JSON.stringify({
    pat: env.GITHUB_SERVICE_ACCOUNT_PAT,
    userData: {
      name: record.name || googleUser.name,
      login: record.login,
      email: googleUser.email,
      avatar: googleUser.picture || '',
    },
  }), { expirationTtl: 30 });

  return new Response(null, {
    status: 302,
    headers: {
      'Location': ADMIN_URL + '?relay=' + relayId,
      'Set-Cookie': 'csrf=; HttpOnly; Secure; SameSite=None; Max-Age=0; Path=/',
    },
  });
}

async function handleRelay(request, env, relayId) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  const data = await env.USERS.get('relay:' + relayId, { type: 'json' });
  if (!data) {
    return new Response(JSON.stringify({ error: 'relay_expired' }), { status: 404, headers: corsHeaders });
  }

  await env.USERS.delete('relay:' + relayId);
  return new Response(JSON.stringify(data), { headers: corsHeaders });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': CORS_ORIGIN,
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
        },
      });
    }

    if (pathname === '/auth' || pathname === '/oauth/authorize') return handleAuth(request, env);
    if (pathname === '/callback' || pathname === '/oauth/redirect') return handleCallback(request, env);

    const relayMatch = pathname.match(/^\/relay\/([a-f0-9]+)$/);
    if (relayMatch) return handleRelay(request, env, relayMatch[1]);

    if (pathname === '/') return new Response('musictide-auth ok', { status: 200 });

    return new Response('Not found', { status: 404 });
  },
};
