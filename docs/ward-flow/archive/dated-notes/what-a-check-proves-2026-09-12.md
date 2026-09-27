# What a check proves — and the four things it does not

**Written 2026-09-12 by Ward Lead, from findings three chats reached independently and from
different directions on one day. Every claim below is a measurement taken that day, with the
measurement named.**

🔴 **THIS EXISTS BECAUSE TWO ADVERSARIAL REVIEWS, RUN SEPARATELY ON SEPARATE LANES, EACH RETURNED
SIX FALSE CLAIMS AND ZERO CODE DEFECTS.** ⚠️ **In this project the defects are in the PROSE, and
nothing automated reads prose. Every mechanism below is an attempt to make a sentence checkable.**

---

## 1 · A FLOOR PROVES THE WALK WAS NOT EMPTY. IT SAYS NOTHING ABOUT WHETHER THE WALK COVERS THE THING YOU ARE WORRIED ABOUT.

**An anti-vacuity floor — `expect(files.length).toBeGreaterThan(1000)` — exists so a guard cannot
pass having examined nothing. That is real and worth having. It is also the weaker half of what
people believe it says.**

**MEASURED, and it is the proof rather than the illustration:**

    tests/ward-source-control-chars-gate.test.ts   floor: population > 1000 files
    the gate's actual roots                        src/ and tests/ ONLY
    the defect it was written for                  five raw 0x08 bytes in three files under docs/

🔴 **The floor was satisfied — 3,164 files — the entire time the gate was blind to the directory
where the defect lived. It printed "None found" identically before and after the repair.** ⚠️ **A
number that agrees with itself is not a number anybody checked.**

✅ **So state the floor's SUBJECT, not just its size: "walked 593 files under `docs/ward-flow`" is a
claim about coverage. "walked 3,779 files" is a claim about effort.**

---

## 2 · A SPECIMEN SAYS "THIS WAS WALKED". A FLOOR ONLY SAYS "SOMETHING WAS".

**The complement, reached independently by a lane from the opposite direction — from its own
legal-forms work, which stumbled into the technique before naming it.**

> **A floor says something was walked. A SPECIMEN — a deliberately constructed case the ordinary
> fixture cannot produce — says THIS was walked.**

🔴 **The two are not alternatives. A floor defends against an empty population; a specimen defends
against a population that is full of the wrong things.** ⚠️ **Most guards in this repository have
the first and not the second.

✅ **A specimen is also the only honest answer to "does this guard bite?" — see §4.**

---

## 3 · A FLOOR OVER AN AGGREGATE DOES NOT DEFEND ITS MEMBERS.

**MEASURED: a screen test asserted that three referral figures were right, with an anti-vacuity
floor on their SUM.**

    the ward under test   {asked: 0, accepted: 2, declined: 1}
    the floor             sum > 0  →  3. Healthy.
    the mutation          swap `asked` and `declined`  →  SURVIVED

🔴 **The `asked` assertion compared 0 with 0. The floor was satisfied by a distribution in which two
of the three members were indistinguishable from each other.**

✅ **The repair was not a bigger floor. It was measuring all 23 seeded units, finding that exactly
ONE had all three non-zero — and that even that one was insufficient, because two of its three were
both 1 and so swapped invisibly. Three further wards now each exercise exactly ONE figure.**

⚠️ **The general form: an aggregate is satisfied by many distributions, and the one you have is
rarely the one that discriminates.**

---

## 4 · A COMMENT THAT NAMES THE GUARD ENFORCING IT CANNOT ROT SILENTLY — IF ANYBODY HAS EVER WATCHED THAT GUARD FAIL.

**A count parked in a comment invalidates itself in silence: nothing fails when it stops being true.
The recommended fix, arrived at today and genuinely good, is that a count should NAME the guard that
enforces it.**

🔴 **AND THEN A LANE ASKED THE QUESTION THAT UNDERCUTS IT: "How many other comments name a guard
nobody has ever watched fail?"**

⚠️ **Nobody knows. It is the exact inverse of the other defect found today — a comment claiming
coverage that did not exist — and it is worse, because naming a guard is the pattern we spent the
day recommending.**

✅ **So the rule has a second half, and without it the first half is decoration:**

> **A count may name its guard only if somebody has made that guard fail and watched it name the
> offender. Otherwise the comment claims enforcement it has never demonstrated.**

🔴 **Both halves of this are "the check exists" standing in for "the check works".**

---

## 5 · A GATE REWRITTEN BY ITS OWN WIRER HAS ONE AUTHOR.

**When two dead gates were wired today, both turned out to pass on an empty population. The
temptation was to fix the gates. They were not fixed.**

✅ **The floors went at the WIRING layer — in the test that invokes the gate — rather than inside the
gate's own pass/fail logic.** ⚠️ **Not out of caution: a gate whose own refusal conditions are
rewritten by the person wiring it is a gate with one author, and the second opinion the wiring was
supposed to provide is gone.**

🔴 **This is structural rather than procedural. It survives the wirer forgetting.**

---

## 6 · RE-DERIVE EVERY FIGURE IN THE SAME PASS THAT WRITES THE LIST IT APPEARS IN.

**MEASURED, and it is the sharpest instance of the day: a process review contained an explicit
warning that its own figures might already be one row out of date — and then shipped a list two
sections later carrying two rows that were already closed, one of which was settleable against the
author's own branch by a single command.**

🔴 **A DOCUMENT THAT CONTAINS ITS OWN STALENESS WARNING STILL SHIPS STALE.** ⚠️ **The caveat and the
list are written at different moments; the reader lifts the row and never the caveat; and the author
does not re-run the measurement in between, because WRITING THE CAVEAT FEELS LIKE HAVING HANDLED IT.**

✅ **The control, stated as a procedure rather than a lesson:**

> **Re-derive every figure in the SAME PASS that writes the list it appears in — not when the caveat
> was written. A row that cannot be re-derived in that pass does not go in the list; it goes in a
> separate "not re-checked" block carrying its own date. And where it is cheap, PUT THE SETTLING
> COMMAND BESIDE THE CLAIM, so a reader settles it in one line instead of trusting it.**

---

## 7 · AGREEMENT IS EVIDENCE ONLY IN PROPORTION TO HOW EASILY IT COULD HAVE FAILED TO HAPPEN.

**Twice in one day, two parties agreed and the agreement meant opposite things.**

    🔴 WORTHLESS   two chats measured a path-separator bug and got the identical number. Both had
                   replicated the walk FROM ITS DESCRIPTION rather than from the file. The real line
                   was `path.posix.join` and the bug did not exist. One instrument, run twice.
    ✅ REAL        two chats enumerated the guards invisible to the ward runner and got the identical
                   eighteen — by different patterns, neither a superset of the other. One added
                   identifier forms and was case-insensitive; the other alone carried `ward-board`.

⚠️ **The test is not "did they agree". It is ASK WHAT WOULD HAVE MADE THEM DIFFER.** ✅ **And record
the asymmetry rather than the agreement: the matching eighteen means no file today is found by one
query and missed by the other — it does not mean the queries are equivalent.**

---

## 8 · NEVER THE EXIT CODE. READ THE RUNNER'S OWN SUMMARY.

**Four times on 2026-09-12 an exit code described something other than the run it appeared to belong
to. Once over `failed: 2`. Once over `4 failed`. Once over a run that executed zero tests. And once
from the harness itself, reporting "completed (exit code 0)" over a script that exited 1.**

🔴 **A fifth was self-inflicted: a `| tail -30` on the one run whose purpose was an honest count. The
output looked complete, nothing said there was more, and the exit code belonged to `tail`.**

✅ **Anything you will quote prints how much you left out. If you truncate, say by how much.**

---

## 9 · A TRUE STATEMENT AT THE WRONG WIDTH — THE TWO AXES, AND EVERY GATE HERE MISSES BOTH

**Two lanes diagnosed themselves on the same afternoon and arrived at opposite halves of one defect.
Neither found their own without the other.**

> **ONE: I generalise from what I was SHOWN. I fix the instance in front of me and report it as the
> set.**
>
> **THE OTHER: I complete from what I did NOT LOOK AT. A slice treated as the file.**

🔴 **Same defect, opposite axes. One reports too MUCH because it only saw part of the problem; the
other reports too LITTLE because it only read part of the source.** ⚠️ **Both produce a statement
that is TRUE and wrongly SCOPED, and a true statement survives every check this repository has.**

**Counted on 2026-09-12: six instances of the second, four of the first. Ten in one afternoon,
between two participants.**

**WORKED EXAMPLES, so the shape is recognisable rather than abstract:**

    generalising from what was shown
      "two guards broke"          it was three, then the repair of the third had two more holes
      "exactly two files compose" three files, four compose lines — and the twin of the corrected
                                  sentence stood four lines below the correction
      a privacy sentence fixed    in one of THREE copies; the review found that one

    completing from what was not read
      "path.join"                 the line says path.posix.join. A grep window that did not
                                  contain the line, with the line supplied from expectation
      "the worktree is gone"      all three exist, and the command never inspects one
      a hook file named           at a path where no such file exists

✅ **THE CONTROL FOR THE FIRST: when a mutation or a review finds one instance, SWEEP FOR ITS
SIBLINGS BEFORE REPORTING A COUNT. A correction that lands on one instance of a repeated claim is
not a correction — it is a disagreement.**

✅ **THE CONTROL FOR THE SECOND: if you are about to quote a line, OPEN THE FILE AT THAT LINE. A grep
window is not the file, and the lines it does not return are exactly where an assumption passes
unchallenged.**

---

## 10 · A FRAGILE LINK THAT IS DOCUMENTED IS STILL FRAGILE.

**A guard's coverage depended on a component being rendered by a test in a DIFFERENT file — an
unnamed, load-bearing cross-file dependency. Two repairs were proposed:**

    name the sibling assertion in a comment     documents the dependency
    assert the case in-file                     deletes the dependency

🔴 **The second is the fix. The first preserves the thing it warns about.** ⚠️ **And the reviewer who
proposed the first said so plainly once both were on the table: _"Mine documents a cross-file
dependency; yours deletes it."_**

✅ **This is the general counter to "write it down" as a remedy, and it applies to most of the
documents this programme produced today: a note explaining a hazard leaves the hazard in place and
transfers responsibility for it to whoever reads the note. Sometimes that is all that is available.
It is never the better option when the hazard can simply be removed.**

---

## 11 · A FINDING IS A CLAIM, AND IT ARRIVES WITH THE AUTHORITY OF HAVING BEEN FOUND.

🔴 **This is the capstone, and it indicts the whole practice the rest of this document recommends.**

**Everything above asks people to check things and report what they find. But:**

> **A FINDING IS A CLAIM. It inherits every failure mode a claim has — wrong width, wrong tree,
> wrong reason, a figure that rotted — AND IT ARRIVES WITH THE AUTHORITY OF HAVING BEEN FOUND.**

⚠️ **A finding is the one kind of statement nobody audits, because the work of finding it reads as
the work of checking it.** ✅ **The reviewer has already done something effortful; the reader assumes
the effort went where it needed to.**

**MEASURED ON 2026-09-12, and this is the whole argument:**

    a reviewer's five errors     every one was a FINDING it had handed somebody else to act on
    a lane's four                same
    a sixth                      a finding about ANOTHER chat's guard, written wider than its
                                 evidence, and acted on before it was measured
    two chats sent to repair     work already done on another branch, on a finding that was true
                                 of the finder's tree and false of the line

🔴 **AND THE MOST EXPENSIVE ONE WAS A FINDING THAT DID NOT EXIST AT ALL.** A path-separator defect
was reported with measurements, independently reproduced by a second party, and believed — until
somebody opened the file. Both had measured a REPLICA written from the description. One instrument,
run twice, agreeing with itself.

✅ **SO A FINDING GETS THE SAME TREATMENT AS ANY OTHER CLAIM:**

    name the TREE it was measured on         a finding true of one branch is false of another,
                                             and three "still outstanding" reports in one day were
                                             each true of the reporter's own tree
    say what would have made it DIFFER       before calling a second measurement corroboration
    open the artefact, not a description     a replica of the thing is not the thing
    and when it is in your favour, audit it  a figure that flatters its own conclusion is
                                             unaudited by construction, because checking it buys
                                             the author nothing

⚠️ **Nobody in this programme found their own errors. Every single one was found by somebody else.**
🔴 **That is not a moral failing and it is not fixable by trying harder. It is the argument for the
adversarial read, and for the rule that the chat which did the work does not certify it.**

---

## 12 · NAME THE FORBIDDEN THING. NEVER SPELL IT.

🔴 **A TEXT SCANNER CANNOT TELL USING SOMETHING FROM TALKING ABOUT IT.** ⚠️ **And the habit that
trips it is the habit that makes this project's mistakes traceable at all: the better the comment,
the more likely it NAMES the thing it is warning about.**

**Three guards, one night, one participant — all three false reds on correct work:**

    the control-character check   a comment DESCRIBING invisible bytes contained them. Twice:
                                  once in the assertion, once in the comment explaining it.
    the type-floor ratchet        a stylesheet comment saying "this file uses NEITHER of the two
                                  sub-floor tokens" added two occurrences to the count.
    the protected-work hook       a COMMIT MESSAGE explaining which command the hook declines
                                  contained that command, and the commit was refused.

🔴 **THE SECOND WAS NOT MERELY NOISE. `+2` in that file reads exactly as two new sub-floor
declarations, and anybody chasing it opens a stylesheet whose entire point is that it has none.**
**That is a wrong answer that looks like a right one, which is worse than an unhelpful one.**

✅ **THE RULE, and it is a writing rule rather than a tooling one:**

> **NAME the forbidden thing. Never SPELL it. "A word-boundary escape", not one typed out. "The two
> smallest token names", not the names.**

⚠️ **This project already applies exactly that discipline for a different reason — a note retiring a
superseded phrase must not QUOTE it, or a search for the old wording returns the note explaining it
is gone instead of the sites still carrying it.** ✅ **Same rule, two reasons. Stated once here so it
stops being rediscovered per guard.**

### ⚠️ AND WHERE A GUARD GENUINELY CANNOT TELL, ITS RED SHOULD SAY SO

**One line in the failure message:**

> _"this may be prose rather than code — check whether the match is inside a comment before treating
> it as a defect"_

🔴 **On 2026-09-12 that sentence would have saved three people twenty minutes each, hunting a defect
that was a sentence.** ✅ **It costs nothing and it is the difference between a guard that teaches and
one that merely stops you.**

### 🔴 AND TWO OF THE THREE MUST NOT BE NARROWED — a decision, recorded so nobody "fixes" it

**Only the type-floor ratchet may strip comments before counting, because it counts DECLARATIONS and
a mention in a CSS comment is never one.**

    the control-character check   🔴 DO NOT NARROW. A stray control byte in a COMMENT is still
                                  corruption — invisible in review, surviving lint, typecheck and
                                  Prettier. It caught the same author twice and was right twice.
    the protected-work hook       🔴 DO NOT NARROW. A dangerous command quoted inside a longer
                                  string is still a dangerous command.

⚠️ **Narrowing either would trade a real protection for an author's convenience.** ✅ **The author who
hit all three proposed keeping both, in those words: _"I would rather reword than be protected
less."_**

---

## 13 · THE SHAPE UNDERNEATH ALL OF IT

    an unanswered routing      reads as an approved one
    an empty capture           reads as a clean result
    a crashed run              reads as a passing one
    a truncated read           reads as a complete list
    a walk over the wrong      reads as a clean walk
      directory
    a true sentence in the     reads as evidence — and every word survives checking
      wrong slot

🔴 **In every member, THE FAULT LEAVES NO ARTEFACT.** ⚠️ **There is nothing to find, which is why
review does not catch them and why each one has to be defended against structurally rather than
carefully.**

✅ **The single practice that caught every instance listed in this document: RUN THE THING AND READ
WHAT IT PRINTS.** 🔴 **Not the source, not the exit code, not the summary somebody wrote about it.**
