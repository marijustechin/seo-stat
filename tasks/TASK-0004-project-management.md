# TASK-0004: Project management and project workspaces

- ID: TASK-0004
- State: completed
- Owner: agent
- Created: 2026-10-08
- Last updated: 2026-10-08

## Objective

Implement the approved project-first functional architecture: persistent
projects with CRUD, settings, and archive/restore; a project list as the entry
screen; and a project workspace with Overview and Settings implemented and the
future sections clearly marked as not implemented. Preserve the current visual
design, routing, and ports.

## Scope

In scope:

- Record the approved functional architecture and the approved visual design.
- Prisma model + committed migration for projects.
- Projects module: create, list, retrieve, update, settings, archive, restore;
  input validation; 404 for unknown projects; stable identity.
- Frontend: project list (create + archived filter), project workspace with
  global vs project navigation, Overview, Settings, and "not implemented" states
  for the future sections.
- Isolated PostgreSQL integration tests, production-build reload checks, subpath
  and health checks, and an isolated backup/restore exercise.
- Reconcile docs and deploy automatically via the existing timer.

Out of scope:

- Scheduling, workflow execution, AI generation, external publication,
  credentials, metrics, and aggregate costs.

## Acceptance criteria

- [x] Functional architecture and approved visual design recorded.
- [x] Committed Prisma migration creating the projects table.
- [x] Projects API: create, list, retrieve, update, settings, archive, restore;
  validation; 404 for unknown; stable identity across name/website changes.
- [x] Project list is the entry screen with creation and archived filtering.
- [x] Project workspace with sections and retained project context across direct
  navigation and reloads.
- [x] Global navigation separated from project navigation; selected project
  visible throughout.
- [x] Settings organized under General, Business context, Content rules,
  Publishing policy; Integrations reserved as "not implemented yet".
- [x] Future sections show "not implemented yet"; no invented metrics,
  executions, or integration success.
- [x] Thin route files and FSD-lite layering preserved; design and ports
  preserved.

## Verification evidence

- Backend integration tests (`pnpm --filter @seo-stat/api test:e2e`) against an
  isolated PostgreSQL: 11 passed (2 health + 9 projects), covering CRUD, settings
  persistence, archive/restore with history preserved, validation failures,
  404 for unknown projects, and independence between two projects.
- Typecheck, lint, unit tests, and production builds pass for both apps.
- Production build reloads: created a project through the same-origin proxy and
  requested `/seo-stat/`, `/seo-stat/system/`, `/seo-stat/projects/new/`, and
  every `/seo-stat/projects/<id>/…` section directly — all returned 200.
- Subpath smoke test passes with the database up and down (health 200/503).
- Isolated backup/restore exercise: two representative projects dumped with
  `pg_dump | gzip`, integrity verified, restored into a separate database, and
  verified (2 rows, correct names, `automatic` policy, `friendly` tone).
- Committed migration `20261008113954_init_projects` creates the `projects`
  table.

## Completion notes

- The first production migration is applied by `deploy.sh`, which runs
  `backup-db.sh` (pre-migration `pg_dump`) before `prisma migrate deploy`.
- No scheduling, generation, publishing, reporting, integrations, or cost
  aggregation is implemented.
- Recommended next task: project-scoped content and workflow/schedule/execution
  management.

## State

- Implementation: complete
- Verification: complete (local)
- Commit: committed on `main`
- Deployment: deployed automatically by the systemd user timer
