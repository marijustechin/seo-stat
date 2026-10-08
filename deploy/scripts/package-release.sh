#!/usr/bin/env bash
# Build a deployment tarball for the current commit. Run on CI after a full
# build (apps/web/.next and apps/api/dist must exist).
set -euo pipefail

sha="$(git rev-parse HEAD)"
out="seo-stat-deploy-${sha}.tar.gz"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

printf '%s\n' "$sha" > RELEASE_SHA
# Write the archive outside the tree so it is never archived while being written.
tar --warning=no-file-changed -czf "$tmp/$out" \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.next/cache' \
  --exclude='coverage' \
  --exclude='*.tsbuildinfo' \
  .
rm -f RELEASE_SHA
mv "$tmp/$out" "$out"
printf 'created %s (%s)\n' "$out" "$(du -h "$out" | cut -f1)"
