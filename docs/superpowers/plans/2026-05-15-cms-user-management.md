# CMS User Management — GitHub Webhook → KV Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the photographer add/remove CMS users via Sveltia, with changes automatically synced to the Cloudflare KV whitelist via a GitHub push webhook hitting the musictide-auth Worker.

**Architecture:** A `cms-users` Sveltia collection stores one JSON file per user in `data/cms-users/`. A GitHub push webhook calls `POST /sync-users` on `musictide-auth`. The Worker verifies the HMAC-SHA256 signature, checks if user files changed, then fetches all files from the GitHub Contents API and reconciles the `USERS` KV namespace — upserting active users and deleting removed ones.

**Tech Stack:** Cloudflare Workers (existing `musictide-auth`), Cloudflare KV (`USERS` namespace, existing), GitHub push webhook, Sveltia CMS YAML config

---

## File Map

| File | Change |
|------|--------|
| `static/admin/config.yml` | Add `cms-users` folder collection |
| `workers/musictide-auth/src/index.js` | Add `syncUsers()`, `handleSyncUsers()`, new route in `fetch` handler, update top-of-file comment |

---

### Task 1: Add cms-users collection to Sveltia config

**Files:**
- Modify: `static/admin/config.yml`

- [ ] **Step 1: Append the cms-users collection**

Add at the very end of `static/admin/config.yml`, after the closing block of the `settings` collection:

```yaml
  # ── UTILIZADORES CMS ─────────────────────────────────────────
  - name: cms-users
    label: Utilizadores
    label_singular: Utilizador
    folder: data/cms-users
    create: true
    format: json
    extension: json
    identifier_field: name
    fields:

      - label: Nome
        name: name
        widget: string
        hint: "Nome completo — usado como nome de autor nos commits git"

      - label: Email Google
        name: email
        widget: string
        hint: "Endereço Gmail com que o utilizador faz login no CMS"

      - label: Slug de Autor
        name: login
        widget: string
        required: false
        hint: "Slug da página de colaborador em /colaboradores/ (ex: joao-silva). Opcional."
```

- [ ] **Step 2: Verify Hugo build succeeds**

```bash
hugo 2>&1
```

Expected: zero `ERROR` lines. The `WARN` about Blowfish version compatibility is acceptable.

- [ ] **Step 3: Commit**

```bash
git add static/admin/config.yml
git commit -m "feat: add cms-users collection to Sveltia config"
```

---

### Task 2: Add syncUsers() to the Worker

**Files:**
- Modify: `workers/musictide-auth/src/index.js`

- [ ] **Step 1: Insert syncUsers() before handleAuth()**

In `workers/musictide-auth/src/index.js`, insert this function between the `jsonResponse` helper and the `handleAuth` function:

```javascript
async function syncUsers(env) {
  const listRes = await fetch(
    'https://api.github.com/repos/n-000000/musictide/contents/data/cms-users',
    { headers: { 'User-Agent': 'musictide-auth' } }
  );
  if (listRes.status === 404) return; // directory not yet created — nothing to sync
  if (!listRes.ok) throw new Error('GitHub API ' + listRes.status);

  const files = await listRes.json();

  const desired = new Map();
  await Promise.all(
    files
      .filter(f => f.type === 'file' && f.name.endsWith('.json'))
      .map(async f => {
        const r = await fetch(f.download_url, { headers: { 'User-Agent': 'musictide-auth' } });
        if (!r.ok) return;
        const data = await r.json();
        if (data.email) desired.set(data.email, { name: data.name || '', login: data.login || '' });
      })
  );

  const { keys } = await env.USERS.list();
  const current = new Set(keys.map(k => k.name));

  await Promise.all([
    ...[...current].filter(k => !desired.has(k)).map(k => env.USERS.delete(k)),
    ...[...desired.entries()].map(([email, rec]) => env.USERS.put(email, JSON.stringify(rec))),
  ]);
}
```

- [ ] **Step 2: Commit**

```bash
git add workers/musictide-auth/src/index.js
git commit -m "feat: add syncUsers() to musictide-auth Worker"
```

---

### Task 3: Add handleSyncUsers() to the Worker

**Files:**
- Modify: `workers/musictide-auth/src/index.js`

- [ ] **Step 1: Insert handleSyncUsers() after syncUsers()**

Insert this function immediately after `syncUsers`:

```javascript
async function handleSyncUsers(request, env) {
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

  if (sig !== expected) return new Response('Invalid signature', { status: 401 });

  const event = request.headers.get('X-GitHub-Event');
  if (event !== 'push') return new Response('OK', { status: 200 });

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(body));
  } catch {
    return new Response('Invalid payload', { status: 400 });
  }

  if (payload.ref !== 'refs/heads/main') return new Response('OK', { status: 200 });

  const touchesUsers = payload.commits.some(c =>
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
```

- [ ] **Step 2: Commit**

```bash
git add workers/musictide-auth/src/index.js
git commit -m "feat: add handleSyncUsers() to musictide-auth Worker"
```

---

### Task 4: Wire /sync-users into the fetch handler and update docs

**Files:**
- Modify: `workers/musictide-auth/src/index.js`

- [ ] **Step 1: Add the route**

In the `fetch` handler, add the `/sync-users` route after the `/verify` block and before the `/` health check:

```javascript
    if (pathname === '/sync-users' && request.method === 'POST') {
      return handleSyncUsers(request, env);
    }
```

- [ ] **Step 2: Update the top-of-file comment**

Replace the `Endpoints:` block in the JSDoc comment:

```javascript
 * Endpoints:
 *   GET /auth?provider=github&site_id=<domain>  — serve GIS login page
 *   POST /verify                                 — verify GIS credential JWT
 *   OPTIONS *                                    — CORS preflight
 *   GET /                                        — health check
```

with:

```javascript
 * Endpoints:
 *   GET /auth?provider=github&site_id=<domain>  — serve GIS login page
 *   POST /verify                                 — verify GIS credential JWT
 *   POST /sync-users                             — GitHub push webhook → KV sync
 *   OPTIONS *                                    — CORS preflight
 *   GET /                                        — health check
```

And replace the `Required secrets` line:

```javascript
 *   GOOGLE_CLIENT_ID, GITHUB_SERVICE_ACCOUNT_PAT
```

with:

```javascript
 *   GOOGLE_CLIENT_ID, GITHUB_SERVICE_ACCOUNT_PAT, WEBHOOK_SECRET
```

- [ ] **Step 3: Commit**

```bash
git add workers/musictide-auth/src/index.js
git commit -m "feat: wire POST /sync-users route in musictide-auth"
```

---

### Task 5: Add WEBHOOK_SECRET and deploy

No file changes — secrets and wrangler deploy only.

- [ ] **Step 1: Generate a webhook secret**

```bash
openssl rand -hex 32
```

Copy the output. You'll use this value in steps 2 and Task 6.

- [ ] **Step 2: Add the secret to the Worker**

```bash
npx wrangler secret put WEBHOOK_SECRET --name musictide-auth
```

Paste the value when prompted.

- [ ] **Step 3: Deploy the Worker**

```bash
cd workers/musictide-auth && npx wrangler deploy
```

Expected: output ends with a line like `Deployed musictide-auth triggers (1 total)`.

- [ ] **Step 4: Smoke-test the endpoint rejects unsigned requests**

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST \
  https://musictide-auth.leftfield.workers.dev/sync-users
```

Expected: `401`

---

### Task 6: Configure GitHub webhook

No code changes — done in the GitHub repo settings UI.

- [ ] **Step 1: Open the add-webhook page**

Go to: `https://github.com/n-000000/musictide/settings/hooks/new`

- [ ] **Step 2: Fill in the form**

  - **Payload URL:** `https://musictide-auth.leftfield.workers.dev/sync-users`
  - **Content type:** `application/json`
  - **Secret:** the value generated in Task 5 Step 1
  - **Which events to trigger:** Just the `push` event
  - **Active:** checked

Click **Add webhook**.

- [ ] **Step 3: Verify the ping delivery**

GitHub sends a `ping` event immediately after saving. In the webhook's **Recent Deliveries** tab, confirm the ping shows a green tick and the Worker responded `200 OK`.

---

### Task 7: End-to-end smoke test

- [ ] **Step 1: Check current KV state**

```bash
npx wrangler kv key list --namespace-id 1f6af293b61b4e989bc65e3c94ea21b3 --remote
```

Note the existing keys — you'll verify nothing is lost after the test.

- [ ] **Step 2: Push a test user file**

```bash
mkdir -p data/cms-users
echo '{"name":"Test User","email":"test-nonexistent@example.com","login":"test-user"}' \
  > data/cms-users/test-user.json
git add data/cms-users/test-user.json
git commit -m "test: add test cms user"
git push
```

- [ ] **Step 3: Confirm webhook delivery**

In `https://github.com/n-000000/musictide/settings/hooks`, open the webhook → **Recent Deliveries**. The push event should appear with a green tick and `200 OK` within seconds of the push.

- [ ] **Step 4: Verify KV was updated**

```bash
npx wrangler kv key list --namespace-id 1f6af293b61b4e989bc65e3c94ea21b3 --remote
```

Expected: `test-nonexistent@example.com` is present.

```bash
npx wrangler kv key get "test-nonexistent@example.com" \
  --namespace-id 1f6af293b61b4e989bc65e3c94ea21b3 --remote
```

Expected: `{"name":"Test User","login":"test-user"}`

- [ ] **Step 5: Clean up and verify deletion**

```bash
git rm data/cms-users/test-user.json
git commit -m "test: remove test cms user"
git push
```

After the push, confirm `test-nonexistent@example.com` is gone:

```bash
npx wrangler kv key list --namespace-id 1f6af293b61b4e989bc65e3c94ea21b3 --remote
```

Expected: key absent. Existing user keys (real users) are unchanged.
