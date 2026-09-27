# F06 + F08 visual corrections — r9

## Scope and source retention

This increment implements the bounded corrections from `F06-F08-visual-review-r9.md`. The active
shared mode stylesheet is `ward-management-modes.module.css`; there is no active
`ward-management.module.css` for this host. No engine, provider, shared shell, shared pressure
component, test, or other mode file was changed.

Before-source bytes are retained at:

`D:/Worktrees/Database/ward-lead/.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-F06-F08-visual-r9/`

The directory contains all eight inputs plus `SHA256SUMS.txt`.

## Implemented corrections

### Network and Governance host

`WardModeWorkspace` now opts its two registered routes into a route-local third-edition host class.
That class removes the nested `100dvh`/overflow shell, duplicate phone top reserve, and visible
duplicate identity chrome. The accessible inner heading remains in the DOM. The existing role
selector and live role-focus sentence remain reachable as compact in-flow controls, and the
Network placement workspace remains mounted while its overview tab is selected.

The correction composes the canonical Ward shell tokens and is applied only by
`WardModeWorkspace`; no legacy mode consumer or shared shell rule was changed.

### Network pressure context

The existing pressure strip is unchanged. Network wraps it in a local bounded panel and derives a
visible service label from each pressure entry's existing `siteCode` through the canonical site
registry. A local caption states that elapsed waits have no common deadline scale because the
records do not hold one denominator applicable to every department. No denominator, target, or
clinical threshold was invented.

### Out of area

The existing far-from-home entries now sit in the first of five separately headed groups. The
remaining four groups use the already established missingness distinctions: near-home and
no-arrival populations are unavailable, while missing home area and missing travel time remain
inseparable within the existing `notBanded` total. No second classifier or derived count was added.

The right column is now headed `At a glance`; the selectable record detail is headed
`Selected placement`. Existing table rows, phone cards, selection behavior, counts, threshold and
synthetic notices, and provenance remain reachable.

### Handover

The third-edition handover table now uses the existing `--ward-table-min-width` seam at `48rem`,
prevents mid-word breaks in its first four categorical columns, and scrolls within the sheet panel.
Print removes the floor and internal overflow so the existing print contract can lay the table out.

### Discharges

At phone width, the third-edition route keeps each existing WardTable visible inside its horizontal
scroll wrapper and hides the duplicate card rendering. Every table row and existing action remains
in the same source component; the legacy presentation remains unchanged outside the opted-in route.

## Changed source and hashes

```text
BEFORE                                                            AFTER
E82AC638921B640F4BC3272C039037F634D8B7FB1B028C23C04EC4B53F068B92  075235E4BA4F71CDC4267F4928C68F738897269BA7D4EF9BFE05B48FF829F827  src/components/ward-management/ward-management-modes.tsx
5B80BCE5A581389C743CE3A09A3FF961A3B23A867177878C903096976B19EAB0  CB4687ED2EC89BC3B177E0B813B70F544806AD1707CDD40E4CDE7D2417A8D388  src/components/ward-management/ward-management-modes.module.css
18424929EF4F718F3186988E06748522652AE78DAF60EECD692AE3756FE7ECA0  5FE6522640BCE295ADA766D9B928EAFBE315CC574CCC5BCDDA48EE36376B6B2F  src/components/ward-management/ward-management-network.tsx
0C758D917199BD8255B3F79AB5C32B8910A23EF756F89353BBF6707B6847E7B9  501B7F10021A90B629A360ACF9B9E29C9E80CB6263C0B13AB7815D0C5A906B2A  src/components/ward-management/ward-management-network-third-edition.module.css
B4A0F6F24B826A32515B92856D2F953FFE609E338AB412D3E6EA0D039C69A667  69DD812987D1D7C20106D135702F9CC3E2BA175793F391F3D65C9C13A4626FBC  src/components/ward-management/out-of-area/out-of-area-board.tsx
E3D0019ACB934B069BDDF504573EBF88F71E387ED45355620297FC59427A6890  72D12C1A3A2C533478E8BE4C5853C8812C934888F90A020749694F0B0CA447A3  src/components/ward-management/out-of-area/out-of-area-third-edition.module.css
712B18A0785A1F413FBC73E5CB43CCC31B8A92206E72CE1523B29F56D550EBEA  174BD2E75CA28D8F773BDE8779A5F9731EAD75CE294B0DAD66F52B1A3E2F6D0C  src/components/ward-management/handover/handover-third-edition.module.css
EB426F879326FA15430CC24BBE4C85392E64A662ACC8291D555543D349F7EA86  57070F9318C7A47D4A8E5C6B4E693662FA37C7133D52E71A93F4C719E298B9BC  src/components/ward-management/discharges/discharges-third-edition.module.css
```

## Static evidence

- `npx prettier --check <the eight owned source files>` — passed after formatting the two changed
  TSX files.
- `git diff --check -- <the eight owned source files>` — passed.
- `npx eslint ward-management-modes.tsx ward-management-network.tsx out-of-area-board.tsx` — zero
  errors. It reported two existing warnings where the unchanged selectable OOA row/card pattern uses
  `aria-selected` with `role="button"`.
- CSS-module reference inspection found every `thirdEdition`/`pageStyles` class used by the changed
  TSX declared in its imported module.

No tests, application server, or browser were run under the controller-owned verification boundary.

## Remaining deviations and evidence limits

- The Network service context is a synchronized footer below the unchanged shared pressure strip,
  rather than text inside each shared card. This preserves the accepted Command component and stays
  within the Network-local ownership boundary.
- The app retains a compact role control and role-focus sentence that are absent from the drawing;
  they are existing functional controls and facts.
- Four Out-of-area groups cannot show rows or independent counts because the current ledger does not
  expose those populations. Their panels state the exact absence instead.
- Visual acceptance, phone scrolling, tab interaction, dark mode, forced colours, and print remain
  pending controller evidence.
