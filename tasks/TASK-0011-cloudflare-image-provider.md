# TASK-0011: Cloudflare Workers AI cover generation (FLUX.1 Schnell)

- ID: TASK-0011
- State: completed
- Owner: agent
- Created: 2026-10-09
- Last updated: 2026-10-09

## Objective

Make Cloudflare Workers AI the explicitly selected image provider (FLUX.1
[schnell]) so cover generation works without funding OpenAI, while preserving the
existing cover-image workflow and historical assets. The Workers Free plan is
used; no paid billing, credits, or paid models.

## Scope

In scope:

- A Cloudflare image provider behind the existing `ImageProvider` interface that
  calls the REST API directly:
  `POST https://api.cloudflare.com/client/v4/accounts/{accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`
  with server-side Bearer-token auth.
- Explicit provider selection via `IMAGE_PROVIDER=cloudflare` (or `openai`); any
  other value disables generation. A stray `IMAGE_API_KEY` never enables or falls
  back to OpenAI. DeepSeek remains the text provider.
- Configuration `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` in
  `/srv/seo-stat/config/api.env` (mode 0600), never exposed.
- Documented `prompt` (max 2048 chars) and `steps` (1-8, default 4) parameters;
  the complete submitted prompt is length-checked with actionable feedback and is
  never silently truncated.
- Validate the REST envelope, decode `result.image` base64, and detect the actual
  format/dimensions so stored extensions and MIME types match the bytes (FLUX
  returns JPEG).
- Preserve editable prompts, explicit regeneration, image versions, cover
  selection, alt text, uploads, project isolation, archived restrictions,
  persistent assets, and WordPress compatibility.
- System/Content surface the selected provider, model, configuration state,
  generation progress, and understandable errors; duplicate generation from
  repeated clicks is prevented.
- Record provider/model, submitted prompt, generation parameters, outcome, and any
  reported usage (state clearly when usage/cost is unavailable).
- Distinguish exhausted free allocation from temporary capacity/rate limits by
  Cloudflare error code; do not retry quota exhaustion or fall back to paid;
  retain failed-attempt history.

Out of scope: paid Cloudflare plans, purchasing credits, switching to paid models,
and changing the DeepSeek text provider.

## Acceptance criteria

- [x] Cloudflare provider behind `ImageProvider`; REST call with Bearer auth to the
      documented endpoint and `{ prompt, steps }` body.
- [x] Explicit selection (`IMAGE_PROVIDER`); no OpenAI requests/fallback from an
      existing `IMAGE_API_KEY`; DeepSeek unchanged.
- [x] Missing credentials → not configured (503), no request made.
- [x] Prompt limit (2048 on the complete submitted prompt) enforced with an
      actionable message; no silent truncation.
- [x] Response envelope validated; base64 decoded; JPEG/PNG/WebP detected from the
      bytes and stored/served with the matching extension and MIME.
- [x] `steps` default 4, clamped to 1-8; documented parameters used.
- [x] Provider/model/prompt/parameters/outcome recorded; usage `null` and shown as
      "usage not reported" (no invented tokens/quota/cost).
- [x] Cloudflare `3036` (free allocation exhausted) and `3040` (temporary
      capacity) surfaced as 429 messages; `5035` (paid-only) reported without
      upgrading; timeouts separated; quota not retried.
- [x] Existing workflow preserved (editable prompts, regeneration, versions,
      selection, alt text, uploads, isolation, archived restrictions, persisted
      assets, WordPress cover use).
- [x] Duplicate generation from repeated clicks prevented (UI guard + server 409).
- [x] System and Content show provider/model/config and clear errors.

## Verification evidence

- Unit tests: API **54 passed** (previously 33), incl. new Cloudflare provider
  tests (endpoint/body/Bearer/auth, base64 decode, JPEG vs PNG detection, steps
  default/clamp/override, 2048 prompt rejection without a provider call, quota vs
  capacity vs paid vs timeout classification, malformed response, missing
  credentials), provider-selection tests (no OpenAI fallback from `IMAGE_API_KEY`,
  `IMAGE_STEPS`), and format-detection tests; web unit **18 passed**.
- API e2e: **48 passed** (2 health + 9 projects + 9 analysis + 17 content + 11
  WordPress). New content coverage: over-length prompt → 400 with a message naming
  the 2048 limit and no attempt row; JPEG bytes mislabelled PNG are stored as
  `image/jpeg` with `cover-v1.jpg`; duplicate generation → 409 while in progress
  and 201 after it clears. Existing cover coverage (upload, selection, alt,
  versions, isolation, archived) still passes.
- `pnpm -r typecheck`, `pnpm -r lint`, and `pnpm -r build` pass;
  `node scripts/validate-harness.mjs` passes.
- No network or real credential is used in tests (the Cloudflare HTTP call is a
  stub; the content suite uses a stub `ImageProvider`).

## Completion notes

- New files: `image.cloudflare.provider.ts`, `image.disabled.provider.ts`,
  `image.providers.ts` (factory), plus specs. `image.provider.ts` gained
  `ImageProviderError`, `maxPromptLength`, `defaultParameters`, and the
  `parameters` result field. `image-meta.ts` gained `detectImageMime`.
- `ImageService` validates the prompt against the provider limit, guards against
  duplicate generation per draft, detects the stored format from the bytes, and
  maps provider error kinds to 429/503/400 responses. `ArticleImage` gained a
  `parameters` JSON column (migration `20261009110428_image_generation_parameters`).
- Content module selects the provider with a factory; unset/unknown →
  `DisabledImageProvider` (never configured). `system/status` exposes provider,
  model, configured, `maxPromptLength`, and default parameters; the System page
  and the Content cover panel show them.
- Deployment: set `IMAGE_PROVIDER=cloudflare`, `CLOUDFLARE_ACCOUNT_ID`,
  `CLOUDFLARE_API_TOKEN` (and optional `IMAGE_STEPS`) in
  `/srv/seo-stat/config/api.env`; restart `seo-stat-api.service`. Create a
  Workers AI API token in the Cloudflare dashboard (Workers AI → Use REST API).
  The free plan's daily neuron allocation applies.

## State

- Implementation: complete
- Verification: complete (automated + deployed structural checks). **Live
  Cloudflare generation verification is pending** — the configured API token was
  rejected (HTTP 401); no credential was acquired or replaced.
- Commit: committed on `main`
- Deployment: deployed automatically by the systemd user timer (see live note)

## Live verification (deployed release)

- Deployed `ac67c7b` (auth-classification follow-up below); deploy log shows
  migration `20261009110428_image_generation_parameters` applied; `prisma migrate
  status` reports "Database schema is up to date" (7 migrations); health 200.
- Server configuration (values never printed): `IMAGE_PROVIDER=cloudflare`,
  `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` are present. `system/status`
  reports `image: { provider: "cloudflare", model:
  "@cf/black-forest-labs/flux-1-schnell", configured: true, maxPromptLength: 2048,
  parameters: { steps: 4 } }`.
- Live **generation attempt** on an existing draft: Cloudflare was reached at the
  documented endpoint and responded **HTTP 401 (authentication error)**. The API
  returned 400 with a sanitized message; no request was made to OpenAI and no fall
  back occurred. A **failed attempt row was retained** (kind generated, status
  failed, provider `cloudflare`, model `flux-1-schnell`). The follow-up commit
  classifies HTTP 401/403 as an explicit credential error.
- Result: **live generation verification is pending** on a valid
  `CLOUDFLARE_API_TOKEN` with Workers AI permissions (the token currently fails
  authentication). The prior OpenAI attempt remains blocked by `429 no credits`
  (TASK-0009); OpenAI is no longer selected.
