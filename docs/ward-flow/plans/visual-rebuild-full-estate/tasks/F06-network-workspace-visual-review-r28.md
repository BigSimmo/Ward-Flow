# F06 Network workspace visual review r28

Reviewed all six supplied captures directly: `network-workspace-app-{390,820,1440}-{light,dark}-r28.png`. The selected SCGH / WF-001 / 11-gate workspace is deliberate and was treated as valid mounted behavior; this review does not promote it to functional or DOD acceptance.

Findings:

- **P1 — 1440px right-side workspace is clipped by the viewport.** In both `network-workspace-app-1440-light-r28.png` and `...dark-r28.png`, the Explainable shortlist panel begins near the right edge and its candidate table continues beyond the screenshot: the rightmost candidate column and the right side of the eligibility/gate content are cut off. The page’s queue, constellation, and shortlist columns together exceed the viewport width; no visible page-level affordance makes the missing shortlist content reachable. Smallest remedy is to constrain the three-column workspace to the available content width and give the shortlist its own bounded horizontal scroller, or use a responsive two-column collapse before this width.
- **P2 — Operational constellation is a large empty dark block at 1440px.** In both 1440 captures, the mounted `Operational constellation` panel occupies most of the center column as an uninformative near-black rectangle, with only its title and controls visible. The selected queue and shortlist are populated, but the central workspace contributes no visible diagram or fallback explanation. If this is an intentionally unavailable diagram, render the existing “schematic/not geographic” state with a compact empty-state explanation; if it is expected to paint, this is a material missing visual region. No judgment was made about data that was not shown.

At 820px both themes show the shortlist table, 11 eligibility gates, current owner, and workspace button without visible clipping in the inspected region. At 390px both themes show the table and gate list readable within the viewport; narrow wrapping in candidate headings is present but no text was cut off. Light/dark controls and status chips remained distinguishable. Lower workspace content, keyboard traversal, callbacks, print output, and non-selected/default views were not assessed here.

## r29 correction closure

Reviewed all eight supplied correction captures directly at original detail:

- `network-workspace-app-{390,820,1440}-{light,dark}-r29.png`
- `network-constellation-app-1440-{light,dark}-r29.png`

The three r28 findings are visually closed in the supplied regions:

- **P1 right-side clipping — closed.** Both 1440 workspace captures contain the complete three-column workspace. The shortlist's right border, all three candidate columns, eligibility gates, current-owner card, and action area remain inside the viewport. The controller's DOM measurement (`x = 1032.8`, `width = 368`, `right = 1400.8` in a 1440 px viewport) agrees with the bitmap. The 390 and 820 captures also keep the shortlist and comparison table within the page; the responsive stack is visible at 820.
- **P2 empty/displaced constellation — closed.** Both dedicated 1440 constellation captures show populated service groups, readable unit nodes, orthogonal connectors, and the selected SCGH node near the top of the panel. The former empty initial viewport caused by the stretched grid row is absent.
- **P2 inherited-role readability — closed.** Light and dark captures now show coherent panel surfaces, borders, headings, body copy, status chips, selected rows/cards, and actions. No material light- or dark-theme contrast failure is visible in these regions.

No new P1 or P2 visual defect was found. This is a bounded screenshot closure, not full screen acceptance: the images do not prove keyboard or focus behavior, callbacks, print output, scroll ends, or every node and route below the captured constellation viewport. No reference captures were supplied in this correction batch, so the verdict closes the recorded r28 app defects rather than asserting exact drawing parity.
