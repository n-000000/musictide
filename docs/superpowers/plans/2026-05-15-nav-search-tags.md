# Nav categories, search/tags layout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Espinho + Nacional to the nav (with auto-coloring), suppress category pages from Pagefind search, and give tag term pages a proper card layout with per-article category colors.

**Architecture:** Pure Hugo template + config work. Nav is config-only (the menu templates already resolve `cat-text--{color}` from the linked page). Pagefind suppression uses `data-pagefind-ignore="all"` in `categories/term.html`. Tag pages get two new layout files mirroring the category equivalents, with per-article color lookup instead of term-level color.

**Tech Stack:** Hugo 0.158 + Blowfish v2 theme module. No JS, no CSS changes.

**Spec:** `docs/superpowers/specs/2026-05-15-nav-search-tags-design.md`

---

## Files

| Action | File |
|--------|------|
| Modify | `config/_default/menus.pt.yaml` |
| Modify | `config/_default/menus.en.yaml` |
| Modify | `layouts/categories/term.html` |
| Create | `layouts/tags/term.html` |
| Create | `layouts/tags/term.fragment.html` |

---

## Task 1: Add Espinho + Nacional to the nav

**Files:**
- Modify: `config/_default/menus.pt.yaml`
- Modify: `config/_default/menus.en.yaml`

Both desktop (`layouts/partials/header/components/desktop-menu.html`) and mobile menu templates already compute `cat-text--{color}` by calling `site.GetPage` on each menu item URL and reading `.Params.color`. The CSS classes `cat-text--primary-300` (Espinho) and `cat-text--secondary-500` (Nacional) are already defined. No template or CSS changes needed.

- [ ] **Replace `config/_default/menus.pt.yaml` entirely:**

```yaml
main:
  - name: Espinho
    url: /categories/espinho/
    weight: 10
  - name: Nacional
    url: /categories/nacional/
    weight: 20
  - name: Cultura
    url: /categories/cultura/
    weight: 30
  - name: Desporto
    url: /categories/desporto/
    weight: 40
  - name: Lifestyle
    url: /categories/lifestyle/
    weight: 50
  - name: Agenda
    url: /categories/agenda/
    weight: 60
  - name: Colaboradores
    url: /authors/
    weight: 70
```

- [ ] **Replace `config/_default/menus.en.yaml` entirely:**

```yaml
main:
  - name: Espinho
    url: /en/categories/espinho/
    weight: 10
  - name: Nacional
    url: /en/categories/nacional/
    weight: 20
  - name: Culture
    url: /en/categories/cultura/
    weight: 30
  - name: Sport
    url: /en/categories/desporto/
    weight: 40
  - name: Lifestyle
    url: /en/categories/lifestyle/
    weight: 50
  - name: Agenda
    url: /en/categories/agenda/
    weight: 60
  - name: Contributors
    url: /en/authors/
    weight: 70
```

- [ ] **Build and verify:**

```bash
hugo 2>&1 | grep -c "^ERROR"
```
Expected: `0`

```bash
grep -o 'cat-text--[a-z0-9-]*' public/index.html | sort -u
```
Expected output includes `cat-text--primary-300` (Espinho) and `cat-text--secondary-500` (Nacional).

- [ ] **Commit:**

```bash
git add config/_default/menus.pt.yaml config/_default/menus.en.yaml
git commit -m "feat: add Espinho and Nacional to nav"
```

---

## Task 2: Suppress category term pages from Pagefind

**Files:**
- Modify: `layouts/categories/term.html`

Pagefind respects `data-pagefind-ignore="all"` on any element in the page — it removes the entire page from the search index regardless of where the attribute is placed. Category pages are navigated via the header; they should not appear as search results.

The fragment output (`term.fragment.html`) is a bare HTML snippet with no `<html>` wrapper — Pagefind does not index it. No change needed there.

- [ ] **Verify current state (baseline):**

```bash
hugo 2>&1 | grep -c "^ERROR"
grep -c "pagefind-ignore" public/categories/espinho/index.html
```
Expected: `0` errors, `0` matches (attribute not yet present).

- [ ] **Edit `layouts/categories/term.html` — wrap the entire `{{ define "main" }}` body in a `data-pagefind-ignore="all"` div:**

Replace the full file content with:

```html
{{- /*
  categories/term.html — category listing page with a hero showing the latest
  article in that category. Same hero rules as the homepage.

  Wrapped in data-pagefind-ignore="all" — category pages are accessed via the
  nav bar; they should not appear as Pagefind search results.
*/ -}}
{{ define "main" }}
  <div data-pagefind-ignore="all">
  {{- $style     := hugo.Data.style -}}
  {{- $isWide    := $style.wide_layout | default false -}}

  {{- $posts  := where .Pages ".Params.draft" "ne" true -}}
  {{- $posts   = $posts.ByDate.Reverse -}}
  {{- $latest := index $posts 0 -}}

{{ if $latest }}
  {{- $img     := partial "resolve-feature-image.html" (dict "Page" $latest "Globs" (slice "*feature*" "*cover*" "*thumbnail*")) -}}
  {{- $heroURL := $img.URL -}}

  <article class="max-w-full">
    <div class="relative">
      {{- if $isWide }}
      <div class="mt-wide mt-breakout">
      {{- else }}
      <div>
      {{- end }}
        <a href="{{ $latest.Permalink }}" class="mt-hero-frame block relative no-underline shadow-xl">
          {{- if $heroURL }}
          <div class="absolute inset-0">
            <img
              class="nozoom mt-img-flush h-full w-full object-cover"
              src="{{ $heroURL }}"
              role="presentation">
          </div>
          <div class="mt-hero-grad absolute inset-0"></div>
          <div class="mt-hero-vignette absolute inset-0"></div>
          {{- end }}
          <div class="hero-content">
            {{ partial "category-badge.html" $latest }}
            <h1 class="hero-title text-neutral-100">{{ $latest.Title }}</h1>
          </div>
        </a>
      </div>
    </div>
  </article>

  {{ partial "ad-slot.html" . }}

  <div
    data-sentinel
    hx-get="{{ .RelPermalink }}fragment.html"
    hx-trigger="load"
    hx-target="this"
    hx-swap="outerHTML">
  </div>

{{ else }}
  <section class="mt-10 prose dark:prose-invert">
    <p class="py-8 border-t">
      <em>{{ i18n "term.no_articles" | emojify }}</em>
    </p>
  </section>
{{ end }}
  </div>
{{ end }}
```

Note: the only changes from the original are (a) the outer `<div data-pagefind-ignore="all">` wrapper + its closing tag, and (b) removal of the unused `$colorSlot` variable.

- [ ] **Build and verify:**

```bash
hugo 2>&1 | grep -c "^ERROR"
```
Expected: `0`

```bash
grep -c "pagefind-ignore" public/categories/espinho/index.html
```
Expected: `1` (the attribute is present in built HTML)

- [ ] **Commit:**

```bash
git add layouts/categories/term.html
git commit -m "feat: suppress category term pages from Pagefind search"
```

---

## Task 3: Create tag term page layout

**Files:**
- Create: `layouts/tags/term.html`

Tag pages are discoverable only via Pagefind search (hashtags in article bodies are rendered as plain text, not links). They must look like the rest of the site: hero + card grid + HTMX infinite scroll. Tags have no `color` param — the hero uses the latest article's own feature image and `category-badge.html`, which already reads the article's first category color.

Hugo generates the fragment output for all `term`-kind pages (both categories and tags) because `outputs.term` in `config/_default/hugo.yaml` lists both `HTML` and `fragment`. The HTMX sentinel URL pattern `{{ .RelPermalink }}fragment.html` works for tag pages exactly as it does for category pages.

- [ ] **Create `layouts/tags/term.html`:**

```html
{{- /*
  tags/term.html — tag listing page. Same structure as categories/term.html
  but without a term-level color (tags have no color param). Hero shows the
  latest article tagged with this term; category-badge.html provides
  per-article color from the article's own first category.

  Tag pages are intentionally NOT wrapped in data-pagefind-ignore — they are
  the primary discovery surface for hashtag content via search.
*/ -}}
{{ define "main" }}
  {{- $style   := hugo.Data.style -}}
  {{- $isWide  := $style.wide_layout | default false -}}

  {{- $posts  := where .Pages ".Params.draft" "ne" true -}}
  {{- $posts   = $posts.ByDate.Reverse -}}
  {{- $latest := index $posts 0 -}}

{{ if $latest }}
  {{- $img     := partial "resolve-feature-image.html" (dict "Page" $latest "Globs" (slice "*feature*" "*cover*" "*thumbnail*")) -}}
  {{- $heroURL := $img.URL -}}

  <article class="max-w-full">
    <div class="relative">
      {{- if $isWide }}
      <div class="mt-wide mt-breakout">
      {{- else }}
      <div>
      {{- end }}
        <a href="{{ $latest.Permalink }}" class="mt-hero-frame block relative no-underline shadow-xl">
          {{- if $heroURL }}
          <div class="absolute inset-0">
            <img
              class="nozoom mt-img-flush h-full w-full object-cover"
              src="{{ $heroURL }}"
              role="presentation">
          </div>
          <div class="mt-hero-grad absolute inset-0"></div>
          <div class="mt-hero-vignette absolute inset-0"></div>
          {{- end }}
          <div class="hero-content">
            {{ partial "category-badge.html" $latest }}
            <h1 class="hero-title text-neutral-100">{{ $latest.Title }}</h1>
          </div>
        </a>
      </div>
    </div>
  </article>

  {{ partial "ad-slot.html" . }}

  <div
    data-sentinel
    hx-get="{{ .RelPermalink }}fragment.html"
    hx-trigger="load"
    hx-target="this"
    hx-swap="outerHTML">
  </div>

{{ else }}
  <section class="mt-10 prose dark:prose-invert">
    <p class="py-8 border-t">
      <em>{{ i18n "term.no_articles" | emojify }}</em>
    </p>
  </section>
{{ end }}

{{ end }}
```

- [ ] **Build and verify:**

```bash
hugo 2>&1 | grep -c "^ERROR"
```
Expected: `0`

Check a tag page was generated and contains the hero markup:
```bash
ls public/tags/ | head -5
```
```bash
grep -c "mt-hero-frame" public/tags/$(ls public/tags/ | head -1)/index.html
```
Expected: `1`

Verify tag pages are NOT wrapped in pagefind-ignore:
```bash
grep -c "pagefind-ignore" public/tags/$(ls public/tags/ | head -1)/index.html
```
Expected: `0`

- [ ] **Commit:**

```bash
git add layouts/tags/term.html
git commit -m "feat: add card layout for tag term pages"
```

---

## Task 4: Create tag term fragment (HTMX infinite scroll)

**Files:**
- Create: `layouts/tags/term.fragment.html`

The fragment is the HTMX payload for infinite scroll — bare HTML, no `<html>` wrapper. It mirrors `layouts/categories/term.fragment.html` with one key difference: instead of a uniform term-level color (`$colorSlot` from `.Params.color`), each card gets its own article's category color via per-article lookup — the same pattern used in `layouts/posts/list.fragment.html`.

- [ ] **Create `layouts/tags/term.fragment.html`:**

```html
{{- /*
  tags/term.fragment.html — bare HTML fragment for HTMX infinite scroll on
  tag listing pages.

  Standalone (no baseof). Mirrors categories/term.fragment.html but uses
  per-article category color lookup instead of a term-level color (tags have
  no color param).
*/ -}}
{{- $style         := hugo.Data.style -}}
{{- $isWide        := $style.wide_layout         | default false -}}
{{- $isCards       := ne ($style.card_layout | default "cards") "list" -}}
{{- $alignment     := $style.card_alignment      | default "left" -}}
{{- $categoryColor := $style.card_category_color | default false -}}

{{- $posts := where .Pages ".Params.draft" "ne" true -}}
{{- $posts  = $posts.ByDate.Reverse -}}
{{- /* Exclude the hero article (first/latest post shown above the feed) */ -}}
{{- $hero  := index $posts 0 -}}
{{- if $hero }}{{- $posts = where $posts "Permalink" "ne" $hero.Permalink -}}{{- end -}}
{{- $pager := .Paginate $posts 5 -}}

{{- if $isCards }}
  {{- range $pager.Pages.GroupByDate "January 2006" }}
{{- if $isWide }}<div data-month-group class="mt-wide mt-breakout">{{- end }}
<h3 data-month="{{ .Key }}" class="mt-10 mb-4 text-2xl font-extrabold text-neutral-700 dark:text-neutral-300">{{ .Key }}</h3>
<section data-month-cards="{{ .Key }}" class="mt-card-grid{{- if $isWide }} mt-card-grid--wide{{- end }} mt-cards--{{ $alignment }}">
    {{- range .Pages }}
  {{- $color := "" -}}
  {{- if $categoryColor -}}
    {{- with index .Params.categories 0 -}}
      {{- $catPage := site.GetPage (printf "/categories/%s" (. | urlize)) -}}
      {{- if $catPage -}}{{- $color = $catPage.Params.color | default "primary-500" -}}{{- end -}}
    {{- end -}}
  {{- end -}}
  {{ partial "article-link/card.html" (dict "Page" . "categoryColor" $color) }}
    {{- end }}
</section>
{{- if $isWide }}</div>{{- end }}
  {{- end }}
{{- else }}
  {{- range $pager.Pages.GroupByDate "January 2006" }}
{{- if $isWide }}<div data-month-group class="mt-wide mt-breakout">{{- end }}
<h3 data-month="{{ .Key }}" class="mt-10 mb-4 text-2xl font-extrabold text-neutral-700 dark:text-neutral-300">{{ .Key }}</h3>
<section data-month-cards="{{ .Key }}" class="space-y-10 w-full">
    {{- range .Pages }}
  {{- $color := "" -}}
  {{- if $categoryColor -}}
    {{- with index .Params.categories 0 -}}
      {{- $catPage := site.GetPage (printf "/categories/%s" (. | urlize)) -}}
      {{- if $catPage -}}{{- $color = $catPage.Params.color | default "primary-500" -}}{{- end -}}
    {{- end -}}
  {{- end -}}
  {{ partial "article-link/simple.html" (dict "Page" . "categoryColor" $color) }}
    {{- end }}
</section>
{{- if $isWide }}</div>{{- end }}
  {{- end }}
{{- end }}

{{- if $pager.HasNext }}
<div data-ad-inject class="mt-ad-slot" hidden>
  <p class="mt-ad-label">Publicidade</p>
  <a class="mt-ad-card" href="" target="_blank" rel="noopener noreferrer">
    <img class="mt-ad-img" src="" alt="">
    <p class="mt-ad-title"></p>
  </a>
</div>
{{- end }}

{{- if $pager.HasNext }}
<div
  data-sentinel
  hx-get="{{ $pager.Next.URL }}"
  hx-trigger="preempt"
  hx-target="this"
  hx-swap="outerHTML">
</div>
{{- end }}
```

- [ ] **Build and verify:**

```bash
hugo 2>&1 | grep -c "^ERROR"
```
Expected: `0`

Check a tag fragment was generated:
```bash
ls public/tags/$(ls public/tags/ | head -1)/
```
Expected output includes `fragment.html`

Verify the fragment contains card markup (not Blowfish's default list):
```bash
grep -c "mt-card-grid\|space-y-10" public/tags/$(ls public/tags/ | head -1)/fragment.html
```
Expected: `1` or more

- [ ] **Final build verification:**

```bash
hugo 2>&1 | grep -E "^ERROR|^WARN" | grep -v "not compatible"
```
Expected: no output (the Blowfish version warning is acceptable and filtered).

- [ ] **Commit:**

```bash
git add layouts/tags/term.fragment.html
git commit -m "feat: add HTMX infinite scroll fragment for tag term pages"
```

---

## Self-review notes

- Task 1 covers both menu files (PT + EN) — spec requirement met.
- Task 2 covers `data-pagefind-ignore="all"` on category term pages — spec requirement met. Unused `$colorSlot` variable removed as a bonus cleanup.
- Task 3 covers tag term.html — spec requirement met. Confirmed `outputs.term` in hugo.yaml includes `fragment` for all term kinds, so the sentinel URL works.
- Task 4 covers tag term.fragment.html with per-article color lookup — spec requirement met.
- Issue 3 (multi-category / dedup audit) — confirmed no code changes required; not a task in this plan.
