# F03 Patient Search and Patient Now implementation report r1

Date: 2026-09-13  
Implementer: `/root/hub_inventory`  
Plan: `docs/ward-flow/plans/2026-09-13-visual-rebuild-full-estate.md`  
Frozen plan SHA-256: `2194350E1AD66ED47049CF7EAA115DB7789D8BEBAE18AB06C465559B253B4155`

## Scope

Changed only the accepted F03 page-local presentation files:

- `src/components/ward-management/search/patient-search.tsx`
- `src/components/ward-management/search/search.module.css`
- `src/components/ward-management/search/record-preview.tsx`
- `src/components/ward-management/search/record-preview.module.css`
- `src/components/ward-management/patients/person-screen.tsx`
- `src/components/ward-management/patients/person.module.css`

F04 Raise a referral remains unclaimed because its stylesheet is shared by intake, board, and match screens. No engine, provider, shared shell, primitive, test, or canonical design document changed.

## Design sources inspected

The authoritative served references were viewed at original detail before the design edits:

- `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/patient-search-reference-1440-light.png`
- `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/patient-search-reference-390-light.png`
- `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/patient-now-reference-1440-light.png`
- `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/patient-now-reference-390-light.png`

## Implementation

Patient Search now composes the third-edition shell tokens and presents the drawing's responsive order: Results, Search, Selected person or movement, then Access record. The desktop workspace uses two columns with Results and Search on the left and selection and access history on the right. Phone reading order stays linear and all controls remain in flow. The local typeahead, stage and department filters, refusal response and live region, three result kinds, preview actions, and session-only access record retain their existing handlers and derivations. Selected record names moved into the panel body so the panel heading states its stable purpose.

Patient Now now composes the same token layer, uses the drawing's persistent panel and tab geometry, and keeps a full-width `The person now` identity band above the allowed record workspace. The Now, Details, and Documents tabs keep their roving keyboard behavior and hidden-panel contract. The referral action and its pointer/privacy explanation remain intact. The safety disclosure remains visible as a subsequent full-width band on both screens.

Both screen roots carry the established third-edition and rebuilt-screen markers. Print rules reset third-edition surfaces and expose all Patient Now tab panels without changing screen visibility.

## Deliberate deviations

- Patient Now does not render the drawing's movement verdict, seven-stage journey, referrals, History, or Community content. This route is explicitly forbidden from reading referral, movement, or unit state under FD-23. Adding those panels would either invent facts or breach the existing ward visibility boundary. The visible absence explanation remains beside the record tabs.
- Patient Search retains its page-local clinical lookup despite the shared shell search. The local control owns patient, referral, movement, stage, department, refusal, typeahead, and access-record behavior that the universal shell search does not replace.
- Search results remain separated into the existing people and movement/referral result panels rather than being flattened into the drawing's synthetic six-row list. This preserves the engine's actual three result kinds, add-person path, filters, links, and accessible tables.
- The complete not-a-medical-device and closed/arrived warning remains visible; the drawing's shorter prose does not supersede that safety content.

## Before-source evidence

Copies preserving source-relative paths are under `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-F03/`.

| File                        | Before SHA-256                                                     |
| --------------------------- | ------------------------------------------------------------------ |
| `patient-search.tsx`        | `C5AF2764F27A351A43087F8BA52B82B35D35A15B28D7F21E9E8258064AE30988` |
| `search.module.css`         | `7FFB6E0792D530741DA63FE2ECDB529399EFA15F7C8C2B0376F3B7FE8981FEE3` |
| `record-preview.tsx`        | `D3630EB239EA09A26CF8CC411CBAD16CA102924E840E03C6289716789131783B` |
| `record-preview.module.css` | `F1F5DEBDB35605BE5068127FC6C3AADAE2D723F1C012F83941638122E8E8D093` |
| `person-screen.tsx`         | `D65258314041FBD8ADAC8284DA51B1EF68E9382A48970D53D627902FEF876736` |
| `person.module.css`         | `57F5EDABC6CE88084B96F2B58B922B9159A52C7115A56A63697A0CE42D6707B1` |

## After-source evidence

| File                        | After SHA-256                                                      |
| --------------------------- | ------------------------------------------------------------------ |
| `patient-search.tsx`        | `879B9BC5CB3E08D6EC000B29E3757B047002640542A63426BFDC8FAEF063B02C` |
| `search.module.css`         | `60718F5F8F67807BE9042E88A78B3C3199CA0D061C73EE467DF417016A19178B` |
| `record-preview.tsx`        | `2CCEE817569D43D7D0DFF5654FA0017815180077945DF9A16374B09FB790BEA3` |
| `record-preview.module.css` | `D7BC4DFDEB99E8430BA1E552C4A80FC1D85303B30C086BCC326595B0C7BB9C6D` |
| `person-screen.tsx`         | `5D8741CA7F7CAD0172080FE72B8A49F14659D1D2A3405BA6D2EB5D4B789DEA7E` |
| `person.module.css`         | `C6E6EA8529AEFCC42D8A8CDFEE6F8A342696224DFABFCBCEFC32366C0A82F9B6` |

## Source checks

- Prettier wrote the six owned files once; the final comment-only adjustment was formatted once in `patient-search.tsx`.
- TypeScript `transpileModule` parsed all three TSX files without error.
- PostCSS parsed all three CSS Modules without error.
- Every `styles.*` reference in each TSX file resolves to a class in its paired CSS Module.
- A PostCSS selector walk found a local class in every selector branch in all three CSS Modules; no bare attribute selector was introduced.

Tests, browser runtime, server work, and visual acceptance were not run by this implementer under the controller-owned verification boundary. The served references above are design input, not evidence that the application output matches them.
