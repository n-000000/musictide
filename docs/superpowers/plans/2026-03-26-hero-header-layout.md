# Hero, Header & Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the hero (16:9, clickable, badge+title bottom-left, no button/description), align header to content bounds, add CMS toggles for card/list layouts, and reset all border-radius to zero site-wide.

**Architecture:** All changes are Hugo template and CSS overrides. Hero layout is rebuilt in `hero.html`. Header alignment and global border-radius are CSS-only additions to `extend-head.html`. Layout toggles read from `data/style.yaml` (via `hugo.Data.style`) — the same pattern used by color scheme and font. Posts listing gets a new `layouts/posts/list.html` that overrides Blowfish's `_default/list.html` for the posts section only.

**Tech Stack:** Hugo 0.158.0, Blowfish v2 (Hugo module), Tailwind CSS (via Blowfish), PostCSS. Build: `hugo 2>&1`. No automated tests — verification is a clean build (zero ERROR lines) and visual inspection.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `layouts/partials/home/hero.html` | Modify | Tasks 1, 2, 5 |
| `layouts/partials/extend-head.html` | Modify | Tasks 3, 4 |
| `layouts/posts/list.html` | Create | Task 6 |
| `data/style.yaml` | Modify | Tasks 5, 6 |
| `static/admin/config.yml` | Modify | Tasks 5, 6 |

---

## Task 1: Hero cleanup — remove CTA button and description

**Files:**
- Modify: `layouts/partials/home/hero.html:78-85`

- [ ] **Step 1: Remove the featureimagecaption paragraph (lines 78–80)**

Delete these lines from `hero.html`:
```
{{- with $latest.Params.featureimagecaption }}
<p class="mt-0 mb-6 text-base italic max-w-xl opacity-85 hero-title {{ $textClass }}">{{ . }}</p>
{{- end }}
```

- [ ] **Step 2: Remove the CTA button (lines 82–85)**

Delete these lines:
```
<a href="{{ $latest.Permalink }}"
   class="mt-2 inline-block px-6 py-3 rounded-none no-underline text-sm font-semibold uppercase tracking-wider transition-colors bg-primary-500 text-neutral-100 hover:bg-primary-400">
  Ler artigo →
</a>
```

- [ ] **Step 3: Verify build**

```bash
hugo 2>&1 | grep -E "^ERROR|^WARN" | grep -v "not compatible"
```

Expected: no ERROR lines. The Blowfish version WARN is acceptable.

- [ ] **Step 4: Commit**

```bash
git add layouts/partials/home/hero.html
git commit -m "feat: remove hero CTA button and description paragraph"
```

---

## Task 2: Hero 16:9 aspect ratio + clickable wrapper + bottom-left layout

**Files:**
- Modify: `layouts/partials/home/hero.html`

This task restructures the hero container. Three things happen together because they touch the same wrapping div:
1. The outer `<div class="relative shadow-xl sm:overflow-hidden">` becomes an `<a>` (when a latest post exists) with `aspect-ratio:16/9`
2. The inner content div becomes `absolute inset-0 flex flex-col justify-end items-start` (bottom-left anchor)
3. The title loses its nested `<a>` wrapper (redundant once outer container is the link); font becomes larger

- [ ] **Step 1: Replace the hero container and inner content div**

In `hero.html`, replace from `<div class="relative shadow-xl sm:overflow-hidden">` down through the closing `</div>` of that container (currently ends at line 94) with:

```html
        {{- /* Hero container: <a> when latest exists, <div> fallback */ -}}
        {{- if $latest }}
        <a href="{{ $latest.Permalink }}" class="block relative no-underline shadow-xl" style="aspect-ratio:16/9;overflow:hidden;">
        {{- else }}
        <div class="relative shadow-xl" style="aspect-ratio:16/9;overflow:hidden;">
        {{- end }}

          {{- /* Hero background image (article featureimage) */ -}}
          {{- if $heroURL }}
          <div class="absolute inset-0">
            <img
              class="nozoom h-full w-full object-cover"
              src="{{ $heroURL }}"
              role="presentation"
              style="margin:0;">
          </div>
          <div class="absolute inset-0" style="background:linear-gradient(to top,rgba(0,0,0,.88) 0%,rgba(0,0,0,.5) 40%,rgba(0,0,0,.15) 70%,transparent 100%)"></div>
          <div class="absolute inset-0" style="background:radial-gradient(ellipse at center,transparent 40%,rgba(0,0,0,.35) 100%)"></div>
          {{- end }}

          <div class="absolute inset-0 flex flex-col justify-end items-start p-8 sm:p-12 lg:p-16">
            {{- if $latest }}

              {{- with $latest.Params.event }}
              <span class="mb-2 inline-block text-sm font-bold uppercase tracking-widest px-3 py-1 bg-primary-500 text-neutral-100 hero-badge">
                {{ . }}
              </span>
              {{- end }}

              <h1 class="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-none hero-title {{ $textClass }}">
                {{ $latest.Title }}
              </h1>

            {{- else }}
              <h1 class="text-4xl font-extrabold {{ $textClass }}">
                {{ site.Title }}
              </h1>
            {{- end }}
          </div>

        {{- if $latest }}</a>{{- else }}</div>{{- end }}
```

- [ ] **Step 2: Verify build**

```bash
hugo 2>&1 | grep -E "^ERROR|^WARN" | grep -v "not compatible"
```

Expected: zero ERROR lines.

- [ ] **Step 3: Visual check**

Open `http://localhost:1313` (run `yarn watch` if not running). Verify:
- Hero fills its width at 16:9
- Title and badge are at the bottom-left
- Entire hero area is clickable (clicking navigates to the article)
- On mobile viewport, scrolling past the hero does not trigger navigation

- [ ] **Step 4: Commit**

```bash
git add layouts/partials/home/hero.html
git commit -m "feat: hero — 16:9 aspect ratio, clickable container, bottom-left layout"
```

---

## Task 3: Header alignment

**Files:**
- Modify: `layouts/partials/extend-head.html`

- [ ] **Step 1: Add header constraint CSS**

In `extend-head.html`, find the existing header transparency block:
```css
/* ── Fixed header transparency ───────────────────────────── */
header nav,
header > div {
  background: transparent !important;
}
```

Replace it with:
```css
/* ── Fixed header transparency + alignment ───────────────── */
header nav,
header > div {
  background: transparent !important;
}

header > div,
header nav > div {
  max-width: 1600px !important;
  padding-left: 30px !important;
  padding-right: 30px !important;
  margin-left: auto !important;
  margin-right: auto !important;
  box-sizing: border-box;
}
```

- [ ] **Step 2: Verify build and visual check**

```bash
hugo 2>&1 | grep -E "^ERROR|^WARN" | grep -v "not compatible"
```

Open `http://localhost:1313`. Verify the header logo and nav links align with the left and right edges of the hero.

- [ ] **Step 3: Commit**

```bash
git add layouts/partials/extend-head.html
git commit -m "feat: constrain header to 1600px content bounds"
```

---

## Task 4: Global border-radius reset

**Files:**
- Modify: `layouts/partials/extend-head.html`

- [ ] **Step 1: Replace card-specific border-radius rule with global reset**

In `extend-head.html`, find the cards block:
```css
/* ── Cards — sharper, meaner ─────────────────────────────── */
.article-link--card {
  border-radius: 0 !important;
  border-color: rgba(var(--color-neutral-600), 0.4) !important;
  ...
```

Remove only the `border-radius: 0 !important;` line from `.article-link--card` (leave the rest of the rule intact).

Then add a new block at the top of the `<style>` tag, before all other rules:
```css
/* ── Global zero border-radius ───────────────────────────── */
*, *::before, *::after {
  border-radius: 0 !important;
}
```

- [ ] **Step 2: Verify build and visual check**

```bash
hugo 2>&1 | grep -E "^ERROR|^WARN" | grep -v "not compatible"
```

Open `http://localhost:1313`. Check both the homepage and an article page. All bordered elements (cards, tag pills, buttons, inputs, appearance switcher) should have sharp corners.

- [ ] **Step 3: Commit**

```bash
git add layouts/partials/extend-head.html
git commit -m "feat: global border-radius reset — sharp corners everywhere"
```

---

## Task 5: Homepage gallery style CMS toggle

**Files:**
- Modify: `data/style.yaml`
- Modify: `static/admin/config.yml`
- Modify: `layouts/partials/home/hero.html`

- [ ] **Step 1: Add field to data/style.yaml**

Add one line to `data/style.yaml`:
```yaml
homepage_gallery_style: cards
```

- [ ] **Step 2: Add CMS field to config.yml**

In `static/admin/config.yml`, after the `homepage_image` field block (after line 278), add:
```yaml
          - label: Estilo da Galeria (Homepage)
            name: homepage_gallery_style
            widget: select
            options:
              - { label: "Cards (grelha)", value: cards }
              - { label: "Lista", value: list }
            default: cards
            hint: "Como os artigos recentes aparecem na página inicial"
```

- [ ] **Step 3: Add conditional rendering to hero.html**

In `hero.html`, find the line that reads the siteStyle at the top:
```
{{- $siteStyle := hugo.Data.style -}}
```

Add immediately after it:
```
{{- $galleryStyle := $siteStyle.homepage_gallery_style | default "cards" -}}
```

Then find the recent articles section. The current card rendering block:
```html
    <section class="w-full grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {{- range first $count $remaining -}}
        {{ partial "article-link/card.html" . }}
      {{- end -}}
    </section>
```

Replace with:
```html
    {{- if eq $galleryStyle "list" }}
    <section class="space-y-10 w-full">
      {{- range first $count $remaining -}}
        {{ partial "article-link/simple.html" . }}
      {{- end -}}
    </section>
    {{- else }}
    <section class="w-full grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {{- range first $count $remaining -}}
        {{ partial "article-link/card.html" . }}
      {{- end -}}
    </section>
    {{- end }}
```

- [ ] **Step 4: Verify build**

```bash
hugo 2>&1 | grep -E "^ERROR|^WARN" | grep -v "not compatible"
```

Test both modes by temporarily changing `data/style.yaml` → `homepage_gallery_style: list`, rebuild, verify list renders. Then restore to `cards`.

- [ ] **Step 5: Commit**

```bash
git add data/style.yaml static/admin/config.yml layouts/partials/home/hero.html
git commit -m "feat: CMS toggle for homepage gallery style (cards/list)"
```

---

## Task 6: Posts listing page style CMS toggle

**Files:**
- Modify: `data/style.yaml`
- Modify: `static/admin/config.yml`
- Create: `layouts/posts/list.html`

- [ ] **Step 1: Add field to data/style.yaml**

Add one line to `data/style.yaml`:
```yaml
posts_listing_style: cards
```

- [ ] **Step 2: Add CMS field to config.yml**

In `static/admin/config.yml`, directly after the `homepage_gallery_style` field added in Task 5, add:
```yaml
          - label: Estilo da Listagem de Artigos
            name: posts_listing_style
            widget: select
            options:
              - { label: "Cards (grelha)", value: cards }
              - { label: "Lista", value: list }
            default: cards
            hint: "Como os artigos aparecem na página /posts/"
```

- [ ] **Step 3: Create layouts/posts/list.html**

Create `layouts/posts/list.html` as a copy of Blowfish's `_default/list.html`, with one line changed. The full file (copy from `_vendor/github.com/nunocoracao/blowfish/v2/layouts/_default/list.html`), with line 45 replaced:

Original line 45:
```
    {{ $cardView := .Params.cardView | default (site.Params.list.cardView | default false) }}
```

Replace with:
```
    {{- $siteStyle := hugo.Data.style -}}
    {{ $cardView := eq ($siteStyle.posts_listing_style | default "cards") "cards" }}
```

> Note: this override applies only to the `posts` section. All other list pages (events, authors, tags) continue to use Blowfish's `_default/list.html` unchanged.

- [ ] **Step 4: Verify build**

```bash
hugo 2>&1 | grep -E "^ERROR|^WARN" | grep -v "not compatible"
```

Test both modes: set `posts_listing_style: list` in `data/style.yaml`, rebuild, open `http://localhost:1313/posts/`, verify list view. Restore to `cards`.

- [ ] **Step 5: Commit**

```bash
git add data/style.yaml static/admin/config.yml layouts/posts/list.html
git commit -m "feat: CMS toggle for posts listing style (cards/list)"
```

---

## Task 7: Push and verify production build

- [ ] **Step 1: Final local build**

```bash
hugo 2>&1 | grep -E "^ERROR"
```

Expected: no output (zero errors).

- [ ] **Step 2: Push**

```bash
git push
```

- [ ] **Step 3: Verify Cloudflare Pages deploy**

Check `https://musictide.pages.dev` after the build completes. Verify:
- Hero is 16:9, badge+title bottom-left, whole area clickable
- Header logo/nav aligns with hero edges
- No rounded corners anywhere on the site
- Homepage shows cards (default)
- `/posts/` shows cards (default)
