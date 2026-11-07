---
name: restoring-a-mutated-file
description: "the restore proof sits downstream of the damage — a destroyed fixture passes the control, and every obvious restore route is blocked or lies"
metadata:
  type: feedback
---

**Consolidated 2026-09-06 from 7 separate memories on one subject**, written from different chairs across a night of six parallel sessions.

⚠️ **Nothing is summarised — each section below is its original entry verbatim.** The merge exists because the index
that points at these has a hard size limit: 7 index lines for one subject crowd out 6 unrelated
memories, which then do not load at all. The only thing given up is recalling one of these without the others.

---

# restoring-a-mutated-file

> Mutation testing needs an exact restore — the two obvious routes are blocked or unreliable, and the obvious verification is weaker than it looks

2026-08-30, Ward Flow worktrees. Mutation testing only means something if the file goes back
**exactly**. Two sessions independently discovered that the obvious ways to do that are not available.

- `git checkout` with a path is refused by the protected-work hook.
- Redirecting `git show HEAD:<path>` into the file is refused **situationally** by the auto-mode
  classifier — it worked for one session and was refused for another the same night. That is worse
  than a consistent refusal: you plan around a route you have tested, then discover the gap mid-task
  with a mutated file sitting on disk.

**The reliable route: reverse the exact edit you made, and verify with `git hash-object` against a
baseline captured BEFORE mutating.**

```bash
BASE=$(git hash-object path/to/file)      # capture first
# mutate, run, observe the predicted failure
# reverse the exact edit
git hash-object path/to/file              # must equal $BASE
```

**Why the hash rather than an empty `git diff`.** A clean diff says the file matches HEAD, which is a
different claim from "my restore was exact" — and it is equally satisfied by a file that was never
properly mutated in the first place. **The weaker check looks identical to the stronger one and never
fails.** Same shape as everything in [[checks-that-cannot-fail]]: verify the property, not a proxy.

## The protection hook blocks writing ABOUT these commands

Documented and deliberate: it matches command text and cannot tell an operation from a description of
one, so a note quoting a delete or restore command is refused exactly as running one is. The
prescribed remedy is to author such files with the Write tool — data-carrying tools are exempt by
design. This memory was written that way after a heredoc containing the commands above was refused.
Do not weaken the hook; the detour is the intended cost.

Related: [[checks-that-cannot-fail]], [[protected-work-and-backups]], [[gate-wrappers-mask-exit-codes]].

## A mutation that never applied reports as a pass, and the pass is the only thing you see

2026-08-31, three variants in one session, two of them mine.

- **Anchor matched nothing.** A python edit script asserted its anchor and aborted before writing.
  The subsequent test run reported **"passed 2, failed 0"** — a green describing an _unmutated_
  file. Twice, both times because Prettier had reformatted the line I was anchoring on.
- **Anchor matched more than one place.** A peer reports the harness **refuses** it, and the run
  then passes for the same empty reason.
- **Restore discarded the change under test.** `git show HEAD:<path> > <path>` restored the merge
  commit's version — correct, clean, and not what I wanted, because the fix being proven was still
  uncommitted. The restore did exactly what it was asked.

**The rule: a refused or unapplied mutation is a NON-RUN, never a pass — and the run cannot tell
you which it was.** Green after a mutation means one of two opposite things: the guard is weak, or
the mutation never happened. Same colour, same exit code.

**So verify application against the FILE, never the run.** `grep` the mutated line and read it back
before believing any result. And commit before mutating, so the restore has something correct to
restore to.

**The tell that nearly fooled me twice:** the abort message and the test output arrive in the same
block, and the green is larger and lower down. A failure that scrolls past above a success reads as
a success — this is the same shape as `83 passed (83)` when 84 files went in, and as a `&&` chain
dying at step 3 of 7 and printing what looks like a finished report.

Related: [[checks-that-cannot-fail]], [[read-the-failure-message]],
[[gate-wrappers-mask-exit-codes]], [[the-suite-never-tests-the-absence]].

## 🔴 `git checkout HEAD --` ON A FILE CARRYING UNCOMMITTED WORK IS NOT A RESTORE — 2026-09-03

**A chat mutated a file to prove a test, then restored with `git checkout HEAD -- <file>`. The
FEATURE ITSELF WAS UNCOMMITTED.** ⚠️ **So the command did not undo the mutation — it undid the
entire change.**

**The next two mutations then ran against a file with the feature already gone: one reported a RED
that was its own deleted work, and one reported a GREEN from a file that no longer had anything to
guard. Both would have been reported as evidence.**

**It was caught because the second result contradicted something just watched passing — not by
checking.**

⚠️ **RULE: before mutating a file that carries uncommitted work, COPY IT, and restore from the copy.**
`git checkout HEAD --` restores to HEAD, and HEAD is a different thing from "the file a moment ago"
whenever anything is uncommitted — which, during a build, is always.

## ⚠️ A NON-GLOBAL SUBSTITUTION SILENTLY PREFERS A COMMENT — and good comments make it worse

Same session. `perl -0pi -e 's/No ward implied/Nothing here/'` — **no `/g`** — hit the FIRST
occurrence, **which was in the doc comment the author had just written ABOUT the empty state, not in
the JSX.**

**The mutation "applied". The suite went green. And a green from an applied mutation reads exactly
like a test that does not guard.**

⚠️ **THE GENERALISATION IS THE PART WORTH KEEPING, AND IT IS PERVERSE: THE BETTER YOUR DOC COMMENT,
THE MORE LIKELY IT CONTAINS THE EXACT STRING YOU ARE TRYING TO MUTATE.** **Writing a good comment
about a value makes that value HARDER TO MUTATE CORRECTLY.** In a codebase that comments heavily —
this one — the first textual occurrence of any meaningful string is very often prose.

**Target the code construct, not the string: the full JSX element, the whole declaration, or an
anchored pattern. And print the mutated lines before reading the result.**

**Both of these produced a PLAUSIBLE RESULT rather than an error. Neither announced itself.** That is
the family: [[a-green-mutation-only-counts-if-the-mutant-ran]],
[[green-mutation-that-changed-nothing]].

⚠️ **AND A COMMIT MADE WHILE A MUTATION AGENT IS RUNNING CAN CAPTURE THE MUTANT — SILENTLY.**
2026-09-04. A subagent was running three mutations, two of which deliberately break a committed
stylesheet before restoring it from the committed blob. Had I committed the unrelated files sitting
in the same tree during that window, the mutant would have gone in as an ordinary staged file.

**The failure has no symptom, and the reason is that the agent's own check is correct:**

    agent restores by:   git show HEAD:<path> > <path>     then verifies hash-object == rev-parse HEAD:<path>
    if I commit first:   HEAD now CONTAINS the mutant
    -> the restore "succeeds", the hashes match, the guard goes green, and the mutant is the baseline

**The reference moved underneath a check that was right.** Nothing reports it: the mutation is a
plausible one-line deletion, the agent reports success truthfully, and the tree is clean afterwards.

**How to apply:** while any mutation-testing agent is live, the working tree is an unreliable commit
source and **nothing announces when that window is open**. Before staging anything, verify
`git hash-object <path>` against `git rev-parse HEAD:<path>` for every file that agent might mutate
— not only the files you are committing. Restore-by-blob protects the agent's own file; this
protects everyone else's commit.

Related: [[verify-in-head-not-the-working-tree]], [[controller-staging-claims-subagent-work]],
[[a-baseline-from-the-subject-vouches-for-it]].

---

## 🔴 THE RESTORE MUST BE IN A `finally` — A CRASHED HARNESS LEAVES THE LIE BEHIND (2026-09-04)

**Every other mutation lesson is about a mutant that could not be detected. This one is about a
mutant that never gets removed.**

A peer's mutation driver **crashed after writing the mutant**: on Windows, Node decoded vitest's
UTF-8 output as cp1252 and the captured stream came back empty. **The restore ran only because it
happened to sit in a `finally`.**

⚠️ **The crash is precisely the case where a person assumes the run never got that far** — the output
is empty, so it reads as "nothing happened". **And a deliberate falsehood left in a shared worktree
is picked up by another session's pre-commit hook**, which inspects the whole tree here.

**My own run the same night had no `finally`:** mutate + hash-check, run tests, restore + verify —
three separate shell calls. Had the middle one died, a false `return 999;` would have sat in a
worktree other sessions can commit from. Nothing happened because the restore was verified
afterwards, **but the window was never designed out, and I had already recommended the habit to four
other sessions without this clause.**

**How to apply.** Wrap mutate/run/restore so the restore cannot be skipped, then **check the tree
afterwards rather than assuming** — `git status --porcelain` plus a hash comparison, not a mental
model of how far the run got. **A mutation habit without this is worse on a bad night than no
mutation habit**, because it converts a diagnostic into a planted defect.

**Second clause, same source: watch WHICH assertion goes red, not merely that one did.** Two reds
for one cause is not a stronger signal — it hides which half moved, and it is how an assertion that
is not mapped to the site its name claims stays hidden. Related: [[which-assertion-went-red]],
[[checks-that-cannot-fail]].

⚠️ **AND IT HAPPENED, TO A PEER, ON AN UNTRACKED FILE — THE SAME NIGHT I GAVE THE ADVICE WITHOUT THIS
CLAUSE.** Their harness crashed on the cp1252 decode after writing the mutant. **The file was minutes
old and untracked, so there was nothing for `git checkout --` to restore FROM.** Recovery was
reversing the edit by hand, which is only possible if you know an edit is there. They found it by
running `git status` on reflex.

🔴 **THE PART THAT INDICTS ME: THIS VERY FILE ALREADY SAID `git checkout --` DOES NOTHING TO AN
UNTRACKED FILE, AND I STILL RECOMMENDED A MUTATION HABIT TO FOUR SESSIONS WITHOUT IT.** The knowledge
was written down, retrievable, and did not reach the advice. **A lesson recorded is not a lesson
applied** — and my own run was covered only by which file I happened to pick, since it was tracked.

**What the note was missing was the correlation, not the mechanism:** _a new file is exactly what you
mutate when you have just written a guard._ The exposure is not spread evenly — **it concentrates on
precisely the case the habit exists for.**

**So: commit an untracked target BEFORE mutating it, or accept that the only restore path is the one
inside your own script.**

**And the progression, which is one idea rather than three findings:** a guard that **cannot fail**;
a harness that **erases its own evidence**; a harness that **erases the evidence AND the recovery
route**. Each strictly worse than the last; only the first is ever on anybody's list.

⚠️ **2026-09-04, THE WINDOW IS REAL AND IT OPENED.** A mutation driver written without a
`try/finally` raised AFTER writing the mutant — Windows decoded vitest's UTF-8 output as cp1252 and
Python threw — leaving a deliberate falsehood in the tree. **The target file was UNTRACKED**, minutes
old, so the usual path-scoped restore command had nothing to restore FROM: the only recovery was
reversing the edit by hand, which requires knowing it is there at all. Found by running `git status`
on reflex — luck, not method, and a reflex does not survive a tired session or transfer to whoever
works on this next.

**Three rules, and the third is the one nobody applies:**

1. **Restore in a `finally`.** Necessary, not sufficient — it closes the interpreter-raises window
   and does nothing for a killed process, a stalled machine, or a checkout that vanishes underneath.
2. **Verify the restore by CONTENT afterwards** — hash the file and compare with the pre-mutation
   hash. Not "the `finally` ran", not "the tests passed".
3. **Before mutating an UNTRACKED file, commit it first.** Every discussion of this assumes version
   control is the backstop; for a new file it is not — **and a new file is exactly what you mutate
   when you have just written a guard, so the exposure concentrates on the very case the habit
   exists for.**

**Three failure shapes, and this is the worst:** a guard that cannot fail hides a defect; a harness
that dies mid-run erases its own evidence; **this one erases the evidence AND the recovery route at
once.** A peer had rule 3 recorded in their own notes from an earlier session and still omitted it
when advising four chats — **a lesson written down is not a lesson applied.**

⚠️ **A SEPARATE, SMALLER LESSON FROM WRITING THIS ENTRY:** the protective hook on this machine
refused the command three times because the PROSE contained a destructive git incantation as an
example. Nothing was being deleted. **The right response is to reword the text, never to reach for
the override** — an override used on an obvious non-case is how the habit of overriding is built.

## A probe must assert the fixture is still the fixture — 2026-09-06

Two self-inflicted faults in one hour, both in restore mechanics rather than in the work.

**1. I lost an entire uncommitted fix.** Ran a control by mutating the guard, then restored _guard
and fixture together_ from HEAD — taking my own unfinished fix with them. The rule was already in
this store (**commit before you mutate**) and I broke it the same night I quoted it to somebody
else. Cost: re-applying every edit from context.

🔴 **2. I DESTROYED THE FIXTURE AND THE CONTROL STILL PASSED.**

    io.open(F, 'w').write(io.open(F).read() + probe)     # WRONG

**Python opens for writing — truncating the file — before evaluating the argument**, so the inner
read returns an empty string. The fixture went from 87 lines to 2: the probe, and nothing else.
Correct form is `s = open(F).read()` **into a variable first**, then open for write.

⚠️ **The control went red exactly as designed. A file containing ONLY the planted violation gives
the same verdict as an intact file containing it, so the control passed while testing almost
nothing** — no realistic surroundings, no other declarations, none of the conditions I was claiming
to have tested. **No assertion could have caught this**, because the assertion was about the
violation, not about the fixture.

**The only thing that disagreed with me was a NUMBER I already knew:** the failure named line 2 for
something appended to an 87-line file. ⚠️ **And my first instinct was to hunt for a bug in the
guard's line arithmetic — which was perfectly correct.** A self-inflicted fault presents as a defect
in the thing under test, and that is the direction that wastes the most time.

**How to apply: assert an invariant of the FIXTURE inside the probe, before running the gate** — a
line count, a byte size, a hash, the presence of some untouched landmark. Cheap, and it is the only
thing standing between "the gate caught my violation" and "the gate caught the only thing left in
the file". Related: [[a-green-mutation-only-counts-if-the-mutant-ran]],
[[verify-in-head-not-the-working-tree]], [[read-the-failure-message]].

---

# a-destroyed-fixture-passes-the-control

> A control that destroyed its own fixture still went red; a wrecked input and a caught violation look identical from the verdict alone

Ward Verifier, 2026-09-06, planting a violation into a CSS fixture:

    io.open(F,'w').write(io.open(F).read() + probe)

Python opens for writing — **truncating the file** — before evaluating the read. The fixture
went from 87 lines to 2: the planted violation and nothing else. **The guard went red exactly
as predicted**, because a file containing only the violation yields the same verdict as an
intact file containing it. **The control passed while testing almost nothing.**

⚠️ **The tell was a line number, not a failure.** It reported `ward-chip.module.css:2` for
something appended to an 87-line file. The first instinct was to hunt a bug in the guard's line
arithmetic — the arithmetic was right and the file was wrong. **Had the guard not printed a
line number, nothing in the run would have disagreed.**

**Why:** every mutation-testing safeguard we have checks whether the gate _reacted_. None
checks whether the **input still existed**. A red from a wrecked fixture and a red from a real
catch are the same red.

**How to apply:**

- **A probe must assert the fixture is still the fixture** — line count, byte size, or a hash of
  the untouched region — checked _before_ the gate runs, in the same script.
- Read incidental detail in a red (line numbers, file sizes, counts) as evidence about the
  _setup_, not only about the subject. A number that cannot be right is the cheapest signal.
- Related: commit before mutating. The same session lost an uncommitted fix by restoring the
  guard and the fixture from `HEAD` together — see [[restoring-a-mutated-file]].

Sibling of [[a-green-mutation-only-counts-if-the-mutant-ran]] and
[[green-mutation-that-changed-nothing]]: those are mutants that never executed. **This is the
mirror — the mutant executed, and the thing it was supposed to be hiding inside was gone.**

---

# a-restore-that-matches-proves-nothing

> \"restored, hash matches\" sits downstream of the damage — what clears a mutation control is a red carrying pre-existing content, and my own floor failed that test

**A hash-matching restore cannot clear a mutation control, because the restore proof sits DOWNSTREAM
of the damage.** Truncate a fixture, plant the mutation, get exactly the red you predicted, restore
from the captured bytes — and the hash matches perfectly. On Ward Flow a session destroyed an 87-line
fixture down to 2 lines, got the predicted red, and its restore reported OK.

**What positively clears a control is a property of the RED: it must carry a number or name derived
from PRE-EXISTING content.** A red that quotes a seeded ward id, a discovered filename, or a
population count could not have come from a destroyed file. A red that says only _"expected false to
be true"_ or _"expected 0 to be greater than 0"_ is safe by mechanism, not by evidence — a weaker
claim, and it should be held as one.

**2026-09-06 — my own anti-vacuity floor failed this, and a colleague had just credited it as passing.**
The floor asserted _at least one ward shows a non-zero sex mix_. Its red was `expected 0 to be greater
than 0`. **An emptied fixture produces that identical red**, so it could not distinguish "the screen
reads a key the model does not use" from "there was nothing to read" — and it fired first, so the
seed-derived equality below it never spoke. **A peer's assessment in my favour was the least-audited
message I received, and re-running it was what settled it.**

**The fix generalises: a floor must say what it WALKED, not only what it FOUND.** The message became
`0 of 23 wards report a non-zero sex mix` — the 23 is a seed fact, so the red is a statement about the
code. `0 of 0` is a statement about the fixture, a different problem, and needs its own separate
assertion (`population > 10`) because the pattern catching the code defect passes silently on a
destroyed board. **Two failure modes, two assertions, deliberately not merged.**

**How to apply:** after any mutation control, read the red you actually got and ask _could a destroyed
or empty input have produced this exact message?_ If yes, the control is unproven regardless of the
restore. Put the population, an id, or a discovered name into the failure message. And in this repo
use `scripts/ward-flow/mutation-run.mjs` rather than hand-rolling — it captures bytes before writing,
restores in a `finally`, refuses an untracked target and refuses a find-string that does not match
exactly once. Related: [[a-green-mutation-only-counts-if-the-mutant-ran]],
[[floor-the-denominator-never-the-numerator]], [[a-correction-that-agrees-with-you]].

---

# restore-proof-sits-downstream-of-the-damage

> Restored, hash matches" cannot clear a mutation control — the proof is downstream of the damage and passes on a destroyed fixture

**Truncate the fixture → plant the violation → gate goes red → restore from `HEAD` → the hash
matches perfectly.** Every step reports success. The restore proof is **structurally incapable**
of seeing that the file was destroyed before the gate ran, because it compares the _restored_
file to `HEAD`, not the _mutated_ file to what it should have been.

So `"restored to a matching hash each time"` — which is what four chats reported all night —
clears nothing. Ward Verifier, 2026-09-06, auditing its own controls after truncating an
87-line fixture to 2 lines and getting the predicted red.

**What DOES clear a control, and it is a property of the red, not of the restore:**

> **A red carrying a number or name derived from PRE-EXISTING content cannot have come from a
> destroyed file.** "ward-tokens.module.css: 7 uses, ceiling 6" (6 baseline + 1 planted) proves
> the baseline was there. "line 88 of an 88-line file" proves the file was 88 lines. A red
> saying only _"a violation was found"_ proves nothing about the input.

**Write mechanisms:** safe are `sed -i` (temp file + rename), JS
`writeFileSync(f, readFileSync(f) + x)` (arguments evaluate before the call), and Python
read-into-a-variable-then-write. **Unsafe is exactly one form:**
`open(f,"w").write(open(f).read() + x)` — the `"w"` truncates before the read is evaluated.

**How to apply:**

- Prefer **structural immunity over a rule**: capture the original bytes into a variable before
  any write, restore from that capture in a `finally`, never from `HEAD` (restoring from `HEAD`
  also silently discards uncommitted work — see [[restoring-a-mutated-file]]).
- When judging someone's control — or your own from an hour ago — ask what the red **said**, not
  whether the restore passed.
- Sibling of [[a-destroyed-fixture-passes-the-control]] (the incident) and
  [[a-green-mutation-only-counts-if-the-mutant-ran]] (the mirror case).

⚠️ **And the meta-finding: a safeguard nobody invokes and a safeguard nobody knows they depend
on fail the same way.** A structurally-immune mutation harness had been committed here since
2026-09-04, wired to nothing, while four sessions hand-rolled the same job — the same week
Prettier turned out to be silently holding up two guards. See
[[a-clean-result-held-up-by-another-gate]].

---

# a-failed-restore-contaminates-later-mutants

> A mutation harness whose restore throws leaves the NEXT mutants running against mutated source — their greens and their reds are both worthless

2026-09-05. Running six mutations in a `for` loop. Mutant 4's `to` was the empty string (it deleted a
line), so on restore the harness searched for `""`: `s.split("").length - 1` counted **21646** — every
character — the uniqueness check threw, and **the restore never ran**.

The loop carried on. **Mutants 5 and 6 executed against a still-mutated file.** Both went red, but
four tests red rather than one, and I could not tell which reds were theirs.

**Why this is worse than an ordinary harness bug.** A mutation run is where you _expect_ red, so a
contaminated run does not look wrong — it looks like a mutation with wide blast radius. And the
danger runs both ways: had mutant 4 removed something the later mutants needed, they would have gone
**green** and I would have recorded two guards as unfalsifiable that are fine.

**How to apply.**

- **Print the file hash before and after every apply AND every restore, and say CHANGED or
  UNCHANGED.** That is what caught this — nothing else would have.
- **Refuse an empty search string outright.** An empty needle makes the count meaningless in exactly
  the direction that reads as "not found".
- **Re-establish a clean baseline between mutants, or after any harness error**, and re-run every
  mutant that followed the failure. Do not keep the ones that "look right".
- **Restore by reversing the edit, never `git checkout --`** — the tree holds other uncommitted work,
  and the guard hook refuses it anyway.

Related: [[a-green-mutation-only-counts-if-the-mutant-ran]], [[green-mutation-that-changed-nothing]],
[[restoring-a-mutated-file]], [[a-baseline-from-the-subject-vouches-for-it]],
[[verify-in-head-not-the-working-tree]].

---

# untracked-scratch-invalidates-gate-evidence

> A gate receipt hashes the WORKING tree while the gate checks the COMMITTED tree, so two untracked scratch files silently made the evidence unusable

`scripts/run-vitest.mjs` records a gate receipt whose `inputHash`/`fileCount` come from the
**working tree**. `committedTreeInputSignature` in `scripts/ward-flow/chat-control.mjs` checks it
against `git ls-tree -r <ref>` — the **committed tree**. So any untracked file in the worktree
makes the receipt not match, and nothing says that is why.

Observed 2026-09-05 clearing the `ward-flow-chat-control` deadlock: the receipt recorded **5964**
input files where the gate wanted **5962** — off by exactly the two untracked scratch files sitting
in my worktree. The run passed, the receipt was written, and the gate still refused with its
original message, which describes a missing receipt rather than a mismatched one.

**Why:** the discrepancy is invisible from either side. The runner's line says "recorded a pass",
and the gate's line says "has no runner-produced passing receipt" — neither prints the two numbers
it is comparing, so the natural conclusion is that the run did not count, not that scratch files
changed its identity. See [[a-green-mutation-that-changed-nothing]] and
[[verifier-output-is-ephemeral]] for the same shape: an operation that appears to have produced
evidence and produced none.

**How to apply:** before producing any receipt-backed evidence, run `git status --porcelain` and
require zero entries — untracked included. If a receipt-backed gate refuses for no visible reason,
compare the numbers before re-running: `git ls-tree -r --name-only <ref> | grep -vc '^node_modules/'`
against the `(N input files)` the runner printed. Hold untracked files outside the worktree
(same drive — `os.replace` cannot cross D: to C:), back them up first, and hash-verify on restore;
never delete them. And note the receipt lives in `node_modules/.cache/database-gate-receipts.json`,
so any `npm ci` destroys it — see [[a-working-safeguard-leaves-no-trace]].

---

# verify-in-head-not-the-working-tree

> Under memory pressure a write or a commit can fail silently; check `git show HEAD:<path>`, never the file on disk, and never reach for `commit --amend`

An edit or a commit can fail to happen with no red anywhere. On 2026-08-30 this machine hit
`STATUS_COMMITMENT_LIMIT` (0xC000012D) and could not fork: a `python` and a `git commit` died, an
edit was silently lost, and later PowerShell itself would not start. **An unwritten edit followed by
a clean `git status` is indistinguishable from having nothing to commit**, and a test run over the
old content is honestly, completely green.

**Verify in `HEAD`, not in the working tree.** `git show HEAD:<path> | grep <the thing you added>`,
never `grep <path>`. The working-tree check passes in exactly the worst case — the edit landed, the
_commit_ died, the files on disk look perfect, and `HEAD` does not have them. That correction came
from a peer session that had lived it; the weaker disk-based rule was the one I wrote first.

**Never reach for `git commit --amend` when a commit seems to have gone wrong.** It is the one
common git operation that destroys the previous state as a precondition of creating the new one, so
under a machine failing to fork it can leave a branch that has simply lost a commit, with no error.
A follow-up commit costs one line of history and cannot do that.

**Why:** every tool in the chain reports success, so nothing in the normal loop contradicts it. The
guarantee a test wrapper can give — that every file handed in produced a result
([[hand-picked-test-subsets-ship-red]]) — sits _downstream_ of this and cannot see it.

**How to apply:** after any long or heavy step, and always before reporting work complete, confirm
the content is in `HEAD`. Related: [[checks-that-cannot-fail]], [[restoring-a-mutated-file]],
[[observations-expire]], [[claude-session-accumulation-starves-machine]].

## Four ways a write silently did not happen, one night — three ending in a clean tree

2026-08-30, same evening, three different layers:

| Mechanism                                        | Layer       | How it presented                                           |
| ------------------------------------------------ | ----------- | ---------------------------------------------------------- |
| a `fork` killed at `STATUS_COMMITMENT_LIMIT`     | the machine | an error scrolled past; the file simply did not change     |
| a heredoc that swallowed its own `\|\|` fallback | the shell   | **no output, no error, no change** — exit looked fine      |
| an idempotency guard matching an unrelated line  | the script  | ⚠️ **`already applied`** — it reads as the guard _working_ |

**A FOURTH, later the same night, and it is the only one that DESTROYS rather than skips.** A
scratchpad script spliced a section into a 61,285-byte document. `open(path, "w")` **truncates the
file to zero before it writes anything**, and the encode then threw on one bad character — leaving
0 bytes and 1,101 lines gone. The script's own `assert marker in read()`, added by rule 2 below,
**could not run: the file was already empty.**

> ⚠️ **A VERIFICATION STEP DOWNSTREAM OF THE DESTRUCTIVE STEP IS NOT A VERIFICATION STEP.** The
> check and the damage share a cause, so the check cannot see it — the same reason a mutation
> restore must not be proved by reading the file you just wrote ([[restoring-a-mutated-file]]).

**Encode first, write to a temp file, then `os.replace`.** The encode throws before anything is
touched. And commit before any scripted edit: the only reason nothing was lost is that the file was
committed minutes earlier, and `git checkout HEAD -- <path>` restored it, **verified by hash rather
than by eye**.

⚠️ **An empty file is the purest form of the whole family: it still opens, still greps clean, and
satisfies every "X is not present" check perfectly.**

**The third is the worst because it looks like success.** A marker chosen for convenience —
`"RE-MEASURE"` — already appeared twice in that file from hours earlier, so the guard refused an edit
that had never run. Same family as `ward` matching inside `forward`, and as a `grep -c` counting a
comment rather than a definition: **a substring chosen for convenience matches something you did not
mean, and here it does so in the one direction that reassures.**

**Two halves, and the second generalises past guards entirely:**

1. A marker must exist **only** in the block being inserted — take a distinctive phrase from the new
   text, never a keyword.
2. ⚠️ **Verify the write AFTER it, not the intention before it.** Re-read the file and assert the
   marker is now present. One line, and it turns a silent no-op into a loud one.

**All three end with a clean `git status` and a session that believes it has finished** — which is
why the rule at the top of this memory is the only check downstream of all three.

## ⚠️ A tool's report of what it did is not evidence of what it did

2026-08-30. An edit script reported `escapes repaired: 211`. **Nothing was repaired.** Doubled
backslashes were flattened before the interpreter saw them, so both arguments to `replace()` were
the same character and the call was a no-op; `211` was simply how many em-dashes the file already
contained. The one genuine escape it was written to fix survived untouched.

**The write happened. The report was true as arithmetic and false as a claim about the edit** —
which is a different failure from the silent non-writes above, and it defeats the `grep -c` habit,
because a count confirms content, not causation.

⚠️ **What nearly let it through: the number was only caught by being wrong-shaped.** The author
expected 1 and got 211. **Had the file happened to contain one stale match, it would have printed
`1`, matched the expectation exactly, and shipped.** An alarm that depends on arithmetic surprise is
a thin thing to rely on.

**The mechanical check, which does not depend on noticing anything:**

```bash
git diff --stat        # 39 insertions, 0 deletions -> 211 characters cannot have changed
```

**The repository's record of what changed outranks any tool's account of what it did.** Use the
diff to confirm the _shape_ of an edit (how many lines, added vs removed), not just a grep for the
text you hoped to write.

---

# The restore must be in a `finally`, or one throw corrupts every later mutation silently

2026-09-06, Ward Flow. My harness did: apply → run → restore → print. A mutation threw between the
apply and the restore, so the file stayed mutated — and **the next five mutations in the loop all
measured a reducer with an inverted guard while printing perfectly normal reports.** Each said
"HASH MATCHES", because each restored to _its own_ corrupted baseline.

**The one visible sign was that the later mutations' `applied:` baseline hash differed from the
earlier ones' — and that is the easiest line in the output to skim past.**

## How to apply

- **Restore in a `finally`, never on the happy path**, and **throw loudly if the restored hash does
  not equal the baseline captured before mutating.** A harness that cannot leave a file mutated is
  the only kind whose green means anything.
- **In a loop, assert the baseline hash is the SAME for every mutation touching the same file.** A
  changing baseline is the corruption signature; "HASH MATCHES" on each individual run does not
  contradict it, because each one restores to whatever it found.
- ⚠️ **A restored hash proves the file went back to what THAT run found — not to what it should
  have been.** The restore proof sits downstream of the damage. What actually clears a control is a
  red quoting content that was already there, and a predicted catcher named _before_ running.
- When results are invalidated this way, **say so and re-run from a verified clean state** rather
  than reasoning about which of them were probably still fine.

## 🔴 A PERFECT RESTORE THAT DESTROYS ANOTHER CHAT'S UNCOMMITTED WORK. Raised by Ward Builder Three, 2026-09-09.

The worst restore failure yet, and it is invisible from BOTH ends. Mutation testing on a shared
worktree, or on a file another live chat is editing:

1. You copy the file to a pristine copy, mutate it, run the test, copy the pristine copy back.
2. `cmp` says byte-identical. **Your restore is perfect and your proof is sound.**
3. But if another chat had UNCOMMITTED edits in that file when you took your copy — or made them
   while you were mutating — **your restore silently overwrites them.**

⚠️ **Every check passes.** `cmp` compares against YOUR baseline. `git status` shows the file
unmodified, which is exactly what a clean restore looks like. The other chat's work does not appear
in any history, because it was never committed. **There is nothing to notice, from either side.**

🔴 **And it is strictly worse than the duplicated-effort failure it sits beside.** Duplication
wastes work that still exists. This DESTROYS work, and destroys the only copy.

**How to apply.** Before mutating any file another chat may be editing:

- **Ask that chat**, and get the answer before you copy the baseline — a clean `git status` at
  the moment you look is not a promise about the next ten minutes.
- Prefer mutating in a worktree **nobody else is attached to**, and remember the attachment question
  has defeated three instruments here — see [[differs-is-not-owns]].
- **Commit before mutating** is the standing rule and it protects YOU; it does not protect the other
  chat, whose uncommitted work is the thing at risk. Nothing you can do in your own tree protects
  them. Only asking does.

Related: [[controller-staging-claims-subagent-work]], [[identical-work-produces-no-conflict]].
