# Alerts page redesign mock-up (1 Nov 2026)

Mock-up only. Nothing in the app has changed.

- `alerts-redesign/` holds the new Alerts page, built inside the real app frame (rail, top bar, styles and fonts captured from the running app). `desktop.html` and `phone.html` read `?theme=dark|light` and `?bc=none`.
- `viewer-index.html` is the Ward Flow Redesign side-by-side viewer (artifact BL86wBgPv41hzMG2QWMwB3) with one change: on the Alerts page the Redesign pane loads `alerts-redesign/` and an "Alerts: New design / Current mock-up" switch shows the existing component version for comparison. It opens on Alerts.
- All data is the synthetic demo at 10:42.
