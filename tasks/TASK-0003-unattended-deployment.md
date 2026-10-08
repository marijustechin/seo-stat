# TASK-0003: Unattended deployment

- ID: TASK-0003
- State: completed
- Owner: agent
- Created: 2026-10-08
- Last updated: 2026-10-08

## Objective

Implement automatic deployment of successful `main` builds to the local server
as `seostat`, using GitHub-hosted CI artifacts and a systemd user timer, with
health checks, rollback, migrations, and backups. First deployment is pending
one-time administrator prerequisites.

## Scope

In scope:

- CI packaging of a Linux deployment artifact tied to the commit SHA on `main`.
- A systemd user timer polling for the latest successful `main` build and
  downloading its artifact over outbound HTTPS.
- Serialized, idempotent deployment into `/srv/seo-stat/releases/<sha>` with a
  `current` symlink, restarting only this project's user services.
- Health verification of the API/database and the HTTPS UI; application rollback
  on failure (explicitly not a database rollback).
- `prisma migrate deploy` when migrations exist, with a pre-migration backup and
  documented restore.
- An idempotent administrator bootstrap for PostgreSQL, nginx/TLS integration,
  and missing runtime tools.
- Read-only server inspection over SSH as `seostat`.

Out of scope:

- Scheduled jobs, execution history, and a simulated action.
- AI generation and external publishing.

## Acceptance criteria

- [x] Server inspected over SSH as `seostat` (OS, Node/pnpm, systemd user, ports,
  nginx/TLS, PostgreSQL, storage/memory/disk, outbound access).
- [x] CI produces a `main`-only artifact named by commit SHA; PRs and
  failed/in-progress builds are excluded.
- [x] Server poller selects only successful `push` runs on `main`, verifies the
  artifact's embedded SHA, and never deploys PR artifacts or moving refs.
- [x] Deployments serialized (`flock`) and idempotent; deployed SHA, timestamps,
  outcome, and health results recorded in a state file.
- [x] Release layout `/srv/seo-stat/releases/<sha>` with persistent config/state
  outside releases; systemd user services for API and web.
- [x] Safe release switch, restart of only this project's services, API/database
  health check, and HTTPS UI check; application rollback on failure.
- [x] `prisma migrate deploy` (conditional) with pre-migration backup and
  documented restore; never `migrate dev`/`db push` in production.
- [x] Administrator bootstrap prepared for PostgreSQL role/database, nginx/TLS
  integration, and missing tools; no broad passwordless sudo.
- [x] First deployment completed and the target URL verified (see Verification
  evidence).

## Verification evidence

- Read-only SSH inspection as `seostat` succeeded (see `docs/deployment.md`);
  ports 3011/3012 free, Node 24 and pnpm 11 present, linger enabled, PostgreSQL
  18 online, nginx active, outbound HTTPS to GitHub working, no sudo.
- Deployment shell scripts and systemd units are committed under `deploy/`;
  `package-release.sh` is invoked by CI and the artifact name is tied to
  `${{ github.sha }}`.
- Application-side checks rerun and passing (typecheck, lint, tests, ESM build,
  API e2e, subpath smoke with database up/down) on ports 3011/3012.
- Systemd user units installed on the server as `seostat`; `seo-stat-deploy.timer`
  is enabled and scheduled, and the API/web units are enabled. A manual
  `systemctl --user start seo-stat-deploy.service` completed with `Result=success`
  and logged `no readable token ... skipping`, confirming serialization and clean
  handling of a missing credential.
- GitHub token verified on the server: `/srv/seo-stat/config/github.token` is
  owned by `seostat`, mode 0600, and the Actions API returned HTTP 200 (the
  token is never printed).
- Admin prerequisites still required: with the shipped placeholder `api.env`,
  database authentication fails, and the nginx snippet/include are absent. The
  required utilities (`unzip`, `curl`, `tar`, `gzip`, `flock`, `pg_dump`) are
  present.
- Defects fixed during this task: `backup-db.sh` now strips Prisma's `?schema=`
  parameter before `pg_dump`; `bootstrap-admin.sh` generates a password when the
  shipped placeholder is present; a failed first deploy now stops the services
  and clears `current` so a later poll can retry.
- CI verified: runs completed successfully and produced SHA-tied artifacts,
  most recently run 37768742656 on commit `2fe962d` with artifact
  `seo-stat-deploy-2fe962d36a0c272c09b7d0f260d0dfc47fa0fb65` (1.63 MB). An earlier
  run (37764253751) failed in the packaging step; the archive is now written
  outside the tree with `--warning=no-file-changed`.
- Server deploy scripts were synced from the committed revision `2fe962d`;
  `/srv/seo-stat/scripts/bootstrap-admin.sh` matches it (sha256) and all scripts
  pass `bash -n`.
- Administrator bootstrap ran successfully (PostgreSQL role/database created,
  `api.env` written, nginx include added, `nginx -t` passed, linger enabled).
- First deployment completed through the implemented mechanism. For the verified
  release, the CI run SHA (`d82d102…`), artifact name
  (`seo-stat-deploy-d82d1027d9a687ba0999b6b20da9b3ae44686338`), embedded
  `RELEASE_SHA`, and deployed `current` all agree.
- Verified after deployment: API listening on `127.0.0.1:3011` and web on
  `127.0.0.1:3012`; `/seo-stat/api/health` returns 200 with
  `{"database":"up"}`; the app-origin subpath smoke passes all checks; through
  nginx `https://192.168.8.50/seo-stat/`, `/schedules/`, `/runs/`, `/robots.txt`,
  a `_next` static asset, and `/seo-stat/api/health` return 200; `/seo-stat`
  redirects (301) to `/seo-stat/`; unrelated apps still return 200 (`/` landing
  and `/sdr/`).
- `deploy-state.json` records the deployed SHA, timestamps, outcome, and health
  result. A repeated poll logged `already deployed … nothing to do` and left the
  state unchanged, confirming idempotency. The deploy timer remains enabled.

## Completion notes

- The one-time administrator bootstrap (`bootstrap-admin.sh`) has been run and
  the GitHub token is in place. The systemd user units are installed and
  enabled, so each new successful `main` build is deployed automatically: a push
  produces an artifact and the timer advances `current` to it within a few
  minutes, with no recurring operator approval.
- Defects found and fixed while completing the first deployment: the poller's
  JSON helper used `$2` instead of `$1`; `deploy.sh` now loads `api.env` so
  Prisma has `DATABASE_URL`; `backup-db.sh` strips Prisma's `?schema=`
  parameter; `bootstrap-admin.sh` treats the shipped placeholder password as
  unset.
- Rollback restores the previous application release only; it does not reverse
  database migrations.
- Recommended next task: persistent schedules, safe job claiming, execution
  history, and a simulated action.

## State

- Implementation: complete (committed)
- Verification: complete (services, health, and HTTPS URL verified)
- Commit: committed on `main`
- Deployment: deployed (first release verified; the timer advances `current` to
  each new successful `main` build)
