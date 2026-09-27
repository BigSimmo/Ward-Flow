# F01 Capacity phone overflow visual closure r31

## Review boundary

Read-only review of the six fresh, fully reloaded `capacity-ward-filters-app` r31 captures at 390,
820, and 1440 px in light and dark themes. This review covers the corrected Wards panel, filter
controls, and local table-overflow treatment only. It is not full Capacity design acceptance.

## Finding

The reported P1 clipping defect is closed in the observed cells.

- At 390 px, the Wards panel remains within the content column in both themes. All four filter
  controls have complete visible borders and wrap into the available width. `Needs confirming 2` is
  visibly selected without being clipped.
- The expanded North Metro group and its `Hide North Metro` action are fully contained, confirming
  that the table/group content no longer forces the surrounding panel to its former roughly
  1,592 px intrinsic width.
- The visible table columns stay inside the panel while later columns remain available through the
  table's local horizontal-overflow contract. There is no observed page-level horizontal escape or
  right-edge control loss.
- At 820 and 1440 px, both themes visibly retain the table's horizontal scrollbar. The 820 px cells
  also show the explanatory text, “This table scrolls sideways on narrow screens.” This rules out
  the containment fix having suppressed the existing table-scroll affordance.
- Light and dark cells show the same layout and containment result; no new contrast or border-loss
  regression is apparent in this reviewed region.

No new P1 or P2 issue was found in the reviewed region.

## Evidence limitation

The 390 px captures end partway through the tall table, before its bottom scrollbar and explanatory
caption. They prove phone containment and control reachability, but do not independently show the
phone scrollbar at the table's lower edge. The corresponding affordance is directly visible at 820
and 1440 px. No claim is made here about the rest of the Capacity page, pointer/keyboard mechanics,
print, forced colors, or full design match.

## Evidence hashes

- `capacity-ward-filters-app-390-light-r31.png` — `AC15010AC8CF6A468C24DF5BB185893A3FE997DCAD8A36906FF4D270062C95CB`
- `capacity-ward-filters-app-390-dark-r31.png` — `DB4749118B7CD671807F733F365D7A56A7A25A6D5FC1AEECE1E42ED0526CAB69`
- `capacity-ward-filters-app-820-light-r31.png` — `41D18D20FE1E929E8B1BB421AB71DD094D53AD190A5DAF757506E76722A1E144`
- `capacity-ward-filters-app-820-dark-r31.png` — `93715AFC7E5785A6CFEEEB92F50DE8975A9D91E3E8E13A81E1A4994C5C4ABDF8`
- `capacity-ward-filters-app-1440-light-r31.png` — `D76F630E4DD73C1FEF818242BEB0E5209BEAA59F5370E27E89D65CD890AB4570`
- `capacity-ward-filters-app-1440-dark-r31.png` — `1F288012AD2CE1690897DE40FB3D454AF002E63D5C5520F0DD688F8A2B26EF8F`

No source files, tests, browser state, or verification JSON were changed or run during this review.
