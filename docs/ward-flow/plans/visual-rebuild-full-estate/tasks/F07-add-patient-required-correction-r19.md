# F07 Add patient required-field correction r19

Date: 2026-09-13  
Builder: `/root/statistics_inventory`

## Change

The four identity fields already governed by `REQUIRED_FIELDS` now show a quiet **Required** marker beside their visible labels. Each marker is `aria-hidden="true"`, preserving the existing exact accessible label text. The same four inputs carry `aria-required="true"`, exposing their requirement without invoking native form validation or changing the existing custom availability and rejection path.

Gender remains optional. No Sex field, validation rule, handler, route, population or other panel was added or changed.

## Files and hashes

- `src/components/ward-management/patients/add-patient.tsx`: `C356A2A2A0908DBC2AB21A57EF37CD41FAF5FB57B9EAB1B587877CAAA82045B1` before; `BA341929ED4F257B41BB9A5F3884D9B4C6407EF691292DE63D43F325798CC06F` after.
- `src/components/ward-management/patients/add-patient.module.css`: `19763EB9E169670DFD69BBE40534BC42FE9D888905128953EFFC8C553DA3638A` before; `5C550545EAA7C300D26DD285C265A55D6DEBEB99F5D9EF8C169B1D627211E5F3` after.

Actual-before copies are under `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-add-patient-required-r19/`.

## Verification

- Prettier completed on both owned files and reported them unchanged.
- TypeScript transpile syntax diagnostics: 0.
- PostCSS parse: passed.
- Static count: exactly four `aria-required` attributes and four `requiredMarker` usages.

No test runner, browser or server was started as assigned. Fresh rendered and interaction evidence remains controller-owned.
