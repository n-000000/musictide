# Biografias + Utilizadores Unification Design

**Goal:** Replace the "Colaboradores" CMS collection with "Biografias" and add an optional link from Utilizadores to a Biografia entry — keeping auth data and public profile data in separate collections with zero overlap.

**Architecture:** Config-only change. No fork build, no Worker changes, no file migration. Two collections remain; their relationship is made explicit via a relation field in Utilizadores.

---

## Background

Two CMS collections currently manage overlapping concerns:

| Collection | Label | Folder | Purpose |
|---|---|---|---|
| `authors` | Colaboradores | `content/authors/` | Public contributor profiles (photo, bio, social links) |
| `cms-users` | Utilizadores | `data/cms-users/` | CMS auth accounts (email, token for Worker lookup) |

**The problem:** Some CMS users are not public contributors (e.g., site admins). Merging both into a single collection would expose auth accounts as public Hugo pages and mix auth data with public content.

**The solution:** Keep two collections. Make the relationship between them explicit by adding an optional `biography` relation field to Utilizadores.

---

## What Changes

### 1. Rename "Colaboradores" → "Biografias"

In `static/admin/config.yml`, change the `authors` collection labels only:

```yaml
# BEFORE
- name: authors
  label: Colaboradores
  label_singular: Colaborador

# AFTER
- name: authors
  label: Biografias
  label_singular: Biografia
```

Everything else in the `authors` collection is unchanged: folder, fields, field names, YAML keys. Hugo templates, article relation fields, and existing `.md` files are unaffected.

### 2. Add `biography` relation field to Utilizadores

In `static/admin/config.yml`, add one new field to the `cms-users` collection:

```yaml
- label: Biografia
  name: biography
  widget: relation
  collection: authors
  search_fields: [title]
  value_field: "{{slug}}"
  display_fields: [title]
  required: false
  hint: "Perfil público associado a esta conta (se existir). Deixar vazio para utilizadores sem perfil público."
```

Place it after the `token` field. The stored value is the Biografia file slug (e.g., `nuno`, `carlos-tavares`) — stable even if the public name is later edited.

`inline_create` is deliberately omitted (defaults to `false`). To link a Utilizador to a Biografia, the Biografia must be created first.

---

## What Does NOT Change

- `data/cms-users/*.json` file format and existing field names (`name`, `email`, `token`)
- Auth Worker (`musictide-auth`) — reads same field names as before
- Commit author monkey-patch in `index.html` — reads `name`, unchanged
- preSave hook — reads `email` and writes `token`, unchanged
- `content/authors/*.md` files — untouched, no new fields required
- Article relation fields — still `collection: authors, value_field: title`
- Hugo templates — no changes

---

## Result

**A CMS user who is also a contributor:**
- Has an entry in Utilizadores (auth access)
- Has an entry in Biografias (public profile)
- Utilizadores entry has `biography: nuno` linking to the Biografia

**A CMS user who is admin-only (not a public contributor):**
- Has an entry in Utilizadores
- `biography` field left blank
- No public Hugo page is generated for them

**A contributor without CMS access:**
- Has an entry in Biografias only
- No Utilizadores entry

---

## Migration

No file migration needed. Existing `data/cms-users/*.json` files continue to work without changes — the new `biography` field is optional and defaults to absent.

Optionally, after deployment, open each Utilizador in the CMS and select their matching Biografia from the dropdown. This is a manual UX step, not a data migration requirement.

---

## Out of Scope

- Renaming `name` → `user` in Utilizadores (deferred — requires Worker + monkey-patch changes)
- Renaming `email` → `auth_email` / `token` → `auth_token` (deferred)
- Inline creation of Biografias from within the Utilizadores form (deferred)
- Public author listing pages (`/authors/`) — Hugo generates these from `content/authors/` as before; no change in behavior
