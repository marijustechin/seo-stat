# TASK-0010: Project-scoped WordPress integration and article export

- ID: TASK-0010
- State: completed
- Owner: agent
- Created: 2026-10-09
- Last updated: 2026-10-09

## Objective

Add a project-scoped WordPress integration and an explicit article-draft export
that creates or updates a WordPress **draft**. Credentials are stored with
authenticated encryption; external actions are recorded, concurrency-safe, and
conflict/uncertainty-aware. Also close out the outstanding image-generation
verification question.

## Scope

In scope:

- Project Settings WordPress section: site URL, username, dedicated Application
  Password, save/test/replace/disconnect, and clear configured/test states.
- HTTPS-only connection using WordPress Application Password; connection test
  verifies identity and capabilities and creates no content.
- Server-side authenticated encryption (AES-256-GCM) of the stored password with
  a deployment-managed key outside release directories; never returns the
  password; blank input preserves the stored credential.
- Shared public-URL/SSRF protections for outbound requests; authentication
  headers are never forwarded across origins after a redirect.
- Explicit "Send draft to WordPress" action with a pre-export summary; mapping of
  title, slug, excerpt, Markdown→safe HTML, selected cover → featured media, and
  cover alt text. Sources/claims stay local; SEO title/meta remain local.
- Reliable external-action records: attempts, local draft/version, destination,
  payload hash, remote post/media ids, timestamps, outcome, sanitized errors;
  concurrency protection; media reuse after success; partial-success and
  uncertain-outcome handling; remote-edit/non-draft detection; archived-project
  restrictions; export state in the UI.
- Never request publish or scheduled status.

Out of scope: LinkedIn/other publishing, Yoast/SEO-plugin synchronization,
scheduled publication, and image generation (image provider is unchanged).

## Acceptance criteria

- [x] WordPress settings with save, test connection, replace credential
      (blank preserves), disconnect, and configured/unconfigured + test states.
- [x] Application Password over HTTPS; connection test verifies identity and
      capabilities and creates no content.
- [x] Credentials encrypted server-side (AES-256-GCM) with a deployment key
      outside releases; never returned to the browser or written to logs, errors,
      Git, or task records.
- [x] Outbound requests use public-URL protections; auth headers are dropped on
      cross-origin redirects.
- [x] Explicit export with pre-export summary (destination, title, selected
      cover, stays-a-draft); exports only persisted values and the selected cover;
      unsaved edits are detected and block export.
- [x] Title/slug/excerpt mapped; Markdown→safe HTML; selected cover uploaded as
      featured media with alt text; sources/claims and internal notes stay out of
      the body; SEO title/meta stay local (no Yoast claim).
- [x] Export never requests publish or scheduled status, regardless of policy.
- [x] Export records persisted with local draft/version, destination, payload
      hash, remote ids, timestamps, outcome, and sanitized errors; concurrent
      exports prevented; same remote draft reused after success; unchanged media
      reused; partial success recorded; ambiguous timeouts marked uncertain and
      reconciled without blind retry; remote edits/non-draft detected and never
      overwritten.
- [x] UI shows export state, last exported version, changes since export, and a
      link to the WordPress editor; archived projects keep history but reject
      exports.
- [x] Image verification: key presence checked without printing; real generation
      attempted; provider rejection recorded as the exact sanitized blocker and
      left pending.

## Verification evidence

- API integration tests with a mocked WordPress client
  (`pnpm --filter @seo-stat/api test:e2e`): **45 passed** (2 health + 9 projects
  + 9 analysis + 14 content + 11 WordPress). WordPress coverage: encrypted
  storage (ciphertext is `v1.…`, never the plaintext, never returned), blank
  password preserves, HTTP URL rejected, project isolation, connection test
  identity + sanitized failure with no content created, export create with safe
  HTML and featured cover/alt, SEO fields not sent, concurrent-export 409,
  update same remote id with media reuse and re-upload on cover change, partial
  failure records media id, timeout→uncertain→reconcile (no blind retry),
  remote-edit and non-draft conflicts without overwrite, unsaved-edit guard,
  archived-project rejection with history readable, review policy + local SEO
  fields preserved, and export rejected when not connected.
- Unit tests: **33 passed** (API), including Markdown→safe HTML (escaping, safe
  links, code), AES-256-GCM round-trip/tamper/missing-key, and redirect
  header-stripping; web unit **18 passed**.
- `pnpm -r typecheck`, `pnpm -r lint`, and `pnpm -r build` pass;
  `node scripts/validate-harness.mjs` passes.
- No network or credential is used in tests (the WordPress client is stubbed;
  integration encryption uses a test key).

## Completion notes

- New Prisma models `wordpress_integrations` and `wordpress_exports` (migration
  `20261009101811_wordpress_integration`), including a partial unique index that
  allows only one in-progress export per draft.
- New `apps/api/src/modules/integrations` module (WordPress service/controller,
  REST client, credential crypto) and `apps/api/src/common` (SSRF/public-URL
  primitives moved there and reused by analysis; bounded JSON request helper;
  Markdown→HTML converter). The analysis `safe-fetch` re-exports the shared
  primitives so existing imports/tests are unchanged.
- Deployment: `bootstrap-admin.sh` and `install-user-units.sh` generate
  `/srv/seo-stat/config/integration.key` (mode 0600) and set
  `INTEGRATION_ENCRYPTION_KEY_FILE`; `system/status` reports
  `integrations.encryptionConfigured`; the System page shows it.
- The application has no authentication; WordPress routes are project-scoped
  like the rest of the API (recorded as an unresolved architectural decision).
- Image verification: `IMAGE_API_KEY` is configured, but the provider rejected
  real generation with `429 You have no credits remaining`; live image generation
  remains pending (see TASK-0009).

## State

- Implementation: complete
- Verification: complete (automated + structural). **Live WordPress verification
  is pending** — no WordPress credentials were available and none were created.
- Commit: committed on `main`
- Deployment: deployed automatically by the systemd user timer (see live note)

## Live verification

- Image generation: provider rejected (429 no credits) — pending (TASK-0009).
- WordPress: **pending**. No WordPress site/credentials were provided, and the
  task forbids acquiring them. The implementation is deployed; the exact setup
  steps are in `docs/deployment.md`. When credentials are available, exercise one
  real create and one update, confirming the same remote post id, the cover as
  featured media, and `status: draft` (no publication).
