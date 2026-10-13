# TASK-0015: Resolve article information gaps without operator intervention

- ID: TASK-0015
- State: completed
- Owner: agent
- Created: 2026-10-13
- Last updated: 2026-10-13

## Objective

Implement ROADMAP-04 according to [ADR-0010](../docs/decisions/ADR-0010-unattended-content-pipeline.md).

Article generation must resolve information gaps through research, rewriting, or
neutral wording, then record remaining uncertainty in a non-blocking digest.

**Metric: required operator answers before a draft can proceed = 0.** Reported
below.

This task makes article generation capable of proceeding unattended. It does not
implement the scheduler or the complete unattended publication pipeline.

## Scope

In scope:

1. **Resolution ladder** per information requirement: resolve from project
   knowledge and relevant research, then rewrite so the claim is unnecessary, then
   use neutral wording, then record the uncertainty without blocking. Applies to
   body, title, excerpt, SEO title, meta description, and call to action.
2. **Optional operator input preserved**: `answered` used with its stated
   provenance, `exclude` omits the claim, `unanswered` and `unknown` resolved
   through the ladder without waiting.
3. **Bounded research reuse** with a documented total per-run budget.
4. **Persisted decisions and digest** per [ADR-0011](../docs/decisions/ADR-0011-gap-resolution-digest.md).
5. **Non-blocking UI** wording and digest display.

Out of scope, per the task statement: workflow definitions, schedules, workers and
publication intervals; automatic WordPress export or publication, LinkedIn, link
planning and measurement; changes to publishing policies or review gates for
external actions; AI/image providers, credentials, deployment tooling; automatic
promotion of findings into approved project knowledge; and any claim that the
complete unattended pipeline now exists.

## Acceptance criteria

- [x] 1. A topic with unanswered requirements produces a persisted draft without
      operator answers. Covered by the end-to-end test "produces a draft and a gap
      digest when the operator answers nothing at all", which uses the generated
      topic path so the requirements are the ones the product itself created.
- [x] 2. Available evidence resolves a requirement with recorded source
      provenance. The digest record carries the URL, the page title, and the
      retrieval date, and the end-to-end test asserts all three.
- [x] 3. Inaccessible sources, inconclusive research, and exhausted research
      budgets lead to supported content rather than a blocking question. Covered
      by the end-to-end test with an empty page set and a recorded fetch failure.
- [x] 4. An unsupported locator, named partnership, certification, or
      zero-landfill claim is omitted or rewritten without implying it is
      established. The claim guard now covers the article body as well as the
      presentation fields, and every neutralization is recorded in the digest.
- [x] 5. Optional answers and exclusions affect generation correctly, including
      when the model reports a different resolution for the same requirement.
- [x] 6. The digest survives reload and remains associated with the correct run
      and draft version, on the run view, the draft view, and the draft list.
- [x] 7. Regeneration preserves previous drafts and their resolution history; each
      version keeps its own digest.
- [x] 8. No UI or API prerequisite requires answering or acknowledging information
      gaps. Reconnaissance established that generation was already ungated; the
      blocking was presentational, and the prerequisite wording is replaced. The
      digest exposes no control of any kind.
- [x] 9. Project isolation, archived-project restrictions, stale-save protection,
      and existing publishing policies remain intact. Covered by the existing
      end-to-end tests, which still pass unchanged.
- [x] 10. Provider, database, or malformed-output failures still produce truthful
      failed runs. Covered by an end-to-end test asserting `failed`, a non-empty
      sanitized error, a null digest, and no draft.

## Verification evidence

Unit tests, `pnpm -C apps/api test`:

```
 Test Files  16 passed (16)
      Tests  82 passed (82)
```

New unit coverage: `content.digest.spec.ts` (12 tests: provenance, downgrade of an
unsupported `researched` claim, evidence dropped by the budget, unreported
requirements, operator answer and exclusion preservation, evidence cap, run
association, and unusable input), `content.research.spec.ts` (4 tests: page cap,
character cap, within-budget pass-through, backend and failure preservation), and
`content.claims.spec.ts` extended to 5 tests including body neutralization.

End-to-end tests against PostgreSQL 17 (`pnpm db:up`, `prisma migrate deploy`,
then `pnpm --filter @seo-stat/api test:e2e`):

```
 Test Files  5 passed (5)
      Tests  55 passed (55)
```

`test/content.e2e-spec.ts` now contains 24 tests, six of them new. They exercise
the real orchestration and persistence path - run creation, the generation runner,
Prisma writes, and the read endpoints - not only prompt helpers.

Full workspace checks, all exit 0: `pnpm -r typecheck`, `pnpm -r lint`,
`pnpm -r test`, `pnpm -r build`.

Migration `20261013120000_content_run_gap_digest` applied by
`prisma migrate deploy`, adding `content_runs.gap_digest` (JSONB).

Metric: **0** operator answers are required before a draft can proceed. The
end-to-end regression case answers nothing, has no retrievable research, and still
produces a completed draft with a persisted digest.

Harness validation, `node scripts/validate-harness.mjs`:

```
Harness validation passed.
  Markdown files scanned: 40
  Local links checked:    132
  Task records found:     15 (15 completed)
  Project rules:          versions, ESM, ports OK
```

**Not verified in a browser.** There is no browser access from this environment
(ROADMAP-14), so the UI half is verified by typecheck and lint only. The digest
panel has not been rendered against a live API payload. This is recorded as a
limitation, not as a verified result.

## Completion notes

- **Reconnaissance corrected the premise of the task.** Generation was never gated
  on requirement state, in the API or in the UI. What the operator experienced was
  presentational: the labels "Needed before writing", "x/y answered", and
  "require confirmation before review", plus the fact that nothing recorded what
  had been skipped. The work therefore replaced the wording and added the record
  rather than removing a check. Had the premise been taken on trust, the task would
  have "removed" a gate that did not exist and left the experience unchanged.
- The digest is stored **once**, on `ContentRun`, and reached from a draft through
  the existing `ArticleDraft.generationRunId`. There is no second copy, so there is
  nothing to drift ([ADR-0011](../docs/decisions/ADR-0011-gap-resolution-digest.md)).
- **Provenance is enforced, not requested.** A resolution is recorded as
  `researched` only when it cites a URL that was actually retrieved during that
  run. A model claim citing anything else is downgraded to `unresolved`, and the
  downgrade says why. The end-to-end test asserts this with a deliberately
  invented URL.
- **Operator input wins.** `answered` and `exclude` are decided server-side and
  override whatever the model reports for the same requirement, including a model
  attempt to neutralize an exclusion. Answers are never relabelled as verified
  evidence.
- **The per-run research budget is enforced in the content layer**
  (`content.research.ts`, 8 pages / 30 000 characters) rather than in the shared
  analysis port, so analysis behaviour is untouched. The article run performs one
  bounded research call; nothing is retried until an answer appears. `droppedPages`
  makes exhaustion observable instead of silent.
- **The claim guard now covers the body.** It previously neutralized only the
  title, excerpt, SEO fields, and call to action, so an absolute claim in the body
  survived verbatim. It now returns structured neutralizations that the digest
  records.
- `gapResolutions` is optional in the model schema (`.default([])`). A terser or
  older model answer still produces an article, and every open requirement is then
  recorded as `unresolved`. Absence of a report never fails a run.
- **Digest assembly cannot fail a run.** It tolerates missing or malformed inputs,
  is never awaited on a human, and has no acknowledgement state.
- **Limitations, stated plainly.** Browser rendering of the digest panel is
  unverified. The prompt-level part of the ladder (rewriting prose so a claim is
  unnecessary) is instructed and recorded, not mechanically verified; the
  mechanically enforced parts are the absolute-claim neutralization in all six
  fields, the provenance rule, and the operator override.
- Two pre-existing issues found and deliberately **not** fixed here, to keep the
  change scoped: the Firecrawl research backend never applies the documented
  60 000-character input bound (recorded as ROADMAP-16), and the UI does not save
  an edited brief before starting generation, so unsaved answers never reach a run.

## State

- Implementation: complete
- Verification: complete for unit, end-to-end, typecheck, lint, and build;
  **browser verification not performed** (no browser access in this environment)
- Commit: not committed
- Deployment: not deployed
