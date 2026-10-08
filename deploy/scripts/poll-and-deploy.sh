#!/usr/bin/env bash
# Poll the GitHub Actions API for the latest successful main-branch build and
# deploy its artifact. Runs from the systemd user timer.
#
# Never deploys failed/in-progress builds, pull-request artifacts, or a moving
# branch reference (the artifact is tied to an immutable commit SHA).
set -euo pipefail

ROOT="${SEO_STAT_ROOT:-/srv/seo-stat}"
REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
WORKFLOW_FILE="${GITHUB_WORKFLOW_FILE:-harness.yml}"
BRANCH="${GITHUB_BRANCH:-main}"
API="${GITHUB_API:-https://api.github.com}"
TOKEN_FILE="${GITHUB_TOKEN_FILE:-$ROOT/config/github.token}"

log() { printf '%s %s\n' "$(date -Is)" "$*"; }

[ -r "$TOKEN_FILE" ] || { log "no readable token at $TOKEN_FILE; skipping"; exit 0; }
token="$(cat "$TOKEN_FILE")"
auth="Authorization: Bearer $token"
accept="Accept: application/vnd.github+json"

api_get() { curl -fsS -H "$auth" -H "$accept" -H 'X-GitHub-Api-Version: 2022-11-28' "$1"; }

json_field() {
  # json_field <json> <node-snippet-producing-value>
  node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write(String((function(){'"$2"'})()??""))}catch{process.stdout.write("")}})'
}

runs="$(api_get "$API/repos/$REPO/actions/workflows/$WORKFLOW_FILE/runs?branch=$BRANCH&status=success&event=push&per_page=10" 2>/dev/null || true)"
[ -n "$runs" ] || { log "GitHub API unavailable; will retry next cycle"; exit 0; }

run_id="$(printf '%s' "$runs" | json_field 'const r=(j.workflow_runs||[])[0]; return r?r.id:"";')"
run_sha="$(printf '%s' "$runs" | json_field 'const r=(j.workflow_runs||[])[0]; return r?r.head_sha:"";')"
[ -n "$run_id" ] && [ -n "$run_sha" ] || { log "no successful main run found"; exit 0; }

if [ -L "$ROOT/current" ] && [ "$(basename "$(readlink -f "$ROOT/current")")" = "$run_sha" ]; then
  log "already deployed $run_sha; nothing to do"
  exit 0
fi

arts="$(api_get "$API/repos/$REPO/actions/runs/$run_id/artifacts" 2>/dev/null || true)"
expected="seo-stat-deploy-$run_sha"
art_id="$(printf '%s' "$arts" | json_field 'const a=(j.artifacts||[]).find(x=>x.name==="'"$expected"'"); return a?a.id:"";')"
[ -n "$art_id" ] || { log "artifact $expected not found for run $run_id; skipping"; exit 0; }

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
log "downloading artifact $expected"
curl -fsSL -H "$auth" -H 'X-GitHub-Api-Version: 2022-11-28' \
  "$API/repos/$REPO/actions/artifacts/$art_id/zip" -o "$tmp/artifact.zip" || { log "download failed"; exit 0; }

if command -v unzip >/dev/null 2>&1; then
  unzip -q "$tmp/artifact.zip" -d "$tmp/zip"
elif command -v python3 >/dev/null 2>&1; then
  python3 -m zipfile -e "$tmp/artifact.zip" "$tmp/zip"
else
  log "no unzip or python3 available to extract the artifact"; exit 1
fi

tarball="$(find "$tmp/zip" -name 'seo-stat-deploy-*.tar.gz' | head -1)"
[ -n "$tarball" ] || { log "artifact does not contain a release tarball"; exit 1; }

release_dir="$ROOT/releases/$run_sha"
rm -rf "$release_dir"
mkdir -p "$release_dir"
tar xzf "$tarball" -C "$release_dir"

embedded="$(cat "$release_dir/RELEASE_SHA" 2>/dev/null || true)"
[ "$embedded" = "$run_sha" ] || { log "SHA mismatch: embedded=$embedded expected=$run_sha"; exit 1; }

log "deploying $run_sha"
exec "$ROOT/scripts/deploy.sh" "$release_dir"
