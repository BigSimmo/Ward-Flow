# Q004 Command visual acceptance

Reviewed 2026-09-13 by controller and independent Astra reviewer. Active lean policy applies; no numerical score assigned. Evidence is under `.superpowers/sdd/2026-09-13-product-refinement/screens/`.

| Actual coverage                                       | Evidence                                                                                       |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1440 light/dark live and served drawing               | `command-final-paired-{light,dark}-1440.png`, `command-reference-paired-{light,dark}-1440.png` |
| 1440 dark, initial closed shortlist                   | `command-lean-empty-dark-1440.png`                                                             |
| Expanded key, 1440 light                              | `command-key-fixed-light-1440.png`                                                             |
| 820 dark selected candidate/actions, reused unchanged | `command-corrected-actions-dark-820.png`                                                       |
| 820 light selected queue/flow composition             | `command-final-selected-light-820.png`                                                         |
| 390 light/dark selected actions, reused unchanged     | `command-phone-selected-action-{light,dark}-390.png`                                           |

Independent review inspected eight relevant captures and found no material remaining issue. Expanded key includes Recorded destination and Schematic without clipping; important actions remain available on the inspected narrow states. The controller also exercised close/deselect and observed the shortlist disappear and flow expand. Tablet light coverage shows the selected queue/flow, not a new inspection of every lower shortlist control; corresponding narrow action evidence is reused above. Expanded Update record with a lower candidate selection was not newly exercised. Temporary reset/misnamed captures are excluded.

The owner explicitly requested the closed initial shortlist, taller/wider flow, compact expandable definitions and visible action hierarchy. Engine populations, eligibility reasons, operational absence states and permission gates remain authoritative over illustrative drawing data. Visual acceptance does not replace the pending cumulative domain gate; existing D14 patient-link source finding remains tracked separately. No printing, physical-device or hosted assurance is claimed.
