# Task 7 Bed board correction — revision 1

Applied the controller-approved corrections from `task-7-review-r1.md` within the existing Board TSX/CSS ownership. No engine, derivation, reducer, fixture, route, shared shell, daily-sheet, test, or other source file changed.

## Corrections

- A filter that excludes the selected tile now clears that selection while focus remains on the filter button the user activated. It explicitly clears the pending focus-return ref, so no later effect attempts to focus the newly hidden tile. Filters that still include the selection leave the detail open. Explicit detail close and Escape retain their existing return-to-opening-tile behavior.
- Print now overrides the historical `display: none !important` on `.flowColumn`, hides only the tab controls, and reveals every mounted tabpanel. Incoming, outgoing, and since-yesterday facts are therefore printable even when their tab was inactive on screen. The existing daily sheet, filtered-tile restoration, print-only people list, and print color/pattern rules remain.
- `Synthetic prototype — not a medical device` is again visible on screen in a compact canonical warning pill. The local `Bed board` h1 alone keeps the visually-hidden treatment because the shared bar supplies the visible route title. The complete warning remains available to assistive technology and print.

## Retained behavior

All four filters, three stable presentation orders, five tile states, admission-key selection, tab click/Arrow/Home/End behavior, reducer actions, mandatory ward/preparation/diagnosis warnings, unavailable-action wording, and all daily-sheet/people/provenance content remain unchanged apart from the three corrections above.

## Evidence and limits

Reviewed the focused source diff and final cascade positions. Formatting was applied only to the two Board source files and this report. Per controller instruction, no tests, browser, server, computed-style, print/PDF, forced-colors, physical-device, or provider check was run. The controller retains runtime and matrix acceptance.

Output SHA-256 fingerprints after formatting:

- `src/components/ward-management/board/ward-board.tsx`: `BA373CAF6A57CEA8987641C945387632389B36A6E9F73A0397BF57F571CB660C`
- `src/components/ward-management/board/board.module.css`: `7151CD9F62B8E3795072561749A563A3DE120975919F28CECC2FECBDD80A7CA3`
