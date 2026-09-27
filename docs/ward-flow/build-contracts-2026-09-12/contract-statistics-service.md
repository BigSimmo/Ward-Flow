# Contract — Service statistics (`statistics/service/[serviceId]`)

Written 2026-09-12, before any edit, per §3 of `AGENT-BRIEF-COMMON.md`. No contract existed for
this screen before this file.

**Files compared:**

- Drawing: `docs/ward-flow/mockups/statistics-service-third-edition.html` (9,681 lines)
- Route: `src/app/mockups/ward-flow/statistics/service/[serviceId]/page.tsx`
- Component: `src/components/ward-management/statistics/statistics-service-screen.tsx` (492 lines)
- Existing test: `tests/ward-statistics-service-screen.dom.test.tsx` (247 lines, 12 cases already
  green before this task)

**Headline finding: the screen is already built, in detail, past the drawing in places.** This is
not a case of a stub needing content — the component carries five real panels, a not-found state,
per-item invented-figure provenance, and commentary recording at least two prior owner rulings
(2026-09-01, 2026-09-07) that postdate the drawing. The three-way diff below found exactly **one**
real content gap worth building, several drawing-only chrome/flourish items the rest of the
statistics family has already, consistently, chosen not to port, and a longer APP ONLY list that
must simply be left alone.

## IN BOTH

| Claim                                                                                                                           | Drawing                                                                                                                         | App                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Page title is the service's own name                                                                                            | `docs/…third-edition.html:4892,5015` (`<h1>Service statistics</h1>` + `<h2 id="scopeH">North Metropolitan Health Service</h2>`) | `statistics-service-screen.tsx:216` (`title={service}`)                                                               |
| Identity note: "a name and a count of real records, and nothing else"                                                           | `…html:5023-5026`                                                                                                               | `statistics-service-screen.tsx:228-231`                                                                               |
| "Ready" names one number: the smaller of allocatable and empty                                                                  | `…html:5052-5055`                                                                                                               | `statistics-service-screen.tsx:237-240`                                                                               |
| Ready-beds table: ward, cohort, ready beds, total row                                                                           | `…html:5058-5062` (`#readyTable`)                                                                                               | `statistics-service-screen.tsx:283-307` (`WardTable`)                                                                 |
| Live-figures footer note (not a snapshot)                                                                                       | `…html:5063-5066`                                                                                                               | `statistics-service-screen.tsx:309-312`                                                                               |
| Placement panel: raised / within-service / accepted-elsewhere sentence                                                          | `…html:5219` (`referrals: {raised, withinService, elsewhere}`) rendered `…html:5634-5652`                                       | `statistics-service-screen.tsx:325-332`                                                                               |
| Per-other-service breakdown, including services at nought                                                                       | `…html:5220-5224` (`WACHS, n: 0`)                                                                                               | `statistics-service-screen.tsx:151-153,334-350`; asserted `tests/ward-statistics-service-screen.dom.test.tsx:145-152` |
| Unresolved-ward count sentence                                                                                                  | `…html:5663-5673`                                                                                                               | `statistics-service-screen.tsx:352-358`                                                                               |
| "Not yet accepted anywhere" caveat — narrower than "nobody answered", names queued/declined/community-team as indistinguishable | `…html:5674-5680`                                                                                                               | `statistics-service-screen.tsx:360-371`, pinned by `tests/…:117-142`                                                  |
| Out-of-area headline count                                                                                                      | `…html:5095,5685`                                                                                                               | `statistics-service-screen.tsx:386-389`                                                                               |
| Not-banded count, two-cause note, no shared denominator                                                                         | `…html:5107-5109,5693-5695`                                                                                                     | `statistics-service-screen.tsx:416-423`                                                                               |
| Out-of-area governance notices (invented threshold, synthetic travel times), rendered whole                                     | `…html:5237-5243`                                                                                                               | `statistics-service-screen.tsx:443-448`, imported from `ward-distance.ts`                                             |
| 30-day sent/taken-in charts, explicitly labelled demonstration data                                                             | `…html:5114-5130`                                                                                                               | `statistics-service-screen.tsx:452-463` via `DemonstrationChart`                                                      |
| Two series seeded per-service so reload of a different service doesn't repeat the wobble                                        | `…html:5206-5236` (`serviceKey`)                                                                                                | `statistics-service-screen.tsx:188-211`, asserted `tests/…:181-192`                                                   |
| "What is invented / what this cannot yet show" disclosure at the foot                                                           | `…html:5134-5161`                                                                                                               | `statistics-service-screen.tsx:465-482` via `StatFootnote` (different heading text — see DRAWING ONLY)                |
| Not-found state: never falls back to a different service, names the five real service names                                     | (owner-ruling comment, no drawing equivalent for this state)                                                                    | `statistics-service-screen.tsx:84-108`, asserted `tests/…:36-56`                                                      |

## DRAWING ONLY — present in the drawing, absent from the app, and **not being built**, with reasons

1. **The KPI tile band (`dl.band`) under every panel header**
   (`…html:5057` `readyBand`, `5081` `placementBand`, `5105` `outOfAreaBand`) — e.g. "Ready beds"
   and "Wards with none ready" as tiles, or "Raised / Accepted within / Accepted elsewhere / Not
   yet accepted" as tiles. **Not built**, because the app already conveys the same _content_ as
   prose sentences with embedded `data-testid` numbers (see IN BOTH above), and — checked directly —
   **no sibling statistics screen uses the tile-band primitive either**: `grep -n "count="` against
   `statistics-ward-screen.tsx`, `statistics-ed-screen.tsx` and `statistics-community-screen.tsx`
   returns nothing, and none imports `WardFigureStrip`/`WardFigure`
   (`src/components/ward-management/ward-figure.tsx`). The family has a consistent, deliberate
   translation of the drawing's KPI chrome into prose; adding tiles here only would be a new,
   unilateral idiom for one screen in a family of five.
2. **The `WardPanel` header `count` badge** (drawing's `readyCount`, `placementCount`,
   `outOfAreaCount`, `identityCount` spans, e.g. `…html:5045`) — `WardPanel` supports a `count` prop
   (`src/components/ward-management/ward-panel.tsx:19,35-39`) but **no statistics-family screen
   passes it** (checked `statistics-ward-screen.tsx`, `statistics-ed-screen.tsx`,
   `statistics-community-screen.tsx` — no `count=` call site in any). Same reasoning as (1): a
   family-wide convention, not an oversight local to this screen.
3. **The "Snapshot" identity fact** — drawing's `dl.slFacts` carries a `Snapshot` row showing the
   frozen clock and date (`…html:5034-5035`, rendered `…html:5595` as `"10:42 AWST, Saturday 15
August 2026"`). **Not built**, for two reasons: the drawing is a frozen mockup with one fixed
   instant, while this screen reads a live `now` from `useWardFlow()`
   (`statistics-service-screen.tsx:77`) that changes on every render — a static "Snapshot" label
   would misdescribe a live figure as a point-in-time capture; and the screen's own footer already
   states the opposite explicitly: _"not a snapshot, and not the figure this ward showed a minute
   ago"_ (`statistics-service-screen.tsx:310-311`). Adding a field labelled Snapshot would
   contradict a sentence already on the same page.
4. **The descriptive clause "one of the network's health services, a group of hospital sites rather
   than a single hospital"** (`…html:5019-5022`, `class="teamLine"`) — minor framing prose. Not
   built: the same fact is already implied by the panel content (a list of the service's own sites,
   wards and EDs) and by the screen's title being the service's own name; adding a second sentence
   asserting what the panel already shows would be restating rather than adding information.
5. **"How the numbers agree with each other" — the self-check reveal and `pageCheck` line**
   (`…html:5163-5169`, `agreeReveal`/`agreeList`/`pageCheck`, computed at `…html:5814-5829`). This
   is a real, checkable feature in the drawing (recomputing every sum client-side and reporting
   whether they reconcile) but it is **drawing-family chrome that has never been built on any
   sibling, including one the owner has already ruled DO NOT REBUILD**: `statistics-overview-screen.tsx`
   carries the identical drawing pattern (confirmed:
   `grep -c "agreeReveal\|How the numbers agree" docs/ward-flow/mockups/statistics-*-third-edition.html`
   finds it in the community, overview and service drawings alike) and its own contract records it
   was never built there either (`docs/ward-flow/build-contracts-2026-09-12/contract-statistics-overview.md:41`,
   quoting `statistics-community-screen.tsx:283-284`: _"the drawing carries 'What is invented, and
   what is real' and this screen has never had it, nor have two of its three siblings"_). Building a
   net-new self-verification widget for this screen alone, when the rest of the family has
   consistently treated it as decorative-only and one sibling was reviewed and still doesn't have
   it, is a family-wide product decision, not a single-screen upgrade — flagged below rather than
   built.
6. **The global Service-selector / search / rail / drawer chrome around the page**
   (`…html:4899-5006`) — this is the shared shell (`StatisticsSectionFrame`,
   `src/components/ward-management/statistics/statistics-section-frame.tsx`), which this screen
   does not own and which its own file header states deliberately adds no controls
   (`statistics-section-frame.tsx:36-40`). Out of scope for this screen; would be a shared-file
   edit per §1 of the common brief if it were ever wanted.

## APP ONLY — built, absent from the drawing, and **kept unchanged**

1. **The Pending/cleaning contrast sentence and its conditional "not counted from the Ready
   figures" clause** (`statistics-service-screen.tsx:241-277`, `data-testid=
"ward-statistics-service-pending-preparation"`). Checked: `grep -n "Pending\|cleaning\|maintenance"
docs/…third-edition.html` returns nothing. This reflects the owner's 2026-09-01 ruling (a ward's
   Ready figure must not lurch as cleaning starts and stops) and the 2026-09-07 correction recorded
   in the component's own comment (`:252-263`) — both postdate the drawing. **Kept, unchanged.**
2. **The whole not-found state** (`:84-108`) and its test coverage (`tests/…:36-56`) — the drawing
   is one frozen service's page and has no equivalent for an unresolved id. **Kept.**
3. **The per-item invented-figures provenance discipline** (`StatFootnote` groups at `:465-482`,
   guarded word-for-word by `tests/…:194-238` against the 2026-09-09 owner ruling that an invented
   figure must say so in its own sentence, not only under a heading). The drawing's footnote is one
   undifferentiated paragraph (`…html:5140-5161`); the app's is stricter. **Kept.**
4. **`ward-statistics-service-chooser-link`** (both on the not-found state and at the foot of a
   resolved page) — the drawing has no page-to-page navigation model since it is one frozen service;
   the app needs a route back to the hub because the route is a real dynamic segment. **Kept.**

## The one real gap: wards with none of their beds ready

The drawing's `readyBand` KPI tiles (`…html:5606-5618`) state two figures side by side: total ready
beds, and a **count of this service's own wards that currently have zero ready beds** (`"Wards with
none ready"`, computed as `wardUnits.filter(u => u.ready === 0).length`). The app currently states
the total (via the table's own footer row) but **never states the second figure anywhere on the
page** — confirmed by `grep -n "none ready\|zeroReady\|no ready beds" statistics-service-screen.tsx`
returning nothing. This is a real, honestly-computable fact (every number needed —
`readyRows`, each row's `capacity.available` — is already live data read in this component,
`:120-121`), it does not require a new component or a family-wide convention change (a prose
sentence, matching every other headline figure on this page), and a reader planning where to place
the next patient benefits from knowing not just the total but whether it is concentrated in one
ward or spread out. **This is what gets built.**

## What this contract does NOT check

- The drawing's JavaScript-computed `pageCheck`/`agreeList` values were not executed or verified
  against the app's own arithmetic — the section is not being built, so its correctness was not in
  scope.
- Every other drawing element inside the shared shell (search results, task/tool drawers, the
  Service-selector menu panel content, the New-referral and Export menus) was read only far enough
  to confirm it is shell chrome (`…html:4899-5006`) rather than page content; its exact copy against
  `StatisticsSectionFrame`'s current implementation was not re-verified line by line.
- CSS/visual parity (colours, spacing, the light/dark theming rules in the drawing's `<style>`
  block) was not compared against `statistics-service-screen.module.css` — this contract is about
  content and claims, not pixels.
- The correctness of `unitCapacity`, `openBedsNow`, `bedsPendingPreparation`, `outOfAreaLedger` and
  `siteByCode` themselves was taken on trust from their own modules and existing test suites; this
  task did not re-derive or re-verify those functions.
- Whether `WardFigureStrip`'s "at most two tiles flagged" constraint would ever bind here was not
  tested, since no tile band is being added.
