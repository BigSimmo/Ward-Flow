# Build contract — Ward Flow Settings screen

Drawing: `docs/ward-flow/mockups/settings-third-edition.html` (8448 lines).
Route measured absent: `src/app/mockups/ward-flow/settings/` does not exist. No nav entry exists
either (`grep -i settings src/components/ward-management/ward-nav.ts` — no hit). This is a genuine
new build, not a re-skin of an existing route.

## 0. Design or reproduction?

**Design**, with one internal reuse the drawing documents itself. Searched the whole file for
"reproduc*", "exactly", "already exists", "based on" — the only hit is its own comment block at
line ~4700–4730:

> "Command has the engine that builds that data; this screen does not, so the arrays below are
> Command's own, copied from command-third-edition.html unchanged... it exists here only so the
> bar's search, the Activity drawer, the Tasks drawer, the rail and the reconciliation line behave
> on this screen exactly as they do everywhere else."

That is the shared shell-facade convention every third-edition mockup uses (copying the rail/bar
data arrays from `command-third-edition.html` so the chrome behaves consistently) — it is a mockup
authoring convention, not a claim that the _settings content itself_ reproduces a built React
component. No comment anywhere claims this screen's five panels were copied from real code. The
"reproduced exactly" comment the brief warns about belongs to a different drawing in the set, not
this one.

## 1. Does a settings-like surface already exist?

Yes — enumerated by reading the real components, not by grepping for "settings":

- **`WardDemoControls`** (`src/components/ward-management/ward-demo-controls.tsx`) — a flask-icon
  menu in the rail with clock advance (+15/+60 min), a scenario radio group (Standard/Scarce,
  backed by `ward-scenarios.ts`'s `WardScenario`), and Reset. Real, wired, tested.
- **Appearance (Light/Dark/Auto)** already lives in the Tools drawer, `ward-bar.tsx:150-190,
679-705`. Real state: `WardAppearance` type (`shell/ward-shell-types.ts:56`), storage key
  `"ward-flow-appearance"`, event `ward-flow-appearance-change`, applied via
  `document.documentElement.setAttribute("data-theme", ...)`. CSS actually branches on
  `[data-theme]` (`ward-tokens.module.css:292-310` — the dark-mode print-bleed fix proves it's a
  real, consumed attribute, not decorative).
- **Rail open/closed** is real state: `RAIL_OPEN_STORAGE_KEY = "ward-flow-rail"`
  (`shell/ward-rail.tsx:61`), event `ward-flow-rail-change`, read by `useRailOpenStore` and applied
  to `data-rail`.
- **Service selector** exists in `ward-bar.tsx` (`useState<HealthService | null>`) but is
  explicitly unwired: `onServiceChange` is "an unwired seam nobody calls yet" (`ward-bar.tsx:449`),
  not persisted, resets every load.
- Owner ruling **Q-7** (`docs/ward-flow/archive/dated-notes/owner-decisions-2026-09-1x.md:53`): "Where do clock /
  scenario / reset live? The Tools drawer... Nothing a demonstration needs is lost, and nothing
  reads as a real control." — binding: those three stay in Tools, and the drawing correctly does
  not put them in Settings.

## 2. The drawing's sections, in order

1. **Appearance** — three buttons (Light/Dark/Auto), a "Now showing" readout, a note that this is
   the same choice as Tools' Appearance and changes both together.
2. **The rail** — a "Now" readout (Open/Closed) and one button, "Close the rail" / "Open the rail".
3. **Default service** — a "Chosen right now" readout only; explicitly says the choice "is not
   saved" and the page always starts at all services. No control that writes anything.
4. **What prints on the handover sheet** — a read-only bulleted description of the real Handover
   screen's Print panel (verified: `handover-page.tsx` has all four named sections — Longest waits,
   Beds pulled, In transit, Placement gone wrong) plus a link to open Handover. No control.
5. **Thresholds** — a read-only table of every hidden numeric threshold in the prototype (e.g. the
   ED 1440-minute constant, `ward-model.ts`'s `ED_ACCESS_TARGET_MINUTES`), each row naming its
   source file/constant and its owner-decision provenance. Explicitly: "Nothing here can be changed
   from this screen."

Interactive controls that write anything at all: **only two** (Appearance buttons, rail toggle
button). Sections 3–5 are read-only displays by the drawing's own design — a correct choice, not a
gap.

## 3. Per control: what it writes, and whether anything reads it

**Appearance buttons (`data-set-theme="light\|dark\|auto"`)**

- Drawing's own script (lines 8411-8434) writes `localStorage["ward-flow-settings-appearance"]`.
- 🔴 **This is a different key from the real, already-built Tools-drawer control**, which uses
  `"ward-flow-appearance"` (`ward-bar.tsx:155`). If built literally as drawn, the Settings screen's
  Appearance buttons would read/write a _second, disconnected_ piece of state — directly
  contradicting the drawing's own sentence, "Changing it here changes it there too." That sentence
  is only true if the build reuses the real `WardAppearance` storage (key, event, `applyAppearance`
  logic), which currently live as module-private helpers inside `ward-bar.tsx` and are **not
  exported**. Building honestly means extracting/exporting that logic (or its key/event names) to a
  shared module and having both call sites use it — not inventing a second key that happens to look
  similar. This is exactly the "control nothing reads" trap in a subtler form: not that nothing
  reads it, but that it would be read by nobody _else_, silently diverging from the one already-real
  Appearance control the moment a user touches both.

**Rail toggle button (`data-rail-toggle="closed\|open"`)**

- Drawing's script (line 7913) writes `localStorage["ward-flow-rail"]` — this key **matches** the
  real one exactly (`ward-rail.tsx:61`). Genuinely wireable as drawn, once the module-private
  `setRailOpenPreference`/event-dispatch logic in `ward-rail.tsx` (currently un-exported) is
  exported or duplicated correctly.

**Default service / Handover / Thresholds** — no writes; pure reads of existing model constants and
a link. Nothing to flag here because nothing is written.

## 4. What cannot be built honestly

- **The Appearance control as literally scripted (its own separate localStorage key) must NOT be
  built that way** — it would visibly disagree with the real Tools control while claiming to be the
  same choice. This is not a missing feature, it's a wrong-key bug baked into the drawing's own
  inline script; the contract must route this control through the real, existing `WardAppearance`
  state instead of copying the drawing's script verbatim.
- **Nothing in this drawing invents a control that changes clinical behaviour.** Scenario, clock,
  and reset — the only things that touch case data — are deliberately absent from Settings per Q-7,
  and the drawing does not reintroduce them. Good.
- **"Default service" has no control** in the drawing precisely because the real Service selector
  is unwired and not persisted — the drawing does not paper over that gap with a fake toggle. Any
  attempt to add a working default-service _setting_ here would require first wiring the Service
  selector itself (`onServiceChange`) to something real, which is out of scope for this screen and
  is the owner's call, not this build's.
- Per the changeable-data rule, the Thresholds table's rows must keep citing real file/constant
  names and real owner-decision dates (as the drawing already does) — inventing a plausible-looking
  source for a threshold would be the dishonest failure mode here.

## 5. Owner decisions binding this build

- **Q-7** (`owner-decisions-2026-09-1x.md:53`): scenario/clock/reset stay in Tools, not Settings.
- **"No new notion of a user, an account or a person-who-logs-in"** (`:142-143`): all settings here
  must stay per-browser (`localStorage`), never a per-user account preference — matches the
  drawing's own "remembered for this browser only" language throughout.
- **The changeable-data rule** (`:170`): every invented figure in the Thresholds table must carry
  its own sourced marker; nothing may be built that only works for the seed.
- No owner text specifically addresses a Settings screen beyond Q-7; nothing else in
  `owner-decisions-2026-09-1x.md` mentions "settings" or "default service".

## 6. The catcher, per section/control

1. **Route + nav wiring**: `tests/ward-nav.test.ts` already checks every `WARD_NAV` href against
   the real route tree — adding the settings entry and route is caught by that existing test
   failing red until both exist and match.
2. **Appearance buttons**: a test that sets the Settings screen's Appearance to "dark", then reads
   `localStorage.getItem("ward-flow-appearance")` (the REAL key) and/or asserts
   `document.documentElement.getAttribute("data-theme") === "dark"`, and separately asserts the
   Tools-drawer Appearance control (or a second render) reflects the same value. If the build uses
   the drawing's own invented key instead, this is the test that goes red — it is the "does the read
   exist" proof the brief asks for.
3. **Rail toggle**: a test that clicks the Settings "Close the rail" button, then reads
   `localStorage.getItem("ward-flow-rail") === "closed"` and asserts `WardRail`'s own open/closed
   DOM state (or `data-rail` attribute) changed — proving the shared reader in `ward-rail.tsx`
   actually consumed it, not just that Settings wrote something.
4. **Default service / Handover / Thresholds**: no write-side catcher needed (nothing is written).
   The catcher is a content test: the Handover bullet list's four named sections and the Thresholds
   table's rows resolve against the real source (e.g. `ED_ACCESS_TARGET_MINUTES`'s literal value),
   so a future change to the real constant or the Handover sections' names fails this test rather
   than leaving the Settings screen quietly wrong.
5. **Handover deep link**: a test that the `href="handover-third-edition.html"`-style link is
   replaced with the real route (e.g. `/mockups/ward-flow/handover`) and resolves, not a dangling
   mockup-to-mockup link carried over by copy-paste.

## Limits of this reading

- I read the full settings drawing's markup, its inline scripts (theme/rail wiring, lines
  ~5751-5765, 7326, 7809-7913, 8356-8434), and its Thresholds table content, but did not render the
  file or check every one of its ~8448 lines line-by-line (e.g., the CSS block and the copied
  Command-engine array literals were skimmed, not fully read).
- I did not check every other third-edition mockup for the "reproduced exactly" comment the brief
  flagged — I only confirmed it is absent from _this_ file's comments and markup; I have not
  identified which sibling drawing does carry that claim.
- I did not open `command-third-edition.html` to verify the copied engine-facade arrays are
  byte-identical, only that this file's own comment says so.
- I have not checked `docs/ward-flow/archive/dated-notes/owner-decisions-2026-09-08.md` or `-09-09.md` for settings-
  adjacent rulings beyond the 09-1x file the brief named; a quick title-only scan suggests they are
  about sex/gender and edge-bar rulings, not settings, but I did not open them in full.
- If a decision surfaces that this contract doesn't cover — in particular, whether the Appearance
  control's storage key is fixed by the owner as `ward-flow-appearance` (real) or something else —
  stop and hand it back rather than guessing.
