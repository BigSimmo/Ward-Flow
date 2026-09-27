# Q004 Task 1 — Command refinement report

Status: implemented; controller visual and behavioural verification outstanding.

## Ownership and inputs

Worked in `D:/Worktrees/Database/ward-lead`, branch `codex/task-ward-flow-live-state-20260831`, HEAD `1ef9ed3975078b789e9b5d70b3f000c64edc3809`. Plan SHA supplied by controller: `B9C2F289978E917A49DF84DCC0E2DBEC480EC92FB5C1D13141380F779E6B9C3F`. Existing dirty inputs were preserved and individually snapshotted under `.superpowers/sdd/2026-09-13-product-refinement/task-1-before/src/components/ward-management/coordinator/` before editing. Controller confirmed same-task start preflight already completed.

Viewed the actual `command-reference-dark-1440.png` and `command-before-light-1440.png` captures; read drawing HTML source, Ward README, design material/layout and wording rules, and installed Next CSS documentation. Browser and server remained controller-owned.

Changed these eight coordinator source paths only:

- `coordinator-screen.tsx`
- `coordinator.module.css`
- `shortlist-panel.tsx`
- `shortlist-panel.module.css` (explicit ownership extension from controller)
- `flow-diagram.tsx`
- `flow-diagram.module.css` (explicit ownership extension from controller)
- `pressure-strip.tsx`
- `exception-drawer.tsx`

## Decisions and deviations

The empty shortlist no longer reserves a full desktop column. A compact flow-header prompt explains the selection entry point; selecting a patient or referral restores the panel, while a valid restored movement focus continues to open it. Close clears view selection and shared focus, resets the unit selection via the existing selection helper, and returns keyboard focus to the active queue tab. Queue-tab switching remains independent of the panel subject. Closing does not dispatch an action.

Desktop flow gains a 32rem minimum region in a 56rem minimum grid, with a fixed 22rem lower register. Each existing column keeps its own scrolling body and fixed region header. This deliberately preserves the owner's readable register floor rather than the drawing's much shorter laptop register. The existing flow module's competing scroll minimum is removed only at desktop widths. The capacity key gets a distinct title row, wider edge padding and more breathing room between marks and the advanced key.

The complete existing guarded action block now precedes all candidates. Its selection/parallel-use summary is concise and factual. On desktop it stays at the shortlist scrollport's top after the subject header scrolls away, so selecting a lower candidate does not require traversing the whole list to reach Refer/Override. Update record precedes candidates too. Phone actions remain in natural flow: the old rule fixed every record-action row to the same bottom edge, which could stack controls from an opened record form.

Candidates remain explicit actionable choices, including overridable wards; no options are removed or reordered. Derived badges state eligible/review/unavailable counts. Eligibility checks and declines use native disclosures; eligibility starts open and retains every gate/reason. Detail padding and escalation spacing use Ward tokens. Print uses the existing shared printable-disclosure hook for the new detail disclosures, operational score and advanced flow key.

ED tone is based on actual existing clockState results: breached or within one hour is danger, within three hours is warning, recorded later deadlines are on track, waiting without a recorded deadline uses the existing accent. Labels repeat each state, including No deadline recorded; no arbitrary elapsed-wait threshold or fabricated breach is introduced. Wait meter lengths still express relative actual longest waits.

Exception coverage and How candidates are ordered narration were removed. Synthetic marker, refusal count, restrictive-placement warnings, unavailable reasons and recorded override reasons remain.

## Action retention and verification

Input-relative comparison verified all shortlist non-render derivations, guards and handlers remain identical. Referral selection, max-three selection constraint, eligibility/override gates, stage restrictions, urgency/legal updates, release/cancel, escalation, recorded declines and refusal handling were not changed. Existing Refer and Record override controls are retained; no new clinical Confirm action was invented.

Narrow checks executed:

- `node node_modules/prettier/bin/prettier.cjs --check` with the eight owned coordinator files: `All matched files use Prettier code style!` after formatting only owned files.
- TypeScript `transpileModule` syntax diagnostics over coordinator-screen, shortlist-panel, pressure-strip, flow-diagram and exception-drawer: 0 syntax errors in each file. This is syntax-only, not a project typecheck.
- Compared all eight output files to their task snapshots and inspected the changed sections; no shared/model/provider/test file writes, Git writes, external calls, server commands or test commands by this worker.

## Exact next checks for controller

1. Capture unselected and selected states in light/dark at 1440 and wider desktop, mid-width, and phone. Verify freed flow width, useful flow height, Capacity key spacing and the 22rem register floor; scroll each region independently.
2. Select a patient, switch queue tabs, select a referral, close, reopen, and remount with a valid restored focus. Confirm panel subject retention, correct explicit switching, keyboard focus after Close and zero clinical dispatch from selection/deselection.
3. Exercise a lower candidate then Refer/Override, selection cap, unavailable choices, stage block and ineligibility explanations. Verify sticky action toolbar does not obscure detail content or its own expanded override form.
4. Open Update record at phone width and verify urgency/legal/release controls do not overlap. Confirm the natural document flow and no stray bottom reserve.
5. Exercise deadline fixtures with no deadline, clear, due, critical and breached states; ensure words, accessible names and tones agree while ED order/count/wait values remain authoritative.
6. Print before/after the new disclosures are expanded and confirm all detail contents print and the prior open states restore.

No visual acceptance, browser/device acceptance, integrated test pass or full typecheck is claimed here. Controller schedules the smallest behavioural gates and independent task review. No commits or publication.

## Controller visual feedback — refinement pass

Viewed the controller's `command-refined-empty-light-1440.png` and `command-refined-selected-light-1440.png` at 1440×1000 and read `VISUAL-REVIEW.md`. These showed excessive footer height, only roughly 338px of drawable flow, an oversized Close control, and singular deadline wording. No numeric self-certification is claimed.

The Capacity title, four status marks and More key now share a wrapping row; the schematic label joins that row when space permits and forms a balanced second row at selected-panel width. Footer padding/gaps are reduced. The visible scroll-narration row is removed from the layout. Native scrollbars remain, and the focusable named flow region retains the overflow instruction as an accessible description.

Both desktop CSS owners now specify a 30rem drawable scrollport floor, avoiding import-order ambiguity. The overall grid floor is 62rem with a 38rem minimum flow track and the unchanged 22rem register floor. Close uses a compact inset, transparent header control with a hover surface, while coarse pointers retain a 3rem target. The deadline label correctly reads `1 deadline on track`.

Affected-source Prettier check passes. Tests were not run, as instructed. State: source-ready for controller recapture and independent review; visual acceptance remains pending across the required width/theme cells.

## Independent review corrections — expanded key and phone actions

Read `task-1-review.md` and viewed `command-corrected-key-light-1440.png`. The expanded key clipping is confirmed by the screenshot; the earlier compact-key correction did not allocate sufficient space to its open state.

The legend now explicitly refuses flex shrink. Opening its sole `data-flow-key` disclosure adds 8rem to the desktop grid height (70rem floor instead of 62rem), all carried by the flexible upper track. Closing returns the compact height. The 30rem drawable and 22rem register floors remain unchanged, and legend content stays inside the panel rather than overflowing across the register.

On phones the existing primary-action footer is now the single bottom-sticky owner, visually ordered after the detail content in the flex layout. It contains Refer/Override and only their own summary/reason form; Update record and all its buttons/forms remain in ordinary document flow. Shortlist ancestor overflow is released at the phone breakpoint so stickiness follows the document instead of a non-scrolling overflow ancestor. The action owner carries safe-area padding and bounds expanded override content to half the viewport with its own explicit scroll, keeping it clear of the global header. Print restores static order and releases that bound. No duplicate action controls were created and no action handlers changed.

Existing phone policy is retained: at or below 48rem, Statewide flow is hidden and its diagram is unmounted; the pressure strip is also hidden by that policy. The queue keeps an independent height bound (`min(70vh, 38rem)`), while the shortlist remains long natural document content. The controller observed a 4185px shortlist and a roughly 482px queue at 390×844 before this correction. Those are controller measurements of the prior state, not new validation. Shared rail/header size is outside this worker's ownership and unchanged.

Verification: the four affected source files pass the focused Prettier check; the changed TSX file `flow-diagram.tsx` reports zero TypeScript transpile syntax errors. No tests/browser/server commands were run. Required controller checks remain expanded key at selected 1440px (including Recorded destination and schematic label), and a lower-candidate phone journey with Update record both closed and open. Source-ready; independent recheck and final visual acceptance pending.

## Tablet action-owner breakpoint correction

Viewed `command-selected-dark-820.png` and inspected the active layout cascade. The actual bounded-shortlist boundary is 87.5rem (1400px), not 1000px: 1001–1399px uses two columns with the shortlist in row 2 and no height bound. At 1400px and above the fixed-height region grid establishes the shortlist's internal scroller.

The single bottom-sticky primary-action owner and its required shortlist ancestor overflow release now apply below 87.5rem, covering both natural-flow layouts. The existing desktop top-sticky owner is retained at and above 87.5rem. Only the two owned CSS modules changed in this pass; no component logic, global header, queue policy or shared rail changed. This addresses the same lower-candidate action-reachability defect across tablet and intermediate widths without introducing a second owner.

Focused Prettier check over `coordinator.module.css` and `shortlist-panel.module.css` passes. No tests or browser commands were run. Controller already verified the earlier bottom-owner behavior at 390px light/dark and enabled Refer after candidate selection; 820px reachability and the latest expanded desktop key remain for controller recheck. Source-ready; acceptance remains pending.
