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
- Verification: complete, including one real Gemini generation (the authorized
  paid call) with the operator's key.
- Commit: committed on `main` (`34ddf7a` feature; this live-verification record)
- Deployment: deployed automatically by the systemd user timer (`34ddf7a`; see
  live note)

## Live verification (deployed release)

- Deployed `34ddf7a`; the release installs `@google/genai`; health 200.
  `system/status` reports `image: { provider: "gemini", model:
  "gemini-3.1-flash-image", configured: true, maxPromptLength: 48000, parameters:
  { aspectRatio: "16:9", model: "gemini-3.1-flash-image" } }`.
- Restarted only `seo-stat-api.service`; the running process matched the config
  file (hashes) for `IMAGE_PROVIDER`, `GEMINI_API_KEY`, and `GEMINI_IMAGE_MODEL`.
- **One real generation** through the app's existing endpoint on the article
  **"What Happens to Your Donated Clothes? Reuse, Recycling and Zero Landfill
  Explained"** (draft `aebcf00d`, chosen to leave all existing images and the
  selected cover untouched):
  - Exact submitted prompt (built from the saved title + summary):
    `Create a landscape editorial cover illustration for an article titled "What
    Happens to Your Donated Clothes? Reuse, Recycling and Zero Landfill
    Explained". Article summary: A plain-language look at what happens to a
    garment after it reaches a textile collection point: how it is assessed for
    its best next use, hand-sorted and graded by category, season and quality, and
    routed to reuse or recycling rather than landfill. Style: conceptual and
    non-photographic, clean and modern, suitable as a blog header. Do not include
    any text, words, letters, numbers, captions, logos, or watermarks in the
    image. Do not depict real people, identifiable customers, facilities, or brand
    logos, and do not include statistics or unsupported claims.`
  - Model: `gemini-3.1-flash-image` (provider `gemini`), aspect ratio `16:9`.
  - Result: **201** in ~11.0 s; image **v1**, status `ready`, `image/jpeg`
    (detected from bytes), `cover-v1.jpg`, **1376×768** (landscape), 749,892 bytes.
  - Reported usage (actual): `serviceTier: standard`, `totalTokenCount: 1663`,
    `promptTokenCount: 149` (TEXT), `candidatesTokenCount: 1514`, image tokens
    `1120`.
- **Inspection**: the served file (`GET .../images/{id}/file`) returned 200
  `image/jpeg` with a valid JPEG signature at the full byte count; the decoded
  image is a valid 1376×768 landscape cover. (Subjective aesthetic review requires
  a human; the technical/visual metadata is recorded here.)
- **Existing images and selected cover unchanged**: the tested article gained one
  unselected image; the other article's selected cover remains **v4** (Cloudflare).
- Cloudflare/OpenAI were not used (no fallback), and no paid-plan change was made.
