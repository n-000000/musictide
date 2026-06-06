# Sveltia CMS Fork — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fork Sveltia CMS at v0.166.0, apply targeted fixes for all externally-unfixable backlog issues, add PT-PT translation, and host the compiled bundle in the musictide repo.

**Architecture:** Thin fork — upstream is a git remote; all changes live as clean commits on top of the `0.166.0` tag, making future rebases mechanical. Build output is a single `dist/sveltia-cms.js` committed to `musictide/static/admin/` and served directly, eliminating the CDN dependency. The musictide `admin/index.html` monkey-patches (fetch interceptor, upload toast, Ctrl+A, etc.) remain in place and are unaffected by this fork.

**Tech Stack:** Svelte 5, SvelteKit, Vite, pnpm (workspace), `@sveltia/i18n` (YAML locale files), TypeScript.

---

## Backlog covered by this plan

| P | Issue |
|---|-------|
| 9 | Scroll broken in thumbnail mode (media picker) |
| 7 | Media list cache — gallery picker shows stale/no results |
| 7 | Inconsistent preview/edit pane scroll |
| 7 | Images not pre-selected after upload |
| 6→1 | "View on live site" — disable when draft=true |
| 5 | Ctrl+A → Insert only inserts 1 image (internal state) |
| 3 | Multi-select + drag-drop gallery ordering |
| 2 | Preview↔image selection link |
| 1 | Inline create Events/Authors from relation field |
| — | PT-PT translation |

**Not in this plan:** Draft live preview (requires separate preview server, orthogonal to Sveltia).

---

## File map

| File | Change |
|------|--------|
| `src/lib/locales/pt.yaml` | **Create** — PT-PT translation strings (copy en.yaml, translate) |
| `src/lib/components/contents/details/toolbar.svelte` | Disable "View on live site" when entry has `draft: true` |
| `src/lib/components/assets/browser/simple-image-grid.svelte` | Fix scroll/overflow in grid view |
| `src/lib/components/assets/browser/assets-panel.svelte` | Ctrl+A selects all + pre-select after upload |
| `src/lib/components/assets/browser/select-assets-dialog.svelte` | Wire Ctrl+A keyboard handler at dialog level |
| `src/lib/components/assets/browser/internal-assets-panel.svelte` | Force media list refresh on picker open |
| `src/lib/components/contents/details/editor.svelte` | Fix preview/edit scroll sync |
| `src/lib/components/contents/details/fields/file/file-list.svelte` | Multi-select + drag-drop gallery ordering (investigate exact file) |
| `musictide/static/admin/sveltia-cms.js` | **Output** — compiled bundle (committed after each phase) |
| `musictide/static/admin/index.html` | Update `<script src>` to point at local file |

---

## Phase 1 — Infrastructure

### Task 1: Fork and clone

**Files:** none (git operations only)

- [ ] **Step 1: Fork on GitHub**

  Go to `https://github.com/sveltia/sveltia-cms` → Fork → name it `sveltia-cms` under your account (ngon / n0xx). Keep it public or private — doesn't matter.

- [ ] **Step 2: Clone to the right location**

  ```bash
  cd /home/n0xx/Code/infra/service
  git clone git@github.com:<your-fork>/sveltia-cms.git
  cd sveltia-cms
  ```

- [ ] **Step 3: Add upstream remote and pin to 0.166.0**

  ```bash
  git remote add upstream https://github.com/sveltia/sveltia-cms.git
  git fetch upstream --tags
  # Verify our base tag exists
  git show v0.166.0 --stat | head -5
  # Create a branch off the exact tag we shipped with
  git checkout -b musictide-patches v0.166.0
  ```

- [ ] **Step 4: Verify branch is clean**

  ```bash
  git log --oneline -3
  # Should show: the 0.166.0 tag commit at HEAD
  git status
  # Should show: nothing to commit
  ```

---

### Task 2: Build pipeline

**Files:** none (env setup)

- [ ] **Step 1: Install pnpm if not present**

  ```bash
  which pnpm || npm install -g pnpm
  pnpm --version  # expect 8.x or 9.x
  ```

- [ ] **Step 2: Install dependencies**

  ```bash
  cd /home/n0xx/Code/infra/service/sveltia-cms
  pnpm install
  ```

  Expected: packages install without errors. Ignore any peer dependency warnings.

- [ ] **Step 3: First build**

  ```bash
  pnpm build
  ```

  Expected: `dist/sveltia-cms.js` created, no errors. Build takes ~30–60 seconds.

  ```bash
  ls -lh dist/sveltia-cms.js
  # expect ~1.8–2.2 MB
  ```

- [ ] **Step 4: Commit baseline build script alias**

  Add a convenience script to `package.json` if not already present — nothing to change, `pnpm build` is the standard command. Just document it:

  ```bash
  # From now on: to rebuild after any change, run:
  # cd /home/n0xx/Code/infra/service/sveltia-cms && pnpm build
  # Then copy dist/sveltia-cms.js to musictide/static/admin/
  ```

---

### Task 3: Wire bundle into musictide

**Files:**
- Modify: `musictide/static/admin/index.html`
- Create: `musictide/static/admin/sveltia-cms.js` (copy from fork build)

- [ ] **Step 1: Copy initial build**

  ```bash
  cp /home/n0xx/Code/infra/service/sveltia-cms/dist/sveltia-cms.js \
     /home/n0xx/Code/infra/service/musictide/static/admin/sveltia-cms.js
  ```

- [ ] **Step 2: Update script tag in index.html**

  In `musictide/static/admin/index.html`, find:
  ```html
  <!-- Pin version — do not use @latest. Check https://github.com/sveltia/sveltia-cms/releases for updates. -->
  <script src="https://unpkg.com/@sveltia/cms@0.166.0/dist/sveltia-cms.js"></script>
  ```

  Replace with:
  ```html
  <!-- Fork build — compiled from /home/n0xx/Code/infra/service/sveltia-cms @ musictide-patches -->
  <script src="/admin/sveltia-cms.js"></script>
  ```

- [ ] **Step 3: Test locally**

  ```bash
  cd /home/n0xx/Code/infra/service/musictide
  yarn watch
  ```

  Navigate to `http://localhost:1313/admin/` — CMS should load identically to before. Log in and verify a basic article edit works.

- [ ] **Step 4: Check bundle size is acceptable for git**

  ```bash
  ls -lh musictide/static/admin/sveltia-cms.js
  # ~2 MB is fine for git. If >5 MB, use Git LFS instead.
  ```

- [ ] **Step 5: Commit to musictide**

  ```bash
  cd /home/n0xx/Code/infra/service/musictide
  git add static/admin/sveltia-cms.js static/admin/index.html
  git commit -m "feat(cms): switch to local fork build of Sveltia CMS

  Eliminates CDN dependency. Fork lives at:
  /home/n0xx/Code/infra/service/sveltia-cms @ musictide-patches
  Rebuild: pnpm build in fork, cp dist/sveltia-cms.js here.

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
  git push origin main
  ```

---

## Phase 2 — Quick wins

### Task 4: PT-PT translation

**Files:**
- Create: `src/lib/locales/pt.yaml` (in sveltia-cms fork)
- Rebuild + copy to musictide

**Context:** The i18n system auto-discovers `src/lib/locales/*.yaml` at build time via Vite glob import. Browser locale `"pt"` (from `navigator.language`) will match a `pt.yaml` file. Users whose browser is set to Portuguese will get the UI in PT-PT automatically.

- [ ] **Step 1: Copy en.yaml as starting point**

  ```bash
  cd /home/n0xx/Code/infra/service/sveltia-cms
  cp src/lib/locales/en.yaml src/lib/locales/pt.yaml
  ```

- [ ] **Step 2: Inspect structure**

  ```bash
  head -50 src/lib/locales/pt.yaml
  # Understand the YAML key format before translating
  ```

  Also compare with `ja.yaml` to confirm format is consistent.

- [ ] **Step 3: Translate pt.yaml**

  Open `src/lib/locales/pt.yaml` and translate all string values from English to PT-PT. Keys stay the same — only values change. Focus on:
  - Navigation labels (Collections, Entries, Assets, Settings)
  - Action buttons (Save, Cancel, Delete, Duplicate, Upload, Insert, Replace, Remove)
  - Field labels used across all widgets
  - Error and status messages
  - Media picker strings (No files found, Search for Images, Uploading files…)

  The file is ~40KB. Translate in sections, starting with the highest-visibility strings. The existing monkey-patch in `index.html` has some PT-PT strings (e.g., `"A enviar"`) — keep them consistent.

- [ ] **Step 4: Build and verify**

  ```bash
  pnpm build
  cp dist/sveltia-cms.js /home/n0xx/Code/infra/service/musictide/static/admin/sveltia-cms.js
  ```

  Set your browser language to Portuguese, load `http://localhost:1313/admin/` — UI should appear in PT-PT.

- [ ] **Step 5: Commit in fork**

  ```bash
  cd /home/n0xx/Code/infra/service/sveltia-cms
  git add src/lib/locales/pt.yaml
  git commit -m "feat(i18n): add PT-PT locale (pt.yaml)"
  ```

- [ ] **Step 6: Commit bundle to musictide**

  ```bash
  cd /home/n0xx/Code/infra/service/musictide
  git add static/admin/sveltia-cms.js
  git commit -m "feat(cms): PT-PT translation via fork build"
  git push origin main
  ```

---

### Task 5: Disable "View on live site" for drafts

**Files:**
- Modify: `src/lib/components/contents/details/toolbar.svelte`

**Context:** The button condition is `{#if !disabled && previewURL}`. We add a check: if the entry's `draft` field is `true`, hide/disable the button. Entry values are read via `$entryDraft?.currentValues`. Since Sveltia uses a locale map, values live under a locale key — read `draft` from the default locale's values.

- [ ] **Step 1: Read the toolbar and find the previewURL block**

  ```bash
  grep -n "previewURL\|View on live\|live site\|isDraft\|currentValues" \
    src/lib/components/contents/details/toolbar.svelte | head -20
  ```

  Note the line number of the `{#if !disabled && previewURL}` block.

- [ ] **Step 2: Find how to read the draft field**

  ```bash
  grep -n "currentValues\|defaultLocale\|originalEntry\|\.draft" \
    src/lib/components/contents/details/toolbar.svelte | head -20
  ```

  If `defaultLocale` is already in scope, entry data is accessible as:
  ```javascript
  $entryDraft?.currentValues?.[defaultLocale]?.draft
  ```
  If not, import `defaultLocale` from the appropriate service (check how other components do it — grep the repo for `defaultLocale` imports).

- [ ] **Step 3: Add the isDraft derived**

  In the `<script>` section, after the existing `$derived` declarations, add:
  ```javascript
  const isDraft = $derived(
    !!($entryDraft?.currentValues?.[defaultLocale ?? Object.keys($entryDraft?.currentValues ?? {})[0]]?.draft)
  );
  ```

  (The `?? Object.keys(...)` fallback handles the single-locale case where `defaultLocale` might not be set.)

- [ ] **Step 4: Add isDraft to the button condition**

  Find the `{#if !disabled && previewURL}` line and change to:
  ```svelte
  {#if !disabled && previewURL && !isDraft}
  ```

- [ ] **Step 5: Build and verify**

  ```bash
  pnpm build
  cp dist/sveltia-cms.js /home/n0xx/Code/infra/service/musictide/static/admin/sveltia-cms.js
  ```

  Load a draft article in the CMS — "View on live site" button should not appear. Load a published article — button should appear.

- [ ] **Step 6: Commit**

  ```bash
  cd /home/n0xx/Code/infra/service/sveltia-cms
  git add src/lib/components/contents/details/toolbar.svelte
  git commit -m "fix: hide 'View on live site' button for draft entries"
  ```

  ```bash
  cd /home/n0xx/Code/infra/service/musictide
  git add static/admin/sveltia-cms.js
  git commit -m "fix(cms): hide live site button for drafts"
  git push origin main
  ```

---

### Task 6: Investigate and fix thumbnail scroll in grid view (P9)

**Files:**
- Investigate: `src/lib/components/assets/browser/simple-image-grid.svelte`
- Investigate: associated CSS (may be in `<style>` block in same file)

**Context:** Grid view shows only ~8 images and doesn't scroll. Either a fixed height/max-height on the grid container or a virtual scroll misconfiguration.

- [ ] **Step 1: Inspect the grid container CSS**

  ```bash
  grep -n "height\|overflow\|scroll\|max-h\|grid\|virtual" \
    src/lib/components/assets/browser/simple-image-grid.svelte | head -30
  ```

  Also check parent containers:
  ```bash
  grep -n "height\|overflow\|scroll" \
    src/lib/components/assets/browser/assets-panel.svelte | head -20
  grep -n "height\|overflow\|scroll" \
    src/lib/components/assets/browser/select-assets-dialog.svelte | head -20
  ```

- [ ] **Step 2: Identify the constraint**

  If it's a CSS `max-height` or `overflow: hidden` on the grid wrapper: remove or increase it.
  If it's a virtual scroll component with a fixed item count: find the prop controlling visible item count and remove the cap.

- [ ] **Step 3: Apply the fix**

  CSS fix example (if max-height is the issue):
  ```svelte
  /* In simple-image-grid.svelte <style> */
  .grid-wrapper {
    overflow-y: auto;
    /* Remove or increase any max-height constraint */
  }
  ```

- [ ] **Step 4: Build and verify**

  ```bash
  pnpm build
  cp dist/sveltia-cms.js /home/n0xx/Code/infra/service/musictide/static/admin/sveltia-cms.js
  ```

  Open the media picker in grid mode with 15+ images — all should be visible and scrollable.

- [ ] **Step 5: Commit**

  ```bash
  cd /home/n0xx/Code/infra/service/sveltia-cms
  git add src/lib/components/assets/browser/simple-image-grid.svelte
  # Add any other changed files
  git commit -m "fix: enable scroll in media picker grid/thumbnail view"
  ```

  ```bash
  cd /home/n0xx/Code/infra/service/musictide
  git add static/admin/sveltia-cms.js
  git commit -m "fix(cms): media picker grid now scrollable"
  git push origin main
  ```

---

## Phase 3 — Media picker

### Task 7: Ctrl+A → Insert all selected images (P5)

**Files:**
- Investigate: `src/lib/components/assets/browser/assets-panel.svelte`
- Investigate: `src/lib/components/assets/browser/select-assets-dialog.svelte`

**Context:** Our monkey-patch in `index.html` clicks all `button[role="option"]` elements, which sets `aria-selected=true` on all of them. But Sveltia's internal `selectedAssets` reactive state only reflects one selection. The fix: add a proper keyboard handler inside the component that uses Sveltia's own selection API to select all items.

- [ ] **Step 1: Find how selectedAssets is managed**

  ```bash
  grep -n "selectedAssets\|selected\|onSelectionChange\|selectAll" \
    src/lib/components/assets/browser/assets-panel.svelte | head -30
  grep -n "selectedAssets\|selected\|onSelectionChange" \
    src/lib/components/assets/browser/select-assets-dialog.svelte | head -30
  ```

  Note the variable name and whether it's `$state`, a store, or passed as prop.

- [ ] **Step 2: Find where filteredAssets is defined**

  ```bash
  grep -n "filteredAssets\|assets\b" \
    src/lib/components/assets/browser/assets-panel.svelte | head -20
  ```

  `filteredAssets` is the array of currently visible assets in the picker. We want to select all of them on Ctrl+A.

- [ ] **Step 3: Add select-all function**

  In `assets-panel.svelte` (or `select-assets-dialog.svelte` — wherever `selectedAssets` and `filteredAssets` are co-located), add:

  ```javascript
  function selectAll() {
    // Replace selectedAssets with all currently visible assets
    selectedAssets = [...filteredAssets];
  }
  ```

  Adjust variable names to match what you found in Step 1–2.

- [ ] **Step 4: Wire to keydown handler**

  In the same component's template, add a keydown handler on the outermost wrapper or the dialog element:

  ```svelte
  <svelte:window onkeydown={(e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      selectAll();
    }
  }} />
  ```

  If the component already has a `<svelte:window>` handler, add the Ctrl+A case to it.

- [ ] **Step 5: Remove the Ctrl+A monkey-patch from musictide index.html**

  The entire `// Ctrl/Cmd+A selects all items in the media picker dialog.` block in `musictide/static/admin/index.html` can now be removed — the fork handles it correctly.

- [ ] **Step 6: Build and verify**

  ```bash
  pnpm build
  cp dist/sveltia-cms.js /home/n0xx/Code/infra/service/musictide/static/admin/sveltia-cms.js
  ```

  Open media picker, press Ctrl+A — all images should be aria-selected AND clicking Insert should insert all of them.

- [ ] **Step 7: Commit**

  ```bash
  cd /home/n0xx/Code/infra/service/sveltia-cms
  git add src/lib/components/assets/browser/assets-panel.svelte
  # or select-assets-dialog.svelte, wherever the fix lives
  git commit -m "feat: Ctrl+A selects all assets in media picker"
  ```

  ```bash
  cd /home/n0xx/Code/infra/service/musictide
  git add static/admin/sveltia-cms.js static/admin/index.html
  git commit -m "feat(cms): Ctrl+A now selects and inserts all — remove monkey-patch"
  git push origin main
  ```

---

### Task 8: Force media list refresh on picker open (P7 — cache bug)

**Files:**
- Investigate: `src/lib/components/assets/browser/assets-panel.svelte`
- Investigate: `src/lib/services/assets/` (wherever the asset list is cached)

**Context:** Sveltia fetches the media list once when the picker is first opened in a session, then reuses it. Uploading via cover image field → opening gallery picker shows stale/empty results. Fix: clear the cached list each time the picker dialog opens.

- [ ] **Step 1: Find the cache**

  ```bash
  grep -rn "assets\b.*\$state\|fetchAssets\|loadAssets\|assetList\|cachedAssets" \
    src/lib/services/assets/ | head -20
  grep -n "onMount\|onopen\|open.*fetch\|fetch.*open" \
    src/lib/components/assets/browser/select-assets-dialog.svelte | head -20
  ```

- [ ] **Step 2: Identify the fetch trigger**

  Find what triggers the initial fetch (likely `onMount` or a reactive effect when `open` becomes `true`). Note whether subsequent opens skip the fetch.

- [ ] **Step 3: Force re-fetch on open**

  The fix is to clear the cached asset list whenever the picker dialog transitions from closed to open. Exact code depends on what you find in Step 2, but the pattern is:

  ```javascript
  // In select-assets-dialog.svelte, watch for open state change
  $effect(() => {
    if (open) {
      // Clear cached list to force fresh fetch
      cachedAssets = undefined; // or whatever the cache variable is
    }
  });
  ```

- [ ] **Step 4: Build and verify**

  ```bash
  pnpm build
  cp dist/sveltia-cms.js /home/n0xx/Code/infra/service/musictide/static/admin/sveltia-cms.js
  ```

  Reproduce the bug scenario: new article → upload cover image → open gallery picker. Should now show the uploaded image.

- [ ] **Step 5: Commit**

  ```bash
  cd /home/n0xx/Code/infra/service/sveltia-cms
  git add src/lib/components/assets/browser/select-assets-dialog.svelte
  # + any service files touched
  git commit -m "fix: force media list refresh each time picker opens"
  ```

  ```bash
  cd /home/n0xx/Code/infra/service/musictide
  git add static/admin/sveltia-cms.js
  git commit -m "fix(cms): media picker no longer shows stale list"
  git push origin main
  ```

---

### Task 9: Pre-select uploaded images (P7)

**Files:**
- Investigate: `src/lib/components/assets/shared/upload-assets-dialog.svelte`
- Investigate: `src/lib/components/assets/browser/assets-panel.svelte`

**Context:** After uploading images through the picker's Upload button, the newly uploaded files appear in the list but aren't selected. The photographer expects them to be pre-selected for immediate insertion.

- [ ] **Step 1: Find the upload completion handler**

  ```bash
  grep -n "upload\|onUpload\|afterUpload\|uploaded\|inserted" \
    src/lib/components/assets/shared/upload-assets-dialog.svelte | head -20
  grep -n "upload\|onUpload\|afterUpload" \
    src/lib/components/assets/browser/select-assets-dialog.svelte | head -20
  ```

- [ ] **Step 2: Find where selected assets are set after upload**

  After upload completes, Sveltia probably adds the new assets to the list. Find that callback and add the newly uploaded assets to `selectedAssets`:

  ```javascript
  // After upload completes:
  function onUploadComplete(uploadedAssets) {
    // existing code that adds to asset list...
    // ADD: pre-select the newly uploaded assets
    selectedAssets = [...(selectedAssets ?? []), ...uploadedAssets];
  }
  ```

- [ ] **Step 3: Build and verify**

  ```bash
  pnpm build
  cp dist/sveltia-cms.js /home/n0xx/Code/infra/service/musictide/static/admin/sveltia-cms.js
  ```

  Upload images via the gallery picker — they should appear pre-selected. Clicking Insert should immediately include them.

- [ ] **Step 4: Commit**

  ```bash
  cd /home/n0xx/Code/infra/service/sveltia-cms
  git add src/lib/components/assets/shared/upload-assets-dialog.svelte
  # + any other files touched
  git commit -m "feat: pre-select newly uploaded assets in picker"
  ```

  ```bash
  cd /home/n0xx/Code/infra/service/musictide
  git add static/admin/sveltia-cms.js
  git commit -m "feat(cms): uploaded images auto-selected in picker"
  git push origin main
  ```

---

## Phase 4 — Editor

### Task 10: Fix preview/edit pane scroll sync (P7)

**Files:**
- Investigate: `src/lib/components/contents/details/editor.svelte`
- Investigate: scroll sync logic (search for `scrollTop`, `scroll`, `syncScroll`)

**Context:** Scrolling in the edit pane syncs to preview correctly. Scrolling in the preview pane causes the edit pane to jump. This is a two-way scroll sync bug — the feedback loop from preview→edit is misfiring.

- [ ] **Step 1: Find the scroll sync code**

  ```bash
  grep -rn "scroll\|syncScroll\|scrollTop\|onscroll" \
    src/lib/components/contents/details/ | grep -v ".test." | head -30
  ```

- [ ] **Step 2: Identify the feedback loop**

  Scroll sync typically works by:
  1. Edit scrolls → compute ratio → set preview scroll
  2. Preview scrolls → compute ratio → set edit scroll

  The bug: step 2 triggers step 1, which triggers step 2, causing oscillation. The fix is a guard flag:

  ```javascript
  let isSyncing = false;

  function onEditScroll(e) {
    if (isSyncing) return;
    isSyncing = true;
    // set preview scroll position
    isSyncing = false;
  }

  function onPreviewScroll(e) {
    if (isSyncing) return;
    isSyncing = true;
    // set edit scroll position
    isSyncing = false;
  }
  ```

  Adapt to match the actual code structure found in Step 1.

- [ ] **Step 3: Build and verify**

  ```bash
  pnpm build
  cp dist/sveltia-cms.js /home/n0xx/Code/infra/service/musictide/static/admin/sveltia-cms.js
  ```

  Open an article in widescreen view. Scroll in preview pane — edit pane should track smoothly without jumping.

- [ ] **Step 4: Commit**

  ```bash
  cd /home/n0xx/Code/infra/service/sveltia-cms
  git add src/lib/components/contents/details/editor.svelte
  git commit -m "fix: prevent scroll sync feedback loop between edit and preview panes"
  ```

  ```bash
  cd /home/n0xx/Code/infra/service/musictide
  git add static/admin/sveltia-cms.js
  git commit -m "fix(cms): preview/edit scroll sync no longer causes jumping"
  git push origin main
  ```

---

## Phase 5 — Heavy features (defer until Phase 1–4 complete)

These are significant features. Scope them individually when Phase 4 is done.

### Task 11: Multi-select + drag-drop gallery ordering (P3)

**Scope note:** The gallery field in the article form shows individual image items with up/down arrow buttons. This task adds checkbox multi-select and drag-and-drop reordering of multiple items. This is a meaningful feature addition (~1–2 days) and should be planned separately once the infrastructure is stable.

**Starting point:**
```bash
grep -rn "gallery\|list.*image\|move.*up\|move.*down\|reorder" \
  src/lib/components/contents/details/fields/ | head -20
```

---

### Task 12: Preview↔image selection link (P2)

**Scope note:** Clicking an image in the preview pane should highlight/scroll to the corresponding field in the edit pane, and vice versa. Requires understanding how the preview is rendered and how field focus is managed. ~1 day of investigation + implementation.

---

### Task 13: Inline create Events/Authors from relation field (P1)

**Scope note:** The relation widget (used for category, author, event fields) should allow creating a new entry in the referenced collection without navigating away. This is the largest feature — requires adding a "Create new" affordance to the relation widget that opens a mini-form or navigates and returns. ~2–3 days.

---

## Maintenance: pulling upstream updates

When Sveltia ships a new version worth pulling:

```bash
cd /home/n0xx/Code/infra/service/sveltia-cms
git fetch upstream --tags
# Review the changelog for the new version
# Then rebase our patches on top of the new tag:
git rebase v<new-version> musictide-patches
# Fix any conflicts (our changes are targeted; conflicts should be rare)
pnpm install   # in case deps changed
pnpm build
cp dist/sveltia-cms.js /home/n0xx/Code/infra/service/musictide/static/admin/sveltia-cms.js
cd /home/n0xx/Code/infra/service/musictide
git add static/admin/sveltia-cms.js
git commit -m "chore(cms): bump fork base to Sveltia v<new-version>"
git push origin main
```
