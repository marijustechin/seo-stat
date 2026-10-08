# Product

## Purpose

`seo-stat` will run on a local Linux server and schedule a repeatable SEO
content pipeline:

1. Content research - gather topics/keywords and source material.
2. Article generation - draft articles from research output.
3. Website publishing - publish approved articles to the site.
4. LinkedIn publishing - publish approved posts to LinkedIn.
5. Google performance reporting - collect and report Google search performance.

## Intended workflows (proposed)

- Scheduled research produces candidate topics.
- Generation turns a topic into a draft.
- A configurable publishing mode decides whether human review is required before
  an item goes live.
- Each external action records its result so it is not repeated.
- Reporting runs on its own schedule and summarizes outcomes.

These workflows are proposals. None are implemented yet.

## Initial MVP boundaries (proposed)

In scope for an initial MVP:

- Content research and article generation producing reviewable drafts.
- A single publishing mode setting (review vs automatic), defaulting to review.
- Durable records of generated items and their publication state.
- A simple performance report.

Out of scope for the initial MVP:

- Multi-user accounts, roles, and permissions.
- A web UI.
- Multiple websites or multiple social accounts.
- Analytics beyond Google performance.
- Retries against flaky third-party APIs beyond basic idempotency.

## Open product decisions

- Which keyword/topic sources are authoritative for research.
- Draft quality bar and who performs review.
- What "published" means for each channel and how duplicates are detected.
- Report cadence, audience, and delivery channel.
