# F03 Patient Now implementation — r1

Scope was limited to:

- `src/components/ward-management/patients/person-screen.tsx`
- `src/components/ward-management/patients/person.module.css`

Actual pre-edit copies were saved at `C:\Users\joshs\AppData\Local\Temp\ward-f03-person-before-r1`.

Pre-edit SHA-256:

- `person-screen.tsx`: `5D8741CA7F7CAD0172080FE72B8A49F14659D1D2A3405BA6D2EB5D4B789DEA7E`
- `person.module.css`: `FA668027F06472E6BEF457F581880BF1E01733528EEA1B117CBDE5BB6306843A`

The supplied r8 pairs were viewed at original detail:

- app 1440: `77B627185ECEFFD35336E787AC6F96E5CF4AB763CB4077181A8E7E2E2842FB8A`
- drawing 1440: `ADEADC657CCBBC9E0C391AB436B222F4A11DFD3CF06C303CE9A788CAE116D679`
- app 390: `D4EE008BCCE9C1EDD1956E49FA05D50ED2BC9F67D3003771FE0402E76CEF9124`
- drawing 390: `AA08FE087D8025777B70BCD4CBCBF2EA7E08F1CA3CAAAE23F2004542DFDF9E97`

Changes:

- The current identity panel now leads the record workspace, followed by the existing action block and then the Now/Details/Documents tab controls. The existing tab panels remain mounted with their roles, IDs, labels and hidden-state behavior.
- The existing `Refer Patient` link, pointer wording, identity facts, derived age, sensitive-field placement and FD-23 text were preserved. The action remains the same route and does not copy identity data.
- Added an explicit current-movement/eligibility absence statement. No referral, movement, destination, owner, blocker or journey fact was fabricated; the movement projection remains a recorded dependency from the review.
- Added third-edition layout rules so identity and action share the leading desktop workspace and collapse to one column on phones. Removed the obsolete local phone-bar top reserve. Existing third-edition token composition remains on the screen root and new styling uses its canonical `--line`, `--surface`, `--muted`, `--t-*` and `--r1` tokens.

Post-edit SHA-256:

- `person-screen.tsx`: `D463DB86D0908E9B5EBE1D652A4B490A2568C3468128820850D09AE30DE28FF8`
- `person.module.css`: `477DCA084DC7501CE99F4A316EC03398EF4DDCA7DEC8609D303931EBCDE87C7B`

`git diff --check` passed for the two owned files. Tests, server, browser rerender and print checks were not run under this task. The screenshot hashes above are supplied pre-edit evidence only; no new visual acceptance claim is made.
