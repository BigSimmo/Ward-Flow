---
name: a-screen-that-names-its-own-panel
description: "Rendered UI prose can cross-reference another panel BY ITS HEADING, so a rename breaks a live pointer; and a whole-screen toContain satisfied by both sites cannot say which it walked"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 99a23426-c7b5-442f-8067-f5ed285ac016
  modified: 2026-09-11T07:33:26.168Z
---

Renaming a panel heading has a blast radius that includes **the screen's own sentences about
itself**. Ward Flow, 2026-09-11, D-20-REVISED: the ward screen's bed note explains that a _held_
bed is not a bed _pulled_ for a named patient, and then tells the coordinator where the pulled ones
live — _"Those are in "Accepted, pulled or en route here" below."_ That is a live cross-reference to
another panel, by its heading text. Ward Lead's ruling named two test assertions to re-point; the
actual search found **four sites across two files**, and this one was rendered prose, not a test.
Renaming the heading alone would have left a sentence on screen directing a coordinator to a panel
nothing calls by that name.

**Why:** a heading is an identifier that other copy quotes. Tests and greps look for the heading's
_definition_; nothing looks for the places that _cite_ it, because a citation is indistinguishable
from ordinary prose. The two hazards already filed — [[a-comment-that-quotes-the-string-it-removes]]
and [[a-grep-for-a-filename-finds-its-prose]] — are about COMMENTS and DOCS. This one ships to a
clinician.

**And the guard covering it could not say what it had walked.** The assertion read
`toContain("Accepted, pulled or en route here")` against the _whole screen's_ text — satisfied by
the heading OR by the sentence quoting it, indistinguishably, so it would have stayed green if
either one survived alone. Same family as [[looking-at-the-screen-misattributes]] and
[[a-property-whose-operands-can-coincide]]: the measurement is real, the attribution is not.

**How to apply:** before renaming any visible label, grep the FULL old string across `src/` and read
every hit for whether it _defines_ the name or _cites_ it — a hit inside a paragraph is a citation
and must move too. Remember HTML entities: the citation was written `&ldquo;…&rdquo;`, so a search
for the string with real curly quotes finds nothing (see [[absence-under-one-prefix]]). When an
assertion could be satisfied by two sites, anchor it to the surrounding clause so it names one.
Related: [[a-line-number-is-a-different-number-in-every-tree]] — a ruling that names `:89` and `:130`
is naming sites in the ruler's tree, not a complete list.
