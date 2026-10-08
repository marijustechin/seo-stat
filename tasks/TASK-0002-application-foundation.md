# TASK-0002: Application foundation with subpath routing

- ID: TASK-0002
- State: completed
- Owner: agent
- Created: 2026-10-08
- Last updated: 2026-10-08

## Objective

Create the minimal application foundation served under the `/seo-stat/` subpath,
with a database-backed health check, and record the confirmed architecture
decisions. Corrected to the confirmed stack: ESM, NestJS 12, Prisma 7, and ports
3011/3012.

## Scope

In scope:

- Confirmed stack and URL documentation; unknown server details kept explicit.
- ESM pnpm workspace with `apps/web` and `apps/api`; pinned versions, lockfile.
- Cross-platform commands for dev, build, typecheck, lint, tests, harness
  validation.
- Subpath routing: Next.js `basePath` `/seo-stat` and `trailingSlash`; NestJS
  global prefix `seo-stat/api`; development proxy; nginx example.
- Prisma 7 with the `@prisma/adapter-pg` adapter and `prisma.config.ts`, plus an
  isolated development PostgreSQL and a secrets-free `.env.example`.
- API health endpoint with a real database check.
- Minimal responsive UI shell; backend domain modules and frontend layers.
- CI application checks.

Out of scope:

- Scheduling, job execution, execution history, and simulated actions.
- AI generation and external publishing.
- Server configuration and deployment (see TASK-0003).

## Acceptance criteria

- [x] Stack and URL recorded as confirmed; unknown server details remain explicit.
- [x] ESM everywhere; NestJS 12 on Fastify; Prisma 7 with the PostgreSQL adapter
  and `prisma.config.ts`.
- [x] Next.js served under `/seo-stat/` with trailing slashes; API under
  `/seo-stat/api/`; API on port 3011 and web on 3012.
- [x] Development proxy forwards `/seo-stat/api/` to NestJS on the same origin.
- [x] `/seo-stat/api/health` performs a real database check and returns 503 when
  the database is down, without exposing connection details.
- [x] Backend organized into `src/modules`, `src/database`, and `src/config`;
  frontend keeps thin routes and `src/{shared,entities,features,widgets}` layers.
- [x] Minimal responsive UI shell with Overview, Schedules, Run history; English
  text; `cursor-pointer` on interactive buttons.
- [x] Prisma configured against an isolated dev PostgreSQL; `.env.example` is
  secrets-free.
- [x] nginx example routes API vs UI preserving the path, with `/seo-stat` ->
  `/seo-stat/` canonical redirection.
- [x] Production build verified under `/seo-stat/`, including frontend-to-API
  requests, with the database up and down.

## Verification evidence

- `pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r test`, `pnpm -r build` all pass
  on Node v24.20.0 with pnpm 11.26.0.
- The ESM production build starts (`node dist/main.js`) and Nest dependency
  injection resolves `PrismaService` (route mapped, "Nest application
  successfully started"), confirming decorator metadata.
- API end-to-end test (`pnpm --filter @seo-stat/api test:e2e`) against live
  PostgreSQL: 2 passed (health 200; `/health` outside prefix 404).
- Production subpath smoke test with the database up: all checks pass (pages,
  reload, static asset under `/seo-stat/_next/static/`, public asset, canonical
  redirect `/seo-stat` -> `/seo-stat/`, no duplicate prefix, root `/api/` and
  root `/_next/` rejected, health 200 via the same-origin proxy).
- Same smoke with the database stopped: health 503, database down; other checks
  pass.
- Pinned versions: Next 16.4.0, React 19.3.0, NestJS 12.1.2, Fastify 5.12.5,
  Prisma 7.10.0, `@prisma/adapter-pg` 7.10.0, pg 8.23.1, TypeScript 5.9.3,
  ESLint 10.12.0, Vitest 5.0.3.
- Not verified locally: the updated GitHub Actions workflow run.

## Completion notes

- This task was corrected after an initial CommonJS/Nest 11/Prisma 6 version:
  the project-owned toolchain is now ESM, NestJS 12, and Prisma 7, and the ports
  are 3011 (API) and 3012 (web).
- Tests use Vitest with `unplugin-swc` so decorator metadata is emitted under
  ESM; the build uses `tsc` with `module`/`moduleResolution` `nodenext`.
- Recommended next task: unattended deployment (TASK-0003), then persistent
  schedules and execution history.

## State

- Implementation: complete
- Verification: complete (local)
- Commit: committed on `main`
- Deployment: not applicable to this task
