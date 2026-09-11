#!/usr/bin/env bash
# Publish dist/ to the gh-pages branch and point GitHub Pages at the custom
# domain. Idempotent: safe to re-run after every build.
#
# Requires a GitHub token with, on bbbbz14/snapboard:
#   Contents: Read and write   (push main and gh-pages)
#   Pages:    Read and write   (create the Pages site, set the custom domain)
set -euo pipefail

REPO=bbbbz14/snapboard
DOMAIN=snapboard.kaomatumaraiwa.com
BRANCH=gh-pages
WORKTREE=$(mktemp -d)

npm run build

# The custom domain lives in the published branch, not in public/, so a plain
# `npm run build` never needs to know about deployment.
cp -R dist/. "$WORKTREE/"
printf '%s\n' "$DOMAIN" > "$WORKTREE/CNAME"
# Pages would otherwise run the output through Jekyll and drop _headers.
touch "$WORKTREE/.nojekyll"

git -C "$WORKTREE" init -q -b "$BRANCH"
git -C "$WORKTREE" add -A
git -C "$WORKTREE" commit -q -m "Deploy $(git rev-parse --short HEAD)"
git -C "$WORKTREE" push -q --force "https://github.com/$REPO.git" "$BRANCH:$BRANCH"
rm -rf "$WORKTREE"

# Create the site on first run; afterwards just keep the domain in sync.
# Both payloads go in as JSON because the source field is nested. Pushing a
# gh-pages branch can enable Pages on its own, so 409 here means "already
# done", not a failure.
if ! gh api "repos/$REPO/pages" >/dev/null 2>&1; then
  printf '{"source":{"branch":"%s","path":"/"}}' "$BRANCH" \
    | gh api -X POST "repos/$REPO/pages" --input - >/dev/null \
    || gh api "repos/$REPO/pages" >/dev/null
fi
printf '{"cname":"%s"}' "$DOMAIN" | gh api -X PUT "repos/$REPO/pages" --input -
# Enforcing HTTPS only works once GitHub has issued the certificate, which
# needs the DNS record to resolve first. Failing here is expected on day one.
printf '{"https_enforced":true}' | gh api -X PUT "repos/$REPO/pages" --input - \
  || echo "HTTPS not enforceable yet - re-run this script after DNS resolves."

echo "Published. Add this DNS record at the registrar, then wait for it:"
echo "  CNAME  snapboard  ->  bbbbz14.github.io"
echo "Live at https://$DOMAIN (and meanwhile at https://bbbbz14.github.io/snapboard/)"
