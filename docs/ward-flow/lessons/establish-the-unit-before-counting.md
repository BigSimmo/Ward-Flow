---
name: establish-the-unit-before-counting
description: "establish the unit before comparing counts, measure the thing not a proxy, never produce a figure while writing, and a reconciliation that balances is a hypothesis"
metadata:
  type: feedback
---

**Consolidated 2026-09-06 from 8 separate memories on one subject**, written from different chairs across a night of six parallel sessions.

⚠️ **Nothing is summarised — each section below is its original entry verbatim.** The merge exists because the index
that points at these has a hard size limit: 8 index lines for one subject crowd out 7 unrelated
memories, which then do not load at all. The only thing given up is recalling one of these without the others.

---

# establish-the-unit-before-counting

> Before computing a count to check somebody's claim, establish what UNIT the claim counts — and the detection signal is a number that clashes with something you already read

2026-09-02, Ward Flow. In one evening, **four** of my independent counts disagreed with a colleague's
claim. **All four times my count was wrong, and wrong the same way: I measured a different unit.**

| I counted                                    | The claim counted                                       | Would have said                      |
| -------------------------------------------- | ------------------------------------------------------- | ------------------------------------ |
| total `overrideReason` declarations (2 vs 4) | declarations each side **ADDED** (1 vs 3)               | "your count is off by one"           |
| string occurrences of an event name (2)      | AST **construction sites** (1)                          | "your pin is wrong"                  |
| table rows containing the word "TESTED" (4)  | the **Method column's value** (all 13 REASONED)         | "the register overstates itself"     |
| decline **reasons** (3)                      | rendered **`<option>` elements** (4, incl. placeholder) | "the assertion expects one too many" |

⚠️ **Every one would have been a confident correction of a colleague who was right.** Three of the
four were about to go out.

## The rule

> **Before computing a count to check somebody's claim, establish what unit the claim counts.**

Better than "check your work" because it names _when_ to apply it and _what to do_. The arithmetic is
almost never the problem; the instrument is.

## ⚠️ The detection signal, and its prerequisite — this is the half I did not have

**Not one of the four was caught by being careful.** Every one was caught the same way:

> **The number clashed with something I had already read.**

A count that merely _looks_ wrong on its own gets defended. A count that contradicts a doc comment, a
line of source, or a commit message you read ten minutes ago gets re-derived.

⚠️ **So the check has a PREREQUISITE: you must have read something first.** A reviewer who only
measures has nothing for the number to collide with, and will ship the wrong unit with full
confidence. **Read the thing, then count it — in that order, and not only because reading is
informative.** (Ward Lead's sharpening, adopted.)

## ⚠️ WHEN it happens: the correcting message. Added 2026-09-03.

**Two more that night, one mine and one Ward Lead's, and BOTH occurred inside a message
correcting somebody else.** I reported 30 when the answer was 24 — I counted matching LINES and the
question was about FILES. Ward Lead did the same thing three times, each time in a correction.

⚠️ **The correcting message is written in a hurry and with confidence, which is the worst possible
combination for choosing a unit.** You have just established somebody else was wrong, and the
adrenaline of being right is exactly the condition under which you reach for `grep -c` instead of
listing the things.

**And it travels further than an ordinary error, because a correction carries more authority than
the claim it replaces.** Nobody re-checks the person who just caught somebody.

**How to apply: when you are about to correct someone's number, LIST THE ITEMS, never count the
matches.** The list is its own audit and costs one extra line.

## ⚠️ And the corollary: a finding of yours that survives because the corrector was generous

Same night, I sent the owner a disclosure finding that was **wrong** — I claimed no ward screen said
the data was invented; 24 files carry a "Synthetic prototype" badge. Ward Lead corrected it and
offered me a **narrower version that still stood**. I pushed it down to nothing instead.

**Why: a half-strength survivor gets cited later at full strength** — "Ward Builder Three found a
disclosure gap". ⚠️ **And note what the mechanism actually was: the correction, not any virtue of
mine. I had no reason to re-check a finding I had already sent and nobody had challenged.** A record
that credits character teaches the next reader to rely on something unrepeatable.

## The companion failure — provenance, not units

Same evening, a peer reported **as measured in a browser** that a patient search showed the same
sentence for its idle and empty states, so a clinician typing nothing would be told the person is
unknown and offered a create-duplicate button. Urgent, clinical, **and false** — the component has
three branches keyed on `query.trim().length > 0`, byte-identical across both branches, control
confirming the diff discriminates. Three of that peer's four measurements _were_ real defects.

⚠️ **Not a unit error: a measurement reported as delivered. Same cost, different mechanism —
something arriving with a strong provenance label ("I saw it in the browser") gets checked LAST.**

Related: [[measure-the-thing-not-a-proxy]], [[relayed-numbers-lose-attribution]],
[[a-mention-is-not-an-assertion]], [[run-the-mutation-before-relaying]],
[[green-mutation-that-changed-nothing]].

## A third mechanism: LAST-WINS COLLECTION, which discards the value that mattered. 2026-09-04.

**Comparing two CSS token sets, I built each as `{name: value}` from a regex over all declarations.**
I reported four disagreements. **Three were real. The fourth was manufactured by my own method.**

`--ward-border` is declared TWICE in one file:

```
line  19  --ward-border: var(--neutral-500);   top level        <- AGREES with the other set
line 376  --ward-border: var(--border);        @media (forced-colors: active)
```

⚠️ **A dict keeps the LAST match. So the high-contrast override silently replaced the top-level value,
and the comparison reported a fork where the two sets actually agree.** Line 376 is not a competing
value at all — it is a different SCOPE, and scope is most of what CSS means.

**How to apply: when collecting name→value pairs, count the occurrences per name first.** More than
one means the flattening is a decision, not a read — and the decision needs to be about scope
(at-rule, media query, selector specificity), not about which line came last. **The check that
settled it printed the enclosing at-rule beside every declaration**, with a control confirming the
three real forks were each declared exactly once at top level.

⚠️ **Same family as the entity-digits false positive I caught the same day** — a match that is real
text meaning something else. **I caught that one because I controlled in both directions. This one
had no control, and a colleague caught it instead.** [[compliance-without-coverage]]

## A fourth mechanism: TWO FIELDS IN ONE CLAUSE, only one of them measured. 2026-09-04.

Ward Flow. I wrote, inside an otherwise correct plan: _"7 of 50 are at `pulled` and none carries an
`admissionId`, so until the fixture repair lands that branch is the common case."_

**"That branch" was a DIFFERENT FIELD — `pullExpiresAt`.** I measured `admissionId` (absent 7 of 7)
and drew a conclusion about `pullExpiresAt` (present 7 of 7). Opposite answers, one sentence, and the
sentence reads perfectly.

⚠️ **Ward Lead then built a ruling on it** — instructing me to write the wording _"for a coordinator
who will see it constantly"_ — for a branch **no movement reaches**, and which `PULL_PATIENT` makes
reducer-impossible. A careless clause inside a report that was right about everything else became the
premise of somebody else's decision.

**How to apply: a sentence naming two fields needs two measurements.** The tell is a clause where the
subject changes between the evidence and the conclusion — "none carries X, so **that** branch" — and
the pronoun is where the substitution hides. **When a claim spans two field names, say each one's
number separately, even when it makes the sentence uglier.**

⚠️ **And the propagation is the cost, not the error.** A wrong number in my own head is cheap; a
wrong number a colleague RULES ON is expensive, because the ruling then carries authority the
measurement never had. See [[relayed-numbers-lose-attribution]] — this is that, with myself as the
origin rather than the relay.

**Caught only because I re-measured before writing prose the ruling asked for** — the same habit that
caught WF-009 the hour before: [[prove-the-task-is-still-outstanding]] applied to my own claims, not
just to assignments.

## A fifth mechanism: A PARTIAL FILTER NAMED AFTER THE WHOLE ONE. 2026-09-04.

I reported a bucket as _"50 movements, 1 in shape, 0 accepted"_. **Every number wrong.** Open
movements are 43, not 50; and the bucket — `declinedByAll`, which excludes anything already classed
`escalated` — is **empty**. My "1" was the shape predicate run **without the escalation step**, then
labelled with the bucket's name.

⚠️ **This is not a wrong unit. It is the RIGHT unit with a step of its definition dropped**, which is
worse, because the name I gave it was correct for the thing I meant and wrong for the thing I ran.
Nobody reading "1 in shape" could have detected it.

**How to apply: when a derived set is defined by N filters, run all N or say which you ran.** The
tell is describing a filter in prose while measuring it in code — the prose keeps the whole
definition and the code keeps the part you typed.

⚠️ **And the corollary a colleague supplied, which is the real prize: a floor of `>= 1` on an empty
bucket is not a weak guard, it is an ALREADY-RED one.** So if such an assertion is passing, the
bucket is not empty, or nothing is asserting over it at all. **An emptiness measurement tells you
which guards on that set CANNOT be the real ones** — cheaper than reading them.

Caught by ward-verifier measuring independently and reconciling rather than just disagreeing: it
named the exact step it thought I had dropped, which is what made the difference checkable in one
run instead of an argument.

**2026-09-06 — the same failure, but the wrong number had already been relayed and acted on.** I
reported "11 of 14 panel counts carry prose" without ever stating what a "panel count" was. Ward Lead
used it to answer a question the owner had asked and deferred. Re-measured with the unit written down
first — _one `count=` expression on one `<WardPanel>` call site_ — it is **21 of 32**, i.e. 66% where
the relayed figure said 79%. My wrong "11" turned out to be the count of the _complement_ (the bare
figures), against a denominator I had never fixed.

**The tell is that the peer's message quotes your number back to you.** That is the moment to
re-measure, not to feel corroborated — a figure returning from someone else has lost its error bars,
its unit and its author, and it now has consequences you did not choose. Correct it immediately and
say plainly which direction it moves: mine made the argument _weaker_, and burying that would have
been the actual dishonesty. Related: [[relayed-numbers-lose-attribution]],
[[never-produce-a-figure-while-writing]], [[a-correction-that-agrees-with-you]].

## A reconciliation that balances is a hypothesis, not a finding — 2026-09-06

Two of us counted the same thing and disagreed by one: their seven against my six. They proposed
the reconciliation — _"seven SITES, six FILES; one file carries two gates, so 7 = 6 + 1"_. It
balances exactly. **It is wrong.** Measured: six sites across **five** files. Under their reading
my number would have been five.

**The real +1 was a gate written inside a string literal**, counted by a scanner without
string-blanking. Two hypotheses fitted the identical off-by-one, and the wrong one won because it
was the **charitable, symmetric** one — _we counted different units, nobody erred_ — where the true
one required saying _one of us counted a string_.

⚠️ **A DISCREPANCY OF ONE HAS MORE AVAILABLE EXPLANATIONS THAN A DISCREPANCY OF FOUR, so a tidy fit
is weakest exactly where it feels strongest.** The arithmetic working is not evidence; it is the
minimum any candidate explanation must clear.

**How to apply: this is the failure that happens AFTER "establish the unit" and "diff names, not
counts" are both followed.** A unit disagreement gets proposed, the arithmetic confirms it, and
everyone stops. **The only thing that settles it is listing the members and comparing the lists** —
re-deriving totals cannot, however many ways you derive them. Here the member list named the file
immediately, and it was not the file either of us had said.

**And both corrections in that exchange were half right, in the same message.** I named the right
mechanism and the wrong file; they named the right unit problem and the wrong instance of it — and
I had quoted "five files" for what was five sites across four files while correcting their units.
See [[a-correction-that-agrees-with-you]] and [[deferring-to-a-correction-looks-like-humility]]:
their correction of me was gracious and cost nothing to accept, which is its own reason to measure
before conceding.

---

# measure-the-thing-not-a-proxy

> Wrong measurements from grepping a proxy — including a correction that was itself a proxy, and the confident recommendation built on the phantom it created

On 2026-08-25 I stated three measurements confidently and all three were wrong, in the
same way: I read something adjacent to the property and called it the property.

1. **"Every open movement has at least six eligible wards; nobody is stranded."** I counted
   `eligibleCandidatesAmong(...).length`. That helper sorts eligible-first and **truncates to
   its `limit`** — it never filters to eligible. The length is the count of same-cohort units.
   Truth: 337 eligible pairs, distribution `{0:2, 4:11, 5:6, 6:3, 11:1, 12:9, 14:9}`, and
   **two movements (WF-009, WF-308) already have nowhere eligible.** This reached a design
   document and a product-owner conversation before a subagent's test contradicted it.
2. **"The escalation contact is the only free-text input left."** I had grepped `<textarea`
   once, early. A second one — the override-reason box — existed the whole time.
3. **"13 bed releases in the fixture."** I counted `unitId:` occurrences, which appear in
   other structures too. Truth: 6.

**Why:** grepping a nearby token is cheap and feels like measuring. Computing the actual
property usually means running code, which felt disproportionate for "just a number".

**How to apply:** before stating a number that will shape a decision, compute the property
itself — write the throwaway test, run it, delete it (see the `tmp-measure.test.ts` pattern:
throw the result in an `Error` so vitest prints it, then `rm` and confirm `git status` clean).

## 2026-08-29 — the correction was also a proxy, one layer down

Counting a flag across three branches, `grep -c exampleOnly` gave 3/3/3 and looked wrong. I caught
that myself: a word-occurrence count is not an entry count. The fix — `grep -c 'exampleOnly: true'` —
gave 3/4/3 and looked like a real off-by-one against a test asserting two/three/two.

**It was also a proxy.** One matching line was a _comment describing the flag_, opening with `*`.
Excluding comments: 2/3/2, exact agreement, no gap, nothing uncounted. A peer caught it.

Two things generalise, and both are worse than the arithmetic:

- **A correction can inherit the flaw of the thing it corrects, and it is harder to catch there,
  because the act of correcting reads as diligence already spent.** Having just named the error made
  the second attempt _more_ credible, not less — it was specific enough to look like the real
  measurement and arrived carrying the authority of a fix.
- **A recommendation built on a phantom finding inherits none of the finding's uncertainty.** From
  the imagined gap I advised deriving a test's expected set from the source it checks — putting both
  sides of the assertion in one place, i.e. **a check that cannot fail**, recommended into a merge
  resolution by the session that had spent two days cataloguing exactly that defect. The measurement
  was shaky and had already been wrong once; the advice arrived confident and unhedged. Asked to
  defend it, I would have defended it well.

**Practically:** exclude comment lines when counting code (`grep -c` is line-matching, not parsing),
and when advice rests on a measurement that has already been corrected once, hedge the advice or
re-measure before giving it.

If a helper is involved, read what it actually returns before trusting its length or shape.
And when a subagent contradicts a number of mine, **measure before defending it** — all three
times the subagent was right. Related: [[run-the-test-before-prescribing-the-fix]],
[[ward-flow-verification-lessons]].

## A question the data structurally cannot answer, dressed as one it can

Asked "which files were authored inside the format-ignored worktree?", I reached for
`git diff --diff-filter=A base..branch` and got 31. **That is everything ADDED since the base, not
everything authored in that worktree** — three of the 31 were mine, written in a different worktree
outside the ignored path and explicitly formatted. **Git records what changed, never where the
change was made.** The provenance the question needed is not in the history at all, at any level of
care.

This is distinct from the usual proxy failure. It is not a check that was too narrow or a fact true
at a different moment — it is a query that returns a confident, well-formed answer to a question the
data cannot represent. Nothing in the output signals the substitution.

**The corrective is to measure the property, not its history:** `format:changed` answers "is this
file unformatted now" directly, needs no provenance, and cannot be fooled by where a file came from.

**Tell:** if the answer would require the data to have recorded something it was never designed to
record, you are reading a coincidence. Ask what the tool actually stores before trusting what it
seems to say.

## Clear a pre-existing red BEFORE work whose deliverable is a watched failure

A known unrelated red contaminates every gate run beside it — and the person reading the result
later has no asterisk. It matters most for mutation testing, where the deliverable IS a failure with
a predicted message: running that against a tree with a standing red is the one condition guaranteed
to make a real finding ambiguous. **Order the cheap unrelated fix first, then do the work that needs
a clean signal.**

**And when a fix reveals long-standing drift rather than causing it, say so IN the commit** — the
next person to meet a thousand-line reformat on a file nobody edited will otherwise reconstruct a
wrong story and attribute it to whoever ran the merge.

## Waiting for a lock is what hid the fact that there was nothing to do

2026-08-30. Two sessions spent a day treating `.prettierignore:15` (`.claude/worktrees/`) as proven
formatting debt. One carried "up to 31 candidate files" for hours and called it a candidate count;
the other passed on "~1175 lines differ" without reproducing it. Both told the owner the fold had
revealed formatting drift.

**There was none.** `npx prettier --check` on the files, from inside the worktree, returns "All
matched files use Prettier code style!" — the ignore path is relative to the ignore file, so from
inside a worktree the paths read `src/components/...` and line 15 never matches. And the worktree the
commit was actually going to happen in, `D:/Worktrees/Database/pr-2390-fix`, is not under
`.claude/worktrees/` at all. Two independent reasons it could not bite, neither checked.

**The mechanism worth keeping: being BLOCKED made the missing measurement free to postpone.** The
work was queued behind another session's lock, so nothing forced the four-second command, and a
number that was never measured survived every handover, two peer messages and a report to the owner —
gaining confidence at each step purely by being repeated. A task you cannot start yet is a task whose
premise nobody re-examines.

**Rule: measure the premise BEFORE joining the queue, not when the lock frees.** The cheapest moment
to discover there is nothing to do is before you wait for permission to do it. If a claimed quantity
has no command behind it, it is a guess — say "guess" out loud, because "candidate count" and
"up to N" both read as measurements to everyone downstream.

Companion shape: a true fact and a false conclusion delivered in one paragraph, the true half doing
the vouching (`.prettierignore:15` really does contain that line — the inference from it was wrong).
See [[check-the-conclusion-that-flatters-the-theme]], [[assert-only-about-code-you-opened]].

### Correction to the section above: the original number was right, and the retraction was the error

Same day, hours later. Measured properly — `git show <ref>:<path>` for each blob into scratch,
CR=0 confirmed, then `prettier --check --config .prettierrc`. **Six files, 1175 changed lines**,
which is EXACTLY the figure that had been retracted as an unverified guess.

The whole chain ran on commands that were really executed and really aimed at the wrong files:

- The author retracted after running `prettier --check` over **the files changed on their branch** —
  clean, correctly, because the drift lives in board files already committed.
- I "independently confirmed" the retraction by running prettier on **three files I picked myself**,
  all clean, none of them a board file. I sampled outside the affected set and reported the result
  as a property of the tree.
- A third session measured on **disk**, got five files, and misclassified a sixth as CRLF noise —
  `ward-data-checker.test.ts` is CRLF on disk AND carries 29 lines of real drift underneath. **A file
  can be both**, and "every line differs means line endings" is a true rule that stops you looking.

**"I measured it" is not the end of the sentence — WHAT got measured is.** Three real measurements
produced three wrong answers, and every one of them would have survived a demand for evidence.

**And the withdrawal never got the scrutiny the claim did.** Retracting reads as the careful,
humble move, so it passes unchecked. **A withdrawal is a claim and needs the same evidence as an
assertion.** Nothing was struck because it had been disproved; it was struck because it was
unverified — which is a reason to go and check it, never a reason to believe its opposite.

**Instrument that settles this class:** read the committed blob, not the working copy. Git stores LF,
so line endings cannot confound the verdict, no other session's live tree is touched, and there is no
mutation race. `git show <ref>:<path>` costs seconds and is immune to the two confounds that beat
three sessions here.

**RETRACTED, and the retraction is the lesson.** I wrote here that a Windows shell had converted an
extracted blob, and offered a free diagnostic: "CR exactly equal to the line count means the extraction
converted it." **The number it explained was never real.** The other session re-measured at byte level
against a control file it built with known CRLF — the control detected 2 CR bytes, the blobs detected 0,
and its own 597/663/143 would not reproduce. There was no conversion, no culprit, and nothing to solve.

Look at what I built on that. Three numbers matching three line counts exactly is a very strong-looking
coincidence, and from it I produced a mechanism, a named culprit, a free check, and a memory entry — in
under twenty minutes, none of it re-measured. It was the most persuasive thing written all day.

**And CR == line count is not the signature of conversion. It is the signature of a count that returns
the line count whatever the file contains** — a pattern that matches every line. I took the shape of a
check that cannot fail and promoted it to a diagnostic, on the same day I was cataloguing that class,
with a peer supplying the half I did not verify and me supplying the half it did not. Neither of us
could have built it alone.

**The rule that survives:** a diagnostic derived from a single unreproduced observation is a story. Re-take
the measurement, or build the control that proves the instrument can detect the thing when it IS there —
that control is what settled this, and it cost seconds.

### The final turn: both numbers were right, and neither named its commit

The retraction above needs its own correction. Bisecting the file's history settled it: `ward-board.tsx`
was drifted for its whole life and went **clean at `de023179b`** on the board branch — a commit that is
NOT an ancestor of the tip the other measurement used (`git merge-base --is-ancestor` says so). So
"1175 lines at 13d2842e4" and "clean at my HEAD" were BOTH true. The file crossed between the two
readings.

Nobody was sloppy and nobody needed to retract. **Neither number named the tree it described.** Scope
was the first axis ("what got measured"); **time is the second, and it is invisible while several
sessions commit to different branches.** A measurement of a repository is only meaningful with its ref
attached: "six files at `13d2842e4`", never "six files".

**And the fix for the drift was NOT to format it.** `git merge-base <board> <tip>` returned the tip
itself — the board branch already contained it, so the next fold was a fast-forward and every one of
the six files was blob-identical to that base on the other line. Two sessions formatting the same six
files would have converted a guaranteed fast-forward into a real three-way merge **on whitespace-only
diffs, where every resolution looks green and none is checkable by reading.** The branch that owns the
files formats them; the fold carries them across for free. Check the merge-base before tidying anything
that lives on two branches.

Footnote worth its own attention: `ward-board.tsx` became clean because an agent ran Prettier over a
1348-line file nobody asked it to touch, and its report never mentioned it. It was an improvement this
time. **An unrequested reach into a file nobody is reviewing, inside a 1095-line diff, is how a real
change ships unnoticed.**

## Searching for the new thing misses the change to the old thing

2026-08-30. A coordinating session assessed the blast radius of a clock commit by grepping for callers
of the NEW functions it added (`dayOf`, `minuteOf`). It found none and concluded "the primitive exists,
the callers have not migrated" — and was about to hold other sessions' work on that basis.

**Wrong, and by a whole category.** The defect (a 30-hour wait rendering as `30h 00m`) was not fixed by
adding a primitive with callers to migrate. It was fixed by **changing the behaviour of `splitDuration`,
which every screen already called.** Measured at the SHA: 39 files import the module, 7 call that
function directly, 5 more reach it through `formatElapsed`/`formatRemaining`. **A two-file commit
changed twelve screens, and an import graph could not see it.**

**Rule: an import graph answers "who could be affected by a NEW symbol". It cannot answer "who is
affected by this change".** For a behaviour change to a shared function, the blast radius is its
existing callers — read the diff and grep the CHANGED symbol, never the added one. The two questions
look identical and have different answers whenever a commit modifies rather than adds.

Companion, and the reason this one is dangerous: the migration-pending reading is the _cautious_-
sounding conclusion, so it passes without challenge — same family as [[check-the-conclusion-that-flatters-the-theme]].

## The measurement is right and the JOIN is wrong — 2026-08-30

A citation checker found 28 paths in nine dated plans that no longer resolve: real, reproducible,
file-and-line specific. The proposal was to stamp those plans "superseded" on that evidence.

**The paths not resolving proves the source layout moved. It does not prove those plans' 555
unchecked tasks were completed rather than abandoned, deferred or silently dropped — and a
supersession banner asserts the second.** Two different facts; only one was measured.

**Why it nearly passed: everything was sound except the join.** The measurement was strong, and it
_was_ strong evidence — for the claim it actually supported. Nothing in review would have caught it,
because the plans do look finished.

**The check, and it is one sentence long: before offering a measurement as evidence, say out loud
which claim it supports and which claim you WANT it to support. If those are two different
sentences, that is the gap, however good the measurement.**

**The better artefact was the raw output itself** — nine files, 28 paths, file and line. Unlike a
banner it cannot be wrong about completion, because it never claims anything about it. **A record
that makes no claim cannot make a false one.**

Siblings: [[check-the-conclusion-that-flatters-the-theme]], [[assert-only-about-code-you-opened]],
[[checks-that-cannot-fail]].

## For "what does a user see", the screen is the only instrument that is not a substitution

2026-08-30. Three instruments were pointed at the same question — how many urgency pickers render a
bare digit — and only one answered it.

| Instrument                                  | What it actually answers         | Result                                                        |
| ------------------------------------------- | -------------------------------- | ------------------------------------------------------------- |
| import graph (who imports the label helper) | which FILES reference the helper | could not distinguish one offending picker in a file from two |
| `data-testid` search                        | which CONTROLS are labelled      | missed the control entirely — it carries no testid            |
| filling in the form                         | what is on the screen            | found it immediately                                          |

⚠️ **Both code-side instruments failed the same way and neither said so** — each returned a clean,
plausible number with no error. The testid search nearly produced a confident refutation of a true
finding ("there is no raise-referral picker in this file").

**The live walk has no such gap because it is not a proxy at all: the thing asked about is the thing
in front of it.** It is also the instrument least reached for — slow, manual, and it leaves no
artefact anyone can re-run. **That combination is why the gap persists.**

**The defect found this way:** a referral form whose five other fields default to readable words
(Adult, Open, Female, Voluntary, No form) while urgency defaults to a naked `3`, which is the
_least_ urgent tier, on the field that decides queue position. ⚠️ **The inconsistency is visible in
the column itself and needs no argument about what a clinician would infer** — which made it a far
stronger statement of the defect than "the picker lacks labels".

**How to apply:** for any question of the form "what does a user see", walk the screen. Treat a
code-side count as a hypothesis about the screen, never an answer about it. And when a walk finds
something, credit the instrument, not the walker — "be more careful" is not repeatable by somebody
already being careful; "walk the screen" is.

## The inversion: a proxy check that gets WORSE the more carefully you run it — 2026-09-02

I deleted ~30 browser assertions that drove a paused guided tour and a removed view toggle, and
proved they were dead by grepping `<ViewControl` in the one file that renders that screen. Nothing.
Verdict: not rendered, safe to delete. **The verdict was right and the proof was worthless.**

A peer re-derived it soundly and found three independent faults, any one of which flips the answer:

- **The assertions selected `data-testid`s, which are written as `testId="…"` PROPS.** A
  component-name grep is structurally blind to them — it could not have found them however the code
  behaved.
- **`ViewControl` IS in that file, as a definition.** "Found nothing" was true only of the JSX usage,
  and I read it as absence of the component.
- ⚠️ **A repo-wide grep for `<ViewControl` returns a RENDERED hit — a different component with the
  same name, defined locally in an unrelated mockups file.**

**So the more thorough version of my own check — widen the grep from one file to the repo — returns a
rendered usage and reverts a correct deletion.** Confident, corroborated, entirely false, in the
safe-looking direction. ⚠️ **And nobody ever revisits a decision NOT to delete**, so it would have sat
there for ever as a reverted correct change with a plausible reason attached, no gate anywhere red.

**Every other failure that day was a check too weak to fail. This is the opposite class and it needs
its own name: a check whose failure mode is triggered BY diligence.** Widening the search widened the
namespace, and the namespace contained a stranger with the same name.

**The sound question is the one the TEST asks: for each selector the assertion used, is that selector
reachable?** The test id is the thing. A component name is a proxy for it, and a proxy can point at
somebody else entirely. Ask the question in the vocabulary the failing artefact uses, not in the
vocabulary you find it natural to search.

Siblings: [[a-mention-is-not-an-assertion]], [[checks-that-cannot-fail]], [[agreeing-checks-with-one-blind-spot]].

## The rule that names WHEN to check, and it beats "be careful" — 2026-09-02

A peer's independent count disagreed with somebody four times in one review. **Four times it was the
peer's count that was wrong, and every time for the same reason: it measured a different UNIT than
the claim.** Totals against additions. String occurrences against construction sites. Word matches
against a table column. Reasons against `<option>` elements — a claim of "four options" checked by
counting reasons, which are three, because the fourth is the placeholder.

Its rule, adopted verbatim, and it is better than everything above it in this file because it is
actionable at a specific moment:

> **Before computing a count to check somebody's claim, establish what unit the claim counts.**

⚠️ **Not one of the four was caught by being careful.** Every one was caught the same way: **the
number clashed with something already read.** That names the detection method and its prerequisite —
**you have to have read something first. A reviewer who only measures has nothing for the number to
collide with**, which is why a fresh pair of eyes with no context is the worst instrument for this.

My own errors that day were the same class, not carelessness: I counted files matching event names
and called them dispatchers; I counted mentions and called them construction sites.

### And the sibling failure that is not a unit error at all

The same night, a peer reported — **explicitly as measured in a browser on a named tree** — that a
patient search screen's idle state and empty state were one sentence, so a clinician who typed
nothing was told the person was unknown and offered a button creating a duplicate record. Urgent,
clinical, and **false**: three branches keyed on `query.trim().length > 0`, byte-identical on both
trees, control confirming the diff command discriminates.

⚠️ **I checked it only because it contradicted my own earlier audit.** Nothing else would have. **A
claim arriving with a strong provenance label — "measured", "in a browser", "on tree X" — gets
checked LAST, because the label is doing the work the check would have done.** Ask which it actually
was, without asking the peer to defend it: _"measured"_ and _"read"_ carry different weight, and the
difference matters most once you have already passed it on.

**Three of that peer's four measurements survived and were the real defect.** Correcting a headline
is not withdrawing the finding — [[a-correct-diagnosis-that-stops-the-inquiry]].

## ⚠️ THE WRONG UNIT ARRIVES IN THE CORRECTING MESSAGE — 2026-09-02

**Three times in one session I chose the wrong unit, and all three were in a message correcting
somebody else's measurement.** A peer did the same an hour earlier: it reported 30 where the answer
was 24, because it counted matching LINES and the question was about FILES.

**Its diagnosis, which is the durable part:**

> ⚠️ **The correcting message is written in a HURRY and with CONFIDENCE, which is the worst
> combination for choosing a unit.**

**You have just established that somebody else was wrong. The adrenaline of being right is the
condition under which you reach for `grep -c` instead of listing the things.** **And a correction
carries more authority than the claim it replaces, so the error propagates further.**

**Practically: when writing a correction, state the UNIT in the sentence — "24 FILES, listed, not 30
matching lines" — because naming it forces you to have chosen it.**

## The generous correction that would have preserved a wrong finding

Same night. A peer reported a disclosure gap to the owner, I checked and found it wrong, and I
offered it a **softened** version that preserved half the finding. **It refused the soft version and
pushed its own finding further down than I had.**

Its reason: _"a finding of mine that survives at half strength because the person correcting it was
generous is exactly the kind that then gets cited later as 'X found a disclosure gap'."_

⚠️ **A REGISTER IS ONLY WORTH WHAT ITS WEAKEST SURVIVING ROW IS WORTH, AND ROWS SURVIVE BY NOBODY
WANTING THE ARGUMENT.** **Softening a correction to be kind leaves a wrong row standing with a
citation attached.**

**And it corrected my praise too, which is the sharper half:** I called the downgrade hard. It said it
was not hard — it had a measurement in front of it. ⚠️ **What would have been hard is if nobody had
corrected it, because it had no reason to re-check a finding already sent and never challenged.**
**The mechanism was the correction, not the character** — and a record that credits character
teaches the next reader to rely on something unrepeatable.

Siblings: [[check-the-conclusion-that-flatters-the-theme]], [[observations-expire]].

## The sharper name for it: RESOLVING TO THE WRONG THING, not to nothing (2026-09-03)

Four instances in one night, from four different chats. The shared property is not "measured a proxy"
— it is worse and more specific:

> ⚠️ **A reference or a measurement that resolves to the WRONG thing rather than to nothing. Nothing
> fails. It answers a question you did not ask, in the shape of the one you did.**

**A pointer that resolves to nothing is safe** — it errors, or returns empty, and somebody looks. **A
pointer that resolves to something plausible is not**, because every downstream check passes and the
answer arrives with evidence attached.

**The four forms, so the shape is recognisable rather than abstract:**

1. **A findings register citing a test file that had never existed.** The finding, the mutation and
   the evidence were all real; only the pointer was wrong. Anyone chasing it found nothing, and the
   natural reading of nothing is _the finding was invented_. It survived a session review, two folds
   and three chats reading the document.
2. **A peer relaying a source-file path that did not exist.** Looking for it returns "no such file",
   which reads as _your_ mistake rather than as a bad pointer or a real absence.
3. **A token list derived from a prefix rather than from the thing itself** — plausible members,
   wrong set.
4. **My own grep**: three function names and an unrelated hook name in one alternation, so all three
   "counts" were counting the hook. **All three came back identical, and the tidiness looked like
   confirmation.**

⚠️ **THE TELL, AND IT IS THE ONLY ONE THAT WORKS: A SUSPICIOUSLY TIDY RESULT.** Three identical
numbers. A clean zero. A round rate. In the same session, distrust of a tidy result caught two of my
own errors — the alternation above, and a "zero edit sections" count that was really a
`### Exact edit` versus `### The exact edit` wording difference in one file of three.

**How to apply:**

- **A zero is a wording difference until proven otherwise.** Check the spelling before reporting the
  absence.
- **Identical numbers across supposedly independent questions mean you asked one question.** Split
  them and re-run.
- **Every absence needs a positive control** — a case you know is present, found by the same method.
  Without it, zero is indistinguishable from a pattern that matches nothing. Related:
  [[compliance-without-coverage]].
- **Ask one question per command.** The alternation above existed only to save a round trip.

⚠️ **A SEARCH THAT WRITES INTO THE SPACE IT SEARCHES ALWAYS FINDS ITSELF (2026-09-04).** Hunting a
stray background task, I grepped the session's task-output directory for a phrase — and the grep's
own output file, being written into that directory as it ran, matched. **The self-match is
indistinguishable from a real hit**: same directory, same phrase, and it disappears afterwards, so
re-checking finds nothing and reads as "the file vanished" rather than "I matched myself".

**Two sessions hit it within five minutes of each other**, and the second only separated the real hit
from the artefact by checking size and modification time — the self-match had neither, because it was
still being created.

**How to apply:** when searching a location your own command writes to — task directories, log
folders, scratch space — exclude your own output by name, or verify every hit by opening it. **A hit
you cannot open is more likely to be your own echo than a discovery.**

---

# one-population-per-figure

> A guard that proves a sentence is derived rather than hardcoded needs its OWN population moved for EACH figure — and zero is the wrong direction when the clause is conditional on non-zero

**Ward Lead, 2026-09-05, after FOUR attempts at one guard. Each earlier version passed on a real
defect.** The subject was a sentence reconciling two counts on the Movements board — _"50 moves in
all, 43 still open — 6 have arrived and 1 did not proceed."_

```
v1  compare the sentence against the model
    🔴 a figure HARDCODED to today's value AGREES with the model. A literal `1` stayed green.
       It could not tell a derivation from a coincidence.

v2  add tracking: call it on a smaller population, require the figures to follow
    🔴 it moved the ARRIVED population; the literal was on the ABANDONED one. Green.

v3  remove the abandoned movement, assert the clause disappears
    🔴 STILL GREEN. The literal sits behind `if (abandoned.length > 0)`, so a population with
       NONE hides it rather than exposing it.

v4  synthesise a population with TWO
    ✅ RED. A literal `1` cannot say "2".
```

## The rule

**Each figure needs its OWN population moved, in a direction where a literal must be wrong.**

⚠️ **"Call it with different data" is not one check — it is one check per figure.** v2 looks like a
proper derivation test and is blind to every figure it did not move.

⚠️ **AND ZERO IS THE WRONG DIRECTION when the clause is conditional on being non-zero.** Emptying
the population takes the whole clause off the page, so the hardcoded value **disappears instead of
being contradicted.** The test that felt decisive was exactly backwards. **Move the count UP, not
down: a literal `1` cannot say `2`.**

## Why v3 is the one worth remembering

**It is the version a careful person ships.** Same shape as Ward Lead's clock guard the same night,
where an `if (frozen !== running)` escape _added to be careful_ detected a coincidence and quietly
skipped, reporting a pass. **In both, the defensive construct is what produced the silence** — a
guard with no escape and no conditional would have gone red immediately.

See [[a-green-mutation-that-changed-nothing]], [[a-property-that-does-not-discriminate]],
[[which-assertion-went-red]].

## The related failure in the same function

`totalsReconciliation` also carried a **balance branch that cannot fire**: its three sets
(`arrived`, `abandoned`, `open`) partition the movement space exactly, so `accounted` is
`total − open` **by construction** and the comparison compares a quantity with itself. Verified by
enumerating all 14 (stage × closure) combinations, not by reasoning.

**The code was worth keeping and the comment beside it was wrong** — it claimed to catch "a closed
movement at a stage this function does not enumerate", which cannot happen, when what it actually
defends against is a future narrowing of `isOpen`. **Right guard, wrong rationale, and the rationale
is what stops the next person checking.** [[a-rationale-that-lives-away-from-the-call-site]].

**No test can cover an unreachable branch**, so a safeguard in that position has no proof it works
and would not be missed if a refactor deleted it. [[a-working-safeguard-leaves-no-trace]].

---

# a-count-that-contradicts-what-you-have-seen

> The cheapest defect detector available is a number that disagrees with something already on screen — and it costs nothing to look for

Ward Builder Three reported six "structurally constant" columns on a discharges group, then cut it to
two before it cost anything. I wrote that up as discipline. **It corrected me, and its version is the
useful one:**

> I did not catch that by discipline. I caught it because the _number_ clashed with something I had
> already read: `discharged-today` has one visible row, and "six constant columns" cannot be a design
> fact about a one-row table.

**The signal was a figure disagreeing with something already on screen — not a habit of
re-deriving.** Had it reported six, four columns carrying real per-row facts would have been deleted
from a clinical board.

**How to apply.** Before reporting any count, ask what else you already know that the number has to
be consistent with — a row count, a file count, a list you read ten minutes ago. **A number that
cannot be true given something you have already seen is free to spot and expensive to miss.** This
is the positive form of [[measure-the-thing-not-a-proxy]]: not "measure more carefully", but
"cross-check against what is already in front of you".

Instances the same night, all caught this way rather than by a gate: 0 of 42 event types having a
role entry (absurd, since the reducer typechecks against that table); "six byte-identical files"
where the rule counts were 5, 6, 6, 6, 7, 7; my own 72 for a team that appears in 68 rows.

⚠️ **And when somebody credits you with discipline you did not exercise, correct it.** The flattering
version of a lesson does not transfer — nobody can practise "be disciplined", and everybody can
practise "check the number against what you already read". Related:
[[never-produce-a-figure-while-writing]], [[a-correction-that-agrees-with-you]].

---

# a-count-overstated-a-tile-mislabelled

> The same missing caveat is a rounding annoyance on a summary screen and a wrong answer on the screen where somebody acts; audit the surface that carries the act

Ward Flow, 2026-09-06. An owner ruling said a bed still being cleaned must show its count beside the
Ready figure without changing it. Built on one screen of six. I reported the gap from a code read as
"five screens overstate a count". Opening the screens showed that understates it:

    Capacity screen   ARM Adult Open   "Ready 2 · 1 still being made ready"      correct
    ED screen         ARM Adult Open   "Ready 2"                                 count overstated
    Ward board        /board/arm-adult-open
                      TWO tiles labelled "Ready", ward-board-bed-18 and -19,
                      no mention of cleaning anywhere on the page               A SPECIFIC BED
                                                                                 MISLABELLED

**A count that is too high is a summary somebody discounts. A tile that says "Ready" is the thing
somebody clicks.** One of those two beds will be refused at the moment of action, and the board
offers no way to tell which. Same missing caveat, two completely different severities, and only the
second is a wrong answer to the question the user is actually asking.

**Why:** I had ranked the affected screens by how prominent the figure was, which is a property of
the layout. The right ranking is **by whether the user acts from that surface** — and the board,
where a coordinator picks one bed, was the one I had listed last.

**How to apply:** when a rule is implemented on some surfaces and not others, enumerate the surfaces
and ask of each _"does somebody take an irreversible action from here?"_ Audit those first and quote
the instance, not the class: `ward-board-bed-18` moves people in a way "five screens are affected"
never does. Measure it — 39 tiles scanned, 2 carry "Ready", page mentions cleaning nowhere — because
a named instance with a count behind it survives being relayed.

⚠️ **And the finding only existed because I opened the page.** The code read gave me the class and
the wrong severity ordering; three suites were green throughout. Related:
[[tests-that-assert-rendering-not-truth]], [[a-guard-is-predicate-plus-query]],
[[fields-with-no-producer]], [[one-word-two-states]].

## Three more of the same shape in one night — 2026-09-06 — and it is not only RULES

The entry above is about an owner's RULE built on one screen of six. The same night produced three
more, and two of them are not rules at all:

    a RULE       "Ready" must show the cleaning count beside it — built on the capacity screen,
                 missing on the ED screen and the ward board (the original entry)
    a DISCIPLINE `ward-statistics-derivations.test.ts` guards that the declines claim describes a
                 world the fixture contains — "true of the model, false of what a reader can see".
                 Three hundred lines away in the same file, `referralId` had no such guard, and the
                 statistics screen called a state "ordinary" that 0 of 267 records are in.
    a DISCLOSURE the network page warns that a bed-empty average has no spread at all. All 23 ward
                 detail pages render the same figure with no such warning — measured: 23 of 23
                 wards have zero variation.

**Every one was a good thing someone built, applied to some surfaces and not to a sibling. Nobody
was careless.** And in every case **the surface that missed out was the MORE SPECIFIC one** — the
page about a named ward, a named patient, a named field — which is also the page somebody opens when
they are about to act.

**Why:** work arrives scoped to a screen or a field. The author applies the rule where they are
standing. **Nothing in a repository asks "where else does this apply?"** — tests guard the surface
they were written for, and a guard's own passing is evidence about one surface only.

**How to apply:** when you find a good rule, guard or disclosure, **spend two minutes enumerating
its siblings before moving on** — the other screens rendering that figure, the other fields with the
same nullability, the other pages making that claim. Ask it of your OWN work first: I fixed a colour
guard's exemption and only then thought to ask whether the sibling parser in another session had the
same fault. It did, and so did mine. Related: [[compliance-without-coverage]],
[[a-fix-can-obsolete-its-own-guards-question]], [[fields-with-no-producer]],
[[a-measurement-is-scoped-to-what-it-measured]].

---

# never-produce-a-figure-while-writing

> Numbers that go wrong are produced during prose composition, not during measurement — get every figure from a tool in a separate act and paste it

**Do not produce a figure while writing. Get it from the tool, in a separate act, and paste it.**

**Why this beats "be careful":** prose composition is exactly where you reach for the nearest
available number instead of re-running the query. The nearest available number is almost always
wrong, because it was produced to answer a different question.

**Established 2026-09-02 on Ward Flow — six instances in one session, three of them INSIDE a
discussion of the failure itself:**

1. Told a chat `ward-screen.tsx` had "ten `PULL_PATIENT` sites". Bare-name mentions: 10.
   **Construction sites: 1.** ⚠️ I had run the correct scan hours earlier and printed
   `ward-screen.tsx:1382` — one site — then reached past my own output for a stale count. That is
   worse than a method failure: the right figure was already in the transcript.
2. Nearly reported a sweep as "38 flagged" by counting lines in my own rendered output. The
   script's own count was **44** — six titles had wrapped onto two lines. Committed _in the report
   about counting the wrong thing_, twenty minutes after writing the fix for it.
3. A peer diagnosed its own escaping bug as "the heredoc ate it" while composing a commit message;
   measurement showed heredocs preserve it and the real cause was elsewhere.

**How to apply:**

1. **Every figure in a report is pasted from a tool result, never typed from recall.** If you cannot
   paste it, re-run the query — the re-run is cheaper than the retraction.
2. **Quote the measurement, not the rendering.** A `head`-truncated listing, a wrapped title, a
   `grep -c` on your own output — all of these count the display, not the thing.
3. **A count of a NAME is never a count of a THING.** Discriminate construction from mention from
   comment, and prove the discriminator on a known positive AND a known negative — see
   [[measure-the-thing-not-a-proxy]] and [[a-mention-is-not-an-assertion]].
4. **Controls must run in both directions.** Almost every control I built in that session proved a
   search CAN find the thing; none proved it can also CLEAR a fixed one. **A detector that never
   clears anything has not been tested, only demonstrated.**
5. **State the denominator with the finding.** "44 flagged, 5 read, 1 genuine, 4 false positives,
   18 unread" is a report. "44 findings" is a fabrication — see [[relayed-numbers-lose-attribution]].

---

# a-distribution-error-inflates-a-quote

> A citation whose quote is exact but whose DISTRIBUTION is inflated — 'three places state this' when one states it twice — survives every check a careful reader performs

2026-09-04, Ward Flow. A colleague relayed a rule as _"written verbatim in the reducer for
`PULL_PATIENT`, `CANCEL_TRANSPORT` and `STEP_BACK_STAGE`."_ The quoted sentence was **exact**.

Measured: `"The refusal lives HERE"` occurs **twice, both inside `PULL_PATIENT`** (`:1272`, `:1307` —
the second being the specialling variant with "not only on that screen"). It appears under
`CANCEL_TRANSPORT` nowhere, and **there is no `STEP_BACK_STAGE` case in the reducer at all.**

## Why this class survives

> **A distribution error inflates an argument without changing a single quoted word.**

"Three independent cases state this discipline" is a far stronger claim than "one case states it
twice" — but the strength lives in the DISTRIBUTION, and the distribution is the one part nobody
checks. ⚠️ **A careful reader verifies the quote.** The quote is fine. So the check that a
conscientious person actually performs is precisely the check this defect passes.

**And it propagates upward.** I was about to relay the stronger version onward, having verified the
quote myself. The next reader would have received "three cases" from two independent sources.

## How to apply

- **When a claim says a thing appears in N places, grep for it and COUNT — then list the N sites.**
  One line, and it is the whole of the check. [[establish-the-unit-before-counting]] — list the
  items, never count the matches.
- ⚠️ **A named site that does not exist is the loudest possible tell and the cheapest to find.**
  `STEP_BACK_STAGE` was not a mislabelled case; there is no such case. `git grep` settles it in
  seconds and no amount of reading the quote ever would.
- **Say "one case, stated twice" rather than rounding up to two**, when that is what you have. The
  rounding is where the inflation enters, and it always rounds the way the argument wants.

## The same day, the same shape, from the other direction

The colleague also caught themselves: they had twice repeated a tidy story that _"test 22 was one
assertion from catching the false claim."_ A test refused it — that fixture reaches acceptance
THROUGH a decline, so the premise was wrong. ⚠️ **A near-miss anecdote is a distribution claim
too** ("how close did we come"), it flatters whoever tells it, and nothing in it is checkable by
reading a quote.

Related: [[a-mention-is-not-an-assertion]], [[false-attribution-manufactures-corroboration]],
[[relayed-numbers-lose-attribution]], [[check-the-conclusion-that-flatters-the-theme]],
[[caveat-only-in-the-report]].

---

# agreeing-checks-with-one-blind-spot

> Two independent measurements agreeing is only evidence when they can fail differently — a shared naming convention defeats both

2026-08-30, renaming `released` to `discharged` across Ward Flow. Two sessions independently
enumerated the affected files. One globbed `tests/ward-*`, the other `tests/ward-*.ts` and
`tests/ward-*.tsx`. **Both missed `tests/ui-ward-discharges.spec.ts`** — the Playwright journeys
live in the same directory under a different convention, `tests/ui-ward-*.spec.ts`.

The two wrong lists agreed with each other. Comparing the counts would never have surfaced it;
diffing the NAMES did, and only because a superset scan was run with a deliberately wider net.

**Why:** independent checks are evidence only when they can fail differently. These two shared
their blind spot — a filename convention — so agreement measured the convention, not the code.
Same family as [[a-correct-diagnosis-that-stops-the-inquiry]] and
[[measure-the-thing-not-a-proxy]]: the pattern was not the question, and the result looked like
an answer.

**The generalisation worth more than the incident:** in this repo, **any completeness claim scoped
by `tests/ward-*` silently excludes the Playwright journeys.** That is correct for running a unit
suite (a different runner) and wrong for any claim of the form "no ward test mentions X". Check
whether a scope was chosen for the runner or for the question.

**THE REMEDY, found 2026-08-30 and the missing half of this entry: a hedge that NAMES ITS OWN
SUSPECTED FAILURE MODE.** Unable to find a referral cap, I reported not _"there is no cap"_ but
_"I could not find one, my pattern may be narrower than the question, and here is the specific
wrong thing I may have matched."_ The alternative I offered was plausible and **wrong** — the cap
was real. **Because the uncertainty came with its shape, one command settled it; asserted flatly it
would have been two confident claims needing arbitration.** _"I might be wrong"_ buys nothing and
readers discount it. **Naming the failure mode is what makes a second check independent, because it
tells the second checker what not to reuse** — so this is the remedy for the blind-spot problem
above, not a separate idea.

**FOUR WAYS one search returned a confident wrong answer, same session, ninety minutes (2026-08-30):**
**(1)** `| head -1` on a pattern matching two files — and the wrong one had been added _by the very
commit under examination_, so landing a fix broke the check for the fix; **(2)** reading
`ReferralDraft` when the question was about `Referral` — **the right pattern aimed at a plausible
wrong object**, and the conclusion survived its own broken evidence so nothing prompted a re-read;
**(3)** grepping the events file rather than the reducer — reported one event where four exist;
**(4)** hunting a symbol by a **guessed name** (`MAX_REFERRAL*`) when it is `PARALLEL_REFERRAL_CAP`
— **a guessed identifier that does not exist is indistinguishable from an absent feature.**
Find a declaration by its VALUE or USE SITE, never by the name you would have chosen. **Open the
type by its declaration, never by the first name matching the stem.**

**A check that picks ONE candidate can never report that it picked the wrong one.** `head -1`,
"the first match", "the obvious file" — no error, no empty result, no ambiguity marker; the wrong
file's output is shaped exactly like the right one's. **Print every match AND its count before
using one; if the count is not 1, the question is not properly asked yet.**

**A RESULT THAT WOULD ALARM SOMEONE EARNS A BROKEN-INSTRUMENT CHECK BEFORE IT IS SENT, NOT AFTER**
(2026-08-30, and the most expensive near-miss of the day). Verifying a backup, my selector was
`ls "$B/bundles" | head -1` — which took `CONTENTS.txt`, not `all-branches.bundle`, because it
sorts first. `git bundle list-heads` on a text file fails silently, `grep -c` returned 0, and the
output read "Ward-design refs in bundle: 0". **I was one message from telling the user his backup
did not contain the register of record.** It did. **An alarming false negative costs far more than an
ordinary wrong fact, because it is acted on immediately and the action is usually destructive** —
here, a hurried branch fold. Fifth `head -1` failure in one day.

**ENUMERATING ALTERNATIVES FEELS LIKE COVERING THE SPACE AND DOES NOT.** Three sessions produced
three readings of one ambiguous instruction, argued their costs, and the set felt exhaustive enough
that the only question left was _which_. **The true answer was none of them** — every reading
assumed a thing arrives and asked what happens next; nobody proposed that nothing arrives, because
all three held the same unstated model. **Agreement on an unstated premise reads as thoroughness.**
So: **one generated reading must deny a premise all the others share — and escalate before
enumerating.** Asking cost one sentence; choosing well among three wrong options would have cost a
data model.

## ⚠️ MEASURED, not asserted: two guards collapsing TOGETHER — 2026-09-02

The clearest instance yet, and it came from trying to break a guard rather than from reasoning.

A guard cross-checked an **AST-derived** count of overridable event types against a **textual** count
of the same field's declarations — deliberately two instruments, precisely so one could catch the
other's failure. I removed one event member's field and ran it.

**The cross-check stayed SILENT. Both sides fell from 4 to 3 together**, so `4 === 4` became
`3 === 3` and the equality held. ⚠️ **Two independent instruments, agreeing, both wrong.** What
caught it was a _third_ guard — an exact-set snapshot pinned against a literal list.

**This is the strongest available argument for redundant guards, and it is the opposite of the usual
one.** The usual argument is "belt and braces". The real one is: **an equality between two derived
quantities has a failure mode that neither quantity has alone — they can move together.** A pin
against a _literal constant_ cannot move with anything, which is why it was the one that fired.

**So when you build a cross-check between two computations, add a third assertion against something
written down by hand.** Ask of any agreeing pair: _what change would move both of these the same way?_
If such a change exists, the pair is one guard, not two.

## How to apply

when two checks agree, ask what they share before treating it as confirmation —
same glob, same tool, same author's assumption. Diff the file names, never the counts: a
difference of counts is a mystery, a difference of names is a bug. And prove any zero with a
mutation — put the thing back in one place and watch something redden — because a zero from a
pattern nobody has shown can fail is not evidence.

---

## Sizing a change: ask what the TYPES and GUARDS demand, not where the value goes

2026-09-06, Ward Flow. Adding one screen to the navigation was sized three times by three sessions,
each smaller than the truth, **and nobody was careless — each reported the scope they had actually
checked:**

```
me                "one line"                  the WARD_NAV entry
Ward Verifier     "two things, one commit"    entry + route, atomic
Ward Builder One  FOUR things, THREE files    WardNavId union member
                                              WARD_NAV entry
                                              WARD_NAV_ICONS entry
                                              the route
```

**Every one of the four reddens something if it lands alone**: route without entry fails
`ward-nav.test.ts:678`, entry without route fails `:668`, id without icon fails **typecheck** _and_
`:956` independently. ⚠️ **And the icon is not a local failure — `WARD_NAV_ICONS` is
`Record<WardNavId, LucideIcon>`, and a missing entry throws `Element type is invalid` on EVERY Ward
Flow screen, because the rail mounts on all of them.** The guard's own comment says it has already
happened once.

**The cheap habit that would have caught all three underestimates:**

> **Before quoting a change's size, resolve what the TYPE SYSTEM and the GUARDS demand of it — not
> just where the value goes.**

A `Record<SomeUnion, X>` keyed by the thing you are adding is a required second edit that the value's
own file never mentions. Grep the union name, not the array name.

**Why the error repeats:** you size a change by looking at where it _belongs_, which is one file, and
the obligations live in files that merely _consume_ it. **Each estimate is honest about what its
author looked at; the miss is always in the consumer.** Three independent sessions produced three
different answers by the same mechanism — which makes it a property of the task, not of anybody's
care.

Related: [[a-shared-layer-inherits-responsibilities-not-just-properties]],
[[the-suite-never-tests-the-absence]], [[a-cast-plus-a-runner-that-does-not-typecheck]],
[[fields-with-no-producer]].

## A type-error count is not a work estimate (2026-09-10)

`npm run typecheck` reported **5** errors in one test file. Fixing all five produced **13**. Fixing
those produced **1**. Fixing that produced **0**.

Nothing regressed and nothing was miscounted. **TypeScript reports one failing property per object
literal** — an id with the wrong template-literal type, a string outside its union, a missing
required field are each found only once the one before it is satisfied. An `as` cast anywhere in the
literal defers the whole remainder.

**So the first number is a lower bound on a lower bound.** Anyone reading "5 errors" as the size of
the job is wrong by whatever factor the literals happen to hold, and finds out only by finishing.
Report a type-error count as _"5 reported, unknown total"_, never as _"5 to fix"_ — and re-run after
every batch rather than working down the original list.

Related: [[assert-only-about-code-you-opened]], [[a-cast-plus-a-runner-that-does-not-typecheck]].
