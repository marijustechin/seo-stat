# seo-stat

Local-server toolkit that will schedule content research, article generation,
website publishing, LinkedIn publishing, and Google performance reporting.

## Current state

Development harness only. There is **no application code** yet. No external
accounts are connected, nothing is published, the server is not configured, and
nothing is deployed. See `tasks/INDEX.md` for task tracking; the bootstrap task
is `tasks/TASK-0001-bootstrap-harness.md`.

The harness is version-controlled on GitHub at
https://github.com/marijustechin/seo-stat with harness CI defined in
`.github/workflows/harness.yml` (see below).

## Repository layout

```
AGENTS.md            Working rules for contributors/agents
README.md            This file
docs/                product, architecture, deployment notes
tasks/               task lifecycle, template, records, index
scripts/             harness validation (no dependencies)
```

## Repository and CI

- GitHub: https://github.com/marijustechin/seo-stat
- Primary branch: `main`
- CI: `.github/workflows/harness.yml` runs the harness validator on pushes and
  pull requests to `main`, using Node 24, read-only `contents` permission, and
  no package installation (the validator has no dependencies).

## Harness validation

One documented command verifies the harness:

```
node scripts/validate-harness.mjs
```

It checks that completed task records contain the required sections and state
fields, and that local Markdown links resolve. Requires Node.js (developed
against Node 24); no third-party dependencies.

CI runs the same command on GitHub. A passing local run is **not** evidence of a
successful CI run; check the GitHub Actions tab for the recorded result.

## Next steps

- Review the open decisions in `docs/architecture.md` and `docs/deployment.md`.
- Confirm the server details recorded as unknown in `docs/deployment.md`.
- Start the first implementation task listed in `tasks/INDEX.md`.
