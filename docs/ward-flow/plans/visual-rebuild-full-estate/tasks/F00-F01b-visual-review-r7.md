# F00/F01b visual review r7

Scope: source-independent inspection of the supplied screenshots at original detail. This is visual evidence only; no browser navigation, DOM inference, source edits, or test execution.

## Looked pairs and visible findings

> ⚠️ The twelve screenshots named below were NOT kept. They were written to the worktree root
> during the review and never committed, so every link to them was dead. The names are left as
> plain text rather than deleted: what was looked at, at which width and theme, is the part of
> this record that still means something, and removing the names would lose that too.

- **390 light:** `capacity-app-390-light-r7.png` and `capacity-mock-390-light-r7.png`. The open rail/search/control row and mismatch panel are visible. App and mock have different rail/header heights and deliberate data/content differences (app: 303 beds/engine figures; mock: compact reference figures and extra breach affordance). No clipping, target-size, or contrast defect is visible in the shown region. Bed-map content below its header is not evidenced.
- **390 dark:** `capacity-app-390-dark-r7.png` and `capacity-mock-390-dark-r7.png`. Same bounded region and conclusion. Dark surfaces, borders, status colors, and primary action remain distinguishable. The app mismatch copy/figures differ from the mock by design. Bed-map rows and lower chrome are below the captured region.
- **820 light:** `capacity-app-820-light-r7.png` and `capacity-mock-820-light-r7.png`. Header/nav, search/filters, full mismatch panel, and only the start of Bed map are visible. The app's longer labels wrap in available columns without visible overlap. The mock's three-row nav and 249-bed/16-ward reference dataset are deliberate drawing content, not engine parity evidence. No concrete spacing, focus, contrast, or overflow defect is visible. Lower bed-map groups/network continuation are unverified.
- **820 dark:** `capacity-app-820-dark-r7.png` and `capacity-mock-820-dark-r7.png`. The app legend wraps Occupied onto a second line at this width; it remains readable and is a normal responsive wrap (P3 observation, no correction indicated). Mock and app retain distinct nav/data contracts. No clipping or contrast failure is visible. Only the first Bed-map group is shown; lower groups and any lower-page footer are unverified.
- **1440 light:** `capacity-app-1440-light-r7.png` and `capacity-mock-1440-light-r7.png`. Header controls, open rail, mismatch panel, Bed map, several ward groups, and Network side panel are visible. App engine figures/23-ward longer-label content and mock reference figures/layout are intentionally different. App labels fit; mock rail uses intentional truncation/ellipsis for long navigation names. No concrete visual defect is visible in the shown area. Further Bed-map groups and lower Network content are below the viewport.
- **1440 dark:** `capacity-app-1440-dark-r7.png` and `capacity-mock-1440-dark-r7.png`. Same regions as light pair. Dark tokens preserve panel separation, status semantics, and text readability; app legend and ward swatches remain distinguishable. Mock rail truncation and reference figures are deliberate. No concrete visual defect is visible. Lower-page Bed-map groups, Network continuation, and print state are not evidenced.

## Deliberate differences

The app captures use the live local engine's 23 wards/303 beds and longer clinical labels; the mock captures use the drawing's compact reference dataset (249 beds/16 wards and its stated services). App and mock rails, nav labels, shift/reconciliation copy, mismatch wording, and filter counts therefore cannot be treated as pixel-parity defects.

## Missing evidence

These captures do not prove the lower Bed-map groups after the visible fold, full Network panel continuation at any viewport, phone scrolling, closed-rail states, interaction/focus states, or print output. No severity P1/P2 visual defect was found in the regions shown; the sole P3 observation is the readable legend wrap in the 820px app pair.
