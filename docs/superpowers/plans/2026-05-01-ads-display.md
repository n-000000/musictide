# Ads Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render active ads in two slots: a centred card below the hero (destaque), and one ad injected after each HTMX infinite-scroll batch.

**Architecture:** Hugo embeds all non-draft ads as a JSON blob in `<head>`. Client-side JS reads it, filters by `Date.now()`, and (a) reveals the destaque card immediately on page load, and (b) populates a pre-rendered `[data-ad-inject]` placeholder each time `htmx:afterSettle` fires. All card HTML is pre-rendered with empty attributes — JS only fills values in.

**Tech Stack:** Hugo templates, vanilla JS, HTMX event hooks, Sveltia CMS YAML frontmatter.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `static/admin/config.yml` | Modify | Add `destaque` boolean field to ads CMS collection |
| `content/ads/ariel-destaque.md` | Create | Mock destaque ad for testing |
| `content/ads/skip-mock.md` | Create | Mock regular ad for feed slot testing |
| `layouts/partials/ads-data.html` | Create | Serialises non-draft ads to `<script id="mt-ads-data">` JSON blob |
| `layouts/partials/extend-head.html` | Modify | Call `ads-data.html` once in `<head>` |
| `assets/css/musictide.css` | Modify | `.mt-ad-slot`, `.mt-ad-card`, `.mt-ad-img`, `.mt-ad-label`, `.mt-ad-title` |
| `layouts/partials/ad-slot.html` | Create | Destaque card HTML + inline JS (destaque reveal + feed slot injection via `htmx:afterSettle`) |
| `layouts/partials/home/hero.html` | Modify | Call `ad-slot.html` after the hero `</article>`, before sentinel |
| `layouts/categories/term.html` | Modify | Same |
| `layouts/posts/list.fragment.html` | Modify | Add `[data-ad-inject]` feed placeholder after month groups, before pager sentinel |
| `layouts/categories/term.fragment.html` | Modify | Same |

---

## Task 1: CMS field + mock content

**Files:**
- Modify: `static/admin/config.yml`
- Create: `content/ads/ariel-destaque.md`
- Create: `content/ads/skip-mock.md`

- [ ] **Step 1: Add `destaque` field to the ads collection in CMS config**

In `static/admin/config.yml`, find the `ads` collection fields list. Add after the `active_until` field:

```yaml
      - label: Destaque
        name: destaque
        widget: boolean
        default: false
        hint: "Anúncio de destaque — aparece imediatamente abaixo do hero. Apenas um anúncio deve ter esta opção activa de cada vez."
```

- [ ] **Step 2: Create the destaque mock ad**

Create `content/ads/ariel-destaque.md`:

```markdown
---
title: "Ariel — Roupa Sempre Limpa"
creative_image: "https://placehold.co/600x450/b45309/ffffff?text=ARIEL"
click_through_url: "https://ariel.com"
active_from: 2026-05-01T00:00:00Z
active_until: 2026-12-31T23:59:59Z
destaque: true
draft: false
---
```

- [ ] **Step 3: Create the feed slot mock ad**

Create `content/ads/skip-mock.md`:

```markdown
---
title: "Skip — Limpo à Primeira"
creative_image: "https://placehold.co/600x450/1d4ed8/ffffff?text=SKIP"
click_through_url: "https://skip.com"
active_from: 2026-05-01T00:00:00Z
active_until: 2026-12-31T23:59:59Z
destaque: false
draft: false
---
```

- [ ] **Step 4: Verify build passes**

```bash
hugo 2>&1 | grep -E "^ERROR"
```

Expected: no output (zero errors). Warnings about Blowfish version and deprecated `languageName` are harmless.

- [ ] **Step 5: Commit**

```bash
git add static/admin/config.yml content/ads/ariel-destaque.md content/ads/skip-mock.md
git commit -m "feat: add destaque CMS field + mock ads for testing"
```

---

## Task 2: `ads-data.html` — JSON blob in `<head>`

**Files:**
- Create: `layouts/partials/ads-data.html`
- Modify: `layouts/partials/extend-head.html`

- [ ] **Step 1: Create `layouts/partials/ads-data.html`**

```html
{{- /*
  ads-data.html — serialises non-draft ads to a JSON blob.
  Consumed by ad-slot.html JS at visit time for date filtering.
*/ -}}
{{- $ads := slice -}}
{{- range where (where site.RegularPages "Section" "ads") ".Params.draft" "ne" true -}}
  {{- $ad := dict
    "title"    .Title
    "image"    (.Params.creative_image | default "")
    "url"      (.Params.click_through_url | default "")
    "destaque" (.Params.destaque | default false)
  -}}
  {{- with .Params.active_from -}}
    {{- $ad = merge $ad (dict "from" (.Format "2006-01-02T15:04:05Z07:00")) -}}
  {{- end -}}
  {{- with .Params.active_until -}}
    {{- $ad = merge $ad (dict "until" (.Format "2006-01-02T15:04:05Z07:00")) -}}
  {{- end -}}
  {{- $ads = $ads | append $ad -}}
{{- end -}}
<script type="application/json" id="mt-ads-data">{{ $ads | jsonify }}</script>
```

- [ ] **Step 2: Wire into `extend-head.html`**

In `layouts/partials/extend-head.html`, add after the `<link>` tag for `musictide.css` (line ~24) and before the Google Fonts block — this places the data blob in `<head>` before any inline scripts that might read it:

```html
{{- $cssMain := resources.Get "css/musictide.css" | resources.Minify | resources.Fingerprint -}}
<link rel="stylesheet" href="{{ $cssMain.RelPermalink }}" integrity="{{ $cssMain.Data.Integrity }}">

{{- /* ── Ad data — JSON blob consumed by ad-slot.html JS ─────── */ -}}
{{ partial "ads-data.html" . }}

{{- /* ── Google Fonts ─────────────────────────────────────────── */ -}}
```

- [ ] **Step 3: Verify build and check output**

```bash
hugo 2>&1 | grep -E "^ERROR"
```

Expected: no errors.

Then spot-check the rendered HTML:

```bash
grep -o 'id="mt-ads-data"[^<]*' public/index.html | head -c 200
```

Expected: something like `id="mt-ads-data">[{"destaque":true,"image":"https://placehold...`

- [ ] **Step 4: Commit**

```bash
git add layouts/partials/ads-data.html layouts/partials/extend-head.html
git commit -m "feat: embed ads JSON blob in <head> via ads-data partial"
```

---

## Task 3: Ad slot CSS

**Files:**
- Modify: `assets/css/musictide.css`

- [ ] **Step 1: Append ad slot styles to `assets/css/musictide.css`**

Add at the end of the file:

```css
/* ═══════════════════════════════════════════════════════════
   AD SLOTS — destaque (below-hero) and feed (after scroll batch)
   ═══════════════════════════════════════════════════════════ */
.mt-ad-slot {
  max-width: 320px;
  margin: 1.5rem auto;
}

.mt-ad-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgb(var(--color-neutral-500));
  margin: 0 0 0.4rem;
  text-align: center;
}

.mt-ad-card {
  display: block;
  background: rgb(var(--color-neutral-200));
  text-decoration: none;
  opacity: 1;
  transition: opacity 0.15s ease;
}

.dark .mt-ad-card {
  background: rgb(var(--color-neutral-800));
}

.mt-ad-card:hover {
  opacity: 0.85;
}

.mt-ad-img {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
}

.mt-ad-title {
  padding: 0.5rem 0.75rem;
  font-size: 0.8rem;
  color: rgb(var(--color-neutral-800));
  margin: 0;
}

.dark .mt-ad-title {
  color: rgb(var(--color-neutral-100));
}
```

Note: no `border-radius` — the global `* { border-radius: 0 !important }` rule in this file zeroes it for all elements.

- [ ] **Step 2: Verify build**

```bash
hugo 2>&1 | grep -E "^ERROR"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add assets/css/musictide.css
git commit -m "feat: add ad slot CSS (.mt-ad-slot, .mt-ad-card, etc.)"
```

---

## Task 4: `ad-slot.html` partial + hero wiring

**Files:**
- Create: `layouts/partials/ad-slot.html`
- Modify: `layouts/partials/home/hero.html`
- Modify: `layouts/categories/term.html`

- [ ] **Step 1: Create `layouts/partials/ad-slot.html`**

```html
{{- /*
  ad-slot.html — two responsibilities:
  1. Renders the destaque card (hidden until JS reveals it).
  2. Inline script handles destaque reveal on load + feed slot
     injection via htmx:afterSettle for each scroll batch.
  Called once per page from hero.html and term.html.
*/ -}}
<div id="mt-ad-destaque" class="mt-ad-slot" hidden>
  <p class="mt-ad-label">Publicidade</p>
  <a class="mt-ad-card" href="" target="_blank" rel="noopener noreferrer">
    <img class="mt-ad-img" src="" alt="">
    <p class="mt-ad-title"></p>
  </a>
</div>
<script>
(function () {
  function activeAds() {
    try {
      var data = JSON.parse(document.getElementById('mt-ads-data').textContent);
    } catch (e) { return []; }
    var now = Date.now();
    return data.filter(function (ad) {
      var from  = ad.from  ? new Date(ad.from).getTime()  : 0;
      var until = ad.until ? new Date(ad.until).getTime() : Infinity;
      return now >= from && now <= until;
    });
  }

  function fillSlot(el, ad) {
    el.querySelector('.mt-ad-card').href         = ad.url;
    el.querySelector('.mt-ad-img').src           = ad.image;
    el.querySelector('.mt-ad-img').alt           = ad.title;
    el.querySelector('.mt-ad-title').textContent = ad.title;
    el.removeAttribute('hidden');
  }

  // Destaque — reveal immediately
  var active   = activeAds();
  var destaque = active.filter(function (ad) { return ad.destaque; })[0];
  if (destaque) {
    fillSlot(document.getElementById('mt-ad-destaque'), destaque);
  }

  // Feed slots — populated after each HTMX batch settles
  if (!window._mtAdListenerAttached) {
    window._mtAdListenerAttached = true;
    document.addEventListener('htmx:afterSettle', function () {
      var pool = activeAds();
      if (!pool.length) return;
      var unpopulated = document.querySelectorAll('[data-ad-inject]:not([data-ad-populated])');
      unpopulated.forEach(function (el) {
        var ad = pool[Math.floor(Math.random() * pool.length)];
        fillSlot(el, ad);
        el.setAttribute('data-ad-populated', '');
      });
    });
  }
}());
</script>
```

- [ ] **Step 2: Add ad slot to homepage hero**

In `layouts/partials/home/hero.html`, add `{{ partial "ad-slot.html" . }}` after the closing `</article>` tag and before the HTMX sentinel `<div>`:

```html
  </article>

  {{ partial "ad-slot.html" . }}

  {{- /* ── Infinite scroll feed ── */ -}}
  <div
    data-sentinel
    hx-get="/posts/fragment.html"
```

- [ ] **Step 3: Add ad slot to category pages**

In `layouts/categories/term.html`, add `{{ partial "ad-slot.html" . }}` after the closing `</article>` tag and before the HTMX sentinel `<div>`:

```html
  </article>

  {{ partial "ad-slot.html" . }}

  <div
    data-sentinel
    hx-get="{{ .RelPermalink }}fragment.html"
```

- [ ] **Step 4: Verify build**

```bash
hugo 2>&1 | grep -E "^ERROR"
```

Expected: no errors.

- [ ] **Step 5: Visual test — destaque slot**

```bash
yarn watch
```

Open http://localhost:1313 in a browser. Below the hero image, before the first article month heading, you should see a centred card labelled "Publicidade" at the top, with the Ariel placeholder image (orange block with "ARIEL" text) and title "Ariel — Roupa Sempre Limpa".

Check a category page (e.g. http://localhost:1313/categories/cultura/) — same card should appear below its hero.

Open browser devtools → inspect the `#mt-ad-destaque` div — it should have no `hidden` attribute, and `.mt-ad-card[href]` should point to `https://ariel.com`.

Stop the dev server (`Ctrl+C`).

- [ ] **Step 6: Commit**

```bash
git add layouts/partials/ad-slot.html layouts/partials/home/hero.html layouts/categories/term.html
git commit -m "feat: destaque ad slot below hero (homepage + category pages)"
```

---

## Task 5: Feed slot placeholders in fragments

**Files:**
- Modify: `layouts/posts/list.fragment.html`
- Modify: `layouts/categories/term.fragment.html`

- [ ] **Step 1: Add feed placeholder to homepage fragment**

In `layouts/posts/list.fragment.html`, add the placeholder after the closing `{{- end }}` of the month-group range loop and before the pager sentinel block:

```html
{{- end }}

<div data-ad-inject class="mt-ad-slot" hidden>
  <p class="mt-ad-label">Publicidade</p>
  <a class="mt-ad-card" href="" target="_blank" rel="noopener noreferrer">
    <img class="mt-ad-img" src="" alt="">
    <p class="mt-ad-title"></p>
  </a>
</div>

{{- if $pager.HasNext }}
```

- [ ] **Step 2: Add feed placeholder to category fragment**

In `layouts/categories/term.fragment.html`, the file has two range loops (cards and list branches inside `{{- if $isCards }}`). Add the placeholder after the outer `{{- end }}` that closes the `if $isCards` block, before the pager sentinel block:

```html
{{- end }}

<div data-ad-inject class="mt-ad-slot" hidden>
  <p class="mt-ad-label">Publicidade</p>
  <a class="mt-ad-card" href="" target="_blank" rel="noopener noreferrer">
    <img class="mt-ad-img" src="" alt="">
    <p class="mt-ad-title"></p>
  </a>
</div>

{{- if $pager.HasNext }}
```

- [ ] **Step 3: Verify build**

```bash
hugo 2>&1 | grep -E "^ERROR"
```

Expected: no errors.

- [ ] **Step 4: Visual test — feed slots**

```bash
yarn watch
```

Open http://localhost:1313. The page loads the hero, then the destaque ad, then the first batch of articles via HTMX. Below the first batch (before the next month group loads) a feed ad card should appear — "Skip — Limpo à Primeira" (blue placeholder) or the Ariel ad (random pick from active pool).

Scroll down to trigger the next batch — another feed ad should appear after that batch too.

Open browser devtools → network tab → filter for `fragment` requests — each response should contain a `[data-ad-inject]` div. After `htmx:afterSettle` fires, inspect that div — it should have `data-ad-populated` attribute and no `hidden` attribute.

Check a category page (http://localhost:1313/categories/cultura/) — same feed ad behaviour after scrolling.

Stop the dev server (`Ctrl+C`).

- [ ] **Step 5: Commit**

```bash
git add layouts/posts/list.fragment.html layouts/categories/term.fragment.html
git commit -m "feat: inject feed ad after each HTMX scroll batch"
```

---

## Task 6: Final build check + push

- [ ] **Step 1: Full production build**

```bash
yarn build 2>&1 | grep -E "^ERROR"
```

Expected: no errors.

- [ ] **Step 2: Push**

```bash
git push
```

Cloudflare Pages will rebuild. Check https://musictide.pages.dev — destaque and feed ads should appear as they do locally.
