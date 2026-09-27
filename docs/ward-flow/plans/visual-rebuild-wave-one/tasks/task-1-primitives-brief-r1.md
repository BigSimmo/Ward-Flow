# Task 1 primitive and statistics-frame helper — revision 1

Model: gpt-5.6-sol / medium, bounded shared-foundation support. Parent is shell, execution, test and browser owner. No child agents, Git writes, providers, shell edits, application-engine edits, tests or browser jobs.

Plan: `docs/ward-flow/plans/2026-09-12-visual-rebuild-wave-one.md`, SHA-256 `79A66BFAAF697433D059726F58F5CA29D8AF52AE3364656ABD707DA4A21BFAB9`.

App HEAD: `1ef9ed3975078b789e9b5d70b3f000c64edc3809`; assigned source paths were clean at dispatch.

Goal: implement Task 1's opt-in third-edition primitive token path and optional statistics-frame seam. The explicit marker is `data-ward-design="third-edition"`; the opted-in frame composes the canonical `wardShellTokens` class locally. Existing consumers that omit the design prop retain their exact default path. Old token bindings composed at primitive elements must be overridden there through marker-scoped selectors. The new frame stylesheet must not import Task 3's later content stylesheet.

Exclusive source ownership:

- `src/components/ward-management/ward-panel.module.css`
- `src/components/ward-management/ward-figure.module.css`
- `src/components/ward-management/ward-table/ward-table.module.css`
- `src/components/ward-management/statistics/statistics-section-frame.tsx`
- new `src/components/ward-management/statistics/statistics-section-frame-third-edition.module.css`
- `src/components/ward-management/statistics/statistics.module.css`, limited to marker-scoped
  `DemonstrationChart` `.prototypeBadge`/`.chartCaption` descendant corrections approved by the
  controller after source inspection showed their explicit legacy declarations defeat inheritance
- `docs/ward-flow/build-contracts-2026-09-12/AGENT-BRIEF-COMMON.md`

Owned task documents:

- this scoped brief;
- `docs/ward-flow/plans/visual-rebuild-wave-one/tasks/task-1-primitives-report-r1.md`.

Required implementation:

- Add optional `design?: "third-edition"` to `StatisticsSectionFrame`.
- Only the explicit value adds the marker and third-edition frame classes; omission preserves current markup classes and behavior.
- Compose canonical tokens from `src/app/ward-flow-shell-tokens.module.css` at the opted-in frame root.
- Add marker-scoped third-edition rules for panel, figure and table primitives, including nested elements whose old composed token bindings or explicit declarations would otherwise win.
- Preserve current semantics, print behavior, table containment/scroll contracts, tabular numeric alignment, and truthful prose count treatment.
- Amend the common brief's obsolete absolute prohibition so it accurately describes the commissioned opt-in mechanism and its three acceptance conditions.

Stop conditions: any need to edit `DemonstrationChart` logic/markup, any unapproved rule outside the
narrow marker-scoped `statistics.module.css` expansion above, Task 3 content styling, shell/layout
files, TSX primitive components, engines, tests or another unassigned shared file; any unsupported
behavior/product decision; provider, destructive or Git-write action. Report the exact need to the
parent instead of editing it.

Acceptance limit: compatibility seam may be implemented now, but visual acceptance and computed-style evidence remain pending until the parent exercises real consumers after the Hub pilot.

Controller correction: model label verified against the original spawn arguments (gpt-5.6-sol, medium, fork_turns none); the earlier generic GPT-6 persona label was inaccurate.
