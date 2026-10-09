#!/usr/bin/env bash
# One-time administrator bootstrap for seo-stat prerequisites that seostat
# cannot configure. Run as root:  sudo bash deploy/scripts/bootstrap-admin.sh
#
# Idempotent. It:
#   1. installs missing runtime tools (unzip)
#   2. creates the PostgreSQL role `seostat` and database `seo_stat`
#   3. writes /srv/seo-stat/config/api.env (mode 0600, owner seostat)
#   4. installs the nginx location include into the shared 192.168.8.50 site
#   5. enables lingering for the seostat user
#
# It does not print secrets and does not grant broad passwordless sudo.
set -euo pipefail

ROOT="${SEO_STAT_ROOT:-/srv/seo-stat}"
OWNER="${SEO_STAT_USER:-seostat}"
DB_NAME="${SEO_STAT_DB:-seo_stat}"
DB_USER="${SEO_STAT_DB_USER:-seostat}"
SITE_FILE="${SEO_STAT_NGINX_SITE:-/etc/nginx/sites-available/ai-sdr.conf}"
SNIPPET="/etc/nginx/snippets/seo-stat.locations.conf"

if [ "$(id -u)" -ne 0 ]; then
  echo "run as root (sudo)" >&2
  exit 1
fi

echo "== runtime tools =="
if ! command -v unzip >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y unzip
else
  echo "unzip present"
fi
command -v pg_dump >/dev/null 2>&1 || { echo "pg_dump missing; installing postgresql-client"; apt-get install -y postgresql-client; }
command -v flock >/dev/null 2>&1 || echo "warning: flock missing"

echo "== directories =="
install -d -o "$OWNER" -g "$OWNER" -m 0750 "$ROOT"
install -d -o "$OWNER" -g "$OWNER" -m 0750 "$ROOT"/{config,state,backups,releases,scripts,logs}
install -d -o "$OWNER" -g "$OWNER" -m 0750 "$ROOT/data" "$ROOT/data/content-images"

echo "== PostgreSQL role and database =="
api_env="$ROOT/config/api.env"
db_password=""
if [ -r "$api_env" ]; then
  db_password="$(sed -n 's#^DATABASE_URL=postgresql://[^:]*:\([^@]*\)@.*#\1#p' "$api_env" | head -1)"
fi
# Treat the shipped placeholder as "no password yet" so the first real run
# generates one instead of reusing the literal placeholder.
if [ -z "$db_password" ] || [ "$db_password" = "REPLACE_WITH_DB_PASSWORD" ]; then
  db_password="$(head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 28)"
fi

sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN;
  END IF;
END \$\$;
ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${db_password}';
SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec
SQL

integration_key="$ROOT/config/integration.key"
if [ ! -s "$integration_key" ]; then
  head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' > "$integration_key"
  echo "generated $integration_key"
fi
chown "$OWNER:$OWNER" "$integration_key"
chmod 0600 "$integration_key"

cat > "$api_env" <<EOF
DATABASE_URL=postgresql://${DB_USER}:${db_password}@127.0.0.1:5432/${DB_NAME}?schema=public
PORT=3011
NODE_ENV=production
# Deployment-managed key for authenticated encryption of integration credentials
# (WordPress Application Passwords). Lives outside the release directories.
INTEGRATION_ENCRYPTION_KEY_FILE=${ROOT}/config/integration.key
CONTENT_ASSET_DIR=${ROOT}/data/content-images
EOF
chown "$OWNER:$OWNER" "$api_env"
chmod 0600 "$api_env"
echo "wrote $api_env"

echo "== nginx integration =="
install -d /etc/nginx/snippets
cat > "$SNIPPET" <<'NGINX'
# Managed by seo-stat bootstrap-admin.sh. Included in the 192.168.8.50 site.
location /seo-stat/api/ {
    proxy_pass http://127.0.0.1:3011;
    proxy_http_version 1.1;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_connect_timeout 5s;
    proxy_read_timeout    120s;
}
location /seo-stat/ {
    proxy_pass http://127.0.0.1:3012;
    proxy_http_version 1.1;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host  $host;
    proxy_connect_timeout 5s;
    proxy_read_timeout    120s;
}
location = /seo-stat {
    return 301 /seo-stat/;
}
NGINX

if [ -f "$SITE_FILE" ] && ! grep -q 'seo-stat.locations.conf' "$SITE_FILE"; then
  cp "$SITE_FILE" "$SITE_FILE.bak.$(date +%s)"
  awk '
    /^[[:space:]]*# --- Shared local-server landing page/ && !done {
      print "    include /etc/nginx/snippets/seo-stat.locations.conf;";
      done = 1;
    }
    { print }
  ' "$SITE_FILE" > "$SITE_FILE.new"
  if grep -q 'seo-stat.locations.conf' "$SITE_FILE.new"; then
    mv "$SITE_FILE.new" "$SITE_FILE"
    echo "added include to $SITE_FILE"
  else
    rm -f "$SITE_FILE.new"
    echo "WARNING: could not find an insertion point in $SITE_FILE; add manually:"
    echo "    include $SNIPPET;"
  fi
elif [ -f "$SITE_FILE" ]; then
  echo "include already present in $SITE_FILE"
else
  echo "WARNING: $SITE_FILE not found; install the snippet and include manually"
fi

echo "== TLS =="
echo "seo-stat reuses the existing 192.168.8.50 certificate (no new cert created)."

echo "== linger =="
loginctl enable-linger "$OWNER" || true

echo "== validate nginx =="
if command -v nginx >/dev/null 2>&1; then
  nginx -t && systemctl reload nginx
fi

echo "bootstrap complete"
