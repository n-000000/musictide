#!/usr/bin/env bash
# Re-pin musictide to the current blowfish fork HEAD, then push (Pages deploys).
#
# Replaces the old ~7-min dance: the slow part was `GOPROXY=direct go list`,
# which git-fetched the whole 539MB fork just to compute a version string.
# That string is pure git metadata, so we derive it locally with zero network.
# Run this AFTER you've committed + pushed the fork.
#
# ponytail: assumes the theme is consumed as a Hugo module pinned by commit.
#           If the two-repo split is ever collapsed (themes/ dir or submodule),
#           delete this script — the whole pin step disappears with it.
set -euo pipefail

FORK="${FORK:-/home/n0xx/Code/infra/service/blowfish}"
MOD="github.com/n-000000/blowfish/v2"
BRANCH="musictide-patches"
MUSICTIDE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 1. Fork must be pushed — Pages resolves the pin from GitHub, not your disk.
fork_head=$(git -C "$FORK" rev-parse HEAD)
if [ "$fork_head" != "$(git -C "$FORK" rev-parse "origin/$BRANCH")" ]; then
  echo "✗ fork HEAD $(git -C "$FORK" rev-parse --short HEAD) is not pushed to origin/$BRANCH."
  echo "  Run: git -C $FORK push origin $BRANCH"
  exit 1
fi

# 2. Derive the Go pseudo-version from git (no fetch).
#    base = most-recent reachable tag with its patch bumped + '-0' (Go's rule),
#    e.g. v2.103.0 -> v2.103.1-0 ; full -> v2.103.1-0.<utc-ts>-<12-char-sha>.
ts=$(TZ=UTC git -C "$FORK" show -s --date=format-local:%Y%m%d%H%M%S --format=%cd "$fork_head")
short=$(echo "$fork_head" | cut -c1-12)
base=$(git -C "$FORK" describe --tags --abbrev=0 "$fork_head" \
        | awk -F. '{printf "%s.%s.%d-0", $1, $2, $3 + 1}')
ver="${base}.${ts}-${short}"
echo "→ pinning $MOD@$ver"

cd "$MUSICTIDE"
if grep -q "$MOD $ver" go.mod; then echo "already pinned; nothing to do."; exit 0; fi

# 3. Bump go.mod; refresh go.sum via the PROXY (cached/fast, not the 539MB direct).
sed -i -E "s#($MOD )v[0-9][^ ]*#\1$ver#" go.mod
go mod download "$MOD"   # writes go.sum entry; fails loudly if the commit isn't fetchable yet

# 4. Commit + push both remotes (origin = GitHub triggers the Cloudflare Pages build).
git commit -q go.mod go.sum -m "chore(deps): pin blowfish fork ${short:0:7} ($ver)"
for r in origin codeberg; do git push "$r" main; done
echo "✓ pinned + pushed. Cloudflare Pages will build from origin/main."
