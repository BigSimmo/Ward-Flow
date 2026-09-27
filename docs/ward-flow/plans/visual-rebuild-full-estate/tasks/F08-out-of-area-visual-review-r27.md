# F08 Out-of-area visual review r27

Reviewed these 20 valid captures directly: `out-of-area-current-{app,mock}-{390,820,1440}-{light,dark}-r27.png` (12), `out-of-area-selected-app-{390,820,1440}-{light,dark}-r27.png` (6), and `out-of-area-group-end-app-390-{light,dark}-r28.png` (2). I excluded all group-end r27 files as instructed. This is a viewport visual review only; it does not establish behavior, full-page, print, or DOD completion.

Finding:

- **P2 — phone group summary labels are too narrow and wrap one word per line.** In both valid group-end captures (`out-of-area-group-end-app-390-light-r28.png` and `...dark-r28.png`), `IN A BED UNDER THREE HOURS FROM HOME` renders as six short lines in a roughly 90px label column, with a large blank value area beside it. `NO TRAVEL TIME HELD FOR THIS WARD AND HOME AREA` similarly wraps to four lines. The cards remain readable and do not visibly clip, but the label/value composition is substantially less compact than the drawing and makes the summary scan difficult. Smallest visual remedy is to give the label a wider minimum or allow the label/value pair to stack at the narrow breakpoint while retaining the value and absence prose.

No other P1/P2 defect was visible in the supplied viewport regions. At 390px the current app’s expanded rail/nav consumes the upper viewport, but the reference capture also presents its navigation; this was not treated as a defect. The mock captures show Capacity as the active navigation item while the app captures show Out of area; that is a capture-context difference, not evidence against the Out-of-area page. The app’s selected 390/820/1440 views show the real Broome/Kimberley detail and preserve the absence wording; no visible clipping or contrast failure was found there. The light/dark 1440 and 820 current views show aligned two-column content, readable selected-placement detail, and consistent panel borders.

Lower content, interactions, tab journeys, nested scroll behavior beyond the shown viewport, and print output remain unverified.

## r29 closure addendum

Reviewed fresh `out-of-area-group-end-app-390-light-r29.png` and `out-of-area-group-end-app-390-dark-r29.png`. The earlier P2 label-column finding is closed in these captures: `IN A BED UNDER THREE HOURS FROM HOME` now wraps to three balanced lines, and `NO TRAVEL TIME HELD FOR THIS WARD AND HOME AREA` remains readable without one-word-per-line stacking. Values remain visible beside each label in both themes. This closes only that r27 visual finding; it does not establish full-page, interaction, print, or DOD acceptance.
