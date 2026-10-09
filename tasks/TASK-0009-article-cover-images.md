# TASK-0009: Article cover images (generate or upload)

- ID: TASK-0009
- State: completed
- Owner: agent
- Created: 2026-10-09
- Last updated: 2026-10-09

## Objective

Let a draft have a cover image: generate one from a visual brief when an image
provider is configured, or upload a PNG/JPEG/WebP. Store images outside the
release directory, scope them per project, and serve them through the
project-scoped API route. Complete the handoff by clarifying the provider,
implementing the missing prompt/regeneration/usage requirements, and stating the
access-control reality honestly.

## Scope

In scope:

- Per-draft cover images with kind (generated/uploaded), status, prompt, alt
  text, provider/model, dimensions, bytes, usage, and selected state.
- Generation via a separate provider interface and credential (OpenAI Images);
  generation is unavailable (503) when unconfigured, and the UI says so.
- **Editable visual prompts** on an existing generated image (persisted via
  `PATCH`), **explicit regeneration** (per-image "Regenerate" and top-level
  "Generate cover image"), and **preserved previous images** (regeneration
  appends a new version).
- **Generation-usage records**: the provider `usage` object, provider, and model
  are stored per generated image and shown in the UI.
- Upload (base64) with content-type and size validation.
- Store files under `CONTENT_ASSET_DIR` (outside the release dir); serve via
  `GET /projects/:projectId/content/images/:imageId/file` with a private cache
  header; treat the stored path as a basename to prevent traversal.
- Select exactly one cover; update alt text; list per draft.
- Report the image provider configuration on the System page.

Out of scope: external publication of the image, image editing/cropping,
multi-image galleries, authentication (the app has none), and text-provider
changes.

## Acceptance criteria

- [x] Upload a PNG/JPEG/WebP cover; reject unsupported types and over-limit
      uploads; record dimensions/bytes.
- [x] Generate a cover when configured; return 503 with an honest message when
      not configured; record failed generations with a sanitized error.
- [x] List, select (one per draft), and edit alt text; only the selected image is
      the intended cover.
- [x] Files are served through the **project-scoped** route (project/draft
      association only; the application has no authentication); another project
      cannot read them (404) and no credential is required.
- [x] Editable visual prompts persist across reload; regeneration is explicit and
      preserves previous images (versioned); generation usage/provider/model are
      recorded.
- [x] Images persist outside the release directory (survive deployment).
- [x] Archived projects cannot change images.
- [x] System page reports the image provider configuration separately from the
      text provider.

## Image provider details

- **Provider**: OpenAI Images. **Endpoint**: `POST
  https://api.openai.com/v1/images/generations` (Image API "Generations";
  base64 response).
- **Model id**: default `gpt-image-2.5-flare` (configurable via `IMAGE_MODEL`).
  `gpt-image-2.5-sunburst` is the precision-editing alternative. Flare is chosen
  as the default because it targets fast, high-quality everyday image generation,
  which matches article cover art; Sunburst would be used only where editing
  precision matters. (Both ids are documented by the provider's image-generation
  guide, verified 2026-10-09.)
- **Size/format**: default `1536x1024` (landscape). Recommended standard sizes
  are `1024x1024` (square), `1536x1024` (landscape), `1024x1536` (portrait);
  custom `WIDTHxHEIGHT` must be multiples of 16, aspect ratio 1:3–3:1, no edge
  above 3840 px. Response `data[0].b64_json` decoded to PNG bytes (`image/png`).
- **Credential**: `IMAGE_API_KEY` (or `OPENAI_IMAGE_API_KEY`), separate from
  `DEEPSEEK_API_KEY`. Image generation is a distinct capability; text stays on
  DeepSeek.
- **Secure server setup**: set the key only in `/srv/seo-stat/config/api.env`
  (mode 0600); it is read by the API process and never sent to the browser,
  responses, logs, the repository, or the release artifact. Do not acquire or
  reuse an OpenAI credential without the operator's authorization.

## Verification evidence

- API integration tests with a mocked image provider
  (`pnpm --filter @seo-stat/api test:e2e`): **34 passed**. Image coverage (test
  "manages cover images: upload, preview, select, alt, reload, regenerate,
  usage, and project scoping"): 503 when unconfigured; upload a 1x1 PNG
  (kind/status/dimensions/bytes); reload list persists alt text; asset file
  written to `CONTENT_ASSET_DIR`; select persists across reload; alt-text edit
  persists across reload; project-scoped file serve (200, `image/png`,
  `cache-control: private`, non-empty body); cross-project read 404 with no
  authorization header (documents the absence of authentication); generation
  records provider `stub-image`, model `stub-image-model`, and usage
  `{stub: true}`; regeneration keeps the previous version (versions 1 and 2);
  editable prompt persists across reload; archived-project upload rejected. Tests
  use a temporary `CONTENT_ASSET_DIR`.
- `pnpm -r typecheck`, `pnpm -r lint`, and `pnpm -r build` pass; web unit tests
  **18 passed**; API unit tests **22 passed**.
- `node scripts/validate-harness.mjs` passes.
- No paid/real image call is made in tests (the provider is stubbed) and no
  OpenAI credential is read.

## Completion notes

- The image subsystem is separate from the text provider: `ImageProvider`
  (abstract) with `OpenAiImageProvider` wired in the content module and reported
  through the system module.
- Schema migration `20261009080318_answers_knowledge_images` adds the
  `article_images` table (shared with TASK-0008's migration).
- Credentials documented in `apps/api/.env.example` and `deploy/api.env.example`
  (`IMAGE_API_KEY`/`OPENAI_IMAGE_API_KEY`, `IMAGE_MODEL`, `IMAGE_BASE_URL`,
  `CONTENT_ASSET_DIR`). `CONTENT_ASSET_DIR` defaults to
  `/srv/seo-stat/data/content-images`; `bootstrap-admin.sh` and
  `install-user-units.sh` now create it, and the deploy step never writes to it.
- **Access control correction**: earlier wording called the asset route
  "authenticated". It is not. The API has no authentication or guards at all;
  the route validates only project/draft association. Documentation and code
  comments were corrected to "project-scoped", and the absence of identity-based
  access control is recorded as an unresolved architectural decision.

## State

- Implementation: complete
- Verification: complete for the implemented behavior (mocked e2e + type/lint/
  build + live upload/serve/persistence checks). **Live image-generation
  verification is pending** — see below.
- Commit: committed on `main` (this completion commit)
- Deployment: deployed automatically by the systemd user timer (see live note)

## Live verification (deployed release)

- Deployment of this completion commit: see the follow-up record note (SHA and
  deploy log), including migration status and health.
- Live **cover upload** journey (no credential needed) is verified in the mocked
  e2e suite and re-checked against the deployed release; asset persistence across
  deployment is verified by the asset directory living outside `releases/`.

## Live image-generation verification (PENDING)

- **Not performed.** No `IMAGE_API_KEY` is configured on the server, and per the
  operator instruction no OpenAI credential was acquired or reused. Until a
  credential is configured and a real image is generated, live generation
  verification (a real provider call, decoded PNG, recorded usage) remains
  pending. Implementation and deployment completion are independent of this
  pending item.
