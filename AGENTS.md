# AGENTS.md - seo-stat

## Scope

These instructions apply to the whole `seo-stat` repository. No parent-directory
`AGENTS.md` exists. If one is added later, it applies in addition to this file.

## Project in one line

A local Linux-server tool to schedule content research, article generation,
website publishing, LinkedIn publishing, and Google performance reporting.

## Confirmed architecture decisions (authoritative)

These are fixed requirements. Follow them unless the user explicitly changes
them; tooling familiarity is not grounds for reopening them. The harness
validator enforces the version, ESM, and port rules mechanically.

- Node.js 24; pnpm 11 pinned via `packageManager`; TypeScript.
- ESM everywhere for project-owned application code, scripts, and configuration
  (`"type": "module"`; `module` and `moduleResolution` set to `nodenext`).
- Web: Next.js 16 App Router (`apps/web`).
- API: NestJS 12 on Fastify (`apps/api`).
- Database: PostgreSQL via Prisma 7 with the `@prisma/adapter-pg` driver adapter
  and `prisma.config.ts`.
- Backend listens on `127.0.0.1:3011`; frontend on `127.0.0.1:3012`.
- UI: https://192.168.8.50/seo-stat/ ; API prefix `/seo-stat/api/`.
- API code is organized into domain modules under `apps/api/src/modules`, with
  database and configuration infrastructure under `apps/api/src/database` and
  `apps/api/src/config`. Frontend code uses `src/shared`, `src/entities`,
  `src/features`, and `src/widgets`, with imports flowing toward lower layers.
- Deployment user `seostat`; systemd user services; automatic deployment after
  successful `main` CI, without recurring operator approval.

## Working rules

- The harness phase is docs + task tracking + validation only. Do not add
  application code, connect external accounts, publish content, configure the
  server, or deploy unless a task explicitly asks for it.
- Keep changes proportionate to a small project. Prefer standard-library
  solutions; do not add dependencies without a task that justifies them.
- Preserve existing work. Inspect before editing.
- Credentials and secrets must stay outside tracked files (see `.gitignore`;
  real values live in untracked env files or the server secret store).
- The content pipeline is **unattended by default**. The operator's only mandatory
  gate is one approval per project (the analysis and the publication interval).
  After that, zero routine operator actions per published article: see
  `docs/decisions/ADR-0010-unattended-content-pipeline.md`.
- `review` (human approval before any external action) remains available as a
  per-project opt-in. It is not the default.
- An uncertainty must never become a blocking question. Resolve it by research,
  then by rewriting so the claim is not needed, then by publishing with neutral
  wording, and otherwise record it for post-publication verification. Unresolved
  items go into a non-blocking digest.
- Quality is judged after publication by measurement, with reversal (edit,
  retract, regenerate) as the correction path.
- External actions must record their result and must be idempotent: never publish
  the same item twice. Reversal is an external action with its own record.
- A failed step must be recoverable without repeating already-successful
  publication steps.
- Scheduling must explicitly handle timezone, server downtime, and missed runs.
- Record implementation, verification, commit, and deployment states separately.
  Never describe uncommitted or undeployed work as committed or deployed.

## Planning and decision records

Planning starts from `docs/ROADMAP.md`: the current state, the ordered intents,
and the open decisions that block them. An intent becomes work only as a task
record.

- `AGENTS.md` stays the authoritative rule list. A settled decision is explained
  once in `docs/decisions/` as an ADR with its rationale, consequences, and the
  condition for reopening it. An ADR never overrides this file; if the two
  disagree, this file wins and the ADR is corrected.
- A decision that needs an outside opinion is written as a packet in
  `docs/consult/` and answered in that same file, so the reasoning is durable and
  reviewable.
- Durable decisions live in this repository, not in a chat, a pasted report, or an
  issue comment. If it must be remembered, it is a file.

## Verification

Run before considering any task done:

```
node scripts/validate-harness.mjs
```

It validates completed task records, local Markdown links, and the confirmed
architecture rules (pinned major versions, ESM configuration, and the required
ports). Node.js is required (developed against Node 24). No install step and no
third-party dependencies.

CI runs the same command on pushes and pull requests to `main` via
`.github/workflows/harness.yml` (Node 24, read-only permissions, no install
step). A passing local run is not evidence of a successful CI run; check the
GitHub Actions tab for the actual result.

## Completion requirements

A task is complete only when:

1. Its record in `tasks/` has all required sections filled in, including
   acceptance criteria and verification evidence.
2. The verification command above passes.
3. The task record's State section and `tasks/INDEX.md` match reality.
4. Commit and deployment states are recorded truthfully (they are separate from
   implementation and verification).
