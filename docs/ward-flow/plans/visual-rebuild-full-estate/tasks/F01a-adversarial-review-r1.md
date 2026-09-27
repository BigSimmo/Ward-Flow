# F01a Movements adversarial review (r1)

Compared current Movements source/CSS with the preserved F01a snapshot and reviewed `F01-movements-report-r1.md`. No tests, browser, server, or Git mutation performed.

## Actionable defect

- `src/components/ward-management/movements/movements-screen.tsx:218`: `.trafficMap` has `aria-label="Carried corridor diagram"` but no semantic role. A generic `div` does not reliably expose an accessible name, so the diagram label can be absent from the accessibility tree. Add the appropriate non-interactive semantic (most likely `role="img"`, matching the project's chart/diagram contract) while retaining the visible corridor text and the separate labelled ranked rail. Confirm the chosen role against the existing diagram convention before implementation.

## Review outcome

The six day metrics are derived from current populations/state: open movements, resolved today, tier-1 open, transport legs, open movements without a booked leg, and carried corridors. Corridor paths and the ranked rail read the same `corridors` data; origin/ward labels use current engine collections with explicit unresolved-record wording. Existing Every/Resolved tabs, three order radios, row links, drawer selection/actions, transport/stage summaries, closed-row marking, and reconciliation remain present. The new CSS supplies 6/3/2 metric wrapping, 2-column-to-1-column work-area changes, corridor rail stacking, 48px controls, focus rings, and print/portal rules. No additional concrete cascade or retained-behavior defect was established by source review.

Visual questions remain controller-owned: compare served drawing at 390/820/1440 in both themes, especially metric wrapping, corridor legibility, and movement drawer placement.

Process note: the requested `before-bed-map` snapshot was absent from the estate snapshot directory; this review does not treat an unchanged HEAD copy as a before-state.
