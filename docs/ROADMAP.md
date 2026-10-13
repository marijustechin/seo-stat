# Roadmap

The entry point for anyone planning work on `seo-stat`: the operator, an
implementing agent, or an external architect that reads this repository through a
read-only connection.

Roadmap items are **intents, not tasks**. An item becomes work only when it is
written as a task record from `tasks/TEMPLATE.md`.

## Product intent, and the one metric that matters

`seo-stat` exists to run an SEO content pipeline **unattended**. After a project's
analysis and publication interval are approved **once**, it selects topics, writes
and illustrates articles, plans their links, publishes them, and reports what the
search engines did with the result.

**Metric: operator actions per published article. Target after project approval:
0.**

This metric was absent from the first product direction, which measured correctness
and safety instead - and therefore built a tool that asked the operator more
questions than it answered. That failure, its cause, and its correction are
recorded in
[ADR-0010](decisions/ADR-0010-unattended-content-pipeline.md).

Every item below is judged by this metric. **An item that adds a mandatory
operator step to the unattended path is a defect, not a feature.** A task record
should name the metric it moves.

## Authoritative sources

This file summarizes; it never overrides.

| Question | Source |
| --- | --- |
| What are the working rules and the fixed decisions? | [AGENTS.md](../AGENTS.md) |
| What does the product do, and what is in the MVP? | [docs/product.md](product.md) |
| What is the approved functional architecture? | [docs/functional-architecture.md](functional-architecture.md) |
| What is the technical architecture, and what is still unresolved? | [docs/architecture.md](architecture.md) |
| Why was a decision made, and may it be reopened? | [docs/decisions/README.md](decisions/README.md) |
| What was actually done, and with what evidence? | [tasks/INDEX.md](../tasks/INDEX.md) |

`scripts/validate-harness.mjs` mechanically enforces the fixed stack rules, so a
proposal that contradicts them fails verification instead of being debated.

## How to propose the next task

1. Read this file and [docs/decisions/README.md](decisions/README.md).
2. Take the first item whose dependencies are satisfied.
3. Resolve the open questions that item lists. If the answer is architectural,
   record it as an ADR in `docs/decisions/` **before** writing the task. If it
   needs an outside opinion, use [docs/consult/README.md](consult/README.md).
4. Write exactly one task record `tasks/TASK-NNNN-short-title.md` from
   `tasks/TEMPLATE.md`, with Objective, Scope (in and out), Acceptance criteria,
   and the State section. Name the metric the task moves in its Objective.
5. Add the row to [tasks/INDEX.md](../tasks/INDEX.md) with state `proposed`.
6. Keep implementation, verification, commit, and deployment as four separate
   facts. Never describe uncommitted or undeployed work as committed or deployed.

One task, one purpose. If a task mixes building, live verification, and
record-keeping, split it.

## Current state (through TASK-0015)

Implemented and live:

- Project management and project workspaces (TASK-0004).
- Website and competitor analysis producing reviewable, evidence-based
  suggestions (TASK-0005).
- Content topics, briefs, and versioned article drafts with a claim guard
  (TASK-0007); information requirements, answers, and reusable project knowledge
  (TASK-0008).
- Automatic gap resolution with a read-only per-run digest, so unanswered
  requirements never block a draft (TASK-0015, ROADMAP-04).
- Article cover images with explicit provider selection and no fallback:
  Cloudflare Workers AI, Google Gemini, OpenAI Images (TASK-0009, TASK-0011,
  TASK-0012).
- Project-scoped WordPress connection and export of article **drafts** only
  (TASK-0010).
- Unattended deployment: a successful `main` build is published by a systemd user
  timer on the server (TASK-0003).

**The unattended half does not exist.** There is no scheduler, no interval, no
workflow execution, and no execution history, so nothing runs by itself: every run
still has to be started by hand. Article generation itself no longer asks the
operator anything, because ROADMAP-04 is done. There is also **no link planning**
and **no measurement**, both of which the product intent requires. There is **no
authentication**; see [ADR-0009](decisions/ADR-0009-no-authentication.md).

Per-task detail and evidence: [tasks/INDEX.md](../tasks/INDEX.md).

## Milestone A - make the loop unattended

Nothing else matters until the pipeline can run one cycle without the operator.
The engine items (01-03) and the autonomy items (04-05) are both required before
the first unattended end-to-end cycle.

### ROADMAP-01 - Workflow definitions (project-scoped)

A reusable description of steps: not a run, and not a schedule. Project-scoped per
[ADR-0001](decisions/ADR-0001-project-first-scope.md).

- Depends on: nothing.
- Size: M.
- Open questions: what a step is (typed steps versus stored configuration);
  whether a definition is versioned once runs exist; whether a definition can be
  edited while a schedule references it.

### ROADMAP-02 - Schedule, interval, and missed-run policy

The trigger that launches a workflow at times, including the per-project
publication interval the operator sets **once**. Owns timezone and missed-run
handling; `AGENTS.md` requires timezone, server downtime, and missed runs to be
handled explicitly.

- Depends on: ROADMAP-01.
- Size: L.
- Open questions (recorded as unresolved in [docs/architecture.md](architecture.md)):
  scheduler technology; whether scheduling lives in the API process or in the
  systemd timer layer; what happens to runs missed while the server was down.

### ROADMAP-03 - Execution history and job store

A single run of a workflow, with its own history and result, distinct from both
the definition and the schedule.

- Depends on: ROADMAP-01.
- Size: L.
- Open questions: job-store schema and where execution history lives; how a run is
  marked interrupted and made retryable.
- Reuse: the existing asynchronous run pattern (queued/running/completed/failed/
  interrupted, one active run per project, sanitized errors, provider/model/usage,
  cost only with a documented price basis) is already implemented for analysis and
  content generation and is the reference model.

### ROADMAP-04 - Unattended resolution of information gaps

**The direct fix for the failure that stopped this project.** The system asked; it
now resolves. The ladder from
[ADR-0010](decisions/ADR-0010-unattended-content-pipeline.md) is implemented in
article generation, and the place where a human answer used to be expected is
recorded in a digest instead.

- **Done: TASK-0015** ([record](../tasks/TASK-0015-gap-resolution.md)), with the
  digest mechanism fixed by
  [ADR-0011](decisions/ADR-0011-gap-resolution-digest.md).
- Depends on: nothing.
- Size: M (delivered).
- Out of scope, and still true: the operator keeps the ability to answer or
  exclude a requirement. `answered` and `exclude` remain optional input.
- Metric: operator answers required before a draft can proceed, from "many" to
  **0** (reported by TASK-0015).

### ROADMAP-05 - Link planning (internal and external)

Part of the original product intent, and **absent from both the code and the
documentation**. An article needs a plan for internal links (to the site's own
relevant pages) and, where useful, external links to sources.

- Depends on: nothing. Internal linking needs an inventory of the site's existing
  URLs, which the analysis research partially collects (up to six pages).
- Size: M.
- In scope: building and refreshing a per-project URL inventory; selecting
  internal targets by relevance to the article; validating that a chosen target
  exists; recording external sources with retrieval dates; refusing to invent URLs.
- Open questions: how the URL inventory is discovered and kept current (sitemap,
  crawl, or WordPress API); how many internal links per article; whether link
  placement is model-decided or deterministic.
- Constraint: fetched external material is untrusted research input, never
  instructions.

### ROADMAP-06 - Application-level settings beyond environment variables

- Depends on: nothing.
- Size: S.
- Open questions: which settings are per-deployment and which are per-project;
  where non-secret settings are stored and who may change them.
- Note: the per-project publication interval and mode belong to project settings,
  not here.

## Milestone B - publish and close the loop

### ROADMAP-07 - Publication model and duplicate detection

What "published" means for each channel, and how duplicate publication is
prevented. `AGENTS.md` requires external actions to record their result and to be
idempotent.

- Depends on: ROADMAP-01, ROADMAP-03.
- Size: M.
- Open questions: the definition of published per channel; detection by recorded
  remote identifier versus payload hash. The WordPress export already records local
  draft/version identity, payload hash, remote post and media ids, outcome, and
  sanitized errors, and already treats an ambiguous timeout as **outcome
  uncertain** requiring reconciliation. Extend that record; do not invent a second
  mechanism.

### ROADMAP-08 - Staged publication (auto-draft, then publish)

The rollout that makes [ADR-0010](decisions/ADR-0010-unattended-content-pipeline.md)
safe. The pipeline creates WordPress **drafts** automatically; after N consecutive
successful unattended articles the project flips to creating published posts.

- Depends on: ROADMAP-07.
- Size: M.
- In scope: the per-project mode and stage, the N threshold, the flip itself, and
  the per-project kill switch.
- Open questions: whether the flip is manual by the operator or automatic at N;
  how the review opt-in interacts with the stage; whether a scheduled post status
  is ever requested.
- Constraint: the existing export never requests publish or scheduled status. This
  item is what introduces publication; it must not weaken the export's
  reconciliation behaviour.

### ROADMAP-09 - Cheap reversal (edit, retract, regenerate)

Reversal replaces pre-publication review as the correction path, so it must be
easy, recorded, and idempotent.

- Depends on: ROADMAP-08.
- Size: M.
- Open questions: which reversal actions exist per channel; how a retraction is
  recorded; whether a corrected article reuses the same URL or gets a new one.

### ROADMAP-10 - Measurement and self-correction

Collect search performance for published articles and feed it back. Without this,
unattended publication has no quality signal at all.

- Depends on: ROADMAP-03.
- Size: L.
- Open questions (recorded as unresolved in [docs/architecture.md](architecture.md)
  and [docs/product.md](product.md)): whether reporting reads third-party APIs
  directly or reads stored snapshots; the Google authentication path; report
  cadence, audience, and delivery channel; what the system proposes to do about a
  poorly performing article.
- Note: this item holds a third-party credential and is therefore affected by
  ROADMAP-12.

## Milestone C - extend channels

### ROADMAP-11 - LinkedIn publishing

- Depends on: ROADMAP-07.
- Size: L.
- Open questions: which API path is available for the operator's account and what
  approval it needs; token lifecycle and storage (per
  [ADR-0007](decisions/ADR-0007-credential-encryption.md)); post versus article
  link; rate limits; what the unattended path posts without review.
- Note: no LinkedIn credential exists yet. This item starts with an operator
  decision, not with code.

## Milestone D - trust boundary

### ROADMAP-12 - Authentication and access control

The API trusts the caller and relies on the private network and nginx. Project
scoping limits which records are visible but is not identity-based authentication.

- Depends on: nothing. It becomes a prerequisite as soon as the application is
  reachable beyond the private network, or as soon as it stores third-party tokens
  for ROADMAP-10 and ROADMAP-11.
- Size: L.
- Open questions: identity source (local accounts versus a reverse-proxy or
  external provider); session model; how the existing project-scoped routes and
  the content image route change; whether multi-user accounts stay out of scope as
  [docs/product.md](product.md) currently proposes.
- Why it matters more now: under
  [ADR-0010](decisions/ADR-0010-unattended-content-pipeline.md) the system
  publishes without a human watching.

## Milestone E - agent harness

Process work, not product work. It exists so that verification does not depend on
the author's prose. These items extend the harness rather than the application, so
each one needs an explicit operator task: `AGENTS.md` limits the current phase to
docs, task tracking, and validation unless a task asks for more.

### ROADMAP-13 - Independent verification of claims

Every completed task's evidence is re-run by a reviewer with fresh context, not
only by the author who produced it.

- Depends on: nothing.
- Size: S.
- Open questions: which checks are mandatory for every task (harness validation,
  typecheck, build, targeted tests) and how a re-run is recorded in the task
  record.

### ROADMAP-14 - Live-system observation for agents

Give agents read access to the deployed application and its data so that
verification of a user-visible claim does not rest on the author's description.

- Depends on: nothing.
- Size: M.
- Open questions: which observation tools are acceptable; how their credentials
  stay out of conversation text and out of the repository
  ([ADR-0007](decisions/ADR-0007-credential-encryption.md)); whether the deployed
  application is reachable from the machine the agents run on.

### ROADMAP-15 - Truthful state recording

Write commit and deployment facts into the task record from the actual tooling
instead of from the author's assertion.

- Depends on: nothing.
- Size: S.
- Motivation, observed on 2026-10-13: after the first push made from an agent
  session, the deployment state of commit `627ebd8` could not be confirmed,
  because the API health endpoint exposes no release identifier. The task records
  had to say "not verified" instead of naming a deployed release. Nothing in the
  system can currently answer "which commit is running?" without reading the
  server.
- Open questions: which facts are recorded automatically (commit sha, deployed
  sha, health result) and who may edit the record afterwards.

## Follow-ups discovered while implementing

### ROADMAP-16 - Enforce the documented research input bound on the Firecrawl path

Found during TASK-0015 reconnaissance. `ANALYSIS_LIMITS.maxInputChars` (60 000) is
applied only by the direct-fetch backend
(`apps/api/src/modules/analysis/research/research.service.ts`); the Firecrawl
backend never truncates the aggregate, so a single analysis run can return up to
15 x 8 000 = 120 000 excerpt characters. The functional architecture states
60 000 input characters as a shared bound, so on that path the documented limit and
the behaviour disagree.

- Depends on: nothing.
- Size: S.
- Note: this sits on the shared analysis path, so it is deliberately **not** part
  of TASK-0015, which is scoped to article generation. The article path applies its
  own per-run budget (`CONTENT_LIMITS.researchMaxInputChars`) regardless of
  backend, so the content pipeline is bounded today.

## Open decisions to resolve

Each of these blocks the item that depends on it, and each must be resolved as an
ADR before that item becomes a task.

| Decision | Blocks | Recorded in |
| --- | --- | --- |
| Scheduler technology and missed-run strategy | ROADMAP-02 | [docs/architecture.md](architecture.md) |
| Job-store schema and where execution history lives | ROADMAP-03 | [docs/architecture.md](architecture.md) |
| How application-level settings are managed | ROADMAP-06 | [docs/architecture.md](architecture.md) |
| What "published" means per channel and duplicate detection | ROADMAP-07 | [docs/product.md](product.md) |
| Where review state lives, for projects that opt into review | ROADMAP-08 | [docs/architecture.md](architecture.md) |
| Reporting reads live APIs versus stored snapshots | ROADMAP-10 | [docs/architecture.md](architecture.md) |
| Report cadence, audience, and delivery channel | ROADMAP-10 | [docs/product.md](product.md) |
| Authoritative keyword/topic sources for research | later content work | [docs/product.md](product.md) |
| URL inventory source for internal linking | ROADMAP-05 | this file |
| Authentication and access control model | ROADMAP-12 | [docs/architecture.md](architecture.md) |

## How this roadmap was corrected

The first version of this file ordered work by technical dependency
(scheduler, then publishing, then reporting) and inherited the product's blind
spot: it never asked how much operator effort the result would cost, and it
omitted link planning entirely. The correction is
[ADR-0010](decisions/ADR-0010-unattended-content-pipeline.md); the roadmap now
starts from the metric and puts the resolution of information gaps
(ROADMAP-04) in the first milestone instead of leaving it as an accepted
behaviour.
