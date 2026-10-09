# TASK-0007: Project content topics and the first reviewable article draft

- ID: TASK-0007
- State: completed
- Owner: agent
- Created: 2026-10-09
- Last updated: 2026-10-09

## Objective

Implement the first real content workflow in the project Content section:
suggest topics from saved settings, select a topic, review/edit a brief,
generate an article draft, and edit/review it. Reuse the existing providers,
research, persistent execution, project isolation, deployment, and design.

## Scope

In scope:

- Business-driven topic suggestions (up to five) from saved settings, with prior
  analysis evidence for attribution; persisted, manually creatable/editable/
  dismissable; duplicate-aware regeneration.
- Editable article brief prefilled from the topic and saved context.
- Bounded research via the existing Firecrawl/direct coordinator; generated
  article draft with title, excerpt, Markdown body, slug, SEO title, meta
  description, call to action, sources, and material claims requiring
  confirmation.
- A project-scoped Content workspace (topic/draft lists, brief editor, Markdown
  editor with safe preview, sources/unresolved-claims panel, save feedback,
  ready-for-review status).
- Versioned, project-scoped persistence with generation snapshots; manual saving
  without AI; explicit regeneration preserving prior versions; stale-save
  handling; asynchronous runs shown in Run history; archived-project
  restrictions.

Out of scope: WordPress/LinkedIn integration, external publication, recurring
schedules, Google metrics, and a general workflow builder.

## Acceptance criteria

- [x] Topic suggestions generated from saved settings; unapplied analysis
      suggestions not substituted; prior evidence attributed with dates; no
      invented metrics or keyword volumes.
- [x] Manual topic create, edit, and dismiss; regeneration preserves work and
      avoids obvious duplicates.
- [x] Editable brief prefilled from topic and context; unknown operational
      details stay unknown; generation starts only on explicit action.
- [x] Draft generation uses bounded research with URL/untrusted protections and
      records actual coverage and failures.
- [x] Draft output validated against storage/editor constraints.
- [x] Content workspace replaces the placeholder with lists, editors, preview,
      sources/claims, save feedback, and ready-for-review.
- [x] Persistence with stable identities and generation snapshots.
- [x] Manual save without an AI call; regeneration appends a version; stale saves
      rejected.
- [x] Asynchronous runs: status across reloads, duplicate-start protection,
      interrupted/failed handling, sanitized errors, provider/model/usage, cost
      only with a price basis; shown in Run history.
- [x] Archived projects retain history but reject new generation/editing.

## Verification evidence

- API integration tests with a mocked provider and fixture research
  (`pnpm --filter @seo-stat/api test:e2e`): **29 passed** (2 health + 9 projects
  + 9 analysis + 10 content). Content coverage: topic generation from saved
  settings (run snapshot equals the saved values) with duplicate-start 409;
  manual create/edit/dismiss; brief prefill/save; draft generation with manual
  save and stale-save 409; regeneration producing versions 1 and 2; over-long
  topic arrays clamped; sanitized failures (address/URL redacted); interrupted
  run reconciliation; project isolation (404); archived-project rejection of
  generation and editing while history remains readable.
- Web unit tests: **18 passed**, including the safe Markdown renderer (headings/
  lists/emphasis; raw HTML escaped; unsafe link schemes rejected; safe http links
  rendered). `react-dom/server` renders the preview elements without executing
  HTML.
- `typecheck`, `lint`, and production builds pass; harness validation passes;
  ports 3011/3012 preserved.
- No paid AI calls in CI (provider and research are mocked).

## Live verification (deployed release)

- Deployed automatically (with a pre-migration backup) to
  `68fd45fdbe5bf4660346814d47b6c1737937fb48`; migration
  `20261009070146_content_topics_briefs_drafts` applied; health 200.
- Provider configured (`deepseek-flash`); Firecrawl not configured, so research
  used the `direct` backend.
- **Topic generation** on TexTrade UK completed (run `8bd7a86c…`, 2399 input /
  1712 output tokens, cost unavailable). It produced 5 distinct topics with
  distinct audiences, including a brand/retailer topic ("What Happens to Unsold,
  Outdated and End-of-Season Clothing? A Responsible Brand Surplus Process") and
  separate audiences for consumers, charities/schools, wholesale buyers, and
  councils.
- **Article draft** generation completed (run `b7cab1bb…`, 11085 input / 1842
  output tokens, cost unavailable) and saved as **version 1, status `draft`**
  (not ready for review): title "What Happens to Your Donated Clothes? Reuse,
  Recycling and Zero Landfill Explained", slug
  `what-happens-to-donated-clothes-reuse-recycling-zero-landfill`, 5442 body
  characters, 4 sources, 5 unresolved claims. It is available in the project
  Content section (draft id `aebcf00d…`) for human review; suggestions were not
  published and project settings were not changed.
- Research limitation: TexTrade UK's saved settings are minimal (business
  context/audience/objectives empty), so topics relied on the website plus prior
  analysis evidence; the draft accordingly carries unresolved claims to confirm.

## Completion notes

- New Prisma models: `content_topics`, `article_briefs`, `article_drafts`,
  `content_runs` (migration `20261009070146_content_topics_briefs_drafts`).
- The content runner reuses the existing `AnalysisProvider` (DeepSeek) and the
  `AnalysisResearch` coordinator, and mirrors the analysis runner's in-process
  queue and restart reconciliation.
- The Markdown renderer is dependency-free and builds React elements (no
  `dangerouslySetInnerHTML`); no rich-text editor dependency was added.
- UI journey note: the deployed Content page and its same-origin API journey were
  exercised; a scripted real-browser click-through was not available in this
  environment (see the record's live notes).
- Deployment finding: after a mid-session host reboot the systemd user
  `seo-stat-deploy.timer` was found inactive and had to be re-armed with
  `systemctl --user start seo-stat-deploy.timer`; auto-deployment resumed. The
  reboot behaviour should be re-verified.

## State

- Implementation: complete
- Verification: complete for mocked/structural checks and a real TexTrade UK
  topic + article-draft run (draft left unapplied)
- Commit: committed on `main`
- Deployment: deployed automatically by the systemd user timer (verified at
  `68fd45f`; timer re-armed after a host reboot)
