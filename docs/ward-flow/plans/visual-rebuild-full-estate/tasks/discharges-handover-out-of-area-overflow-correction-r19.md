# Discharges, Handover, and Out of area overflow correction r19

Date: 2026-09-13  
Owner: `/root/hub_inventory`

## Scope

Only the three page-local third-edition stylesheets were edited:

- `src/components/ward-management/discharges/discharges-third-edition.module.css`
- `src/components/ward-management/handover/handover-third-edition.module.css`
- `src/components/ward-management/out-of-area/out-of-area-third-edition.module.css`

No TSX, engine, prose, shared component, test, server, browser, or JSON file changed.

Before-source copies preserving the same relative paths are under
`.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-r19-three-overflow/`.

## Corrections

### Discharges phone table

- Kept the existing table presentation and made its primitive wrapper a width-bounded native
  horizontal scrollport at 40rem and below.
- Added a stable gutter and page-token scrollbar paint, while retaining overflow-dependent native
  behavior.
- Gave the first Unit column a 7.5rem minimum and disabled arbitrary word breaking so full unit
  names wrap only at normal boundaries.
- Reset the scroll boundary for print so the table is not clipped on paper.

### Handover tables

- Bounded only the four data-table sections (Longest waits, Beds pulled, In transit, and Placement
  gone wrong) to 34rem on screen.
- Kept both axes natively scrollable with a stable, visible scrollbar. The horizontal control is
  now reachable after a bounded internal vertical journey rather than only after the full handover
  document.
- Left filter, outside-filter, sign-off, notes, and print panels unbounded.
- Removed the height and overflow bounds in print so every row remains visible.

### Out of area tablet register

- At 40.0625rem through 62.5rem, bounded the existing records section to 38rem with native vertical
  overflow and a stable visible scrollbar.
- The change keeps all 18 current far-from-home records and all five groups in their existing
  order; no population or selection behavior changed.
- Phone remains document-scrolled to avoid a nested near-viewport scroll area.
- Print explicitly removes the tablet bound and continues to expose the existing print table while
  hiding the screen card list.

## Hashes

| File            | Before SHA-256                                                     | After SHA-256                                                      |
| --------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Discharges CSS  | `B3E54BA9E915CF1CA4811E92F026DD98A36416FB9C139F2F779D642FAFB0F22F` | `3BFE587526C76A2CEB859EF5D45A7E6B746684BE4B458781411AD2295FFDC829` |
| Handover CSS    | `6C6B83BA336DFB0DFA0F76EC52053774A581182F67437684D23D9AF526C7D613` | `D2A47FF21A6A23E94D2017F40435B78BCD8989A0C4904202C5B028B4CDC4A542` |
| Out-of-area CSS | `4F6C1F3DFCD75E3B36248268C8AF2276807D4CB57544A55C29E4B61C070709AB` | `3BB25DF2F14FF18C3C9114C0ACF2DB9B34B35AC9CE05E3E6A692A935AFFC6940` |

## Source checks

- Prettier was run once on the three owned stylesheets; all were unchanged.
- The new selectors are anchored by local CSS Module classes; no bare global attribute selector
  was introduced.
- The before/after diffs contain only the overflow, scrollbar, word-wrap, and print-reset rules
  described above.
- Tests, browser checks, and print rendering were not run by instruction. Runtime acceptance
  remains with the controller.
