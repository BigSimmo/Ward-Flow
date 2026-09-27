# Ward Builder Two — the complete record, 2026-09-08 to 2026-09-10

**Session `ward-builder-two-62`.** Worktree `D:/Worktrees/Database/ward-refusals-visible`, branch
`ward/reword-arms-20260909`. Written at the owner's request so the work, and the understanding
behind it, survive the session that produced them.

> ⚠️ **Every number here was measured, and the ones that were not are labelled.** The habit this
> record exists to preserve is that distinction, not the results.

---

## 1. What the job was

An audit recorded that 95 ward guards across 22 test files had been converted to be
"reword-tolerant" — so rephrasing a sentence on screen would not redden a test that is not about
the wording. Roughly seven had ever had that tolerance exercised. The brief:

> **A guard that has never been shown to go red is indistinguishable from one that does not work.**

The method: reword the real sentence on the real screen, run the guard, it must stay GREEN. Then
break the guard's real subject and prove it goes RED. Restore, and prove the restore.

## 2. What was found

    range 1 (16 files)   57 sites   47 defective (82%)
    range 2 (statistics)  57 sites   31 defective (54%)

**Four findings in the statistics range are clinical claims rather than test-quality ones:**

1. **A screen promising it never substitutes a ward could announce that it does.** `["falls back",
"fall back"]` names the SUBJECT of a refusal, so the sentence carries it in either direction.
   _"This page falls back to the nearest other ward, because a page showing the wrong ward under the
   right heading is **better** than a page showing nothing"_ — **no guard fired at all.** The ED
   screen carried identical wording and the identical hole.
2. **A lifetime maximum the record cannot express.** The refused-so-far note could be reversed to
   _"that is the total number of wards it may ever be put to"_ — **66/66 GREEN.** That is the claim
   which once described a patient refused by six wards as having been put to three.
3. **A guarantee the model does not give.** _"the model enforces that strictly"_ passed **66/66**,
   reinstating the unearned invariant the paragraph was rewritten to remove.
4. **Three of four refusal screens could publish the figure they refuse** — see §4.

**And in range 1**, a guard that BLESSED the reversal of its own clinical caveat (37/37 green on a
false claim about who is under a team's care); an absence rendered as a fabricated duration; and a
guard that was a **tautology over its own locator** and could not fail at all.

## 3. 🔴 The one sentence, if the rest is lost

> **A guard is a QUERY plus a PREDICATE, and an arm that only edits text exercises only the
> PREDICATE.**

Three separate defects in one range were the guard's REACH, not its wording, and all three read
perfectly in review. ⚠️ **This was already written down on 2026-09-05, mid-cell in a wide table, and
two builders re-derived it independently five days later without noticing.** The defect was the
placement. **A finding that is recorded but not promoted gets paid for again, and the second payment
looks like discovery.**

## 4. The arm neither method could see

Passed from Ward Builder Four: **leave the refusal exactly as written and publish the refused figure
beside it.** A reword arm passes — the refusal still says what it said. A break arm has nothing to
delete.

    "Empty beds that were not offered"      + "4 beds were offered and refused"        RED
    "publishes no referral-to-bed duration" + "Referral to bed took 3.2 days"        GREEN
    "cannot be measured here"               + "Beds took 41 minutes"                 GREEN
    "withheld pending an owner ruling"      + "Northam declined 7; Bunbury 4"        GREEN

**The one that caught it reads the ARTICLE; the three that missed it read the PARAGRAPH.**

## 5. The defect classes

| class                      | what it looks like                                                      |
| -------------------------- | ----------------------------------------------------------------------- |
| **polarity-blind**         | the spelling names the SUBJECT of a refusal, so the reversal keeps it   |
| **bystander**              | the spelling lives in a neighbouring sentence that survives the break   |
| **narrow query**           | a ban or numeral guard reads one element; the claim returns in the next |
| **dead alternate**         | a listed spelling a sibling test forbids from ever rendering            |
| **OR over a required set** | one member vouches for the set — four journey legs, two distinct claims |
| **inverted predicate**     | a topic word is equally present in the sentence that DENIES it          |

## 6. 🔴 Question substitution — nine probes, one defect

Nine instruments across four chats returned a confident answer to a question they could not answer.
They are not nine lessons:

> **THE INSTRUMENT ANSWERS THE ADJACENT QUESTION, AND THE ANSWER ARRIVES IN THE RIGHT SHAPE** —
> correct, well-formed, and about something else. **The rigour of the method is what makes the wrong
> answer persuasive.**

- `git log -S` answers _"which commit introduced this text"_; read as _"has this landed"_. **Twice.**
- A grep answered _"does any test read this board"_; read as _"did my fix land"_.
- A plant in a screen the test never renders answered _"does this redden the suite"_; read as _"does
  the ban reach here"_.
- A near-miss paraphrase of a banned phrase — _"have not **been** collected"_ against a ban on _"not
  yet collected"_ — **could not fire**, and its silence was committed as a measured hole.

⚠️ **The fix is NOT "ask the right question", because nobody knows they asked the wrong one.**

> **It is the CONTROL: point the instrument at a case whose answer you already know, and refuse to
> report until it comes back right.**

That is `scripts/ward-flow/folded.sh`, which **refuses to answer at all** until a known-folded commit
comes back folded. **A checker that cannot say YES cannot be trusted when it says NO.**

⚠️ **Apply it to REASSURING claims hardest.** A warning that the backups might be compromised
resolved safe on measurement — but the check was worth running precisely because nobody would want
that one to be wrong. **A relayed claim that resolves in your favour is the one least likely to be
re-checked.**

## 7. What was built

| artefact                                 | what it does                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/ward-ban-scope.test.ts`           | refuses any ban that reads narrower than a page or screen root. **Keyed on the ASSIGNMENT, never the variable name** — ten of eleven sites already bind to a variable called `page`, so a name-keyed check could never fail for its own reason. Floor is RELATIVE (`parsed === found`), which caught a twelfth call site on its first run: **this file's own source, scanning itself.** |
| `tests/helpers/ward-invented-figures.ts` | the owner's ruling as a predicate — provenance belongs to the ITEM, never the heading, because **a heading is context and context does not travel with the sentence.** Full CLAIMS, not topic words, so a negation cannot contain one.                                                                                                                                                  |
| `tests/ward-invented-figures.test.ts`    | the corpus that caught the inverted version, kept as the guard's own guard                                                                                                                                                                                                                                                                                                              |
| `scripts/ward-flow/folded.sh`            | three verdicts, never two; no `--skip-control`; prints what the ref RESOLVED to                                                                                                                                                                                                                                                                                                         |

## 8. What I got wrong, and why it is in the record

1. **I told two chats no two of us touched the same component**, and used it to justify a work
   split. **False**, and never checked in the direction that mattered.
2. **I implemented the owner's ruling with an INVERTED predicate** — measured on my own code:
   **7 of 8 defects admitted, all four negations, AND 3 of 9 honest items reddened.** Wrong in both
   directions at once, which is the shape that makes a guard feel principled while protecting
   nothing.
3. **I measured a predicate and called it a guard — twice**, the second time with the first written
   up as a titled lesson in my own report. **Knowing a trap by name does not stop you walking into
   it.**
4. **I published a finding on a probe that could not fire**, found only because the fix did not
   change its result.
5. **I wrote a warning about one-signal-two-states and shipped one**: `ls node_modules/.bin | wc -l`
   returns 0 for _broken_ and for _never installed on purpose_, which need opposite responses.
6. **A correction I wrote did not sweep the class it named**, leaving a fourth ban unfixed in a
   range I had already reported complete.

> **The self-corrections are why the rest is trustworthy.** A record with no retractions in it is a
> record nobody checked.

## 9. Tooling — a green gate that was evidence about npm

`npm run format` printed _"'prettier' is not recognized"_ and **exited 0, zero files changed.** Zero
files reads as _"the tree was already clean"_. **95 files were unformatted.**

**Cause:** `node_modules/.package-lock.json` — npm's own record of the installed tree — was missing,
so the install never finished its bookkeeping. **Packages all present and correct; only `.bin`
absent**, which makes every tool unrunnable BY NAME and perfectly runnable BY PATH. ⚠️ **That is why
it hides: the tools you would reach for to check are the ones that still work.**

    [ -d node_modules ] || echo "NEVER INSTALLED — not this fault; do not repair"
    ls node_modules/.bin 2>/dev/null | wc -l      # 0 = no npm-script binary ran, whatever npm said

**Repair, non-destructive:** `npm rebuild` then `npm install`. ⚠️ **Not `npm ci`** — it deletes
`node_modules` first and has crashed on this machine, which is plausibly the original cause.

⚠️ **The family is three surfaces:** a wrapper's exit status, a background-task _"completed (exit
code 0)"_ notification, and a zero-change count are all _"the run went fine"_ signals that survive
the run not happening. **And its pair, from Ward Builder Four: a tool lying and a person forgetting
are indistinguishable from outside. RE-CHECK THE ARTEFACT, NEVER TRUST THE RUN.**

### 🔴 A hazard I NAMED and did not SWEEP — added after the fold, because it is the sharpest instance

Before the whole-tree format landed I checked `tests/ward-ban-scope.test.ts`, **which parses test
source as TEXT and would break if prettier rewrapped a line**, and reported it green. It was green.

**Ten other guards were not.** Byte-for-byte mockup checks — HTML compared letter-for-letter against
a stylesheet — reflowed differently as HTML and as CSS, and went red on the fold. Restored, and the
directory added to `.prettierignore`.

> **I identified the class, proved ONE instance safe, and reported the instance. Nobody enumerated
> the rest, and my report read as though somebody had.**

⚠️ **A hazard identified is not a hazard swept**, and a green instance from inside a named class is
the most persuasive possible way to under-report it: **the check was real, the result was true, and
the sentence covered more than the evidence.** It is the same defect as measuring a predicate and
calling it a guard, one level up — **measuring an INSTANCE and calling it the CLASS.**

🔴 **AND THE REMEDY I ATTACHED TO THIS CORRECTION WAS ITSELF UNTESTED, WHICH IS THE SAME DEFECT AGAIN.** I wrote that one extra command — _list every guard that reads source as text_ — would have kept the ten out of the fold. **Ward Lead measured it and it does not hold. Re-measured here:**

    grep -l readFileSync tests/*.test.ts*            391 files
    of those, also doing an exact comparison        382 files
    narrowed further to files reading HTML or CSS    94 files

**Both broken files are in every one of those sets — inside a haystack of 94 to 391**, nearly all of which read JSON, run scripts or check paths and are untouched by a reformat. **The class is not cheaply enumerable by grep.**

> **The real remedy is SEQUENCING, not a cleverer search: run the full suite AFTER a whole-tree reformat and BEFORE folding it.** That is what actually caught the ten, within the hour.

⚠️ **A correction that arrives with an untested remedy attached is the shape it is correcting.** I under-reported a class, was corrected, and shipped the correction with a fix nobody had run. **The standard I asked to be held to applies to the repair as much as to the finding.**

## 10. State at hand-over

**Everything is folded**, verified with `folded.sh` and its control passing. **179 tests green**
across the seven guard-bearing files. Tree clean. Nothing pushed, ever.

**All eleven bans in both ranges read `document.body` or a screen root — none element-scoped**,
confirmed from the tree rather than from commit messages.

## 11. 🔴 Unfinished and UNOWNED — not inherited as done

- **The liveness gap.** The provenance guard does not govern _"Live, reconciled"_ over invented
  figures. **Pinned as a passing test so it cannot be cited as covered.** A mockup already ships it.
- **Three residuals** — a colon, an "and", a comma — **shared with an independent implementation.**
  **A residual shared by two independent implementations is a property of the approach, not a bug in
  either.** Documented, deliberately not chased.
- **`D:/Repos/Database` has the broken tooling.** Three chats independently declined to repair
  another tree unasked. **Nobody owns it.**
- **58 test files named in dated plans were never written.**
- **A class of wrong paths inside source and test code** that the citation checker cannot see **by
  construction**.
- **Two Playwright failures in `ui-ward-referrals.spec.ts`** — queued-board columns off-screen at
  641px, and a stale-fixture disagreement. The column ruling approved the columns and said nothing
  about reachability at narrow widths; that reads like an owner question.

## 12. Beliefs, labelled

- The number-word list in the provenance guard is complete enough. **Believed, not measured** —
  ordinals, fractions and _couple/several_ are not covered.
- `RETRACTED` does not redden honest copy. **True of the corpus; the real footnotes of every ward
  screen were not swept.**
- The tooling repair holds across a reboot. **Verified this session only.**
