# ADR-0010: Unattended content pipeline as the default operating model

- Status: accepted
- Recorded: 2026-10-13
- Source of truth: this record; it amends [AGENTS.md](../../AGENTS.md) and
  [ADR-0008](ADR-0008-review-policy-and-idempotency.md)
- Amends: ADR-0008, default publishing mode only
- Supersedes: none

## Decision

`seo-stat` is an **unattended** SEO content pipeline.

- The operator's only mandatory gate is **once per project**: approving (or
  editing and approving) the website and competitor analysis, and setting the
  publication interval. Everything downstream depends on those two facts.
- After that approval, topic selection, brief, draft, link plan, cover image, and
  publication proceed **without operator actions**. The target is **zero routine
  operator actions per published article**.
- **An uncertainty must never become a blocking question.** The resolution ladder
  is, in order:
  1. resolve it by research;
  2. rewrite the content so the claim is not needed;
  3. publish with neutral wording;
  4. record it for post-publication verification.

  Unresolved items are collected into a **non-blocking digest**. They never gate
  progress.
- Quality is judged **after publication**, by measurement, with **reversal** as the
  correction path.
- `review` mode (human approval before an external action) remains available as a
  **per-project opt-in**. It is no longer the default.
- Idempotency and external-action records are **unchanged** and remain in force
  from ADR-0008. Reversal (edit, retract, regenerate) becomes a first-class
  external action with its own record.
- Rollout: the first automatic cycles create WordPress **drafts**. Publication
  status is enabled after N consecutive successful unattended articles, where N is
  chosen by the operator. Until that flip, draft creation is the external action.

## Rationale

The first product direction optimized for correctness and safety. Measured task by
task, it produced a system that asked the operator more questions than it answered
and required an explicit action at every step - so a manual flow (ask a model for
an article, paste it into WordPress) stayed cheaper than the "automated" one.

Two recorded facts explain it, and neither is an implementation bug:

- Nothing in the task records or in the acceptance criteria ever measured operator
  effort. The harness built, faithfully, what it measured: correctness and
  reversibility.
- Every unknown was routed to the operator. Information requirements asked
  questions before writing; unsupported claims were listed for confirmation. The
  system's answer to uncertainty was to ask.

A gate is worth its cost only when the mistake it prevents costs more than the
gate. Here the mistake is cheap and reversible: an article can be edited,
retracted, or regenerated after publication, and measurement shows whether it
worked. Pre-publication interrogation was therefore the more expensive error.

The one-time project approval is the gate whose value clearly exceeds its cost: it
fixes the audience, tone, language, and cadence that everything downstream
depends on.

## Consequences

- **A blocking question is now a defect.** A task that adds a mandatory human
  answer before publication contradicts this record.
- The information-requirement data is kept but loses its authority: unanswered
  requirements are rendered to the model as unknown and resolved by the ladder,
  not by waiting for the operator. Excluding a claim (`exclude`) and answering one
  (`answered`) remain available as operator *input*, not as a prerequisite.
- `AGENTS.md` no longer says "Default to `review`".
- Measurement becomes load-bearing rather than a later feature: without search
  performance feedback, unattended publication has no quality signal at all. The
  measurement loop is part of this model.
- Reversal must be genuinely cheap and recorded, because it replaces
  pre-publication review as the correction path.
- The staged rollout (drafts first, publication after N) is what makes the
  inversion safe. It is a rollout detail, not a permanent gate.
- The absence of authentication
  ([ADR-0009](ADR-0009-no-authentication.md)) becomes more consequential: the
  system now acts without a human watching. The private network remains the
  boundary, and it matters more than before.
- Review mode is still the right choice for a client-facing or regulated project.
  It is a **setting**, and the system must keep working when it is on.

## Reopen only if

Unattended publication demonstrably produces harmful content. The response is then
to tighten the resolution ladder (fewer claims published without verification) or
to enable review for that project - **not** to restore per-article gating as the
system default. That would return to the model this record replaces.
