# F02 Ward visual correction — r7

## Scope and inputs

- Exclusive implementation scope: `ward/ward-screen.tsx` and `ward/ward.module.css`.
- Before-source snapshot: `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-F02-visual-r7/manifest.json`.
- Before hashes: TSX `D07AC26AFD61C5590AA108666AC8B86B443BBD4AC4DD46BDEC00421807E11A8D`; CSS `8C21955093EA5DF2B00415B4182BA342ED3694672845CECD380DE6C0A92F86A0`.
- Viewed served references: app desktop r7 `0DF3AF63CAB4C322D4CC22886A76BB68B91C01FC51884EE32E9C7CF04DF83749`; mock desktop r7 `D62692A9949FB4A27E24C6D85D172B7F04BBE23036F324A022A5CF3278FBA855`; mock phone `0625EBD1723A69CAC39568A09F51E0E3D8A0B6D268ECDCABC92CF5B2C374945E`.

## Implemented structure

- Rebuilt the ward identity as one full-width panel with a flush panel header, freshness, existing site/cohort/designation facts, compact bed facts, daily-return status, and the existing board and answer routes.
- Reduced the ready-bed entry hero to a compact action band. Its always-available bed-list link and explanatory contract remain intact.
- Reshaped Ward figures into a distribution bar plus the existing authoritative Ready/Held/Blocked/Occupied and discharge/leave values. The existing explanatory prose remains visible.
- Moved the complete capacity, bed-release, preparation and leave workflows intact into a closed `Update ward figures and bed records` disclosure. The controls remain mounted; handlers, local draft state, test ids, target ids and reducer dispatches were not changed.
- Added Worth your attention from already-recorded facts only: pending bed preparation, held-up releases and capacity-refresh requests. The empty state explicitly says which records are absent.
- Kept the overview DOM and visual order aligned: identity, compact action, figures, attention, awaiting answer, daily return, Coming in, Going out, then the existing reference/audit panels. Attention and awaiting answer form the desktop pair; Coming in and Going out form the next pair. Both collapse to one column at the established 62.5rem Ward breakpoint.
- Added Going out as a read-only summary of the existing `capacityBreakdown` discharge and leave bands. Lifecycle actions continue to live in the update disclosure.
- Preserved Ward Answer as a separate presentation. Existing direct-child visibility selectors still expose only its answer navigation, request panel and governance statement.
- Preserved the phone drawing's inset cards and wrapping controls; no edge-to-edge override was added.

## Behaviour and data retention

- No engine, provider, reducer, model, role gate, refusal path, or FD-23 scoping logic changed.
- Incoming, accepted, withdrawn, override, handover and suburb-team content remains in the source and mounted in the overview.
- Daily-return and board routes remain available in the identity panel. The full daily-return panel remains mounted below the primary operational pair.
- No bed, staffing, contact or clock value was invented. New visible summaries use `unit`, `unitCapacity`, `capacityBreakdown`, `bedsPendingPreparation`, the ward-scoped refresh request, and the existing session confirmation set.

## Deviations and limitations

- The drawing carries richer named-bed attention records. The current Ward overview has no equivalent bed-row identity binding in this component, so attention shows the available recorded aggregate facts rather than fabricated bed numbers or narratives.
- The drawing's identity block includes additional designation/specialling/acuity prose. This pass retains the component's existing `designationSummary` and recorded capacity facts; it does not infer missing details.
- The operational update disclosure is an engine-preserving adaptation: the drawing does not show the full set of live forms, but removing them would remove working Ward behavior.

## Output and verification

- Output TSX SHA-256: `22FA36DBD3316F84D9618776D79CB1EFF8902AD551762BD77A9B5056183DF154`.
- Output CSS SHA-256: `341ED7AA1BBD69D6AE2B5A849EA7CE8C71759BE644E9FE2D6CF9EE030DAAA4A4`.
- `git diff --check -- src/components/ward-management/ward/ward-screen.tsx src/components/ward-management/ward/ward.module.css` produced no errors.
- Prettier was used once during iteration, then the TSX was restored byte-for-byte from the before snapshot before the bounded structural patch was reapplied; no formatter-wide source churn remains beyond the deliberate DOM move.
- Tests, typecheck, server and browser verification were not run, as assigned to the controller. Current visual acceptance remains pending a served app capture of these output hashes.
