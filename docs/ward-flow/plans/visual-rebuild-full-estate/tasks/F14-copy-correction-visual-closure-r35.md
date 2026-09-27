# F14 copy-correction visual closure r35

Date: 2026-09-13  
Reviewer: `/root/hub_inventory`  
Scope: bounded read-only review of 12 current copy-correction captures. This is not full-screen Definition-of-Done evidence.

## Evidence inspected

All captures were inspected at original detail:

- `patient-preview-accepted-app-{390,1440}-{light,dark}-r35.png`
- `governance-effectiveness-app-{390,1440}-{light,dark}-r35.png`
- `alerts-override-limits-app-{390,1440}-{light,dark}-r35.png`

Exact image hashes:

- `patient-preview-accepted-app-390-light-r35.png` — `B7FE4AE0E71BA1499C46F5560F14E03384198186ED77A4685F9066F58CE57B28`
- `patient-preview-accepted-app-390-dark-r35.png` — `7842A52E6747EE3DA1629A708BF53683C78D26F4017216D92AAAF85E294B29F5`
- `patient-preview-accepted-app-1440-light-r35.png` — `55C33A6F39439C1366C26C57D2EF0B9565764D50C087FE412CCE7A098DB105CD`
- `patient-preview-accepted-app-1440-dark-r35.png` — `12A359D684B806EEF700613F25CC27F0565EB0BFC46B0E52545844B4B357AD9B`
- `governance-effectiveness-app-390-light-r35.png` — `A13F679F9B7516311DD6C22BE561A585AC994A0E166E5198310E98CDA30EA36D`
- `governance-effectiveness-app-390-dark-r35.png` — `168DF51249A8F7B25ED68981E98ABB9BF951D09045CC8158A1BBC9A4ACB4B091`
- `governance-effectiveness-app-1440-light-r35.png` — `FE1AB4A29F0F7535B0FD41069A7654045FCDA79D45659659A479E2B61836D982`
- `governance-effectiveness-app-1440-dark-r35.png` — `DE1D85053DC1EF40B8E456779752A9F51D3E537CE8A28B0EBB33F9C704EC1855`
- `alerts-override-limits-app-390-light-r35.png` — `4ED4138F653BD9637EEBD2EE48AEA657155432FF846A7110DC1D44AA92134CEF`
- `alerts-override-limits-app-390-dark-r35.png` — `9D203A57FFC601632AB2A909F57A2B04E848F61904D2D79CDB5D90B4EA73585E`
- `alerts-override-limits-app-1440-light-r35.png` — `0A2D8C52DB8197CA492E7E4123B021A0642CF6B52B0EBE1808A41E0ED69401AB`
- `alerts-override-limits-app-1440-dark-r35.png` — `27F52105EC31393E7D6E7EB12011DB4DC62B978D8A4A42941E0513CEBFCCF687`

## Corrected claims

Patient Search now presents RF-010 consistently as Accepted: a destination has agreed, and the next line says that no destination declined before acceptance. It no longer pairs the accepted status with waiting/no-bed wording. The referral and no-linked-movement statements remain readable and contained at both widths and in both themes.

Governance now says the proposed legal-deadline effectiveness measure is not published, while explicitly retaining deadlines as recorded and monitored operational alerts. It makes no claim that the deadline records were removed or that an effectiveness value was computed for them.

Alerts now states the precise limitation: the screen cannot identify a prior gate verdict because the record retains who, when, fixed reason, and wards, but not that verdict. The override explanation remains visually subordinate to the operational alert list, and the adjacent handover absence explanation remains present.

These three corrections are visually clean in the supplied cells. Text, card boundaries, callouts, and hierarchy remain readable in light and dark themes without clipping.

## P2 — Governance subtitle contradicts its first measure

The Effectiveness panel subtitle says `Two measures computed from this synthetic scenario`, while the first measure immediately says `Not enough data to compute`. This is internally contradictory and overstates the available output.

Smallest fix: describe the panel as holding two proposed or reported measures, or state that one measure is currently available. Preserve the existing sample-size disclosure and the honest not-enough-data result.

No P1 finding was observed.

## Limits

This review covers only the visible regions and corrected copy in the 12 named screenshots. It does not independently exercise state transitions, links, focus/keyboard behavior, print, screen readers, physical devices, or other page states. No source, browser, test, or canonical evidence ledger changed.
