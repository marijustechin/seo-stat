#!/usr/bin/env bash
# Install the seo-stat systemd USER units and the deploy scripts. Run as
# seostat. Does not require sudo: everything stays under $HOME and /srv/seo-stat.
set -euo pipefail

deploy_dir="$(cd "$(dirname "$0")/.." && pwd)"
root="${SEO_STAT_ROOT:-/srv/seo-stat}"
unit_dir="$HOME/.config/systemd/user"

mkdir -p "$unit_dir" "$root/releases" "$root/state" "$root/backups" "$root/config" "$root/scripts" "$root/logs" "$root/data/content-images"

install -m 0644 "$deploy_dir/systemd/"*.service "$deploy_dir/systemd/"*.timer "$unit_dir/"
install -m 0755 "$deploy_dir/scripts/"*.sh "$root/scripts/"

if [ ! -f "$root/config/seo-stat.env" ]; then
  install -m 0644 "$deploy_dir/seo-stat.env.example" "$root/config/seo-stat.env"
fi
if [ ! -f "$root/config/api.env" ]; then
  install -m 0600 "$deploy_dir/api.env.example" "$root/config/api.env"
fi
if [ ! -f "$root/config/web.env" ]; then
  install -m 0644 "$deploy_dir/web.env.example" "$root/config/web.env"
fi

# Deployment-managed key for authenticated encryption of integration credentials.
integration_key="$root/config/integration.key"
if [ ! -s "$integration_key" ]; then
  head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' > "$integration_key"
  chmod 0600 "$integration_key"
  printf 'generated %s\n' "$integration_key"
fi
if [ -f "$root/config/api.env" ] && ! grep -q '^INTEGRATION_ENCRYPTION_KEY_FILE=' "$root/config/api.env"; then
  printf '%s\n' "INTEGRATION_ENCRYPTION_KEY_FILE=$integration_key" >> "$root/config/api.env"
fi

systemctl --user daemon-reload
systemctl --user enable seo-stat-api.service seo-stat-web.service
systemctl --user enable --now seo-stat-deploy.timer
printf 'installed user units; deploy timer enabled\n'
printf 'next: set the database password in %s/config/api.env and the GitHub token in %s/config/github.token\n' "$root" "$root"
