# TASK-0005: Project website and competitor analysis with reviewable suggestions

- ID: TASK-0005
- State: completed
- Owner: agent
- Created: 2026-10-08
- Last updated: 2026-10-08

## Objective

Implement a real, manually triggered analysis that helps configure a project from
its website, objectives, and optional competitor URLs, producing evidence-based
reviewable suggestions with explicit, selective application. Keep provider access
behind a small backend interface and never expose credentials.

## Scope

In scope:

- Project settings: optional competitor URLs (up to five); an "Analyze website &
  competitors" action with scope explanation, status, previous results, and the
  latest suggestions.
- Bounded, SSRF-protected public research with concrete documented limits.
- Structured output with provenance (user/website/competitor/inference),
  sources, uncertainties, and targeted questions.
- Asynchronous, project-scoped, persistent analysis runs with usage and
  restart-safe interruption handling; analyses shown in Run history.
- Reviewable/selective application of business context, audience summary,
  objectives, and tone; conflict handling; publishing policy unchanged.
- One real AI provider (OpenAI) with global server-side configuration and a
  truthful System status.
- Review-policy semantics clarification.

Out of scope: article generation, WordPress/LinkedIn publication, recurring
schedules, Google metrics, and a general workflow builder.

## Acceptance criteria

- [x] Competitor URLs (add/edit/remove, max five) persisted; never invented.
- [x] Analysis action with scope explanation, status, previous results, latest
      suggestions.
- [x] Input snapshot captured at start, including project `updatedAt`.
- [x] Bounded research with documented page/redirect/size/timeout/retry/AI limits.
- [x] SSRF protections (schemes, ports, credentials, hostnames, private/reserved
      addresses, redirect hops) with evidence and failures recorded.
- [x] Partial competitor failures reported and non-blocking; unreadable project
      website yields an incomplete/failed analysis.
- [x] Structured suggestions with provenance, sources, and separated competitor
      observations; unsupported claims as questions/proposals.
- [x] Editable suggestions with proposed vs current values and selective apply.
- [x] Applying never changes the publishing policy; reanalysis saves new results.
- [x] Changed-settings conflict shown and acknowledged before applying.
- [x] One real provider behind an interface; server-side credential; System
      status without secrets; unavailable state when unconfigured.
- [x] Provider/model and token usage persisted; cost only with a documented price
      basis; per-run output limit enforced.
- [x] Asynchronous runs persisted with statuses, timestamps, evidence, output,
      sanitized errors, usage, and application history.
- [x] Duplicate concurrent runs prevented; reload preserves progress/results;
      restart marks stale runs interrupted and retryable.
- [x] Archived projects reject new analyses and applications; history retained.
- [x] Runs shown in Run history, identified as analyses.

## Verification evidence

- Unit tests (`pnpm --filter @seo-stat/api test`): 13 passed, including SSRF URL
  and address validation, HTML extraction, structured-output schema validation,
  and competitor-URL normalization.
- Integration tests with a mocked provider and fixture research
  (`pnpm --filter @seo-stat/api test:e2e`): 18 passed (2 health + 9 projects +
  7 analysis) covering: run completion with recorded model/usage and
  `cost unavailable`; duplicate start prevention (409); selective application
  that leaves tone unset and publishing policy `review`; changed-settings
  conflict requiring acknowledgement; archived-project rejection of start and
  apply; project isolation (cross-project 404); unavailable provider state (503);
  and interrupted-run reconciliation on startup.
- No paid AI calls are made in CI; research and provider are mocked.
- `typecheck`, `lint`, production builds, harness validation, and subpath smoke
  checks pass; ports 3011/3012 preserved.
- **Live AI execution was NOT exercised**: no `OPENAI_API_KEY` is present on the
  server (`config/api.env` has DATABASE_URL/PORT/NODE_ENV only). The live
  **TexTrade UK** project exists and was left unmodified.
- CI: run 37778966167 on commit `3b23046` succeeded and produced the SHA-tied
  deployment artifact.
- Deployed automatically to `3b23046213229d2212b005d8ca731c092fb1eab3` (state
  outcome `success`). The deploy log shows the pre-migration backup
  (`backing up database before migrations`) then `prisma migrate deploy`
  applying `20261008123232_analysis_runs_and_competitors`; a third backup
  `seo_stat-20261008T124650Z.sql.gz` was written and the `analysis_runs` table
  exists.
- Live after deploy: services on `127.0.0.1:3011`/`3012`; `/seo-stat/api/health`
  200; `/seo-stat/api/system/status` returns provider `openai`, model
  `gpt-6.1-sol`, `configured:false`, with the documented limits; nginx serves
  `/seo-stat/`, `/system/`, `/projects/new/`, and the status endpoint (200); the
  app-origin subpath smoke passes; unrelated apps (`/` landing and `/sdr/`) still
  200. The live project list contains `TexTrade UK` with no competitor URLs and
  was not modified.

## Completion notes

- Provider: OpenAI official SDK, default model `gpt-6.1-sol` (documented balance
  of intelligence and cost); configurable via `OPENAI_MODEL`/`OPENAI_BASE_URL`.
- Remaining one-time setup to enable live analysis: set `OPENAI_API_KEY` in
  `/srv/seo-stat/config/api.env` (mode 0600), optionally set
  `ANALYSIS_COST_INPUT_PER_MTOK`/`ANALYSIS_COST_OUTPUT_PER_MTOK`, then
  `systemctl --user restart seo-stat-api.service`. Then run the analysis for
  TexTrade UK from project Settings (suggestions are not applied automatically).
- Recommended next task: project-scoped content and workflow/schedule/execution
  management.

## State

- Implementation: complete
- Verification: complete for mocked/structural checks and the live deployment;
  live AI execution pending provider configuration (not verified)
- Commit: committed on `main`
- Deployment: deployed automatically by the systemd user timer (verified at
  `3b23046`)
