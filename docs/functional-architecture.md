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
  chars, 2 500 output tokens.
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
- Provider: one provider behind a small interface (OpenAI). Configuration is
  global and server-side; inputs/results/usage are project-scoped. Model and
  token usage are recorded per run; estimated cost appears only when a
  documented price basis is configured, otherwise "cost unavailable".
- Archived projects cannot start analyses or apply suggestions; history is kept.

## Review policy semantics

- Manually requested public website research may execute without another
  approval.
- Applying proposed project settings always requires the user's explicit action.
- Publishing, sending messages, and modifying external systems remain subject to
  the project's review policy.

## Planned capabilities (not implemented)

- Content research and generation.
- Workflow definitions, schedules, and execution history.
- External integrations and credentials.
- Metrics, reports, and aggregate costs.

## Visual design (approved)

The current visual language is approved and must be preserved: the light/dark
color variables, card-based layout, top navigation, muted text, status colors,
6/10px radii, and spacing defined in `apps/web/src/app/globals.css`. New UI
extends the existing components and classes; it does not redesign the
application.
