# F06 + F08 independent visual review — r9

## Evidence and limits

Reviewer: `gpt-5.6-sol / medium`.

I viewed all 20 supplied PNGs at original resolution: app and authoritative served mockup for Network, Governance, Discharges, Handover and Out of area, each at 1440 and 390 light. The exact image hashes are recorded below. Source delivery was treated as unaccepted until compared here.

This is a first-viewport review only. It does not prove lower-page content, interactions, scrolling, dark mode, forced colours or print. Counts and richer/absent records were not treated as defects where the live engine dictates them.

## Ranked findings

### P1 — Network and Governance are still mounted inside the legacy nested viewport shell

Both app pages carry a second full page frame beneath the shared rail/bar: an inner identity header, role control, role-focus strip and its own viewport sizing. On desktop this consumes roughly 150px before either drawing-owned workbench begins. On phone it is materially worse: after the shared chrome ends, the captures show a large blank band and only then a second page title/role control; Network's first actual panel does not begin in the initial viewport, while the mockup starts its pressure panel immediately after the shared bar.

The source explains the geometry. `ward-management-modes.module.css:1-25` makes `.modeShell` a two-column, `height: 100dvh`, `overflow: hidden` shell; `:935` reserves the phone bar again. `ward-management-modes.tsx:588-590` always mounts `ModeHeader` and `RoleFocus` inside the already-mounted third-edition shell. This is not a data difference and creates nested scroll/height ownership.

Smallest correction claim:

- `src/components/ward-management/ward-management-modes.tsx`
- `src/components/ward-management/ward-management-modes.module.css`

Add a mode-specific third-edition root marker/class for the only two `WARD_WORKSPACE_MODES`, reset that branch to normal-flow `height:auto; min-height:0; overflow:visible; display:block` and remove the duplicate phone reserve. Keep the working role selector reachable as a compact in-flow control, while visually suppressing the duplicated identity/meta title already owned by the shared bar. Collapse the role-focus sentence into the content gap rather than retaining a second banner-height header. This is a route-scoped correction; do not change other screen shells.

### P1 — Out of area does not implement the drawing's five left-column groups

The app renders one flat “People in a bed on these records” table/card list containing only far-from-home entries. The five categories exist only as a dense definition list in the right column. The mockup's defining structure is five separately headed left-column groups followed by the selectable records, with the right column reserved for “At a glance” and provenance. On phone the mismatch is immediate: the app begins a homogeneous South West card list, whereas the mockup begins the “In a bed far from home” group and makes the other group boundaries part of the same reading order.

This is acknowledged in source rather than forced by the engine: `out-of-area-board.tsx:171-233` renders one register; `:269-300` reduces all five headings to the side summary, including truthful “Not available” / “Not separated” results. Those absence sentences are correct, but they are in the wrong panel type and location.

Smallest correction claim:

- `src/components/ward-management/out-of-area/out-of-area-board.tsx`
- `src/components/ward-management/out-of-area/out-of-area-third-edition.module.css`
- `src/components/ward-management/out-of-area/out-of-area.module.css` only if the existing table/card selectors need group-local spacing

Keep the existing ledger and selected-entry derivation unchanged. Make the far group own the existing rows, then render four sibling group panels in drawing order whose bodies use the already-authored unavailable/not-separated explanations. Rename/reframe the right summary as “At a glance”; do not derive missing counts or add a second classifier.

### P2 — Handover's desktop table collapses words despite ample panel width

At 1440 the app's left panel is wide, yet Stage and Wait break into fragments such as `Plac-em-ent` and `waitin-g`; department and destination cells wrap far more than the mockup. This makes the main shift record slower to scan and creates much taller rows. The phone panel order is coherent, but the same table will be reached below the captured fold.

`handover.module.css:253-261` explicitly composes the shared table while declaring no per-screen minimum width. The shared table therefore distributes a six-column handover record from min-content constraints, allowing the long destination column to squeeze short categorical columns.

Smallest correction claim:

- `src/components/ward-management/handover/handover.module.css`

Set the handover table's existing `--ward-table-min-width` seam to a measured floor near the drawing's usable width (start at `48rem` and verify), and prevent breaking inside the short Rank/Movement/Wait/Stage values. Retain the existing horizontal scroll wrapper instead of widening the page.

### P2 — Network pressure cards omit the drawing's known service label and visual deadline scale

The app pressure strip supplies site code, waiting count, longest wait and breach text, but its cards read as widely spaced text columns. The mockup makes each department a bounded card, names its health service, and uses a short scale beneath the longest wait. The missing service is not an engine limitation: the ED has a `siteCode`, and the existing site registry owns its service. The screenshot's borders are also much quieter than the drawing, reducing the sense that this is an independently scrollable card strip.

Smallest correction claim, with a shared-component hazard:

- `src/components/ward-management/coordinator/pressure-strip.tsx`
- `src/components/ward-management/coordinator/coordinator.module.css`
- Network-local source/CSS only if a `presentation="network"` variant is chosen

Prefer a narrowly named Network presentation prop so the accepted Command rendering is not silently restyled. Add the known service label from the canonical site lookup. Add a scale only if its denominator can be read from an existing legal-clock derivation; otherwise retain longest/breach text and record the scale as unavailable. Strengthen the card boundary through existing `--line`/`--line-strong` tokens.

### P2 — Discharges changes the authoritative phone table into a different card panel type

Desktop is structurally close: four stacked group panels plus “Outside the four groups”, in the correct order. At 390 the app hides each table and substitutes large cards (`discharges.module.css:234-244`), while the mockup retains the compact table inside an obvious horizontal scroller. The card adaptation preserves facts and is readable, so this is lower priority than the missing structures above, but it is a real panel-type divergence and shows substantially fewer rows in the first viewport.

Smallest correction claim:

- `src/components/ward-management/discharges/discharges.module.css`

For the third-edition marker only, retain the table at phone widths and hide the duplicate card list, using the existing `30rem` table floor and WardTable scroll affordance. Leave legacy/default consumers unchanged. If product ownership prefers cards as the accessibility adaptation, record this exact divergence rather than calling the phone cell a design match.

## Pages without another independent blocker

Governance's zero override/review state is truthful engine absence, so the missing populated review rows and absent “Record a review” action are not defects. Its six retained assurance cards are extra app evidence below the workbench; after the nested-shell correction they should remain below the drawing-owned register/detail panels and must not displace those panels.

Discharges' differing group counts and Handover's differing movement totals/timestamps are engine data differences. The Handover disclaimer and Print control remain visible and the left-sheet/right-signoff order is correct. Out of area's unavailable counts and absence explanations are honest; the defect is their structural placement, not their wording.

## Evidence map

```text
network-app-1440-light-r9.png       8AA77AC8AEAA7DB8244820693E919DC1305D616233B5095CCF5D5F4C3AA0744F
network-mock-1440-light-r9.png      197BCA34352D99F575A09074FFCB9E75E3EC5145F68494431B864CCAF6302DAC
network-app-390-light-r9.png        A2C9F57720C086E0A6BCF9A92E2F0BBF87FFA897EDFC68EA75B6ABBE5649EEF1
network-mock-390-light-r9.png       3955D07C4F8AB71649F2D49926DDB1D516BC250877799F8452C385CA2B795512
governance-app-1440-light-r9.png    5BEDCB8012BF1E2E565C91522C69E68FD0F3C640526028411E447B427B0DEDA1
governance-mock-1440-light-r9.png   B699CF8B708741139E0C23A7E07595E362BC659ADAD91F3D6210A052B5601F89
governance-app-390-light-r9.png     A0F0FF7F8FF9732DC19AFEC3D034766AC7968D77C98E1778E84EA1E96ED67B1C
governance-mock-390-light-r9.png    69EC608E25CA891C8F9E3AB9C31826CCC1916FDB45F185C2F5B807AC69F0D55F
discharges-app-1440-light-r9.png     CFDA1A1BCBE21F7720E417326F6430366489A11F48D62B1A1C56AE54C92FA866
discharges-mock-1440-light-r9.png    E1C42ACA6530C5488699E8931A30B5D9BE56B667476CDA406F3123EC5BEA42CE
discharges-app-390-light-r9.png      19925F08FE5B023E00D6F892E0C48E9A0017C9A1B15A9CC3BA8CF109DDE6C92D
discharges-mock-390-light-r9.png     8CAEBF65A33188EBE1118C4A522DB239891CD720E567916D1F758321BE9636F6
handover-app-1440-light-r9.png       6AF0A693B6DF28AE7FD56ADBE56682237AEDD7BA631333394B6F5981F91219D6
handover-mock-1440-light-r9.png      25867E4D3B6476FD2379328DAA4C17506FBA4629B44414E2C264A6583CD1012F
handover-app-390-light-r9.png        91B281C860DAFD58D2B64A7438340BC752784FF103A84B4E9BF196AD3A13A411
handover-mock-390-light-r9.png       48A8B766EEF4D7C5CD92D4BCCF2B9DD519111AE15825F28FF2B3A722ED0A8483
out-of-area-app-1440-light-r9.png    9F47DC41BFE7D655F3B2EB7FC6F24E3E64BD520E38BE0E9FBE3C26A0797C520B
out-of-area-mock-1440-light-r9.png   1EBCD7530ACBB70480B4577EDBC0EC770D271E14BF88AC86E261E579C610C1DF
out-of-area-app-390-light-r9.png     B7FF0BBCD39A46A4C767320B94BDBB8417095613147804BF10A9628C2AB36CBB
out-of-area-mock-390-light-r9.png    952F63496A170E21CE5939BBE0C6515F8D0D12B4C83276BFE61919B5D5BE9FD2
```

Human visual acceptance remains pending after corrections.
