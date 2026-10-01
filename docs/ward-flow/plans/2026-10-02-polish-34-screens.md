# Ward Flow polish: 34 screens

Task/source identity: `BigSimmo/Ward-Flow:polish-34-screens-20261002`.
Coordinator: `codex/chat-polish-34-screens-6c8b` in the Codex 6c8b worktree.
Base: local main `981a4a8a52e0c235b888e4c9470c94c34808cf33`.
Status: In progress. Local Fast Preview; no publication, main integration or deployment.

## Agreed outcome

Polish all 34 application designs except Discharge Board, Referral Board and Community
Directory. Include New Referral, Community Hub and Community Statistics. Exclude the
optional showcase. Preserve the current identity, behavior, clinical/legal meaning,
synthetic provenance, privacy and access boundaries. Remove redundant explanatory prose.
Replacement concepts are separate local artifacts only, presented together at the end;
never apply them to working pages during this task. Continue autonomously.

## Ownership and order

| Batch | Owner/branch | State | Acceptance |
| --- | --- | --- | --- |
| Reporting: seven designs | reporting / `codex/polish-reporting-20261002` | In progress | Compact truthful reporting; no fabricated history; focused regression and rendered checks |
| Patients/intake: five designs | patients / `codex/polish-patients-20261002` | In progress | Search, both patient views, Add Patient and New Referral polished; privacy and form gates retained |
| Services: six designs | services / `codex/polish-services-20261002` | In progress | Ward directory/hub/answer/board, ED and Community Hub polished; availability and response meaning retained |
| Access/preferences: two designs | coordinator | Next | Sign-in simulation clear; Settings imports fully validated; existing persistence retained |
| Operational overview: four designs | worker wave 2 | Next | Command, Capacity, Network and Service Search polished; supported scope/navigation retained |
| Movement/transport: three designs | worker wave 2 | Next | Board/workspace/Transport Hub polished; inspect committed movement recovery first |
| Coordination/governance: seven designs | worker wave 2 | Next | Delay, handover, alerts, on-call, out-of-area, legal and governance polished; accepted/refused alert feedback truthful |

## Coordination rulings

- Independent editing threads use separate main-derived worktrees under repository rules.
  Coordinator applies reviewed scoped patches to this task branch; no branch merge/rebase.
- Shared shell, generated records and Git operations have one coordinator owner.
- Statistics shared CSS is single-owner; patient default/governed route is single-owner.
- Community detail is included, directory excluded. Referral intake included, board excluded.
- Existing paused candidates remain recoverable; none is automatically adopted wholesale.
- Existing source is reused. No new backend, public APIs, identity flow, provider, dependency
  or security-policy change. New tests cover actual corrected behavior rather than styling.

## Evidence and next step

Setup verified dedicated fetch/push remotes, clean source and main base; Node 24.19.0/npm
11.17.0. Dependencies reused by supported setup with exact lock parity. Last verified
baseline preview: port 3174, clean `ag-hud-fold` root at base. Separate movement-recovery
preview: port 3787, a42c root at `ffd61d2`; not the integrated candidate.

Next: bind edited preview to coordinator source; collect baseline/rendered findings and
integrate independent owned batches. Focused tests and relevant viewport/action checks,
then required selected final-candidate gates. All completion/visual claims remain pending.
Private worker reports/evidence: `%TEMP%/ward-polish-34-20261002/`.
Canonical receipt reconciliation: unsynced; prepare the existing local receipt bridge.
