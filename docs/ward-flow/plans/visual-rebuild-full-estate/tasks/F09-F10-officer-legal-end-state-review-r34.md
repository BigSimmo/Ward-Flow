# F09/F10 Officer and Legal end-state visual review r34

Date: 2026-09-13  
Reviewer: `/root/hub_inventory`  
Scope: bounded read-only review of the current lower/end-state captures. This is not screen Definition-of-Done evidence.

## Evidence inspected

All 18 files were inspected at original detail:

- `officer-last-job-app-{390,820,1440}-{light,dark}-r34.png`
- `legal-deadline-end-app-{390,820,1440}-{light,dark}-r34.png`
- `legal-record-end-app-{390,820,1440}-{light,dark}-r34.png`

Controller-supplied runtime evidence records the WF-005 progression from En route to Collected to Arrived, with jobs dropping from 8 to 7 and open movements from 43 to 42. It also records selection of WF-327 through **Work this job**, visible disabled reasons, and the Legal populations of 4 records with deadlines, 15 without deadlines, and 23 voluntary movements, totaling 42.

## Verdict

No P1 or P2 visual finding in the inspected states.

### Officer last-job state

WF-327 remains visibly selected at all three widths and in both themes. Origin, destination, transport-form absence, escort requirement, current Collected state, wait time, and progress track remain legible. The 390 px action row stays visible at the viewport edge; prior stages are visually disabled and Arrived is the clear remaining action. At 820 and 1440 px the actions remain attached to the selected card, while unselected jobs retain their full **Work this job** target. No content clipping or page-width overflow is visible.

### Legal deadline and record endpoints

The deadline and no-deadline groups retain clear headings, counts, ordering explanation, record IDs, form/status/origin/owner facts, and their deadline or waiting-time callouts across 390, 820, and 1440 px in both themes. Long facility names wrap within their cards without collision. The record endpoint exposes the full **If nobody renews it** explanation, form totals, holder/authority boundary, and expanded **About these records** disclosure. Text, green status surfaces, card boundaries, and disclosure surfaces remain readable in light and dark themes. The open disclosure preserves the synthetic-data and ordering provenance instead of displacing or hiding the records.

No row action is expected on Legal in this state, so its absence is not treated as a defect.

## Limits

This review covers only the visible regions of the 18 named screenshots and the controller-supplied runtime facts. It does not independently exercise the Officer transitions, keyboard or focus behavior, disclosure controls, print, screen-reader output, physical devices, or other page states.
