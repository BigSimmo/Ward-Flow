# F03/F07 narrow visual closure r21

Date: 2026-09-13  
Reviewer: `/root/hub_inventory`  
Mode: independent screenshot review

## Evidence inspected

All 12 requested original-detail captures under
`.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/`:

- `referrals-register-{app,mock}-820-{light,dark}-r21.png` (4 images)
- `add-patient-{app,mock}-{390,1440}-{light,dark}-r21.png` (8 images)

This was a narrow closure against the known r19 findings, not a new audit of unchanged behavior or
content.

## Verdict

No current P1/P2 is visible in the requested regions.

### Referral Register: r19 tablet clipping finding closed

In both 820px app themes, `Queued (6)` now has a clear bounded region with a persistent native
vertical scrollbar. All six queued records are fully rendered at the initial position; the boundary
does not cut through the last visible row. `Recently decided` and the unselected Referral detail
panel remain visibly subsequent sections rather than being mistaken for clipped queue content.

The app retains its real six-record population and does not mimic the drawing's different seven-row
sample or selected referral. The drawing comparison supports the intended bounded-register form;
the population and selection differences remain engine-authoritative.

### Add patient: r19 required-field finding closed

At 390 and 1440 in both themes, **Required** appears directly beside each of the four governed
identity labels: Record number, Date of birth, Given name, and Family name. Marker spacing remains
visually associated with the corresponding label without colliding with the input or adjacent
column. Gender remains visibly separate and optional, preserving the current four-field identity
contract rather than importing the drawing's Sex requirement.

The `Identity and what is known` header and introduction retain a clear boundary from the form. At
1440, the four required controls form two aligned columns and the `Already on the board` heading is
aligned in the adjacent panel. At 390, the same controls stack with consistent label/input spacing;
the section heading, title, and prototype badge fit without horizontal clipping. Light and dark
states retain readable marker, heading, border, placeholder, and notice contrast.

## Limits

- These are static first-viewport images. The Register evidence does not prove scrollbar keyboard or
  touch operation, scroll end behavior, selection, focus order, or decision actions.
- Add patient evidence does not prove accessible-name computation, `aria-required`, validation,
  duplicate checking, mutation behavior, or content below the captured phone viewport.
- Print, forced colors, screen-reader output, physical-device behavior, hosted behavior, and human
  acceptance remain unverified.
- No source, canonical evidence JSON, PROGRESS file, browser, server, or test was changed or run.
