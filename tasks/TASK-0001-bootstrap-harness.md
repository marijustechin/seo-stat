# TASK-0001: Bootstrap the `seo-stat` project harness

- ID: TASK-0001
- State: completed
- Owner: agent
- Created: 2026-10-08
- Last updated: 2026-10-08

## Objective

Establish the development harness for `seo-stat`: minimal documentation, task
tracking, lightweight mechanical checks, and documented operating boundaries.
No application code and no server work.

## Scope

In scope:

- Inspect the repository and record its actual state.
- Add README, AGENTS.md, and product/architecture/deployment docs.
- Add a small task lifecycle, template, index, and this bootstrap record.
- Add a dependency-free harness validation script and document one command.
- Document operating boundaries (publishing mode, idempotency, recovery,
  scheduling, secrets).
- Connect the repository to GitHub (`origin`) and add a minimal CI workflow.

Out of scope:

- Application scaffolding or runtime components.
- Connecting external accounts, publishing, configuring the server, or deploying.

## Acceptance criteria

- [x] Workspace inspected and findings recorded.
- [x] Required docs exist, with proposals clearly separated from implemented work.
- [x] Task template, lifecycle, index, and this bootstrap record exist.
- [x] One documented validation command exists and uses no third-party deps.
- [x] Validation detects invalid completed task records and broken local links.
- [x] Remote `origin` configured and a minimal CI workflow added.
- [x] Commit and deployment states recorded separately and truthfully.

## Verification evidence

- `git status` at start: on branch `master`, no commits, no remote; only `.git`.
- No parent `AGENTS.md` found under `C:\Users\msmig\Projektai` or the user home.
- `node scripts/validate-harness.mjs` passes on the working tree.
- Invalid-input check: a temporary completed task record missing required
  sections and a Markdown file with a broken local link were added; the
  validator exited non-zero and named both problems; fixtures were then removed.
- Node version used: v24.20.0. Python was unavailable (Windows Store alias).
- Remote `origin` (https://github.com/marijustechin/seo-stat.git) inspected
  before push: reachable and empty (no refs), so there was no remote history to
  preserve or reconcile.
- CI workflow added at `.github/workflows/harness.yml` (pushes and pull requests
  to `main`, Node 24, read-only permissions, no install step).
- CI run for bootstrap commit `55d0322` completed successfully (GitHub Actions
  run 37757718760, event `push`):
  https://github.com/marijustechin/seo-stat/actions/runs/37757718760
- `gh` was unauthenticated, so the run was read through the public GitHub REST
  API; the workflow itself was confirmed `active`.

## Completion notes

- The harness is documentation + tracking + validation only. Nothing runs and
  nothing is deployed.
- Server details remain unknown and are listed in `docs/deployment.md`.
- Recommended next task: a persistent scheduled-job workflow with execution
  history and a simulated action, before AI generation or external publication.

## State

- Implementation: complete (harness files, remote, and CI workflow present)
- Verification: complete (local validator passes; invalid input detected; CI green
  for bootstrap commit `55d0322`)
- Commit: committed on `main` as the TASK-0001 bootstrap commit
- Deployment: not deployed / not applicable
