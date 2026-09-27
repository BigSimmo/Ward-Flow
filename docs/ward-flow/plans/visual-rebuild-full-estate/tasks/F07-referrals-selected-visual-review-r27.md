# F07 referrals selected-state visual review r27

Date: 2026-09-13  
Reviewer: `/root/hub_inventory`  
Scope: visual review only; no source, browser, test, or canonical evidence-record changes.

## Evidence inspected

I viewed all six supplied app captures at original detail:

- `referrals-selected-app-390-light-r27.png`
- `referrals-selected-app-390-dark-r27.png`
- `referrals-selected-app-820-light-r27.png`
- `referrals-selected-app-820-dark-r27.png`
- `referrals-selected-app-1440-light-r27.png`
- `referrals-selected-app-1440-dark-r27.png`

I compared them with the six previously reviewed served-reference captures from r19:

- `referrals-mock-{390,820,1440}-{light,dark}-r19.png`

The reference is available, but it does not show the same state. Its 390 px captures show the triage-list top, while its 820 px and 1440 px captures show RF-001 with the general Decision/reasons treatment. The r27 app captures show RF011 with its real unit-specific travel-band controls. The reference therefore supports comparison of panel density, spacing, and visual language, but not an exact selected-state parity claim.

## Verdict

No current P1 or P2 visual issue is evident in the supplied RF011 selected-state captures.

- At 390 px in both themes, the open first travel band, available-unit actions, mismatch explanations, native reason selectors, and disabled override actions remain fully contained and readable. There is no horizontal clipping or page overflow.
- At 820 px and 1440 px, cards, selectors, and buttons retain clear spacing and alignment. The captures show ordinary vertical continuation rather than clipped panel content; the page scrollbar remains available.
- Available, mismatch, and disabled states remain distinguishable in light and dark themes. Button labels, native select arrows, supporting copy, and boundaries are readable.
- The unused area beside the selected workspace at wider sizes is not recorded as a defect: these captures show a different engine-authoritative selected state from the served reference, and there is no evidence that the space causes clipping, obscures controls, or creates horizontal overflow.

## Limits

The captures prove only the visible RF011 state with the first travel band open. They do not prove the full lower scroll extent, the contents of both later closed bands, keyboard/focus behavior, selecting a reason and enabling an override, or the resulting action. Exact reference closure is not claimed because the served-reference captures show a different selected referral and control structure.
