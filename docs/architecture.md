# Architecture

This document distinguishes confirmed decisions and implemented components from
proposals. The authoritative list of fixed decisions is in `AGENTS.md`.

The approved functional (project-first) architecture is described in
`docs/functional-architecture.md`. This document covers the technical
architecture.

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

- `apps/web` - Next.js App Router UI.
  - `src/app` - thin route files (project list, project workspace sections,
    system page) plus the project workspace layout.
  - `src/widgets` - composed UI (global nav, project header/nav/context).
  - `src/features` - user-facing capabilities (project list, create, overview,
    settings, health status).
  - `src/entities` - domain models and data access (project, health).
  - `src/shared` - cross-cutting code (config, API client, safe Markdown
    renderer, small UI).
  - Imports flow downward: app -> widgets -> features -> entities -> shared.
- `apps/api` - NestJS on Fastify.
  - `src/modules/projects` - the projects domain module (controller, service,
    DTOs, mapper, competitor URL normalization, public `index.ts`).
  - `src/modules/analysis` - website/competitor analysis: controller, service,
    an in-process runner, SSRF-safe bounded research (`research/`), and one AI
    provider behind an interface (`ai/`, DeepSeek via the OpenAI-compatible SDK).
  - `src/modules/content` - project content workflow: topics, briefs (with
    information-requirement answers), reusable project knowledge, versioned
    drafts, article cover images (upload/generation behind an explicitly selected
    provider: Cloudflare Workers AI FLUX or OpenAI Images), and their
    asynchronous generation runs.
  - `src/modules/integrations` - project-scoped external integrations: the
    WordPress connection (encrypted credentials, connection test) and explicit
    article-draft export to a WordPress draft with reliable external-action
    records. Credential encryption and the WordPress REST client sit here.
  - `src/common` - shared infrastructure reused across modules: outbound
    public-URL/SSRF protections and a bounded JSON request helper, plus the
    dependency-free Markdown-to-safe-HTML converter.
  - `src/modules/system` - global system status (analysis, research, image
    provider, and integration-encryption configuration).
  - `src/modules/health` - health domain module.
  - `src/database` - Prisma infrastructure (`DatabaseModule`, `PrismaService`).
  - `src/config` - configuration infrastructure (`AppConfigModule`).
  - `src/bootstrap` - shared app configuration (`configureApp`).
  - `src/generated/prisma` - Prisma 7 client output (git-ignored, regenerated).
- `apps/api/prisma/schema.prisma` + `prisma/migrations` - the `projects` table
  with a committed migration; `prisma.config.ts` holds the connection URL.
- `deploy/` - deployment artifacts: systemd user units, deploy/poll/backup
  scripts, an nginx location include, and the administrator bootstrap script.
- `scripts/validate-harness.mjs` - harness validation (tasks, links, and the
  pinned version/ESM/port rules).
- `scripts/smoke-subpath.mjs` - subpath routing and health smoke test.

No scheduling, workflow execution, or external publishing (beyond the explicit
WordPress draft export) exists yet.

## Proposed components (not implemented)

- Workflow definitions, schedules, and execution history (project-scoped).
- Content research and generation, website and LinkedIn publishing, reporting.
- Integrations and credential storage.
- Aggregate costs across projects.

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
- Functional model: project-first scope and ownership (see
  `docs/functional-architecture.md`).
- Backend module layout and frontend layer boundaries (see above).
- Deployment: GitHub artifact + systemd user timer; see `docs/deployment.md`.
- Integration credentials: stored server-side with authenticated encryption
  (AES-256-GCM) under a deployment-managed key outside the release directories;
  never returned to the browser or written to logs/errors.

## Unresolved decisions

- Scheduler technology and missed-run strategy.
- Job-store schema and where execution history lives.
- How application-level (non-secret) settings are managed beyond environment
  variables.
- Authentication and access control: **not implemented**. The API (including the
  content image-file route and the WordPress integration/export routes) trusts
  the caller and relies on the private network and nginx; project scoping limits
  which records are visible but is not identity-based authentication.
- Review workflow mechanics and where review state lives.
- Duplicate-publication detection strategy per channel.
- Whether reporting reads third-party APIs directly or stored snapshots.
