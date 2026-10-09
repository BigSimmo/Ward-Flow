# Ward Flow design system v8

Synthetic prototype, not a medical device. v8 builds on v7.1 (`../v7/`, kept unchanged for provenance). The values live only in [`ward-flow-v8.css`](ward-flow-v8.css). [`ward-flow-design-system-v8.html`](ward-flow-design-system-v8.html) is the live board, drawn by that same sheet, with Review, Foundations, Controls, Ward page and Patterns tabs, day and night, desktop and phone.

**Status.** This is the standard, not the build. Nothing in `src/` changes until Josh says build. When he does, the sheet is ported into `src/components/wf` CSS Modules and React components, per the 5 October React direction in `AGENTS.md`. The board is the reference drawing, not a second UI.

**How v8 was made.** v7.1 was checked against the app source at `main` `a9330ed`, the 9 October code audit of the token layers, the `ui/` and `wf/` libraries, feature CSS and theme switching, and the owner rulings. Every contrast figure below was computed on the token values with the WCAG 2.2 formula, alpha composited onto the real surface.

## 1. What v8 changes

1. **One theme switch.** Every colour token holds its day and night value in one `light-dark(day, night)` pair, resolved by `color-scheme`. `data-theme` on `<html>`, the OS setting, `.day` and `.night` subtrees and print all work through that one mechanism. A night block can no longer miss a token, because there is no night block.
2. **Twelve is the floor.** Ruling O-15.1 (11 September) holds: 12px, no uppercase exception. The 11px size is retired. Eyebrows, table heads, counts, tier, kbd, avatars and chart ticks are 12px. Count circles grow from 18 to 20px.
3. **Contrast fixed where v7.1 fails.** Night ink on accent, the data ramp, faded beds, tone colours used as words, and selection under Windows high contrast.
4. **New token groups the app already needs.** Service colours, a z-index ladder, three breakpoints, named control shadows and a print block.
5. **The app's fonts come back.** The stacks lead with the `next/font` variables again. v7 had dropped them, which would have lost the self-hosted Geist on paste.
6. **Component contracts from the code audit.** Pause, tabs, tooltip, sheet focus, donut, zero, stepper and group headers.
7. **One library, real gates.** `src/components/wf` is the only primitive library. Six per-file ratchets replace the gates that never ran.

Everything else in v7.1 carries over unchanged: the rules, the status glyphs, radii, spacing, the 14 shared patterns, page anatomy and phone behaviour (v7 sections 2 and 4 to 8).

## 2. Review: v7.1 against the app

29 issues across four groups. All 29 are fixed in the v8 sheet or spec. Four decisions need Josh (section 12).

### G. v7.1 against the app

| #   | Issue                               | Evidence                                                                                                                                                                                                                                                                                                                                                 | v8 fix                                                         |
| --- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| G1  | Two theme switches                  | v7 keys night on `.night` only and drops v6's `data-theme` and OS rules. The app already splits. Ward Appearance sets `data-theme` (`ward-bar.tsx` `applyAppearance`). The compat and ckb-v2 layers, Tailwind `dark:` and the page background follow `.dark` (`theme.ts` bootstrap). Light chosen on a dark OS renders the shell light and the page dark | One switch through `color-scheme` (section 4)                  |
| G2  | Fonts lose `next/font`              | v7 `--wf-font` starts at `Geist`. v6 and the app start at `var(--font-geist-sans)`                                                                                                                                                                                                                                                                       | `next/font` variables lead both stacks                         |
| G3  | 11px breaks the floor               | O-15.1: "Keep the 12-pixel floor with no uppercase exception". v7 keeps 11px for eyebrows, counts, tier, kbd and ticks                                                                                                                                                                                                                                   | Six sizes, 12 to 28. `--wf-fs-11` aliases 12 until removed     |
| G4  | No service colours                  | `--svc-*` live only in `ward-flow-shell-tokens.module.css`. Its print block carries stale east, north, south and WACHS hues and misses 23 tokens. Night CAHS equals night WACHS (`#38bdf8`)                                                                                                                                                              | Seven `--wf-svc-*` pairs. A dot beside the name, never alone   |
| G5  | No z-index ladder                   | 146 raw `z-index` values in ward CSS, 33 distinct, from 2 to 99999                                                                                                                                                                                                                                                                                       | Eight rungs, 1 to 110                                          |
| G6  | Breakpoints unruled                 | 518 width media queries, 72 distinct widths, `639.98` style epsilon hacks                                                                                                                                                                                                                                                                                | Three widths in range syntax                                   |
| G7  | No print rules                      | ShiftBrief is print safe in words only. Glyphs are drawn as backgrounds, which browsers drop in print                                                                                                                                                                                                                                                    | Print block: day, ink only, glyphs kept, hero prints quiet     |
| G8  | Legacy tokens hold their own values | `referrals.module.css` `--ink: var(--ink)` (a cycle, so the register loses its ink). The shell's explicit-dark block misses `--danger-ink`. `--ward-shadow` holds a shadow but `patient-now` uses it as a colour. `--good-ink` is undefined on Delays                                                                                                    | Legacy names alias `--wf` roles and hold no values (section 9) |

### H. v7.1 values against WCAG 2.2

| #   | Issue                           | Evidence                                                                                               | v8 fix                                                                                                          |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| H1  | Night ink on accent fails       | `#fff` on `#8fb0d4` is 2.25:1. The shortlist tick sits on it                                           | Night `--wf-on-accent` is `#0d141b`, 8.2:1. New `--wf-on-pri` (white, 5.3:1 or better) for the primary gradient |
| H2  | Data step 3 too pale            | `--wf-data-3` `#c9d3dd` is 1.49:1 day, 1.46:1 night, and is used as a series                           | Ramp re-stepped (section 5). Old value kept as `--wf-data-rest` for a remainder that is never the only mark     |
| H3  | Faded beds still unreadable     | v7 E13 fade at 0.5: name 3.3:1, state line 2.1:1                                                       | Find dims instead: surface-2 fill and ink-3 words, 5.6:1                                                        |
| H4  | Tones used as words             | Day danger 4.49, warning 4.00, success 4.20 on surface                                                 | Tones colour glyphs, edges and marks. Words use the `-ink` partner, `.ink-*` classes                            |
| H5  | Selection lost in high contrast | Selected tabs, chips, choices, beds and rows are inset box shadows. Forced colours removes box shadows | Every selected state gets a `Highlight` border in forced colours                                                |
| H6  | Rule 2 broken by the kit        | Secondary buttons, chips and bed tiles use `--wf-line-2`, 1.36:1, against "control edges at least 3:1" | Rule 2 reworded: 3:1 where the edge is the only cue (inputs, checks, radios, switch tracks, selection)          |
| H7  | Stacked segments touch          | Mini bars set data steps side by side at about 1.4:1 to each other                                     | Segments sit 2px apart (`.mb`), with direct labels                                                              |
| H8  | Reduced motion half done        | Motion tokens not zeroed, press scale and spinner still move                                           | Motion tokens zero, press scale off, spinner slowed to 1.6s                                                     |

### I. Components, from the code audit

| #   | Issue                                 | Evidence                                                                                                                                              | v8 contract                                                                             |
| --- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| I1  | Pause chip contradicts itself         | `wf/live.tsx` swaps the label to "Resume live updates" and sets `aria-pressed`, so it is read as "Resume, pressed"                                    | One name, "Pause live updates", with `aria-pressed`. Only the icon swaps                |
| I2  | Tabs lose their tab stop              | `wf/choice.tsx` `Tabs` and `Segmented`: when no item matches `value`, every item gets `tabIndex=-1`                                                   | The first enabled item holds the stop when nothing matches                              |
| I3  | Escape on a tooltip closes the drawer | `ui/tooltip.tsx` has no `stopPropagation`, and a tip opened by hover ignores Escape (WCAG 1.4.13)                                                     | Escape closes the tip only, from hover or focus. The tip is hoverable                   |
| I4  | Sheets drop focus                     | `ui/sheet.tsx` skips focus return when it unmounts while open (`MovementDrawer`, legal forms). `headerHidden` sheets have no focus target (Referrals) | Every sheet names its first focus. Focus returns on close and on unmount                |
| I5  | Donut lies at the ends                | `wf/chart.tsx` round caps draw a dot at 0% and close the gap from 96%                                                                                 | `.chart-arc` uses butt caps                                                             |
| I6  | Zero disappears                       | `CardHead` aside, `Menu` meta and counts test truthiness                                                                                              | 0 renders as 0. Missing renders as "Not recorded"                                       |
| I7  | Stepper role on a wrapper             | v7 board puts `role="spinbutton"` on a span nobody can focus                                                                                          | The value is the spinbutton, with arrow, Home and End keys. Buttons are `tabindex="-1"` |
| I8  | Group header is a div                 | v7 board: `role="button"` on a div with no keyboard                                                                                                   | `.grp` is a real `button` with `aria-expanded`                                          |

### J. Governance

| #   | Issue                      | Evidence                                                                                                                                                                                                   | v8 fix                                                                      |
| --- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| J1  | Two primitive libraries    | `ui/` Button, Tabs, SegmentedControl, Select, TextField, Checkbox, ConfirmDialog and 10 more are imported only by tests. `wf/` serves 73 files                                                             | `wf/` is the one library (section 8)                                        |
| J2  | v7 colour drift miscounted | v7 D2 "787 hex" counts token files and comments. Feature CSS has no raw colour in declarations. The real drift is TSX: `upload-forms-modal.tsx` has 19 inline hex and reads six undefined `--ward-*` names | Count and gate TSX inline styles (627 today)                                |
| J3  | Blind outline removal      | v7 D5 deletes all 100 `outline: none`. 50 of those rules already draw a replacement ring, so deleting them doubles rings                                                                                   | Delete only rules with no replacement                                       |
| J4  | Gates that never run       | `check:type-scale` claims `verify:cheap` but is not wired. `drift-ratchet.json` names a script that does not exist. `GATES.md` cites a missing baseline                                                    | Six per-file ratchets in `npm test` (section 10)                            |
| J5  | Docs describe PsychSift    | `docs/design-system` is titled PsychSift, names `ckb-v2` and documents components that do not exist                                                                                                        | This spec is the Ward standard. The old set gets an archive banner at build |

## 3. Rules (16)

1. **Calm and dense.** Space between parts is 4, 8, 12 or 16. Inside a control, insets may step by 2.
2. **Every surface has an edge.** Hairline first, light shadows. _(Amended)_ 3:1 wherever the edge is the only cue: inputs, checkboxes, radios, switch tracks and the selected state. A labelled button's edge is decoration.
3. **Glass for chrome only.** Bars, menus, toasts, sheets and the palette. Never data. Phone bars are solid.
4. **One hero band per page.** Slate while anything is live, quiet when nothing is.
5. **One primary per area.**
6. **Colour is a dot or glyph.** Never a card fill. Fit and hold tints only inside data. _(Amended)_ Words take the `-ink` partner, never the tone itself.
7. **Shape carries status.** One shape per tone everywhere.
8. **Signal, not explanation.** Titles 5 words at most, actions 6.
9. **Live and honest.** Values show their age. Stale or offline is marked on the value.
10. **Labels never wrap.** Shrink, then truncate, then tip.
11. **Colons mean clock time.** Durations carry units and a direction word.
12. **Red means act now.** Nothing else is red.
13. **Shape tells you what it does.** Raised pills press, flat pills label, circles count.
14. **Mono is for figures.** Numbers, ids, clock times.
15. **Dashed means unavailable.** On controls and surfaces. Chart guides are exempt.
16. **Twelve is the floor.** _(New)_ No word, count or label under 12px. Uppercase is a treatment at 12, never a licence to go smaller.

Voice is unchanged: Australian English, sentence case, verbs first, 24 hour time, digits.

## 4. The one theme switch

**In the sheet.** `:root` sets `color-scheme: light dark`. `:root[data-theme="light"]` and `.day` set `light`. `:root[data-theme="dark"]` and `.night` set `dark`. Print forces `light`. Each colour token is `light-dark(day, night)`, so it resolves wherever it is used. Shadows, the glass rim, sheen and backdrop are built from colour parts, so they follow too. Elevation layers that one theme does not use are `transparent`, which keeps every value exactly as in v7.1.

**Browser support.** `light-dark()` needs Edge and Chrome 123, Safari 17.5 or Firefox 120. The managed Edge version on WA Health desktops has not been checked. Confirm it before the build.

**In the app, at build.** Today two stores disagree. One is `ward-flow-appearance` driving `data-theme`. The other is `clinical-kb-theme` driving `.dark`.

1. The ward Appearance store is the one source. `applyAppearance` sets `data-theme` and toggles `.dark` to the resolved scheme. It also writes both `theme-color` meta tags.
2. `THEME_BOOTSTRAP_SCRIPT` reads the same key and sets `data-theme` and `.dark` before first paint. It migrates a stored `clinical-kb-theme` once. It stops overwriting the media-tagged `theme-color` tags when the theme is Auto.
3. In Auto, one `matchMedia` listener in the shell keeps `.dark` in step when the OS changes. This is only needed until `.dark` is retired.
4. The sign-in screen writes the same store and stops restoring the old `data-theme` on unmount.
5. The v8 tokens load after `globals.css`, and v6's `:root { color-scheme: light }` goes. Then `color-scheme` follows the theme again, and so do scrollbars and native inputs.
6. `appleWebApp.statusBarStyle` stops forcing `black-translucent`, which puts white status text on a light page.
7. Retire `.dark` once the compat and ckb-v2 layers alias `--wf-` roles (section 9).

## 5. Tokens

### Changed from v7.1

| Token                      | v7.1                       | v8                                                          | Why                                                  |
| -------------------------- | -------------------------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| Every colour token         | `.day` and `.night` blocks | `light-dark(day, night)`                                    | One switch, no missing night value                   |
| `--wf-fs-11`, `--wf-lh-11` | 11, 14                     | Deprecated alias of 12, 16                                  | Rule 16                                              |
| `--wf-count`               | 18px                       | 20px                                                        | Room for a 12px figure                               |
| `--wf-on-accent` night     | `#fff` (2.25:1)            | `#0d141b` (8.2:1)                                           | H1                                                   |
| `--wf-data-2`              | `#7c96af` / `#4f6d8c`      | `#557089` / `#6a8bad`                                       | Steps stay apart once step 3 darkens                 |
| `--wf-data-3`              | `#c9d3dd` / `#2a3a4b`      | `#788ea4` / `#55728f`                                       | H2: 3.3 and 3.4:1                                    |
| `--wf-font`, `--wf-mono`   | Geist first                | `var(--font-geist-sans)` and `var(--font-geist-mono)` first | G2                                                   |
| `.glass.dark`              | class                      | `.glass.onhero`                                             | Collided in name with the legacy `.dark` theme class |
| `.bed.fade`                | opacity 0.5                | `.bed.dim` (`.fade` kept as alias)                          | H3                                                   |

### New

| Group           | Tokens                                                                                                           | Notes                                                                                                                                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ink on primary  | `--wf-on-pri`                                                                                                    | White in both themes. `--wf-on-accent` is for flat accent fills only                                                                                                                                                       |
| Neutral ink     | `--wf-neutral-ink`                                                                                               | Words beside a neutral glyph                                                                                                                                                                                               |
| Data remainder  | `--wf-data-rest`                                                                                                 | The old step 3. Never the only mark of a value                                                                                                                                                                             |
| Service         | `--wf-svc-east`, `-north`, `-south`, `-wachs`, `-cahs`, `-statewide`, `-private`                                 | Day values are the services' own colours. Night CAHS `#8ab4ff` and Statewide `#5fc9d6` are new so no two services share a night hue. Chip fills derive with `color-mix`, so there are no `-bg`, `-border` or `-ink` tokens |
| Layers          | `--wf-z-raised` 1, `-sticky` 20, `-bar` 60, `-overlay` 80, `-popover` 95, `-modal` 100, `-toast` 105, `-tip` 110 | Tooltips over everything. Toasts above a modal and never made inert by it                                                                                                                                                  |
| Breakpoints     | `--wf-bp-phone` 40rem, `--wf-bp-narrow` 48rem, `--wf-bp-wide` 64rem                                              | Media queries cannot read custom properties. These record the only widths allowed, written `(width <= 48rem)`. 48rem is the component phone rule. 40 and 64 are for layout only                                            |
| Row             | `--wf-row-group` 40px                                                                                            | Grouped table headers                                                                                                                                                                                                      |
| Control shadows | `--wf-e-pri`, `-pri-press`, `-hero`, `-on-hero`, `-on-hero-press`, `-light`, `-well`, `-knob`, `-tip`, `-bar`    | v7 left 13 raw shadows in rules                                                                                                                                                                                            |
| Theme parts     | `--wf-rim-1` to `-3`, `--wf-sheen-top`, `--wf-glow-1`, `-2`, `--wf-sh-*`, `--wf-ring-*`, `--wf-press`            | Internal. Components read `--wf-e1`, `--wf-glass-rim` and so on, never these                                                                                                                                               |

## 6. Contrast (v8 values)

| Pair                                            | Day           | Night         | Needs |
| ----------------------------------------------- | ------------- | ------------- | ----- |
| Body text on surface                            | 17.2          | 14.6          | 4.5   |
| Meta text (ink-3) on surface                    | 5.9           | 6.7           | 4.5   |
| Meta text on selected row                       | 5.4           | 5.4           | 4.5   |
| Meta text on canvas                             | 5.1           | n/a           | 4.5   |
| Danger words (`--wf-danger-ink`)                | 7.2           | 8.5           | 4.5   |
| Danger glyph                                    | 4.5           | 5.9           | 3     |
| At risk glyph                                   | 4.0           | 7.6           | 3     |
| Success glyph on fit tint                       | 3.9           | 6.0           | 3     |
| Neutral glyph on fit tint                       | 3.8           | n/a           | 3     |
| Input, check and stepper edge (`--wf-line-ctl`) | 3.4           | 4.0           | 3     |
| Selected pill ring on track                     | 3.0           | n/a           | 3     |
| Ink on accent                                   | 9.0           | 8.2           | 4.5   |
| Ink on primary                                  | 7.1           | 5.3           | 4.5   |
| Data steps 1, 2, 3                              | 8.8, 5.1, 3.3 | 7.6, 4.8, 3.4 | 3     |
| Dimmed bed words                                | 5.6           | 6.2           | 4.5   |
| Pressed hero glyph (warning, the lowest)        | 4.1           | 4.1           | 3     |
| Hero meta on slate                              | 5.9           | 5.9           | 4.5   |
| Tooltip text                                    | 13.3          | 10.5          | 4.5   |
| Service dots (lowest: CAHS day, east day)       | 4.8           | 6.4           | 3     |

Disabled ink (`--wf-ink-off`, 3.3 day, 3.8 night) is exempt under WCAG 1.4.3 and is kept above 3:1 anyway. Fit and hold edges (1.5:1) are decoration: the tick, circle and words carry the state.

## 7. Status glyphs and tone

Unchanged from v7: triangle act now, filled circle at risk, tick done, capsule moving, ring waiting, cross closed. Not active is a dash, a record state, never a seventh tone. Glyphs are 9 to 10px and `aria-hidden`. The word beside them carries the meaning.

New in v8: `.tone-*` colours a glyph or mark. `.ink-*` colours words. In high contrast, every glyph keeps its shape in `CanvasText`. In print, glyphs keep their colour through `print-color-adjust: exact`.

## 8. Components

`src/components/wf` is the one library. Class names stay short for CSS Modules. The React names below are the contract.

| Class                  | Component in `wf/`                             | v8 contract                                                                                             |
| ---------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `.b`                   | `Button`, `SplitButton`                        | Disabled is `aria-disabled` plus a reason, so it stays in the tab order. Busy keeps focus on the button |
| `.pt`                  | `Tabs` (tablist), `Segmented` (radiogroup)     | Roving tab stop always exists (I2). Disabled items are dashed                                           |
| `.trk`                 | `HeroTrack`                                    | Link mode never nests a second `nav` inside an outer one                                                |
| `.fc`                  | `FilterChip`, `AppliedFilter`                  | On state is `aria-pressed` with an accent edge and heavier label. Highlight border in forced colours    |
| `.choice-row`          | `Segmented variant="row"` (new)                | Radiogroup of equal buttons, never wrapping                                                             |
| `.k`                   | `Count`, `CountBubble`                         | Always neutral. 0 shows 0                                                                               |
| `.tier`                | `TierTile`                                     | T1 to T3 pill, never red                                                                                |
| `.bd`                  | `Badge`                                        | Flat pill. Drops its chip inside rows                                                                   |
| `.svc`                 | `ServiceTag` (new)                             | Dot and service name. Never the dot alone                                                               |
| `.g`, `svg.gl`         | `StatusGlyph`, `Dot`                           | Info is the capsule (v7 build item)                                                                     |
| `.lv`                  | `LiveChip`, `Timer`                            | Pause: one name with `aria-pressed` (I1). Resume refreshes the time at once                             |
| `.hs`, `.hs.pill`      | `HeroStat`                                     | `pressed` prop makes the pill. Never mix pills and plain stats in one row                               |
| `.in`, `.field`        | `Field`, `TextInput`, `Select`, `Textarea`     | Errors are announced (`role="alert"` or a live region). Clearing returns focus to the input             |
| `.sw`, `.chk`, `.rad`  | `Switch`, `Checkbox`, `Radio`                  | Indeterminate re-applies after every click                                                              |
| `.stp`                 | `Stepper`                                      | The value is the spinbutton (I7)                                                                        |
| `.card`                | `Card`, `CardHead`, `CardBody`, `CardFoot`     | `aside={0}` renders 0 (I6)                                                                              |
| `.hero`                | `Hero`                                         | `.quiet` when nothing is live                                                                           |
| `.st`, `.meter`, `.mb` | `Stat`, `Meter`, `StackBar`                    | Meter clamps `aria-valuenow` to its range. Stacked segments 2px apart                                   |
| `.chart-*`             | `BarList`, `ColumnChart`, `Donut`, `LineChart` | Butt caps on arcs (I5). Empty series render an empty state, not NaN                                     |
| `.menu`, `.pop`        | `Menu`, `Popover`                              | Escape closes the menu only and returns focus. Portalled when inside a scrolling sheet                  |
| `.toast`               | `ToastView`, `ToastProvider`                   | Mount the provider once in the ward shell. The toast layer is exempt from a sheet's inert               |
| `.tip`                 | `Tooltip` (move from `ui/`)                    | Opens on hover or focus after a short delay. Escape closes the tip only. The tip is hoverable (I3)      |
| `.drawer`, `.scrim`    | `Sheet`, `Drawer` (move from `ui/`)            | Names its first focus. Returns focus on close and unmount (I4)                                          |
| `.empty`               | `EmptyState`                                   | One 48px line that says what is clear                                                                   |
| `.sk`                  | `Skeleton`                                     | Stops under reduced motion                                                                              |
| `.tile`, `.av`, `.kbd` | `IconTile`, `Avatar`, `Kbd`                    | Neutral only                                                                                            |
| `.bed`, `.beds`        | `BedTile`, `BedBoard` (new)                    | `.dim` for Find, never opacity                                                                          |
| `.grp`, `.row-tl`      | `GroupedTable`, `RowTimeline` (new)            | Group header is a button with `aria-expanded` (I8)                                                      |

**Retire from `ui/`** once nothing outside tests imports them: `button`, `chip`, `choice`, `tabs`, `segmented-control`, `select`, `text-field`, `form-field`, `confirm-dialog`, `page-header`, `link`, `pagination`, `progress`, `disclosure`, `error-state`, `applied-filters`, `interactive-row`, `section-heading` and `metro-pulse-circle`. Move `sheet`, `sheet-focus`, `tooltip` and `overlay-root` into `wf/`. Keep `live-announcer` and `missing-value` as shared utilities. Deleting exported code still follows the dead-code rule in `AGENTS.md` and needs Josh's approval for that run.

**Unused `wf/` exports.** `SplitButton`, `Meter`, `Sparkline`, `LineChart`, `SortHeader`, `BulkBar`, `HeroSteps`, `CountBubble`, `Radio` and `Textarea` have no product importers. They stay, because the patterns in v7 section 6 need several of them, but each needs one product use or a retirement decision.

## 9. Legacy migration

**Aliases hold no values.** All legacy names are aliased in one file. Each line is `--old: var(--wf-role)`, with no literal value. Because the `--wf-` role already carries both themes, an alias cannot miss a theme or point at itself (G8). A test forbids literals and cycles in that file.

| Legacy                                                           | v8 role                                                                            | Visible change                             |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------ |
| `--ink`, `--ward-text`, `--ward-heading`, `--text`               | `--wf-ink-1`                                                                       | None                                       |
| `--ink-soft`                                                     | `--wf-ink-2`                                                                       | None                                       |
| `--muted`, `--text-muted`, `--ward-muted`, `--ink3`              | `--wf-ink-3`                                                                       | Slightly darker (`#5f6873` to `#5b646f`)   |
| `--line`, `--border`                                             | `--wf-line`                                                                        | Lighter hairline (0.11 to 0.08 alpha)      |
| `--line-strong`, `--ward-border`, `--ward-divider`               | `--wf-line-3`                                                                      | None for `--line-strong`                   |
| `--surface`, `--surface-2`, `--sunk`                             | `--wf-surface`, `--wf-surface-2`, `--wf-track`                                     | Small                                      |
| `--accent`, `--accent-ink`, `--accent-soft`                      | `--wf-accent`, `--wf-accent-ink`, `--wf-accent-tint`                               | Small                                      |
| `--danger`, `--warn`, `--good`                                   | Tone when it colours a glyph or edge. `-ink` when it colours words. Check each use | Yes, per use                               |
| `--danger-soft`, `--warn-soft`, `--good-soft`                    | `--wf-fit-tint` or `--wf-hold-tint` inside data. Card fills are removed (rule 6)   | Yes                                        |
| `--lift`, `--ward-shadow`                                        | `--wf-e1`, only in a `box-shadow` slot                                             | Fixes the invalid shadows in `patient-now` |
| `--focus`                                                        | `--wf-focus-ring`                                                                  | None                                       |
| `--r1` (10px), `--r2` (6px), `--pill`, `--radius-pill`           | `--wf-r-sm`, `--wf-r-xs`, `--wf-r-pill`                                            | None                                       |
| `--body`, `--mono`                                               | `--wf-font`, `--wf-mono`                                                           | None                                       |
| `--t-0`, `--text-xs`, `--text-3xs`                               | `--wf-fs-12`                                                                       | None                                       |
| `--t-1`, `--t-2` (13.5), `--t-3`, `--t-4`, `--t-5`, `--t-6` (26) | `--wf-fs-13`, `-14`, `-14`, `-16`, `-20`, `-28`                                    | 13.5 to 14, 26 to 28                       |
| `--ward-space-4`, `-8`, `-12`, `-16`                             | `--wf-s-1` to `--wf-s-4`                                                           | None                                       |
| `--ward-space-2`, `-6`, `-10`                                    | Inside a control only, as 2, 6 and 10px                                            | None                                       |
| `--ward-tap`, `--spacing-tap`                                    | `--wf-touch`                                                                       | Check the 48px PsychSift knob. Ward is 44  |

**Order, as each screen is touched.**

1. Wire the theme switch (section 4) and add the v8 tokens beside v6. They do not collide, because v8 changes values only where section 5 says.
2. Add the alias file and the six gates with today's counts as the per-file baseline.
3. Update `wf/` to v8: the 12px floor, count circles, info capsule, the contracts in section 8.
4. Per screen: aliases to roles, raw sizes to the six, raw z-index to rungs, media queries to the three widths. Remove `outline: none` only where no replacement exists (J3).
5. Delete the unreachable versioned CSS (`*-third-edition`, `statistics-v4`, `ward-modes-second-edition`, about 9,550 lines) with Josh's dead-code approval, and update the tests that pin it.
6. Update `design/figma/tokens.json` with v8 values and run the Figma sync. `tests/figma-tokens.test.ts` pins v6 until then.

## 10. Gates

Each gate is a per-file ratchet run by `npm test`, so it runs in CI. A count can fall and never rise.

1. **Token graph.** Parse CSS and TSX style objects. Fail on a self-reference or cycle, a reference with no definition and no fallback (TSX included), and a shadow-valued token used in a colour slot.
2. **Theme completeness.** Every colour token in the v8 sheet is a `light-dark()` pair, or is on the short theme-independent list (hero, on-hero, light parts).
3. **Type.** Raw `font-size` values, and any size off the six, per file. This replaces the unwired `check:type-scale` and extends the existing 12px ratchet.
4. **Layers and widths.** CSS `z-index` must read `var(--wf-z-*)`. Media query widths must be 40, 48 or 64rem. Extends `require-z-index-ladder`, which only sees TSX.
5. **Focus.** `outline: none` or `outline: 0` only in a rule that also draws a visible replacement, or under `:focus:not(:focus-visible)`.
6. **Inline style.** TSX `style={{}}` count per file, and no hex in a style object. Extends `no-hardcoded-hex`, which only sees Tailwind classes. Delete the orphaned `drift-ratchet.json`.

## 11. Carried from v7 unchanged

Shared components (SidePanel, TabbedCard, ChartCard, BedBoard, ShapeKey, RecordDrawer, Facts, HeroToggle and HeroBand, GroupedTable, RowTimeline, FitList, ShiftBrief, Palette, RecordState and the quiet hero), page anatomy and phone rules are as in v7 sections 6 to 8. One change: any 11px in those specs is now 12px.

## 12. Needs Josh

1. **12px floor over 11px.** v8 follows O-15.1. Confirm, or rule that uppercase eyebrows and counts may be 11px. If so, only `--wf-fs-11` and rule 16 change.
2. **Data colours change.** Steps 2 and 3 darken so every series reads. Every chart in the app shifts slightly.
3. **Night service colours.** CAHS and Statewide get their own night hues. Day keeps the services' own colours.
4. **Carried from v7.** Capsule for moving, quiet hero and dash, T1 pills. The tier time thresholds remain synthetic and need clinical sign-off.

## 13. Verified and not verified

- **Verified.** The board was rendered in Chromium (Playwright 1.56) in day and night, desktop and phone, every tab, with no script errors and no sideways scroll at 420px. Computed styles confirm `light-dark()` resolves to the night surface under `.night` and the day surface under `.day`. Contrast figures come from the token values.
- **Not verified.** The app has not been changed or run against v8. High contrast mode and print were checked by reading the rules, not on a Windows ward PC or a printer. Edge version support for `light-dark()` on WA Health desktops is unconfirmed.
