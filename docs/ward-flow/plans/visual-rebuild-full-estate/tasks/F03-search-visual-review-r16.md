# F03 Patient search independent visual review — r16

Reviewer: `gpt-5.6-sol / medium`. The reviewer did not author the captured Patient search source.

## Evidence and limits

All twelve supplied PNGs were opened with `view_image` at original detail: app and served drawing at 1440px, 820px, and 390px in explicit Light and Dark themes.

| Cell       | App SHA-256                                                        | Drawing SHA-256                                                    |
| ---------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| 1440 Light | `93BC9594772FE64A41B8C000CFB5DF050761878B81CF5AF3209FC1DFAB381CB4` | `4E5EF990109E2637E743626F15D89B2FA005AF6E50522D4F667F3070F24E20F3` |
| 1440 Dark  | `77872F8957AE0B5701203D5D9C623C277424E5268DE2D6AFB55DDCCBF1836D10` | `CE1741492CE2F75F4F5FEF208452F0B080DCE34E9089227DB732D98EE5C79DB7` |
| 820 Light  | `C4F1F9C943A97993C6547C5605CC221A21E63A43AB661F1B67045E892F5DEA16` | `356295CA9FACC2ED4BAF1F47B3F47C8C50D19885E973866F57254C8A1D0E5E0C` |
| 820 Dark   | `E570A55C412BDBA0515BA52B45D71A5F80D827B8C90F9101DA4DDCA7FF20A553` | `9878DC893075A3F820436894C05BFCC09F547CE53B2E4865456CC39F0DF76DAA` |
| 390 Light  | `53B0ECA5C645B85D22D5A893BB80BEE038C868A13DF3429F0A52EEF8E3C278A6` | `A50587E2F2596ACEC4D1D18C67276591F4E0B962A5B03A0A52C1847A199307A1` |
| 390 Dark   | `CBD15AA982192820257030BB3C92AA3DAAECE307EAC129E0AC39C17A9DD0DC50` | `E90A66659D1A0DB7F2645F096A18D71D10F2AC2A195D96B5CBAFA4EB906B41A1` |

These are initial-viewport screenshots. They establish visible hierarchy, spacing, and theme contrast, but do not prove keyboard/focus behavior, interaction states, the complete lower page, internal-scroll reachability, print, forced colors, or physical-device behavior. No cell is marked visually accepted.

The app's larger real engine populations, the unselected preview, and their resulting labels/counts were treated as authoritative. They are not design defects.

## Findings

### P1 — Light theme makes core page content effectively unreadable

This reproduces in every Light app cell and does not appear in the Light drawing cells. At 1440px the referral identifiers are effectively white on white, referral descriptions are extremely faint, and the empty Selected person copy is barely visible. At 820px and 390px the Search labels, input text/placeholder, select values, stage explanation, refusal copy, referral identifiers, and result descriptions are similarly pale. The same content is legible in every Dark app cell, which rules out missing content and shows a theme-specific presentation failure.

The page-local source explains the shape. `search.module.css` opts the root into the canonical third-edition `--ink`/`--muted` palette at lines 53–60, while many nested rules still consume legacy `--text`, `--text-heading`, and `--text-muted` roles: fields at lines 164–180, empty text at 183–188, people rows at 274–283, and referral rows at 327–335. Unlike other converted screens, this third-edition root does not rebind those legacy roles to `--ink` and `--muted`. Add the bounded aliases on the opted-in Patient search root so its existing descendants and composed controls resolve against the selected canonical theme. Verify the selected-preview module through the same inherited aliases; do not paint individual rows with one-off colors.

This blocks visual acceptance and practical use in Light mode.

### P2 — Results follow Search at 820px and 390px, reversing the drawing's workflow

Both 820px drawing cells and both 390px drawing cells put the Results instrument first, followed by Search/refinement. The app puts the full Search card first at both widths. On the phone this consumes the entire remaining initial viewport, so no result row is visible; the drawing exposes several results immediately. Desktop broadly reaches the intended two-column row arrangement, with Results and Selected person above Search and Access record.

This is explicitly created by the page CSS: the third-edition `.searchPanel` has order 1 and `.resultsConsole` has order 2 at lines 864–865 and 948–949, before the desktop grid pins them at lines 1012–1052. Correct the sub-desktop order to Results then Search. Because the TSX currently places the Search section before the result console (lines 337–473), the correction should also make DOM and visual reading order agree instead of relying on contradictory flex order. Preserve the engine's people, waiting-referral, and open-movement populations and keep the honest unselected preview.

### P2 — The 390px app retains an obsolete fixed-phone-header reserve

In both phone themes, the app leaves a conspicuous blank band between the normal-flow shell chrome and the Search card; the drawing begins its Results card close under the chrome. The source has an older `@media (max-width: 40rem)` rule at lines 348–356 that adds `padding-top: var(--spacing-ward-phone-bar)` to `.screen`, with a comment describing a fixed phone bar. The current shell in the supplied capture is already in normal flow, so the extra reserve is visible dead space. Reset that legacy padding only for the opted-in third-edition Patient search root at the same breakpoint. The 820px and desktop cells should retain their current outer inset.

## Deliberate differences and non-findings

- The app shows 43 open movements and 6 waiting referrals while the drawing fixture shows different totals. The engine population is authoritative.
- The app opens with an honest empty Selected person panel while the drawing fixture shows a selected record. Selection state is authoritative.
- The drawing carries a New referral action, but the current route contract deliberately declares Patient search as `{ kind: "none" }` in `ward-nav.ts` lines 622–626 because its primary workflow lives in the page. Its absence from the app bar is therefore not reported as a defect.
- Extra shell routes behind More pages and the reconciliation status are preserved working-product differences.
- No horizontal clipping or unreadable compression was visible in the twelve initial viewports. The screenshots do not prove lower content or horizontal internal-scroll behavior.

## Smallest correction boundary

The three findings can be corrected within `src/components/ward-management/search/patient-search.tsx` and `src/components/ward-management/search/search.module.css`: bind the legacy text roles on the opted-in root, put Results before Search in both DOM and sub-desktop presentation, and remove only the stale third-edition phone reserve. No engine, route registry, selected-record behavior, shared shell, or global token change is indicated by this evidence.

Closure needs a fresh paired six-cell capture after source freeze, plus focused keyboard/focus and lower-page reachability evidence from the controller. Human visual acceptance remains pending.
