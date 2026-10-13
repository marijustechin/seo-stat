# ADR-0002: TypeScript ESM on Node.js 24 in a pnpm workspace

- Status: accepted
- Recorded: 2026-10-13
- Source of truth: [AGENTS.md](../../AGENTS.md), enforced by
  [scripts/validate-harness.mjs](../../scripts/validate-harness.mjs)
- Supersedes: none

## Decision

- Node.js 24.
- pnpm 11, pinned through `packageManager` in the root `package.json`.
- TypeScript with **ESM everywhere** for project-owned application code, scripts,
  and configuration: `"type": "module"`, and `module` plus `moduleResolution` set
  to `nodenext`.
- Tests run on Vitest. Legacy CommonJS test configuration must not exist.

## Rationale

Not separately recorded. The decision is a fixed requirement rather than a
trade-off under discussion, and it is enforced mechanically, which is what makes
it stable: `scripts/validate-harness.mjs` fails the build when the runtime,
package manager, module system, or test runner drifts. A rule that a script can
check does not need to be re-argued in conversation.

## Consequences

- `apps/api/package.json` and `apps/web/package.json` must declare `"type":
  "module"`.
- `apps/api/tsconfig.json` must use `module: nodenext` and
  `emitDecoratorMetadata: true`.
- The API start script runs the built ESM entry (`dist/main.js`).
- `apps/api/jest.config.js`, `apps/api/test/jest-e2e.json`, and
  `apps/web/jest.config.js` are rejected as legacy CommonJS configuration.
- New tooling must be ESM-capable. A dependency that only ships CommonJS is a
  reason to look for an alternative, not a reason to add a transform layer.

## Reopen only if

The operator explicitly changes the runtime or module system. Such a change must
update `AGENTS.md` and `scripts/validate-harness.mjs` in the same commit, so the
rule and its enforcement cannot drift apart.
