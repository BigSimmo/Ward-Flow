# Core audit fixes — 7 October 2026

Task: repair the twelve findings in the local codebase behaviour audit. User authorised local patches and a read-only fetch of `BigSimmo/Ward-Flow` main. Base `9778c48`; branch `ward/audit-core-fixes`; isolated worktree `/workspace/Ward-Flow-fixes`. Synthetic fixtures only. No publication or deployment.

## State and persistence

Repatriation records the sending admission separately from the destination hold. The sending ward remains occupied through allocation and loses its occupant only when receiving arrival is recorded. Bed release refuses to refund/delete an occupied or foreign linked stay. Ordinary placement and arrival reject a second conflicting live stay for the same patient.

Gender correction updates the held admission and arrival records the gender used for occupancy counting. Incoming transfer details remain on the historical sending stay; the receiving stay starts a fresh transfer workflow. Patient identity routes prefer the current admission and its movement over historical records.

Transport schemas are validated in their owning contexts: movement transport and admission care transport are different records. Restored broadcasts require the collection, sequence, valid row fields and acknowledgement arrays before readers can touch them.

Evidence: nine new public-seam regressions failed before these changes; the regressions and existing care-journey suite pass together (70 tests). Source TypeScript check passed. Further compatibility and UI fixes in progress.

## Remaining patch groups

Draft persistence, expected departure editing, Settings operational defaults, board-refresh disclosure and accessibility preference wiring. Final checks and evidence will be appended here.

## Draft privacy

The dirty-state guard retains unload warnings and in-memory drafts; it no longer reads, writes or restores typed browser caches. The provider purges legacy `wf-draft:` keys on mount and reset, so visiting a draft editor is unnecessary. Existing draft tests now assert the D18 privacy contract, and a real provider remount test checks both cache cleanup and preservation of a safe care transport arrangement.

Locked dependencies were installed independently in the patch worktree after detecting that the supplied shared installation had Next.js 16.3.3 instead of locked 16.3.8. No lockfile or original checkout dependencies were changed. Twenty-six audit-focused tests passed on the exact installation; final broad checks are in progress.

## Transfer compatibility and defensive release

The duplicate-stay guard recognises recorded psychiatric-ward referrals as transfers, preserving the sending stay through reservation and departing it on receiving arrival. Older saves with a completed incoming care transfer can start a new transfer. Defensive release is tested against the legacy occupied-source alias, independently of the corrected producer. Broadcast validation preserves producer-valid fractional durations and rejects stale ID counters.

Focused state and compatibility regressions passed; the broad run is underway. No runtime logging or diagnostic instrumentation was added.
