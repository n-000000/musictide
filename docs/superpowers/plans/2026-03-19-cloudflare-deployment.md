# Cloudflare Pages + R2 Deployment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **⚠️ Note for agentic workers:** Tasks 1, 3, and 4 contain manual steps that require a human at a browser. Implement code changes and verification steps only; flag manual steps for human action.

**Goal:** Move the musictide git primary remote to GitHub and wire up Cloudflare Pages (auto-build on push) + Cloudflare R2 (media storage, 10GB free) so that pushing to `main` deploys the site live within ~30 seconds.

**Architecture:** GitHub is the source-of-truth git remote. Cloudflare Pages connects to GitHub via OAuth, runs `hugo --gc --minify` on every push to `main`, and deploys `public/` to Cloudflare's global CDN. Media (photos, video) live in an R2 bucket with public read access — not in git. Codeberg stays as a passive manual backup mirror.

**Tech Stack:** Hugo 0.158.0 Extended, Blowfish v2 (Go module), Cloudflare Pages (free), Cloudflare R2 (10GB free tier), GitHub (public repo)

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `config/_default/hugo.yaml` | Modify line 1 | `baseURL` → `https://musictide.pages.dev/` |
| `config/_default/params.yaml` | Modify | Add `mediaBaseURL: https://pub-<hash>.r2.dev` at top |
| `package.json` | Modify | Add `"mirror": "git push codeberg main"` to scripts |

No new files. No `wrangler.toml` needed — Cloudflare Pages is configured entirely in the dashboard for Git-connected projects.

---

## Task 1: Create GitHub Repo + Migrate Primary Remote

**Files:** none (git config only)

This task rewires `origin` from Codeberg to GitHub. After this task, `git push origin main` targets GitHub.

- [ ] **Step 1.1: Create the GitHub repo** *(manual — browser)*

  Go to https://github.com/new and create a repo:
  - Name: `musictide`
  - Visibility: **Public**
  - Do NOT initialise with README, .gitignore, or licence (the repo already has all of these)

  Note the SSH URL shown on the next screen: `git@github.com:<your-username>/musictide.git`

- [ ] **Step 1.2: Rename the current origin remote to `codeberg`**

  ```bash
  cd /home/n0xx/Code/infra/service/musictide
  git remote rename origin codeberg
  ```

  Verify:
  ```bash
  git remote -v
  ```

  Expected:
  ```
  codeberg  ssh://git@codeberg.org/ngon/musictide.git (fetch)
  codeberg  ssh://git@codeberg.org/ngon/musictide.git (push)
  ```

- [ ] **Step 1.3: Add GitHub as `origin`**

  ```bash
  git remote add origin git@github.com:<your-username>/musictide.git
  ```

  Replace `<your-username>` with your actual GitHub username.

- [ ] **Step 1.4: Push all history to GitHub**

  ```bash
  git push -u origin main
  ```

  Expected: GitHub accepts the push and reports all commits uploaded.

- [ ] **Step 1.5: Verify both remotes work**

  ```bash
  git remote -v
  ```

  Expected:
  ```
  codeberg  ssh://git@codeberg.org/ngon/musictide.git (fetch)
  codeberg  ssh://git@codeberg.org/ngon/musictide.git (push)
  origin    git@github.com:<your-username>/musictide.git (fetch)
  origin    git@github.com:<your-username>/musictide.git (push)
  ```

---

## Task 2: Update `baseURL` for Cloudflare Pages

**Files:**
- Modify: `config/_default/hugo.yaml` (line 1)

The current `baseURL` points at Codeberg Pages. It must point at the Cloudflare Pages URL before the first Pages build, otherwise Hugo generates incorrect canonical links, sitemap URLs, and RSS feed URLs.

The Cloudflare Pages URL will be `https://musictide.pages.dev/` — this is the URL Cloudflare assigns when the project is named `musictide` in the next task. We set it here in advance.

- [ ] **Step 2.1: Update `baseURL` in `config/_default/hugo.yaml`**

  Change line 1 from:
  ```yaml
  baseURL: https://musictide.codeberg.page/
  ```
  To:
  ```yaml
  baseURL: https://musictide.pages.dev/
  ```

  The rest of the file is unchanged.

- [ ] **Step 2.2: Verify the build still passes locally**

  ```bash
  cd /home/n0xx/Code/infra/service/musictide
  hugo 2>&1
  ```

  Expected: zero `ERROR` lines, 15 PT pages + 13 EN pages built. (`hugo` with no subcommand is the build command — `hugo build` does not exist.)

- [ ] **Step 2.3: Commit and push**

  ```bash
  git add config/_default/hugo.yaml
  git commit -m "chore: update baseURL to cloudflare pages"
  git push origin main
  ```

---

## Task 3: Set Up Cloudflare Pages Project

**Files:** none (dashboard configuration)

This task connects GitHub to Cloudflare Pages and triggers the first build. The Hugo version must be pinned via an environment variable — it cannot be set via a file in the repo.

- [ ] **Step 3.1: Log in to Cloudflare** *(manual — browser)*

  Go to https://dash.cloudflare.com and log in.

- [ ] **Step 3.2: Create a new Pages project** *(manual — browser)*

  Navigate to: **Workers & Pages → Pages → Create a project → Connect to Git**

  - Authorise Cloudflare to access your GitHub account if prompted
  - Select the `musictide` repository
  - Branch to deploy: `main`

- [ ] **Step 3.3: Configure build settings** *(manual — browser)*

  On the "Set up builds and deployments" screen, set:

  | Setting | Value |
  |---------|-------|
  | Project name | `musictide` |
  | Production branch | `main` |
  | Build command | `hugo --gc --minify` |
  | Build output directory | `public` |
  | Root directory | `/` (leave blank or set to `/`) |

- [ ] **Step 3.4: Set Hugo version environment variable** *(manual — browser)*

  Still on the same screen, expand **Environment variables (advanced)** and add:

  | Variable name | Value | Environment |
  |---------------|-------|-------------|
  | `HUGO_VERSION` | `0.158.0` | Production |

  **This is critical.** Without it, Cloudflare uses an old Hugo version that will fail to build Blowfish.

- [ ] **Step 3.5: Save and deploy** *(manual — browser)*

  Click **Save and Deploy**. Cloudflare will trigger the first build immediately.

- [ ] **Step 3.6: Monitor the first build** *(manual — browser)*

  Watch the build log in the Cloudflare dashboard. Expected output (abridged):

  ```
  Installing Hugo 0.158.0
  ...
  Start building sites …
  Pages │ 15 │ 13
  Total in ~30s
  ```

  Zero `ERROR` lines. If the build fails, check:
  - `HUGO_VERSION` is set correctly (not `v0.158.0` — just `0.158.0`)
  - Build command is exactly `hugo --gc --minify`
  - Output directory is exactly `public`

- [ ] **Step 3.7: Verify the live URL**

  ```bash
  curl -I https://musictide.pages.dev/
  ```

  Expected: `HTTP/2 200`

  ```bash
  curl -I https://musictide.pages.dev/en/
  ```

  Expected: `HTTP/2 200`

  ```bash
  curl -I https://musictide.pages.dev/pt/
  ```

  Expected: `HTTP/2 404` — confirms `defaultContentLanguageInSubdir: false` is working (Portuguese is at `/`, not `/pt/`)

---

## Task 4: Create R2 Bucket + Enable Public Access

**Files:** none (dashboard configuration)

R2 public access must be explicitly enabled — it is off by default. Without it, the `pub-<hash>.r2.dev` URL does not exist and media will return 403.

- [ ] **Step 4.1: Create the R2 bucket** *(manual — browser)*

  In the Cloudflare dashboard: **R2 Object Storage → Create bucket**

  - Bucket name: `musictide-media`
  - Location: Default (Cloudflare picks the closest region)

- [ ] **Step 4.2: Enable public access** *(manual — browser)*

  After creation: **R2 → musictide-media → Settings → Public Access → Allow Access → Enable**

  Cloudflare will display a permanent public URL in the format:
  ```
  https://pub-<32-char-hash>.r2.dev
  ```

  **Record this URL.** It is needed in Task 5.

- [ ] **Step 4.3: Set CORS policy** *(manual — browser)*

  In **R2 → musictide-media → Settings → CORS Policy**, add:

  ```json
  [
    {
      "AllowedOrigins": ["https://musictide.pages.dev", "https://*.musictide.pages.dev", "http://localhost:1313"],
      "AllowedMethods": ["GET"],
      "AllowedHeaders": ["*"]
    }
  ]
  ```

  The `*.musictide.pages.dev` wildcard covers Cloudflare Pages preview deployments (created automatically for non-`main` branch pushes), so media will load correctly in preview URLs as well.

- [ ] **Step 4.4: Upload a test image and verify public access**

  Upload any small image (e.g., `test.jpg`) to the bucket via the dashboard drag-and-drop.

  Then verify it is publicly accessible:

  ```bash
  curl -I https://pub-<hash>.r2.dev/test.jpg
  ```

  Expected: `HTTP/2 200` with `content-type: image/jpeg`

  If you get 403: public access was not enabled correctly — repeat Step 4.2.

---

## Task 5: Wire `mediaBaseURL`, Mirror Script, and Full Verification

**Files:**
- Modify: `config/_default/params.yaml`
- Modify: `package.json`

**Prerequisite:** You must have the R2 public URL from Task 4 Step 4.2 before starting this task.

- [ ] **Step 5.1: Add `mediaBaseURL` to `config/_default/params.yaml`**

  The current file starts with `colorScheme: blowfish` on line 1. Insert `mediaBaseURL` as the new first line, followed by a blank line. The top of the file should look exactly like this after the edit:

  ```yaml
  mediaBaseURL: https://pub-<hash>.r2.dev

  colorScheme: blowfish
  defaultAppearance: light
  autoSwitchAppearance: true
  enableSearch: true
  enableCodeCopy: false
  ```

  Replace `pub-<hash>.r2.dev` with the actual URL recorded in Task 4 Step 4.2. Everything below `enableCodeCopy: false` is unchanged.

- [ ] **Step 5.2: Add `mirror` script to `package.json`**

  ```json
  {
    "name": "musictide",
    "version": "0.1.0",
    "private": true,
    "scripts": {
      "watch": "hugo server",
      "build": "hugo --gc --minify",
      "update": "hugo mod get -u && hugo mod tidy",
      "mirror": "git push codeberg main"
    }
  }
  ```

- [ ] **Step 5.3: Verify local build still passes**

  ```bash
  cd /home/n0xx/Code/infra/service/musictide
  hugo 2>&1
  ```

  Expected: zero `ERROR` lines.

- [ ] **Step 5.4: Commit and push to GitHub**

  ```bash
  git add config/_default/params.yaml package.json
  git commit -m "chore: wire R2 mediaBaseURL and codeberg mirror script"
  git push origin main
  ```

- [ ] **Step 5.5: Verify Cloudflare Pages picks up the push**

  In the Cloudflare dashboard (Pages → musictide → Deployments), confirm a new build was triggered within ~10 seconds of the push. It should complete successfully.

- [ ] **Step 5.6: Mirror to Codeberg**

  ```bash
  yarn mirror
  ```

  Expected: `git push codeberg main` completes without error.

- [ ] **Step 5.7: Final acceptance criteria verification**

  ```bash
  # AC1 + AC2: push triggers build (already verified in 5.5)

  # AC3: Portuguese home page at /, not /pt/
  curl -s -o /dev/null -w "%{http_code}" https://musictide.pages.dev/
  # Expected: 200

  curl -s -o /dev/null -w "%{http_code}" https://musictide.pages.dev/pt/
  # Expected: 404

  # AC4: English version at /en/
  curl -s -o /dev/null -w "%{http_code}" https://musictide.pages.dev/en/
  # Expected: 200

  # AC5: R2 test image publicly accessible
  curl -s -o /dev/null -w "%{http_code}" https://pub-<hash>.r2.dev/test.jpg
  # Expected: 200

  # AC6: mediaBaseURL is set (check the file)
  grep mediaBaseURL config/_default/params.yaml
  # Expected: mediaBaseURL: https://pub-<hash>.r2.dev

  # AC7: Codeberg mirror works
  git ls-remote codeberg main
  # Expected: same commit SHA as `git rev-parse HEAD`
  ```

  All 7 acceptance criteria pass → done.
