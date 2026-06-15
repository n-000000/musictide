# Blowfish Fork — Feature Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every musictide layout override and CSS hack from `musictide/layouts/` and `musictide/assets/css/` into the Blowfish fork, eliminating all `!important` CSS hacks and inline `<style>` blocks from `extend-head.html`, leaving musictide's local `layouts/` directory empty.

**Architecture:** Wire the blowfish fork as a Hugo module with a local-path replacement active only in the `development` environment (Cloudflare Pages' production build resolves from GitHub). Each migration task is an atomic commit pair: one commit in the fork adding/modifying the template or CSS, one commit in musictide deleting the now-redundant local override. The site must build clean (`hugo 2>&1 | grep ERROR` → empty) after every commit pair.

**Tech Stack:** Hugo 0.163.0 Extended, Blowfish v2 fork at `github.com/n-000000/blowfish`, Tailwind CSS 4.x via `@tailwindcss/cli` (built in the fork and committed as `assets/css/compiled/main.css`), HTMX 2.0.4.

---

## Catalogue of Everything Being Migrated

### From `musictide/assets/css/` → fork's `assets/css/`

| File | What it does |
|------|-------------|
| `musictide.css` | Hero, card grid, gallery, ads, film grain, header transparency, language switcher hide, logo override, `.cat-bg--*` / `.cat-text--*` palette slots, smooth scroll, view transitions |
| `schemes/dark-metal.css` … `schemes/zinc.css` (8 files) | Custom color palette definitions (RGB triplets for Blowfish's CSS custom properties) |

### From `musictide/layouts/` → fork's `layouts/`

| File | Status | Action |
|------|--------|--------|
| `partials/footer.html` | Blank (suppresses footer + its medium-zoom init) | Delete; fix in fork |
| `partials/header/basic.html` | Reads `site_name` from `hugo.Data.style`; logo max-size override was done via CSS !important | Migrate to fork; fix logo Tailwind classes in template |
| `partials/header/components/desktop-menu.html` | Adds HTMX SPA nav attrs + category color classes on menu items | Migrate to fork |
| `partials/header/components/mobile-menu.html` | Same as desktop | Migrate to fork |
| `partials/hero/big.html` | Article feature image using `resolve-feature-image.html`; custom CSS classes | Migrate to fork |
| `partials/resolve-feature-image.html` | DRY image lookup partial (new, no upstream equivalent) | Add to fork |
| `partials/article-gallery.html` | Gallery grid partial (new) | Add to fork |
| `partials/category-badge.html` | Colored category pill (new) | Add to fork |
| `partials/ads-data.html` | Serialises ads to JSON blob in `<head>` (new) | Add to fork |
| `partials/ad-slot.html` | Destaque card + feed slot JS (new) | Add to fork |
| `partials/home/hero.html` | Fully custom homepage hero layout | Replace Blowfish's version in fork |
| `partials/article-link/card.html` | Adds `categoryColor` param; must remove `min-w-full` that breaks flex grid | Migrate to fork; fix min-w-full at source |
| `partials/article-link/simple.html` | Adds `categoryColor` param | Migrate to fork |
| `_default/single.html` | Credit fields (texto/fotos/vídeo), `article-gallery.html` call | Migrate to fork |
| `index.html` | Reads `homepage_layout` from `hugo.Data.style` | Migrate to fork |
| `authors/list.html` | Bio card grid with inline `<style>` block in extend-head.html | Migrate to fork; replace custom CSS with Tailwind classes |
| `posts/list.html` | Reads card layout from `hugo.Data.style` | Migrate to fork |
| `posts/list.fragment.html` | HTMX infinite scroll fragment (new) | Add to fork |
| `categories/term.html` | Category page with hero + HTMX scroll | Add to fork |
| `categories/term.fragment.html` | HTMX fragment for category scroll (new) | Add to fork |
| `tags/term.html` | Tag page with hero + HTMX scroll | Add to fork |
| `tags/term.fragment.html` | HTMX fragment for tag scroll (new) | Add to fork |

### CSS hacks being fixed at source (not just moved)

| Current hack | Where it lives | Fix in fork |
|---|---|---|
| `img.logo { max-width: 220px !important; max-height: 2.5rem !important; }` | `extend-head.html` `<style>` block | Change Tailwind classes on logo `<img>` in `header/basic.html` to `max-h-10 max-w-56` |
| `header nav, header > div { background: transparent !important; }` | `musictide.css` | Find the fixed-header background in Blowfish's wrapper and remove it in fork's `header/fixed.html` or equivalent |
| `.translation { display: none !important; }` | `musictide.css` | Remove the `translations.html` partial call from fork's desktop-menu + mobile-menu |
| `.mt-card-grid .article-link--card { min-width: 0; }` (overrides Blowfish's `min-w-full`) | `musictide.css` | Remove `min-w-full` from `article-link/card.html` in fork |
| Author card `<style>` block (~100 lines) | `extend-head.html` | Replace with Tailwind classes directly in fork's `authors/list.html` |
| `mediumZoom` DOMContentLoaded re-init | `extend-head.html` | Restore medium-zoom init to fork's `footer.html`; delete the re-init from extend-head |

### `extend-head.html` — what stays vs what goes

| Block | Fate |
|---|---|
| Color scheme `<link>` (loads `schemes/*.css`) | **Stays** — still loads from fork assets via `resources.Get` |
| `musictide.css` `<link>` | **Stays** — still loads from fork assets via `resources.Get` |
| Ads data `{{ partial "ads-data.html" }}` | **Stays** |
| Google Fonts `<link>` blocks | **Stays** |
| Dynamic CSS (font-family + `.mt-wide`) | **Stays** — build-time data-driven |
| Author card `<style>` block | **REMOVED** — replaced by Tailwind in fork's template |
| Logo sizing `<style>` block | **REMOVED** — fixed in fork's header template |
| Theme toggle visibility `<style>` block | **Stays** — data-driven conditional |
| `mediumZoom` `<script>` | **REMOVED** — moved back to footer.html in fork |
| HTMX CDN `<script>` | **Stays** |
| IntersectionObserver + month-merge JS | **Stays** |
| Hashtag `#` strip JS | **Stays** |

---

## Task 0: Fix Hugo deprecation warnings

### Context

Hugo 0.163.0 emits four deprecation warnings on every build. Two are already fixed (committed in musictide 2026-06-15). Two remain and will resolve automatically in Task 1.

**Warning source breakdown:**

| Warning | Source | Fix |
|---|---|---|
| `languages.pt.languageName` deprecated | musictide `config/_default/languages.pt.yaml` | **Already fixed** — renamed to `label` |
| `languages.en.languageName` deprecated | musictide `config/_default/languages.en.yaml` | **Already fixed** — renamed to `label` |
| `.Site.LanguageCode` deprecated | vendored Blowfish v2.101.0 — `layouts/partials/schema.html` (×2) and `layouts/partials/head.html` | **Resolved by Task 1** — fork's upstream already uses `.Site.Language.Locale` |
| `.Language.LanguageCode` deprecated | vendored Blowfish v2.101.0 — `layouts/_default/baseof.html` | **Resolved by Task 1** — fork's upstream already uses `.Language.Locale` |

No action required in this task — the config fixes are already committed and the template fixes arrive with the fork. This task exists as a record of what was done and why the remaining two warnings can be ignored until Task 1 completes.

- [ ] **Step 1: Verify the two config warnings are gone**

```bash
cd /home/n0xx/Code/infra/service/musictide && hugo 2>&1 | grep "languageName"
```

Expected: empty output. If you see output, the config fix wasn't committed — check `config/_default/languages.pt.yaml` and `config/_default/languages.en.yaml` (both should have `label:` not `languageName:`).

- [ ] **Step 2: Confirm two template warnings still present (expected until Task 1)**

```bash
cd /home/n0xx/Code/infra/service/musictide && hugo 2>&1 | grep "LanguageCode"
```

Expected: two lines about `.Site.LanguageCode` and `.Language.LanguageCode`. These will disappear in Task 1 when the fork replaces the vendored module.

- [ ] **Step 3: Note for Cloudflare Pages — update HUGO_VERSION in the dashboard**

Local Hugo is now 0.163.0 (snap package). Cloudflare Pages dashboard env var `HUGO_VERSION` must be updated from `0.158.0` to `0.163.0` to keep parity. This is a manual step in the Cloudflare Pages dashboard (Settings → Environment variables → `HUGO_VERSION`).

This does not block the rest of the plan but should be done before the next production deploy.

---

## Task 1: Create fork branch and wire up the Hugo module

### Context

The fork at `/home/n0xx/Code/infra/service/blowfish` is currently the upstream Blowfish code on `main`. The upstream module name is `github.com/nunocoracao/blowfish/v2`. We need a `musictide-patches` branch with a renamed module path, and musictide needs to point to it.

Hugo module local replacement syntax (YAML): `github.com/n-000000/blowfish/v2 -> /home/n0xx/Code/infra/service/blowfish`

This goes in `config/development/module.yaml` so it only activates during `hugo server` (`-e development` is the default). Cloudflare Pages runs with `-e production` and resolves from GitHub.

**Files:**
- Create: fork branch `musictide-patches`
- Modify: `/home/n0xx/Code/infra/service/blowfish/go.mod`
- Modify: `/home/n0xx/Code/infra/service/musictide/config/_default/module.yaml`
- Create: `/home/n0xx/Code/infra/service/musictide/config/development/module.yaml`
- Modify: `/home/n0xx/Code/infra/service/musictide/go.mod`

- [ ] **Step 1: Create the musictide-patches branch in the fork**

```bash
git -C /home/n0xx/Code/infra/service/blowfish checkout -b musictide-patches
```

- [ ] **Step 2: Rename the fork's module path**

Edit `/home/n0xx/Code/infra/service/blowfish/go.mod`. Change:
```
module github.com/nunocoracao/blowfish/v2
```
to:
```
module github.com/n-000000/blowfish/v2
```

- [ ] **Step 3: Commit the module rename in the fork**

```bash
git -C /home/n0xx/Code/infra/service/blowfish add go.mod
git -C /home/n0xx/Code/infra/service/blowfish commit -m "chore: rename module path for musictide fork"
```

- [ ] **Step 4: Update musictide's module import to point to the fork**

Edit `/home/n0xx/Code/infra/service/musictide/config/_default/module.yaml`:
```yaml
imports:
  - path: github.com/n-000000/blowfish/v2
```

- [ ] **Step 5: Create the development environment module replacement**

Create `/home/n0xx/Code/infra/service/musictide/config/development/module.yaml`:
```yaml
replacements:
  - github.com/n-000000/blowfish/v2 -> /home/n0xx/Code/infra/service/blowfish
```

- [ ] **Step 6: Update musictide's go.mod**

Edit `/home/n0xx/Code/infra/service/musictide/go.mod`. Change:
```
require github.com/nunocoracao/blowfish/v2 v2.101.0 // indirect
```
to:
```
require github.com/n-000000/blowfish/v2 v2.101.0 // indirect
```

Then run:
```bash
cd /home/n0xx/Code/infra/service/musictide && hugo mod tidy
```

Expected: completes without error. `go.sum` may be updated.

- [ ] **Step 7: Verify the build still works**

```bash
cd /home/n0xx/Code/infra/service/musictide && hugo 2>&1 | grep -E "^ERROR"
```

Expected: empty output. The `WARN` about Blowfish version compatibility may change to reference the new module path — that's fine.

- [ ] **Step 8: Commit musictide module wiring**

```bash
git -C /home/n0xx/Code/infra/service/musictide add config/_default/module.yaml config/development/module.yaml go.mod go.sum
git -C /home/n0xx/Code/infra/service/musictide commit -m "feat: wire up blowfish fork as Hugo module"
```

---

## Task 2: Move CSS assets into the fork and rebuild Tailwind

### Context

`musictide.css` and the 8 custom scheme files live in `musictide/assets/css/`. Hugo's module asset merging means that once they live in the fork's `assets/css/`, `resources.Get "css/musictide.css"` in `extend-head.html` will find them there. The Tailwind build in the fork must be re-run after any layout file changes (done as part of each subsequent task); this task just does the initial CSS move and confirms the pipeline works.

**Files:**
- Add to fork: `assets/css/musictide.css`
- Add to fork: `assets/css/schemes/dark-metal.css`, `goth.css`, `indie.css`, `minimal.css`, `punk.css`, `slab.css`, `swamp.css`, `zinc.css`
- Rebuild: fork's `assets/css/compiled/main.css`
- Delete from musictide: `assets/css/musictide.css` and all `assets/css/schemes/*.css`

- [ ] **Step 1: Copy CSS files to the fork**

```bash
cp /home/n0xx/Code/infra/service/musictide/assets/css/musictide.css \
   /home/n0xx/Code/infra/service/blowfish/assets/css/musictide.css

cp /home/n0xx/Code/infra/service/musictide/assets/css/schemes/*.css \
   /home/n0xx/Code/infra/service/blowfish/assets/css/schemes/
```

- [ ] **Step 2: Install fork dependencies (first time only)**

```bash
cd /home/n0xx/Code/infra/service/blowfish && npm install
```

Expected: packages installed, no errors.

- [ ] **Step 3: Build Tailwind in the fork**

```bash
cd /home/n0xx/Code/infra/service/blowfish && npm run build
```

Expected: `assets/css/compiled/main.css` updated. The build scans layouts for class names — no new classes added yet, so output should be similar size to upstream.

- [ ] **Step 4: Commit the CSS assets and rebuilt Tailwind bundle in the fork**

```bash
git -C /home/n0xx/Code/infra/service/blowfish add assets/css/musictide.css assets/css/schemes/ assets/css/compiled/main.css
git -C /home/n0xx/Code/infra/service/blowfish commit -m "feat(musictide): add musictide.css and custom color schemes"
```

- [ ] **Step 5: Delete the CSS files from musictide**

```bash
rm /home/n0xx/Code/infra/service/musictide/assets/css/musictide.css
rm /home/n0xx/Code/infra/service/musictide/assets/css/schemes/*.css
rmdir /home/n0xx/Code/infra/service/musictide/assets/css/schemes
```

- [ ] **Step 6: Verify build — CSS must still load**

```bash
cd /home/n0xx/Code/infra/service/musictide && hugo 2>&1 | grep -E "^ERROR"
```

Expected: empty output. Hugo's asset pipeline merges modules, so `resources.Get "css/musictide.css"` finds the file in the fork.

- [ ] **Step 7: Commit musictide deletion**

```bash
git -C /home/n0xx/Code/infra/service/musictide add assets/css/
git -C /home/n0xx/Code/infra/service/musictide commit -m "chore: move CSS assets to blowfish fork"
```

---

## Task 3: Migrate footer — restore medium-zoom, suppress visible content

### Context

`musictide/layouts/partials/footer.html` is intentionally blank. This suppresses the entire Blowfish footer, including the `mediumZoom(...)` init script that lives there. To compensate, `extend-head.html` re-initializes medium-zoom with a `DOMContentLoaded` wrapper.

In the fork, we make the footer's visible content suppressible via params (Blowfish already supports `showMenu`, `showCopyright`, `showThemeAttribution`, `showScrollToTop`) while keeping the medium-zoom script. We also need to suppress the `<footer>` element's padding when all content is off.

**Files:**
- Modify in fork: `layouts/partials/footer.html` — make padding conditional on any content being shown
- Modify in musictide: `config/_default/params.yaml` — add footer section with all items false
- Delete from musictide: `layouts/partials/footer.html`
- Modify in musictide: `layouts/partials/extend-head.html` — remove medium-zoom `<script>` block

- [ ] **Step 1: Modify fork's footer.html to suppress padding when no content is displayed**

Read `/home/n0xx/Code/infra/service/blowfish/layouts/partials/footer.html` first, then wrap the `<footer>` padding class conditionally. Find the opening `<footer>` tag — currently:

```html
<footer id="site-footer" class="py-10 print:hidden">
```

Replace with:

```html
{{- $showContent := or
  (.Site.Params.footer.showMenu | default true)
  (.Site.Params.footer.showCopyright | default true)
  (.Site.Params.footer.showScrollToTop | default true)
-}}
<footer id="site-footer"{{ if $showContent }} class="py-10 print:hidden"{{ end }}>
```

- [ ] **Step 2: Rebuild Tailwind in the fork**

```bash
cd /home/n0xx/Code/infra/service/blowfish && npm run build
```

- [ ] **Step 3: Commit footer change in the fork**

```bash
git -C /home/n0xx/Code/infra/service/blowfish add layouts/partials/footer.html assets/css/compiled/main.css
git -C /home/n0xx/Code/infra/service/blowfish commit -m "feat(musictide): suppress footer padding when no content configured"
```

- [ ] **Step 4: Add footer params to musictide's params.yaml**

Edit `/home/n0xx/Code/infra/service/musictide/config/_default/params.yaml`. Uncomment/replace the footer section:

```yaml
footer:
  showMenu: false
  showCopyright: false
  showThemeAttribution: false
  showScrollToTop: false
```

- [ ] **Step 5: Delete musictide's blank footer override**

```bash
rm /home/n0xx/Code/infra/service/musictide/layouts/partials/footer.html
```

- [ ] **Step 6: Remove medium-zoom re-init from extend-head.html**

Edit `layouts/partials/extend-head.html`. Remove the entire block:

```html
{{- /* ── medium-zoom init (Blowfish's footer.html is suppressed, so init it here) ── */ -}}
{{- if not site.Params.disableImageZoom }}
<script>
document.addEventListener('DOMContentLoaded', function () {
  if (typeof mediumZoom === 'function') {
    mediumZoom('img:not(.nozoom)', { margin: 24, background: 'rgba(0,0,0,0.5)', scrollOffset: 0 });
  }
});
</script>
{{- end }}
```

- [ ] **Step 7: Verify build and image zoom**

```bash
cd /home/n0xx/Code/infra/service/musictide && hugo 2>&1 | grep -E "^ERROR"
```

Expected: empty. Then start `yarn watch` and open an article page. Click the feature image — medium-zoom lightbox must open. Verify no footer content (copyright, powered-by, scroll-to-top) is visible.

- [ ] **Step 8: Commit musictide changes**

```bash
git -C /home/n0xx/Code/infra/service/musictide add config/_default/params.yaml layouts/partials/extend-head.html layouts/partials/footer.html
git -C /home/n0xx/Code/infra/service/musictide commit -m "chore: remove footer override; restore medium-zoom to fork footer"
```

---

## Task 4: Migrate header overrides

### Context

Three header files to migrate. Each has musictide-specific changes:

- **`header/basic.html`**: reads `site_name` from `hugo.Data.style`; currently has logo with upstream Tailwind classes `max-h-20 max-w-20` (80px) overridden via `extend-head.html`'s `<style>` block to `max-width: 220px; max-height: 2.5rem`. Fix: change to `max-h-10 max-w-56` directly in template.
- **`header/components/desktop-menu.html`**: adds HTMX `hx-get/hx-select/hx-target/hx-push-url` attrs to internal nav links; reads category color for menu item text color; removes translations partial (eliminating `.translation { display: none !important; }` hack).
- **`header/components/mobile-menu.html`**: same HTMX attrs; same category color; removes translations partial from mobile footer components.

**Transparent header fix:** The `musictide.css` rule `header nav, header > div { background: transparent !important; }` overrides a background added by Blowfish's fixed-header wrapper. Read `/home/n0xx/Code/infra/service/blowfish/layouts/partials/header/fixed.html` to find the element adding the background. Make it transparent by modifying that template directly (not via !important). After this, the CSS rule in `musictide.css` can be removed.

**Files:**
- Modify in fork: `layouts/partials/header/basic.html`
- Modify in fork: `layouts/partials/header/components/desktop-menu.html`
- Modify in fork: `layouts/partials/header/components/mobile-menu.html`
- Modify in fork: `layouts/partials/header/fixed.html` (or wherever the background lives)
- Delete from musictide: all three header override files
- Modify in musictide: `assets/css/musictide.css` — remove transparent header rule and `.translation { display: none !important; }` rule
- Modify in musictide: `layouts/partials/extend-head.html` — remove logo `<style>` block

- [ ] **Step 1: Read the fork's header/fixed.html to find the background source**

```bash
cat /home/n0xx/Code/infra/service/blowfish/layouts/partials/header/fixed.html
```

Identify the element(s) that add a background color/blur. Common patterns: `bg-neutral-100/75`, `backdrop-blur`, `bg-neutral-50/75 dark:bg-neutral-800/75`.

- [ ] **Step 2: Make the fixed header transparent in the fork**

In fork's `header/fixed.html` (or wherever the background class is found), remove or replace the background color classes to make the header transparent. If the background is e.g. `class="... bg-neutral-100/75 dark:bg-neutral-800/75 ..."`, remove those classes. The header should have no background — the page content shows through.

- [ ] **Step 3: Copy musictide's header/basic.html to the fork, fixing the logo classes**

Copy musictide's `layouts/partials/header/basic.html` to fork's `layouts/partials/header/basic.html`.

Find the logo `<img>` element (it has `class="logo max-h-20 max-w-20 ..."`). Change `max-h-20 max-w-20` to `max-h-10 max-w-56`.

This eliminates the need for the `img.logo { max-width: 220px !important; ... }` block in `extend-head.html`.

- [ ] **Step 4: Copy musictide's desktop-menu.html to the fork, removing translations call**

Copy musictide's `layouts/partials/header/components/desktop-menu.html` to the fork.

Remove the line:
```html
{{ partial "header/components/translations.html" . }}
```

This eliminates the need for `.translation { display: none !important; }` in `musictide.css`.

- [ ] **Step 5: Copy musictide's mobile-menu.html to the fork, removing translations from mobile-footer-components**

Copy musictide's `layouts/partials/header/components/mobile-menu.html` to the fork.

In the `{{ define "mobile-footer-components" }}` block, remove the entire `translations.html` partial call:
```html
{{ partial "header/components/translations.html" . }}
```

Also remove the condition that was keeping that block alive just for translations. The `mobile-footer-components` block should only render when `site.Params.enableA11y` is true:

```html
{{ define "mobile-footer-components" }}
  {{ if site.Params.enableA11y | default false }}
    <div class="flex flex-wrap items-center ... gap-x-6 ps-2 mt-8 pt-8 border-t bf-border-color">
      {{ partial "header/components/a11y.html" (dict "prefix" "mobile-menu-") }}
    </div>
  {{ end }}
{{ end }}
```

- [ ] **Step 6: Rebuild Tailwind in the fork**

```bash
cd /home/n0xx/Code/infra/service/blowfish && npm run build
```

- [ ] **Step 7: Commit header changes in the fork**

```bash
git -C /home/n0xx/Code/infra/service/blowfish add layouts/partials/header/ assets/css/compiled/main.css
git -C /home/n0xx/Code/infra/service/blowfish commit -m "feat(musictide): header overrides — site_name, HTMX nav, category colors, transparent fixed header"
```

- [ ] **Step 8: Delete musictide's header overrides**

```bash
rm /home/n0xx/Code/infra/service/musictide/layouts/partials/header/basic.html
rm /home/n0xx/Code/infra/service/musictide/layouts/partials/header/components/desktop-menu.html
rm /home/n0xx/Code/infra/service/musictide/layouts/partials/header/components/mobile-menu.html
```

- [ ] **Step 9: Remove the logo `<style>` block from extend-head.html**

In `musictide/layouts/partials/extend-head.html`, remove:

```html
{{- /* ── Logo sizing override (Blowfish caps at max-w-20/max-h-20 = 80px) ── */ -}}
<style>
  img.logo { max-width: 220px !important; max-height: 2.5rem !important; width: auto; }
</style>
```

- [ ] **Step 10: Remove the now-redundant CSS rules from musictide.css in the fork**

Edit `/home/n0xx/Code/infra/service/blowfish/assets/css/musictide.css`. Remove:

```css
/* Transparent fixed header */
header nav,
header > div {
  background: transparent !important;
}

/* Hide language switcher (no EN content yet) */
.translation {
  display: none !important;
}
```

- [ ] **Step 11: Rebuild Tailwind after removing CSS rules**

```bash
cd /home/n0xx/Code/infra/service/blowfish && npm run build
```

- [ ] **Step 12: Commit CSS cleanup in fork**

```bash
git -C /home/n0xx/Code/infra/service/blowfish add assets/css/musictide.css assets/css/compiled/main.css
git -C /home/n0xx/Code/infra/service/blowfish commit -m "fix(musictide): remove !important hacks from musictide.css — fixed at source in templates"
```

- [ ] **Step 13: Verify build and visual**

```bash
cd /home/n0xx/Code/infra/service/musictide && hugo 2>&1 | grep -E "^ERROR"
```

Expected: empty. Start `yarn watch`. Check:
- Logo renders at correct size (wider than 80px, no distortion)
- Fixed header is transparent (page content visible behind it on scroll)
- Language switcher not present in desktop or mobile nav
- HTMX nav: clicking a category link does an HTMX swap (no full page reload)

- [ ] **Step 14: Commit musictide cleanup**

```bash
git -C /home/n0xx/Code/infra/service/musictide add layouts/partials/header/ layouts/partials/extend-head.html
git -C /home/n0xx/Code/infra/service/musictide commit -m "chore: remove header overrides; moved to blowfish fork"
```

---

## Task 5: Migrate resolve-feature-image, hero/big, article-gallery, category-badge

### Context

Four partials that are new additions (no upstream Blowfish equivalent for three of them). They form a dependency chain: `resolve-feature-image.html` is called by `hero/big.html`, `home/hero.html`, `categories/term.html`, `tags/term.html`, and `article-link/card.html`. Safe to migrate together.

`hero/big.html` is a **modification** of Blowfish's existing `hero/big.html` — the fork already has an upstream version. The musictide version replaces it wholesale.

**Files:**
- Add to fork: `layouts/partials/resolve-feature-image.html`
- Replace in fork: `layouts/partials/hero/big.html`
- Add to fork: `layouts/partials/article-gallery.html`
- Add to fork: `layouts/partials/category-badge.html`
- Delete from musictide: all four files

- [ ] **Step 1: Copy resolve-feature-image.html to the fork**

```bash
cp /home/n0xx/Code/infra/service/musictide/layouts/partials/resolve-feature-image.html \
   /home/n0xx/Code/infra/service/blowfish/layouts/partials/resolve-feature-image.html
```

- [ ] **Step 2: Copy hero/big.html to the fork**

```bash
cp /home/n0xx/Code/infra/service/musictide/layouts/partials/hero/big.html \
   /home/n0xx/Code/infra/service/blowfish/layouts/partials/hero/big.html
```

- [ ] **Step 3: Copy article-gallery.html to the fork**

```bash
cp /home/n0xx/Code/infra/service/musictide/layouts/partials/article-gallery.html \
   /home/n0xx/Code/infra/service/blowfish/layouts/partials/article-gallery.html
```

- [ ] **Step 4: Copy category-badge.html to the fork**

```bash
cp /home/n0xx/Code/infra/service/musictide/layouts/partials/category-badge.html \
   /home/n0xx/Code/infra/service/blowfish/layouts/partials/category-badge.html
```

- [ ] **Step 5: Rebuild Tailwind**

```bash
cd /home/n0xx/Code/infra/service/blowfish && npm run build
```

- [ ] **Step 6: Commit to fork**

```bash
git -C /home/n0xx/Code/infra/service/blowfish add layouts/partials/resolve-feature-image.html layouts/partials/hero/big.html layouts/partials/article-gallery.html layouts/partials/category-badge.html assets/css/compiled/main.css
git -C /home/n0xx/Code/infra/service/blowfish commit -m "feat(musictide): add resolve-feature-image, hero/big, article-gallery, category-badge"
```

- [ ] **Step 7: Delete from musictide**

```bash
rm /home/n0xx/Code/infra/service/musictide/layouts/partials/resolve-feature-image.html
rm /home/n0xx/Code/infra/service/musictide/layouts/partials/hero/big.html
rm /home/n0xx/Code/infra/service/musictide/layouts/partials/article-gallery.html
rm /home/n0xx/Code/infra/service/musictide/layouts/partials/category-badge.html
```

- [ ] **Step 8: Verify build**

```bash
cd /home/n0xx/Code/infra/service/musictide && hugo 2>&1 | grep -E "^ERROR"
```

Expected: empty. Visual: open an article page. Feature image renders correctly at 16:9. Click image — medium-zoom opens. Scroll past body — gallery renders in columns.

- [ ] **Step 9: Commit musictide**

```bash
git -C /home/n0xx/Code/infra/service/musictide add layouts/partials/
git -C /home/n0xx/Code/infra/service/musictide commit -m "chore: move hero, gallery, category-badge partials to blowfish fork"
```

---

## Task 6: Migrate ads-data and ad-slot

### Context

Both are new partials (no upstream equivalent). `ads-data.html` is called from `extend-head.html` (which is cached, context is `.Site`); `ad-slot.html` is called from `home/hero.html` and `categories/term.html`.

**Files:**
- Add to fork: `layouts/partials/ads-data.html`
- Add to fork: `layouts/partials/ad-slot.html`
- Delete from musictide: both files

- [ ] **Step 1: Copy both partials to the fork**

```bash
cp /home/n0xx/Code/infra/service/musictide/layouts/partials/ads-data.html \
   /home/n0xx/Code/infra/service/blowfish/layouts/partials/ads-data.html

cp /home/n0xx/Code/infra/service/musictide/layouts/partials/ad-slot.html \
   /home/n0xx/Code/infra/service/blowfish/layouts/partials/ad-slot.html
```

- [ ] **Step 2: Rebuild Tailwind**

```bash
cd /home/n0xx/Code/infra/service/blowfish && npm run build
```

- [ ] **Step 3: Commit to fork**

```bash
git -C /home/n0xx/Code/infra/service/blowfish add layouts/partials/ads-data.html layouts/partials/ad-slot.html assets/css/compiled/main.css
git -C /home/n0xx/Code/infra/service/blowfish commit -m "feat(musictide): add ads-data and ad-slot partials"
```

- [ ] **Step 4: Delete from musictide**

```bash
rm /home/n0xx/Code/infra/service/musictide/layouts/partials/ads-data.html
rm /home/n0xx/Code/infra/service/musictide/layouts/partials/ad-slot.html
```

- [ ] **Step 5: Verify build**

```bash
cd /home/n0xx/Code/infra/service/musictide && hugo 2>&1 | grep -E "^ERROR"
```

Expected: empty. Visual: homepage should still show the destaque ad slot below the hero (if any active ads exist).

- [ ] **Step 6: Commit musictide**

```bash
git -C /home/n0xx/Code/infra/service/musictide add layouts/partials/ads-data.html layouts/partials/ad-slot.html
git -C /home/n0xx/Code/infra/service/musictide commit -m "chore: move ads-data and ad-slot partials to blowfish fork"
```

---

## Task 7: Migrate article-link/card and article-link/simple — fix min-w-full

### Context

Both are modifications of Blowfish's existing partials. The key changes:
- Both accept a `categoryColor` dict param (alongside the original plain-page context for backward compatibility in `simple.html`)
- `card.html` uses `resolve-feature-image.html` instead of inline image resolution
- **`min-w-full` fix:** Blowfish's upstream `card.html` has `min-w-full` on the `<article>` element. This breaks the flex card grid (cards always stretch to full width instead of fitting the flex column). musictide currently patches this with `musictide.css`: `.mt-card-grid .article-link--card { min-width: 0; }`. In the fork, remove `min-w-full` from the article element directly.

Also remove from `musictide.css` in the fork: `.mt-card-grid .article-link--card { min-width: 0; }` (the override that was compensating for this).

**Files:**
- Replace in fork: `layouts/partials/article-link/card.html`
- Replace in fork: `layouts/partials/article-link/simple.html`
- Modify in fork: `assets/css/musictide.css` — remove the min-width override
- Delete from musictide: both files

- [ ] **Step 1: Copy card.html to the fork**

```bash
cp /home/n0xx/Code/infra/service/musictide/layouts/partials/article-link/card.html \
   /home/n0xx/Code/infra/service/blowfish/layouts/partials/article-link/card.html
```

In fork's `card.html`, find the `<article>` element with `class="article-link--card relative min-h-full min-w-full ..."` and remove `min-w-full`:

```html
<article class="article-link--card relative min-h-full overflow-hidden rounded-lg border border-neutral-300 dark:border-neutral-600{{- with $categoryColor }} cat-bg--{{ . }}{{- end }}">
```

- [ ] **Step 2: Copy simple.html to the fork**

```bash
cp /home/n0xx/Code/infra/service/musictide/layouts/partials/article-link/simple.html \
   /home/n0xx/Code/infra/service/blowfish/layouts/partials/article-link/simple.html
```

- [ ] **Step 3: Remove the min-width override from musictide.css in the fork**

In `/home/n0xx/Code/infra/service/blowfish/assets/css/musictide.css`, remove:

```css
/* Override Blowfish's min-w-full on cards, which breaks flex sizing */
.mt-card-grid .article-link--card { min-width: 0; }
```

- [ ] **Step 4: Rebuild Tailwind**

```bash
cd /home/n0xx/Code/infra/service/blowfish && npm run build
```

- [ ] **Step 5: Commit to fork**

```bash
git -C /home/n0xx/Code/infra/service/blowfish add layouts/partials/article-link/ assets/css/musictide.css assets/css/compiled/main.css
git -C /home/n0xx/Code/infra/service/blowfish commit -m "feat(musictide): article-link card and simple with categoryColor; remove min-w-full hack"
```

- [ ] **Step 6: Delete from musictide**

```bash
rm /home/n0xx/Code/infra/service/musictide/layouts/partials/article-link/card.html
rm /home/n0xx/Code/infra/service/musictide/layouts/partials/article-link/simple.html
```

- [ ] **Step 7: Verify build and visual**

```bash
cd /home/n0xx/Code/infra/service/musictide && hugo 2>&1 | grep -E "^ERROR"
```

Expected: empty. Visual: homepage card grid renders correctly (3 columns on desktop, 2 on tablet, 1 on mobile). Cards have colored category backgrounds when `card_category_color: true`.

- [ ] **Step 8: Commit musictide**

```bash
git -C /home/n0xx/Code/infra/service/musictide add layouts/partials/article-link/
git -C /home/n0xx/Code/infra/service/musictide commit -m "chore: move article-link partials to blowfish fork"
```

---

## Task 8: Migrate _default/single.html and index.html

### Context

`single.html` adds musictide-specific credit fields (`credit_texto`, `credit_fotos`, `credit_video`) and calls `article-gallery.html`. It's a modification of Blowfish's `_default/single.html`.

`index.html` reads `homepage_layout` from `hugo.Data.style` instead of `params.yaml`. It's a replacement of Blowfish's `layouts/index.html`.

**Files:**
- Replace in fork: `layouts/_default/single.html`
- Replace in fork: `layouts/index.html`
- Delete from musictide: both files

- [ ] **Step 1: Copy single.html to the fork**

```bash
cp /home/n0xx/Code/infra/service/musictide/layouts/_default/single.html \
   /home/n0xx/Code/infra/service/blowfish/layouts/_default/single.html
```

- [ ] **Step 2: Copy index.html to the fork**

```bash
cp /home/n0xx/Code/infra/service/musictide/layouts/index.html \
   /home/n0xx/Code/infra/service/blowfish/layouts/index.html
```

- [ ] **Step 3: Rebuild Tailwind**

```bash
cd /home/n0xx/Code/infra/service/blowfish && npm run build
```

- [ ] **Step 4: Commit to fork**

```bash
git -C /home/n0xx/Code/infra/service/blowfish add layouts/_default/single.html layouts/index.html assets/css/compiled/main.css
git -C /home/n0xx/Code/infra/service/blowfish commit -m "feat(musictide): single.html with credit fields; index.html reads from data.style"
```

- [ ] **Step 5: Delete from musictide**

```bash
rm /home/n0xx/Code/infra/service/musictide/layouts/_default/single.html
rm /home/n0xx/Code/infra/service/musictide/layouts/index.html
```

- [ ] **Step 6: Verify build and visual**

```bash
cd /home/n0xx/Code/infra/service/musictide && hugo 2>&1 | grep -E "^ERROR"
```

Expected: empty. Visual: open an article with credit fields (look for one with `credit_texto` or `credit_fotos` in frontmatter). Credits should appear below the title. Homepage should dispatch to the hero layout.

- [ ] **Step 7: Commit musictide**

```bash
git -C /home/n0xx/Code/infra/service/musictide add layouts/_default/single.html layouts/index.html
git -C /home/n0xx/Code/infra/service/musictide commit -m "chore: move single.html and index.html to blowfish fork"
```

---

## Task 9: Migrate home/hero.html

### Context

`home/hero.html` is musictide's fully custom homepage layout. It replaces Blowfish's `home/hero.html` entirely. It calls `resolve-feature-image.html`, `category-badge.html`, and `ad-slot.html` — all now in the fork.

**Files:**
- Replace in fork: `layouts/partials/home/hero.html`
- Delete from musictide: `layouts/partials/home/hero.html`

- [ ] **Step 1: Copy home/hero.html to the fork**

```bash
cp /home/n0xx/Code/infra/service/musictide/layouts/partials/home/hero.html \
   /home/n0xx/Code/infra/service/blowfish/layouts/partials/home/hero.html
```

- [ ] **Step 2: Rebuild Tailwind**

```bash
cd /home/n0xx/Code/infra/service/blowfish && npm run build
```

- [ ] **Step 3: Commit to fork**

```bash
git -C /home/n0xx/Code/infra/service/blowfish add layouts/partials/home/hero.html assets/css/compiled/main.css
git -C /home/n0xx/Code/infra/service/blowfish commit -m "feat(musictide): custom homepage hero layout"
```

- [ ] **Step 4: Delete from musictide**

```bash
rm /home/n0xx/Code/infra/service/musictide/layouts/partials/home/hero.html
```

- [ ] **Step 5: Verify build and visual**

```bash
cd /home/n0xx/Code/infra/service/musictide && hugo 2>&1 | grep -E "^ERROR"
```

Expected: empty. Visual: homepage shows full-bleed 16:9 hero with latest article, category badge bottom-left, title overlaid. Clicking hero navigates to article.

- [ ] **Step 6: Commit musictide**

```bash
git -C /home/n0xx/Code/infra/service/musictide add layouts/partials/home/
git -C /home/n0xx/Code/infra/service/musictide commit -m "chore: move home/hero.html to blowfish fork"
```

---

## Task 10: Migrate posts/list.html and posts/list.fragment.html

### Context

`posts/list.html` reads card display options from `hugo.Data.style`. It's a replacement of Blowfish's `_default/list.html` scoped to the `posts` section.

`posts/list.fragment.html` is a new standalone template (no `{{ define "main" }}`, `baseof.html` not applied) for HTMX infinite scroll.

**Files:**
- Add to fork: `layouts/posts/list.html`
- Add to fork: `layouts/posts/list.fragment.html`
- Delete from musictide: both files

- [ ] **Step 1: Copy both files to the fork**

```bash
mkdir -p /home/n0xx/Code/infra/service/blowfish/layouts/posts

cp /home/n0xx/Code/infra/service/musictide/layouts/posts/list.html \
   /home/n0xx/Code/infra/service/blowfish/layouts/posts/list.html

cp /home/n0xx/Code/infra/service/musictide/layouts/posts/list.fragment.html \
   /home/n0xx/Code/infra/service/blowfish/layouts/posts/list.fragment.html
```

- [ ] **Step 2: Rebuild Tailwind**

```bash
cd /home/n0xx/Code/infra/service/blowfish && npm run build
```

- [ ] **Step 3: Commit to fork**

```bash
git -C /home/n0xx/Code/infra/service/blowfish add layouts/posts/ assets/css/compiled/main.css
git -C /home/n0xx/Code/infra/service/blowfish commit -m "feat(musictide): posts list and HTMX fragment template"
```

- [ ] **Step 4: Delete from musictide**

```bash
rm /home/n0xx/Code/infra/service/musictide/layouts/posts/list.html
rm /home/n0xx/Code/infra/service/musictide/layouts/posts/list.fragment.html
```

- [ ] **Step 5: Verify build and visual**

```bash
cd /home/n0xx/Code/infra/service/musictide && hugo 2>&1 | grep -E "^ERROR"
```

Expected: empty. Visual: `/posts/` listing page renders. `yarn watch` — scroll homepage to bottom — HTMX infinite scroll loads next batch of cards without full page reload.

- [ ] **Step 6: Commit musictide**

```bash
git -C /home/n0xx/Code/infra/service/musictide add layouts/posts/
git -C /home/n0xx/Code/infra/service/musictide commit -m "chore: move posts list templates to blowfish fork"
```

---

## Task 11: Migrate categories/term.html and categories/term.fragment.html

### Context

Both new templates (no upstream equivalent in Blowfish for categories-specific listing with this structure). They replace Blowfish's `_default/term.html` for the categories taxonomy.

**Files:**
- Add to fork: `layouts/categories/term.html`
- Add to fork: `layouts/categories/term.fragment.html`
- Delete from musictide: both files

- [ ] **Step 1: Copy to fork**

```bash
mkdir -p /home/n0xx/Code/infra/service/blowfish/layouts/categories

cp /home/n0xx/Code/infra/service/musictide/layouts/categories/term.html \
   /home/n0xx/Code/infra/service/blowfish/layouts/categories/term.html

cp /home/n0xx/Code/infra/service/musictide/layouts/categories/term.fragment.html \
   /home/n0xx/Code/infra/service/blowfish/layouts/categories/term.fragment.html
```

- [ ] **Step 2: Rebuild Tailwind**

```bash
cd /home/n0xx/Code/infra/service/blowfish && npm run build
```

- [ ] **Step 3: Commit to fork**

```bash
git -C /home/n0xx/Code/infra/service/blowfish add layouts/categories/ assets/css/compiled/main.css
git -C /home/n0xx/Code/infra/service/blowfish commit -m "feat(musictide): category term page and HTMX fragment"
```

- [ ] **Step 4: Delete from musictide**

```bash
rm /home/n0xx/Code/infra/service/musictide/layouts/categories/term.html
rm /home/n0xx/Code/infra/service/musictide/layouts/categories/term.fragment.html
```

- [ ] **Step 5: Verify build and visual**

```bash
cd /home/n0xx/Code/infra/service/musictide && hugo 2>&1 | grep -E "^ERROR"
```

Expected: empty. Visual: click a category in the nav (e.g. Cultura) — hero shows latest article in that category; HTMX scroll loads more.

- [ ] **Step 6: Commit musictide**

```bash
git -C /home/n0xx/Code/infra/service/musictide add layouts/categories/
git -C /home/n0xx/Code/infra/service/musictide commit -m "chore: move categories templates to blowfish fork"
```

---

## Task 12: Migrate tags/term.html and tags/term.fragment.html

### Context

Mirrors the categories migration. Tags differ from categories in that they have no `color` param — the category badge on tag pages uses per-article category colors, not a term-level color.

**Files:**
- Add to fork: `layouts/tags/term.html`
- Add to fork: `layouts/tags/term.fragment.html`
- Delete from musictide: both files

- [ ] **Step 1: Copy to fork**

```bash
mkdir -p /home/n0xx/Code/infra/service/blowfish/layouts/tags

cp /home/n0xx/Code/infra/service/musictide/layouts/tags/term.html \
   /home/n0xx/Code/infra/service/blowfish/layouts/tags/term.html

cp /home/n0xx/Code/infra/service/musictide/layouts/tags/term.fragment.html \
   /home/n0xx/Code/infra/service/blowfish/layouts/tags/term.fragment.html
```

- [ ] **Step 2: Rebuild Tailwind**

```bash
cd /home/n0xx/Code/infra/service/blowfish && npm run build
```

- [ ] **Step 3: Commit to fork**

```bash
git -C /home/n0xx/Code/infra/service/blowfish add layouts/tags/ assets/css/compiled/main.css
git -C /home/n0xx/Code/infra/service/blowfish commit -m "feat(musictide): tag term page and HTMX fragment"
```

- [ ] **Step 4: Delete from musictide**

```bash
rm /home/n0xx/Code/infra/service/musictide/layouts/tags/term.html
rm /home/n0xx/Code/infra/service/musictide/layouts/tags/term.fragment.html
```

- [ ] **Step 5: Verify build and visual**

```bash
cd /home/n0xx/Code/infra/service/musictide && hugo 2>&1 | grep -E "^ERROR"
```

Expected: empty. Visual: click a tag on an article — tag listing page shows with hero and HTMX scroll.

- [ ] **Step 6: Commit musictide**

```bash
git -C /home/n0xx/Code/infra/service/musictide add layouts/tags/
git -C /home/n0xx/Code/infra/service/musictide commit -m "chore: move tags templates to blowfish fork"
```

---

## Task 13: Migrate authors/list.html — replace CSS with Tailwind

### Context

`authors/list.html` renders the `/authors/` bio card grid. The template uses custom CSS classes (`.author-grid`, `.author-card`, `.author-photo`, etc.) that are defined in a large `<style>` block in `extend-head.html`. 

In the fork, replace ALL of those custom classes with Tailwind utilities directly in the template — this is the whole point of owning the Tailwind build. After this, the `<style>` block in `extend-head.html` can be removed entirely.

**Tailwind replacements for each custom class:**

| Old class | Tailwind replacement (in fork) |
|---|---|
| `author-grid` | `grid grid-cols-1 md:grid-cols-2 gap-6 mt-8` |
| `author-card` | `flex gap-4 p-5 bg-neutral-100 dark:bg-neutral-800 scroll-mt-20` |
| `author-photo` | `shrink-0 w-20 h-20 rounded-full object-cover` |
| `author-photo-placeholder` | `shrink-0 w-20 h-20 rounded-full bg-neutral-300 dark:bg-neutral-600 flex items-center justify-center text-2xl font-bold text-neutral-600 dark:text-neutral-300` |
| `author-info` | `flex-1 min-w-0` |
| `author-name` | `text-lg font-bold text-neutral-900 dark:text-neutral-50 mb-1 mt-0` |
| `author-bio` | `text-sm text-neutral-600 dark:text-neutral-400 mb-3 mt-0 leading-normal` |
| `author-social` | `flex gap-3 flex-wrap items-center` |
| `author-social a` (hover/color) | `text-neutral-500 dark:text-neutral-400 w-5 h-5 inline-flex items-center justify-center transition-colors hover:text-primary-500 dark:hover:text-primary-400` |
| `author-social svg` | `w-5 h-5` |

Note: `rounded-full` generates `border-radius: 9999px` — but musictide.css has a global `border-radius: 0 !important` reset. Author photos therefore render square, not circular. This is the current behaviour. If you want circular photos, the global reset must carve out an exception for `.author-photo` and `.author-photo-placeholder`. For feature parity, keep them square (as they are now). Note this in a code comment in `authors/list.html`.

**Files:**
- Add to fork: `layouts/authors/list.html` (with Tailwind classes replacing the custom CSS)
- Delete from musictide: `layouts/authors/list.html`
- Modify in musictide: `layouts/partials/extend-head.html` — remove the author card `<style>` block

- [ ] **Step 1: Write the fork's authors/list.html with Tailwind classes**

Create `/home/n0xx/Code/infra/service/blowfish/layouts/authors/list.html`:

```html
{{ define "main" }}
  <div class="max-w-7xl mx-auto">
    <h1 class="mt-8 mb-2 text-4xl font-extrabold text-neutral-900 dark:text-neutral">
      {{ .Title }}
    </h1>

    {{/* Note: border-radius: 0 !important in musictide.css makes photos square, not circular */}}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
      {{ range where .Site.RegularPages "Section" "authors" }}
        <div id="{{ .Title | urlize }}" class="flex gap-4 p-5 bg-neutral-100 dark:bg-neutral-800 scroll-mt-20">

          {{ if .Params.photo }}
            <img
              src="{{ .Params.photo }}"
              alt="{{ .Title }}"
              class="shrink-0 w-20 h-20 rounded-full object-cover">
          {{ else }}
            <div class="shrink-0 w-20 h-20 rounded-full bg-neutral-300 dark:bg-neutral-600 flex items-center justify-center text-2xl font-bold text-neutral-600 dark:text-neutral-300">
              {{ substr .Title 0 1 | upper }}
            </div>
          {{ end }}

          <div class="flex-1 min-w-0">
            <p class="text-lg font-bold text-neutral-900 dark:text-neutral-50 mb-1 mt-0">{{ .Title }}</p>

            {{ if .Plain }}
              <p class="text-sm text-neutral-600 dark:text-neutral-400 mb-3 mt-0 leading-normal">{{ .Plain }}</p>
            {{ end }}

            <div class="flex gap-3 flex-wrap items-center">
              {{ with .Params.pub_email }}
                <a href="mailto:{{ . }}" title="Email"
                   class="text-neutral-500 dark:text-neutral-400 w-5 h-5 inline-flex items-center justify-center transition-colors hover:text-primary-500 dark:hover:text-primary-400">
                  {{ partial "icon.html" "email" }}
                </a>
              {{ end }}
              {{ with .Params.instagram }}
                {{ $url := cond (strings.HasPrefix . "http") . (printf "https://instagram.com/%s" (strings.TrimPrefix . "@")) }}
                <a href="{{ $url }}" target="_blank" rel="noopener noreferrer" title="Instagram"
                   class="text-neutral-500 dark:text-neutral-400 w-5 h-5 inline-flex items-center justify-center transition-colors hover:text-primary-500 dark:hover:text-primary-400">
                  {{ partial "icon.html" "instagram" }}
                </a>
              {{ end }}
              {{ with .Params.facebook }}
                {{ $url := cond (strings.HasPrefix . "http") . (printf "https://facebook.com/%s" (strings.TrimPrefix . "@")) }}
                <a href="{{ $url }}" target="_blank" rel="noopener noreferrer" title="Facebook"
                   class="text-neutral-500 dark:text-neutral-400 w-5 h-5 inline-flex items-center justify-center transition-colors hover:text-primary-500 dark:hover:text-primary-400">
                  {{ partial "icon.html" "facebook" }}
                </a>
              {{ end }}
              {{ with .Params.x_twitter }}
                {{ $url := cond (strings.HasPrefix . "http") . (printf "https://x.com/%s" (strings.TrimPrefix . "@")) }}
                <a href="{{ $url }}" target="_blank" rel="noopener noreferrer" title="X / Twitter"
                   class="text-neutral-500 dark:text-neutral-400 w-5 h-5 inline-flex items-center justify-center transition-colors hover:text-primary-500 dark:hover:text-primary-400">
                  {{ partial "icon.html" "x-twitter" }}
                </a>
              {{ end }}
              {{ with .Params.bluesky }}
                {{ $url := cond (strings.HasPrefix . "http") . (printf "https://bsky.app/profile/%s" (strings.TrimPrefix . "@")) }}
                <a href="{{ $url }}" target="_blank" rel="noopener noreferrer" title="Bluesky"
                   class="text-neutral-500 dark:text-neutral-400 w-5 h-5 inline-flex items-center justify-center transition-colors hover:text-primary-500 dark:hover:text-primary-400">
                  {{ partial "icon.html" "bluesky" }}
                </a>
              {{ end }}
              {{ with .Params.tiktok }}
                {{ $url := cond (strings.HasPrefix . "http") . (printf "https://www.tiktok.com/@%s" (strings.TrimPrefix . "@")) }}
                <a href="{{ $url }}" target="_blank" rel="noopener noreferrer" title="TikTok"
                   class="text-neutral-500 dark:text-neutral-400 w-5 h-5 inline-flex items-center justify-center transition-colors hover:text-primary-500 dark:hover:text-primary-400">
                  {{ partial "icon.html" "tiktok" }}
                </a>
              {{ end }}
              {{ with .Params.youtube }}
                {{ $url := cond (strings.HasPrefix . "http") . (printf "https://youtube.com/@%s" (strings.TrimPrefix . "@")) }}
                <a href="{{ $url }}" target="_blank" rel="noopener noreferrer" title="YouTube"
                   class="text-neutral-500 dark:text-neutral-400 w-5 h-5 inline-flex items-center justify-center transition-colors hover:text-primary-500 dark:hover:text-primary-400">
                  {{ partial "icon.html" "youtube" }}
                </a>
              {{ end }}
              {{ with .Params.spotify }}
                <a href="{{ . }}" target="_blank" rel="noopener noreferrer" title="Spotify"
                   class="text-neutral-500 dark:text-neutral-400 w-5 h-5 inline-flex items-center justify-center transition-colors hover:text-primary-500 dark:hover:text-primary-400">
                  {{ partial "icon.html" "spotify" }}
                </a>
              {{ end }}
            </div>
          </div>

        </div>
      {{ end }}
    </div>
  </div>
{{ end }}
```

- [ ] **Step 2: Rebuild Tailwind (new classes in the template must be scanned)**

```bash
cd /home/n0xx/Code/infra/service/blowfish && npm run build
```

- [ ] **Step 3: Commit to fork**

```bash
git -C /home/n0xx/Code/infra/service/blowfish add layouts/authors/list.html assets/css/compiled/main.css
git -C /home/n0xx/Code/infra/service/blowfish commit -m "feat(musictide): authors list with Tailwind classes (removes extend-head style block)"
```

- [ ] **Step 4: Delete from musictide**

```bash
rm /home/n0xx/Code/infra/service/musictide/layouts/authors/list.html
```

- [ ] **Step 5: Remove the author card `<style>` block from extend-head.html**

In `/home/n0xx/Code/infra/service/musictide/layouts/partials/extend-head.html`, remove the entire block from:

```html
{{/* Author card grid */}}
<style>
  .author-grid {
```

to the closing `</style>` tag of that block (approximately lines 88–184 in the current file).

- [ ] **Step 6: Verify build and visual**

```bash
cd /home/n0xx/Code/infra/service/musictide && hugo 2>&1 | grep -E "^ERROR"
```

Expected: empty. Visual: navigate to `/authors/`. Bio cards should render identically to before (2-column grid, avatar left, name/bio/social icons right). Social icon hover colours should use the primary colour.

- [ ] **Step 7: Commit musictide**

```bash
git -C /home/n0xx/Code/infra/service/musictide add layouts/authors/ layouts/partials/extend-head.html
git -C /home/n0xx/Code/infra/service/musictide commit -m "chore: move authors/list to fork; remove author card style block from extend-head"
```

---

## Task 14: Final cleanup and verification

### Context

At this point all layout files should be gone from musictide's `layouts/` directory (only `.gitkeep` remains). `extend-head.html` should contain only the legitimate integrations. `musictide.css` in the fork should contain no more `!important` rules (verify). The fork should be pushed to GitHub and musictide updated to pin to the new commit for production builds.

**Files:**
- Verify: `musictide/layouts/` — only `.gitkeep` remains
- Verify: `musictide/layouts/partials/extend-head.html` — no remaining style blocks except the dynamic `$hasDynamicCSS` one and the theme-toggle one
- Verify: fork's `musictide.css` — grep for `!important` should return empty
- Modify: `musictide/config/_default/module.yaml` — pin to the fork's latest commit (for production)
- Update: `CLAUDE.md` — reflect the fork and new module setup

- [ ] **Step 1: Confirm musictide layouts directory is clean**

```bash
find /home/n0xx/Code/infra/service/musictide/layouts -type f | sort
```

Expected: only `layouts/.gitkeep`. If any file is still there, it means a migration task was missed — do not proceed until those files are migrated.

- [ ] **Step 2: Confirm no !important remaining in fork's musictide.css**

```bash
grep -n "!important" /home/n0xx/Code/infra/service/blowfish/assets/css/musictide.css
```

Expected: empty. If any `!important` remains, investigate whether it's a legitimate CSS override or another hack that should be fixed at source.

- [ ] **Step 3: Confirm extend-head.html has no unexpected style blocks**

```bash
grep -n "<style>" /home/n0xx/Code/infra/service/musictide/layouts/partials/extend-head.html
```

Expected: one or two — the `{{- if $hasDynamicCSS }}` block (font-family + wide layout) and the theme toggle visibility block. Both are data-driven and legitimate.

- [ ] **Step 4: Full build check**

```bash
cd /home/n0xx/Code/infra/service/musictide && hugo 2>&1 | grep -E "^(ERROR|WARN)" | grep -v "not compatible"
```

Expected: empty (the "not compatible" version warning is acceptable).

- [ ] **Step 5: Push the fork's musictide-patches branch to GitHub**

```bash
git -C /home/n0xx/Code/infra/service/blowfish push -u origin musictide-patches
```

- [ ] **Step 6: Get the latest fork commit hash**

```bash
git -C /home/n0xx/Code/infra/service/blowfish rev-parse HEAD
```

Note this hash for the next step.

- [ ] **Step 7: Update musictide's go.mod to pin to the fork commit**

In `/home/n0xx/Code/infra/service/musictide/go.mod`, the `require` line should reference the GitHub fork. Run:

```bash
cd /home/n0xx/Code/infra/service/musictide && hugo mod get github.com/n-000000/blowfish/v2@<commit-hash>
hugo mod tidy
```

This updates `go.mod` and `go.sum` to reference the exact fork commit for production builds (Cloudflare Pages will resolve this from GitHub).

- [ ] **Step 8: Verify production-equivalent build (no local replacement)**

```bash
cd /home/n0xx/Code/infra/service/musictide && HUGO_ENV=production hugo 2>&1 | grep -E "^ERROR"
```

Expected: empty. This confirms Cloudflare Pages will build correctly.

- [ ] **Step 9: Update CLAUDE.md**

In `musictide/CLAUDE.md`, update the Architecture section:

1. Under the Hugo Module section, replace `github.com/nunocoracao/blowfish/v2` with `github.com/n-000000/blowfish/v2`
2. Add a note that the fork is at `/home/n0xx/Code/infra/service/blowfish` on branch `musictide-patches`, mirroring the Sveltia fork workflow
3. Note that `config/development/module.yaml` activates the local path replacement during `yarn watch`
4. Update "Local Layout Overrides" section to note that all overrides now live in the fork; musictide's `layouts/` is intentionally empty
5. Update the musictide.css entry under Styling System to note it lives in the fork

- [ ] **Step 10: Final commit in musictide**

```bash
git -C /home/n0xx/Code/infra/service/musictide add go.mod go.sum CLAUDE.md
git -C /home/n0xx/Code/infra/service/musictide commit -m "chore: pin blowfish fork commit; update CLAUDE.md for fork workflow"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Covered by |
|---|---|
| Move musictide.css to fork | Task 2 |
| Move 8 custom schemes to fork | Task 2 |
| Logo !important → Tailwind fix | Task 4 |
| Transparent header !important → template fix | Task 4 |
| Language switcher !important → remove partial call | Task 4 |
| min-w-full card hack → remove from template | Task 7 |
| Author card style block → Tailwind in template | Task 13 |
| medium-zoom re-init hack → restore to footer.html | Task 3 |
| All 22 layout files migrated | Tasks 5–13 |
| Production build works from GitHub fork | Task 14 |
| CLAUDE.md updated | Task 14 |

**Placeholder scan:** No TBDs, no "implement later", no "similar to above". Every task has exact file paths and exact shell commands. Task 4, Step 1 says "read the file to find the background" — this is intentional because the element could shift with upstream updates; the agent must find it fresh.

**Type consistency:** All partial calls use the same dict shapes throughout (e.g. `resolve-feature-image.html` receives `dict "Page" . "Globs" ...`, `article-link/card.html` receives `dict "Page" . "categoryColor" $color`). These were verified against the existing working templates.
