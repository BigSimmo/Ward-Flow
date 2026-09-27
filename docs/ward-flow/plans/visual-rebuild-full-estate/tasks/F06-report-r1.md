# F06 Network and Governance report — r1

Date: 2026-09-13  
Worker: `gpt-5.6-sol / medium`  
Plan SHA: `2194350e1ad66ed47049cf7eaa115db7789d8bebae18ab06c465559b253b4155`

## Scope and sources

Implemented the Network and Governance presentation increment in route-specific component and CSS
boundaries. No shell, shared token, primitive, provider, engine or test file was edited.

Authoritative served references inspected before editing:

- `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/network-reference-1440-light.png`
- `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/network-reference-390-light.png`
- `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/governance-reference-1440-light.png`
- `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/governance-reference-390-light.png`

Contracts read:

- `docs/ward-flow/build-contracts-2026-09-12/contract-network.md`
- `docs/ward-flow/build-contracts-2026-09-12/contract-governance.md`

## Before-source evidence

The exact three existing source files were copied before the first source edit to
`.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-F06/`. The same directory contains
`manifest.json`; it records both new CSS modules as absent before this increment.

| Source                                                       | Before SHA-256                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------------ |
| `src/components/ward-management/ward-management-network.tsx` | `A5ED12BB697FCC26D2A078E67D79282F346E4A90206D17A5B62C3BA6041B4228` |
| `src/components/ward-management/ward-management-modes.tsx`   | `36B05D31C898E05D50D8349D0D8C7077B985A7C03E411A54996ABA1A23E56FE0` |
| `src/components/ward-management/governance-registers.tsx`    | `0687C350305B8F752CDD3806C796885CA7D2EF9A5A19E7194488BF93A23D059C` |

## Implemented structure

### Network

- Added a default **Network overview** tab with the drawing's two regions in order:
  **Emergency department pressure** and **Statewide flow**.
- Reused the established live `PressureStrip` and `FlowDiagram` components. The overview reads the
  provider's current movements, units, bed releases, leave beds and clock; it introduces no new
  clinical derivation.
- The flow diagram deliberately receives no movement. It therefore shows the whole network without
  candidate eligibility or destination emphasis, matching the overview's scope.
- Retained the complete existing patient/referral placement workspace as a second **Placement
  workspace** tab. It remains mounted while hidden, preserving its local patient, referral, stage,
  shortlist and unit selection state across tab changes.
- Added local responsive panel, tab and print rules only in the new Network module. The existing
  placement module remains unchanged.

### Governance

- Added the drawing-shaped two-column workbench: a tabbed register on the left, with **Override
  detail** and **Decision and record** stacked on the right. It collapses to one column at the
  documented `62.5rem` adaptation.
- The Overrides tab uses the existing network-wide `allOverrides` derivation and read-only
  `OverrideRegister`. The Access record tab preserves the existing session-only, no-identity
  disclosure.
- Override detail displays only recorded facts: movement, affected units, fixed reason, role and
  recorded time. It explicitly says the failing gate identity is absent.
- Decision and record explicitly says review decision, reviewer and reviewer reason are absent from
  the model. No fabricated review rows or action were added.
- Retained the existing not-a-medical-device statement, six assurance cards, synthetic decision
  audit, four public grounding links, exhaustive change audit, effectiveness calculations and
  suppression/dropped-measure disclosures beneath the new workbench. Existing test ids and links
  remain in the mounted tree.

## Deliberate differences from the drawings

- Network has two tabs. The drawing removes the working placement queue and shortlist, but the
  current application has real patient/referral selection, movement links, eligibility gates and
  coordinator explanations there. Controller direction required preserving that behaviour, so the
  drawing is the default overview and the established workspace remains one tab away.
- Selecting an ED card in the Network overview only selects that card; it does not filter the
  network-wide pressure list or the flow diagram. This preserves D-35's network-wide scope.
- Governance cannot truthfully reproduce “unreviewed” filtering, oldest-first review order, gate
  identity, reviewed decisions, reviewer identity, reviewer reasons, or a network-wide access log.
  Each absence is visible in the corresponding drawing-shaped region.
- The Governance drawing's **Record a review** action is not added. The current action registry and
  data model provide no destination or review command for it.
- Governance remains longer than the drawing because the established assurance, audit,
  effectiveness and source evidence is retained rather than discarded.

## Output hashes

| File                                                                              | SHA-256                                                            |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/components/ward-management/ward-management-network.tsx`                      | `18424929EF4F718F3186988E06748522652AE78DAF60EECD692AE3756FE7ECA0` |
| `src/components/ward-management/ward-management-network-third-edition.module.css` | `0C758D917199BD8255B3F79AB5C32B8910A23EF756F89353BBF6707B6847E7B9` |
| `src/components/ward-management/ward-management-modes.tsx`                        | `E82AC638921B640F4BC3272C039037F634D8B7FB1B028C23C04EC4B53F068B92` |
| `src/components/ward-management/governance-registers.tsx`                         | `69A08AB170D85DB8CC0FDFEAA7AD2303C6F96425D3ABC23BF0B7C2DAC59D0288` |
| `src/components/ward-management/governance-third-edition.module.css`              | `B02F8CC518DC8FCCEA57C6A9FCD68F265833F6E54118931C1DA8AF82BCE4D6CA` |

## Source checks and pending evidence

- `git diff --check` over the three tracked source files: passed.
- TypeScript `transpileModule` syntax parse over all three changed TSX files: passed.
- PostCSS syntax parse over both new CSS modules: passed.
- No test, typecheck, browser, server, print emulation or provider command was run, by controller
  ownership. Runtime layout, the permanently-undefined `FlowDiagram` path, dark theme, forced
  colours and visual comparison remain pending controller evidence. Both new tab sets implement
  roving focus plus Left/Right/Home/End selection in source; runtime keyboard evidence is pending.
