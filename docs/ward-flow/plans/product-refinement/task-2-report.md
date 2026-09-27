# Q004 Task 2 — Movements refinement

Status: implemented; controller browser review, behavioural gates and independent review pending. Source inspection is not visual acceptance.

## Scope and preserved inputs

Branch `codex/task-ward-flow-live-state-20260831`, inherited HEAD `1ef9ed3975078b789e9b5d70b3f000c64edc3809`. This is the existing shared, dirty local Ward line; no Git mutation occurred.

Changed:

- `src/components/ward-management/movements/movements-screen.tsx`
- `src/components/ward-management/movements/movements.module.css`

All five assigned source inputs were copied with their relative paths into `.superpowers/sdd/2026-09-13-product-refinement/task-2-before/` before editing; source and snapshot SHA-256 matched for each. `movements-derivations.ts`, `traffic-diagram.tsx` and `traffic-diagram.module.css` remain untouched by this task. Shared components, model/provider, tests and other agents' files were not edited.

## Result

- The day uses a compact divided metric band. Semantic colour stays on values instead of large coloured tiles.
- Attention presents ID, the recorded blocker (or actual stage when absent), and journey wait. Its count explicitly identifies the three shown out of all tier 1 open movements.
- Attention reveals the corresponding worklist row, moves keyboard focus to it and highlights it. It switches the resolved-only tab to Every movement while preserving the chosen order. A monotonically increasing request makes repeated clicks work. It never opens the drawer implicitly.
- The grouping/sort strip uses compact Stage, Transport and Longest wait controls; the existing descriptive accessible labels remain.
- Worklist records separate identity/urgency/closure/time, route, stage, blocker or closure reason, supporting facts, owner and explicit actions. Both What is recorded and Review patient remain available. Supporting text uses existing Ward type tokens; row actions are compact on desktop and retain the 48px phone floor.
- Stage summary provides proportional stage bars, the longest open journey at each stage and links to the matching worklist group. Empty stages state none. Owner-not-recorded and unaccepted-transport follow-ups open their existing summary tabs.

## Deliberate deviations

- The drawing's severe-cause data and illustrative counts are not copied. Attention retains the existing tier 1 population/order and uses recorded blockers/status.
- A local worklist `li` composes existing Ward chips within the existing Ward record list, rather than changing the shared `WardRecordRow` API. This enables a focusable record target and separate route/facts/action hierarchy without modifying other screens. Existing record identity/data markers are retained. Transport and other summary rows continue using the shared row.
- Stage adds oldest-journey information and follow-up links instead of duplicating the Resolved tab's totals. Bars use each stage's share of all open movements.
- Attention and stage jumps use immediate scrolling, preserving reduced-motion behavior.

## Retained behaviour

All-movement stage/transport/wait populations and ordering, closed-row outcomes/reasons and frozen clocks, drawer actions, workspace routes, open-only transport tally, all five summary tabs, traffic/corridor meanings, compact traffic legend, reconciliation and synthetic disclosure remain. Q003 bounded independently scrolling bodies, stationary controls, aligned primary/summary stack and natural phone/print flow remain in the stylesheet.

## Evidence and next checks

Viewed all four assigned actual reference/before captures and read the served drawing's source plus the relevant written design standard. Inspected the scoped diff against the preserved dirty inputs.

Formatting: scoped Prettier formatted TSX, but its CSS write returned `UNKNOWN/open`. CSS remained intact/readable; the same installed Prettier API then produced formatting that was applied through the patch tool. No process or permission changes were made.

Tests, typecheck, lint, server and browser commands: **unrun by task ownership**. Controller owns these checks. No provider calls, Git mutations, deletions or moves.

Minimal behavioural coverage for the controller:

1. Attention from each order and from Resolved today reveals the right record, retains the chosen order, focuses it and does not open a dialog; repeated click repeats focus/scroll.
2. Stage-summary action selects stage grouping and reveals that stage's first open record; empty stage is inert; summary follow-ups open their existing tabs.
3. Explicit detail and workspace actions still work; a closed movement retains outcome, reason and frozen elapsed time under each order.
4. Browser review at desktop and phone widths: metric/attention density, long real blockers and route names, row action targets, independent scroll/focus, Stage summary content, light/dark, print, and no horizontal page overflow.

Review concerns: the local focused record markup and its existing test contracts need independent scrutiny; visual compactness and long-content behavior remain unverified until the controller captures the running app.

## Review correction batch

Addressed the three findings in `task-2-review.md`, after viewing `movements-refined-worklist-light-1440.png` beside the assigned worklist reference.

1. Reveal consumption now belongs to a ref on `MovementsScreen`, with a stable callback. The matching row consumes its request before focus/scroll. Grouping remounts cannot replay a consumed request; a new attention or stage jump has a fresh request number. Highlight remains independently represented by the selected ID. Controller must recheck attention → Transport/Longest wait leaves focus on the chosen control, while repeated attention and resolved → attention still focus the record.
2. Row padding and internal margins are tighter. The route uses the existing ED site code with its full department name in accessible text/title. Missing acceptance reads the subordinate “Destination pending” with the precise absence in its title. Stage and meaningful blocker/closure reason share a wrapping line; service and owner share one wrapping footer line alongside the unchanged explicit actions. Font sizes and the phone touch floor are retained. No new screenshot or measured row-height claim is made by the implementer.
3. Blank blockers and exact `BLOCKERS_MEANING_NOTHING_IS_BLOCKING` sentinels fall back to the actual stage in attention. They no longer create an empty-purpose worklist reason line. Meaningful prose remains verbatim, closure reasons remain visible, and raw cleared/history blocker detail remains available through What is recorded. Priority populations/order and engine code are unchanged.

Only the same two source files and this report were edited in this correction batch. Installed Prettier formatting was applied through the patch tool. No tests, browser, server, provider, shared-source or engine commands/edits were made. Reuse the independent review's single provisional scorecard; corrected interaction and visual evidence remain with the controller rather than assigning an unobserved new score.
