# ADR-0001: Project-first scope and ownership

- Status: accepted
- Recorded: 2026-10-13
- Source of truth: [docs/functional-architecture.md](../functional-architecture.md)
- Supersedes: none

## Decision

The application is organized around **projects**. A project is one specific
business or brand and owns its settings, content, workflows (definitions),
schedules, execution history, integrations, metrics, and reports.

**Global scope** contains only project management (create, list, archive,
restore), system settings, and aggregate costs.

Project-specific data is always stored with a project id. Project identity is the
generated id and is stable across name or website changes.

## Rationale

Documented in the approved functional architecture: global features - including
aggregate costs - must not hold project data outside a project. Shared AI provider
access may be reused across projects, but usage and cost attribution must remain
project-specific; aggregate costs are a view over per-project attributions, never
a replacement for them.

## Consequences

- Every new domain table needs a project id, unless it is explicitly global. That
  exception must be argued in the task record.
- Archiving a project keeps its history and rejects new generation, editing,
  exports, and analyses. Archived behaviour is a per-module obligation, not a
  global switch.
- Provider credentials and model configuration may be global and server-side,
  while inputs, results, and usage stay project-scoped.
- Aggregate views are derived. They may never become the only place a number
  lives.

## Reopen only if

A capability genuinely cannot be attributed to a single project. Then record the
exception as a new ADR naming the data that has no project owner, and update
[docs/functional-architecture.md](../functional-architecture.md) in the same
change.
