# F03 Patient Documents inset correction r32

Date: 2026-09-13

## Correction

The Documents empty-state sentence is a direct child of `WardPanel`, which has no body wrapper. Its
existing `.documentsNote` rule supplied typography but no inset, leaving the sentence flush against
the panel border at 390, 820, and 1440 px in both themes.

`src/components/ward-management/patients/person.module.css` now gives `.documentsNote` the existing
page-local panel-body inset, `0.5rem 1rem`, under the `data-ward-design="third-edition"` screen marker.
The exact truthful sentence, component structure, behavior, and legacy/default presentation remain
unchanged.

## Evidence

- Before snapshot:
  `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-patient-documents-inset-r32/person.module.css`
- Before SHA-256: `CD450BFE2256F6462737AEE04290A79A61259A3B17CFBCC39B10064F9F5CD179`
- After SHA-256: `4B560866F7A29F5D4DB49EF33D04041471AEE996F911C184C5AFB099282712AE`
- Prettier completed with the file unchanged after formatting.
- `git diff --check -- src/components/ward-management/patients/person.module.css` passed.

No tests or browser checks were run by instruction. Fresh served captures remain required to verify
the inset visually; this source correction alone is not visual acceptance or full DOD proof.
