# F04 Intake CSS correction r27

## Scope

Changed only `src/components/ward-management/referrals/referrals.module.css`. The pre-change file was copied to `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-intake-css-r27/referrals.module.css` before editing.

## Corrections

- The desktop Intake context grid now aligns its three cards to the start. `Progress` and `What sending does` keep their intrinsic height instead of stretching to the much taller referral-summary card.
- At the phone breakpoint, the History fieldset's existing warning paragraph clears the intentionally floated semantic `legend` and gains the normal small block gap. This preserves the fieldset/legend accessibility structure while preventing the wrapped legend from colliding with the warning copy.

Both rules are gated by `data-referral-view="intake"`. The shared Referral register and Match selectors, all labels, controls, validation, and behavior are unchanged.

## Verification

- `prettier --write src/components/ward-management/referrals/referrals.module.css` — completed.
- PostCSS parse of the final stylesheet — `CSS_PARSE_OK`.
- No tests or browser checks were run, per controller ownership. Fresh desktop and 390 History captures remain required to visually close the two P2s.

## Hashes

- Before CSS and snapshot: `666f97c1f62cd480c546979567f6ba38500520f4c627a29192bd2630658e3f4a`
- After CSS: `4ac3533f6bea1bb62050300b47b95c729a0e27407e26b3b28e7e0e4b23f9df44`
