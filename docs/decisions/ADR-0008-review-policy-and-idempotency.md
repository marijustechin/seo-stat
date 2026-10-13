# ADR-0008: Review-first publishing policy with idempotent external actions

- Status: amended by
  [ADR-0010](ADR-0010-unattended-content-pipeline.md) (default publishing mode
  only; idempotency unchanged)
- Recorded: 2026-10-13
- Source of truth: [AGENTS.md](../../AGENTS.md),
  [docs/functional-architecture.md](../functional-architecture.md)
- Supersedes: none

## Decision

- The publishing mode is configurable **per workflow**: `review` (a human approves
  before any external action) or `automatic`. The default is `review`.
  **Amended by [ADR-0010](ADR-0010-unattended-content-pipeline.md): for the
  content pipeline the default is now `automatic` after a one-time project
  approval, and `review` is a per-project opt-in.**
- Every external action records its result and is **idempotent**: the same item is
  never published twice.
- A failed step must be recoverable **without repeating already-successful
  publication steps**.
- Applying proposed project settings always requires an explicit user action.
- Manually requested public website research may execute without further approval.
- The WordPress export always creates or updates a **draft** and never requests
  publish or scheduled status, regardless of the project publishing policy.

## Rationale

Recorded in `AGENTS.md` and the review-policy semantics of the functional
architecture. Two principles combine:

- Approval is about **irreversible external effects**, not about every model call.
  Research is reversible; publishing is not.
- The WordPress export deliberately cannot bypass the publication review policy,
  because it never publishes. Draft creation is a reversible external effect, so
  it does not need the full gate - but it still must not be repeated blindly.

## Consequences

- Idempotency is achieved by **recorded outcomes**, not by hoping a retry is safe.
  An ambiguous timeout becomes **outcome uncertain** and requires reconciliation;
  a create is never blindly retried.
- Partial success is recorded (for example an uploaded media id) so the next
  attempt resumes instead of duplicating.
- Concurrent external actions for one item are prevented at the storage level
  (a partial unique index on in-progress attempts).
- Remote drift is respected: a remotely edited post, or one no longer a draft, is
  detected and never overwritten or converted back to a draft.
- Every future channel (WordPress publication, LinkedIn, Google reporting) reuses
  this record-and-reconcile pattern rather than inventing a second one.
- Failure and uncertainty are shown in the UI. A step that is knowingly
  unreconciled is stated as such, not reported as success.

## Reopen only if

Never in principle. The mechanism around it may change - a queue, a different
record shape, other statuses - but weakening "never publish the same item twice"
or defaulting to `automatic` requires an explicit operator decision recorded as a
new ADR. The default was changed that way in
[ADR-0010](ADR-0010-unattended-content-pipeline.md); the idempotency rule was not
weakened.
