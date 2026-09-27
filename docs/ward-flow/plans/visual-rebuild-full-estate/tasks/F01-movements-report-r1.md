# F01a Movements implementation report r1

Date: 2026-09-13  
Writer: `/root/hub_inventory`  
Frozen full-estate plan SHA-256: `2194350E1AD66ED47049CF7EAA115DB7789D8BEBAE18AB06C465559B253B4155`

## Ownership and inputs

This pass changed only the Movements screen and its exclusive stylesheet:

- `src/components/ward-management/movements/movements-screen.tsx`
- `src/components/ward-management/movements/movements.module.css`

`movement-drawer.tsx` imports that stylesheet, so its existing class contract and portal-safe print rules were retained. No shared chrome, primitive, drawer component, engine, derivation, test, server, or browser file was changed.

The exact pre-edit files are copied under `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-F01a/src/components/ward-management/movements/`:

- `movements-screen.tsx`: `B657A48C6D800DEE3FAA22BC3DED9468AB6CD50AD6890AF6BA9B182DF87AC8CB`
- `movements.module.css`: `9B2598A3BCBAE011A1824217F35F08A1F1E31AE508566E8CC0424FE71CB206`

Served design references inspected at actual detail:

- `movement-reference-1440-light.png`: `C5AA605614040B8B19352F0F21652A26CE5E508F21A86D36EF231229D8ECAA8B`
- `movement-reference-390-light.png`: `A7ECCB25C0FA02BEACB95DEFB1E9DE9F88D9754DB07421C5B27EF95949E9253C`

## Result

The screen now uses the third-edition screen marker and canonical surface roles. Its reading order follows the served drawing:

1. A full-width **The day** panel presents six figures derived from the current movement and transport state.
2. **Worth your attention** exposes up to three real open tier-1 movements and opens the existing record drawer; it adds no new state or action.
3. A full-width **Today’s traffic** panel presents current carried corridors as a responsive origin-to-destination diagram, with the same corridors ranked in an attached rail.
4. The existing movement register and the transport/stage summaries form the lower two-column area and stack below 1100 px.
5. The existing reconciliation remains full width. The complete synthetic-data warning remains available in its native disclosure immediately below it.

The day figures are `openMovements.length`, `closedToday.length`, current open tier-1 count, `legs.length`, the existing `withoutBookedTransport`, and `corridors.length`. No new clinical, capacity, breach, or transport derivation was introduced.

The CSS provides six-to-three-to-two metric wrapping, a below-diagram corridor rail at narrower widths, a single-column work area, 48 px interactive floors, focus-visible rings, phone-safe wrapping without reproducing the drawing's own clipped copy, dark-token inheritance, and an expanded-content print reset.

## Behaviour and content retained

- The Every movement / Resolved today tabs and their complete populations remain unchanged.
- The three existing order choices remain a radiogroup and still select the same stage, transport, and wait renderings.
- Closed movements remain visibly marked rather than filtered out.
- Patient workspace links, record-drawer actions, transport rows, transport distribution, stage totals, empty-state wording, and reconciliation remain in place.
- The movement drawer still uses every existing stylesheet class and retains its portal print reset.
- The local `h1` remains in the accessibility tree while the shared bar supplies the visible route label.
- Corridor labels now say “from” and “to” rather than relying on an arrow alone.

## Deliberate deviations from the drawing

- The drawing's breached/severe figures were not copied because the working movement model does not provide those exact owned derivations. The band names the truthful available figures instead.
- The drawing's refused and unused corridor populations remain absent. A refusal has no journey stage, and the established unused rule does not match the working engine. The visible corridor note explains the refused omission.
- The drawing's five shape tabs were not created. The engine-backed Every/Resolved tabs and three order controls remain authoritative and preserve closed records and their facts.
- The diagram expresses the carried origin/destination pairs without asserting a geographic topology the engine does not own.

## Source checks

- `npx prettier --write src/components/ward-management/movements/movements-screen.tsx src/components/ward-management/movements/movements.module.css` completed for both owned files.
- Static class inventory confirmed every `styles.*` use in `movements-screen.tsx` and `movement-drawer.tsx` has a stylesheet definition.
- Static token scan found no remaining new references to undefined `--warn-ink` or `--pill` roles.
- Tests, browser inspection, screenshots, and server work were not run; those remain controller-owned.

## Output hashes

- `movements-screen.tsx`: `9892C903EEB89C45A8485906DD3ADC75C23FF070867815BC8E9F1228C7FF353B`
- `movements.module.css`: `8CC3BD2F562B167E85CCF9026F1B4586B05D86BC37B793C6DE2B25E81963FCBD`
