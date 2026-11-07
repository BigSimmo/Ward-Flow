# 6 Nov 2026, #1495 Five pages move to the right drawer

Measured on hosted CI (Ward Flow production build, run 42304194656) merged with `main` at `66bd2196`, using main's own saved measurements for main alone (in brackets).

Raised:

- ED detail `/ward-flow/ed/arm-ed`: 649.7 KB (647.8). Budget 649.0 raised to 650.1, the measured size plus 0.3 KB, plus 0.1 KB for the drawer focus-return prop added in the next push.

The ED page imports none of the five moved screens directly. The 1.9 KB growth sits in shared chunks the ED page also loads: the kit `PanelDrawer` path now carries the Transport, Alerts, Discharges, Out of area and Search drawers' shared pieces. A trim was looked for: the removed inline panels, the Search sole-result logic and the old preview helper are already gone in this PR, and no further cut keeps the drawers. The raise is 1.1 KB, inside the 5 KB per screen allowance in HOW-WE-WORK section 6. Every other screen was within budget on that run. Not yet measured on hosted CI after this push.
