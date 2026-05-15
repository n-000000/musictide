# CMS User Management via GitHub Webhook → KV Sync

**Date:** 2026-05-15  
**Status:** Approved

## Problem

CMS user access is controlled by a Cloudflare KV namespace (`USERS`), mapping Google email addresses to `{"name":"...","login":"..."}`. Currently only the developer can add/remove users via `wrangler kv key put`. The photographer needs to manage contributors without developer involvement.

## Approach

Sveltia CMS `users` collection → files committed to `data/cms-users/` in GitHub → GitHub push webhook → `musictide-auth` Worker syncs KV.

No GitHub Actions. No Cloudflare API token in GitHub. Credentials stay in Cloudflare.

## Design

### 1. CMS Collection

New folder collection added to `static/admin/config.yml`:

- **name:** `cms-users`
- **label:** `Utilizadores`
- **folder:** `data/cms-users`
- **create:** `true`
- **format:** `json` / **extension:** `json`
- **identifier_field:** `name`

Fields:

| Field   | Widget | Required | Notes                                      |
|---------|--------|----------|--------------------------------------------|
| `name`  | string | yes      | Display name; drives filename slug         |
| `email` | string | yes      | Google email — becomes the KV key          |
| `login` | string | no       | Author slug (`content/authors/`); stored for future wiring |

Files are stored as `data/cms-users/<name-slug>.json`. Hugo does not read these files.

### 2. Auth Worker — `/sync-users` Endpoint

New `POST /sync-users` handler added to `workers/musictide-auth/src/index.js`.

**Flow:**

1. Verify `X-Hub-Signature-256` header — HMAC-SHA256 of raw request body using `WEBHOOK_SECRET`. Reject with 401 if invalid or missing.
2. Check `X-GitHub-Event` header — must be `push`. Return 200 (no-op) for all other event types.
3. Check push branch — must be `main` (or `refs/heads/main`). Return 200 for other branches.
4. Scan all commits in the payload (`commits[].added`, `commits[].modified`, `commits[].removed`) for any path beginning with `data/cms-users/`. Return 200 immediately if none match — the vast majority of pushes are article publishes.
5. Run **full KV sync**:
   a. Fetch directory listing from GitHub Contents API: `GET https://api.github.com/repos/n-000000/musictide/contents/data/cms-users` (public repo, no auth needed).
   b. Fetch and `JSON.parse()` each file's content (base64-decoded from the API response).
   c. Build desired state: `Map<email, {name, login}>`.
   d. Call `env.USERS.list()` to get current KV keys.
   e. Delete any KV key not present in desired state.
   f. `env.USERS.put(email, JSON.stringify({name, login}))` for every entry.
6. Return 200 on success, 500 on any GitHub API or KV error (GitHub retries on 5xx).

**Why full sync instead of incremental:** When a file is deleted, its content is gone by the time the webhook fires. The filename slug alone cannot reliably recover the email (the KV key). Full sync sidesteps this: it computes the desired state from what exists in the repo right now and reconciles against current KV state. Safe and idempotent.

**New secret:** `WEBHOOK_SECRET` — added via `npx wrangler secret put WEBHOOK_SECRET --name musictide-auth`.

### 3. One-Time Setup (manual, not code)

After deploying the Worker:

1. Generate a random webhook secret (e.g. `openssl rand -hex 32`).
2. `npx wrangler secret put WEBHOOK_SECRET --name musictide-auth` → paste the value.
3. In GitHub repo settings → Webhooks → Add webhook:
   - **Payload URL:** `https://musictide-auth.leftfield.workers.dev/sync-users`
   - **Content type:** `application/json`
   - **Secret:** same value
   - **Events:** Just the `push` event
   - **Active:** yes

## Out of Scope

- Role-based access (Sveltia has no permission system — all logged-in users can edit the `users` collection; honor system)
- Enabled/disabled toggle (delete = revoke access; KV is the whitelist)
- EN translations for the CMS collection labels
- Connecting `login` field to `content/authors/` (deferred — field is stored for future wiring)

## Files Changed

| File | Change |
|------|--------|
| `static/admin/config.yml` | Add `cms-users` collection |
| `workers/musictide-auth/src/index.js` | Add `POST /webhook` handler |
| `workers/musictide-auth/wrangler.toml` | No change needed (KV binding already present) |
