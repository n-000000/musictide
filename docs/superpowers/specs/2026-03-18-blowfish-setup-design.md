# Design: Blowfish Hugo Site Setup

**Date:** 2026-03-18
**Repo:** codeberg.org/ngon/musictide
**Status:** Approved

## Summary

Scaffold a fresh Hugo site in `/home/n0xx/Code/infra/service/musictide` using Blowfish as the sole theme, installed as a Hugo module. No Hugolify, no vendor directory, no PostCSS pipeline.

## Goals

- Photography/video-emphasis editorial blog with rich HTML articles
- Sveltia CMS for non-technical editors (later phase)
- Free static hosting on Codeberg Pages or GitHub Pages
- Design-agnostic starting point (client hasn't decided on look yet)
- Ads collection interleaved into listing pages via client-side JS (later phase)

## Stack

- **Hugo Extended ≥ 0.141.0** (required by Blowfish)
- **Blowfish** theme (MIT, actively maintained, Tailwind-based, ships gallery/carousel/video shortcodes)
- **Blowfish installed as Hugo module** — `github.com/nunocoracao/blowfish/v2`, updated with `hugo mod get -u`
- **Sveltia CMS** — Git-backed CMS frontend, added in a later phase

## What Gets Built

### Hugo scaffold

```bash
hugo new site . --force --format yaml
```

Run inside the repo root. The `--format yaml` flag ensures all generated config files use YAML (not the default TOML in recent Hugo versions). The auto-generated `themes/` dir and any overwritten `.gitignore` should be reviewed after scaffolding. `README.md` from Codeberg should be preserved.

### Hugo module init

```bash
hugo mod init codeberg.org/ngon/musictide
```

### Config structure

`config/_default/` split — all YAML:

**`module.yaml`**
```yaml
imports:
  - path: github.com/nunocoracao/blowfish/v2
```

**`hugo.yaml`** — core Hugo settings:
```yaml
defaultContentLanguage: pt
enableRobotsTXT: true
module:
  hugoVersion:
    min: "0.141.0"
    extended: true
outputs:
  home:
    - HTML
    - RSS
    - JSON
```
The `outputs.home` JSON entry is required by Blowfish for search and JS features.

Two language files — `pt` is the primary language, `en` is secondary:

**`languages.pt.yaml`**
```yaml
locale: pt-PT
languageName: Português
weight: 1
title: Musictide
params:
  isoCode: pt-PT
  displayName: PT
  rtl: false
  dateFormat: "2 January 2006"
```

**`languages.en.yaml`**
```yaml
locale: en-GB
languageName: English
weight: 2
title: Musictide
params:
  isoCode: en-GB
  displayName: EN
  rtl: false
  dateFormat: "2 January 2006"
```

`params.isoCode` is required by Blowfish for HTML `lang` attribute and OpenGraph `og:locale` output.

Corresponding menu files: `menus.pt.yaml` and `menus.en.yaml` (both can be empty stubs at scaffold time).

**`menus.en.yaml`** — Blowfish requires this file (one per language) for header/footer navigation. Can be empty or stub-commented at scaffold time, but must exist.

**`params.yaml`** — Blowfish theme params (colorScheme, homepage layout, etc.):
Copied from `$GOPATH/pkg/mod/github.com/nunocoracao/blowfish/v2@.../config/_default/params.toml` after `hugo mod tidy` fetches the module, then trimmed to the subset being actively configured.

**`markup.yaml`** — required by Blowfish for correct goldmark/highlight behaviour:
Copied verbatim from the theme's own `config/_default/markup.toml` (converted to YAML) after the module is fetched.

No `social.yaml`, `privacy.yaml`, `services.yaml`, `taxonomies.yaml`, or `permalinks.yaml` until actually needed.

### Content

Single `content/_index.md` with minimal frontmatter to verify home page renders.

### package.json

Minimal scripts, no PostCSS/PurgeCSS devDependencies:

```json
{
  "scripts": {
    "watch": "hugo server",
    "build": "hugo --gc --minify",
    "update": "hugo mod get -u && hugo mod tidy"
  }
}
```

### Acceptance criterion

`yarn watch` serves the Blowfish default home page with zero errors and zero warnings.

## Out of Scope (Later Phases)

- **Sveltia CMS** integration and content schema definition
- Custom layouts / template overrides
- Ads collection and interleaving logic
- Final design / color scheme (pending client input)
- **Codeberg Pages deployment:** Codeberg Pages requires either Woodpecker CI pushing the `public/` build output to a `pages` branch, or a dedicated repo named `pages`. A plain `yarn build` producing `public/` is not sufficient — a CI pipeline must be configured separately.
