# Core audit fixes — 7 October 2026

Task: repair the twelve findings in the local codebase behaviour audit. User authorised local patches and a read-only fetch of `BigSimmo/Ward-Flow` main. Base `9778c48`; branch `ward/audit-core-fixes`; isolated worktree `/workspace/Ward-Flow-fixes`. Synthetic fixtures only. No publication or deployment.

## State and persistence

Repatriation records the sending admission separately from the destination hold. The sending ward remains occupied through allocation and loses its occupant only when receiving arrival is recorded. Bed release refuses to refund/delete an occupied or foreign linked stay. Ordinary placement and arrival reject a second conflicting live stay for the same patient.

Gender correction updates the held admission and arrival records the gender used for occupancy counting. Incoming transfer details remain on the historical sending stay; the receiving stay starts a fresh transfer workflow. Patient identity routes prefer the current admission and its movement over historical records.

Transport schemas are validated in their owning contexts: movement transport and admission care transport are different records. Restored broadcasts require the collection, sequence, valid row fields and acknowledgement arrays before readers can touch them.

Evidence: nine new public-seam regressions failed before these changes; the regressions and existing care-journey suite pass together (70 tests). Source TypeScript check passed. Compatibility and UI repairs are described below.

## Draft privacy

The dirty-state guard retains unload warnings and in-memory drafts; it no longer reads, writes or restores typed browser caches. The provider purges legacy `wf-draft:` keys on mount and reset, so visiting a draft editor is unnecessary. Existing draft tests now assert the D18 privacy contract, and a real provider remount test checks both cache cleanup and preservation of a safe care transport arrangement.

Locked dependencies were installed independently in the patch worktree after detecting that the supplied shared installation had Next.js 16.3.3 instead of locked 16.3.8. No lockfile or original checkout dependencies were changed. Twenty-six audit-focused tests passed on the exact installation; final broad checks are in progress.

## Transfer compatibility and defensive release

The duplicate-stay guard recognises recorded psychiatric-ward referrals as transfers, preserving the sending stay through reservation and departing it on receiving arrival. Older saves with a completed incoming care transfer can start a new transfer. Defensive release is tested against the legacy occupied-source alias, independently of the corrected producer. Broadcast validation preserves producer-valid fractional durations and rejects stale ID counters.

Focused state and compatibility regressions passed; the broad run is underway. No runtime logging or diagnostic instrumentation was added.

## Discharge editor and truthful Settings

Expected departure editing starts with a clock-only `HH:mm` value; saving still preserves its recorded date. Operational defaults are read-only runtime values, with no browser display-string override or false save action. Board refresh stays visible and keyboard-reachable with the exact “Not wired in this prototype.” disclosure; activation gives that explanation rather than pretending to save a cadence.

Reduced motion and high contrast use shared browser preferences, restored by a component above every Ward route. Scoped Ward CSS consumes those attributes: manual reduction suppresses animation, transitions and smooth scrolling; contrast uses the current Ward ink colour for muted text and borders, preserving light/dark palette selection.

Browser proof: system Chromium at desktop 1440×1000 and phone 390×844; animation computed from `audit` to `none`, muted ink from `#5f6873` to `#161a20`; preferences survived a reload on Home; phone Settings disclosure passed; zero page errors. Evidence lives in `/workspace/ward-flow-audit/patch-browser-final.log` and the adjacent screenshots. The browser probe waits for hydration before activation.

## Full-suite compatibility review

The first full Ward run completed with 8,790 passing tests, 90 skipped tests and 10 failures across six files. Capacity fixtures reused patients already occupying other wards; the fixtures now give capacity probes distinct synthetic identities while preserving staffing, specialling and cohort assertions. Existing expectations now assert the separate repatriation source, fresh receiving transfer workflow, clock-only editor and absence of browser draft persistence. All 45 cases in those six files pass.

A further legacy-profile regression reproduced historical movement fallback when a current stay had no movement link. The resolver now uses only a current stay's explicit link or matching admission backpointer; without either it displays the current admission without borrowing a historical movement or referral. The new regression failed before this change and passes afterwards; all 45 cases in the profile-focused group pass.

The final full Ward run is in progress against the completed source and test changes. The existing codebase-index coverage advisory about the `.design` root is also present on the untouched base; it is unrelated to these fixes. Generated screen-map validation passes.
