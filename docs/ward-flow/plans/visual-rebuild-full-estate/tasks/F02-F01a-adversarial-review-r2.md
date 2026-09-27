# F02/F13a + F01a adversarial review r2

Scope: bounded source-only review of current Ward/Ward Answer and TrafficDiagram changes against the supplied before snapshots. No source edits, tests, browser, server, provider, or Git mutation.

## Verdict

No concrete defect found in this batch.

## Ward structure and Answer route

- `WardScreen` keeps one reducer/state reader and selects presentation explicitly. The Answer branch derives `incoming` from the same ward-scoped live state, renders a single request when non-empty, and renders the explicit no-referral absence sentence otherwise. Previous/Next clamps against the current array after actions remove a request.
- Overview source still mounts identity, entry, bed figures/forms, Coming in, Awaiting your answer, daily return, leave-bed, attention, and disclosure sections. CSS ordering changes the visual composition deliberately; the Answer selector explicitly hides overview-only children and leaves Answer navigation, the incoming section, and governance disclosure reachable.
- Existing accept, decline, override/rejection, pull/release, capacity, preparation, leave-bed, and daily-return controls remain in source. No action/refusal branch was deleted. `Worth your attention` remains derived from pending preparation, blocked-today breakdown, and refresh-request state; no synthetic attention or “Going out” count was added.
- Ward-scoped referral visibility remains intact: no other-destination list or parallel-referral count is rendered. The established FD-23/ward-scoped refusal wording and action gates remain unchanged.
- The Ward facts definition lists use wrapper divs containing only `dt`/`dd`; no nested invalid paragraph was found in these files.

## Movements TrafficDiagram

- `movements-screen.tsx` continues to obtain `corridors` from `corridorCounts(movements)` and applies the prior deterministic count-descending/origin-id ordering before rendering.
- `TrafficDiagram` uses that same array for SVG paths and ranked rail, without an additional filter or sort. Endpoint label sorting only determines vertical endpoint placement. Refused/unaccepted corridors remain excluded and explicitly explained; unknown ED/unit ids retain record-level fallback text.
- The diagram region is keyboard focusable and the SVG has a derived accessible label. The new component does not alter the existing stage/order/tab/action surfaces.

## Evidence limits

`before-F02-visual-r7` contains only the pre-visual Ward TSX/CSS snapshot; the newly added Answer route is inherently absent. `before-F01a` predates the new TrafficDiagram component, so there is no prior component file for byte-level comparison. Direct source review does not prove rendered CSS order, phone overflow, focus, or dark-theme appearance.
