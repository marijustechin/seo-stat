# Functional architecture (approved)

The operator approved a project-first functional architecture. This is the
authoritative description of scope and ownership; the technical stack is in
`docs/architecture.md` and `AGENTS.md`.

## Scope model

- **Global scope** contains:
  - project management (create, list, archive, restore),
  - system settings,
  - aggregate costs.
- **Project scope** is one specific business or brand. Each project owns its:
  - settings,
  - content,
  - workflows (definitions),
  - schedules,
  - execution history,
  - integrations,
  - metrics,
  - reports.

Ownership rule: project-specific data is always stored with a project id.
Global features (including aggregate costs) must not hold project data outside a
project. Project identity is the generated id and is stable across name or
website changes.

## Definitions

- **Workflow definition**: a reusable description of steps. Not a run.
- **Schedule**: a trigger that launches a workflow at times; owns timezone and
  missed-run handling.
- **Execution**: a single run of a workflow (or of a scheduled launch), with its
  own history and result.

These are deliberately distinct. A schedule is not a workflow, and neither is an
execution.

## Shared AI access and attribution

Shared AI provider access may be reused across projects, but usage and cost
attribution must remain project-specific. Aggregate costs are a global view over
per-project attributions, never a replacement for them.

## Implemented today (TASK-0004)

- Project persistence in PostgreSQL with committed Prisma migrations.
- Projects API: create, list, retrieve, update, settings, archive, restore.
- Project list as the application entry screen, with archived filtering.
- Project workspace with sections Overview, Content, Automation, Run history,
  Metrics & reports, and Settings.
- Overview and Settings are functional. Content, Automation, Run history, and
  Metrics & reports show explicit "not implemented yet" states.

## Website & competitor analysis (implemented, TASK-0005)

A manually triggered, project-scoped analysis helps configure a project from its
website, objectives, and optional competitor URLs.

- Inputs (snapshotted at start): website URL, competitor URLs, business context,
  audience, objectives, tone, content language, and the project's `updatedAt`
  for conflict detection.
- Research: a bounded selection of relevant public pages (home, about, services,
  audience, contact) from the project site and each competitor. Concrete limits:
  up to 6 project pages, 3 per competitor, 15 pages total, 5 competitors, 4
  redirects, 2 MB per page, 10 s timeout, 1 retry, 8 000 chars/page, 60 000 input
  chars, 8 000 output tokens (thinking mode is disabled for the analysis call so
  the budget is spent on the JSON answer).
- Research backends: **Firecrawl** is preferred when `FIRECRAWL_API_KEY` is
  configured and acquires clean Markdown for the selected pages; otherwise the
  direct fetch backend is used. Firecrawl never runs an unrestricted full-domain
  crawl (individual URLs only). Both backends preserve the same page/input/time
  limits and treat fetched content as untrusted. Difference: the direct backend
  enforces public-URL rules at connect time (DNS/IP, redirect hops), whereas
  Firecrawl fetches from its own network, so we still pre-validate every URL we
  send but the provider's egress governs its actual fetch. Each run records its
  backend, source URLs, retrieval timestamps, failures, and any Firecrawl-reported
  credit usage (null when not reported).
- SSRF protection: only http/https on ports 80/443; credentials, localhost and
  internal hostnames, and private/loopback/link-local/metadata/reserved
  addresses are rejected at connect time (DNS resolution and every redirect hop).
  Fetched text is untrusted research material, never instructions.
- Output: structured suggestions for business context, multiple audience
  segments (needs, offering, desired action, content directions), a clearer
  objectives formulation, tone, content themes, and missing-information
  questions. Each suggestion records provenance (`user`, `website`,
  `competitor`, `inference`), confidence, rationale, and source links. Competitor
  observations are kept separate; unsupported claims stay questions/proposals.
- Review and apply: results are editable suggestions with proposed vs current
  values. Applying is explicit and selective (business context, audience
  summary, objectives, tone). Applying never changes the publishing policy. A
  reanalysis is a new saved result and does not overwrite approved settings.
  If the project changed since the run started, the conflict is shown and must
  be acknowledged before applying.
- Execution: asynchronous in-process runner (not a workflow engine), one active
  run per project, persisted runs (queued/running/completed/failed/interrupted)
  with input snapshot, evidence, structured output, sanitized errors, and usage.
  A restart marks stale queued/running runs interrupted and retryable. Analyses
  appear in project Run history.
- Provider: one provider behind a small interface (DeepSeek). Configuration is
  global and server-side; inputs/results/usage are project-scoped. The model and
  token usage are recorded per run; estimated cost appears only when a documented
  price basis is configured, otherwise "cost unavailable". No OpenAI credential
  is required.
- Archived projects cannot start analyses or apply suggestions; history is kept.

## Content workflow (implemented, TASK-0007)

The project Content section implements the first content workflow: suggest topics,
select a topic, review/edit a brief, generate an article draft, and edit/review it.

- Topic suggestions (up to five) are generated from the project's **saved**
  settings (business context, audience, objectives, content language, tone);
  unapplied analysis suggestions are never substituted. Prior analysis research
  evidence may inform proposals with source attribution and retrieval dates.
  Each topic records title, audience, objective, reader need, angle, call to
  action, relevance, information needed, an `objectiveAlignment` (the stated
  objective it serves), and a `priority` (`primary` when it directly serves the
  stated primary objective, otherwise `secondary`/`supporting`). Alignment and
  priority are shown so the user can see commercial relevance while still
  selecting any audience. No invented search volumes, keyword difficulty,
  rankings, or traffic. Topics can be created manually, edited, and dismissed;
  repeated generation avoids obvious duplicates.
- The brief is editable and prefilled from the topic and saved context (title,
  angle, audience, business outcome, outline, call to action, destination URL,
  sources, confirmations). Unknown operational details stay unknown. Generation
  only starts on an explicit action.
- Research uses the existing Firecrawl/direct-fetch coordinator with the same
  bounds and URL/untrusted-content protections. Generated articles include
  title, excerpt, Markdown body, slug, SEO title, meta description, call to
  action, sources, and material claims requiring confirmation. SEO fields are
  editable proposals validated against storage limits. A claim guard neutralizes
  unsupported absolute claims (for example "zero landfill", "100%", "guaranteed",
  "certified", "carbon neutral", or superlatives) in the title, excerpt, SEO
  fields, and call to action, and records them under unresolved claims; it does
  not claim to verify facts automatically.
- Drafts are versioned per topic; regeneration appends a new version and keeps
  the previous one. Manual saving works without an AI call. Stale saves are
  rejected (optimistic concurrency). "Ready for review" means available for
  human review, not publication approval. Unresolved claims are shown before
  marking ready.
- Topic and article generations are asynchronous runs with the same pattern as
  analyses (visible status, duplicate-start protection, interrupted handling,
  sanitized errors, provider/model/usage, cost only with a price basis), shown
  in Run history distinct from analyses. Archived projects keep content history
  but reject new generation and editing.

## Content information requirements, answers, and knowledge (implemented, TASK-0008)

- A topic carries **information requirements**: the questions that must be
  answered before writing. Each requirement has a stable id, the question text,
  an optional answer and source reference, and a state:
  `unanswered`, `answered`, `unknown`, or `exclude`.
- Users answer requirements in the topic editor and in the brief. Answers are
  saved per topic and per brief and are included in the article generation
  snapshot. `unknown` is rendered to the model as "do not invent an answer", and
  `exclude` means the claim must not appear; neither is treated as established
  fact, and answers are treated as user-provided information rather than
  independently verified website evidence.
- Switching topics preserves each topic's answers and never copies one topic's
  answers onto another. An unsaved brief edit is protected by a discard
  confirmation before switching.
- An answered requirement can be **kept as reusable project knowledge**: a
  project-scoped note (with its originating question) that is included in later
  article prompts. Knowledge can be listed, edited, and removed.
- Two UI changes make the workflow clearer: "Use topic" is renamed
  "Prepare article brief" (it only prepares and scrolls to the brief; generation
  still requires an explicit action), and a draft generated from an earlier brief
  is flagged **stale** ("brief changed since generation") so the user can
  regenerate.

## Article cover images (implemented, TASK-0009)

- A draft can have cover images: generated from a visual brief or uploaded
  (PNG/JPEG/WebP, size-limited). Each image records kind, status, prompt, alt
  text, provider/model, dimensions, bytes, usage, and selected state.
- The **visual prompt is editable** on an existing generated image (saved with
  `PATCH`), and **regeneration is explicit** (the per-image "Regenerate" and the
  top-level "Generate cover image" actions). Regeneration always appends a new
  version; **previous images are preserved** and listed. Generation-usage records
  (the provider's `usage` object) and provider/model are stored per generated
  image and shown in the UI.
- Images are project- and draft-scoped. Files are stored outside the release
  directory (`CONTENT_ASSET_DIR`) and served through the project-scoped API route
  `GET /projects/:projectId/content/images/:imageId/file`. **The application has
  no authentication**: the route validates only project/draft association, so
  another project gets 404 and a request without any credential succeeds. The
  stored path is treated as a basename to prevent traversal. Archived projects
  cannot change images.
- Only the **selected** image is the intended cover; a generated image is a draft
  visual, not an editorially verified asset. Image generation is a separate
  capability with its own credential: when unconfigured, the API returns 503, the
  UI shows an unavailable state, and uploads still work. The System page reports
  the image provider, model, and configuration separately.
- **Provider selection is explicit** (`IMAGE_PROVIDER`). The selected provider for
  SEO-STAT is **Cloudflare Workers AI** with `@cf/black-forest-labs/flux-1-schnell`
  (the Workers **Free** plan): `POST .../accounts/{accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`
  with Bearer auth and the documented `prompt` (max 2048 chars) and `steps`
  (1-8, default 4) parameters. The JSON envelope is validated, `result.image` is
  decoded, and the **actual format/dimensions are detected from the bytes** (FLUX
  returns JPEG, stored and served as JPEG). A stray `IMAGE_API_KEY` does not enable
  OpenAI or cause a fallback; `IMAGE_PROVIDER=openai` is the only way to select
  OpenAI, and DeepSeek remains the text provider.
- The submitted prompt and generation parameters are recorded per attempt. Usage
  is recorded only when the provider reports it; Cloudflare does not, so the UI
  states "usage not reported" rather than inventing tokens, quota, or zero cost.
  Cloudflare error codes are distinguished: `3036` (free daily allocation
  exhausted) and `3040` (temporary capacity) are surfaced as clear 429 messages,
  `5035` (paid-only) is reported without upgrading, and timeouts are separated;
  quota exhaustion is not retried and never falls back to a paid provider. Failed
  attempts are retained in the per-draft history.

## WordPress integration and article export (implemented, TASK-0010)

Project Settings has a **WordPress** section: site URL, username, and a dedicated
Application Password, with save, test connection, replace credential, and
disconnect; it shows configured/unconfigured and connection-test states.

- Connections use HTTPS only. Credentials are stored server-side with
  authenticated encryption (AES-256-GCM) under a deployment-managed key that
  lives outside the release directories. The stored password is never returned to
  the browser, logged, put in an API error, or committed; leaving the password
  field blank preserves the stored credential.
- The connection test verifies the authenticated identity and inspects its
  capabilities (`GET /wp-json/wp/v2/users/me?context=edit`) and **creates no
  content**. Outbound requests use the shared public-URL/SSRF protections, and
  authentication headers are never forwarded to a different origin after a
  redirect.
- The article draft has an explicit **"Send draft to WordPress"** action. Before
  exporting it shows the destination site, article title, selected cover, and the
  fact that the WordPress post will remain a **draft**. Only persisted article
  values and the selected cover are exported; unsaved edits are detected and block
  the action. Mapping: title, slug, excerpt; Markdown body converted to safe HTML
  (raw HTML escaped; links limited to http/https); the selected cover uploaded to
  WordPress and assigned as featured media, with its alt text. Sources and
  unresolved claims stay available in SEO-STAT, and internal review notes are not
  appended to the body. SEO title and meta description remain local and are not
  claimed to be synchronized with Yoast or any SEO plugin. **The export never
  requests publish or scheduled status, regardless of the project publishing
  policy.**
- Every attempt is persisted with the local draft/version identity, destination,
  payload hash, remote post/media ids, timestamps, outcome, and sanitized errors.
  Concurrent exports for one draft are prevented (a partial unique index on
  in-progress attempts); after a confirmed success, later exports update the same
  remote draft and reuse unchanged uploaded media. Partial success records the
  uploaded media id. An ambiguous timeout becomes **outcome uncertain** and
  requires reconciliation — a create is never blindly retried. Remote edits or a
  remote post that is no longer a draft are detected and are never overwritten or
  converted back to a draft. The UI shows the export state, last exported
  version, changes since export, and a link to the WordPress editor. Archived
  projects keep export history but reject exports and updates.

## Review policy semantics

- Manually requested public website research may execute without another
  approval.
- Applying proposed project settings always requires the user's explicit action.
- Publishing, sending messages, and modifying external systems remain subject to
  the project's review policy. The WordPress export always creates/updates a
  WordPress **draft** and never publishes or schedules, so it does not bypass the
  review policy for publication.

## Planned capabilities (not implemented)

- Workflow definitions, schedules, and execution history.
- LinkedIn publishing and external integrations beyond the WordPress draft export.
- Metrics, reports, and aggregate costs.

## Visual design (approved)

The current visual language is approved and must be preserved: the light/dark
color variables, card-based layout, top navigation, muted text, status colors,
6/10px radii, and spacing defined in `apps/web/src/app/globals.css`. New UI
extends the existing components and classes; it does not redesign the
application.
