# Product

## Purpose

`seo-stat` runs on a local Linux server and schedules a repeatable SEO content
pipeline:

1. Content research - gather topics/keywords and source material.
2. Article generation - draft articles from research output.
3. Website publishing - publish approved articles to the site.
4. LinkedIn publishing - publish approved posts to LinkedIn.
5. Google performance reporting - collect and report Google search performance.

## Project-first model (approved)

The application is organized around projects. A project represents a specific
business or brand and owns its settings, content, workflows, schedules,
execution history, integrations, metrics, and reports. Global scope covers
project management, system settings, and aggregate costs. See
`docs/functional-architecture.md` for the authoritative description.

## Confirmed decisions

- Language/runtime: TypeScript on Node.js 24.
- Web: Next.js (App Router).
- API: NestJS on Fastify.
- Database: PostgreSQL via Prisma.
- Public UI URL: https://192.168.8.50/seo-stat/
- Browser-facing API prefix: `/seo-stat/api/` on the same origin.
- Planned server deployment user: `seostat`.

## Implemented today

- pnpm workspace with `apps/web` (Next.js) and `apps/api` (NestJS on Fastify).
- Project persistence and CRUD: create, list, retrieve, update; archive and
  restore; persistent settings.
- Project list as the entry screen, with archived filtering.
- Project workspace with sections Overview, Content, Automation, Run history,
  Metrics & reports, and Settings; Overview and Settings are functional.
- Website & competitor analysis: optional competitor URLs (up to five), a
  manually triggered bounded public-website research run, and reviewable,
  evidence-based suggestions that can be selectively applied to settings.
- Content workflow: business-driven topic suggestions, an editable brief, and
  versioned, editable article drafts with Markdown editing, safe preview,
  sources and unresolved claims, and a "ready for review" state (not
  publication).
- Database-backed API health endpoint at `/seo-stat/api/health`.
- Subpath routing, a development proxy, and automatic deployment.

Scheduling, generation, publishing, reporting, integrations, and aggregate costs
are **not** implemented. Only Overview and Settings contain real functionality.

## Intended workflows (proposed)

- Scheduled research produces candidate topics.
- Generation turns a topic into a draft.
- A configurable publishing mode decides whether human review is required before
  an item goes live.
- Each external action records its result so it is not repeated.
- Reporting runs on its own schedule and summarizes outcomes.

## Initial MVP boundaries (proposed)

In scope:

- Project management and per-project settings.
- Content research and article generation producing reviewable drafts.
- A configurable publishing mode (`review` or `automatic`), defaulting to review.
- Durable records of generated items and their publication state.
- A simple performance report.

Out of scope:

- Multi-user accounts, roles, and permissions.
- Analytics beyond Google performance.
- Advanced UI or design work beyond the approved existing design.
- Credential storage and external integrations (until a later task).

## Open product decisions

- Which keyword/topic sources are authoritative for research.
- Draft quality bar and who performs review.
- What "published" means for each channel and how duplicates are detected.
- Report cadence, audience, and delivery channel.
