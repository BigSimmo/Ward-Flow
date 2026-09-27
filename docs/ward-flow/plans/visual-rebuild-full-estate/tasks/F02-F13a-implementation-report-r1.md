# F02 Ward, Wards, ED and F13a Ward Answer implementation report r1

Date: 2026-09-13  
Writer: `/root/hub_inventory`  
Frozen full-estate plan SHA-256: `2194350E1AD66ED47049CF7EAA115DB7789D8BEBAE18AB06C465559B253B4155`

## Decision applied

The final correction in `F13-integration-decision-brief-r1.md` supersedes its historical one-route mapping. The existing `/mockups/ward-flow/ward/[unitId]` remains the ward overview. A reachable sibling `/mockups/ward-flow/ward/[unitId]/answer` now presents the ward's answer workflow. Both render the same parameterized `WardScreen`, provider state, derivations and action handlers; reducer or event logic is not copied.

No separate presentation component was needed. `WardScreen` accepts `presentation="overview" | "answer"`, defaulting to the existing overview. This is the smallest seam that gives the two commissioned drawings distinct routes without creating a second state reader or action implementation.

The shared bar will need to label the new sibling route **Ward answer**. That route-title mapping remains shared-shell work and was not changed here.

## Ownership and before-source evidence

Changed existing files:

- `src/components/ward-management/ward/ward-screen.tsx`
- `src/components/ward-management/ward/ward.module.css`
- `src/components/ward-management/wards/ward-index.tsx`
- `src/components/ward-management/wards/ward-index.module.css`
- `src/components/ward-management/ed/ed-screen.tsx`
- `src/components/ward-management/ed/ed.module.css`

Added:

- `src/app/mockups/ward-flow/ward/[unitId]/answer/page.tsx`

The six original files were copied byte-for-byte under `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-F02/`. `new-paths-absent.json` records that the route and the optional presentation-component paths did not exist before the pass.

| Existing source               | Before SHA-256                                                     |
| ----------------------------- | ------------------------------------------------------------------ |
| `ward/ward-screen.tsx`        | `7C6AD818BBB729025FBCA53FC836470D49FA096F770E45A54C649FE5264E4A05` |
| `ward/ward.module.css`        | `8806AB0D96B52492E692292A1D90F87953F037340BF9030EFDDFE8CE696A7586` |
| `wards/ward-index.tsx`        | `8EADCABB344D716A328DAC1A1032DD600F6617BCAA1A94D4735DE339E44F1262` |
| `wards/ward-index.module.css` | `116DBB26F266FF91DB964FB09D4BBE291F615AB0CA1D844F88A128AAAC0FB7D6` |
| `ed/ed-screen.tsx`            | `1D83A650AE7AADE1B085A6E6B873B8A2D2B6BFE95F7364906207DACF1D9B1337` |
| `ed/ed.module.css`            | `F08EF73D7ECD81B141B9421D2C9235C65276ECD8C37267DB9501049547ABBF40` |

No shared shell, provider, reducer, derivation, primitive, fixture, drawer, test, or existing route page was changed.

## Served design inputs inspected

All four supplied references were inspected at original detail:

| Reference                              | SHA-256                                                            |
| -------------------------------------- | ------------------------------------------------------------------ |
| `ward-reference-1440-light.png`        | `03AD1CD473840951149B80934452E9B44912F47FA04D47E5B8BAAE42E644DA82` |
| `ward-answer-reference-1440-light.png` | `BFC40AE0D9156D078568613C81840B58EAEE4C39D228E8BCA0EF5E25892D0387` |
| `wards-reference-1440-light.png`       | `332460C545ABF6F863A7A7859948B06339E2239C5CCCA13CFAEC82460E230A65` |
| `ed-reference-1440-light.png`          | `F47E97D6EDFC623E2D6AA9A8EF20847C8DD6C66562D51E4769B8AD459C4A979B` |

The HTML structures were read from `ward-third-edition.html`, `ward-answer-third-edition.html`, `wards-third-edition.html`, and `emergency-department-third-edition.html`. The supplied images are desktop references only; the controller retains the complete 390/820/1440 light/dark comparison.

## Implemented presentation

### Ward overview

- Opts into the third-edition surface carrier and gives the ward identity, current entry summary, ward figures, work lists and daily return an explicit panel hierarchy.
- Uses CSS ordering to put identity and current bed information before action and record areas while leaving the existing JSX, state and event handlers mounted once.
- Adds a 48 px reachable link to **Answer this ward's bed requests**, alongside the existing bed-board link.
- Keeps the local `h1` in the accessibility tree while the shared bar supplies the visible route label.

### Ward answer

- Uses the existing `incoming` array and the existing accept, decline, gate warning, override and rejection paths.
- Shows one real pending request at a time, with Previous and Next controls and a derived queue position. When an action removes a request, the visible index clamps to the remaining array.
- Keeps the full request card and its established eligibility/refusal wording and controls. The answer route links back to the ward overview.
- Retains the complete synthetic/prototype disclosure.

### Wards index

- Rebuilds the body into the drawing's **About this list** and **All wards** panels.
- Keeps all health-service groups, empty-service wording, unplaced wards, live unit input seam, exact per-ward route links, and the deliberate no-bed-figures contract.
- Uses a four-column-capable responsive directory grid at desktop and one column on phones. The whole card remains the 48 px link target.

### Emergency department

- Adds a full-width, horizontally scrollable department selector from `allEmergencyDepartments()`. Every card links to its existing dynamic route, names the recorded site/service, derives its open-movement count, and marks the current page.
- Presents the selected department identity next, then groups the existing Expects, Referrals, Recently answered and Psychiatry outbox panels into a desktop two-column work area. Referral entry, patient work and statewide capacity remain full-width subsequent panels.
- Keeps every existing population distinct. No tab or filter was added that could hide or reclassify a patient.

## Necessary deviations from the drawings

- Ward Answer does not add the drawing's invented Recent answers history. It presents the existing pending-request population and existing mutation controls only.
- Ward Answer does not copy the drawing's separate Confirm your beds widget. The real request card retains the engine-backed bed and eligibility wording; the overview remains the existing place for full bed confirmation and lifecycle work.
- The overview retains all richer bed-release, leave, pull, override, record and suburb/team surfaces even where the drawing is shorter.
- ED keeps the engine's Expects, Referrals, Recently answered, Outbox, referral-entry, patient and capacity populations instead of converting them into the drawing's visually tabbed population model. This avoids hiding records or inventing a new filter state.
- ED's selector reports current open movement counts. It does not reproduce the drawing's breach/longest-wait ranking because that specific network ranking is not owned by this individual-ED screen.
- The Wards index retains the current catalogue and its current truth statement. No drawing-specific claim about a different ward catalogue was copied.
- Reference title-control overflow was not reproduced; page controls remain able to wrap or scroll within their own region.

## Source verification

- Read the installed Next.js dynamic-route guide and used its promised `params` contract for the new nested route.
- `npx prettier --write` completed for all seven owned files.
- TypeScript `transpileModule(..., reportDiagnostics: true)` reported `TSX_PARSE_OK` for the three screens and the new route.
- `postcss.parse` reported `CSS_PARSE_OK` for all three CSS modules.
- Static `styles.*` inventory reported `STYLE_CLASS_OK` for Ward, Wards and ED.
- A CSS Modules purity scan found no selector beginning with a bare attribute. During implementation the controller exposed four ED attribute selectors that were not locally scoped; all four were corrected to descend from `.screen` before this report.
- Tests, browser interaction, application screenshots, server work, and Git operations were not run by this writer. They remain controller-owned.

## Output hashes

| Output                          | SHA-256                                                            |
| ------------------------------- | ------------------------------------------------------------------ |
| `ward/ward-screen.tsx`          | `D07AC26AFD61C5590AA108666AC8B86B443BBD4AC4DD46BDEC00421807E11A8D` |
| `ward/ward.module.css`          | `8C21955093EA5DF2B00415B4182BA342ED3694672845CECD380DE6C0A92F86A0` |
| `wards/ward-index.tsx`          | `7FDE8803CECB37622FF47C6337EE613AE81DDFA626D04B98F041BAF2889F4E9D` |
| `wards/ward-index.module.css`   | `B174206B8C13CC91513438C074D8D68EFB2455ECAAFD577341C4BAA0F612523D` |
| `ed/ed-screen.tsx`              | `605BE9D5F5452102564ACCA87F25058734AB74B9100D02B213818E0E8C43F135` |
| `ed/ed.module.css`              | `ED452ED86D04DA8FDB9A2D796AED2762087C47E44D9F7B9E45D8DF80A5481496` |
| `ward/[unitId]/answer/page.tsx` | `7A1F473F14F3417E5B1199240EB02731CD9E26230D4775A46D918D2D729D2D47` |
