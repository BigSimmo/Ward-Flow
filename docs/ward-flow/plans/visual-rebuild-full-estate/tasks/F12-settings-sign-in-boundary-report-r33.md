# F12 Settings inset and sign-in boundary report r33

Date: 2026-09-13

## Settings correction

The `Demonstration controls` paragraph reused the general `.body` typography class but, unlike the
other Settings panel bodies, had no containing `.stack` inset. The paragraph therefore started on
the panel border at every captured width.

`src/components/ward-management/settings/settings.module.css` now scopes the established Settings
panel-body padding (`0.75rem 1rem 1rem`) to `.body` inside
`[data-testid="ward-settings-demonstration"]`. No shared primitive, markup, copy, behavior, or other
use of `.body` changed.

- Before snapshot:
  `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-settings-demonstration-inset-r33/settings.module.css`
- Before SHA-256: `0E825951C3DD30F02213EDDAF7B12676B0229B31F4CA88838FBE8CC462BFC915`
- After SHA-256: `36F98567C00724BAC8A8E2EDC4CA2898CD15E628C81048B647B6EDA638443687`
- Prettier completed with no further change.
- `git diff --check -- src/components/ward-management/settings/settings.module.css` passed.

No test or browser check was run by instruction. Fresh visual evidence remains required to close the
Settings inset finding.

## Sign-in Ward-boundary review

All six `sign-in-ward-boundary-app-{390,820,1440}-{light,dark}-r33.png` originals were inspected at
full detail. No new visible P1 or P2 issue was found in the supplied region.

- The four `Refused to every role` cards remain bordered, readable, and contained at all widths.
- The selected Ward path's `Sign in as the ward` action has a proportionate target and remains
  visually distinct in both themes. Its adjacent wording says that choosing a role changes what the
  control _would_ open, so the observed not-wired announcement is consistent with the preserved D16
  demonstration boundary rather than an omitted authenticated flow.
- The `7 roles and 13 actions` reconciliation statement and the Appearance controls remain visible
  and contained. At 390 px, the three appearance choices fit beside their label without clipping; at
  820 and 1440 px they retain the intended end alignment.
- Light and Dark surfaces, text, borders, and selected appearance states remain legible.

Evidence hashes:

- `sign-in-ward-boundary-app-390-light-r33.png` — `2A100FF39DACBD78CC6DD7239C09FB5F6DCAE8C4E214D37379356756A86F26B3`
- `sign-in-ward-boundary-app-390-dark-r33.png` — `45986661103C532F2EE1AE0606CC9E1D3E8201E54D28DA58C1649C938A99F4B4`
- `sign-in-ward-boundary-app-820-light-r33.png` — `84DE5B9B2B85E58A7972E31CE578172539A60A813904437C949EE254230FB472`
- `sign-in-ward-boundary-app-820-dark-r33.png` — `F4F0FADC90E78648FCD45A978A3A7CFED3A726DA32B6210EE309BD93F0397334`
- `sign-in-ward-boundary-app-1440-light-r33.png` — `16D665F89FEDCECC9ECA8B816D0AE93BEA413B9343715362928303A2118D33DE`
- `sign-in-ward-boundary-app-1440-dark-r33.png` — `C797EDC2F7A1BD64FBDF6671231AEA89B96379ACB63A2E0124EC01971259FEAA`

This is a narrow visual review of the supplied lower boundary state. It does not prove the unseen
role-selection region, action announcements, focus/keyboard behavior, persistence, physical-device
behavior, authentication, or full sign-in DOD. The controller supplied the observed role counts and
not-wired announcement; they were not independently exercised here. No sign-in source, browser,
test, or verification JSON changed.

## Settings inset visual closure r35

The four fresh `settings-demonstration-app-{390,1440}-{light,dark}-r35.png` captures were inspected at
original detail. They close the r33 source-only Settings finding: the `Demonstration controls` copy
now has the same deliberate panel-body inset as the other Settings panels at both widths and in both
themes. It no longer starts on the panel border. The Thresholds heading, explanatory copy, table,
scrollbar, note, and Demonstration controls panel remain separated and readable. On phone, the wide
Thresholds table stays within its local horizontal scroll area while the panel and following copy
remain contained; this check found no new P1 or P2 issue.

Evidence hashes:

- `settings-demonstration-app-390-light-r35.png` — `9F2619F09E88E83F2906C9F392B49129752D682834DE9101CEACD5EA77BE4C17`
- `settings-demonstration-app-390-dark-r35.png` — `E6A19F6BC9A08F1231C7D2F3BDADFCE4A836A6F787CE3E2EE839BC135DFA7F16`
- `settings-demonstration-app-1440-light-r35.png` — `580F8372ED1D06BDB74F670716AF5E0938892DAC2A229E4D3F4A4E542A929075`
- `settings-demonstration-app-1440-dark-r35.png` — `6E0C610C31B356BDBBF32FC886B45FC1B90D851C8A2B141560C8788F9D7A568F`

This is a narrow visual closure of the r33 inset correction in the supplied viewport regions. It
does not establish full Settings DOD, keyboard or screen-reader behavior, print, physical-device
behavior, persistence, or content outside the captured regions. No source, browser, test, or
verification JSON changed during this closure.
