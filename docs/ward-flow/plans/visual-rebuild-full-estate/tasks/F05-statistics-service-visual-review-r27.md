# F05 Service statistics visual review r27

Date: 2026-09-13  
Reviewer: gpt-5.6-sol / medium  
Scope: independent rendered review only; Service statistics was implemented by this reviewer in an earlier task, so this is a closure check rather than independent implementation review.

## Evidence reviewed

I viewed all 22 supplied PNGs at original detail:

- Six paired app/drawing cells at 390, 820, and 1440 px in light and dark: `statistics-service-current-{app,mock}-{390,820,1440}-{light,dark}-r27.png`.
- Six app lower-page cells at the same widths and themes: `statistics-service-lower-app-{390,820,1440}-{light,dark}-r27.png`.
- Four focused phone cells: `statistics-service-{placement,flow}-app-390-{light,dark}-r27.png`.

Current explanatory source inspected only to identify the responsive cause:

- `statistics-service-screen.tsx` SHA-256 `5AFB30D280AB02272264A1A9DF960CCF1266A0F394A86615DF93A0BD445CC740`
- `statistics-service-third-edition.module.css` SHA-256 `0A06F7BFF181B1D6ABBC8D00C7962E7E2BADA39907B7FC1B7D2796E2721DFF10`

## Findings

No P1 finding.

### P2 — desktop column proportions remain visibly different from the drawing

At 1440 px the app gives the two content columns equal width. The drawing gives the left identity/ready-beds/referral column about 55% and the right out-of-area/flow column about 45%. The equal split is clear in both app themes and makes the table-bearing left side narrower while giving the short band rows surplus width. Panel order and content are correct.

Smallest correction: change only the page-local desktop `.pageGrid` columns from equal fractions to approximately `minmax(0, 1.1fr) minmax(0, 0.9fr)`, retaining the existing 62.5 rem single-column breakpoint and print reset.

### P2 — phone identity facts discard the drawing's compact label/value alignment

At 390 px the app forces every identity value onto a new full-width row (`.identityFacts dd { grid-column: 1 / -1; }`). The drawing retains a compact label/value definition-list layout, so hospitals, wards, departments, and snapshot remain quickly scannable. In the app this makes the already explanatory identity panel taller and leaves fewer of its facts in the initial viewport. Long hospital names do wrap safely, and there is no horizontal clipping.

Smallest correction: keep a bounded label column on phone, for example `grid-template-columns: minmax(6.5rem, 0.35fr) minmax(0, 1fr)`, and remove the phone-only full-span placement from the value. Allow wrapping within the value column. This is page-local and does not affect the KPI or band layouts.

## Closed observations

- The route title reads **Service statistics** in all six app cells.
- **Export the figures** is visible and usable at 390, 820, and 1440 px in both themes. Its existing unwired announcement is the accepted D16 behavior; no export implementation is requested here.
- Identity, Ready beds, referral placement, out-of-area, and flow panels are present in the intended independent-column/stack order. The focused phone captures prove the complete placement tally and both flow demonstrations remain reachable below the first viewport.
- Ready-bed and destination tables/lists remain legible; long hospital and ward names wrap without collision. Zero destination rows and the out-of-area zero band remain explicit rather than disappearing.
- Light and dark surfaces, captions, notices, figures, lines, and demonstration labels remain readable. No new page-level horizontal overflow is visible in the supplied cells.

The app's additional routes, synthetic/governance preamble, current engine counts, service naming, and D16 Export response were treated as intentional application differences. These still images do not prove keyboard interaction, screen-reader output, print pagination, focus states, or service switching; South Metro navigation behavior was controller-verified separately.

## Image hashes

```text
46C866C9F659D8D8EE063EAA9513DBED5F3CE0A1C700B81E257BC2CCFD9C9E0B statistics-service-current-app-1440-dark-r27.png
644C4A2688C9AAE2ECF625686F91E0E7C14041A64103B8423FAE6CED5FFEB50F statistics-service-current-app-1440-light-r27.png
C2D6917EF9F8750BB7F0B88AA2CCD61ECF65D413AA8D2EE191B4DCB9D2D9E5BB statistics-service-current-app-390-dark-r27.png
451099E4CE5F4E955D09C94780FEAF9DD980D155B808B73204F0B3FC169C71DA statistics-service-current-app-390-light-r27.png
16912E46D8354F5F56AC63CA407F30FF5078DF945F093B25DEE8C13E1E449276 statistics-service-current-app-820-dark-r27.png
58A73B46B75E6B369806E91724ECFB79E04D586395D799C11DA18D11366082F4 statistics-service-current-app-820-light-r27.png
F1582853F2F751F7491FDB102F27619CEE1A2B14DE32B2FBBFD066F1C7E5196B statistics-service-current-mock-1440-dark-r27.png
CFF6F50714FDB5178937E5F21844C06BB119571ED98ABA19575C79AA9C0EFBA7 statistics-service-current-mock-1440-light-r27.png
EED58BBA34EE4AC9975888479570855A294F006E7E6D245A14E83CA367F6EDF6 statistics-service-current-mock-390-dark-r27.png
0985241DFF4AF46ADD2E971F6214B40A3FCD3BEAB123219C1A98A9FD71521191 statistics-service-current-mock-390-light-r27.png
7101D8E0B6824E9BF001C5728A051CE0517D8E9A298EBE07A512F46C2737F62F statistics-service-current-mock-820-dark-r27.png
F5E477F515D6DACC256873ED6EBB153FD02CEEE76CA9AF8E4505B4289067F95D statistics-service-current-mock-820-light-r27.png
5683243AC8558818594D5EEDE847C87FA1F0C2FF9311AFD5FEAC44C59C65241C statistics-service-flow-app-390-dark-r27.png
35048FE0EE59515105B7B59AEB7E96E7770AA125ABF7A37B03DA796353C09374 statistics-service-flow-app-390-light-r27.png
0FD22D635A6FF55B8059F5B1601B90FC7DC73F835D62AA7907A24175451A28ED statistics-service-lower-app-1440-dark-r27.png
D0D2955305FE14DC512953D9C16175FB36C8CF1DC278BCFA037C9769AF72A316 statistics-service-lower-app-1440-light-r27.png
6E345CEEA3E21057F230A45558E9C96000F0BA5BD8CBD248011AAA644D26C243 statistics-service-lower-app-390-dark-r27.png
6370A506BD7BCA2822B1E11821EB022C828733FE6D62632177127161B4B10114 statistics-service-lower-app-390-light-r27.png
0A349D86EDE87444820E95A133D1A0F38A42D1ABAF6F66DECC95952AEA12BF1B statistics-service-lower-app-820-dark-r27.png
4BF349AD037758BB1F3CDFBA4BD89162AA0BAFC5F6DFCA27822EB53A126BC2F3 statistics-service-lower-app-820-light-r27.png
0A165285127856122CF21DE0BDC7ADA5B4C6197EA57F5BF5406A06155A33B214 statistics-service-placement-app-390-dark-r27.png
E009E0C75CC8FF21BA78C98E26554732FB43A5FC6A605A39CBE17A6533D349E5 statistics-service-placement-app-390-light-r27.png
```
