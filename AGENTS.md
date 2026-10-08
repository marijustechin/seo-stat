# AGENTS.md - seo-stat

## Scope

These instructions apply to the whole `seo-stat` repository. No parent-directory
`AGENTS.md` exists. If one is added later, it applies in addition to this file.

## Project in one line

A local Linux-server tool to schedule content research, article generation,
website publishing, LinkedIn publishing, and Google performance reporting.

## Working rules

- The harness phase is docs + task tracking + validation only. Do not add
  application code, connect external accounts, publish content, configure the
  server, or deploy unless a task explicitly asks for it.
- Keep changes proportionate to a small project. Prefer standard-library
  solutions; do not add dependencies without a task that justifies them.
- Preserve existing work. Inspect before editing.
- Credentials and secrets must stay outside tracked files (see `.gitignore`;
  real values live in untracked env files or the server secret store).
- Publishing mode is configurable per workflow: `review` (human approval before
  any external action) or `automatic`. Default to `review`.
- External actions must record their result and must be idempotent: never publish
  the same item twice.
- A failed step must be recoverable without repeating already-successful
  publication steps.
- Scheduling must explicitly handle timezone, server downtime, and missed runs.
- Record implementation, verification, commit, and deployment states separately.
  Never describe uncommitted or undeployed work as committed or deployed.

## Verification

Run before considering any task done:

```
node scripts/validate-harness.mjs
```

It validates completed task records and local Markdown links. Node.js is
required (developed against Node 24). No install step and no third-party
dependencies.

CI runs the same command on pushes and pull requests to `main` via
`.github/workflows/harness.yml` (Node 24, read-only permissions, no install
step). A passing local run is not evidence of a successful CI run; check the
GitHub Actions tab for the actual result.

## Completion requirements

A task is complete only when:

1. Its record in `tasks/` has all required sections filled in, including
   acceptance criteria and verification evidence.
2. The verification command above passes.
3. The task record's State section and `tasks/INDEX.md` match reality.
4. Commit and deployment states are recorded truthfully (they are separate from
   implementation and verification).
