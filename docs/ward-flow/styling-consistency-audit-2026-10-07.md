# Styling consistency audit, 7 October 2026

Scope: `src/components/ward-management/**` (125 stylesheets) and the two token layers. Static code
audit, no Figma. The current look is the baseline; nothing here proposes a restyle.

## Summary

- The tokens already exist. The drift comes from screens writing literals beside them and from
  each screen styling its own controls.
- Shared React primitives in `src/components/ui/` are not used by any ward screen (only `sheet`,
  in 4 files). Ward screens render 1,114 raw `<button>` elements across about 260 bespoke button
  classes, 125 tab or segment classes and 526 chip, pill or badge classes.
- Ward-specific shared components exist and are under-used: `WardChip` (10 files), `WardPanel`
  (22), `WardSegmented` and `WardFilters` (1).

## Token coverage

| Category   | Tokens                                                                                | Literals in ward CSS                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Colour     | v2 palette, `--ward-*`, shell layer                                                   | Near zero (guarded by `ward-raw-colour.test.ts`)                                                                     |
| Radius     | Three parallel names: `--radius-sm/md/lg/pill`, `--r1/--r2/--pill`, `--ward-radius-*` | 676 px or rem literals after this PR (was 901). Pills now fully tokenised                                            |
| Font size  | `--t-0` to `--t-6` (shell), `--text-*` (globals)                                      | 1,208 literals. About 280 are below the documented 12px floor                                                        |
| Focus ring | `--focus`                                                                             | Mostly consistent. Widths vary between 2px and 3px, colours between `--focus`, `--accent`, `--ward-blue` and `--ink` |
| Tap target | `--ward-tap`, `--spacing-tap` (48px)                                                  | Common literal minimums: 44px (118), 36px (25), 28px (31), 2.25rem (50)                                              |

`--r1` equals `--radius-md` and `--r2` equals `--radius-sm`, but `person.module.css` and
`ed.module.css` remap `--radius-md` and `--radius-sm` locally, so the same name means different
shapes on different screens.

## Done in this PR (no change to the resting look)

1. 225 literal pill radii (`9999px` and `999px`) now use `var(--radius-pill, 9999px)`.
2. The role switcher's menu items get the shared keyboard focus ring. They previously showed only
   the faint hover fill on focus.
3. `tests/ward-style-drift-ratchet.test.ts` keeps pill literals at zero and caps literal font sizes
   and radii at today's count, so they can only fall.

## Larger refactors for owner approval

Ranked by impact on consistency.

1. **One shared `WardButton` (primary, secondary, quiet, icon) with a 48px target.** Migrate screen
   by screen, starting with the most repeated classes (`acceptButton`, `declineButton`,
   `controlButton`, `iconBtn`, `modalCloseBtn`). Removes most of the 260 button classes. Visible
   change: minor size and padding alignment.
2. **Font sizes to tokens.** Map literal px sizes to `--t-*`. Literal px text ignores the compact
   and spacious density settings, which scale rem. Visible change: text below 12px rises to the
   floor, and density now affects every screen.
3. **One radius scale.** Make `--r1` and `--r2` aliases of `--radius-md` and `--radius-sm`, remove
   the local remaps in `person` and `ed`, then map the remaining literals. Visible change: small
   corner differences on those two screens.
4. **Adopt `WardChip` and `WardSegmented` for status pills, tabs and filters.** Visible change:
   minimal, mostly consistent heights.
5. **Tap targets.** Raise 28px to 44px controls to `--ward-tap` where they are primary actions on
   phone layouts. Visible change: taller controls on small screens.
6. **One focus ring token** (`--focus-ring` width and colour) and migrate the outliers. Keyboard
   focus only.

Also noted: `.distBandSeg` and `.distBandRect` in `statistics-service-third-edition.module.css` are
not referenced by any component.
