# F05 Ward statistics correction r19

Date: 2026-09-13  
Plan scope: `statistics/statistics-ward-screen.tsx` and `statistics/statistics-ward-third-edition.module.css` only, plus this report.  
Review basis: `F05-F11-statistics-visual-review-r19.md`.

## Before evidence

Exact pre-edit copies are in `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-statistics-ward-correction-r19/`.

| Source                                                                               | Before SHA-256                                                     | After SHA-256                                                      |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `src/components/ward-management/statistics/statistics-ward-screen.tsx`               | `36F43921FDFACC805A127184BA9368F05571FEFFB0D2C95EAA0801C5D4CF5EF6` | `BF4F918276C8E05F3BD23FCD9B54D5C7125ED9BC1B55BDA7013EC9AA42F32755` |
| `src/components/ward-management/statistics/statistics-ward-third-edition.module.css` | `3A0B8EBAF47557F1EB8726BDB11E8C3F79749B169CB22F14D633C80AA44D24FD` | `5EB5C2259AC4221EF67806233E060A900E1F9D1E3DDFE94166450D5AA5E2F262` |

## Correction

- The discharge share row now has its own readable label/value tracks. At 40rem and below it stacks into one column, retaining the existing value, denominator, unmeasured state, and test ID without introducing horizontal overflow.
- The clinically-ready count and share now form a two-cell KPI band. Existing values are merely re-presented: `headlineTotal` remains the count, `ready.shareOfWard` remains the percentage figure, and every zero, error, unmeasured, population, reason-row, and denominator branch is unchanged.
- The former inner section heading was redundant with the `WardPanel` heading and the new KPI label. Removing that duplicate restored one unambiguous accessible occurrence inside the tested section while leaving the panel heading and visible KPI label intact.

No engine, derivation, population, clinical wording, action, shared frame, shell, or test source changed.

## Verification

- `npx prettier --check src/components/ward-management/statistics/statistics-ward-screen.tsx src/components/ward-management/statistics/statistics-ward-third-edition.module.css` — passed.
- Initial focused run: `npm test -- tests/ward-statistics-ready-section.dom.test.tsx tests/ward-statistics-ward-shares-agree.dom.test.tsx` — 1 of 12 tests failed because the new KPI label duplicated the existing inner heading.
- After removing that redundant inner heading, the same focused command passed: 2 files, 12 tests.

No browser, server, print, or new screenshot verification was run by this worker. Served visual closure remains with the controller; this report does not claim visual acceptance.
