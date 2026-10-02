# Ward Lead handover — 2026-09-09

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/STATUS.md`.** Kept for history; do not follow.

**Written by Ward Lead at Josh's instruction, after taking a handover from every live Ward Flow
chat.** Supersedes nothing: [`WARD-LEAD-HANDOVER-2026-09-05.md`](WARD-LEAD-HANDOVER-2026-09-05.md)
still holds the reword-arm ruling and the open-items table, and its line 257 was **corrected three
times today** — read it there, not here.

⚠️ **Sections marked ⏳ are awaiting a chat's own handover and are NOT yet filled from their
account.** Anything not marked ⏳ was measured on the master line by Ward Lead.

---

## 1. Where the line stands

    master line   codex/task-ward-flow-live-state-20260831
    state         12 folds, nothing pushed, ~2400 commits local-only
    tests         4145 pass · 2 expected fail · 75 skipped · **the 2 failures are FOUND AND FIXED**
    tree          clean apart from seven untracked scratch files at the repo root

### 🔴 The two failing tests, named — and neither was a broken screen

For three days a full ward run reported "2 failed" with no detail, because a `| tail` discarded it.
They are `ward-community-ratified-alias-on-screen` and `ward-community-near-duplicate-warning`, and
**both were `Test timed out in 30000ms` — not an assertion.** Each renders all **64** community team
pages one at a time; the page list grows with the source document and the ceiling was a flat 30 s.

**Ward Builder Three diagnosed this correctly on 2026-09-07** — _"not randomly flaky; it runs close
enough to the limit that machine load decides the verdict"_ — handed it to "whoever owns
`ward-community-*`", and nobody picked it up. **Four sessions then reported the mutation harness as
broken on the strength of the same 30-second timeout.** A diagnosis with no owner gets re-derived.

Fixed by deriving the budget from the population (`pages × 3 s`) rather than raising it to a new
constant, which would reset the same trap one team further out. Both green: 27.4 s and 24.5 s.

🔴 **NOTHING IS EVER PUSHED.** Both ward branches exist on this disk only.

### What landed today

|                                           |                                                                                                                                    |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `origin/main` merged into the ward line   | 101 conflicts — 90 mechanical, 11 decided one at a time. **Not one of the 38 ward component files was genuinely divergent.**       |
| The handover page became fully filterable | Service, Ward, ED, Community. All three owner conditions verified live and by mutation. **Print verified with a working control.** |
| The reword arms                           | Ward Builder Two 57/57; Ward Builder Four 4/4 measurable. **The method itself was found incomplete — see §3.**                     |
| A P1 safety proof                         | `PULL_PATIENT` refuses a judgement gate — the pair the reducer's own comment demanded and which did not exist.                     |
| Three guards the fold aged                | Repaired at the coordinate, not the rule.                                                                                          |
| The fold survey                           | **Every ward branch is folded. No remaining branch in the repository contains ward work.**                                         |

---

## 2. Owner decisions made today

| Ruling                                                                                                                                                                                                   | Where                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **The handover page is fully filterable, and the chip rule does not govern it** — with three conditions: the filter named, the excluded count stated, and anything urgent outside the filter still named | [`owner-decisions-2026-09-09.md`](owner-decisions-2026-09-09.md) §1 |
| **An invented figure carries its own provenance** — the heading is not enough. Widened to all 17 screens (reading A: disclosure _sentences_, not every figure)                                           | [`owner-decisions-2026-09-09.md`](owner-decisions-2026-09-09.md) §2 |
| **Statistics deferred, then restarted.** Deferred with _"drop the statistics work for now"_, confirmed directly; subsequently restarted by direct instruction to Ward Builder Two                        | `control/work-claims.md`                                            |

⚠️ **The statistics row records a deferral that events overtook.** It is correct as written and
already stale in effect — the work is running. **Fix it when the current batch lands, not before**,
or the row will contradict the fold that closes it.

---

## 3. The method changed today, twice, and both changes are in the ruling not here

Read [`WARD-LEAD-HANDOVER-2026-09-05.md`](WARD-LEAD-HANDOVER-2026-09-05.md) line 257. In short:

1. 🔴 **"Narrow what is READ" is correct for a POSITIVE claim and INVERTED for a BAN.** A ban read
   from a narrowed element cannot see the forbidden phrase anywhere else. Measured: a retired claim
   placed in a neighbouring element, **37 of 37 passed**. **I restated the universal form to three
   chats in three briefs before this was found.**
2. 🔴 **Reword-plus-break cannot see two defect classes**, because a break arm deletes the line and
   every spelling fails together. Two further arms are now required — **D · bystander** (keep the
   spelling, change the subject) and **E · hollow** (keep the subject, remove the absence). **Three
   of four sites were invisible to the old method.**
3. **A fallback spelling its own file forbids from rendering** — invisible to all five arms, because
   the disqualifying fact lives in another test.
4. **An inert file is UNMEASURABLE, not unmeasured.** `ward-morning-page.dom.test.tsx` declares 20
   tests and executes none.

---

## 4. In flight

| Chat                      | Work                                                                   | State                                                                                                                              |
| ------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Ward Builder Two          | Statistics reword arms, then arm F over both ranges                    | ✅ **folded `2e254d3e47` + `f6bfec213d` + `45e2b4a4c0`.** 57 measured · 31 defective · 26 sound; the completed range moves 46 → 47 |
| Ward Builder Four         | The invented-figure ruling                                             | ✅ **folded `72308345c0` + `4a35634f96`.** Three holes closed, arms re-run here                                                    |
| Ward Builder Three        | Stopped on Josh's instruction                                          | ✅ account received; their timeout diagnosis is now acted on                                                                       |
| Ward Verifier             | `probes-that-answer-a-neighbouring-question.md`, folded                | ✅ account received                                                                                                                |
| Design System             | Third edition; `485a9cfa98` folded                                     | ⏳ handover requested                                                                                                              |
| Ward Flow command mockups | Unknown to Ward Lead until yesterday — **nothing of theirs is folded** | ⏳ handover requested                                                                                                              |

⚠️ **Two chats are still named "Ward Builder Two".** Three recommended making that impossible rather
than merely documenting it; one of them has started signing itself `ward-builder-two-62`. **Nothing
has been done about it**, and a fold attributed to the wrong chat is the failure mode.

---

## 4b. 🔴 The invented-figure guard reaches two files out of seventy-six

**Measured four ways that agree** — by me with one grep, and by three independent read-only passes
over 39 of the 76 ward files, none of which knew the others' answers.
Full account: [`the-guard-reaches-two-files-2026-09-10.md`](the-guard-reaches-two-files-2026-09-10.md).

    76  ward screen files            51  carry provenance-disclosure prose
     3  headings the guard can see    2  files those three live in

**The screens are not missing their disclosures.** Fifty-one of them carry one. The convention this
codebase actually uses is a governance banner — a badge reading "Synthetic prototype" followed by a
paragraph — and it does not put the word in a heading. `capacity-screen.tsx` says _"Every bed count,
ward name and waiting patient on this screen is invented. No figure here describes a real hospital,
and nothing on it is a clinical record."_ That is compliant, it is exactly what the ruling is about,
and **the guard structurally cannot see it.**

So this is not a backlog of forty-nine screens. **Making them visible to this guard would mean
rewriting compliant screens to adopt a heading convention they do not use, so that a check can see
them.** Whether that is worth doing is a question for Josh, and it is in §6.

⚠️ **The guard's anti-vacuity floor sits exactly on its population** — `blocks >= 3` against exactly
3 blocks. It fires when a block goes dark, which looks like the floor working. It is not: it fires
because a count crossed a constant. **Add a fourth block and the identical loss passes in silence.**

---

## 4c. The same defect, twice in one afternoon, pointing opposite ways

    the provenance guard    a constant FLOOR   under a population that could grow  → passes silently
    the two ward sweeps     a constant CEILING under a population that did grow    → reddened

**A constant compared against a moving population decides its verdict by arithmetic rather than by
what it is supposed to be watching.** Both were written by careful people and both read as correct.
Every anti-vacuity floor in this programme is currently written as a constant.

---

## 5. 🔴 The three gates before any real-patient use

**These are not tasks. They are conditions, and two of them cannot be met from inside this project.**

1. **Regulatory classification (TGA/SaMD).** A board that _ranks wards for a patient_ is closer to
   clinical decision support than one that records what happened. The box was left unticked on
   PR #2597 and lifting the old "suggests nothing" constraint is what made it live. Per
   `owner-rulings-2026-09-04.md` R-G it must be answered **before this ships to anyone**, not before
   it is prototyped.
2. **Sex and gender identity.** Bed eligibility is computed from a single `sex` field; no gender
   field exists. The owner ruled a clinician who works in this area decides before the model
   changes. ⚠️ **Every screen built meanwhile hardens the single-field assumption.**
3. **Aboriginal cultural safety review.** Deferred deliberately — a review against a sketch produces
   advice about a sketch. **It requires Aboriginal health practitioners and no internal review
   substitutes for it.**

---

## 6. Still with the owner

- **The third-edition identity replacement** — approved in principle, _"I will update soon. Await my
  response"_, unstarted. Nine of eleven locked colours change and a five-wave migration of all
  eighteen mockups sits inside it.
- **Five drawings exist only as chat artifacts** — Command, Capacity, Movements, Delays and the
  patient Now screen. Only the chats holding them can export them.
- **Seven scratch files** at the repo root, awaiting permission to delete.
- 🆕 **How far the invented-figure guard should reach** (§4b). Three ways to go, and the cost of each
  is real:
  1. **Leave it.** Two files guarded; the other seventy-four rely on a person noticing. Cheapest,
     and it means a screen could start stating an invented figure as fact and nothing would catch it.
  2. **Widen the trigger to banners.** This was already built and measured once: **44 of 58 banner
     sentences flagged, and almost all of them were correct**, because banners mix provenance with
     safety statements like _"This board is not a medical device."_ A guard that reddens on correct
     work gets switched off rather than obeyed.
  3. **Change the screens to disclose under a heading**, so the guard reaches them. Honest, and it
     means editing compliant screens for the benefit of a checker.

  **My recommendation is 1 for now**, because 2 is known to fail and 3 spends real work on screens
  that are already telling the truth — but it is his call, because it is his ruling.

---

## 7. The habit that would have prevented most of today

> **Test the instrument on a question you already know the answer to, before pointing it at one you
> do not. Once per instrument, not once per sweep.** — Ward Verifier

**Eight probes across four chats returned a confident answer to a question they could not answer.**
Not one was caught by a gate; every one surfaced by accident or because a result looked too good.
The catalogue is [`probes-that-answer-a-neighbouring-question.md`](../../probes-that-answer-a-neighbouring-question.md).

⚠️ **And four instruments answered "whose worktree is this?" wrongly in one afternoon** — the branch
name, a process filter that structurally could not return a hit, a session `cwd` that was correct
and expired, and a working tree that was clean when read. **The only method that worked was asking
the chat.**

---

## 8. What I verified myself rather than took on trust

**Ward Builder Four's guard was folded on their account, then mutated by me.** A guard folded on
its author's word is a guard nobody has tested.

    A · a bare invented figure INSIDE the guarded paragraph   → RED, naming that sentence and no other
    B · the same figure in a SECOND paragraph, same heading   → GREEN, 4 of 4. Invisible.
    C · the block's prose wrapped in <span> instead of <p>    → RED, but on the FLOOR, not on the rule

**Arm A is the guard working.** **Arm B is the hole its author predicted and could not measure
before handing over — now measured, and recorded at the scoping function rather than in a document
nobody opens next to the code.** Arm C is §4b's floor finding.

`hub-screen.tsx` was restored to its pre-mutation blob and checked by hash, not by eye.

---

## 8b. 🔴 The checker accepts a sentence saying the figures are NOT invented

Found by Ward Builder Four the same evening, measured by them and **re-verified by me before I
acted on it.** All three of these satisfy the guard:

    "These figures are NOT invented — they are the current state of the network."   PASSES
    "This is NO LONGER a prototype, and the eleven-hour figure is measured."        PASSES
    "Nothing here is synthetic any more; every bed count is live."                  PASSES

**A negated marker counts as a marker.** The guard tests for a WORD; the property is a CLAIM. So it
certifies the exact assertion the owner's ruling forbids — that an invented figure is measured —
because the sentence contains the word it is denying.

The same root admits six "bystander" sentences, where the marker sits in a clause about a different
subject: _"The ward names are invented; there were 28 referrals this period."_

**Four is fixing all of it on their own branch, in five separate commits, and I am staying off the
file** — they measured every part of it and two chats writing one file is the failure nothing here
can see. Also removed: `prototype`, which admits three defects and — verified by me by deleting it
and re-running, 4 of 4 green — holds up none of the five real sentences.

⚠️ **And one of my own reasons did not survive their reading of it.** I declined to widen the
paragraph scan by quoting a measurement of **44 of 58 banner sentences flagged**. That figure came
from a BADGE-anchored widening over banner prose; what was proposed was HEADING-anchored and stays
inside the population the file already defends. **The number never priced the question I spent it
on.** It is the same shape as the withdrawal in §8 — a rigorous, correct measurement about the
wrong thing — and I made it in the commit that wrote theirs up. Their measurement: the widening adds
**0 sentences** on today's corpus. Accepted; the wrong reasoning is being replaced in the file by
the same edit that fixes it.

---

## 9. Where today went wrong, kept because the pattern repeats

- 🔴 **I reported the two ward failures as unknown for three days** because a `| tail -6` returned
  the pipe's exit code and threw the detail away — a trap I had already recorded in my own memory
  and hit anyway. `pipefail` is off in this shell. **Write the output to a file; never pipe a gate
  into `tail`.**
- 🔴 **I wrote a per-page figure built from two different measurements** — a timed-out duration
  (34 s, from a run that never finished) divided by a page count from a different reading (43, when
  the list holds 64). Neither half measured the same thing. **A timed-out duration is not how long
  the work takes; it is how long we waited before giving up.** Caught and corrected before the
  commit; the real figures are 0.43 s and 0.38 s per page.
- **Ward Builder Three's timeout diagnosis sat unowned for three days** and four sessions
  re-derived a piece of it. It was handed to "whoever owns `ward-community-*`" — and nobody owns
  `ward-community-*`. **A handover addressed to a role nobody holds is not a handover.**

---

## 10. 🔴 Arm F — the one that outranks everything else on this page

**Two chats found the same thing on the same night, from opposite sides, neither knowing of the
other.** In Ward Builder Two's words:

> **A guard is a QUERY plus a PREDICATE, and both of our arms only exercise the predicate.**

Arms A–E all mutate what a guard reads ABOUT. **Not one of them mutates what it READS.** So all five
pass on a guard that is looking in the wrong place, and the result looks perfect in review.

    Two bans read one element, the retired claim sat in the next paragraph   37 of 37 passed
    Three of four refusal figures: guard read the paragraph, figure in the article
    The provenance guard read the first <p>; the same defect in a second <p> was invisible

**Arm F: leave the sentence exactly as written, and put the defect in a neighbouring element.** Now
promoted to a named arm at the top of the 2026-09-05 ruling.

⚠️ **And it had already been written down there, on 2026-09-05** — _"a guard is predicate PLUS
query"_ — buried mid-cell in a wide table. **A finding that is recorded but not promoted is a
finding that will be paid for again.** That is why it has a letter now.

---

## 11. What the wide gates say, now that somebody ran them

Ward Builder Two closed their handover by labelling what they had **not** run — no `verify:cheap`,
no typecheck, format unrun. That labelling is the only reason the next line exists.

**Typecheck was red: 13 errors, every one in a file I wrote,** and the ward suite was green
throughout. Fixed at `d0835c78ca`. **Third instance on this line of a green ward suite standing
beside a red typecheck — no ward gate asks the question, so a person has to.**

⚠️ **And the count is not a work estimate: it went 5 → 13 → 1 → 0.** TypeScript reports one failing
property per object literal, so each fix uncovers the next. "5 errors" understated the job
threefold.

**Format has still not been run on this line.** Recorded as unrun rather than assumed clean.

---

## 12. 🔴 The worst defect in either range, and it was found by restating a rule at a different file

**A sentence retired for being FALSE could return verbatim, one element from the ban that forbids
it, with 105 of 105 green.**

The out-of-area board once explained an unbanded patient with a single cause — _"because this
prototype holds no travel time for their home region."_ **That is false for every patient this
prototype places from an emergency department**, because an ED admission carries no home region at
all. The sentence was retired and banned. The ban read one banner. Re-rendered in a neighbouring
element on the same board, nothing fired.

Verified here with a control: the verbatim claim in a new element reddens exactly one test — the one
named for it — and an unrelated sentence in the same element does not.

### Why it survived a correction that named it

The report covering that range **already carried** _"I measured the predicate and called it the
guard"_. Writing that sentence did not cause its author to re-check the other three bans it was
equally true of.

> **A correction is scoped to the thing it was written about, and does not sweep the class it
> names.**

It closed the instance and left the class open — **inside a document whose whole subject is that
closing an instance is not closing a class.** What reopened it was Ward Lead restating the rule
against a _different_ file. Ward Builder Three reports the identical shape the same day, in their
better phrasing: _"knowing a trap by name does not stop you walking into it — being handed the case
it covers, in a form you recognise, is what fires it."_

### What follows from two chats showing the same thing

**A check that RUNS beats a lesson that is read.** Commissioned from Ward Builder Two: a static test
requiring every `expectNeverSaysAgain` to read a page- or screen-level element.

⚠️ **With one constraint that decides whether it is worth anything.** Measured before commissioning:
**11 call sites, 3 files, and ten of the eleven already name their variable `page`.** So a check
keyed on the identifier passes today and can never fail for its own reason — a guard satisfied by the
text it scans. **It must key on the ASSIGNMENT**, not the name; its floor must be relative
(`checked === found`) rather than a constant at 11; and every exemption carries a reason, because an
exemption with no reason is indistinguishable from a defect somebody silenced.

---

## 13. The rule became a check that runs — and it caught itself first

`tests/ward-ban-scope.test.ts`, folded `6283426e1b`. **Three chats argued in three documents that a
ban must read the whole page, and the class stayed open every time.** The written form was measured
insufficient four times. This is the version that runs, and it fails closed for bans written after
all of us stop.

**Verified here by my own mutation, against the trap that decides its worth.** Ten of the eleven ban
haystacks are already named `page`, so a check keyed on the _identifier_ would pass today and could
never fail for its own reason. I narrowed a real ban's read and left the variable called `page`:

    × ward-statistics.dom.test.tsx:832 — … reads a page or screen root
      "this ban reads `page`, assigned from `…getByTestId("ward-statistics-bed-readiness")…`,
       which is narrower than a page or screen root."

🔴 **The relative floor earned itself before the check had checked anything.** On its first run it
went red having found a **twelfth** call site it could not parse — **its own source**, carrying
`"expectNeverSaysAgain("` inside its matcher. Comments are blanked; a string literal is not.
**Writing the defect down collided with the check for the defect**, and a constant floor at eleven
would have passed it in silence.

⚠️ **Its residual weakness, in its author's words rather than dressed up:** the screen roots are a
declared list of two ids, and somebody could widen what the check accepts by adding a narrow id to
it. Visible reasoned diff, and a typo fails closed — **but not the same as verifying root-ness from
the DOM, which a static check cannot do.**

⚠️ **And the file carries an inversion warning at the top, which is the likeliest thing here to save
somebody.** It governs **bans** only. Extending it to `expectSays` would enforce the _opposite_ of
what positive claims need — for a claim, a read too WIDE is the defect. A future chat reading only
the filename would widen it and quietly break every positive guard in the estate.

---

## 14. Closed since, and what is genuinely still open

### Closed

- ✅ **The statistics provenance guard's inversion — FIXED and folded** (`bad20426c9`). It was wrong
  in **both directions at once** — 7 of 8 defects admitted _and_ 3 of 9 honest items reddened — which
  is why it read as tuned rather than broken. Now 0 and 0. **The repair is one shared predicate, not
  one better list:** two near-identical copies existed, and the second survived precisely _because_
  it was a copy — written the same day as the correction that named its class, in a file its author
  had just edited, unlooked-at.
- ✅ **The owner's reach question — ANSWERED: leave it.** [`owner-decisions-2026-09-09.md`](owner-decisions-2026-09-09.md) §3.
- ✅ **The Command drawing's Activity panel — FIXED** (`60695b3906`), verified in a browser.
  [`owner-decisions-2026-09-09.md`](owner-decisions-2026-09-09.md) §4.
- ✅ **The repo-root scratch files — deleted with the owner's approval.** Six removed;
  `.claude/launch.json` kept, because it is a dev-server config and not scratch.

### 🔴 Still open

- **Two questions with the owner, both drawn on the Command screen and neither in the software:**
  whether beds are ordered partly by **patient acuity**, and whether the **catchment rule** is real.
  **Anybody building from that drawing would build them.** Ward Lead is the named un-deferrer.
- **Format has never been run on this line.** Commissioned from Ward Builder Two now that both guards
  are repaired. Recorded as unrun, not assumed clean.
- **Design System still owes a handover.** The command-mockups chat has given theirs.
- **The third-edition identity replacement** — approved in principle, _"I will update soon"_,
  unstarted. Nine of eleven locked colours change; a five-wave migration of eighteen mockups sits
  inside it.
- **Five ledger inbox requests** need `npm run issues:reconcile` from a dedicated fresh-base branch.
  **Deliberately not done while chats are live** — it takes a cross-worktree lock.
- **The query of every NON-ban guard** in both reword ranges is **UNEXAMINED, not clean.**

---

## 15. 🔴 Nine instances, one defect — and it is the finding of the whole programme

Ward Builder Two collapsed a catalogue I had been keeping as nine separate entries:

> **"I keep accepting an answer to the adjacent question because it arrives in the right shape."**

    git log -S <text>       answers "which commit INTRODUCED this"   read as "has this landed"
    grep for a component    answers "which files IMPORT it"          read as "where is this SHAPE"
    grep for a board string answers "does any test READ this board"  read as "did my fix land"
    plant, run the suite    answers "does this redden the suite"     read as "does the guard reach"
    Win32_Process           answers "what binary is running"         read as "whose worktree is this"

**Every one returned a correct, well-formed answer to the question next door.** Not carelessness, not
a broken tool. **The rigour is what makes it persuasive** — one grep, exhaustive, correct, and about
the wrong thing.

**And "ask the right question" is not the fix, because nobody knows they asked the wrong one.** The
fix is the control: **point the instrument at a case whose answer you already know, before trusting
what it says.** Ward Builder Two's version of this is the best output of the day — a fold-checker
that **refuses to report at all** until a commit known to be folded comes back folded:

> **A checker that cannot say YES cannot be trusted when it says NO.**

**Four chats have now measured the written form insufficient.** Prefer the tool that refuses to the
resolution that is read.
