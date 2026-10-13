# TASK-0016: Internal and external link planning

- ID: TASK-0016
- State: completed
- Owner: agent
- Created: 2026-10-13
- Last updated: 2026-10-13

## Objective

Implement ROADMAP-05: an article should link to the project's own relevant pages
and, where useful, to external sources - without ever shipping an invented
address.

**Metric: invented or broken link URLs that reach a saved draft = 0.** The rule is
[ADR-0012](../docs/decisions/ADR-0012-link-justification.md): an internal link must
be a page from the project's own URL list, and an external link must be a URL
retrieved during the same run. Anything else keeps its anchor text and loses the
URL, and the removal is recorded.

This task deliberately does **not** build a URL inventory subsystem: no crawl, no
maintained index, no link-graph analysis, no per-page relevance scoring. An earlier
version of ROADMAP-05 described exactly that, and it was corrected after the
operator pointed out that the requirement is simply "link to the wholesale page and
to contacts".

## Scope

In scope:

- `content.links.ts`: a bounded sitemap reader behind an injectable port, candidate
  selection, and the link policy applied to the generated body.
- The project URL list is the sitemap when there is one, otherwise the pages the
  research already retrieved; the writer is given those paths and nothing else.
- Recording on the run: source, candidate count, truncation, kept links, and
  removed links with reasons (`ContentRun.linkPlan`).
- Exposure through the run view and the draft view, and one compact section in the
  existing read-only report panel.
- The sitemap is read with the shared SSRF-protected, size- and time-bounded fetch.

Out of scope: any crawl, index, or scoring; changing the claim guard or the gap
digest; changing providers, credentials, publishing policy, or the review gates for
external actions; and any change to how a draft is exported or published.

## Acceptance criteria

- [x] 1. The writer is given only URLs that exist on the project's own site; the
      prompt contains no invented target.
- [x] 2. An internal link whose path is in the project list is kept; one that is
      not loses its URL, keeps its anchor text, and is recorded with a reason.
- [x] 3. An external link is kept only when the URL was retrieved during that run;
      otherwise it is removed and recorded.
- [x] 4. With no sitemap and no retrievable pages, no internal links are placed and
      the empty list is recorded rather than guessed.
- [x] 5. When the sitemap is unusable, the pages the research already retrieved are
      used instead.
- [x] 6. The record survives a reload and stays associated with the run and the
      draft version that produced it, on both the run and draft endpoints.
- [x] 7. Images, `mailto:`, `tel:`, and fragment links are left untouched.
- [x] 8. The per-article caps are enforced and the overflow is recorded.
- [x] 9. Link planning adds no crawl and no new provider, and reading the sitemap
      goes through the existing bounded fetch.
- [x] 10. A link-planning failure cannot fail a generation run: an unreadable or
      malformed sitemap yields an empty list, and the article is still produced.

## Verification evidence

Unit tests, `pnpm -C apps/api test`:

```
 Test Files  17 passed (17)
      Tests  101 passed (101)
```

`content.links.spec.ts` is new and covers candidate selection (sitemap preference,
research fallback, foreign origins, excluded non-content paths, deduplication,
shallow-first ordering, the cap and `truncated`, unusable entries) and the link
policy (allowed internal kept, invented internal removed with the text preserved,
retrieved external kept including a trailing-slash difference, unretrieved external
removed, a relative link unverifiable without an origin, images and `mailto:`/`tel:`/
fragments untouched, both caps enforced, and a link-free body unchanged).

End-to-end tests against PostgreSQL 17 (`pnpm db:up`, `prisma migrate deploy`, then
`pnpm --filter @seo-stat/api test:e2e`):

```
 Test Files  5 passed (5)
      Tests  58 passed (58)
```

`test/content.e2e-spec.ts` now has 27 tests, three of them new: a body containing
one allowed internal link, one invented internal link, one retrieved external link,
and one unretrieved external link; a project with no URL list at all; and the
fallback to research-discovered pages. They exercise the real run and persistence
path, including the new column.

Full workspace checks, all exit 0: `pnpm -r typecheck`, `pnpm -r lint`,
`pnpm -r test`, `pnpm -r build`.

Harness validation, `node scripts/validate-harness.mjs`:

```
Harness validation passed.
  Markdown files scanned: 42
  Local links checked:    140
  Task records found:     16 (16 completed)
  Project rules:          versions, ESM, ports OK
```

Migration `20261013150000_content_run_link_plan` applied by `prisma migrate deploy`,
adding `content_runs.link_plan` (JSONB, additive).

**Not verified in a browser.** There is no browser access from this environment
(ROADMAP-14), so the panel section is verified by typecheck and lint only. The same
limitation applies to TASK-0015 and is recorded there.

## Completion notes

- **Scope was corrected by the operator, and the correction is in the roadmap.** An
  earlier ROADMAP-05 described a per-project URL inventory with refresh, relevance
  selection, and validation; the operator's actual requirement was "one link to the
  wholesale page, one to contacts, maybe one external". The item is now size S and
  names what is explicitly out of scope. This is the second time an item was
  over-specified in this repository, and both corrections came from the operator
  rather than from review.
- **The only part that genuinely needed engineering is the URL list.** Everything
  else is a prompt instruction. Without a list the writer guesses slugs, and slugs
  are guessable, so an invented address in a published article is the natural
  failure mode of this feature.
- The sitemap reader is a separate injectable port (`ContentLinkSource`), so the
  end-to-end tests are deterministic and never touch the network, matching the
  existing `AnalysisResearch` seam.
- **The shared fetch's content-type allowlist was widened to include XML.** A
  sitemap is `application/xml` or `text/xml` and the shared helper rejected both.
  The change is one regex, is additive, and does not touch the address-based SSRF
  protections, sizes, timeouts, or redirect handling. It is recorded here because it
  is a change to shared analysis infrastructure made for a content-module need.
- A sitemap **index** is followed for at most two child sitemaps. That bound keeps
  the worst case (four requests, each with the existing 10 s timeout and one retry)
  in the same range as the research call the run already makes.
- **Removal preserves the sentence.** A removed link becomes plain text rather than
  deleting the anchor or the sentence, so an article is still readable when a target
  is missing - the same "neutral, not destructive" choice the claim guard makes.
- Non-content paths are excluded deterministically (feeds, tags, authors, search,
  pagination, date archives, WordPress internals) rather than by scoring. That is a
  fixed rule, not a heuristic that has to be tuned.
- The two caps (6 internal, 3 external) are generous on purpose, in line with the
  operator's "three is not a limit". They exist to stop padding, not to ration
  links, and the overflow is recorded so a cap that bites is visible.
- Sharing one panel for the gap report and the link record is a naming compromise:
  the component is still `GapDigestPanel`. It renders whichever of the two records
  exists and no control of any kind.

## State

- Implementation: complete
- Verification: complete for unit, end-to-end, typecheck, lint, and build;
  **browser verification not performed** (no browser access in this environment)
- Commit: not committed
- Deployment: not deployed
