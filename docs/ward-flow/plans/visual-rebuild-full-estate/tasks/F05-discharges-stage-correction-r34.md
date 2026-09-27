# F05 Discharges Stage correction r34

Date: 2026-09-13  
Owner: `/root/hub_inventory`

## Scope

Changed only `src/components/ward-management/discharges/discharges-third-edition.module.css`.

The source before the edit was copied to `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-F05-discharges-stage-r34/src/components/ward-management/discharges/discharges-third-edition.module.css`.

## Change

The route-scoped fourth table column, Stage, now keeps its short values on one line and restores normal word-breaking with an intrinsic minimum width. The existing page-local table overflow rules are unchanged, so narrower viewports continue to use the bounded horizontal scroller rather than widening the document.

No shared WardTable primitive, board markup, values, grouping, actions, or engine behavior changed.

## Source evidence

- Before SHA-256: `D5CF9D8BBD1830AD20ED9CA20EC606AA442055DBEF13933887A55EA5B84653CF`
- After SHA-256: `79EFA82DFC4E137F90A7E295A780AC83E6F246F9DE4583B73609B8C29EC152F2`
- Static inspection: the CSS has balanced braces (`30/30`), and the new selectors are anchored by the local `.screen` class before their global table descendants.
- Tests and browser checks were not run, as requested. Fresh responsive capture remains controller-owned.

## Visual verification r35 — finding remains open

The four `discharges-stage-app-{390,820}-{light,dark}-r35.png` captures were inspected at original
detail. The 820 px cells still render `Confirmed` as `Confirm` / `ed` and `Expected` as `Expect` /
`ed` in the Stage column in both themes. The source-only correction therefore does not close the
P2. The 390 px captures show the table at its left scroll position, where Stage is outside the
captured region, so they do not independently prove the Stage rendering at phone width.

Evidence hashes:

- `discharges-stage-app-390-light-r35.png` — `A8CC00629A56147151BE9B508B2E14402F6C98BBA8B2CCF8F40EA4ED5E396510`
- `discharges-stage-app-390-dark-r35.png` — `8E3EE6D04F4CF6FF362DEFB1AD8B1CE79CC71A0DE183D2D03DE521EA310C2186`
- `discharges-stage-app-820-light-r35.png` — `5C22EA1D8F703D53D508587767C44F158743A22ABD418FBD163516BD6E15494C`
- `discharges-stage-app-820-dark-r35.png` — `B58C309148CF0ECC18D5AE446C7538F060ABDE951E33D8CE25399154D10A89F1`

The existing local table scrolling and page containment remain visible. A further correction must
address the winning table-cell wrapping rule or column sizing, then be recaptured at 820 px and at a
phone scroll position that exposes Stage. No source was changed during this visual review.

## Visual closure r36 — post-restart evidence

The four specified post-restart captures were inspected at original detail:

- `discharges-stage-closed-app-820-light-r36.png` — `C2D1E711B5D669129F03328F5BE58398CF67873D1F44CBC476168371A8534462`
- `discharges-stage-closed-app-820-dark-r36.png` — `9E7B0361159AD5111793ECAFB7FF0A9C9BF2429A95E7967771F015ADAC90CAA1`
- `discharges-stage-phone-end-app-390-light-r36.png` — `2FDB497FD6D269F62C0B291518288DC8C80F781470D93E58F19BE2F9588DB55B`
- `discharges-stage-phone-end-app-390-dark-r36.png` — `E0087C792050829B77BF0BBDC4678CAF8FD04CA367479B3F9EDD4B0BEA332B02`

These captures supersede the stale r35 visual result. At 820 px, every visible Stage value —
`Confirmed`, `Expected`, and `Discharged` — remains whole in both themes. At the phone table endpoint,
the `Expected` Stage values and Freshness column are simultaneously readable without mid-word Stage
breaks. The native horizontal scrollbar remains visible and local to the table.

Controller-supplied geometry records document width `375/375`, observed table scroll `196.8`, and a
maximum scroll of `228`; this confirms contained page width but the CDP-positioned endpoint is not
evidence of a user wheel or touch-scroll journey. No new P1 or P2 issue is visible in these four
cells. This closes the Stage-word-wrap finding only, not full Discharges DOD. No source, test,
browser, or canonical evidence record changed during this review.
