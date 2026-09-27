# F03 Patient Now r16 visual review and correction

Date: 2026-09-13. Reviewer/implementer: Codex Luna (independent review lens; also authored the prior Patient Now source). Scope: all 12 served r16 app/mock captures at 1440, 820 and 390 px in light/dark.

## Findings

- **P1:** app light captures showed identity values and the “What you can do” heading almost white on white, including 1440, 820 and 390. Dark captures were readable.
- **P2:** desktop app layout placed identity/action/workspace on a staggered diagonal grid, unlike the drawing’s coherent identity/action band followed by the record workspace. Narrow captures remained contained; no horizontal page overflow was visible.
- The app’s explicit current-movement/eligibility-unavailable statement and absent History/Community wording are truthful FD23 behavior and were retained. The drawing’s movement journey/referral content is not evidence that those projections may be fabricated.

## Correction

Only `person-screen.tsx` and `person.module.css` are owned by this task. The source already preserved the identity fields, referral handler, three allowed tabs, FD23 absence wording and sensitive-field ordering. The CSS correction binds third-edition text/surface aliases to the local ink ramp and gives the desktop record panel explicit `identity actions` grid areas, with the tablist and other panels in the next full-width grid row. Existing print, forced-colour, responsive and hit-target rules remain in place.

Static checks only: PostCSS parse passed; TypeScript transpile syntax diagnostics 0. Prettier `--check` was run and reported existing style differences in both owned files; no formatter write or runtime test was performed. Browser recapture, interaction, keyboard, print, lower-page and human acceptance remain pending.

Actual-before copies: `C:\Users\joshs\AppData\Local\Temp\patient-now-r16-before`.
