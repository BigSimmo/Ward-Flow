# Task 2 independent Hub visual review — revision 1

Date: 2026-09-12  
Reviewer: `statistics_inventory` / gpt-5.6-sol / medium  
Review independence: reviewer did not implement the Hub screen or Hub stylesheet.  
Frozen source hashes: `hub-screen.tsx` `564E3F83CD978215E3F764DCD9F756B815CD16A4F7A5EAA47617D73298823D0E`; `hub.module.css` `DCD1BF59B45758D8D8B2D5DD714418C7D6FD60A7767DBC98256DB52989E4506C`; `ward-hub-bar-colours.test.ts` `F0FDCF51D136F0098631C33DAB734DE7DD06F2C0E8F3448C2AFF46EA11B97654`.

## Verdict

Changes requested for two material drawing deviations and one minor affordance deviation. The six app cells are internally coherent across light/dark and preserve the intended two-column desktop order and stacked responsive order, but those properties do not make the remaining mismatches design matches. Human acceptance remains pending.

## Actionable deviations

### Important — Ready beds by service is missing the drawing's table header

In both 1440px app captures, `READY BEDS BY SERVICE` goes directly from the section heading to `North Metro 4`. The matching drawings render a real two-column table header, `HEALTH SERVICE` and `READY`, before the five service rows and total. Restore that header row in the same compact inset/table treatment. It supplies column meaning visually and should use semantic column headers; it does not require changing the derived values or their order.

Evidence: `hub-final-app-1440-light.png` and `hub-final-app-1440-dark.png`, right panel around y346; matching mockups around y342.

### Important — Wards that need a check uses the wrong row type

In both 1440px app captures, attention items are flat divider rows directly on the panel surface, with a detached bordered `View` button on the right. The drawings use individually bounded inset cards, keep the age aligned in the card header, and present the destination as an underlined `Show this ward` action within the card. Apply the drawing's inset-card boundary/radius/spacing while retaining the app's 48px action target, exact urgency wording and derived ordering. This is a presentation correction; no ranking or clinical rule needs to move.

Evidence: app captures around y548 onward; matching mockups around y565 onward.

### Minor — The directory field drops the drawn search glyph

Across all six app cells, the local directory field lacks the leading search icon shown in all six drawings. The app's explicit placeholder and visible keyboard-help sentence are readable and should remain, but they do not visually replace that affordance. Restore the decorative search glyph without reducing the 48px field target or changing search behavior. The drawing's trailing `/` badge is intentionally excluded: that shortcut belongs to universal search, and this local directory field does not own it.

## Observed layout and readability

- At 1440px, the app uses the drawing's approximately 235px rail, 58px bar, two-column Hub region and narrow inter-panel gap. Both panels independently scroll and their content remains readable in light and dark.
- At 820px, the app stacks `The network` before `At a glance`, matching the drawing's panel order. Both panels keep bounded internal overflow. The app exposes fewer lower-panel rows in the initial viewport because its retained 48px targets and visible keyboard instruction make the directory taller; those are specified retained behaviors, not findings in this review.
- At 390px, the corrected compact rail ends at approximately the same vertical position as the drawing (about y388–392), and the Hub panel retains the same side inset and order. The app bar is shorter because the global patients/movements search is a compact trigger and D-16 deliberately supplies no Hub `New referral` primary action. Only the initial viewport was reviewed; lower panes and the wrapped remainder of the tab strip are outside this evidence set and remain the controller's separate check.
- Dark captures preserve the same geometry and hierarchy as their light counterparts. Text, boundaries, active state, stale state, numeric columns and internal scrollbars remain legible in the supplied raster evidence.

## Justified differences excluded from findings

This review did not treat the following as defects: the service-grouped directory rather than the drawing's global-urgency order; the compact rail's `More pages` access to retained routes; the global patients/movements search; D-16's explicit absence of a Hub `New referral` primary action; 48px targets; truthful prototype/caveat/absence wording; or the derived total-bed statement. The Hub's already-assigned right-disclosure correction is also excluded.

## Evidence map

All files are under `.superpowers/sdd/2026-09-12-visual-rebuild-wave-one/` and were visually inspected at original resolution.

| Cell       | App evidence                                                                                        | Drawing evidence                                                                                       | Dimensions     |
| ---------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------- |
| 390 light  | `hub-final-app-390-light.png` — `F833F8930CFE7F4B2CC0713CD01D8E9FE668E19AD062B44552E0DBEBD385B9D0`  | `hub-final-mockup-390-light.png` — `2325FC96C3C270B9E767709E5CC0856A5C33DF94D7CF0D63B0BF0C8A2FF077AD`  | 390×844 each   |
| 390 dark   | `hub-final-app-390-dark.png` — `ECC4F9F41D4AC7D0580E1C815C8AB7E536D6FC6A03B857FE2AA61F52B85DD7B8`   | `hub-final-mockup-390-dark.png` — `3F1AF02D9E8B5CE3489E4EBCCA19BACFA7E99690DE3869E3489EDFE10106487B`   | 390×844 each   |
| 820 light  | `hub-final-app-820-light.png` — `F6D7930ACDCAAE0989406D9EF45AD08B62153EFA88B7A8EB19431B6449371CC0`  | `hub-final-mockup-820-light.png` — `564BFD0165B298D80206AF5C5CB51C02FDC6BB2B95EA215C8B8B3412777034BA`  | 820×1180 each  |
| 820 dark   | `hub-final-app-820-dark.png` — `8E31B90D33D66B3CC49E6407CBBE8E080DCBA342297AC39A407ADB4ED0F9293D`   | `hub-final-mockup-820-dark.png` — `4D77E4FC0BDF31B72166552E7DB3C64814DD6FC207E9D69271540D7F437F5417`   | 820×1180 each  |
| 1440 light | `hub-final-app-1440-light.png` — `D3DD29C31327FB26011475FE219AC08DC72570A666FA6B0943A68EFC98F81FF6` | `hub-final-mockup-1440-light.png` — `F5CB9C9F97697994DAF0D1FED24EABBF98CC58996E8F7DBF8A40C02214C4C947` | 1440×1000 each |
| 1440 dark  | `hub-final-app-1440-dark.png` — `0352CBC013FCF12142DB8D83D9DCF5CF6CDEBB99512C4D9D1A9623013B873165`  | `hub-final-mockup-1440-dark.png` — `B5AFC480B2D8363BB188901EBD598A6B297886F15661E42118A772D1EB27AC04`  | 1440×1000 each |

No source, test, browser or server operation was performed for this review. The captures are visual evidence for the listed states only; they do not prove interaction, forced-colour, print or lower-mobile behavior. Human acceptance remains pending after the findings are resolved and recaptured.

Controller correction: model label verified against the original spawn arguments (gpt-5.6-sol, medium, fork_turns none); the earlier generic GPT-6 persona label was inaccurate.

## Revision 2 closure — 2026-09-12

The three assigned presentation findings are closed in the six revised app captures when compared with the unchanged drawing references above:

- `READY BEDS BY SERVICE` now has the visible `HEALTH SERVICE` and `READY` column header row in both 1440px themes. The derived total remains `27`, equal to the five displayed values (`4 + 9 + 8 + 4 + 2`).
- `WARDS THAT NEED A CHECK` now presents each visible item as a bounded inset card with the age retained in the card header, status content inside the boundary and the destination action within the card. This is visible in both 1440px themes; the panel's existing vertical scroll remains usable rather than becoming page-width overflow.
- The local directory field now has its leading search glyph in every revised width/theme cell. No `/` badge is requested because the local field does not own the universal-search shortcut.

No new horizontal overflow, clipping or unreadable text was observed at 390px, 820px or 1440px in either theme. The responsive panel order and bounded internal scrolling remain intact. The 390px and 820px captures cover only their initial viewport, so this closure does not independently expand the lower-pane evidence boundary from revision 1.

### Revision 2 evidence map

All revised files are under `.superpowers/sdd/2026-09-12-visual-rebuild-wave-one/` and were visually inspected at original resolution. They were compared with the corresponding unchanged `hub-final-mockup-*` references and hashes in the revision 1 evidence map.

| Cell       | Revised app evidence                                                                                | Dimensions |
| ---------- | --------------------------------------------------------------------------------------------------- | ---------- |
| 390 light  | `hub-review-r2-390-light.png` — `2F0AD522A858E38594D553332EBF0ED63BBCEA54C7A3598F27345573E6CE1EC7`  | 390×844    |
| 390 dark   | `hub-review-r2-390-dark.png` — `FCCEAB1B4E92A97DEB522BCC5A0C80FCBE40FC1B78726C866E7A617D4BCB1614`   | 390×844    |
| 820 light  | `hub-review-r2-820-light.png` — `64770C518124853E07A2CCC5A137E56A721526FD57428F9A808F81E3829FE1FE`  | 820×1180   |
| 820 dark   | `hub-review-r2-820-dark.png` — `637277EA30B9E4812442E8571B341F5229E39C2A5E23E75B72C70A735BD40A03`   | 820×1180   |
| 1440 light | `hub-review-r2-1440-light.png` — `4367AE11E19AC223AFD2F8C768BD746B8881268C4106C1F195C42D9D8E62A0EF` | 1440×1000  |
| 1440 dark  | `hub-review-r2-1440-dark.png` — `7514C521255BCEDA0CEB06279C8A3A22C9744EC123CF633332C97D5E26D2BF56`  | 1440×1000  |

Corrected source hashes: `hub-screen.tsx` `104EDCF3B6CA7AFA88395A7B60B23FA3B7BF95A0B53154C4174FE4BA66576598`; `hub.module.css` `B4C4A8BADD8F43D23E177A479239894AECF2463760099C920FCEF4FFE77D881D`; `ward-hub-bar-colours.test.ts` `F0FDCF51D136F0098631C33DAB734DE7DD06F2C0E8F3448C2AFF46EA11B97654`.

Exact remaining evidence gaps: human design acceptance is pending; PDF output is unsupported and therefore unverified. The controller separately verified the lower-phone expanded disclosure and forced-colours/print emulation; those checks are controller-supplied evidence and were not rerun in this independent image closure. No remaining visual implementation gap was found for the assigned table-header, inset-card or search-glyph corrections.
