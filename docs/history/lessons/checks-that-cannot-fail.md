---
name: checks-that-cannot-fail
description: "every shape of unfailable guard — tautologies, an it.fails that passes on any error, a precondition verified once, operands that coincide, and a guard that regenerates its tautology when fixed"
metadata:
  type: feedback
---

**Consolidated 2026-09-06 from 7 separate memories on one subject**, written from different chairs across a night of six parallel sessions.

⚠️ **Nothing is summarised — each section below is its original entry verbatim.** The merge exists because the index
that points at these has a hard size limit: 7 index lines for one subject crowd out 6 unrelated
memories, which then do not load at all. The only thing given up is recalling one of these without the others.

---

# checks-that-cannot-fail

> Mutation-test any guard before trusting it; the known shapes of check that reads like verification and cannot produce a red result — including a newly built control, whose default state is vacuous

Before reporting a check as passing, ask whether it _could_ have failed. Four separate defects
in the 2026-08-18 environment session were the same shape — something that reads like
verification and cannot produce a red result:

- **A hook reporting on stderr.** `check-base-freshness.mjs` printed its stale-base warning with
  `console.error`, but Claude Code injects only a SessionStart hook's **stdout** into context. It
  ran, exited 0, and the warning reached nobody for its entire life.
- **`grep` on a file containing a NUL byte.** GNU grep switches to binary mode and prints only
  "Binary file matches", so a `git diff … | grep <pattern>` check returned empty whether or not
  the pattern was present. It "proved" a function was untouched. Redone by byte comparison.
- **A pipeline masking the exit code.** `npm run verify:pr-local … | tail -80` reported
  `exit code 0` while its own summary line said `failed: test (exit 1)`. `${PIPESTATUS[0]}` or
  redirect to a file, never a bare pipe, when the status matters.
- **A tautological guard.** `clean-worktree.mjs` re-checked "0 commits ahead" after its squash
  test, but the counter it used returns 0 for any branch that test just accepted — satisfiable
  only by candidates already skipped.

- **A guard chained behind `grep -c` with `&&`.** A mutation proof ran
  `grep -c "<class>" <file> && npm run test:focused …`. The mutation had stripped the classes, so the
  count was `0` — and `grep` exits **non-zero when it matches nothing**, so `&&` short-circuited and
  **the test never ran at all**. No summary line, and the operator reads as "confirm the mutation
  landed, then test it". Caught 2026-08-24 by the subagent that wrote it, which reported the
  non-run rather than re-running quietly. Use `;` between "prove the mutation is present" and "run
  the gate", never `&&` — the first command's exit status is data about the file, not a precondition.

**The tell that unites the first five:** ask what the check prints when it _fails_, and confirm you have
seen that output at least once. Four of these five produce **no output at all** in the failing case,
which is why they read as passes. A gate with no summary line did not run, whatever its exit code.

## 2026-08-29 — the sharpest general form, from the Ward Flow fold

**Verify under conditions where the verification is capable of failing.** A check run while it is
structurally blind returns the same clean answer as a check run when everything is fine, and nothing
in the output distinguishes them.

Proved by a fold where `git merge-tree` reported three conflicts all day. It compares committed tips
and is blind to a working tree; another branch had four files edited but uncommitted. The moment they
committed, a **fourth** conflict appeared — in the file that counted routes, where both branches held
21 and the answer was 22, so taking either side wholesale would have been confidently wrong. Three
sessions had agreed the three-file answer independently and recorded it in two places.

**A family of the same shape, five instances in one day**, all presenting as disagreements about fact:

- a spec read before and after a correction (disagreement about _when_)
- two branches both with 21 routes that were not the same 21 (about _where_)
- a lint rule read from the docs rather than the config (the docs describe the rule; the config IS it)
- a branch tip read against an uncommitted working tree
- a session store read as a statement about where work had gone

**A record of intent is not a record of outcome.** The session store says where a session _believes_
it is; `git rev-list --count origin/main..<branch>` says whether anything ever landed there — one
command, no self-reports, no memory of who was where. **Prefer the question that settles it over the
question you can most easily ask.**

Two more from the same day worth keeping:

- **A test file that fails to parse subtracts its tests from the denominator**, so `Tests 1002 passed
(1002)` reads as a clean run while 41 tests never existed. Read the total against the _previous_
  total, never the ratio.
- **Mutation-testing a multi-assertion case verifies exactly one assertion** and silently grants the
  others its credibility, because the runner stops at the first failure. A mutation ledger recording
  a case as RED records less than it appears to.
- **A recommended fix is a hypothesis, not a result.** A review hunting checks-that-cannot-fail
  recommended one: `toHaveText([...])` compares `textContent`, not visible text, so it passed with
  `display: none` applied — in the very property it claimed to add.

**Three of nine instances that day were found inside machinery built to prevent the class.** That is
not the machinery failing; it is what it looks like running. The alternative was never fewer
instances, only undetected ones.

## Two second-order lessons from the same day, both sharper than the rules they refine

**A stale baseline mis-calibrates the one check that can see vanished tests.** "Compare the total
against the previous total" is the only thing that catches a test file failing to _parse_ — its tests
leave the denominator too, so `Tests 1002 passed (1002)` reads as a clean run. Every other check in a
suite is blind to that failure by construction. So quoting a total from two commits ago does not just
misstate a number; it disables the sole instrument for that failure mode. **Pin every total to a SHA.**

**A renumbered measurement invents a causal claim nobody checked.** A comment recorded "337 eligible
pairs across 22 units". A 23rd unit had since been added, so changing 22→23 looked like tidying.
Re-measuring gave **342** — and recomputing with the new unit _excluded_ also gave 342, so it
accounted for none of the difference. The edit would have credited the change to the one thing
demonstrably unrelated to it. Where a figure is recorded with its basis, **re-measure or leave it**:
renumbering asserts a cause, not just a value.

**And a gate can be green while the compiler is red.** A merge verified as "the test suite passes"
shipped a branch that did not build: Vitest does not typecheck, and a guard whose whole purpose was
to fail compilation when a record gained a field was doing exactly that. **"It was green" is never a
complete claim — name which green.** Two gates disagreeing usually means they measure different
things, not that either is wrong.

**Why:** two of the original four were mine, and both were caught only because something forced a second
look. Neither would have surfaced from re-reading the code.

**How to apply:**

1. **Mutation-test a new guard.** Inject the regression it claims to catch and watch it go red.
   Done for `tests/claude-code-settings.test.ts`: a broad allow rule, a bare-path hook
   registration, and a missing timeout produced 6 failures, then 89/89 after restore.
2. **Capture real exit codes.** Redirect to a file and echo `$?`, or read `${PIPESTATUS[0]}`.
3. **Prefer byte/structural comparison over text matching** when proving something is unchanged.
4. **Know which stream a hook's output must use** — see [[claude-hook-exec-bit-trap]] for the
   sibling trap in the same area.

**Fifth instance, 2026-08-21 (both in one session):**

- **A lease refusal that exits 0.** `scripts/run-playwright.mjs` printed only "Another Database
  heavyweight command is active (PID …): vitest run" and exited **0** — no spec collected, no
  browser launched, no `N passed` line. The holder had been hung for an hour. Reported as ledger
  issue; contrast `verify:ui`, which exits 1 on admission timeout by design.
- **`npm ci` exiting 0 on a half-installed tree.** 928 MB extracted, 523 top-level packages, but
  no `node_modules/.bin` and no `next` at all. Exit code 0, empty stdout. Only `npm run ensure`
  failing exposed it. `node scripts/setup-codex-worktree.mjs` re-ran the locked install correctly —
  prefer it over bare `npm ci` in a fresh worktree on this Dev Drive.

**Correction (2026-08-21, measured):** do NOT treat "523 packages" as the alarm. A _healthy,
complete_ install of this lockfile shows exactly **523** entries to `ls` and **528** to
`readdirSync` — the gap is five dotfiles `ls` hides (`.bin`, `.cache`, `.codex-installed-tree.json`,
`.package-lock.json`, `.vite-temp`). The real signal above was the **missing `.bin` and `next`**,
not the count. Count anything with `readdirSync`, not `ls | wc -l`, or you will invent a
discrepancy that is pure dotfile accounting.

The standing test for both: **grep for the positive evidence line** (`N passed`, `.bin` populated),
never the exit code alone.

Related: [[ward-flow-verification-lessons]] — green tests that missed a wrong value on every
screen. Same family: the test ran, the test passed, the test proved nothing.

**Sixth shape, 2026-08-25 — the assertion is sound and the RUNNER cannot reach it.**

Caring Contacts Task 6b wrote a source scan proving the caseload's SQL column list does not select a
patient's free-text clinical note. The scan was correct, and its positive control was _not_ vacuous —
a rename or deletion of `PLAN_COLUMNS` goes red rather than passing on an empty match, which is how
this class usually fails. It was nevertheless dead: it lived in
`tests/caring-contacts-postgres-repository.test.ts`, which sits in `caringContactsDbTestFiles` and is
**unconditionally excluded from the offline `node` project** in `vitest.config.mts`. And
`grep -rn "caring-contacts" .github/workflows/` returns **zero hits** — CI runs no caring-contacts
database suite at all. So the guard fired only when a human happened to have Docker Postgres up. It
needed no database: it was a `readFileSync` and a regex.

**Where a check lives decides whether it exists.** The first five shapes are all about what a check
_does_; this one is about what collects it. Add to the standing test: after confirming a guard can go
red, confirm that the command you actually run collects the file it lives in.

The same look found the larger fact, now filed as a P2: **the whole 193-test caring-contacts Postgres
suite never runs in CI**, including every row-level-security and cross-team assertion the shared
contract makes against real SQL.

**Why this one was invisible:** the guard was written _in response to_ a surviving mutation, so it
carried the authority of a lesson learned. Nobody asks whether the fix to a real finding is itself
reachable.

**Seventh shape, 2026-08-25 — the mock was never called, so the test passed inert.**

Writing a test for a `sessionStorage` write refusal, a subagent installed a mock `setItem` that threw
— and the test passed without the mock ever being invoked. **jsdom's storage is a Proxy that answers
from the prototype**, so assigning to the instance property never intercepted anything. The test
asserted the fallback behaviour and got it by accident from the real implementation.

Fixed by asserting **the spy was actually exercised**, not only that the outcome was right.

**The general rule: a test that installs a double must assert the double was used.** Otherwise it
proves the system works when nothing was substituted, which is not the claim. This is the mirror of
the mutation-testing rule — there you prove the change reached the tree, here you prove the
substitution reached the code — and both exist because the _green_ is the outcome you were hoping
for.

**And one prerequisite discovered the same day.** Reverting a mutation with `git checkout -- <file>`
also discards any _uncommitted fix_ in that same file. A subagent lost its real fix that way, caught
it on the presence check, and concluded: **"commit as you go turns out to be a mutation-testing
prerequisite, not just crash insurance."** Commit the fix before mutating the file it lives in.

**Eighth shape, 2026-08-25 — the assertion behind a sibling that fails first.**

A mutation proof ran against a test case holding **two** assertions. The mutation tripped the first
one, the case went red, and the ledger recorded the mutation as proved. **The second assertion was
never reached** — Vitest short-circuits a case at the first failure — so the thing the mutation was
written to prove remained unproved while its row said RED.

Caught by an implementer doing the missing mutation work properly: re-adding a removed input went red
on a sibling `queryByRole` check, so a second mutation was needed to reach the id-list assertion
behind it. Its conclusion:

> **An assertion behind a sibling that fails first is not proved by a mutation that trips the sibling
> — one mutation per case is not enough when a case holds two.**

**How to apply:** when a case holds more than one assertion, either write one mutation per assertion,
or split the case. And when a mutation goes red, check _which_ assertion produced the failure message
rather than accepting the colour — this is the same discipline as
[[read-the-failure-message]], one level down.

**Ninth shape, 2026-09-12 — the assertion ENTAILED by the pins in front of it.**

Sharper than the eighth, and it survives splitting the case. Repairing a dead
`expect(245 - 35).toBe(210)`, I replaced it with the gap read off the rendered row —
`inDepartment - sinceReferral` — which is what the task asked for. **But two assertions above it
already pinned each operand to its literal: `toHaveAttribute(..., "245")` and
`toHaveAttribute(..., "35")`. Given both, the difference is 210 necessarily.** The new assertion was
a _restatement_ of the two above it — the same tautology as the line it replaced, one level less
obvious, and dressed in the language of reading from the DOM.

Two tells, both present and both ignorable:

- **The mutation reddened and named a different assertion** (the literal pin, which ran first). That
  is the eighth shape, and it was the thread that led here.
- **Once the order was fixed, the assertion could fail — which means the ORDER was load-bearing, and
  an assertion whose failability depends on running before its neighbours is fragile by
  construction.** Anybody tidying the case back into "pins first, derivation after" silently restores
  the defect.

**How to apply:** after writing a derived assertion, ask whether the assertions around it already
force its operands. If every operand is pinned to a literal in the same case, the derivation asserts
nothing — **delete the pins, move them after, or assert the derivation against a DIFFERENT
representation** (the rendered words rather than the data attributes they were built from). And when
ordering is what makes a check failable, say so in a comment at the case, because the next reader's
instinct is to reorder it. Kin: [[a-property-whose-operands-can-coincide]],
[[a-test-co-authored-with-the-code]], [[a-green-mutation-only-counts-if-the-mutant-ran]].

**Two companion rules from the same programme, both about what a proof does not cover:**

- **Mutation testing can only falsify tests that exist.** A branch added mid-task that nobody wrote an
  assertion about is unreachable by any mutation, however thorough the ledger. That cost one real bug
  — an in-memory fallback unreachable in the exact case its own comment claimed it handled.
- **For every assertion, name the wrong value it should reject, then confirm it rejects it.** This
  catches the tautology class (a test asserting a length where membership was meant, a regex named for
  a window that admits values outside it). **Its precondition: the check draws "the wrong value" from
  the case's NAME**, so it only works where cases are named for the rule they enforce. A vaguely named
  case yields nothing to name and the check silently returns nothing.

## The inverse: a check you believe is REDUNDANT is a hypothesis too

Everything above is about a check that cannot fail. The mirror error is easier to act on and worse,
because it **deletes** coverage rather than merely failing to add it.

2026-08-25: an implementer classifying its own coverage concluded a `not.toContain` loop was redundant
— an equality assertion above it already pinned the array, so the loop could not add anything. Sound
reasoning. **It ran the mutation before writing the finding up, and was wrong.** Setting one fixture
constant to a different reserved number left the equality **passing, because both sides read the same
record**, and only the loop caught it.

**Before deleting or filing any check as redundant, mutate it and watch it fail.** "Nothing can reach
this" and "this is implied by the assertion above" are the two shapes that look most obviously true
and most often are not — an assertion that reads its expected value from the same source as the code
under test proves nothing at all, which is the tautology class one level up.

See also [[deleting-code-you-believe-is-dead]] territory in `AGENTS.md`: "nothing imports it" is
necessary and nowhere near sufficient. Same instinct, same insufficiency, different artifact.

## The failure mode behind several of these, finally named

> **"Disclosing a limitation feels like completing the audit. It isn't the audit."**

An implementer that had described one unproven assertion at length, and two lines below left another
unproven while calling the case proved, on being asked why. A frank paragraph about a gap reads — to
its author most of all — as though the gap has been handled. It has been _described_. **The more
articulate the disclosure, the more completely it substitutes for the work.**

Watch for it in your own reports: a well-written "known limitation" section is the place a real
obligation goes to be forgotten.

## `grep -cE` on a JSX marker silently returns 0 — the presence check itself can lie

**2026-08-25, and this one undermines the foundation the rest of this file rests on.** "Prove the
mutation is in the tree" is the standing rule; the usual way to do it is `grep -c '<marker>' <file>`.
Reproduced on the marker `min={bounds?.earliest}`:

```
grep -cF  'min={bounds?.earliest}'  → 1  (exit 0)
grep -c   'min={bounds?.earliest}'  → 1  (exit 0)   BRE
grep -cE  'min={bounds?.earliest}'  → 0  (exit 1)   ← false negative
grep -cP  'min={bounds?.earliest}'  → 0  (exit 1)
```

**In extended (`-E`) and Perl (`-P`) mode, `{…}` is an interval quantifier.** `{bounds?.earliest}` is
not a valid interval, and **GNU grep silently declines to match rather than erroring** — returning 0
and exit 1, which is indistinguishable from "the marker is not there".

**This is not one unlucky marker. Any JSX marker containing braces fails the same way**, which is most
of them in a `.tsx` file. A mutation genuinely applied reads as absent, and the honest response — "the
mutation did not land, skip this one" — quietly drops the proof.

**How to apply:**

1. **Use `grep -cF`** for presence checks. Fixed-string mode makes braces literal. Escape braces only
   if a real regex is genuinely needed.
2. **Treat exit 1 as distinct from a count of 0.** A driver that conflates them cannot tell "no match"
   from "grep refused to try".
3. **When grep disagrees with what you believe you just edited, read the file.** The disagreement is
   the signal.

**Two wrong hypotheses worth recording, because both were plausible and both cost time:** the
implementer guessed "the marker contains `{`" — right about the character, wrong about the mechanism,
since under `-F` it matches fine and `-F` is the _fix_. And I guessed a Prettier reflow splitting the
marker across lines; tested, that returns **2** under `-F` (grep splits it into alternative patterns),
an over-count, never a zero. **The signature distinguishes them and neither of us checked the
signature before theorising.**

### Correction, same day: `-F` is not the whole fix — there is a second layer

The `-E`-interval finding above is correct **for an interactive shell**. It is not the whole story
when the presence check is driven from a script. Measured through Python's `subprocess` argv into
MSYS2 grep on Windows:

- `caring-contacts-activation-schedule-summary` → counts **1** (plain identifier, survives)
- `data-testid="…"` → counts **0** (double quotes mangled)
- `min={bounds?.earliest}` → counts **0** (braces mangled) — **even under `-F`**

So switching to `-F` fixed the shell case and did **not** fix the driver, and switching was what
exposed the second layer. **Do not run the presence check across a Python→MSYS2 argv boundary at
all** — read the file in the same process and check the substring there.

**Two further driver defects found in the same pass, both capable of a false green:**

- **An unflushed write.** `io.open(path,"w").write(text)` leaves the close to refcounting. The
  mutation can still be in a buffer when the gate starts, so the gate runs the _unmutated_ file and
  reports green. Use a context manager, or flush explicitly.
- **A reused gate receipt.** `gate-receipts.mjs` memoises lint/typecheck/vitest against a content
  signature, so a **control** run on an unmutated tree legitimately reuses a receipt and exits 0
  **with no summary line** — which reads exactly like a gate that never ran. Run controls with
  `GATE_RECEIPTS=refresh` when the point is fresh evidence.

**The pattern across all three:** every one of them turns "I proved this" into "something exited 0".
The standing rule holds and is the only reliable defence — **grep for the positive evidence line
(`N passed`), never the exit code**, and confirm the mutation is present by reading the file rather
than by asking another process whether it is there.

## The one simplification that survives all of this: a RED proves presence; only a GREEN needs the check

2026-08-26, after the presence check itself turned out to be unreliable (see the `grep` sections
above). An implementer audited its own back-catalogue and found the argument that rescues most of it:

> **A mutation that never reached disk cannot make its own target assertion fail.** So a red on the
> mutation's own named assertion proves the mutation was present. **A presence check is load-bearing
> only for a green.**

That is sound, and it collapses most of the worry — 31 exposed presence checks reduced to one
compromised conclusion. **But it holds only under three conditions, and two of them were discovered
by probing rather than volunteered:**

1. **The failure message names the mutated behaviour.** Otherwise a _different_ assertion in the same
   case may be what went red — see the sibling-assertion shape above.
2. **A green baseline on the same tree, immediately before.** A pre-existing red proves nothing.
3. **A quiet worktree and a deterministic assertion.** A concurrent writer can falsify the target
   assertion — that exact failure voided a whole mutation round in this programme. And a flaky async
   DOM assertion can go red on its own: the same test run that produced this argument contained an
   existence proof, an unrelated virtualization test going red under load with no mutation near it.

**File-content assertions (`not.toMatch` over source) meet condition 3 trivially; async DOM
assertions do not.** The argument's strength varies by assertion class, so record it with the
conditions rather than as the bare sentence.

## Three more, 2026-08-29 — Ward Flow, two sessions checking each other's work

**A mutation that fails to bite is a QUESTION, not an answer.** Proving a fixture guard, I flipped a
seeded person's sex and the suite stayed green. The two tempting readings are "the test is fake" and
"the test is fine". **The third — the probe never exercised the property — looks exactly like both,
and it was the answer:** I had flipped somebody who had already _left_, and a departed person holds no
bed, so the sex mix correctly did not move. Retried against an occupied record: red immediately.
This is the mirror of the presence check. There you ask "did the mutation reach the tree"; here you
must also ask **"does the record I mutated participate in the property at all"**. A no-bite is
un-actionable until you can name which of the three it is.

**`git checkout -- <file>` cannot restore an UNTRACKED file.** Distinct from the known trap that it
discards an uncommitted fix in a _tracked_ one. On a brand-new file it prints `error: pathspec … did
not match any file(s) known to git` and **leaves the mutation in place**; the porcelain listing is
byte-identical before and after, because `??` either way. Only the blob-id comparison caught it.
**Back new files up out-of-tree and restore by copy**, and note the second edge: once a tracked file
has uncommitted work, `git checkout --` would destroy that work, so backups are correct there too.

**A test file whose import cannot resolve never loads — every guard inside it is inert.** Related to
the sixth shape (a file the runner does not collect) but reached differently: the sister session
cherry-picked a fixture and its test without the module the _test_ imported. The file was collected
and died on import, so its assertions — including an anchor-drift guard I had explicitly told them to
take — had never run once, while everyone believed the anchor was protected. **Cherry-picking a
commit does not bring what its tests depend on.** Fixed by decoupling the test from the layer it
reached across, which was the right fix anyway: the assertion was a claim about the fixture, not
about that layer.

**And the sentence the whole session collapsed to:**

> **An absent signal reads exactly like a passing one.**

It is the guard that never ran, a scanner that lost its place and reported clean, a retry loop
exiting 0 while printing "STILL BLOCKED", a memoised gate exiting 0 having executed nothing — and me
committing before reading the test output, which printed nothing and which I only caught while
writing the near-miss up for someone else. Writing it down for another reader is what surfaced it.

## Invariance needs a companion that pins an absolute

New this session, from the same exchange, and it belongs beside the mutation rules.

A test of the form "this number must not change when I vary X" **proves nothing when everything
collapses to one value**. A function refusing everyone is perfectly invariant; so is one accepting
everyone. The sister session's most important test — that distance never gates a bed — survived a
real distance gate for exactly this reason, and its floors closed only the _refusal_ direction.

**The fix is a second test, on a case where the answers SHOULD differ, pinning both absolutely.** Ours
reads `forFemale === 0` and `forMale === 4` on a male-only ward, so uniform acceptance and uniform
refusal each redden the test that owns the claim — rather than being caught incidentally elsewhere in
the suite, which is a weaker position even when it works.

Second-order, and it cost the other session a real defect: **an invariance test is only as broad as
the inputs it varies.** Theirs varied home region; the hidden gate read origin site, and a
gate with an innocuous name slipped the name sweep too.

**And a ninth, 2026-08-29 — `git diff HEAD` exits 0 whether or not anything differs.** It is a display
command; the exit code is not a verdict. **Reproduced in a scratch repo with one modified file:
`git diff HEAD` → exit 0, `git diff --quiet HEAD` → exit 1.** A whole mutation round on the sister
branch rested its restore evidence on the bare form before a reviewer noticed. Use `--quiet` when the
status is the answer. And **do not treat an empty `git status --porcelain` as evidence in a shared
worktree** — with other agents writing, empty more likely means the command did not run as intended
than that the tree is clean.

## The two sharpest generalisations, 2026-08-29 — from two sessions auditing each other

**"The tool built to check is written by the same hands and inherits the same blind spot."**

A registration harness written specifically to defeat absent signals was found to contain two of them:
a retry loop keyed on one failure string (so a different failure read as a real result), and a
`printf` emitting a blank where a grepped test line goes — so a gate that produced **no output** was
indistinguishable from one that passed. This is why the class survives careful people. It is not
corner-cutting; the checker is built by the same mind, at the same moment, with the same assumptions.

**A report whose confidence exceeds its evidence, where the unstated part is the RANGE.**

Two instances in one hour, both by careful sessions, both surviving review until the other side
checked:

- I searched **one directory** for a value and wrote "not hiding anywhere else." Repository-wide there
  were eleven hits. The conclusion happened to survive all ten others — but the sentence claimed a
  breadth the search never had.
- A peer escalated a **governance** finding — an apparently statutory figure pinned in a test — on the
  strength of a grep hit and a variable name, without opening the fixture. The value turned out to be
  `330 + 150`, an offset from an offset, and **never written as a literal anywhere**. Its
  suspicious roundness was an accident of addition.

**The tell in the second case is worth keeping as a technique:** every signal that alarmed the reader
— the name containing "legal", the round eight hours, the pinned assertion — was a property of how the
value was **displayed and asserted**, and none was a property of **where it came from**. Before
escalating on a constant, open the thing that produces it. A real threshold is authored as a round
number; a derived one is authored as arithmetic.

**And the useful asymmetry:** checking cost twenty minutes each; being wrong the other way would have
put a false clinical claim on screen. Raising it was right. Escalating it before opening the fixture
was not.

## Two more, 2026-08-29 — a type that permits the omission, and a tool blind to the tree

**A loosely-keyed `Record` is a check that cannot fail.** Ward Flow's nav icons are typed
`Record<string, LucideIcon>` rather than keyed to the nav-id union. So a nav entry with **no icon
compiles cleanly**, renders `undefined`, and no gate anywhere says a word. Found in passing while
visiting the file for something else. The general form: **when a map is keyed by `string` instead of
the union it is really keyed by, exhaustiveness stops being checkable** — the type system looks like
the guard and has quietly stopped being one. Same family as the `tileClassName` switch in the same
component, which fell through to a wrong branch and drew the literal class `"undefined"` until a
`never` binding was added. Ask of any lookup table: _what happens when a key is missing, and would
anything go red?_

**`git merge-tree` compares COMMITTED TIPS and cannot see your working tree.** I ran it to check
whether four files I had edited would still merge cleanly, and reported that they did. They were
uncommitted, so merge-tree had answered about a version of the branch **in which I had not edited
them at all** — confidently, with no indication the question was unanswerable. A peer caught it by
checking `git log $BASE..<branch>` for commits touching those paths: zero. Meanwhile the other branch
had one commit on each, so committing turns four add/add-free files into modify/modify on both sides,
and whether they conflict is **not knowable until the commit exists**.

**The order that makes the answer mean anything: commit, THEN merge-tree, THEN report.** And the
generalisation, which is this file's thesis arriving from a new direction: _before trusting a tool's
answer, confirm the artefact it reads is the artefact you changed._ Cf. the reused gate receipt, the
unflushed write, and the stale `.next` build — all the same shape.

### `grep` without `-i` reports an absence that is not there

2026-08-29, and it is the mirror of the `-E` brace trap above — that one loses a match you know
exists; this one manufactures a _negative result_ you then report as a fact about the file.

Asked whether a rule existed in a document, I ran `grep -n "verbatim"`, got one hit, and wrote "no
such rule exists". The rule was on a line beginning **"Verbatim rule unchanged; no agent may alter
them."** `grep -in` returns two hits. A single missing flag turned a present rule into an absent one.

**The tell is that I reported a property of my search as a property of the document.** "My grep found
one" and "there is one" are different claims, and only the first was ever established.

**What made it survive review — and this is the part worth keeping.** The false version was the
_better story_. It let me write "armoured by the heading alone, no separate rule needed", which is a
sharper sentence than the messy truth of three overlapping layers, and it fitted the lesson I was
already drawing. See [[check-the-conclusion-that-flatters-the-theme]]: the peer's version was also
wrong, also toward _their_ own account, and **neither of us verified the step that made our own
telling stronger.**

**How to apply:** search case-insensitively before reporting an absence; state the range and the
flags with any negative result; and when a finding makes your current thesis tidier, that is the one
to re-run rather than the one to write up.

**A rule that says "expect this to change" is not a mechanism for noticing that it has.** The Ward
Flow handover recorded the owner's stay bands as `verbatim`, under a heading saying his decisions
must not be re-litigated, **and** carried a separate rule stating those lists were _liable to change
— expected to become more specific_. He replaced the bands nine hours later. The document had the
foresight and no trigger, so its stale line went on instructing readers to "restore" the superseded
set, armoured by the very apparatus written to protect his decisions. **Anticipating a change in
prose does nothing; only something that fires when it happens does.** A more useful failure than
never having thought about it, and harder to see for exactly that reason.

**A case-sensitive `grep` deleted the rule from the record.** `grep -n verbatim` on that handover
returned one hit; `grep -in` returned two, because §7 capitalises it. The absence was then reported
as a fact about the document rather than a fact about the search — and it survived scrutiny because
the narrower result made a _better story_ ("armoured by the heading alone, no separate rule needed")
than the truth. Cf. [[check-the-conclusion-that-flatters-the-theme]]: the step that strengthens your
own account is the step that goes unverified. **State the range with the result — flags, paths,
case — or the conclusion silently inherits the search's limits.**

**Caveats must name their own gap or they are disclaimers.** "This does not witness the band ids" is
falsifiable, and someone can go and check; it is what led to the stale-document find above. "This may
not cover everything" cannot be acted on by anyone, including its author — it protects the writer
rather than informing the reader, which is disclosure substituting for the work. **A caveat that
names what it misses is a lead; a vague one is cover.**

**"The suite is green" does not mean the branch compiles.** After the Ward Flow fold, condition 7
was "the ward suite green" and it passed — 70 files, 1043 tests, verified at the SHA. The branch did
not typecheck. **Vitest does not typecheck**, so a whole class of breakage sits outside the condition
that was written to catch breakage. The failure was `tests/ward-travel-grouping.test.ts`, whose
helper writes out every `Admission` field deliberately _so that a new field breaks compilation
rather than silently defaulting_ — and the fold added two required fields. A guard firing exactly as
designed, invisible to the gate that was supposed to be the proof.

**Any "the tests pass" condition needs a typecheck leg beside it.** It is cheap, offline, and this
fold produced a real instance on its first run. And note the shape: the two gates disagreed because
they _measure different things_, not because one was wrong — which is why "it was green" is never a
complete claim without naming which green.

**A baseline quoted from two commits ago describes neither commit.** The same session told an agent
the previous totals were 70 files / 1043 tests; two commits had landed since and the real baseline
was 71 / 1048. The agent proved it from `git diff --name-status` (no test files added or deleted
against its own +5 delta) instead of accepting the number. **Pin every total to a SHA**, because a
remembered total is the instrument used to detect vanished tests — and a stale one silently
mis-calibrates the only check that catches a file failing to load.

## The check that expires through somebody's ordinary correct work

2026-08-29, Ward Flow. A session about to name a decision namespace `RF-` checked first and found
`RF-001` was already a synthetic **referral record id** in three documents. A decision `RF-1` beside a
record `RF-001`, in the same files about the same subject, would have been worse than a plain
collision: **both readings stay plausible, so the reader gets no error — just a slightly wrong belief
they never notice forming.**

The catch was good. The generalisation is the part worth keeping. `RF-` was caught because `RF-001`
exists **today**. A prefix like `MH-` or `ED-` would pass the identical search against current
fixtures and **still become a collision the moment someone adds a record**. So the question is not
"is this prefix unused" but "could this prefix ever plausibly be a record namespace" — prefer one
that could not. That converts a point-in-time search into a durable property.

**Why this belongs in this file, and how it differs from everything else in it.** Every other
expiring check here expires through a mistake or an omission. **This one expires through somebody
doing ordinary correct work.** A colleague adds a fixture, does everything right, and silently
invalidates a decision made months earlier in a different document. There is no moment at which
anyone did anything wrong, and no signal at the moment it stops being true — so no amount of care by
any individual would have caught it, and nothing will ever fire.

**The general form:** when a check's validity depends on the current contents of something other
people are expected to grow, it is not a check — it is a snapshot with a check's confidence. Either
restate it as a property that survives growth, or accept it will expire without telling anyone.

## A correct principle applied to the instance in front of the author

Same day, same codebase. `initialDraft()` in the referral form pre-answers all nine fields. One field
— `urgency` — carries a comment saying a blank form must never read as an assumption about how urgent
a request is. **Exactly right, and applied only to the field the author was looking at.** Age band,
sex, home region and origin site take option zero in silence, and those are four of the five
person-facts a referral carries.

**The author was more careful than average, not less.** Being the person who saw the danger is
precisely what scoped the remedy to where they were looking. That distinction is not politeness — it
is load-bearing on whether the fix is checkable: **a remedy aimed at attention is unfalsifiable**
(nobody can demonstrate they were attentive enough, so it has no completion condition), while a
remedy aimed at **stated range** — "this applies to every field in this function, and here is the
assertion" — either passes or fails.

So when a good principle is found narrowly applied, the useful question is never "why was this
missed" but **"what is this principle's range, and what test states it?"**

## A check phrased as "which of these is right?" can never answer "none of them"

2026-08-29, the sharpest instance yet, because it defeated a warning written specifically to prevent it.

Five sessions carried a documented branch-name trap: _three branches are named
`claude/ward-flow-ward-board*`; only the unsuffixed one carries work._ It came with a command, it had
been verified, and it was believed by everyone. **It was false.** The live branch was
`claude/ward-flow-print-fixes` — named after a task that grew into the board work and never got
renamed — and `claude/ward-flow-ward-board` was ahead 0, behind 40, dead.

**The warning could not catch this, because its premise was the error.** It asked which member of a
set was live. Once the answer moved outside the set, the check returned a coherent, confidently wrong
answer with no error, to everyone who ran it.

**Correction, made within the hour by a peer, and it is the same trap one level up.** My first
account said four sessions spent a day naming the wrong branch. **False, and it flattered the day's
theme, which is why I did not check it.** `claude/ward-flow-ward-board` _was_ the live branch and was
correct every time it was named — until `899917421`, the fold that took it as a parent and absorbed
it. Its 0-ahead/40-behind is what a **fully merged** branch looks like, not an abandoned one. This is
documentation decay at an identifiable commit, not carelessness.

**Why the correction matters practically:** "four sessions were careless" invites a remedy aimed at
attention, which cannot be checked and was not the failure. The remedy that works is mechanical —
**a fold that absorbs a branch updates the registry row in the same commit.**

**And the correction makes the finding stronger.** The check was _correct when written_. Its
enumerating shape is what made its decay undetectable afterwards — so a check of this shape is not
merely wrong when the world moves; it is **unable to report that it has stopped being right**.

**The fix is a question about identity, not about membership.** Ask the thing what it is:

```
git -C <worktree> rev-parse --abbrev-ref HEAD
```

A worktree cannot be out of date about its own branch. A registry row, a session store, a
plausible name and a verified-once list all can.

**The general form, and it is worth applying beyond branches:** a check that enumerates candidates
inherits the assumption that the right answer is among them. Whenever a check is phrased as a choice,
ask what it returns when the truth is not on the list — if the answer is "the least-wrong candidate,
stated confidently", it is not a check.

## "Displayed on no screen" is not "safe to remove" — grep the tests before the source

2026-08-29. My own referral plan recommended deleting `originSiteCode` from the form, on evidence I
had gathered properly: two agents confirmed it is rendered on no screen in the application. **True,
and insufficient.** Checking the plan against the code before handing it over found:

- a guard test asserting the form offers every network site as an origin option, **whose own title
  names it "the four-time defect class this phase keeps hitting"**;
- the _does-not-swallow-refusals_ test, which provokes its rejection **through that very field**;
- a comment in `ward-distance.ts` recording that distance is **never** taken from it — a decision
  that would have been orphaned and re-derived by the next person.

So removing it would have deleted a guard against a four-times-recurring defect **and** the proof
that refusals surface — the fold's exact failure shape, in a plan written by the session that keeps
writing that lesson down.

**This sits one layer above the repo's existing dead-code rule** that "nothing imports it" is
insufficient. A display audit is a _different_ insufficient check with the same feel of completeness:
it answers "does a user see this?" when the question is "does anything depend on this?" — and tests,
comments and derivations all depend without displaying.

**The real count, measured after a peer challenged my figure: 10 test files and 7 source files.** I
had said "a guard test" and "the refusals test" — two. The full set includes travel bands, travel
grouping, network referral placement, referral matching, morning rollup, board derivations, and
**`ward-legal-figure-guard.test.ts`**, the Mental Health Act figure guard. **I under-reported the blast
radius of my own error by a factor of five, in the message correcting it.**

**The cheap check that catches it: grep the tests for the symbol before the source.** One command,
and ten files is a far louder signal than any display audit returns. A test that names a field is a
contract; a test whose _title_ names a recurring defect class is a contract with a history, and
deleting it is never incidental to a tidy-up.

**And the generalisable tell:** I trusted this because it came from careful work — two agents, a real
finding, verified. **Evidence being sound is not the same as being sufficient for the conclusion
drawn from it**, and the gap is widest when the evidence was expensive to gather.

## Reducing a safeguard: the difference between a decision and an excuse

Two positions collided today and both were right, which is what makes the boundary worth writing
down. I dropped four of the owner's seven fold conditions for a second merge, because the hazard
they addressed — files changed on both sides, where the wrong resolution looks green — was
**measurably absent** (that count was zero). A peer then argued the opposite when I reasoned, in the
moment, that "both trees clean" did not bite for a fast-forward: **"a condition kept only when it is
load-bearing is a condition that has to be re-argued every time, and the argument will eventually be
made by someone in a hurry with a worse case."**

Both hold, and the line between them is not the strength of the argument — a good argument is
exactly what an excuse looks like. It is these three, all of which the first case had and the second
lacked:

1. **Written down BEFORE the moment**, not reasoned out while wanting to proceed.
2. **Put to the person who set the condition**, in the words they would hear — _"I cut your seven to
   four"_ — rather than approved as a summary that omits it.
3. **A measured trigger for restoring it**, stated as a number somebody else can check, not as
   future judgement.

Without all three it is not a reduced condition, it is a skipped one with a rationale. And the tell
is timing: **the reasoning arrived when the condition became inconvenient.** In the second case the
cost of keeping it whole was minutes, which is the other half — a condition is cheap to honour
exactly when honouring it feels pointless.

Related: a condition that survives only until it is inconvenient never existed.

## A rule violated by its own author, twice in one day

2026-08-29. The board session broke _"ask the worktree, never infer the branch from a name"_ **in the
message that stated it.** I minted a new principle for one the project already held **while holding
the rule against exactly that.** Two independent instances in a day is the difference between a slip
and a property.

**Holding a rule makes you fluent in it, not governed by it.** It is available for stating and not
consulted before acting, because acting never feels like the moment the rule is about. **A rule needs
a moment that forces consultation** — a command, a commit check, a question answered before
proceeding. Every rule that has held here has one; every rule broken by its author was a disposition.

**And: an ambiguous rule is worse than a thin one.** Ward Flow's conservative-failure rule said an
unresolvable record _"renders as absent"_ — _shown and marked absent_ is the rule, _disappears_ is the
bug. **The sentence returned "compliant" for the defect it forbade.** The plausible diagnosis
("too abstract, add examples") would have repaired the wrong thing. **When a rule is rediscovered,
read it as an adversary before reaching for examples:** rediscovery means too thin, but a defect that
satisfies the rule's own words means ambiguous, and those need opposite fixes.

## A denylist of exact names is defeated by any prefix

Ward Flow's structural privacy guard compared field names against the exact string `"diagnosis"`.
When `tentativeDiagnosis` was added, the guard did not fail — `tentativeDiagnosis !== "diagnosis"` —
so a clinical field could have shipped with **every assertion in that file green**. It was the first
time the protection had been exercised and it would have been walked around rather than passed.

**`tentativeDiagnosis`, `provisionalDiagnosis`, `diagnosisDetail` all clear a list containing
`diagnosis`.** A guard built from full names guards only the names somebody already thought of —
which is the set that was never the risk.

**Fix:** match on STEMS anywhere in the name, and allow specific fields through BY NAME with their
ruling and date, so each exception is a decision rather than a gap. Proved by mutation rather than
by reading: adding `notes` must produce "declares an unauthorised person-fact field: notes".

Same family as a route-count canary that a one-character edit silences: **the check is only as wide
as the enumeration behind it, and an enumeration of known-bad values cannot see a new one.** Prefer
allowlists of what is permitted over denylists of what is not, wherever the permitted set is the
smaller and more stable one.

## A retraction is a claim, not a safe direction

2026-08-29, from the session that did it twice in a day: _"withdrawing felt like the rigorous move
… it is not a direction; it is a claim, and it needs the same evidence as the assertion did."_

One retraction struck a finding that was **true**. The other withdrew a recommendation that was
**half sound**, on the reasoning "I had no standing" — which would mean withholding judgement
wherever it touched something the owner had written.

**Asserting feels like taking a risk; retracting feels like removing one**, so a retraction passes
review unexamined while the assertion before it was scrutinised. But _"that was wrong"_ is a positive
claim about the world, and an unevidenced one destroys something true while looking like diligence.

**Before withdrawing: state what would have to be true for the original to be wrong, and check it.
Then withdraw the part that is wrong, not the whole thing** — over-withdrawal is commonest, because
finding the boundary of an error takes thought and taking it all back does not.

**The tell: a retraction that costs you nothing.** Real corrections name a specific error and leave
the rest standing.

## Reclassification keeps the identifier green while the meaning changes underneath

2026-08-30, found by mutation on `tests/ward-handover.test.ts`. Two assertions sit together:

```
placementGoneWrong.map(e => e.movement.id)  ->  ["WF-009"]
placementGoneWrong[0]?.kind                 ->  "escalated"
```

Remove WF-009's escalation record and the patient does NOT leave the list — it is **reclassified** as
`declined_by_all` and stays. So the id assertion, the prominent one, stays green under a defect that
changes what the handover MEANS clinically ("somebody rang round and recorded who they tried" becomes
"the network refused it and nobody is recorded as having acted"). Only the second line notices.

**The failure mode is the pairing, not either line.** The assertion that fails makes the file look
covered; the one doing the real work sits beside it with no message and no prominence. A reviewer
reading the green id assertion concludes the list is guarded, and it is — for membership, which was
never the thing at risk.

**Look for this wherever a record can change CATEGORY without changing IDENTITY** — status, kind,
reason, tier, stage. Membership assertions are blind to it by construction.

## Predict BOTH branches when you genuinely cannot tell which way it falls

Before that mutation I wrote down: "either the list empties (my message fires) or WF-009 is
reclassified (only `kind` fires)". The run picked the second. **A two-branch prediction is not a hedge
— it is the only honest form when a reclassification could go either way, and it is what stopped the
green id assertion being read as a pass.** A single-branch prediction that misses forces a choice
between admitting the miss and quietly reinterpreting the result; the second is easier and invisible.

Related: a green from a suite that does not exercise the thing is an **absent signal, not a passing
one**. I mis-aimed a mutation at `referralEligibility` instead of `eligibility`; three suites stayed
green and the honest reading was "no evidence", never "no problem".

## A number nothing reads can be wrong indefinitely, and people act on it

`tests/ward-escalation.test.ts` carried "123 eligible movement/unit pairs" in a comment. The real
figure is **98**. No assertion reads a pair count, so nothing was ever red and nothing ever could be.

**How to tell an error-when-written from drift-since, which have different obligations:** four other
figures in the same measurement re-measured unchanged (342 standard pairs, 9 stranded, 23 units, 41
open). A fixture that moved one total by 25 could not leave four others identical — so it was wrong
when written. Drift would have obliged re-verifying everything downstream; an authoring error obliges
only correcting the comment. **Record the correction with both figures and the date; never swap the
number and keep the date** — same family as the stale "22 units" comments, load-bearing on human
judgement rather than on any gate.

## The clean reading that means danger: custody is granted, never inferred

2026-08-30. A session ran a mutation probe in a shared worktree — breaking a file four ways,
**restoring between each step**. **So the tree reads clean at exactly the moments it is most
dangerous to touch**, and no git command distinguishes that from genuinely idle.

`git status --porcelain` empty is a fact about **one instant**. Custody is a fact about **a
process**. Identical output, different questions.

**Rule: only the holder can say a tree is free, and only after its own work has stopped. A clean read
plus no handover line means wait.**

**The same error with the tense changed:** "it is free" and "it will be free" flatten into one
sentence, and **the reader takes the one that permits action** — not from carelessness, but because a
message that permits action is read as permitting it. Same shape as saying "the questions are mine to
put" when they had already gone. **Say the state AND its time, never the state alone.**

**The general form, worth more than the git case:** a signal that is absent during danger and present
during safety **is not a safety signal, it is a coin.** Before trusting an all-clear, ask what the
indicator does _while the hazard is active_. If that is the same as what it does with no hazard, it
is measuring something else.

## A check that picks ONE candidate can never report that it picked the wrong one

Added 2026-08-30, after it appeared twice in one day in two completely different forms.

**In a shell pipeline.** A session verified a document fix with
`git ls-tree -r --name-only $ref | grep "superpowers/plans.*2026-08-29" | head -1`. **Two files match
that pattern.** `head -1` took the wrong one — and that file had been _added by the very commit under
examination_, so landing the fix is what broke the check for the fix. It reported 0 hits on every
branch, confidently, and the session was composing a message saying my evidence did not reproduce.

**In prose.** The worktree registry enumerated three `claude/ward-flow-ward-board*` branches and
asked which was live. When the live work moved to a branch outside that family, the question could
not answer — it returned a confident wrong answer, with no error, to every session that asked.

**The shape: `head -1`, "the first match", "the obvious file", "which of these is it?" — each
discards the alternatives and returns an answer about something you did not ask about.** No error, no
empty result, no ambiguity marker. The output of the wrong file is shaped exactly like the output of
the right one.

**A check phrased "which of these is it?" cannot say "none of them". A check phrased "take the first"
cannot say "there were two".**

**Operational form: print every match AND its count before using one; if the count is not 1, the
question is not properly asked yet.** The count is the part that fails loudly — `head -1` on two
matches and on one match produce identical-looking output.

## A NEW control cannot fail by default — three built in one night, all three vacuous

2026-08-30, three sessions, one night: a test written to guard a plan-banner rule matched nothing and
stayed green under mutation; a checklist written to prevent exactly this was stranded where nobody
read it; and a citation checker written _inside a document about controls that cannot fail_ printed
`0 SHAs, 0 unresolved, 0 missing` and **exited 0 against a corpus it never reached**.

**That is not three careless nights. It is the default state of a newly built control.** A guard
nobody has watched fail is indistinguishable from a guard that cannot fail, and the moment of
greatest confidence — just after writing it — is the moment least evidence exists.

**The commonest sub-shape: an empty scan reports as a clean scan.** Zero files matched, zero tests
collected, zero citations found — each is arithmetically identical to "nothing wrong" and means
something entirely different. **Give it its own outcome.** The ward test wrapper refuses zero
collection; the citation checker gained a third exit code (0 resolved / 1 a citation failed / 2
REFUSED, the scan never reached a corpus) for the same reason.

⚠️ **And the first fix for it reintroduced the fault one layer down** — an absent directory threw an
uncaught `ENOENT` and exited 1, which in that tool already meant "a citation did not resolve": two
unrelated situations sharing one exit code. Caught only by running the canary instead of trusting the
patch. **Prove every outcome a tool claims, not only the one you were fixing.**

**How to apply:** before reporting any new guard as working, make it go red on purpose and watch it.
Then ask separately what it does when it finds _nothing at all_.

Related: [[read-the-failure-message]], [[measure-the-thing-not-a-proxy]],
[[observations-expire]].

## ⚠️ A deferral's cited safety net is the least-checked part of it

2026-08-30. A docblock deferred fixing four urgency pickers, justifying it on the grounds that all
four surfaces "carry their own pinned tests". **They did not.** Verified at the parent commit: no
test anywhere referenced `ward-change-urgency`, so two of the pickers had zero coverage.

**So the deferral was not a judgement about risk — it was a judgement about risk made against a
false fact.** And it read as the _careful_ kind of deferral precisely because naming a safety net
is what care looks like. Nobody re-reads the reassuring clause.

**It paired with a second absence on the same field the same night**, and the pair is the mechanism
rather than bad luck: an element that is never rendered means **no test can assert it appeared**; a
control nothing references means **no test can report it is unguarded**. Both absences are
_unreportable_, not merely untested.

**The rule: when a deferral cites a mitigation, verify the mitigation exists before accepting the
deferral.** Applies equally to "covered by X", "guarded by Y", "the gate catches this" — the named
safety net is the most persuasive sentence in the argument and the least often looked at.

Sibling: [[assert-only-about-code-you-opened]], [[measure-the-thing-not-a-proxy]].

## The constructive inverse: record a finding WITH the thing that will contradict it

2026-08-30. Everything above is a claim nothing could ever refute. The counter-pattern was built
twice the same night and **both fired, for the right reason, within hours.**

- **A self-invalidating pin.** A referral form told clinicians _"the suburb is not recorded on the
  referral"_ — true, and true only while the model lacked that field. The pin asserts **the sentence
  is on screen WHILE the field is absent.** When the field landed, it went red with a message naming
  the testid, quoting the sentence, and saying to rewrite the note _and_ the test rather than delete
  either. **The claim's expiry date was enforced by the claim itself.**
- **A staleness canary on a finding.** An implementer found a screen's inbox unreachable, and pinned
  the finding **together with an assertion that fails once the inbox is reachable.** Seeded data
  arrived an hour later; the test said _"the reachability finding is stale"_ instead of sitting green
  over a superseded claim.

**Why it works, and it is not diligence:** it requires nobody to remember. A note, a comment, a
ledger row and a deferral all decay silently, and the reader who would notice is the one who never
arrives. **A pin fails on the exact commit that makes it wrong, and hands the next person the
reason.**

⚠️ **The rewrite is the part to get right.** When it fires, the temptation is to delete the
assertion, because the claim it guarded is genuinely obsolete. **Invert it instead — pin the new
truth against the fact that now makes it true.** A pin that can no longer fail is worse than none:
it looks like coverage.

**Strongest form yet, because it generalises past one finding:** a test that reads a type's field
names out of the model and requires each to be written by the event that creates it — so a field
with no producer is caught the day it is added, by nobody remembering anything. **Three fields
landed with no producer that night** (`edId`, `purpose`, `triagedAt`); each passed typecheck, passed
every test, and read as complete. **The only symptom is a screen rendering its absent branch
forever, which looks exactly like correct handling of a legitimate case.**

**Prefer an identity over a count whenever one exists** — a blob hash, a compile error, a type. Two
sessions independently miscounted the same file within thirty seconds that night (a key-name grep
over a table of tuples returning `2` for 537 rows); the hash across three refs settled it instantly.
**That is not carelessness, it is the default way of reaching for evidence.**

### The third variant, and the hardest to see: the code is right and the FIXTURE is silent

Same night, one layer along from the no-producer class. A referral clock had two branches — running,
and stopped once the patient is triaged after being referred. **Both branches were written, both had
hand-made unit tests, the derivation was correct and typecheck was clean.** Nine seeded referrals
existed. **Every one of them was `running`.** So half the code could not reach a screen.

⚠️ **Nothing in a derivation, its unit tests, or the compiler looks at what the SEED actually
contains.** The no-producer case is "the field cannot be written"; this is **"it can, and no seeded
case does"** — and it is harder to see, because everything the author owns is green and correct.
The owner of the derivation said outright they could not have found it from their side.

**The near-miss that hid it:** one seeded row _did_ carry the field, which made the case look
covered — but it was the opposite shape (triaged BEFORE referral, so correctly still running).
**A fixture that exercises a field is not a fixture that exercises a branch.**

**Remedy:** seed every shape a union or a boolean branch can take — here absent, running, stopped —
and pin the one that was missing, since the other two looked like full coverage on their own.

### And the transmission rule, which is why these travel

Four wrong numbers and one stale claim reached me that night **inside reports full of carefully
verified work**, and I nearly relayed every one. ⚠️ **The verified material around a statement does
not merely fail to vouch for it — it suppresses the impulse to check it**, because the surrounding
evidence sets the reader's confidence for the whole message. Same asymmetry as a correction spending
its authority on the next sentence.

**Practical form: check the figures and side-claims in the messages you AGREE with first.** A number
in a claim you doubt is already going to be checked. **A number in a claim you endorse is the one
that travels onward under your name.**

## ⚠️ The mutation harness fell into the class it exists to catch

2026-08-31. A mutation whose anchor string matched **more than one place in the file** was REFUSED by
the harness. The refusal printed, and the test run that followed passed — **for no reason at all,
because nothing had been mutated.**

**A refused mutation is a NON-RUN, never a pass.** It is an absence that reads as a pass, inside the
one tool whose entire purpose is proving a check can fail. **Nothing downstream can catch it:** the
suite is green, the exit code is 0, and the only evidence is a refusal line above the result that
looks like housekeeping.

**The discipline that survives it — verify APPLICATION, not the exit state:**

```bash
# BEFORE the run: prove the mutation is in the file
grep -c "<original>" <file>   # want 0
grep -c "<mutant>"   <file>   # want 1
# AFTER: read the assertion, not the colour — right test, right reason
# RESTORE: reverse the edit, prove identical with git hash-object
```

⚠️ **And do not repeat someone else's mutation evidence as evidence.** A relayed "four mutations,
each failing exactly one test" is a claim ABOUT evidence, not evidence — the temptation is strongest
when the claim is flattering to its author. Verify it, or label it unverified.

## An existence probe whose FAILURE prints something is a probe whose failure looks like data

2026-08-31, copying 30 ward documents between branches. The probe was
`dst=$(git rev-parse "HEAD:$f" 2>/dev/null || echo absent)`, and it reported **every** file as
differing — including files that do not exist on that branch at all.

🔴 **`git rev-parse HEAD:<missing-path>` PRINTS ITS ARGUMENT to stdout and then exits 128.** So the
variable held the literal string `HEAD:docs/…` where a hash should be, the `|| echo absent` branch
never ran, and nothing ever compared equal. `git cat-file -e <rev>:<path>` prints nothing and can
only exit 0 or 1.

⚠️ **IT FAILED IN THE SAFE DIRECTION BY LUCK, AND THAT IS THE WHOLE ENTRY.** "Differs on
everything, including files that are not there" is absurd, so it stopped me. **Had `rev-parse`
echoed anything that compared equal, the probe would have reported all thirty already identical, the
copies would have been skipped, and success reported** — a destructive-adjacent operation silently
not performed, with a green report.

**The rule:** for an existence check, choose a command that can only SUCCEED OR FAIL, never one that
returns a value which might be mistaken for the answer. `cat-file -e`, `test -f`, `ls-tree` with an
emptiness check — not anything that prints on the failure path.

**Fourth member of a family** that also holds the refused mutation whose tests then pass, the guard
inspecting an arm no fixture produces, and the file truncated to zero before the write that failed.
Each is a check whose failure is indistinguishable from its success.

⚠️ **And it came from an instruction, not from carelessness** — a peer's verification instruction
named `rev-parse` specifically. Finding the flaw in a command you were told to use is the harder
direction to look, and the one nobody is assigned.

## Four additions to the section above, from the other side of that fold (2026-08-31)

**The section above was written by the peer session; this extends it rather than repeating it.
Checked first — the shared memory store means a duplicate costs the next reader findability.**

**1. The family reduces to one question you can ask of ANY check before trusting it:**

> ⛔ **What would this PRINT if it failed, and could I tell that from what it prints when it
> passes?** ✅ **If you cannot, the check is decoration.**

**2. ⚠️ Verify the COMPLEMENT, not only the target.** In the same operation: the peer verified
that 30 copied files matched their sources; I verified that the other 97 had NOT moved.
**Its check catches a file that failed to copy. Mine catches a file copied that should not have
been.** ⚠️ **Neither can see the other's failure, and only running both closes it.**

**3. ✅ Test a probe against a case whose answer you already know**, before trusting it on a batch.
The bad probe was run straight onto thirty files; one known-absent and one known-present file would
have exposed it in a second.

**4. ⚠️ Taking ALL the blame for a bad instruction removes the second lesson.** I recorded the
unsafe probe as entirely my fault for naming `rev-parse`. The peer declined that and asked for both:
**naming a command whose failure prints, and failing to test the probe, are two errors with two
different remedies.** ✅ **Its own reading is the sharper one: _"the absurdity is what saved it, not
my diligence — I would have shipped it had the output looked plausible."_**

---

## `vi.resetModules()` does not clear the mock registry (2026-09-01)

A test named _"...when run against the repository's real data"_ called `vi.resetModules()` and then
dynamically imported the module under test — and silently got the **mocked** dependency a previous
test had registered with `vi.doMock`. `resetModules` clears the module cache; it does not
deregister mocks. So the one test whose whole purpose was to run against real data ran against a
two-item fixture, and **could not fail**.

Caught only by mutation: reverting the matcher to the naive implementation turned the synthetic
test red and left this one green. A "real data" test that survives a mutation the real data would
expose is the tell. The fix is `vi.doUnmock(<specifier>)` before `resetModules()`.

**The general shape: a test that names its own scope in its title is asserting nothing about that
scope unless something forces the scope.** Check what it actually loaded, not what it is called.

## A control run where the positive case cannot exist — 2026-09-02

A peer offered a fold on the grounds that a function had no callers, and backed it with a control:
_"my own caller IS in that grep's results, which proves the query would have found a caller if one
existed."_ ⚠️ **It was not and could not be. Its caller lived on a DIFFERENT branch. Run against
the branch it named, the query returned only the definition — the same empty answer it would return
whether the instrument worked or not.**

Its conclusion was right and its evidence was void. **Re-run on the tree where the caller actually
lived, the control discriminated immediately.**

**The refinement is small and it is the whole thing: naming the tree is not enough. Ask whether the
POSITIVE CASE CAN EXIST on the tree you are running the control against.** A control is only a
control where the thing it is meant to detect is reachable.

⚠️ **This is the anti-vacuity failure appearing INSIDE the check built to prevent one** — and it was
caught only because I ran the control myself instead of reading the peer's account of it. **Reading
somebody's control is not running it.**

## Writing a finding down does not stop you committing it

Same night. A peer catalogued a specific defect in the morning — a CSS custom property referenced
without being declared and without a fallback, which makes the declaration invalid at computed-value
time, so the background silently vanishes, the warning stops looking like a warning, **and every gate
stays green**. **Hours later it nearly shipped that exact defect, in the file it was editing.**

It caught it by checking the token existed instead of assuming. Then, checking the rest, it found
three more — tokens declared only inside another module's scope, undefined on this page.

⚠️ **A REGISTER ENTRY IS NOT A SAFEGUARD. It is a description of a safeguard somebody still has to
perform.** The register tells you which act to perform; it does not perform it, and having written it
creates a feeling of coverage that is not coverage.

**And its first token check was scoped to one file and reported three false positives until widened
— a narrowed check, inside the tool being used to check for narrowed checks.**

Siblings: [[compliance-without-coverage]], [[a-working-safeguard-leaves-no-trace]],
[[measure-the-thing-not-a-proxy]].

## An assertion that lists the wordings you thought of — 2026-09-02

A test guarded a real safety property: **the screen must never claim two dates of birth differ when
the field is blank.** It asserted `/different date of birth|dates differ/`. **A mutation wrote _"The
date of birth is different"_ and walked past both.**

⚠️ **A LIST OF PHRASINGS SOMEBODY IMAGINED IS NOT A CHECK ON WHAT THE SENTENCE CLAIMS.** The
denylist can only ever contain the wordings its author happened to think of, and the thing it is
guarding against is _any_ wording. **It is a check that passes by default and fails only on a
coincidence of vocabulary.** Rewritten to assert the property — with the field blank, no form of
"differ" can be true here — it reddens.

**Tell: an assertion built from `|`-separated strings is almost always a denylist, and a denylist of
natural language is unclosable.** Assert what must be TRUE of the output, not which sentences must be
absent from it.

### ⚠️ And this was the THIRD instance of one shape in a single session

**The instrument was real every time, and its SCOPE did not match the claim it was used to support:**

| Instrument           | Real | Scope that did not match the claim                        |
| -------------------- | ---- | --------------------------------------------------------- |
| a regex denylist     | yes  | the wordings imagined, not the claim made                 |
| a `git grep` control | yes  | run on a tree where the positive case could not exist     |
| a CSS token check    | yes  | scoped to one file, so out-of-scope tokens read as absent |

**None was a lazy check. Each was written deliberately, by somebody who had just catalogued this
class, to guard the thing it failed to guard.** ⚠️ **The question that separates them from working
checks is one sentence: _could this instrument have returned a different answer if the defect were
present?_ All three would have returned the same answer either way.**

Siblings: [[measure-the-thing-not-a-proxy]], [[compliance-without-coverage]],
[[a-green-mutation-only-counts-if-the-mutant-ran]].

## A guard DELETED because it proved nothing — the best outcome of the class — 2026-09-02

A chat built a guard over a hand-maintained list: _for every member of `INFORMATIONAL_GATES`, the
reducer refers with nothing recorded._ **It then smuggled a PHYSICAL gate onto the list to break it.
Six of six passed.**

⚠️ **The property does not discriminate.** Referring to a ward with no allocatable bed is ALSO
accepted with nothing recorded — correctly, since a coordinator may ask a full ward and be declined.
**A check whose subject was real, whose wording was true, and which no wrong list could ever fail.**

**It deleted the guard rather than repairing it, and recorded WHY in the file.** ⚠️ **It would
otherwise have been counted as protection it never gave — in a commit arguing against exactly that.**

**What actually protected the list, found by measuring instead of reasoning: adding a physical gate
reddens five EXISTING tests by name. The list was already answerable to behaviour; it simply was not
FINDABLE from the list.** **The fix was a pointer to where the answerability lives, not a new
assertion.**

**Rule: before writing a guard over a list, put a WRONG MEMBER on the list and run it. If it passes,
the property you chose is not the property that matters — and the honest fix may be to delete the
guard and document where the real protection is.**

### ⚠️ The tally that makes this a design problem rather than a run of bad luck

**In one session, on one feature set: FOUR defects found by a human looking at a screen or an agent
attacking the code on purpose. TWO more found only because a check was made to prove itself first.
The number found by the automated suite: ZERO.**

**Every one of them was invisible to 2,332 passing tests and a clean typecheck** — including a
sentence on a clinical screen that inverted an explicit owner ruling, telling a clinician to record a
reason the engine did not want and would not store.

⚠️ **A green suite is evidence that the things somebody thought to assert are still true. It is not
evidence that the screen says something true.**

- **A filter and an assertion over the same predicate.** 2026-09-03, Ward Flow, and I wrote it
  myself. Two new tests filtered a spec list to _"matches the mockup pattern AND NOT the production
  pattern"_, then asserted the production pattern did not match — `false === false` by construction.
  ⚠️ **The detection is the reusable part: four mutations ran and the suite went red each time, so
  the run looked like proof.** What gave it away was reading WHICH assertion went red — those two
  never appeared in any caught-by line. **Watching a mutation turn the suite red is not enough; the
  assertion you are proving has to be the one that fails.** Name each mutation's catcher, and treat
  an assertion that no mutation ever names as unproven rather than as passing. The fix was to
  compute the two sets independently and intersect them.

- **"Dead by order" needs BOTH ends pinned, not just the subject.** 2026-09-03, Ward Flow triage. An
  exact `expect(x).toBe(A)` followed by `expect(x).not.toBe(B)` is only dead when **B is a literal**.
  When B is other live state — `expect(LABELS.a).toBe("Belongs to another service"); expect(LABELS.a)
.not.toBe(LABELS.b);` — the second says _these two differ_, nothing pins the second one, and it
  fails the day somebody makes them equal. ⚠️ **Three assertions queued for deletion as "restatements"
  were load-bearing.** Deleting checks that catch real defects, in the name of removing checks that
  catch nothing, is the exact inversion the exercise existed to prevent. Two further traps in the same
  pass: `toEqual` pins VALUE but not IDENTITY, so `toEqual(s)` then `.not.toBe(s)` is a live copy test;
  and the comparand may be pinned by a SEPARATE assertion earlier in the same block, so "unpinned" also
  needs the file open. **Every shortcut here was a rule applied instead of a file read.**

- **A FEATURE can be a no-op too, and it looks identical to a working one in the diff.** 2026-09-04,
  Ward Flow mockup. I added a sort control (distance / free beds / name) plus a script to reorder the
  list. The insert was correct code and landed **nowhere**: the HTML file had no `</body>`, so
  `src.replace("</body>", script + "</body>")` matched nothing and silently changed nothing. The
  control rendered, accepted clicks, and returned the same order every time. ⚠️ **No error, no visible
  difference, and a reviewer reading the diff sees a working feature.**
  **The tell was three modes producing IDENTICAL output** — and identical to document order, which
  alphabetical would not have been. **When you add a behaviour, prove it with outputs that DIFFER
  across inputs that should differ** (name FSH/RGH/RPH vs distance 11/22/47 vs free 3/1/1), never by
  re-reading the code. Same root as the tautology and the unapplied mutation: every string replace
  gets an occurrence assertion, including the last one you write when you think you are finished.

## The self-baseline: a snapshot taken from the thing under test — 2026-09-04

The shapes above are checks that cannot produce a red. **This one can — just never for the reason
you care about.** It is the hardest to see, because it fires correctly on the wrong question.

**Measured on Ward Flow.** A design rule says every screen copies a shared style block **verbatim**,
and a brief required proving mine was byte-identical. I hashed the block, made my edits, hashed it
again, and reported **IDENTICAL — twice.** It was true and it was worthless: **I had taken the
baseline from the file itself, before my first edit, and that copy ALREADY carried a forbidden
edit** (`text-decoration:none; display:inline-block;` added inside the shared block).

> ⚠️ **A BASELINE CAPTURED FROM THE THING UNDER TEST INHERITS WHATEVER IS ALREADY WRONG WITH IT,
> AND THEN VOUCHES FOR IT.** My comparison could only ever answer _"did I change this?"_. It was
> read — by me and by the reviewer — as _"is this correct?"_.

**Another agent found the real defect by comparing against the CANONICAL source instead of a local
snapshot. That is the only version of the comparison that could fail**, and my file was the only one
of ten in breach.

**The consequence, which is why this is worth a memory:** a planned contract test was about to pin
each route's tokens against _the copy that route already carries_ — the same self-baseline, promoted
to a committed gate, running on every build, **green forever**. It was rewritten to compare against
one canonical declaration.

**How to apply:**

- **Ask what the baseline is a copy OF.** If it came from the artefact under test, the check measures
  change, not correctness. Say which of those two you are claiming.
- **Compare against the source of truth, not against a snapshot** — canonical file, upstream ref,
  generated-from-spec output. A hash of the thing against itself is a tautology with a checksum.
- **"Unchanged since I arrived" is a real and useful claim.** Report it in those words. It is not
  compliance, and the two are one preposition apart in a summary line.

## Retract the false half, keep the true half

The same report contained two claims: _44 bytes changed under me_ (true — a concurrent edit by
another agent) and _the block is compliant_ (void). ⚠️ **Collapsing both into "my check was wrong"
would have thrown away a real detection.** Retract by claim, not by report — and do it even when the
reviewer has already accepted it and nobody is going to re-derive your baseline, because that is the
only circumstance in which the retraction costs you anything and the only one where it proves the
rest of your reports are worth reading.

Related: [[a-green-mutation-only-counts-if-the-mutant-ran]], [[compliance-without-coverage]],
[[measure-the-thing-not-a-proxy]].

## The guard that WITHDRAWS rather than fails — 2026-09-04

Every shape above is a check that cannot go red today. **This one is green and correct today, and
stops covering the thing later — by its own correct rule, with nothing failing at the moment it
happens.**

**Measured on Ward Flow.** The FD-23 privacy guard computes its scope rather than listing it:

> _"every module reachable from the ward-facing entries that NO surface in `SEES_EVERYTHING`
> reaches… **A module both roles reach is shared infrastructure by construction.**"_

That is a good rule — a listed scope silently acquires and misses files. **But it means a component
serving two roles is EXEMPT, automatically, the moment the second role arrives.**

I was asked whether one shared component was safe for a screen with two scopes. **It is — today, one
viewer, two filters.** The finding was in the next step:

- the second role (`community`) **already exists** and records decisions;
- **no** community-scoped projection exists, so nothing says what it may see;
- the guard's source **does not contain the word**.

> ⚠️ **THE EXEMPTION IS NOT SOMETHING A FUTURE CHANGE WOULD HAVE TO CREATE. IT IS ALREADY IN PLACE,
> WAITING FOR THE SCREEN THAT WALKS INTO IT.** A leak with the alarm already disconnected.

**How to apply:**

- **When a guard computes its scope from role-reachability, ask what happens when a module gains a
  second consumer.** If the answer is "it leaves the guarded set", the guard protects it only while
  nobody needs it to.
- **Answer the question you were asked, then ask what would make the answer change** — and check
  whether that condition is already half-present. Here it was two-thirds present.
- 🔴 **Pin the absence.** A finding in prose expires; the fix was a test asserting _no community
  projection exists and no community entry is in the ward-facing list_, with the reasoning in a
  comment. **The day somebody adds one, the decision reopens as a red test rather than as something
  a person has to remember.**

Related: [[fields-with-no-producer]], [[compliance-without-coverage]], [[self-invalidating-pins]].

---

## ⚠️ A THING THAT CANNOT FAIL ACCRUES CONFIDENCE WITH AGE — 2026-09-04

**Four instances in one night, found by three sessions who did not know about each other:** an age
assertion that computed an expected value and discarded it, checking the render against
`/\d+\s*(years|year)/i`; a `Map` whose comment claimed it prevented a duplicate; a length guard whose
first half could not fail (removing it left all 25 tests green); and a parity test that passed with
the guard deleted, because a second guard blocked the same case.

**Three people making the same class of mistake in one night is not carelessness. It is what guards
in that codebase do by default.** One of them had filed it under "what I got wrong today"; the count
is what moved it from personal error to project property.

🔴 **The mechanism, and it is the durable half.** A guard that cannot fail does not merely miss
things — **it accumulates apparent reliability. Every day it sits green reads as a day it held up.**
So the longer it survives, the more it looks like evidence, and the less anyone re-examines it.

⚠️ **AND THE SAME SENTENCE HOLDS WITH "DECISION" SUBSTITUTED FOR "GUARD".** An unbuilt decision
cannot fail either, so it hardens the same way: nothing has contradicted it because nothing could
have, **which is not the same as anything having confirmed it.** Reached independently from inert
machinery and from a corpus of ~22 owner decisions of which ~20 described unbuilt things. **One idea,
two materials.** The reporting word is **UNCHECKED, never CLEARED.**

**How to apply.** Mutate every new guard once before trusting it — break the thing it guards, watch
it go red, restore, and hash-check the restore. **All four were found that way; none was found by
reading**, and two sat under comments that described them accurately as safeguards. And when
reporting a list of claims, mark each MEASURED / INFERRED / UNCHECKED, because a claim resting on a
measurement and one resting on nobody having looked are indistinguishable in a numbered list.

Related: [[misfiled-by-consequence]], [[a-green-mutation-that-changed-nothing]],
[[a-comment-can-satisfy-a-guard]], [[restoring-a-mutated-file]].

## A predicate over an EMPTY population never runs — and the emptiness is often by design. 2026-09-06.

A gate shipped with an expected-failures manifest and four validators over its entries: kind is
declared, reason is present, count is a positive integer, file is in the population. **The manifest
ships EMPTY**, so all four looped over zero entries and passed. Proved by mutation: inverting the
count check to `false` and the kind check to `.not.toContain` left the suite GREEN on both.

⚠️ **The emptiness was not bad luck, it was the DESIGN.** The manifest starts empty because the
backlog reached zero. So those validators were never going to meet real data during exactly the
weeks in which somebody tidies them — and the first entry filed would be both their first execution
and the first time anyone relied on them.

> **A validator's most dangerous moment is its first real input, and that is precisely when nobody
> is watching it.**

**The remedy is always the same and it is not more care applied to the same data: extract the
predicate and hand it a fixture the code controls.** Nine deliberately-bad entries asserted rejected,
**plus one good entry asserted accepted** — without the accept arm, a validator that rejects
everything passes, which is the natural result of a copy-paste error in the first predicate. Each
reject case is a single-field override of the known-good baseline, so a red names the field rather
than the fixture.

⚠️ **AND KEEP THE FIXTURE'S POPULATION SEPARATE FROM THE REAL ONE** (Ward Builder Three's catch).
The synthetic cases used a made-up population of one file, so they are independent of the disk walk.
If the walk breaks, the real-data loop and the floors fail loudly while the synthetic cases keep
proving the predicate still decides correctly. **Entangle them and you cannot tell a clean estate
from a dead detector** — which was the exact defect in a sibling guard the same night.

**Four instances of this shape in one session, across two sessions of work:** an inert edit-distance
limit, a predicate that coincided with every file on disk, a detector that could not tell "found
nothing" from "matches nothing", and these validators. All four were written against data that
happened to be quiet, and **quiet data cannot exercise a predicate.**

Related: [[compliance-without-coverage]], [[a-guard-that-red-lights-the-fix]],
[[a-red-that-is-load-bearing]].

## Declining to build one, and how to tell that is honest — 2026-09-06

Asked for a guard that fails when a mutation is run outside the safe harness. **I could not build
one, said so, and added nothing** — which was the right answer and is worth recording as a shape,
because "I could not build it" is also what somebody says when they did not try.

**The reason is checkable and it is the night's own finding: a hand-rolled mutation ends by
restoring the file, so afterwards THERE IS NO TRACE.** A check needs something to look at. That
same absence is what made auditing four other sessions' controls undecidable, and what let my own
destroyed fixture produce a perfect green.

**What made the "cannot" honest rather than lazy — I went and eliminated the candidates:**

- the runner's _receipt_ turned out to be a cache signal it CONSUMES, not an artefact it produces
- a git hook fires after the restore
- a guard over the `package.json` key is satisfied by the key existing
- the only buildable version parses commit-message prose for mutation claims — **spelling not
  structure, needs a grandfathering list, and fires on honest work: three anti-patterns in one**

⚠️ **AN UNFALSIFIABLE GUARD IS WORSE THAN A DOCUMENTED CONVENTION, because it makes the convention
look enforced and stops people looking.** That is the whole argument for adding nothing, and it only
holds if the convention is actually written where somebody meets it — here, an `npm run` entry, the
runbook and the working agreement.

**How to apply: when declining to build a check, name the specific candidates you eliminated and
why.** A bare "cannot be done" is indistinguishable from not having looked — same failure as a
bare caveat without its size. And ⚠️ **say it out loud to the person who asked, inviting them to
overrule you**; I asked the reviewer directly whether they could see an honest check I had missed.
Related: [[a-true-impossibility-claim-blocks-the-search]], [[compliance-without-coverage]].

## Declining the undecidable question can hide a decidable one beside it — 2026-09-06

I was asked for a guard that fails when a mutation is run outside the safe harness, argued carefully
that it was undecidable, enumerated four routes, and added nothing. **The reasoning was right and
the answer was incomplete.**

⚠️ **A reviewer pointed out that the undetectable failure was not the failure that had occurred.**
What occurred was a **correct tool going unreachable** — right for two days, invoked by nothing, and
hand-rolled again by four sessions. **That is entirely checkable**, and my careful decline had
quietly covered it too.

🔴 **AND MY OWN SENTENCE WAS THE TELL, WRITTEN AS REASSURANCE:** _"its 14 self-tests pass today, so
it never rotted."_ A statement true **by luck**, because nobody was running them. **Any sentence of
the form "X is fine today" is an observation wearing a guarantee's clothes, and it names the gate
that does not exist.**

**How to apply: after declining to build a check, ask what failure ACTUALLY happened and whether
THAT one is checkable.** The undecidable framing is usually the most general one, and generality is
what makes it undecidable — the specific incident is often narrower and within reach. Separate _the
question I was asked_ from _the event that prompted it_.

**The check that resulted is worth copying:** read the command string out of the config and **run
exactly that**, rather than re-typing an equivalent. One execution then proves the wiring exists,
that what it points at runs, and that the tool's own guards still fire — where re-typing would test
the tool and leave the wiring loose, and the two drift the moment somebody renames it.
Related: [[a-working-safeguard-leaves-no-trace]], [[the-suite-never-tests-the-absence]].

## Write the new mode's self-test WITH the mode, not after it — 2026-09-06

I extended a mutation harness with an append mode, under a reviewer's condition that **only one
guard be bypassed**. I wrote the code, then wrote a self-test case asserting the mutant-landed guard
still refused an empty probe — reasoning that appending nothing leaves the file byte-identical.

**It went red.** Append mode puts the probe on its own LINE, so an empty probe still appends a
**newline**. Hash changes, the guard is satisfied, the command runs, and **a verdict comes back
about a file carrying no mutant.** A pass that means nothing, reported as a result.

⚠️ **That is precisely the "a new mode quietly relaxes a SECOND guard" failure the condition existed
to prevent — arriving by accident, which is the only way it realistically ever would.** Nobody
disables a guard deliberately; they add a feature whose mechanics step around one.

**How to apply: when adding a mode to a tool that has guards, write a case per guard asserting it
STILL BITES through the new path — and write them while building, not after.** Had I written them
afterwards I would have written them to match observed behaviour and they would all have passed. The
case only discriminated because I wrote down what I EXPECTED before running it — the same ordering
that caught a scanner bug earlier the same night.

**And when a case turns out to test something other than its title, retitle it.** Mine said "guard 3
still refuses an empty append"; guard 3 cannot see an empty append. Leaving the title would have left
a false claim about coverage in a file whose whole subject is false claims about coverage.
Related: [[a-control-must-test-the-premise-not-the-measurement]], [[a-guard-that-pins-the-old-wording]].

---

# a-tautology-that-regenerates

> Fixing a check that cannot fail can hand it a NEW way to be tautological; only re-running the same mutation after each fix finds the second one

Ward Flow, 2026-09-03. A reachability check reported two pages as unreachable. They were not —
three real links reached them, but the address is assembled from a constant built from another
constant, so the literal path appears nowhere in the source.

I taught the check to resolve those constants. The catcher was: **delete a genuine link and the
check must go red.**

- **Round 1 — green.** With constants resolved, the route module's own template literal was now a
  string of the right shape. **The definition vouched for itself.**
- **Round 2, after excluding those literals — green again.** The module's own
  `export function pathwayRoute(` matched the builder-CALL check instead. **The same self-reference
  one level up.**
- **Round 3** — a route module vouches for nothing at all. Only this version reddens.

⚠️ **Each fix removed one self-referential path to green and created the next.** Both greens looked
like success; the only thing separating them from a real pass was re-running the deletion mutation
_after every fix_.

**How to apply: when you fix a check that could not fail, re-run the SAME mutation that exposed it —
every time, until it reddens.** A single post-fix run is not enough, because the fix itself can be
what supplies the new tautology. And be specific about the shape to look for: **evidence produced by
the thing being checked**. A definition, a builder, a fixture, a doc — anything that both _is_ the
subject and _counts as_ proof about it.

Related: [[a-property-that-does-not-discriminate]], [[checks-that-cannot-fail]],
[[a-green-mutation-only-counts-if-the-mutant-ran]], [[compliance-without-coverage]].

**And the reason it was ever caught:** the catcher was written by someone else, in the brief, before
I started — _"delete one genuine inbound link and it must fail; that proves you fixed the allowlist
rather than the assertion."_ I would not have written that condition against my own fix.
[[a-working-safeguard-leaves-no-trace]].

---

# it-fails-passes-on-any-error

> vitest's it.fails passes when the body throws ANYTHING, so a typo makes it green and it stays green after the defect is fixed; the only rescue is inverting the assertion

**`it.fails` is green whenever the body throws — for any reason.** A typo, a bad import, a mistyped
property path, a wrong action name, a dispatch refused on a role permission. Every one of those
makes it pass.

⚠️ **And it keeps passing after the defect is fixed**, because the incidental error still throws.
**A wrongly written `it.fails` is a check that can never fail, and on the report it is
indistinguishable from a correct one.** Green either way is exactly what makes it a good pin for a
known defect and exactly what makes it dangerous.

**The rescue is one control, and without it the pin is worth nothing:**

> **Invert the assertion to state the CURRENT buggy behaviour, and confirm the runner reports
> "expected to fail but passed".**

Run on a real pin, 2026-09-04:

    it.fails, correct post-condition asserted   ->  62 passed | 1 expected fail   (the pin)
    inverted to assert the buggy behaviour      ->  "Error: Expect test to fail"  (CONTROL PASSES)

That second line is the proof the test is failing on its **assertion** rather than on an accident.

**A second control is worth it too:** print the real post-state once and check it against the values
from the driven run that found the defect. If they differ, the chain is not reaching the state and
the pin is fiction.

⚠️ **This is the same failure as a probe whose dispatches are all refused.** One reachability probe
sent `PATIENT_ARRIVED` with role `"ward"` where `EVENT_ROLE` permits only `"officer"`; nothing was
ever driven, and it went red only because it happened to assert that a closure must EXIST rather
than merely that none has an empty reason. **The weaker assertion would have passed on a run where
nothing happened.** `it.fails` is where that failure is invisible instead of merely lucky.

**When to reach for it at all:** pinning a confirmed defect whose fix belongs to somebody else or to
a later change. It beats prose (cannot go stale), and it beats a red test (gates stay green
mid-fold), **and when the fix lands it goes red as "expected to fail but passed" — a louder and more
specific signal than a green test quietly appearing.**

Incidental, same install: **`--reporter=basic` is not valid on vitest 4.1.10** — it errors with
"Failed to load custom Reporter from basic". It fails loudly, so nothing is contaminated, but a
brief carrying that flag dies at startup.

Related: [[green-mutation-that-changed-nothing]], [[checks-that-cannot-fail]],
[[a-control-must-test-the-premise-not-the-measurement]],
[[a-green-mutation-only-counts-if-the-mutant-ran]].

---

# a-gate-that-verifies-its-precondition-once

> A gate keyed to a frozen historical commit can fail exactly once and then passes forever, on any tree, through any later change

`tests/ward-flow-chat-control.test.ts` demanded a runner-produced passing receipt for the committed
tree at the control plane's **activation snapshot** — a frozen historical SHA. `committedTreeInputSignature`
hashes `git ls-tree -r <ref>`, and for a fixed ref that hash is **immutable**.

So once a matching receipt exists in any local store, **that gate passes forever** — on any working
tree, through any subsequent change to the control plane, the script, or the state file. It could
fail exactly once, in the state I found it in (no receipt anywhere), and it can never fail again.

Worse, the receipt was only satisfiable in one way. At the activation commit the state read
`mode: recovery`, `activationSnapshot: null`, `transitionEvidence: []`, so the assertion sits inside
a loop over an empty list and **never executes there**. Ward Verifier's judgement, which I accept:
this is **neither a bypass nor a fix — it is a gate that verified its own precondition once and is
now inert.**

**Why it fooled everyone:** the gate's name and message describe continuing assurance about the
control plane, and it was RED for days, which reads as a gate doing its job hard. Red is not
evidence of discrimination — see [[a-property-that-does-not-discriminate]] and
[[checks-that-cannot-fail]]. Its evidence also lived in `node_modules/.cache/`, so an `npm ci`
destroys it and everyone deadlocks again with no recovery derivable from the error message.

**How to apply:** when a check pins evidence to a commit, ask whether that ref MOVES. A frozen ref
makes the check a one-time precondition; only a moving ref gives continuing assurance. And before
calling any long-red gate valuable, find the input it is keyed to and ask what would make it go
green — if the answer is "one artefact existing anywhere, ever", it is a latch, not a gate.
Report it as inert rather than as fixed; changing what it certifies is the owner's call.

---

# a-guard-is-predicate-plus-query

> A text-level arm cannot see the element lookup upstream of it, so it reports a caught deletion as an undetected one — and inflates the finding sevenfold

Ward Flow, 2026-09-05. I reported **ten** converted guards as unable to detect the deletion of the
caption they are named for. **Three.** Ward Lead had already put "the ten" in a merge message and
was carrying it to the owner when I caught it.

My deletion arm captured the text each assertion reads, removed the carrying sentence from that
string, and re-ran the helper's predicate. Seven of the ten reach their text through
`screen.getByTestId(...)`, which **throws** when the element is gone:

    TestingLibraryElementError: Unable to find an element by:
      [data-testid="ward-governance-dropped-measure"]

**The element lookup sits upstream of the helper, so a text-level arm is structurally blind to it.**
Deleting a sentence out of the captured string models a partial TRIM of a multi-sentence caption —
a real but much smaller defect — not the removal the guard exists for.

**Why:** the measurement was sound and the sentence was written wider than it. A guard is
**predicate PLUS query**; I measured the predicate and made a claim about the guard. Same shape as
[[differs-is-not-owns]] the same hour and [[a-measurement-is-scoped-to-what-it-measured]] before
that — and the direction is the dangerous one, because it INVENTS findings rather than hiding them
([[a-green-mutation-only-counts-if-the-mutant-ran]]).

⚠️ **The tell I walked past: my arm reported 80 of 90 healthy and I took that as proof the method
discriminates.** It does discriminate — between two texts. It says nothing about whether text was
the right unit. **A control that can produce both answers still only vouches for the axis it
varies.**

**How to apply:** when a finding is about a test, run the mutation **on the subject the test
actually renders** — delete the element from the component and run the file — before reporting it.
Doing that took four minutes and settled both classes: the governance caption's removal went red
with the lookup error; deleting the community-hub caveat's whole `<p>` left its test **green with
the caveat gone from the screen**, which is the one real find. Restore by reversing the edit and
prove it with `git hash-object` against a baseline taken first.

Related: [[tests-that-assert-rendering-not-truth]],
[[widening-a-guard-destroys-its-other-direction]], [[measure-the-thing-not-a-proxy]],
[[relayed-numbers-lose-attribution]].

---

# a-stale-guard-answers-honestly

> A guard's printed list is the right evidence, but a stale COPY of the guard answers a superseded question honestly — I corrected a colleague's document wrongly on one

Ward Flow's standing rule is right: read a guard's own printed failure list, never a count in
prose. I did exactly that, and still produced a wrong finding — I told Ward Lead their handover
undercounted the deliberate red at seven files when it "really" named eight, and pushed it as a
document correction.

The eighth was `ward-delays-screen.dom.test.tsx`, whose only `WardModeWorkspace mode="exceptions"`
sits at line 36 **inside a doc comment** explaining where a pin had been carried FROM. The master
line had added comment-stripping to the guard for precisely that false positive. My branch was 17
commits behind, so my copy of the guard (`6373a6b0`) asked the superseded question and answered it
honestly. The subject file was byte-identical on both sides (`fc85d65e`), which is what makes this
hard to see: nothing about the file was wrong, and the guard was not broken — it was old.

**Why:** "run it, don't trust the prose" moves trust from a document onto a program, and a program
has a version too. A stale guard fails in the direction that feels most authoritative — you have
running output, so you argue harder.

**How to apply:** before quoting a guard's output at anyone, re-read the base, the same way you
re-read a tip before quoting a SHA — `git rev-list --count HEAD..<master>` and
`git rev-parse HEAD:<guard>` vs `<master>:<guard>`. If the guard's blob differs, its output is a
claim about your branch, not about the project. And when a finding is a _correction to someone
else's document_, diff the guard before sending it. See [[observations-expire]],
[[a-fix-can-obsolete-its-own-guards-question]], [[deferring-to-a-correction-looks-like-humility]].

---

# a-property-that-does-not-discriminate

> A guard can be true, on-topic and impossible to fail because the property it asserts also holds for the cases it was meant to exclude

Ward Flow, 2026-09-02. I wrote a guard to stop a hand-maintained list (`INFORMATIONAL_GATES`,
the gates the coordinator screen treats as non-blocking) from drifting away from the engine.
It asserted: for every member, the reducer refers to such a ward **with nothing recorded**.

I then smuggled `allocatable_bed` — a physical fact, the opposite of informational — onto the
list to prove the guard would catch it. **6 of 6 passed.**

Referring to a ward with no free bed is ALSO accepted with nothing recorded, and correctly so:
a coordinator may ask a full ward and be declined. **The property was true of the thing I wanted
to allow and equally true of the thing I wanted to forbid, so no wrong list could ever fail it.**

**Why:** this is not the usual vacuity (an assertion that never runs, a loop whose `if` never
fires). The check ran, on the right subject, and its wording was accurate. It simply measured
something both sides share. It would have been counted as protection — by me, in a commit
arguing against exactly that.

**How to apply:** before trusting a guard, **smuggle the wrong member in and watch it go red.**
Not a mutation of the code under test — a mutation of the _input the guard is supposed to
police_. If the guard stays green, the property does not discriminate and the guard is decoration.
Then look for what the two cases actually differ on; here it was the shortlist's classification,
where the same smuggling turned five existing tests red by name. Related: [[checks-that-cannot-fail]],
[[compliance-without-coverage]], [[the-suite-never-tests-the-absence]].

Same session, twice more, both in the direction that INVENTS a finding rather than hiding one
([[a-green-mutation-only-counts-if-the-mutant-ran]]): a mutation inserted one branch too late
never created the defect and passed — which reads as "the test is weak" and sends you hunting a
defect that is not there; and a `grep -A30` window returned zero for a function emitting nine
gates, where **only the positive control revealed the window was too small, not the answer wrong**
([[measure-the-thing-not-a-proxy]]).

## Both directions wrong in one guard, and the safe-looking one is the worse — 2026-09-06

I wrote a proximity guard: a sourced figure must never be sited beside statutory vocabulary, and
must never appear as a bare literal at a point of use. **Both arms were wrong on first run, in
opposite directions.**

**Too wide:** the bare-literal arm flagged EVERY occurrence of the number in the directory and went
red on a seeded record whose day count merely equalled it. ⚠️ **A guard that fires on honest,
unrelated work is one somebody widens until it means nothing** — and the widening happens quietly,
by whoever is blocked at the time. The fix was to anchor on the SUBJECT: the risk was never "this
number appears", it was "this number is used AS the threshold without its provenance".

**Too narrow, and this is the one to fear:** the siting arm fired on **my own disclaimer** — the
sentence _"this is not a statutory period"_, which is exactly the right thing to write. **A guard
defeated by somebody doing the right thing teaches people to stop doing it.** The fix was to search
comment- and string-blanked source: **prose is not siting; a legal FIELD beside the value is.**

⚠️ **The two failures pull opposite ways and a single test run only ever shows you one of them.**
The wide arm announced itself with a red. The narrow arm ALSO announced itself here only because
the offending prose was mine — had I written the disclaimer anywhere else, the guard would have
been quietly unfailable on real code and green forever.

**How to apply, for any proximity or neighbourhood guard: state the two questions separately —
_what honest work would this fire on?_ and _what real violation would it miss?_ — and answer both
before running it once.** Then mutate for both: insert a genuine violation (must go red) and a
correct disclaimer (must stay green). Related: [[a-comment-can-satisfy-a-guard]],
[[a-guard-that-pins-the-old-wording]], [[floor-the-denominator-never-the-numerator]].

## A syntactic test can never decide a semantic property — 2026-09-06

I refused an empty probe in a mutation tool, believing I had closed a class. A reviewer measured the
whole family instead of the member I had tested:

    (empty) · space · tab · lone newline        REFUSED
    a comment · a bare `;` · `@media print{}`   RAN, then reported SURVIVED
    a real declaration                          RAN, then CAUGHT

🔴 **My refusal asks "is this whitespace?" — syntactic. The property that matters is "can the gate
under test SEE it?" — semantic. Those can never be the same test.** A `@media print{}` probe is
inert for a colour ratchet and a perfectly good probe for a print-styles guard. **Inertness is
relative to the GATE, not to the string**, so no input validation can decide it — and a validator
rejecting those inputs would break the tool for exactly the guards they are legitimate probes for.

**How to apply: when tempted to close a class by validating inputs, ask whether the property is a
fact about the STRING or a fact about the RELATIONSHIP between the string and something else.** If
the latter, no validator exists, and adding refusals produces an over-broad guard that fires on
honest work while still not closing the class. **Say what the verdict means instead of pretending it
means more** — and put that where the verdict is reported, not in a paragraph further up.

✅ **And two corrections in the rare direction, both from the same review.** My fix covered the
entire whitespace class, not just the empty string — **I had claimed NARROWER than the code
delivered.** An understated claim is still a wrong claim, and it is the one nobody re-checks,
because being modest reads as being careful. **Measure the family, not the member you happened to
try.** Related: [[compliance-without-coverage]], [[establish-the-unit-before-counting]].

---

# A regex the rendered text can never satisfy (2026-09-06, Ward Flow search hub)

A DOM guard asserted `/\b2\b/` and `/\b3\b/` against `document.body.textContent`, to prove a ward
screen showed its ready-beds and vacant-not-yet-cleared figures as two separate facts. **It failed
against a screen that was correct**, and the screen stayed suspected for two runs.

`textContent` concatenates sibling elements **with no separator**. The correct markup
`2 · Ready to admit · 3 · Vacant, not yet cleared`, sitting after a subtitle, arrives as
`…North Metro2Ready to admit3Vacant…`. `\b` needs a word/non-word transition; `o2` and `2R` are
both word-character pairs, so **that regex cannot match anywhere on any page**, whatever the screen
does. It is not a weak guard — it is an assertion with no satisfying input, which is the same defect
as a tautology wearing the opposite sign.

⚠️ **The tell is a guard that reddens on work you have just verified by eye.** Suspect the assertion
before the subject. The diagnosis took a throwaway test that dumped `textContent` before and after a
click — three minutes, and it also proved the click worked, which greps had left ambiguous.

**How to apply: never regex whole-page `textContent` for a bare number or short token.** Scope to a
region (`within(getByRole("complementary", { name: … }))`) and match whole leaf nodes
(`getByText("2")`), which cannot match `North Metro2` or `24`. **Scoping made the guard STRONGER,
not weaker** — the collapsed total `2+3=5` could finally be asserted absent, impossible whole-page
because another ward's own legitimate 5 would have tripped it.

Related: [[a-property-whose-operands-can-coincide]], [[tests-that-assert-rendering-not-truth]],
[[read-the-failure-message]], [[a-guard-that-blocks-its-own-purpose]].

## The mirror image: A CHECK THAT CANNOT SUCCEED. 2026-09-09, four sessions.

Everything above is about a guard that cannot go red. **The same defect exists from the other end and
this file had no entry for it**: a probe that cannot return the POSITIVE, used as clearance to act.

Worked example. Before rebuilding another worktree's dependencies I checked whether any process held
it: `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*ward-builder-three*' }`.
Empty, so I called the tree unheld and proceeded. **`Win32_Process` has no working-directory
property at all**, and a `vitest` or `npm` started INSIDE that folder carries no path in its command
line. The query could not have produced a hit. A live session did have that folder as its cwd.

> **A check that cannot fail and a check that cannot succeed are the same defect from opposite ends.
> Neither can move a belief, and both read as a clean result.** — Ward Verifier

🔴 **The asymmetry that makes this end WORSE:** an unfailable guard produces a false green
that leaves the status quo alone. **A probe that cannot succeed produces a false ALL-CLEAR, and an
all-clear is spent immediately — it is the thing you act on.** Mine was the stated justification
for the dangerous act itself.

**The countermeasure, and it is Ward Builder Three's** — who wrote the incomplete version I had
adopted (_"ask which command settles it, and run it"_), watched it fail me, and repaired it:

> **Name the command AND show it could have returned the other answer.** A probe that cannot produce
> the positive has not tested anything; **its negative is a property of the instrument.**

See [[a-clean-negative-that-measured-nothing]] and [[differs-is-not-owns]] for the six impostor
properties that made this particular absence impossible to notice.

## The verification METHOD certified exactly the defects it could not see. 2026-09-09, Ward Flow.

The standing method for proving a reword-tolerant guard was **reword, then break**: change the
wording (must stay green), delete the claim (must go red). Applied all day, dispatched to three
chats as sufficient.

🔴 **THE BREAK ARM PASSES ON A GUARD WHOSE SPELLINGS ARE INDIVIDUALLY WORTHLESS, because deleting
the line makes EVERY spelling fail together.** It proves the guard notices its subject vanishing. It
cannot prove the guard notices anything else. **4 of 4 measurable sites were defective; the break arm
passed on all four both before and after the fix.** Arms A–C would have signed three of them off.

`expectSays(el, label, spellings)` is `some(s => text.includes(s))`, so **the WEAKEST spelling sets
the guard's entire strength.** A spelling that does not independently imply the whole claim admits a
counterexample, and the two failure directions are opposite:

| spelling shape                              | blind to                 | measured counterexample                                                       |
| ------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------- |
| subject-free — `"not recorded"`, `"only"`   | the subject changing     | `"Referral time not recorded"` satisfied a guard about **acceptance** time    |
| absence-free — `"acceptance"`, `"referral"` | the absence disappearing | `"referral time 14:20"` satisfied a guard asserting that time was **missing** |

Two sites carried both, so those rows could have stated a different clock's claim, or the exact
opposite of their own, and stayed green.

**The two arms that actually find it, now in the ruling:**

- **D · BYSTANDER** — keep the spelling, change the SUBJECT.
- **E · HOLLOW** — keep the subject, remove the ABSENCE.

⚠️ **A TIGHT QUERY DOES NOT RESCUE A SUBJECT-FREE SPELLING, AND THE REASONING THAT IT DOES IS VERY
CONVINCING.** I argued that reading ONE row, with `data-kind="examination"` asserted a line above,
meant no bystander could reach it — then measured anyway: `"Decline not recorded."` written INTO that
same trusted element passed 25 of 25. **My first repair reintroduced the defect it was fixing and
only the bystander arm caught it.** The defect can be written into the element the query already
trusts. **Buy tolerance with more FULL spellings, never a fragment of one.**

⚠️ **AND THE REPAIR RULE INVERTS BY GUARD TYPE.** _"Narrow what is READ"_ is right for a POSITIVE
claim and wrong for a BAN — a ban read from one element cannot see the forbidden phrase elsewhere,
and narrowing it weakens it while every arm still passes (measured: 37/37 green with the retired
claim moved one element sideways). **Sort by what each guard PROTECTS before applying either rule.**

**The transferable form:** when a method is handed out as sufficient, ask what a passing result
CANNOT distinguish. Here, "break arm passed" could not tell a sound guard from one whose every
spelling was a fragment. Related: [[compliance-without-coverage]],
[[a-green-mutation-only-counts-if-the-mutant-ran]], [[a-control-must-test-the-premise-not-the-measurement]].

---

## 2026-09-10 — the organising sentence, and three shapes the arms above still miss

**A GUARD IS A QUERY PLUS A PREDICATE, AND AN ARM THAT ONLY EDITS TEXT EXERCISES ONLY THE PREDICATE.**
Three separate defects in one range were the REACH and not the wording, and all three read perfectly
in review: two bans scoped to one element while the retired claim stood in the next paragraph, and
numeral guards on three of four refusal figures scoped to the paragraph rather than the article.
Say this FIRST in any brief that hands out reword-and-break, not last.

**HOLLOW, applied to a refusal figure — the highest-harm instance found so far.** Leave the refusal
paragraph EXACTLY as written and publish the refused figure beside it, in the same article:

    "publishes no referral-to-bed duration"   + "Referral to bed took 3.2 days"     GREEN
    "cannot be measured here"                 + "Beds took 41 minutes"              GREEN
    "withheld pending an owner ruling"        + "Northam declined 7; Bunbury 4"     GREEN

The one screen that caught it read the ARTICLE. **The repair that generalises: inside a refusal
figure, every digit must belong to an element carrying a `data-testid`** — which pins the component's
own design rule ("the counts live in their own elements"), lets prose be reworded freely, and leaves
loose prose nowhere to hide a quantity. Its reach must be stated: a false figure written INSIDE an
existing named count element is invisible to it.

🔴 **THE MIRROR TRAP, AND IT MANUFACTURES A FINDING RATHER THAN HIDING ONE. A BREAK ARM THAT QUIETLY
REWORDS.** I replaced _"did not proceed"_ with _"stopped short"_, called it a break, and recorded the
green result as a defect. It is a REWORD of the same claim, so green was the guard working correctly.
Caught only because the re-proof after the "fix" came back green where I had predicted red. **Before
recording a silent break as a defect, ask whether the mutation actually removed the CLAIM or only
restated it.** The same session produced the opposite error too — a mutation that removed one of two
statements of an absence and left the claim standing, whose green I nearly recorded as a defect.
**A false "sound" closes the question; a false "defect" spends a repair on nothing and adds a
spelling list that can now fight honest work.**

⚠️ **AN OR-LIST OVER A SET THAT MUST BE COMPLETE.** `["referral raised", "ward acceptance", "bed
pulled"]` over a paragraph naming four journey legs: drop two legs, one surviving member satisfies
the whole list, green. Same shape as an "Invented figures" heading where ONE compliant item vouches
for its siblings — which produced an owner ruling the same day (_"the number should always carry
that it's invented"_: the marker belongs to the ITEM, never the heading, because **a heading is
context and context does not travel with the sentence**). **Where the entries are different claims
rather than spellings of one, an OR-list is not a spelling list at all — require each.**

⚠️ **A REPAIR CAN CARRY ITS OWN DEFECT IN.** Removing a dead alternate, I drew the replacement
spelling from the paragraph; it also sat three sentences later, so the repaired guard was unfailable.
**Test every candidate spelling against the BROKEN text, never against the text that suggested it.**

🔴 **A PROBE THAT CANNOT FIRE, AND IT IS INDISTINGUISHABLE FROM A GUARD THAT WILL NOT FIRE.** Testing
a ban, I planted _"have not yet been collected"_. The banned phrase was _"not yet collected"_ — "been"
sits in the middle, so **the plant carried no banned phrase at all** and its silence was evidence of
nothing. It was committed as a measured hole first. Found only because the FIX did not change the
probe's result. **When probing a ban, copy the phrase verbatim out of the list — a near-miss
paraphrase is the one input that cannot discriminate.** The silence agreed with the hypothesis being
held, which is why it read as a result rather than as a null. Related: [[a-clean-negative-that-measured-nothing]].

⚠️ **TWO GUARDS SHARING ONE LIST COVER FOR EACH OTHER, AND THE COVER IS INVISIBLE UNTIL YOU MEASURE
ONE ALONE.** The counterfactual for the above read CLEAN until BOTH bans using that list were reverted
together: with either one still page-scoped it caught the plant meant for the other. **Reverting one
at a time reports a working guard.** The same reasoning applies to relying on a page-wide sibling ban
for cover — it is withdrawn silently the day somebody edits that sibling's list, and nothing reddens.
**Widen the guard that has no hole too, so no guard depends on another's list.**

⚠️ **AND THE PREDICATE/GUARD SUBSTITUTION REPEATS EVEN AFTER YOU NAME IT.** I made it twice on one
branch: planting a retired phrase INSIDE the element a ban reads, watching it redden, and recording
the site "measured" — with the first instance already written up as a titled lesson in my own report.
**Knowing a trap by name does not stop you walking into it.** The only thing that caught the second
was a peer restating the rule at me.

## 2026-09-11 — a guard corrupted by the SCRIPT that wrote it, and only partly

I generated four regex guards through a Python heredoc. **Every word-boundary escape collapsed into
a single 0x08 byte** — that escape is a real control-character escape in Python's string syntax,
while the digit and whitespace escapes are not escapes there and passed through untouched.

🔴 **So only SOME patterns were corrupted, which is what made it survivable.** The file read
correctly at a glance, the suite was green, and each corrupted pattern demanded a literal backspace
character and **could never match anything**. The uncorrupted ones in the same block still fired, so
the guard looked alive.

⚠️ **Two separate things had to go wrong for me to catch it, and neither was review.** A repository
guard scans for raw control characters and its message named the cause, the fix, and — the detail
that saves the next person — _"in a comment, describe the escape in words rather than typing it,
because typing it into the explanation reproduces the byte"_. That is
[[writing-the-defect-down-collides-with-the-check]] anticipated by the guard's own author.

**The rule: never GENERATE a regex through another language's string syntax.** Write it as a literal
with an editing tool. If a script must emit one, build the backslash from `chr(92)` so no escape
processing can touch it, and then **prove each pattern fires on a specimen of what it forbids** —
which is the check that would have caught this in one line and which I only ran afterwards.

**And the companion finding from the same hour:** the guard also checked only the EXPORTED sentence
constants, so a sentence returned as an inline literal was invisible to it. A mutation found that,
not reading. **Point a text guard at what the function RETURNS, never at the declarations somebody
has to remember to add to** — see [[compliance-without-coverage]].

Related: [[a-green-mutation-only-counts-if-the-mutant-ran]], [[corruption-that-makes-checks-pass-harder]],
[[a-guard-that-blocks-its-own-purpose]], [[read-the-failure-message]].

## 2026-09-11 — the ANCHOR-SLICE, where the language hands you the vacuous result

An eight-guard audit turned up one shape distinct from all the others:

    const block = source.slice(source.indexOf("export type Foo = {"),
                               source.indexOf("export type Bar"));
    expect(block).not.toMatch(/\?:/);

🔴 **`indexOf` returns `-1` for a missing marker, and `slice(-1, -1)` returns `""`.** Rename either
anchor, or move one relative to the other, and the guard asserts a property of the empty string —
**and passes.**

⚠️ **This is NOT the missing-anti-vacuity-floor shape.** Those fail because somebody forgot to check
a population size. Here **nobody forgot anything** — the lookup quietly returns a sentinel and the
slice quietly accepts it. **The vacuous result is computed for you, correctly, by the language.**

✅ **The fix usually already exists.** This repository ships `tests/helpers/source-contract.ts` with
a `sourceSegment` helper that **throws on a missing or ambiguous anchor**, and every audited file
using it was healthy for that reason. **The defect was not using the helper written for exactly
this** — and a second file sliced by hand while its own doc comment cited that anchor as _"the
model"_ for good marker choice.

**The rule: never anchor a source scan with a raw `indexOf` pair.** Use something that throws, or
assert the slice is non-trivial before asserting anything about its contents. ⚠️ **And the general
tell: any API that signals "not found" with a value the next call accepts — `-1`, `undefined`,
`null`, `""` — can build you an empty population without an error anywhere in the chain.**

Related: [[compliance-without-coverage]], [[a-clean-result-from-measuring-nothing]],
[[git-queries-that-answer-instead-of-erroring]], [[a-comment-that-quotes-the-string-it-removes]].

---

## A verdict template that ships already passed (2026-09-20, Ward Flow)

`docs/ward-flow/handover/02-SCORING-RUBRIC-AND-FATAL-FLAWS.md` carried a "Master Scorecard Output
Template" whose **fourteen fatal-flaw checkboxes were all ticked `PASS`**, with
`**Fatal Flaws Status**: **0 Violations (ALL CLEAR)**` already written in — while every other field
in the same block was a blank to fill (`[SHA256_HASH]`, `[YYYY-MM-DD]`, `____ / 25`).

🔴 **A scorer copying it inherited fourteen results nobody measured, and the summary line a reader
checks first said ALL CLEAR before the screen had been opened.** The ticks were not a recorded
result; they were a default nobody chose.

⚠️ **The tell is a template whose DEFAULT IS THE PASSING STATE.** A gate can then only be
reached by someone who happens to look — the opposite of a gate, which should be reached by
everyone and escaped only by evidence. It is the paperwork cousin of an assertion that cannot fail:
same failure, no code involved, and harder to spot because the artefact looks complete.

✅ **Fix: a template's every verdict field is blank, including the summary**, and any
correction note lives OUTSIDE the copyable block — otherwise it is pasted into every future
scorecard and becomes noise people learn to skip.

⚠️ **Ask of any checklist, rubric or report template: what does it say about a screen nobody
looked at?** If the answer is anything other than "nothing", it is not a check.

Related: [[a-working-safeguard-leaves-no-trace]], [[compliance-without-coverage]],
[[a-clean-result-from-measuring-nothing]], [[a-self-check-must-judge-structure-not-verdict]],
[[two-task-lists-one-check]].
