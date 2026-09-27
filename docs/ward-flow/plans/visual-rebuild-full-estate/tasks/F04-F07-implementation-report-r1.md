# F04/F07 referral front-door implementation report r1

Date: 2026-09-13  
Implementer: `/root/hub_inventory`  
Frozen full-estate plan SHA-256: `2194350E1AD66ED47049CF7EAA115DB7789D8BEBAE18AB06C465559B253B4155`

## Scope

Changed only the accepted five-file referral/add-patient workspace:

- `src/components/ward-management/referrals/referral-intake.tsx`
- `src/components/ward-management/referrals/referral-board.tsx`
- `src/components/ward-management/referrals/referrals.module.css`
- `src/components/ward-management/patients/add-patient.tsx`
- `src/components/ward-management/patients/add-patient.module.css`

No engine, provider, shared shell, primitive, test, route wrapper, or `referral-match.tsx` file changed. New rules in the shared referral stylesheet are gated by local `data-referral-view` roots. The match view is laid out only when mounted inside the owned register screen.

## Design evidence inspected

The following served references were viewed at original detail before the design edits:

- `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/raise-a-referral-reference-1440-light.png`
- `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/raise-a-referral-reference-390-light.png`
- `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/referrals-reference-1440-light.png`
- `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/referrals-reference-390-light.png`
- `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/add-a-patient-reference-1440-light.png`
- `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/add-a-patient-reference-390-light.png`

## Implementation

Raise a referral now uses the third-edition surface and typography roles. A referral opened from a known person record gains a truthful `The person` strip built from the existing person record and pointer. The existing numbered form steps remain the main column; destination, progress, recorded values and sending consequences remain in the context column. Phone order stays person, questions, then context. All existing fields, outstanding-state words, free-text warnings, destination choices, summary derivations, validation, and Send behavior are unchanged.

The Referrals register now composes the queue/record and selected decision surface as one responsive workspace. The queued and recently decided records remain together in the left column. Selecting the same existing row mounts the full engine-authoritative match view in the right column; no simplified acceptance path was added. Before selection, a neutral `Referral detail` panel tells the user how to open the existing decision surface. Both columns retain in-flow scrolling on narrow screens and get independent vertical scrolling at desktop widths. The existing queue order, responsive table/cards, selection handler, refusal/cancellation facts, candidate list, unit-specific acceptance, override reasons and decline actions remain intact.

Add a patient now presents `Identity and what is known` as the primary panel, with the four required fields ordered Record number, Date of birth, Given name, Family name and the existing optional Gender field following them. Source context and duplicate checking follow in the left column; board context and next-step explanation occupy the right column. Phone order is linear. Duplicate matching, field state, unavailable-action explanation, Add Patient dispatch, post-create navigation and real board sample remain unchanged.

All three screen roots carry the established third-edition/rebuilt markers. Existing full safety wording is retained as a later full-width panel. Print overrides remove viewport scrolling constraints and reset third-edition surfaces to paper colors.

## Deliberate deviations

- The referral register does not implement the drawing's unit-less `Accept to the pathway` or unwired Redirect action. The real reducer requires a unit for ward acceptance, and the existing match view preserves that candidate selection, eligibility, override and reason contract.
- The register does not preselect a synthetic first referral. Its existing state begins without a selection; a truthful instruction fills the detail column until the user selects a real queued row.
- The intake person strip appears only when the route carries a known patient pointer. Direct intake has no person to name, and the screen does not invent one.
- Intake preserves all current structured questions, multiple destinations and the complete written-history safety wording. The reference's smaller fixed fixture cannot replace those working contracts.
- Add a patient does not add the drawing's required Sex control. `ADD_PATIENT` has no sex payload, and the recorded `Patient.sex` field is free text rather than the drawing's two-choice vocabulary. Existing optional Gender remains separate and defaults to the explicit `Not yet recorded` state.
- The board sample remains alphabetical because current patient data has no created-at fact. It is not relabelled as recently added.

## Before-source evidence

Copies preserving source-relative paths are under `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-F04-F07/`.

| File                     | Before SHA-256                                                     |
| ------------------------ | ------------------------------------------------------------------ |
| `referral-intake.tsx`    | `FADF8B2FC3928CD57C2247EA9211EE71C2A8C3ED641F5FAB9AD897C3801B552B` |
| `referral-board.tsx`     | `51D4D7215071EDC4F18B54E43683D9BC49CA1618323FAAF9273BCE2A8149E0E9` |
| `referrals.module.css`   | `46940004DF0004F1F5942B9B8A12EF6BA0AD950358AE9E555037C822E1034291` |
| `add-patient.tsx`        | `AE88A2D5DD9C6FC226835F84379B2E89B2E0E8CF6875139BC05BADD8502BF6E9` |
| `add-patient.module.css` | `C22EE292FA8A36B42EE83B43879F36C25289D2ECA2DF9ABB84447732CD16ACFE` |

## After-source evidence

| File                     | After SHA-256                                                      |
| ------------------------ | ------------------------------------------------------------------ |
| `referral-intake.tsx`    | `96E6624AAE6CF8555535EF72F964C1EFB730CA8CD94BEB0D04E51C89A621C8BF` |
| `referral-board.tsx`     | `C21AC58D6278E08E617E1F9B02F4F7ECE64BCE29750930B275CB308A2FC65855` |
| `referrals.module.css`   | `C124E408D4747AEEAE301BBDFD040544D2CA1E51075E4C6A3A4E6B400F18225D` |
| `add-patient.tsx`        | `3EDB5A3D22EBA181CA3938622331F7C4C938F242159A70BA981EE86F0E43AA21` |
| `add-patient.module.css` | `B6C5D035784AE54BA32CCAF79EFF8BF8FB9749CA58BA64888A2FC93C00DB8BDC` |

## Source checks

- Prettier wrote the five owned files once; the final intake/person-strip and field-order adjustments were formatted once in their two affected files.
- TypeScript `transpileModule` parsed all three TSX files without error.
- PostCSS parsed both CSS Modules without error.
- Every `styles.*` reference in the three TSX files resolves in its paired CSS Module.
- A PostCSS selector walk found a local class in every selector branch in both CSS Modules; no bare attribute selector was introduced.
- A before/after source diff confirmed the referral handlers, derivations, validation and dispatch blocks were not edited.

Tests, browser runtime, server work, and visual acceptance were not run by this implementer under the controller-owned verification boundary. The six served references above are design input only.
