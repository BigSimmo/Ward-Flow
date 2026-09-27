# F03 Patient Now polish r17

Date: 2026-09-13  
Builder: `/root/statistics_inventory`  
Source scope: `src/components/ward-management/patients/person.module.css` only.

I viewed the served `patient-now-app-1440-light-r17.png` and paired `patient-now-mock-1440-light-r17.png` at original detail. Their SHA-256 hashes are `810596643947CF4CB671C0038FCAF58A981183C1CC8C4B6A89E9F32B1628F25E` and `6816C8C2670CCFF60F775977E331AF4F4374754607D9A967C8AC10FBD2FCE84C` respectively. These first-viewport images support the targeted visual correction; they do not prove interaction, print, phone layout or lower-page content.

The third-edition identity rows, derived-age explanation and current-movement absence now use the drawing's 16px subject-body inline inset. The rules are marker-scoped and use fixed local spacing, because `WardPanel` has no body wrapper and its nested `--ward-space-*` values are not available to these page-owned descendants. The age figure keeps the shared primitive's existing 16px inset. The third-edition `Refer Patient` action remains the same 48px filled link but drops its nested elevation and uses the canonical panel radius; the surrounding action panel continues to carry the surface elevation.

No TSX, handlers, routes, populations, identity facts, age derivation, FD-23 absence wording, test ids, shared primitives or legacy styles changed. No movement history or projection was added.

Actual-before snapshot: `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-patient-now-polish-r17/person.module.css` (`55E28E48D6A881561E9296D2E63FF766432E1D405B03FC99CFD21EE325F94217`). Final stylesheet SHA-256: `CD450BFE2256F6462737AEE04290A79A61259A3B17CFBCC39B10064F9F5CD179`.

`npx prettier --write src/components/ward-management/patients/person.module.css` completed and reported the file unchanged. Tests and browser/server checks were not run as assigned; the controller owns the fresh rendered comparison. The previously supplied 177-test Patient Now batch is controller evidence and was not rerun here.
