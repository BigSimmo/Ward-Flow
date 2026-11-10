# Ward Flow master design (1 Nov 2026)

One page: shared tokens, the real kit, and a tab per screen. Synthetic data only.
Artifact: https://claude.ai/artifact/91BETDiimnJVbyeCb2sxcK (publish new versions here; total is ~79MB, so publish in two parts). Hub source: index.html. Kit sheet source: kit/.

Published folders and where each came from:

- m/ = redesign preview + kit.html/kit.js/kit.css, rebuilt from main dce1194a0 on 2 Nov 2026 after #1287-#1300 (same build as mn/; first built from f57da860 with Ward #1212, Pop-ups #1226, Forms #1228, Discharges #1229)
- st/ = statistics-hifi.patch applied on b93dfa4c, then built
- tr/ = transport/josh-upload-1102 (Transport Mock-up.zip)
- mv/ = movements/interactive-preview; ed/ = ed/mockup-bundle; ho/ = handover/preview
- pa/ = Patient Screen Redesign.zip; he/ = Ward Flow Redesign 1.zip (Help)
- al/ = alerts/alerts-redesign; cm/ = community/community-team-mockup.html; pu/ = popups screenshots; ac/ = alerts-clarity/hifi (interactive clarity proposal, not approved)

Rebuild from a Ward-Flow checkout on Node 24 (the repository requires it; in a cloud session use `/opt/node24/bin`), then copy kit/kit.html into `<pub>/m`:

```sh
node scripts/ward-flow/build-redesign-preview.mjs --out <pub>/m
node <master>/kit/build-kit.mjs <master>/kit <pub>/m
```

Frame URLs: frame.html?screen=<slug>&shell=next&theme=light|dark[&pop=<pop>]. Pop-ups use screen=<over>&pop=<pop> (see screens.ts MOCKUP_POPUPS).
When a screen's PR merges, keep its tab on the approved mock-up: the master is the design source and main can lag it (Q209, Josh 1 Nov 2026). Point a tab at m/ only after a side-by-side check at 390, 820, 1280 and 1440, light and dark, shows main matches it.

- mn/ = main's redesign preview built from main after #1276, #1278, #1282 and #1284 (2 Nov 2026, Q218 and Q221 plus Josh's go-ahead for the older pop-ups): the 20 pages with no approved redesign and their 21 pop-ups, drawn from main's real pages in the newest shell. Rebuild with build-redesign-preview.mjs --out <pub>/mn. The four retired community pop-ups (record drawer, Assign referral, transport booking and cancel) are gone because main no longer opens them.
- mn/ rebuilt from main d3372b7a (after #1283 and #1285) on 2 Nov 2026 11:08 UTC. Q230: the Home and Movements tabs now point at mn/ after a side-by-side check at 390, 820, 1280 and 1440, light and dark (evidence in ward-flow/master-q230/); Movements keeps the round 4 bundle as a second view.
- mn/ rebuilt from main dce1194a0 on 2 Nov 2026 after #1287-#1300 (pre-launch fixes Q260-Q306). All 74 m/ and mn/ tabs render at 390 and 1280, light and dark; thumbnails (th/) for those tabs re-shot. The phone dock now says Alerts (Q268). No tab re-pointed: Handover, ED board and Transport are close to their mock-ups but not an exact match (Q209 candidates only).
- b/ = BL86 viewer now only for the archived role views and the Not wired state, with main's global.css (tokens) swapped in (Q142, 1 Nov). Role views (as-*) show older layouts and are archived (Q156, 1 Nov): listed last under "Archive, old layout", not to be built from.
- rules.html = Rules and lessons tab.
