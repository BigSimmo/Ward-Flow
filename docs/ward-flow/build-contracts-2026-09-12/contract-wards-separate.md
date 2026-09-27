# Build contract — the drawing's "Wards" screen (`docs/ward-flow/mockups/wards-third-edition.html`)

Read-only research. No repo file touched. Worktree: `D:\Worktrees\Database\ward-lead`.

## 1. What the existing `/wards` screen does today

`src/components/ward-management/wards/ward-index.tsx` (`WardIndex`, rendered by
`src/app/mockups/ward-flow/wards/page.tsx:12`) is the index of every ward in the network — one
sentence: it lists every unit the live provider holds, grouped by health service, each name
linking to `/mockups/ward-flow/ward/${unit.id}` (`ward-index.tsx:250-253`).

It renders, in order:

- A governance banner: "Synthetic prototype" + "not a medical device" + the East Metro Youth
  Unit carve-out sentence (`ward-index.tsx:139-147`).
- `<h1>All wards</h1>` + subtitle (`:149-152`).
- A provenance sentence: "This is a way in, not a bed state... no bed numbers, no availability..."
  (`:160-164`).
- One `<section>` per `wardServiceOrder` service (`ward-derivations.ts:184-190`: North Metro, East
  Metro, South Metro, WACHS, Private), each a `<ul>` of ward links; each link shows `unit.cohort`
  and `wardKindWord(unit)` — "Open"/"Locked"/"Mixed", a **word never a number**
  (`ward-index.tsx:241-245`).
- A "Not placed in a health service" group for any unit whose site code doesn't resolve
  (`:189-203`).

🔴 **Digit ban.** `tests/ward-nav.test.ts`'s "is an index and not a second bed board" test
(around line 1690-1713) pins an exhaustive allowlist of every fixed sentence this page may render
and asserts `/[0-9]/.test(fragment)` is false for every rendered text fragment
(`ward-nav.test.ts:1713`). The comment block above that test (`:1613-1650`) is explicit that this
is **not a traceable owner ruling** — it is untraceable to any cited decision, attributed only to
one uncited sentence in commit `e06427196`, though the _separate_ "stays names only" restraint
was ratified by the owner on 2026-09-04 (`ward-index.tsx:24-27`, `ward-nav.test.ts:1613-1622`).
Practically: **treat both the exact copy and the digit ban as fixed**, regardless of the
provenance nuance.

This screen already sits inside the shared app shell. `src/app/mockups/ward-flow/layout.tsx`
mounts `WardRail` and `WardBarMount` (which renders `WardBar`) as ancestors of **every** route
under `/mockups/ward-flow/**`, `/wards` included (layout.tsx's own doc comment: "the third-edition
shell mounts HERE and nowhere else"). So `/wards` already renders inside the same rail + top bar
(search, Service selector, Activity/Tasks/Tools drawers, "New referral") that every other Ward
Flow screen has.

## 2. What makes the drawing's screen different — I could not find one, and I'm saying so plainly

I read the drawing's own "Wards" JS (`wards-third-edition.html:8720-8829`) expecting to find new
capability. Its own inline comments say, verbatim, that it is a redraw of the built screen:

- `wardKindWord` — "reading `ward-bed-designation.ts`'s `unitHasLockedBeds`/`unitHasOpenBeds`...
  never a number" (`:8724-8725`) — copies `ward-index.tsx`'s function by name and behaviour.
- The unplaced group — "mirroring ward-index.tsx's own 'unplaced' derivation by subtraction"
  (`:8735-8737`).
- The digit ban itself — "ward-index.tsx's own guarding test (`tests/ward-nav.test.ts`) bans any
  digit anywhere in this panel's rendered copy... because a count here is exactly the shape the
  'not a second bed board' restraint (owner ruling, 2026-09-04) exists to keep off this page"
  (`:8785-8790`).
- The governance banner and provenance sentence are the same sentences, near word-for-word
  (`wards-third-edition.html:4586-4614` vs `ward-index.tsx:139-164`) — the only textual delta is
  the drawing drops the "its bed numbers are invented" clause.

The only additions beyond what `/wards` already renders:

1. **Restructured into two `<section>` panels** ("About this list" / "All wards") instead of one
   banner-then-list flow — presentational, not a new capability.
2. **An honesty note about the (decorative) Service selector**: `wardsFilterBar` shows, only
   while a service is chosen in `WardBar`'s Service menu, "Working in `<service>` for the rail,
   the drawers and search. This list still shows every ward" plus a "Show all"/"Back to..."
   control (`:8818-8827`). This is not a filter — it exists because the shell-wide Service
   selector is present everywhere and this page must say it does not narrow the list.
3. A "network note" claiming this list reads the full 23-ward/17-site/5-service network while
   "the rest of this prototype... draws from a smaller set of sixteen wards" excluding WACHS and
   the private hospital (`:4611-4614`). **I checked this against the model and it is false for the
   built app**: `wardServiceOrder` (`ward-derivations.ts:184-190`) and `HEALTH_SERVICES`
   (`ward-model.ts:48`) both carry all five services including WACHS and Private, and
   `allUnits()` (`ward-sites.ts:741-743`) flat-maps all 17 sites with no filtering; `ward-index.tsx`
   already reads the same unfiltered `units` from the live provider. The 16-vs-23 gap is a
   **known, already-tracked discrepancy between other mockup HTML files** (Command/Capacity third
   edition carry a hand-typed 16-ward fixture; see the open item in
   `docs/outstanding-issues-inbox/66de38d8-436a-4d80-874e-6590c5947652.json`), not a fact about the
   shipped React app. Carrying that sentence into a built screen would be **false the day it
   shipped**.

**Plain statement: I cannot articulate a genuine difference in audience, question answered, or
content shown.** The drawing is, by its own comments, a faithful redraw of `ward-index.tsx`
wrapped in chrome (`WardBar`/`WardRail`) that `/wards` already inherits from the shared layout.
If this is built as drawn, the two screens will look and behave almost identically to a
coordinator — same heading, same banner, same groups, same links, same restraint. That is a
finding for the owner: either he wants two entry points to the _same_ content for a reason not
visible in the drawing or the model (e.g., one is a bare fallback and one is the "real" navigable
screen), or he is asking for a duplicate. I did not find evidence for the former in the drawing,
the model, or any doc I read.

## 3. Proposed route

`/mockups/ward-flow/wards-directory` (or `/mockups/ward-flow/ward-directory`, singular "ward" to
match the existing `ward/[unitId]` pairing) — not `/wards-index`, `/all-wards`, or anything
containing "index"/"all-wards" that could alias the existing page's own h1 text ("All wards") or
test-id namespace (`ward-index-*`, `ward-index-link-*`, `ward-index-service-*`). A fresh
`ward-directory-*` test-id prefix keeps `tests/ward-nav.test.ts`'s existing selectors
untouched and unambiguous with the new screen's own tests.

⚠️ Given the finding in §2, I'd flag to the owner before building: if the content really is meant
to be a redraw of the same index, consider naming the route to say so explicitly (e.g.
`.../wards-chromed` is ugly; a clearer product name is his call, not mine).

## 4. The drawing's sections, in order, with data source

| #   | Section                                                                                                                                                             | Data needed                                                                                                                                                                                                    | Source                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1   | Masthead: title, "Synthetic prototype" chip, search, Service menu, Activity/Tasks/Tools drawers, "New referral"                                                     | None new — reuses `WardBar` as already mounted by `layout.tsx` for every route                                                                                                                                 | `shell/ward-bar.tsx` (already built, already mounted)                                        |
| 2   | "About this list" panel: governance banner + provenance sentence + scope note                                                                                       | Static prose, identical to `ward-index.tsx:139-164`                                                                                                                                                            | Hand-written copy, no model field                                                            |
| 3   | "All wards" panel: `<h2>`, ward count placeholder (`wardsCount` — drawing sets it to the literal string "no figures on this page", never a number, at `:8792-8793`) | none rendered as a figure                                                                                                                                                                                      | n/a — text only                                                                              |
| 4   | Network note (23 wards / 17 sites / 5 services vs. "the rest of the prototype's" 16)                                                                                | 🔴 **NOT IN THE MODEL as stated** — see §2.3. The 23/17/5 figures ARE in the model (`allUnits()`, `wardSites`, `HEALTH_SERVICES`) but the claimed "smaller set of sixteen" contrast is false for the built app | `ward-sites.ts:741-743`, `ward-model.ts:48`, `ward-derivations.ts:184-190`                   |
| 5   | Filter/status bar (`wardsFilterBar`) — only visible while a service is selected in the (decorative) Service menu                                                    | The chosen service, from `WardBar`'s local `service` state — **not exposed anywhere `onServiceChange` is wired**, so a real page would need its own local read of that same unwired seam                       | `shell/ward-bar.tsx:226,291-306` (`onServiceChange` prop exists, nothing calls it)           |
| 6   | Ward groups by `wardServiceOrder`, each a `<ul>` of `{name, cohort, wardKindWord}` links                                                                            | Direct match: `wardServiceOrder`, `siteByCode(unit.siteCode)?.service`, `unit.cohort`, `unitHasLockedBeds`/`unitHasOpenBeds`                                                                                   | `ward-derivations.ts:184-190`, `ward-sites.ts:764` (`siteByCode`), `ward-bed-designation.ts` |
| 7   | "Not placed in a health service" group                                                                                                                              | Units whose `siteByCode` resolves to `undefined`                                                                                                                                                               | Same derivation as `ward-index.tsx:130-134`                                                  |
| 8   | "Each ward name opens the ward reference screen..." footnote                                                                                                        | Static prose                                                                                                                                                                                                   | n/a                                                                                          |

## 5. What cannot be built honestly

- 🔴 **Confirmed, as briefed**: there is no global "selected service" concept that scopes
  anything. `HealthService` is a per-unit/per-site attribute only (`ward-model.ts:48-49`,
  `ward-sites.ts` per-site `service:` field). `WardBar`'s Service selector is explicitly
  documented as decorative: its own panel copy reads "not wired in this prototype" and the code
  comment states plainly that `service` is "component-local state read by nothing outside this
  trigger's own label... `onServiceChange` is an unwired seam nobody calls yet"
  (`shell/ward-bar.tsx:416-425,443-449`). So a new Wards screen gets this control for free by
  living under the same layout, but it will do nothing, and the drawing already knows that (its
  own honesty note in §2.2 exists for exactly this reason) — that part of the drawing is buildable
  honestly.
- **Activity/Tasks tallies**: also confirmed unavailable as a _global_ count. `WardBar`'s Activity
  drawer takes an optional per-page `activity: WardActivityContent` prop
  (`shell/ward-bar.tsx:215-216`) — a route must supply its own tally or the drawer shows its
  built-in "not available" fallback. There is no ward-network-wide activity/task tally in the
  model to feed it; a new Wards screen would either pass nothing (honest, understated) or would
  need someone to define what "activity" means for a directory page that shows no bed data at all
  — a product decision, not a gap I can fill here.
- **The "smaller set of sixteen wards" sentence (§2.3)** cannot be built honestly as worded — it
  is false against the live model. Any real version of this section would need different wording,
  which is the owner's or the implementer's call once told the fact is wrong.

## 6. Catchers, and the merge guard

Per section:

1. Masthead — a snapshot/contract test asserting the new route renders `data-testid="ward-bar-*"`
   (proves it inherited the shared shell, not a duplicate hand-rolled header).
   2–3. About/All-wards panels — a fixed-copy allowlist test in the same shape as
   `ward-nav.test.ts`'s "is an index and not a second bed board" (own file, own testids).
2. Network note — a test that fails if the sentence is ever re-added while `wardServiceOrder`/
   `HEALTH_SERVICES` still include WACHS/Private with no other filtering elsewhere (i.e., a test
   that would go red today if this sentence's factual claim were literally coded).
3. Filter/status bar — since `onServiceChange` is unwired, either don't build this section at all,
   or a test asserting it never claims to narrow the list (banned words: "narrowed to", "showing
   only", any digit).
   6–7. Ward groups / unplaced — reuse `ward-nav.test.ts`'s own pattern: equality between rendered
   links and `allUnits().map(u => u.id)`, sorted, deduped; explicit unplaced-group test with a
   synthetic broken site code.
4. Footnote — static-copy assertion, same allowlist file as items 2–3.

🔴 **The merge guard the owner's instruction needs**: a test (new file, e.g.
tests/ward-directory-separate.test.ts (gone — directory-separate suite deleted)) asserting that `WardIndex`
(`src/components/ward-management/wards/ward-index.tsx`) is **not imported** by the new screen's
component file, and that the new screen's component file is **not imported** by
`src/app/mockups/ward-flow/wards/page.tsx`. Concretely: grep-based or `import`-graph assertion
that the two page files' component trees share no common named export beyond the shared model/
derivation modules (`ward-model.ts`, `ward-sites.ts`, `ward-derivations.ts`, `ward-bed-
designation.ts`) and the shared shell (`WardBar`, `WardRail`). This is the guard that goes red the
day someone "helpfully" merges the two screens or points one route's page at the other's
component — the exact outcome the owner's twice-repeated instruction rules out.

## Limits of this reading

- I read `ward-index.tsx`, its test file's relevant sections (not the full 1800+ lines), the
  drawing's masthead markup and its Wards-specific JS (~200 lines around line 8700-8830), and the
  layout/shell files (`layout.tsx`, `ward-bar.tsx`) only for the passages that answer this brief.
  I did not read the drawing's CSS, its Activity/Tasks/Tools renderers, or `ward-nav.ts` in full.
- I did not check `ward-catchment.ts` at all — I found nothing in the drawing's Wards section that
  calls for it, but I have not read it to confirm it is irrelevant.
- I have not run any test, server, or build — everything above is static reading, as instructed.
- The "no genuine difference" finding in §2 is my read of the evidence, not a ruling — it is the
  thing the brief says to report loudly rather than resolve.

If a decision arises that this brief doesn't cover, it should go back to the owner rather than be
guessed at here.
