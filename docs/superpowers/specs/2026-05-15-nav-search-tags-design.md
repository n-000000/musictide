# Design: Nav categories, search/tags, multi-category audit

**Date:** 2026-05-15  
**Status:** Approved

---

## Scope

Three related issues with category/tag/search coherence:

1. Espinho + Nacional missing from nav
2. Search returns category pages alongside tag pages (both as "Espinho"), tag pages use wrong layout
3. Multi-category articles and front-page dedup — audit only, no code changes

---

## Issue 1 — Nav: add Espinho + Nacional

### What
Add Espinho and Nacional to the main nav before the thematic categories, with their respective colors applied automatically.

### How
Edit `config/_default/menus.pt.yaml` and `config/_default/menus.en.yaml`:
- Renumber existing entries to free up weights at the top
- Add Espinho (weight 10) and Nacional (weight 20)
- Final order: **Espinho · Nacional · Cultura · Desporto · Lifestyle · Agenda · Colaboradores**

Color is resolved automatically — both desktop (`desktop-menu.html`) and mobile (`mobile-menu.html`) templates already compute `cat-text--{color}` by calling `site.GetPage` on the menu item URL and reading `.Params.color`. No template or CSS changes required. The CSS classes `cat-text--primary-300` (Espinho) and `cat-text--secondary-500` (Nacional) are already defined in `assets/css/musictide.css`.

---

## Issue 2 — Search/Tags

### Root cause
Hugo generates both `/categories/espinho/` and `/tags/espinho/` as full HTML pages. Pagefind indexes both. Search returns them as duplicate results with the same title. Clicking the category result is correct; clicking the tag result lands on Blowfish's default list layout with no per-article category color.

Compounding factor: hashtags in article body are rendered as plain text (the `#` prefix is stripped by JS in `extend-head.html`) — tag pages are therefore only reachable via Pagefind search, never via in-page links.

### Design principle
Nav is the canonical entry point for categories. Search is the discovery mechanism for tags. The two should not overlap.

### Part A — Suppress category term pages from Pagefind
Pagefind respects `data-pagefind-ignore="all"` on any element in a page — it removes the entire page from the search index regardless of where the attribute is placed.

In `layouts/categories/term.html`: wrap the `{{ define "main" }}` content in a `<div data-pagefind-ignore="all">`. Category term pages will no longer appear in search results. The category nav entries remain the authoritative access point.

No change needed to `layouts/categories/term.fragment.html` — HTMX fragment responses are not full HTML pages and are not indexed by Pagefind.

### Part B — Fix tag term page layout
Create two new files:

**`layouts/tags/term.html`**  
Mirrors the structure of `layouts/categories/term.html` with these differences:
- No `$colorSlot` lookup from `.Params.color` (tags have no color param)
- Hero shows the most recent non-draft article tagged with this term, with its own feature image; `category-badge.html` renders the article's own first category (existing partial, no changes needed)
- HTMX sentinel points to `layouts/tags/term.fragment.html`
- Content wrapped in `data-pagefind-ignore` is NOT applied here — tag pages should remain searchable

**`layouts/tags/term.fragment.html`**  
Mirrors `layouts/categories/term.fragment.html` with these differences:
- No `$colorSlot` from `.Params.color`
- Per-article color lookup mirrors `layouts/posts/list.fragment.html`: for each article, look up `index .Params.categories 0` → `site.GetPage "/categories/{slug}"` → `.Params.color`. Each card gets its own article's category color.
- Hero exclusion: same as the category fragment — exclude the first/latest post (shown in the hero above) from the card grid

---

## Issue 3 — Multi-category articles and dedup audit

### Findings
Both behaviors are intentional, not accidental:

**Category badge** (`layouts/partials/category-badge.html`): uses `index $cats 0` to explicitly take the first category. When an article has multiple categories, only the first is badged. This is correct — the badge is a UI element for quick scanning, not a complete taxonomy display.

**Front-page hero/card dedup** (`layouts/posts/list.fragment.html`, `layouts/categories/term.fragment.html`): both templates explicitly exclude the hero article using `where $posts "Permalink" "ne" $hero.Permalink`. An article appears exactly once in the feed regardless of how many categories it has.

**Multi-category scraped articles**: 13 of ~82 articles have two categories (e.g., `["Cultura", "Nacional"]`, `["Desporto", "Espinho"]`). Hugo correctly lists these articles on both category term pages. The CMS `category` field is single-value, so new articles will have one category only. No code or content changes required.

### Decision deferred
Whether to clean up the 13 multi-category scraped articles (trim to one category each) or to change the CMS widget to `multiple: true` is deferred to a review with the photographer. No action for this implementation.

---

## Files changed

| File | Change |
|------|--------|
| `config/_default/menus.pt.yaml` | Add Espinho + Nacional, renumber weights |
| `config/_default/menus.en.yaml` | Same |
| `layouts/categories/term.html` | Wrap main content in `data-pagefind-ignore="all"` div |
| `layouts/tags/term.html` | New file — card layout, hero, HTMX sentinel |
| `layouts/tags/term.fragment.html` | New file — card grid with per-article category color |

---

## Out of scope

- Making hashtags in article body clickable links to tag pages (future work)
- Pagefind configuration for other taxonomy types (authors, series)
- Multi-category CMS widget change
- Cleaning up scraped articles
