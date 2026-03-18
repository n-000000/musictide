# Design: Cloudflare Pages + R2 Deployment

**Date:** 2026-03-18
**Repo:** codeberg.org/ngon/musictide → github.com/ngon/musictide
**Status:** Approved

## Summary

Migrate the musictide git remote from Codeberg to GitHub and wire up Cloudflare Pages for automatic Hugo builds on every push. Cloudflare R2 provides media storage (10GB free tier). Codeberg stays as a passive backup mirror.

## Goals

- Photographer commits content via Sveltia CMS → site goes live in ~30 seconds, no developer involvement
- Media (photos, eventually video) stored in R2, not in git
- Zero recurring cost until R2 free tier (10GB) is exceeded
- Fast delivery in Portugal (Cloudflare PoP in Lisbon)
- No servers to maintain

## Out of Scope

- Sveltia CMS integration and CMS-to-R2 upload workflow (separate phase)
- Custom domain (deferred — can be added later in Cloudflare Pages settings)
- Video hosting strategy (deferred)
- Ads interleaving (separate phase)

## Stack

- **GitHub** — primary git remote (public repo, commercial-friendly free tier)
- **Cloudflare Pages** — Hugo build + global CDN hosting, triggered on push to `main`
- **Cloudflare R2** — media object storage, S3-compatible, 10GB free, no egress fees
- **Codeberg** — passive backup mirror (existing remote, kept as `codeberg` remote)

## Architecture

### Build Pipeline

```
git push origin main (GitHub)
        │
        ▼
Cloudflare Pages (detects push via GitHub integration)
        │
        ▼
hugo --gc --minify  (Hugo 0.158.0 Extended)
        │
        ▼
public/ deployed to Cloudflare CDN
        │
        ▼
https://musictide.pages.dev (and later custom domain)
```

Cloudflare Pages has native Hugo support. Build command and output directory are set in the Cloudflare Pages dashboard. No pipeline YAML file is required in the repo.

The Hugo version is set as an environment variable in the Pages dashboard (Settings → Environment variables → Production):

```
HUGO_VERSION = 0.158.0
```

This is the only mechanism that controls the Hugo version for Git-connected Pages builds — it cannot be set via a file in the repo.

### Media Storage

R2 bucket `musictide-media` is created with public read access explicitly enabled in the Cloudflare dashboard (R2 → bucket → Settings → Allow Access). Once enabled, Cloudflare assigns a permanent `pub-<hash>.r2.dev` URL.

Hugo templates reference media via a configurable base URL parameter in `params.yaml`:

```yaml
# config/_default/params.yaml addition
mediaBaseURL: https://pub-<hash>.r2.dev
```

All content markdown references images as paths relative to this base. Changing the media host in future (e.g. switching to a VPS or custom domain) is a one-line config change.

### Git Remotes

```
origin    → github.com/ngon/musictide   (primary — Cloudflare Pages watches this)
codeberg  → codeberg.org/ngon/musictide (backup mirror — best-effort, manual)
```

A `yarn mirror` script pushes to Codeberg on demand. This is intentionally manual and best-effort — it does not auto-run on every push. If a reliable automated mirror is needed in future, a GitHub Actions workflow can be added.

## Files

| File | Action | Purpose |
|------|--------|---------|
| `config/_default/hugo.yaml` | Modify | Update `baseURL` from Codeberg Pages URL to `https://musictide.pages.dev` |
| `config/_default/params.yaml` | Modify | Add `mediaBaseURL` pointing at R2 public URL |
| `package.json` | Modify | Add `mirror` script (`git push codeberg main`) |
| `.gitignore` | Verify | Confirm `public/` is already ignored (it is) |

No `wrangler.toml` is needed — Cloudflare Pages build settings are configured entirely in the dashboard for Git-connected projects.

## Cloudflare Pages Dashboard Settings

To be configured manually in the Cloudflare Pages dashboard when creating the project:

| Setting | Value |
|---------|-------|
| Build command | `hugo --gc --minify` |
| Build output directory | `public` |
| Root directory | `/` |
| Environment variable (Production) | `HUGO_VERSION = 0.158.0` |

## R2 Bucket Setup

1. Create bucket `musictide-media` in Cloudflare dashboard
2. **Enable public access**: R2 → `musictide-media` → Settings → Allow Access → Enable
3. Record the assigned `pub-<hash>.r2.dev` URL — this is the value for `mediaBaseURL`
4. CORS policy: allow GET from `*.pages.dev` and any future custom domain

Bucket structure convention (not enforced): `/<year>/<event-slug>/filename.jpg`

## Acceptance Criteria

1. `git push origin main` triggers a Cloudflare Pages build automatically
2. Build completes with zero errors in under 2 minutes
3. `https://musictide.pages.dev/` serves the Portuguese (pt-PT) Blowfish home page; `/pt/` returns 404 (confirming `defaultContentLanguageInSubdir: false` is working)
4. `https://musictide.pages.dev/en/` serves the English (en-GB) version
5. R2 bucket exists, public access is enabled, and a test image is publicly accessible via `https://pub-<hash>.r2.dev/test.jpg`
6. `mediaBaseURL` in `params.yaml` points at the correct R2 public URL
7. Codeberg remote still works: `git push codeberg main` succeeds
