# Sveltia CMS — Brainstorming Context (pre-compact backup)

**Date:** 2026-03-20
**Status:** Brainstorming in progress — NOT a spec, NOT approved. Resume from here.

---

## Where We Are

Brainstorming Sveltia CMS integration for musictide. Design has NOT been written yet. We are at the "approaches proposed, waiting for user approval to proceed to design" stage.

## Decisions Made So Far

- **Media storage: Cloudflare R2** (already set up at `pub-576ea11202f543d0bf28d36ef63d18ff.r2.dev`)
- **NOT Cloudinary** — R2 has no egress fees; Cloudinary's "25GB" is a shared credit pool covering storage + bandwidth, which burns fast on a media-heavy site
- **NOT git media** — binary files bloat git history; R2 is the right call long-term
- **Cloudflare Worker + pre-signed URLs (Option C)** — user was leaning this way; Worker generates a short-lived pre-signed R2 upload URL, browser uploads directly to R2 (browser → R2, Worker never touches the file). ~30 lines of Worker code. Free tier is 100,000 requests/day, way more than needed.
- **Cloudflare Workers are free** for this use case — confirmed with user, no cost concern.

## Content Model (confirmed with user)

1. **Articles** — photography-heavy posts, text + photos, bilingual (pt-PT primary, en-GB secondary)
2. **Ads** — rich content, either Image or HTML, with click-through metadata. JS interleaving into listing pages is a LATER phase — CMS just needs to CREATE and store them.
3. **Staff/Contributors** — photo, contact info, small bio. "To the side" — not the main focus. Multiple contributors possible (not just one author).
4. **Media library** — flat, R2-backed. Sveltia's built-in media library wired to R2 via Worker + pre-signed URLs.

## Site Context

- Hugo + Blowfish v2, live at https://musictide.pages.dev
- GitHub: github.com/n-000000/musictide (public repo)
- Hosting: Cloudflare Pages (builds on push to main)
- Media: Cloudflare R2 (`pub-576ea11202f543d0bf28d36ef63d18ff.r2.dev`)
- Bilingual: pt-PT primary (`defaultContentLanguageInSubdir: false`), en-GB secondary
- `static/` and `layouts/` are currently empty
- `mediaBaseURL` already set in `config/_default/params.yaml`

## Proposed Architecture (NOT yet approved by user)

### Option C — Pre-signed URL Worker (recommended, user was receptive)

1. **Sveltia CMS** served at `/admin/` via `static/admin/index.html` (loads Sveltia from CDN)
2. **Auth**: Cloudflare Pages OAuth proxy for GitHub — configure a GitHub OAuth app, point callback at Cloudflare's built-in proxy at `https://musictide.pages.dev/auth`
3. **Media uploads**:
   - Sveltia calls Worker at `https://musictide-media-upload.workers.dev/presign?filename=foo.jpg`
   - Worker validates GitHub token, generates pre-signed R2 upload URL (short-lived)
   - Browser uploads file DIRECTLY to R2 using pre-signed URL (Worker never touches file)
   - Worker returns the public R2 URL to Sveltia
   - Sveltia inserts the R2 URL into the markdown
4. **Sveltia media library plugin**: ~50 lines of JS registered via `CMS.registerMediaLibrary()` — implements the Netlify CMS media library plugin API that Sveltia inherits
5. **Collections**: articles, ads, staff (see content model above)
6. **`static/admin/config.yml`**: Sveltia configuration file

### Files to create/modify

| File | Action | Purpose |
|------|--------|---------|
| `static/admin/index.html` | Create | Loads Sveltia from CDN, registers media library plugin |
| `static/admin/config.yml` | Create | Sveltia CMS configuration (collections, auth, media) |
| `static/admin/r2-media-plugin.js` | Create | Custom Sveltia media library plugin for R2 |
| Cloudflare Worker | Create (separate deploy) | Pre-signed URL generator for R2 uploads |
| `layouts/_default/` | Possibly | If any Hugo template overrides needed |

## Open Questions (not yet asked)

1. Does the photographer need bilingual article creation, or do they write PT only and someone else handles EN translation?
2. What fields does an Article need? (title, date, cover photo, body, tags, author, slug — anything else?)
3. What fields does an Ad need? (type: image|HTML, content/image URL, click-through URL, advertiser name, active dates?)
4. Should ads be stored as content files or data files?
5. Does the Staff page need to be CMS-managed or can it be hardcoded initially?

## Next Step

Resume brainstorming: present the full design to user, get approval, write spec, review, then invoke writing-plans.

The design to present covers:
1. Auth (Cloudflare Pages GitHub OAuth)
2. Admin UI (`/admin/` route, CDN-loaded Sveltia)
3. Media upload flow (Worker + pre-signed URLs → R2)
4. Collections schema (articles, ads, staff)
5. Bilingual strategy in Sveltia
