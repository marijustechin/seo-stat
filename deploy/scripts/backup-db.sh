#!/usr/bin/env bash
# Pre-migration PostgreSQL backup (pg_dump | gzip). The URL is never printed.
set -euo pipefail

ROOT="${SEO_STAT_ROOT:-/srv/seo-stat}"

if [ -z "${DATABASE_URL:-}" ] && [ -r "$ROOT/config/api.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/config/api.env"
  set +a
fi
: "${DATABASE_URL:?DATABASE_URL is required}"

mkdir -p "$ROOT/backups"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
out="$ROOT/backups/seo_stat-${stamp}.sql.gz"
# psql/pg_dump do not understand Prisma's ?schema=... query parameter.
db_url="${DATABASE_URL%%\?*}"
pg_dump "$db_url" | gzip > "$out"
printf 'backup written: %s\n' "$out"
