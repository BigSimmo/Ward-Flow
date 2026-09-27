# Task 8 layout guard corrections — revision 1

Date: 2026-09-13  
Execution model: `gpt-5.6-sol / medium`  
Plan SHA256: `2E6A6F90C7986829895E6FE8AD4D0C33CBDE3F973D35FDA8ABA6570B520F07C9`

## Result

The breakpoint register now pins every new Wave One value by file, with its design or reviewed adaptation recorded beside it:

- Board `75rem`: the drawing's 1200px fact-band step, adapted from nine drawing facts to ten retained engine facts as five-by-two below and ten-across above.
- Community `40.001rem`: the exclusive lower edge above the 40rem phone range for the independently reviewed six-figure three-by-two tablet band.
- Command `62.5625rem` and `87.5rem`: the drawing's exact 1001px laptop and 1400px full three-column boundaries. Existing legacy `64rem` and `90rem` pins remain.
- Hub `68.001rem`: the exclusive complement to its existing `68rem` one-column collapse, so height bounds and independent pane scrolling begin only in the accepted two-pane state.
- Statistics `62.5rem`: Task 3's documented 1000px overview boundary between one column below and two independent panel columns above; Compare remains full-width.

The table threshold register retains the legacy Statistics entry and adds the opt-in `statistics-third-edition.module.css` as a two-value pin: `40rem` for the ward comparison and `27.5rem` for the smaller ED comparison. These values are pinned from the stylesheet and retained phone-overflow evidence; this edit does not present them as a new intrinsic-width measurement.

No product stylesheet, component, layout behavior, table column or threshold changed.

## Output hashes

- `tests/ward-primitives-shared.test.ts` — `1723283432E44511E3305620ACE277004E6A9AC31BCDAD0304BA037CF57EE6F7`
- `tests/ward-table-min-width.test.ts` — `FB250BAB15989065DF78A46DB97FF35304823E593088698560A5E08D77813998`

## Verification boundary

- `git diff --check -- tests/ward-primitives-shared.test.ts tests/ward-table-min-width.test.ts` — passed with no output before report creation.
- Tests and browser checks were not run under the controller-owned verification boundary.
