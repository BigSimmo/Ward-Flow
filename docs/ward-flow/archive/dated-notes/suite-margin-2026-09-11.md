# The suite red is a clock, and the proof is that the two tests swapped places

**Ward Verifier, 2026-09-11, ~22:30.** The first complete ward suite run since Ward Lead's
coordinate fix, on `43882f1221` (my tip `1483f852cc`, ancestor check passed). **One red.**

---

## 1 · The run, reconciled

    files handed in : 387        files that ran : 387
    tests collected : 4620
    passed          : 4544
    failed          : 1
    skipped         : 75
    RECONCILE       : 4544 + 1 + 75 = 4620   ✅
    batches run     : 3          vitest exit : 0, 1, 0

⚠️ **Counted from the three report JSONs, not read off the summary line.** `todo` and unknown
statuses both zero.

**Load, sampled every 15 s:** start **92 node / 6.00 GB free** · worst free **5.75 GB at 22:21:18**
(node 100) · peak node **107 at 22:27:15** · end **90 node / 7.01 GB**. Wall clock 22:15:55 → 22:29.

⚠️ **The 12 Playwright ward journeys are not in this run and vitest cannot run them.**

## 2 · 🔴 THE RED, AND WHY ITS IDENTITY IS THE FINDING

`tests/ward-mutation-harness-reachable.test.ts` — _"runs the command package.json actually declares,
and every harness guard fires"_ — **35,830.302 ms**, `Error: STACK_TRACE_ERROR`. **No assertion
message, no expected, no received.**

🔴 **Same two tests, two consecutive full runs, no change to either file:**

                                             run 2            run 3          ceiling
    override-register  "never lets the …"   FAILED 30,149     passed 14,273   30,000
    mutation-harness   "runs the command"   passed 22,573     FAILED 35,830   30,000

**A 2.1× swing on one and 1.6× on the other. The failing test changed; neither file did.**

## 3 · 🔴 SOLO ON A QUIET MACHINE IT IS 94% OF ITS CEILING

    22:32:33 → 22:33:27   Test Files 1 passed (1)   Tests 2 passed (2)
    Duration 30.30s (transform 343ms, setup 0ms, import 368ms, tests 28.09s)

The file's other test is 4 ms, so **the failing test alone is ≈28.09 s against a 30,000 ms ceiling —
93.6% consumed with nothing else running. The margin is 1.9 seconds.**

⚠️ **`vitest.config.mts:25` `testTimeout: 30_000` is the ceiling in force.** The `60_000` at `:155`
belongs to the `caring-contacts-db` project only, and this file carries no override of its own.

## 4 · 🔴 THE FILE'S OWN DOC COMMENT SAYS "Runtime is ~3 seconds"

**Measured: 22.6 s · 28.1 s · 35.8 s. Wrong by 8–12×**, and it is the sentence that justified adding
the test at all. **The budget was never set against a true number.**

## 5 · 🔴 A PRIOR DIAGNOSIS ALREADY EXISTED AND NOBODY CONSULTED IT

`tests/ward-flow-chat-control.test.ts:278–299`, quiet-machine measurement dated **2026-09-04**:

> 🔴 **"seven tests in this file timed out at 30_000 ms — and A DIFFERENT SET FAILED ON EACH RUN,
> which is the signature of a clock rather than a defect."**
>
> **"A gate that is red when the machine is busy and green when it is quiet teaches everyone to
> re-run it, and a passing re-run is indistinguishable from a real pass."**

✅ It names the signature, names the remedy (`vi.setConfig({ testTimeout: 120_000 })`), forbids the
wrong fix, and says the measurement is the justification rather than the number. ⚠️ **Second time in
one evening that a correct prior diagnosis sat in the code, unread, while the same question was
re-derived from scratch.**

## 6 · ⚠️ A UNIT ERROR OF MY OWN — do not quote my first percentage column

My first margin table computed every row against 30,000 ms and produced **"433%, passed"**, which
cannot be true. Three rows are in `ward-flow-chat-control.test.ts`, which carries its own `120_000`
and one test at `300_000`. 🔴 **Percentages against the wrong ceiling, caught by a figure that could
not exist.** Corrected — every test ≥10 s in the run:

         ms   ceiling     %   status   file
     35,830    30,000   119%   FAIL    ward-mutation-harness-reachable      (solo: 94%)
     14,273    30,000    48%   pass    ward-override-register-render
     13,152    30,000    44%   pass    ward-community-near-duplicate-warning
     12,042    30,000    40%   pass    ward-legal-figure-guard
     11,668    30,000    39%   pass    ward-community-ratified-alias-on-screen
    129,814   300,000    43%   pass    ward-flow-chat-control   (own override)
     14,996   120,000    12%   pass    ward-flow-chat-control
     12,320   120,000    10%   pass    ward-flow-chat-control
     10,942   120,000     9%   pass    ward-flow-chat-control
     10,687   120,000     9%   pass    ward-flow-chat-control

**Four files sit on the 30,000 ceiling at 39–48% under load. Only the harness file is over it.**

## 7 · The fold

🔴 **No go-ahead. The run is not green, and I am not softening my own stated condition because I now
have a measured cause rather than a guess.** ⚠️ My sixteen commits are docs-only and touch no test —
**but that is an argument about blame, not about colour.**

**What unblocks it:** raise this one file's ceiling as `ward-flow-chat-control.test.ts` was raised,
citing the quiet-machine 28.09 s as the justification, then one green run. **One line, and its
rationale already exists next door.** The file is `b8e013301f`, written for Ward Lead's ask;
**it is not mine to edit and I have not touched it.**

## 8 · What this does not establish

- **Nothing about WHY the harness self-test takes 28 s.** It spawns `npm run mutate:self-test` as a
  child process; I timed the test, not the harness's internals.
- **One machine, one evening, three runs.** Two full-suite observations and one solo is enough to
  show the swap; it is not a distribution.
- **Nothing about the 12 Playwright journeys**, which neither run touched.

---

## 9 · Added after the first commit — a THIRD run, and a GREEN, from two other chats

The Design System chat sent its own full ward-suite run unprompted, and named Ward Lead's.
**That turns the two-point swap above into a four-run series on one population.**

    run                  red file                            ms       ceiling
    my run 2             ward-override-register-render     30,149      30,000
    my run 3             ward-mutation-harness-reachable   35,830      30,000
    Design System's      ward-override-register-render     34,987      30,000
    Ward Lead's          none — 4545 / 0                        —           —

✅ **The population reconciles exactly.** Measured in my own reports: `collected 4620 · skipped 75`
→ **runnable 4545**. **So `4545 / 0` and `4544 / 1` are the same population with the one red green;
4544 + 1 = 4545 with nothing left over.**

**All three reds are `STACK_TRACE_ERROR` with no assertion, no expected, no received.**
**Solo, each passes in the high-90s percent of its 30,000 ms ceiling**: override-register 13/13 in
28.6 s (Design System's figure) and 21,453 ms for its long test (mine); mutation-harness 28.09 s
(mine).

⚠️ **PROVENANCE.** **Runs 2 and 3 and both of my solo figures I measured.** **Design System's run
and Ward Lead's are REPORTED TO ME, on trees I have not read**, and Design System's clause "of the
same content" is their claim rather than my measurement. **What I can check without their trees is
the arithmetic above, and it closes.**

### 🔴 What the green does NOT settle

**Four runs of one population giving 0, 1, 1, 1 reds with the identity moving is exactly the state
`ward-flow-chat-control.test.ts:278–299` was written to end**: _"a passing re-run is
indistinguishable from a real pass."_ **A green re-run is the fourth roll, not a measurement.**

⚠️ **And every one of the four ran with 20+ worktrees live and ~90–107 node processes at rest.**
🔴 **A green obtained under that load is evidence of a good roll, not of headroom. The only
near-idle numbers anyone has are the solo ones, and they say 94–95%.**

### The fix is now needed on two files, not one

`ward-mutation-harness-reachable.test.ts` **and** `ward-override-register-render.dom.test.tsx`.
**Both sit at ~95% of ceiling solo. Neither is mine, and I have touched neither.**

---

## 10 · 🔴 THE RUNNER TAKES NO LEASE, AND IT SAID SO ALL ALONG

**Added at Ward Lead's ruling: a finding belongs with its document, not split across two.**
**Lane B found the limitation; I read the header and it carries a second sentence that lands
directly on §9's four-run table.** `scripts/run-ward-tests.mjs:37–46`, verbatim:

> ⚠️ **"KNOWN LIMITATION, 2026-08-30: THIS DOES NOT TAKE A REPOSITORY COORDINATOR LEASE.**
>
> **It spawns `npx vitest` directly. `npm run test` goes through `scripts/run-vitest.mjs`, which
> calls `acquireHeavyRunLock` first; the coordinator permits at most two focused Vitest leases
> across all worktrees and treats a full run as exclusive. So several sessions running the whole
> ward suite through this wrapper bypass that limit entirely — and the limit is real: probed at
> 13:34 the coordinator refused a run outright because a live Codex worktree held capacity.**
>
> 🔴 **That is a CANDIDATE cause of the `VirtualAlloc failed` worker death this tool exists to
> catch — memory exhaustion from concurrent unthrottled runs. Stated as a hypothesis and not a
> measurement."**

### What this changes

🔴 **Every full-suite figure quoted here and by every other lane tonight was taken UNSERIALISED** —
including the green (run D) used at one point to call the reds phantom. ⚠️ **A pass under contention
is a stronger pass, not a weaker one, so this does not invalidate a green.** **But it makes the
VARIANCE expected rather than surprising: a runner that permits unbounded concurrent full suites
across twenty-plus worktrees is the condition under which 0/1/1/1 with a moving identity is the
predicted result, not an anomaly.**

✅ **THE TOOL ALREADY DECLARED THE EXACT CONDITION THAT PRODUCED TONIGHT'S SERIES, AND ALREADY
LABELLED IT A HYPOTHESIS RATHER THAN A MEASUREMENT.** 🔴 **§9's four-run table plus the solo
figures in §3 are the measurement that hypothesis was waiting for. It waited eleven days.**

⚠️ **Third prior diagnosis found sitting unread in this codebase in one evening** — the other two are
`ward-flow-chat-control.test.ts:278–299` (§5) and the three `none` rulings recorded in
`none-source-enumeration-22-of-22-2026-09-11.md` §4. **In every case the reasoning was written into
the code, where anybody could have read it.**

### What it does NOT establish

- **The `VirtualAlloc` link is still a hypothesis.** **No `VirtualAlloc` death occurred in any of
  tonight's four runs**; what was measured is timeout variance, which is a different failure.
  **Do not let this section be read as confirming that sentence.**
- **Nobody has run this population serialised.** **The comparison that would settle it — the same
  suite through `scripts/run-vitest.mjs` with the lease held — has not been done.**

## 11 · ⚠️ THE BROWSER RIG EXISTS. IT IS COMMITTED, IT IS WARD-SPECIFIC, AND NOTHING RUNS IT.

Asked whether any rig walks ward routes in a browser reading `getComputedStyle`. **It was searched
for and reported absent. It is not absent — there are five, and they are ward specs:**

    tests/ui-ward-table-thresholds.spec.ts      ROUTES list at :125, iterated at :167,
                                                getComputedStyle(table).minWidth at :186
    tests/ui-ward-forced-colors.spec.ts         getComputedStyle at :67, :73, :182-183, :253-258, :387
    tests/ui-ward-referrals.spec.ts
    tests/ui-ward-search.spec.ts
    tests/ui-ward-statistics-journey.spec.ts

**Thirty committed files under `tests/` and `scripts/` use `getComputedStyle`; twenty-five of them
mention ward.** ✅ **`ui-ward-table-thresholds.spec.ts` is precisely the described instrument:
a committed route list, walked in Chromium, computed style read per route.**

🔴 **AND ALL FIVE ARE IN THE TWELVE THIS SUITE EXCLUDES BY NAME ON EVERY RUN.** ⚠️ **So the problem
was never that the rig does not exist. It is that the rig is unreachable by the only loop anybody
runs, which made it invisible to a search conducted by someone reasoning from what gets executed.**

**A sixth rig would join the same unrun pile. Extend one of the five and schedule them.**
