# Task 2 inventory — Search hub

Date: 2026-09-12  
Source baseline: `1ef9ed3975078b789e9b5d70b3f000c64edc3809`  
Scope: source inventory only. No served comparison, computed-style proof, tests or application edits were performed.

## Three-way inventory

### Shared by drawing and app

- One page-owned search for wards, emergency departments and community teams, with clear, query and kind filtering (`All`, `Wards`, `EDs`, `Community`). The app additionally has the correct roving-tab keyboard contract.
- A dominant network directory beside a narrower `At a glance` subject pane, stacking at narrower widths.
- Grouped ward, ED and community results; a selected row; a network overview when nothing is selected; ward-first operational ordering and derived counts.
- Network bed figures kept separate as ready, empty/not cleared and out of service; a labelled proportion meter; ready beds by service; wards needing attention; stated absences.
- Ward, ED and community detail states with cohort/service/site context, ward bed and authorisation facts, ED on-site ward facts, community provenance, and an action to open the relevant app destination.
- Provenance/honesty content distinguishing real network facts from invented prototype figures and names.
- Responsive single-column fallback, scrollable directory/detail regions, 48px interactive targets, visible focus, and print/forced-colour provisions.

### Drawing-only presentation or structure

- Third-edition panel construction: `surface` panel, `surface-2` header/foot strips, 1px line plus stronger bottom edge and the single shared lift, 10px/9px outer/inner radii. The current app panels are flat `ward-canvas` boxes without the third-edition header strips or lift.
- A panel header named `The network`, its explanatory note, and a derived count. The app starts directly with the search bar; `Search results` is only an accessible section label.
- Search as a full-width composer strip (`.hubComposer`) beneath that header, then a full-width tab strip and optional filter strip. The app puts search and tabs together inside `.searchBar`.
- The directory's exact visual grammar: sticky `surface-2` group bands, uppercase tracked kind/service labels, mono figures at the 13.5px step, selected accent wash/ring treatment, and status words instead of a coloured edge.
- The `At a glance` title and count/pin in a panel header strip, compact `sec` sections, third-edition tally tiles, register rows, bed chips, facts and table wrapper.
- `Where these figures come from` as the subject panel's attached `surface-2` footer. The app instead places three separate `What is real`, `What is invented`, and `Design decisions` columns in a detached `.aboutPanel` after both panes.
- Measured overflow fades at the top/bottom of the directory and subject scroll regions.
- Third-edition type throughout: Geist; Geist Mono for figures, identifiers, times and counts; `--t-0` through `--t-6`; 12px floor; tracked uppercase labels; page title at 26px. The app stylesheet still contains the old `--text-*` scale throughout.
- Drawing-specific refused-search row and shell-integrated service/task filter presentation. The drawing has one place-search composer; the mounted app also retains its universal patient/movement search in the shell bar. These distinct scopes are a runtime-confirmed departure, not a duplicate implementation of the same search. They need explicit accessible names.

### App-only behaviour/content to retain

- `hub-derivations.ts` remains the only owner of directory entries, search, grouping, totals, ready-by-service, attention and network-bed arithmetic. Do not port the drawing's embedded data engine.
- `hub-browser-memory.ts`: pinned places, recently opened destinations, pin/unpin controls, and the rule that a visit is recorded only on the outbound link, not while keyboard selection previews rows.
- `hub-provenance.ts`: the reconciliation sentence, including the truthful statement that there is no event feed on this screen.
- Search keyboard behaviour: Escape clears the query, Enter opens the sole result, ArrowUp/ArrowDown changes the selected preview, and kind tabs implement Arrow/Home/End roving focus.
- Truthful empty search copy and kind-specific zero states; the plain result container and real section/list semantics; `aria-current` on selection and `aria-pressed` on pins.
- Full-row result buttons with a separate pin button. Keep the existing no-dead-edge target and forced-colour selected border; restyle its appearance without collapsing the two controls.
- Current data corrections in the detail and provenance copy: ready and empty/not-cleared remain separate; locked/open and Mental Health Act authorisation remain separate; community names carry `(placeholder)` at every occurrence; Broome is a forensic ward rather than one forensic bed; source disagreements remain exposed.
- Ward and ED `View statistics` links beside the primary destination action. These are a recorded plan addition, absent from the drawing. Community retains a stated absence because its region id cannot truthfully resolve to a clinic statistics route.
- The app's detached browser-memory sections (`Pinned`, `Recently opened`) are also not drawn. Owner Q-12 says to keep app-only sections grouped into the nearest drawn panel; fold them inside the `At a glance` body rather than drop them.
- The local freshness line, prototype governance wording and corrected app provenance claims. Their final location should avoid duplicating the mounted bar's prototype mark, but their information must survive.

## Concrete design changes

1. Compose the Task 1 third-edition screen-root token recipe onto `.screen`; do not begin token renames until `--t-0` resolves on the real Hub route. Remove every `--text-*` reference from `hub.module.css` in the completed rebuild.
2. Stop `.screen` from recreating shell columns/min-height if the mounted layout already owns them, and reshape `.main` to the drawing's body inset/rhythm: 14px top, 24px sides, 14px panel gap. Keep its overflow compatible with the established sticky/scroll behaviour.
3. Rework `.hubShell` to the drawing's `.hubGrid` geometry and panel heights. Keep a roughly 2:1 directory/detail relationship on wide screens, stack at the foundation breakpoint, and preserve `min-width: 0`/`min-height: 0` on every scroll path.
4. Give `.hubLeft` and `.hubRight` the third-edition panel material and attached header/foot strips. Add visible `The network` header/note/count markup above `.searchBar`; make `.detailHead` the `At a glance` header rather than a padded free-standing body block.
5. Restyle `.searchBar`, `.searchInputWrap`, `.searchInput`, `.clearButton`, `.searchHint`, `.kindTabs`, `.kindTab`, `.kindTabActive` and `.tabCount` as the drawing's composer and tab strips while retaining current React handlers and accessibility semantics.
6. Restyle `.groupHead`, `.subGroupHead`, `.resultRow`, `.resultRowActive`, `.resultMain`, `.resultText`, `.resultName`, `.resultSub`, `.resultStat`, `.resultStatStale`, `.pinButton` and `.pinButtonOn` to the third-edition directory hierarchy. Do not add coloured status bars; selection must remain visible in forced colours.
7. Restyle the overview/detail vocabulary: `.detailBody`, `.detailSection`, `.capacityGrid`, `.capacityCell`, `.capacityNum`, `.capacityNumMuted`, `.capacityLbl`, `.capacityBar`, `.barLegend`, `.overviewTable`, `.queue`, `.decisionRow`, `.firstFlag`, `.notesList`, `.infoPill`, `.flagPill`, `.detailCta`, `.ctaButton`, `.statsLink`, and `.statsAbsent`. Figures/counts use Geist Mono; absence sentences use the body face and italic only where the standard assigns absence/quietness.
8. Fold `.aboutPanel` content into an attached source foot on `.hubRight`, headed exactly `Where these figures come from`, while preserving all corrected app claims. Keep the app-only third `Design decisions` content within that foot or the nearest subject section; do not restore the drawing's four refuted claims.
9. Fold `.memoryList`, `.memoryRow`, `.memoryName` and `.memoryStat` into the overview part of `At a glance`. Retain their browser-only wording and actions.
10. Preserve print, reduced-motion and forced-colour rules after the selector changes. A served comparison must decide whether the drawing's overflow fades are needed and prove them with actual overflow; do not infer them from source alone.

## Foundation dependencies and acceptance hooks

- Task 1 owns the composable third-edition root token class in `src/app/ward-flow-shell-tokens.module.css` and its opt-in marker. Task 2 consumes that exact recipe at `.screen`; it must not copy token declarations into `hub.module.css`.
- Task 1 owns mounted shell geometry and the bar/rail. Runtime inspection corrected the source-only assumption that Hub suppresses universal search: the bar search remains for patients/movements, while `.searchInput` searches this screen's ward/ED/community directory. Retain both, with scope-specific accessible names.
- Foundation-owned primitive selectors named by the plan are `ward-panel.module.css`'s `.panel`, `.panelHeader`, `.panelTitle`, `.panelCount`, `.panelBlurb`, plus any shared figure and table-wrapper opt-in selectors Task 1 publishes. Hub currently renders hand-rolled local panels (`.hubLeft`, `.hubRight`), figures (`.capacityNum*`) and table (`.overviewTable`); it does **not** currently render those shared primitives. Do not claim their nested acceptance from Hub unless implementation deliberately adopts them. Do not add a demonstration-only primitive.
- The Hub acceptance hook is exact: on `[data-testid="ward-hub-page"]`, `--t-0` must compute to `0.75rem`; named elements must compute to their design steps (at minimum `.pageTitle` `--t-6`, panel titles/result names `--t-3`, body text `--t-3`, row figures `.resultStat*` `--t-2`, meta/source notes `--t-1`, labels/counts/chips/tabs/legends `--t-0`); `hub.module.css` must contain zero `--text-*` references.
- Nested computed-style checks should cover one real result row, a panel heading/count, capacity figure/label, table header/body cell, provenance heading/body, a zero/absence, and the selected/forced-colour state actually rendered on Hub. Any shared primitive not rendered here waits for its first real consumer, per the plan.

## Behaviour retention checklist for implementation

- Same `HubScreen` route output and navigation destinations.
- Same derivation imports and no arithmetic in JSX/CSS.
- Same search, selection, roving tabs and keyboard arrivals.
- Same pin/recent memory and recording boundary.
- Same truthful zero, absence, stale and source-disagreement wording.
- Same ward/ED statistics links and community statistics absence.
- Same provenance corrections and reconciliation line.
- Same distinct universal and directory searches, 48px targets, focus, responsive, print and forced-colour behaviour.

The served drawing and served app captures remain required before implementation. This inventory is not visual proof and makes no pixel-match claim.
