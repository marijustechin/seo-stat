# Architecture

Everything in this document is **proposed** unless the "Implemented today"
section says otherwise. This harness contains no application code.

## Proposed components

- Scheduler - triggers research, generation, publishing, and reporting runs.
  Must handle timezone, server downtime, and missed runs.
- Job store - durable record of each item and each external action result.
  Enables idempotent publishing and recovery without repeating successes.
- Research module - produces candidate topics and source notes.
- Generation module - turns a topic into a draft article.
- Website publisher - publishes approved content to the site.
- LinkedIn publisher - publishes approved posts to LinkedIn.
- Reporting module - collects and reports Google performance.
- Config + secrets - non-secret config tracked; secrets untracked.
- Entry point - a CLI or scheduler-facing runner.

## Proposed data flow

research -> draft -> (review, if configured) -> publish (website/LinkedIn)
-> record result; reporting reads recorded results.

## Implemented today

- Documentation set in `docs/`.
- Task tracking in `tasks/`.
- Harness validation in `scripts/validate-harness.mjs`.

No runtime components exist yet.

## Resolved decisions (for the harness)

- Repository bootstrapped on branch `master`, no remote yet.
- Harness validation uses the Node standard library only, run as
  `node scripts/validate-harness.mjs`.

## Unresolved decisions

- Language/runtime for the application (Node, Python, other).
- Storage for the job store (files, SQLite, server database).
- Scheduler technology.
- How config and secrets are loaded on the server.
- Review workflow mechanics and where review state lives.
- Duplicate-publication detection strategy per channel.
- Whether reporting reads third-party APIs directly or stored snapshots.
