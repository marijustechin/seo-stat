# Deployment

This describes the **intended** deployment model. No server has been configured
and nothing has been deployed. Unknowns are recorded explicitly.

## Intended model (proposed)

- Target: a single local Linux server, owned and operated locally.
- A dedicated deployment user `seostat` runs the scheduler and jobs.
- Configuration that is not secret is tracked in the repository; secrets are
  provided outside version control.
- Persistent data (job records, generated content, snapshots) lives on the
  server and survives redeploys and restarts.

## Configuration (proposed)

- Non-secret configuration in a tracked config file.
- Secret values referenced by name and supplied via an untracked env file or the
  server secret store, following the `seostat` service account's permissions.

## Secrets (proposed)

- Never committed. `.gitignore` excludes `.env*`, `secrets/`, and local config.
- Stored on the server with access limited to `seostat`.
- Rotated without editing tracked files.

## Persistent data (proposed)

- Location on the server: unknown (to be decided).
- Must be backed up and excluded from version control.

## Scheduling and downtime (proposed)

- Timezone: explicitly configured, not assumed from the host.
- Missed runs caused by downtime must be detected and handled deliberately
  (catch-up or skip), not silently lost.

## Rollback (proposed)

- Deployments should be reversible to a prior known-good version.
- Persistent data must not be destroyed by a rollback.
- External actions already recorded as published must not be re-executed.

## CI

- The repository has a GitHub remote and a GitHub Actions workflow at
  `.github/workflows/harness.yml`.
- It runs `node scripts/validate-harness.mjs` on pushes and pull requests to
  `main`, using Node 24, read-only `contents` permission, and no package
  installation (the validator has no dependencies).
- CI validates the harness only. It does not build, publish, or deploy the
  application and does not touch the server.
- The bootstrap push (commit `55d0322`) produced a successful run:
  https://github.com/marijustechin/seo-stat/actions/runs/37757718760
- Going forward, confirm each workflow run in the GitHub Actions tab; a passing
  local run is not evidence of a successful CI run.

## Unknown server details

Recorded explicitly as unknown; confirm before any deployment task:

- Hostname/IP, OS distribution and version.
- SSH access method and who holds keys.
- Whether the `seostat` user already exists and its permissions.
- Service manager (systemd or other).
- Data locations and backup strategy.
- Secret store technology.
- Network egress rules for the Google and LinkedIn APIs.
