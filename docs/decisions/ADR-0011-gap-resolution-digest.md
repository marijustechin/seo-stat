# ADR-0011: Gap resolution digest: one record per article run, read-only, non-blocking

- Status: accepted
- Recorded: 2026-10-13
- Source of truth: this record; it implements the recording requirement of
  [ADR-0010](ADR-0010-unattended-content-pipeline.md)
- Amends: none
- Supersedes: none

## Decision

When an article run resolves information requirements, it records what it did in
a **gap resolution digest**. The digest is evidence of how uncertainty was
handled; it is never a gate.

- **One digest per article-generation run.** It is stored as `ContentRun.gapDigest`
  (JSON, nullable). The run is the single source of truth: a draft exposes its
  digest through `ArticleDraft.generationRunId`, which already exists, so there is
  no second copy that could drift.
- **Associated with the draft version** it produced. The digest payload carries the
  run id, the draft id, and the draft version, so the association is explicit
  rather than inferred from ordering.
- **Displayed in two existing places**: the draft workspace, and content-run
  details in Run history.
- **No** email, notification, new reporting subsystem, or mandatory
  acknowledgement. The digest has no state of its own: it cannot be accepted,
  dismissed, or confirmed, because nothing waits on it.

Digest contents, per requirement:

| Field | Meaning |
| --- | --- |
| `requirementId` | The requirement this record resolves |
| `question` | The requirement text, verbatim |
| `operatorState`, `operatorAnswer`, `operatorSourceUrl` | The operator's input, preserved verbatim and never overwritten |
| `action` | `researched`, `rewritten`, `neutral`, `excluded`, `operator_answer`, `unresolved` |
| `evidence` | Source references with retrieval dates, when the action is `researched` |
| `rationale` | Why this action was taken |
| `remainingUncertainty` | What a later verification should still check, or null |

Plus run-level counts, the claim-guard neutralizations, and the research budget
that was used.

### Provenance rule (mechanically enforced)

An `action` of `researched` is recorded **only** when the record cites at least one
URL that was actually retrieved during that run. A model-reported resolution that
cites nothing retrieved is **downgraded to `unresolved`**, and the downgrade is
stated in its rationale. Inference is therefore never labelled as verified
evidence, and the rule is testable rather than a matter of trust.

### Operator input is authoritative and preserved

`answered` and `exclude` are operator decisions. The digest records them as
`operator_answer` and `excluded` and does not let a generated resolution replace
them. A later run may still record its own record for the same requirement; the
operator's value stays readable next to it.

### Non-blocking by construction

The digest is assembled from data the run already produced. If the model reports
nothing, every unresolved requirement is simply recorded as `unresolved` and the
article is still produced. **Assembling the digest cannot fail a run**, and no
code path waits for a human response. A research failure, an exhausted budget, or
an unparsable model resolution all lead to `unresolved`, never to a question.

## Rationale

[ADR-0010](ADR-0010-unattended-content-pipeline.md) removed the blocking questions
but did not say where the record of what was skipped would live. Without that
record, unattended publication loses its audit trail: nobody could later tell
which claims were dropped, which were rewritten, and which rest on a retrieved
source.

The mechanism is deliberately small. A digest is a *read* artifact of a run, so
the cheapest correct design is one nullable JSON column on the run that already
exists, surfaced in the two screens that already show runs and drafts. Anything
larger - a table, a subsystem, a notification channel, an acknowledgement state -
would add a second thing that can be incomplete, and would tempt a future planner
into re-introducing a gate.

## Consequences

- The digest is **read-only in the UI**. No endpoint accepts a digest update.
- It cannot become a prerequisite: no API or UI path requires it to exist, to be
  read, or to be acknowledged before generating, editing, exporting, or
  publishing.
- An article with everything `unresolved` is a valid, successful outcome. The run
  is not failed and the draft is not withheld.
- Because a `researched` action requires retrieved evidence, the digest is
  simultaneously a claim about *what we know* and a list of *what we do not*, and
  the two cannot be confused by prompt phrasing alone.
- A digest on an older run is never recomputed, so regeneration produces a new
  digest and the previous draft versions keep their own.
- The digest is not project knowledge. Nothing is promoted into reusable
  knowledge automatically; that stays an explicit operator action
  ([ADR-0010](ADR-0010-unattended-content-pipeline.md), scope).
- The research budget is recorded per run, which makes "the budget was exhausted"
  an observable fact in the digest instead of a silent truncation.

## Reopen only if

The digest must reach the operator outside the application (email, chat, a
notification), or a second consumer needs it as a first-class entity. Either is a
new record that supersedes this one. **Changing it into an approval gate is not a
reopen**: it contradicts
[ADR-0010](ADR-0010-unattended-content-pipeline.md) and requires that decision to
be reversed first.
