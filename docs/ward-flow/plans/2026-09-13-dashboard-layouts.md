# Q003 — page-specific dashboard scrolling

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/plans/README.md`.** Kept for history; do not follow.

Owner approved: operational dashboards fit the available desktop workspace where practical; panels must remain comfortably large (Command lower register must not be squeezed). Longer pages may contain multiple bounded sections. Align neighbouring bottom edges, including stacked summary columns. Keep panel headings and controls visible while only that panel's content scrolls. Phones stack and scroll naturally; only exceptionally long lists, tables and diagrams retain internal scrolling.

This is a Ward Flow layout-only continuation on the existing local task branch. Preserve all data, engine behavior, route/actions, dirty inputs, drawings and print access. No Git publication or protected deletion. No blanket fixed viewport clipping. At short viewports allow page overflow instead of unusably small panels.

## Shared contract and ownership

Root owns shell/shared CSS and Command, Movements, delays and legacy console/undrawn routes. Shared sizing variables, inherited from WardGround: `--ward-workspace-height: clamp(36rem, calc(100dvh - 9rem), 64rem)`, `--ward-section-height: clamp(32rem, calc(100dvh - 10rem), 52rem)`, `--ward-compact-height: clamp(22rem, calc(100dvh - 18rem), 34rem)`, `--ward-sticky-top: 4.5rem`. Use page-specific adjustments where content needs more space. Desktop containment should normally begin at 1001px; phones <=640px release fixed heights except genuine diagrams/long lists. Print releases every bounded body. Do not introduce mandatory panel-body wrappers globally.

Workers use local CSS and minimal JSX for explicit labelled keyboard-scrollable body regions. Do not wrap controls into scroll bodies. Do not change WardPanel/shared imports, behavior, tests, routes, framework or engine. Root schedules verification; workers run no tests/browser. Each records changed paths, page classification (including no-change pages), deviations and remaining risks in its report. Snapshot before editing, in-place edits only.

| Task | Owner/model                  | Owned paths                                                                                                                             | State       |
| ---- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| L1   | spatial worker / Sol high    | capacity, ward, wards, board, ed, community, network local modules                                                                      | Implemented |
| L2   | records worker / Sol high    | statistics, patients, search, hub, referrals local modules                                                                              | Implemented |
| L3   | operations worker / Sol high | legal-forms, handover, discharges, out-of-area, on-call, alerts, officer, settings, governance local modules; sign-in/digest assessment | Implemented |
| L4   | root / Astra                 | shared shell, coordinator, movements, delays, tracker, morning, escalation, legacy console and auxiliary route coverage                 | Integrated  |
| L5   | independent reviewer         | batch diff/source audit                                                                                                                 | Reviewed    |

Reports: `dashboard-layouts/L1.md` through `L5.md`. Root maintains `dashboard-layouts/PROGRESS.md` and REQUEST-QUEUE. No recursive agents; at most three simultaneous implementers. Use existing dependencies and services. One focused domain check plus one typecheck only if JSX changed; no full-suite churn. Visual proof remains distinct from source checks. Previous browser client blockage must not be bypassed; missing final visual evidence remains recorded and affected canonical entries reopen.
