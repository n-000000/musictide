# CMS Assessment & Paths Forward

**Date:** 2026-03-22
**Status:** Assessment complete — awaiting decision on editor approach before next implementation phase.

---

## Current State of Implementation

### What's Done and Working

1. **Hugo foundation** — events taxonomy, content sections (posts, ads, authors with PT+EN indexes), `showAuthor: false`, `.gitignore` for workers
2. **GitHub OAuth** — `sveltia-cms-auth` Worker deployed at `https://sveltia-cms-auth.leftfield.workers.dev`, GitHub OAuth App registered, secrets fixed (were incorrectly named, now `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are set)
3. **R2 Upload Worker** — deployed at `https://musictide-media-upload.leftfield.workers.dev` (POST /upload, GET /list). **Now redundant** — Sveltia's native R2 support uploads directly from browser to R2. Can be removed or kept for non-CMS tooling.
4. **Sveltia CMS** — served at `/admin/`, loads from `https://unpkg.com/@sveltia/cms@0.148.0/dist/sveltia-cms.js` (pinned version), config at `static/admin/config.yml`
5. **R2 native integration** — configured in `config.yml` with `media_libraries.cloudflare_r2` (access_key_id, bucket, account_id, public_url). CORS configured on R2 bucket for musictide.pages.dev + preview deploys + localhost.
6. **Cloudflare Pages** — auto-builds on push to main, live at `https://musictide.pages.dev`

### What's Deployed

- **Cloudflare Pages:** musictide.pages.dev (watches github.com/n-000000/musictide main branch)
- **Cloudflare Workers:**
  - `sveltia-cms-auth.leftfield.workers.dev` — GitHub OAuth proxy for Sveltia CMS
  - `musictide-media-upload.leftfield.workers.dev` — R2 upload proxy (redundant now, see above)
- **R2 Bucket:** `musictide-media`, public URL `https://pub-576ea11202f543d0bf28d36ef63d18ff.r2.dev`
- **R2 API Token:** Account API Token, Object Read & Write on musictide-media bucket
  - Access Key ID: `0bd0a95fb73f463fa74a8cfd52ae8ec6` (in config.yml, safe to commit)
  - Secret Access Key: stored in user's password manager, entered in Sveltia UI on first login per device

### Git State

- All work is on `main` branch (feature/sveltia-cms was rebased and merged)
- Worktree at `.worktrees/feature/sveltia-cms` can be cleaned up
- CLAUDE.md updated with wrangler/npx note

### Known Issues Discovered During E2E Testing

These are the issues the photographer reported after first login:

---

## Issue-by-Issue Assessment

### Quick Fixes (config changes, ~30 min total)

**1. `locale: pt` causes console warning**
- Sveltia CMS does not support the `locale` config option (Netlify CMS legacy)
- Fix: remove `locale: pt` from `static/admin/config.yml`

**2. Slug field is unnecessary**
- Hugo auto-generates slugs from titles
- Fix: remove the slug field from the posts collection config

**3. No cover/front page image field**
- Blowfish uses `featureimage` frontmatter for article hero/cover images
- Also supports: `featureimagecaption` (markdown caption), `imagePosition` (CSS object-position for cropping)
- Fallback chain if no `featureimage`: files matching `*feature*`, `*cover*`, `*thumbnail*`, `*background*` in the page bundle
- Fix: add `featureimage`, `featureimagecaption`, and `imagePosition` fields to the posts collection

**4. Date doesn't auto-fill**
- Sveltia datetime widget supports `default: "{{now}}"` — confirmed in docs
- Fix: add `default: "{{now}}"` to all datetime fields in posts and ads collections

**5. Gallery should allow multi-image select**
- Sveltia's `image` widget supports `multiple: true` — allows selecting/uploading multiple images at once
- Trade-off: loses per-image captions (flat URL array vs list of {src, caption} objects)
- Recommendation: switch to `widget: image, multiple: true` for "fire and forget" workflow; captions in body text
- Alternative: keep current list widget but accept one-at-a-time upload

### Medium Effort (config + JS)

**6. Event field should be searchable**
- Currently: `widget: string` (free text, error-prone for inebriated photographer)
- Option A (simple): `widget: select` with hardcoded event options in config.yml. Developer adds new events. Photographer picks from searchable dropdown. Sveltia shows search when options > 5.
- Option B (better): Make events a mini-collection (`content/events/`, just a `title` field), then use `widget: relation` pointing to it. Photographer can create new events from CMS. Sveltia renders as searchable dropdown.
- Recommendation: Option B (self-service, no developer involvement to add events)

**7. Auto-tagging from title + event always a tag**
- Sveltia has `preSave` event hooks — JS that runs before each save, can modify entry data
- Implementation: add `CMS.registerEventListener({ name: 'preSave', handler: ... })` in `index.html`
- Hook would: auto-generate tags from title words if tags empty, add event name as tag
- Limitation: photographer won't see auto-tags before hitting save (they appear on save)
- Requires adding `<script>` block to `index.html` after Sveltia loads

### Sveltia Limitations (not fixable)

**8. Interface language defaults to English, Portuguese not available**
- Sveltia auto-detects from browser/OS locale
- Portuguese is not in Sveltia's built-in translations
- Chinese appears because Sveltia has a Chinese translation contributed by community
- **Not fixable on our side**

**9. Lorem Ipsum / stock photo import in gallery**
- Sveltia's built-in stock photo integration on image fields
- Ships by default, cannot be disabled via config
- **Not fixable**

**10. Gallery one-at-a-time upload (if keeping list widget with captions)**
- Sveltia's list widget adds items one at a time
- Only fixable by switching to `widget: image, multiple: true` (loses captions)
- **Trade-off decision**

### Architectural Issue: The Editor

**11. Rich text editor is too limiting**
- Sveltia's editor outputs Markdown only
- No image float, no drag-to-resize, no HTML source mode
- HTML mode is on Sveltia's "future plans" list
- Tables also on "future plans"
- This is the most significant issue

---

## Sveltia CMS Capabilities Deep Dive

### What Sveltia CAN Do (confirmed from docs)

- **Compute fields:** read-only fields that auto-generate values from other fields using `{{fields.fieldName}}` templates
- **Hidden fields:** auto-fill with `{{datetime}}`, `{{uuid}}`, `{{author-name}}`, `{{author-email}}`, `{{author-login}}`, `{{locale}}`
- **Image field `multiple: true`:** multi-select, drag-drop multiple files, clipboard paste
- **Select widget:** searchable dropdown (threshold configurable, default 5), multi-select with tag UI
- **Relation widget:** cross-collection references with searchable dropdown
- **Object variable types:** type selector + different field sets per type (page builder pattern)
- **preSave/postSave event hooks:** modify data before/after save
- **MDC-like editor components:** custom registered via JS API (limited)
- **DateTime `{{now}}` default:** auto-fills current datetime on new entry creation
- **i18n support:** per-field localization (true/false/duplicate), multiple structure options
- **Code widget:** syntax-highlighted code editor for raw HTML/CSS/JS

### What Sveltia CANNOT Do

- Rich text with image positioning/float/resize
- HTML source mode in rich text editor (future plan)
- Tables in rich text (future plan)
- Text alignment in rich text (future plan)
- Custom media library plugins (`registerMediaLibrary` is not supported)
- Multiple image pasting in Firefox
- Stock photo integration disable
- Portuguese UI translation
- Remark plugins (uses Lexical, not Slate/Remark)

---

## Three Paths Forward for the Editor

### Path A — Accept Markdown, Redesign Content Model

**Effort:** Minimal (config changes only)
**Idea:** Body text is text-only. All visual content lives in structured fields: cover image (`featureimage`), gallery (`image` widget with `multiple: true`). The Hugo template renders gallery as a visual grid/slideshow, body text as context.

**Pros:**
- No code changes beyond config
- Matches "less text, more media" zine concept
- Foolproof for photographer
- Ships today

**Cons:**
- No inline images in body text at all
- Layout is entirely template-driven, photographer has no control over image placement within text

### Path B — Block-Based Content Model in Sveltia

**Effort:** Medium (config + Hugo template work)
**Idea:** Replace single `body` field with a `content_blocks` list using Sveltia's Object variable types:

```yaml
- label: Conteúdo
  name: content_blocks
  widget: list
  types:
    - label: Texto
      name: text
      fields:
        - { label: Texto, name: body, widget: markdown }
    - label: Imagem
      name: image
      fields:
        - { label: Imagem, name: src, widget: image }
        - { label: Legenda, name: caption, widget: string, required: false }
        - label: Posição
          name: position
          widget: select
          options: ["centro", "esquerda", "direita", "largura total"]
          default: "centro"
    - label: Galeria
      name: gallery
      fields:
        - { label: Imagens, name: images, widget: image, multiple: true }
        - { label: Colunas, name: columns, widget: number, default: 3, min: 1, max: 6 }
```

Hugo template iterates blocks, renders each type differently (text → prose, image → figure with float/width CSS, gallery → grid).

**Pros:**
- Photographer controls layout via structured choices (not HTML)
- Image positioning via dropdown (left/center/right/full)
- Gallery blocks with configurable columns
- Works within Sveltia today
- Foolproof — no syntax to learn

**Cons:**
- Requires Hugo template work (partial per block type)
- More complex content model
- Existing articles (if any) would need migration
- Not true WYSIWYG — photographer sees form fields, not visual preview

### Path C — Replace Sveltia CMS

Two sub-options:

#### C1: Hugo + Tina CMS

**Effort:** Medium-large (new CMS integration, keep Hugo)
**Idea:** Replace Sveltia with Tina CMS. Tina provides visual inline editing with custom block components. Works with Hugo. Has a free tier (Tina Cloud) or can self-host.

**Pros:**
- Visual inline editing (closest to WYSIWYG)
- Custom block components with live preview
- Works with existing Hugo templates
- Keeps "fire and forget" Hugo simplicity
- All infra carries over

**Cons:**
- React-based (new technology for the developer)
- Tina Cloud is a SaaS dependency (or self-host adds complexity)
- Rebuild CMS integration from scratch
- More JS in the stack

#### C2: Nuxt + Nuxt Content + Nuxt Studio

**Effort:** Large (full stack rebuild)
**Idea:** Replace Hugo entirely with Nuxt as SSG. Nuxt Content reads markdown from git. Nuxt Studio provides cloud-based visual editing. MDC (Markdown Components) enable custom Vue components inline in markdown (image-float, gallery, etc.).

**Pros:**
- Best editing experience (Nuxt Studio is a full visual editor)
- MDC components solve the image layout problem natively
- Modern Vue.js ecosystem
- All Cloudflare infra carries over (Pages, R2, Workers)

**Cons:**
- Complete rebuild (templates, content structure, everything)
- Nuxt Studio is a cloud SaaS dependency
- Node.js runtime complexity vs Hugo's zero-dep binary
- Worst "fire and forget" score — framework updates, npm, build tooling
- Vue is unfamiliar territory for the developer (Python background)
- Significantly slower builds (5-30s vs 300ms)

---

## Comparison Table

| | Hugo + Sveltia (current) | Hugo + Sveltia Path B (blocks) | Hugo + Tina CMS | Nuxt + Nuxt Studio |
|---|---|---|---|---|
| **Infra reuse** | 100% | 100% | 100% | ~90% |
| **Rebuild effort** | Done | Small | Medium | Large |
| **SSG build speed** | ~300ms | ~300ms | ~300ms | 5-30s |
| **Editor UX** | Basic markdown | Structured blocks | Visual inline editing | Full visual editing |
| **Image layout control** | None | Dropdown (L/C/R/full) | Block-based, configurable | MDC components, visual |
| **CMS hosting** | Self-hosted Worker | Self-hosted Worker | Tina Cloud or self-host | Nuxt Studio (cloud) |
| **Photographer UX** | Spartan | Good | Very good | Best |
| **Developer complexity** | Low | Low-medium | Medium | High |
| **"Fire and forget"** | Best | Good | Good | Worst |
| **Dev's tech comfort** | High (simple config) | High (YAML + Go templates) | Medium (React) | Low (Vue/Nuxt) |
| **SaaS dependencies** | None | None | Tina Cloud (optional) | Nuxt Studio |

---

## Recommendation

**Implement Path B (block-based content) now.** It's the best effort-to-value ratio:
- Solves the photographer's layout needs within Sveltia
- No new technology or SaaS dependencies
- Ships in a day
- Keeps "fire and forget" simplicity
- Can always escalate to Tina CMS or Nuxt later if blocks aren't enough

If after using Path B the photographer still needs more editorial control, evaluate Tina CMS as the next step (keeps Hugo, replaces only the CMS layer).

---

## Files to Resume From

- `static/admin/config.yml` — CMS configuration (needs Phase 1 fixes + potential Path B rewrite)
- `static/admin/index.html` — CMS entry point (needs preSave hook if implementing auto-tagging)
- `config/_default/hugo.yaml` — Hugo config (events taxonomy already added)
- `config/_default/params.yaml` — Blowfish params (showAuthor already false)
- `workers/r2-upload/` — redundant Worker (can be removed)
- `.worktrees/feature/sveltia-cms/` — stale worktree (can be cleaned up)

## Credentials Reference

- **R2 Access Key ID:** `0bd0a95fb73f463fa74a8cfd52ae8ec6` (in config.yml)
- **R2 Secret Access Key:** user's password manager (entered in Sveltia UI per device)
- **Cloudflare Account ID:** `43220b81420989e7198287bd4559a701` (in config.yml)
- **GitHub OAuth App Client ID:** `Ov23liqMUtOJYdVl58nr` (in sveltia-cms-auth Worker secrets)
- **GitHub OAuth App Client Secret:** user's password manager (in sveltia-cms-auth Worker secrets)
- **Cloudflare Workers subdomain:** `leftfield`
- **GitHub repo:** `n-000000/musictide` (public)
