---
name: wrong-on-purpose-and-load-bearing
description: "some wrong strings are the evidence — a fabricated SHA kept beside its own correction, a wrong path quoted in order to be described, a retracted accusation preserved so there is a trace it was made; repairing any of them destroys the record"
metadata:
  node_type: memory
  type: feedback
  originSessionId: f606abe8-feca-4f85-a2e1-0ec2f70e5c18
  modified: 2026-09-10T09:30:48.234Z
---

**Ward Flow, 2026-09-08 to 09-10. A tool reported 118 broken citations across 419 documents. Two
were defects.** Of the rest, a whole class was **wrong deliberately**, and the single most valuable
output of that work was not a repair — **it was a list of things that must never be repaired.**

**The instances, each a different reason:**

- **A fabricated commit SHA left standing beside its own correction.** The row says _"I quoted a
  commit SHA I had invented"_ and names the real one. **The dangling SHA IS the evidence that a
  fabrication was caught.** Repairing it leaves the register describing a mistake that no longer
  appears to have happened.
- **A wrong path quoted IN ORDER TO BE DESCRIBED** — a finding whose whole content is "this citation
  is wrong". Replacing the string deletes the finding and leaves the row saying nothing.
- **A retracted false accusation about a peer**, kept inside its own withdrawal so there is a trace
  the accusation was made. A sweep that "corrects" it erases that trace.
- **Fictional paths illustrating how a gate behaves**, and **files a plan PROPOSES** under a heading
  reading "New file". Neither is a claim that anything exists.
- **An open unknown** — a guard file nobody can name. Left reporting **deliberately**, because it is
  not a known-good exception and should keep asking.

**The generalisation, which is the transferable half:**

> **A document about a wrong identifier will contain the wrong identifier. That is what makes it
> useful.** Assume any unresolvable citation sitting next to its own correction is deliberate until
> the sentence around it has been read.

**How to apply:**

1. **Read the surrounding sentence before repairing any flagged string.** `grep -o ".\{300\}<x>.\{300\}"`,
   never the count. **A presence check cannot distinguish a claim standing from a claim quoted inside
   its retraction — both states contain the string.**
2. **Do NOT add a checker exemption or allowlist entry.** An exemption is a small silent claim that a
   string is known-good; it makes the tool green and the evidence invisible. **Leave it reporting and
   explain it in prose a reader can check.** Where the tool must stay red forever, say so and why.
3. **The list is not about one tool.** Two of its entries are not citations at all and no citation
   gate flags them. **It governs any text sweep** — a grep for withdrawn claims, a wording guard, a
   find-and-replace.
4. **Consequence worth stating out loud:** done properly, **the more retractions an honest record
   contains, the more hits a naive sweep returns, and the worse that record looks.** Never rank
   records by hit count.

Full list with reasons: `docs/ward-flow/archive/dated-notes/citation-repair-handover-2026-09-08.md`; the reasoning behind
it: `docs/ward-flow/archive/dated-notes/citation-repair-session-record-2026-09-10.md`.

Related: [[writing-the-defect-down-collides-with-the-check]],
[[publishing-a-verdict-into-the-artefact-under-trace]], [[a-grep-for-a-filename-finds-its-prose]],
[[a-comment-can-satisfy-a-guard]], [[a-retraction-does-not-travel]].
