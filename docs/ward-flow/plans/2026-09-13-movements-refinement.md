# Q002 — Movements refinement

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/plans/README.md`.** Kept for history; do not follow.

Owner feedback: 13 September 2026, seven screenshots; live Movements versus served `movement-third-edition.html`. Continues alongside Q001 rather than replacing it. Branch remains the local ward task line; no publication or engine-rule changes.

## Design contract

Bound desktop two-column sections so each long list scrolls inside its own body and its neighbouring summary remains in place. Panel headings and controls sit outside those bodies. This prevents the long blank right column. On narrow widths stack the panels with reachable controls. Apply this principle to Q001 as well; it is the owner's clarified global scroll rule, not an instruction to rewrite every screen in this batch.

Improve Day metrics, attention items, compact traffic nodes and routing, compact expandable key, corridor switcher, movement rows and actions. Keep Transport right now and add the useful summary switcher. Remove explanatory product prose; preserve concise operational facts, actual absent states and synthetic provenance. Derive figures from current records and record every drawing/engine difference. Do not substitute the mockup's illustrative completed-journey counts for open accepting-destination records.

## Ownership and sequence

1. M1 — `tasks_copy_review` implementer: `src/components/ward-management/movements/**`, focused matching tests. Snapshot dirty starting inputs; report in `movements-refinement/tasks/M1.md`.
2. M2 — independent bounded source review after M1 returns; fix concrete correctness and design gaps once.
3. M3 — root integrates, compares served app/drawing at 390/820/1440 light/dark, checks scroll ownership, tab changes and patient routing. Update canonical verification only for actual looking, regenerate record, preserve historical proof.

Shared shell remains Q001 ownership. Root controls browser and test capacity. Reuse running identified local server. No full-suite repetition: one focused relevant batch after source settles, widen only for a concrete failure. No fabricated 9/10 score; use observed layout, spacing, state truthfulness and interaction checks as the acceptance threshold.

## Progress

- M1 implemented; M2's three source findings corrected and independently closed. M3 inspected supplied light/dark responsive captures with no material visual finding in their covered states.
- Latest transport restoration, unique corridor totals and requested-transport wording still need a final rendered check: browser navigation returned `ERR_BLOCKED_BY_CLIENT`. Canonical verification remains reopened. See [progress and acceptance boundary](movements-refinement/PROGRESS.md).
