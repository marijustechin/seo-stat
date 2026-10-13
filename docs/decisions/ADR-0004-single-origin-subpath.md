# ADR-0004: Single-origin subpath deployment on loopback ports 3011/3012

- Status: accepted
- Recorded: 2026-10-13
- Source of truth: [AGENTS.md](../../AGENTS.md),
  [docs/architecture.md](../architecture.md), asserted by
  [scripts/smoke-subpath.mjs](../../scripts/smoke-subpath.mjs)
- Supersedes: none

## Decision

- Public UI: `https://192.168.8.50/seo-stat/`.
- Browser-facing API prefix: `/seo-stat/api/`, on the **same origin** as the UI.
- The API binds `127.0.0.1:3011` and the web app binds `127.0.0.1:3012`. Both are
  loopback. nginx is the only public entry point.
- Next.js runs with base path `/seo-stat` and trailing slashes. `/seo-stat`
  redirects canonically to `/seo-stat/`, while root `/api/` and `/_next/` are
  rejected.

## Rationale

One origin means browser requests need no cross-origin configuration, and one
public entry point means there is a single place to terminate TLS and apply
access rules. Binding the applications to loopback keeps them off the network even
though they run on a shared host.

## Consequences

- Browser code must issue relative, same-origin requests under `/seo-stat/api/`.
  An absolute URL to another host or port breaks the model.
- Ports 3011 and 3012 are checked mechanically: `apps/api/.env.example`,
  `apps/web` dev and start scripts, the Next.js API proxy target, and the smoke
  test default. Changing a port means changing all of them.
- New static or public assets must survive the subpath, and the smoke test is the
  place that proves it.
- Anything served outside `/seo-stat` is a new public surface and needs its own
  justification.

## Reopen only if

A second public entry point or a different hostname is genuinely required. That
change touches `AGENTS.md`, [docs/deployment.md](../deployment.md),
`apps/web/next.config.mjs`, and the smoke test together.
