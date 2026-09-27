# F11 Statistics landing lower-region visual review r22

Date: 2026-09-13  
Reviewer: `/root/hub_inventory`  
Mode: independent screenshot review

## Evidence inspected

Original-detail captures under `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/`:

- `statistics-landing-bottom-{app,mock}-{390,1440}-{light,dark}-r22.png` (8 images)
- `statistics-notice-app-1440-{light,dark}-r22.png` (2 images)

## Findings

### P1 — light-theme health-service links have unreadable text contrast

In `statistics-landing-bottom-app-390-light-r22.png` and
`statistics-landing-bottom-app-1440-light-r22.png`, all five links under **Choose a health
service** paint almost-black text on charcoal surfaces. Names such as North Metro, WACHS, and
Private are barely distinguishable. The same links use clearly readable light text in the dark app
capture, confirming a light-theme foreground/background token mismatch rather than missing labels.

Smallest fix: within the Statistics landing root, give these link cards the canonical light surface
and ink pair in light mode while retaining the current dark-mode pair, border, 48px target, names,
network order, and routes. Do not replace the real five-service list with drawing data.

### P2 — the light phone measurement warning uses a dark-on-dark amber pair

The warning visible at the top of `statistics-landing-bottom-app-390-light-r22.png` paints dark
ochre copy on a dark brown surface. The same warning is legible as brighter amber copy in the dark
capture. Although only the lower portion is included, multiple complete lines in the light capture
show the contrast failure.

Smallest fix: use the page's canonical warning foreground with its matching soft warning surface in
light mode. Preserve every explanation and the existing measurement/absence logic.

## Closed and retained observations

- The separately captured **Declines per ward** withheld notice now uses a neutral bordered surface
  with readable heading/body contrast in both themes. No further contrast finding is raised for that
  notice.
- The app truthfully retains its recorded pull-to-arrival measurement explanation and measured-pair
  counts. No invented historical trend or unsupported value is visible.
- The service chooser is followed by a clearly labelled Synthetic prototype footer stating that the
  figures are not real. The app's longer source/measurement explanations remain in accessible native
  disclosures elsewhere on the page; the compact closed presentation is an accepted structural
  difference from the drawing's permanently expanded prose.
- No clipping or horizontal overflow is visible in the reviewed lower regions at 390 or 1440.

## Limits

These captures cover selected lower-page positions rather than a continuous journey. They do not
prove the complete disclosure content, disclosure interaction, service-link navigation, focus order,
keyboard behavior, print expansion, forced colors, screen-reader output, physical devices, hosted
behavior, or human acceptance. No source, browser, server, test, canonical evidence JSON, or PROGRESS
file was changed or run.
