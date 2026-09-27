# F02 Ward form visual closure r31

Date: 2026-09-13  
Scope: read-only review of `ward-update-forms-app-{390,820,1440}-{light,dark}-r31.png` at original detail.

The r28 correction is visually closed at the widths where the affected controls are present:

- At 820 and 1440 px in both themes, **Waiting on** shows the full `Choose what it is waiting on` value and **Blocker** shows the full `No blocker` value. Neither select crosses its form boundary.
- At 1440 px, **Flag bed coming free** retains an ordinary single-control height below the field row instead of stretching to the former multiline-field height. The 820 action is likewise proportionate.
- The bed-count explanation visibly reads `the two can disagree. Confirmed here counts…` at 390, 820, and 1440 px in Light and Dark. The missing JSX word boundary is closed.

No new P1 or P2 defect is visible in the supplied changed regions. Labels, values, actions, form boundaries, and Light/Dark contrast remain readable.

The 390 captures end during the preceding **Confirm allocatable beds** section, before the Waiting-on, Blocker, and Flag-bed controls. They therefore close the prose-spacing defect at phone width but do not provide phone visual evidence for the two select widths or release-action height. The captures also do not establish focus, validation, submission, print, or below-fold behavior. No source, tests, or browser state was changed in this review.

## Phone form addendum — r32

The two fresh `ward-flag-form-app-390-{light,dark}-r32.png` captures close the phone evidence gap
identified above. In both themes, **Waiting on** shows the complete `Choose what it is waiting on`
value, **Blocker** shows `No blocker`, and both selects remain within the form column. **Expected
free** stays proportionate beside its label, while **Flag bed coming free** occupies one contained
full-width action row rather than stretching from a neighbouring field. The following bed-release,
bed-ready, and leave-bed sections remain readable and contained; the leave time control and action
also fit the phone column. No new P1 or P2 issue is visible in these supplied phone regions.

Evidence hashes:

- `ward-flag-form-app-390-light-r32.png` — `6ACC3642F4C2F1DB0349E2A6716A14B2D1140CDD68332161E8CC3CAF12E39205`
- `ward-flag-form-app-390-dark-r32.png` — `DEEE6CEA80C64D5627D83BC601EA7EB1058220FE17BB54D3C827D95E8D6C80A7`

This addendum is still screenshot-only evidence. It does not establish focus, validation,
submission, print, below-capture content, or full Ward design acceptance. No Ward source, tests, or
browser state was changed for this addendum.
