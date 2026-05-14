/**
 * musictide-auth — Google OAuth proxy for Sveltia CMS
 *
 * Exposes the same /auth + /callback interface as sveltia-cms-auth, so Sveltia
 * needs no changes. On successful Google login, verifies the email against a
 * Cloudflare KV registry and issues a shared GitHub service account PAT to the
 * CMS. Also sends user metadata (name, email) so admin/index.html can inject
 * correct commit author attribution on every save.
 *
 * Endpoints:
 *   GET /auth?provider=github&site_id=<domain>  — initiate Google OAuth
 *   GET /callback?code=<code>&state=<state>      — handle OAuth callback
 *   OPTIONS *                                    — CORS preflight
 *   GET /                                        — health check
 *
 * Required secrets (set via wrangler secret put):
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GITHUB_SERVICE_ACCOUNT_PAT
 *
 * KV (USERS binding): key = google email, value = {"name":"...", "login":"author-slug"}
 */

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

function isAllowedDomain(siteId, allowedDomains) {
  return (allowedDomains || '')
    .split(',')
    .map(d => d.trim())
    .some(d => d && (siteId === d || siteId.endsWith('.' + d)));
}

function authErrorPage(reason) {
  const msg = JSON.stringify('authorization:github:error:' + reason);
  return new Response(
    `<!doctype html><html><body><script>
      if (window.opener) window.opener.postMessage(${msg}, '*');
      window.close();
    </script></body></html>`,
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
      // HttpOnly + Secure — SameSite=None needed because the callback comes
      // from accounts.google.com redirecting back to us (cross-site redirect).
      'Set-Cookie': `csrf=${csrf}; HttpOnly; Secure; SameSite=None; Max-Age=600; Path=/`,
    },
  });
}

async function handleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state') || '';
  const oauthError = url.searchParams.get('error');

  if (oauthError) return authErrorPage(oauthError);
  if (!code) return authErrorPage('missing_code');

  // Verify CSRF: state = "{csrf}_{siteId}", csrf cookie must match
  const underscoreIdx = state.indexOf('_');
  const stateCsrf = underscoreIdx > 0 ? state.slice(0, underscoreIdx) : '';

  const cookieHeader = request.headers.get('Cookie') || '';
  const csrfCookie = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith('csrf='));
  const cookieCsrf = csrfCookie ? csrfCookie.split('=').slice(1).join('=') : '';

  if (!stateCsrf || !cookieCsrf || stateCsrf !== cookieCsrf) {
    return authErrorPage('csrf_mismatch');
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

  if (!tokenRes.ok) return authErrorPage('token_exchange_failed');
  const { access_token } = await tokenRes.json();

  // Get Google user info
  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: 'Bearer ' + access_token },
  });

  if (!userRes.ok) return authErrorPage('userinfo_failed');
  const googleUser = await userRes.json();

  // Check KV registry — key is the Google email address
  const record = await env.USERS.get(googleUser.email, { type: 'json' });
  if (!record) return authErrorPage('unauthorized');

  // Build payloads
  const userDataMsg = JSON.stringify({
    type: 'mt-user-data',
    user: {
      name: record.name || googleUser.name,
      login: record.login,
      email: googleUser.email,
      avatar: googleUser.picture || '',
    },
  });
  const authMsg = JSON.stringify('authorization:github:success:' + env.GITHUB_SERVICE_ACCOUNT_PAT);

  const clearCookie = 'csrf=; HttpOnly; Secure; SameSite=None; Max-Age=0; Path=/';

  return new Response(
    `<!doctype html><html><body><script>
      if (window.opener) {
        window.opener.postMessage(${userDataMsg}, '*');
        window.opener.postMessage(${authMsg}, '*');
      }
      window.close();
    </script></body></html>`,
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Set-Cookie': clearCookie,
      },
    },
  );
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
        },
      });
    }

    const { pathname } = new URL(request.url);

    if (pathname === '/auth' || pathname === '/oauth/authorize') {
      return handleAuth(request, env);
    }

    if (pathname === '/callback' || pathname === '/oauth/redirect') {
      return handleCallback(request, env);
    }

    if (pathname === '/') {
      return new Response('musictide-auth ok', { status: 200 });
    }

    return new Response('Not found', { status: 404 });
  },
};
