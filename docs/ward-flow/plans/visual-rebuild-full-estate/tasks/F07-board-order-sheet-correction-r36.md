# F07 Board order and daily-sheet correction — r36

## Scope

This bounded correction changed only the Board screen, its local stylesheet, and one existing Board DOM test. The immediate pre-change bytes are retained under `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-board-order-sheet-r36/`.

## Correction

- The people-count sentence now selects its explanatory note from the active `bedOrder`. Longest-stay, soonest-expected-out, and recorded-order views each describe the ordering actually shown. The notes also state how missing dates or stays are handled without changing the ordering implementation or any patient facts.
- The daily sheet now paints `var(--surface-2)`, the canonical nested-surface colour used with its canonical text tokens. This removes the stale host-dark surface seen in the light-theme phone capture.
- The existing later print rule still resets the sheet to `Canvas`/`CanvasText`, so printed visibility is unchanged.
- `ward-board-selection.dom.test.tsx` now changes the real order control through all three values and asserts that the same visible summary follows the selected order and drops the prior note.

## Exact files and hashes

| File                                                    | Before SHA-256                                                     | After SHA-256                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `src/components/ward-management/board/ward-board.tsx`   | `0A62D35026CC25D1B7492958783353F91C2C213CB0B0682977D958EF1108F161` | `BDD9641826526E0EDB621E174765230E10F00912559F344A1435C598231CF551` |
| `src/components/ward-management/board/board.module.css` | `4AF927AF7C50E908182A13F024141A48A3681EE25AD2B9EBAD8F54C89182E0AD` | `C919A8745B2FD2BC2DE9C21DD9B2E6728DF1EC2AB89C21D8CE3A84654F775BBE` |
| `tests/ward-board-selection.dom.test.tsx`               | `0B26B42A894E72E6AF565E220150148024999AEE575AB0E2805E6629EBEEEB83` | `77C5868F6BA73BC6854BAB97C9E70EBEF590A6A80A49389D753CE5FF4545E6C9` |

The before-to-after comparison contains only the three changes described above; earlier shared-worktree Board changes remain intact.

## Verification

- `git diff --check -- src/components/ward-management/board/ward-board.tsx src/components/ward-management/board/board.module.css tests/ward-board-selection.dom.test.tsx` — passed with no whitespace errors.
- Tests were not run by this worker. The controller's later `N0seHa` focused session included `tests/ward-board-selection.dom.test.tsx`: all 16 tests in that file passed. The three-file session overall reported 49 passed and two failures in other files, so it is recorded as focused Board evidence rather than a green batch verdict.
- The supplied preceding full-suite result was 454/454 files, 5,077 passed and one unrelated Hub hex-colour resolver failure; this correction has not been included in that run.

## Remaining evidence

Fresh light/dark rendered evidence is still required to confirm the daily-sheet palette and the three summary states in the served application. No clinical derivation, sorting behavior, print behavior, action, or route was changed.

## Independent source review

The immediate-before comparison was independently reviewed after the focused controller run.

- The `stay` comparator uses `-1` for a tile without an occupant/stay, sorts recorded days descending, and uses original tile position for ties. The new note therefore accurately says missing stays follow the dated population and retain recorded order.
- The `leaving` comparator uses positive infinity for a missing expected date, sorts ascending, and uses original tile position for ties. The new note accurately describes both the placement of missing dates and their stable recorded order.
- The `recorded` comparator is exactly the original tile index. Its note also preserves the established warning that source order does not identify physical bed locations.
- The stylesheet diff is one screen-theme declaration only: `.sheet` changes from `var(--surface-chrome)` to `var(--surface-2)`. Both existing print blocks are byte-identical to the snapshot, including the later `Canvas`/`CanvasText` sheet reset.
- The test drives the accessible order combobox through all three actual values and checks the visible count summary. It does not restate comparator implementation details or patient facts.

The controller's subsequent three-file focused batch reported the Board test passing. The same batch exposed one unrelated pre-existing Movements assertion collision after an `Arrived` outcome chip became visible; that assertion has since been narrowed to the stage heading and awaits its own focused rerun.
