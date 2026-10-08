#!/usr/bin/env bash
# Deploy a prepared release directory and switch /srv/seo-stat/current.
#
# Serialized with flock. Records the deployed SHA, timestamps, outcome, and
# health-check results in the state file. On health-check failure it restores
# the previous application release (this does NOT reverse database migrations).
set -euo pipefail

ROOT="${SEO_STAT_ROOT:-/srv/seo-stat}"
BASE_PATH="${SEO_STAT_BASE_PATH:-/seo-stat}"
API_PORT="${API_PORT:-3011}"
PUBLIC_URL="${PUBLIC_URL:-https://192.168.8.50/seo-stat/}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
CACERT="${SEO_STAT_TLS_CACERT:-}"

release_dir="${1:?usage: deploy.sh <release_dir>}"
sha="$(cat "$release_dir/RELEASE_SHA" 2>/dev/null || basename "$release_dir")"

# Load the database URL for prisma generate/migrate. Never printed.
if [ -r "$ROOT/config/api.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/config/api.env"
  set +a
fi

log() { printf '%s %s\n' "$(date -Is)" "$*"; }
fail() { log "ERROR: $*"; exit 1; }

state_dir="$ROOT/state"
mkdir -p "$state_dir" "$ROOT/releases" "$ROOT/backups"
state_file="$state_dir/deploy-state.json"

exec 9>"$state_dir/deploy.lock"
flock 9

record() {
  # record <phase> <sha> <outcome> <detail>
  node - "$state_file" "$1" "$2" "$3" "$4" <<'NODE'
const fs = require('node:fs');
const [file, phase, sha, outcome, detail] = process.argv.slice(2);
let state = {};
try { state = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
state.phase = phase;
state.sha = sha;
state.outcome = outcome;
state.detail = detail;
state.updatedAt = new Date().toISOString();
if (phase === 'start') state.startedAt = state.updatedAt;
if (outcome === 'success') state.deployedAt = state.updatedAt;
fs.writeFileSync(file, JSON.stringify(state, null, 2) + '\n');
NODE
}

if [ -L "$ROOT/current" ] && [ "$(basename "$(readlink -f "$ROOT/current")")" = "$sha" ]; then
  log "release $sha already current; nothing to do"
  exit 0
fi

log "deploying $sha from $release_dir"
record start "$sha" in-progress "$release_dir"

cd "$release_dir"

log "installing dependencies"
pnpm install --frozen-lockfile --reporter=silent || fail "pnpm install failed"

log "generating Prisma client"
pnpm --filter @seo-stat/api exec prisma generate || fail "prisma generate failed"

migrations_dir="apps/api/prisma/migrations"
if [ -d "$migrations_dir" ] && [ -n "$(ls -A "$migrations_dir" 2>/dev/null)" ]; then
  log "backing up database before migrations"
  "$ROOT/scripts/backup-db.sh" || fail "pre-migration backup failed"
  log "applying prisma migrate deploy"
  pnpm --filter @seo-stat/api exec prisma migrate deploy || fail "prisma migrate deploy failed"
else
  log "no migrations to apply"
fi

previous="$(readlink -f "$ROOT/current" 2>/dev/null || true)"
log "switching current release"
ln -sfn "$release_dir" "$ROOT/current.tmp"
mv -Tf "$ROOT/current.tmp" "$ROOT/current"
if [ -n "$previous" ]; then
  ln -sfn "$previous" "$ROOT/previous.tmp"
  mv -Tf "$ROOT/previous.tmp" "$ROOT/previous"
fi

log "restarting services"
systemctl --user enable seo-stat-api.service seo-stat-web.service
systemctl --user restart seo-stat-api.service seo-stat-web.service

health_api() { curl -fsS "http://127.0.0.1:${API_PORT}${BASE_PATH}/api/health" >/dev/null 2>&1; }
health_web() {
  if [ -n "$CACERT" ] && [ -r "$CACERT" ]; then
    curl -fsS --cacert "$CACERT" -o /dev/null "$PUBLIC_URL"
  else
    curl -fsS -k -o /dev/null "$PUBLIC_URL"
  fi
}

healthy=0
for _ in $(seq 1 30); do
  if health_api && health_web; then
    healthy=1
    break
  fi
  sleep 2
done

if [ "$healthy" = "1" ]; then
  log "health checks passed"
  record verify "$sha" success "api + database healthy; https ui reachable"
  ls -1dt "$ROOT"/releases/*/ 2>/dev/null | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf
  exit 0
fi

log "health checks FAILED"
if [ -n "$previous" ] && [ -d "$previous" ]; then
  log "restoring previous application release $(basename "$previous")"
  ln -sfn "$previous" "$ROOT/current.tmp"
  mv -Tf "$ROOT/current.tmp" "$ROOT/current"
  systemctl --user restart seo-stat-api.service seo-stat-web.service || true
  record verify "$sha" failed "health check failed; restored $(basename "$previous") (database unchanged)"
else
  # No previous release to restore. Stop the services and clear `current` so a
  # later poll can retry this SHA once the cause is fixed (for example, after
  # the one-time database setup).
  log "no previous release; stopping services and clearing current for retry"
  systemctl --user stop seo-stat-api.service seo-stat-web.service || true
  rm -f "$ROOT/current"
  record verify "$sha" failed "health check failed; no previous release; cleared current for retry"
fi
exit 1
