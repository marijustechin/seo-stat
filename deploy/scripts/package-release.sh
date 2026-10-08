#!/usr/bin/env bash
# Build a deployment tarball for the current commit. Run on CI after a full
# build (apps/web/.next and apps/api/dist must exist).
set -euo pipefail

sha="$(git rev-parse HEAD)"
out="seo-stat-deploy-${sha}.tar.gz"
printf '%s\n' "$sha" > RELEASE_SHA

tar czf "$out" \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.next/cache' \
  --exclude='coverage' \
  --exclude='*.tsbuildinfo' \
  .

rm -f RELEASE_SHA
printf 'created %s (%s)\n' "$out" "$(du -h "$out" | cut -f1)"
