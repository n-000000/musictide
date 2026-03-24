# Sveltia CMS Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Sveltia CMS into musictide so the photographer can create articles, manage ads, and maintain staff profiles entirely from a browser UI at `/admin/`.

**Architecture:** Sveltia CMS is served as a static SPA at `/admin/` (loaded from CDN via `static/admin/index.html`). GitHub OAuth is handled by the `sveltia-cms-auth` Cloudflare Worker (official Sveltia project — Cloudflare Pages has no built-in CMS OAuth proxy; that is a Netlify-only feature). Media uploads go browser → R2 Upload Worker → R2 bucket via `R2.put()` directly; the Worker returns the public R2 URL. The original brainstorm proposed pre-signed URLs (browser → R2 directly), but that requires ~100 lines of S3 Signature V4 crypto in the Worker with no practical benefit at this scale (~100 uploads/month). Direct proxy is simpler, correct, and well within the Workers free tier. All CMS-authored content is committed to GitHub by Sveltia, which triggers a Cloudflare Pages rebuild automatically.

**Tech Stack:** Hugo 0.158.0 + Blowfish v2, Sveltia CMS (CDN, pinned version), Cloudflare Workers (Wrangler v3), Cloudflare R2, GitHub OAuth

---

## Prerequisite: Wrangler CLI

Before starting Tasks 2–3, ensure Wrangler v3 is installed and authenticated:

```bash
npm install -g wrangler
wrangler login    # opens browser for Cloudflare auth
wrangler whoami   # verify
```

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `config/_default/hugo.yaml` | Modify | Add `events` taxonomy; add `events` to related indices |
| `config/_default/params.yaml` | Modify | Set `article.showAuthor: false` (only one author now; flip when multiple staff exist) |
| `content/posts/_index.md` | Create | PT section index for articles |
| `content/posts/_index.en.md` | Create | EN section index for articles |
| `content/ads/_index.md` | Create | PT section index for ads |
| `content/ads/_index.en.md` | Create | EN section index for ads |
| `content/authors/_index.md` | Create | PT section index for staff/contributors |
| `content/authors/_index.en.md` | Create | EN section index for staff/contributors |
| `.gitignore` | Modify | Exclude `workers/**/node_modules` and `workers/**/.wrangler` |
| `static/admin/index.html` | Create | Loads Sveltia from CDN (pinned version); loads and registers R2 media plugin |
| `static/admin/config.yml` | Create | Sveltia config: backend, media library, three collections |
| `static/admin/r2-media-plugin.js` | Create | Custom Sveltia media library plugin wired to R2 upload Worker |
| `workers/r2-upload/index.js` | Create | Cloudflare Worker: `POST /upload` stores file in R2, `GET /list` lists files |
| `workers/r2-upload/wrangler.toml` | Create | Worker config: R2 binding, public URL env var |

**Not in this repo (external deploy):**
- `sveltia-cms-auth` Worker — cloned from `https://github.com/sveltia/sveltia-cms-auth` and deployed separately

---

## Task 1: Hugo Config — Events Taxonomy + Content Sections

**Files:**
- Modify: `config/_default/hugo.yaml`
- Modify: `config/_default/params.yaml`
- Modify: `.gitignore`
- Create: `content/posts/_index.md`, `content/posts/_index.en.md`
- Create: `content/ads/_index.md`, `content/ads/_index.en.md`
- Create: `content/authors/_index.md`, `content/authors/_index.en.md`

- [ ] **Step 1.1: Add `events` taxonomy to hugo.yaml**

In `config/_default/hugo.yaml`, add `event: events` to the existing `taxonomies:` block (one line only — do not replace the entire block):

```yaml
taxonomies:
  tag: tags
  category: categories
  author: authors
  series: series
  event: events        # ← add this line
```

Add an `events` entry to the existing `related.indices` list:

```yaml
    - name: events
      weight: 80
```

Insert it between `authors` and `date`.

- [ ] **Step 1.2: Disable global author display in params.yaml**

In `config/_default/params.yaml`, change `showAuthor` under the `article:` block from `true` to `false`:

```yaml
article:
  showDate: true
  showAuthor: false     # was true — only one author now; flip to true if/when multiple staff exist
```

- [ ] **Step 1.3: Create section index files**

`content/posts/_index.md`:
```markdown
---
title: "Artigos"
---
```

`content/posts/_index.en.md`:
```markdown
---
title: "Articles"
---
```

`content/ads/_index.md`:
```markdown
---
title: "Publicidade"
---
```

`content/ads/_index.en.md`:
```markdown
---
title: "Ads"
---
```

`content/authors/_index.md`:
```markdown
---
title: "Colaboradores"
---
```

`content/authors/_index.en.md`:
```markdown
---
title: "Contributors"
---
```

- [ ] **Step 1.4: Add workers to .gitignore**

Append to `.gitignore`:

```
# Cloudflare Workers
workers/**/node_modules
workers/**/.wrangler
```

- [ ] **Step 1.5: Verify build**

```bash
hugo 2>&1
```

Expected: zero `ERROR` lines. The Blowfish version `WARN` is acceptable.

- [ ] **Step 1.6: Commit**

```bash
git add config/_default/hugo.yaml config/_default/params.yaml content/ .gitignore
git commit -m "feat: add events taxonomy, content sections, and workers gitignore"
```

---

## Task 2: GitHub OAuth App + sveltia-cms-auth Worker

This task is entirely external to the repo. It sets up the auth backend that Sveltia needs to write back to GitHub.

> **Note:** Cloudflare Pages has no built-in CMS OAuth proxy. The `sveltia-cms-auth` Worker is the official Sveltia-recommended approach for Cloudflare Pages deployments.

- [ ] **Step 2.1: Register GitHub OAuth App**

Go to: GitHub → Settings → Developer settings → OAuth Apps → New OAuth App

Fill in:
- **Application name:** Musictide CMS
- **Homepage URL:** `https://musictide.pages.dev`
- **Authorization callback URL:** `https://musictide-cms-auth.workers.dev/callback`
  *(placeholder — update after deploy in Step 2.3)*

Save the **Client ID** and generate a **Client Secret**. Keep both.

- [ ] **Step 2.2: Clone and deploy sveltia-cms-auth**

```bash
git clone https://github.com/sveltia/sveltia-cms-auth /tmp/sveltia-cms-auth
cd /tmp/sveltia-cms-auth
npm install

# Wrangler will prompt for the value of each secret
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET

wrangler deploy
```

Note the deployed Worker URL (e.g., `https://sveltia-cms-auth.<subdomain>.workers.dev`).

- [ ] **Step 2.3: Update GitHub OAuth App callback URL**

Go back to the GitHub OAuth App settings and update the callback URL to the exact Worker URL:

`https://<your-worker-url>.workers.dev/callback`

- [ ] **Step 2.4: Record the auth base_url**

Write down: `https://<your-worker-url>.workers.dev`

You'll use this in `static/admin/config.yml` in Task 5.

---

## Task 3: R2 Upload Worker

**Files:**
- Create: `workers/r2-upload/wrangler.toml`
- Create: `workers/r2-upload/index.js`

> **Security note:** The `/upload` endpoint accepts unauthenticated requests. Anyone who discovers the Worker URL can upload files to the R2 bucket. This is a known gap, acceptable for Phase 1 at this site's scale. Adding GitHub token validation is listed under Future Work.

- [ ] **Step 3.1: Create the Worker directory**

```bash
mkdir -p workers/r2-upload
```

- [ ] **Step 3.2: Write wrangler.toml**

`workers/r2-upload/wrangler.toml`:
```toml
name = "musictide-media-upload"
main = "index.js"
compatibility_date = "2025-01-01"

[[r2_buckets]]
binding = "R2"
bucket_name = "musictide-media"

[vars]
PUBLIC_BASE_URL = "https://pub-576ea11202f543d0bf28d36ef63d18ff.r2.dev"
ALLOWED_ORIGIN = "https://musictide.pages.dev"
```

- [ ] **Step 3.3: Write index.js**

`workers/r2-upload/index.js`:
```javascript
// SECURITY NOTE: /upload is unauthenticated. Adding GitHub token validation
// is deferred to a future phase. See plan Future Work section.

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // POST /upload — store a file in R2, return its public URL
    if (request.method === 'POST' && url.pathname === '/upload') {
      const formData = await request.formData();
      const file = formData.get('file');
      if (!file) {
        return new Response(JSON.stringify({ error: 'No file provided' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const key = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      await env.R2.put(key, file, {
        httpMetadata: { contentType: file.type },
      });

      return new Response(JSON.stringify({ url: `${env.PUBLIC_BASE_URL}/${key}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /list — list files in the bucket (max 1000; truncation logged if exceeded)
    if (request.method === 'GET' && url.pathname === '/list') {
      const listed = await env.R2.list();
      if (listed.truncated) {
        console.warn('R2 list truncated at 1000 objects — implement cursor pagination if needed');
      }
      const files = listed.objects.map((obj) => ({
        name: obj.key,
        url: `${env.PUBLIC_BASE_URL}/${obj.key}`,
        size: obj.size,
        uploaded: obj.uploaded,
      }));
      return new Response(JSON.stringify(files), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not found', { status: 404, headers: corsHeaders });
  },
};
```

- [ ] **Step 3.4: Test locally**

```bash
cd workers/r2-upload
wrangler dev --remote    # --remote required to access the real R2 bucket
```

In a second terminal:

```bash
# Test upload
curl -X POST http://localhost:8787/upload \
  -F "file=@/path/to/any/test-image.jpg"
```

Expected: `{"url":"https://pub-576ea11202f543d0bf28d36ef63d18ff.r2.dev/1234567890-test-image.jpg"}`

```bash
# Test list
curl http://localhost:8787/list
```

Expected: JSON array containing the test upload.

- [ ] **Step 3.5: Deploy**

```bash
cd workers/r2-upload
wrangler deploy
```

Note the deployed URL (e.g., `https://musictide-media-upload.<subdomain>.workers.dev`).

- [ ] **Step 3.6: Smoke-test deployed Worker**

```bash
curl -X POST https://musictide-media-upload.<subdomain>.workers.dev/upload \
  -F "file=@/path/to/test-image.jpg"
```

Expected: JSON response with R2 public URL.

- [ ] **Step 3.7: Commit Worker code**

```bash
cd /home/n0xx/Code/infra/service/musictide
git add workers/
git commit -m "feat: add R2 upload Worker (POST /upload, GET /list)"
```

---

## Task 4: Sveltia Admin UI + R2 Media Plugin + CMS Config

> **Important:** Do NOT push to GitHub until all three files in this task are committed. Pushing `index.html` without `config.yml` will serve a broken CMS.

**Files:**
- Create: `static/admin/index.html`
- Create: `static/admin/r2-media-plugin.js`
- Create: `static/admin/config.yml`

- [ ] **Step 4.1: Pin the Sveltia CMS version**

Check the latest stable release at `https://github.com/sveltia/sveltia-cms/releases`. Note the version number (e.g., `0.41.0`). You will use it in Step 4.3.

- [ ] **Step 4.2: Write r2-media-plugin.js**

Replace `<WORKER_URL>` with the deployed Worker URL from Task 3 Step 3.5.

Note: this file uses a global variable (`window.R2MediaLibrary`) rather than ES module exports to avoid script load-order issues in the browser.

`static/admin/r2-media-plugin.js`:
```javascript
// R2 media library plugin for Sveltia CMS
// Loaded as a plain script (not an ES module) — sets window.R2MediaLibrary.
// Registration happens in index.html after both this script and Sveltia have loaded.

const WORKER_URL = 'https://musictide-media-upload.<subdomain>.workers.dev';

function createMediaDialog(onInsert) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center';

  const dialog = document.createElement('div');
  dialog.style.cssText = 'background:#fff;border-radius:8px;padding:24px;min-width:480px;max-width:640px;width:90%';

  dialog.innerHTML = `
    <h2 style="margin:0 0 16px;font-size:18px">Carregar Imagem</h2>
    <input type="file" id="r2-file-input" accept="image/*,video/*" style="display:block;margin-bottom:16px">
    <div id="r2-status" style="font-size:14px;color:#666;margin-bottom:16px"></div>
    <div id="r2-file-list" style="max-height:280px;overflow-y:auto;border:1px solid #ddd;border-radius:4px;margin-bottom:16px"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button id="r2-cancel" style="padding:8px 16px;border:1px solid #ccc;border-radius:4px;cursor:pointer;background:#fff">Cancelar</button>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  const statusEl = dialog.querySelector('#r2-status');
  const fileListEl = dialog.querySelector('#r2-file-list');
  const fileInput = dialog.querySelector('#r2-file-input');

  function close() {
    document.body.removeChild(overlay);
  }

  dialog.querySelector('#r2-cancel').onclick = close;
  overlay.onclick = (e) => { if (e.target === overlay) close(); };

  // Load existing files from R2
  statusEl.textContent = 'A carregar ficheiros…';
  fetch(`${WORKER_URL}/list`)
    .then((r) => r.json())
    .then((files) => {
      statusEl.textContent = files.length ? '' : 'Sem ficheiros. Carregue um abaixo.';
      fileListEl.innerHTML = files
        .sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded))
        .map(
          (f) =>
            `<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;cursor:pointer;border-bottom:1px solid #eee" data-url="${f.url}" data-name="${f.name}" class="r2-file-item">
              <img src="${f.url}" style="width:40px;height:40px;object-fit:cover;border-radius:3px" onerror="this.style.display='none'">
              <span style="font-size:12px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.name}</span>
            </div>`
        )
        .join('');

      fileListEl.querySelectorAll('.r2-file-item').forEach((item) => {
        item.onclick = () => {
          onInsert({ url: item.dataset.url, alt: item.dataset.name });
          close();
        };
      });
    })
    .catch(() => { statusEl.textContent = 'Erro ao carregar lista de ficheiros.'; });

  // Upload a new file
  fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    statusEl.textContent = `A carregar ${file.name}…`;
    fileInput.disabled = true;

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${WORKER_URL}/upload`, { method: 'POST', body: formData });
      const { url, error } = await res.json();
      if (error) throw new Error(error);
      onInsert({ url, alt: file.name });
      close();
    } catch (err) {
      statusEl.textContent = `Erro: ${err.message}`;
      fileInput.disabled = false;
    }
  };
}

window.R2MediaLibrary = {
  name: 'r2',
  init: () => ({
    show: ({ onInsert }) => createMediaDialog(onInsert),
    hide: () => {},
    enableStandalone: () => false,
  }),
};
```

- [ ] **Step 4.3: Write index.html**

Replace `<VERSION>` with the version noted in Step 4.1 (e.g., `0.41.0`).

`static/admin/index.html`:
```html
<!doctype html>
<html lang="pt">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Musictide CMS</title>
    <!-- Pin version — do not use @latest. Check https://github.com/sveltia/sveltia-cms/releases for updates. -->
    <script src="https://unpkg.com/sveltia-cms@<VERSION>/dist/sveltia-cms.js"></script>
    <script src="./r2-media-plugin.js"></script>
  </head>
  <body>
    <script>
      window.CMS.registerMediaLibrary(window.R2MediaLibrary);
    </script>
  </body>
</html>
```

- [ ] **Step 4.4: Write config.yml**

Replace `<AUTH_WORKER_URL>` with the URL from Task 2 Step 2.4.

`static/admin/config.yml`:
```yaml
backend:
  name: github
  repo: n-000000/musictide
  branch: main
  base_url: https://<AUTH_WORKER_URL>.workers.dev

media_library:
  name: r2

locale: pt

collections:

  # ── ARTIGOS ──────────────────────────────────────────────────
  - name: posts
    label: Artigos
    label_singular: Artigo
    folder: content/posts
    create: true
    slug: "{{slug}}"
    preview_path: "posts/{{slug}}"
    fields:

      - label: Título
        name: title
        widget: string

      - label: Data
        name: date
        widget: datetime
        date_format: DD-MM-YYYY
        time_format: HH:mm
        format: YYYY-MM-DDTHH:mm:ssZ
        default: ""    # Sveltia fills with current datetime on creation

      - label: Slug
        name: slug
        widget: string
        required: false
        hint: "Deixe em branco para gerar automaticamente a partir do título"

      - label: Etiquetas
        name: tags
        widget: list
        required: false
        hint: "Palavras-chave separadas por vírgula"

      - label: Evento
        name: event
        widget: string
        required: false
        hint: "Nome exacto do evento para agrupar artigos — use sempre o mesmo formato (ex: Vagos Metal Fest 2025)"

      - label: Autor
        name: author
        widget: string
        required: false
        hint: "Deixe em branco se for o autor principal"

      - label: Texto
        name: body
        widget: markdown

      - label: Galeria
        name: gallery
        widget: list
        required: false
        summary: "{{fields.caption}}"
        fields:
          - label: Imagem
            name: src
            widget: image
            media_library:
              name: r2
          - label: Legenda
            name: caption
            widget: string
            required: false

      - label: Rascunho
        name: draft
        widget: boolean
        default: true

  # ── PUBLICIDADE ──────────────────────────────────────────────
  - name: ads
    label: Publicidade
    label_singular: Anúncio
    folder: content/ads
    create: true
    slug: "{{slug}}"
    fields:

      - label: Título Interno
        name: title
        widget: string
        hint: "Nome interno — não visível no site"

      - label: Data
        name: date
        widget: datetime
        date_format: DD-MM-YYYY
        time_format: HH:mm
        format: YYYY-MM-DDTHH:mm:ssZ
        default: ""

      - label: Activo De
        name: active_from
        widget: datetime
        date_format: DD-MM-YYYY
        time_format: HH:mm
        format: YYYY-MM-DDTHH:mm:ssZ
        required: false
        hint: "Data de início de exibição"

      - label: Activo Até
        name: active_until
        widget: datetime
        date_format: DD-MM-YYYY
        time_format: HH:mm
        format: YYYY-MM-DDTHH:mm:ssZ
        required: false
        hint: "Data de fim de exibição"

      - label: URL de Destino
        name: click_through_url
        widget: string
        pattern: ['^https?://', 'Deve ser uma URL válida (começar com http:// ou https://)']

      - label: Criativo — Imagem
        name: creative_image
        widget: image
        required: false
        media_library:
          name: r2
        hint: "Preencha este campo OU o campo HTML abaixo, não ambos"

      - label: Criativo — HTML
        name: creative_html
        widget: code
        default_language: html
        required: false
        hint: "HTML auto-contido (sem scripts externos). Alternativa à imagem acima."

      - label: Notas Internas
        name: notes
        widget: text
        required: false

      - label: Rascunho
        name: draft
        widget: boolean
        default: true

  # ── COLABORADORES ─────────────────────────────────────────────
  - name: authors
    label: Colaboradores
    label_singular: Colaborador
    folder: content/authors
    create: true
    slug: "{{slug}}"
    fields:

      - label: Nome
        name: title
        widget: string

      - label: Foto
        name: photo
        widget: image
        required: false
        media_library:
          name: r2

      - label: Bio
        name: body
        widget: markdown
        required: false

      - label: Email
        name: email
        widget: string
        required: false

      - label: Instagram
        name: instagram
        widget: string
        required: false
        hint: "Só o handle, sem @ (ex: musictide_pt)"

      - label: Rascunho
        name: draft
        widget: boolean
        default: false
```

- [ ] **Step 4.5: Verify build**

```bash
hugo 2>&1
```

Expected: zero `ERROR` lines. Confirm admin files appear in build output:

```bash
ls public/admin/
```

Expected: `config.yml`, `index.html`, `r2-media-plugin.js`

- [ ] **Step 4.6: Local smoke test**

```bash
yarn watch
```

Open `http://localhost:1313/admin/` in a browser.

Expected: Sveltia CMS loads and shows a "Login with GitHub" button. Two things will fail locally — both are expected and not bugs:
1. **OAuth**: authentication will fail (no OAuth on localhost)
2. **Media library**: any attempt to use the R2 media picker will be blocked by CORS (`ALLOWED_ORIGIN` in the Worker is set to the production domain only)

What you must NOT see: a blank page, a JS console error on initial page load, or a 404 for the admin files.

- [ ] **Step 4.7: Commit all three admin files together**

```bash
git add static/admin/
git commit -m "feat: add Sveltia admin UI, R2 media plugin, and CMS config"
```

---

## Task 5: Deploy + End-to-End Test

- [ ] **Step 5.1: Push to Cloudflare Pages**

```bash
git push origin main
```

Watch the Cloudflare Pages dashboard. Expected: build succeeds, no errors.

- [ ] **Step 5.2: Open the CMS**

Navigate to `https://musictide.pages.dev/admin/`.

Expected: Sveltia CMS login screen.

- [ ] **Step 5.3: Log in via GitHub OAuth**

Click "Login with GitHub". Complete the GitHub OAuth flow.

Expected: redirected back to `/admin/`, CMS collections visible (Artigos, Publicidade, Colaboradores).

- [ ] **Step 5.4: Create a test article**

In Sveltia: **Artigos → New Artigo**

Fill in:
- Título: `Teste CMS`
- Tags: `teste`
- Body: any text
- Galeria: click "Add gallery item" → upload any photo via the R2 plugin

Expected: upload completes, R2 URL (`pub-576ea...r2.dev/...`) appears in the gallery field.

- [ ] **Step 5.5: Verify photo in R2**

```bash
curl -I https://pub-576ea11202f543d0bf28d36ef63d18ff.r2.dev/<filename-from-step-5.4>
```

Expected: HTTP 200, `content-type: image/jpeg` (or similar).

- [ ] **Step 5.6: Save and verify GitHub commit**

In Sveltia, save the article as draft.

Expected: a new commit appears in `https://github.com/n-000000/musictide` with file at `content/posts/teste-cms.md`.

- [ ] **Step 5.7: Verify Cloudflare Pages rebuild**

Expected: Cloudflare Pages detects the commit and triggers a new build. Build succeeds.

- [ ] **Step 5.8: Clean up test article**

In Sveltia, delete the test article. Verify the deletion commit appears in GitHub.

---

## Future Work (out of scope for this plan)

- **Events metadata (Phase 2):** Add `content/events/<term>/_index.md` content files + `layouts/events/term.html` template with conditional banner/description display. Add an `Events` collection to Sveltia config.
- **Ads display (Phase 2):** Add `layouts/ads/single.html` + client-side JS to interleave active ads into article listings.
- **Worker upload auth:** Validate the GitHub Bearer token on `POST /upload` to prevent anonymous uploads.
- **R2 list pagination:** Add cursor-based pagination to `GET /list` when bucket exceeds 1,000 objects.
- **EN translation:** Add `i18n` config to Sveltia collections and bilingual authoring workflow when needed.
- **Author conditional display:** Flip `showAuthor: true` in `params.yaml` (or create a custom partial) once multiple staff members are added.
- **Sveltia version updates:** Periodically check `https://github.com/sveltia/sveltia-cms/releases` and update the version pin in `static/admin/index.html`.
