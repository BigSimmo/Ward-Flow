---
name: gate-wrappers-mask-exit-codes
description: "a gate whose REPORT does not describe the run it came from — a pipe or wrapper returning tail's exit code, a lock refusal that looks like a failure, a substitute tool that checks LESS than the gate it replaced, and a normal summary line printed over files that never executed"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 843b5f08-01ae-4513-bc35-74dd82b6ebe5
  modified: 2026-09-04T03:27:03.886Z
---

**CONSOLIDATED 2026-09-09.** Four memories about ONE subject — a gate whose REPORT does not describe the run it came from: an exit code from the wrong command, a refusal that looks like a failure, a substitute tool that checks less, and a summary line printed over files that never executed.

⚠️ **Nothing is summarised — every folded section below is its original entry verbatim.** The merge exists because `MEMORY.md` is loaded in full at every session start and had exceeded its size limit, at which point it loads only PART of itself and says so nowhere. Each entry folded here gave back one index line. The only thing given up is recalling one of these without the others.

When wrapping a repo gate in a bounded retry loop (the standard technique here for
run-coordinator lock contention), **never let the wrapper's last command be `tail`, `head`, or
`grep`**. The wrapper then exits with _that_ command's status, so a failed gate reports success.

I did this on 2026-08-22 with `npm run verify:pr-local` — the background task reported exit 0
while lint had failed inside it. The failure was only visible because I read the output. This is
the same trap the repo's own AGENTS.md warns about, committed by the session that was quoting
the warning into every subagent dispatch.

**Correct shape:**

```
code=99
for i in 1 2 3 4 5; do
  npm run <gate> > /tmp/g.log 2>&1; code=$?
  [ $code -eq 0 ] && break
  grep -q "capacity is full\|heavyweight command is active" /tmp/g.log || break
  sleep 60
done
cat /tmp/g.log
echo "INNER_EXIT=$code"
exit $code
```

**Why:** one Bash call (a cross-turn `Monitor` wait ends a subagent's turn), `timeout: 600000`
on the tool call, log read with `cat` _after_ the loop, and the inner code re-echoed and exited.

**How to apply:** use this shape for every gate wrapper, and treat lock refusal ("capacity is
full" / "heavyweight command is active") as a retry condition distinct from real failure — see
[[heavy-lock-refusal-looks-like-failure]] and [[rsc-boundary-invisible-to-gates]].

## 2026-09-04: it is not only wrappers. A BARE PIPE does it, and that is the common case.

    npm run verify:cheap 2>&1 | tail -45     ->  reported exit 0
    npm run verify:cheap                     ->  exit 1, stopped at gate 2 of 42

**A pipeline's exit status is its LAST command's.** No loop, no wrapper, no retry logic — just a
pipe to `tail` to keep the log short, which is the most ordinary thing anyone types. Fifth instance
in this project and the first that was _invisible_ rather than merely misreported: nothing in the
transcript looked like a wrapper at all.

⚠️ **The same shape hides inside a compound command.** `npm ci > log 2>&1; echo "exit=$?"` is
correct, but put a `tail` after it and the surrounding tool call reports `tail`'s status. That
happened here too, on a run of `npm ci` that had actually failed with EPERM.

**Two habits, and the second is what actually caught it:**

1. `cmd > log 2>&1; code=$?` — capture before anything else runs, echo `code` explicitly.
2. **Read the log, not the exit line.** The gate had printed _"Installed dependencies do not match
   package-lock.json"_ in plain English at the bottom of the output I already had.

**And a corollary worth its own line:** a gate that stops early looks identical to a gate that
passed, because both produce a short log ending in something innocuous. Count the gates that ran —
2 of 42 was visible in the log the whole time.

## The inverse, three times in one day: a wrapper reporting FAILURE over a passing gate

2026-08-29. The original entry is about a wrapper hiding a red. The same construct just as easily
invents one, and that is worse in a subtle way: a false red gets investigated (cheap), but a wrapper
you have learned to distrust in BOTH directions stops being evidence at all.

The shape, written three separate times in one session without noticing:

```bash
[ "$RAN" = "0" ] && { echo "NEVER RAN"; exit 75; }     # last line of the script
```

When `RAN=1` the test is false, `&&` short-circuits, and **the script's exit status is the failed
test's — 1** — so a run reporting `Test Files 4 passed (4) / Tests 104 passed (104)` came back as
"failed with exit code 1". A sibling case: `grep -c pattern file || echo "missing"` prints "missing"
for a file that exists, because `grep -c` exits non-zero on a count of zero.

**Fix:** end such a script with an explicit `exit 0`, or write `if [ ... ]; then ... fi`, never a
bare `[ ] &&` as the final statement. Same family as the `&&` short-circuit already recorded in
[[checks-that-cannot-fail]] — a test command's exit status is _data_, not a control-flow signal.

**The rule that saved it each time, and the only one that scales:** the count is the evidence, the
exit code never is. `Tests N passed (N)` was right; the wrapper was wrong; and because the habit is
to read the count first, the wrapper's verdict never got a vote.

**One more thing to check alongside the count** (learned the same day from a merge): compare the
FILE count against how many files you asked for, and the test total against the previous total. A
file that fails to parse removes its tests from the numerator _and_ the denominator, so everything
passes over a silently smaller suite — a perfect ratio is not a signal.

## 2026-09-04: I did it AGAIN, with this memory already written, in the plainest form there is

Not a retry wrapper this time. Just a pipe, typed without thinking, to keep the output short:

```bash
node scripts/run-playwright.mjs … --reporter=list | tail -60
```

The tool reported **`[exited with code 0]`**. Sixty lines above it, the runner had printed
`Playwright production build failed (status 1)` after a TypeScript error. A shell pipeline exits
with the status of its LAST command, and `tail` always succeeds. The runner was honest; the pipe
was not.

⚠️ **THE LESSON THE FIRST TWO ENTRIES MISSED: THE HAZARD IS NOT "WRAPPERS", IT IS `| tail` AS A
READING HABIT.** I had written this file, could quote it, and still reached for the pipe — because
I was not building a gate wrapper, I was _shortening output_. The intent felt like formatting.
Anything ending `| tail`, `| head`, `| grep` is a wrapper whether or not it was meant as one.

**So the rule is mechanical, and it is about the command line, not the intent:** if a command's
result matters, it does not end in a pipe. Redirect to a file, capture `$?` on the very next line,
then read the file:

```bash
cmd > "$SCRATCH/run.txt" 2>&1; echo "exit=$?"; tail -40 "$SCRATCH/run.txt"
```

And the check that catches it anyway, which is the one that actually worked here: **read the last
few lines for a sentence saying it failed, never the exit code alone.** The words
`build failed (status 1)` were right there in the output I had asked for.

Related: [[which-assertion-went-red]], [[read-the-failure-message]], [[a-bypass-that-runs-a-narrower-check]].

## 2026-09-04: five instances in one night, and the last one hid a destroyed node_modules

The mechanism is always the same — **a pipeline's exit status is its LAST command's** — but the
consequences escalated:

1. Two mutation runs echoed `REAL EXIT: 1` while the harness line said `[exited with code 0]`. Only
   recoverable because the script author had added the explicit echo.
2. `npm run verify:cheap 2>&1 | tail -45` reported success for a gate that **short-circuited at 2 of
   42** and exited 1. That false green stood over a real `installed-lock-parity` failure.
3. Worse, an hour later: `npm ci > log 2>&1; echo "exit=$?"` was itself correct, but the surrounding
   call ended in `tail`, so the harness reported **exit 0 for an install that had failed with
   `EPERM`** — after `npm ci` had already emptied `node_modules` to 155 entries.

⚠️ **`npm ci` DELETES BEFORE IT INSTALLS.** A mid-install failure does not abort cleanly; it leaves a
worktree with no dependencies. Here the cause was a running Next dev server and two turbopack workers
holding `lightningcss.win32-x64-msvc.node` open — a native `.node` binary that npm cannot work
around. **Stop any dev server rooted in that worktree before `npm ci`**, and stop only processes whose
command line contains that worktree's path.

⚠️ **Do not run `npm ci` to "get current" in a worktree whose lockfile is older than the line you care
about** — it installs that worktree's own lock, so it changes nothing and risks the above. Check
`installed vs locked` first; a tree consistent with its own older lock has no parity fault to fix.

**Both halves of the fix, and both are needed:** capture the inner status explicitly
(`out=$(cmd); code=$?`, then echo and exit it), **and read the log rather than the exit line** — the
second is what caught instance 2.

⚠️ **2026-09-04: THE RUNNER ITSELF DID IT, WITH NO WRAPPER INVOLVED.** `npm run test` reported
`Test Files 8 failed | 1125 passed` and `Tests 11 failed | 14960 passed` — **and exited 0.** Nothing
was piped, nothing was tailed. Anything keying on the exit status scores that a pass, and I had
already drafted a message saying the suite was green before reading the counts.

**Six costumes of the same thing in one night**, across three sessions: a pipeline whose exit is its
last command's; a tool timeout that is not a process kill; a focused runner that refuses everything
and exits 2; a test file whose NAME matches no runner's include pattern, so it reports nothing
forever; a mutation that never applied because the harness died first; and a suite that fails and
exits 0. **Every one produces an outcome a reader scores as fine.**

**How to apply: never read a gate's exit status as its verdict. Read the counts, and say the counts.**
And when a full run disagrees with the targeted runs that preceded it, the difference is usually the
BASE rather than the change — here, eleven failures came from a red ancestor merged in from a peer's
branch, not from any of my five commits.

⚠️ **A related one from the same hour: verifying a CHERRY-PICK by ancestry always says NOT IN.**
A cherry-pick copies a commit under a new SHA, so `git merge-base --is-ancestor <original> <target>`
is guaranteed false and looks exactly like "my work was dropped". **Verify a cherry-pick by CONTENT**
— `git show <target>:<path> | grep <the change>` — the same rule as a squash merge.

## The fix is not "capture the exit code" — it is "check the work came back" — 2026-09-06

My wrapper hid a failure THREE times in one night, in three different ways, all with the same
`… | tail -N; echo "EXIT=${PIPESTATUS[0]}"` shape:

    283 paths on one command line   -> "The command line is too long."  harness saw exit 0
    a full vitest run               -> FATAL ERROR: heap out of memory   harness saw exit 0
    a git commit under memory       -> exit 66, nothing committed        next command died too

Ward Builder Three's runner was immune, **and not by anticipating any of those.** It never reads an
exit code at all. It requires `passed + failed` to equal the parenthesised total, AND that total to
equal the number of paths it asked for; it retries three times, then exits 9. **A crash, a dropped
fork and an OOM all fail that one test without needing to be told apart.**

**Why this is stronger than capturing the code:** an exit code is a claim the tool makes about
itself, and it travels through pipes, wrappers and harnesses that can each replace it. **The number
of files that came back is a property of the WORK**, and nothing in the chain can forge it.

⚠️ **And it exposes a gap in a filter-based run, which is what I had been using.** `vitest run ward`
has no requested-path count to compare against, so completeness cannot be checked — the summary is
only internally consistent. **Close it by discovering the population from disk and comparing:** 283
files matching on disk, 283 reported. Only then is "the suite is green" a statement about the suite
rather than about whatever subset happened to run.

**How to apply:** after any batch run, ask _did the number of units that came back equal the number I
asked for?_ before reading pass/fail at all. Related: [[two-task-lists-one-check]],
[[hand-picked-test-subsets-ship-red]], [[a-bypass-that-runs-a-narrower-check]],
[[heavy-lock-refusal-looks-like-failure]].

---

## Knowing the rule did not prevent it — twice in one hour, in one team

2026-09-06, Ward Flow. A peer hit this and wrote it to me explicitly: their first sweep reached them
through `| tail`, **the pipeline's exit code replaced vitest's**, and it reported 0 while a test had
failed. They named it as the lesson of their evening.

⚠️ **Within the hour I ran a Playwright suite as `npm run test:e2e:ward-journeys 2>&1 | tail -60`,
and the harness told me it "completed (exit code 0)". Eight tests had failed.** I had been warned, in
writing, about this exact construction, by someone who had just been burned by it.

**So the rule is not the control.** What actually caught it was noticing that `test-results/` held
eight failure directories while the verdict said success — a _second, independent_ signal that
disagreed. The output, when finally read, ended `8 failed … 65 passed (4.4m)`.

**And the pipe costs twice over.** `| tail` also **buffers to EOF**, so the output file sat at 0
bytes for the entire run: no exit code AND no progress. I could not tell a building suite from a hung
one, and had to infer liveness from process counts and artefact mtimes.

**How to apply:**

- **Never pipe a gate through `tail`, `head`, or `grep`.** Redirect the whole thing to a file and read
  the file: `cmd > out.txt 2>&1` then `tail -40 out.txt`. Costs nothing, keeps the exit code, and the
  file fills as it goes.
- **If you must pipe, `set -o pipefail`** — but prefer not needing it.
- **Accept a verdict only from the runner's own summary line**, and prefer a second signal that can
  disagree with it (failure artefacts, a written report, a count that reconciles).
- ⚠️ **Treat "exit code 0" from any wrapped command as unverified**, not as green. The harness reports
  the wrapper faithfully; it has no way to know a filter is standing in front of the thing you ran.

Related: [[a-summary-line-over-a-broken-run]], [[read-the-failure-message]],
[[heavy-lock-refusal-looks-like-failure]], [[a-clean-negative-that-measured-nothing]],
[[carry-the-antidote-with-the-assertion]].

## Recurred 2026-09-07 as a BACKGROUND TASK's completion status

A backgrounded `npx vitest run tests/ward … ; echo "VITEST=$?"` was reported by the harness as
**"completed (exit code 0)"**. Vitest's own exit was **1**, and one test had failed. The wrapper's
last statement was the `echo`, so the pipeline's status was the echo's.

**The notification is a claim about the LAST command, not about the work.** A background completion
that says "exit code 0" is not evidence the thing you ran passed — and unlike a foreground run,
there is no output in front of you to contradict it.

**What saved it:** the command printed `VITEST=${PIPESTATUS[0]}` as its own token, so the real code
was in the captured output even though the harness's summary disagreed. **Always emit the gate's
exit code as a labelled token you can grep for, and read that rather than the completion summary.**

⚠️ Note the shape is the same as [[a-summary-line-over-a-broken-run]]: a true statement about a
narrower thing, sitting where a statement about the wider thing is expected.

## 2026-09-09 — the SIXTH instance, and the first where the misread INVENTED A PROPERTY OF THE TOOL

**Consolidated from three separate entries** written independently by three sessions within one hour
— which is itself the finding underneath: see the duplication note at the end.

**The trap was documented, the invocation was named in this very file, and the message the reader
would see was quoted here. It recurred anyway** — so the countermeasure cannot be "remember this
entry."

    npm run verify:cheap 2>&1 | tail -40     ->  read 0
    npm run test 2>&1 | tail -40             ->  read 0
    npm run lint 2>&1 | tail -15             ->  read 0
    set -o | grep pipefail                   ->  pipefail  off
    (exit 7)                                 ->  7
    (exit 7) | tail -1                       ->  0     (PIPESTATUS[0]=7)

🔴 **WHAT MADE THIS WORSE THAN A HIDDEN FAILURE: IT INVENTED A PROPERTY OF THE TOOL.** The conclusion
drawn was _"the gate refuses while EXITING 0 — it reported green twice having run nothing."_ That was
written up as a repository defect, endorsed in writing by a second session, relayed to Josh as fact,
proposed for the ledger, and ranked by a third session **above a real measured finding**, with a
recommendation to fix the gate at source. **A change to a working gate was one step away, on a shell
behaviour nobody had checked.**

> **An invented property travels, because it arrives as a warning, and warnings are not audited.**

🔴 **AND THE CORROBORATION WAS FAKE IN A WAY THAT LOOKED EXACTLY LIKE EVIDENCE.** Each session
reported the other's identical result as independent confirmation. **Two instruments sharing a defect
agree perfectly.** Nobody tested whether the observations were independent; they were one observation
made three times on one shell. **Any "confirmed independently" claim has to survive that question.**

**Disproven afterwards, bare and unpiped — the gates are fine:**

    node scripts/check-ward-citations.mjs --selftest               exit=1
    node scripts/check-installed-lock-parity.mjs --root <bogus>    exit=1
    npm run check:installed-lock-parity  (passing case)            exit=0
    scripts/check-installed-lock-parity.mjs:338-343   explicit process.exit(1) on the accused branch

**npm does propagate a failing script's status.** The claim is not merely withdrawn; it is refuted.

⚠️ **THE CORRECT OBSERVATION WAS REACHED BY THE WRONG ROUTE, AND THAT HALF SURVIVES.** The absent test
totals WERE a true tell — of the gate halting at a **real** fault (eight byte-identical duplicate
inbox records the origin/main merge resurrected), not of the gate lying. **Do not strike the tell
along with the explanation**; see [[a-correct-diagnosis-that-stops-the-inquiry]].

### The habits, in the order they actually help

1. **Read the log for a sentence in English, never the exit line.** An exit code is one integer that
   three different things produce. A gate that stops says so in words — here, _"Installed dependencies
   do not match package-lock.json. Run npm ci before interpreting test failures."_, already sitting in
   output that had been read.
2. **Check the population and the duration, never the colour.** A pass over nothing is identical to a
   pass. Running the guard directly and seeing it execute 13 tests in 3.12s is what actually protected
   the one session that was not fooled — _not_ scepticism about the claim, which they believed.
3. **A claim that a GATE is broken deserves the same standard as a claim that CODE is broken.** A
   lower one was applied because the claim came from a trusted peer and confirmed a plausible hazard.
   [[assert-only-about-code-you-opened]] applies to scripts you ACCUSE, not only code you edit.
4. **Audit a retraction that favours you.** Believing a false retraction would have restored a
   genuinely broken gate to trusted status — the asymmetry runs opposite to the usual case. The
   retraction here was worth trusting _because_ it was self-incriminating in the hard direction
   ("I did this to myself", not "the gate misled me"); see [[a-correction-that-agrees-with-you]].

🔴 **A FALSE CASE WAS FILED AGAINST A TRUE LESSON, AND REMOVING IT IS WHY THIS ENTRY WAS REWRITTEN.**
One version recorded that a peer _"said TWICE they could not reproduce it"_, and drew from that the
rule _"a peer who cannot reproduce your finding is evidence about your finding."_ **The case is false
— that peer never attempted a reproduction; they asserted the defect twice, in bold, as established
fact, and originated it.** The rule is good and keeps its own memory. It does not belong to this
episode.

> **Filing a true lesson against a false case destroys the lesson: the next reader who checks the
> case discards both.**

⚠️ **THE DUPLICATION IS THE SECOND FINDING.** Three sessions wrote three entries about this one
episode into this one file inside an hour, each unaware of the others, and every copy was accurate.
**Nothing conflicted, so nothing surfaced it** — the same shape as two chats fixing one defect
identically. In a memory file the cost is direct: this file is loaded every session, and three copies
of one lesson crowd out the other memories that then do not load at all. **Before appending an
episode to a shared memory, grep it for the episode.**

## The mechanism that let it spread, absent from the five prior instances

Checked by grep before appending, per the rule above: this file records the trap, the false case and
the duplication, but not **why a second party endorsed the claim without checking it.**

🔴 **I applied a LOWER standard to a claim that a GATE was broken than I would have to a claim that
CODE was broken** — because it came from a peer I had worked well with all week, and because it
confirmed a hazard I already found plausible. I did not merely receive it: I sharpened it
(_"the worst possible failure mode for a gate"_), asked for it to be ledgered, and relayed it to the
owner as fact. **A confident second voice is how a wrong finding acquires the appearance of
corroboration**, and supplying one cost nothing while checking it would have cost one command.

⚠️ **Why the standing note in this very file did not fire: I was reading the claim as a FINDING
rather than as a measurement somebody made with a shell.** A finding invites agreement. A measurement
invites _"what command, and what did it return?"_ — and that question alone dissolves this entire
class. See [[assert-only-about-code-you-opened]]: it governs scripts you ACCUSE, not only code you
edit.

🟢 **What actually protected me was not scepticism — I believed the claim.** It was running the guard
directly and confirming it executed 13 tests in 3.12s instead of accepting the colour. That habit
defends against a fabricated finding and a real one identically, which is why it beats doubt aimed at
any particular source.

---

# heavy-lock-refusal-looks-like-failure

> A run-coordinator capacity refusal exits 1 from test:focused, identical to a real test failure — retry on the message, never the exit code

_Folded in on 2026-09-09. Text below is VERBATIM — nothing summarised._

When another worktree holds test capacity, the repo's run coordinator refuses admission — but
the two entry points report it differently:

- `npm run typecheck` exits **75** (`DATABASE_HEAVY_RUN_ADMISSION_BUSY`), which is
  distinguishable.
- `npm run test:focused` throws from `acquireHeavyRunLock` in `scripts/test-run-lock.mjs`, so
  node exits **1** — byte-identical to a genuine test failure by exit code alone. The only
  signal is the string `capacity is full` in the output.

**Why:** an automated retry loop keyed on the exit code stops on attempt 1 and reports the change
as broken when nothing ran. Hit 2026-08-21 verifying a 9-line deletion; the real run finally
succeeded on attempt 6 (`Test Files 2 passed`, `Tests 60 passed`).

**How to apply:** gate retries on `grep -qE "capacity is full|clinical-kb-heavy-locks"`, not on
`$?`. Also expect two transient infrastructure errors on this busy machine: a cacache
`ENOENT ... rename` race during `npm ci` when another install shares `D:\.npm-cache` (retry after
`rm -rf node_modules`; one `npm ci` took 58 minutes), and an `ENOENT` writing
`clinical-kb-heavy-locks/<id>.lock/queue/*.tmp` when the lock dir is recreated mid-write. Neither
is your diff. Never kill another worktree's lease-holding process.

Related: [[checks-that-cannot-fail]], [[local-test-failures-windows]].

## The hole in that rule: the lock may be YOUR OWN orphan

2026-08-30. An implementer stopped its own task and **its `vitest` child survived, still holding
the machine-wide heavy-run lease**. The restarted run then died on `Another Database heavyweight
command is active` — the exact message this entry says means BLOCKED-not-failed.

**It was true, and the diagnosis it invites was wrong.** Retrying would have waited forever on a
process that will never finish, and the symptom is indistinguishable from another session running
a heavy gate.

**Corrected rule: read the message, then check whether the lock is yours before you wait on it.**
A killed task can leave a child holding the lease. Find the PID and confirm it is not your own
orphan before treating contention as external.

Same family as the restore refusals found the same night: **a true message that invites a wrong
diagnosis.** The instrument is not lying — it is answering a different question from the one you
are asking. See [[a-correct-diagnosis-that-stops-the-inquiry]].

## ⚠️ A DIFFERENT FAILING SET EACH RUN IS A CLOCK, NOT A DEFECT. 2026-09-04.

`tests/ward-flow-chat-control.test.ts` came back red twice with **different members failing each
time** — two tests in a full-suite run, seven in an isolated re-run. Every one:

```
Error: Test timed out in 30000ms
```

I had four subagents running. The suite hashes a **124 MB committed bundle**, byte-compares it, runs
`git bundle verify` and **clones it into a new repository** — real seconds, against a 30 s per-test
budget that only one test overrides.

> **The membership of the failing set is the diagnostic.** A defect fails the same tests every time.
> A budget fails whichever ones the machine was slowest on.

⚠️ **I had already told a colleague "one test flipped between my two runs and I have not proved it
was not my commit."** It was not. Reds appearing right after your own commit are the ones you are
most primed to own, and load is invisible in the report.

🔴 **And the standing hazard, which outlives the incident: a gate that is red when busy and green
when quiet trains everyone to re-run it — and a re-run that passes is indistinguishable from a real
pass.** Once that habit exists nobody can tell a genuine failure from a busy machine. Raise it as a
decision rather than re-running until it is green.

**Check load before diagnosing:** count your own running agents and background jobs first. It costs
one thought and it is the cheapest explanation on the list.

---

# a-bypass-that-runs-a-narrower-check

> Substituting a raw tool for a blocked repo gate can silently run a NARROWER check; its silence is not evidence

_Folded from a memory last modified 2026-08-30 on 2026-09-09. Text below is VERBATIM — nothing summarised._

When `npm run typecheck` was refused with `DATABASE_HEAVY_RUN_ADMISSION_BUSY` (exit 75), I
substituted `npx tsc --noEmit -p tsconfig.json` and reported "blast radius: nothing breaks".
**That config does not cover `tests/`; the repo's `typecheck:internal` does.** Three real type
errors were invisible to it, and one of them was genuine blast radius in a file I never opened.
They shipped into another session's branch, whose Vitest run was also green — Vitest does not
typecheck.

**Why:** the danger of a lease bypass is not impoliteness or timing. It is that the substitute
command is usually _not the same check_, and a narrower check produces the identical silence a
passing one does. Nothing in the output distinguishes "found nothing" from "could not look
there". The same trap sits under `npx vitest <file>` standing in for a suite, and under any
`tsc`/`eslint` invocation that picks up a different config from the one the script uses.

**How to apply:** when a gate is lease-blocked, record it as **unrun and owed** and keep working
— do not substitute a raw invocation and then cite its silence. If you do run one for a quick
read, say which config it used and never call it the gate. Re-run the real gate before claiming
a blast radius is zero. Related: [[gate-wrappers-mask-exit-codes]],
[[heavy-lock-refusal-looks-like-failure]], [[measure-the-thing-not-a-proxy]],
[[checks-that-cannot-fail]].

## 2026-09-05, the inverse and commoner form: narrowing a gate's OUTPUT, not the gate

I ran `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i statistics` perhaps six times across a
session, to scope it to the files I was editing. Empty every time, and I read that as clean. **The
tree had four typecheck errors throughout.**

⚠️ **This is worse than replacing the gate, because it looks like discipline.** Filtering a gate's
output to your own work is exactly what a careful person does to avoid reporting other people's
noise — and there is no moment where you decide to skip anything. The full gate ran, correctly, every
time; only its report was narrowed, and the narrowing had no failure mode.

🔴 **And the specific hazard in this repo: vitest runs no tsc.** So a typecheck error is invisible to
the test loop a builder actually runs. It announces itself nowhere. A red test is loud; this is not.

**How to apply — Ward Verifier's formulation, which is better than my first one:**

> **Scope a gate by what you RUN, never by what you READ.** `tsc -p <a narrower tsconfig>` is a
> scoped check whose silence means something. `tsc | grep mine` is a full check with the answer
> thrown away.

Its counterpart evidence is what makes that more than a slogan: it ran the unfiltered typecheck three
times the same night and got **3, then 1, then 0**. That sequence is only legible because nothing was
filtered — a grep-scoped run shows zero at every step, and two of the three errors were its own, so a
filter on its own topic would have hidden exactly those.

Failing that: run the gate unfiltered ONCE before saying anything about its state, and read the whole
list. Filter to triage — never to conclude. If you filter, say what you filtered on in the same
sentence as the verdict ("clean for `statistics`" is a different claim from "clean"), which makes the
narrowing visible to you as you write it.

⚠️ **What the four hidden errors turned out to be is the argument for all of this.** One was
`exact: true` passed to `getByRole`, which does not accept it — and it did not merely get ignored, it
asked for the behaviour the query already performs (read out of the installed package: `exact`
appears zero times in `role.js`; the accessible name goes through `matches`, which ends in full
string equality). **No runtime difference existed for any assertion to detect, so the typecheck was
the only gate here that could ever have reported it** — and it was the check being filtered.

🔴 **AND THE EXPERIMENT HAD ALREADY BEEN RUN, WITH BOTH ARMS, THE SAME NIGHT, ON THAT ONE LINE.**
Another chat found the same defect from an UNFILTERED typecheck and removed it, labelling it
_"Unrelated"_ in the commit body so it could not hide inside a feature commit. Same line, same file,
two chats, hours apart: **caught unfiltered, missed filtered.** That also answers the objection the
rule invites — _"if the typecheck is the only witness, was anyone watching?"_ Yes, once, and the
watching worked; what failed was the scoping of the output, not the gate.

🔴 **THE CHEAP, MECHANICAL FORM OF THE RULE — Ward Verifier's, and better than mine:**

> **When a search returns empty, widen the pattern once before believing the absence.** An empty
> result is a claim about the DETECTOR at least as much as about the subject, and on compiled or
> minified sources a precise pattern is the wrong tool by default.

Demonstrable in two commands on one file:

    grep -cE 'matches\('  .../@testing-library/dom/dist/queries/role.js   ->  0
    grep -cE 'matches'    .../@testing-library/dom/dist/queries/role.js   ->  3

because the compiled call reads `(0, _allUtils.matches)(`. **Zero and three, same file, one character
of difference in the pattern.**

⚠️ **My first attempt to verify that reported it UNCONFIRMED, and my grep was the defect** — I
searched for `matches(` where the compiled source reads `(0, _allUtils.matches)(`. A detector's
silence taken as evidence, inside the finding about a detector's silence not being evidence. **A
corroborating claim is the one to re-check hardest, and the re-check needs its own control.** Related: [[checks-that-cannot-fail]],
[[the-suite-never-tests-the-absence]], [[gate-wrappers-mask-exit-codes]].

---

# a-summary-line-over-a-broken-run

> A batched vitest run printed a normal summary while five files never ran; the fix is arithmetic, not the presence of a count line

_Folded from a memory last modified 2026-09-06 on 2026-09-09. Text below is VERBATIM — nothing summarised._

Under memory pressure this machine kills forked processes (`fork: Resource temporarily unavailable`,
cygheap copy failures). Vitest still prints its summary. **The files that never ran are simply absent
from it**, so a batch reads as green.

    b.02   Test Files  1 failed | 41 passed (47)     42 accounted -> FIVE FILES NEVER RAN
    b.03   Test Files  43 passed (45)                TWO NEVER RAN
    re-run of b.02 alone                             47/47, 502/502, balanced

I had been checking "is there a count line", and had recommended that check to Ward Lead. **It
passes on every broken run above.**

**Why:** absence-shaped failures do not print. A dropped file produces no line to grep for, and the
summary is computed over what ran, not over what was asked for.

**How to apply:** accept a run only when `passed + failed + expected-fail` equals the parenthesised
total, **for FILES as well as tests**, and the file total equals the number of paths passed in.
Retry a batch that fails that, up to three times, then fail loudly. The same fork failure corrupts
population _derivation_ — a `grep` that cannot fork returns empty, `[ "$n" -gt 0 ]` errors, and the
file silently leaves the list (273 where it should have been 274); floor the derived population
against its own glob half. And self-test the checker: mine used `bc`, which does not exist in this
shell, so it called a good 30/30 batch incomplete three times. That direction is survivable; the
same bug pointing the other way is this whole note. See [[two-task-lists-one-check]],
[[hand-picked-test-subsets-ship-red]], [[checks-that-cannot-fail]].

---

## The same lie pointing the other way: content that ran THREE TIMES

2026-09-06, Ward Flow. `tests/ward-capacity-view.dom.test.tsx` in the master worktree went from 367
lines to 1101 — **its own content appended to itself twice**, 6 `describe` blocks where there are
meant to be 2. Nothing wrote it deliberately; something reached in by absolute path, from outside
the folder it belonged to.

⚠️ **I said "it ran three times" and relayed it to five sessions before doing the arithmetic. Three
copies is not three runs.** Self-append DOUBLES — 367 → 734 → 1468 — so no number of self-append runs
reaches 1101; the added bytes came from a **fixed snapshot**, which gets there in **two**. A peer
caught it by multiplying. **Counting the artefacts is not counting the events, and the conversion
between them depends entirely on the mechanism you have not identified yet** — which is exactly the
thing you are still looking for. Say "three copies" until you know.

**And the forensic test that looked decisive was not.** The damaged copy is LF-only, which reads as
"a Python or Node writer, not a Windows shell redirect" — until you check `.gitattributes` and find
`* text=auto eol=lf`, so **every file in the repository looks like that.** A discriminator has to be
checked against the population before it discriminates. See [[a-clean-negative-that-measured-nothing]].

🔴 **A triplicated test file does not fail. It PASSES, three times over.** No duplicate-name error,
no red, no warning — just a larger green number. Every count quoted from that run inflates, and the
arithmetic check above (`passed + failed == total`) **balances perfectly**, because the duplicates
are genuinely there and genuinely ran.

**So the file/test totals guard against absence and are blind to duplication.** The two failures look
nothing alike from the summary line: one under-reports silently, the other over-reports silently, and
the same balanced arithmetic certifies both.

**What actually surfaced it:** the pre-commit hook refused to commit while an unstaged file sat in
`tests/`. Not a test run — a lock. It had been sitting for half an hour.

**How to apply:**

- **Before believing a count went UP, check the file didn't.** `git diff --stat` on the test tree
  costs nothing; 734 insertions in a file nobody edited is the whole tell.
- **Prove duplication lossless before discarding it**, or a real edit rides out with the noise:
  `comm -23 <(sort -u added) <(sort -u head)` must return **zero** lines. Mine did, so rewriting from
  HEAD provably lost nothing — and I kept a copy of the damaged version anyway.
- ⚠️ **A protection hook can fire on an ordinary file restore, and again on the note describing it.**
  The repo guard matched my restore command, then matched this memory entry's own prose. `git show
HEAD:<path> > <path>` does the restore with no delete verb, and `git diff` empty afterwards proves
  it exact; the note went in through the file tools. **Never disable a hook to get past it** — find
  the equivalent that is not the thing it guards against. See [[a-comment-can-satisfy-a-guard]] for
  the same coupling in the opposite direction.

Related: [[identical-work-produces-no-conflict]], [[establish-the-unit-before-counting]],
[[controller-staging-claims-subagent-work]], [[a-guard-that-blocks-its-own-purpose]].

## 2026-09-10 — `npm run format` failed, exited 0, and reported ZERO files

    > prettier --write .
    'prettier' is not recognized as an internal or external command
    [exited with code 0]        0 files changed

🔴 **A zero-file format result reads as "the tree was already clean".** It was not — 95 files were
unformatted. The cause is the known broken install on these worktrees: **`node_modules/.bin` is
EMPTY** (the `npm ci` that crashed with a V8 fatal error and itself exited 0), so every binary is
unrunnable BY NAME while the package is present and perfectly runnable BY PATH.

**Run it as `node node_modules/prettier/bin/prettier.cjs --write .`** — identical binary, identical
arguments, no `.bin` dependency. Same shape as `node node_modules/vitest/vitest.mjs`.

⚠️ **The tell is the count, not the exit code.** Formatting is the change most often orphaned here
because it feels finished the moment it is written, and a run that touched nothing is
indistinguishable from a tree that needed nothing. **Before reporting a format clean, check
`ls node_modules/.bin | wc -l` — if it is 0, no npm-script binary ran, whatever npm said.**

CORRECTION, same day, and it is the defect this file is about: ZERO COVERS TWO STATES that need
OPPOSITE responses — broken bookkeeping (repair it) and NEVER INSTALLED ON PURPOSE (do not). A chat
whose brief said "you do not need node_modules" reads the bare check, sees 0, and runs the
quarter-hour install its brief told it to avoid. Distinguish before prescribing:

    [ -d node_modules ] || echo "NEVER INSTALLED - not this fault; do not repair"
    ls node_modules/.bin 2>/dev/null | wc -l

AND THE FAMILY IS THREE SURFACES, NOT ONE: a wrapper's exit status, a zero-change count, AND a
background-task "completed (exit code 0)" NOTIFICATION are all "the run went fine" signals that
survive the run not happening. The harness reported exit 0 twice where the real Node exit was 1;
the only thing that caught it was `echo "EXIT=$?"` written into the captured output and read
INSTEAD of the notification. Write the exit code into the output you read.

⚠️ **And it generalises past format:** on these worktrees ANY `npm run <script>` invoking a bare
binary name exits 0 having done nothing. A green `npm run` here is evidence about npm, not about the
tool it names.

## `npm run format` exits 0 when prettier is not installed (2026-09-10)

    'prettier' is not recognized as an internal or external command
    [exited with code 0]        0 files changed

**npm reported success for a command that never ran**, and **a zero-file format result reads as "the
tree was already clean."** It was not: 95 files were unformatted. Cause: an empty
`node_modules/.bin` in that worktree — the broken-install state this machine keeps producing, which
makes every binary unrunnable _by name_ while the packages themselves are present.

⚠️ **This is the gate where the false all-clear costs most.** Formatting is the change that feels
finished the moment it is written, it is in neither `test` nor `lint` nor `typecheck`, and this repo
blocks pushes on it. **Zero files is the tell** — a real format pass over a live tree almost never
changes nothing.

- **Run the binary, not the wrapper:** `node node_modules/prettier/bin/prettier.cjs --write .`, or
  `npx prettier --write .`. Then the exit code is about your run and not about npm's.
- **Verify with `prettier --check .` afterwards** and read the count. `--check` exiting 0 is the
  claim; a file list is the evidence.
- **When another agent reports "format is clean", ask which command and what file count.** A count
  of zero means "did not run" far more often than it means "already clean".
- **Check `ls node_modules/.bin | wc -l`** before trusting any by-name binary in a worktree here.

Related: [[local-test-failures-windows]], [[a-clean-negative-that-measured-nothing]].

## The pairing that makes the whole family checkable (Ward Builder Four, 2026-09-10)

**A TOOL LYING AND A PERSON FORGETTING ARE INDISTINGUISHABLE FROM OUTSIDE.** One ran a command that
silently did nothing; the other never ran the command on that file. Same artefact, same absence of
any error, same green session.

> **RE-CHECK THE ARTEFACT, NEVER TRUST THE RUN.**

`prettier --check .` catches both. Any amount of care about the run catches neither — and a session
watching only for the tool-lying version keeps shipping the forgot-to-run version, which is the more
frequent of the two. Measured: a document folded UNFORMATTED for a day because the command was never
pointed at it, found only by re-checking rather than by remembering.

⚠️ **And apply the control to REASSURING claims too.** A peer's warning that backups might be
compromised resolved safe on measurement — `backup-work.sh` is pure git and shell, its only
`node_modules` mention is an exclude pattern — but the check was worth running precisely because the
frightening version was the one nobody would want to be wrong about. **A relayed claim that resolves
in your favour is the one least likely to be re-checked.**

## 2026-09-11 — twice in one session, so the rule was not blunt enough

Two false greens the same day, both from a status that belonged to something other than the thing
measured, and **I had already written this memory before the second one.**

**One — a run that never ran.** A backgrounded Playwright baseline came back as _"completed (exit
code 0)"_ from the task harness. The command's own status was **75**, and its entire output was
`DATABASE_HEAVY_RUN_ADMISSION_BUSY` — a heavyweight-lock refusal. **Zero tests executed.** Had I
skimmed the notification I would have recorded "referral baseline green", a green that is not a
statement about the referral screen at all.

⚠️ **The grep that looks safe is the one that fails here.** A refusal prints one line and no test
output, so _"no `failed` in the output"_ and _"no output"_ are indistinguishable. **Check for the
POSITIVE — a `N passed` count — never for the absence of the negative.** The fix that worked: a
wrapper that never pipes, retries while the busy marker is present, and prints
`VERDICT ran=yes|no exit=<real status>` so the answer states whether a measurement happened at all.

**Two — I did it to myself, an hour later.** `node check-text-size-floor.mjs | tail -12` then `$?`
read **0**. The script had exited **1** and the gate was RED. The visible output was the script's
standard trailing guidance, which prints on pass and fail alike, so it read as a pass.

🔴 **"Beware pipes to `tail`/`head`" was not enough, because the pipe is invisible at the moment you
add it** — you add it to shorten output, not to change semantics, and the interesting line is at the
end so `tail` feels correct. **The blunt version, which is the one to keep:**

> **Never put a gate behind a pipe at all. Redirect to a file, read `$?` on the next line, then read
> the file.** `cmd > out.txt 2>&1; echo "REAL_EXIT=$?"; head out.txt`

`set -o pipefail` is not the answer either — it fixes the status and still hands you a truncated
output you will read as the whole result.

Related: [[a-clean-result-from-measuring-nothing]], [[broken-and-never-worked-look-identical]],
[[carry-the-antidote-with-the-assertion]], [[observations-expire]].

---

## An invalid runner flag: zero tests, empty output, exit 0 (2026-09-12)

⚠️ **`--reporter=basic` DOES NOT EXIST IN VITEST 4.** It fails inside `loadCustomReporterModule`
during server start — **before a single test executes** — and the process still exits 0.

I used it specifically to capture failure names a previous `tail -60` had truncated. The capture
file came back **empty**, and the background notification read _"completed (exit code 0)"_.

🔴 **AN EMPTY RESULT AND A CLEAN RESULT ARE THE SAME SHAPE.** A filter that finds no `FAIL` lines
because the suite was green, and one that finds none because the suite never ran, produce the
identical artefact: a zero-byte file and a success code. **The only thing separating them is
checking that the measurement happened at all** — which for vitest means a positive `Tests N
passed` line, never the absence of failures.

⚠️ **This landed within an hour of the SAME machine reporting `exit code 0` over a run whose own
summary read `5 failed`.** Two opposite lies from one signal in one session: success over real
failures, and success over no measurement.

✅ **The habit that catches both:** grep a POSITIVE count — `Tests +[0-9]+ (failed|passed)` — and
if that line is absent, the run did not happen. Treat a missing summary line as a broken probe,
not as a quiet pass. See also [[a-clean-result-from-measuring-nothing]] and
[[a-green-mutation-only-counts-if-the-mutant-ran]].

⚠️ **And `tail -N` on a suite's output is itself a truncating probe.** `tail -60` over a 1,418-file
run kept the summary line but dropped three of five `FAIL` names — so the count and the names
disagreed, and only the count survived. Filter with `grep --line-buffered` for the lines you need;
never bound by position.

## 2026-09-12 — the three shapes that leave no artefact, and the one with no defence

**CONSOLIDATED.** Two chats wrote this same episode into this same file within minutes, each having
grepped first and each correctly finding nothing — **because neither grep could see a write that had
not landed yet.** 🔴 **"Grep before appending" does not protect against a CONCURRENT append**, and the
cost here is direct: this file loads whole every session, so a duplicate pushes other memories out of
reach entirely. Both accounts are folded below; nothing distinct was lost.

**Two chats, within an hour, on different files: each read a SLICE of something and described the
WHOLE of it.** One ran `grep -n -i "comment" | head -8` over a 168-line script header, concluded a
count had been taken out when the very next lines restated it, and published a compliment built on
that. The other read a gate's exit status through a `| sed` and got `sed`'s status.

🔴 **THE FAMILY, AND IT IS ONE SENTENCE THREE TIMES:**

    an EMPTY result     and a CLEAN result      are the same shape
    a TRUNCATED read    and a COMPLETE one      are the same shape
    a SILENT recipient  and an APPROVING one    are the same shape

**In each, the fault leaves NO ARTEFACT** — nothing says "there was more", "nothing ran", or "nobody
is there". ⚠️ **Scepticism has nothing to attach to, which is why these recur among people who can all
quote the rule.**

✅ **The only defence is an instrument that produces a DIFFERENT SHAPE for the two cases.** Per member:

- **empty vs clean** — ✅ SOLVED, repeatedly: a floor that refuses below N, a specimen the matcher must
  find, a total that must reconcile. **This is why "add a floor" keeps being the answer to problems
  that look unrelated.** Solved, but unevenly applied.
- **silent vs approving** — ✅ ENGINEERED ONCE, by Ward Flow's D-5 wording: _a protected deletion does
  not proceed until the check REPLIES._ Silence is made to mean STOP rather than to mean nothing.
- **truncated vs complete** — 🔴 **NOTHING EXISTS.** Nothing anywhere makes `head -8` or `| tail`
  announce that it cut something.

**The habit that closes the third — and PHRASE IT THIS WAY, because the other phrasing dies in a day:**

> **ANY READ THAT WILL BE QUOTED PRINTS ITS OWN COMPLETENESS.**

⚠️ **Do not attach the rule to the act of READING.** At the moment of the mistake nobody believes they
are doing anything risky — they believe they are TIDYING. Adding `| head` feels like formatting, not
like changing what you measured, which is why both instances were committed by people who could quote
this file. 🔴 **A slice is harmless until it becomes a claim.** Attach it to the QUOTE and it fires at
the one moment the person would recognise what they are doing as consequential. One clause does it:

```bash
sed -n '1,8p' FILE; echo "(of $(wc -l < FILE) lines)"
```

⚠️ **A gate on how somebody READS a file is not buildable, so this stays a habit** — but a habit with
a written form beats a warning: `(of N lines)` costs nothing and would have caught both.

⚠️ **Also from that exchange: when two counts of the same thing differ, NAME THE TREE BEFORE DISPUTING
THE METHOD.** Three rounds of argument over two CORRECT measurements of two different commits; one
`git merge-base --is-ancestor` settled it. Full entry: [[name-the-tree-before-disputing-the-method]].

🔴 **And the truncated read landed as PRAISE**, which is the version nobody audits — see
[[a-correction-that-agrees-with-you]].

Related: [[a-clean-result-from-measuring-nothing]], [[a-measurement-is-scoped-to-what-it-measured]].
