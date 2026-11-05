# Consolidated figure repairs — 4 November 2026

Repository: `BigSimmo/Ward-Flow`. Task: the 16 unresolved WF-FIG findings supplied on 4 November.
Repair branch: `fix/consolidated-figures-20261104`, based on main
`559f225892b27b6c42bd7e9a6fa81f3ef81e62ec` (a descendant of the audit's pinned main).
All examples and checks use synthetic data. This is local engineering evidence, not deployment evidence.

## Changes

| Finding | Repair                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 017     | Canonical bed states accept named referral, movement and ward-inbox holds. Count each physical bed and episode once; suppress converted commitments only at their own ward. Readers receive that population, including occupancy, forecasts and paused Statistics. Releasing a pull clears its numbered movement and referral commitment. Home occupancy receives the same reservation population and refreshes when referral or movement holds change. |
| 001     | Search's count, free-bed inclusion and WardPreview use canonical reservation-aware Ready.                                                                                                                                                                                                                                                                                                                                                               |
| 004     | Alerts includes supported meeting categories and resolves their movement/admission navigation.                                                                                                                                                                                                                                                                                                                                                          |
| 002     | Accepted census uses the existing episode/destination predicate before deduplicating people.                                                                                                                                                                                                                                                                                                                                                            |
| 010     | Snapshot metadata projection shares the command parser for category-aware composite subjects.                                                                                                                                                                                                                                                                                                                                                           |
| 011     | A genuinely new meeting occurrence retires old mutable snooze/ownership through append-only histories. Completion and Undo preserve the same occurrence. Acknowledgement retains its existing enduring semantics, the audit's stated product choice.                                                                                                                                                                                                    |
| 018     | The actual Capacity forecast view records its baseline on leaving; alert readers remain read-only.                                                                                                                                                                                                                                                                                                                                                      |
| 003     | Activity identifies the effective scope and omits withheld ED rows.                                                                                                                                                                                                                                                                                                                                                                                     |
| 006     | Home uses the current recorded-form due selector. No statutory calculation is introduced.                                                                                                                                                                                                                                                                                                                                                               |
| 019     | Browser forecast baseline/history/reasons include actor, desk, scenario and world generation. Legacy unscoped history is not trusted; other desks' history survives cleanup.                                                                                                                                                                                                                                                                            |
| 014     | Preview disables marking changes reviewed and guards automatic, deferred and retained-callback baseline writes.                                                                                                                                                                                                                                                                                                                                         |
| 015     | Activity captures interval metadata with displayed rows.                                                                                                                                                                                                                                                                                                                                                                                                |
| 013     | Near-term EDD captions use minutes/hours and “Expected now”. Today membership is unchanged.                                                                                                                                                                                                                                                                                                                                                             |
| 008     | Checking names both departure and arrival transport conditions.                                                                                                                                                                                                                                                                                                                                                                                         |
| 009     | Checking describes multiple declines without claiming universal refusal.                                                                                                                                                                                                                                                                                                                                                                                |
| 016     | Capacity's own-ED figure links to a validated exact-ED Waiting filter.                                                                                                                                                                                                                                                                                                                                                                                  |

Ward-only readers use the existing inbox projection rather than receiving other referral destinations.
Preparation remains a separate marker. The competing numbered-bed guard remains enforced.
Corrected findings 005, 007 and 012 are not reinstated in the repair backlog.

## Verification and limits

New regression files cover reservation conversion/release/deduplication, reader reconciliation,
episode membership, form deadlines, forecast scope/writer, Activity context, meeting metadata and
queue/navigation populations. Existing regression checks also cover shared scope, pull release,
transport cancellation, ward referral boundaries and paused Statistics.

Local pinned Chromium revision 1248 checked desktop 1440 and phone 390 widths: Search count/preview
reconciliation, Activity opening/closing and keyboard containment/return, exact-ED Waiting rows,
Capacity and the phone forecast drawer. The clean runs had no page errors or horizontal overflow.
Earlier failed probes, their corrections and command logs are preserved in the task's private
workspace at `/workspace/scratch/figures-runtime`.

Final selected run: **69 files, 521 tests passed**. Lint and frontend/backend typechecks passed.
Runtime, formatting, diff integrity, documentation scripts/links/index/inventory and installed-lock
parity checks passed. The exact commands and earlier failed runs are recorded in the private task workspace. Focused or selected tests do not
establish a full-suite verdict. No authenticated two-client polling, hosted restore, hosted CI,
production build, physical-device acceptance, publication or deployment is claimed.

## Completion — 5 November 2026

Josh approved the scoped Home occupancy edit on 5 November. The remaining call in
`coordinator/coordinator-screen.tsx` now supplies referrals and movements and includes both in its
memo dependencies. All 16 retained findings have local repairs; no ownership blocker remains.

Fresh regression evidence: **4 files, 12 tests passed**, including the actual Home component
changing from 50.0% to 100.0% and back as either a referral-only or movement-only named hold is
added and released without remounting. Other occupancy inputs stay referentially stable, so this
also checks the memo's invalidation. The new regression is
`tests/ward-consolidated-home-occupancy.dom.test.tsx`.

The earlier 69-file/521-test run and pinned-browser evidence above are reused for the unchanged
repairs in parent commit `f02ffbd5a30eed9d8f72cbe9b50c8539b66308df`; they are not described as a fresh
whole-branch run after the Home change. Scope remains local: no push, PR, merge or deployment.
