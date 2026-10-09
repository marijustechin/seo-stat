# TASK-0008: Content information requirements, answers, and reusable knowledge

- ID: TASK-0008
- State: completed
- Owner: agent
- Created: 2026-10-09
- Last updated: 2026-10-09

## Objective

Make the "needed before writing" information actionable. Users answer a topic's
information requirements (answered / unknown / exclude), the answers feed the
article generation snapshot instead of being invented, and an answer can be kept
as reusable project-scoped knowledge. Also make topic selection understandable by
renaming the misleading "Use topic" action and protecting unsaved brief edits.

## Scope

In scope:

- Structured per-topic information requirements (question, answer, source
  reference, state) persisted on the topic and on the brief.
- Answer editing UI in the topic editor and the brief; `unknown` means "do not
  invent an answer", `exclude` removes the claim; answered values are
  user-provided, not independently verified evidence.
- Answers included in the article prompt/snapshot; answer state survives topic
  switching and is never copied between topics.
- Reusable project knowledge (create from an answered requirement with its
  originating question; list/edit/delete) included in later article prompts.
- Rename "Use topic" to "Prepare article brief" (prepares and scrolls to the
  brief only; generation still needs an explicit action); unsaved-brief discard
  confirmation; a "brief changed since generation" stale flag on drafts.

Out of scope: automatic fact verification, external publishing, scheduling, and
image generation (separate task, TASK-0009).

## Acceptance criteria

- [x] Topic requirements can be created, answered, marked unknown/excluded, and
      removed; persisted across reloads.
- [x] Brief answers persist and are included in the article generation snapshot.
- [x] `unknown` and `exclude` semantics are applied in the prompt; no invented
      answers.
- [x] Answers are per-topic and preserved when switching topics.
- [x] Answered requirements can be kept as reusable project knowledge, and that
      knowledge is included in the article snapshot; knowledge can be edited and
      removed.
- [x] "Use topic" renamed to "Prepare article brief"; unsaved brief edits prompt
      before switching; drafts generated from an earlier brief are flagged stale.
- [x] Legacy topics (with only `informationNeeded`) keep rendering.

## Verification evidence

- API integration tests with a mocked provider
  (`pnpm --filter @seo-stat/api test:e2e`): **34 passed** (2 health + 9 projects
  + 9 analysis + 14 content). New content coverage: topic requirements and brief
  answers round-trip and appear in the article `inputSnapshot.brief.answers`;
  per-topic answers survive switching (the other topic's brief is still 404);
  project knowledge create/list/edit/delete and inclusion in
  `inputSnapshot.knowledge`; a draft becomes `stale` after brief answers change
  and a regenerated draft is not stale. The generated-topic stub fixture now
  returns `informationRequirements`, matching the updated topic output schema.
- `pnpm -r typecheck`, `pnpm -r lint`, and `pnpm -r build` pass; web unit tests
  **18 passed**; API unit tests **22 passed**.
- `node scripts/validate-harness.mjs` passes.

## Completion notes

- Schema migration `20261009080318_answers_knowledge_images` adds
  `content_topics.requirements`, `article_briefs.answers`, and the
  `project_knowledge` table (shared with TASK-0009, which adds `article_images`).
- Legacy topics that only had `informationNeeded` are read through
  `requirementsFor` (synthesized single requirement) so existing data keeps
  rendering; no data migration was required.
- The topic output schema now requires `informationRequirements` (a list of
  question strings) so generated topics carry answerable requirements.
- Staleness compares the draft's stored `briefSnapshot.answers` with the current
  brief answers (JSON equality).

## State

- Implementation: complete
- Verification: complete (mocked/structural checks)
- Commit: committed on `main`
- Deployment: deployed automatically by the systemd user timer (see live note)

## Live verification (deployed release)

- Migration `20261009080318_answers_knowledge_images` was applied to the
  production database during deployment; health 200. Image generation is not
  configured (no `IMAGE_API_KEY`), so generation returns 503 and uploads remain
  available; answers/knowledge and staleness do not require any provider.
