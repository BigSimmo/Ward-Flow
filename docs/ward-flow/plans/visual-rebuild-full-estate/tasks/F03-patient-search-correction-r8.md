# F03 Patient Search correction r8

Date: 2026-09-13  
Writer: `/root/hub_inventory`  
Scope: Patient Search presentation only

## Inputs reviewed

- `F03-F04-F07-visual-review-r8.md`, specifically the Patient Search P2 finding.
- `patient-search-app-1440-light-r8.png`
- `patient-search-mock-1440-light-r8.png`
- `patient-search-app-390-light-r8.png`
- `patient-search-mock-390-light-r8.png`

The images were inspected at original detail. They are design inputs, not post-change acceptance evidence.

## Before-source evidence

Byte-for-byte copies are under:

`.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-F03-patient-search-r8/`

| Source                                                     | Before SHA-256                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/components/ward-management/search/patient-search.tsx` | `879B9BC5CB3E08D6EC000B29E3757B047002640542A63426BFDC8FAEF063B02C` |
| `src/components/ward-management/search/search.module.css`  | `60718F5F8F67807BE9042E88A78B3C3199CA0D061C73EE467DF417016A19178B` |

## Correction

- Replaced the visually separate people and movement/referral cards with one labelled Results console. It retains the three engine-authoritative populations as distinct subsections while giving them one bounded, keyboard-scrollable viewport.
- Added a compact console summary derived from the existing people and mixed result arrays. A refused query reports that nothing is returned and exposes neither result rows nor population counts.
- Reordered the narrow layout so Search, including the query, Stage, Department, refusal note, and live summary, appears before the bounded population. Desktop retains the drawing's Results-over-Search left column.
- Gave the desktop Selected panel a stable minimum height while keeping it in normal flow. The Access record remains beneath it and every existing preview state and action remains reachable.
- Flattened only the nested Results subsection panel chrome so the three populations read as one instrument. Existing rows, links, Preview actions, movement facets, movement table, empty states, and test ids remain intact.
- Print removes the Results viewport height and overflow constraints so no population is dropped.

## Preserved behavior and deviations

- Matching remains owned by `findPatients`, `searchPatients`, and `searchMovements`; no ranking, joining, or data derivation changed.
- The Stage and Department counts and the seven movement-only facets retain their existing scopes and keyboard behavior. They do not filter people or queued referrals.
- Selection, close-preview behavior, full-record links, Add this person routing, access-record-on-submit behavior, refusal behavior, and all governance text are unchanged.
- The app keeps all three real populations rather than adopting the drawing's movement-only sample rows. They are consolidated visually without pretending that person, referral, and movement records share one clinical schema.
- The page-local Search panel remains because this route's filters and access-record behavior depend on it; the narrow presentation moves it ahead of the long result population rather than inventing shell-owned controls.

## Source checks

- Prettier wrote both owned files once and reported both unchanged after formatting.
- TypeScript `createSourceFile` TSX parse: `TSX_PARSE_OK`.
- Next's installed PostCSS Modules local-by-default parser in `pure` mode: `CSS_MODULE_PURE_OK`.
- Static source assertions confirmed the existing refusal, matching, movement-facet keyboard keys, access recording, preview, population, and result test-id paths remain present.
- Tests, browser checks, and server work were not run, per controller ownership.

## After-source evidence

| Source                                                     | After SHA-256                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/components/ward-management/search/patient-search.tsx` | `56FB45A2CFA2D099D22DDE098AA04A5BE090449A915F15C31ECD76A88FAF6FF7` |
| `src/components/ward-management/search/search.module.css`  | `799FFDD03C62ED937CF3DFBBBFCABA6B2C323242F7BAF8442F89D5211B348CDF` |

Runtime and responsive acceptance remain with the controller.
