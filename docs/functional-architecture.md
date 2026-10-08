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
