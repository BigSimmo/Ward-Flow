# Ward Flow component guidance

@../../../AGENTS.md

The root [AGENTS.md](../../../AGENTS.md) is the canonical operational rule source within the host
instruction hierarchy. This subtree adds only component-specific pointers. HOW-WE-WORK and the
product README provide context; neither overrides root safeguards. Read the affected
[code-map section](../../../docs/ward-flow/code-map/README.md) before component work.

- Before changing controls, legal displays, persistence or privacy wording, read
  [owner rules, HOW-WE-WORK §6](../../../docs/ward-flow/HOW-WE-WORK.md#6-owner-rules-that-fail-builds-or-reviews).
- Classify new events in `ward-flow-persistence-classification.ts`, map their roles in
  `EVENT_ROLE` (`ward-flow-event-roles.ts`, re-exported from `ward-flow-events.ts`) and cover permissions in `tests/ward-event-permissions.test.ts`.
- Use the shared [wf kit](../wf/) and existing `--wf-*` tokens from
  [ward-flow-v9-tokens.css](../../app/ward-flow-v9-tokens.css), with the
  [v9 design system](../../../design/v9/design-system-v9.md). Preserve accepted appearance;
  follow [UI and local server workflow](../../../docs/agents/building-ui.md) for actual UI work.
