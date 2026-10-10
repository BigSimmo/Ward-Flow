# Ward Flow design system v9

Synthetic prototype, not a medical device. The values live only in [`ward-flow-v9.css`](ward-flow-v9.css). [`ward-flow-design-system-v9.html`](ward-flow-design-system-v9.html) is the live board, drawn by that same sheet in day and night, desktop and phone.

**Status.** This is the standard. v9 replaces v8 to v8.2 as one document, so nobody has to apply a chain of amendments. v8 (`../v8/`) and v7 (`../v7/`) stay unchanged for provenance. The app does not load this sheet yet. Loading it, and moving the shared parts onto it, is the next step (section 13).

**Why v9.** On 10 October 2026 Josh asked for the design system to be perfected. The review (artifact `66mvgLJYqmC6WqVGHNKftt`, source `design/appraisal-10oct/design-system-v9-proposal.html` in the project files) found 45 issues: the spec read as a changelog, the sheet contradicted its own rules, glass was heavy, motion barely existed, and layout and content had no rules. Josh approved every recommendation at 00:39Z, with one change: glass stays largely opaque, at about 80%.

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

One switch, carried from v8. Every colour token is `light-dark(day, night)`, resolved by `color-scheme`. `data-theme` on `<html>`, the OS setting, `.day` and `.night` subtrees and print all work through it, so no theme block can miss a token. The app wiring steps are unchanged from v8 section 4. `light-dark()` needs Edge 123 or later; the managed Edge version on WA Health desktops is still unchecked.

## 3. Colour and materials

**Surfaces.** Canvas, surface, surface-2, track, hover and selected carry over from v8. v9 adds two steps that rise:

| Token          | Day       | Night     | Use                                               |
| -------------- | --------- | --------- | ------------------------------------------------- |
| `--wf-raised`  | `#ffffff` | `#1b2733` | Menus, popovers, the selected tab, glass fallback |
| `--wf-overlay` | `#ffffff` | `#202d3a` | Sheets and dialogs                                |

At night a surface gets lighter as it rises, because shadows do not show on a dark canvas.

**Tone.** Glyphs, edges and marks take the tone (`--wf-danger` and so on). Words that stand alone, such as an error message, take the `-ink` partner. Cards, rows and tiles take no tinted fill, except a free or fit place, which keeps its soft fit tint. An act now item takes a thin 1px edge in `--wf-act-edge` through `.edge-act`, never a fill. On the hero, glyphs take the on-hero tones.

**Accent states.** `--wf-accent-hover`, `--wf-accent-press` and the primary gradient's `-hover` and `-press` stops. No control uses `filter`, which softened text and made a stacking context.

**Light parts on the hero.** `--wf-light-1` and `-2` are themed in v9: white by day, `#e9eef3` and `#d6dfe8` at night, so the light button and a pressed chip stop glaring on a night screen.

**Glass.** About 80% opaque by owner choice: frosted and calm rather than see-through. Three tiers by role, one hairline, one 1px top highlight, one soft shadow. The v8 sheen and masked rim are gone. Saturate stays at 1.4, so red edges and service dots keep their colour as they pass beneath.

| Class          | Fill | Blur | Use                                                                         |
| -------------- | ---- | ---- | --------------------------------------------------------------------------- |
| `.glass.bar`   | 78%  | 20px | Top bars and toolbars                                                       |
| `.glass`       | 82%  | 24px | Menus, popovers, the palette and the one glass panel allowed in a page body |
| `.glass.sheet` | 86%  | 32px | Sheets, drawers and dialogs                                                 |

Only `ink-1` and `ink-2` sit on glass. Measured on the worst backdrop (dark ink passing under day glass, light text under night glass), `ink-2` holds 4.6:1 or better on every tier. Phone bars stay solid. Reduced transparency, increased contrast and a browser with no `backdrop-filter` all fall back to `--wf-raised`.

**Canvas.** The soft glow sits behind the top 400px only, where the hero and bars are, so tables below sit on one even canvas.

**Service colours.** An 8px dot beside the service name, never on its own and never as a fill or stripe.

**Data.** The v8 ramp carries over. The third series step also takes a hatch (`.chart-s3`), so series never differ by shade alone, and every series has a direct label.

## 4. Type

Five sizes on a page. The 12px floor holds with no uppercase exception.

| Size | Line | Weight | Tracking | Use                                                  |
| ---- | ---- | ------ | -------- | ---------------------------------------------------- |
| 20   | 26   | 600    | -1.5%    | Hero and page titles                                 |
| 15   | 20   | 600    | -1%      | Figures: hero chips, key values, the side panel name |
| 14   | 20   | 600    | 0        | Section and card titles                              |
| 13   | 18   | 400    | 0        | Body                                                 |
| 12   | 16   | 500    | 0        | Meta, labels, counts. Uppercase eyebrows at 600, +6% |

28 is for sign-in and print only. 16 is retired; `--wf-fs-16` aliases 15 until nothing reads it. Nothing on a page is larger than 20, except inside a chart.

**Figures.** Quantities (counts, percentages, durations) use Geist with tabular figures (`.num`), so columns still line up without the wide gaps mono leaves around a decimal point. Mono is for clock times, UMRNs and ids (`.clk`, `.id`, `.bd.id`, bed numbers).

## 5. Space, shape and size

**Space.** 4, 8, 12 and 16 between parts. Inside a control insets may step by 2. 24 (`--wf-s-6`) separates page sections and 32 (`--wf-s-8`) is the wide page gutter. Those two are for layout only.

**Radius.** 6, 10, 12, 16 and 22, and pills. Corners are concentric: an inner radius is the outer radius less the inset, rounded to the scale. A 16px card with an 8px inset holds 8 to 10px parts. No square corners.

**Targets.** At least 28px for anything a pointer clicks on desktop (`--wf-target`). 24px only inline in running text. 44px on phone and touch.

**Density.** One setting in Settings, set as `data-density` on the shell. Every row reads `--wf-row`.

| Density | Row  | Use                                              |
| ------- | ---- | ------------------------------------------------ |
| `dense` | 36px | Long lists on a large screen                     |
| default | 44px | Everything else                                  |
| `touch` | 52px | Ward touchscreens. Coarse pointers default to it |

**Glyphs.** 10px beside text, 12px in hero chips. The triangle is drawn about 10% wider so it weighs the same as the circle. Shapes are unchanged: triangle act now, filled circle at risk, tick done, capsule moving, ring waiting, cross closed, dash not active.

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

- **Reactions.** Buttons, chips, tabs, rows and bed tiles all react within 100ms. Hover changes the edge, fill or shadow, never the position. Press compresses.
- **Continuity.** Selection moves rather than jumps. Pill tabs use the sliding capsule (`.pt.slide .cap`). A pressed hero chip crossfades. The side panel swaps content with a short crossfade (`.sp-swap`), never a flash.
- **Live without noise.** The live dot is still and pulses once when data arrives (`.pulse.tick`). A changed figure carries `.chg` for 1.4s. New rows rise in (`.enter`), removed rows fade and collapse (`.leave`), and nothing moves under a pointer that is hovering.
- **Busy.** After 300ms with no answer a button shows a spinner in place (`aria-busy="true"`). It keeps its width and its focus. Skeletons crossfade to content (`.loaded`).
- **Never.** No `animation-fill-mode` of `forwards` or `both` on an entry or on any ancestor of glass: it stops the blur (found in PR #204). `forwards` is allowed only on an exit that ends with the element removed. No animated layout on a table of more than 50 rows.
- **Reduced motion** keeps every state change and its feedback, swaps movement for a 120ms fade, and never sets 0ms, because `transitionend` and `animationend` do not fire at zero.

## 7. Layout

- **Grid.** 12 columns on desktop with 16px gutters (`.grid12`, `.span-*`). Page sections sit 24px apart (`.page`).
- **Main and rail.** `.layout-core` with the standard panel, or `.r21` and `.r31` for 2:1 and 3:1. The rail is sticky and live.
- **Equal columns.** Side by side cards are flush and the same height (`.cols`). The `.lead` card sets the height. A `.follow` card takes it and scrolls inside its `.card-scroll`, so a long column never ends below its neighbour and a short one never leaves a gap.
- **Tables.** Tables grow with the page and never sit in a fixed-height box. Only the head row sticks (`.thead`).
- **Hero.** One per page, full width, 20px inset, 22px radius. Facts and one primary on the left, page-specific actions on the right, hero chips below the title, the page's own part (such as the shift timeline) under them.
- **Reflow.** A 1280px desktop at 200% zoom is 640px wide. At 48rem every layout collapses to one column without losing an action (WCAG 1.4.10).
- **Phone** is its own design at 390 by 844, never a reflow of desktop and never a change to it. A priority list, cards with their one action, bottom sheets, a sticky bottom bar and a segmented control. Names 14, meta 12, rows tap as a whole, row actions at least 36px and the bottom bar 44px.

## 8. Accessibility

- **Focus.** A 2px ring with a 2px gap, so it never touches a red edge, a tint or a selection. Parts whose ring sits inside (tabs, menu items, rows, `.ring-in`) draw the gap inside too. On the hero the ring is light. In forced colours the ring is `Highlight`.
- **Contrast.** Measured on composited values with the WCAG 2.2 formula. v8 section 6 figures carry over. New in v9: `ink-2` on the worst glass backdrop 4.6:1 (bar, night) or better. Pressed tones on the night light chip 3.5:1 or better. White on the night primary hover 4.8:1. Meta on night raised 5.9:1.
- **Live updates.** One polite live region per page, batched once a minute, announcing only act now changes, such as "2 new act now". Never a running tally.
- **Keyboard.** Arrow keys (and J and K) move through rows and tiles, Enter opens, Escape closes the top layer only and returns focus to what opened it. Timeline marks are reachable by arrow keys. Each page has a skip link (`.skip`) to its focal part. One item in every tab list holds the tab stop.
- **Truncation.** Truncated text shows in full on focus as well as hover, and stays in the accessible name.
- **Anything revealed on hover** (row actions `.ra`, timeline links) is also revealed on focus and selection, and always shows on touch.
- **Preferences.** Reduced motion, reduced transparency, increased contrast, forced colours and print are all handled in the sheet.

## 9. Patterns

- **Actions.** The page owns its top bar action. The hero holds facts and one primary. A row has one quiet action that appears on hover, focus or selection. One primary per area.
- **Feedback.** An action changes state at once, then a toast reports it with Undo when the step can be undone. A confirm sheet is only for steps that cannot be undone.
- **States.** Every component uses one wording and look for each state:

| State        | Look                                       | Words                           |
| ------------ | ------------------------------------------ | ------------------------------- |
| Empty        | One 48px line, ink-3                       | What is clear: "No one waiting" |
| Loading      | Skeleton, crossfades to content            | None                            |
| Stale        | Warning edge on the live chip, age shown   | "Updated 12m ago"               |
| Offline      | Danger edge on the live chip               | "Offline. Showing 10:42"        |
| Error        | `-ink` words with the glyph, and a retry   | What failed and what to do      |
| Zero         | The figure 0                               | 0, never blank                  |
| Not recorded | Dashed ring glyph, ink-3                   | "Not recorded"                  |
| Unavailable  | Dashed edge, `aria-disabled` with a reason | The reason, in a tip            |

- **Filters.** At most three visible, the rest in a More menu. A filter either hides or highlights, and the control says which.
- **Counts.** Each figure has one source. "N of M" only when N rows are shown, otherwise "Top 10 of 70". Hero chips, tab counts and list lengths agree.
- **Content.** Dates as "Fri 9 Oct". 24 hour time. Durations as 45m, 3h 20m, 2d 4h, from one formatter, with no seconds. Thousands separators. Percentages to one decimal place.

## 10. Components

`src/components/wf` is the one library. The v8 contracts (v8 section 8) carry over. v9 changes:

| Class                                                | Component               | v9                                                                                    |
| ---------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------- |
| `.b`                                                 | `Button`                | Hover and press by colour steps. Press scale 0.97. Busy via `aria-busy`               |
| `.pt`, `.pt.slide`                                   | `Tabs`, `Segmented`     | 30px items, 28 small. The sliding capsule moves under the selected item               |
| `.hs`, `.hs.pill`                                    | `HeroStat`              | A compact chip: figure at 15 tabular, 12px glyph, label. Flat reports, raised presses |
| `.st`                                                | `Stat`                  | Figure at 15 tabular                                                                  |
| `.k`, `.tier`                                        | `Count`, `TierTile`     | Tabular Geist. T1 stays neutral (ruling, 10 Oct)                                      |
| `.row`, `.li`                                        | Rows                    | Height from density. `.ra` row action. `.enter` and `.leave` motion. Inset focus ring |
| `.card.click`                                        | `Card`                  | Hover steps the edge and shadow                                                       |
| `.cols`, `.card-scroll`                              | `Columns` (new)         | Flush equal columns, `.follow` scrolls inside                                         |
| `.glass.bar`, `.glass.sheet`                         | Bars, `Sheet`, `Drawer` | Glass tiers by role                                                                   |
| `.drawer`, `.sheet-phone`, `.menu`, `.pop`, `.toast` | Overlays                | `.enter` and `.leave` motion. The toast has a dark fill and an Undo button            |
| `.pulse.tick`                                        | `LiveChip`              | Pulses once per refresh                                                               |
| `.chg`, `.bump`                                      | `LiveValue` (new)       | Marks a changed figure and pops its glyph                                             |
| `.skip`                                              | `SkipLink` (new)        | Goes to the page's focal part                                                         |

**State matrix.** Every interactive component documents, on the board, how it looks in each of: default, hover, pressed, focus, selected, disabled, busy, error, empty and stale, in day and night. The board's Controls tab shows the matrix for buttons, tabs, chips, rows and bed tiles.

## 11. Legacy names and gates

Unchanged from v8 sections 9 and 10: legacy names alias `--wf-` roles and hold no values, and six per-file ratchets run in `npm test`. v9 adds these deprecated aliases, to be removed when nothing reads them: `--wf-fs-16` (to 15), `--wf-m-fast`, `--wf-m-base`, `--wf-m-slow`, `--wf-ease` (to the v9 motion tokens), and `--wf-glass-thin`, `--wf-glass`, `--wf-glass-thick` (to the bar, popover and sheet tiers). `.glass.thin` and `.glass.thick` still work as `.glass.bar` and `.glass.sheet`.

## 12. Owner rulings in force

- 12px floor, no uppercase exception (O-15.1).
- Colour lives in glyphs and the hero. Red means act now. Act now items take a thin edge, never a fill (9 Oct).
- Compact sizing and smaller text (9 Oct).
- Phone is its own design (9 Oct).
- Every page has a focal part, a part of its own and a page-specific hero (9 Oct).
- Glass about 80% opaque (10 Oct).
- Figures in tabular Geist, mono for clock times and ids (10 Oct).
- Default rows 44, with dense 36 and touch 52 (10 Oct).
- T1 pill neutral (10 Oct).
- Tier time thresholds remain synthetic and need clinical sign-off.

## 13. Next steps

1. **Load v9 in the app** through one alias file after `globals.css`, and wire the one theme switch (v8 section 4).
2. **Move the shared parts** onto it so every page lifts at once: hero chip, Badge, status words, tabs with the capsule, focus, live chip, toast and density.
3. **Point the in-app Design showcase at the sheet**, so it can no longer teach v6.
4. **Rebuild pages against v9**, weakest first, as the 10 October appraisal set out.

## 14. Verified and not verified

- **Verified.** The board renders from this sheet in Chromium (Playwright) in day and night, desktop and phone, with no script errors and no sideways scroll. Every `var(--wf-*)` the sheet reads is defined. Contrast figures for the new values come from the token values.
- **Not verified.** The app does not load v9 yet. High contrast and print were checked by reading the rules, not on a ward PC or a printer. Backdrop blur performance on ward PCs is unmeasured. Edge support for `light-dark()` on WA Health desktops is unconfirmed.

## Appendix: where the v8.2 rules went

| v8.2 rule                          | v9                                          |
| ---------------------------------- | ------------------------------------------- |
| 1 Calm and dense                   | Principle 2, section 5                      |
| 2 Every surface has an edge        | Section 3                                   |
| 3 Glass for chrome, plus one panel | Principle 5, section 3                      |
| 4 One hero band                    | Section 7                                   |
| 5 One primary per area             | Section 9                                   |
| 6 Colour lives in glyphs           | Principle 3, section 3                      |
| 7 Shape carries status             | Principle 4, section 5                      |
| 8 Signal, not explanation          | Section 1 voice                             |
| 9 Live and honest                  | Principle 6, section 9                      |
| 10 Labels never wrap               | Section 8 truncation                        |
| 11 Colons mean clock time          | Section 9 content                           |
| 12 Red means act now               | Principle 3                                 |
| 13 Shape tells you what it does    | Principle 4                                 |
| 14 Mono is for figures             | Section 4, now tabular Geist for quantities |
| 15 Dashed means unavailable        | Principle 4, section 9 states               |
| 16 Twelve is the floor             | Section 4                                   |
| 17 Focal element                   | Principle 1                                 |
| 18 Counts sit in hero chips        | Section 10 `.hs`                            |
| 19 A part of its own               | Section 7 hero                              |
| 20 Phone is its own design         | Section 7 phone                             |
| 21 Every never needs a do          | How the principles are written              |
