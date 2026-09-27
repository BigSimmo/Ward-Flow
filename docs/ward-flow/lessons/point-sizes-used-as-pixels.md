---
name: point-sizes-used-as-pixels
description: "A self-written contrast checker copied WCAG's large-text figures in points (18pt, 14pt bold) as pixels, so its ALL GREEN relaxed the floor for text it should have held; read the checker's threshold against the spec before trusting its green"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 29c363eb-169a-4dac-8951-045babf2d37d
  modified: 2026-09-09T12:05:25.809Z
---

The Ward Flow third-edition harness (`third-edition-kit/check.mjs`, `check-standard.mjs`) treated text
at 18.66px regular or 14px bold as "large" and held it to 3:1 instead of 4.5:1. WCAG's large text is
18 **point** regular or 14 **point** bold, which is 24px, or 18.66px bold. The figures were right and
the unit was wrong, and the two ALL GREEN runs recorded on 8 September 2026 were measured with it. A
second reviewer's chat found it on 9 September 2026 (their finding 1). The same harness also sampled
only the first window of each page and skipped SVG text without saying so, so "0 low of 433" read as
whole-page coverage.

**Why:** a checker written alongside the thing it checks inherits the author's understanding, and a
green from it proves the author's rule held, not the spec's. It is the same shape as
[[a-test-co-authored-with-the-code]] and [[broken-and-never-worked-look-identical]]: the wrong
threshold never produced a red, so nothing prompted anyone to open it.

**How to apply:** before quoting a harness's green as proof, open the line that decides pass or fail
and compare its constant and its unit with the source it claims to implement. When a checker samples,
make it print what it did not sample (the SVG text count, the scroll steps) so the reader cannot mistake
a window for the page. Corrected on 9 September 2026: the pages still pass under the right rule, which
is the only reason the wrong one was harmless.
