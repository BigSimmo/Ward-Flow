---
name: a-written-diagnosis-does-not-sweep
description: "A comment explaining a defect proves somebody understood it once, and says nothing about how far they looked — two live instances sat three lines from the explanation"
metadata:
  node_type: memory
  type: feedback
  originSessionId: b1ace96a-832b-4e38-9f46-6c2896334ea0
  modified: 2026-09-04T00:14:59.965Z
---

A finding comment in `tests/ward-referral-screens.dom.test.tsx` spent six lines explaining
that a negative assertion placed AFTER an exact `.toBe` on the same value can never report
anything: if the `.toBe` passes the negative is trivially true, and if it fails execution
stops before reaching it. Somebody found that, fixed one instance, and wrote it down.

**Two more instances of the identical shape were live in the same file, one of them three
lines below the explanation.** Ward Builder Three found them only because I asked "does this
shape exist elsewhere?" after a different question had accidentally surfaced the first.

**Why:** a written diagnosis is evidence that one person understood one instance. It is not
evidence of a sweep, and it reads like one — which makes it worse than no comment, because
the next reader treats the block as already handled. The same applies to my own ledger
entries and handover documents.

**How to apply:** when you find a defect that has a _shape_, do not stop at the instance.
Build the smallest scanner for the shape and run it over the whole file, then the whole
suite. And carry the control PER FILE, not once per run — Three's first scanner reported
"0 found" having parsed 5 expects in a 320-expect file, and its control passed because it
only tested whether the matcher recognised a synthetic pair. A broken parser and a clean
file produced identical output. The control that worked: put the known-bad order back into
the real file and require the scan to find exactly one more than it currently does.

**⚠️ AND IT SUPPRESSES THE SWEEP HARDEST FOR THE PERSON WHO WROTE IT.** 2026-09-04, and I am the
worked example. I adopted four ward stylesheets, deleting each root background. Hours later a
blank-page print defect was found; the report named the two files in front of me. I fixed exactly
those two, proved them in a live browser, and **wrote a careful comment explaining the mechanism** —
then reported it handled. Three files I had adopted EARLIER THE SAME EVENING had the identical shape
and I never looked. I was, at that moment, running a sweep for exactly this pattern.

Having written the correct explanation is what closed the question. The author knows the prose is
right, so it satisfies the doubt it should have raised.

**What actually found it: a cross-file MATRIX, not re-reading my own work.** Of the 14 self-named
ward screen stylesheets, exactly 7 carried an `@media print` block and 7 did not — three of the
seven mine. **No per-file review could have surfaced it**: every file was internally complete and
consistent, and the asymmetry existed only across the set.

**How to apply, added:** when a defect has a shape, build the sibling matrix — one row per file, one
column per feature — and look for the N-1 split. And treat your own recent work as _more_ suspect
than a stranger's, not less, precisely where you have just written a confident explanation.

**⚠️ AND THE MATRIX CAN CONFIRM THE WRONG COLUMN.** 2026-09-04, same night, same defect, one
level down. Having learned to build the sibling matrix, I built it — _does each file have an
`@media print` block?_ — and it came back CLEAN across all eight files I had migrated.

**The property I measured was the PRESENCE of the fix. The property that mattered was its EXTENT.**
Every print block resets `.screen`. Meanwhile `.table td`, `.teamLink`, `.count` and 30 other
selectors declare `color: var(--text)` on themselves, and an ancestor's reset cannot beat them —
which is the exact mechanism the fix exists for. Board enumerates **56** selectors in a 250-line
print block and still misses five. **The most careful enumeration in the tree is the proof that
enumeration does not hold.**

Printed result: `.table th` sets no colour so it inherits the reset and prints BLACK; `.table td`
prints near-white. **A table with visible headings and invisible rows reads as a successfully
printed empty list** — strictly more dangerous than the blank page, because a blank page gets
reported and an empty table gets believed.

**How to apply, added:** a matrix column must be the property that would be FALSE if the defect
were present — not the artefact that appears when someone fixes it. "Has a print block" is the
artefact. "Every rule declaring its own colour is covered" is the property. And prefer a fix that
cannot drift (`.screen, .screen *`) over one that must be re-enumerated each time somebody adds a
selector.

⚠️ **THE STRONGEST INSTANCE IS A COMMENT THAT IS ENTIRELY CORRECT.** Same night, forced colours,
`ward-sidebar.module.css`. The comment above the block explains — accurately — that severing the
chain to `--border` would cost a high-contrast user the system border colour, that a fix for one
group which breaks another is not a fix, and that "under forced colours the aliases point back at
the global tokens and the system decides, **exactly as `board.module.css` does**".

**The policy is right. It is implemented on one of the three selectors.** The token is declared on
`.panel, .drawerBody`; the repoint targets `.phoneBar`, which is not their ancestor, so five
consumers keep the non-system colour.

**The earlier instances were comments that merely failed to sweep. This one ARGUES, and cites a
model file.** A reader checking whether forced colours were handled finds a careful, correct,
sourced explanation and stops — the citation makes it more convincing, not less. **Correctness of
the prose is not evidence about the extent of the code**, and a comment good enough to persuade is
the most effective place for a gap to hide.

**How to apply:** when a comment states a POLICY, list every element the policy must cover and
check each one. The comment tells you the rule; it never tells you the membership.

Related: [[checks-that-cannot-fail]], [[compliance-without-coverage]],
[[a-green-mutation-only-counts-if-the-mutant-ran]], [[comments-that-recruit]],
[[a-property-set-on-the-element-itself]].

---

## ✅ 2026-09-07: THE ONE CASE WHERE A NOTE DOES FIRE — you are the reader

This file, and five separate instances in one Ward Flow night, all say the same discouraging thing:
**a correct explanation sitting feet from the wrong one changes nothing, because proximity is not
delivery.** A wrong CSS mechanism, a stale count, a stripped governance suffix, an over-claiming
config comment — in every case the right version was already written down nearby and nobody read it.

**Then one fired, and the difference is worth more than the rule.**

I built a probe to settle a disagreement, and it returned a three-way colour collision — vindicating
me, worse than I had claimed, arriving as I composed the overturn. It was an artefact: the values
were `CanvasText`, the **forced-colours override**. I caught it in the second before sending because
I recognised the value — **from a comment I had written myself, hours earlier, in my own test file,
saying exactly that those tokens are overrides and correct.**

🔴 **Ward Lead's generalisation, and it is the actionable half:** _"A note is a message to your
future self before it is a message to anybody else, and that is the case where it works."_

**Why the asymmetry is real, not luck.** A note to a stranger has to be FOUND — it competes with
every other line in the file and loses to whatever the reader already believes. A note to yourself
only has to be RECOGNISED, and recognition needs no search: the value shows up, and the memory of
writing about it arrives with it. The five failures were all notes aimed at somebody else. The one
success was aimed at me.

**How to apply: at the moment you work out something that fooled you, write it where YOU will next
be fooled by it** — beside the token, in the test that resolves it, in the probe. Not in the
handover, not in the summary, not in a message. **Then keep writing the ones aimed at other people
too — but expect those to be found rather than to fire, and pair them with something mechanical**
(a guard, a control inside the probe, a failing test) that does not depend on being read. See
[[carry-the-antidote-with-the-assertion]] and
[[a-control-must-test-the-premise-not-the-measurement]] for the mechanical half.

Related: [[comments-that-recruit]], [[a-comment-that-predicts-an-edit-elsewhere]],
[[publishing-a-verdict-into-the-artefact-under-trace]], [[a-retraction-does-not-travel]].

## Publishing the trap did not let its own author recognise it one hour later. 2026-09-09.

The strongest version of this file's thesis yet, and it is not about a reader — it is about the
**author**.

Ward Builder Four wrote up the MSYS path-conversion trap and circulated it. **About an hour later
Four hit the same trap in a different command shape** (`git hash-object` on a `/d/...` path rather
than a `git show <rev>:<path>`), corrected the path form reflexively mid-command — _"the way a
typo is fixed"_, their own words — and did not recognise it as the thing they had just
documented. The corrected result was right; the recurrence went unmentioned because it was never
consciously noticed. Two other sessions then spent an afternoon rediscovering it independently.

⚠️ **So the obvious remedy is the wrong one.** "Report your fixes" would not have caught
this: **there was no decision to withhold, and nothing felt like a fix.** A reflex does not generate
a report. And a written diagnosis does not fire when the trap arrives wearing a different command.

**How to apply.** Index a trap by its SYMPTOM, not by the command that produced it — _"a path
argument came back as does-not-exist for a file that exists"_ fires on any command; _"`git show`
mangles `<rev>:<path>`"_ fires on one. And when a diagnosis is written, ask **what OTHER shapes this
same cause takes**, because that list is what the future reader (and you) will actually be holding.

🔴 And the corollary that cost the most here: **a mitigation can create the mirror-image
trap.** `MSYS2_ARG_CONV_EXCL="*"` fixes `<rev>:<path>` and breaks every real filesystem path in the
same shell. Both failures present as a confident absence. See [[git-queries-that-answer-instead-of-erroring]].

## A handover addressed to a role nobody holds (2026-09-10)

Ward Builder Three diagnosed two timing-out tests correctly on 2026-09-07, wrote the right repair
(_"make them faster or raise their own timeout deliberately — not quarantine, not re-run until
green"_), and handed it to **"whoever owns `ward-community-*`"**. Nobody owns `ward-community-*`.

The diagnosis sat for three days. **Four separate sessions then reported a related file as BROKEN**
on the strength of the same 30-second timeout, each re-deriving a piece of what was already written
down and correct.

**A handover needs a named recipient, not a named area.** "Whoever owns X" is addressed to nobody
whenever X has no owner — and an area with no owner is exactly the area whose findings go unclaimed,
so the phrasing fails precisely where it is most needed. If you cannot name a person or a chat, the
handover's real recipient is **the coordinator**, and it should say so.

Corollary for a coordinator: a finding handed over without a recipient is your inbox by default.
Related: [[verifier-output-is-ephemeral]], [[two-task-lists-one-check]], [[a-deferral-whose-reason-expires]].

## Recorded but not promoted (2026-09-10)

_"A guard is a QUERY plus a PREDICATE"_ was written down on **2026-09-05**, correctly, in the ward
reword-arm ruling. **Two chats re-derived it independently on 2026-09-09/10**, from three separate
measured defects, neither knowing of the other or of the 2026-09-05 record.

Nobody was careless. The sentence was true, in the right document, in the row about the right
subject — **and buried mid-cell in a wide markdown table that nobody reads to the end.** It was
findable by search and unreachable by reading.

**A finding that is recorded but not PROMOTED will be paid for again.** Promotion means: its own
heading, above the thing it qualifies, with a name a brief can cite (it is now "arm F"). A clause
inside a cell is an archive entry, not a rule in force. **When a second chat re-derives something
you have already written down, the defect is the placement, not their reading.**

Related: [[carry-the-antidote-with-the-assertion]], [[verifier-output-is-ephemeral]].

## A correction is scoped to what it was written about (2026-09-10)

A ward report already carried the sentence _"I measured the predicate and called it the guard"_,
naming the one ban it had been found on. **Writing that sentence did not cause its author to
re-check the other three bans it was equally true of.** One of those three was hiding the worst
defect in the range: a clinical sentence retired for being false could be re-rendered verbatim, one
element away from the ban that forbids it, with 105 of 105 green.

**It closed the instance and left the class open — inside a document whose entire subject is that
closing an instance is not closing a class.** What reopened it was a _different_ chat restating the
rule against a _different_ file. A second chat reported the identical shape the same day: it wrote a
rule about probes that cannot return a positive, then endorsed a peer's finding without checking
one, within the hour.

> **Knowing a trap by name does not stop you walking into it. Being handed the case it covers, in a
> form you recognise, is what fires it.**

**So when you write up a defect, the write-up is not the sweep.** Name the class, then go and
enumerate its members and check each one — or say explicitly that you did not, so the next reader
inherits an open class rather than a closed one.

⚠️ **And two chats demonstrating the written form is insufficient is stronger evidence than either
instance: it argues for a check that RUNS, not a lesson that is read.** Prefer a mechanical guard
over a better-worded note whenever the class is enumerable.

Related: [[prove-the-task-is-still-outstanding]], [[a-measurement-is-scoped-to-what-it-measured]].

## 🔴 2026-09-12 — MUTATION EXIT CODES RECORDED IN A HEADER ARE A CLAIM NOBODY RE-RUNS

I rebuilt a ratchet with three protections and **proved each by hand**: broke the glob (exit 2), broke
the matcher (exit 2), added the forbidden declaration (exit 1), restored (exit 0). **I wrote those
exit codes into the script's header and did not automate them**, because automating meant appending to
real ward CSS from a test and leaving a shared worktree dirty for other sessions. **I declared the
limit, which made it a trade rather than a gap.**

⚠️ **A peer named the residue exactly: _"exit codes recorded in a header are a claim nobody
re-runs."_** 🔴 **The three protections are live; the PROOFS that they bite are now prose.** A later
change that quietly removes the floor leaves the header still asserting it was proven — **the header
ages into a false statement about the present, in the same way a status claim about another branch
does.**

✅ **And the cost of closing it was measurable, not vague:** the script takes no root override, so a
temp-fixture test would need one added — small, and it converts three decaying sentences into three
live assertions.

**How to apply:** when you decline to automate a proof, **say what it would cost in one measured
phrase** so the decision can be reversed cheaply by somebody else. ⚠️ **And prefer proving the
guard's OUTPUT SHAPE in the test even when you cannot prove its behaviour** — asserting that it still
reports its swept count and its proved control means a later tidy that deletes either one changes an
assertion, which is weaker than a mutation proof and far stronger than a header.

Kin: [[a-working-safeguard-leaves-no-trace]], [[observations-expire]],
[[a-green-mutation-only-counts-if-the-mutant-ran]], [[self-invalidating-pins]].
