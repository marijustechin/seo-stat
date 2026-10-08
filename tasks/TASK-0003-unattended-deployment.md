# TASK-0003: Unattended deployment

- ID: TASK-0003
- State: in-progress
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
- [ ] First deployment completed and the target URL verified (blocked: see
  Completion notes).

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
- Not yet verified: an actual GitHub Actions artifact download on the server, and
  the first end-to-end deployment. Blocked on the administrator bootstrap
  (PostgreSQL role/database and nginx include) and a GitHub download token.

## Completion notes

- Blocking prerequisites (one-time):
  1. Administrator runs `sudo bash deploy/scripts/bootstrap-admin.sh` on the
     server (creates the `seostat` PostgreSQL role and `seo_stat` database,
     writes `api.env`, installs the nginx include, installs `unzip`, enables
     linger).
  2. `seostat` runs `bash deploy/scripts/install-user-units.sh` and places a
     minimally scoped GitHub token (Actions: read) at
     `/srv/seo-stat/config/github.token` (mode 0600).
- Once both are done, the timer deploys the latest successful `main` artifact
  automatically; no recurring operator approval is required.
- Rollback restores the previous application release only; it does not reverse
  database migrations.
- Recommended next task: persistent schedules, safe job claiming, execution
  history, and a simulated action.

## State

- Implementation: complete (code committed; see Commit below)
- Verification: partial (server mechanisms implemented; first deployment blocked)
- Commit: see Git history for this record
- Deployment: not deployed (blocked on administrator bootstrap and GitHub token)
