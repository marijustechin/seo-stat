# TASK-0012: Google Gemini image provider and responsive cover previews

- ID: TASK-0012
- State: completed
- Owner: agent
- Created: 2026-10-09
- Last updated: 2026-10-09

## Objective

Add Google Gemini as an explicitly selected image provider (behind the existing
`ImageProvider` interface) using the official `@google/genai` SDK, and complete
the responsive cover-preview fix. DeepSeek remains the text provider; there is no
automatic fallback between image providers.

## Scope

In scope:

- `GeminiImageProvider` using the official `@google/genai` SDK (ESM), default
  model `gemini-3.1-flash-image`, requesting a landscape `16:9` image suitable for
  article covers.
- Explicit selection `IMAGE_PROVIDER=gemini` with `GEMINI_API_KEY` and
  `GEMINI_IMAGE_MODEL`; no fallback to Cloudflare/OpenAI.
- Default prompt built from the article's saved title and summary with clear
  visual instructions (avoid embedded text/logos/real people and unsupported
  claims).
- Preserve image versions, selection, editable prompts, alt text, uploads,
  persistent asset storage, and WordPress export.
- Responsive cover previews (the `.cover-preview` element had no CSS and could
  overflow).

Out of scope: changing the DeepSeek text provider, adding other image providers,
and paid-plan changes.

## Acceptance criteria

- [x] Gemini provider behind `ImageProvider`, using the official `@google/genai`
      SDK; landscape `16:9`; default model `gemini-3.1-flash-image`.
- [x] Explicit selection (`IMAGE_PROVIDER=gemini`); no automatic fallback; a stray
      `IMAGE_API_KEY` never enables OpenAI.
- [x] Response `inlineData` decoded; actual format detected from the bytes;
      dimensions/usage/parameters recorded (usage `null` and shown as "usage not
      reported" when absent).
- [x] Errors classified (quota/rate, auth/permission, capacity, invalid) and
      surfaced as clear 429/503/400 responses; no retry of quota.
- [x] Existing cover workflow preserved (versions, selection, editable prompts,
      alt text, uploads, storage, WordPress export).
- [x] Cover previews are responsive and never overflow.

## Verification evidence

- API unit tests: **64 passed** (14 files), incl. 8 new Gemini provider tests
  (16:9 request, base64/format detection, text-only rejection, prompt bounds
  without a provider call, quota/auth/capacity/invalid classification, missing
  key) and updated provider-selection tests (Gemini selected only when explicit;
  unconfigured without a key; no OpenAI fallback). Web unit **18 passed**.
- API e2e **49 passed** (unchanged; the content suite still uses a stub
  `ImageProvider`, so no network/credential is used).
- `pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r build`, and
  `node scripts/validate-harness.mjs` pass.

## Completion notes

- Added dependency `@google/genai@2.28.0` (official, ESM). The repo's pnpm
  supply-chain allowlist (`pnpm-workspace.yaml`) marks its install scripts and
  `protobufjs` as not run (published package ships prebuilt output).
- New files: `image.gemini.client.ts` (isolated SDK seam; injectable for tests)
  and `image.gemini.provider.ts`; the factory `image.providers.ts` gained the
  `gemini` branch.
- `ImageService` default prompt now includes the draft title and excerpt
  (summary) and instructions to avoid text/logos/people/claims, benefiting all
  providers.
- Responsive fix: added `.cover-preview` (and `figure`) CSS so cover previews are
  full-width, keep aspect ratio, and never overflow.

## State

- Implementation: complete
- Verification: complete (automated). **Live Gemini generation is pending** — the
  operator key has not been added yet.
- Commit: committed on `main`
- Deployment: deployed automatically by the systemd user timer (see live note)

## Live verification

- Pending: when `GEMINI_API_KEY` is present, set `IMAGE_PROVIDER=gemini` and
  `GEMINI_IMAGE_MODEL=gemini-3.1-flash-image`, restart only `seo-stat-api.service`,
  and perform one real generation (authorized paid call) without changing existing
  images or the selected cover. Report the article, exact prompt, model, available
  usage, and result.
