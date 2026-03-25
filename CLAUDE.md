# CLAUDE.md — musictide

This file provides guidance to Claude Code when working in this repository.

## Project Overview

**Musictide** is a photography-heavy digital zine / music magazine covering rock and metal concerts, street fairs, and live events in Portugal. Inspired by 90s print fanzines — less text, more media. Target audience: Gen X and Millennial alternative crowd (punks, metalheads, goths, skaters, indie kids).

**Client:** Professional photographer (early 50s), primary content editor, uploads mid-event. Possibly slightly inebriated. Design everything to be foolproof.

**Developer:** Experienced Python backend dev (n0xx), Linux since late 90s, comfortable with Docker and AWS. Wants to ship and move on.

**Core principle:** Fire and forget. Every design decision should minimise ongoing developer involvement.

---

## Commands

```bash
# Wrangler (Cloudflare Workers CLI)
# NOT globally installed — always use npx:
npx wrangler deploy
npx wrangler secret put SECRET_NAME --name worker-name
npx wrangler secret list --name worker-name

# Development
yarn watch              # Hugo dev server (hot reload) at http://localhost:1313

# Build
yarn build              # Production build (hugo --gc --minify)

# Hugo modules
yarn update             # Update all Hugo modules (hugo mod get -u && hugo mod tidy)

# Git
yarn mirror             # Push to Codeberg backup mirror (git push codeberg main)
```

**Note:** `hugo` (bare, no subcommand) is the Hugo build command. `hugo build` does not exist.

---

## Architecture

**Stack:** Hugo 0.158.0 Extended + Blowfish v2 (Hugo module) + Sveltia CMS + Cloudflare Pages + Cloudflare R2

### Hugo Module

```
config/_default/module.yaml:
└── github.com/nunocoracao/blowfish/v2   # theme, layouts, shortcodes, partials
```

### Configuration Split

All config lives in `config/_default/` as YAML:

| File | Purpose |
|------|---------|
| `hugo.yaml` | Core Hugo settings, baseURL, outputs, taxonomies (incl. events) |
| `module.yaml` | Hugo module imports |
| `params.yaml` | Blowfish theme params + `mediaBaseURL` |
| `markup.yaml` | Goldmark renderer + highlight config |
| `languages.pt.yaml` | pt-PT (primary, weight 1, served at `/`) |
| `languages.en.yaml` | en-GB (secondary, weight 2, served at `/en/`) |
| `menus.pt.yaml` | Navigation menu stubs (pt) |
| `menus.en.yaml` | Navigation menu stubs (en) |

Environment overrides: `config/production/`, `config/staging/`, `config/development/` (loaded automatically by Hugo).

### Bilingual Strategy

- Primary language: **pt-PT**, served at `/` (`defaultContentLanguageInSubdir: false`)
- Secondary language: **en-GB**, served at `/en/`
- Content uses **translation-by-filename**: `_index.md` = PT, `_index.en.md` = EN
- `/pt/` returns 200 (Hugo generates aliases) — this is expected, not a bug
- EN article translations are **not yet implemented** — only PT content exists currently

### Deployment Pipeline

```
git push origin main (GitHub: github.com/n-000000/musictide)
        │
        ▼
Cloudflare Pages (auto-detects push)
        │   Build: hugo --gc --minify
        │   HUGO_VERSION = 0.158.0 (set in Pages dashboard env vars)
        ▼
public/ → Cloudflare CDN (PoP in Lisbon)
        │
        ▼
https://musictide.pages.dev
```

No pipeline YAML file — Cloudflare Pages is configured entirely in the dashboard.

### Media Storage

- **Cloudflare R2 bucket:** `musictide-media`
- **Public URL:** `https://pub-576ea11202f543d0bf28d36ef63d18ff.r2.dev`
- **Hugo config:** `params.yaml` → `mediaBaseURL: https://pub-576ea11202f543d0bf28d36ef63d18ff.r2.dev`
- Media lives in R2, NOT in git. Binary files do not belong in the repo.
- R2 free tier: 10GB storage, no egress fees.
- Uploads go through the R2 proxy Worker (see CMS section below), which adds `{collection}/YYYY/MM/DD/` prefixes.

### Git Remotes

```
origin    → git@github.com:n-000000/musictide.git   (primary, Cloudflare Pages watches this)
codeberg  → ssh://git@codeberg.org/ngon/musictide.git (backup mirror, run yarn mirror manually)
```

---

## CMS (Sveltia)

Sveltia CMS is the content management UI, served at `/admin/`. The photographer logs in via GitHub OAuth, creates/edits content, and Sveltia commits directly to GitHub — which triggers a Cloudflare Pages rebuild.

### Entry Point

`static/admin/index.html` — loads Sveltia from CDN (pinned at `@sveltia/cms@0.149.1`). Also contains:
- **R2 proxy fetch interceptor** — intercepts Sveltia's S3 API calls to R2, rewrites them to go through the proxy Worker instead. Strips AWS Signature V4 auth, injects GitHub Bearer token from the CMS session, passes `X-Collection` header.
- **Dummy R2 credential pre-seeding** — Sveltia prompts for an R2 secret key per session. Since the fetch interceptor handles auth via GitHub OAuth, the actual R2 key is irrelevant. A dummy value is pre-seeded in `localStorage` to suppress the prompt.
- **preSave hashtag extraction** — extracts `#hashtags` from article body text into the `tags` array on every save. Body is the source of truth (tags replaced, not merged). The `#` prefix is stripped from rendered output by client-side JS in `extend-footer.html`.
- **Stock photo CSS hack** — hides Picsum/Unsplash buttons in the media picker via CSS (`display: none !important`). Sveltia has no config option to disable them.

### CMS Config

`static/admin/config.yml` — defines backend, media library, and all collections.

### Auth

`sveltia-cms-auth` Worker at `https://sveltia-cms-auth.leftfield.workers.dev` — GitHub OAuth proxy. This is the official Sveltia-recommended approach for non-Netlify deployments. The GitHub OAuth App callback points here.

### R2 Proxy Worker

`workers/r2-proxy/` — S3-compatible reverse proxy between Sveltia and R2. Deployed at `https://musictide-media-proxy.leftfield.workers.dev`.

What it does:
- **PutObject** — prepends `{collection}/YYYY/MM/DD/` to the key (based on current date)
- **ListObjectsV2** — returns objects from ±1 day only, scoped to the current collection
- **DeleteObject / HeadObject** — pass through
- **Auth** — verifies the GitHub OAuth token has push access to `n-000000/musictide` (no static secrets)
- **Daily cron (03:00 UTC)** — deletes orphaned R2 objects not referenced in any content markdown file. Fetches the full repo tree from GitHub's public API and cross-references R2 keys.

### Known Sveltia Limitations

These are confirmed limitations that cannot be fixed from our side:
- `registerMediaLibrary()` is NOT supported — hence the fetch interceptor approach
- `locale` config option is NOT supported — UI follows browser locale; Portuguese unavailable
- Rich text editor outputs Markdown only — no HTML mode, no tables, no image float/resize
- Stock photo integration cannot be disabled (CSS hack hides it)
- `widget: hidden` doesn't properly hide list/array fields
- Media list is cached per session — uploads via one image field don't appear in another field's picker until page reload
- `date_format` only affects stored format, not UI display
- R2 `prefix` is static — no dynamic per-article or date-based prefixes (hence the proxy Worker)
- Collection-level `media_folder`/`public_folder` with placeholders do NOT work with R2 external media

---

## Content Model

Five CMS collections, all live and operational:

| Collection | CMS name | Storage | Purpose |
|------------|----------|---------|---------|
| Articles | `posts` | `content/posts/` | Photography-heavy event posts. Fields: event (relation), title, date, featureimage, author, body (text widget), gallery (multi-image), draft |
| Ads | `ads` | `content/ads/` | Paid placement ads. Fields: title, creative_image, click_through_url, active_from/until, notes, draft |
| Events | `events` | `content/events/` | Lookup collection for the article event relation picker. Fields: title only |
| Contributors | `authors` | `content/authors/` | Contributor profiles. Fields: title, photo, bio, email, instagram, draft |
| Site Style | `settings` | `data/style.yaml` | File collection (single file). Palette + font selection |

**Body field** uses `widget: text` (plain text), not `widget: markdown`. Simpler for the photographer.

**Tags** are not a CMS field — they are extracted automatically from `#hashtags` in the body text by the preSave hook.

**Ads note:** Ads are paid placement (transactional, not per-click). JS interleaving into listing pages is a future phase — CMS just creates and stores them.

---

## Local Layout Overrides

These files override Blowfish defaults:

| File | Purpose |
|------|---------|
| `layouts/_default/single.html` | Article template — injects gallery partial below body, uses `hugo.Data` (not deprecated `site.Data`). `max-w-prose` removed from header, content div, and footer so all elements span the full content column width. |
| `layouts/partials/article-gallery.html` | Renders `gallery` frontmatter as responsive CSS columns grid (1 col mobile, 2 col ≥640px, 3 col ≥1024px). No `<a>` wrapper — Blowfish's Tobii zoom handles clicks |
| `layouts/partials/extend-head.html` | Dynamically loads scheme CSS from `assets/css/schemes/<colorScheme>.css` via Hugo asset pipeline (minified + fingerprinted). Also loads Google Fonts and gallery CSS media queries. |
| `layouts/partials/extend-footer.html` | Client-side JS that strips `#` from hashtags in rendered article content |

---

## Styling System

`data/style.yaml` stores the active color scheme and font choices. `extend-head.html` reads it and dynamically loads the appropriate scheme CSS file from `assets/css/schemes/` via Hugo's asset pipeline (minified + fingerprinted). The scheme `<link>` is injected after Blowfish's bundled CSS, so it naturally overrides Blowfish's default color variables without touching `head.html`.

**Scheme files:** `assets/css/schemes/{dark-metal,goth,punk,indie,minimal}.css` — each defines a single `:root` block with `--color-neutral-*`, `--color-primary-*`, and `--color-secondary-*` CSS custom properties (10 shades each, RGB triplet format matching Blowfish conventions). No light/dark split needed — Blowfish handles dark mode by selecting different shade indices via Tailwind utilities.

**5 schemes:** dark-metal (charcoal/blood-red/amber), goth (deep-purple/violet/rose), punk (warm-brown/hot-pink/yellow-green), indie (midnight-blue/coral/teal), minimal (gray/near-black/warm-stone)

**Font options (headings):** system, bebas-neue, oswald, playfair, inter, roboto-slab
**Font options (body):** system, inter, roboto-slab, playfair

Switchable via CMS at Definições → Estilo Visual. Currently set to `goth` with `inter` headings and system body font.

---

## Mock Content

9 mock articles exist in `content/posts/` using Picsum placeholder images: moonspell-vagos, gojira-sonicblast, deftones-voa, pixies-colorama, sepultura-vagos, massive-attack-sonar, baroness-sonicblast, health-sumol, blindzero-voa. Plus `fu-manchu` and `slayer` created via CMS during testing.

These are placeholder content for development. Remove before going live with real content.

---

## Known Quirks

- **Blowfish version warning:** `WARN Module "github.com/nunocoracao/blowfish/v2" is not compatible with this Hugo version` — Blowfish v2 declares max Hugo 0.157.0 but we run 0.158.0. Soft warning, builds succeed. Ignore it.
- **`public/` directory:** Exists locally from local builds. Gitignored. Do not commit it.
- **`.worktrees/` is gitignored** — worktrees live at `.worktrees/<branch-name>`.
- **Sveltia media cache bug:** Media list is fetched once per session. Uploading via one image field then opening another field's picker won't show the new file until page reload.
- **`/pt/` returns 200** — Hugo generates aliases. This is expected, not a bug.

---

## Pending Work

### Not yet implemented

- **Bilingual authoring workflow** — EN translations for articles. Translation-by-filename is set up but no EN content exists yet. Sveltia i18n per-field config not yet added.
- **Ads display** — Client-side JS to interleave active ads into article listing pages.
- **Events taxonomy templates** — `content/events/` exists as a CMS lookup collection but has no custom Hugo taxonomy templates (no banner/description display on event pages).
- **Custom domain** — still on `musictide.pages.dev`.
- **Video hosting strategy** — not started.

### Cleanup

- **`workers/r2-upload/`** — the original R2 upload Worker. Redundant since the R2 proxy Worker (`workers/r2-proxy/`) replaced it. Can be removed from the repo and undeployed.
- **Mock content** — 11 test articles to remove before launch.

### Future consideration

- **Block-based content model** — Evaluated on 2026-03-22 as "Path B" (see `docs/superpowers/specs/2026-03-22-cms-assessment-and-paths-forward.md`). Would replace the single body text field with a list of typed blocks (text, image, gallery) giving the photographer layout control. Not implemented — current approach (body text + separate gallery field) was chosen for simplicity. Revisit if photographer needs more editorial control.
- **CMS replacement** — Tina CMS (keeps Hugo, better editor) or Nuxt + Nuxt Studio (full rebuild, best editor UX) were evaluated and deferred. See same assessment doc.

---

## Build Verification

After any change, always verify:

```bash
hugo 2>&1
```

Expected: zero `ERROR` lines. `WARN` about Blowfish version is acceptable.

---

## Project History

Condensed timeline of key milestones:

| Date | Milestone |
|------|-----------|
| 2026-03-18 | Project bootstrap: Hugo scaffold, Blowfish v2 module, bilingual config, YAML split config, package.json. Cloudflare deployment spec written. |
| 2026-03-19 | Cloudflare Pages + R2 deployed. Primary remote moved from Codeberg to GitHub. `musictide.pages.dev` live. R2 bucket `musictide-media` with public access. Codeberg kept as manual mirror. |
| 2026-03-20 | Sveltia CMS integration begins. Auth Worker deployed (`sveltia-cms-auth`). R2 upload Worker created. Admin UI at `/admin/`. Collections: posts, ads, authors. Events taxonomy added. |
| 2026-03-21 | E2E testing. Native R2 integration discovered (replaced custom media plugin). Multiple Sveltia limitations found. Original `r2-upload` Worker becomes redundant. |
| 2026-03-22 | CMS assessment: 11 issues documented, three paths forward evaluated (A: accept markdown, B: block-based content, C: replace Sveltia). Quick fixes applied (cover image, date defaults, multi-image gallery, event relation widget). |
| 2026-03-23 | R2 proxy Worker built (`workers/r2-proxy/`). Fetch interceptor in `index.html`. Date-based upload prefixes. GitHub OAuth auth on uploads. Daily orphan cleanup cron. |
| 2026-03-24 | Styling system (5 palettes, fonts, CSS custom properties via `data/style.yaml`). Homepage article grid. Article gallery partial. Hashtag extraction preSave hook. Mock articles. Body field changed to text widget. All committed and pushed. |
| 2026-03-25 | Color scheme migration: replaced homebrew CSS custom property inline blocks in `extend-head.html` with native Blowfish scheme CSS files (`assets/css/schemes/*.css`). Proper `:root` + RGB triplet format. Scheme loaded via Hugo asset pipeline. Article layout fix: removed `max-w-prose` from header, content div, and footer in `single.html` so all elements span full content column width. |

Design docs live in `docs/superpowers/specs/` and `docs/superpowers/plans/` — useful for understanding rationale behind decisions but may be outdated relative to current code.

---

## Credentials Reference

Non-secret identifiers needed for operations:

| What | Value |
|------|-------|
| Cloudflare Account ID | `43220b81420989e7198287bd4559a701` |
| Cloudflare Workers subdomain | `leftfield` |
| R2 Access Key ID | `0bd0a95fb73f463fa74a8cfd52ae8ec6` |
| R2 Public URL | `https://pub-576ea11202f543d0bf28d36ef63d18ff.r2.dev` |
| GitHub OAuth App Client ID | `Ov23liqMUtOJYdVl58nr` |
| Auth Worker URL | `https://sveltia-cms-auth.leftfield.workers.dev` |
| R2 Proxy Worker URL | `https://musictide-media-proxy.leftfield.workers.dev` |
| R2 Upload Worker URL (redundant) | `https://musictide-media-upload.leftfield.workers.dev` |
| GitHub repo | `n-000000/musictide` (public) |
| Cloudflare Pages URL | `https://musictide.pages.dev` |

Secrets (R2 Secret Access Key, GitHub OAuth Client Secret) are in the developer's password manager and/or Cloudflare Worker secrets. Never committed to the repo.
