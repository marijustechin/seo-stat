# Decision records

Architecture decisions that are already made, with the reasoning behind them and
the conditions under which they may be reopened.

The purpose of this directory is to stop a planner - human or model - from
re-arguing settled ground, and to make the settled ground visible to anyone who
only reads the repository.

## What wins in a conflict

1. [AGENTS.md](../../AGENTS.md) is the authoritative rule list.
2. [scripts/validate-harness.mjs](../../scripts/validate-harness.mjs) enforces
   part of it mechanically.
3. These records explain **why** a rule exists and what it costs.
4. [docs/architecture.md](../architecture.md),
   [docs/functional-architecture.md](../functional-architecture.md), and
   [docs/product.md](../product.md) describe the system and the product.

If a record here contradicts 1, 2, or 4, the record is wrong: fix the record, do
not weaken the source.

## When to write a record

- A decision that is expensive to reverse, or that a future reader would
  otherwise reopen without context.
- A decision that resolves a row in the open-decisions table of
  [docs/ROADMAP.md](../ROADMAP.md).
- An accepted limitation, so that it reads as a choice rather than an oversight.

Do not write a record for a reversible implementation detail.

## Format

```markdown
# ADR-NNNN: Title

- Status: accepted | amended by ADR-NNNN | superseded by ADR-NNNN | accepted (limitation)
- Recorded: YYYY-MM-DD
- Source of truth: link to the authoritative document
- Supersedes: none | ADR-NNNN

## Decision
## Rationale
## Consequences
## Reopen only if
```

The `Recorded` date is the date the record was written. Some records describe
decisions that predate them; the Decision section names the source that already
carried the decision.

IDs are `ADR-NNNN`, allocated in order, never reused. File name:
`ADR-NNNN-short-title.md`. Add the row to the table below when a record is added.

## Records

| ID | Decision | Status |
| --- | --- | --- |
| [ADR-0001](ADR-0001-project-first-scope.md) | Project-first scope and ownership | accepted |
| [ADR-0002](ADR-0002-esm-node24-pnpm-workspace.md) | TypeScript ESM on Node.js 24 in a pnpm workspace | accepted |
| [ADR-0003](ADR-0003-application-stack.md) | Next.js 16, NestJS 12 on Fastify, Prisma 7 with PostgreSQL | accepted |
| [ADR-0004](ADR-0004-single-origin-subpath.md) | Single-origin subpath deployment on loopback ports 3011/3012 | accepted |
| [ADR-0005](ADR-0005-unattended-deployment.md) | Unattended deployment from a successful `main` build | accepted |
| [ADR-0006](ADR-0006-explicit-provider-selection.md) | Explicit AI provider selection with no automatic fallback | accepted |
| [ADR-0007](ADR-0007-credential-encryption.md) | Integration credentials encrypted server-side, key outside releases | accepted |
| [ADR-0008](ADR-0008-review-policy-and-idempotency.md) | Review-first publishing policy with idempotent external actions | amended by ADR-0010 (default mode only) |
| [ADR-0009](ADR-0009-no-authentication.md) | No authentication in the current deployment | accepted (limitation) |
| [ADR-0010](ADR-0010-unattended-content-pipeline.md) | Unattended content pipeline as the default operating model | accepted |
| [ADR-0011](ADR-0011-gap-resolution-digest.md) | Gap resolution digest: one record per article run, read-only, non-blocking | accepted |
| [ADR-0012](ADR-0012-link-justification.md) | A link URL is never invented | accepted |

## Related

- [docs/ROADMAP.md](../ROADMAP.md) - what comes next, and which open decisions
  must be resolved first.
- [docs/consult/README.md](../consult/README.md) - how to obtain an outside
  opinion on a decision without making a chat the source of truth.
