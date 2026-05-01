# Ads Display — Design Spec

**Date:** 2026-05-01
**Status:** Approved

---

## Overview

Render one active ad as a centred card immediately below the hero image, on both the homepage and category listing pages. Active ads are determined at visit time by client-side JS — no rebuild required for an ad to go live or expire.

---

## Placement

- **Homepage** (`layouts/partials/home/hero.html`) — after the hero `</article>`, before the HTMX sentinel `<div>`
- **Category pages** (`layouts/categories/term.html`) — after the hero `</article>`, before the HTMX sentinel `<div>`
- Only one ad slot per page. The slot is invisible if no ad is active.

---

## Data Model

Ad content is already defined in the CMS (`static/admin/config.yml`, collection `ads`, folder `content/ads/`). Relevant frontmatter fields:

| Field | Type | Notes |
|---|---|---|
| `title` | string | Internal label; also used as visible card title |
| `creative_image` | string (URL) | R2 image URL; fills the card image area |
| `click_through_url` | string (URL) | Full card is a link to this; opens in new tab |
| `active_from` | datetime or empty | If absent, treated as "already started" |
| `active_until` | datetime or empty | If absent, treated as "never expires" |
| `draft` | bool | Draft ads are never included |

---

## Architecture

### `layouts/partials/ads-data.html` (new)

Outputs a `<script type="application/json" id="mt-ads-data">` tag in `<head>`. Iterates all pages in the `ads` section, skips drafts, serialises to a JSON array:

```json
[
  {
    "title": "Ariel — Roupa Sempre Limpa",
    "image": "https://pub-....r2.dev/ads/2026/ariel.jpg",
    "url": "https://ariel.com",
    "from": "2026-05-01T00:00:00Z",
    "until": "2026-06-01T00:00:00Z"
  }
]
```

Empty `active_from` → `from` omitted from JSON (or empty string). Empty `active_until` → `until` omitted.

### `layouts/partials/ad-slot.html` (new)

Renders the card container (initially `hidden`) and an inline `<script>` that runs on page load:

1. Parse `#mt-ads-data`
2. Filter: `now >= (from || 0)` and `now <= (until || Infinity)`
3. If zero active → return, slot stays hidden
4. Pick one at random from the active set
5. Set `href` on the `<a>`, `src` on the `<img>`, and text on the title element — all pre-rendered with empty attributes, no DOM creation
6. Remove `hidden` from the outer `.mt-ad-slot` wrapper (which contains the "Publicidade" label + card)

Card HTML is fully pre-rendered with empty/placeholder attributes. JS only fills values in — no `createElement` or `innerHTML`.

### `layouts/partials/extend-head.html` (modified)

Add `{{ partial "ads-data.html" . }}` once, so the JSON blob is available on every page that needs it.

### `layouts/partials/home/hero.html` (modified)

Add `{{ partial "ad-slot.html" . }}` immediately after the closing `</article>` of the hero, before the HTMX sentinel div.

### `layouts/categories/term.html` (modified)

Same — add `{{ partial "ad-slot.html" . }}` after the hero `</article>`, before the sentinel div.

### `assets/css/musictide.css` (modified)

New `.mt-ad-slot` block:

- Centred, max-width ~320px, margin auto
- Dark card background matching site aesthetic
- "Publicidade" label above: small, muted, uppercase, sans-serif
- Card image: full-width, fixed aspect ratio 4:3, `object-fit: cover` (normalises whatever the advertiser uploads)
- Card title: below image, light colour, sans-serif, modest font size
- Full card is a `<a>` wrapping image + title — `target="_blank" rel="noopener"`
- Hover: slight opacity reduction (no transform, consistent with site style)

---

## Mock Content

Create `content/ads/ariel-mock.md` for local testing:

```yaml
---
title: "Ariel — Roupa Sempre Limpa"
creative_image: "https://placehold.co/600x400/b45309/ffffff?text=ARIEL"
click_through_url: "https://ariel.com"
active_from: "2026-05-01T00:00:00Z"
active_until: "2026-12-31T23:59:59Z"
draft: false
---
```

Remove or set `draft: true` before launch.

---

## Edge Cases

| Scenario | Behaviour |
|---|---|
| No active ads | Slot stays `hidden`, no visible gap |
| Multiple active ads | One chosen at random on each page load |
| `active_from` missing | Treated as always started |
| `active_until` missing | Treated as never expiring |
| No ads collection entries at all | JSON blob is `[]`, slot stays hidden |
| JS disabled | Slot stays hidden (graceful degradation) |

---

## Files Changed

| File | Action |
|---|---|
| `layouts/partials/ads-data.html` | Create |
| `layouts/partials/ad-slot.html` | Create |
| `layouts/partials/extend-head.html` | Modify — add ads-data partial |
| `layouts/partials/home/hero.html` | Modify — add ad-slot partial |
| `layouts/categories/term.html` | Modify — add ad-slot partial |
| `assets/css/musictide.css` | Modify — add `.mt-ad-slot` styles |
| `content/ads/ariel-mock.md` | Create (mock content, remove before launch) |

---

## Out of Scope

- Ad analytics / click tracking
- Multiple ad slots per page
- Ads on article pages
- Ads in the infinite scroll feed (between article batches)
- A/B testing or frequency capping
