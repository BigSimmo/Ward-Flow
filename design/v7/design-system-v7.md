# Ward Flow design system v7 (v7.1)

Synthetic prototype, not a medical device. v7 builds on v6 (`../v6/`, left untouched). Tokens and component classes are in `ward-flow-v7.css` in this folder. The live board is the "Ward Flow design system v7" Artifact.

Grounding: Ward Flow coordinates beds, referrals and movements for WA mental health services. Each screen answers one of four questions fast: where is a bed, who is waiting and for how long, whose move is it, what must happen this shift. v7 was reviewed against that, against Josh's standing rules in project memory, and against the design work merged or mocked up on 8 and 9 Oct (PRs #127 to #137, Ward Hub, Delays, Patient and Global search mockups).

## 1. Review: what was wrong

17 issues (groups A, B and D) plus 14 patterns to share (group C). A second audit of v7 itself found 14 more, all fixed in v7.1 (section 11).

Evidence counts come from `src/**/*.css` at main `d7d7b39` (9 Oct).

### A. The v6 spec contradicts later decisions

| #   | Issue                                                                             | Evidence                                                                                                   | v7 fix                                                                                                     |
| --- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| A1  | Buttons, badges, counts, segmented items and tabs have square corners (6 to 10px) | v6 `.b` r-md 10, `.bd` and `.k` r-xs 6. Josh 7 and 8 Oct: pill buttons, chips and tabs, circles for counts | All controls are pills. Counts are circles. Radii scale softened (section 3)                               |
| A2  | Underline tabs                                                                    | v6 `.tabs`. Ward Hub, Delays, Settings and ED mockups all use pill tabs                                    | Underline tabs retired. One pill control (`.pt`) in three sizes for page tabs, panel tabs and view toggles |
| A3  | Coloured icon tiles still in the kit                                              | v6 `.tile.acc`, `IconTile` used in 23 places. Josh: plain icons, no coloured tiles                         | `.tile` is a neutral circle only, `.acc` retired                                                           |
| A4  | Tier is a square digit tile                                                       | v6 `.sq`. Delays mockup swapped it to a circled digit, which then reads as a count                         | Tier is a `T1` pill (`.tier`), never a circle                                                              |
| A5  | Glass for every bar                                                               | Phone header locked 8 Oct is solid on scroll                                                               | Bars are glass on desktop, solid surface-2 on phone (rule 3 amended)                                       |

### B. The spec breaks its own rules

| #   | Issue                                                                                                          | Evidence                                                                                                | v7 fix                                                                                                                                           |
| --- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| B1  | Rule 7 (one shape per tone) is broken: info and warning are both filled circles, differing by 0.6px and colour | `status-glyph.tsx` r 4 vs r 3.4. v6 spec admits "differ only by colour"                                 | Info is a capsule. Every tone now has its own shape in glyphs, dots, legends and charts                                                          |
| B2  | Dashed edges mean two things                                                                                   | v6: dashed = disabled or locked. Ward Hub board: dashed = free bed                                      | Rule 15: dashed means unavailable. A free bed is a solid tile with a soft fit tint and a tick                                                    |
| B3  | Mono spreads into sentences                                                                                    | Ward Hub hero footer and shift rows, 159 `font-family: var(--wf-mono)` declarations in ward CSS         | Rule 14: mono is for figures, ids and clock times only                                                                                           |
| B4  | Hero stats come in two looks with no rule                                                                      | Delays hero: plain stats with dividers. Ward Hub and Home: pill toggles                                 | Rule 13: a pill presses. Stats that filter or open a band are pills with `aria-pressed`, stats that only report are plain. Never both in one row |
| B5  | No state for "nothing is live"                                                                                 | Patient page: most looked-up patients are not active, yet the slate hero and live timers imply they are | Quiet hero (`.hero.quiet`) and a record state line for inactive, discharged and historical records                                               |
| B6  | Off-scale sizes in the spec's own components                                                                   | `.seg .k` used 10.5px                                                                                   | Seven sizes only. 11px is for uppercase eyebrows, counts, tier, kbd and chart ticks                                                              |

### C. Patterns repeated per page that should be shared

| #   | Pattern                                                                     | Seen in                                                                                   | v7 component                         |
| --- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------ |
| C1  | Side panel that rests on a summary and swaps to the clicked item, with Back | Ward Hub "Ward flow", Delays rail, Home placement                                         | `SidePanel`                          |
| C2  | Card with pill tabs and counts in the head                                  | Ward Hub panel and This shift, Settings, Delays graphs                                    | `TabbedCard`                         |
| C3  | Graph card with a view toggle where marks filter the table                  | Delays (Wait spread, Next 4 hours, Where and whose move)                                  | `ChartCard`                          |
| C4  | Bed board with a shape key, Board or List, and Find that fades              | Ward Hub A                                                                                | `BedBoard`, `BedTile`, `ShapeKey`    |
| C5  | Bed or person slide-out with prev and next, quick facts and tabs            | Ward Hub bed dossier, Patient                                                             | `RecordDrawer`, `Facts`              |
| C6  | Hero counts that filter or open one band underneath                         | Home (#130), Ward Hub                                                                     | `HeroToggle` and `HeroBand`          |
| C7  | Table grouped by blocker with owner, count and longest wait                 | Delays                                                                                    | `GroupedTable`                       |
| C8  | One-row timeline under a selected row                                       | Delays                                                                                    | `RowTimeline`                        |
| C9  | Fits list (green fits with bed, amber fits with no bed)                     | Home placement, bedflow (#130)                                                            | `FitList`                            |
| C10 | Print-safe shift summary with bed numbers, no names                         | Ward Hub Shift brief                                                                      | `ShiftBrief`                         |
| C11 | Palette with kinds, counts and a preview pane                               | Global search (#131)                                                                      | `Palette`                            |
| C12 | Preview tag for unwired controls                                            | Settings (#134)                                                                           | `PreviewTag`, `unavailable` prop     |
| C13 | Status key repeated as page footers                                         | Ward Hub, Delays                                                                          | `ShapeKey` plus a header Key popover |
| C14 | Record state for inactive people                                            | Patient page thread (state pill, dash for not active, As at, Not recorded, closed banner) | `RecordState` and quiet hero         |

### D. The app drifts from the system

| #   | Drift                                                                                                                         | Count                                               | Fix                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------- |
| D1  | Six token families live side by side: `--wf-`, `--ward-`, `--t-`, legacy `--ink/--line/--surface`, `--text-`, `--radius-/--r` | 10,886 `--wf-` uses against 13,000+ from the others | Alias the legacy names to `--wf-` tokens in one file, then delete per screen |
| D2  | Raw colours                                                                                                                   | 787 hex values, 421 unique                          | Replace with tokens, screen by screen                                        |
| D3  | Font sizes off the scale                                                                                                      | 9, 9.5, 10, 10.5, 11.5, 12.5 and 13.5px all in use  | Map to the seven sizes. 12px floor for text, 11px for eyebrows and counts    |
| D4  | Shadows                                                                                                                       | 1,143 declarations, 261 unique                      | e1, e2, e3 only                                                              |
| D5  | Focus removed                                                                                                                 | 100 `outline: none` or `outline: 0`                 | Delete. The global `:focus-visible` outline covers them                      |
| D6  | Shared library half adopted                                                                                                   | 73 of 155 ward screens import `src/components/wf`   | New screens must. Old ones move as they are touched                          |

## 2. Rules (15)

1. **Calm and dense.** Space between parts is 4, 8, 12 or 16 (`--wf-s-1` to `--wf-s-4`). Inside a control, insets may step by 2 (2 to 14). No empty boxes, no oversized parts.
2. **Every surface has an edge.** Hairline first, light shadows. Control edges at least 3:1.
3. **Glass for chrome only.** Bars, menus, toasts, sheets and the palette. Never data. Phone bars are solid.
4. **One hero band per page.** Slate while anything on the page is live. Quiet (a light card) when nothing is.
5. **One primary per area.** Everything else is secondary, tint or ghost.
6. **Colour is a dot or glyph.** Never a card fill. Soft fit and hold tints are allowed inside data only.
7. **Shape carries status.** One shape per tone everywhere.
8. **Signal, not explanation.** No sentence restates the data. Titles 5 words at most, actions 6.
9. **Live and honest.** Values show their age. Stale or offline is marked on the value. Lists update at most once a minute and can pause.
10. **Labels never wrap.** Shrink, then truncate, then tip.
11. **Colons mean clock time.** Durations carry units and a direction word.
12. **Red means act now.** Nothing else is red.
13. **Shape tells you what it does.** Raised pills press (buttons, filter chips, hero pills). Flat pills label (badges, tier, state pill, live chip). Circles count. Cards hold, tables list.
14. **Mono is for figures.** Numbers, ids, clock times. Sentences stay in the sans.
15. **Dashed means unavailable.** On controls and surfaces: disabled, locked and Preview. Chart reference lines and hatching are exempt.

Voice is unchanged: Australian English, sentence case, verbs first, 24 hour time, digits.

## 3. Token changes from v6

| Token                                                                | v6                | v7                                                   | Why                                    |
| -------------------------------------------------------------------- | ----------------- | ---------------------------------------------------- | -------------------------------------- |
| `--wf-r-sm`                                                          | 8                 | 10                                                   | Softer insets                          |
| `--wf-r-md`                                                          | 10                | 12                                                   | Bed tiles, inputs, insets              |
| `--wf-r-lg`                                                          | 14                | 16                                                   | Bigger card corners                    |
| `--wf-r-xl`                                                          | 20                | 22                                                   | Hero, drawers, sheets                  |
| Buttons, chips, tabs, badges, live chip, stepper                     | r-md or r-xs      | `--wf-r-pill`                                        | Rule 13                                |
| `--wf-fs-*`, `--wf-lh-*`                                             | in app only       | in the sheet                                         | One type source                        |
| `--wf-hero-danger` and four siblings                                 | inline in `.hero` | tokens                                               | Quiet hero needs to switch back        |
| `--wf-fit-tint`, `--wf-fit-edge`, `--wf-hold-tint`, `--wf-hold-edge` | new               |                                                      | Fits and holds in boards and placement |
| `--wf-count`                                                         | new               | 18px                                                 | Count circles                          |
| `--wf-panel`, `--wf-panel-wide`                                      | new               | clamp(300px, 27%, 400px), clamp(340px, 33.3%, 480px) | Side panel widths                      |
| `--wf-drawer`, `--wf-drawer-wide`                                    | new               | 480, 760                                             | Record drawer, referral slide-out      |
| `--wf-bar-phone-top`, `--wf-bar-phone`, `--wf-touch`                 | new               | 56, 52, 44                                           | Phone bar locked 8 Oct                 |

Renames and retirements: `.tabs` and `.seg` become `.pt`; `.sq` becomes `.tier`; `.tile.acc` is retired; `.dot` becomes `.g`. Colours, elevation, motion and contrast results are unchanged from v6 (section 3 there). The capsule glyph uses the same info colour, so contrast holds at 4.9:1.

## 4. Status glyphs

| Tone    | Shape         | Means                                                 |
| ------- | ------------- | ----------------------------------------------------- |
| danger  | Triangle      | Act now: overdue, offline, error                      |
| warning | Filled circle | At risk: due soon, stalled, stale. Always with a word |
| success | Tick          | Done: accepted, ready, free                           |
| info    | Capsule (new) | Moving: en route, requested, held                     |
| neutral | Ring          | Waiting: routine, on leave                            |
| closed  | Cross         | Declined, closed                                      |

Glyphs are 9 to 10px and `aria-hidden`. The word beside them carries the meaning. The same shapes are used as chart marks (Delays dot graph) and in the shape key.

## 5. Components, updated

- **Button.** Pill. Sizes 30, 36, 44. Split button for New referral. Disabled is dashed with a reason.
- **Pill tabs `.pt`.** One control for page tabs (Home, Decisions), panel tabs (Referrals 1, Admissions 3) and view toggles (Cards, Table, Lanes). `.sm`, `.fill` and `.icons` variants. Counts inside in circles. Scrolls sideways on phone, never wraps.
- **Filter chip `.fc`.** Pill with a count circle. On state is an accent edge, not a fill.
- **Choice row.** One row of equal soft buttons for short exclusive choices such as sex or Refer to. Never wrapping pills.
- **Badge.** Pill with a glyph. Drops its chip inside table rows. Sparing: one per card head.
- **Count `.k`.** Circle, 18px, pill when two digits or more. Always neutral. Status goes in the glyph beside the label, never in the count (v7.1).
- **Tier `.tier`.** `T1` to `T3` in an outlined flat pill. T1 is bold with a darker edge, never red (v7.1).
- **Input.** Search is a pill. Text fields keep r-md. Text areas r-lg.
- **Live chip.** Pill. Live, paused, stale (amber edge, "Stale, as at 10:26"), offline (red edge, "est." on timers).
- **Hero stat.** Plain or pill per rule 13.
- **Preview tag.** Dashed outline, uppercase 11px, for controls that are not wired.

## 6. New shared components

Each lists states, phone behaviour and accessibility. All are shown live on the board.

1. **SidePanel.** Grid column `--wf-panel` beside the core feature. Rests on a summary for the page (Ward flow, Bed flow today, registers). Clicking a row, bed or dot swaps it to that item with a Back control and keeps the summary one tap away. Close only when the panel is optional. Phone: becomes a bottom sheet. A11y: the swap moves focus to the item heading, Back returns focus to the row that opened it, `aria-live="polite"` on the heading only.
2. **TabbedCard.** Card head with a title, `.pt.sm` tabs with counts, and an optional time. One body visible at a time. Height matches its neighbour on desktop. Phone: tabs scroll sideways.
3. **ChartCard.** One card, a view toggle, a key line, the chart, then a footer "N match, Clear". Every mark filters the table above. Marks use the glyph shapes. Max four faint gridlines, one dashed reference line, direct labels. Phone: charts with more than 12 columns become a ranked list.
4. **BedBoard and BedTile.** 5 across on desktop, 2 on phone. Tile: bed number (mono), name or state word, one line of state plus stay, one glyph top right. States: occupied, free (fit tint and tick), pulled, held (capsule), on leave (ring), at risk (amber), act now (triangle), closed (cross, muted). Board or List toggle, Find fades non-matches to 50%, shape key in the footer. A11y: each tile is a button named "Bed 04, Alaric F, held up, 34 days".
5. **ShapeKey.** One line of glyph plus word. Footer of boards and charts, and a Key popover from the header.
6. **RecordDrawer.** `--wf-drawer` wide, thick glass over a scrim. Head: id, name, age, sex, stay band, prev and next arrows. Facts strip of four. Pill tabs (Overview, Plan to leave, Timeline). Footer: actions that match the record's state, one primary. Phone: full-height sheet with a grab handle.
7. **Facts.** Three or four equal cells: stay, legal, going out, observation. Truncates, never wraps.
8. **HeroToggle and HeroBand.** Hero pills with counts that filter the core feature or open one shared band under the hero. One band open at a time. `aria-pressed` and `aria-controls`. Phone: toggles hidden, the band's content stays in the page.
9. **GroupedTable.** Group header rows with chevron, name, count circle, owner ("Wards to clear"), longest wait and a mini bar. Groups collapse. Selected row gets the 3px marker.
10. **RowTimeline.** Opens under the selected row. One track from arrival to now with at most five labelled points, quiet time hatched, a due marker with its glyph.
11. **FitList.** Wards a patient fits. Green tint plus tick when it fits and has a bed, amber tint plus circle "Fits, no bed now". Previously declined wards never count as fits. Eligible and review wards are never hidden.
12. **ShiftBrief.** Print-safe sheet. Eight figures, then Came in, Going, Stuck, Overdue, Away at ED, Still to do. Bed numbers only, no names. Copy action.
13. **Palette.** Thick glass under the header, kind chips with counts, results left, preview right. Empty query shows Needs you now, Recent (session memory only), Go to, Do. Phone: full screen, no preview, chips scroll.
14. **RecordState and quiet hero.** Taken from the Patient page thread (9 Oct). A record is in one of three states, decided in this order: In placement (an open placement), On ward (an occupied bed), otherwise Not active, which covers most lookups.
    - A state pill in the header names the state. Not active uses a dash marker. The dash is a record state, not a seventh status tone.
    - In placement keeps the slate hero, the live chip and the timers, and is the only state that can show red.
    - On ward keeps the slate hero, showing the stay: ward, bed, day of stay, legal, observation and discharge plan. The main action is Request transfer.
    - Not active uses the quiet hero (a light card). There is no live chip, no timers and no red. Values show "As at" with the time they were loaded. The first tab becomes Overview, and the main action is New referral, prefilled from the last stay.
    - A link to a closed placement opens the person as they are now, with a dashed closed-record banner that links to the old record (rule 15).
    - Empty values show a plain grey "Not recorded", never a dash or a blank.

## 7. Page anatomy

Top to bottom on desktop:

1. Hero band (title, live chip, at most five stats or toggles, one primary).
2. Toolbar row: page pill tabs left, Find pill and page actions right.
3. Core feature full width with a SidePanel on the right.
4. One TabbedCard or ChartCard below, full width.

Phone keeps the order, drops the panel to a sheet and the lower card to tabs.

## 8. Phone

- Breakpoint 48rem. Desktop is never changed by phone rules.
- Bar: 56px with no fill at the top, 52px solid on scroll, never hides, scope line becomes a live summary.
- Touch targets 44px. Pill tabs 36px high.
- Side panels and drawers become bottom sheets with a grab handle.
- Boards 2 across. Tables become stacked rows with the wait on the right.

## 9. Migration (build only when Josh says build)

1. Add the v7 token block to `src/app/ward-flow-v6-tokens.css` (rename later). Radius values change in place, so every screen using `--wf-r-*` softens at once.
2. Update `src/components/wf`: Button, Badge, Count, Tabs and Segmented (to `.pt`), TierTile (to `.tier`), StatusGlyph (info capsule), IconTile (neutral circle), HeroStat (`pressed` prop sets the pill).
3. Add the new components to `src/components/wf` as they are built into the pages that need them (Ward Hub first: SidePanel, TabbedCard, BedBoard, RecordDrawer, ShiftBrief).
4. Alias legacy token families to `--wf-` tokens in one file, then remove the 100 `outline: none` lines.
5. Per screen as touched: raw hex to tokens, off-scale sizes to the seven sizes, shadows to e1 to e3.

## 10. Needs Josh

- Capsule for "moving" (info). It is the only new shape.
- Quiet hero, state pill and dash marker for patients who are not active, as built into the Patient page mockups.
- Tier as `T1` pills instead of circled digits.
- The tier time thresholds remain synthetic and need clinical sign-off.

## 11. v7.1 audit (9 Oct)

Josh asked for v7 itself to be reviewed and fixed. Contrast ratios are WCAG 2.2, measured on the v7 token values.

| #   | Issue                              | Evidence                                                       | Fix in v7.1                                                                   |
| --- | ---------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| E1  | Pressed hero pill glyphs fail 3:1  | Hero tones on white: danger 2.91, success 2.6, warning 2.25    | Pressed pill resets tones to day values: 4.57, 4.27, 4.07                     |
| E2  | Counts signal by colour alone      | `.k.warn`, `.k.act` were an edge colour only                   | Retired. Glyph sits beside the label, count stays neutral                     |
| E3  | T1 is red                          | `.tier.t1` used danger, but red means act now only             | Neutral ink, 1.5px darker edge                                                |
| E4  | Raw hex in the quiet hero          | `.hero.quiet` re-declared five tones by hex, plus a night copy | Hero swaps tones only on `.hero:not(.quiet)`                                  |
| E5  | Tooltip has no night look          | `.tip` one dark fill in both themes                            | `--wf-tip-bg`, `--wf-tip-ink`, `--wf-tip-ring`, day and night                 |
| E6  | Focus ring clipped                 | `.stp` overflow hidden, `.pt` scrolls                          | Inset ring on stepper buttons, offset -2px on tabs and tracks                 |
| E7  | Words at 11px                      | As at, est., facts labels, small badges, live units            | 12px floor for words. 11px only for caps eyebrows, counts, tier, kbd, ticks   |
| E8  | Live chip set in mono              | Breaks rule 14                                                 | Sans words, `.clk` mono time                                                  |
| E9  | Rule 13 too loose                  | Badges, tier and state pill are pills that never press         | Raised pills press, flat pills label. `.fc` and `.hs.pill` gain a raised edge |
| E10 | Rule 15 against chart rules        | Dashed mean line and hatching are in the chart spec            | Rule 15 covers controls and surfaces only                                     |
| E11 | Hero pills under 44px on touch     | `.hs.pill` fixed at 36px                                       | `min-height: var(--wf-h-md)`, 44px on coarse pointers                         |
| E12 | Same state, two tones on the board | Bed 04 and 16 both held up, one act now, one at risk           | Both act now. Count 3 in hero, brief and phone bar                            |
| E13 | Faded beds unreadable              | Find fade at 0.32 put text under 3:1                           | Fade to 0.5                                                                   |
| E14 | Raw colours on the hero            | rgba fills and `#d5e0ea` in six classes                        | `--wf-on-hero-fill`, `-line`, `-hl`, `-ink`, `-track`, `--wf-light-ink`       |

New tokens: `--wf-on-hero-fill`, `--wf-on-hero-line`, `--wf-on-hero-hl`, `--wf-on-hero-ink`, `--wf-on-hero-track`, `--wf-light-ink`, `--wf-tip-bg`, `--wf-tip-ink`, `--wf-tip-ring`. Retired: `.k.warn`, `.k.act`. No renames.

## 12. Design system skill audit (9 Oct)

Run with the design-system skill on the v7.1 sheet after section 11. Measured on `ward-flow-v7.css`, rules only (token blocks excluded).

**Summary.** 31 components reviewed. 9 issues found, 8 fixed, 1 deferred to the build. Score 74 before, 90 after.

### Naming consistency

| Issue                                           | Where                                                                     | Fix                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `.rtl` reads as right to left                   | Row timeline                                                              | Renamed `.row-tl`                                                      |
| Class names are terse with no map to components | `.b`, `.bd`, `.k`, `.g`, `.lv`, `.hs`, `.pt`, `.fc`, `.stp`, `.sw`, `.in` | Kept short for CSS Modules, mapped below. React names are the contract |

| Class   | Component   | Class                 | Component               |
| ------- | ----------- | --------------------- | ----------------------- |
| `.b`    | Button      | `.lv`                 | LiveChip                |
| `.bd`   | Badge       | `.hs`, `.hs.pill`     | HeroStat, HeroToggle    |
| `.k`    | Count       | `.pt`                 | PillTabs                |
| `.tier` | Tier        | `.fc`                 | FilterChip              |
| `.g`    | StatusGlyph | `.stp`                | Stepper                 |
| `.in`   | Input       | `.sw`, `.chk`, `.rad` | Switch, Checkbox, Radio |
| `.trk`  | HeroTrack   | `.row-tl`             | RowTimeline             |
| `.bed`  | BedTile     | `.empty`              | EmptyLine               |

### Token coverage

| Category      | Before                                                                     | After                                                                                                                                                  |
| ------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Type          | 57 raw sizes, `--wf-fs-*` and `--wf-lh-*` defined but never used, one 17px | 58 `--wf-fs-*` and 15 `--wf-lh-*` uses, no raw sizes, 17px now 16                                                                                      |
| Spacing       | Rule said 4 to 16, but 3, 5, 7 and 9px in use. `--wf-s-*` used 9 times     | Odd values moved to the 2px grid. `--wf-s-*` used 39 times. Rule 1 now names both steps                                                                |
| Colour        | 12 raw hex in rules (`#fff` 9, `#eef2f6`), `--wf-on-accent` unused         | 2 left, both `#000` mask fills. New `--wf-light-*` tokens for white parts on the hero                                                                  |
| Elevation     | 16 raw shadows                                                             | 13. `--wf-e-raise` and `--wf-e-press` added. The rest are control specific (hero, primary, glass)                                                      |
| Unused tokens | 27                                                                         | 9, all reserved: `--wf-data-3`, `-ready`, `-closed` (charts), `--wf-*-ink` tones (tone text), `--wf-canvas`, `--wf-hero-ink-3`, `--wf-m-slow` (sheets) |

### Component completeness

States: D default, H hover, F focus, P pressed or selected, X disabled, L loading, E error, M empty, S stale.

| Component                   | States                       | Variants                                                     | Docs | Score |
| --------------------------- | ---------------------------- | ------------------------------------------------------------ | ---- | ----- |
| Button                      | D H F P X L                  | pri, sec, tint, ghost, danger, light, onhero, split, 3 sizes | Yes  | 10    |
| PillTabs                    | D H F P X (new)              | sm, fill, icons                                              | Yes  | 9     |
| FilterChip                  | D H F P X (new)              | with count                                                   | Yes  | 9     |
| Input                       | D F E X (locked)             | search, text, date                                           | Yes  | 9     |
| Switch, Checkbox, Radio     | D F P X                      | Preview                                                      | Yes  | 8     |
| Badge, Count, Tier          | D                            | tones, id, solid, sm, Preview                                | Yes  | 9     |
| LiveChip                    | D S (stale, offline, paused) | onhero                                                       | Yes  | 10    |
| HeroStat, HeroToggle        | D H F P                      | plain, pill                                                  | Yes  | 9     |
| BedTile                     | D H F P X (closed) S (fade)  | 8 states                                                     | Yes  | 9     |
| Card, TabbedCard, ChartCard | D L M S                      |                                                              | Yes  | 9     |
| EmptyLine                   | new                          |                                                              | Yes  | 9     |
| Tooltip, Popover, Drawer    | D                            | day, night                                                   | Yes  | 8     |

### Accessibility

| Issue                                                                                                | Fix                                                                                                           |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Windows high contrast (ward PCs) removed every status glyph, because glyphs are drawn as backgrounds | `forced-colors` block keeps glyph shapes in `CanvasText`, focus in `Highlight`, disabled dashed in `GrayText` |
| Disabled only defined for buttons                                                                    | Same dashed, ink-off treatment on chips and tabs                                                              |
| Empty state lived only in the board, 120px tall                                                      | `.empty` in the sheet: one 48px line, glyph, what is clear, last time                                         |
| Touch token unused                                                                                   | Coarse pointer heights now read `--wf-touch`                                                                  |

### Priority actions for the build

1. Build `src/components/wf` from the sheet first, with the class map above as the component names.
2. Add the drift guard (raw hex, off-scale sizes, `outline: none`) before pages migrate.
3. Fold the 13 control shadows into named elevation tokens when the Button and PillTabs components are built. Deferred because each needs checking in the real app.
