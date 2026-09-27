# Task 2 implementation report — Search hub

Date: 2026-09-12  
Source baseline: `1ef9ed3975078b789e9b5d70b3f000c64edc3809`  
Plan SHA-256 after ownership amendments: `9ECE16E99228AF0B4053D7C6ED75CF694354EE9BBCBA9D0EC48A20F55573201E`

## Result

The Hub now opts into the draft third-edition root recipe and uses only `--t-*` typography tokens. Its local panels match the served drawing's structure: `The network` header, full-width directory composer and tab strip, two-thirds/one-third desktop grid, stacked tablet/phone layout, compact `At a glance`, third-edition result rows, figures, table, status treatments, and an attached `Where these figures come from` foot.

The contemporaneous served drawing was inspected at 390px, 820px and 1440px, and the pre-change app at 1440px. These captures guided the source patch; they are not post-change acceptance evidence.

## Changed paths and hashes

- `src/components/ward-management/hub/hub-screen.tsx` — adds the third-edition root marker and drawing structure; folds provenance into the right panel.
- `src/components/ward-management/hub/hub.module.css` — local third-edition Hub presentation; zero `--text-*` references.
- `tests/ward-hub-bar-colours.test.ts` — resolves the bar's new third-edition palette before comparing the three segment paints.
- `docs/ward-flow/plans/visual-rebuild-wave-one/tasks/task-2-inventory-report-r1.md` — corrects the runtime search-scope finding.
- `docs/ward-flow/plans/visual-rebuild-wave-one/tasks/task-2-report-r1.md` — this report.

Pre-report hashes:

- `hub-screen.tsx`: `8530FA7966D62B34E18E6AED90B21F01DD0E6780B54798AA0ADCD350028F861D`
- `hub.module.css`: `AE9FEAE239EDAAECA7742710947809F933DDDB369A106B9200D8F949B3664725`
- `ward-hub-bar-colours.test.ts`: `F0FDCF51D136F0098631C33DAB734DE7DD06F2C0E8F3448C2AFF46EA11B97654`
- `task-2-inventory-report-r1.md`: `16378592B77F9743354450859C3F2178AEDCBBB8D02CB5958BE3D273757BE670`

## App behaviour retained

- All data and ordering still come from the existing Hub derivations. No engine, seed, search predicate, count or clinical rule changed.
- Local directory search, empty results, keyboard selection, Enter arrival, Escape clearing and roving kind tabs are unchanged.
- Pins and recently opened destinations remain browser-only, including the rule that a recent visit is recorded only on the outbound action.
- Ward and ED statistics links remain real arrivals. Community statistics remains a stated absence rather than a fabricated route.
- Ready, not-cleared and out-of-service figures remain separate; stale state, authorisation, forensic status, locked/open disagreement and community placeholder wording remain explicit.
- The reconciliation line and all corrected real/invented/design-decision claims remain in the attached source foot.
- Existing 48px targets, full-row action target, separate pin control, print handling, reduced motion and forced-colour selected state remain represented in the stylesheet.

## Deviations and reasons

- **Two searches remain.** The served drawing has one directory composer. Runtime evidence shows the mounted app also has the universal shell search for patients and movements. It is a different scope and existing capability, so it is retained; the parent owns explicit shell labelling and Hub labels its local search as wards, EDs and community teams.
- **Pins and recents remain.** They are app-only browser memory approved under Q-12 and stay grouped inside the nearest drawn region, `At a glance`.
- **Per-item statistics remains.** The drawing has no detail-pane statistics action, but the approved plan added resolvable ward and ED links. The unresolvable community arm remains a sentence.
- **The source foot has a third `Design decisions` clause.** The drawing has real/invented provenance. The app's extra clause records data corrections and prevents refuted drawing claims from returning.
- **The local page title remains visually hidden.** The mounted bar title is intentionally a styled span, so Hub's local `h1` remains the route's accessible heading without duplicating the visible title.
- **No shared panel primitive was adopted.** Hub's existing panels are local and the brief explicitly assigns shared primitive adoption to the controller.

## Verification handoff

No tests or browser jobs were run because the controller owns all execution. Requested smallest focused test set:

```text
node scripts/run-ward-tests.mjs tests/ward-hub-screen.dom.test.tsx tests/ward-hub-route.test.ts tests/ward-hub-bar-colours.test.ts tests/ward-hub-reconciliation-line.test.ts
```

Controller should also verify on the mounted route:

- `[data-testid="ward-hub-page"]` resolves `--t-0` to `0.75rem`;
- named row, figure, label, table and provenance elements compute to the exact `--t-*` sizes;
- the stylesheet has zero `--text-*` references;
- the two searches have distinct accessible names and preserve their different scopes;
- drawing/app comparisons at 390px, 820px and 1440px, including selection, empty result, a ward detail, an ED without on-site beds, a community detail, pins/recents, keyboard focus, dark, reduced motion, forced colours and print.

Visual verification and human acceptance are pending the controller's post-change served captures. Foundation acceptance is also pending; this implementation consumes the draft recipe and does not release later screen work.

## Independent-review correction batch

After `task-2-review-r1.md` requested three Hub source corrections, `hub.module.css` was updated in place and remains the only corrected application file in this batch:

- `.screen` now paints canonical `--ground` and covers the route height. The controller owns the complementary marker-scoped transparency selector on the ancestor `WardGround`.
- The directory input itself now has a 3rem minimum height, and its wrapper exposes a visible `:focus-within` outline with a forced-colour override.
- Print restores `.resultMain` with `display: flex !important`, resets Hub descendants to `Canvas`/`CanvasText`, and preserves capacity semantics through outlined solid, dashed and double segments after colour removal.

Corrected `hub.module.css` SHA-256 after the final visual-review batch: `AE9FEAE239EDAAECA7742710947809F933DDDB369A106B9200D8F949B3664725`.

No tests, browser work or server work was run for this correction batch; those remain controller-owned acceptance evidence.

## Runtime visual correction batch

The exact 1440px light capture showed the full inherited disclosure permanently consuming nearly the entire right panel and leaving the network metrics only a narrow strip. The Hub now keeps the essential synthetic/real/placeholder caveat and as-at reconciliation line visible, while preserving the complete `What is real`, `What is invented` and `Design decisions` paragraphs inside a native `details` disclosure named `More about these figures`. The attached footer is height-bounded and scrollable when expanded, so opening the detail cannot permanently displace the panel's metrics. Print hides the summary and expands the complete disclosure.

The `At a glance` sections now follow the drawing's principal order: `Beds, network-wide`, `Ready beds by service`, then `Wards that need a check`. `Worth knowing` follows, with the app-only pinned and recent destinations after it when browser memory contains them. The directory results remain grouped by service rather than globally interleaved by urgency because the working engine owns their established ordering; changing that behavior would exceed this presentation correction.

The network header count now occupies its own bottom-right line below the description, matching the drawing without changing its derivation.

The network introduction no longer claims that directory wards are globally worst-first. It now truthfully states that wards are grouped by health service and retain their established directory order within each service. The independently derived `Wards that need a check` list still keeps its existing severity order; no result sorting or derivation changed.

`Beds, network-wide` now follows the drawing's information order: two KPI boxes with their labels above the ready and not-cleared values, followed by the unchanged proportion bar and legend. The same derived total is preserved as readable prose below the bar: `{network.beds}` beds across `{network.wards}` wards, with the remainder occupied or not reported.

The Hub reuses the established `usePrintableDisclosures` before/after-print pattern via `source-print`, so Chromium opens the native disclosure for printing and restores its prior interactive state afterward. The CSS print expansion remains as a static fallback and the full provenance content stays printable.

Final source hashes for this batch:

- `hub-screen.tsx`: `8530FA7966D62B34E18E6AED90B21F01DD0E6780B54798AA0ADCD350028F861D`
- `hub.module.css`: `AE9FEAE239EDAAECA7742710947809F933DDDB369A106B9200D8F949B3664725`

No engine, state, search, derivation or action behavior changed. No tests, browser work or server work was run; the controller retains those acceptance steps.

## Final Hub visual-review correction batch

The `Ready beds by service` table now has semantic `Health service` and `Ready` column headers, row headers for each service, and a derived total footer using the existing `network.ready` result. Values and service order are unchanged.

Each `Wards that need a check` item is now an inset bordered card. Its header keeps the ward name and urgency flag and shows the existing confirmation age only when `confirmedAt` is available; the compact age uses the existing duration formatter and no clock value is invented. The unchanged reason follows, then an underlined `Show this ward` button on its own lower line. The button retains a 3rem target and the same `reveal(entry.id)` handler, so ordering and navigation behavior are unchanged.

The local directory field now has a decorative search glyph. The drawing's `/` badge was deliberately rejected: `/` is already the shortcut owned by the global patient/movement search, while the local directory field has no such shortcut. Showing it locally would advertise false keyboard behavior.

Print now resets `.hubShell` to `height: auto` as well as block flow, preventing the desktop viewport-height rule from constraining printed content. Controller evidence under print emulation plus before/after-print events confirms that result rows remain visible flex content with black text on white, and the disclosure opens for print then restores closed. Actual PDF output remains unverified because `Page.printToPDF` was unavailable.

Formatting: `npx prettier --write src/components/ward-management/hub/hub-screen.tsx src/components/ward-management/hub/hub.module.css` ran once and reported both files unchanged.

Final source hashes:

- `hub-screen.tsx`: `8530FA7966D62B34E18E6AED90B21F01DD0E6780B54798AA0ADCD350028F861D`
- `hub.module.css`: `AE9FEAE239EDAAECA7742710947809F933DDDB369A106B9200D8F949B3664725`

No tests, browser work or server work was run by this worker for the batch. Human visual acceptance remains pending the controller's recapture of the changed table, card and directory-field states.
