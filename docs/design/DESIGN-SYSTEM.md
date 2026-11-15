# Ward Flow design system

_Updated 2026-11-13 - shared design parts from D-192 (neutral service tags, count windows, Undo, synthetic mark, button reasons, fields and choice rows); Documentation owns._

The one design standard for every Ward Flow screen, mock-up and build, written on 2 Nov 2026 from everything the screen builds and reviews taught us. It is drawn from the [master design](https://claude.ai/artifact/91BETDiimnJVbyeCb2sxcK), not from the running app on `main`. The master also shows this page as its **Design system** tab.

Ward Flow is a prototype that uses synthetic data only. Nothing here is validated clinical decision support.

**What wins.** This page is the design system of record (Q327). [AGENTS.md](../../AGENTS.md) and Josh's rulings, then the master design's newest screens, then this page, then [design-system-v9.md](../../design/v9/design-system-v9.md) (kept as background). Where a merged page deliberately differs from its mock-up, follow what shipped. Values live in [`src/app/ward-flow-v9-tokens.css`](../../src/app/ward-flow-v9-tokens.css); this page names roles, never new values.

**Token files.** `src/app/ward-flow-v9-tokens.css` is the only place token values are set. Three older files still load and must not gain new tokens (Q375):

- `src/app/ckb-v2-tokens.css`: the v2 layer inherited from PsychSift, still read by older screens.
- `src/app/ward-flow-shell-tokens.module.css`: the third-edition layer, composed by older screen styles as `wardShellTokens`.
- `src/app/globals.css`: Tailwind set-up and compatibility values.

Screens move to `--wf-*` as they are rebuilt, and each old file is deleted once nothing reads it.

**How to run a design task.** Every design task follows the [design review prompt](design-review-artifact-prompt.md), the standing rule (Josh, 9 Nov 2026, D-107).

The lessons behind each rule are in [lessons/2026-11-02-design-lessons.md](lessons/2026-11-02-design-lessons.md).

## 1. Principles

1. **Answer first.** Each page answers one question in five seconds. The answer is the hero title ("Short 26 beds", "2 need you now") and the focal part sits in the first screen.
2. **Calm and dense.** A 4px rhythm, a compact type scale, flush columns, no empty rails.
3. **Colour means state.** Tone lives in glyphs, small tags and the hero. Red means act now and nothing else. Words stay neutral ink.
4. **No coloured side edges.** No stripe, inset bar or tone-coloured border on any row, card, tile or stat box (Josh, 31 Oct: "it feels tacky").
5. **One system, many pages.** Every page shares the shell, tokens and kit. Each page may then take one signature idea of its own inside the [variation zone](#8-the-variation-zone).
6. **Short, warm words.** Labels of one to three words. Plain Australian English. Sentence case.
7. **Honest and live.** Values show their age, counts agree everywhere, nothing claims more than it shows.
8. **Everyone can use it.** Keyboard first, a visible ring, text that grows to 200% without cutting, and motion that follows the user's settings.
9. **Headers show the live scope.** A page header says what the page is filtered to right now (Josh's standing design rule, carried in the [design review prompt](design-review-artifact-prompt.md) that D-107 item 3 adopts).
10. **Mock-ups are real pages.** Full-page and high-fidelity, built in the real app and screenshotted before and after. Never board or canvas layouts. Components look refined, not cartoonish (same source as principle 9).
11. **No clinical choice pre-selected.** A clinical choice (ward, legal status, day) starts empty so a person makes it on purpose (Josh, 31 Oct 2026). Tabs, filters, sort order and view switches may keep a default.

## 2. Tokens

Use tokens only. A raw hex value, pixel size or radius in a screen is a defect. Click a token in the master's Tokens tab to copy it.

### Colour roles

| Role                | Tokens                                                                                                                   | Use                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Ground and surfaces | `--wf-canvas`, `--wf-surface`, `--wf-surface-2`, `--wf-raised`, `--wf-overlay`, `--wf-track`                             | Canvas behind the sheet; solid surfaces carry data.                                         |
| States of a surface | `--wf-hover`, `--wf-selected`, `--wf-e-sel`                                                                              | A selected item takes the selected tint with a neutral border, never a coloured edge.       |
| Lines               | `--wf-line`, `--wf-line-2`, `--wf-line-3`, `--wf-line-ctl`                                                               | Hairlines, dividers and control outlines.                                                   |
| Ink                 | `--wf-ink-1`, `--wf-ink-2`, `--wf-ink-3`, `--wf-ink-off`, `--wf-dim`                                                     | Text. "Not recorded" is ink-3.                                                              |
| Action blue         | `--wf-accent` (+ `-strong`, `-tint`, `-ink`, `-hover`, `-press`), `--wf-pri-1`, `--wf-pri-2` (+ hover, press)            | One action blue. Filled buttons, links, the focus ring, today, Now.                         |
| Hero                | `--wf-hero-1`, `--wf-hero-2`, `--wf-hero-glow`, `--wf-hero-ink` (2, 3), `--wf-on-hero-*`                                 | The lit slate band only.                                                                    |
| Tones               | `--wf-danger`, `--wf-warning`, `--wf-success`, `--wf-info`, `--wf-neutral` and their `-ink`; `--wf-hero-*` tones on hero | Glyphs and tags. Danger is act now.                                                         |
| Tints               | `--wf-act-tint`, `--wf-hold-tint`, `--wf-fit-tint` (`--wf-hold-edge`, `--wf-fit-edge` for glyph rings only)              | Row and tag backgrounds for act now, held and fits. The edge tokens never draw a side edge. |
| Data                | `--wf-data-1` to `--wf-data-3`, `--wf-data-ready`, `--wf-data-closed`, `--wf-data-rest`, `--wf-hatch`, `--wf-now`        | Charts, bed squares, heat maps. The hatch means "may move" everywhere.                      |
| Health services     | `--wf-svc-north`, `-south`, `-east`, `-wachs`, `-cahs`, `-private`, `-statewide`                                         | Neutral since D-192: no brand colours. A service is its short name in a plain Badge.        |
| Materials           | `--wf-glass-bar`, `--wf-glass-pop`, `--wf-glass-sheet`, `--wf-sheen`, `--wf-scrim`, `--wf-scrim-strong`                  | Glass about 80% opaque, with the sheen, for chrome and overlays. Never glass on data.       |
| Elevation           | `--wf-e1`, `--wf-e2`, `--wf-e3`, `--wf-e-bar`                                                                            | One raise per role. Cards that are not separate objects take no shadow.                     |

Dark mode and the Bright light setting come from the same tokens. Check every screen in both light and dark. In dark, a red badge on the phone bar needs the deeper red fill to pass 4.5:1 (Q302).

### Type

- Faces: `--wf-font` (Geist) for words and chart axes; `--wf-mono` (Geist Mono, tabular digits) for figures, times and counts.
- Scale: 12, 13, 14, 15, 16, 20 and 28px (`--wf-fs-*` with `--wf-lh-*`). **12px is the floor**, with no exception for capitals, column heads, chart labels or `<small>`.
- Strip figures are 15px. 20px figures appear in one focal strip per page only. The kit hero title is 20px (`--wf-fs-20`); 28px is for a page's one display figure, such as the TV and Statistics heroes.
- Tracking: `--wf-tr-20`, `--wf-tr-15`, `--wf-tr-caps` for the few capital labels.

### Space, shape and size

- Space: `--wf-s-1` 4, `--wf-s-2` 8, `--wf-s-3` 12, `--wf-s-4` 16, `--wf-s-6` 24, `--wf-s-8` 32. Page sections sit 24px apart. Grid gutters are 16px.
- Radius: `--wf-r-xs` 6 to `--wf-r-xl` 22, `--wf-r-pill`, `--wf-r-ctl`, `--wf-r-track`, `--wf-r-tag`. The hero takes `--wf-r-xl`.
- Rows: 44px default (`--wf-row-default`), 36px dense, 52px touch, 40px group heads.
- Controls, by device:

| Control                | Phone                                                                                                                                                       | Tablet and desktop                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Button                 | 40px drawn, 48px tap cover                                                                                                                                  | 36px (`--wf-h-md`); 28px is the smallest target (`--wf-target`) |
| Small button           | 40px on phone (Q295)                                                                                                                                        | 32px (`--wf-h-sm`)                                              |
| Tabs and segments      | 40px items on a 48px track (Q225, 2 Nov, as built; this replaces D-94's 32px tab in a 40px track, and the kit overrides the older `--wf-phone-seg-*` 32/40) | 30px at 13px (Q231)                                             |
| Chips and filter pills | 40px (`--wf-phone-pill-h`)                                                                                                                                  | 24 to 30px; never a target under 24px (`--wf-target-min`)       |
| Accept, Pull, Decline  | Full 48px (the one exception)                                                                                                                               | Kit size                                                        |
| Controls at 200% text  | Grow with the text: min-height, never a fixed height (Q306)                                                                                                 | Same                                                            |

### Motion

`--wf-t-press` 80ms, `--wf-t-micro` 100ms, `--wf-t-enter` 220ms, `--wf-t-exit` 160ms, `--wf-t-sheet` 340ms, `--wf-t-live` 1400ms, with `--wf-ease-out`, `--wf-ease-in` and `--wf-ease-sheet`. A press answers within 100ms. Reduced motion turns movement into a fade or nothing.

### Focus

A 2px `--wf-focus-ring` with a 2px gap, never clipped, light on the hero. Escape closes the top layer only and returns focus to what opened it.

## 3. Breakpoints and the shell

| Range               | Width                  | Shell                                                                                                                                                                        |
| ------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phone               | up to 743px            | Top bar, phone dock, sheets. Its own design.                                                                                                                                 |
| Short touch screens | under about 500px tall | Treated as phone for control size (Q289). Over 743px wide they keep the full top bar and draw no bottom dock (Josh, 8 Nov 2026). Drawer headers scroll with the body (Q288). |
| Tablet portrait     | 744 to 1000px          | No rail beside the work. iPads at 744 and 768 get this layout (Q292).                                                                                                        |
| Tablet landscape    | 1001 to 1200px         | Icon rail.                                                                                                                                                                   |
| Desktop             | 1201px and up          | Full master sidebar.                                                                                                                                                         |
| Content stack       | below about 900px      | Not a shell change: two crowded side-by-side cards stack (Q291).                                                                                                             |

The queries live in `src/components/wf/use-is-phone.ts`; CSS repeats them as `(max-width: 46.4375rem)` and `(min-width: 46.5rem)`. Use these values for every phone, tablet and desktop switch. A content-fit point (a table's measured width, the 900px stack) is allowed only with a comment saying what it measures. Older `40rem` (640px) phone switches are being moved onto the phone value.

**Check every page at 390, 744, 768, 820, 1180, 1280 and 1440, in light and dark, and at 200% text on phone.** 1180 is the icon rail (tablet landscape).

The shell is the same on every page. Copy it from the master's newest screens (the redesign preview with `?shell=next`), never from a page on `main`.

- **Sidebar.** The master sidebar on every page (#1280). Pinned pages last for the open browser tab only.
- **App bar.** Dark, joined to the band hero. On phone a long page name shrinks with an ellipsis so Search always shows (Q280). No "Synthetic prototype" pill; the footer keeps its synthetic-data notice, and the TV view and printouts keep a small mark.
- **Band hero.** The kit `Hero` with `data-wf-hero="band"`, full width, joined to the bar, with the light sheet below. Phone uses the same Hero. One per page.
- **Phone dock.** Each person keeps their own dock everywhere (Q162). On a page no dock tab owns, the Menu icon lights in accent (Q161). The tab is "Alerts" (Q268). Labels shrink to fit at large text and never split a word (Q307, #1310).
- **Toasts** sit bottom-right of the work area on desktop, 24px in, on the solid overlay surface and never over the row they name; on phone they sit `--wf-toast-dock-gap` above the pinned action bar or the dock. An Undo toast says one clock time ("Undo until 10:47"), no seconds countdown, stays at least 10 seconds, and `RowUndo` keeps Undo on the row for the whole window (D-192).
- **Loading and offline notes** rest at the foot of the window, above the dock, never over the page title (Q276).

## 4. Components (the kit)

Build with `src/components/wf`. Never copy a primitive into a screen, and never write one-off `.tag`, `.chip` or `.pill` CSS. The master's Components tab shows each part in each state.

| Need                  | Use                                      | Rules                                                                                                                                                                                                                                                                                                                                 |
| --------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page header           | `Hero` (band), `CheckingFoot`            | Title is the answer, five words at most. One strip of figures. At most one on-hero button, the next step's light button; page tools sit in one row of quick-link chips under it, which scrolls sideways on a phone (page tops v6, D-116, D-159). Anything past that goes in "…" (Q153). Eyebrow hidden on phone unless it adds facts. |
| Figures               | `Stat` strip                             | Mono, tabular. Keep a strip on one row where it fits; let a title column shrink first (Q290, Q293).                                                                                                                                                                                                                                   |
| A labelled state      | `Badge`, `StatusGlyph`                   | Small tinted tag or glyph. Counts use the count badge.                                                                                                                                                                                                                                                                                |
| A group of content    | `Card`                                   | Only where it is a separate object. Kit card heads keep their title whole (Q237).                                                                                                                                                                                                                                                     |
| Actions               | `Button`                                 | One filled button per row or panel; the rest are quiet. Unavailable for now: `aria-disabled` with `disabledReason`. Never usable by this desk: not shown. Unwired: "Not wired in this prototype."                                                                                                                                     |
| Choosing one of a few | `choice` (segments, radio group)         | Never the browser's own drop-down for a kit choice (Q319).                                                                                                                                                                                                                                                                            |
| Search                | `SearchField`                            | "/" jumps to it where a page has one search.                                                                                                                                                                                                                                                                                          |
| Dates and times       | `DateField` (DD/MM/YYYY), `TimePresets`  | Never the browser's date picker. Never default a written time to now (Q120).                                                                                                                                                                                                                                                          |
| Long lists            | `ShowMoreRow`                            | About eight rows, then "Show 8 more" / "Show fewer". Never a small scrolling box.                                                                                                                                                                                                                                                     |
| Pop-ups and panels    | `Sheet`, `Dialog`, `requestConfirm`      | See section 5. Leaving with unsaved work: "Leave this page?", "Leave without saving", "Keep editing" (focus on Keep editing). Never `confirm`, `alert` or `prompt`.                                                                                                                                                                   |
| Activity lists        | `Feed`, `SinceYouLookedFold`             | One timeline per record.                                                                                                                                                                                                                                                                                                              |
| Charts                | `Chart`                                  | To scale, from existing figures only, data tokens, Geist axes.                                                                                                                                                                                                                                                                        |
| Names                 | `FormalName`                             | Patients surname first as recorded ("Jenkinwood, Sarah"); staff as written ("Dr S. Chen", Q226). Always in full, wrapping.                                                                                                                                                                                                            |
| Synthetic marker      | `SyntheticMark`                          | Every enlarged or full-screen view carries it in its top row (D-192). One wording: "Synthetic data".                                                                                                                                                                                                                                  |
| Who acts              | `WhoDoesThis`                            | A desk never sees a button it can never use; one quiet line names who does it. Unavailable for now: the reason is drawn under the button, on phone too (D-192).                                                                                                                                                                       |
| Service names         | `ServiceNameTag`, Badge `tag`            | A service shows as its short name in a neutral hairline tag, never a colour, and only where the name isn't already written (D-192).                                                                                                                                                                                                   |
| Count windows         | `window` on HeroStat, Segmented, Tabs    | Drawn by `WindowWord`; only the D-192 window words, typed. Spoken after the label.                                                                                                                                                                                                                                                    |
| Undo on a row         | `RowUndo`, toast `undo.until`            | One clock time; the row keeps Undo until the window ends (D-192).                                                                                                                                                                                                                                                                     |
| Full-screen views     | `FullScreenFrame`, `FullScreenMarkSlot`  | Every enlarged view draws the synthetic mark in its top row.                                                                                                                                                                                                                                                                          |
| Form rows             | `Field` `layout="row"`, `reserveLine`    | Help and error lines always sit under the box; reserve the line so answers don't move controls.                                                                                                                                                                                                                                       |
| Answer choices        | Segmented `layout="answers"`             | Choices size to their words and wrap; on phone a row that doesn't fit becomes 40px list rows.                                                                                                                                                                                                                                         |
| Missing facts         | `MissingValue`                           | "Not recorded" in ink-3; amber only where the gap blocks the next step.                                                                                                                                                                                                                                                               |
| Phone folds and rows  | `PhoneFold`, `phoneRows`                 | Chip rows put the count first and slide with an edge fade.                                                                                                                                                                                                                                                                            |
| Live changes          | `LiveAnnouncer`, `live`                  | One polite region per page, batched, act-now changes only.                                                                                                                                                                                                                                                                            |
| Formatting            | `format.ts` (`clk`, `dur`, `durMinutes`) | Never re-implement a formatter.                                                                                                                                                                                                                                                                                                       |

### Icons and status marks

Josh, 3 Nov 2026 (icon audit, PR #1357): icons are subtle, crisp and timeless. They help someone find a place or act, and never decorate.

**Line icons.** Lucide (`lucide-react`) only, at `strokeWidth={1.75}`, coloured by the text beside them (`currentColor`), accent only when the item is active. No custom drawings, two-tone fills, emoji or icon fonts.

| Where                                 | Size |
| ------------------------------------- | ---- |
| Inside a chip, tag or small button    | 14px |
| Inline with body text, buttons, menus | 16px |
| Sidebar, icon rail and More panel     | 18px |
| Phone dock                            | 21px |

**One icon, one meaning.** Use the same icon for the same thing everywhere, and never reuse a menu destination's icon for something else. The menu map is `ward-nav-icons.ts`; `tests/ward-nav-icons-audit.test.ts` keeps every destination unique.

| Thing           | Icon           | Thing            | Icon             |
| --------------- | -------------- | ---------------- | ---------------- |
| Home            | `House`        | Bed, Capacity    | `BedSingle`      |
| Waiting         | `Hourglass`    | Movements        | `ArrowLeftRight` |
| Transport       | `Ambulance`    | All EDs          | `Siren`          |
| Alerts          | `Bell`         | Escalation       | `TriangleAlert`  |
| Patients        | `BookUser`     | Places           | `MapPin`         |
| Referrals inbox | `Inbox`        | New referral     | `FilePlusCorner` |
| Discharges      | `DoorOpen`     | Seclusion        | `DoorClosed`     |
| Legal forms     | `FileBadge`    | Out of area      | `Signpost`       |
| Bed meeting TV  | `Presentation` | Statistics       | `ChartColumn`    |
| Sign out        | `LogOut`       | Search           | `Search`         |
| Close, dismiss  | `X`            | More actions     | `Ellipsis`       |
| Loading         | `LoaderCircle` | More information | `Info`           |

Use Lucide's current names, never the old aliases: `TriangleAlert` not `AlertTriangle`, `CircleAlert` not `AlertCircle`, `CircleCheck` not `CheckCircle2`, `ChartColumn` not `BarChart3`, `LoaderCircle` not `Loader2`, `Ellipsis` not `MoreHorizontal`, `BedSingle` not `BedDouble`, `Ambulance` not `Truck`.

**Status marks.** Use the kit's `StatusGlyph` (or `Dot`), never a typed ▲ ◆ ■ ● ○ ✓ ✕ ⚠, which render as font or emoji glyphs and differ by device. One shape per tone: triangle act now (`danger`), filled circle at risk (`warning`), tick done (`success`), capsule moving (`info`), ring waiting (`neutral`), cross declined or closed (`closed`). From 12px the triangle carries its exclamation mark. Sit a mark on the surface, never on a dot of its own colour.

**Action led.** A mark earns its place only when it changes what someone does next.

- At most one act-now triangle per row, on the row that needs a person now. Do not repeat it on every tab, chip or column head.
- Do not add a mark beside words that already say the state, such as "No due time recorded" or "No wait".
- An icon sits beside its label, not instead of it. The icon rail and phone dock are the only icon-first places, and each item still has its name for screen readers and on hover.
- Icons and marks are `aria-hidden`; the button's words or `aria-label` carry the meaning.

## 5. Layout and patterns

**Page anatomy.** Every page has the band hero, a focal part that answers the page's question and gets the most space, and a part of its own (the page's signature, see section 8). Restructure, don't restyle: each fact lives in one right place.

**Grid.** 12 columns on desktop, 16px gutters. Main and rail at 2:1 or 3:1; a rail is never empty and opens on the most urgent item. Side-by-side cards are flush and level. Below about 900px, two crowded cards stack (Q291).

**Lists and panels.** A list-and-panel page opens on the first useful item (Home's Placement panel is the exception). Group repeats into one row with one action ("Chase all"). Checklists: one head line with counts, a bulk action and Hide, then one-line cards three across, first nine shown.

**Chips.** Filter and highlight chips sit in one row. A chip with nobody in it is hidden. A row that scrolls sideways scrolls only sideways: it sets `overflow-y: hidden` beside its `overflow-x: auto`, and carries its chips' tap band in its own top and bottom padding (a matching negative margin keeps its place), because iPhone Safari still drags a row whose contents are taller than it (10 Nov 2026; `tests/css-sideways-rows-scroll-sideways-only.test.ts` checks every stylesheet, and the phone axe sweep checks every page's rows fit). Each chip's list item in the page-top quick-link rows and the Home quick bar is `display: flex`, so it is exactly its chip's height whatever the phone's fonts (11 Nov 2026). Do not add `overscroll-behavior-y` to a sideways row: it stops a vertical swipe that starts on the row from scrolling the page. On a phone those quick-link rows, the shared phone chip row and Home's ED strip take `touch-action: pan-x` instead, so a finger moves them only sideways (D-144, Josh's accepted trade-off: a swipe that starts on them does not scroll the page).

**Pop-ups and side panels.** The name, a small status tag beside it, one quiet context line. Close takes focus; no second Back link. Open on a short Summary; long lists go behind tabs with counts. Facts are label and value pairs, three to five per titled group. Notes are one compact list with icons. Actions pinned at the foot, one filled. Documents are chips that open a marked synthetic preview. Forms open blank. Tab stays inside an open panel (Q300). On short screens the header scrolls and the footer unpins (Q288).

**Graphs, grids and beds.** Heat-map cells show the number alone, shade deepening, empty days a faint dot, days after tomorrow hatched, two-line day heads with today in accent. Bed pictures read "1 ready of 20 beds", a bed-type tag, squares on one line, a note line only when needed. One timeline per record with a live Now point.

**Home: Needs you and Flow (Q340-Q345, #1324, 3 Nov).** One navigation row: **Needs you | Flow** as the raised switch, a rule, then the Flow stages as lighter trackless tabs with counts (All, No ward yet, Bed agreed, Ready to move, Moving; first tab renamed by D-220), red when someone in that stage is late. A stage tab opens Flow at that stage. Flow groups open movements by stage, oldest first, five rows per stage then "Show all N". Needs you holds act now, beds to pull and referrals to decide; a waiting alert is a mark on the patient's Flow row, not a second row. Later today sits in the right column on desktop and is a third tab on a phone. On a phone the row pins under the header. Use this one-row pattern for any page that pairs an action list with a staged list.

**Tools sheet (Q308-Q326, Q350-Q353, #1316, 3 Nov).** Search and a Recent row (Suggested until a tool is used) lead, then Do now, Look up and Print and share, ordered per desk. Rows show live counts and short second lines. One tool open at a time, scrolled into view; from 1280 wide it opens in a second pane. "/" jumps to search; no match offers Search Ward Flow. Viewing as and the demo controls sit together at the foot. Pickers come from the kit, picks come from lists only, and On-call Call copies the number (no tel links).

**Long data.** People and place names wrap in full and never lose the first name (Q285). Other long text takes two lines and an ellipsis, with the full text on hover and focus (Q284, Q286). Typed text breaks anywhere so it never runs out of its box (Q283). Hidden text stays inside its scroll area (Q281).

## 6. Words

Short labels win. Josh rejected "For you / With other desks" as too wordy (Q179); keep the Alerts count header ("4 act now · 9 waiting").

- Sentence case, verbs first, 24-hour times, digits, short durations ("2d 14h"), dates as "2 Nov".
- Titles five words at most, actions six. A row's second line is two to four words (Q313).
- Count windows: a figure shows its window as a quiet word after the label ("Discharges · any date") only when it differs from what the page title already says, or when one strip mixes windows. Words: now, today, by tomorrow, next 4h, next 24h, last 24h, this week, since 07:00, any date (D-192).
- Say a time once: "Sent 3 days ago · Due 2 days ago". A legal-form time shows as entered from the form, never a countdown (D-93), with no "as typed" suffix (D-218); "within 1h" stays on Forms (Q152).
- Fewer warnings: say it once, quietly. No hedging or disclaimer phrases ("as typed", "not legally checked", "not verified"); a table cell holds the value or a short label, and any needed explanation appears once, in the header or a tooltip (D-218). Warnings that ask someone to act keep their exact words.
- Screen-reader labels say what the screen shows (Q271).
- Browser tab: the sidebar name + " — Ward Flow" (Q272).

One word for each thing (the full list and the banned phrases are in [word-list.md](../ward-flow/word-list.md), which `tests/ward-word-list.test.ts` reads; change both together):

| Say                                            | Not                                                                                 |
| ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| Alerts                                         | Tasks                                                                               |
| movement                                       | journey                                                                             |
| held up (a state)                              | barrier, blocker (Releases held up stays on Ward, Q305)                             |
| discharge (the event)                          | release, departure, due out                                                         |
| Bed board                                      | Stays and discharges, Bed Board, board                                              |
| New referral                                   | Raise referral                                                                      |
| Add patient                                    | Add a patient, New patient                                                          |
| desks                                          | units, areas, screens (in Broadcast)                                                |
| Locked, Locked bed                             | Secure, Secure bed (except inside ward names; Josh, 5 Nov 2026)                     |
| Board time                                     | Demo time (the live pill "Demo 10:42" stays: Josh, 5 Nov 2026, HOW-WE-WORK §6)      |
| Synthetic numbers                              | Mock numbers                                                                        |
| Needs you (Tools), Next escalation step        | Suggested now, Suggested next step (D-192)                                          |
| From ward dates                                | Forecast, likely (D-192)                                                            |
| Community team                                 | team, Community teams (as a page)                                                   |
| Needs you, Flow (Home)                         | Open, Waiting, Queue (Waiting is the ED count)                                      |
| Later today                                    | Planned                                                                             |
| No ward yet, Bed agreed, Ready to move, Moving | other stage names; the detailed steps are sub-labels only (Josh, 5 Nov 2026; D-220) |
| Nobody                                         | No one (empty lines; a whole sentence ends with a full stop)                        |

States: empty pages say what is empty without a Clear button ("No patients yet."). Offline: "You're offline. Tap again once you're back online." Slow: "Still loading. Check the connection." with Reload after about 15 seconds.

## 7. Accessibility and resilience

- **200% text.** Kit controls grow (min-height, not height); labels wrap at word boundaries; safety lines never end in "…".
- **Focus.** The kit ring everywhere, including custom choice buttons (Q298). Escape returns focus to the opener (Q299). Dialog pattern for pickers, not "menu" (Q301).
- **Headings and landmarks.** No skipped levels; each landmark has a unique name (Q303, Q304).
- **Keyboard.** Scrollable strips are focusable. Arrow keys move through rows and tiles.
- **Contrast.** 4.5:1 for text and badges in both themes.
- **Stickies.** A sticky bar never covers content or a tab row (Q224). The design sweep test fails text under 12px and covering sticky bars, and phone controls under 40px above each page's baseline, at 390, 744, 768, 1180 and 1280 (`tests/ui-ward-design-sweep.spec.ts`).

## 8. The variation zone

The shell, tokens and kit keep Ward Flow feeling like one product. The variation zone lets each page have one memorable idea of its own, so screens are not all the same list.

### Fixed everywhere (never varied)

- The shell: sidebar, app bar, band hero frame, phone dock, toasts, footer.
- Tokens: no new colours, sizes, radii or fonts. Tone semantics (red is act now).
- Kit primitives: buttons, badges, choices, fields, sheets, dialogs, Show more.
- House rules: 12px floor, 40px phone controls with a 48px cover, 30px desktop tabs, no coloured side edges, one filled button per panel, at most one on-hero button plus one quick-link chip row (D-159).
- Words, names, times, safety wording and synthetic data.
- The five-second answer in the hero title.

### Free to vary (one signature per page)

Each page may take **one signature part**: a bespoke visual that shows its own data in its own way. It lives in the focal part or in the hero's own-part slot under the figure strip.

| Dial          | Allowed range                                                                                                                    | Examples                                                                    |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Data picture  | Any honest, to-scale form drawn with the data, tone and service tokens and the hatch: bed squares, rails, heat maps, flows, maps | Ward bed picture, Capacity bed map, Movements stage rail, Statistics charts |
| Hero own part | One strip under the hero figures: a timeline, a mini chart, a checking foot or a route line                                      | Shift timeline, Transport route line, Waiting check foot                    |
| Composition   | Any layout on the 12-column grid: 2:1, 3:1, three across, a full-width board                                                     | ED board full width, Discharges list and panel                              |
| Density       | Dense 36px, default 44px or touch 52px rows, chosen per page and kept for the whole page                                         | TV board at touch, Statistics tables dense                                  |
| Scale         | A display scale for shared screens only (TV and meeting views) using the 20 and 28 steps                                         | Bed meeting TV                                                              |
| Motion        | One signature motion per page from the motion tokens, off under reduced motion                                                   | A live Now point sliding on a rail; a bed square filling                    |
| Empty state   | A quiet glyph or a faded copy of the signature part, plus one plain sentence                                                     | Faint bed squares with "No beds open"                                       |

### Limits on any variation

1. It answers a question the page can't already answer (less is more).
2. It uses tokens only and passes every fixed rule above, in light and dark, at every check width and at 200% text.
3. Its phone form is designed, not squashed: it may simplify to a list or strip, never shrink below the floor.
4. It is drawn in the page's mock-up, marked "Signature part" in the master, and built only after Josh approves that mock-up.
5. When a second page wants the same part, it moves into the kit and stops being a variation.

## 9. Before posting a mock-up or marking a PR ready

- [ ] Shell copied from the master's newest screens, compared side by side with the master's Home and Ward.
- [ ] Checked at 390, 744, 768, 820, 1180, 1280 and 1440, light and dark, and at 200% text on phone.
- [ ] Tokens only; kit parts only; no one-off pills.
- [ ] Icons from the table in section 4 at 1.75 stroke; status marks from `StatusGlyph`, no typed symbols, and only where they change the next action.
- [ ] No coloured side edges; no text under 12px; phone controls 40px; desktop tabs 30px.
- [ ] At most one on-hero button plus one quick-link chip row (D-159), one filled button per panel, eight rows then Show more.
- [ ] Words from section 6; patient names surname first, staff names as written, both in full; legal times as entered, with no countdown and no disclaimer (D-218).
- [ ] At most one signature part, inside the limits in section 8.
- [ ] Synthetic data only; no names or typed text in URLs, screenshots or logs.

## 10. Decisions

Josh said yes to all four on 2 Nov 2026 (21:00 UTC). Q308 to Q326 belong to the Tools review; this page's block is Q327 to Q349.

1. **Q327.** This page is the design system of record. design-system-v9.md is background only. _Yes._
2. **Q328.** Each page may take one signature part inside the limits in section 8, approved in that page's mock-up. _Yes._
3. **Q329.** When a second page wants the same signature part, it moves into the kit. _Yes._
4. **Q330.** The design sweep test checks 744 and 768 too, so the iPad layout is checked on every PR. _Yes, built in its own small PR._
