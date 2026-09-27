# F08 Governance deadline disclosure correction r31

Date: 2026-09-13

## Scope and correction

- `src/components/ward-management/ward-management-modes.tsx`: changed only the Governance dropped-measure paragraph.
- `tests/ward-governance.dom.test.tsx`: changed only the existing dropped-measure assertions.

The Governance screen now states that the proposed legal-deadline effectiveness measure is not published there, while legal deadlines remain recorded and monitored as operational alerts. It no longer claims every deadline was removed or that the underlying data cannot be computed. No metric, denominator, target, engine behavior, deadline record, or alert behavior was added or changed.

The existing DOM assertion now proves the fixture contains at least one recorded `legalForm.dueAt`, requires the disclosure to say the metric is not published and the records remain monitored, and rejects the two former false claims. This protects the distinction between absence of a published effectiveness metric and absence of deadline data without pinning the current fixture count.

## Evidence

Before snapshots: `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-governance-deadline-r31/`

| File                                                       | Before SHA-256                                                     | After SHA-256                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `src/components/ward-management/ward-management-modes.tsx` | `075235E4BA4F71CDC4267F4928C68F738897269BA7D4EF9BFE05B48FF829F827` | `466EC610B2E6776C0BE64F66A269555CDCF5BC67E621208C42538FF8080BEE5A` |
| `tests/ward-governance.dom.test.tsx`                       | `4F405E73372AD9A0AFED4F42E49397C7985458CC1CF0DAE2F014EF155D3D08C5` | `0AD037CE279555A74BF4451A24D3619443828249C68F32C9E48E2DBCA2214001` |

Prettier completed on both owned files and the before/current comparison contains only the intended paragraph and assertion changes. `git diff --check` passed. Tests and browser checks were not run by instruction; the controller will batch this DOM case with the Patient Search preview regression.
