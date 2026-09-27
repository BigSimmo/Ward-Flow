# Build contract — Handover (shift handover)

Drawing: `docs/ward-flow/mockups/handover-third-edition.html`
Built screen under review: `src/app/mockups/ward-flow/handover/page.tsx` →
`src/components/ward-management/handover/handover-page.tsx` (730 lines) +
`src/components/ward-management/handover/handover.module.css` (354 lines)

## 0. Does this screen already exist?

**Yes — in full, not as a stub.** `src/app/mockups/ward-flow/handover/page.tsx:10-12` renders
`<HandoverPage />`. The built page already implements the filter ruling this screen is bound by
(`docs/ward-flow/archive/dated-notes/owner-decisions-2026-09-09.md` §1, restated at `handover-page.tsx:28-47`): a
`HandoverScope` of network/service/ward/ed/team, all three of the ruling's named conditions (scope
always named, excluded count always stated, anything urgent outside the filter still named), a
live (not frozen) clock per OD-4, and four fixed sections. This is an **upgrade**, not a build from
nothing — the three-way diff below is what changes.

## 1. Shared chrome — IN BOTH, but at different layers

The drawing draws its own standalone copy of the universal search box, the "Service" scope menu,
the Activity/Tasks/Tools drawers and the "New referral" menu inside this one HTML file
(`handover-third-edition.html:4761-4852`). The built app does not duplicate any of that inside
`HandoverPage` — it is supplied once, globally, by `src/app/mockups/ward-flow/layout.tsx:97-112`,
which wraps **every** route under `/mockups/ward-flow/` (this one included) in `<WardRail>` and
`<WardBarMount>` (`shell/ward-bar.tsx`, `shell/ward-rail.tsx`). So this chrome is present for a
reader of the real app, just built once at the layout rather than once per screen. Nothing to add
here; noted so the diff below isn't misread as "the drawing's header is missing."

⚠️ `docs/ward-flow/build-contracts-2026-09-12/contract-wards.md` §4A (written earlier in this same
programme) asserts this shared chrome "does not exist anywhere in the built app." That claim is
now stale: `ward-flow-layout.tsx:63-96`'s own comment records the third-edition shell (`WardBar` +
`WardRail`) mounting at the layout on 2026-09-1x, after that contract was written. Confirmed by
reading the current layout file directly, not by trusting the older contract.

## 2. Three-way diff, section by section

### 2.1 Governance / synthetic badge — IN BOTH

Drawing: chip "Synthetic prototype" with title text `handover-third-edition.html:4764-4768`. App:
`.governanceBanner`/`.prototypeBadge`, `handover-page.tsx:279-286`. Same fact (invented figures,
not a medical device), different exact wording — no functional gap.

### 2.2 Page title — IN BOTH (wording differs)

Drawing: `<h1>Handover</h1>` (`:4763`). App: `<h1>Shift handover</h1>` (`handover-page.tsx:289`).
Same screen; cosmetic wording difference only.

### 2.3 The scope filter — IN BOTH (different control shape)

Drawing: a `<details>` "Filter the sheet" reveal containing chip buttons, grouped Everything /
Service / Ward / Emergency department / Community team, each chip carrying a live count
(`:4869-4872`, `renderFilter` `:6267-6325`). App: a single labelled `<select>` with the same four
`<optgroup>`s (Service/Ward/Emergency department/Community team) plus "Whole network"
(`handover-page.tsx:365-419`). The app's own comment (`:354-364`) states why a `<select>` was
chosen over chips: "third edition: one loud thing per screen... a single compact control rather
than four dropdowns fighting the header for space." Same four dimensions, same three ruling
conditions satisfied by both; **DRAWING ONLY: per-option live counts next to each scope choice.**
Not built — see §3.

### 2.4 scopeSummary / scopeExcluded sentences — IN BOTH, near-identical wording

Drawing `render()` (`:6351-6373`) and app (`handover-page.tsx:305-317`) both state: the scope name,
included-of-total count, and the excluded count (never silent, even at zero). Wording differs in
minor ways but both satisfy ruling conditions 1 and 2.

### 2.5 scopeRule sentence — 🔴 DRAWING ONLY

Drawing renders a third sentence explaining the filter's own rule: "The sheet is filtered to one
thing at a time... which every other Ward Flow screen refuses to do..." (`:6374-6375`, target
`#scopeRule` at `:4876`). **The app has no equivalent sentence at all.** Static prose, no figure —
buildable honestly. Built — see §4.

### 2.6 Four sheet sections — IN BOTH, one column difference

| Section              | Drawing columns (`handover-third-edition.html`)                                                | App columns (`handover-page.tsx`)                                                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Longest waits        | Rank/Movement/Wait/Stage/Department/Destination (`:6404-6410`)                                 | Rank/Movement/Wait/Stage/Department/Destination (`:548-554`) — **match**                                                                                   |
| Beds pulled          | Movement/Ward/**Wait**/Pull (`:6438`)                                                          | Movement/Unit/Pull (`:592-596`) — 🔴 **DRAWING ONLY: a Wait column**                                                                                       |
| In transit           | Movement/Leg/**Transport job** (placeholder, always "No transport job recorded", `:6464-6466`) | Movement/**Unit** (destination)/Leg (`:637-641`) — 🔴 **APP ONLY: a destination column; DRAWING ONLY: an always-empty "Transport job" placeholder column** |
| Placement gone wrong | Movement/Wait/What happened (`:6485`)                                                          | Movement/Wait/What happened (`:679-683`) — **match**                                                                                                       |

**APP ONLY, must survive: the In-transit destination column** (`destinationCell`,
`handover-page.tsx:501-512`) — the drawing's table doesn't show a destination for in-transit
movements at all. Kept; see §5.

### 2.7 "Outside this filter" — IN BOTH, drawing has more per-row detail

Both render condition 3 of the ruling (`handover-third-edition.html:4885-4894` /
`handover-page.tsx:435-467`). Drawing's per-row content: id, **wait duration**, urgent reason,
department, "not shown under X", then **owner + stage** on a second line (`:6512-6531`). App's
per-row content: id, urgent reason, department, "not shown under X" only (`:454-457`) — 🔴
**DRAWING ONLY: wait duration and owner/stage per row.** Both back onto real fields
(`elapsedLabel`, `movement.owner`, `stageCopy`, all already imported and used elsewhere on this
page) — buildable honestly. Built — see §4.

Drawing's footer sentence (`:6534-6545`) states what "urgent" means and gives whole-network totals
("X open movements are urgent, and Y are outside this filter"). App has **no such footer sentence
at all**. 🔴 **DRAWING ONLY** — buildable from data already computed on this page (`urgentNet` /
network-wide urgent count is a new one-line derivation from `openMovements`). Built — see §4.

Drawing's empty-case text is also richer: "Nothing urgent is outside this filter. \[N open
movements are outside it, and none of them is flagged urgent or past a legal deadline.\]"
(`:6501-6509`) vs. app's plain "Nothing urgent is outside this filter." (`:461-463`). 🔴 **DRAWING
ONLY** — buildable from `excludedOpenCount`, already computed at `handover-page.tsx:274`. Built.

### 2.8 "Shift and sign off" panel — 🔴 DRAWING ONLY, in full

Drawing (`:4897-4932`, script `renderShift` `:6568-6634`) has no counterpart anywhere in the built
page. Two parts, and they are not equally buildable — see §3 (what cannot be built honestly) and
§4 (what was built).

### 2.9 "Print" panel — 🔴 DRAWING ONLY (app has an equivalent action, not an equivalent panel)

Drawing devotes its own panel to print: a lede sentence, a list of what the printed sheet carries,
a "Print the sheet" button (`:4934-4950`, `renderPrint` `:6636-6666`). The app has the same
underlying action — a bare `<button>` in the page header calling `window.print()`
(`handover-page.tsx:294-296`) — **APP ONLY, must survive** — but no explanatory panel. Building the
panel is squarely "print behaviour," which the owner's binding ruling for this screen says to
**extend on this page**, never split into a second surface. Built — see §4. The header button is
untouched.

## 3. 🔴 What cannot be built honestly

**The shift-schedule half of "Shift and sign off"** — `renderShift` hard-codes a shift model this
app's data does not have: `SHIFT_START_MIN`, `HANDOVER_MIN`, "Handing over: Bed coordinator, day
shift" / "Handing over to: Coordinator on call, evening shift", a specific handover clock time, and
a percent-through-shift meter (`handover-third-edition.html:6568-6590`). Checked directly:

- No shift-boundary concept exists anywhere in the real model except one unrelated constant,
  `EVENING_SHIFT_END_MINUTES = 22 * 60` in `ward-bed-availability.ts:28`, which governs _bed
  release banding_ ("does this bed free before the evening shift ends"), not a coordinator
  handover schedule.
- No "day shift" / "evening shift" / "night shift" role vocabulary exists (`WardRole` in
  `ward-derivations.ts:58` is `"flow" | "ed" | "ward"`, with `roleLabels.flow = "Flow coordinator"`
  — a role, never a shift-and-role pairing).
- No "handover time," "time left," or shift-progress percentage is derived anywhere in
  `ward-clock.ts` or `ward-derivations.ts` (checked by name).

Rendering the drawing's `shiftFacts`/`shiftMeter` block would be inventing a plausible-looking
schedule with no data behind it — exactly the trap AGENT-BRIEF-COMMON.md §5 names. **Not built.**
The rest of the panel — "What the sign off records" and "Notes for the incoming coordinator" — does
not depend on a shift schedule and is built; see §4.

**The per-option live counts in a chip-style filter (§2.3)** — buildable in principle
(`movementInHandoverScope` already computes membership per scope), but replacing the reasoned,
already-shipped `<select>` with a chip reveal is a materially larger surgical change to the one
control this screen's binding ruling is about, for a cosmetic gain. Deferred rather than risked;
recorded as a deliberate scope decision, not a defect.

**The drawing's "Transport job" placeholder column (§2.6)** — every row would forever read "No
transport job recorded" (`:6466`); no field on `Movement` backs a transport job distinct from the
`leg` already shown in the adjacent column. A permanently-empty column adds width, not fact. Not
built; the app's own destination column (APP ONLY) is kept instead.

## 4. What was built

1. `.scopeRule` static explanatory paragraph, after the excluded-count line
   (`handover-page.tsx`, new, mirrors `handover-third-edition.html:6374-6375`).
2. `UrgentOutsideFilterFooter` rows now include wait duration
   (`elapsedLabel(movement, now)`) and `{movement.owner} · {stageCopy[stage].label}`, mirroring
   `handover-third-edition.html:6512-6531`. `movement.owner` is a non-optional `string` on the real
   `Movement` type (`ward-model.ts:903`, sample values "Flow coordinator" / "ED mental health team"
   / "Ward nurse in charge" in `ward-movements.ts` — a role, never a person's name), so no
   "no owner recorded" fallback is needed or rendered, unlike the drawing's nullable-owner engine.
3. `UrgentOutsideFilterFooter`'s empty-case text extended to name the excluded count and state the
   two-part urgency rule, and a new footer sentence stating the whole-network urgent count and how
   many of them are outside the filter — mirrors `:6501-6545`, driven by a new
   `urgentAnywhereCount` derived in `HandoverPage` from the same `openMovements` population every
   other network-wide count on this page already uses.
4. `PulledBedsSection` gained a Wait column (`elapsedLabel(entry.movement, snapshot.takenAt)`),
   matching the drawing's four-column table (`:6438-6446`) and the pattern already used in
   `LongestWaitsSection`/`PlacementGoneWrongSection` on this same page.
5. New "Sign off" section: "What the sign off records" — a list of facts already computed on this
   page (the moment, the scope, the on-sheet/network counts, the on-sheet legal-deadline-breach
   count, the urgent-outside-filter line) plus one static sentence ("the role that signs it, and
   the moment — never a person's name," consistent with the codebase-wide role-not-name doctrine,
   e.g. `ward-model.ts:1179`, `:1203`) — and a "Sign off the handover" button that announces
   `"Sign off the handover is not wired in this prototype."` via `announceToWardShell`
   (`shell/ward-live-region.tsx`, mounted globally by the layout, §1), the exact idiom
   `shell/ward-bar.tsx:150-153,574` already uses for a drawn-and-not-wired primary action.
6. New "Notes for the incoming coordinator" section (folded into the Sign off panel, matching the
   drawing's own placement): a static, honest empty-state paragraph — no note-authoring mechanism
   exists in this prototype, so the section always reads that way, and says so plainly.
7. New "Print" section: a lede sentence, a list of what the printed sheet carries (the moment, the
   filter, the total row count across the four sections, the urgent-outside-filter line — all
   already-derived facts), and a second "Print the sheet" button calling the same `window.print()`
   as the existing header button. The header button is untouched (APP ONLY, survives).

## 5. Every "APP ONLY" item, and whether it survives

- **The native `<select>` scope filter and its exact four `optgroup`s** (§2.3) — **KEPT**, untouched.
- **The In-transit destination column** (§2.6) — **KEPT**, untouched.
- **The header "Print" button** (§2.9) — **KEPT**, untouched; a second, panel-local print button
  was added alongside it, not in place of it.
- **The cross-link paragraph to the capacity board** (`handover-page.tsx:345-348`) — not mentioned
  anywhere in the drawing at all — **KEPT**, untouched, unmoved (still the last element before
  `</main>`).
- **The `movementInHandoverScope` / `urgentMovementsOutsideScope` / `movementIsUrgent` /
  `destinationCell` exported functions and their extensive doc comments** — **KEPT**, untouched;
  only new code was added, nothing in this set was rewritten.

## 6. Which owner decisions bind this screen

- `docs/ward-flow/archive/dated-notes/owner-decisions-2026-09-09.md` §1 — the four-dimension filter and its three
  conditions. Already built (§0); unaffected by this pass.
- `docs/ward-flow/archive/dated-notes/owner-decisions-2026-09-09.md` OD-4 — the page reads live, never freezes.
  Unaffected; nothing added here freezes anything.
- `docs/ward-flow/archive/dated-notes/owner-decisions-2026-09-1x.md` O-17.2 — "the handover print sheet re-uses this
  page, pre-scoped to a ward... **re-uses `/mockups/ward-flow/handover` pre-scoped to that ward
  rather than drawing its own**." This build does not implement the pre-scoping mechanism itself
  (no route or search-param reading was added) — no other screen currently links here with a ward
  scope to wire against (`grep -rln "/mockups/ward-flow/handover" src/` finds only
  `morning-page.tsx`, `ward-chrome-header.tsx`, `ward-nav.ts`, none of which pass a scope), and
  O-17.2's own text calls that pre-scoping wiring **"a WIRING task"** for whichever screen builds
  the print action (the ward screen, per Q-12/A3), not a feature this screen invents unprompted.
  Extending print behaviour on this page (§2.9, §4.7) is the constraint this ruling actually binds;
  honoured by adding to this page rather than a second surface. Flagged in §7 below in case another
  lane needs this page to accept a scope from its URL.

## 7. Shared-file edits, and anything for the controller

None needed. Every change is inside `handover-page.tsx` and `handover.module.css`, both owned by
this screen.

One thing worth the controller's attention, not a request to edit a shared file: **if a later task
wires a "print this ward's handover" action from the ward screen (O-17.2/A3), this page will need a
way to receive an initial scope** — e.g. a search param read once at mount. Nothing currently reads
one, and no other screen currently links here with a ward scope, so building that seam speculatively
risked guessing its shape. Recorded rather than built, per AGENT-BRIEF-COMMON.md's "stop and hand
back" rule for an out-of-scope decision.

## 8. The vocabulary trap ("Ready")

🔴 A first grep of only `handover-page.tsx` and the drawing's own HTML found nothing but "already"
— that grep was too narrow, exactly the "grep for the name you expect" mistake AGENT-BRIEF-COMMON.md
§3 warns about, because it missed a value the page renders through an imported table rather than a
literal in its own source.

**"Handover ready" IS a real, renderable value on this screen already**, before any of my changes:
`handover_ready` is a real `MovementStage` (`ward-model.ts:159-168`), seeded onto real movements in
the fixture (`ward-movements.ts:206,652`), and `stageCopy.handover_ready` is `{ label: "Handover
ready", shortLabel: "Ready" }` (`ward-stage-copy.ts:30`). `LongestWaitsSection`'s existing Stage
column already renders `stageCopy[entry.movement.stage].label` (`handover-page.tsx:563`), so a
movement at this stage already shows "Handover ready" today, pre-dating this build.

This is the "ready bed" vs. "ready to leave" pair the brief names, and "Handover ready" is the
_second_ meaning (a movement/patient ready to be collected), never the first. It reads
unambiguously as written — "Handover" names what it is ready FOR — **as long as the full `.label`
is used and never `stageCopy[...].shortLabel`, which is the bare, ambiguous word "Ready" on its
own.** My one new use of `stageCopy[...].label` (`UrgentOutsideFilterFooter`, §4.2) follows this
same rule — full label only, same as the section it was copied from — so it introduces no new
ambiguity, only a second place the existing safe pattern is used. Nothing in this build reads
`.shortLabel` anywhere.

## 9. What I did not check

- I did not run the drawing in a browser; every claim about its rendered output is read from its
  HTML/JS source, structurally (headings, `id`s, the render functions), not from a screenshot.
- I did not check `tests/ward-handover-filters.test.ts`, `tests/ward-handover-filters.dom.test.tsx`,
  or `tests/ward-handover.test.ts` line-by-line before writing this contract — I read
  `tests/ward-handover.dom.test.tsx` and `tests/ward-handover-print.test.ts` in full, since those
  are the ones a DOM-and-print change to this page is most likely to collide with. I re-ran the
  full existing suite (not just the file I extended) as part of verification — see the agent
  report — which is how I would have caught a collision I didn't anticipate here.
- I did not check whether `ward-handover-destination-truthfulness.test.ts` covers the new Wait
  column or the new per-row urgent-outside content; I only confirmed it still passes.
- I did not investigate what `Instant`/`clockState` do for a movement whose `legalForm.dueAt` is in
  a state other than "breached" (e.g. "approaching") beyond reusing the exact check
  `movementIsUrgent` already makes — I did not audit `ClockState`'s full value set.
- I did not check whether any other Ward Flow screen already renders a "Sign off" or "notes for the
  incoming coordinator" concept elsewhere in the app (e.g. as part of a different phase) that this
  might collide with in wording or intent; a grep for "sign off" and "incoming coordinator" across
  `src/components/ward-management/` before writing returned only this page's new code and the
  drawing itself.
- I did not verify the visual result in a browser (no `npm run ensure` / Playwright per the common
  brief's restriction on this lane) — only DOM-test and `tsc` verification, per §7 of the common
  brief.
