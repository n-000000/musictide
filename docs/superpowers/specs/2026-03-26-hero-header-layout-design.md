# Hero, Header & Layout Redesign — Design Spec

**Date:** 2026-03-26
**Status:** Approved

---

## Scope

Seven discrete changes across three areas: hero section, header alignment, and site-wide layout/style options.

---

## 1. Hero changes (`layouts/partials/home/hero.html`)

### 1.1 Remove CTA button
Remove the "Ler artigo →" `<a>` button. The whole hero becomes the call-to-action (see 1.4).

### 1.2 Remove article description
Remove the `featureimagecaption` paragraph. Hero shows only event badge + title.

### 1.3 Fixed 16:9 aspect ratio
The hero image container gets `aspect-ratio: 16/9`. It scales with the hero width at all breakpoints. The inner content div changes from `py-16 sm:py-24 lg:py-32` padding-based height to `absolute inset-0 flex flex-col` so it fills the fixed-ratio container.

### 1.4 Entire hero is a clickable link — mobile-safe
The outer hero container (`<div class="relative shadow-xl">`) becomes a single `<a href="{{ $latest.Permalink }}">`. The nested `<a>` around the title is removed (nested anchors are invalid HTML and redundant). Browsers natively cancel click events when a touch gesture moves beyond scroll threshold — no custom JS required.

### 1.5 Layout: badge above title, both flush-left, bottom-anchored
- Content is anchored to the bottom-left of the hero frame (`items-end justify-end` or `absolute bottom-0 left-0`)
- Event badge and title are stacked vertically, left-aligned flush
- Both use the heading font (inherits from theme global style — no hardcoded font-family)
- Badge: primary-500 background, same font-family as title, uppercase, tight letter-spacing
- Title: large headline size (approx `text-5xl` or larger), uppercase, `text-neutral-100`, `hero-title` text-shadow class

---

## 2. Header alignment (`layouts/partials/extend-head.html`)

### 2.1 Constrain header to hero/content bounds
Add CSS to `extend-head.html` targeting Blowfish's header inner container:

```css
header > div,
header nav > div {
  max-width: 1600px;
  margin-left: auto;
  margin-right: auto;
  padding-left: 30px;
  padding-right: 30px;
}
```

This aligns the header's logo and nav links with the left and right edges of the hero and content columns. No template override needed.

---

## 3. Misc

### 3.1 CMS toggle: homepage gallery style
New field `homepage_gallery_style` in `data/style.yaml` (default: `cards`). Options: `cards` | `list`.

In `layouts/partials/home/hero.html`, the recent articles section checks this value:
- `cards` → existing card grid (`article-link/card.html`)
- `list` → Blowfish list partial (`article-link/simple.html` or equivalent)

CMS field added to `static/admin/config.yml` under the Estilo Visual file collection, as a select widget with two options.

### 3.2 CMS toggle: posts listing page style
New field `posts_listing_style` in `data/style.yaml` (default: `cards`). Options: `cards` | `list`.

New override at `layouts/posts/list.html` (or `layouts/_default/list.html` scoped to posts) that reads `hugo.Data.style.posts_listing_style` and passes the appropriate `showCards` value to Blowfish's list rendering. This replaces the static `list.showCards` in `params.yaml` for the posts section.

CMS field added alongside 3.1 in `static/admin/config.yml`.

### 3.3 Global border-radius: 0
Replace the existing card-specific `border-radius: 0 !important` rule in `extend-head.html` with a global reset:

```css
*, *::before, *::after {
  border-radius: 0 !important;
}
```

Applies to all pages (listing, article, homepage). Covers all UI elements: cards, buttons, tag pills, inputs, hero image, author avatars.

---

## Files to change

| File | Change |
|------|--------|
| `layouts/partials/home/hero.html` | Items 1.1–1.5 and 3.1 |
| `layouts/partials/extend-head.html` | Items 2.1 and 3.3 |
| `layouts/posts/list.html` | New file — item 3.2 |
| `data/style.yaml` | Add `homepage_gallery_style`, `posts_listing_style` |
| `static/admin/config.yml` | Add CMS fields for 3.1 and 3.2 |

---

## Out of scope

- Mobile-specific breakpoint behaviour beyond what CSS aspect-ratio and flexbox provide natively
- Custom "list" row design — uses Blowfish's built-in list partial as-is
- Any changes to article detail pages
