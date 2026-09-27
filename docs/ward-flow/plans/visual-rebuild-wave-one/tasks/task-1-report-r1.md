# Foundation implementation record (in progress)

Controller Astra owns bar/rail/layout and shell tests. Sol medium `statistics_inventory` owns the explicitly delegated primitive/frame seam; Hub Sol owns Hub only. Plan/app input hashes are in the issued briefs. Source was clean before implementation.

## Served baseline and three-way inventory

The controller viewed the actual app and HTTP Command/Hub drawings. App identity matched `clinical-kb:d0a358b585df`; task checkout server came from `npm run ensure`. Precise screenshot evidence uses CDP viewport metrics and an explicit screenshot clip; the first high-level capture was cropped by the app viewport, so it is not accepted as matrix evidence. Corrected Hub captures exist at 390, 820 and 1440px in the task scratch folder.

- Shared: wordmark, remembered rail and appearance, global search except page-owned composers, service selector, activity/tasks/tools, primary actions, navigation, reconciliation.
- Drawing-only: route title on non-place pages, grouped rail, shift dial/schedule, pinned movement list/flyout, signed-in identity, service stripe, compact desktop controls and hover cards.
- App-only: additional navigation destinations; actual local Service selection without filtering; unavailable Activity tally; live role switcher/demo controls in Tools; broader truthful synthetic disclaimer and current reconciliation refusal.

## Design adaptations and reasons

- Restore route titles from the existing navigation registry, retaining actual resolved place names. Use a styled span in the shell because the screen retains its accessible h1.
- Preserve 48px control hit targets, exceeding the drawing's compact desktop painted control height; this retains the working accessibility contract.
- Group all existing routes, retaining core views in their required landmark. Additional app routes require more scrolling than the drawing's shorter list; none is dropped.
- Retain selection ring rather than drawing's rail edge bar under the explicit owner ruling. Service state is local to the bar and unwired; do not invent a global service stripe/filter. Correct the false Escape announcement.
- The engine holds no shift schedule or authenticated signed-in identity. Keep a quiet Shift container stating the absence; no fabricated clock/dial/progress. Do not label a route role as a signed-in person.
- There is no shared movement-pin store to supply the drawn pinned list. State that limitation in its region; existing Hub place pinning remains inside Hub. No fake rows or new engine state.
- Native link titles retain destinations/count descriptions in the closed rail. A custom drawn hover card is still pending; it must not be reported as matched.
- Search keyboard guidance stays accessible and becomes visible on focus to allow the compact bar arrangement. Search behaviour is unchanged.

Checks: unrun; implementation and independent visual review pending. Human acceptance pending. No source/visual completion is claimed by this record.

## Rendered pilot correction

Desktop comparison found the rail (~235px), bar (~58px), content inset (~25px), gap (~15px) and Hub split close to the served drawing. At 390px the preserved 23-link registry wrapped to a ~740px navigation area, pushing the Hub below the first viewport. Independent Sol review confirmed the defect at 820px too. The controller assigned only the rail pair to Sol for a bounded responsive More pages Sheet using the existing overlay, while retaining desktop geometry, the registry and active routes.

The bar retains the single real WardGlobalSearch input and shortcuts. Below 1000px an empty unfocused input uses a 48px magnifier target; focus or a query expands the same field in flow. Utility labels become visually hidden at that breakpoint with accessible names retained. This is a responsive presentation change, independent of role.

The reviewer proposed restoring New referral on the Hub. That proposal is rejected: the current primary-action registry intentionally supplies none on this route (D-16). Existing referral navigation remains reachable; no new primary action is inferred from the drawing.

Runtime appearance check: Tools opens, Dark applies data-theme=dark, Close returns focus to Tools. Hub root --t-0 computes to .75rem. These are partial checks, not matrix acceptance. The first post-change screenshot exposed a long disclosure crushing right-side metrics; the Hub owner is correcting that presentation without dropping disclosure content.

## Reproduced reload fixes

Fresh reload left root data-theme absent while Tools showed Dark pressed. WardBar now reflects its saved client appearance in a layout effect without rewriting storage. This restores the remembered paint after hydration; no pre-hydration filmstrip evidence is claimed. A separate runtime getServerSnapshot cache warning was traced to the unchanged-at-HEAD WardLiveRegion fresh server object. It now returns a stable silent module constant. Two regression cases were added for these paths; execution remains admission-blocked. The installed Next server/client component guide was read before changing lifecycle behavior.

## Next executable pilot gate

Run only when repository admission is available:

```text
node .superpowers/sdd/2026-09-12-visual-rebuild-wave-one/run-focused.mjs tests/ward-shell-third-edition.dom.test.tsx tests/ward-shell-print-ancestor.test.ts tests/ward-hub-screen.dom.test.tsx tests/ward-hub-route.test.ts tests/ward-hub-bar-colours.test.ts tests/ward-hub-reconciliation-line.test.ts
```

Latest attempt in pilot-tests-r3.log was blocked before the runner started by a live other-worktree accessibility test lease. Earlier completed shell-only run handed in3 files and ran3, collecting51 tests:50passed/1locatorfailure; that locator is corrected but final-source test verification remains unrun. Do not treat the surrounding PowerShell exitcode as a passing runner verdict. No fullsuite or typecheck has run for this pilot. Independent shell and Hub six-cell visual reports are now received, with named engine adaptations retained and human acceptance pending.
