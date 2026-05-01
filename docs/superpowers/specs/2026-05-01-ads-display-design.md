# Ads Display — Design Spec

**Date:** 2026-05-01
**Status:** Approved (revised)

---

## Overview

Two distinct ad placements, both resolved at visit time by client-side JS (no rebuild required for an ad to go live or expire):

1. **Destaque slot** — one premium ad, always shown immediately below the hero on homepage and category pages. Designated by `destaque: true` in frontmatter.
2. **Feed slots** — one ad injected after each HTMX infinite-scroll batch loads (i.e. every time the IntersectionObserver fires a sentinel). Picks randomly from all currently-active ads.

**Future phase (not in scope now):** card-format ads embedded as a grid slot within the article card layout.

---

## Placement

### Destaque slot
- **Homepage** — after the hero `</article>`, before the HTMX sentinel
- **Category pages** — after the hero `</article>`, before the HTMX sentinel
- Slot is `hidden` if no destaque ad is currently active

### Feed slots
- **Homepage** — after each fragment batch loads (`list.fragment.html`)
- **Category pages** — after each fragment batch loads (`term.fragment.html`)
- Each fragment includes one `<div data-ad-inject hidden></div>` placeholder
- JS listens to `htmx:afterSettle`, finds unpopulated `[data-ad-inject]` elements in the new content, fills them with a randomly-chosen active ad
- Slot stays hidden if no active ads exist

---

## Data Model

Ad content lives in `content/ads/` (CMS collection `ads`). Relevant frontmatter fields:

| Field | Type | Notes |
|---|---|---|
| `title` | string | Internal label; also rendered as card title |
| `creative_image` | string (URL) | R2 image URL; fills the card image area |
| `click_through_url` | string (URL) | Full card links here; opens in new tab |
| `active_from` | datetime or empty | Absent → treated as already started |
| `active_until` | datetime or empty | Absent → treated as never expiring |
| `destaque` | bool | If `true`, this ad occupies the below-hero slot |
| `draft` | bool | Draft ads never included in the JSON blob |

Only one ad should have `destaque: true` at a time. If multiple do, the first one found is used (no error, just a content convention to enforce via CMS notes).

---

## Architecture

### `layouts/partials/ads-data.html` (new)

Outputs a `<script type="application/json" id="mt-ads-data">` tag. Iterates all non-draft pages in the `ads` section, serialises to JSON:

```json
[
  {
    "title": "Ariel — Roupa Sempre Limpa",
    "image": "https://pub-....r2.dev/ads/2026/ariel.jpg",
    "url": "https://ariel.com",
    "from": "2026-05-01T00:00:00Z",
    "until": "2026-06-01T00:00:00Z",
    "destaque": true
  }
]
```

`active_from` absent → `from` field omitted. `active_until` absent → `until` field omitted.

### `layouts/partials/ad-slot.html` (new)

Renders the destaque card container (`hidden`) plus an inline `<script>` block that:

1. Parses `#mt-ads-data`
2. Filters to currently-active ads: `now >= (from || 0)` and `now <= (until || Infinity)`
3. Finds the destaque ad (`destaque === true`) within the active set
4. If none → returns, slot stays `hidden`
5. Sets `href` on the `<a>`, `src` on the `<img>`, text on the title element (pre-rendered empty attributes, no DOM creation)
6. Removes `hidden` from the outer `.mt-ad-slot` wrapper
7. Also attaches an `htmx:afterSettle` listener (once, guarded by a flag so it only registers once per page) that handles feed slot injection (see below)

### Feed slot injection (inside `ad-slot.html` script)

The `htmx:afterSettle` listener:

1. Finds all `[data-ad-inject]:not([data-ad-populated])` in the document
2. For each, picks a random ad from the active set (any ad, including destaque)
3. Clones the pre-rendered card template, fills `href` / `src` / title
4. Replaces the placeholder's contents and removes `hidden`
5. Marks the placeholder `data-ad-populated` so it isn't processed again on subsequent settles

### `layouts/partials/extend-head.html` (modified)

Add `{{ partial "ads-data.html" . }}` so the JSON blob is available on every page.

### `layouts/partials/home/hero.html` (modified)

Add `{{ partial "ad-slot.html" . }}` after the hero `</article>`, before the sentinel div.

### `layouts/categories/term.html` (modified)

Same — add `{{ partial "ad-slot.html" . }}` after the hero `</article>`, before the sentinel div.

### `layouts/posts/list.fragment.html` (modified)

Add `<div data-ad-inject hidden></div>` as the last element before the pager sentinel (or after the last month group).

### `layouts/categories/term.fragment.html` (modified)

Same.

### `assets/css/musictide.css` (modified)

New `.mt-ad-slot` and `[data-ad-inject]` blocks:

- Centred, max-width 320px, margin auto
- Top/bottom margin to breathe against the hero and first month heading
- Dark card background consistent with site aesthetic
- "Publicidade" label above the card: small, muted, uppercase, sans-serif
- Card image: full-width, aspect-ratio 4:3, `object-fit: cover`
- Card title: below image, light colour, modest font size
- Full card is `<a target="_blank" rel="noopener">`
- Hover: slight opacity reduction, no transform

---

## Mock Content

Create two mock ads for testing both slots:

**`content/ads/ariel-destaque.md`**
```yaml
---
title: "Ariel — Roupa Sempre Limpa"
creative_image: "https://placehold.co/600x450/b45309/ffffff?text=ARIEL"
click_through_url: "https://ariel.com"
active_from: "2026-05-01T00:00:00Z"
active_until: "2026-12-31T23:59:59Z"
destaque: true
draft: false
---
```

**`content/ads/skip-mock.md`** (feed slot)
```yaml
---
title: "Skip — Limpo à Primeira"
creative_image: "https://placehold.co/600x450/1d4ed8/ffffff?text=SKIP"
click_through_url: "https://skip.com"
active_from: "2026-05-01T00:00:00Z"
active_until: "2026-12-31T23:59:59Z"
destaque: false
draft: false
---
```

Remove or draft both before launch.

---

## Edge Cases

| Scenario | Behaviour |
|---|---|
| No active ads | Both slot types stay `hidden`, no visible gap |
| No destaque ad active | Below-hero slot hidden; feed slots still populate from active pool |
| Multiple `destaque: true` ads active | First one in the JSON array used (content convention, not enforced by code) |
| `active_from` / `active_until` missing | Treated as open-ended |
| JS disabled | All slots stay `hidden` (graceful degradation) |
| Infinite scroll not triggered | Feed slots never populated (no `htmx:afterSettle` fires) |

---

## Files Changed

| File | Action |
|---|---|
| `layouts/partials/ads-data.html` | Create |
| `layouts/partials/ad-slot.html` | Create |
| `layouts/partials/extend-head.html` | Modify — add ads-data partial |
| `layouts/partials/home/hero.html` | Modify — add ad-slot partial |
| `layouts/categories/term.html` | Modify — add ad-slot partial |
| `layouts/posts/list.fragment.html` | Modify — add `data-ad-inject` placeholder |
| `layouts/categories/term.fragment.html` | Modify — add `data-ad-inject` placeholder |
| `assets/css/musictide.css` | Modify — add ad slot styles |
| `content/ads/ariel-destaque.md` | Create (mock, remove before launch) |
| `content/ads/skip-mock.md` | Create (mock, remove before launch) |

---

## Out of Scope

- Ad analytics / click tracking
- Ads on individual article pages
- A/B testing or frequency capping
- **Card-format ads** (grid slot in article card layout) — future phase, revisit separately
