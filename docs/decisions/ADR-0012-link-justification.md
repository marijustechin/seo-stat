# ADR-0012: A link URL is never invented

- Status: accepted
- Recorded: 2026-10-13
- Source of truth: this record; it implements ROADMAP-05
- Amends: none
- Supersedes: none

## Decision

Article generation may place links, but only links it can justify.

- An **internal link** must target a page from the project's own URL list. That
  list is read once per run from the project's `sitemap.xml`, or, when there is no
  usable sitemap, from the pages the research already retrieved from the project
  site. If neither yields a list, **no internal links are placed**.
- An **external link** must target a URL that was actually retrieved during that
  run.
- Any other link **keeps its anchor text and loses the URL**. The removal, with its
  reason, is recorded on the run.
- The list is bounded but generous, and relevance rather than the cap decides how
  many links an article uses. `mailto:`, `tel:`, fragments, and images are not
  link targets and are left untouched.
- Out of scope by decision: a crawl, a maintained URL index, link-graph analysis,
  and per-page relevance scoring.

## Rationale

The cheap failure mode of automatic linking is a plausible-looking invented URL.
Slugs are guessable, so a writer that *may* invent them *will*, and the result is
a 404 on a published page - invisible until someone clicks it, and damaging
exactly where the feature was supposed to help.

Validation is what makes the feature safe to run unattended, and it is the same
rule [ADR-0011](ADR-0011-gap-resolution-digest.md) already applies to claims: a
statement backed by real evidence is kept, and everything else is recorded instead
of asserted. Links are claims about the world ("this page exists"), so they get
the same treatment.

The alternative - asking the writer to be careful, or asking the operator to
approve links - is either unenforceable or another human gate, and
[ADR-0010](ADR-0010-unattended-content-pipeline.md) removed those.

## Consequences

- A project with no sitemap and no retrievable pages gets articles without
  internal links. That is a valid outcome, and it is recorded rather than guessed.
- A systematically missing list (a broken sitemap, a wrong website URL) becomes
  visible in the link record, which is the diagnostic that would otherwise be
  missing.
- Reading the sitemap uses the shared SSRF-protected, size- and time-bounded
  fetch. That fetch's content-type allowlist was widened to include XML for this
  purpose, so a sitemap is never read outside the existing protections.
- The prompt only ever receives URLs that exist, which also removes a class of
  model failure: it cannot pick a wrong target from a list it was not given.
- Removed links leave readable prose behind. A sentence whose claim rested on a
  removed link still reads, and the removal is recorded.

## Reopen only if

A URL can be validated by a means this record does not consider - for example a
live availability check per candidate target before placement. That is a new
record. **Weakening "a URL is never invented" is not a reopen**: it is the whole
point of this decision.
