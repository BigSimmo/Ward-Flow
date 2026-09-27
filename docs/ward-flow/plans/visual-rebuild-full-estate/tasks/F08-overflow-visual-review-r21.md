# F08 overflow visual review r21

Date: 2026-09-13
Scope: independent visual review of the 36 r21 originals for Discharges, Handover, and Out of area. Checked all app/mock pairs at 1440, 820, and 390px in light and dark themes, concentrating on recent responsive overflow fixes, table containment, header/control wrapping, and dark-theme contrast.

## Evidence reviewed

- Discharges: `discharges-{app,mock}-{1440,820,390}-{light,dark}-r21.png` (12 files)
- Handover: `handover-{app,mock}-{1440,820,390}-{light,dark}-r21.png` (12 files)
- Out of area: `out-of-area-{app,mock}-{1440,820,390}-{light,dark}-r21.png` (12 files)

## Findings

- **No current P1/P2 visual defect found in the reviewed overflow scope.** Header navigation and action controls remain contained at all three widths. Phone layouts wrap controls and content without visible body-level horizontal overflow. Wide tables visibly use their own bounded scrolling instrument where the column set exceeds the phone or inner panel width; this did not produce page-level clipping.
- The long Discharges and Handover table values wrap inside their columns at narrower captures, and the Handover table exposes an inner scrollbar in wide app captures. These are consistent with the screen's table instrument and preserve access to the remaining columns.
- Dark captures retain readable headings, body text, borders, active states, warning/prototype panels, and controls. App/mock data and action-set differences were treated as intentional engine/reference differences.

## Limits

PNG review does not prove scrolling or keyboard behavior, focus-ring visibility, hit-area dimensions, print output, or content below the captured viewport. The report records visual evidence only; no source, browser, test, or verification-record changes were made.
