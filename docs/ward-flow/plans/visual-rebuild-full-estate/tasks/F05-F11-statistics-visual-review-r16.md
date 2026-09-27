# F05/F11 Statistics visual review — r16

Reviewer: `gpt-5.6-sol / medium`.

## Independence and authorship limit

This is an independent visual review of Statistics landing and Community Statistics. The reviewer authored the static Service Statistics r11 presentation, so the Service portion is a visual self-review rather than independent source acceptance. Community was implemented by the controller and Luna; Statistics landing was implemented by Hub. No application source was changed during this review.

## Evidence and limits

All 36 supplied originals were opened with `view_image`: app and served drawing for the three routes at 1440px, 820px, and 390px in explicit Light and Dark themes.

| Surface    | Cell       | App SHA-256                                                        | Drawing SHA-256                                                    |
| ---------- | ---------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Statistics | 1440 Light | `41E57F2D2E9845DA9DCFFB1CE6391FD7F642B111A5B7FCE47780DB955D906381` | `414A979097B7CAADBDCCF52483E9F530FEFC51A7E58A941454A52F266720923D` |
| Statistics | 1440 Dark  | `5CD591F1DF71632410CFADB3874485C16944E3A323752629CEE1F11CCFC2E490` | `124E17EA1BDF39398D3F07987E4215F85146494FD2932C4DE09C334E8505020E` |
| Statistics | 820 Light  | `B560EB5084DC5C55A894903BD8D713EF4F99E3C0321E2B5FA2C24EFA9C6C0985` | `C670B91ECD3944B8EE51B4D0ADCFC107E084910A106731906B316BEAC130670C` |
| Statistics | 820 Dark   | `5AB626BE89DF97A73D6AD3D8CA6F151368FC36DE079F2F0B2CD72D6897DB635C` | `BBB9B69D887A7715E1607A9FB5ABF59504937F1124F3E671C4845F89FD5750C5` |
| Statistics | 390 Light  | `095A760FC27A70FCA56D2DBBE86E88CA0EE5AABBD21D4D498004998D18B7A381` | `5758AF1F19010E1F97FD5998811E36298C3500C2D3D685C7EF0D938CB317C5AA` |
| Statistics | 390 Dark   | `7B6F1823B087B03D1502F768D13EF5C6D8B67A48671FA696016FC41EA43CA92E` | `B011640C76A8B1982B9ABFE6C80704109F73365F2D0B487F90BCFC3FB4CB4A6A` |
| Community  | 1440 Light | `16D173D5A1A77447CE38F1CCAEDFE204DAE7F7813204C229240A2F21B77D62AA` | `7E1CC84859BB354CAD37B6E5D7C2888882565BF6F5708A118E329FC307B6FCFF` |
| Community  | 1440 Dark  | `9B5948613E992557E83FBCDC2AAF44506B8BC2F11CE7B80553255551C602E8D2` | `383BCFA3F000400FC242EDB5E9F24406D5A66F5F80FA654D852FD31B47FB2188` |
| Community  | 820 Light  | `E10D598241D36FA96F06D226E021944828A66ECA98B75FC8863848249598373B` | `AE1B04AE221560AA63983615975F598487E4527C0ED24635C5038B72E52D3B2F` |
| Community  | 820 Dark   | `3867ED5F16B28F485910C040E24F8578A985CF1307C894ADFBC5E947DA9AFBBA` | `D907670E58AD5ECC270B60C48C3B0571EA83FACCF32305C10487A8F4A7F87284` |
| Community  | 390 Light  | `80345A70B49A4C39DE8F08F53E77BBDE3899F1C45FF791C9D9BD4048C76512A4` | `1A4A855F9AC1CC8BF30C54D1700C9370EE0BB102F925A7034F04D34B85E08E1D` |
| Community  | 390 Dark   | `B0780D7176AC2EB7539DF34002E3C8B2920187A53151FEF7BD84213AE3CBB261` | `13679BC656DC820119AD755DFA6118B7C586E0FA0ADCF3663142100A97173783` |
| Service    | 1440 Light | `FAAF2F13ACEDEF2D6F0D960C82208CBA788D3338184A29F90AF3F8CA461FBF34` | `CFF6F50714FDB5178937E5F21844C06BB119571ED98ABA19575C79AA9C0EFBA7` |
| Service    | 1440 Dark  | `ABC4D761158CD3908489418F24B59DDAF733BB46F68BA70390881AF7B7EFE071` | `48AD6BCFDDA91DDB9B64845AC8103D9A81BAFE5871C1C67D84EA475EEE19B744` |
| Service    | 820 Light  | `51F10453676DB1C7E4B51FC45B94379DF601E03D489F63A7FCCFF5F76CC70603` | `A91B3603E9E3A43EF39587DA32B283A4C91DC6DE1D717A0861F3DCDB2D2EFA70` |
| Service    | 820 Dark   | `5A55A9B30DD6CEDB9A5B3BBD4B54F83A785AD44A97DF3A2BADC2AB815D1440DF` | `E8AB917ED8388F6083ADF4E783941F2C9AE740B25AE06D2AE518BC8583EFFD1F` |
| Service    | 390 Light  | `7E44898E0F01DAAC1D840F68BE2CACE46E109BAEE1345374F3769D9B470A2C12` | `0985241DFF4AF46ADD2E971F6214B40A3FCD3BEAB123219C1A98A9FD71521191` |
| Service    | 390 Dark   | `3FA3B6675B4BD98EFD0A3584A9521AB9CCBD1EED5B04877A785D3DF23990DDEF` | `EED58BBA34EE4AC9975888479570855A294F006E7E6D245A14E83CA367F6EDF6` |

These are initial-viewport captures. They prove the visible panel hierarchy, spacing, action presence, theme contrast, and top-of-page responsiveness. They do not prove lower-page order in every cell, internal table/chart scrolling, disclosure interaction, focus order, print, forced colors, or physical-device behavior. The three routes are not marked visually accepted from this evidence.

The controller reports two source corrections made after r16 capture: the Service brown notice blocks now use canonical neutral footers, and long Community/Service bar titles now use the revised threshold/type size. Those two visible r16 artifacts are excluded from the remaining findings, but they still require fresh visual evidence.

## Findings

No remaining P1 defect was established after excluding those two corrected r16 artifacts.

### P2 — Statistics landing retains the obsolete phone-header reserve

In both 390px app themes, the shell action row ends around the same place as the drawing, but the first `Across all services` panel begins after a conspicuous additional blank band. The 820px and 1440px app cells do not show the same proportional gap. This is not caused by the richer engine population.

The source provides a direct explanation: the legacy `statistics.module.css` phone rule still adds `padding-top: var(--spacing-ward-phone-bar)` to `.screen` at lines 745–748, while the mounted third-edition shell chrome is already in normal flow. `statistics-landing-third-edition.module.css` resets main padding but does not reset that root reserve. Add a third-edition-only `padding-top: 0` at the same 40rem breakpoint, preserving the legacy branch. This is the same bounded compatibility correction already applied to other rebuilt screens.

### P2 — Community turns two drawing subregions into separate raised cards

At 1440px, the drawing keeps `How long each open case has been open` inside the Caseload panel and `The same cases, grouped` inside Time to first contact. The app renders each as an independent card. This breaks the drawing's panel types and produces a fragmented checkerboard of shallow absence cards, most visibly the detached `The same cases, grouped` card beneath Time to first contact. It also makes the app's two columns look aligned by card count rather than by the two measurement questions they represent.

The source confirms this is presentation structure: `statistics-community-screen.tsx` creates separate `WardPanel`s for case age around line 265 and grouped cases around line 329, and `statistics-community-third-edition.module.css` assigns each its own grid area. Nest each existing region inside its owning Caseload or Time-to-first-contact panel as a bordered subregion. Keep the exact absence wording, test IDs, current zero-versus-absence treatment, and all later panels. At the one-column breakpoint, the same grouping gives the drawing's identity → Caseload sequence without changing any data.

### P2 — Service Statistics has no route primary action in any app cell

The Service app bar has no page action at 1440px, 820px, or 390px. The served drawing has Export in every corresponding cell. The current shell intentionally exposes at most one route primary, so the drawing's simultaneous New referral control is an accepted shell adaptation; the absence of the Statistics export action itself is not.

The route registry explains the omission: `WARD_PRIMARY_ACTIONS` includes Statistics landing, Ward, Community, and ED export actions at `ward-nav.ts` lines 605–620, but has no `/mockups/ward-flow/statistics/service/[serviceId]` entry. Add the existing dynamic Service Statistics route with the existing `{ kind: "export-figures", label: "Export the figures" }` action and update the exact route/action registry guard. Do not add a page-local button or a second bar primary.

## Accepted adaptations and observations

- Statistics landing uses six drawing regions but places the engine's current measurements and explicit absences under them. Its top KPI band and recorded pull-to-arrival range therefore differ from the drawing's fabricated network totals and 14-day series. This was declared in the F05/F11 implementation report and is not reported as a visual defect.
- Community's Bentley selection, zeros, and missing contact/case-duration measures differ from the drawing's Armadale fixture. The engine state and explicit absence statements are authoritative; no values or metadata should be copied from the drawing.
- Service counts, service short name, unbanded population, and band proportions differ from the drawing fixture. Current derivations are authoritative.
- The Statistics section frame retains Back to statistics and a collapsed synthetic/access disclosure above Community and Service panels. The drawing omits them, but they preserve required navigation and governance. Their additional height is a documented app adaptation, not a request to hide or delete them.
- Light and Dark page content was readable in all captured cells. No horizontal page overflow, crushed KPI text, or clipped visible action was observed in the initial viewports. Lower tables and charts remain outside this evidence.
- The richer app rail, More pages control, reconciliation status, and different movement/referral counts are shared-shell and engine differences.

## Recommended bounded closure

1. Landing phone reserve: `statistics/statistics-landing-third-edition.module.css` only.
2. Community panel grouping: `statistics/statistics-community-screen.tsx` and `statistics/statistics-community-third-edition.module.css` only.
3. Service route action: `ward-nav.ts` plus its exact primary-action registry test; no Service screen change.

After those changes and the controller's two already-applied post-r16 fixes, capture fresh paired six-cell app evidence for all three routes. Add one lower-page phone and desktop inventory per route for panel order, table/chart reachability, and disclosure content before human visual acceptance.
