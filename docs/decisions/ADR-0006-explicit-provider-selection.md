# ADR-0006: Explicit AI provider selection with no automatic fallback

- Status: accepted
- Recorded: 2026-10-13
- Source of truth: [docs/functional-architecture.md](../functional-architecture.md),
  [AGENTS.md](../../AGENTS.md)
- Supersedes: none

## Decision

- **Text and analysis**: one provider behind a small interface (DeepSeek, through
  the OpenAI-compatible SDK). Configuration is global and server-side. No OpenAI
  credential is required.
- **Images**: the provider is selected **explicitly** by `IMAGE_PROVIDER` -
  `cloudflare` (Workers AI `@cf/black-forest-labs/flux-1-schnell`), `gemini`
  (official `@google/genai` SDK, `gemini-3.1-flash-image`), or `openai`.
- There is **no automatic fallback** between image providers. A stray
  `IMAGE_API_KEY` does not enable OpenAI.

## Rationale

Recorded in the functional architecture, and it is the reason this record exists.

- Quota exhaustion must never silently move spend to a different, paid provider.
  Cloudflare free-plan code `3036` (daily allocation exhausted) and `3040`
  (temporary capacity) surface as clear 429 responses, `5035` (paid-only) is
  reported without upgrading, and quota is not retried.
- A configuration mistake must surface as unavailable, not as a different provider
  quietly answering.
- Reported usage must be real. Cloudflare does not report usage, so the UI says
  "usage not reported" rather than inventing tokens, quota, or a zero cost.

## Consequences

- An unconfigured image provider returns 503 and the UI shows an unavailable
  state. Uploads keep working, so the feature degrades instead of failing.
- The actual image format and dimensions are detected from the returned bytes, not
  taken from the request.
- Provider, model, submitted prompt, parameters, and usage are recorded per
  attempt; failed attempts stay in the per-draft history.
- Error classes are distinguished (quota/rate, auth/permission, capacity,
  invalid) rather than collapsed into one failure.
- The System page reports each provider and its configuration separately.
- Adding a provider means adding a branch behind the interface plus its own
  credential, tests, and selection value - not a fallback chain.

## Reopen only if

The operator explicitly accepts a paid fallback, or wants automatic provider
routing, and records the cost and safety consequences as a new ADR that supersedes
this one.
