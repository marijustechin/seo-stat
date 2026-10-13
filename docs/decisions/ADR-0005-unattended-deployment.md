# ADR-0005: Unattended deployment from a successful `main` build

- Status: accepted
- Recorded: 2026-10-13
- Source of truth: [AGENTS.md](../../AGENTS.md),
  [docs/deployment.md](../deployment.md)
- Supersedes: none

## Decision

- GitHub Actions on `main` validates and packages, and on success produces a
  deployment artifact tied to the commit SHA. CI does **not** deploy and does not
  touch the server.
- A systemd **user** timer on the server polls for the latest successful `main`
  build, downloads the artifact, deploys into `/srv/seo-stat/releases/<sha>`,
  switches `/srv/seo-stat/current`, restarts the user services, and restores the
  previous release on failure.
- Deployment happens automatically after a successful `main` CI, **without
  recurring operator approval**.
- Deployment user: `seostat`.

## Rationale

Recorded in `AGENTS.md`. The intent is that a merged, verified change reaches the
server without a human in the loop on every release, while CI stays unable to
reach the production host - the server pulls, nothing pushes.

## Consequences

- **Any push to `main` produces a release and restarts the services**, including a
  documentation-only commit. That is why commit and deployment are recorded as
  separate facts in every task record: pushing is a deploy.
- A passing local run is not evidence of a successful CI run. Only the GitHub
  Actions result is.
- Migrations, backup/restore, rollback, and the one-time administrator
  prerequisites are operator concerns documented in
  [docs/deployment.md](../deployment.md).
- A failed step must be recoverable without repeating already-successful
  publication steps (`AGENTS.md`). Rollback restores a previous release; it does
  not re-run migrations backwards.

## Reopen only if

The operator wants a manual deployment gate, a different artifact channel, or a
push-based model. That is a change to `AGENTS.md` and
[docs/deployment.md](../deployment.md), not to a script alone.
