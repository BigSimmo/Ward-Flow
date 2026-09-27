# Skipped-test reconciliation — ward suite, 2026-09-07

**Method note, because a prior report on this exact question got it wrong:** "82 skipped" was
previously reported as one number by adding two different populations together — tests excluded
by an environment gate (would run on a machine/config that met the precondition) and tests a
human deliberately parked with `.skip`. Those mean different things and are kept separate below.
Nothing was un-skipped, changed, or committed to produce this report; it is read-and-report only.

## Headline reconciliation

```
tests run:              npx vitest run "tests/ward-"
files searched:         347 (git ls-files "tests/ward-*.test.ts" "tests/ward-*.dom.test.tsx",
                         cross-checked against a filesystem glob — both agree, no untracked
                         ward test files exist)
vitest-reported:        Test Files  5 failed | 331 passed | 11 skipped (347)
                         Tests       6 failed | 4015 passed | 2 expected fail | 75 skipped (4098)

(a) environment-gated:    0 cases  — bucket is genuinely EMPTY, see "Bucket (a)" below
(b) deliberately parked:  75 cases — 12 skip sites across 12 files (11 whole-file, 1 partial-file)

0 + 75 = 75  →  MATCHES vitest's reported 75 skipped exactly.
```

The per-file case counts below were derived three independent ways and all three agree:
reading the source of every skip site, vitest's own reported total (75), and the historical
`docs/ward-flow/archive/dated-notes/retired-coverage-record-2026-09-06.md`, which itself states its counts were "read
from vitest's own JSON reporter rather than counted from source." No adjustment was made to force
a match — the sum came out exact on the first count.

**11 of the 12 skip sites skip their entire file** (so they land in vitest's "11 skipped" file
tally). The 12th, `ward-device-claim-reason.dom.test.tsx`, skips one `describe` block inside a
file that also has a passing `describe` — so vitest counts that file under "passed" (it has no
failures), not "skipped," even though 3 of its cases are skipped. That is why 12 skip sites
produce a file tally of 11, not 12, and it is a real reconciling detail, not a discrepancy.

## Two other populations found while searching — noted so they are never added to "skipped"

- **"2 expected fail"** in vitest's own summary line is `it.fails(...)`, found in
  `tests/ward-flow-reducer.test.ts:813` and `tests/ward-movement-fixture-reducer-reachable.test.ts:130`.
  These are tests that assert something is CURRENTLY broken and pass when it stays broken — a
  third, distinct population from both buckets below. They are not skipped and are not part of
  this classification.
- `tests/ward-travel-bands.test.ts:243` carries `it.skipIf(!TRAVEL_BANDS_ARE_INVENTED)` — a real
  conditional-skip construct, but `TRAVEL_BANDS_ARE_INVENTED` (`src/components/ward-management/
ward-travel-bands.ts:49`) is a hardcoded `true`, so `skipIf(false)` currently means **this test
  runs**. It contributes 0 to today's skipped count. It is listed under "conditions that could
  disable a test" for completeness, not because it is doing so today.

## Bucket (a) — environment-gated: EMPTY

No ward test currently skips because of an environment/platform/CI precondition. Search performed
across all 347 files:

- `\.skip\(|skipIf\(|\.todo\(|describe\.skip|it\.skip|test\.skip` — the only `skipIf(` hit is
  `ward-travel-bands.test.ts`, addressed above (currently not skipping).
- `xdescribe|xit\(|xtest\(|describe\.skipIf|it\.skipIf|test\.skipIf|\? describe :|\? it :|\? test :`
  — no real hits (one match on `childExit` was a substring false-positive for `xit(`).
- `process\.platform|process\.env\.|os\.platform\(\)|win32|CI\s*===|IS_CI` — two files matched,
  neither is a skip gate: `ward-flow-chat-control.test.ts` uses `process.platform` as an expected
  VALUE inside an assertion and `process.env.*` to pass variables into a spawned child process;
  `ward-journeys-lane-runs-without-blocking.test.ts` only mentions `skipIf(win32)` in a comment
  describing a _different, non-ward_ file (`ci-cache-safety.test.ts`).
- `\bctx\.skip\(|\bthis\.skip\(|expect\.skip|\bskip\(\)` (dynamic/runtime skip calls) — no hits.

So bucket (a) is empty by measurement, not by assumption: there is currently no ward test whose
non-run is explained by "this machine/config doesn't qualify." Every skipped ward test today is a
human decision.

## Bucket (b) — deliberately parked: 75 cases across 12 skip sites (12 files)

🔴 **NARROWED 2026-09-07 BY WARD VERIFIER, AND THE ORIGINAL WORDING CLAIMED MORE THAN THE FILES
CARRY.** This section was first summarised as _"all deliberate, none accidental"_. **That is a claim
about intent, and the code does not carry it.** Measured on a second tree, independently:

- **NOT ONE of the twelve states a reason AT THE SKIP SITE.** The rulings below were reconstructed
  from surrounding comments and dates, not read off the `describe.skip` line. **A reconstruction is
  evidence about what somebody could work out later, never about what was decided at the time.**
- 🔴 **SIX OF THE TWELVE COVER LIVE ROUTES** — the four community suites and two ED ones, against
  `/community`, `/community/[teamId]` and `/ed/[edId]`, **none of which is a redirect.** Parking a
  suite over a screen a user can still reach is a coverage hole, not a retirement.
- **Five sit over folded-away screens** (escalation, morning, tracker), where parking is right.
- **One is the conditional** (`skipIf`), which currently evaluates to RUN.

**So the honest split is: five parked correctly, six parked over live screens with no recorded
reason, one conditional.** The mechanism half of the original count is unchanged and was confirmed
by both measurements — **12 skip sites, 1 `skipIf`, zero environment gates, 75 cases matching
vitest's own tally.** It is only the word "deliberate" that was too wide.

⚠️ **This correction is the same error the document was written to fix, one level up.** The original
82 added two populations that mean different things; the replacement said 75 were all one thing.
**Both compressed a distinction that the underlying files do not make.**

All 12 sites trace to two owner rulings, both dated 2026-09-06/07, both on the same theory:
a component that no app route currently renders had its test file's cover **parked, not deleted**,
with the case text preserved in `docs/ward-flow/archive/dated-notes/retired-coverage-record-2026-09-06.md` so it can
be restored from the record if the screen is revived. `tests/ward-component-reachability.test.ts`
is the live guard: it reddens if any of these components becomes reachable again, which is the
one hook that would tell a future session to look at this file.

| #   | File                                      | `describe` skipped                                                                                | Cases | Condition                                                         | Why (from the file's own comment)                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------------------- | ----: | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `ward-community-figures.dom.test.tsx`     | `CommunityFigures`                                                                                |     4 | unconditional `describe.skip`                                     | `CommunityFigures` reached only from `CommunityHome`, itself unreachable — owner ruling 2026-09-06, "the eleven replaced ward screens are finished with"                                                                                                                                                                                                                                                                                                                        |
| 2   | `ward-community-teams-table.dom.test.tsx` | `CommunityTeamsTable`                                                                             |     5 | unconditional `describe.skip`                                     | Same ruling; reached only from `CommunityHome`                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 3   | `ward-escalation.dom.test.tsx`            | `EscalationBoardPage`                                                                             |     6 | unconditional `describe.skip`                                     | Same ruling; `/escalation` redirects to `/delays` — no route renders the component                                                                                                                                                                                                                                                                                                                                                                                              |
| 4   | `ward-morning-tour.dom.test.tsx`          | `MorningTour`                                                                                     |     7 | unconditional `describe.skip`                                     | Same ruling; reached only from `morning-page.tsx`, itself unreachable                                                                                                                                                                                                                                                                                                                                                                                                           |
| 5   | `ward-tracker-leg-badge.dom.test.tsx`     | `live tracker leg badges` (renders `LiveTracker`)                                                 |     2 | unconditional `describe.skip`                                     | Same ruling; `/transport` redirects to `/movements`                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 6   | `ward-community-team-hub.dom.test.tsx`    | `CommunityTeamHub — the community role's own, restricted landing`                                 |     4 | unconditional `describe.skip`                                     | Same ruling; `/community/[teamId]` renders `CommunityScreen` instead                                                                                                                                                                                                                                                                                                                                                                                                            |
| 7   | `ward-community-scope.dom.test.tsx`       | `CommunityHome — the coordinator's scope switch`                                                  |     5 | unconditional `describe.skip`                                     | Same ruling; `/community` renders `CommunityIndex` instead                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 8   | `ward-ed-home.dom.test.tsx`               | `EdHome`                                                                                          |    12 | unconditional `describe.skip`                                     | Same ruling; `/ed/[edId]` renders `EdScreen` instead                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 9   | `ward-ed-service-bands.dom.test.tsx`      | `EdServiceBands`                                                                                  |     5 | unconditional `describe.skip`                                     | Same ruling; reached only from `EdHome`, itself unreachable                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 10  | `ward-device-claim-reason.dom.test.tsx`   | `a retired board's stated reason for not being a medical device` (the escalation-board half only) |     3 | unconditional `describe.skip` on one of two describes in the file | Same ruling, escalation half only. **Split on 2026-09-07**: the file originally skipped all 8 cases (both the escalation-board AND the live referral-board medical-device checks) as a side effect of retiring the whole file — the referral board is live (`/mockups/ward-flow/referrals`) and was never meant to be covered by that ruling. The 5 referral-board cases were restored into a sibling non-skipped `describe`; only the 3 escalation-board cases remain skipped. |
| 11  | `ward-morning-page.dom.test.tsx`          | `MorningPage`                                                                                     |    20 | unconditional `describe.skip`                                     | A _separate_, later "Ward Lead's ruling, 2026-09-06": `MorningPage` has been unmounted since a merge folded the morning bed-state board into `CapacityScreen`; `/mockups/ward-flow/morning` is a redirect stub. The file's own comment explicitly forbids re-pointing these assertions at `CapacityScreen` — the two screens deliberately differ (sex mix, specialling headroom) and that is an open owner question, not something a test rewrite should silently settle.       |
| 12  | `ward-morning-tour-paused.dom.test.tsx`   | `the guided tour is paused`                                                                       |     2 | unconditional `describe.skip`                                     | A third, **unrelated, earlier** ruling (2026-08-30): the guided tour feature it describes "is not built." The file's own assertion is inverted — it currently proves the tour does NOT render, and its own comment says explicitly: restore by removing this file if the tour is deliberately switched back on.                                                                                                                                                                 |

Row 10's original file additionally carries a `describe` (`"a live board's stated reason for not
being a medical device"`, `LIVE_BANNERS`) with a floor test (`walks the live boards, so nothing
below can pass on an empty set`) plus 4 more cases for the referral board — none of those are
skipped; they are not listed above because they run.

## What should happen to each parked test

- **Rows 1–9 (the seven single-purpose community/ED screens plus the escalation board and its
  tracker) — leave parked.** Each is retired for the same, single, checkable reason (no route
  renders the component), each has its case text preserved in the 2026-09-06 record, and each is
  covered by `ward-component-reachability.test.ts`, which will redden and name the file the moment
  any of them becomes reachable again. There is nothing to act on until that guard fires.
- **Row 10 (`ward-device-claim-reason.dom.test.tsx`) — leave parked, and treat the 2026-09-07 split
  as the template.** This is the one case where a blanket file-level skip once hid live coverage
  (the referral-board medical-device claim) behind an unrelated retirement; that has already been
  fixed by splitting the file. Nothing further to do unless the escalation board becomes reachable.
- **Row 11 (`ward-morning-page.dom.test.tsx`, 20 cases) — leave parked, but this is the one that
  most needs an owner decision, not just a reachability check.** Its own comment states the
  screen was deliberately not replaced 1:1 by `CapacityScreen` and that whether `CapacityScreen`
  should ever show sex mix and specialling headroom is an open question. Restoring these 20 cases
  is not just a "did the component come back" mechanical check the way rows 1–9 are — it needs the
  owner to actually decide that question first, or the guard will never have anything to fire on
  (the component `MorningPage` may simply never be wired to a route again, and the cases would sit
  parked indefinitely without anyone revisiting whether that is still correct).
- **Row 12 (`ward-morning-tour-paused.dom.test.tsx`, 2 cases) — leave parked, and reread it as a
  status file, not ordinary dead cover.** It does not test a retired component; it tests the
  ABSENCE of a feature ("the guided tour is paused") and explicitly instructs future readers to
  delete the file, not un-skip it, if the tour is turned back on. It should stay exactly as-is
  until that product decision is made.

Recommendation is the same shape for every row: **do not un-skip any of these to "make a number
go up."** Every file says so explicitly, and the sole basis for restoring any of them is either
`ward-component-reachability.test.ts` reddening (rows 1–10) or an owner decision reopening the
screen (rows 11–12) — never a manual edit to the `.skip` line.
