# F00 Tools directory delta correction r27

Date: 2026-09-13  
Owner: `/root/hub_inventory`

## Scope and evidence

The only product file changed is `src/components/ward-management/shell/ward-bar.module.css`. Its exact pre-edit bytes are saved at `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-tools-delta-r27/src/components/ward-management/shell/ward-bar.module.css` with SHA-256 `EACD2F84B8045EF1352B324C2A1C372426962CEA3D4B6EB0E3BC50A64C12E1FB`.

I inspected `tools-current-app-390-dark-r27.png` at original detail and compared it with the served `tools-mock-390-dark-r13.png` reference and the previously accepted `tools-app-390-dark-r13.png` capture. The drawer's explicit horizontal table scroller is intentional and matches the served design. The current first-column growth is a regression: after the Tools table adopted the canonical Ward table class, that primitive's `white-space: nowrap` rule for every `th` also reached body row headers. The longest place name therefore fixes a wide first column, leaving the Extension heading partly visible and Email wholly offscreen before any horizontal movement. The earlier accepted app capture allowed place names to wrap and kept more of the contact columns visible.

## Correction

Added one page-local `.directoryTable tbody th { white-space: normal; }` rule. Column headings retain the primitive's no-wrap behavior, place names may wrap at ordinary word boundaries, and the explicit scroll region remains available for the complete three-column table. This does not change rows, links, contact values, target sizing, table semantics, or the shared primitive.

No other screenshot issue was promoted: row spacing remains compatible with the existing 48 px link targets, and the current dark palette and dividers remain readable.

## Verification boundary

This was a source and supplied-image correction only. No browser, server, or tests were run. A fresh 390 px capture is required to confirm the initial visible column balance after CSS layout.

## r28 visual closure

I viewed `tools-current-app-{390,1440}-{light,dark}-r28.png` (4 images) at original detail. The fresh evidence closes the r27 P2:

- At 390 px, both **Extension** and **Email** are visible in the initial table viewport. Long emergency-department names wrap at ordinary word boundaries without clipping, while short ward names stay compact.
- The table remains inside the drawer with no page-level horizontal overflow. Row rules, values, and link text retain clear spacing and contrast in both themes.
- At 1440 px, all three columns remain aligned and compact; the local wrapping rule introduces no visible wide-layout regression.

No remaining P1/P2 is evident in the four changed-state captures, so no further source change was made. These images close the visual effect of the row-header correction only; they do not add keyboard, focus, print, forced-colour, or action-behavior evidence.
