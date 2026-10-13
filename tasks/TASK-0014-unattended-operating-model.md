# TASK-0014: Unattended operating model: decision record and roadmap correction

- ID: TASK-0014
- State: completed
- Owner: agent
- Created: 2026-10-13
- Last updated: 2026-10-13

## Objective

Correct the product direction that made the "automated" pipeline more work than
doing it by hand, and make the correction binding rather than advisory.

**Metric moved: operator actions per published article, currently "many" and
unmeasured, toward the target of 0 after project approval.**

The observed failure: the system asked the operator many questions and required
explicit actions at every step, so a manual flow - ask a model for an article,
paste it into WordPress - remained cheaper than the tool built to replace it.
The cause was not an implementation defect. Nothing in the harness ever measured
operator effort, and every unknown was routed to the operator as a question.

## Scope

In scope:

- `docs/decisions/ADR-0010-unattended-content-pipeline.md` - the operating model:
  unattended by default, one approval per project, an uncertainty-resolution
  ladder instead of blocking questions, post-publication measurement, cheap
  reversal, and a staged rollout from drafts to publication.
- Amending `ADR-0008` in the one place this decision changes it (the default
  publishing mode), while leaving its idempotency rule intact.
- The `AGENTS.md` working rules that mandated the old behaviour, replaced with the
  inverted defaults and the resolution ladder.
- `docs/ROADMAP.md` corrected: the missing success metric, the resolution of
  information gaps as ROADMAP-04, link planning as ROADMAP-05 (it was absent from
  the code, the documentation, and the previous roadmap), a restructured
  milestone order, and a section recording how the roadmap was corrected.
- This record and its row in `tasks/INDEX.md`.

Out of scope:

- Any application code, schema, route, or configuration change. The ladder, link
  planning, the scheduler, and measurement are roadmap items, not this task.
- Weakening idempotency or the external-action record. They are unchanged.
- Committing or pushing.

## Acceptance criteria

- [x] An ADR states the unattended operating model, the zero-operator-action
      target, the resolution ladder, and the staged rollout.
- [x] The ADR names the cause of the previous direction explicitly, including
      that operator effort was never measured.
- [x] `ADR-0008` is amended, not silently contradicted: its status, its default
      mode, and its reopen condition all point at the amending record, and its
      idempotency rule is explicitly unchanged.
- [x] `docs/decisions/README.md` supports an "amended by" status and lists the new
      record.
- [x] `AGENTS.md` no longer says "Default to `review`"; it states the unattended
      default, the opt-in review mode, the resolution ladder, and reversal as a
      recorded external action.
- [x] `docs/ROADMAP.md` opens with the product intent and the metric, states that
      an item adding a mandatory operator step is a defect, and adds the two
      missing capabilities.
- [x] No document claims that the corrected behaviour is implemented. The
      unattended half is described as not existing.
- [x] `node scripts/validate-harness.mjs` passes.

## Verification evidence

Command: `node scripts/validate-harness.mjs`

```
Harness validation passed.
  Markdown files scanned: 38
  Local links checked:    117
  Task records found:     14 (14 completed)
  Project rules:          versions, ESM, ports OK
```

The old default was searched for across every Markdown file rather than trusted
to memory. The search returned two matches, and both are reported here because
"no matches" would have been the convenient and wrong claim:

```
ADR-0010-unattended-content-pipeline.md:73: - `AGENTS.md` no longer says "Default to `review`".
TASK-0014-unattended-operating-model.md:59: - [x] `AGENTS.md` no longer says "Default to `review`"; ...
```

Both are new documents **quoting** the removed rule. `AGENTS.md` itself no longer
contains it, which is the claim that matters.

Repository state at verification. Commit and deployment are separate facts; see
the State section:

```
 M AGENTS.md
 M README.md
 M tasks/INDEX.md
?? docs/ROADMAP.md
?? docs/consult/
?? docs/decisions/
?? tasks/TASK-0013-architect-handoff.md
?? tasks/TASK-0014-unattended-operating-model.md
```

## Completion notes

- **The root cause, written down so it is not repeated:** the project had no
  measurement of its own purpose. Thirteen task records measured correctness and
  safety - do not invent facts, do not publish twice, do not bypass review - and
  not one measured how much work the result put on the operator. The harness
  built, faithfully, what it measured.
- **My own miss, recorded because it is the same failure:** the first
  `docs/ROADMAP.md` (TASK-0013) ordered work by technical dependency and omitted
  link planning entirely, even though it was an explicit product requirement. It
  reproduced the blind spot it was written to remove. That is why
  ROADMAP-04 and ROADMAP-05 exist and why the metric now opens the file.
- The correction is deliberately not a rewrite. The components - topics, briefs,
  drafts, the claim guard, covers, runs, the WordPress export with its
  reconciliation behaviour, unattended deployment - are what the unattended
  pipeline needs. What changed is the operating model, the defaults, and the two
  missing capabilities.
- The one-time project approval in
  [ADR-0010](../docs/decisions/ADR-0010-unattended-content-pipeline.md) is the
  operator's own description of stage one, not a new gate invented here.
- The staged rollout (automatic drafts, publication after N) keeps the existing
  export's safety behaviour while moving the default. The export still never
  requests publish status; introducing publication is ROADMAP-08, not a side
  effect of this decision.
- Open and deliberately unresolved: the digest delivery channel, the URL
  inventory source for internal linking, and the N threshold. All three are listed
  in the open-decisions table of [docs/ROADMAP.md](../docs/ROADMAP.md).

## State

- Implementation: complete
- Verification: complete (harness validation passed; output above)
- Commit: not committed
- Deployment: not deployed
