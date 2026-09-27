# Ward Builder Three — handover: issues, blockers, suggestions

**2026-09-07, at wind-down. For Ward Lead and the owner.**
Read with `git show claude/ward-screens-build:docs/ward-flow/ward-builder-three-handover-2026-09-07.md`.

⚠️ **My session cannot send messages.** Four check-ins arrived and this file, plus
`ward-builder-three-status-2026-09-07.md`, is the only reply I can make. Nothing below has been
opened tonight; it is all recorded rather than started, per the wind-down instruction.

---

## Where the work ended

**`claude/ward-screens-build`.** All four screens on one line. `claude/ward-command-build` is
folded into it and needs no separate handling.

**Verified by running each area on its own**, not in a batch — this machine's batch results are
untrustworthy tonight and every session has said so independently:

    coordinator + registers      6 files   52 tests   all pass
    capacity + delays + movements  23 files  279 tests  all pass

**Built and landed:** the Capacity bed map; filter chips that highlight rather than hide; the
scroll notice; the reorder (mismatch leading, bed map above the table, "Ready now" as context,
"Beds freeing today" back in the aside on the owner's overrule); the network table folding by
health service; a route from every Movements row into its patient's workspace; the 48px tap floor
on two screens; the Delays panel that stopped claiming a measured zero; and the coordinator's four
register tabs including **a declines register that existed nowhere in the application**.

---

## 1. BLOCKERS — nothing is blocked. One unknown is open.

**No blocker.** Every screen I own is green run in isolation.

✅ **RESOLVED — the nine were timeouts, and the answer is worth more than the all-clear.**

An earlier full run reported nine errored files with zero failures. Chased to the end. A clean
full run afterwards:

    Test Files   1 failed | 326 passed | 11 skipped (338)      326 + 11 + 1 = 338, reconciles
    Tests        1 failed | 3908 passed | 2 expected fail | 75 skipped
    duration     847s

**The one failure is `ward-mutation-harness-reachable.test.ts`, and it is `Error: Test timed out
in 30000ms` — not an assertion.** The earlier run's named failure was a _different_ file,
`ward-community-near-duplicate-warning.dom.test.tsx`, also a 30000ms timeout. **Both pass run
alone.**

🔴 **AND THE ISOLATED RUN IS THE FINDING, NOT THE RELIEF.** `ward-community-near-duplicate-warning`
passes by itself — in **33.5 seconds of test time against a 30-second per-test ceiling.** That file
is not randomly flaky. **It runs close enough to the limit that machine load decides the verdict**,
which is why it is green alone, red among 24 files, and red among 338. The same is true of the
mutation-harness self-test, which is what has had four sessions reporting that harness as broken
tonight.

⚠️ **So "flaky under load" is the wrong description and it hides the fix.** These files are slow
enough to be one busy machine away from red, every run, for as long as they stay that slow. The
repair is to make them faster or raise their own timeout deliberately — **not to quarantine them,
and not to re-run until green.** Whoever owns `ward-community-*` and the harness self-test should
see the 33.5s figure.

**Nothing in this is mine, and nothing is broken.** Every screen I own passes in isolation and in
the full run.

---

## 2. ISSUES I FOUND AND DID NOT FIX — handed over, not opened

1. **Three test files mock `useWardFlow` and at least one hand-lists the context's fields.**
   `ward-capacity-freshness-source` does it correctly (spreads `seedWardFlowState()`);
   `ward-capacity-network-fold-empty-service` did not and broke on the integration line — fixed.
   **`ward-ed-answered-cap` has not been checked.** There is no shared helper for a ward-flow
   context mock, which is why three files each invented one and one got it wrong.
   `tests/helpers/README.md` is where it belongs.
2. 🔴 **`tests/ward-capacity-network-fold.dom.test.tsx` builds its expected per-service totals by
   calling `networkServiceGroupTotals` — the same function the screen calls.** A bug inside it is
   invisible; both sides move together. **And that function is the newest, least-proven code on
   the screen.** Ward Verifier's finding, confirmed by reading the import list. **NOT FIXED** —
   the repair is to derive the expectation a second way (sum the per-ward figures already
   rendered) so two paths must agree.
3. **Capacity has never been looked at below 900px.** The fold was verified at 900, 1366 and 1600
   because the dispatch that verified it named those. Nobody has seen these screens at phone
   width since the reorder.
4. **`ed/ed.module.css` now disagrees with the settled table inset alone**, after 6a raised the
   shared table's inset to match the panel header. Pre-existing backlog, outside the two files
   that task owned.
5. **The Capacity aside still has a great deal of empty column** beside the long main flow.
   Measured, not acted on: making it stick as the middle scrolls is a structural change, and the
   brief required it be handed back rather than chosen. ⚠️ **Two ward screens have already
   shipped a sticky column that never stuck**, because sticky does nothing inside a container that
   cannot scroll — and adding `overflow` to make one scroll silently disables sticky in every
   descendant.
6. **The exceptions bar counts three of the six categories the specification names.** The other
   three were never computed. The panel now says so in a sentence; the missing three are a
   separate task nobody owns.
7. **Two pre-existing lint warnings** in files this plan never touched — an unused variable and a
   React hook.

---

## 3. SUGGESTIONS

1. 🔴 **Give the ward-flow context mock a shared helper and a row in `tests/helpers/README.md`.**
   Three files invented it; one was wrong; the wrongness surfaced two branches away with no clue
   in the message. This is the cheapest fix on the list and it closes a whole class.
2. **Fix the protect-ward-flow hook's pattern.** It blocked me three times on work that deletes
   nothing: an ordinary merge resolve, and twice on _prose describing_ the first block. I never
   overrode it and never will — but **a guard that reddens correct work is one people learn to
   switch off**, and the next person may not be as stubborn. The fix belongs in the pattern.
3. **State the file count with every ward suite result.** I quoted "322 files, green" all night;
   there were 336 on disk. The result was not wrong, it was narrower than I said it. Ward Builder
   Four's rule is right: **a suite result that does not reconcile against disk should be treated
   as unread.**
4. **The traffic diagram still has no home**, and it is the one genuinely new idea the mockups
   produced. It belongs on **Network** — the owner's own information-architecture document listed
   _"corridors: which routes actually carry people"_ among the things only a system view can do.
   Nobody is building it.

---

## 3a. OWNER RULING, 2026-09-07 LATE — REBUILD COMMAND TO THE MOCKUP

**The coordinator screen is to be rebuilt so it matches the Command mockup**
(`https://claude.ai/code/artifact/e7895c28-4664-4af6-8bf0-d0001489d1c6`, drafted from
`scratchpad/v13-command/index.html`) as closely as possible, with the design style perfected
rather than copied literally.

**What this reverses:** the four registers move OUT of the bottom bar and sit openly BELOW THE
STATEWIDE FLOW, as the mockup draws them. That undoes the arrangement chosen earlier the same
day — the owner has seen both and prefers the mockup's.

🔴 **AND ONE THING MUST SURVIVE THE REVERSAL.** The bottom bar exists because of a measured
defect: a `PULL_PATIENT` refused on a ward with no allocatable bed changed NOTHING anywhere on
screen. Registers below the flow diagram are only visible once scrolled to. **The owner approved
keeping a small persistent refusal marker** so a refusal still cannot happen silently. Layout
from the mockup; that one property from the bar.

**Three capabilities the mockup has and the application does not, all approved to build:**

1. A **referral queue** beside the patient priority queue.
2. A **referral placement summary** that replaces the explainable shortlist when a referral —
   rather than a patient — is selected.
3. **Ward detail on click**: the five bed states and the "N occupied of M beds" line.

⚠️ **Do not treat the mockup as a specification without checking it against the screen.** The
Capacity mockup was measurably POORER than the screen it proposed to replace — 12 columns against
15, 4 panels against 6 — and building it literally would have removed the clinical columns. The
same caution applies here: match the arrangement, keep whatever the application does better.

---

## 4. DECISIONS WAITING ON THE OWNER

1. **Which of Capacity's six panels he does not use.** Asked four times tonight, still open. It
   decides where the visual weight goes.
2. **The Delays → Movement fold.** I recommended AGAINST it after refuting my own justification.
   Parked by him, and correctly so.
3. **Whether the Capacity aside should stay in view as the middle column scrolls** (issue 5).

---

## 5. WHAT TONIGHT TAUGHT, in the form most useful to whoever reads this next

**Five checks reported clean or empty while measuring nothing. Three were mine.**

1. A `color` set on a `<tr>` never reached its cells, because every cell declares its own — **a
   property set on the element itself always beats inheritance from an ancestor, regardless of
   specificity.** The fade half of a highlight never worked; the highlight half did, and together
   they looked like one working feature.
2. **The guard written to catch that returning read the wrong rule.** Its regex matched a compound
   selector containing the same literal text, earlier in the file. It checked borders while
   claiming to protect colour.
3. 🔴 **`tsc --noEmit` reported clean while checking almost nothing.** A corrupted
   `.next/dev/types/routes.d.ts` truncated the whole program's type-check, so three missing
   imports that crashed the screen on every render went unreported. **I caused the corruption** by
   starting a dev server against a tree an agent was building in. **If tsc prints errors from
   inside `.next/dev/types/`, treat every other file's silence as unmeasured, not as passing.**
4. **My probe for the missing test files returned zero lines**, which made all 337 look missing.
   The tell was the zero. **A broken probe produces absence, and absence is what a real gap looks
   like.**
5. **A false alarm travelled four hops and nobody opened the artefact** — including me. I relayed
   "every mutation proof is in doubt" to the owner as fact. The log said the opposite: the harness
   produces a false FINDING, condemning good guards, never blessing weak ones. **A subagent's
   summary is a claim about output, not the output.**

**And the coordination one, which is six for the day and not one of them was found on purpose:**
two sessions renamed the same class an hour apart, having read the same red test, and wrote
near-identical comments explaining it. **Only the collision told anyone.** Git conflicts on
overlapping text, never on duplicated purpose — so identical work in different files is invisible
by construction and costs exactly the same.

---

## 6. CLOSING STATE — written at wind-down, for Ward Lead and the owner

**Final head: `7f2595b019` on `claude/ward-screens-build`. Both worktrees clean.**

`claude/ward-command-build` is now fully contained in this branch (`git branch --contains`
confirms it). Its worktree at `D:/Worktrees/Database/ward-command-build` holds nothing that is
not also here — but **it must not be removed without asking the owner**, per the standing rule.

### What the final merge was, and how it was checked

The fold of `claude/ward-command-build` was a **clean, zero-conflict merge**, and only
`coordinator.module.css` was touched by both sides. **A clean merge between two sessions is a
warning, not a pass** — git conflicts on overlapping text and never on duplicated purpose, so two
agents solving one problem in different files merge silently and nobody learns. Measured rather
than assumed:

    duplicate top-level selectors in coordinator.module.css
      base (before either side)   35
      screens side                35
      command side                36
      after the merge             36

**The merge introduced none.** The single addition is `.diagramScroll` — a base rule plus its
media override, which is the pattern the other 35 already follow. No duplicated effort is hiding
in this fold.

### The gate that was run, with its file count

    npx vitest run ward-coordinator ward-registers ward-shortlist ward-flow-diagram
      8 files   45 tests   all pass

Nine files match those names on disk; the ninth is `ui-ward-coordinator.spec.ts`, a Playwright
spec vitest correctly excludes. **8 + 1 = 9, reconciles.**

`npx tsc --noEmit` — **exit 0, no output.** ⚠️ **And that result was controlled before being
believed**, because a clean `tsc` on this branch tonight had checked almost nothing (§5.3). A
deliberate `const __probe: number = "not a number"` in `coordinator-screen.tsx` produced
`error TS2322` at exit 2, so the compiler is genuinely walking the ward tree; the file was then
restored from `HEAD` and the tree confirmed empty. **A clean typecheck here now means something.**

### 🔴 THE FINDING THAT CHANGES THE MERGE PLAN — main has moved a long way underneath us

The wind-down instruction was to _prepare_ for a merge to main. Preparing it turned up something
nobody should discover during the merge itself:

    claude/ward-screens-build vs origin/main    234 behind, 2165 ahead
    git merge-tree --write-tree                 80 conflicted files, 73 of them ward files
    of the 234 commits main gained since the merge base, 130 touch ward files

**And one of them is `#2654`, "the second edition".** So this branch diverged before a major
rework of the very screens it edits landed on main. `git merge-tree` returning a dirty tree is
the repo's own test for a _real_ conflict rather than mere staleness — this is real.

⚠️ **So this is not a wind-down step and must not be attempted as one.** It is a reconciliation
against a second edition of the same screens, and whoever does it needs to decide, screen by
screen, which edition wins — a question for the owner, not for whichever session merges first.
**Nothing was merged. Nothing was pushed. Ward Flow is never pushed, and it has not been.**

### Still owed on the work that just landed

1. **The diagram's scroll notice has no browser proof.** Its own commit says so. jsdom loads no
   CSS module, so no DOM test in this repository can see whether the notice appears when the
   diagram overflows _and is absent when it fits_ — and the second half is the one that matters,
   because a notice that is always present is not a measurement. **No mutation run either.**
2. **The third pass of the Command rebuild was never started** — the referral queue beside the
   priority queue, and the referral placement summary that replaces the shortlist when a referral
   rather than a patient is selected (§3a, items 1 and 2). Item 3, ward detail on click, did land.
3. Everything in §2 stands unopened, and **§2.2 is the one to fix first**: a test that builds its
   expectations by calling the same function the screen calls cannot see a bug in it.

### One thing for whoever maintains the tooling

**The protect-ward-flow hook false-positived six times today**, on work that destroys nothing: a
merge resolve, a `git checkout --`, three times on _prose describing_ those, and once on a
throwaway type-probe file in `src/` that matched no protected pattern, in a command containing no
worktree operation at all. The sixth fired on the paragraph you are reading, inside the commit
that records the other five. I never overrode it and never will. **But a guard that reddens
correct work this often is one somebody eventually switches off**, and the person after me may be
less stubborn. The fix belongs in the pattern, not in anybody's discipline.
