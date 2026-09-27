# Build contract — Out of area (`/mockups/ward-flow/out-of-area`)

Drawing: `docs/ward-flow/mockups/out-of-area-third-edition.html` (8233 lines).
Read-only research. No repository file touched.

## 0. Design or reproduction?

**Design — an upgrade, not a "reproduced exactly" copy.** The drawing's own header comment
(out-of-area-third-edition.html:4943-4998) says: _"WHAT THE SCREEN IS... It is the repository's
out-of-area ledger (`src/components/ward-management/out-of-area/out-of-area-board.tsx`) drawn to
this standard, and three of that board's decisions are carried here because losing any one of
them would change what the screen says"_ — unranked order, single band lookup, unrecorded-pair-is-
a-gap. Everything else (subject panel, five-group split, catchment lookup, pinning, record/referral
actions) is new. The "reproduced exactly" language in this file is scoped only to specific _data
tables_, not the screen: line 5052 "the repository structures it, spellings and typos reproduced
exactly" (catchment rows) and similar wording for the ward/site fixtures and the two governance
notices (line 5253-5254, "carried word for word from ward-distance.ts"). No sentence in this
drawing claims the whole screen was reproduced from the built component — that "reproduced
exactly" whole-screen claim belongs to a _different_ drawing in the set, not this one.

## 1. What exists today

- Route: `src/app/mockups/ward-flow/out-of-area/page.tsx` — renders `<OutOfAreaBoard />`, no props
  (page.tsx:11-12).
- Shared shell mounts one level up, at `src/app/mockups/ward-flow/layout.tsx`: `WardBarMount`
  (top bar / search / primary action) and `WardRail` (nav rail), ancestors of _every_ ward route
  including this one (layout.tsx:1-40+). **The rail, search bar, and reconciliation-line chrome the
  drawing shows are therefore already present app-wide** — this is not out-of-area-specific work,
  except for what content that shell shows _for this route_ (see §3).
- Component: `src/components/ward-management/out-of-area/out-of-area-board.tsx` (252 lines).
  Sections it renders, top to bottom:
  1. Governance banner (`ward-out-of-area-governance`) — "Synthetic prototype" badge + full visible
     sentence: _"This board is **not a medical device**. Every bed, every occupancy and every
     travel time in it is invented, and nothing here has been checked against a real service."_
     (lines 88-94).
  2. Page header — title "Out of area" + subtitle (96-99).
  3. Counts paragraph — two figures, deliberately no fraction/percentage/progress bar (110-120,
     comment 101-109).
  4. Notice group — `INVENTED_OUT_OF_AREA_THRESHOLD_NOTICE` + `SYNTHETIC_TRAVEL_TIMES_NOTICE`,
     imported whole from `ward-distance.ts`, rendered above the entries (138-145).
  5. Provenance paragraph (168-175) — seeded, not live-count; nothing removes anyone from the list;
     an arrival during the session _is_ added; ED-pathway admissions raise the second figure, not
     the list.
  6. Entries section — table (desktop) + a separately-keyed `<ul>` card list for phone (`display:
none` on the table below 40rem) (177-228).
- Tests: `tests/ward-out-of-area-figure-direction.dom.test.tsx` (91 lines, pins the "figure above"
  vs "below" wording to actual DOM order) and `tests/ward-out-of-area-live-state.dom.test.tsx`
  (154 lines, see §5).
- Model: `Admission` (`ward-admissions.ts:288+`) has `homeRegion: HomeRegion | null` (line 446) and
  **no `suburb` field** (confirmed by full-file grep). `outOfAreaLedger` (`ward-referrals.ts:1251`)
  reads `admissions`, `units`, `now`; excludes not-occupied and null/non-finite `arrivedAt`; buckets
  null `homeRegion` into `notBanded`; looks up band via `ward-distance.ts` from `homeRegion` +
  unit's site, never stores a band on the admission.

## 2. The drawing's sections, in order

1. Rail (`#rail`, shared shell nav).
2. Header 1: title + "Synthetic prototype" badge (tooltip only) + search + three drawer triggers
   (Activity, Tasks, Tools) + New referral menu + "Record a home area" primary button.
3. Register: `<h2>People in a bed on these records</h2>`, table sorted "far from home first"
   (aria-label, line 4920) — actually the _five-group_ order below, not a per-row time sort.
4. Subject panel ("At a glance"): per-placement detail — "This placement", "Catchment", "What this
   screen does not say", "Where these figures come from" (sourceInvented/sourceReal/sourceScope).
5. "The five groups" summary (far / near / no-home / no-band / no-arrival), each with its own note.
6. "What out of area means here" (the invented-threshold notice, restated in this frame).
7. "Catchment data" section (per-suburb lookup, contested-Karratha handling).
8. Drawers: Activity, Tasks, Tools (shared shell content, out-of-area-flavoured).
9. Pinned beds (rail group, `localStorage` "ward-flow-out-of-area-pinned").

## 3. Three-way diff

### 🔴 APP ONLY — would be lost by a naive upgrade

- **The visible "not a medical device" sentence.** App: a standing, always-visible banner paragraph
  (`ward-out-of-area-governance`, board.tsx:88-94). Drawing: the same words exist only as a hover
  `title` attribute on the prototype badge (line 4785) — invisible on touch/phone, and invisible
  until a mouse lingers on desktop. Built as drawn, every coordinator on a phone (which this screen
  explicitly designs a card list for) loses the one sentence saying this is not a medical device.
  **What would be lost:** the standing disclaimer's visibility for the entire mobile audience.
- **The phone card list as the _only_ content below 40rem.** Confirmed present in the app
  (board.tsx:207-225, table `display:none` under 40rem). Not confirmed for the drawing at the level
  I read (a shell-standard responsive layout is implied by the design system, but I did not find a
  parallel `cardList`/`display:none` pair for the register specifically — see Limits). Must be
  proven present, not assumed, given the brief's warning that a sibling contract found "a whole
  phone layout no test would have caught" on another screen.
- **The exact "no fraction, no percentage, no progress bar" framing for the two headline figures**
  is preserved in the drawing's five-group note text but is not the same _shape_: the app states
  two numbers as prose; the drawing renders a five-way breakdown with per-group counts. Not a
  contradiction (the drawing explicitly says the two are additive back to the app's own figure —
  see §5), but the upgrade must keep the app's plain two-sentence read available, since that is
  what `ward-out-of-area-counts` / the two testids assert on.

### DRAWING ONLY (net new)

- Subject/detail panel ("At a glance") — no per-placement selection view exists in the app at all.
- Five-group split (`no-home` vs `no-band` as distinct groups) — a strict refinement of the app's
  single `notBanded` figure; the drawing states explicitly it "adds back to that one figure."
- Catchment lookup section, including contested-suburb handling — see §4, NOT IN THE MODEL.
- "Record a home area" and "Raise a referral (source prefilled)" actions — both marked "Not wired
  in this prototype" in the drawing itself; no `WARD_PRIMARY_ACTIONS` entry exists for
  `/mockups/ward-flow/out-of-area` today (`ward-nav.ts:512-566` — the route is absent from the
  list entirely, unlike e.g. `/mockups/ward-flow/search` which is explicitly `{ kind: "none" }`).
- Pinned beds (rail group, localStorage-only in the drawing).

### IN BOTH (wording/shape notes)

- Page title "Out of area" — identical.
- Threshold + synthetic-travel notices — drawing states they are carried "word for word" from
  `ward-distance.ts`; app imports the same two constants directly. Same text, same source.
- Unranked list order — both state it explicitly and give the same reason (a time-since-arrival
  sort would read as a repatriation priority).
- "Nothing removes anyone from this list" / "an arrival is added" — drawing's subject-panel source
  note (lines 5985-5988) closely paraphrases the app's provenance paragraph (lines 168-175); not
  verbatim, needs reconciling to one wording rather than two independently-worded truths.

## 4. Drawing-only sections: data and derivation

- **Subject panel, five-group split, "no fraction" framing:** all derivable from the existing
  `Admission[]` + `outOfAreaLedger` output — no model change. `groupOf` in the drawing (JS,
  line ~5484) is a pure re-expression of `outOfAreaLedger`'s own branches (§1); the real
  implementation must call the existing exported function, not reimplement the branches, or it
  becomes the "second reader"/second copy this project's own comments repeatedly warn against.
- **Catchment section (per-suburb lookup, contested Karratha): 🔴 NOT IN THE MODEL.**
  `ward-catchment.ts` already holds a suburb→team lookup with an exported `contested` state
  (module header, lines 1-30) — the _derivation_ exists. But `Admission` (`ward-admissions.ts:288+`)
  carries **no `suburb` field**, only `homeRegion` (the ten broad regions). The field's own doc
  comment (lines 422-444) states this is an **open owner ruling, not an oversight**: _"If suburb
  becomes the recorded fact and region is derived from it, this field's authority moves, and
  writing a region here first would give one fact two homes — the thing the changeable-data rule
  exists to forbid."_ Building the catchment section as drawn requires either (a) waiting for that
  ruling, or (b) getting a fresh owner decision specifically authorising a `suburb` field on
  `Admission` before this section can be wired to real data. Until then this section can only ever
  render placeholder/no-data state, and pretending otherwise (inventing a per-placement suburb)
  reopens the exact seam the field's comment says must stay closed.
- **"Record a home area" / "Raise a referral (prefilled)" actions:** need a `WARD_PRIMARY_ACTIONS`
  entry (`ward-nav.ts:512`) for this route. The current architecture is documented as "one primary
  action per route" (ward-nav.ts:425) — the drawing wants _two_ concurrent action affordances (a
  menu-triggered "New referral" and a separate primary "Record a home area" button). That is an
  architecture decision, not a data question — flag to hand back if the owner hasn't ruled on it.
- **Pinned beds:** purely a rail/localStorage feature, no model dependency, but needs the rail's
  existing "Pinned" capability (if any) checked for reuse rather than a second implementation —
  outside what I read; flag as unresolved (see Limits).

## 5. The truthfulness constraint — checked against current code, not the brief's framing

⚠️ The brief's own framing is **stale**. It states admissions are "not in reducer state and
nothing on these screens adds to or removes from that list." `out-of-area-board.tsx`'s doc comment
(lines 47-52) says this directly: _"THE ADMISSIONS COME FROM THE PROVIDER, AND UNTIL 2026-08-30 THEY
CAME FROM THE SEED... Both had stopped being true: `seedWardFlowState` carries `admissions`, and the
reducer appends one."_ Arrivals genuinely are added live now (`PATIENT_ARRIVED`).

The **live guard** is narrower and still fully in force: `tests/ward-out-of-area-live-state.dom.test.tsx`,
the test _"⚠️ DOES NOT IMPORT THE ADMISSIONS SEED AT ALL"_ (lines 78-87), asserts
`out-of-area-board.tsx`'s own source text does **not** contain `"ward-admissions-seed"`, with the
stated reason: _"this screen must take its admissions from the provider, which re-anchors them to
the same clock `now` is on. Importing the seed module here is the whole defect: a default nobody
passes, subtracted from a clock that has moved."_ This is a guard against a **second, unanchored
reader of the frozen seed module** re-entering the board file directly — not a guard on whether the
list can grow or shrink.

**Would anything the drawing adds falsify this?** No, on what I read. Every drawing-only feature
(subject panel, five groups, catchment display, pinning) reads the _same_ `admissions`/`units`/`now`
already flowing through the provider — none of them needs a second import of the seed module. The
one candidate that could tempt a second reader — "Record a home area" writing a value onto an
admission — is a **write** through the existing reducer, not an alternate read path, so it does not
touch this guard either. **Caveat:** if the catchment section (§4) is ever wired against a
`suburb` field added directly to the seed fixture rather than threaded through `WardFlowProvider`,
that would recreate exactly the shape this test exists to catch — the catcher in §7 covers it.

## 6. Owner decisions binding this build

`docs/ward-flow/archive/dated-notes/owner-decisions-2026-09-1x.md`:

- **Q-2** (line 48): _"Does home area limit which ward a patient may go to? NO — catchment is
  INFORMATION, never a filter. No bed is hidden or excluded by where someone lives, until a real
  mapping exists."_ The drawing's catchment section complies — it states facts side by side and
  draws no conclusion (matches the board's own comment, out-of-area-board.tsx is silent on
  catchment entirely today, so this is genuinely new ground, not a contradiction of existing code).
- **Q-5** (line 51): _"Ten region teams, or sixty-five catchment teams? The sixty-five, every one
  marked as invented. The ten are retired when the owner supplies the real list."_ The drawing
  keeps _both_ the ten `HOME_AREAS` (for travel-band lookup) and a suburb-keyed catchment table —
  consistent with today's model, where `homeRegion` (10) and catchment-by-suburb (65, in
  `ward-catchment.ts`) are two separate, not-yet-joined facts.
- Lines 78-79: _"Catchment is information. This does not license a builder to compute, infer or
  display a catchment relationship the model does not already hold."_ Directly governs §4: the
  lookup table exists, but the per-_admission_ suburb it would be keyed on does not — so today
  there is nothing on any real admission to display it against.
- The changeable-data rule (line 170, and repeated in `ward-admissions.ts:432-444`): every invented
  figure discloses itself in its own sentence. The drawing complies throughout (SYNTHETIC/invented
  notices verbatim, "invented" stated per table). Must carry forward unchanged.

## 7. Catchers, per changed section

- **Governance banner / medical-device sentence (APP ONLY risk):** a DOM test asserting the exact
  sentence text is present and **not** inside a `title`/`aria-label`-only attribute — i.e. present
  in accessible _text content_, not just on hover. Extend or replace `ward-out-of-area-governance`
  coverage.
- **Phone card list:** a Playwright/DOM check at <40rem viewport asserting the card list renders
  and the table is hidden, mirroring the existing card testids — do not let this slip during a
  redesign that changes the CSS module.
- **Five-group split:** a unit test asserting `no-home` count + `no-band` count === `outOfAreaLedger`'s
  existing `notBanded`, for every fixture already used by `ward-out-of-area-live-state.dom.test.tsx`.
- **Catchment section:** no catcher can be written until the model decision (§4) lands — the
  catcher IS the owner ruling plus a new `Admission.suburb` field with its own migration of
  meaning, not a screen-level test.
- **Primary actions:** a `tests/ward-nav.test.ts`-style entry proving `/mockups/ward-flow/out-of-area`
  resolves to whatever `WARD_PRIMARY_ACTIONS` entry is decided (or explicitly `{ kind: "none" }`
  if the owner rejects a new action for this route).
- **Truthfulness/seed guard:** no new catcher needed if built as scoped in §5; if the catchment
  section is later wired to a fixture-level suburb rather than through the provider, re-run
  `tests/ward-out-of-area-live-state.dom.test.tsx`'s "DOES NOT IMPORT THE ADMISSIONS SEED" test —
  it will catch a same-shaped regression.
- **Unranked order:** the existing figure-direction test plus a new assertion that the five-group
  render order matches `GROUPS` array order and is never re-sorted by elapsed time.

## Limits of this reading

- I did not open `ward-catchment.ts` past its header comment (~60 lines of a much longer file) —
  I did not verify the full alias table or exact `contested` predicate signature.
- I did not check whether the drawing's phone breakpoint actually hides the register table the way
  the app's `out-of-area.module.css` does — I found the app's rule but not a matching one in the
  drawing's ~2000 lines of CSS in the time available; flagged as APP ONLY above but unconfirmed
  either way for the drawing side, which is itself worth surfacing rather than guessing.
- I did not read the "Tools"/"Activity"/"Tasks" drawer content in the drawing in detail, nor
  compare it against what the shared `WardBar`/`WardRail` shell currently renders for other
  screens — I confirmed the shell mounts globally but not that its _content_ for this route matches
  the drawing's specifics (search index entries, pinned-beds capability already existing or not).
- I did not open `ward-nav.ts`'s default behaviour for a route absent from `WARD_PRIMARY_ACTIONS`
  (whether it silently renders nothing or is treated as a bug) — flagged as a decision to hand
  back rather than assumed.
- I did not run any test, server, or build — this is a static reading only, per the brief.

**Decision this brief does not cover:** whether "Record a home area" and "Raise a referral" can
coexist as two concurrent bar actions on one route, given the documented one-primary-action-per-route
architecture. Handing that back rather than choosing for the owner.
