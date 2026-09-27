# The twelve ward browser journeys, run for the first time

**Ward Verifier, 2026-09-12, at `f57435cd45`.** **O-17.4: the owner approved scheduling the twelve
specs `verify:ui` has never run.** **This is the first time they have been run as a set.**
**Pre-registration was written and committed before the run; the lock's scope is in
`heavy-lock-scope-2026-09-12.md`.**

---

## 1 · 🟢 THE RESULT

    command       npm run test:e2e:ward-journeys
                  (run-playwright.mjs --project=chromium-mockups ui-ward-)
    collected     91
    passed        88
    skipped        3
    failed         0
    RECONCILE     88 + 3 + 0 = 91   ✅
    EXIT          0

**All twelve spec files appear in the output.** ⚠️ **The `EXIT=0` above is the recorded exit of the
npm command itself, read from the log — not the exit of the wrapper shell, which reported the exit
of a trailing `date`.**

⚠️ **THE THREE SKIPS ARE NOT NAMED BY THIS REPORTER AND I AM NOT GUESSING WHICH THEY ARE.** **A skip
is not a pass. Identifying them needs a run with the JSON reporter (`process.env.CI` selects it),
and that has not been done.** **So the honest statement is 88 passed, 3 unaccounted, 0 failed.**

## 2 · ✅ THE PRE-REGISTRATION HELD — and that is one observation, not a validated method

**Predicted before the run: ZERO reds**, by diffing `43882f1221 → d59d6e5b23` over ward source,
extracting removed strings and removed `data-testid`s not re-added verbatim, and cross-referencing
against all twelve. **Ward Lead expected two.**

⚠️ **The prediction was written against `d59d6e5b23` and the run was on `f57435cd45`.** ✅ **Checked
before starting rather than after: `git diff` over ward source between those two commits is ZERO
files, ZERO lines. The prediction carried for a measured reason.**

🔴 **A zero means "no assertion names a string or test-id that vanished". It does NOT validate the
method.** **The method is blind to additions (121 prose strings were added), to structure, to ARIA
not expressed as test-ids, to CSS-module classes, and to timing. None of those was exercised against
it tonight, because nothing failed.**

## 3 · Cost — the figure nobody had

    start                00:22:36        end   00:39:27        WALL 16 min 51 s
      next.config.ts      6.3 s
      compile             5.0 min
      TypeScript          2.6 min
      static pages        1871 pages, 1 worker, 2.1 min
      server ready        570 ms
      SPEC EXECUTION      6.1 min for 88 tests, 1 worker

🔴 **The build is ~62% of the cost and it is a full production `next build --webpack` at
`--max-old-space-size=8192`, with `cpus: 1`.** **`npm run ensure` is not needed and would be wrong —
the runner builds and serves its own isolated app; there is no `webServer` block in the config.**

⚠️ **THIS IS AN UNDER-CONTENTION FIGURE AND IT IS NOT THE "how often can this run" NUMBER.**
**Ward Lead's union ward suite was still running for the first ~56 s of my build.** **A quiet-machine
figure was not obtainable tonight and I am not substituting this one for it.**

## 4 · 🔴 THE LOCK DID NOT PAUSE IT — no wait, no queue, immediate start

**Full detail in `heavy-lock-scope-2026-09-12.md`.** **In one line: `run-playwright.mjs` takes the
heavy lock and `run-ward-tests.mjs` takes none, so the two heavy things this project runs cannot see
each other.**

## 5 · 🔴 THE RUN FOUND SOMETHING, AND IT HAD BEEN REPORTING IT TO AN EMPTY ROOM

`ui-ward-table-thresholds.spec.ts` prints, and does not assert:

> **thresholds that can never bind (3) — MEASURED AT `f57435cd45`, 2026-09-12 00:39:**
>
>     /statistics/compare  ward-statistics-compare-wards       threshold 560px vs min-content 563px
>     /discharges          ward-discharge-table-blocked        threshold 480px vs min-content 490px
>     /referrals           ward-referral-board-queued-table    threshold 480px vs min-content 516px

**Each is "at or below the table's own min-content, so it can never take effect."**

🔴 **THESE SIX NUMBERS AGE THE MOMENT ANY OF THE THREE TABLES CHANGES WIDTH OR COLUMN COUNT**, and
ten agents were building ward screens as this was written — one of them on `statistics/compare`.
**Do not quote a figure here without the SHA beside it; re-run the spec instead.** ✅ **Still true at
`76f7293805`: `git diff f57435cd45 76f7293805 -- src/components/ward-management
src/app/mockups/ward-flow` is ZERO files. The margins are 3px, 10px and 36px, so the first of them
is one column-padding change from becoming the opposite finding.**

🔴 **Three declared thresholds that cannot fire. A guard whose condition is unreachable is not a
weak guard — it is an absent one wearing a guard's name**, and all three read as present to anyone
scanning for coverage.

⚠️ **THE PART THAT MATTERS MOST: the spec has been computing and printing this the whole time.** **It
is not a new defect and it was never hidden.** 🔴 **It was invisible because nobody ran the spec —
which is the same fault as the rig nobody could find, one layer on. An unrun suite does not merely
fail to catch new faults; it accumulates findings it has already made, addressed to nobody.**

✅ **Routed, not fixed. I hold no view on whether the thresholds or the tables should move.**

## 6 · What this run does NOT establish

- **Nothing about the other browsers.** `chromium-mockups` only.
- **Nothing about the three skips**, per §1.
- **It does not validate my prediction method**, per §2.
- **One viewport per spec's own choice**, and nothing about screen readers.
- 🔴 **A first green on a population never run before is a BASELINE, not a clearance.** **Nobody
  knows which of these 88 would have been red a week ago, so nothing here says the twelve were
  passing all along.**
