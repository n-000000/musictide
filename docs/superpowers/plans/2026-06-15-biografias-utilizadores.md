# Biografias / Utilizadores Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename "Colaboradores" to "Biografias" in the CMS and add an optional biography relation field to the Utilizadores collection.

**Architecture:** Config-only change to a single YAML file (`musictide/static/admin/config.yml`). No fork build, no Worker changes, no file migration. Two tasks: label rename, then new field. Verification via Playwright at `http://localhost:1313/admin/`.

**Tech Stack:** Sveltia CMS YAML config, Hugo, Playwright MCP.

**Spec:** `docs/superpowers/specs/2026-06-15-biografias-utilizadores-design.md`

---

## File Map

| File | Change |
|------|--------|
| `static/admin/config.yml` | Lines 232–233: rename labels. Lines 458–463: add `biography` field after `token`. |

---

## Task 1 — Rename Colaboradores → Biografias

**Files:**
- Modify: `static/admin/config.yml:232-233`

No test to write — this is a YAML label change verified visually.

- [ ] **Step 1: Edit the labels**

In `/home/n0xx/Code/infra/service/musictide/static/admin/config.yml`, find the `authors` collection header (around line 230):

```yaml
# BEFORE
  # ── COLABORADORES ─────────────────────────────────────────────
  - name: authors
    label: Colaboradores
    label_singular: Colaborador
    folder: content/authors

# AFTER
  # ── BIOGRAFIAS ────────────────────────────────────────────────
  - name: authors
    label: Biografias
    label_singular: Biografia
    folder: content/authors
```

- [ ] **Step 2: Verify config syntax**

```bash
cd /home/n0xx/Code/infra/service/musictide
python3 -c "import yaml; yaml.safe_load(open('static/admin/config.yml'))" && echo "YAML OK"
```

Expected output: `YAML OK`

- [ ] **Step 3: Verify in browser**

Start Hugo if not running:
```bash
cd /home/n0xx/Code/infra/service/musictide
yarn watch &
```

Open `http://localhost:1313/admin/` in Playwright. After sign-in, confirm the sidebar shows "Biografias" where "Colaboradores" used to appear. Confirm clicking it lists the existing author entries (Alexandre Marques, Nuno, etc.).

- [ ] **Step 4: Commit**

```bash
cd /home/n0xx/Code/infra/service/musictide
git add static/admin/config.yml
git commit -m "feat(cms): rename Colaboradores → Biografias"
git push origin main
```

---

## Task 2 — Add biography relation field to Utilizadores

**Files:**
- Modify: `static/admin/config.yml:458-463`

- [ ] **Step 1: Add the field**

In `/home/n0xx/Code/infra/service/musictide/static/admin/config.yml`, find the end of the `cms-users` fields block (around line 458). The current last field is `token`:

```yaml
      - label: Token
        name: token
        widget: string
        required: false
        readonly: true
        hint: "Preenchido automaticamente ao guardar. Não editar manualmente."
```

Add the `biography` field immediately after it:

```yaml
      - label: Token
        name: token
        widget: string
        required: false
        readonly: true
        hint: "Preenchido automaticamente ao guardar. Não editar manualmente."

      - label: Biografia
        name: biography
        widget: relation
        collection: authors
        search_fields: [title]
        value_field: title
        display_fields: [title]
        dropdown_threshold: 0
        required: false
        hint: "Perfil público associado a esta conta. Deixar vazio para utilizadores sem perfil público."
```

- [ ] **Step 2: Verify config syntax**

```bash
cd /home/n0xx/Code/infra/service/musictide
python3 -c "import yaml; yaml.safe_load(open('static/admin/config.yml'))" && echo "YAML OK"
```

Expected output: `YAML OK`

- [ ] **Step 3: Verify in browser**

Open `http://localhost:1313/admin/` in Playwright. Navigate to Utilizadores and open any existing entry (e.g., `ngon` or `david`). Confirm:

1. A "Biografia" dropdown field appears below the Token field.
2. Clicking the dropdown shows existing Biografias entries (Nuno, Alexandre Marques, etc.) in the list.
3. Selecting an entry saves correctly — re-open the entry and confirm the value persists.
4. The field can be left blank (not required) — create a test entry with no Biografia selected and confirm it saves without error.

Take a screenshot.

- [ ] **Step 4: Commit and push**

```bash
cd /home/n0xx/Code/infra/service/musictide
git add static/admin/config.yml
git commit -m "feat(cms): add biography relation field to Utilizadores"
git push origin main
```

---

## Post-implementation

- [ ] **Update CLAUDE.md backlog**

In `/home/n0xx/Code/infra/service/sveltia-cms/CLAUDE.md`, change the Unify row:

```
| Unify "Colaboradores" and "Utilizadores" collections into Sveltia | pending | — |
```

to:

```
| Unify "Colaboradores" and "Utilizadores" collections into Sveltia | ✅ done | musictide <commit-hash> |
```

Commit and push sveltia-cms.
