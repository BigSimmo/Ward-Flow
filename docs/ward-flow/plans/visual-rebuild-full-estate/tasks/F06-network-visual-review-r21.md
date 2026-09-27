# F06 Network visual review r21

Date: 2026-09-13  
Reviewer: `gpt-5.6-sol / medium`  
Scope: independent, read-only visual review of Network only

## Evidence reviewed

I viewed all twelve original screenshots at original detail:

- `network-app-390-light-r21.png` and `network-mock-390-light-r21.png`
- `network-app-390-dark-r21.png` and `network-mock-390-dark-r21.png`
- `network-app-820-light-r21.png` and `network-mock-820-light-r21.png`
- `network-app-820-dark-r21.png` and `network-mock-820-dark-r21.png`
- `network-app-1440-light-r21.png` and `network-mock-1440-light-r21.png`
- `network-app-1440-dark-r21.png` and `network-mock-1440-dark-r21.png`

The captures are first-viewport evidence. I did not operate the tabs, scroll the internal diagram, inspect below-fold content, run a browser, or run tests.

## Findings

### P1 — Network loses the emergency-pressure facts on phone

At both 390 px app captures, the Emergency department pressure region contains only the horizontally scrolling service-context entries (`RGH South Metro`, `PEEL South Metro`, `SJGM East Metro`) and the measurement-limit sentence. The waiting count, longest wait, and breach facts are absent. The corresponding drawings show the pressure cards as the primary phone content, including those operational values.

This is an unintended shared-selector collision rather than an engine-data difference. `WardNetworkWorkspace` renders `PressureStrip` inside `pressureFrame` in `src/components/ward-management/ward-management-network.tsx`. `src/components/ward-management/coordinator/coordinator.module.css` applies `display: none` to `.pressureStrip` under `@media (max-width: 48rem)` for the Command screen's phone policy. Because the shared component carries that class on the Network route too, the rule also hides it there. The Network module removes the strip's border but does not restore its display.

Smallest correction: add a Network-route-scoped phone override in `ward-management-network-third-edition.module.css` for the direct pressure-strip child, restoring its intended layout only inside `.pressureFrame`. Do not change Command's phone policy or duplicate/rederive the pressure facts.

### P2 — The two-view tab control starts with a truncated label on phone

At both 390 px app captures, `Placement workspace` is clipped at the right edge and the two-tab control exposes a horizontal scrollbar. The workspace remains reachable, but a two-option primary view switch should present both option names without an exploratory horizontal scroll.

The source cause is the Network module's phone rule: `.viewTabs { overflow-x: auto; }` plus `.viewTab { flex: 0 0 auto; }`. Smallest correction: make the two tabs share the available width at this breakpoint, allowing label wrapping if needed while retaining the existing 48 px minimum target and tab semantics. This is local to `ward-management-network-third-edition.module.css`.

## Observed closure outside those findings

No additional P1/P2 issue was visible at 820 or 1440 in the captured areas. The full-width header surface, pressure band, diagram panel, hub, ED nodes, and compact two-column service cards remain readable in light and dark themes. Full service names and count labels are visible, and I saw no card overlap or content clipping.

The following differences are accepted engine or product adaptations rather than defects in this review: the app has no selected movement in Network overview, so it shows no eligibility routes; the Placement workspace tab retains the working placement workflow; real route/navigation counts and service populations differ from drawing fixtures. The missing connector routes in the no-selection overview follow that state and are not reported as a visual failure.

Human interaction, keyboard traversal, tab switching, internal-scroll reachability, and below-fold visual acceptance remain pending.
