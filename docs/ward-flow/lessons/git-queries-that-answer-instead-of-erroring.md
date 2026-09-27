---
name: git-queries-that-answer-instead-of-erroring
description: "expressions that return a PLAUSIBLE ANSWER to a question they could not answer instead of failing - git rev-parse and grep answering the unanswerable, an MSYS path rewritten before git sees it, a backslash-b escape eaten by the shell into byte 0x08, a pathspec matching nothing, a truthy empty list, and a hash that normalises away the difference under test"
metadata:
  type: feedback
---

**CONSOLIDATED 2026-09-09.** Six memories about ONE subject — expressions that RETURN A PLAUSIBLE ANSWER to a question they could not answer, instead of failing. A path rewritten before git sees it, an escape eaten by the shell, a pathspec that silently matches nothing, a truthy empty list, and a hash that normalises away the difference you were testing for.

⚠️ **Nothing is summarised — every folded section below is its original entry verbatim.** The merge exists because `MEMORY.md` is loaded in full at every session start and had exceeded its size limit, at which point it loads only PART of itself and says so nowhere. Each entry folded here gave back one index line. The only thing given up is recalling one of these without the others.

**Twice on 2026-09-06 a git command answered a question I had not asked, with a plausible value
rather than an error, and I believed it.**

**1 · `git rev-parse "<branch>:<path>"` for a path that does not exist on that branch.** It returned
something, my `|| echo "-"` fallback never fired, and I classified two branches as _"present,
DIFFERENT"_ — **the most alarming possible answer**, reported to a colleague as a possible collision.
`git show` on the same ref then said _"exists on disk, but not in 'claude/ward-builder-two'"_.
**`git cat-file -e <ref>:<path>` is the unambiguous existence test**; use it, then `git rev-parse`
only for refs it confirmed.

**2 · `git grep <pattern> <rev> -- 'dir/**/*.css'`.** Returned **10** matches where the true figure
is **26**. `git ls-tree` with that identical `**` pathspec matches **zero files** — so the pathspec
was silently empty and grep answered over some other scope. **A plain directory pathspec
(`-- dir/`) gave the right answer.**

**The two failed in opposite directions** — one manufactured an alarm, one manufactured
reassurance — which is why "it looked wrong so I checked" is not a defence. The reassuring one is the
dangerous one, and it is the one I would not have caught if a colleague had not asked for the number.

**Why:** these commands take a string that is BOTH a ref-ish and a pathspec, and a shape they cannot
resolve is not always an error. Exit status did not distinguish the cases.

**How to apply:** any git query whose result you are about to report — a count, an existence, a
branch comparison — **reconcile against a second spelling before quoting it.** `cat-file -e` for
existence, a plain directory pathspec instead of `**`, `ls-tree` to confirm a pathspec matches
anything at all. If two spellings of the same question disagree, the one you ran first is not
automatically the wrong one — find out which, because both numbers are quotable and only one is true.
Related: [[measure-the-thing-not-a-proxy]], [[establish-the-unit-before-counting]],
[[msys-leading-slash-false-absence]].

---

## `git log -- <path>` on a path that does not exist (2026-09-06, Ward Flow)

Asked whether a file belonged to me, I ran `git log --oneline -3 -- src/components/ward-management/board.module.css`
and got nothing back. I reported **"that file does not exist on my branch"** to two chats, and one of
them re-based an argument on it.

**The real path was `.../ward-management/board/board.module.css`** — one directory further down.
`git log` returns empty for a path with no commits AND for a path that is not there, with no error
and no warning either way. ⚠️ **A wrong path and an untouched file are the same output**, so the
query answered a question it could not answer and I read the answer.

The file was 93 KB, present, and its history was shared ward work — so the conclusion I drew ("not
mine") happened to be right, on evidence that could not support it. **A right answer from a query
that could not have produced a wrong one is not a measurement.**

**How to apply: pair every "it is absent" git query with a control against something you KNOW is
present**, in the same invocation style. One extra call:

```bash
git log --oneline -1 -- <suspect-path>     # empty — but why?
git log --oneline -1 -- <path-you-know-exists>   # returns a commit -> the tool is working
ls -la <suspect-path>                       # separates "no commits" from "no such file"
```

⚠️ **And the cost is not the wrong belief, it is the relay.** A peer had already spent effort
arguing a ruling on my behalf about a file I had told them was not mine; the misattribution made
their own conflict of interest invisible to them. Related:
[[a-measurement-is-scoped-to-what-it-measured]], [[a-clean-negative-that-measured-nothing]],
[[msys-leading-slash-false-absence]], [[absence-under-one-prefix]].

## Three instruments, one evening, all answering a narrower question. 2026-09-06.

Chasing "who wrote this one CSS line", three sessions produced three different answers and none
was challenged by its own output:

| query                               | what it actually answers                                | how it failed                                           |
| ----------------------------------- | ------------------------------------------------------- | ------------------------------------------------------- |
| `grep src/styles/ckb-v2-tokens.css` | nothing — **that directory does not exist**             | returns absence for every token, forever, with no error |
| `git log -- <path-with-a-typo>`     | "no commits" and "no such path", identically            | read as "the file is not mine"                          |
| `git log -1 -S'<str>' -- <f>`       | which commit changed the string count **LAST**          | handed over as _the_ commit                             |
| `git log -L 96,96 -- <f>`           | which commits touched **whatever text sits at line 96** | line 96 held different content over time                |
| `git log -S'<str>' … \| tail -3`    | the last three of a correct list                        | **had the right SHA and dropped it**                    |

🔴 **The last two are the instructive pair. `-S` follows the string wherever it moves; `-L` follows
the line NUMBER regardless of what occupies it.** On a reformatted file they diverge completely:
4 commits and 5 commits, **sharing exactly one — which was the correct answer, and both of us
discarded it by taking the newest from our own list.**

The proven answer needed a different query and a control: `git log -S'<str>' --reverse | head -1`,
then verify the **parent has 0 occurrences and the commit has 1**. Thirty seconds.

⚠️ **A fourth session had the correct SHA all along and truncated it away with `| tail -3`.** It was
then explained as "your base predates it" — **an explanation nobody checked, layered on an
explanation nobody checked.** Four rounds, three sessions, one file: the answer appeared in every
list and was taken from none of them.

**Why:** every one of these returns well-formed output. `-L` returned a real commit, by the right
author, in the right era, touching the right region — everything corroborated except that it was
not the answer. **An absence at least looks like nothing; a plausible partial looks like work.**

**How to apply:** before quoting a git result as a fact, run the same query against an input whose
answer you already know — a path you are certain exists, a string you are certain was added in a
known commit. And **write findings as claims, not coordinates**: through three rounds of wrong
SHAs, the prose half ("shared ward history, late August, on every branch, not from tonight") stayed
true the whole time, precisely because it was not a locator.
Related: [[whose-commit-is-this]], [[absence-under-one-prefix]],
[[a-green-mutation-only-counts-if-the-mutant-ran]].

## Five bad probes in one day, across three sessions, and every one exited SUCCESSFULLY. 2026-09-09.

Chasing a dependency skew across twelve Ward Flow worktrees, three sessions produced five wrong
measurements. **Not one errored. Not one warned. Every one returned a well-formed, plausible,
successful-looking result**, and four of the five read as _good news_.

| probe                                                    | what it actually answered                                      | how it read                                                                |
| -------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `npm run <gate> 2>&1 \| tail -40`                        | `tail`'s exit status (`pipefail` is OFF here)                  | "the gate exits 0 while failing" — **a defect invented in a working tool** |
| `node script.mjs --root /d/Worktrees/...`                | MSYS rewrote it to `D:\d\Worktrees\...`; every run died ENOENT | grep matched nothing → **all twelve folders reported clean**               |
| `readdir(node_modules).filter(n => n.includes('stamp'))` | nothing — the file is `.codex-installed-tree.json`             | "the skewed trees have no install stamp" — **nearly filed as the cause**   |
| `git log -- package-lock.json`                           | last **non-merge** commit touching it                          | wrong date, asserted to two chats as the supporting fact                   |
| `grep` excluding `.ts`                                   | a subset                                                       | a clean negative, nearly reported as a finding                             |

🔴 **THE INVENTED PROPERTY IS THE WORST OF THE FIVE, AND IT TRAVELLED.** From the pipe we did not
merely miss a red — we concluded the gate _refuses while exiting 0_, wrote it up as a repository
defect, relayed it as a warning to three sessions, and I recommended fixing the gate at source. **A
change to a correctly-working gate was one step away.** An invented property travels precisely
because it arrives as a warning, and warnings are not audited.

⚠️ **AND TWO SESSIONS MAKING THE SAME MISTAKE IS NOT CORROBORATION.** I reported the pipe finding;
a peer said they had confirmed it; I relayed that to the owner as independent confirmation. It was
one observation made twice in one shell. **Before calling two results independent, check that the
two instruments do not share a defect** — ours shared the shell.

⚠️ **A TRUE FINDING CAN RIDE INSIDE A FALSE ONE, AND THE RETRACTION NEARLY TOOK IT.** The same
message that carried the invented exit-0 defect also carried a real one: the installed tree did not
match the lockfile. Withdrawing the false half almost discarded the true half standing beside it.
**When you strike a finding, name what survives it.**

**What actually worked, and it is the only thing that did:** before trusting a clean sweep, run the
probe against **one known-bad and one known-good**. Re-pointed at a folder a peer had already
measured as skewed (must read skewed) and one measured as healthy (must read healthy), the corrected
probe reproduced both — and only then were the other ten worth quoting. The same discipline confirmed
a peer's explanation of a confusing hash: it predicted a freshly-installed tree's stamp would equal
the live lockfile's sha256, and it did, while a skewed tree's differed.

**And separate the measurement from its cause.** The skew was measured; _"the merge changed the
lockfile"_ was inferred, relayed by me as fact, and was **false in all four trees** — every
`package-lock.json` was byte-identical and none had changed that day. A peer caught it. **A relayed
cause arrives already believed; a relayed measurement does not.** Triaging the remaining folders by
the story ("did it take the merge?") would have read them clean; the script read them correctly.
Related: [[a-clean-result-from-measuring-nothing]], [[gate-wrappers-mask-exit-codes]],
[[a-control-must-test-the-premise-not-the-measurement]], [[observations-expire]],
[[a-correction-that-agrees-with-you]].

---

# msys-leading-slash-false-absence

## ⚠️ THE FIX FOR THIS HAS ITS OWN INVERSE, AND IT BITES THE SAME AFTERNOON. 2026-09-09, Ward Lead.

`MSYS2_ARG_CONV_EXCL="*"` is the standing mitigation above — it stops the rewriting, so
`git show <rev>:<path>` finally works. **It also stops REAL filesystem paths being converted**, and
git is a native Windows binary that cannot open a `/d/...` path. Both halves are true at once and
you cannot have both behaviours in one shell.

Measured, both in one session with the exclusion set:

    git hash-object /d/Worktrees/Database/ward-lead/package-lock.json
      -> fatal: could not open ... No such file or directory   (the file exists)
    ... reported for FOUR worktrees at once, which read as "the lockfiles are missing"

    git commit -F /tmp/mm.txt
      -> fatal: could not read log file '/tmp/mm.txt': No such file or directory
      -> and the commit did NOT happen, while the surrounding script printed a SHA from
         `git log -1` that was the OLD head. A failed commit that prints a plausible commit line.

🔴 **The two failure modes are mirror images and BOTH produce a confident absence:**
without the exclusion, `<rev>:<path>` lies; with it, real paths lie. Neither errors in a way that
names the cause — both say "does not exist".

**How to apply.** Keep the exclusion for `<rev>:<path>` reads. But **any real filesystem path handed
to git, or to any native Windows binary, must be a Windows path** (`D:/Worktrees/...`,
`C:/Users/...`) — including `-F <message-file>`, `hash-object <file>`, `--git-dir`, and output
redirection targets you later feed back to git. Writing scratch files to the session scratchpad with
its `C:/...` path, rather than `/tmp`, avoids the whole class.

⚠️ **And check the SHA after a scripted commit**, not the exit code of the block: this one
printed `merged as f0e6084ec5`, which was the head the merge was supposed to REPLACE.

> A leading-slash argument is rewritten into a Windows path before git sees it, so searches return confident false absences with every gate green

_Folded in on 2026-09-09. Text below is VERBATIM — nothing summarised._

On this Windows/Git-Bash workstation, **an argument beginning with `/` is rewritten by MSYS into a
Windows path before the command receives it.** `git grep -F "/mockups/ward-flow/statistics/overview"`
becomes a search for `C:/Program Files/Git/mockups/...` and returns **nothing, exit 0, no warning**.

**Two instances in one day (2026-09-01), both nearly reported as findings:**

- `git show <ref>:.githooks/pre-commit` returned an **empty blob**. I was one step from reporting a
  hook as absent from a branch it was present on.
- `git grep -F "/mockups/..."` returned 0 hits for four route literals, **including two a peer had
  just committed**. I was one step from reporting their landed fix as not landed.

**The danger is the shape of the failure, not its frequency.** An absence is the one result that
looks identical whether the search was right or wrong, and it is the result that most often _is_ the
finding. Every gate stays green; nothing anywhere says the argument was mangled.

**What to do instead**

- Drop the leading slash: search `mockups/ward-flow/...`, not `/mockups/ward-flow/...`.
- Or reach the blob by hash: `git rev-parse <ref>:<path>` then `git cat-file blob <hash>`.
- **Prove any absence before reporting it.** Run the same search for a string you know is present.
  A search that cannot find a known positive has not established a negative.

**Why I caught it both times: the answer flattered a finding I wanted.** That is the only tell there
was — see [[check-the-conclusion-that-flatters-the-theme]]. Same family as
[[backslash-b-becomes-a-backspace]] and [[the-suite-never-tests-the-absence]]: a silent transform
between what was written and what ran. Related: [[measure-the-thing-not-a-proxy]].

## A second false absence: composed at render. 2026-09-03.

**A verifier searched all of `src` for the on-screen line `Not in department yet`, with a sound
control proving the search reached the right paths, and found nothing. It concluded it could not
locate the source.** The string is real and rendered every day.

**It is composed TWICE: a constant holds `"not in department yet"` in LOWER CASE, and a helper
supplies the capital at render.** ⚠️ **So the rendered string exists at no point in the source as
typed — neither its case nor its whole phrase is greppable.**

⚠️ **An absence meaning "composed at render" and an absence meaning "does not exist" are
INDISTINGUISHABLE FROM A GREP, and only one of them is a finding.**

**How to apply: before reporting that UI text is absent from the source, search for a distinctive
FRAGMENT and case-insensitively, then find the constant and follow its consumers.** The same caution
as [[a-mention-is-not-an-assertion]] and [[compliance-without-coverage]]: the search succeeded, the
method was sound, and the conclusion was still wrong.

---

# backslash-b-becomes-a-backspace

> A literal backslash-b becomes 0x08 in any non-raw string; the shell halving runs of backslashes is a separate hazard that feeds it

_Folded from a memory last modified 2026-09-04 on 2026-09-09. Text below is VERBATIM — nothing summarised._

Two hazards, independently real, and they fire **in sequence** — which is why each looks like the
other's explanation and neither account is complete on its own. Both measured 2026-09-04, by two
sessions, by writing files and reading the bytes back.

## Hazard 1 — the shell halves RUNS of backslashes

    written  \s      -> on disk  \s     SURVIVES
    written  \\s     -> on disk  \s     COLLAPSED
    written  \\\\s   -> on disk  \\s    HALVED
    written  /\s+/u  -> on disk  unchanged, regex LITERALS are safe

**A single backslash survives; a run is halved.** Reproduced independently by a second session.

⚠️ **So a regex LITERAL is safe and a regex built from a STRING is not.** `new RegExp("\\s")` needs
two backslashes on disk, so four must be written. Write two and the file gets `"\s"`, which
JavaScript reads as a plain `s`. **The matcher compiles, runs, and matches nothing** — a false
negative with no error, which reports work as absent.

## Hazard 2 — a non-raw string turns a literal backslash-b into 0x08

Independent of any shell. `"\b"` in Python or JavaScript is BACKSPACE, not backslash-b. A pattern
containing it silently cannot match anything.

**The chain:** write `\\b` in a heredoc → the shell halves it to `\b` → the language reads `\b` as
0x08. **Hazard 1 produces the input that Hazard 2 destroys.** Neither session's original account was
wrong; each had one link.

⚠️ **Hazard 2 fires even when nothing was collapsed**, so "write files with a non-shell tool" fixes
Hazard 1 and does nothing for Hazard 2. Use raw strings, or regex literals, or build patterns from
explicit character lists.

## The mitigation that beats knowing any of this

**A counted precondition, asserted before the write:**

    edit script  ->  assert the pattern occurs exactly once
    detector     ->  anti-vacuity floor on the population walked
    mutation     ->  assert the mutation actually applied

**All three convert "did nothing, reported success" into a loud stop**, at the only moment anyone is
watching, and none of them requires diagnosing which hazard fired.

⚠️ **The demonstration: a patch script written to correct a note about this failure was itself hit
by it** — its anchor contained escapes that had been collapsed, so it matched nothing. **It stopped
only because of that one asserted precondition.** The abstract rule is worth less than that fact.

Related: [[a-conveniently-shaped-control]], [[checks-that-cannot-fail]],
[[a-green-mutation-that-changed-nothing]], [[hash-object-proves-content-not-bytes]].

## 2026-09-05 — FOUR instances in one night, and a note demonstrably cannot prevent them

Three sessions plus the lead, in one session's span:

1. A count assertion on the delays screen (`/of 43<0x08>/`) — matched nothing, presenting as
   _"unable to find an element"_, **so the natural repair is to weaken the assertion until it passes.**
2. A helper in a phone-layout guard — matched nothing in the whole repository and made a NEW
   assertion pass over an empty list. **Four tests green, no warning.** Found by reading, not running.
3. **The comment written to warn about instance 1 contained the byte**, so it rendered as `/of 43/`
   — silently deleting the character the comment existed to warn about.
4. **The guard's own documentation**, committed by somebody who had just catalogued the other three
   and was actively hunting for it. It went red on its own comment a minute after going green.

**Instance 4 is the measurement that retires "be careful" as a control.** A note already existed in
this repository and did not prevent three recurrences in one session.

**The rule: in prose, DESCRIBE a control character in words. Never type it.**
Guard: `tests/ward-no-control-characters.test.ts` (ward-scoped; names file, line, and for 0x08 says
it is almost certainly a word-boundary escape in a template literal).

### ⚠️ Widening past C0 is WRONG here, and I nearly proposed it

Swept all 847 ward files for NBSP, ZWSP, ZWNJ/ZWJ, BOM, soft hyphen, U+2028/9 — the characters that
break a pin identically while sitting outside C0. **One hit, and it was load-bearing:**
`tests/ward-table-min-width.test.ts:85` has U+200B between `*` and `/` so that `*/` does not close
the enclosing block comment. Proved with the TypeScript parser on a copy — **0 parse errors as
committed, 21 with the ZWSP removed.**

**Both legitimate exceptions found so far are the same shape: a delimiter quoted inside the thing
that delimiter closes** (the other being a `U+0003` ZIP magic number in a corrupt-archive fixture).
That is the only category where an invisible character does real work. **A third exception that is
NOT that shape is a defect** — a sharper test than a growing allowlist.

## The SyntaxWarning is inversely correlated with harm (measured 2026-09-05)

Ward Builder One wrote a probe containing a literal backslash-paren, saw Python's
`SyntaxWarning: invalid escape sequence`, and ran `cat -A` because of it. Their file was fine. **The
warning could not have fired for the escape that actually destroys anything.** Probed every escape
that matters, from a FILE rather than a heredoc:

    typed   warns?   bytes   verdict
    \(      WARNED   \(      preserved
    \d \s \w  WARNED   as typed preserved
    \b      silent   0x08    DESTROYED
    \n      silent   0x0a    DESTROYED
    \t      silent   0x09    DESTROYED

**Python warns on exactly the escapes it PRESERVES and is silent on exactly the ones it DESTROYS.**
So the warning cannot be the trigger for checking. **Run `cat -A` unconditionally on anything
containing a backslash that is meant to be re-run later.**

⚠️ **And I reached for a heredoc three times in one session while measuring this**, twice building a
test probe and once building the table above — each time the doubled backslash collapsed before the
interpreter saw it, and the third produced a blank cell and a crash. It came out only because the
crash was loud; a quieter escape yields a table that looks right and is wrong. **The medium you write
a demonstration in is part of the demonstration.** Write probes with a file tool, never a heredoc.

### The warning is dead as a trigger, four ways over (measured 2026-09-05)

1. It fires on exactly the escapes Python **preserves** and is silent on exactly the ones it
   **destroys** — anti-correlated with harm (table above).
2. On an **imported** module it fires **once ever**; the cached `.pyc` silences every later run.
   Measured with `-W always` to remove the filter confound: imported 4 / 0 / 0, direct 4 / 4 / 4
   (`__main__` is never cached).
3. **On Python 3.11 it never fires at all by default** — it is a `DeprecationWarning`
   there, not a `SyntaxWarning`.
4. Its **text changes between versions**, so you cannot reliably grep for it either:

        3.14   SyntaxWarning:      "\(" is an invalid escape sequence.   escape BEFORE, double quotes
        3.11   DeprecationWarning: invalid escape sequence '\('        escape AFTER, single quotes

5. **The damage is byte-identical on every interpreter** — 3.11.15, 3.14.4 and 3.14.7 all
   preserve \( \d \s \w and all destroy \b \n \t to 0x08 / 0x0a / 0x09.
   **The harm is constant; only the signal varies**, so the rule needs no per-interpreter caveat.

⚠️ **The probe that produces that table forces `warnings.simplefilter("always")`, so its
warns-column reads WARNED on 3.11 too.** That column measures _does the warning exist_, not _will
you see it_ — only a SUBPROCESS run under default filters answers the second. Re-running the
probe on 3.11 therefore appears to refute point 3 above. Two instruments, two questions, both
right. Same shape as reporting ten guards when it was three: the measurement was sound and the
sentence was written wider than it.

### THREE PYTHONS ON THIS MACHINE, AND THEY DISAGREE ABOUT WHETHER THE WARNING EXISTS

        python   -> ...hermes-agent\venv\Scripts\python   3.11.15   (a tool's venv, NOT the project's)
        python3  -> ...WindowsApps\python3                3.14.4
        py       -> ...Programs\Python\Launcher\py       3.14.7

Same file, same directory, default filters: `python3` warns, `python` prints nothing at all.
**A peer and I reported opposite results from the same machine because we typed different
words.** Name the interpreter in any claim about warnings, and prefer `py` or `python3` over the
bare `python`, which here resolves to an unrelated tool's virtualenv.

Related: [[an-empty-search-is-a-claim-about-the-detector]], [[compliance-without-coverage]], [[a-comment-can-satisfy-a-guard]],
[[a-control-must-test-the-premise-not-the-measurement]].

## 2026-09-05: THE WARNING IS INVERSELY CORRELATED WITH HARM, AND IT DOES NOT REPEAT

Measured on Python 3.14.4, probe written to a FILE (a heredoc collapses backslashes before the
interpreter sees them, so it measures the shell instead):

    typed   warns?   bytes      verdict
    \(      WARNED   5c 28      preserved
    \d      WARNED   5c 64      preserved
    \s      WARNED   5c 73      preserved
    \w      WARNED   5c 77      preserved
    \b      silent   08         DESTROYED
    \n      silent   0a         DESTROYED
    \t      silent   09         DESTROYED

**`SyntaxWarning` fires on precisely the escapes Python PRESERVES and is silent on precisely the
ones it DESTROYS.** Not merely unreliable — inversely correlated with harm.

🔴 **AND IT DOES NOT REPEAT.** It is emitted at COMPILE time, so a cached `.pyc` skips it:

    run directly, `python3 probe.py`   run 1: 4 warnings    run 2: 4 warnings
    imported by another module         run 1: 4 warnings    run 2: 0 warnings

A `__main__` script never gets a `.pyc`; **an imported helper warns ONCE, ever**, and the next
reader sees a clean run and reads it as fixed.

**So the warning can never be the trigger for checking.** `cat -A` (or a hexdump) goes on anything
carrying a backslash that is meant to be re-run later, unconditionally — not when something warns.

⚠️ **AND I DID IT AGAIN WHILE WRITING THIS DOWN, ONE MESSAGE AFTER BEING WARNED.** I wrote the
table above into a document through a shell heredoc into Python. The doubled backslashes collapsed
before Python saw them, so the \b row became a literal 0x08 (an invisible column), the \n row
became a real newline that split the table, and the \t row became a real tab. **The three rows the
table exists to warn about were the three destroyed in it; the four that survived are exactly the
four Python warns about.** It still rendered as a table — ragged columns, nothing that looks broken.

**The repair could not be typed either.** It has to be a script whose every backslash is `chr(92)`,
with no string literal containing one, verifying afterwards that no control character survives.
**A repair written as text reproduces the defect it repairs.**

Related: [[a-bypass-that-runs-a-narrower-check]], [[hash-object-proves-content-not-bytes]],
[[checks-that-cannot-fail]].

## AND THE WARNING IS DEAD AS A TRIGGER FIVE WAYS — THREE PYTHONS HERE DISAGREE IT EXISTS

⚠️ **`python`, `python3` and `py` are three different interpreters on this machine**, measured
2026-09-05, and the bare word `python` answers to ANOTHER TOOL'S VIRTUALENV rather than to any
project's:

    python    hermes-agent\venv\Scripts\python.exe   3.11.15
    python3   pythoncore-3.14-64\python.exe            3.14.4
    py        Programs\Python\Python314\python.exe     3.14.7

Same file, default filters, direct run: `python3` and `py` emit four SyntaxWarnings; **`python`
emits nothing at all**, because on 3.11 it is a `DeprecationWarning` and hidden by default. Two
agents on one machine reported "warns once" and "never warns" and both were right.

**The message text moves too:** 3.14 says `SyntaxWarning` with the escape BEFORE the phrase in
double quotes; 3.11 says `DeprecationWarning` with it AFTER in single quotes. **A grep pattern for
it is wrong for somebody's interpreter by construction** — which is how my own attempt to detect the
warning returned empty and nearly got reported as "unreproducible".

🔴 **AND THE DESTRUCTION IS BYTE-IDENTICAL ON BOTH VERSIONS.** 3.11.15 and 3.14.4 both preserve
\( \d \s \w and both turn \b into 0x08, \n into 0x0a, \t into 0x09. **The harm is
constant and only the signal varies.**

**So: (1) anti-correlated with harm, (2) once-only on an imported module, (3) absent entirely on
3.11, (4) undetectable by a fixed pattern, (5) over damage that is the same everywhere.**

**How to apply.** `cat -A` or a hexdump on ANYTHING carrying a backslash meant to be re-run —
never prompted by a warning, and never trusting a clean scan without seeding one bad byte into a
copy first to prove the scanner can fail.

🔴 **AND SCAN THE BYTES, NOT DECODED TEXT.** My first sweep did
`raw.decode("utf8", errors="replace")` and then looked for ordinals below 32. **Every INVALID byte
sequence had already become U+FFFD — ordinal 65533 — so a whole class was invisible to it.** It
would still have caught a bare 0x08, which is valid UTF-8; but _it happened to catch the case I was
looking for_ is not _the scanner was sound_. Read `rb`, check the byte values, and decode strictly
as a second arm. **Seed the control with one control byte AND one invalid byte, and make the script
exit non-zero rather than print a verdict if either arm fails to fire** — a control that proves one
arm licenses a claim about both. And when a result depends on a Python at all, print
`sys.executable` and `sys.version` beside it: **on this machine the word you typed decides the
answer.**

---

**2026-09-06 — the `chr(92)` rule above was already written down and I still hit this three times in
one session. The third failure mode is new and is the dangerous one: A REPLACE THAT REPORTS SUCCESS
AND CHANGES NOTHING.**

1. `\x08` in a generated regex became **byte 0x08**. Silent; the regex was simply wrong.
2. `
` inside a TypeScript string literal became **a real newline** — an unterminated string. Loud,
   and the only one that announced itself.
3. `"scripts\lib"` arrived as `"scripts\lib"`, which TypeScript then read as an escape, so the
   test input was `scriptslib` and the case failed **for the wrong reason**. **The repair attempt then
   printed its success message and changed nothing** — the `assert old in s` passed, the write ran,
   and the file was byte-identical afterwards.

**Number 3 is what to guard against, because a generator saying "repaired" over an unchanged file is
indistinguishable from one that worked**, and the next command's failure then looks like a fresh
problem rather than the same one.

**The rule this adds to the `chr(92)` one already recorded here: VERIFY BY RE-READING THE FILE INSIDE
THE SAME PROCESS.**

    check = io.open(P, encoding="utf-8").read()
    assert check.count(new) == 1 and check.count(old) == 0, "the write did not take"

Never infer that a write took because the code that wrote it did not throw. And note `git
hash-object` before/after does **not** cover this: an unchanged hash is exactly what a silent no-op
produces, so the hash check that protects a mutation restore is useless for a repair.

**The meta-point, since the `chr(92)` rule was already on this page:** a recorded lesson is not an
applied lesson. Where a harness exists, prefer it to my own care — the repo's
`scripts/ward-flow/mutation-run.mjs` exists for exactly this reason and its own docstring says the
same thing about the guard it was written to enforce.

---

# git-doubled-star-requires-a-subdirectory

> In a git pathspec `**/` demands an intervening directory, so `dir/**/*.css` silently drops every file sitting directly in dir — and plain `*` already crosses slashes

_Folded from a memory last modified 2026-09-05 on 2026-09-09. Text below is VERBATIM — nothing summarised._

Measured 2026-09-06 in the Ward Flow repo, same tree, same moment:

    git ls-files "src/components/ward-management/*.css"           -> 51
    git ls-files "src/components/ward-management/**/*.css"        -> 32
    files sitting DIRECTLY in ward-management/                     -> 19

**`**/` requires at least one intervening directory.** It does not mean "any depth including
zero". And git's plain `*` in a pathspec already crosses `/` — unlike a shell glob — so adding
`**` buys nothing except that requirement. The "more thorough looking" pattern is the narrower one.

## Why it matters more than an off-by-19

**The failure direction is silent absence.** The scan runs, finds files, reports a clean number, and
every file it never opened is indistinguishable from a file with nothing in it. I used
`**/*.module.css`, measured "no hardcoded colours anywhere in the ward stylesheets", and was one
message away from telling the coordinator a whole assignment was unnecessary — **over two thirds of
the tree.** Nothing was red. Nothing could have been.

**The only reason I caught it: the coordinator had independently said 51 and I got 32.** Not a
gate, not a control — a disagreement with a colleague's number. Related:
[[establish-the-unit-before-counting]], [[compliance-without-coverage]],
[[an-alias-defeats-a-name-matching-detector]], [[caveat-only-in-the-report]].

## How to apply

- **Prefer `dir/*.ext` in a git pathspec**; it already matches at every depth. Reach for `**` only
  when you deliberately want to exclude the top level.
- **Print the file COUNT of any sweep and reconcile it against an independently obtained number**
  before drawing a conclusion — especially a conclusion that says there is nothing to do.
- ⚠️ **A conclusion that reduces your own workload is the one to re-derive**, and this one did
  exactly that. Related: [[check-the-conclusion-that-flatters-the-theme]].

## While here: `#[0-9a-fA-F]{3,8}` matches PR numbers

A naive "find hardcoded colours" scan over this repo reports `PR #2384` as a hex. 4 of the 38
hex-shaped tokens in the ward stylesheets are all-digit references, and **0 of the 38 are in a
declaration at all** — the rest sit inside comments recording measured contrast ratios. Strip
`/* */` before scanning CSS, or the best-documented files score worst. Related:
[[a-mention-is-not-an-assertion]], [[a-comment-can-satisfy-a-guard]].

---

# an-empty-list-is-truthy

> `if (r.cssRules)` is true for an ordinary CSS style rule because an empty CSSRuleList is an object — my walk recursed into nothing and skipped every leaf, reporting zero print rules in a file that has thirteen

_Folded from a memory last modified 2026-09-07 on 2026-09-09. Text below is VERBATIM — nothing summarised._

2026-09-07. Walking `document.styleSheets` to prove a `@media print` rule existed, I wrote:

```js
if (r.cssRules) { walk(r.cssRules, cond); continue; }   // then the leaf check below
```

**Browsers that support nested CSS give every `CSSStyleRule` a `cssRules` property — an EMPTY
`CSSRuleList`, which is an object, which is truthy.** So every ordinary rule took the recurse
branch, walked an empty list, and `continue`d past the check that was the point of the function.
It reported **0 print rules and 0 forced-colors rules** in a stylesheet that has **13 and 10**.

⚠️ **The probe still printed a plausible total** — 320 rules walked, 2 sheets — so nothing about the
output said it was broken. And the answer it gave (no print handling) was the answer a careless
reader would have accepted, because it is the common case.

**Why:** truthiness tests a container's existence, not its contents. `if (xs)` and `if (xs.length)`
differ on exactly the empty case, which is the case that is everywhere. The same bug shape covers
`if (matches)`, `if (rows)`, `if (el.children)` — anything DOM- or API-shaped that returns an empty
collection rather than null.

**How to apply:** test `length`, never the collection. And when a walk must both recurse and check
a leaf, **do not `continue` between them** — an earlier version of this same function that checked
the leaf FIRST and recursed after worked correctly on the same data, which is what let me localise
it. Related: [[checks-that-cannot-fail]], [[a-clean-result-from-measuring-nothing]],
[[git-queries-that-answer-instead-of-erroring]].

⚠️ **This was the third broken probe I wrote in one session, and all three were caught the same
way: by a floor that asserts the probe found SOMETHING before its result is read.** The floor is
what turns "0 results" from an answer into a question — see
[[a-green-mutation-only-counts-if-the-mutant-ran]].

---

# hash-object-proves-content-not-bytes

> git hash-object normalises line endings, so a matching OID can hide a real byte change; and every obvious way to grep for CR is wrong in this shell

_Folded in on 2026-09-09. Text below is VERBATIM — nothing summarised._

**Consolidated 2026-09-06 from 2 separate memories on one subject**, written from different chairs across a night of six parallel sessions.

⚠️ **Nothing is summarised — each section below is its original entry verbatim.** The merge exists because the index
that points at these has a hard size limit: 2 index lines for one subject crowd out 1 unrelated
memories, which then do not load at all. The only thing given up is recalling one of these without the others.

---

# hash-object-proves-content-not-bytes

> git hash-object normalises line endings, so a matching OID proves content identity and not bytes on disk — and the obvious ways to check for CR are all silently wrong in this shell

**`git hash-object` applies the clean filter, so it returns the same OID for a file whose bytes
differ.** Demonstrated 2026-09-04, twice independently:

    lf.txt    6 bytes   de980441c3ab03a8c07dda1ad27b8a11f39deb1e
    crlf.txt  9 bytes   de980441c3ab03a8c07dda1ad27b8a11f39deb1e

⚠️ **This programme's whole mutation-testing method rests on "restore and prove it with a hash".**
That proof is now split in two: `sha256sum` on a copied baseline proves BYTES; `git hash-object`
proves CONTENT only. Both were used interchangeably all night and reported as "byte-identical".
A scripted rewrite that flips line endings leaves the OID matching and `git status` still saying
modified — which is how it surfaced.

⚠️ **Python is a line-ending converter that does not announce itself.**
`io.open(p, encoding="utf-8")` applies universal-newline translation on READ; writing back with
`newline=""` applies none. A CRLF file through that pair becomes LF silently. That is the most-used
patching tool in these sessions.

🔴 **AND EVERY OBVIOUS WAY TO CHECK FOR CR IS WRONG HERE, IN OPPOSITE DIRECTIONS:**

    grep -c $'\r'  on a pure-LF file   -> the LINE COUNT (shell ate the escape, empty pattern)
    grep -cP '\r'  on a CRLF file      -> 0, and -P is unsupported in this shell anyway

The first is what nearly produced "the whole tree has flipped to CRLF"; the second would produce a
clean bill of health. **Both return a plausible number with no error.** The reliable form is to
count the byte in a real program:

    node -e 'const b=require("fs").readFileSync(F); let cr=0; for(const x of b) if(x===13) cr++;'

**How to apply.** For a mutation restore, run BOTH: `git hash-object` for content and a raw CR count
for encoding. And the general rule, which is the fourth instance of its family here after a literal
`\b` becoming a backspace and a `new RegExp` losing a backslash: **anything that turns on a control
character gets counted as bytes inside a program, never pattern-matched through a shell.**

✅ **ANSWERED the same night, and it narrows the exposure: `git status` DOES catch a CRLF-only
flip.** Measured on a real file flipped to CRLF with content unchanged — 6356 → 6562 bytes, `git
status` reported it modified, `git hash-object` matched the HEAD blob exactly. **So the two checks
are blind to different things and together they are complete:** `hash-object` sees content and not
encoding; `git status` sees encoding.

⚠️ **But only where `git status` was actually run.** A restore verified by hash alone, in a session
that never checks the tree, is still unguarded. And the strongest proof of all, where available, is
neither: hold the original bytes in a `Buffer` and compare with `Buffer.equals`.

Related: [[restoring-a-mutated-file]], [[backslash-b-becomes-a-backspace]],
[[the-artefact-you-search-is-not-the-artefact-that-runs]], [[checks-that-cannot-fail]],
[[measure-the-thing-not-a-proxy]].

## ⚠️ AND IT IS TWO REGIMES, NOT ONE — 2026-09-06, measured after I got it half wrong

I hit this on a restore (`hash-object` said IDENTICAL, `git status` still said modified), told a peer,
told the coordinator, and the coordinator was about to write my version into a handover for five
sessions. **My version was true of most of the tree and inverted for the part that matters most.**

Measured with `git hash-object --path`, which applies the attributes of the path you name:

    NORMAL path (`* text=auto eol=lf`, core.autocrlf=input)
        CRLF -> 422c2b7ab3b3c668038da977e4e93a5fc623169c
        LF   -> 422c2b7ab3b3c668038da977e4e93a5fc623169c    IDENTICAL

    `-text` path (Ward Flow: control/evidence/artifacts/**, control/evidence/bundles/**)
        CRLF -> c30dea8a3641ea99b125d04d599d843712292759
        LF   -> 422c2b7ab3b3c668038da977e4e93a5fc623169c    DIFFERENT

**Each regime is protected by a different thing, and they are opposites:**

- **Normalised paths** — `hash-object` is blind to line endings, but **staging flattens CRLF**, so a
  text-mode write cannot corrupt the commit. `git status` is the only tell; the damage is noise.
- **`-text` paths** — staging does NOT normalise, so a byte change **reaches the commit** — but
  `hash-object` sees it there, because it applies the same attribute. **On exactly the paths whose
  bytes are the point, the hash check is the one that works.**

**The rule: the two checks answer different questions, and which is load-bearing depends on the
path.** `git check-attr text -- <path>` tells you which regime you are in.

⚠️ **The meta-lesson, and it is why this is here rather than in the repo:** I generalised a real
measurement from one path to the whole tree without asking where the mechanism applies — the same
error as [[a-measurement-is-scoped-to-what-it-measured]], made while writing a correction ABOUT
scope. A peer's reply combined the bad half of each regime into one scenario, which is what made me
measure instead of agreeing. Related: [[a-correction-that-agrees-with-you]],
[[relayed-numbers-lose-attribution]], [[verify-in-head-not-the-working-tree]].

---

# hash-object-cannot-see-a-byte-change

> A text-mode write flips line endings; git hash-object is blind on normalised paths and byte-sensitive on `-text` paths, so which check is load-bearing depends on the path

I verified restores all night with `git hash-object <path>` against a recorded base. Ward Verifier
hit the failure first: `hash-object` said RESTORED-IDENTICAL while `git status` still called the
file modified. **A Python text-mode write turns every newline into CRLF on Windows** — the bytes
change, the normalised content hash does not.

**Measured, three regimes, same two files:**

    plain hash-object, file outside the work tree     LF de980441   CRLF de980441   BLIND
    --path on a text=auto eol=lf path                 LF de980441   CRLF de980441   BLIND
    --path on a `-text` path                          LF de980441   CRLF b5eff572   SEES IT

**So which check is load-bearing depends on the path, and they are opposites:**

- **Normalised paths** — `hash-object` is blind to line endings, but staging flattens CRLF, so a
  text-mode write cannot corrupt the commit. `git status --porcelain` is the only tell and the
  damage is noise. My commit came out at 16 changed lines, not a whole-file diff.
- **`-text` paths** (here: the two ward-flow control evidence trees, artifacts and bundles) —
  staging does NOT normalise, so a byte change reaches the commit. **But `hash-object` applies the
  same attribute and catches it there.**

⚠️ **I first wrote this note claiming the evidence paths combined the bad half of each — unnormalised
AND invisible to the hash. Only the first half is true**, and I asserted it without measuring.

**How to apply:** write restores in BINARY (read `git show HEAD:<path>` and write raw stdout bytes).
Check `git status --porcelain` as well as a hash: clean hash plus dirty status means line endings,
not an edit. `git checkout -- <path>` is blocked by the protect-ward-flow hook here. See
[[hash-object-proves-content-not-bytes]], [[restoring-a-mutated-file]].

### The cross-check is the only thing that punctures a remedy. 2026-09-09, same day.

Two of us wrote up countermeasures for the above and **each other's were wrong in the half that
mattered — neither of us could have found our own.**

A peer's write-up said a process pre-flight had made an install safe. It could not have: the Windows
process table has **no working-directory field**, so the filter could only ever return all-clear. I
verified that and reported a second floor — the absence does not announce itself, because the
property list is crowded with impostors (`ExecutablePath`, four `*WorkingSetSize*` memory counters).

They then ran _my_ enumeration and found a **sixth** I had missed: a bare `Path`, which returns a
real absolute path on every process. My filter matched `Path` perfectly well and never saw it —
`Get-Member -MemberType Property` (singular) **excludes `ScriptProperty`**, and `Path` is one.

🔴 **THAT BREAKS THE COUNTERMEASURE WE HAD BOTH JUST AGREED ON.** Their rule was _"a name scan is not
a check — read a VALUE from it once."_ It would not have saved me: **a value check audits only the
members you enumerated; it cannot audit the enumeration.** I never reached the value stage. Both
halves are required — **enumerate with no member-type filter, THEN read a value.**

⚠️ **AND THE DEFLATION IS THE BEST PART, VOLUNTEERED BY THEM:** they had not caught the sixth by
better method. **Their default was the plural inclusive `-MemberType Properties`; mine was the
singular. Neither of us knew that was the difference until it was looked up.** What was sent as
diligence was a differing default. **A find is not a method until you can say why it worked.**

**The transferable rule:** _a remedy inherits the credibility of the incident that produced it, and
the only thing that punctures that is somebody else running it._ A lesson written in the voice of
someone just burned reads as hard-won and is not audited. **Ship the remedy to a peer to execute, not
to read** — and separately, ⚠️ **beware collapsing two layers into one sentence**: `Path` exists in
PowerShell and is absent from the WMI schema, so "Win32_Process has a Path" is true and false at
once, and either bare version makes a reader distrust the whole entry. That same two-axes collapse
produced "it is my own folder" (branch owner) against a live session attached to it (occupant) —
twice in one hour, different subjects, same shape.
Related: [[a-control-must-test-the-premise-not-the-measurement]], [[compliance-without-coverage]],
[[establish-the-unit-before-counting]], [[one-word-two-states]].

## The ARG_CONV_EXCL collision that breaks the BACKUP script (2026-09-10, measured)

`bash ~/.claude/scripts/backup-work.sh` fails with **`BACKUP FAILED: bundle create failed`** — and
the cause is not the script. It is `MSYS2_ARG_CONV_EXCL="*"` **exported in the calling shell and
inherited by it.** The script writes to a POSIX destination (`/c/Users/joshs/Backups/...`); with
conversion suppressed, git cannot write there. The same `git bundle create` typed by hand with a
`C:/...` path succeeds, which makes it look like a script bug.

🔴 **THIS COLLISION IS LIKELY, NOT EXOTIC.** `worktree-ownership.md` tells every chat to read Ward
Flow documents with `git show <branch>:<path>`, and the standard fix for THAT on this machine is
exactly `MSYS2_ARG_CONV_EXCL="*"`. **So the instruction every session follows sets the variable
that silently disables the backup** — before a fold, which is when the script is supposed to run.
The script also hides the real error behind `>/dev/null 2>&1`, so there is nothing to read.

**Fix:** `env -u MSYS2_ARG_CONV_EXCL bash ~/.claude/scripts/backup-work.sh`. Verified: 1426 files,
812M, and the branch tip read back **out of the bundle** with `git bundle list-heads` matched the
working tip exactly. ⚠️ **Check that tip.** A bundle can be internally sound and still not hold the
commit you think — `git bundle verify` does not check it, and the manifest must be read from the
bundle, never from a second look at the repo. See [[restoring-a-mutated-file]],
[[protected-work-and-backups]].

## 2026-09-10 — the \b-to-backspace trap fired again, writing a REGEX from a python heredoc

Six `\b` in two new regexes became literal 0x08 bytes in a TypeScript file. **`\s` survived**,
because python does not recognise it as an escape and leaves it alone — **so the file looked
half-correct, which is worse than looking wrong.** The regex still ran and still matched some inputs,
so nothing threw.

🔴 **Re-reading the edit could not have found it: a terminal renders 0x08 by backspacing over the
previous character, so the broken line PRINTS as though the `\b` were merely absent.** What caught
it was one corpus case going red.

**The check that works is on the BYTES, not the rendering:**

    grep -c $'\x08' <file>

**And when generating regex source from python, use a raw string or write the backslash as
`chr(92)+"b"`.** At least the fourth instance, and two of those happened while writing up the trap
itself — which is the same shape as a gate defeated by its own documentation.
