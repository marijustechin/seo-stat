# Deployment

This is the authoritative deployment model. The stack is confirmed in
`AGENTS.md`; this document covers how builds reach the server and how to operate
them.

## Confirmed targets

- Public UI URL: https://192.168.8.50/seo-stat/
- Browser-facing API prefix: `/seo-stat/api/` on the same origin.
- Deployment user: `seostat` (systemd user services, no sudo required).
- API `127.0.0.1:3011`; web `127.0.0.1:3012`.

## Verified server facts (inspected over SSH as seostat)

- Ubuntu 26.04.1 LTS, x86_64, kernel 7.0.0-38.
- Node v24.20.0 and pnpm 11.26.0 already installed; corepack present.
- systemd 259 with lingering enabled for `seostat` (user services persist).
- Ports 3011 and 3012 are free. Existing listeners: PostgreSQL 5432, nginx 80/443,
  and another project on loopback 3000/3003.
- nginx is active with the `ai-sdr.conf` site owning `192.168.8.50` and TLS via
  `/etc/ssl/ai-sdr/ai-sdr.crt`; the `sites-enabled` directory is readable.
- PostgreSQL 18.6, cluster `18/main` online on `127.0.0.1:5432`.
- `seostat` has no sudo; `/srv/seo-stat` exists and is owned by `seostat`.
- Outbound HTTPS to `api.github.com` works (HTTP 200).

## Application topology

- Each release is extracted to `/srv/seo-stat/releases/<sha>/` (source + built
  `apps/web/.next` and `apps/api/dist`). Dependencies are installed in the
  release with `pnpm install --frozen-lockfile`.
- `/srv/seo-stat/current` is a symlink to the active release; `/srv/seo-stat/previous`
  points at the prior one.
- Persistent, non-release state lives outside releases:
  - `/srv/seo-stat/config/` - `seo-stat.env` (not secret), `api.env` (secret,
    mode 0600), `web.env`, `github.token` (secret, mode 0600).
  - `/srv/seo-stat/state/deploy-state.json` - deployed SHA, timestamps, outcome,
    and health-check result.
  - `/srv/seo-stat/backups/` - pre-migration database dumps.
- systemd user units (in `deploy/systemd/`): `seo-stat-api.service`,
  `seo-stat-web.service`, and the `seo-stat-deploy.service` + `.timer`.

## Automatic deployment

1. On a push to `main`, GitHub Actions (`/.github/workflows/harness.yml`) runs the
   harness and application jobs. On success it builds `seo-stat-deploy-<sha>.tar.gz`
   and uploads it as an artifact named `seo-stat-deploy-<sha>` (only for `main`
   pushes).
2. On the server, `seo-stat-deploy.timer` runs `deploy/scripts/poll-and-deploy.sh`
   every few minutes. It asks the GitHub Actions API for the latest successful
   `push` run on `main`, finds that run's artifact, verifies the artifact's
   `RELEASE_SHA` matches the run's commit, and deploys it.
3. `deploy/scripts/deploy.sh` is serialized with `flock`; it is idempotent (a SHA
   already at `current` is skipped) and always deploys the newest successful SHA,
   so repeated polling does not duplicate or reorder deployments. GitHub/API
   outages cause the run to exit cleanly and retry on the next timer tick.
4. It never deploys failed or in-progress builds, pull-request artifacts, or a
   moving branch reference.

### GitHub download credential

Artifact downloads require authentication. Create a fine-grained personal access
token scoped to this repository with **Actions: read** (and Contents: read) only,
store it at `/srv/seo-stat/config/github.token` with mode 0600 owned by `seostat`,
and set `GITHUB_TOKEN_FILE` in `/srv/seo-stat/config/seo-stat.env`. The token is
never committed and never printed.

## Migrations, backup, and restore

- Migrations are applied with `prisma migrate deploy` (never `migrate dev` or
  `db push` in production) only when `apps/api/prisma/migrations` contains
  migrations. There are none yet, so this step is currently a no-op.
- Before applying migrations, `deploy/scripts/backup-db.sh` writes a compressed
  `pg_dump` to `/srv/seo-stat/backups/seo_stat-<timestamp>.sql.gz`.
- Restore: `gunzip -c /srv/seo-stat/backups/<file>.sql.gz | psql "${DATABASE_URL%%\?*}"`
  (strip Prisma's `?schema=` parameter, which `psql` does not accept). Restore
  into a maintenance window; it overwrites current data.

## Rollback semantics

- On a failed post-deploy health check, `deploy.sh` restores the previous
  application release symlink and restarts the services. This reverses
  application code only; it does **not** reverse database migrations. A migration
  that has already run stays applied; its backup is the recovery path.

## One-time administrator prerequisites

`seostat` cannot do these; run the bootstrap as an administrator:

```
sudo bash deploy/scripts/bootstrap-admin.sh
```

It is idempotent and:

- installs `unzip` (needed to extract the artifact) and `postgresql-client` if
  missing;
- creates the PostgreSQL role `seostat` and database `seo_stat`, and writes
  `/srv/seo-stat/config/api.env` (mode 0600, owner `seostat`) without printing the
  password;
- installs `/etc/nginx/snippets/seo-stat.locations.conf` and adds its `include`
  to the existing `192.168.8.50` server block, then reloads nginx;
- enables lingering for `seostat`.

It reuses the existing TLS certificate (no new certificate is created) and does
not grant broad passwordless sudo.

Then, as `seostat`:

```
bash deploy/scripts/install-user-units.sh
```

which installs the user units and deploy scripts, and enables the deploy timer.
Set the GitHub token (above) and the database password is already in `api.env`.

## CI

`.github/workflows/harness.yml` runs on pushes and pull requests to `main`:
a harness job, and an application job (install, typecheck, lint, build, tests,
and an API end-to-end test against a PostgreSQL service). On `main` pushes it
additionally packages and uploads the deployment artifact.

CI validates and packages only; it does not deploy and does not touch the server.
Status at the time of writing: the `main` workflow passes and produces the
SHA-tied artifact (verified run 37765600853 on commit `4550e36`); the first
server-side deployment is pending the administrator bootstrap and the download
token.

## Unknown / to confirm

- Server hostname is `sdr-node`; confirm DNS/`/etc/hosts` expectations for the
  public URL.
- Whether the landing page at `/` should list seo-stat (owned by another site).
- Certificate renewal process for `/etc/ssl/ai-sdr/ai-sdr.crt`.
- Disk-retention policy for `/srv/seo-stat/releases` (pruned to `KEEP_RELEASES`)
  and `/srv/seo-stat/backups`.
