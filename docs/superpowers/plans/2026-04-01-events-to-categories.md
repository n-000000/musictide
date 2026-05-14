# Events → Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `events` free-text relation taxonomy with a `categories` taxonomy (Cultura, Desporto, Lifestyle, Agenda) where each category has a CMS-managed color slot, and show colored category badges on article cards and the homepage hero.

**Architecture:** The `categories` taxonomy already exists in Hugo config (unused). We rename the CMS `events` collection to `categories`, add a `color` field (palette slot selector), update the article relation widget, and inject per-category color via a `<style>` block partial (avoids Hugo's `ZgotmplZ` sanitizer on inline `style=` attributes). Category term pages get a local layout override that reads `content_style` from `data/style.yaml` to match the site's wide/constrained setting.

**Tech Stack:** Hugo 0.158.0, Blowfish v2 (vendored at `_vendor/`), Sveltia CMS, YAML frontmatter, Go templates

---

## File Map

| Action | File | What changes |
|--------|------|-------------|
| Modify | `config/_default/hugo.yaml` | Remove `event: events` taxonomy + `events` related index entry |
| Modify | `static/admin/config.yml` | Rename `events` collection → `categories`, add `color` select field; update posts `event` relation widget → `category` relation |
| Create | `content/categories/cultura/_index.md` | Seed category: Cultura, color: primary-500 |
| Create | `content/categories/desporto/_index.md` | Seed category: Desporto, color: secondary-500 |
| Create | `content/categories/lifestyle/_index.md` | Seed category: Lifestyle, color: primary-300 |
| Create | `content/categories/agenda/_index.md` | Seed category: Agenda, color: secondary-300 |
| Modify | `content/posts/*.md` (11 files) | Replace `event: X` → `categories: [cultura]` |
| Delete | `content/events/` (6 files) | Orphaned mock event files, no longer needed |
| Create | `layouts/partials/category-badge.html` | Renders colored badge from article's first category |
| Modify | `layouts/partials/home/hero.html` | Swap `event` badge → `category-badge.html` partial |
| Modify | `layouts/partials/article-link/card.html` | Add `category-badge.html` below draft badge |
| Create | `layouts/categories/term.html` | Category listing page, respects content_style wide/constrained |
| Modify | `config/_default/menus.pt.yaml` | Add Cultura, Desporto, Lifestyle, Agenda nav items |
| Modify | `config/_default/menus.en.yaml` | Add EN equivalents |

---

## Task 1: Clean up Hugo taxonomy config

**Files:**
- Modify: `config/_default/hugo.yaml`

- [ ] **Step 1: Remove `event: events` from taxonomies and related indices**

  Open `config/_default/hugo.yaml`. The current taxonomies block (lines 24–29) and related block (lines 32–47) each reference `events`. Remove only the `events` lines, leave everything else intact.

  Final `taxonomies` block:
  ```yaml
  taxonomies:
    tag: tags
    category: categories
    author: authors
    series: series
  ```

  Final `related.indices` block (remove the `- name: events` entry, keep all others):
  ```yaml
  related:
    threshold: 0
    toLower: false
    indices:
      - name: tags
        weight: 100
      - name: categories
        weight: 100
      - name: series
        weight: 50
      - name: authors
        weight: 20
      - name: date
        weight: 10
        pattern: "200601"
  ```

- [ ] **Step 2: Verify build still passes**

  ```bash
  cd /home/n0xx/Code/infra/service/musictide && hugo 2>&1 | grep -E "^ERROR|^WARN" | grep -v "blowfish"
  ```
  Expected: no ERROR lines.

- [ ] **Step 3: Commit**

  ```bash
  git add config/_default/hugo.yaml
  git commit -m "chore: remove events taxonomy, categories was already present"
  ```

---

## Task 2: Update CMS config

**Files:**
- Modify: `static/admin/config.yml`

Two changes: (a) rename `events` collection → `categories` with a `color` field; (b) update the posts `event` relation widget → `category` relation pointing at the new collection.

- [ ] **Step 1: Replace the `events` collection block**

  Find the `# ── EVENTOS` section (lines ~139–152 in `static/admin/config.yml`) and replace it entirely:

  ```yaml
    # ── CATEGORIAS ────────────────────────────────────────────────
    - name: categories
      label: Categorias
      label_singular: Categoria
      folder: content/categories
      create: true
      path: "{{slug}}/_index"
      identifier_field: title
      fields:

        - label: Nome
          name: title
          widget: string
          hint: "Ex: Cultura, Desporto, Lifestyle, Agenda"

        - label: Cor
          name: color
          widget: select
          options:
            - { label: "Primário médio", value: "primary-500" }
            - { label: "Primário claro", value: "primary-300" }
            - { label: "Primário forte", value: "primary-700" }
            - { label: "Secundário médio", value: "secondary-500" }
            - { label: "Secundário claro", value: "secondary-300" }
            - { label: "Secundário forte", value: "secondary-700" }
          default: "primary-500"
          hint: "Cor do badge da categoria, amostrada do esquema de cores activo"
  ```

- [ ] **Step 2: Replace the `event` field in the posts collection**

  Find the `event` field block in the posts collection (lines ~29–38) and replace it:

  ```yaml
        - label: Categoria
          name: category
          widget: relation
          collection: categories
          search_fields: [title]
          value_field: title
          display_fields: [title]
          dropdown_threshold: 0
          required: false
          hint: "Categoria do artigo"
  ```

  **Note:** `value_field: title` stores the category's human-readable title (e.g. "Cultura") as a plain string in frontmatter, NOT a slug. Hugo's categories taxonomy will auto-slugify it. This is consistent with how events worked previously.

- [ ] **Step 3: Verify build still passes**

  ```bash
  hugo 2>&1 | grep -E "^ERROR|^WARN" | grep -v "blowfish"
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add static/admin/config.yml
  git commit -m "feat: rename events CMS collection to categories with color field"
  ```

---

## Task 3: Seed category content files

**Files:**
- Create: `content/categories/cultura/_index.md`
- Create: `content/categories/desporto/_index.md`
- Create: `content/categories/lifestyle/_index.md`
- Create: `content/categories/agenda/_index.md`

These give Hugo taxonomy term pages their custom params (title, color). The CMS will manage them going forward.

- [ ] **Step 1: Create the four category index files**

  `content/categories/cultura/_index.md`:
  ```markdown
  ---
  title: Cultura
  color: primary-500
  ---
  ```

  `content/categories/desporto/_index.md`:
  ```markdown
  ---
  title: Desporto
  color: secondary-500
  ---
  ```

  `content/categories/lifestyle/_index.md`:
  ```markdown
  ---
  title: Lifestyle
  color: primary-300
  ---
  ```

  `content/categories/agenda/_index.md`:
  ```markdown
  ---
  title: Agenda
  color: secondary-300
  ---
  ```

- [ ] **Step 2: Verify Hugo generates category pages**

  ```bash
  hugo 2>&1 | grep -E "^ERROR|^WARN" | grep -v "blowfish"
  ```

  Then check:
  ```bash
  ls public/categories/
  ```
  Expected: `cultura/`, `desporto/`, `lifestyle/`, `agenda/`, `index.html`, `index.xml`

- [ ] **Step 3: Commit**

  ```bash
  git add content/categories/
  git commit -m "feat: seed category taxonomy pages (Cultura, Desporto, Lifestyle, Agenda)"
  ```

---

## Task 4: Migrate article frontmatter and delete events content

**Files:**
- Modify: all 11 files in `content/posts/` that have `event:` frontmatter
- Delete: `content/events/` directory and its 6 files

All 11 mock articles are concert/music coverage → they all go into `Cultura`.

- [ ] **Step 1: Replace `event:` with `categories:` in all 11 articles**

  The sed command to run across all posts:
  ```bash
  sed -i 's/^event: .*/categories: [Cultura]/' content/posts/*.md
  ```

  Verify the substitution:
  ```bash
  grep -n "^event:\|^categories:" content/posts/*.md
  ```
  Expected: only `categories: [Cultura]` lines, no `event:` lines.

- [ ] **Step 2: Delete the events content directory**

  ```bash
  rm -rf content/events/
  ```

- [ ] **Step 3: Build and verify no errors**

  ```bash
  hugo 2>&1 | grep -E "^ERROR|^WARN" | grep -v "blowfish"
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add content/posts/ content/events/
  git commit -m "chore: migrate articles from event: to categories: [Cultura], remove events content"
  ```

---

## Task 5: Create category-badge partial

**Files:**
- Create: `layouts/partials/category-badge.html`

This partial renders a colored badge for the article's first category. Color is injected via a scoped `<style>` block to avoid Hugo's `ZgotmplZ` sanitizer (which rejects `var(--X)` in `style=` attributes).

- [ ] **Step 1: Create the partial**

  `layouts/partials/category-badge.html`:
  ```html
  {{- /*
    category-badge.html — renders a colored badge for the article's first category.

    Usage: {{ partial "category-badge.html" . }}
    Context: a Page (article).

    Looks up the category's _index.md to get its `color` param (e.g. "primary-500").
    Injects a scoped <style> block so var(--color-X) isn't sanitized by Hugo.
  */ -}}
  {{- $cats := .Params.categories -}}
  {{- if $cats -}}
    {{- $first := index $cats 0 -}}
    {{- $slug := $first | urlize -}}
    {{- $catPage := site.GetPage (printf "/categories/%s" $slug) -}}
    {{- $colorSlot := "primary-500" -}}
    {{- if $catPage -}}
      {{- $colorSlot = $catPage.Params.color | default "primary-500" -}}
    {{- end -}}
    {{- $className := printf "cat-badge--%s" $slug -}}
  <style>.{{ $className }}{background-color:rgb(var(--color-{{ $colorSlot }}));}</style>
  <span class="{{ $className }} text-neutral-100 hero-badge">{{ $first }}</span>
  {{- end -}}
  ```

  **Note:** `hero-badge` is the existing CSS class already used on the homepage hero badge (defined in `assets/css/musictide.css`). Reusing it gives consistent badge styling across hero and cards.

- [ ] **Step 2: Build and verify**

  ```bash
  hugo 2>&1 | grep -E "^ERROR|^WARN" | grep -v "blowfish"
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add layouts/partials/category-badge.html
  git commit -m "feat: add category-badge partial with theme-color injection via style block"
  ```

---

## Task 6: Wire category badge into hero and cards

**Files:**
- Modify: `layouts/partials/home/hero.html` (line 76–79)
- Modify: `layouts/partials/article-link/card.html` (after line 39)

- [ ] **Step 1: Replace event badge in hero.html**

  In `layouts/partials/home/hero.html`, find and replace this block (currently around line 76):

  Old:
  ```html
              {{- with $latest.Params.event }}
              <span class="bg-primary-500 text-neutral-100 hero-badge">
                {{ . }}
              </span>
              {{- end }}
  ```

  New:
  ```html
              {{ partial "category-badge.html" $latest }}
  ```

- [ ] **Step 2: Add category badge to card.html**

  In `layouts/partials/article-link/card.html`, after the draft badge block (after line 39, inside `<div class="p-4">`), add before `<header>`:

  Old `<div class="p-4">` block opening:
  ```html
    <div class="p-4">
      <header>
  ```

  New:
  ```html
    <div class="p-4">
      <div class="mb-2">{{ partial "category-badge.html" . }}</div>
      <header>
  ```

- [ ] **Step 3: Build and verify**

  ```bash
  hugo 2>&1 | grep -E "^ERROR|^WARN" | grep -v "blowfish"
  ```

  Then spot-check a rendered card:
  ```bash
  grep -A3 "cat-badge--" public/index.html | head -20
  ```
  Expected: `<style>.cat-badge--cultura{background-color:rgb(var(--color-primary-500));}` followed by a span.

- [ ] **Step 4: Commit**

  ```bash
  git add layouts/partials/home/hero.html layouts/partials/article-link/card.html
  git commit -m "feat: show category badge on hero and article cards"
  ```

---

## Task 7: Category listing page layout

**Files:**
- Create: `layouts/categories/term.html`

The default Blowfish `term.html` works but doesn't read our `content_style` from `data/style.yaml`. This override makes category pages use the same wide/constrained card grid as the rest of the site.

- [ ] **Step 1: Create the layout**

  `layouts/categories/term.html`:
  ```html
  {{- /*
    categories/term.html — article listing for a single category.
    Reads content_style from data/style.yaml to match site-wide wide/constrained setting.
  */ -}}
  {{ define "main" }}
    {{- $style       := hugo.Data.style -}}
    {{- $contentStyle := $style.content_style | default "cards-wide" -}}
    {{- $isWide  := or (eq $contentStyle "cards-wide") (eq $contentStyle "list-wide") -}}
    {{- $isCards := or (eq $contentStyle "cards")      (eq $contentStyle "cards-wide") -}}

    {{- /* Category color for the heading badge */ -}}
    {{- $colorSlot := .Params.color | default "primary-500" -}}
    {{- $slug      := .Title | urlize -}}
    {{- $className := printf "cat-heading--%s" $slug -}}

  <style>.{{ $className }}{color:rgb(var(--color-{{ $colorSlot }}));}</style>

  <header class="mt-5 mb-8">
    <h1 class="{{ $className }} mt-5 text-4xl font-extrabold">{{ .Title }}</h1>
  </header>

  {{ if gt (len .Pages) 0 }}

    {{- if $isWide }}
    <div class="mt-wide mt-breakout">
    {{- end }}

    {{- if $isCards }}
    <section class="w-full grid gap-4 sm:grid-cols-2 md:grid-cols-3{{- if $isWide }} xl:grid-cols-4 2xl:grid-cols-5{{- end }}">
      {{- range .Paginate (.Pages.ByDate.Reverse) -}}
        {{ partial "article-link/card.html" . }}
      {{- end -}}
    </section>
    {{- else }}
    <section class="space-y-10 w-full">
      {{- range .Paginate (.Pages.ByDate.Reverse) -}}
        {{ partial "article-link/simple.html" . }}
      {{- end -}}
    </section>
    {{- end }}

    {{- if $isWide }}
    </div>
    {{- end }}

    {{ partial "pagination.html" . }}

  {{ else }}
    <section class="mt-10 prose dark:prose-invert">
      <p class="py-8 border-t">
        <em>{{ i18n "term.no_articles" | emojify }}</em>
      </p>
    </section>
  {{ end }}

  {{ end }}
  ```

- [ ] **Step 2: Build and verify category pages render**

  ```bash
  hugo 2>&1 | grep -E "^ERROR|^WARN" | grep -v "blowfish"
  ```

  Check:
  ```bash
  ls public/categories/cultura/
  ```
  Expected: `index.html` present.

- [ ] **Step 3: Commit**

  ```bash
  git add layouts/categories/term.html
  git commit -m "feat: category listing page with content_style-aware wide/constrained grid"
  ```

---

## Task 8: Navigation menus

**Files:**
- Modify: `config/_default/menus.pt.yaml`
- Modify: `config/_default/menus.en.yaml`

- [ ] **Step 1: Update PT menu**

  `config/_default/menus.pt.yaml`:
  ```yaml
  main:
    - name: Cultura
      url: /categories/cultura/
      weight: 10
    - name: Desporto
      url: /categories/desporto/
      weight: 20
    - name: Lifestyle
      url: /categories/lifestyle/
      weight: 25
    - name: Agenda
      url: /categories/agenda/
      weight: 30
    - name: Colaboradores
      url: /authors/
      weight: 50
  ```

- [ ] **Step 2: Update EN menu**

  `config/_default/menus.en.yaml`:
  ```yaml
  main:
    - name: Culture
      url: /en/categories/cultura/
      weight: 10
    - name: Sport
      url: /en/categories/desporto/
      weight: 20
    - name: Lifestyle
      url: /en/categories/lifestyle/
      weight: 25
    - name: Agenda
      url: /en/categories/agenda/
      weight: 30
    - name: Contributors
      url: /en/authors/
      weight: 50
  ```

  **Note:** Category slugs stay in Portuguese in the URL even for the EN site — consistent with how Hugo generates them from the `_index.md` title.

- [ ] **Step 3: Final build verification**

  ```bash
  hugo 2>&1 | grep -E "^ERROR|^WARN" | grep -v "blowfish"
  ```

- [ ] **Step 4: Final commit**

  ```bash
  git add config/_default/menus.pt.yaml config/_default/menus.en.yaml
  git commit -m "feat: add category nav items (Cultura, Desporto, Lifestyle, Agenda)"
  ```

---

## Self-Review

**Spec coverage:**
- ✅ Events → categories rename
- ✅ Arbitrary number of categories via CMS collection (not a fixed select)
- ✅ Each category has a color from theme palette slots
- ✅ Badge on hero hero shows category color
- ✅ Badge on article cards shows category color
- ✅ Category listing pages exist at `/categories/<slug>/`
- ✅ Nav items for each category
- ✅ Mock articles migrated to Cultura

**Placeholder scan:** No TBDs, all code shown in full.

**Type consistency:** `category-badge.html` uses `$slug := $first | urlize` and the `<style>` class is `cat-badge--{slug}`. Term layout uses `$slug := .Title | urlize` and class `cat-heading--{slug}`. These are intentionally different prefixes (badge vs heading). Consistent within each usage.

**Edge cases covered:**
- Article with no `categories` → badge partial renders nothing (guarded by `if $cats`)
- Category page without `_index.md` (missing CMS entry) → falls back to `primary-500`
- Empty category listing → shows i18n "term.no_articles" message
