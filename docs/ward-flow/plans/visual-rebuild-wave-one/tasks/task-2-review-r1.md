# Task 2 independent Hub source/spec review — revision 1

Date: 2026-09-12  
Reviewer: `statistics_inventory` (independent of the Hub implementation)  
Frozen app baseline: `1ef9ed3975078b789e9b5d70b3f000c64edc3809`  
Reviewed Hub source hash: `D25E52AED160493F2450305F92137E06AB6FC8A2316A57C2AF3B745570E32BBB`

## Verdict

Changes requested. The frozen diff preserves the Hub's derivations, result grouping, keyboard handlers, pins/recents, resolvable statistics arrivals, community stated absence, reconciliation wording and real/invented provenance. The local structure also follows the commissioned two-panel Hub composition, and the stylesheet consistently consumes the canonical third-edition token names with no `--text-*` bridge.

Three source-level issues remain before the Hub can be accepted. Post-change paired visual evidence is still pending and this review makes no visual-acceptance claim.

## Findings

### Important — Result content disappears in print

`hub-screen.tsx:396` renders each directory result as a `.resultMain` button. The global print rule at `src/app/globals.css:4860-4863` hides every `button` with `display: none !important`. The previous Hub stylesheet deliberately restored `.resultMain { display: flex !important; }` in print, but the rewritten print block at `hub.module.css:151-158` no longer does. A printed Hub therefore retains group headings while dropping all result rows. Restore the narrowly scoped `.resultMain` print override; keep the search/filter/action controls hidden.

### Important — The directory input has no visible focus indicator or 48px target

`hub.module.css:23-26` gives the non-interactive `.searchInputWrap` a 3rem height while `.searchInput` explicitly removes its outline and has no minimum height or replacement focus treatment. The wrapper padding is not part of the input's pointer target, so the visible 48px field contains dead vertical area, and keyboard focus has no visible indicator. Give the input itself the 3rem target (accounting for the wrapper border/padding) and add a clear `:focus-visible` or wrapper `:focus-within` treatment that remains visible in forced colours.

### Important — Third-edition ground is scoped but never painted

`hub.module.css:1-8` composes the canonical third-edition tokens onto `.screen` but does not use `--ground` for a background. The mounted route therefore continues to show the legacy `WardGround` paint behind the rebuilt panels instead of the drawing's third-edition ground. Complete the controller-owned compatibility seam: make the legacy ground transparent only for a nested `[data-ward-design="third-edition"]` screen and paint the canonical ground on that screen root, with an appropriate print reset. Keep the legacy path unchanged for every unmarked screen.

## Accepted source decisions

- The visually hidden route `h1` remains a valid accessible heading while the mounted shell supplies the visible page title.
- The two searches have different retained scopes: the shell searches patients/movements and the Hub field searches wards, emergency departments and community teams.
- Pins, recent destinations, ward/ED statistics links and the community no-route statement remain truthful app capabilities grouped inside the closest drawn region.
- The bar-colour guard now resolves the third-edition token layer before the legacy/global layers and retains literal-resolution and pairwise-distinctness checks.
- The provenance foot retains the corrected real/invented/design-decision claims and the current reconciliation limitation.

## Scope and evidence boundary

Reviewed only the working-tree diffs for:

- `src/components/ward-management/hub/hub-screen.tsx`
- `src/components/ward-management/hub/hub.module.css`
- `tests/ward-hub-bar-colours.test.ts`

No application source was changed by this review. No tests, browser work, server work, Git mutations or provider calls were run. The controller still needs post-fix paired captures at 390px, 820px and 1440px plus the specified state, theme, forced-colour and print cells before any visual verdict.
