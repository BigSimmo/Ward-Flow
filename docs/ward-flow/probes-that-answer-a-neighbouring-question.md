# Nine probes that returned a confident wrong answer

**Written 2026-09-09 by Ward Verifier, from measured incidents on 2026-09-08/09. Every one is
reproducible; the exact command is given so the fix sits beside the query rather than in a document
about the query.**

Five sessions ran nine checks that came back clean, specific and wrong. **Not one of them errored.**
That is the pattern worth carrying: the failure mode here is not tools breaking — it is tools
answering a _neighbouring_ question fluently. A crash announces itself. A neighbouring answer does
not, and **seven of these nine read as good news**, which is the half that survives review.

⚠️ **§3 and §6 are the same root cause an hour apart, and the second was invisible to the person who
had just written up the first.** That pair is the most useful thing in this file.

⚠️ **THE COUNTER-MEASURE IS A POSITIVE CONTROL, AND IT IS THE ONLY ONE THAT WORKS.** Before trusting
a sweep, run the probe against one known-bad and one known-good. Ward Builder Four caught its own
because _twelve of twelve_ folders came back clean — too good — not because anything failed.

---

## 1. A pathspec that silently omits merge commits — mine, and it caught me while I was warning others

```bash
git log -- package-lock.json                      # ⚠️ omits merge-commit diffs
git log --diff-merges=separate -- package-lock.json   # ✅ the one to use
```

I reported the lockfile last changed 2026-09-05 (`f006e40743`). It last changed 2026-09-06
(`4533e96366`), **inside a merge**. The command did not error, did not warn, and returned a real
commit that really touched the file — just not the last one. It answered "when did a _non-merge_
commit last change this", and I read it as "when did this last change".

The `--diff-merges=separate` caveat was already written down, in
`docs/ward-flow/archive/dated-notes/merge-to-main-survey-2026-09-08.md`. **It caught me anyway, because that is a
document about the merge and this is a fact about the query.** Hence this file.

## 2. A grep scoped to one file extension

```bash
grep -rn "ward-flow/escalation" src --include=*.tsx    # ⚠️ the nav lives in ward-nav.ts
```

Zero matches, so I nearly reported Escalation as a built screen nothing links to. The navigation is
defined in a `.ts` file. **A clean negative is what an "unreachable" hypothesis predicts**, so the
broken probe and the finding are indistinguishable. Escalation is in fact a redirect to `/delays`.

## 3. A path form the shell rewrites before the tool sees it

🔴 **THE CAUSE IS THE SHELL, NOT THE FLAG: any argument shaped like a POSIX path is rewritten on the
way in.** This entry first named the symptom — "MSYS-style paths passed to a `--root` argument" — and
that framing is what let the same trap recur unrecognised an hour later in a completely different
command. See §6. Write it up by cause or it will not match its own next instance.

```bash
node script.mjs --root "/d/Worktrees/Database/x"   # ⚠️ becomes D:\d\Worktrees\… → ENOENT
git hash-object "/d/Worktrees/Database/x/file"     # ⚠️ same rewrite, different command shape
node script.mjs --root "D:/Worktrees/Database/x"   # ✅ pass Windows-form paths
```

Ward Builder Four passed MSYS-style `/d/Worktrees/…` to a `--root` argument. Node resolved it to
`D:\d\Worktrees\…`, every check crashed with ENOENT, the output filter matched nothing, and **all
twelve ward worktrees printed clean**. A crashed probe and a healthy tree produce identical blank
output.

## 4. A filename filter that guessed the filename

Ward Builder Four listed each `node_modules` for files matching `stamp` or `.installed`, got nothing,
and nearly reported "the skewed trees have no install stamp" as the root cause. The file is
**`.codex-installed-tree.json`** — it matches neither pattern, and all five trees have one.

## 5. An exit code read through a pipe

```bash
npm run <gate> 2>&1 | tail -20     # ⚠️ reports tail's status; pipefail is OFF here
npm run <gate> > out.txt 2>&1; echo "exit=$?"   # ✅
```

`(exit 7) | tail -1` returns 0. Ward Lead concluded a working gate reports success while failing,
**wrote it up as a repository defect, relayed it as a warning, and recommended fixing the gate at
source.** A change to correct code was one step away.

🔴 **An invented property travels further than an invented fact, because it arrives as a warning —
and warnings are not audited.**

## 6. The same trap, recurring in a new shape, invisible to the person who had just published it

**Ward Builder Four's, confirmed by Ward Builder Four.** An hour after writing up §3 and sending it
onward, it hit the identical root cause again — `git hash-object "/d/Worktrees/…"` during the
lockfile byte-identity check — and **did not recognise it.** No decision was made to withhold
anything; the path form was corrected reflexively, mid-command, the way a typo is fixed. Ward Lead
then spent an afternoon rediscovering the same cause.

> 🔴 **A trap you have already reported does not get re-reported when it recurs in a new shape,
> because your own fix arrives faster than the recognition. Having published the lesson is what makes
> the recurrence invisible — it feels like a thing already handled.**

⚠️ **DO NOT READ THIS AS "REPORT YOUR FIXES".** That rule would not have caught it: Four _had_
reported it, prominently, an hour earlier. What would have caught it is the correction now made to
§3 — **writing the trap up by its cause rather than its symptom.** "`--root` arguments get mangled"
does not match `git hash-object` on a bare path; "this shell rewrites anything shaped like a POSIX
path" does. **A trap recorded by its symptom cannot recognise its own next instance.**

Provenance, because this file is about claims that arrive already believed: Ward Lead surfaced it,
Four confirmed the mechanism and corrected the account — _"silently" is accurate about the outcome
and misleading about the mechanism_ — and the disclosure came after Ward Lead described losing time
to it, not cold. The `fa6dfe6c5d…` hashes Four sent were produced by the corrected command and are
sound; Ward Lead independently reproduced byte-identity across all four trees, which is what makes
that conclusion safe rather than Four's say-so.

## 7. A probe that could not have returned a positive, offered as the clearance for a dangerous act

**Ward Lead's, self-reported.** Before rebuilding dependencies in another folder, it checked whether
any process was holding that tree:

```powershell
Get-CimInstance Win32_Process | Where CommandLine -like '*ward-builder-three*'   # ⚠️ cannot hit
```

Nothing came back, and the tree was reported unheld. **`Win32_Process` carries no working-directory
property at all** — verified here against the live class: of its 45 declared properties, the only
path-shaped one is `ExecutablePath` (the binary), beside four `*WorkingSet*` memory counters. A
`vitest` or `npm` process started _inside_ that folder has the folder nowhere in its command line.
**The query was structurally incapable of returning a hit, so its silence carried no information
whatsoever.**

⚠️ **AND THE ABSENCE CANNOT ANNOUNCE ITSELF — THIS IS THE WORST PART AND IT COST US A DISAGREEMENT TO
FIND.** Ward Lead reported a sixth impostor, a bare `Path`. I could not see it; it reported using it
successfully. Both observations were correct, about **different populations**:

`Path` is a **ScriptProperty**, added by PowerShell's own type system and absent from the CIM schema.
`ExecutablePath` is a real `Property`. **Three ways to ask "does `Path` exist" — and two of them say
no:**

```powershell
(Get-CimClass Win32_Process).CimClassProperties.Name -contains 'Path'   # False — schema
$p | Get-Member -MemberType Property -Name Path                         # False — excludes ScriptProperty
$p | Get-Member -Name Path                                              # True  — ScriptProperty
$p.Path   # → C:\WINDOWS\System32\WindowsPowerShell\v1.0\powershell.exe ← a real, absolute path
```

So a name-scan says _no such property_ while the property hands back a genuine absolute filesystem
path — **and it is the EXECUTABLE's path, never the working directory.** Anyone reaching for "the
path property" to find a working directory is handed a real, plausible, wrong answer.

🔴 **WHICH DEFEATS BOTH OBVIOUS REMEDIES, AND THIS IS THE GENERALISABLE PART.**

- _"Read a value from the property once"_ fails: `.Path` yields a value and the value is a valid path.
  Nothing about reading it says it is the wrong path.
- _"Enumerate the members first"_ fails too, and worse — **`-MemberType Property` does not return
  ScriptProperties, so you cannot read a value from a member your enumeration never listed.** The
  narrowing happens one step before the check you were relying on.

The tell is that **`Path` and `ExecutablePath` return the identical string**. Reading a value proves a
property exists; only a **known answer** proves it means what you think. Compare a suspect property
against one whose meaning you already have, on a subject whose answer you can predict.

> 🔴 **The other six probes answered a neighbouring question. This one answered none — and it was
> offered as the evidence that made the action safe.** A check that cannot fail and a check that
> cannot succeed have the same defect from opposite ends: neither can move a belief, and both read as
> a clean result.

⚠️ **THE COORDINATION FACT UNDERNEATH IT IS WORTH MORE THAN THE PROBE.** Ward Lead had confirmed the
BRANCH was its own with `git branch --show-current` and concluded the folder was safe to rebuild.
**Branch ownership and directory attachment are independent axes.** Ward Builder Three's _session_
had that folder as its working directory and was live at the time. A wholesale dependency rebuild is
dangerous on the second axis only, and a branch name says nothing about it. This machine has already
lost in-use worktrees to sessions that checked the wrong axis.

**And note where this sits in the sequence:** it is the _correction to a correction_. Ward Lead's
ownership self-catch was published, read as settled, and was itself wrong — it would have told the
next reader to rebuild dependencies under a live agent on the strength of a branch name. It was fixed
in place in the memory store rather than appended, because **a false remedy sitting above its own
correction still gets read first.**

## 8. A status that belongs to the wrapper, not the tool — three surfaces, one consequence

§5 was a pipe. **It is not only pipes, and the day after §5 was written the same trap took two more
shapes and caught two more people, one of them the author of §5's own file.**

**(a) The background-task completion notice.** Running the mockup suite as a background task, the
harness reported **"completed (exit code 0)"**. The recorded `exit=` line said **1**, and the run had
15 failures. The compound command ended in `echo`, so the notice reported the echo. Ward Builder hit
the identical thing the same day on the citation checker — harness said 0 twice, `SELFTEST_EXIT=1`
and `REAL_EXIT=1` in its own captured lines — and escaped only because it had wrapped each run and
read the captured value instead of the notification.

> 🔴 **This is the more dangerous surface than a pipe, and Ward Builder is right about why: the
> notice arrives unbidden, looks authoritative, and nobody types it.** A pipe is at least something
> you wrote. Nothing prompts you to distrust a status you did not ask for.

**(b) `npm run <anything>` exiting 0 without running.** Ward Builder Two's: a script printed
_"'prettier' is not recognized"_, **exited 0, changed zero files — indistinguishable from a clean
tree.** 95 files were unformatted. `node_modules/.package-lock.json` was missing, so the install never
finished its bookkeeping and every binary was unrunnable **by name** while present and correct **by
path**. Format is in neither `test` nor `lint` nor `typecheck`, so nothing else would have caught it.

```bash
ls node_modules/.bin | wc -l   # 0 ⇒ NO npm-script binary can run, whatever npm reported
```

**Zero files changed is the tell, not the exit code.** Verified on this worktree before trusting any
of today's results: **147**, `.package-lock.json` present, `prettier --version` answering both
directly and through `npm run`. Repair is `npm rebuild` then `npm install` — **not `npm ci`**, which
wipes `node_modules` and has crashed on this machine.

**(c) The backup that saved one project folder out of eighty-two.** Ward Builder Three's, and the
largest of the family. `~/.claude/scripts/backup-work.sh` copied conversation history from a single
project directory — but **every ward chat runs in a linked worktree and writes its transcript to that
worktree's own directory.** The newest saved transcript was **2026-09-06 while work was live today**.
Memory had the same shape: **7 stores, 1 saved.**

> ⚠️ **Exit 0. A healthy file count. A printed `DONE`. Nothing distinguished "saved everything" from
> "saved one folder of eighty-two"** — and the config arm sat at 600+ files for weeks, which is what
> drowned the memory arm saving one store of seven. **The thing to count was how many folders it
> reached, and nothing reported it.**

Repaired, and the fix is guarded by two floors **on the population rather than the total**: it aborts
if it ever copies one transcript folder again, or zero memory files.

```powershell
(Select-String -Path "$HOME\.claude\scripts\backup-work.sh" -Pattern "TRANSCRIPT_DIRS").Count
# 0 = broken, >0 = repaired
```

🔴 **Reversion risk, still open:** every retained backup taken before 2026-09-10 contains the broken
script, and `~/.claude` is not a git repository. **A config restore from an older backup silently
reinstates it, and the next backup looks healthy while saving almost nothing.**

**The rule for all four:** a status tells you about the last thing that ran, which is not necessarily
the thing you meant to run. **Read the log for a sentence in English, and read a number that only the
tool could have produced** — the failure count, the files changed, the population walked.

## 9. A control that cannot fail for the only person who needs it

The check above was circulated between sessions in its bash form:

```bash
grep -c TRANSCRIPT_DIRS ~/.claude/scripts/backup-work.sh   # ⚠️ correct for agents, fails for the owner
```

**It is correct. Every agent here runs bash, so it passes every test any of us would run.** The owner
ran it in PowerShell 7.7, which has no `grep`, and got nothing. **The one reader it breaks for is the
only reader who is not an agent** — and he is the only one who needs it, because the check exists to
be run after restoring a backup.

> 🔴 **The defect is invisible from inside the population that wrote it.** _"It worked when I ran it"_
> cannot detect this class, because everyone doing the testing shares the property that makes it work.

⚠️ **AND IT CAUGHT ME WHILE I WAS INVESTIGATING IT — the fourth self-inflicted entry in this file.** To
confirm the owner's failure I asked whether PowerShell has `grep`. **Mine answered "grep present"**,
because the PowerShell I invoke inherits this shell's `PATH`, which carries Git Bash's binaries. **My
attempt to reproduce his environment reproduced my own**, and reported the broken command as fine.

**A control has an audience, and the audience is part of the control.** Before handing someone a
check, ask what is true of you that may not be true of them — shell, PATH, permissions, platform,
what is installed. Ward Builder tested the replacement **in its own shell and then had the owner run
it in his**, which is the only test that could have settled it: both returned `4`.

- **Two people making the same mistake is not corroboration.** Ward Builder Four relayed my
  agreement to the owner as independent confirmation of its own finding; it was one observation made
  twice in one shell. Independence has to be checked, not assumed from the number of people saying it.
- **A true finding can ride inside a false one.** Retracting the invented exit-0 defect nearly
  discarded the real dependency skew standing beside it. Retract the claim, not the neighbourhood.
- 🔴 **Apology reaches for the passive voice, and the passive voice loses the owner.** §4 above was
  written without a name while the author's own two errors were signed — Ward Builder Four asked for
  its name to be put back on, against its own interest, and reports this as the third time in one day
  a record drifted a mistake off it. **Every drift went the same direction, none was deliberate, and
  each was written by whoever was apologising at the time.** An unattributed error in a document reads
  as the author's, so the passive voice does not soften a record — it moves it.

  This matters for a document like this one and not only for fairness: §1 works _because_ it is
  signed. "It caught me while I was warning others" is a thing that happened to somebody. The same
  entry unowned reads as a hypothetical, and a hypothetical teaches nobody.

## What to do about a result you like

Read the log for a sentence in English, never the exit line. Check the **population and the
duration** — a pass over nothing looks exactly like a pass. And when a peer's correction happens to
resolve something in your favour, that is precisely when to test it rather than accept it: Ward
Builder Four verified my `lockSha256` explanation on both arms (fresh tree matches the live
lockfile's hash, skewed tree does not) for that reason, and said so.

## The one sentence, and it is Ward Lead's

Every entry above is an instrument that was trusted without being tested, and Ward Lead — who spent
the day correctly insisting on positive controls for everything else — put it better than the rest of
this file does, about itself:

> 🔴 **"I applied it to every population I measured, and not once to the tool doing the measuring."**

That is the whole failure. The discipline was present, articulated, and enforced on others all day.
It was simply never turned around to face the instrument. **A probe is the one thing in a
verification that nobody verifies**, because checking it feels like the step before the work rather
than part of it — and by the time it returns a clean answer, the answer is what gets discussed.

**Test the instrument on a question you already know the answer to, before you point it at one you
do not.** Once per instrument, not once per sweep. Every one of the seven above would have been
caught by that single habit, and none of them was caught by anything else.
