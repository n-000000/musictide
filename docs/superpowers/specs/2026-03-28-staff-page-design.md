# Staff Page Design

**Date:** 2026-03-28
**Status:** Approved

---

## Overview

A single `/colaboradores/` listing page showing all contributor bio cards. No individual author profile pages. Simple, low-maintenance, CMS-editable.

---

## Scope

**In scope:**
- Single listing page at `/authors/` (PT: "Colaboradores", EN: "Contributors")
- Horizontal bio cards: photo left, name + bio + social icons right
- Social icons for all filled-in network fields (icon hidden when field is blank)
- Nav menu entries in both languages
- CMS field expansion for 10 social networks

**Out of scope:**
- Individual author profile pages (`/authors/<slug>/`)
- Author byline links on articles
- Blowfish `data/authors/*.json` multi-author widget integration (separate concern)

---

## Data Model

Author profiles are Hugo content files in `content/authors/`. The CMS (`static/admin/config.yml`, collection `authors`) manages them.

### Front matter fields

| Field | CMS widget | Notes |
|---|---|---|
| `title` | string | Display name |
| `photo` | image | R2-hosted, optional |
| `body` | text | Bio text, optional |
| `email` | string | Full email address, optional |
| `instagram` | string | Full profile URL, optional — already exists |
| `facebook` | string | Full profile URL, optional — new |
| `x_twitter` | string | Full profile URL, optional — new |
| `bluesky` | string | Full profile URL, optional — new |
| `mastodon` | string | Full profile URL, optional — new |
| `threads` | string | Full profile URL, optional — new |
| `tiktok` | string | Full profile URL, optional — new |
| `youtube` | string | Full profile URL, optional — new |
| `soundcloud` | string | Full profile URL, optional — new |
| `spotify` | string | Full profile URL, optional — new |
| `draft` | boolean | Hides from listing when true |

All social fields store full URLs (e.g. `https://instagram.com/musictide_pt`). The hint text in the CMS instructs the photographer accordingly.

Icon keys that map to Blowfish's `assets/icons/` SVGs:

| Field | Icon key |
|---|---|
| `instagram` | `instagram` |
| `facebook` | `facebook` |
| `x_twitter` | `x-twitter` |
| `bluesky` | `bluesky` |
| `mastodon` | `mastodon` |
| `threads` | `threads` |
| `tiktok` | `tiktok` |
| `youtube` | `youtube` |
| `soundcloud` | `soundcloud` |
| `spotify` | `spotify` |
| `email` | `email` (rendered as `mailto:` link) |

---

## Layout

### `layouts/authors/list.html`

New file. Overrides Blowfish's default taxonomy list layout for the `authors` section.

**Structure:**
- Page title from `content/authors/_index.md` ("Colaboradores")
- Responsive grid: `grid-cols-1 md:grid-cols-2`, gap between cards
- Iterates `{{ range .Pages }}` — only non-draft pages (Hugo handles draft filtering)
- Each card: horizontal flexbox, photo left (rounded, fixed size), text block right
- Text block: name (heading), bio (paragraph), social icon row

**Card photo:**
- Rendered via `resources.GetRemote` if URL, or `resources.Get` if local asset
- Falls back to a placeholder if no photo set
- Cropped to square, small fixed size (e.g. 80×80px)

**Social icon row:**
- 11 possible icons (email + 10 networks)
- Each rendered only if the corresponding front matter field is non-empty
- Uses `{{ partial "icon.html" "instagram" }}` wrapped in an `<a href="...">` tag
- Icons inherit theme colour via Blowfish's CSS custom properties
- `target="_blank" rel="noopener noreferrer"` on all external links
- Email rendered as `mailto:{{ .Params.email }}`

---

## Navigation

### `config/_default/menus.pt.yaml`

```yaml
- name: Colaboradores
  url: /authors/
  weight: 30
```

### `config/_default/menus.en.yaml`

```yaml
- name: Contributors
  url: /en/authors/
  weight: 30
```

Weight 30 places it after article-related links. Adjust during implementation if ordering needs tuning.

---

## CMS Changes

`static/admin/config.yml`, collection `authors` — add 9 new optional string fields after the existing `instagram` field:

```yaml
- label: Facebook
  name: facebook
  widget: string
  required: false
  hint: "URL completo do perfil (ex: https://facebook.com/musictide)"

- label: X / Twitter
  name: x_twitter
  widget: string
  required: false
  hint: "URL completo do perfil (ex: https://x.com/musictide)"

- label: Bluesky
  name: bluesky
  widget: string
  required: false
  hint: "URL completo do perfil"

- label: Mastodon
  name: mastodon
  widget: string
  required: false
  hint: "URL completo do perfil"

- label: Threads
  name: threads
  widget: string
  required: false
  hint: "URL completo do perfil"

- label: TikTok
  name: tiktok
  widget: string
  required: false
  hint: "URL completo do perfil"

- label: YouTube
  name: youtube
  widget: string
  required: false
  hint: "URL completo do canal"

- label: SoundCloud
  name: soundcloud
  widget: string
  required: false
  hint: "URL completo do perfil"

- label: Spotify
  name: spotify
  widget: string
  required: false
  hint: "URL do perfil de artista ou playlist"
```

Also update the existing `instagram` hint from "Só o handle, sem @" to "URL completo do perfil (ex: https://instagram.com/musictide_pt)" — consistent with the new fields.

---

## Files Changed

| File | Change |
|---|---|
| `static/admin/config.yml` | Add 9 social fields to `authors` collection; update instagram hint |
| `layouts/authors/list.html` | New file — bio card grid layout |
| `config/_default/menus.pt.yaml` | Add Colaboradores nav entry |
| `config/_default/menus.en.yaml` | Add Contributors nav entry |
| `content/authors/_index.en.md` | Add EN title ("Contributors") |

No changes to `hugo.yaml`, `params.yaml`, or any existing layouts.

---

## Verification

After implementation:

```bash
hugo 2>&1
```

Expected: zero `ERROR` lines. Navigate to `/authors/` — listing renders with bio cards. Navigate to `/en/authors/` — same in English. Nav menu shows "Colaboradores" / "Contributors" in both languages.

```bash
# Run local server for visual verification
yarn watch
```
Expected: Use `playwright` MPC browser integration to visual verification of layout and responsive behaviour. Test with various combinations of filled/empty social fields to confirm correct icon rendering.