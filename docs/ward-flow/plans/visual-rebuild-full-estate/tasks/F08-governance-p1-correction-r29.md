# F08 Governance P1 correction r29

Date: 2026-09-13

## Scope

- `src/components/ward-management/governance-third-edition.module.css`
- `src/components/ward-management/governance-registers.tsx` (detail notice only)
- `tests/ward-governance.dom.test.tsx` (one populated-detail truth guard)

The shared `override-register.tsx` and the controller-owned `ward-governance-registers.dom.test.tsx` were not changed.

## Correction

- The Governance register boundary now paints override rows with canonical `--surface-2`, `--line-strong`, `--ink`, and `--muted` roles. The selectors are rooted under the local `.registerBody` class, so the shared register's legacy ward presentation remains unchanged. The override reason stays primary text while time, actor, and destination remain secondary text in both themes.
- The detail notice now says only what the record establishes: the referral was made by override, while the prior gate verdict and any failed-gate identity are not retained. It no longer claims that a gate failed.
- A focused DOM case records an override through the live reducer, proves the dispatch was accepted, and checks the populated detail preserves that absence without the former unsupported sentence. The extra harness is mounted only for this case.

All privacy, role ownership, no-review-outcome disclosures, override selection/order, access-record limitations, and reducer behavior are unchanged.

## Evidence

Before snapshots: `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-governance-r29-fix/`

| File                                  | Before SHA-256                                                     | After SHA-256                                                      |
| ------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `governance-third-edition.module.css` | `B02F8CC518DC8FCCEA57C6A9FCD68F265833F6E54118931C1DA8AF82BCE4D6CA` | `F9CBED21E8BCD6A432E22401456E09F1AE67EE53A8B867B948A435D1D627C48F` |
| `governance-registers.tsx`            | `69A08AB170D85DB8CC0FDFEAA7AD2303C6F96425D3ABC23BF0B7C2DAC59D0288` | `C5045480479ED1B8489203E7290A8C9D64AFFF74591616AA0E79D7D9DEBCCB3D` |
| `ward-governance.dom.test.tsx`        | `D090BD991F18EE91E0111E5B863E7855E56F198396EA632B8048F0E7BF03A8C0` | `4F405E73372AD9A0AFED4F42E49397C7985458CC1CF0DAE2F014EF155D3D08C5` |

`prettier --write` completed for all three owned files; its unrelated reflow of the existing `GovernanceWorkbench` signature was restored so the source delta remains narrow. `git diff --check` passed. CSS Modules purity was inspected statically: every `:global(...)` descendant is anchored by local `.registerBody`.

Tests and browser checks were not run by instruction. Fresh served Light/Dark populated-state captures remain the required visual closure for the palette correction.
