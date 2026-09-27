# F00/F01 adversarial source review (r1)

Scope: source-only comparison of the current F00 bar/search/Tasks and F01b Capacity deltas against .superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-F00. No browser, tests, server, or hosted evidence.

## Verdict

No remaining concrete source defect found in the reviewed delta.

- The bar keeps the existing route/service/activity/tasks/tools wiring and Sheet focus/close path. Current searchWrap owns the 30rem cap and the <=1000px full-row placement; the child search root's <=62.5rem full-width rule is compatible with that parent rule. Search input and clear controls retain the existing 48px contract, labels/test IDs, popup result links, and outside/escape behavior.
- Tasks retains the same items mapping, acknowledgement/completion/reopen dispatches, movement selection, empty state, accessible aria-label, close label/title, and 48px action/close targets. The corrected CSS is now syntactically closed; the transient unmatched brace reported during handoff was removed by root and is treated as resolved.
- Capacity still sources figures from the existing derivations, passes release/admission/leave state, renders all network rows, retains the refresh action and fold semantics, and keeps 15 network columns. The NETWORK_TABLE_COLUMN_COUNT = 15 matches the current 15 column headers, including the refresh column. The new responsive gap-table layout preserves the semantic thead, scoped headers, body rows, total row, and existing test IDs.
- The F00 search popup width is bounded by min(92vw, 36rem) and the containing root; the Tasks Sheet width/position remains host-owned in shell/ward-bar.module.css, so the drawer no longer duplicates fixed positioning.

## Root visual questions

These are visual/runtime questions for the owner's planned captures, not source findings: confirm the bar's 7px search-face inset versus the 48px input at 390/820/1440; confirm search popup clipping/placement at compact widths; confirm Tasks Sheet scrolling and focus appearance; confirm Capacity's two-column gap-table desktop layout and phone stacking in both themes/print.
