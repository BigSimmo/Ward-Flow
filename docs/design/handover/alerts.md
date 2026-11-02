# Alerts redesign handover (1 Nov 2026, 17:25 UTC)

Spec: BUILD-SPEC in /mnt/project-files/ward-flow/mockups/alerts/ (mock-up alerts-redesign/mock.js, mock.css; screenshots/). All six steps are built.

## State

- Merged to main: #1230 (act-now rule), #1233 (Today band), #1237 (list and views), #1238 (side panel), #1239 (hairline), #1240 (chosen units), #1245 (composer, Broadcast tab, Q153 phone hero).
- Merged 17:26-17:35 after Josh said yes at 17:23:
  - #1254 Add units on a live broadcast (Q149). New event ADD_BROADCAST_ALERT_UNITS (coordinator, bed_manager). The dialog is bound to the broadcast that opened it (Codex finding, fixed ea7f25b6a).
  - #1255 eight CodeRabbit fixes found on #1238 (Activity column width, officer note, quiet-ward Next alert, snoozed legal note, Forecast/Snoozed sibling lanes, owner count without snoozed, band stacking by drawn position, exact Now count). The other two findings were withdrawn by CodeRabbit.
- Q148 (Extend is 30 min) done. Q149 in #1254.

## Notes

- Known unrelated reds: Supabase shared sign-in flake (unit shard 2); Midland phone layout shift fixed by Community #1249; Discharges history toggle in browser journeys 3.
- alerts-screen.tsx sits near the 1500-line cap; trim comments or extract before adding.
- Hidden templates kept in the model but not offered as quick starts: ED liaison busy, Adolescent beds full, Forensic beds full.
- Setup: export PATH=/opt/node24/bin:$PATH; WARD_SIGNOUT_FILE=/mnt/project-files/ward-flow/signout/sign-out.md for commit and push. Claims in signout/claims/_c875re_.
- What's new line merged in #1258. Nothing left to do on Alerts.
