# Staff Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/colaboradores/` staff listing page showing contributor bio cards with photo, bio, and social network icons, fully managed via Sveltia CMS.

**Architecture:** Five small changes across CMS config, Hugo layouts, menu config, and content. The layout reads `content/authors/*.md` files and renders horizontal bio cards using Blowfish's built-in `icon.html` partial for social icons. Author card styles live in `extend-head.html` as a `<style>` block — Blowfish ships a pre-compiled PurgeCSS'd Tailwind bundle, so novel utility classes are stripped silently; inline CSS blocks are immune to this.

**Tech Stack:** Hugo 0.158.0, Blowfish v2 (Hugo module), Sveltia CMS, Tailwind CSS (pre-compiled bundle via Blowfish), PostCSS, CSS custom properties (RGB triplet format: `rgb(var(--color-neutral-100))`)

---

## Files

| File | Action | Purpose |
|---|---|---|
| `content/authors/_index.en.md` | Create | EN section title "Contributors" |
| `config/_default/menus.pt.yaml` | Modify | Add "Colaboradores" nav entry |
| `config/_default/menus.en.yaml` | Modify | Add "Contributors" nav entry |
| `static/admin/config.yml` | Modify | Add 9 social fields to authors collection; update instagram hint |
| `layouts/partials/extend-head.html` | Modify | Add author card CSS |
| `layouts/authors/list.html` | Create | Bio card grid layout |

---

### Task 1: EN authors section index

**Files:**
- Create: `content/authors/_index.en.md`

- [ ] **Step 1: Create the file**

```markdown
---
title: "Contributors"
---
```

- [ ] **Step 2: Verify build**

```bash
hugo 2>&1 | grep -i error
```

Expected: no output (zero errors).

- [ ] **Step 3: Commit**

```bash
git add content/authors/_index.en.md
git commit -m "content: add EN authors section index"
```

---

### Task 2: Navigation menu entries

**Files:**
- Modify: `config/_default/menus.pt.yaml`
- Modify: `config/_default/menus.en.yaml`

- [ ] **Step 1: Add PT menu entry**

Replace the entire contents of `config/_default/menus.pt.yaml` with:

```yaml
- name: Colaboradores
  url: /authors/
  weight: 30
```

- [ ] **Step 2: Add EN menu entry**

Replace the entire contents of `config/_default/menus.en.yaml` with:

```yaml
- name: Contributors
  url: /en/authors/
  weight: 30
```

- [ ] **Step 3: Verify build**

```bash
hugo 2>&1 | grep -i error
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add config/_default/menus.pt.yaml config/_default/menus.en.yaml
git commit -m "config: add Colaboradores/Contributors nav menu entries"
```

---

### Task 3: CMS social fields

**Files:**
- Modify: `static/admin/config.yml`

The `authors` collection currently has one social field (`instagram`) storing only the handle. Update it to store the full URL (consistent with all new fields), then add 9 new optional string fields.

- [ ] **Step 1: Update the instagram field and add 9 new social fields**

In `static/admin/config.yml`, find the `instagram` field in the `authors` collection (~line 180) and replace it with:

```yaml
      - label: Instagram
        name: instagram
        widget: string
        required: false
        hint: "URL completo do perfil (ex: https://instagram.com/musictide_pt)"

      - label: Facebook
        name: facebook
        widget: string
        required: false
        hint: "URL completo do perfil (ex: https://facebook.com/musictide)"

      - label: X / Twitter
        name: x_twitter
        widget: string
        required: false
        hint: "URL completo do perfil (ex: https://x.com/musictide)"

      - label: Bluesky
        name: bluesky
        widget: string
        required: false
        hint: "URL completo do perfil (ex: https://bsky.app/profile/musictide.bsky.social)"

      - label: Mastodon
        name: mastodon
        widget: string
        required: false
        hint: "URL completo do perfil (ex: https://mastodon.social/@musictide)"

      - label: Threads
        name: threads
        widget: string
        required: false
        hint: "URL completo do perfil (ex: https://www.threads.net/@musictide)"

      - label: TikTok
        name: tiktok
        widget: string
        required: false
        hint: "URL completo do perfil (ex: https://www.tiktok.com/@musictide)"

      - label: YouTube
        name: youtube
        widget: string
        required: false
        hint: "URL completo do canal (ex: https://youtube.com/@musictide)"

      - label: SoundCloud
        name: soundcloud
        widget: string
        required: false
        hint: "URL completo do perfil (ex: https://soundcloud.com/musictide)"

      - label: Spotify
        name: spotify
        widget: string
        required: false
        hint: "URL do perfil de artista ou playlist (ex: https://open.spotify.com/artist/...)"
```

- [ ] **Step 2: Verify YAML is valid**

```bash
python3 -c "import yaml; yaml.safe_load(open('static/admin/config.yml'))" && echo "YAML valid"
```

Expected: `YAML valid`

- [ ] **Step 3: Commit**

```bash
git add static/admin/config.yml
git commit -m "cms: add social network fields to authors collection"
```

---

### Task 4: Author card CSS

**Files:**
- Modify: `layouts/partials/extend-head.html`

Blowfish's Tailwind bundle is pre-compiled and PurgeCSS'd — utility classes not used elsewhere in the theme are stripped silently and produce no output. Author card layout styles go in `extend-head.html` as an inline `<style>` block, which is immune to PurgeCSS. This is the established pattern for gallery CSS in this project.

Blowfish color CSS custom properties use RGB triplet format: `--color-neutral-100` is defined as e.g. `31, 31, 31` and consumed as `rgb(var(--color-neutral-100))`. Do **not** use `var(--color-neutral-100)` directly in `style=""` HTML attributes — Hugo's template sanitizer blocks it (ZgotmplZ). Inside a `<style>` block there is no such restriction.

- [ ] **Step 1: Append author card CSS to extend-head.html**

At the very end of `layouts/partials/extend-head.html`, append:

```html
{{/* Author card grid */}}
<style>
  .author-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
    margin-top: 2rem;
  }
  @media (min-width: 768px) {
    .author-grid { grid-template-columns: repeat(2, 1fr); }
  }
  .author-card {
    display: flex;
    gap: 1rem;
    padding: 1.25rem;
    border-radius: 0.5rem;
    background-color: rgb(var(--color-neutral-100));
  }
  .dark .author-card {
    background-color: rgb(var(--color-neutral-800));
  }
  .author-photo {
    flex-shrink: 0;
    width: 5rem;
    height: 5rem;
    border-radius: 9999px;
    object-fit: cover;
  }
  .author-photo-placeholder {
    flex-shrink: 0;
    width: 5rem;
    height: 5rem;
    border-radius: 9999px;
    background-color: rgb(var(--color-neutral-300));
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    font-weight: 700;
    color: rgb(var(--color-neutral-600));
  }
  .dark .author-photo-placeholder {
    background-color: rgb(var(--color-neutral-600));
    color: rgb(var(--color-neutral-300));
  }
  .author-info {
    flex: 1;
    min-width: 0;
  }
  .author-name {
    font-size: 1.125rem;
    font-weight: 700;
    color: rgb(var(--color-neutral-900));
    margin: 0 0 0.25rem;
  }
  .dark .author-name {
    color: rgb(var(--color-neutral));
  }
  .author-bio {
    font-size: 0.875rem;
    color: rgb(var(--color-neutral-600));
    margin: 0 0 0.75rem;
    line-height: 1.5;
  }
  .dark .author-bio {
    color: rgb(var(--color-neutral-400));
  }
  .author-social {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    align-items: center;
  }
  .author-social a {
    color: rgb(var(--color-neutral-500));
    width: 1.25rem;
    height: 1.25rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s;
  }
  .author-social a:hover {
    color: rgb(var(--color-primary-500));
  }
  .dark .author-social a {
    color: rgb(var(--color-neutral-400));
  }
  .dark .author-social a:hover {
    color: rgb(var(--color-primary-400));
  }
  .author-social svg {
    width: 1.25rem;
    height: 1.25rem;
  }
</style>
```

- [ ] **Step 2: Verify build**

```bash
hugo 2>&1 | grep -i error
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add layouts/partials/extend-head.html
git commit -m "style: add author card CSS to extend-head"
```

---

### Task 5: Author list layout

**Files:**
- Create: `layouts/authors/list.html`

Hugo resolves `layouts/authors/list.html` for the `/authors/` section list page, overriding Blowfish's default (which renders a taxonomy term index — not what we want).

`.Plain` is used instead of `.Content` for the bio: the CMS stores author body as `widget: text` (plain text), but Hugo still runs it through the Markdown renderer wrapping it in `<p>` tags. `.Plain` gives the raw text so we control the markup. If the body is empty, `.Plain` is an empty string — the `{{ if .Plain }}` guard suppresses the element.

`{{ partial "icon.html" "x-twitter" }}` — note the hyphen, matching Blowfish's icon filename `x-twitter.svg`. The front matter key is `x_twitter` (underscore, valid YAML identifier); the icon key is `x-twitter` (hyphen, matching the filename). These are different and both correct.

- [ ] **Step 1: Create the layout**

```html
{{ define "main" }}
  <div class="max-w-7xl mx-auto">
    <h1 class="mt-8 mb-2 text-4xl font-extrabold text-neutral-900 dark:text-neutral">
      {{ .Title }}
    </h1>

    <div class="author-grid">
      {{ range .Pages }}
        <div class="author-card">

          {{/* Photo — use URL directly; R2 images are external and don't need Hugo processing */}}
          {{ if .Params.photo }}
            <img
              src="{{ .Params.photo }}"
              alt="{{ .Title }}"
              class="author-photo"
            />
          {{ else }}
            <div class="author-photo-placeholder">
              {{ substr .Title 0 1 | upper }}
            </div>
          {{ end }}

          {{/* Info */}}
          <div class="author-info">
            <p class="author-name">{{ .Title }}</p>

            {{ if .Plain }}
              <p class="author-bio">{{ .Plain }}</p>
            {{ end }}

            {{/* Social icons — each rendered only when field is non-empty */}}
            <div class="author-social">
              {{ with .Params.email }}
                <a href="mailto:{{ . }}" title="Email">
                  {{ partial "icon.html" "email" }}
                </a>
              {{ end }}
              {{ with .Params.instagram }}
                <a href="{{ . }}" target="_blank" rel="noopener noreferrer" title="Instagram">
                  {{ partial "icon.html" "instagram" }}
                </a>
              {{ end }}
              {{ with .Params.facebook }}
                <a href="{{ . }}" target="_blank" rel="noopener noreferrer" title="Facebook">
                  {{ partial "icon.html" "facebook" }}
                </a>
              {{ end }}
              {{ with .Params.x_twitter }}
                <a href="{{ . }}" target="_blank" rel="noopener noreferrer" title="X / Twitter">
                  {{ partial "icon.html" "x-twitter" }}
                </a>
              {{ end }}
              {{ with .Params.bluesky }}
                <a href="{{ . }}" target="_blank" rel="noopener noreferrer" title="Bluesky">
                  {{ partial "icon.html" "bluesky" }}
                </a>
              {{ end }}
              {{ with .Params.mastodon }}
                <a href="{{ . }}" target="_blank" rel="noopener noreferrer" title="Mastodon">
                  {{ partial "icon.html" "mastodon" }}
                </a>
              {{ end }}
              {{ with .Params.threads }}
                <a href="{{ . }}" target="_blank" rel="noopener noreferrer" title="Threads">
                  {{ partial "icon.html" "threads" }}
                </a>
              {{ end }}
              {{ with .Params.tiktok }}
                <a href="{{ . }}" target="_blank" rel="noopener noreferrer" title="TikTok">
                  {{ partial "icon.html" "tiktok" }}
                </a>
              {{ end }}
              {{ with .Params.youtube }}
                <a href="{{ . }}" target="_blank" rel="noopener noreferrer" title="YouTube">
                  {{ partial "icon.html" "youtube" }}
                </a>
              {{ end }}
              {{ with .Params.soundcloud }}
                <a href="{{ . }}" target="_blank" rel="noopener noreferrer" title="SoundCloud">
                  {{ partial "icon.html" "soundcloud" }}
                </a>
              {{ end }}
              {{ with .Params.spotify }}
                <a href="{{ . }}" target="_blank" rel="noopener noreferrer" title="Spotify">
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

- [ ] **Step 2: Verify build**

```bash
hugo 2>&1 | grep -i error
```

Expected: no output.

- [ ] **Step 3: Create a test author to verify the layout**

Create `content/authors/test-author.md` (delete this before the final commit):

```markdown
---
title: "Ana Ferreira"
email: "ana@example.com"
instagram: "https://instagram.com/anaferreira"
youtube: "https://youtube.com/@anaferreira"
draft: false
---

Fotógrafa de concertos desde 2012. Metal, punk, e tudo o que faz barulho.
```

- [ ] **Step 4: Start dev server and verify**

```bash
yarn watch
```

Navigate to `http://localhost:1313/authors/` and check:
- Page title "Colaboradores" is shown
- One card renders: initials placeholder "A" (no photo set), name, bio text, 3 icons (email, instagram, youtube)
- No icons for empty fields
- Card background contrasts with page background
- Nav shows "Colaboradores" link

Navigate to `http://localhost:1313/en/authors/`:
- Page title "Contributors" is shown
- Same card renders

- [ ] **Step 5: Visual verification with Playwright MCP**

Use the Playwright MCP browser integration to navigate to `http://localhost:1313/authors/` and take a screenshot. Verify:
- Horizontal card layout (photo left, info right)
- Icons row visible at bottom of info block
- Responsive: at mobile width, cards stack to single column

- [ ] **Step 6: Delete test author file**

```bash
rm content/authors/test-author.md
```

- [ ] **Step 7: Verify build is still clean**

```bash
hugo 2>&1 | grep -i error
```

Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add layouts/authors/list.html
git commit -m "feat: add authors list layout with bio cards and social icons"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Task |
|---|---|
| Single `/colaboradores/` listing page | Task 5 (layout) + Task 2 (nav) |
| Horizontal bio cards — photo left, text right | Task 5 |
| Photo fallback to initials placeholder | Task 5 |
| Social icons rendered only for non-empty fields | Task 5 (`{{ with }}` blocks) |
| 10 social networks + email as icons | Task 3 (CMS) + Task 5 (layout) |
| Update instagram hint to full URL format | Task 3 |
| Nav PT: "Colaboradores" → `/authors/` | Task 2 |
| Nav EN: "Contributors" → `/en/authors/` | Task 2 |
| EN `_index.en.md` with title "Contributors" | Task 1 |
| Author card CSS outside Tailwind bundle | Task 4 |
| External links: `target="_blank" rel="noopener noreferrer"` | Task 5 |
| Email as `mailto:` link | Task 5 |
| Verify build after each change | All tasks |

All spec requirements covered. No gaps.

### Placeholder scan

No TBDs, no "implement later", no vague steps. All code is shown in full.

### Name/type consistency

- `x_twitter` front matter key → `.Params.x_twitter` in template ✓
- `x-twitter` icon key (Blowfish filename `x-twitter.svg`) → `{{ partial "icon.html" "x-twitter" }}` ✓
- CSS class names defined in Task 4 and consumed in Task 5: `.author-grid`, `.author-card`, `.author-photo`, `.author-photo-placeholder`, `.author-info`, `.author-name`, `.author-bio`, `.author-social` — all consistent ✓
- All 10 social field names match between CMS config (Task 3) and layout template (Task 5) ✓
