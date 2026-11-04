# Consolidated figure repairs — 4 November 2026

Repository: `BigSimmo/Ward-Flow`. Task: the 16 unresolved WF-FIG findings supplied on 4 November.
Repair branch: `fix/consolidated-figures-20261104`, based on main
`559f225892b27b6c42bd7e9a6fa81f3ef81e62ec` (a descendant of the audit's pinned main).
All examples and checks use synthetic data. This is local engineering evidence, not deployment evidence.

## Changes

| Finding | Repair                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 017     | Canonical bed states accept named referral, movement and ward-inbox holds. Count each physical bed and episode once; suppress converted commitments only at their own ward. Readers receive that population, including occupancy, forecasts and paused Statistics. Releasing a pull clears its numbered movement and referral commitment. One Home occupancy call remains pending exact-file ownership approval. |
| 001     | Search's count, free-bed inclusion and WardPreview use canonical reservation-aware Ready.                                                                                                                                                                                                                                                                                                                        |
| 004     | Alerts includes supported meeting categories and resolves their movement/admission navigation.                                                                                                                                                                                                                                                                                                                   |
| 002     | Accepted census uses the existing episode/destination predicate before deduplicating people.                                                                                                                                                                                                                                                                                                                     |
| 010     | Snapshot metadata projection shares the command parser for category-aware composite subjects.                                                                                                                                                                                                                                                                                                                    |
| 011     | A genuinely new meeting occurrence retires old mutable snooze/ownership through append-only histories. Completion and Undo preserve the same occurrence. Acknowledgement retains its existing enduring semantics, the audit's stated product choice.                                                                                                                                                             |
| 018     | The actual Capacity forecast view records its baseline on leaving; alert readers remain read-only.                                                                                                                                                                                                                                                                                                               |
| 003     | Activity identifies the effective scope and omits withheld ED rows.                                                                                                                                                                                                                                                                                                                                              |
| 006     | Home uses the current recorded-form due selector. No statutory calculation is introduced.                                                                                                                                                                                                                                                                                                                        |
| 019     | Browser forecast baseline/history/reasons include actor, desk, scenario and world generation. Legacy unscoped history is not trusted; other desks' history survives cleanup.                                                                                                                                                                                                                                     |
| 014     | Preview disables marking changes reviewed and guards automatic, deferred and retained-callback baseline writes.                                                                                                                                                                                                                                                                                                  |
| 015     | Activity captures interval metadata with displayed rows.                                                                                                                                                                                                                                                                                                                                                         |
| 013     | Near-term EDD captions use minutes/hours and “Expected now”. Today membership is unchanged.                                                                                                                                                                                                                                                                                                                      |
| 008     | Checking names both departure and arrival transport conditions.                                                                                                                                                                                                                                                                                                                                                  |
| 009     | Checking describes multiple declines without claiming universal refusal.                                                                                                                                                                                                                                                                                                                                         |
| 016     | Capacity's own-ED figure links to a validated exact-ED Waiting filter.                                                                                                                                                                                                                                                                                                                                           |

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

## Remaining ownership boundary

`coordinator/coordinator-screen.tsx` is claimed by open PR #1380. A calculation-only change to its
Home occupancy call and memo dependencies is prepared at
`/workspace/scratch/figures-runtime/home-occupancy.patch`. It requires the owner's release or Josh's
scoped takeover under AGENTS.md rule 7. All other fixes avoid claimed source files; the overlapping
Alerts assertion-only update has Josh's explicit approval.
