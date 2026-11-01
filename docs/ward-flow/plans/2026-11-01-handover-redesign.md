# Handover redesign build (1 Nov 2026)

Status: built, tests updated, awaiting hosted CI. Pinned at branch `claude/project-thread-asjkae` (continues `claude/project-thread-ngrkil`, redesign commit `1752634d5`).

Josh approved mock-up round 6 of the Handover screen on 1 Nov 2026. This plan records what the build changes and how to check it. Synthetic data only.

## What changes on screen

1. **Header.** The title is the count to hand over. One row of counts (Act now, Flagged urgent, Due by, Finding a ward, Moving) highlights rows when pressed; pressing again clears it. The handover is chosen from one menu (`ward-handover-shift`), which replaced the three-way shift switch.
2. **At a glance.** One line under the header: when the handover starts, beds against demand, the longest wait (opens that patient) and what changed since the last handover (`ward-handover-since-line`). It replaces the Since card and the Changed-since chip.
3. **Sheet bar.** Show (scope), Detail, Highlight (one menu of highlight chips), grouping, and one primary **Print handover** button (`ward-handover-print`). A scoped sheet states "n of N open in scope" above the table; the whole network needs no such line.
4. **More handover actions.** Present on a screen, Copy summary, Downtime pack and Open in Waiting sit in the toolbar's More menu.
5. **Sign-off bar.** A sticky bar at the foot of the sheet (`ward-handover-sign-bar`) shows checks cleared, names the ones still open, and signs off. **Open checklist** opens the full sign-off panel in a drawer. ED desks have no sign-off bar.
6. **Ward promises to chase.** Carry over becomes Ward promises to chase, earliest first.
7. **Table.** On screen, Next step leads and carries the status under it; the Due column is gone from the screen (the printed sheet keeps its own columns).

The phone layout, print sheet, History and Beds tabs keep their behaviour.

## Tests

Tests that pinned removed parts were rewritten to the new controls, keeping each test's intent:

- Shift choice: open `ward-handover-shift`, pick the `menuitemradio` (the menu items are now radios, one handover at a time).
- Sign-off: press **Open checklist** in the sign-off bar, then use `ward-handover-sign-off-button` as before.
- Print: `ward-handover-print`. Present and Copy summary: **More handover actions**.
- Highlight chips: the Highlight menu's `menuitemcheckbox` items.
- Since: the at-a-glance line, which lists only counts above zero and still names ward-wide populations.
- Scope summary: "n of N open in scope" when scoped; the scope control names the whole network.

Files: `tests/ward-handover.dom.test.tsx`, `ward-handover-access-label`, `ward-handover-desk-roles`, `ward-handover-filters`, `ward-handover-scope-from-url`, `ward-handover-sign-off-page-ward`, `ward-handover-title-count`, `ward-journey-handover-signoff`, `ward-render-churn-clock-and-handover`.

## How to check

1. Local: the 27 Handover test files pass (172 tests). `npm run verify:pr-local` for lint, typecheck and related tests.
2. Hosted: "Ward Flow required" is the full gate.
3. By eye: open `/ward-flow/handover` on desktop, iPad portrait and phone and compare with the round 6 mock-up.
