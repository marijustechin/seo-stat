# seo-stat

Local-server toolkit that will schedule content research, article generation,
website publishing, LinkedIn publishing, and Google performance reporting.

## Current state

A project-first application plus an unattended deployment pipeline. There is a
TypeScript ESM pnpm workspace with a Next.js UI and a NestJS API; projects are
persisted in PostgreSQL and can be configured from a bounded website/competitor
analysis. CI produces a deployment artifact consumed by a server-side systemd
user timer, so the app at https://192.168.8.50/seo-stat/ updates automatically
from successful `main` builds. **No scheduling, generation, publishing,
reporting, integrations, or aggregate costs** exist yet.

- Public UI URL: https://192.168.8.50/seo-stat/
- API prefix: `/seo-stat/api/` (same origin)
- Stack: Node.js 24, TypeScript (ESM), Next.js 16 (App Router), NestJS 12 on
  Fastify, Prisma 7 with PostgreSQL.
- Ports: API `127.0.0.1:3011`, web `127.0.0.1:3012`.

## Repository layout

```
AGENTS.md            Working rules and authoritative architecture decisions
README.md            This file
apps/web             Next.js UI (src: app, widgets, features, entities, shared)
apps/api             NestJS API (src: modules, database, config) + Prisma
                     migrations (projects table)
deploy/              systemd user units, deploy scripts, nginx include, bootstrap
docs/                product, architecture, deployment notes
tasks/               task lifecycle, template, records, index
scripts/             harness validation and subpath smoke test (no dependencies)
```

## Commands

Run from the repository root. Requires Node.js 24 and pnpm; Docker is used only
for the local development database. Commands work on Windows and Linux.

```
pnpm install          # install workspace dependencies
pnpm db:up            # start the isolated dev PostgreSQL (Docker, port 5433)
pnpm db:down          # stop it
pnpm dev              # run web (3012) and api (3011) in parallel
pnpm build            # production builds for web and api
pnpm typecheck        # TypeScript checks for both apps
pnpm lint             # ESLint for both apps
pnpm test             # unit tests for both apps
pnpm validate:harness # task records, local links, and confirmed architecture rules
pnpm verify:subpath   # smoke test a running server (see below)
```

The API reads `DATABASE_URL` and `PORT` from the environment. Copy
`apps/api/.env.example` to `apps/api/.env` and adjust; `.env` is git-ignored.

### Subpath smoke test

With the built application running, verify subpath routing:

```
pnpm verify:subpath                       # expects http://127.0.0.1:3012
EXPECT_DB=down node scripts/smoke-subpath.mjs http://127.0.0.1:3012
```

It checks the pages, static and public assets, the canonical `/seo-stat` ->
`/seo-stat/` redirect, that root `/api/` and `/_next/` are rejected, and that
`/seo-stat/api/health` works through the same-origin proxy.

## Deployment

Every successful push to `main` produces a deployment artifact in GitHub
Actions. A systemd user timer on the server polls for the latest successful
`main` build and deploys it under `/srv/seo-stat/`, with health checks and
application rollback. See `docs/deployment.md` for the model, one-time
administrator prerequisites, migrations, backup/restore, and rollback.

CI validates and packages only; it does not deploy and does not touch the server.
A passing local run is not evidence of a successful CI run; check the GitHub
Actions tab.

## Next steps

- Configure the analysis provider (`DEEPSEEK_API_KEY`) to enable website and
  competitor analysis (see `docs/deployment.md`).
- Build project-scoped content, workflow definitions, schedules, and execution
  history (see `docs/functional-architecture.md`).
- Credentials, external publishing, and article generation remain later
  integrations.
