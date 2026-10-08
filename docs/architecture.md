# Architecture

This document distinguishes confirmed decisions and implemented components from
proposals. The authoritative list of fixed decisions is in `AGENTS.md`.

## Confirmed stack

- TypeScript on Node.js 24; pnpm workspace (`apps/web`, `apps/api`).
- ESM for all project-owned code, scripts, and configuration.
- Web: Next.js 16 App Router, base path `/seo-stat`, trailing slashes.
- API: NestJS 12 on Fastify, global prefix `seo-stat/api`.
- Data: PostgreSQL via Prisma 7 with the `@prisma/adapter-pg` driver adapter and
  `prisma.config.ts`.
- Browser API requests use the same origin under `/seo-stat/api/`.
- Production services bind to loopback (API `127.0.0.1:3011`, web
  `127.0.0.1:3012`); nginx is the public entry point.

## Implemented components

- `apps/web` - Next.js App Router UI shell.
  - `src/app` - thin route files (Overview, Schedules, Run history).
  - `src/widgets` - composed UI (navigation).
  - `src/features` - user-facing capabilities (health status card).
  - `src/entities` - domain models and data access (health).
  - `src/shared` - cross-cutting configuration (base path, API URL, nav).
  - Imports flow downward: app -> widgets -> features -> entities -> shared.
- `apps/api` - NestJS on Fastify.
  - `src/modules/health` - domain module (controller, service, public `index.ts`).
  - `src/database` - Prisma infrastructure (`DatabaseModule`, `PrismaService`).
  - `src/config` - configuration infrastructure (`AppConfigModule`).
  - `src/generated/prisma` - Prisma 7 client output (git-ignored, regenerated).
- `apps/api/prisma/schema.prisma` - no domain tables yet; `prisma.config.ts`
  holds the connection URL.
- `deploy/` - deployment artifacts: systemd user units, deploy/poll/backup
  scripts, an nginx location include, and the administrator bootstrap script.
- `scripts/validate-harness.mjs` - harness validation (tasks, links, and the
  pinned version/ESM/port rules).
- `scripts/smoke-subpath.mjs` - subpath routing and health smoke test.

No scheduling, job execution, generation, publishing, or reporting exists yet.

## Proposed components (not implemented)

- Scheduler - triggers research, generation, publishing, and reporting runs,
  handling timezone, downtime, and missed runs.
- Job store - durable record of items and external action results, to make
  publishing idempotent and recoverable.
- Research, generation, website publisher, LinkedIn publisher, reporting modules.

## Deployment architecture (see `docs/deployment.md`)

- GitHub Actions on `main` runs CI and, on success, produces a deployment
  tarball artifact tied to the commit SHA.
- A systemd user timer on the server polls for the latest successful `main`
  build, downloads its artifact, deploys into
  `/srv/seo-stat/releases/<sha>`, switches `/srv/seo-stat/current`, and restarts
  the user services. Failures restore the previous release.

## Resolved decisions

- Language/runtime: TypeScript on Node 24; ESM throughout.
- Frameworks: Next.js 16 (App Router) and NestJS 12 on Fastify.
- Data: PostgreSQL via Prisma 7 with the PostgreSQL driver adapter.
- Subpath: UI at `/seo-stat`, API under `/seo-stat/api`; ports 3011/3012.
- Backend module layout and frontend layer boundaries (see above).
- Deployment: GitHub artifact + systemd user timer; see `docs/deployment.md`.

## Unresolved decisions

- Scheduler technology and missed-run strategy.
- Job-store schema and where execution history lives.
- How application-level (non-secret) settings are managed beyond environment
  variables.
- Review workflow mechanics and where review state lives.
- Duplicate-publication detection strategy per channel.
- Whether reporting reads third-party APIs directly or stored snapshots.
