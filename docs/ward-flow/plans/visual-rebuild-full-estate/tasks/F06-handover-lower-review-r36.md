# F06 Handover lower review r36

Reviewed the eight supplied app captures directly:

- `handover-table-ends-app-390-light-r36.png`
- `handover-table-ends-app-390-dark-r36.png`
- `handover-table-ends-app-820-light-r36.png`
- `handover-table-ends-app-820-dark-r36.png`
- `handover-signoff-app-390-light-r36.png`
- `handover-signoff-app-390-dark-r36.png`
- `handover-signoff-app-820-light-r36.png`
- `handover-signoff-app-820-dark-r36.png`

## Findings

- No current P1/P2 visual defect is evident in the supplied regions. The 820px table captures show the visible row ends for Beds pulled, In transit, and Placement gone wrong, followed by the Outside this filter heading, in both themes. The 390px captures intentionally expose the table horizontal scroll tracks; long unit values are clipped at the viewport edge until scrolled horizontally, but no table content is claimed to be absent.
- Both 390px sign-off captures show the Shift and sign off and Print cards with readable copy and controls. Both 820px sign-off captures show those cards, the footer handover prompt, and usable horizontal spacing in light and dark themes. No unsupported action claim is visible; the prototype wording explicitly says sign-off is not wired.

## Evidence limits

The 390px table captures stop at the Outside this filter heading, so that section's lower copy and any page footer are not visible there. These image crops do not prove keyboard/focus behavior, print output, or full-page lower-content completion. No source, test, browser, or verification-record files were changed for this review.
