---
name: the-artefact-you-search-is-not-the-artefact-that-runs
description: "build-time generation makes declarations invisible to grep and dev-only names invisible in production, so a clean search result is meaningless"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 2b6afefc-3c5d-42e8-9a09-d310ecde7e2f
  modified: 2026-09-04T20:48:36.033Z
---

**Anything generated at build is invisible to a search over `src/`, and anything that exists only in
dev is invisible in a production build.** Both return clean, believable, wrong answers.

Three instances in one night, all in the same programme:

1. **Tailwind 4's `@theme`** declares `--text-2xl`, `--text-base` and their family at build. No source
   file contains the declaration, so an undeclared-token sweep reported four false positives —
   including the worst-looking one, a `var()` with **no fallback at all**, which would have been a
   dropped property rather than a substituted one.
2. **CSS-module class names keep the source filename in dev and drop it in a production build.** A
   Playwright selector of `[class*="ward-panel-module"]` matched nothing on a page that had rendered
   perfectly. Chosen over `[data-level]` _because it looked more precise_ — precision and portability
   pulled opposite ways and the careful-looking choice was the wrong one. Fixed with a
   `data-ward-primitive` attribute.
3. **Vitest does not resolve CSS-module `composes` targets.** A `composes: … from "./x.module.css"`
   written from inside a subfolder pointed at a file that does not exist. The stylesheet cannot
   build, the token layer silently does not apply, every token in the file becomes undeclared — and
   **every contract test and DOM test still passed.**

⚠️ **The failure always surfaces downstream of every gate an adopter is told to run** — at build, or
in a browser, or on paper.

**How to apply.** Resolve on a running page, or say you did not. Select by `data-*`, never by a
generated class name. Assert that a `composes`/import target file exists, since the test runner will
not. And before believing any "declared nowhere" claim, ask whether the declaration could be
generated.

⚠️ **The companion rule, which mattered more than the findings:** _name what your method cannot see._
Both read-only sweeps that night flagged their own blind spot unprompted — "this family may be
Tailwind-generated and outside a source search" — and both times **the flagged uncertainty, not the
finding, was what turned out to matter.** A tool that says "I may not be able to see this" is worth
more than one that is right more often. Put it in every brief template.

Related: [[an-alias-defeats-a-name-matching-detector]], [[compliance-without-coverage]],
[[focused-runs-cannot-select-readfilesync-tests]], [[measure-the-thing-not-a-proxy]].

## 🔴 The fourth instance happened INSIDE the fix for the first three

Same night, hours after replacing every CSS-module class-name hook with a `data-*` attribute
precisely because of this defect, the same chat reached for `[class*=screen]` **in a probe it was
adding to serve as the control for another measurement.**

It matched nothing in the production build, fell through to `body > div`, and read two custom
properties off an element that has neither. The test then printed a confident verdict — _"SAME —
the repoint changes nothing painted; five files carry a block with no effect"_ — **computed from two
empty strings.** That verdict was one relay away from becoming a decision about 28 stylesheets.

⚠️ **In its own words: "the habit is 'select by what the CSS calls it', and that habit does not know
which build it is in."** Knowing the defect does not disarm the habit — the habit fires when you need
a new element, which is exactly when you are thinking about something else.

**Two fixes, and the first is the general one:**

1. **Remove the selector rather than correct it.** Custom properties inherit, so read them off the
   element you are already measuring — `getComputedStyle(measuredEl).getPropertyValue("--x")` —
   instead of finding a "root" to read them from. **No selector to get wrong.** Prefer a design with
   no lookup over a lookup done correctly.
2. **Floor the control itself.** An empty token string must FAIL, with a message saying the
   comparison below cannot be interpreted. ⚠️ **The control needed a control** — it was added to
   prove another measurement meant something, and had no way to report that it had itself not run.

## 🔴 The fifth instance, also inside the fix, and this time the COMMENT is what hid it

One hour after the fourth, in the same file:

    const strip = field?.parentElement ?? null;  // the filter strip, bordered with --ward-border

`field` came from `input.closest("div")`. In that component the input's ancestors are `<label>`,
`<form>`, `<main>` — **none of them divs** — so `closest("div")` returns the screen root itself, and
`.parentElement` is the element ABOVE it. The probe then read a token off an ancestor of the thing it
meant to measure, got a plausible hex, and printed a verdict about whether an override applied.

⚠️ **This one resolves to a real element.** The dev-only class name at least produced empty strings.
An ancestor walk that overshoots returns something real, inherits real custom properties, and paints
a real colour — **so no floor, no anti-vacuity guard and no "did the selector match" check can catch
it.** The only thing that catches it is reading the DOM the selector actually walks.

⚠️ **And the trailing comment is why nobody read it.** `// the filter strip` asserts the answer, and
the code beside it is not obviously wrong. Two people read past it. A comment naming what a selector
picks is a claim, and it decays the moment the markup changes — nothing local ever fails. See
[[comments-that-recruit]].

**How to apply.** `closest()` and `parentElement` are lookups that assume a DOM shape; a `data-*`
hook on the element you mean has no shape to assume. Where a walk is unavoidable, assert what it
found (`expect(strip.tagName).toBe("FORM")`) rather than describing it in a comment.

## The sixth: `borderTopColor` on a zero-width border reports a colour it never draws

Third wrong element in the same probe, caught by its own control. It measured the first row of a
list, whose `border-top: 0` makes `borderTopColor` fall back to `currentColor` — **so the comparison
was a border against text.** The control caught it unaided: the two values had to be identical in
ordinary colours and read `rgb(102,112,133)` against `rgb(27,37,51)`.

⚠️ **Three wrong elements in a row and not one produced an error.** A dev-only class name, an
ancestor walk that overshot, and a real element whose property answers when nothing is painted.
**How to apply:** before comparing two computed colours, assert both are actually drawn — a zero
width, `border-style: none`, or a transparent fill all still return a colour. And keep a control that
must hold in the ordinary case; it is the only thing that caught this one.

## A subagent sharing your worktree makes the working tree an unreliable baseline

Observed 2026-09-05. I measured six CSS modules to verify a colleague's characterisation and got
nonsense — one rule per file where there should be six, no colour tokens at all. **A subagent I had
dispatched into this same worktree had already migrated those files an hour earlier**, replacing the
rules with `composes:`. The measurement was perfectly correct about the artefact in front of it, and
that artefact was not the one the question was about.

**Nothing errored, and the numbers were internally consistent** — six files, six plausible answers,
all wrong together, which is the shape that survives a sanity check. I noticed only because a
comment in one file mentioned a component that had not existed when the question was asked.

**How to apply:** while a subagent, teammate or another session is mid-write in your worktree,
measure the repository at a **ref**, not on disk — `git cat-file blob HEAD:<path>` or
`git show <ref>:<path>`. Check `git status --porcelain` before believing any file-level measurement,
and treat a surprising uniformity across files as a signal that you are reading the wrong artefact.
Same family as [[a-baseline-from-the-subject-vouches-for-it]] and
[[verify-in-head-not-the-working-tree]]: the error is in the scope of the artefact rather than in
the number.

**2026-09-06 — the worktree you are standing in is one of these artefacts.** Asked to survey every
monospace declaration across ward stylesheets and measure each in a browser, I was about to run it in
my own worktree. Measured first: **25 of 51 ward stylesheets and 25 of 63 ward components differed
from the integration line** — including the very files the survey was about. The output would have
been a careful, per-node, correctly-unitted answer **about a tree nobody uses**, and nothing in it
would have looked wrong.

**A branch that is behind is not "slightly out of date" for measurement purposes; it is a different
subject.** The staleness banner said "154 commits behind" and I had read it as a note about basing
new work, not as a statement that my copy of the thing under study was wrong.

**Before any survey, audit or census, diff the subject files between your tree and the line that
actually runs, and put that number at the top of the report.** If they differ, either update the tree
or say plainly which tree you measured — a survey whose subject is unstated is unusable later even if
it was right when written.

**And one counting trap found in the same check:** `git grep <pattern> <rev> -- 'dir/**/*.css'`
returned **10**, while the same search with a plain directory pathspec returned **26**.
`git ls-tree` with that identical `**` pathspec matched **zero files**. The two commands disagreed
about the same pathspec and the wrong number was plausible rather than empty — so it would have been
believed. Reconcile any count against a second spelling of the same query before quoting it.
