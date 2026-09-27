# Common brief — every Ward Flow screen agent, 2026-09-12

**Read this in full before your screen-specific instructions. Where the two disagree, the
screen-specific one wins and you say so in your report.**

You work in `D:\Worktrees\Database\ward-lead`, the worktree you are already in. **Do NOT create a
worktree, switch branch, pull, or merge.**

---

## 0 · PROVE YOUR BASE — and note why the obvious check does NOT work

🔴 **An OLDER "second edition" of Ward Flow is merged to `main`.** So the existence of
`src/app/mockups/ward-flow/` proves **nothing** — an agent passed exactly that check on the wrong
base and was one step from building against the wrong edition. **The discriminating check:**

    ls docs/ward-flow/mockups/ | grep -c third-edition        → must print 36
    ls docs/ward-flow/build-contracts-2026-09-12/             → must exist, ~19 files

**36, not 3.** If you see 3 you are on `main`. **STOP and hand back. Do not fix your own base.**

⚠️ **This is the general lesson, not a one-off: a check that passes in both the good and the bad
case is not a check.** Before you trust any verification in this task, ask what result would have
appeared had the thing been broken.

---

## 1 · 🔴 THE ABSOLUTE CONSTRAINT — the owner stated this in capitals

**DO NOT REPLACE, REWRITE, DELETE OR "TIDY" ANY EXISTING BUILT SCREEN.** Sixteen Ward Flow screens
were built over the preceding days. **Touch YOUR screen's files only.**

⚠️ **OTHER AGENTS ARE EDITING OTHER SCREENS IN THIS SAME WORKTREE RIGHT NOW.**

- 🔴 **If your change needs an edit to a SHARED file** — `ward-management-modes.tsx`, the layout,
  the rail, any shared registry — **STOP, do not edit it, and hand back the exact edit required.**
  The controller applies it centrally. Two agents in one shared file is how this goes wrong.
- **Never delete or move anything matching `ward-flow`, `ward-management`, or `ward-board`.**

## 1a · 🔴 DO NOT DISPATCH SUBAGENTS. DO THE WORK YOURSELF OR HAND BACK.

**You have no subagents. Not helpers, not reviewers, not parallel workers.**

🔴 **WHY, MEASURED 2026-09-12: an agent surveying 21 files spawned four children, returned _"I've
kicked off four parallel agents… I'll compile the full report once they all report back — no need to
do anything further right now"_, and TERMINATED.** ⚠️ **Its children reported to IT, and it was
gone. All 21 files went unsurveyed — and the completion notification looked exactly like the ones
carrying real findings.**

🔴 **THERE IS NO WAY TO RESUME A TERMINATED SUBAGENT IN THIS BUILD, so there is no cheap recovery.**

⚠️ **The tell, if you are ever reading such a report: it describes FUTURE work rather than containing
any, and "no need to do anything further right now" is the giveaway — a completed survey has no
"right now".**

✅ **THE ESCAPE HATCH, so the constraint does not push you into a worse failure: if you run out of
room, DO LESS AND SAY WHICH PART YOU DID NOT REACH.** 🔴 **A partial result that names its gap is
useful. A promise of a complete one is worth nothing, and it is indistinguishable from success.**

## 2 · 🔴 DO NOT COMMIT. NO GIT WRITE COMMANDS.

**No `git commit`, `git add`, `git stash`, and no branch or worktree operation.** The pre-commit
hook inspects the whole working tree, several agents are live in it, and **two committers in one
worktree deadlock in a way that has no courtesy fix — neither can commit until one tree is
completely empty.** Leave your work in the working tree; the controller commits it. Read-only git
(`log`, `diff`, `status`, `show`) is fine.

## 3 · UPGRADE, NOT REBUILD — and the "APP ONLY" list

Most of these screens already exist. For those, the contract is a **three-way diff**:

    IN BOTH        in the built screen and in the drawing
    DRAWING ONLY   the drawing contributes it; the screen lacks it
    APP ONLY       🔴 THE DANGEROUS LIST — in the built screen, ABSENT from the drawing

🔴 **Everything on the "APP ONLY" list must SURVIVE.** A rebuild-to-the-drawing silently deletes
every one. **This project has a recorded incident where exactly that dropped 30 of 42 facts a
previous screen carried.** Never start from a blank file. Report anything you deliberately drop,
with its reason.

**If your screen has no contract yet, write one first** at
`docs/ward-flow/build-contracts-2026-09-12/contract-<name>.md`, as that three-way diff, citing a
`file:line` for every claim, and **ending with a section stating what you did NOT check** — a
document that does not state its limits gets read wider than it was measured.

⚠️ **Enumerate what exists; do not grep for the names you expect.** A search for expected names can
only confirm — its silence is not absence. An agent here invented a build task for a panel that had
been present for four days.

## 4 · DESIGN SYSTEM

- Read `docs/design-system/README.md` before writing markup. It is the system of record.
- **Design tokens, never hex literals** — an ESLint rule fails the build on hard-coded hex.
- Match the idiom of the screen you are editing and its neighbours: CSS Modules, same file layout,
  same naming. Read two existing ward screens first and write code that reads like them.

### ⚠️ The type-scale trap, which reads as SUCCESS when it fails

🔴 **OWNER RULING D-3 (2026-09-10): NO NEW SUB-12px DECLARATIONS. THIS IS AN INVARIANT FOR NEW
WORK, NOT AN ASPIRATION.**

    --text-3xs  = 10px   🔴 FORBIDDEN in new work
    --text-2xs  = 11px   🔴 FORBIDDEN in new work
    --text-xs   = 12px   ✅ the floor — use this

⚠️ **The grandfathering is deliberate and is NOT permission.** The owner REFUSED a sweep, because
raising every existing size at once would relayout all sixteen ward screens and trade a legibility
problem that can be SEEN for a breakage problem that cannot. **Existing sub-12px sizes are raised
screen by screen as each screen is rebuilt — so if you are rebuilding a screen, raise the ones you
touch. If you are adding to a screen, your NEW rules use `--text-xs` or larger, full stop.**

🔴 **DO NOT REASON "the panel next to mine uses 10px, so mine should match."** That reasoning is
what D-3 exists to stop, and "match the idiom of the screen you are editing" above does NOT extend
to type size. **Idiom means structure, naming and file layout — never a sub-floor size.**

⚠️ **AND NOTHING WILL TELL YOU IF YOU BREACH IT.** `scripts/ward-flow/check-text-size-floor.mjs`
implements D-3, but it is **wired into nothing** — no `package.json` script, no test, no CI job —
and it is a **ratchet on a net count**, not a per-declaration check. **Measured 2026-09-12: nine new
sub-12px declarations were added in one night and the ratchet still reported "not risen", because
its baseline carried slack from earlier removals.** 🔴 **So the guard here is you, not the tooling.**

🔴 **Use `--t-0`, `--t-1` and the rest of the `--t-N` scale only on a screen explicitly rebuilt
onto the commissioned third-edition mechanism.** That screen's root must carry
`data-ward-design="third-edition"` and locally compose the canonical `.wardShellTokens` from
`src/app/ward-flow-shell-tokens.module.css`. An unmarked screen remains on `--text-*`; writing
`var(--t-0)` there still resolves to **nothing**, becomes invalid at computed-value time and falls
back to inherited text, so the broken case still looks like success.

⚠️ **THE MARKER ALONE IS NOT PROOF.** The migration is complete only when all three checks in the
Ward Flow design standard §4.4 hold on the real route: the root's computed `--t-0` is `0.75rem`,
every named element computes to its exact target step, and the rebuilt screen stylesheet contains
no `--text-*` reference. Shared primitives that compose the legacy token layer on their own element
must rebind their roles on that same element under the marker; an ancestor-only override loses in
the cascade. Omission of the marker and optional design prop is the compatibility path and must not
change legacy consumers. Owner decision O-17.1, commissioned for the visual rebuild on 2026-09-12.

### ⚠️ A filename collision that has already cost one agent ten minutes

`src/components/ward-management/ward-bar.tsx` is a **bar-chart component** (`WardBar`,
`WardBarSegment`). The shell's top bar is `src/components/ward-management/shell/ward-bar.tsx` —
a different file. **Always write the `shell/` prefix when you mean the top bar.**

## 5 · 🔴 HONESTY RULE — this is a clinical tool and it outranks completeness

Ward Flow is destined to be software a real bed coordinator opens. **Never render a sentence the
data cannot support.**

- If the drawing shows a figure, label or claim the data model cannot produce: **do NOT invent a
  plausible value and do NOT quietly omit it.** Build the rest, leave that element out, and list it
  in your report under **"could not be built honestly"**, with the reason.
- **Invented demonstration figures are acceptable ONLY where the surrounding copy openly says they
  are invented.**
- The contract's "what cannot be built honestly" section is the most important section in it.

⚠️ **The upgrade-specific trap: ADDING DATA MAKES AN UNCHANGED SENTENCE LIE.** A hard-coded
sentence is true only for the rows that exist today. If you add rows, columns or cases, re-read
every surrounding sentence and confirm each is still true.

⚠️ **REFERRALS ARE SEPARATE.** There is an existing referral board, and a separate new referrals
screen owned by another lane. **Do not modify, absorb, re-implement or link-hijack either.** If your
drawing appears to show referral content, build only what is unambiguously yours and report the
overlap.

## 6 · YOUR CATCHER — and it must be able to fail

Write or extend a DOM test under `tests/`: the screen renders, its sections are present **by name**,
and every claim-bearing sentence you rendered is asserted.

🔴 **Before you trust a passing test, make it fail once on purpose** — change an expected string,
confirm it goes red, change it back. **A test that cannot fail is the defect class this whole
project exists to catch, and it has shipped here repeatedly.**

## 7 · VERIFICATION — what you run, and what you must not

    npx tsc -p tsconfig.typecheck.json --noEmit      ← always this exact form, never bare `tsc`
    npx vitest run tests/<your-test-file>            ← your own test only

🔴 **Do NOT run the full ward suite (`scripts/run-ward-tests.mjs`), Playwright, or any `test:e2e`
command.**

⚠️ **CORRECTED 2026-09-12 — THE EARLIER REASON GIVEN HERE WAS WRONG, AND WRONG IN THE DIRECTION
THAT INVITES THE BREACH.** This section used to say _"the browser runner takes a machine-wide
lock"_. **`run-ward-tests.mjs` takes NO lock.** Its own header says so and says why it matters:

> ⚠️ **KNOWN LIMITATION: THIS DOES NOT TAKE A REPOSITORY COORDINATOR LEASE.** It spawns `npx vitest`
> directly… **So several sessions running the whole ward suite through this wrapper bypass that
> limit entirely** — and the limit is real.

🔴 **So an agent reasoning from the old wording concludes "no lock, therefore harmless". The truth is
the opposite: it takes no lock, so nothing will stop it contending with every other session on this
machine.** ✅ **The lock reason is true of Playwright ONLY. Do not run either; the reasons differ.**

### 🔴 HOW TO READ A RESULT — and note which line your tool can actually print

**NEVER read an exit code as the verdict.** ⚠️ **Measured three times in one night: a background
notification reported "exit code 0" over a run whose own summary read `failed: 5`.**

**Read the runner's OWN summary and the POSITIVE counts.**

⚠️ **CORRECTED 2026-09-12: `files handed in` / `files that ran` are printed ONLY by
`scripts/run-ward-tests.mjs` — the runner this section forbids you.** 🔴 **The earlier version told
you to check that those two are equal while prescribing a tool that cannot print them, so an agent
following it literally hunts for a line that cannot appear.** ✅ **What `npx vitest run` prints, and
what you therefore report:**

    Test Files  1 passed (1)
    Tests      13 passed (13)

**Report both lines verbatim, and say WHICH FILES you handed it, so the controller can check the
file count itself.** 🔴 **The handed-in-equals-ran check is the CONTROLLER's, over the union. It is
not available to you, and claiming it would be claiming a measurement you did not take.**

🔴 **Never conclude from the absence of a failure message.**

## 8 · REPORT BACK

1. Every file you created or modified, by path
2. Verification output, quoted **verbatim** from the runner
3. 🔴 **Every "APP ONLY" item and whether you KEPT it** — the most important part of your report
4. What you could **not** build honestly, and why
5. Any shared-file edit you need the controller to apply
6. Anything in the contract you found to be **wrong** once you opened the code

**If you reach a decision this brief does not cover, STOP and hand it back rather than guessing.**

## 9 · Added 2026-09-12, Step 4 — does this brief bind whoever wrote it?

**No.** Every rule above addresses _you_, the screen-building agent — not the controller who
compiled and dispatches this brief. The document says so throughout, by contrast rather than by
omission: the controller commits (§2), applies shared-file edits centrally (§1), and performs the
handed-in-equals-ran check over the union (§7) — the exact things this brief forbids _you_ from
doing. This is a rule for lanes, not a rule the coordinator who wrote it also lives under.
