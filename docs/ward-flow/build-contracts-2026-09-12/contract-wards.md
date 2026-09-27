# Build contract — Wards (the ward index)

Drawing: `docs/ward-flow/mockups/wards-third-edition.html`
Built screen under review: `src/app/mockups/ward-flow/wards/page.tsx` → `src/components/ward-management/wards/ward-index.tsx`

## 1. Does this screen already exist?

**Yes — in full, not in part.** Route `src/app/mockups/ward-flow/wards/page.tsx:11-13` renders
`<WardIndex />`. Tried three names before concluding this: "wards index" (found
`ward-index.tsx`), "all wards" (found the literal string as this screen's own `<h1>`,
`ward-index.tsx:150`), and the mockup's own distinctive phrase "not a second bed board" (found
verbatim as the guarding test's own description, `tests/ward-nav.test.ts:1619`, `it("is an index
and not a second bed board...")`).

This is the screen the owner's ruling renamed. `ward-index.tsx:14` names its own purpose: "the
ward index — every ward in the network, grouped by health service, each one a link to its own
ward screen" — i.e. the same table-turned-index the brief describes, already built as its own
route rather than a section of the capacity screen.

## 2. What are the screen's sections, in drawing order?

1. Header chrome shared by every Ward Flow mockup page — universal search, a "Service" scope
   menu, Activity/Tasks/Tools drawers, "New referral" menu (`wards-third-edition.html:4490-4570`).
2. **"About this list"** panel — governance note, "a way in, not a bed state" note, and a
   service-scope note (`wards-third-edition.html:4583-4597`).
3. **"All wards"** panel — heading + count chip, subtitle, a network-provenance note (23 wards /
   17 sites / 5 services vs. a smaller 16-ward set elsewhere in _this mockup_), a filter bar tied
   to the service scope, the grouped ward list itself, and a closing note about deep-linking
   (`wards-third-edition.html:4605-4620`).

The built screen has exactly panel 3's content, minus the filter bar and the 23-vs-16 note (see
§4), folded together with panel 2's two governance/provenance notes as plain paragraphs rather
than a separately headed panel (`ward-index.tsx:139-164`). There is no second, separately titled
"About this list" heading in the built markup — its content is present, its heading is not.

## 3. Data per section — model coverage

- **Ward list, grouped by service, in service order.** `wardServiceOrder`
  (`src/components/ward-management/ward-derivations.ts:184-190`) supplies the fixed order; each
  group's members come from live `units` (`useWardFlow()`) filtered by
  `siteByCode(unit.siteCode)?.service` (`ward-index.tsx:112-128`). `allUnits()`
  (`src/components/ward-management/ward-sites.ts:741-743`) flattens all 17 sites' units, and the
  provider clones that whole set (per `ward-index.tsx:88-91`) — so, unlike the static mockup's
  admitted 23-vs-16 split, the built app has ONE ward population everywhere, not two.
- **Ward name, cohort, "Open/Locked/Mixed" word.** Straight fields on `Unit`, and
  `wardKindWord()` (`ward-index.tsx:241-245`) derived from `unitHasLockedBeds`/`unitHasOpenBeds`
  (`src/components/ward-management/ward-bed-designation.ts`), exactly as the mockup's own
  comment says it should be (`wards-third-edition.html:8501-8511`).
- **Link to the ward's own screen.** `href={`/mockups/ward-flow/ward/${unit.id}`}`
  (`ward-index.tsx:250-253`) — a real per-ward deep link. Model has it; in fact the built screen
  is ahead of the drawing here (§4).
- **"Not placed in a health service" group.** Derived by subtraction from the rendered groups
  (`ward-index.tsx:130-134`), matching the mockup's own `wardsUnplaced()`
  (`wards-third-edition.html:8767-8769`).
- **Governance/provenance copy.** Static strings, not derived — fine, since they're prose, not
  figures (`ward-index.tsx:139-164`).
- **The count chip, the filter bar, and the "chosen service does not narrow this list" note.**
  🔴 **NOT IN THE MODEL, and not by omission — by design.** See §4.

## 4. 🔴 What cannot be built honestly

**A. The shared header chrome (universal search, a global "Service" scope, Activity/Tasks/Tools
drawers, "New referral" menu) does not exist anywhere in the built app**, for this screen or any
other. The real shell is `WardGround`/`WardShellHeader`
(`src/components/ward-management/ward-shell.tsx:31-78`) — a wrapper `div` plus a single "place"
label — and navigation lives in `ClinicalRail`
(`src/components/ward-management/ward-management-navigation.tsx`). Neither carries a
cross-screen "selected service" concept: `HealthService` (`ward-model.ts:49`) is a per-site/unit
attribute only, never a piece of app-wide filter state (confirmed by an empty grep for
`selectedService`/`scopeName`/`svcBefore` across `src/components/ward-management/`). Building the
drawing's header honestly would need a new app-wide scope-selection state threaded through every
route, plus real sources for "Activity" and "Tasks" tallies and a "Tools" contact directory —
none of which is this screen's own; it is shared infrastructure the whole mockup set assumes and
none of the built app has.
**B. The count chip and the "23 wards / 17 sites / 5 services vs. a smaller 16-ward set
elsewhere" note are a fact about the static mockup's OWN split fixtures**, not about this
codebase — the built app has one ward population everywhere (§3), so there is nothing true left
for that note to say, and the digit-ban ruling below already forbids a count chip regardless.

Nothing else in the drawing's two content panels is unsupported — the remainder is either already
built or is prose the model does not need to derive.

## 5. Which owner decisions bind this screen?

No entry in `docs/ward-flow/archive/dated-notes/owner-decisions-2026-09-1x.md` names "Wards", "ward index", "All
wards", or "second bed board" (checked by grep; zero hits). The ruling that actually governs this
screen predates that file: `ward-index.tsx:24-27` cites an owner ruling **2026-09-04** — put to
him as "should this page show any figures at all," answered **names only, no bed count, no
availability, no occupancy, no pressure colour** — recorded in this component's own doc comment,
not in the 2026-09-1x decisions file. `ward-index.tsx:35-47` is explicit that the _wording and
digit-ban restraint itself_ is **untraceable to any owner ruling**, not merely inferred — worth
repeating rather than compressing, since the file's own comment warns against exactly that
compression.

⚠️ The drawing's "23 vs 16 wards" note and its service-scoped filter bar were drawn before, and
are not contradicted by, any 2026-09-1x ruling — they simply describe the static mockup's own
local inconsistency, which the built single-source model does not have.

## 6. What would the catcher be?

- **Panel content, exact wording, and the digit ban** — `tests/ward-nav.test.ts:1619` ("is an
  index and not a second bed board"), an exhaustive allowlist of every string this page may
  render plus a hard ban on any digit in the rendered markup (`tests/ward-nav.test.ts:1495-1717`).
- **Grouping and order** — `tests/ward-nav.test.ts:1556` ("groups the wards under the health
  services in wardServiceOrder, in that order").
- **Unplaced-site conservative failure** — `tests/ward-nav.test.ts:1569-1587`.
- **Every ward reachable, exactly once, uniquely addressable** —
  `tests/ward-nav.test.ts:1522-1618`.
- **Route not orphaned** — `tests/ward-nav.test.ts:705` (dynamic-route reference coverage).
- **The shared header chrome (§4A)** — 🔴 **no catcher exists, because nothing exists to catch.**
  That is a defect in the brief for anyone asked to build it, not something to skip past: before
  it is built, the owner needs to rule on what "Activity"/"Tasks" actually count and what a
  cross-screen service scope means for every OTHER Ward Flow screen, since that state does not
  belong to Wards alone.

## The limits of my reading

Static reading only, as instructed — no test was run, no server was started, nothing was edited.
I read the drawing's HTML/JS structurally (headings, the `WARDS` fixture, the render functions)
rather than rendering it, and I read the built screen, its route, its two model files
(`ward-derivations.ts`, `ward-sites.ts`) and its guarding test file by grep and targeted excerpt
rather than end to end — `tests/ward-nav.test.ts` is 1800+ lines and I read the sections that
name this screen, not the whole file. I did not open `ward-referrals.ts` or `ward-catchment.ts`
in detail; nothing in this screen's two panels appeared to need them, but I did not prove that
negative exhaustively. I did not check `docs/ward-flow/archive/dated-notes/owner-decisions-2026-09-1x.md` for
decisions that bind the _shared header chrome_ by name (e.g., a service-scope ruling filed under
a different screen's heading) — only for this screen's own name, which does not appear there.
