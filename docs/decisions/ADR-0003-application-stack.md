# ADR-0003: Next.js 16, NestJS 12 on Fastify, Prisma 7 with PostgreSQL

- Status: accepted
- Recorded: 2026-10-13
- Source of truth: [AGENTS.md](../../AGENTS.md),
  [docs/architecture.md](../architecture.md), enforced by
  [scripts/validate-harness.mjs](../../scripts/validate-harness.mjs)
- Supersedes: none

## Decision

- Web: Next.js 16 App Router in `apps/web` (React 19).
- API: NestJS 12 on Fastify in `apps/api`.
- Database: PostgreSQL through Prisma 7 with the `@prisma/adapter-pg` driver
  adapter and `prisma.config.ts`.

Code layout:

- API: domain modules under `apps/api/src/modules`, with database and
  configuration infrastructure under `apps/api/src/database` and
  `apps/api/src/config`.
- Web: `src/app`, `src/widgets`, `src/features`, `src/entities`, `src/shared`,
  with imports flowing **downward only**: app -> widgets -> features -> entities ->
  shared.

## Rationale

The stack was chosen by the operator and is recorded as a fixed requirement.
Tooling familiarity is explicitly not grounds for reopening it. The major
versions are pinned because the validator checks them, so an upgrade is a
deliberate change rather than a side effect of installing something.

## Consequences

- `@nestjs/core`, `@nestjs/platform-fastify`, `@prisma/client`, and
  `@prisma/adapter-pg` are pinned to major 12 and 7 respectively; `next` to 16 and
  `react` to 19.
- A new API capability becomes a module under `src/modules/<domain>` with a
  controller, service, DTOs, and a public `index.ts`; shared outbound protections
  and helpers live in `src/common`.
- A frontend feature may not import upward across the layer boundary. Cross-
  cutting code belongs in `shared`.
- Prisma client output is generated, not tracked.

## Reopen only if

The operator changes the stack or a major version. The change must update
`AGENTS.md`, the validator, and [docs/architecture.md](../architecture.md)
together.
