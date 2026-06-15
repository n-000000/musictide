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
yarn cms                # Local CMS backend proxy (port 8081) — run alongside yarn watch
                        # for local CMS editing without waiting for Cloudflare Pages CI

# Build
yarn build              # Production build (hugo --gc --minify)

# Hugo modules
yarn update             # Update all Hugo modules (hugo mod get -u && hugo mod tidy)

# Git
yarn mirror             # Push to Codeberg backup mirror (git push codeberg main)
```

**Note:** `hugo` (bare, no subcommand) is the Hugo build command. `hugo build` does not exist.

---

## Documentation

When implementing features, always consult local docs first:

- **Hugo:** `./docs/hugo/*.md`
- **Blowfish (theme):** `./docs/blowfish/*.md`

**Conflict resolution:**
- If Blowfish docs and Hugo docs conflict, Blowfish takes precedence — unless the Blowfish docs explicitly defer to Hugo.
- If both sets of docs address the same topic without conflict, ask the user which to follow before proceeding.

---

## Architecture

**Stack:** Hugo 0.163.0 Extended + Blowfish v2 (Hugo module) + Sveltia CMS + Cloudflare Pages + Cloudflare R2

### Hugo Module

```
config/_default/module.yaml:
└── github.com/nunocoracao/blowfish/v2   # theme, layouts, shortcodes, partials
```

### Configuration Split

All config lives in `config/_default/` as YAML:

| File | Purpose |
|------|---------|
| `hugo.yaml` | Core Hugo settings, baseURL, outputs, taxonomies (tags, categories, authors, series) |
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
        │   HUGO_VERSION = 0.163.0 (set in Pages dashboard env vars — update if local version changes)
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

Sveltia CMS is the content management UI, served at `/admin/`. Users log in with Google; a shared GitHub service account PAT is issued to Sveltia on successful auth. Sveltia commits directly to GitHub — which triggers a Cloudflare Pages rebuild.

### Entry Point

`static/admin/index.html` — loads Sveltia from the **local fork bundle** (`/admin/sveltia-cms.js`, built from `/home/n0xx/Code/infra/service/sveltia-cms` branch `musictide-patches`, CDN reference replaced in musictide `b76c50f`). Also contains:
- **R2 proxy fetch interceptor** — intercepts Sveltia's S3 API calls to R2, rewrites them to go through the proxy Worker instead. Strips AWS Signature V4 auth, injects GitHub Bearer token (service account PAT) from the CMS session, passes `X-Collection` header.
- **Dummy R2 credential pre-seeding** — Sveltia prompts for an R2 secret key per session. Since the fetch interceptor handles auth, the actual R2 key is irrelevant. A dummy value is pre-seeded in `localStorage` to suppress the prompt.
- **User metadata listener** — listens for `mt-user-data` postMessage from `musictide-auth` and stores `{ name, login, email, avatar }` in `localStorage` as `mt-current-user`.
- **Commit author injection** — fetch interceptor intercepts GitHub Contents API `PUT`/`DELETE` calls and injects the real user's `name`/`email` as the git commit `author` field, so `git log` shows the actual contributor rather than the service account.
- **preSave hashtag extraction** — extracts `#hashtags` from article body text into the `tags` array on every save. Body is the source of truth (tags replaced, not merged). The `#` prefix is stripped from rendered output by client-side JS in `extend-footer.html`.
- **Stock photo CSS hack** — hides Picsum/Unsplash buttons in the media picker via CSS (`display: none !important`). Sveltia has no config option to disable them.

### CMS Config

`static/admin/config.yml` — defines backend, media library, and all collections.

### Auth

`musictide-auth` Worker at `https://musictide-auth.leftfield.workers.dev` — Google Sign-In proxy for Sveltia. Lives in `workers/musictide-auth/`.

**How it works:**
- Sveltia opens a popup to `/auth?provider=github&site_id=<domain>`
- Worker serves an HTML page with a Google Sign-In button (GIS SDK — `renderButton`)
- User clicks → Google's FedCM / account picker appears inline (no second popup on Chrome/Android)
- GIS returns a signed JWT credential; Worker's `/verify` endpoint validates it with Google's tokeninfo API
- Email is looked up in the `USERS` KV namespace (key = Google email, value = `{"name":"...","login":"..."}`)
- On success: postMessages `{ type: 'mt-user-data', user: {...} }` then `authorization:github:success:{"token":"<PAT>"}` to `window.opener`, then closes
- On failure: shows "Acesso negado" error in the popup

**KV user registry (`USERS` namespace, ID `1f6af293b61b4e989bc65e3c94ea21b3`):**
- Key: Google email address
- Value: `{"name":"Display Name","login":"author-slug"}`
- `name` is used as the git commit author name
- `login` is the `content/authors/` slug (stored, not yet actively wired to anything)
- Manage via Cloudflare dashboard or: `npx wrangler kv key put "email@gmail.com" '{"name":"Name","login":"slug"}' --namespace-id 1f6af293b61b4e989bc65e3c94ea21b3 --remote`

**Secrets** (set via `npx wrangler secret put <NAME> --name musictide-auth`):
- `GOOGLE_CLIENT_ID` — Google Cloud Console OAuth 2.0 client
- `GITHUB_SERVICE_ACCOUNT_PAT` — classic PAT with `repo` scope on n0xx's account

**Google Cloud Console requirements:**
- OAuth consent screen: published to production (not Testing)
- Authorised JavaScript origins: `https://musictide-auth.leftfield.workers.dev`
- When custom domain is added: also add domain as authorised JS origin and update `ALLOWED_DOMAINS` in `wrangler.toml`

### R2 Proxy Worker

`workers/r2-proxy/` — S3-compatible reverse proxy between Sveltia and R2. Deployed at `https://musictide-media-proxy.leftfield.workers.dev`.

What it does:
- **PutObject** — prepends `{collection}/YYYY/MM/DD/` to the key (based on current date)
- **ListObjectsV2** — returns objects from ±1 day only, scoped to the current collection
- **DeleteObject / HeadObject** — pass through
- **Auth** — verifies the Bearer token (service account PAT issued by `musictide-auth`) has push access to `n-000000/musictide`
- **Daily cron (03:00 UTC)** — deletes orphaned R2 objects not referenced in any content markdown file. Fetches the full repo tree from GitHub's public API and cross-references R2 keys.

Note: `workers/r2-upload/` still exists in the repo but is **redundant** — it was superseded by `r2-proxy` and has not been deployed since 2026-03-22. Safe to delete.

### Known Sveltia Limitations

These are confirmed limitations that cannot be fixed from our side:
- `registerMediaLibrary()` is NOT supported — hence the fetch interceptor approach
- Rich text editor outputs Markdown only — no HTML mode, no tables, no image float/resize, no text alignment
- Stock photo integration cannot be disabled (CSS hack hides it)
- `widget: hidden` doesn't properly hide list/array fields
- Media list is cached per session — uploads via one image field don't appear in another field's picker until page reload
- `date_format` only affects stored format, not UI display
- R2 `prefix` is static — no dynamic per-article or date-based prefixes (hence the proxy Worker)
- Collection-level `media_folder`/`public_folder` with placeholders do NOT work with R2 external media
- Multiple image pasting not supported in Firefox (Chrome/Android only)
- No Remark/MDX plugins — Sveltia uses Lexical editor internally

- All ~24 Sveltia dialogs are mounted in the DOM simultaneously at `opacity:0`; only the active one gets CSS classes `.open.active`. Any monkey-patch targeting `[role="dialog"]` MUST use `.open.active` selector or it will hit the wrong dialog.
- `widget: image` Insert button wires to internal Svelte 5 reactive state (`selectedAssets`) — synthetic `.click()` calls on `[role="option"]` elements update DOM `aria-selected` but not internal state. Ctrl+A → Insert only inserts 1 image because Sveltia reads state, not DOM. Requires fork to fix.
- "View on live site" toolbar button: controlled by `!disabled && previewURL` condition in `contents/details/toolbar.svelte`. Button is absent entirely when `previewURL` is falsy. Hugo never builds drafts so there is no meaningful preview URL for drafts. Fix in fork: disable button when `entry.data.draft === true`.

**Confirmed capabilities** (useful when planning future CMS features):
- `preSave`/`postSave` event hooks — JS that runs before/after each save, can modify entry data (used for hashtag extraction)
- `widget: image` with `multiple: true` — multi-select, drag-drop, clipboard paste (used for gallery field)
- `widget: relation` — cross-collection references with searchable dropdown; `dropdown_threshold: 0` forces always-searchable
- `widget: list` with object `types` — type selector + different field sets per type (page builder / block-based content pattern)
- DateTime `default: "{{now}}"` — auto-fills current datetime on new entry creation
- Hidden fields with `{{datetime}}`, `{{uuid}}`, `{{author-login}}` etc. auto-fill templates

---

## Content Model

Six CMS collections, all live and operational:

| Collection | CMS name | Storage | Purpose |
|------------|----------|---------|---------|
| Articles | `posts` | `content/posts/` | Photography-heavy event posts. Fields: category (relation), title, date, featureimage, author, body (text widget), gallery (multi-image), draft |
| Ads | `ads` | `content/ads/` | Paid placement ads. Fields: title, creative_image, click_through_url, active_from/until, destaque (bool), notes, draft |
| Categories | `categories` | `content/categories/` | Lookup collection for article category relation. Fields: title, color (palette slot selector). Seeded: Cultura, Desporto, Lifestyle, Agenda, Espinho, Nacional. |
| Biografias | `authors` | `content/authors/` | Public contributor profiles. Fields: title (public name), photo, bio, pub_email + 9 social network URLs (instagram, facebook, x_twitter, bluesky, tiktok, youtube, spotify), draft. Generates Hugo taxonomy pages at `/authors/`. |
| Utilizadores | `cms-users` | `data/cms-users/` | CMS auth accounts. Fields: name (git commit author), email (Google, cleared after token generation), token (readonly, HMAC-based), biography (optional relation to `authors`). |
| Site Style | `settings` | `data/style.yaml` | File collection (single file). Palette, font, homepage layout, and listing style selection |

**Body field** uses `widget: text` (plain text), not `widget: markdown`. Simpler for the photographer.

**Tags** are not a CMS field — they are extracted automatically from `#hashtags` in the body text by the preSave hook.

**Ads note:** Ads are paid placement (transactional, not per-click). Two slots implemented: destaque (below hero on homepage + category pages) and feed (injected between HTMX scroll batches). The `destaque: true` field flags an ad for the below-hero position; only one should be active at a time (JS picks the first match). Mock/test ads `ariel-destaque.md`, `skip-mock.md`, and `cenas-fixes.md` exist in `content/ads/` — remove before launch.

**Ad slot edge cases:**
- No active ads → both slots stay hidden, no visible gap
- No destaque ad active → below-hero slot hidden; feed slots still populate from active pool
- Multiple `destaque: true` active → first in JSON array wins (content convention, not enforced by code)
- `active_from`/`active_until` absent → treated as open-ended (no start / no expiry)
- JS disabled → all slots stay hidden (graceful degradation)
- Infinite scroll not triggered → feed slots never populated (no `htmx:afterSettle` fires)

**Category relation stores title not slug:** `value_field: title` in the CMS relation widget stores the human-readable category title (e.g. `"Cultura"`) as a plain string in article frontmatter. Hugo auto-slugifies this for taxonomy URLs. Do not change `value_field` to `slug` — it would break existing content.

---

## Local Layout Overrides

These files override Blowfish defaults:

| File | Purpose |
|------|---------|
| `layouts/_default/single.html` | Article template — injects gallery partial below body, uses `hugo.Data` (not deprecated `site.Data`). `max-w-prose` removed from header, content div, and footer so all elements span the full content column width. |
| `layouts/partials/article-gallery.html` | Renders `gallery` frontmatter as responsive CSS columns grid (1 col mobile, 2 col ≥640px, 3 col ≥1024px). No `<a>` wrapper — Blowfish's Tobii zoom handles clicks |
| `layouts/index.html` | Homepage entry point — reads `hugo.Data.style.homepage_layout` and dispatches to the appropriate `home/*.html` partial. Overrides Blowfish's version which reads from `params.yaml`. |
| `layouts/partials/home/hero.html` | Custom hero layout showing latest non-draft article (featureimage as 16:9 background, title + category badge anchored bottom-left). Falls back to `data/style.yaml homepage_image` as a fixed page background. |
| `layouts/partials/extend-head.html` | Dynamically loads scheme CSS, Google Fonts, gallery CSS, ad JSON blob (`ads-data.html`), IntersectionObserver + HTMX infinite-scroll setup (600px preemptive rootMargin, month-group merge logic), and client-side JS that strips `#` prefix from hashtag spans in rendered article body. |
| `layouts/partials/footer.html` | Intentionally empty — footer removed from the site. |
| `layouts/partials/hero/big.html` | Full-width zoomable article hero image. Called from `single.html` when `heroStyle = "big"`. Delegates image lookup to `resolve-feature-image.html`. |
| `layouts/partials/resolve-feature-image.html` | Centralised feature-image resolution logic (URL or Hugo resource). Replaces duplicated lookup code that previously lived in `big.html`, `card.html`, and `hero.html`. |
| `layouts/partials/article-link/simple.html` | Override of Blowfish's simple list-item partial. |
| `layouts/partials/header/basic.html` | Header layout override — logo, nav, appearance switcher. |
| `layouts/partials/header/components/desktop-menu.html` | Desktop nav menu component override. |
| `layouts/partials/header/components/mobile-menu.html` | Mobile nav menu component override. |
| `layouts/partials/ads-data.html` | Serialises all non-draft ads from `content/ads/` to a `<script id="mt-ads-data" type="application/json">` blob in `<head>`. Includes title, image, url, destaque, from/until timestamps. Read by `ad-slot.html` JS at visit time for date filtering. |
| `layouts/partials/ad-slot.html` | Renders the hidden `#mt-ad-destaque` card + inline IIFE. On load: filters active ads by date, fills + reveals destaque slot. On `htmx:afterSettle`: fills one `[data-ad-inject]` feed slot per event, skipping if the previous sibling is already an `.mt-ad-slot`. URL scheme validated via `safeUrl()` (http/https only). |
| `layouts/posts/list.fragment.html` | HTMX infinite-scroll fragment for homepage. Includes `[data-ad-inject]` feed placeholder only when `$pager.HasNext` is true (not on the last page). |
| `layouts/categories/term.fragment.html` | Same as above for category listing pages. |
| `layouts/partials/category-badge.html` | Renders colored badge for article's first category. Looks up `_index.md` for `color` param; injects scoped `<style>` block (class `cat-badge--{slug}`) to avoid ZgotmplZ on `var(--color-X)`. |
| `layouts/partials/article-link/card.html` | Blowfish card override — adds `category-badge.html` before `<header>` inside `.p-4`. |
| `layouts/categories/term.html` | Category listing page — colored heading, HTMX infinite scroll, destaque ad slot, `content_style`-aware wide/constrained grid. |
| `layouts/authors/list.html` | Bio card grid for `/authors/`. Photo or initials placeholder left, name/bio/social icons right. 10 social networks + email. Uses `.Plain` (not `.Content`) for bio — avoids Hugo wrapping plain text body in extra `<p>` tags. |
| `layouts/posts/list.html` | Overrides Blowfish `_default/list.html` for posts section only. Reads `posts_listing_style` from `data/style.yaml` instead of `params.yaml`. |

---

## Styling System

`data/style.yaml` stores the active color scheme and font choices. `extend-head.html` reads it and dynamically loads the appropriate scheme CSS file from `assets/css/schemes/` via Hugo's asset pipeline (minified + fingerprinted). The scheme `<link>` is injected after Blowfish's bundled CSS, so it naturally overrides Blowfish's default color variables without touching `head.html`.

**Scheme files:** `assets/css/schemes/*.css` — each defines a single `:root` block with `--color-neutral-*`, `--color-primary-*`, and `--color-secondary-*` CSS custom properties (10 shades each, RGB triplet format matching Blowfish conventions). No light/dark split needed — Blowfish handles dark mode by selecting different shade indices via Tailwind utilities.

**Custom schemes:** dark-metal (charcoal/blood-red/amber), goth (deep-purple/violet/rose), punk (warm-brown/hot-pink/yellow-green), indie (midnight-blue/coral/teal), minimal (gray/near-black/warm-stone), slab (cool blue-gray/deep-slate/cyan), zinc (warm-gray/near-black/amber), swamp (olive-green/emerald/gold)

**Blowfish built-in schemes (also available):** blowfish, avocado, fire, ocean, forest, bloody, terminal, neon, marvel, noir, autumn, congo, princess, slate, github, one-light

Note: `slab` and `swamp` are renamed versions of what were previously `slate` and `forest` locally, to avoid shadowing the Blowfish built-ins of those names.

**Font options (headings):** system, bebas-neue, oswald, antonio, barlow, fjalla, special-elite, playfair, inter, roboto-slab
**Font options (body):** system, inter, lato, merriweather, roboto-slab, playfair

**Homepage layout** is controlled by `data/style.yaml` → `homepage_layout` field (page, hero, background, card, profile). `layouts/index.html` is overridden locally to read this from `hugo.Data.style` instead of `params.yaml`. The `hero` layout is a fully custom override showing the latest non-draft article with its `featureimage` as a full-bleed background. The `background` layout is overridden to also pick up `homepage_image` from `data/style.yaml`.

**Additional `data/style.yaml` fields:**
- `card_layout` (cards/list) — card grid vs list display; used by homepage, `/posts/`, and category pages
- `wide_layout` (true/false) — breaks the card grid out of the prose column width (`.mt-wide.mt-breakout`)
- `card_alignment` (left/right) — card content alignment
- `card_category_color` (true/false) — show/hide colored category badges on cards

All fields switchable via CMS at Definições → Estilo Visual.

---

## Mock Content

Mock articles have been replaced with real content uploaded by the photographer via CMS. Three mock/test ads remain:
- `content/ads/ariel-destaque.md` — destaque mock (orange placeholder image)
- `content/ads/skip-mock.md` — feed slot mock (blue placeholder image)
- `content/ads/cenas-fixes.md` — expired test ad (active_until 2026-04-24, Wikimedia image)

Remove all three before launch.

---

## Known Quirks

- **Blowfish version warning:** `WARN Module "github.com/nunocoracao/blowfish/v2" is not compatible with this Hugo version: 0.141.0/0.159.1 extended` — Blowfish v2 declares max Hugo 0.159.1 but we run 0.163.0. Soft warning, builds succeed. Will be resolved when the Blowfish fork module is wired up (fork tracks upstream which has removed this limit).
- **Hugo deprecation warnings:** Two config-level warnings (`languageName` → `label`) were fixed 2026-06-15. Two template-level warnings (`.Site.LanguageCode` → `.Site.Language.Locale`) come from the vendored Blowfish v2.101.0 and will be resolved automatically when the Blowfish fork is wired up (upstream already patched).
- **`public/` directory:** Exists locally from local builds. Gitignored. Do not commit it.
- **`.worktrees/` is gitignored** — worktrees live at `.worktrees/<branch-name>`.
- **Sveltia media cache bug:** Media list is fetched once per session. Uploading via one image field then opening another field's picker won't show the new file until page reload.
- **`/pt/` returns 200** — Hugo generates aliases. This is expected, not a bug.
- **`local_backend: true` only activates on localhost** — safe to commit. In production (musictide.pages.dev) it is silently ignored and the Google auth backend is used as normal. Requires `yarn cms` running alongside `yarn watch` to be useful.
- **`yarn cms` installs on first run** — `npx netlify-cms-proxy-server` downloads the package on first invocation; subsequent runs use the npx cache.

---

## Pending Work

### Sveltia Fork (all backlog items resolved as of 2026-06-15)

Fork of Sveltia CMS at tag `v0.166.0`. Fork lives at `/home/n0xx/Code/infra/service/sveltia-cms` on branch `musictide-patches`. Build output committed to this repo at `static/admin/sveltia-cms.js`; `static/admin/index.html` loads the local file (CDN reference replaced as of `b76c50f`).

**All patches shipped and validated:**
- Hide "View on live site" for drafts; editor scroll sync fix; Toast Alert guard
- Local repo AbortError fix (`showDirectoryPicker` before IndexedDB)
- Ctrl+A select-all in both internal and external media pickers (monkey-patch removed from `index.html`)
- Media list cache refresh; multi-select + drag-drop gallery ordering; DropZone false-positive fix
- Inline create Events from relation field (Authors disabled — lookup-only)
- Gallery picker auto-selects all R2 files on open
- PT-PT locale forced from `locale: pt` in config.yml (fork: `c4441290`, `45ab837f`)
- Gallery preview click scrolls edit pane to the clicked image specifically (fork: `6c8c7ef7`, `a37166d4`)
- token field readonly; email hint clarified (`4bd0b15`)
- Colaboradores → Biografias rename; `biography` relation in Utilizadores (`17b1c34`, `da14dc7`)

**Permanent monkey-patches remaining in `index.html`** (musictide integrations, not UX patches — the fork doesn't replace them):
- R2 proxy fetch interceptor (S3 → proxy Worker rewrite, presigned PUT, progress toast, thumbnail redirect)
- GitHub commit author injection
- Dummy R2 credential pre-seeding
- preSave hooks (hashtag extraction, cms-users HMAC token computation)
- Stock photo service CSS hide

### Not yet implemented

- **Custom domain** — still on `musictide.pages.dev`. When ready: update `ALLOWED_DOMAINS` in `wrangler.toml`, add domain to Google OAuth authorised JS origins.
- **Video hosting strategy** — not started.

### Known issues / to investigate

- **Espinho and Nacional missing from nav** — `content/categories/espinho/` and `content/categories/nacional/` exist and are seeded, but neither appears in `config/_default/menus.pt.yaml` or `menus.en.yaml`. Add nav entries or decide these are intentionally unlisted.
- **Single-category limit in CMS** — The `category` relation field in the posts collection is a single-value widget. Some scraped articles have multiple categories in frontmatter (`categories: [A, B]`), but a CMS editor can only assign one. Decide: allow multi-select in CMS (change widget to `multiple: true`) or enforce single-category as a content rule.
- **Front page deduplication logic** — It is unclear what prevents an article from appearing more than once on the homepage (e.g. via both the hero and the card grid). Needs a code review of `hero.html` + the HTMX fragment to document and verify the deduplication criteria.
- **Search / tags / categories interplay** — No review has been done of how Pagefind search, the `#hashtag` tag system, and the categories taxonomy interact. Needs a pass to check for gaps (e.g. tags not indexed, category pages not surfaced in search).
- **Contributor photos** — 14/15 contributors still have letter avatars; one has a photo.

### Cleanup

- **Mock ads** — `content/ads/ariel-destaque.md`, `content/ads/skip-mock.md`, and `content/ads/cenas-fixes.md` to remove before launch.
- ~~**`workers/r2-upload/`**~~ — Deleted.
- ~~**Ctrl+A monkey-patch in `index.html`**~~ — Removed (musictide `b76c50f`); fork handles it natively.

### Future consideration

- **`login` field wiring** — `login` in the KV user record is stored in `mt-current-user` localStorage but not yet used. Intended to link a logged-in user to their `content/authors/` profile. Wire up when CMS user management is in active use.
- **Block-based content model** — Evaluated on 2026-03-22 (Path B). Would replace the single body text field with a list of typed blocks (text, image, gallery) giving the photographer layout control. Not implemented — current approach (body text + separate gallery field) was chosen for simplicity. Revisit if photographer needs more editorial control. Sveltia's `widget: list` with object `types` supports this pattern.
- **EN article translations** — Translation-by-filename is set up, no EN content exists yet. Low priority.
- **CMS sidebar cleanup** — Estilo Visual as top-level collection, reorder sidebar items.

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
| 2026-03-25 | Color scheme migration: replaced homebrew CSS custom property inline blocks in `extend-head.html` with native Blowfish scheme CSS files (`assets/css/schemes/*.css`). Article layout fix: removed `max-w-prose` from header/content/footer. Homepage layout switching via `data/style.yaml` (local `layouts/index.html` override). Custom hero layout showing latest article. Background layout override. 8 color schemes, 10 heading fonts, 6 body fonts. CMS local_backend support via `yarn cms`. |
| 2026-03-26 | Hero redesign: 16:9 aspect ratio, full area clickable `<a>`, title + category badge anchored bottom-left. Header constrained to 1600px. Global `border-radius: 0 !important` reset. CMS layout toggles added (`homepage_gallery_style`, `posts_listing_style`). |
| 2026-03-28 | Authors/colaboradores page: bio card grid layout, photo or initials placeholder, 10 social network fields added to CMS authors collection, Colaboradores/Contributors nav entries added. |
| 2026-04-01 | Events → categories migration: CMS `events` collection renamed to `categories` with `color` field; `category-badge.html` partial with per-category theme color via scoped `<style>` block; badge shown on hero and article cards; category nav items (Cultura, Desporto, Lifestyle, Agenda). |
| 2026-05-01 | Ads display implemented: `destaque` CMS field added; `ads-data.html` embeds non-draft ads as JSON blob in `<head>`; `ad-slot.html` reveals destaque card below hero + injects feed ads between HTMX scroll batches via `htmx:afterSettle`; URL XSS sanitised via `safeUrl()`; adjacent-ad guard prevents duplicates from month-merge race. Hero mobile portrait fix: `80svh` on `max-width:640px portrait`. HTMX sentinel rootMargin increased to 600px. Mock articles confirmed replaced by real photographer content. |
| 2026-05-14 | Google Sign-In auth shipped. Replaced `sveltia-cms-auth` (GitHub OAuth) with `musictide-auth` Worker (Google GIS SDK + Cloudflare KV user registry). Users log in with Google; Worker verifies JWT, looks up email in KV, issues shared GitHub service account PAT to Sveltia. Commit author injection added to `index.html` fetch interceptor — `git log` shows real contributor name/email. `workers/r2-upload/` deleted (was already redundant). Google OAuth app published to production. |
| 2026-05-15 | CMS user management shipped. `cms-users` Sveltia collection (`data/cms-users/`, JSON format) lets the photographer add/remove CMS users without developer involvement. GitHub push webhook → `POST /sync-users` on `musictide-auth` Worker; HMAC-SHA256 verified, timing-safe comparison, full KV reconciliation on each relevant push. No GitHub Actions, no Cloudflare API token in GitHub secrets — all credentials stay in Cloudflare Workers. |
| 2026-06-06 | Sveltia bumped to 0.166.0. Ctrl+A select-all media picker fix shipped (c0d46a8): Sveltia mounts all ~24 dialogs in DOM simultaneously at `opacity:0`; old selector grabbed the wrong one; fixed with `.open.active` guard. Thumbnail 404-after-upload fix shipped: `uploadedKeys` map + CDN redirect intercept + MutationObserver on `img[src]`. Upload progress toast shipped: XHR progress events → toast injected into `.sui.spacer` inside active dialog. Full backlog of 11 CMS issues triaged — 9/11 are unfixable without forking Sveltia. Fork decision made: `sveltia-cms` fork at `/home/n0xx/Code/infra/service/sveltia-cms`, build output committed to `static/admin/sveltia-cms.js`. Fork implementation plan at `docs/superpowers/plans/2026-06-06-sveltia-fork.md`. |
| 2026-06-15 | All Sveltia fork backlog items resolved and validated. New patches: force PT-PT locale from config (`locale: pt` in config.yml, fork `c4441290`/`45ab837f`); gallery preview click scrolls to specific image in edit pane (fork `6c8c7ef7`/`a37166d4`); token field readonly + email hint clarified (`4bd0b15`); author inline-create disabled — lookup-only (`a962521`). Colaboradores collection renamed to Biografias; Utilizadores gains optional `biography` relation field linking to contributor profile (`17b1c34`, `da14dc7`). Design spec at `docs/superpowers/specs/2026-06-15-biografias-utilizadores-design.md`. |


---

## Credentials Reference

Non-secret identifiers needed for operations:

| What | Value |
|------|-------|
| Cloudflare Account ID | `43220b81420989e7198287bd4559a701` |
| Cloudflare Workers subdomain | `leftfield` |
| R2 Access Key ID | `e04ffceffcb454326996be5a9af00865` |
| R2 Public URL | `https://pub-576ea11202f543d0bf28d36ef63d18ff.r2.dev` |
| Auth Worker URL | `https://musictide-auth.leftfield.workers.dev` |
| Auth Worker KV namespace ID | `1f6af293b61b4e989bc65e3c94ea21b3` |
| R2 Proxy Worker URL | `https://musictide-media-proxy.leftfield.workers.dev` |
| GitHub repo | `n-000000/musictide` (public) |
| Cloudflare Pages URL | `https://musictide.pages.dev` |

Secrets (R2 Secret Access Key, `GOOGLE_CLIENT_ID`, `GITHUB_SERVICE_ACCOUNT_PAT`) are in the developer's password manager and/or Cloudflare Worker secrets. Never committed to the repo.
