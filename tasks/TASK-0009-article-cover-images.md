# TASK-0009: Article cover images (generate or upload)

- ID: TASK-0009
- State: completed
- Owner: agent
- Created: 2026-10-09
- Last updated: 2026-10-09

## Objective

Let a draft have a cover image: generate one from a visual brief when an image
provider is configured, or upload a PNG/JPEG/WebP. Store images outside the
release directory, isolate them per project, and serve them only through the
authenticated project route.

## Scope

In scope:

- Per-draft cover images with kind (generated/uploaded), status, prompt, alt
  text, provider/model, dimensions, bytes, and selected state.
- Generation via a separate provider interface and credential (OpenAI Images);
  generation is unavailable (503) when unconfigured, and the UI says so.
- Upload (base64) with content-type and size validation.
- Store files under `CONTENT_ASSET_DIR` (outside the release dir); serve via
  `GET /projects/:id/content/images/:imageId/file` with a private cache header;
  treat the stored path as a basename to prevent traversal.
- Select exactly one cover; update alt text; list per draft.
- Report the image provider configuration on the System page.

Out of scope: external publication of the image, image editing/cropping,
multi-image galleries, and text-provider changes.

## Acceptance criteria

- [x] Upload a PNG/JPEG/WebP cover; reject unsupported types and over-limit
      uploads; record dimensions/bytes.
- [x] Generate a cover when configured; return 503 with an honest message when
      not configured; record failed generations with a sanitized error.
- [x] List, select (one per draft), and edit alt text; only the selected image is
      the intended cover.
- [x] Files are served through the authenticated project route; another project
      cannot read them (404).
- [x] Images persist outside the release directory (survive deployment).
- [x] Archived projects cannot change images.
- [x] System page reports the image provider configuration separately from the
      text provider.

## Verification evidence

- API integration tests with a mocked image provider
  (`pnpm --filter @seo-stat/api test:e2e`): **34 passed**. Image coverage: 503
  when unconfigured; upload a 1x1 PNG (kind/status/dimensions/bytes); list;
  select; alt-text update; authenticated file serve (200, `image/png`, non-empty
  body); cross-project read 404; generate when configured; archived-project
  upload rejected. Tests use a temporary `CONTENT_ASSET_DIR`.
- `pnpm -r typecheck`, `pnpm -r lint`, and `pnpm -r build` pass; web unit tests
  **18 passed**; API unit tests **22 passed**.
- `node scripts/validate-harness.mjs` passes.

## Completion notes

- The image subsystem is separate from the text provider:
  `ImageProvider` (abstract) with `OpenAiImageProvider` (`POST
  /v1/images/generations`, base64 response; model default `gpt-image-2.5-flare`)
  wired in the content module and reported through the system module.
- Schema migration `20261009080318_answers_knowledge_images` adds the
  `article_images` table (also created for TASK-0008's shared migration).
- Credentials documented in `apps/api/.env.example` and `deploy/api.env.example`
  (`IMAGE_API_KEY`/`OPENAI_IMAGE_API_KEY`, `IMAGE_MODEL`, `IMAGE_BASE_URL`,
  `CONTENT_ASSET_DIR`).

## State

- Implementation: complete
- Verification: complete (mocked/structural checks)
- Commit: committed on `main` (`68f7b25`)
- Deployment: deployed automatically by the systemd user timer (`68f7b25`; see
  live note)

## Live verification (deployed release)

- Deployed release `68f7b25`; deploy log shows migration
  `20261009080318_answers_knowledge_images` applied and "health checks passed";
  `prisma migrate status` up to date; loopback health 200. The System status
  reports `image: { provider: "openai-images", model: "gpt-image-2.5-flare",
  configured: false }`. No `IMAGE_API_KEY` is configured on the server, so
  generation returns 503 while cover uploads work without a credential. No paid
  image call was made.
