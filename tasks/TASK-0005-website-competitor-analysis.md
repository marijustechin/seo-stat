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
- **Live AI execution was NOT exercised**: no provider credential is present on
  the server (`config/api.env` has DATABASE_URL/PORT/NODE_ENV only). The live
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
  200; `/seo-stat/api/system/status` returned provider `openai`, model
  `gpt-6.1-sol`, `configured:false` (provider since replaced by DeepSeek — see
  the correction below), with the documented limits; nginx serves
  `/seo-stat/`, `/system/`, `/projects/new/`, and the status endpoint (200); the
  app-origin subpath smoke passes; unrelated apps (`/` landing and `/sdr/`) still
  200. The live project list contains `TexTrade UK` with no competitor URLs and
  was not modified.

## Completion notes

- Provider: **DeepSeek** (see the correction below). The OpenAI SDK is retained
  only as the HTTP client for DeepSeek's OpenAI-compatible API; no OpenAI
  credential is required.
- Remaining one-time setup to enable live analysis: set `DEEPSEEK_API_KEY` in
  `/srv/seo-stat/config/api.env` (mode 0600), optionally set
  `ANALYSIS_COST_INPUT_PER_MTOK`/`ANALYSIS_COST_OUTPUT_PER_MTOK` from DeepSeek's
  published pricing, then `systemctl --user restart seo-stat-api.service`. Then
  run the analysis for TexTrade UK from project Settings (suggestions are not
  applied automatically).
- Recommended next task: project-scoped content and workflow/schedule/execution
  management.

## Follow-up: fix the analysis-start request

- Defect: the shared web helper `apiFetch` always set `Content-Type:
  application/json`, so bodyless POSTs — starting an analysis and also archiving
  and restoring a project — sent an empty JSON body that Fastify rejected with
  "Body cannot be empty when content-type is set to 'application/json'".
- Fix: `apiFetch` now sets Content-Type only when a request body is present, so
  bodyless actions omit it. Backend JSON validation was not weakened (Fastify
  still rejects an empty body that declares `application/json`).
- Missing provider handling: the analysis panel reads `/system/status`, shows a
  clear "AI provider is not configured" state, and disables the action while
  unavailable; start errors are mapped to friendly messages instead of surfacing
  the raw HTTP/parser error. The backend configuration check is retained.
- Regression test: `apps/web/src/shared/api/client.spec.ts` exercises the actual
  `apiFetch` helper against a real Fastify server (bodyless POST succeeds; a
  request with a JSON body sends the header and body; GET sends no header; and an
  empty body with `application/json` is rejected, documenting the defect).
- Competitors remain optional; a new integration test covers starting and
  completing an analysis with zero competitors.
- Verification: web unit tests 11 passed (5 regression), API e2e 19 passed
  (including the zero-competitor case); typecheck, lint, build, and harness pass.
- Live after automatic deployment (SHA `5788aff`, CI run 37784900687 succeeded):
  through `https://192.168.8.50/seo-stat/`, `POST .../analysis` with no
  Content-Type reaches the backend and returns `503 {"message":"Analysis is not
  configured on the server."}` (the parser error is gone), while the same POST
  with `Content-Type: application/json` and an empty body still returns `400`
  (Fastify contract preserved; validation not weakened). `/system/status` reports
  `configured:false`, the Settings page loads (200), and health/unrelated apps
  remain 200. Real AI execution remains pending provider configuration.

## Correction — DeepSeek provider

- Per operator direction the application AI provider is **DeepSeek**; OpenAI is
  used separately for planning/supervising development and must not be an
  application requirement.
- Verified against the current official DeepSeek docs: OpenAI-compatible base URL
  `https://api.deepseek.com`; current documented models `deepseek-flash`
  (DeepSeek-V4.1-Flash, default) and `deepseek-v4-pro`; JSON Output via
  `response_format: { type: 'json_object' }` (DeepSeek does not offer strict
  json_schema, so the response is validated with the existing Zod schema).
- Implementation: `DeepSeekAnalysisProvider` (providerId `deepseek`, default
  model `deepseek-flash`, base URL override) behind the unchanged
  `AnalysisProvider` interface. The OpenAI SDK is retained only as the
  OpenAI-compatible HTTP client (compatibility verified against DeepSeek's own
  quick-start); no OpenAI credential is read. Research limits, structured-output
  validation, persistent runs, review/apply behaviour, and project-specific
  usage attribution are unchanged.
- Configuration: `DEEPSEEK_API_KEY` (required to enable), `DEEPSEEK_MODEL`,
  `DEEPSEEK_BASE_URL`; the OpenAI env vars and default are removed. System status
  now reports provider `deepseek`, and the unavailable state references the
  DeepSeek credential.
- Cost: no default price basis; estimated cost stays "cost unavailable" unless
  `ANALYSIS_COST_INPUT_PER_MTOK`/`ANALYSIS_COST_OUTPUT_PER_MTOK` are set from
  DeepSeek's published pricing. OpenAI pricing is not assumed.
- Verification: `deepseek.provider.spec.ts` added (unconfigured without the key,
  configured with it, default model `deepseek-flash`); typecheck, lint, unit
  tests, API e2e, build, harness, and subpath smoke pass; deployed automatically.
- Live AI: still pending — no `DEEPSEEK_API_KEY` is configured on the server.
  Once set, run TexTrade UK's analysis from Settings without applying
  suggestions, and record the observed run.

## State

- Implementation: complete
- Verification: complete for mocked/structural checks and the live deployment;
  live AI execution pending provider configuration (not verified)
- Commit: committed on `main`
- Deployment: deployed automatically by the systemd user timer (verified at
  `3b23046`)
