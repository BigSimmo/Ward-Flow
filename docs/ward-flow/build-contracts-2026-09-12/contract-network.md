# Build contract — Network screen

Drawing: `docs/ward-flow/mockups/network-third-edition.html` (11,988 lines; screen-specific
markup ends ~line 4650, the rest is the shared "Ward Flow Command" engine string-built in JS).
`<title>Ward Flow Network</title>`, but the CSS banner inside says this file is "WARD FLOW
COMMAND. Third edition" — i.e. Network is Command's engine with two whole panels deleted.

## 1. Does this screen already exist?

**Partially, and under a different design than the drawing.** There are THREE relevant things,
not one:

- **A route already exists:** `src/app/mockups/ward-flow/network/page.tsx` renders
  `<WardModeWorkspace mode="network" />`, which routes (`ward-management-modes.tsx:496`) to
  `WardNetworkWorkspace()` in `src/components/ward-management/ward-management-network.tsx`
  (1,303 lines, its own CSS module). Tried spellings: "network", "statewide", "Command" —
  Network is a real, separate, already-built mode, not a stub.
- **But `WardNetworkWorkspace` is built to an OLDER design that the drawing explicitly
  rejects.** It has a "Movement pipeline" strip (`<section aria-label="Movement pipeline">`,
  line ~715), a priority queue with stage filtering, and a "Referral placement" /
  "Explainable shortlist" panel (line 1134, 1143) with its own diagram engine
  (`NetworkBandGroup`, "Schematic, not geographic" at line 952). The third-edition drawing's own
  CSS comment (top of `network-third-edition.html`, ~line 4400) says this screen "removes their
  markup outright rather than hiding it with `display:none`" — the queue panel and the
  explainable-shortlist tools are Command's, and Network drops them for an "Emergency department
  pressure" strip plus one full-width "Statewide flow" diagram. **So the built screen and the
  drawing disagree about what Network even shows.** Six existing test files are pinned to the
  CURRENT (queue/shortlist) design: `tests/ward-network-queue-count.dom.test.tsx`,
  `ward-network-stage-filter.dom.test.tsx`, `ward-network-stage-strip.dom.test.tsx`,
  `ward-network-referral-placement.dom.test.tsx`, `ward-network-referral-clocks.dom.test.tsx`,
  `ward-network-cluster-header.dom.test.tsx`. Building the drawing as-is means deleting or
  rewriting all six, which AGENTS.md's test-deletion-guard treats as its own governed decision.
- **The exact two panels the drawing DOES want already exist, built for a different screen.**
  `src/components/ward-management/coordinator/pressure-strip.tsx` (`PressureStrip`) renders the
  worst-first ED list, and `coordinator/flow-diagram.tsx` (`FlowDiagram`) renders the statewide
  unit/service diagram — both live today inside `CoordinatorScreen`
  (`coordinator-screen.tsx:37`), which is the root route (`src/app/mockups/ward-flow/page.tsx`)
  and corresponds to the "Command" drawing, not "Network." `FlowDiagram` takes
  `movement: Movement | undefined` and degrades to an unhighlighted diagram when there is no
  selected movement — i.e. it can plausibly run with no queue at all.

**Net:** the screen is not missing, but "already exists" would be a false answer in the direction
that matters here — a rebuild is not "add a route," it is "replace `WardNetworkWorkspace`'s body
with something close to `PressureStrip` + `FlowDiagram` (or new siblings built the same way), and
retire or rewrite six tests pinned to the design being replaced." That decision (retire vs. keep
old Network behaviour) is the owner's, not implicit in "build the screen."

## 2. Sections, in drawing order

1. **Header/chrome** — title "Network", synthetic-prototype badge, universal search, service
   scope menu, Activity/Tasks/Tools drawers, "New referral" menu. This is the shared shell
   (`ward-shell.tsx`, `ward-chrome-header.tsx`) every third-edition screen reuses — not this
   screen's own content.
2. **Emergency department pressure** (`<h2>`, line 4553) — a note "Ordered worst first: breached
   deadlines, then longest wait," a count (`#edCount`), and a sideways-scrolling list
   (`#edList`).
3. **Statewide flow** (`<h2>`, line 4569) — a status count (`#diagStatus`), a Legend toggle
   button, the diagram itself (`#diagWrap`), a foot note ("Schematic, not geographic" /
   "wider than the panel" scroll hint), and a Legend panel.

That is the whole screen. There is no queue, no shortlist, no third panel — the drawing's own
comment is explicit that both were deleted, not hidden.

## 3. Data per section

**Section 2 — Emergency department pressure.**

- **List, sort order, and figures**: fully in the model already. `edPressure(now, movements)`
  in `src/components/ward-management/ward-pressure.ts:35` returns
  `{ ed, waiting, longestWaitMinutes, breaching }[]`, sorted "breaching desc, then
  longestWaitMinutes desc, then waiting desc" — exactly "breached deadlines, then longest wait."
  It is a thin, deliberately non-duplicating wrapper over `edHomeSummaries`
  (`ed/ed-home-derivations.ts`). `breaching` is legal-deadline breach via `clockState`
  (`ward-clock.ts`), not `ED_ACCESS_TARGET_MINUTES` (that constant is explicitly barred from any
  breach/eligibility surface — `ward-model.ts` ~line 297-311).
- **Count** (`#edCount`): `edPressure(...).length`, i.e. `allEmergencyDepartments().length` —
  **owner-ruled to be network-wide and unfiltered by the selected service** (D-35 below).
- **`PressureStrip`** (`coordinator/pressure-strip.tsx`) already renders this exact list against
  live `movements`; it currently also takes a `selectedEdId`/`onSelectEd` pair for Command's own
  ED-click-to-filter-queue behaviour, which Network has no queue to filter — that prop pair would
  need to be optional or dropped for Network's reuse.

**Section 3 — Statewide flow.**

- **The diagram itself**: `FlowDiagram` (`coordinator/flow-diagram.tsx`) groups `units` by
  `wardServiceOrder`/`siteByCode(unit.siteCode)?.service` and draws each unit's bed-state chips
  via `unitCapacity`/`capacityBreakdown`/`designationSummary` — all real model derivations, not
  invented figures. Passing `movement: undefined` (Network has no selected movement) yields the
  network picture with no eligibility highlighting, which is consistent with the drawing (no
  candidate routes are drawn on Network — Command's shortlist tools were removed for that
  reason).
- **`#diagStatus`, Legend, "wider than panel" scroll hint**: presentational states over the same
  data (unit count / overflow detection); no new model needed. `FlowDiagram` already measures
  DOM overflow itself (`diagramOverflowing` state) rather than declaring it, matching this
  drawing's honesty rule.
- **"Schematic, not geographic"**: a static caption, present verbatim in
  `ward-management-network.tsx:952` already — not a model claim.

## 4. What cannot be built honestly

Nothing found in the drawing's two real sections asks for a figure, time, or comparison the
model cannot produce — both sections have a live, tested, non-duplicated derivation already in
the codebase (`edPressure`, `FlowDiagram`'s unit grouping). The one thing that is NOT a model gap
but must still be named: **`FlowDiagram` was written assuming a Command-style host that always
has a `movement` in scope** (it is typed `Movement | undefined` and several internal derivations
— `shortlist`, `originEdId` — are conditioned on it existing). Whether `FlowDiagram` degrades
correctly with `movement` permanently `undefined` (Network's actual condition, not an edge case)
is untested — no test drives `FlowDiagram` with `movement === undefined`, so this is an unverified
code path, not a proven-safe one. That is a build risk to name to whoever writes this, not a
missing model fact.

## 5. Owner decisions binding this screen

Searched `docs/ward-flow/archive/dated-notes/owner-decisions-2026-09-1x.md` for "network" and this screen's section
names.

- **D-35 (2026-09-1x): "The ED pressure strip does not narrow to the selected service, and #6 is
  CLOSED."** Ruling: "the strip shows the whole network," and "the drawing's empty-state
  sentence is not built — not deferred, closed" — `pressure.length` is a constant (one row per
  emergency department; `allEmergencyDepartments()` is static/unfiltered), so it never renders an
  empty-list sentence. **This directly binds section 2**: `#edCount`/`#edList` must stay
  unscoped by the header's service-scope menu even though the menu visually sits above them —
  confirmed already true of the current `PressureStrip`/`edPressure` pairing, so no drawing
  contradiction here.
- **D-34 (2026-09-1x): "A hypothetical destination row may not use obligation vocabulary at
  all."** Ruling names `ward-management-network.tsx:186`'s "Not yet booked" wording as wrong
  (conflated with `ed-screen.tsx`'s "Not yet requested," a real obligation) and states "the
  network's shortlist row stops reaching for an absence wording... The owning lane proposes
  wording on that basis and brings it back" — **open, not resolved.** This rules directly on
  `ward-management-network.tsx`'s shortlist row — but the third-edition drawing deletes the
  shortlist panel outright. If Network is rebuilt to the drawing, D-34's subject (that row) no
  longer exists on this screen; the still-open wording question would migrate to wherever a
  shortlist/candidate row survives (Command's `shortlist-panel.tsx`), not to a rebuilt Network.
  Flag, do not silently resolve: this is a case where the drawing predates the ruling, and
  building the drawing literally would make D-34 moot for this screen rather than satisfying it.
- No other decision in the file names "Statewide flow," "Emergency department pressure," or this
  screen's other headings directly.

## 6. Catchers

- **Section 2, sort order and count**: `tests/ward-pressure.test.ts` already pins
  `edPressure`'s worst-first ordering and the breach definition — reusable as-is; a rendering
  test asserting `#edList` renders in the same order `edPressure` returns would catch a UI-level
  reordering bug. No catcher exists yet for "the strip stays unfiltered when a service is
  selected" as a rendered-DOM property (D-35's own evidence was read from source, not a pinned
  test) — that would need a new DOM test if this becomes production code.
- **Section 3, diagram correctness**: no existing test drives `FlowDiagram` with
  `movement === undefined`. **This is a defect in the contract, not something to skip**: before
  building, either a test must be written asserting the diagram renders every unit with correct
  bed-state chips and zero eligibility highlighting when no movement is selected, or the person
  building this must be told explicitly that this path is unverified.
- **Six pre-existing `ward-network-*.dom.test.tsx` files** (queue count, stage filter, stage
  strip, referral placement, referral clocks, cluster header) are today's catcher for the CURRENT
  `WardNetworkWorkspace`. Whichever way the owner resolves item 1 above (replace vs. keep), those
  six tests are the thing that must be deliberately handled (rewritten, or formally retired per
  the test-deletion-guard contract), not silently left red or silently deleted.

## Limits of my reading

Searched: the mockup file's headings/comments/CSS banner (not every one of its ~12,000 lines —
the bulk after ~line 4650 is the shared drawer/rail JS engine, sampled rather than read in
full); `ward-model.ts`, `ward-derivations.ts` (grep only, not read start-to-end), `ward-pressure.ts`
(read in full), `ward-sites.ts` (grep only, not opened), `ward-referrals.ts`/`ward-catchment.ts`
(not opened — the drawing's two real sections never need referral or catchment data, so I did not
chase them further); `ward-management-network.tsx` (read ~200 of 1,303 lines, structurally, not
line-by-line); `coordinator-screen.tsx` and `flow-diagram.tsx` (partial reads); the full text of
`owner-decisions-2026-09-1x.md`'s D-31 through D-36 (read), not the rest of that ~2,200-line
file (grepped for "network" only — a decision phrased without that word could exist and be
missed). I did not open `ed-home-derivations.ts` beyond its top comment, did not open
`ward-catchment.ts` or `ward-sites.ts` at all, and did not check whether `PressureStrip` or
`FlowDiagram` have any dependency on Command-only state (e.g. `useWardFlow` context shape) that
would block a straight lift into a Network-only tree — that would need checking before treating
"reuse them" as a safe recommendation rather than a hypothesis. I ran no test and no server, per
the constraint given.

**If a decision this brief does not cover arises when building — building on the old
`WardNetworkWorkspace` design vs. replacing it wholesale, or resolving D-34 — stop and hand it
back to the owner.**
