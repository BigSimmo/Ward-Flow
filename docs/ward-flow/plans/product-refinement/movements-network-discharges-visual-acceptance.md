# Movements, Network and Discharges — Q004 visual acceptance

Reviewed 2026-09-13 under the active lean visual policy. **All three routes are recommended for scoped canonical Q004 acceptance.** No numerical score is assigned.

## Movements

The current live evidence under `.superpowers/sdd/2026-09-13-product-refinement/screens/` is:

- `movements-refined-light-1440.png` and `movements-refined-worklist-light-1440.png`
- `q004-review-movements-dark-1440.png` and `q004-review-movements-attention-dark-1440.png`
- `q004-review-movements-worklist-light-390.png`

These were compared with `movements-reference-dark-1440.png` and `movements-worklist-reference-light-1440.png`. The live screen keeps the drawing's day, attention, traffic, worklist and day-shape hierarchy while using the actual 50-movement population and recorded blockers, stages, routes, ownership and timing.

The desktop pair shows readable light/dark metric bands, the bounded traffic diagram and corridor list, and the two-column worklist/summary composition. The explicit attention capture shows WF-315 focused and highlighted in the worklist without opening its detail, with the full reason, route, owner and actions still visible. At 390, long operational facts wrap without horizontal clipping and both row actions remain reachable. No material contrast, density, clipping or interaction defect was found.

The existing 30/30 focused Movements evidence and four interaction cases are reused for stage/order grouping, attention reveal and focus, no replay after changing order, repeated reveal and summary navigation. Every tab/order, print and physical-device behavior were not visually repeated here.

## Network

Served design references are `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/network-reference-{1440,390}-light.png`. Current live evidence is:

- `q004-review-network-overview-{light,dark}-1440.png`
- `q004-review-network-overview-footer-{light,dark}-1440.png`
- `q004-review-network-referral-fixed-{light,dark}-1440.png`
- `q004-review-network-pipeline-fixed-light-390.png`
- `q004-review-network-bands-fixed-light-390.png`
- `q004-review-network-summary-fixed-light-390.png`

The overview preserves all eight emergency departments and all 23 inpatient units. Waiting, service, Ready, Held, Blocked, Occupied, Confirmed and Expected facts remain readable in both themes, with explicit bounded diagram scrolling and the concise all-unit/schematic footer.

The selected RF-001 journey uses a real queued referral. Every unit remains in the band arrangement and each non-accepting unit retains one recorded reason. The light/dark desktop captures show the priority and referral queues, pipeline totals, full band arrangement, legend and referral summary within separate bounded panels. The 390 captures demonstrate the long all-unit arrangement in natural document flow; the selected summary remains reachable after it rather than being duplicated or fixed over the content.

Direct review reproduced two material presentation issues and verified their corrections. The seven pipeline cells no longer collide at 390: six waiting stages use a readable two-column grid and Left the pathway spans the full row with its arrived/did-not-proceed split intact. Duplicate explanatory paragraphs were reduced to one visible warning: the bands are synthetic and based on recorded home region, the picture is not a map, and exact location and measured hospital travel times are not recorded. The selected summary retains the concise boundary “No automatic allocation.” The shared role-focus banner remains outside this Network-owned correction.

The correction changed `ward-management-network.tsx`, `ward-management-network.module.css` and one existing assertion in `tests/ward-network-referral-placement.dom.test.tsx`. Before copies are under `.superpowers/sdd/2026-09-13-product-refinement/task-12-network-review-before/`. The assertion still requires exactly one visible local limitation with every safety fact above and retains the whole-screen comparative-proximity prohibition.

The first two focused Network attempts did not start because another Ward audit held test capacity; the lease was not bypassed. After the audit process ended, the controller used normal admission for the single affected file. The runner reported **1 file handed in / 1 ran, 17 collected, 17 passed, 0 failed** (`C:/Users/joshs/AppData/Local/Temp/ward-tests-olyegs/report-0.json`). This includes the changed visible-warning assertion. Existing integration evidence is reused for unchanged Network behavior.

## Discharges

The served reference is `discharges-reference-1440.png`. Current live evidence is:

- `q004-review-discharges-anonymous-light-1440.png`
- `q004-review-discharges-linked-dark-1440.png`
- `q004-review-discharges-linked-light-820.png`
- `q004-review-discharges-linked-detail-light-820.png`
- `q004-review-discharges-linked-detail-light-390.png`

The light desktop default preserves the nine anonymous releases and their 2 blocked, 2 confirmed, 4 expected and 1 discharged-in-24-hours partition in one grouped table. Blockers, timing, stages and exclusion totals remain visible. The dark desktop state shows the separate 222-record admission population with the linked patient selected and the guarded detail beside the register; no population totals are combined.

At 820 the selected row remains clear in the bounded worklist and the full-width selected detail is reachable below it. At 390 the selected detail appears before the worklist, every recorded date/destination absence remains readable, and Open full ward is fully visible. The latest padding/divider composition introduces no material clipping, crowding or detached controls.

The focused Discharges 10/10 evidence and the 209-test integration evidence are reused for grouping, counts, guarded detail access, selection/filter invalidation and cross-screen behavior. Printed filter scope, every filter/empty/denied combination, physical-device behavior and every theme/width combination were not visually exercised here.

## Acceptance limits

The drawings establish hierarchy rather than fixture values or clinical rules. Actual populations, recorded missingness, guarded identity and the existing engine's stage/count meanings were retained rather than altered to match illustrative reference data.

No material visual gap remains in the inspected local scope. The three routes were not exhaustively repeated across every state, width and theme; print, hosted behavior and physical devices remain unverified. Those are explicit coverage limits rather than blockers under the active lean policy. No provider or Git operation was performed for this review.
