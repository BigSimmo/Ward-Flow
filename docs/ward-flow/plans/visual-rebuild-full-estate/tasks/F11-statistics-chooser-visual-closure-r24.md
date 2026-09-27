# F11 Statistics landing chooser visual closure r24

Date: 2026-09-13  
Reviewer: `/root/hub_inventory`  
Mode: independent changed-control screenshot review

## Evidence inspected

All 12 supplied original-detail app captures under
`.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/`:

- `statistics-index-chooser-app-{390,1440}-{light,dark}-r24.png`
- `statistics-community-chooser-app-{390,1440}-{light,dark}-r24.png`
- `statistics-service-chooser-app-{390,1440}-{light,dark}-r24.png`

These are app-only changed-control crops. The existing r19/r23 app/drawing evidence remains the
comparison record; this report does not invent new paired-drawing coverage.

## Closure

### Community-team chooser: closed

The community cards use a light surface with dark text in light mode and a dark surface with bright
text in dark mode at both 390 and 1440. Long real names including `Alma Street (Cockburn)`,
`Armadale (Mead Centre)`, `Central Great Southern`, and `Eudoria Street (Gosnells)` remain contained
within their cards. Phone cards form one column without horizontal clipping; desktop cards form two
aligned columns. No P1/P2 contrast or wrapping issue is visible.

### Health-service chooser: closed

North Metro, East Metro, South Metro, WACHS, and Private remain readable on canonical surfaces at
390 and 1440 in both themes. Phone cards stack without clipping, desktop cards retain their compact
grid, and the real five-service order is unchanged. The r22 dark-on-dark failure is absent.

### Referral-join warning: prior r23 closure retained

The r23 lower captures already showed the measurement warning as dark amber on a pale warning
surface in light mode and bright amber on a dark warning surface in dark mode. The r24 community and
service crops again expose portions of that warning with the corrected contrast. No regression is
visible.

## Index-entry capture limitation

The four files named `statistics-index-chooser-app-*` do **not** visibly contain any
`ward-statistics-index-entry-*` cards. At 390 they begin at **Flow over time** and continue into
**Where the pressure is**; at 1440 they show the same regions. Consequently, those four images cannot
visually close the index-entry foreground/background or phone-wrap behavior, even though the current
CSS groups the index-entry selectors with the visibly corrected community and service families.

This is a capture-evidence gap, not a newly observed UI defect. A crop containing at least one real
index-entry card in light and dark at 390 and 1440 is required for rendered closure of that family.

## Limits

The r24 captures do not prove hover/focus states, keyboard navigation, target geometry, route
activation, complete list scroll ranges, print, forced colors, screen-reader output, physical-device
behavior, hosted behavior, or human acceptance. No source, test, browser, server, canonical evidence
JSON, or PROGRESS file changed or ran during this review.
