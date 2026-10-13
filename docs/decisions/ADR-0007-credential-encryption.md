# ADR-0007: Integration credentials encrypted server-side, key outside releases

- Status: accepted
- Recorded: 2026-10-13
- Source of truth: [docs/functional-architecture.md](../functional-architecture.md),
  [docs/architecture.md](../architecture.md), [AGENTS.md](../../AGENTS.md)
- Supersedes: none

## Decision

- Integration credentials (for example a WordPress Application Password) are
  stored **server-side**, encrypted with authenticated encryption (AES-256-GCM).
- The encryption key is deployment-managed and lives **outside the release
  directories**.
- A stored credential is never returned to the browser, written to a log, or
  placed in an API error. Leaving the password field blank preserves the stored
  value.
- Connection attempts use HTTPS only. Authentication headers are never forwarded
  to a different origin after a redirect.
- Secrets stay outside tracked files. Real values live in untracked environment
  files or the server secret store; `.gitignore` is the enforcement.

## Rationale

Two documented reasons. First, release directories are replaced on every
deployment, so a key stored inside one would be destroyed by a routine deploy.
Second, the browser and the logs are the two places a credential most easily
escapes, so both are closed by rule rather than by care.

## Consequences

- Key management is an operator prerequisite, not an application feature. Losing
  the key makes stored credentials unreadable and they must be re-entered.
- Rotating the key requires re-entering credentials; there is no re-encryption
  path yet.
- Outbound requests to an integration share the public-URL and SSRF protections
  used elsewhere, so an integration cannot be pointed at an internal address.
- Secrets must never appear in a consult packet
  ([docs/consult/README.md](../consult/README.md)), a task record, or a
  conversation. Refer to a credential by name.
- Any new integration inherits this storage path instead of inventing its own.

## Reopen only if

A different key-management mechanism (for example an external secret manager) is
adopted. That is a change to the architecture document and the deployment notes
together, with a migration path for already-stored credentials.
