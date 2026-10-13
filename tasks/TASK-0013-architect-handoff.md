# TASK-0013: Architect handoff: roadmap, decision records, and consult protocol

- ID: TASK-0013
- State: completed
- Owner: agent
- Created: 2026-10-13
- Last updated: 2026-10-13

## Objective

Give an outside architect - and any implementing agent - a durable entry point
into this repository, so that planning no longer depends on chat history or on a
report pasted between tools.

The problem being solved: the planner saw only a prose summary of finished work,
never the repository itself, and the reasoning behind settled decisions existed
only in conversation. After this task, the repository states what exists, what is
decided, what is still open, and what comes next, and an outside reader can follow
every claim to its source.

## Scope

In scope:

- `docs/ROADMAP.md` - the planning entry point: authoritative-source table, the
  procedure for proposing the next task, the current state, ordered intents with
  dependencies, open questions and size, and the table of open decisions that
  block them.
- `docs/decisions/` - a README stating precedence and format, plus nine decision
  records (`ADR-0001` to `ADR-0009`) transcribed from decisions that are already
  approved in `AGENTS.md`, `docs/architecture.md`,
  `docs/functional-architecture.md`, and `docs/product.md`.
- `docs/consult/` - a README defining a one-question, one-file protocol for
  obtaining an outside opinion, and `TEMPLATE.md` as the packet.
- Pointers to the new entry point from `AGENTS.md` and `README.md`.
- This record and its row in `tasks/INDEX.md`.

Out of scope:

- Any application code, dependency, schema, route, or configuration change.
- Any new architectural decision. The decision records transcribe existing ones.
- Changing the task lifecycle, the record format, or the validator.
- Connecting external accounts, committing, or deploying.

## Acceptance criteria

- [x] `docs/ROADMAP.md` states the current state, ordered intents with their
      dependencies, size, and open questions, and an open-decision table mapping
      each unresolved decision to the item it blocks and the document that records
      it.
- [x] Nine decision records exist, each traced to an authoritative source, each
      naming its consequences and the condition under which it may be reopened.
- [x] No decision record introduces a decision that is not already approved
      elsewhere; where a rationale is not documented anywhere, the record says so
      instead of inventing one.
- [x] `docs/decisions/README.md` states the precedence rule: `AGENTS.md` is
      authoritative and an ADR that contradicts it is the document at fault.
- [x] `docs/consult/` defines a one-question, one-file protocol whose answer is
      pasted verbatim into the packet and committed with the decision.
- [x] `AGENTS.md` and `README.md` point at the new entry point.
- [x] `node scripts/validate-harness.mjs` passes.
- [x] No application code, dependency, architecture rule, or validator check
      changed.

## Verification evidence

Command: `node scripts/validate-harness.mjs`

```
Harness validation passed.
  Markdown files scanned: 36
  Local links checked:    105
  Task records found:     13 (13 completed)
  Project rules:          versions, ESM, ports OK
```

The validator covers the three risks this task introduces: every local Markdown
link in the new documents resolves, this record contains every required section
and the four State fields, and the confirmed architecture rules are untouched.

Structural check of the added files:

```
docs/ROADMAP.md
docs/decisions/README.md
docs/decisions/ADR-0001-project-first-scope.md
docs/decisions/ADR-0002-esm-node24-pnpm-workspace.md
docs/decisions/ADR-0003-application-stack.md
docs/decisions/ADR-0004-single-origin-subpath.md
docs/decisions/ADR-0005-unattended-deployment.md
docs/decisions/ADR-0006-explicit-provider-selection.md
docs/decisions/ADR-0007-credential-encryption.md
docs/decisions/ADR-0008-review-policy-and-idempotency.md
docs/decisions/ADR-0009-no-authentication.md
docs/consult/README.md
docs/consult/TEMPLATE.md
tasks/TASK-0013-architect-handoff.md
```

No application file was modified. The only edits outside `docs/` and `tasks/` are
the two pointer sections in `AGENTS.md` and `README.md`.

## Completion notes

- The decision records are **transcriptions, not proposals**. Every Decision
  section traces to a document that already carried the decision. Where a
  rationale is genuinely not recorded anywhere - the ESM and Node 24 choice in
  [ADR-0002](../docs/decisions/ADR-0002-esm-node24-pnpm-workspace.md) - the record
  states that the constraint is fixed and mechanically enforced rather than
  inventing a justification.
- `AGENTS.md` remains the authoritative rule list; the ADRs explain why a rule
  exists. Precedence is stated in
  [docs/decisions/README.md](../docs/decisions/README.md) so the records cannot
  drift into a competing source of truth.
- The roadmap's ordering is a **proposal**, not a decision. The milestones are
  derived from the "proposed components" and "unresolved decisions" sections of
  the existing documents, not from new product thinking.
- The open-decision table is the load-bearing part of the process: an item cannot
  become a task while a decision it depends on is unrecorded, because the
  procedure requires the ADR first. That is what should stop a planner from
  re-deciding settled ground or skipping a contested one.
- Deliberately **not** included: an authentication decision (it is a limitation,
  recorded as [ADR-0009](../docs/decisions/ADR-0009-no-authentication.md)), and the
  scheduler, job-store, publication-model, and reporting decisions, which stay
  open because the operator has not made them.
- Follow-up worth noting: this repository deploys automatically on every push to
  `main` ([ADR-0005](../docs/decisions/ADR-0005-unattended-deployment.md)), so
  committing this docs-only change produces a release and restarts the services.
  That is why the commit was left to the operator.

## State

- Implementation: complete
- Verification: complete (harness validation passed; output above)
- Commit: not committed
- Deployment: not deployed
