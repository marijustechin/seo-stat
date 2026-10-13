# ADR-0009: No authentication in the current deployment

- Status: **accepted (limitation)**
- Recorded: 2026-10-13
- Source of truth: [docs/architecture.md](../architecture.md),
  [docs/functional-architecture.md](../functional-architecture.md)
- Supersedes: none

## Decision

The API trusts the caller. Access control relies on the private network and nginx,
not on the application.

Project scoping limits **which records are visible**, but it is not identity-based
authentication and it is not an authorization boundary. This includes the content
image-file route and the WordPress integration and export routes: a request
without any credential succeeds.

## Rationale

Recorded explicitly as a known limitation rather than left implicit, so that it is
read as a deliberate scope decision and not discovered later as an oversight. The
product scope in [docs/product.md](../product.md) places multi-user accounts,
roles, and permissions out of the MVP.

## Consequences

- **The application must not be exposed beyond the private network.** Anything that
  makes it reachable from a wider network requires authentication first.
- Every new route inherits "trusted caller" until authentication exists. A new
  route that performs an irreversible external action therefore increases the
  stakes of this limitation.
- Third-party tokens are the sharpest edge: ROADMAP-07 and ROADMAP-08 in
  [docs/ROADMAP.md](../ROADMAP.md) would hold LinkedIn and Google credentials in
  a system where any caller on the network is trusted.
- The content image route validates project and draft association only, treats the
  stored path as a basename to prevent traversal, and returns 404 for another
  project. That is scoping, not security.
- No task may describe the absence of authentication as a security feature, and no
  record may claim the API is access-controlled.

## Reopen only if

Authentication and access control are implemented (ROADMAP-10). That work
supersedes this record, and the replacing ADR must state what the identity source
is and how existing project-scoped routes change.
