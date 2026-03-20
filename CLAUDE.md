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

**Stack:** Hugo 0.158.0 Extended + Blowfish v2 (Hugo module) + Cloudflare Pages + Cloudflare R2

### Hugo Module

```
config/_default/module.yaml:
└── github.com/nunocoracao/blowfish/v2   # theme, layouts, shortcodes, partials
```

No local `layouts/` overrides yet. Create them only when you need to override Blowfish behaviour.

### Configuration Split

All config lives in `config/_default/` as YAML:

| File | Purpose |
|------|---------|
| `hugo.yaml` | Core Hugo settings, baseURL, outputs, taxonomies |
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

### Git Remotes

```
origin    → git@github.com:n-000000/musictide.git   (primary, Cloudflare Pages watches this)
codeberg  → ssh://git@codeberg.org/ngon/musictide.git (backup mirror, run yarn mirror manually)
```

---

## Content Model

Planned collections (Sveltia CMS — not yet implemented):

| Collection | Storage | Purpose |
|------------|---------|---------|
| Articles | `content/posts/` | Photography-heavy event posts, bilingual |
| Ads | `content/ads/` or `data/ads/` | Image or HTML ads with click-through metadata |
| Staff | `content/authors/` | Contributor profiles (photo, bio, contact) |

**Ads note:** Ads are paid placement (transactional, not per-click). JS interleaving into listing pages is a future phase — CMS just needs to create and store them for now.

---

## Pending Work

### Next up: Sveltia CMS Integration

Brainstorming in progress. See `docs/superpowers/specs/2026-03-20-sveltia-cms-brainstorm-context.md` for full context. Resume from there — do NOT start fresh.

**Decided:**
- Auth via Cloudflare Pages GitHub OAuth proxy
- Media uploads via Cloudflare Worker + R2 pre-signed URLs (browser → R2 directly, Worker just generates the URL)
- Sveltia served at `/admin/` from CDN
- Collections: articles, ads, staff

**Not yet decided:** exact content schema fields, bilingual authoring workflow.

### Future phases (not started)

- Ads interleaving via client-side JS (insert ads at regular intervals in listing pages)
- Custom domain
- Codeberg Pages or GitHub Actions CI mirror automation
- Video hosting strategy

---

## Known Quirks

- **Blowfish version warning:** `WARN Module "github.com/nunocoracao/blowfish/v2" is not compatible with this Hugo version: 0.141.0/0.157.0 extended` — Blowfish v2.100.0 declares max Hugo 0.157.0 but we run 0.158.0. This is a soft warning, builds succeed. Ignore it.
- **`public/` directory:** Exists locally from local builds. It is gitignored. Do not commit it.
- **`static/` and `layouts/` are empty** — this is correct. Don't add files there unless specifically needed.
- **`.worktrees/` is gitignored** — worktrees live at `.worktrees/<branch-name>`.

---

## Build Verification

After any change, always verify:

```bash
hugo 2>&1
```

Expected: zero `ERROR` lines. `WARN` about Blowfish version is acceptable.
