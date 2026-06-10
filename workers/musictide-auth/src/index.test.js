import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from './index.js';

// Fixed salt for tests: 32 zero-bytes as hex
const TEST_SALT = '00'.repeat(32);

async function computeToken(value) {
  const saltBytes = new Uint8Array(TEST_SALT.match(/.{2}/g).map((b) => parseInt(b, 16)));
  const key = await crypto.subtle.importKey(
    'raw',
    saltBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function makeKV(initial = {}) {
  const store = new Map(
    Object.entries(initial).map(([k, v]) => [k, JSON.stringify(v)]),
  );
  return {
    async get(key, opts) {
      const val = store.get(key);
      if (val == null) return null;
      return opts?.type === 'json' ? JSON.parse(val) : val;
    },
    async put(key, value) {
      store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    },
    async delete(key) {
      store.delete(key);
    },
    async list() {
      return {
        keys: [...store.keys()].map((k) => ({ name: k })),
        list_complete: true,
      };
    },
    _store: store,
  };
}

function makeEnv(kvEntries = {}, overrides = {}) {
  return {
    GLOBAL_SALT: TEST_SALT,
    GOOGLE_CLIENT_ID: 'test-client-id',
    GITHUB_SERVICE_ACCOUNT_PAT: 'test-pat',
    WEBHOOK_SECRET: 'test-secret',
    ALLOWED_DOMAINS: 'musictide.pages.dev',
    USERS: makeKV(kvEntries),
    ...overrides,
  };
}

function googlePayload(overrides = {}) {
  return {
    sub: 'sub-99999',
    email: 'user@gmail.com',
    email_verified: 'true',
    aud: 'test-client-id',
    name: 'Test User',
    picture: 'https://example.com/pic.jpg',
    ...overrides,
  };
}

function mockGoogleOk(payload) {
  return vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
}

function verifyRequest(credential = 'cred-abc') {
  return new Request('https://worker.dev/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  });
}

afterEach(() => vi.restoreAllMocks());

// ── /verify ──────────────────────────────────────────────────────────────────

describe('POST /verify', () => {
  it('returns 400 for malformed body', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const req = new Request('https://worker.dev/verify', {
      method: 'POST',
      body: 'not json',
    });
    const res = await worker.fetch(req, makeEnv());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_request');
  });

  it('returns 401 when Google tokeninfo returns non-200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad', { status: 400 })));
    const res = await worker.fetch(verifyRequest(), makeEnv());
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('invalid_token');
  });

  it('returns 401 for wrong audience', async () => {
    vi.stubGlobal('fetch', mockGoogleOk(googlePayload({ aud: 'wrong-client' })));
    const res = await worker.fetch(verifyRequest(), makeEnv());
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('invalid_audience');
  });

  it('returns 401 for unverified email', async () => {
    vi.stubGlobal('fetch', mockGoogleOk(googlePayload({ email_verified: 'false' })));
    const res = await worker.fetch(verifyRequest(), makeEnv());
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('email_not_verified');
  });

  it('returns 403 when neither sub_token nor email_token exists in KV', async () => {
    vi.stubGlobal('fetch', mockGoogleOk(googlePayload()));
    const res = await worker.fetch(verifyRequest(), makeEnv({}));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('access_denied');
  });

  it('returns 200 with userData when sub_token found in KV', async () => {
    const payload = googlePayload();
    const subToken = await computeToken(payload.sub);
    vi.stubGlobal('fetch', mockGoogleOk(payload));

    const env = makeEnv({ [subToken]: { name: 'Test User' } });
    const res = await worker.fetch(verifyRequest(), env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pat).toBe('test-pat');
    expect(body.userData.name).toBe('Test User');
    expect(body.userData.email).toBe('user@gmail.com');
    expect(body.userData.login).toBeUndefined();
  });

  it('returns 200 via email_token fallback when sub_token absent', async () => {
    const payload = googlePayload();
    const emailToken = await computeToken(payload.email);
    vi.stubGlobal('fetch', mockGoogleOk(payload));

    const env = makeEnv({ [emailToken]: { name: 'Legacy User' } });
    const res = await worker.fetch(verifyRequest(), env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userData.name).toBe('Legacy User');
  });

  it('auto-upgrades: writes sub_token and deletes email_token on email fallback', async () => {
    const payload = googlePayload();
    const subToken = await computeToken(payload.sub);
    const emailToken = await computeToken(payload.email);
    vi.stubGlobal('fetch', mockGoogleOk(payload));

    const env = makeEnv({ [emailToken]: { name: 'Legacy User' } });
    await worker.fetch(verifyRequest(), env);

    expect(env.USERS._store.has(emailToken)).toBe(false);
    expect(env.USERS._store.has(subToken)).toBe(true);

    const upgraded = JSON.parse(env.USERS._store.get(subToken));
    expect(upgraded.name).toBe('Legacy User');
  });

  it('does not auto-upgrade when sub_token already present', async () => {
    const payload = googlePayload();
    const subToken = await computeToken(payload.sub);
    vi.stubGlobal('fetch', mockGoogleOk(payload));

    const env = makeEnv({ [subToken]: { name: 'Already Upgraded' } });
    const kvPutSpy = vi.spyOn(env.USERS, 'put');
    await worker.fetch(verifyRequest(), env);

    expect(kvPutSpy).not.toHaveBeenCalled();
  });
});

// ── /compute-token ────────────────────────────────────────────────────────────

describe('POST /compute-token', () => {
  function tokenRequest(email, authHeader, name) {
    return new Request('https://worker.dev/compute-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(name !== undefined ? { email, name } : { email }),
    });
  }

  it('returns 401 without Authorization header', async () => {
    const res = await worker.fetch(tokenRequest('a@b.com', null), makeEnv());
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong PAT', async () => {
    const res = await worker.fetch(tokenRequest('a@b.com', 'Bearer wrong-pat'), makeEnv());
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing email', async () => {
    const req = new Request('https://worker.dev/compute-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-pat',
      },
      body: JSON.stringify({}),
    });
    const res = await worker.fetch(req, makeEnv());
    expect(res.status).toBe(400);
  });

  it('returns 200 with HMAC token for valid email + correct PAT', async () => {
    const res = await worker.fetch(tokenRequest('user@gmail.com', 'Bearer test-pat'), makeEnv());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBeDefined();
    expect(body.token).toHaveLength(64); // SHA-256 → 32 bytes → 64 hex chars
  });

  it('produces the same token for the same email on repeated calls (deterministic)', async () => {
    const env = makeEnv();
    const r1 = await worker.fetch(tokenRequest('user@gmail.com', 'Bearer test-pat'), env);
    const r2 = await worker.fetch(tokenRequest('user@gmail.com', 'Bearer test-pat'), env);
    const t1 = (await r1.json()).token;
    const t2 = (await r2.json()).token;
    expect(t1).toBe(t2);
  });

  it('token matches expected HMAC-SHA256(GLOBAL_SALT, email)', async () => {
    const res = await worker.fetch(tokenRequest('user@gmail.com', 'Bearer test-pat'), makeEnv());
    const { token } = await res.json();
    const expected = await computeToken('user@gmail.com');
    expect(token).toBe(expected);
  });

  it('produces different tokens for different emails', async () => {
    const env = makeEnv();
    const r1 = await worker.fetch(tokenRequest('alice@gmail.com', 'Bearer test-pat'), env);
    const r2 = await worker.fetch(tokenRequest('bob@gmail.com', 'Bearer test-pat'), env);
    expect((await r1.json()).token).not.toBe((await r2.json()).token);
  });

  it('upserts {name} to KV immediately when name is provided', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      tokenRequest('user@gmail.com', 'Bearer test-pat', 'Ngon'),
      env,
    );
    expect(res.status).toBe(200);
    const { token } = await res.json();

    expect(env.USERS._store.has(token)).toBe(true);
    const stored = JSON.parse(env.USERS._store.get(token));
    expect(stored.name).toBe('Ngon');
  });

  it('does not touch KV when name is absent', async () => {
    const env = makeEnv();
    const kvPutSpy = vi.spyOn(env.USERS, 'put');
    await worker.fetch(tokenRequest('user@gmail.com', 'Bearer test-pat'), env);
    expect(kvPutSpy).not.toHaveBeenCalled();
  });
});
