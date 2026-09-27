---
name: publishing-a-verdict-into-the-artefact-under-trace
description: "A correction written where the false claim lived is the only kind the next reader finds, and the same act closes the question to independent re-checking"
metadata:
  node_type: memory
  type: feedback
  originSessionId: b1ace96a-832b-4e38-9f46-6c2896334ea0
  modified: 2026-09-04T10:34:00.092Z
---

2026-09-04. A rule was attributed in code to "the owner's decision". A provenance search found no
such ruling, so I corrected the attribution **in the two files that carried the false claim** —
which is where a correction has to go if the next reader is to find it.

**That act destroyed the possibility of an independent re-trace.** A tracer of that rule reads those
two files first — the restraint is _in_ them — so any second opinion reached afterwards would be
confirmation, not replication.

⚠️ **Both properties come from the same act, and neither is the mistake.** A correction that is not
in the artefact is not found; a correction that is in the artefact is read before the evidence.

**The resolution, from the peer who could not then run the check:** for a rule that matters, the
verdict belongs somewhere a tracer will not stumble on, with a **pointer** from the code — the
comment should say _"provenance assessed, see X"_, not the verdict itself. Findable, and still open
to a second pass.

⚠️ **AND IT SURVIVED BY LUCK, WHICH IS THE PART WORTH KEEPING.** The verdict was published as a
single TOKEN — one word — while the independent check was a search of the ruling corpus for
_subject_ terms ("ward index", "digit", "All wards"). Those did not collide, so the corpus question
stayed answerable. **Had the same conclusion been published as a SENTENCE — "no owner ruling mentions
the ward index" — the peer's search would have been reading my conclusion back to me** and returning
it as agreement.

**So the thing that made the correction findable (a greppable single word) is the same thing that
left the second check intact.** That was not designed.

**How to apply:** before recording a conclusion inside the thing it is about, ask what a future
independent check would have to read, and whether your text will be in its path. If it will, publish
the finding elsewhere and leave a pointer. And when a peer's check agrees with you, establish whether
they could have seen your answer — **agreement from a contaminated check is worth less than no check
at all**, because it feels like replication.

Related: [[a-correction-that-agrees-with-you]], [[false-attribution-manufactures-corroboration]],
[[a-humble-conclusion-is-under-audited]], [[agreeing-checks-with-one-blind-spot]],
[[observations-expire]].

---

## 2026-09-08 — the same act also defeats every search for the retracted phrase

Retracting **in place** means quoting the withdrawn claim inside its own withdrawal, so the words
stay on the page. **A presence check cannot separate a claim standing from a claim quoted inside its
retraction — both states contain the string.** Done properly, the more retractions a record holds,
the more hits a naive sweep returns and the worse the record looks. Read the match
(`grep -o ".\{300\}<phrase>.\{300\}"`), never the count.

⚠️ **Both grep directions were measured live on one file pair within an hour, neither from a careless
search:** a line-scoped grep reported a sentence ABSENT (it wrapped across two lines, and markdown
wraps everything); a wrap-safe count reported a retracted claim PRESENT (it was the retraction
quoting itself). **The wrap-safe fix for the first cannot fix the second.** See
[[a-measurement-is-scoped-to-what-it-measured]] and [[establish-the-unit-before-counting]].

## Raising a discrepancy so it resolves in one round, not three

Ward Lead's method, and it is why five apparent contradictions in one session each dissolved
immediately. Suspecting I had published a command different from the one I ran, they:

1. **quoted my command back verbatim** rather than characterising it,
2. **ran it themselves** and printed what it returned,
3. **said plainly they could not tell which I had executed, and refused to guess.**

That left nothing to argue with except my own transcript — the one place that could answer it. They
were right, and I found it myself.

> **When you cannot distinguish two explanations, say which two, and hand it to whoever can see the
> difference. Guessing between them adds nothing and forecloses the check.**

⚠️ The failure mode this avoids: _"you seem to have mis-measured"_ makes the other party defend the
number they got right, and nobody ever looks at the thing that was actually wrong. See
[[a-reviewer-who-has-read-the-intent]] and [[right-conclusion-wrong-evidence]].
