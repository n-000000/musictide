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
Cloudflare Pages (detects push)
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

No pipeline YAML required. Cloudflare Pages has native Hugo support — build command and output directory are configured via the Cloudflare Pages dashboard or `wrangler.toml`.

### Media Storage

R2 bucket `musictide-media` is created with public read access. Hugo templates reference media via a configurable base URL parameter:

```yaml
# config/_default/params.yaml addition
mediaBaseURL: https://pub-<hash>.r2.dev
```

All content markdown references images as relative paths under this base. Changing the media host in future (e.g. switching to a VPS) is a one-line config change.

### Git Remotes

```
origin    → github.com/ngon/musictide   (primary — Cloudflare Pages watches this)
codeberg  → codeberg.org/ngon/musictide (backup mirror — push manually or via hook)
```

A simple post-push alias (`yarn mirror`) pushes to Codeberg after every GitHub push, keeping it in sync as an off-site backup.

## Files

| File | Action | Purpose |
|------|--------|---------|
| `config/_default/params.yaml` | Modify | Add `mediaBaseURL` pointing at R2 public URL |
| `package.json` | Modify | Add `mirror` script for Codeberg sync |
| `wrangler.toml` | Create | Declares Hugo version for Cloudflare Pages |
| `.gitignore` | Modify | Ensure `public/` stays ignored |

## Cloudflare Pages Configuration

Set in Cloudflare Pages dashboard (or `wrangler.toml`):

```toml
# wrangler.toml
name = "musictide"
compatibility_date = "2024-01-01"

[env.production.vars]
HUGO_VERSION = "0.158.0"

[pages_build_output_dir]
value = "public"
```

Build command: `hugo --gc --minify`
Build output directory: `public`
Root directory: `/` (repo root)

## R2 Bucket

- Bucket name: `musictide-media`
- Public access: enabled (read-only, via R2 public URL)
- CORS: allow GET from `*.pages.dev` and future custom domain
- Structure: `/<year>/<event-slug>/filename.jpg` (convention, not enforced by this phase)

## Acceptance Criteria

1. `git push origin main` triggers a Cloudflare Pages build automatically
2. Build completes with zero errors in under 2 minutes
3. `https://musictide.pages.dev/` serves the Blowfish home page
4. `https://musictide.pages.dev/en/` serves the English version
5. R2 bucket exists and a test image is publicly accessible via its R2 URL
6. `mediaBaseURL` in `params.yaml` points at the R2 bucket
7. Codeberg remote still works (`git push codeberg main` succeeds)
