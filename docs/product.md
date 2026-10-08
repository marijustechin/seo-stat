# Product

## Purpose

`seo-stat` runs on a local Linux server and schedules a repeatable SEO content
pipeline:

1. Content research - gather topics/keywords and source material.
2. Article generation - draft articles from research output.
3. Website publishing - publish approved articles to the site.
4. LinkedIn publishing - publish approved posts to LinkedIn.
5. Google performance reporting - collect and report Google search performance.

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
- Minimal responsive UI shell: Overview, Schedules, and Run history pages.
- Database-backed API health endpoint at `/seo-stat/api/health`.
- Subpath routing for the UI and API, a development proxy, and an nginx example.

Scheduling, generation, publishing, and reporting are **not** implemented.

## Intended workflows (proposed)

- Scheduled research produces candidate topics.
- Generation turns a topic into a draft.
- A configurable publishing mode decides whether human review is required before
  an item goes live.
- Each external action records its result so it is not repeated.
- Reporting runs on its own schedule and summarizes outcomes.

## Initial MVP boundaries (proposed)

In scope:

- Content research and article generation producing reviewable drafts.
- A configurable publishing mode (`review` or `automatic`), defaulting to review.
- Durable records of generated items and their publication state.
- A simple performance report.
- Extending the existing UI shell with real data.

Out of scope:

- Multi-user accounts, roles, and permissions.
- Multiple websites or multiple social accounts.
- Analytics beyond Google performance.
- Advanced UI or design work beyond a functional shell.

## Open product decisions

- Which keyword/topic sources are authoritative for research.
- Draft quality bar and who performs review.
- What "published" means for each channel and how duplicates are detected.
- Report cadence, audience, and delivery channel.
