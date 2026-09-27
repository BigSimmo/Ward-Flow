# F08 Discharges, Handover and Out of area report — revision 1

## Scope and evidence boundary

- Approved plan SHA-256: `2194350e1ad66ed47049cf7eaa115db7789d8bebae18ab06c465559b253b4155`.
- Before-source snapshot and input hashes: `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-F08/manifest.json`.
- Served drawing references inspected:
  - `discharges-reference-{1440,390}-light.png`
  - `handover-reference-{1440,390}-light.png`
  - `out-of-area-reference-{1440,390}-light.png`
    under `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/`.
- Ownership was restricted to three mounted screen files and three new page-scoped CSS modules. Existing legacy CSS, engine, shared shell, primitives, tests and canonical documentation were not edited.
- The new CSS modules were written before their mounted imports. Each composes the canonical third-edition shell tokens locally and is activated only on a `data-ward-design="third-edition"` screen root.

## Discharges

- Preserved the four fixed engine groups and their existing flag-before-stage classification: Blocked, Confirmed, Expected and Discharged today.
- Each group is now a drawing-shaped stacked panel with its purpose and live row count in the panel header. Blocked retains its existing conditional emphasis only while it contains work.
- Added the drawing's `Outside the four groups` heading and explanatory paragraph around the two existing exclusion populations. Neither count was merged or relabelled.
- Applied the drawing's deliberate empty-state punctuation: `None. No ...`.
- Preserved every column, the Blocker-only-in-Blocked rule, band ordering, freshness text, existing phone card alternative, governance sentence and subtitle.
- The shared shell continues to own header actions and service chrome; no duplicate page control was added.

## Handover

- The visible screen title now matches the drawing's `Handover`; the in-page h1 remains accessible while the shared bar owns the visible title.
- Rebuilt the page hierarchy as the drawing's desktop composition:
  - left `Handover sheet`: native scope control, included/excluded/rule statements, Longest waits, Beds pulled, In transit, Placement gone wrong and Outside this filter;
  - right: `Shift and sign off`, followed by `Print`.
- The Handover sheet header carries the current included-of-total count from the existing values.
- Preserved the current native select and every optgroup, live-clock behavior, scope filtering, urgent-outside rule, movement columns, in-transit destination, both print buttons, sign-off not-wired announcement, incoming-note absence, role-not-person wording and Capacity link.
- At 62.5rem the two columns become one; print returns to document flow and preserves the existing print-hiding contract.

## Out of area

- The register heading now matches the drawing: `People in a bed on these records`.
- The main content uses the drawing's two-column hierarchy: register on the left; group summary, At a glance, threshold meaning and source/provenance on the right. It collapses to one column at 62.5rem while retaining the existing phone table-to-card behavior at 40rem.
- Preserved selection behavior, current far-from-home entries, both headline facts, exact threshold/travel notices, unranked-list explanation, placement facts, catchment absence, clinical caveat and source disclosure.
- Added all five drawing group headings without creating a second admissions classifier:
  - `In a bed far from home` uses `entries.length`, which the existing ledger directly returns.
  - `In a bed under three hours from home` and `No arrival recorded` explicitly state that this ledger does not return those populations.
  - `No home area recorded` and `No travel time held for this ward and that home area` explicitly state that the existing `notBanded` count does not separate them.
  - The unchanged combined `notBanded` sentence remains visible and quantified.
- No suburb, catchment-team result, pinning state, home-area write, referral action or priority judgment was invented.

## Retention and static evidence

Comparison with the before snapshot found no missing pre-existing `data-testid` values in any screen. Handover retains one Link, three button elements and nine select elements; the other two screens retain their prior element counts. No route or handler was removed.

Source parsing completed without tests: `PARSE_OK tsx=3 css=3` using TypeScript `transpileModule` and PostCSS parsing.

No tests, browser interaction, app server or Git operations were run. Inspecting served reference images established the target only; it is not visual proof that the application matches. Controller-owned app/reference comparison remains pending.

## Explicit drawing deviations

- Discharges retains phone cards instead of the drawing's horizontally scrolling phone table because the working app's corridor-use contract requires cards below 40rem.
- Handover does not invent the drawing's day/evening shift schedule, handover clock, named shift roles or percent-through-shift meter. The existing sign-off panel states only the live moment, scope, counts and coordinator role that the engine actually has. It also retains the real destination column instead of adding an always-empty Transport job column.
- Out of area cannot honestly show four of the five drawing counts from the current `outOfAreaLedger` return. Their panels state the exact unavailable population or separation. Catchment lookup remains unavailable because Admission records a broad home region and no suburb.
- Page-specific governance sentences remain visible even though the drawing folds the generic prototype warning into shared chrome.

## Output fingerprints

| File                                               | Input                                                              | Output                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `discharges/discharge-board.tsx`                   | `8607d80be5e1733818e7c06173b9c23b56d933dc640042831a16ee533f06111a` | `7fae286df15ea12410e0f6c0128aea859e65d9314f0f10eead76aabeed06b6ef` |
| `discharges/discharges-third-edition.module.css`   | absent                                                             | `eb426f879326fa15430cc24bbe4c85392e64a662acc8291d555543d349f7ea86` |
| `handover/handover-page.tsx`                       | `d3db7d1258528e4f61f9208523c23def6277745943c40e8a26bc048f35925dfc` | `f96c8bd61fedee90f682df83b22d71ef546bd5115caf5f14fce86f6131bbbf51` |
| `handover/handover-third-edition.module.css`       | absent                                                             | `712b18a0785a1f413fbc73e5cb43ccc31b8a92206e72ce1523b29f56d550ebea` |
| `out-of-area/out-of-area-board.tsx`                | `d0245e138a16615972c71a4fd4e64563d27a58f011c24bc1d4b0d8126571c680` | `ac09b5365e4f086e2d960444e3eed154f7e211c7a7fabf6556606d5ad7e439a1` |
| `out-of-area/out-of-area-third-edition.module.css` | absent                                                             | `e3d0019acb934b069bddf504573ebf88f71e387ed45355620297fc59427a6890` |

## Controller verification requested

Run the affected Discharges, Handover and Out-of-area DOM tests plus the plan-selected journeys. Visual review should cover 390, 820 and 1440 pixels in light and dark, below-fold sections, empty populations, Handover scope changes, Out-of-area selection, table/card swaps, print and forced colors. Confirm the app identity from the controller-owned server before recording evidence.
