# Ward Flow design system v9

Synthetic prototype, not a medical device. The values live only in [`ward-flow-v9.css`](ward-flow-v9.css). [`ward-flow-design-system-v9.html`](ward-flow-design-system-v9.html) is the live board, drawn by that same sheet in day and night, desktop and phone.

**Status.** This is the standard. v9 replaces v8 to v8.2 as one document, so nobody has to apply a chain of amendments. v8 (`../v8/`) and v7 (`../v7/`) stay unchanged for provenance. The app does not load this sheet yet. Loading it, and moving the shared parts onto it, is the next step (section 15).

**Why v9.** On 10 October 2026 Josh asked for the design system to be perfected. The review (artifact `66mvgLJYqmC6WqVGHNKftt`, source `design/appraisal-10oct/design-system-v9-proposal.html` in the project files) found 45 issues: the spec read as a changelog, the sheet contradicted its own rules, glass was heavy, motion barely existed, and layout and content had no rules. Josh approved every recommendation at 00:39Z, with one change: glass stays largely opaque, at about 80%.

## Changes 10 Oct 2026

Elevate is adopted. Josh approved every Elevate recommendation on 10 October ("Go ahead with all your recommendations"). The appraisal and its board are at https://claude.ai/artifact/KVE47Vcu2F7577MxNtVZCu. It brings one action blue, a lit hero, glass you can see by day and a quiet slate for closed (section 3), the Elevate parts (section 12), Glare mode (section 13), and the fixes now written into sections 3 to 9. The page review calls that were pending are now decided (section 14).

## 1. Principles

Eight principles replace the 21 numbered rules. Each one says what to do, not only what to avoid.

1. **Answer first.** Every page answers one question in 5 seconds. Its focal part is in the first screen and gets the most space.
2. **Calm, dense, aligned.** A compact scale, a 4px rhythm, flush equal columns, tables that grow, and no empty rails.
3. **Colour means state.** Tone lives in glyphs, the hero and the thin act now edge. Red means act now and nothing else. Words stay neutral ink.
4. **Shape tells you.** One shape per status. Raised pills press, flat pills label, circles count, dashed means unavailable.
5. **Materials have roles.** Solid surfaces for content, frosted glass for chrome and overlays, deep slate for the hero. Never glass on data.
6. **Live and honest.** Values show their age and mark themselves when they change. Counts reconcile. Nothing claims more than it shows.
7. **Every action answers.** A press reacts within 100ms, then the result shows, with Undo where the step can be undone.
8. **Everyone can use it.** Keyboard first, a visible ring everywhere, reflow at 200% zoom, and motion and transparency that follow the user's settings.

Voice: Australian English, sentence case, verbs first, 24 hour time, digits. Titles 5 words at most, actions 6.

## 2. Theme

One switch, carried from v8. Every colour token is `light-dark(day, night)`, resolved by `color-scheme`. `data-theme` on `<html>`, the OS setting, `.day` and `.night` subtrees and print all work through it, so no theme block can miss a token. The app wiring steps are unchanged from v8 section 4. `light-dark()` needs Edge 123 or later. The managed Edge version on WA Health desktops is still unchecked. The night switch shows "on" in the accent.

**One key, one writer.** The stored key is `clinical-kb-theme`, kept in storage and a cookie so the server paints `data-theme` before first paint. One function, `setThemePreference`, writes it and sets `data-theme`, `.dark` and both `theme-color` metas together, with an in-memory fallback when storage is blocked. The pre-paint script moves the old `ward-flow-appearance` key across once. Auto follows the OS. The top bar, the rail, Settings and sign-in are views over that one switch, never their own copies. The phone status bar style is `default`. This replaces v8 section 4 steps 1 and 2 (from the 9 Oct v8 app build, which was never merged).

## 3. Colour and materials

**Surfaces.** Canvas, surface, surface-2, track, hover and selected carry over from v8. v9 adds two steps that rise:

| Token          | Day       | Night     | Use                                               |
| -------------- | --------- | --------- | ------------------------------------------------- |
| `--wf-raised`  | `#ffffff` | `#1b2733` | Menus, popovers, the selected tab, glass fallback |
| `--wf-overlay` | `#ffffff` | `#202d3a` | Sheets and dialogs                                |

At night a surface gets lighter as it rises, because shadows do not show on a dark canvas.

**Tone.** Glyphs, edges and marks take the tone (`--wf-danger` and so on). Words that stand alone, such as an error message, take the `-ink` partner. Cards, rows and tiles take no tinted fill, except a free or fit place, which keeps its soft fit tint. An act now item takes a thin 1px edge in `--wf-act-edge` through `.edge-act`, never a fill. On the hero, glyphs take the on-hero tones.

**Accent.** One clear blue means you can act here. `--wf-accent` is `light-dark(#245a8c, #8cbcf0)`. The primary button runs from `--wf-pri-1` `light-dark(#2f6aa3, #3a72a8)` to `--wf-pri-2` `light-dark(#234f7a, #2c5c8c)`. White text holds at least 4.9:1 on every primary stop. Data bars (`--wf-data-*`) stay slate, so blue never reads as data. Red and amber keep their meanings.

**Accent states.** `--wf-accent-hover`, `--wf-accent-press` and the primary gradient's `-hover` and `-press` stops, one step each. No control uses `filter`, which softened text and made a stacking context. A disabled control never reacts to hover or press.

**Hero light.** The hero band has one fixed light source at the top right, a soft radial light over the slate gradient. It never moves and never carries state. The hero's top highlight is `--wf-on-hero-hl` at 0.14. At night the hero edge softens to 10%, so it glows rather than outlines.

**Light parts on the hero.** `--wf-light-1` and `-2` are themed in v9: white by day, `#e9eef3` and `#d6dfe8` at night, so the light button and a pressed chip stop glaring on a night screen.

**Scrim.** One scrim per overlay tier, checked behind a busy page: popovers and menus none, sheets and drawers `--wf-scrim`, dialogs that block the page `--wf-scrim-strong`. The v6 scrim was too faint behind drawers. Never stack scrims or desaturate the page instead.

**Glass.** About 80% opaque by owner choice: frosted and calm rather than see-through. Three tiers by role, one hairline, a bright 1px top edge, a sheen across the top and one soft shadow (owner, 10 Oct: keep the Apple shine at 80% opacity). The masked rim is gone. Saturate stays at 1.4, so red edges and service dots keep their colour as they pass beneath.

Glass you can see by day. Day glass is a cool tint, `rgba(244,247,250)`. The sheen starts at 0.75 by day and 0.12 at night and has faded by halfway down. A faint inner shade sits along the bottom edge. Night glass values are unchanged.

| Class          | Day fill | Night fill | Blur | Use                                                                         |
| -------------- | -------- | ---------- | ---- | --------------------------------------------------------------------------- |
| `.glass.bar`   | 80%      | 78%        | 20px | Top bars and toolbars                                                       |
| `.glass`       | 84%      | 82%        | 24px | Menus, popovers, the palette and the one glass panel allowed in a page body |
| `.glass.sheet` | 88%      | 86%        | 32px | Sheets, drawers and dialogs                                                 |

Only `ink-1` and `ink-2` sit on glass. Measured on the worst backdrop (dark ink passing under day glass, light text under night glass), `ink-2` holds 4.6:1 or better on every tier. Phone bars stay solid. Reduced transparency, increased contrast and a browser with no `backdrop-filter` all fall back to `--wf-raised`.

**Canvas.** The soft glow sits behind the top 400px only, where the hero and bars are, so tables below sit on one even canvas. `--wf-glow-1` is 0.45 by day, so the bar has colour to frost.

**Service colours.** An 8px dot beside the service name, never on its own and never as a fill or stripe. All services (Statewide) is the WA Health corporate green, `#005b38` by day and `#a3d9b8` by night (#173). The v8 sheet had drifted to a blue, and v9 restores the green.

**Data.** The v8 ramp carries over. The third series step also takes a hatch (`.chart-s3`), so series never differ by shade alone, and every series has a direct label.

**Hatch has one meaning.** Hatch means held or quiet: a pulled bed, the third data series, or time on a wait bar with nothing recorded. There is one hatch, drawn through `--wf-hatch`. Quiet time takes the amber circle after 2h. A time axis may compress past a stated point into a hatched band labelled with its range.

**Dim, never hide.** `--wf-dim` (ink at about 45%) is how rows, bars and beds recede when a highlight or a chart pick does not match them. Dim uses colour tokens, never `filter` or `opacity`, so contrast stays predictable.

**Bed states.** Ready takes the fit tint and fit edge. Being made ready adds a ring. Pulled takes the hatch. Closed is never gold: it is a quiet slate, `--wf-data-closed` `light-dark(#b9c4cf, #3a4b5c)`, under a dashed edge. Occupied takes the track. A free or fit bed is never dashed, because dashed means unavailable.

**Overdue zone.** A time axis tints its overdue part with `--wf-overdue-zone`, the danger tone at 6% by day and 8% at night. It is for time axes only. Cards, rows and tiles still take no tint.

**Other tokens.** `--wf-now` marks Now on a time axis. `--wf-mark` (the accent tint) marks matched search text.

## 4. Type

Five sizes on a page. The 12px floor holds with no uppercase exception.

| Size | Line | Weight | Tracking | Use                                                  |
| ---- | ---- | ------ | -------- | ---------------------------------------------------- |
| 20   | 26   | 600    | -1.5%    | Hero and page titles                                 |
| 15   | 20   | 600    | -1%      | Figures: hero chips, key values, the side panel name |
| 14   | 20   | 600    | 0        | Section and card titles                              |
| 13   | 18   | 400    | 0        | Body                                                 |
| 12   | 16   | 500    | 0        | Meta, labels, counts. Uppercase eyebrows at 600, +6% |

28 is for sign-in and print only. 16 is retired. `--wf-fs-16` aliases 15 until nothing reads it. Nothing on a page is larger than 20, except inside a chart.

**Figures in strips and tiles** are 15 mono. 20 is for titles, and for the figures of one focal strip per page.

**Figures.** Figures stay in mono with tabular digits: counts, percentages, durations (`.num`), hero chips, stat values, clock times, UMRNs and ids (owner, 10 Oct: keeps the control room feel). Chart axes and ticks use Geist so charts read quietly. Chart values use mono.

## 5. Space, shape and size

**Space.** 4, 8, 12 and 16 between parts. Inside a control insets may step by 2. 24 (`--wf-s-6`) separates page sections and 32 (`--wf-s-8`) is the wide page gutter. Those two are for layout only.

**Radius.** 6, 10, 12, 16 and 22, and pills. Corners are concentric: an inner radius is the outer radius less the inset, rounded to the scale. A 16px card with an 8px inset holds 8 to 10px parts. No square corners.

**Targets.** At least 28px for anything a pointer clicks on desktop (`--wf-target`). 24px only inline in running text. 44px on phone and touch: on a coarse pointer a smaller control reaches 44px through a hit area, not a bigger face. Hero chips sit on one 32px face with a 36px hit area. Passive badges and the live chip keep their size on touch.

**Density.** One setting in Settings, set as `data-density` on the shell. Every row reads `--wf-row`. Density also binds beds, controls and card heads, not just rail rows.

| Density | Row  | Use                                              |
| ------- | ---- | ------------------------------------------------ |
| `dense` | 36px | Long lists on a large screen                     |
| default | 44px | Everything else                                  |
| `touch` | 52px | Ward touchscreens. Coarse pointers default to it |

**Breakpoints.** Three widths only, recorded as tokens because media queries cannot read them: `--wf-bp-phone` 40rem, `--wf-bp-narrow` 48rem (the phone rule for components) and `--wf-bp-wide` 64rem. No other widths.

**Glyphs.** 10px beside text, 12px in hero chips, 8px only in a row of people pips with its figure beside it. The triangle is drawn about 10% wider so it weighs the same as the circle. Shapes are unchanged: triangle act now, filled circle at risk, tick done, capsule moving, ring waiting, cross closed, dash not active.

## 6. Motion

Quick in, quicker out. Nothing moves without a reason, and nothing bounces on data.

| Token            | Value                              | Used for                                                               | Reduced motion       |
| ---------------- | ---------------------------------- | ---------------------------------------------------------------------- | -------------------- |
| `--wf-t-micro`   | 100ms, ease out                    | Hover colour and edges                                                 | Unchanged            |
| `--wf-t-press`   | 80ms                               | Press: scale 0.97 and the shadow compresses                            | Colour change only   |
| `--wf-t-release` | 160ms, ease out                    | The press springs back                                                 | Colour change only   |
| `--wf-t-enter`   | 220ms, `cubic-bezier(.2,0,0,1)`    | Menus, popovers, toasts, new rows rising 4px                           | 120ms fade           |
| `--wf-t-exit`    | 160ms, `cubic-bezier(.3,0,1,1)`    | Everything leaving. Exits are quicker than entries                     | 120ms fade           |
| `--wf-t-sheet`   | 340ms, `cubic-bezier(.32,.72,0,1)` | Sheets, drawers, the tab capsule, the hero chip selection              | 120ms fade, no slide |
| `--wf-t-live`    | 1400ms                             | A changed value: a 2px accent line fades under it, its glyph pops once | Line only, no pop    |

- **Reactions.** Buttons, chips, tabs, rows and bed tiles all react within 100ms. Hover changes the edge, fill or shadow. It never moves or scales a mark. Scale is for press only, and press compresses. A disabled control does not react at all.
- **Continuity.** Selection moves rather than jumps. Pill tabs use the sliding capsule (`.pt.slide .cap`). A pressed hero chip crossfades. The side panel swaps content with a short crossfade (`.sp-swap`), never a flash.
- **Live without noise.** The live dot is still and pulses once when data arrives (`.pulse.tick`). A changed figure carries `.chg` for 1.4s. New rows rise in (`.enter`), removed rows fade and collapse (`.leave`), and nothing moves under a pointer that is hovering.
- **Busy.** After 300ms with no answer a button shows a spinner in place (`aria-busy="true"`). It keeps its width and its focus. Skeletons crossfade to content (`.loaded`).
- **Never.** No `animation-fill-mode` of `forwards` or `both` on an entry or on any ancestor of glass: it stops the blur (found in PR #204). `forwards` is allowed only on an exit that ends with the element removed. No animated layout on a table of more than 50 rows.
- **Reduced motion** keeps every state change and its feedback, swaps movement for a 120ms fade, and never sets 0ms, because `transitionend` and `animationend` do not fire at zero.

## 7. Layout

- **Grid.** 12 columns on desktop with 16px gutters (`.grid12`, `.span-*`). Page sections sit 24px apart (`.page`).
- **Main and rail.** `.layout-core` with the standard panel, or `.r21` and `.r31` for 2:1 and 3:1. The rail is sticky and live, and ends level with its main column. A rail is never empty: until something is chosen it shows the most urgent item or a short summary, never "Select a row".
- **Equal columns.** Side by side cards are flush and the same height (`.cols`). The `.lead` card sets the height. A `.follow` card takes it and scrolls inside its `.card-scroll`, so a long column never ends below its neighbour and a short one never leaves a gap.
- **Tables.** Tables grow with the page and never sit in a fixed-height box. Only the head row sticks (`.thead`).
- **Hero.** One per page, full width, 20px inset, 22px radius. Facts and one primary on the left, page-specific actions on the right, hero chips below the title, the page's own part (such as the shift timeline) under them.
- **The hero title is the answer.** A count or a shortfall with its noun, five words at most ("Short 26 beds", "2 need you now"). The page name lives in the top bar and the eyebrow.
- **Hero chips.** At most five. A flat chip reports. A pressed chip (`.hs.pill[aria-pressed]`) filters what is under the hero, and its state and the focal part's filter always agree. A chip with a chevron (`.hs.pill[aria-expanded]`) opens a strip under the hero (`.hero-drawer`). Up to two hero jumps (`.hj`) open a record. No page builds its own hero buttons.
- **Checks.** A page that watches conditions lists them in the hero foot (`.hero-checks`): each with its count, zeros quiet, and what it cannot check last with a cross and the reason.
- **Entity pages** (one ward, ED or team) carry a switcher in the title and may show their siblings as a `PressureStrip` in navigate mode.
- **Reflow.** A 1280px desktop at 200% zoom is 640px wide. At 48rem every layout collapses to one column without losing an action (WCAG 1.4.10).
- **Phone** is its own design at 390 by 844, never a reflow of desktop and never a change to it. A priority list, cards with their one action, bottom sheets, a sticky bottom bar and a segmented control. Names 14, meta 12, rows tap as a whole, row actions at least 36px and the bottom bar 44px. Chip rows and tabs that overflow scroll with an edge fade, never a hard cut. Phone charts compress time after 8 hours and keep the outliers.

## 8. Accessibility

- **Focus.** A 2px ring with a 2px gap, so it never touches a red edge, a tint or a selection. Parts whose ring sits inside (tabs, menu items, rows, `.ring-in`) draw the gap inside too. A ring is never clipped: inside a parent with `overflow: hidden` the ring is inset. On the hero the ring is light and the hero sets its own focus gap. In forced colours the ring is `Highlight`, and a selected item keeps its selection with a `Highlight` border.
- **Contrast.** Measured on composited values with the WCAG 2.2 formula. v8 section 6 figures carry over. New in v9: `ink-2` on the worst glass backdrop 4.6:1 (bar, night) or better. Pressed tones on the night light chip 3.5:1 or better. White on every primary stop, hover and press included, 4.9:1 or better. Meta on night raised 5.9:1.
- **Live updates.** One polite live region per page, batched once a minute, announcing only act now changes, such as "2 new act now". Never a running tally.
- **Keyboard.** Arrow keys (and J and K) move through rows and tiles, Enter opens, Escape closes the top layer only and returns focus to what opened it. Timeline marks are reachable by arrow keys. Each page has a skip link (`.skip`) to its focal part. One item in every tab list holds the tab stop.
- **Tips.** A tip stays while the pointer moves onto it (120ms grace), Escape hides it until the next hover or focus, and it never uses `pointer-events: none` (WCAG 1.4.13).
- **Truncation.** Truncated text shows in full on focus as well as hover, and stays in the accessible name.
- **Anything revealed on hover** (row actions `.ra`, timeline links) is also revealed on focus and selection, and always shows on touch.
- **Preferences.** Reduced motion, reduced transparency, increased contrast, forced colours and print are all handled in the sheet.

## 9. Patterns

- **Actions.** The page owns its top bar action. The hero holds facts and one primary. A row has one quiet action that appears on hover, focus or selection. One primary per area.
- **Feedback.** An action changes state at once, then a toast reports it with Undo when the step can be undone. A confirm sheet is only for steps that cannot be undone.
- **States.** Every component uses one wording and look for each state:

| State          | Look                                                                                     | Words                                                              |
| -------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Empty          | One 48px line, ink-3                                                                     | What is clear: "No one waiting"                                    |
| Loading        | Skeleton, crossfades to content                                                          | None                                                               |
| Stale          | Warning edge on the live chip, amber dot, age shown                                      | "Updated 12m ago"                                                  |
| Offline        | Danger edge on the live chip, the dot a neutral ring                                     | "Offline. Showing 10:42"                                           |
| Error          | `-ink` words with the glyph, and a retry                                                 | What failed and what to do                                         |
| Zero           | The figure 0                                                                             | 0, never blank                                                     |
| Not recorded   | Dashed ring glyph, ink-3                                                                 | "Not recorded"                                                     |
| Unavailable    | Dashed edge, `aria-disabled` with a reason                                               | The reason, in a tip                                               |
| Locked primary | The primary keeps its place, `aria-disabled`, a lock line beside it (`aria-describedby`) | "Needs Legal status, Bed fit". Pressing it makes the line an alert |
| Stale record   | Amber circle and the record's age                                                        | "5h 00m stale, ask NUM". Figures built on it read "to check"       |
| Held           | Warning edge on the live chip, neutral dot                                               | "Held at 10:42". On resume, changed figures flash once             |
| Frozen         | Flat live chip, neutral dot, no pulse                                                    | "Frozen 06:00", for a snapshot on purpose                          |
| Changed        | 1px accent edge, the saved point marked, a reset                                         | "Back to saved"                                                    |

- **Filters.** At most three visible, the rest in a More menu. A filter either hides or highlights, and the control says which.
- **Highlight.** Highlight chips (`HighlightPills`) sit in their own row and may run to six, count first. Matching rows stay as they are, the rest dim with `--wf-dim`, and a note says "2 of 7 highlighted, all rows stay" with Clear. Queues of 100 rows or fewer highlight matching rows by default and dim the rest. Delays keeps hiding rows, by owner ruling.
- **Charts as filters.** A bar or mark may be a highlight button with `aria-pressed` and arrow keys, and the caption says what it highlights. One labelled dashed reference line per chart (`RefLine`, `.chart-ref`), drawn by one recipe through the `--wf-ref-*` tokens. A threshold you can move uses the Stepper.
- **Inputs.** An input resets the browser's inner focus and takes the one ring. It has hover, invalid and disabled states.
- **Progress.** One family. Pips (18 by 6px) for one to five gates or steps, 7px dots (`Steps`) for the legs of a trip, a fraction pill (`Frac`, mono) above five, and a ring only in a hero. The first gate that is not clear holds the area's one primary.
- **One control per value.** A stepper or a slider, never both. The 12px floor holds inside controls, range ends included.
- **Print.** Controls carry `data-print-hide`. Print also hides row actions, toasts, tips, menus and drawers, and repeats table headers on each page. Print is ink on white with no glass or shadow, grids collapse to one column, cards and rows never split across pages, and every printed page shows its window and when it was generated.
- **Counts.** Each figure has one source. "N of M" only when N rows are shown, otherwise "Top 10 of 70". Hero chips, tab counts and list lengths agree.
- **Content.** Dates as "Fri 9 Oct". 24 hour time. Durations from one formatter (`durText`) with no seconds: under 1h as 45m, under 48h as 3h 20m, from 48h as 7d 1h, never "169h 0m". A list may add a relative part in ink-3: "Fri 16 Oct, in 7d", "2d ago". Thousands separators. Percentages to one decimal place. A colon means clock time only. Counts must reconcile across a page: the hero, a tile and a list never disagree about the same thing. Legal forms are named by their Mental Health Act 2014 form name and period, not a section number, unless the section has been verified. Where the app does not check a legal limit it says "Legal limits not checked here".
- **Age.** Every confirmed figure shows its age ("15m since confirmed"). Past its threshold it takes the amber circle and names the action.

## 10. Components

`src/components/wf` is the one library. The v8 contracts (v8 section 8) carry over. v9 changes:

| Class                                                    | Component                                           | v9                                                                                    |
| -------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `.b`                                                     | `Button`                                            | Hover and press by colour steps. Press scale 0.97. Busy via `aria-busy`               |
| `.pt`, `.pt.slide`                                       | `Tabs`, `Segmented`                                 | 30px items, 28 small. The sliding capsule moves under the selected item               |
| `.hs`, `.hs.pill`                                        | `HeroStat`                                          | A compact chip: figure at 15 mono, 12px glyph, label. Flat reports, raised presses    |
| `.st`                                                    | `Stat`                                              | Figure at 15 mono                                                                     |
| `.k`, `.tier`                                            | `Count`, `TierTile`                                 | Mono. T1 stays neutral (ruling, 10 Oct)                                               |
| `.row`, `.li`                                            | Rows                                                | Height from density. `.ra` row action. `.enter` and `.leave` motion. Inset focus ring |
| `.card.click`                                            | `Card`                                              | Hover steps the edge and shadow                                                       |
| `.cols`, `.card-scroll`                                  | `Columns` (new)                                     | Flush equal columns, `.follow` scrolls inside                                         |
| `.glass.bar`, `.glass.sheet`                             | Bars, `Sheet`, `Drawer`                             | Glass tiers by role                                                                   |
| `.drawer`, `.sheet-phone`, `.menu`, `.pop`, `.toast`     | Overlays                                            | `.enter` and `.leave` motion. The toast has a dark fill and an Undo button            |
| `.pulse.tick`                                            | `LiveChip`                                          | Pulses once per refresh                                                               |
| `.chg`, `.bump`                                          | `LiveValue` (new)                                   | Marks a changed figure and pops its glyph                                             |
| `.skip`                                                  | `SkipLink` (new)                                    | Goes to the page's focal part                                                         |
| `.hp-note`, `.fc[aria-pressed]`                          | `HighlightPills` (new)                              | Count first, dims the rest, says "all rows stay"                                      |
| `.gates`, `.gate`, `.pips`                               | `GateStrip`, `Pips` (new)                           | Verdict, pips, one cell per gate with its owner. First open gate holds the primary    |
| `.steps`, `.frac`, `.people`                             | `Steps`, `Frac`, people pips (new)                  | Legs of a trip, done of more than five, one pip per person                            |
| `.tax`                                                   | `TimeAxis` (new)                                    | Piecewise stops, hatched compressed tail, shape marks as buttons                      |
| `.wm`                                                    | `WaitMeter` (new)                                   | Fixed 24h with an 8h tick, quiet time hatched                                         |
| `.age`, `.lv.held`, `.lv.frozen`                         | `Age`, `LiveChip` (new states)                      | Record age, stale words, Held and Frozen                                              |
| `.hj`, `.hero-drawer`, `.hero-checks`                    | `HeroJump`, `HeroStat expanded`, `HeroChecks` (new) | Hero jumps, the strip under the hero, the Checking foot                               |
| `.bs`                                                    | `BedStrip` (new)                                    | One cell per bed with named states, `aria-label` spells out the counts                |
| `.ready`, `.ready-row`, `.lockline`                      | `ReadyList`, locked primary (new)                   | What is left, and why the primary waits                                               |
| `.ps`                                                    | `PressureStrip` (new)                               | Flush peers. Select mode, or navigate with `aria-current`                             |
| `.rule`, `.range`                                        | `RuleRow` (new)                                     | Value, live effect, pages that read it, saved point, Back to saved                    |
| `.triage`                                                | `TriageColumns` (new)                               | Act now, Later today, Done. Ticked work moves across                                  |
| `.ladder`                                                | `Ladder` (new)                                      | Who to call next and when                                                             |
| `.bl`                                                    | `BarList` with `onPick`                             | Bars as highlight buttons with one `RefLine`                                          |
| `.hrun`                                                  | `TimeRail` hero (new)                               | The shift on the hero: passed fill, dashed window, Now, marks as buttons              |
| `.crail`                                                 | `TimeRail` card (new)                               | Expiries from Now in two label lanes, clusters as +n, a Passed bay                    |
| `.dayb`                                                  | `TimeRail` day (new)                                | 24h per contact with Now, words say until when and who next                           |
| `.gantt`, `.scrub`                                       | `Gantt`, `Scrubber` (new)                           | Ward rows of arrival capsules, a slid time recounts free beds                         |
| `.spread`, `.lanes`                                      | `TimeLanes` (new)                                   | One lane per owner or event kind, shape marks stack, tail folded past 24h             |
| `.ftiles`                                                | `FilterTile` (new)                                  | Ring, beds, over-threshold count and four figures. Pressing highlights the table      |
| `.caprows`                                               | `CapacityBarRow` (new)                              | Stacked bed states with a movable dashed alert line. Rows are buttons                 |
| `.pinc`                                                  | `PinCompare` (new)                                  | Up to three wards against the network. Worse takes the amber circle                   |
| `.fc48`                                                  | `RangeColumns` (new)                                | Now solid, estimates with a range whisker and an estimate caption                     |
| `.gaps`                                                  | `GapTiles` (new)                                    | Need, verdict, signed gap, fit against waiting. A real table                          |
| `.thbar`                                                 | `ThresholdBar` (new)                                | Two settings as one bar, boundaries follow the steppers                               |
| `.gm`                                                    | `Frac` matrix (new)                                 | Sites by requirement in fraction pills. Press a site to scope the summary             |
| `.chart-grid`, `.chart-now`, `.chart-ref`, `.chart-tick` | Chart primitives                                    | Faint gridline, Now line, the one dashed reference, edge-aware ticks                  |

Still to build as shared parts, each when its page is next touched (owner, 10 Oct): `ViewSwitch`, `WardCapacityRow`, `GroupHead`, `NeedsYou`, `KeyHints`, `RecordCard` and `RailSummary`. The live board for the new parts and the charts is the board's Parts tab.

**State matrix.** Every interactive component documents, on the board, how it looks in each of: default, hover, pressed, focus, selected, disabled, busy, error, empty and stale, in day and night. The board's Controls tab shows the matrix for buttons, tabs, chips, rows and bed tiles.

## 11. Legacy names and gates

Unchanged from v8 sections 9 and 10: legacy names alias `--wf-` roles and hold no values, and six per-file ratchets are meant to run in `npm test`. On main today only the ward-wide aggregate ratchet runs. The per-file drift script, its baseline, the token cycle, shadow and night parity gates and the wf contract tests were built for v8 on the 9 Oct branch and arrive, retargeted to v9 values, with the v9 app PR. v9 adds these deprecated aliases, to be removed when nothing reads them: `--wf-fs-16` (to 15), `--wf-m-fast`, `--wf-m-base`, `--wf-m-slow`, `--wf-ease` (to the v9 motion tokens), and `--wf-glass-thin`, `--wf-glass`, `--wf-glass-thick` (to the bar, popover and sheet tiers). `.glass.thin` and `.glass.thick` still work as `.glass.bar` and `.glass.sheet`.

## 12. Elevate parts

Adopted 10 Oct. They live in the sheet and on the board, and reach `src/components/wf` when a page first needs them.

| Part              | Class       | Use                                             | Rule                                                                                                                                                                 |
| ----------------- | ----------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quiet units       | `.qu`       | Units beside a figure                           | Units at 0.8em in ink-3, so "11h 20m" reads as figures first                                                                                                         |
| Mixed-face answer | `.ans`      | A title that carries a figure                   | The words in Geist, the figure in mono with tabular digits                                                                                                           |
| Fading hairline   | `.fade-hr`  | A soft break inside a card or panel             | A hairline that fades out at both ends                                                                                                                               |
| `PressureArc`     | `.parc`     | One occupancy gauge in a hero                   | The arc stays neutral. The glyph and word carry the tone. A dashed line marks the alert point                                                                        |
| Figure roll       | `.roll`     | A figure that changes                           | Only the changed digits move, 220ms, no overshoot. A fade under reduced motion                                                                                       |
| `AllClear`        | `.allclear` | A page or area with nothing to act on           | A clear state still says what is next, with a next-three rail (`.nextrail`)                                                                                          |
| `BedPlan`         | `.bplan`    | A ward as pods and a corridor, one cell per bed | Pick up to place. Picking someone lifts the chip onto glass and dims beds that do not fit by sex, security or closed state. Enter picks and places from the keyboard |
| `RowSpark`        | `.spk`      | A trend inside a row                            | Sits beside the row's figure and never replaces it                                                                                                                   |
| Delta twins       | `.dtw`      | Change since last time                          | Two tiny bars, before and now, instead of an arrow                                                                                                                   |
| `JourneyRibbon`   | `.jrib`     | A person's stages so far                        | Stages sized by real duration. Quiet time hatched. The current stage is a capsule                                                                                    |
| `SinceYouLooked`  | `.digest`   | The shift change digest                         | What changed since you last looked. Copy as handover text is its one primary                                                                                         |
| Command palette   | `.pal`      | Ctrl K from anywhere                            | Verbs as well as places. The glass popover tier. Each line shows its shortcut                                                                                        |
| Undo hairline     | `.toast.ud` | A toast with Undo                               | A 2px line shrinks over the Undo window. Under reduced motion the line hides and the time is in words                                                                |

## 13. Modes and parked parts

- **Glare mode** is adopted. `data-mode="glare"` on the root, for ward PCs near windows. Surfaces go solid, with no glass or blur. Lines go darker, text goes one weight heavier and glyphs go to 12px.
- **Night shift mode** is planned, after a contrast check.
- **Wall mode** is parked until there is a bed meeting screen.
- **Parked, not in the sheet:** FlowMap, DeparturesBoard, the hero that folds into the bar, and presence on a record, which needs shared state first.

## 14. Owner rulings in force

- 12px floor, no uppercase exception (O-15.1).
- Colour lives in glyphs and the hero. Red means act now. Act now items take a thin edge, never a fill (9 Oct).
- Compact sizing and smaller text (9 Oct).
- Phone is its own design (9 Oct).
- Every page has a focal part, a part of its own and a page-specific hero (9 Oct).
- Glass about 80% opaque with the sheen kept (10 Oct).
- Figures stay in mono with tabular digits. Chart axes in Geist (10 Oct).
- Default rows 44, with dense 36 and touch 52 (10 Oct).
- T1 pill neutral (10 Oct).
- Delays filters hide rows (owner ruling, kept now highlight is the default elsewhere).
- From the 10 Oct page review, decided: a faint overdue zone on time axes only, highlight by default on queues, strip figures at 15 with 20 only in one focal strip per page, 8px people pips, and the shared parts in section 10 built when each page is next touched.
- Elevate adopted (10 Oct): one action blue, the lit hero, glass you can see by day, closed in slate, the parts in section 12, Glare mode, and the fixes in sections 3 to 9.
- Tier time thresholds remain synthetic and need clinical sign-off.

## 15. Next steps

1. **Load v9 in the app** through one alias file after `globals.css`, and wire the one theme switch (v8 section 4).
2. **Move the shared parts** onto it so every page lifts at once: hero chip, Badge, status words, tabs with the capsule, focus, live chip, toast and density.
3. **Point the in-app Design showcase at the sheet**, so it can no longer teach v6.
4. **Rebuild pages against v9**, weakest first, as the 10 October appraisal set out. Bring in each Elevate part with the first page that needs it.
5. **Check Night shift mode for contrast** before it is built.

## 16. Verified and not verified

- **Verified.** The board renders from this sheet in Chromium (Playwright) in day and night, desktop and phone, with no script errors and no sideways scroll. Every `var(--wf-*)` the sheet reads is defined. Contrast figures for the new values come from the token values.
- **Not verified.** The app does not load v9 yet. High contrast and print were checked by reading the rules, not on a ward PC or a printer. Backdrop blur performance on ward PCs is unmeasured. Edge support for `light-dark()` on WA Health desktops is unconfirmed. Glare mode has not been tried on a ward PC near a window.

## Appendix: where the v8.2 rules went

| v8.2 rule                          | v9                             |
| ---------------------------------- | ------------------------------ |
| 1 Calm and dense                   | Principle 2, section 5         |
| 2 Every surface has an edge        | Section 3                      |
| 3 Glass for chrome, plus one panel | Principle 5, section 3         |
| 4 One hero band                    | Section 7                      |
| 5 One primary per area             | Section 9                      |
| 6 Colour lives in glyphs           | Principle 3, section 3         |
| 7 Shape carries status             | Principle 4, section 5         |
| 8 Signal, not explanation          | Section 1 voice                |
| 9 Live and honest                  | Principle 6, section 9         |
| 10 Labels never wrap               | Section 8 truncation           |
| 11 Colons mean clock time          | Section 9 content              |
| 12 Red means act now               | Principle 3                    |
| 13 Shape tells you what it does    | Principle 4                    |
| 14 Mono is for figures             | Section 4, kept                |
| 15 Dashed means unavailable        | Principle 4, section 9 states  |
| 16 Twelve is the floor             | Section 4                      |
| 17 Focal element                   | Principle 1                    |
| 18 Counts sit in hero chips        | Section 10 `.hs`               |
| 19 A part of its own               | Section 7 hero                 |
| 20 Phone is its own design         | Section 7 phone                |
| 21 Every never needs a do          | How the principles are written |
