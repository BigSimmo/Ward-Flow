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

| Batch                                  | Owner/branch                                  | State       | Acceptance                                                                                                             |
| -------------------------------------- | --------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| Reporting: seven designs               | reporting / `codex/polish-reporting-20261002` | In progress | Compact truthful reporting; no fabricated history; focused regression and rendered checks                              |
| Patients/intake: five designs          | patients / `codex/polish-patients-20261002`   | In progress | Search, both patient views, Add Patient and New Referral polished; privacy and form gates retained                     |
| Services: six designs                  | services / `codex/polish-services-20261002`   | In progress | Ward directory/hub/answer/board, ED and Community Hub polished; availability and response meaning retained             |
| Access/preferences: two designs        | coordinator                                   | Next        | Sign-in simulation clear; Settings imports fully validated; existing persistence retained                              |
| Operational overview: four designs     | worker wave 2                                 | Next        | Command, Capacity, Network and Service Search polished; supported scope/navigation retained                            |
| Movement/transport: three designs      | worker wave 2                                 | Next        | Board/workspace/Transport Hub polished; inspect committed movement recovery first                                      |
| Coordination/governance: seven designs | worker wave 2                                 | Next        | Delay, handover, alerts, on-call, out-of-area, legal and governance polished; accepted/refused alert feedback truthful |

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

Checkpoint: guard repair `7493135` independently reviewed and regression checked. Reporting
`c60b1eb` (162 focused tests/typecheck), services `5bacbf4` (96 tests), movement `409fac3`
(31 tests), patient recovery `17be650` and patient polish in progress (135 focused tests).
Those are worker evidence, not final combined-candidate acceptance. Desktop reviews use
**1920 x 1080 viewport captures only** following the user's correction; prior smaller/full-page
images are preliminary and excluded from desktop acceptance.

Reporting/service patches are preserved staged in the coordinator; combined commit was
blocked by new concurrent migration-restoration claims at sign-out lines709/719. Scoped user
approval is pending for seven statistics TSX files, Community CSS and movement-board CSS.
Other owner worktrees are intact. Settings imports now reuse complete validation and visibly
render feedback (previous toast state had no markup); seven import regressions pass. Sign-in
copy no longer claims authentication or shows drawing filenames; focused assertion update
pending. Actual screens remain ordinary refinements; no replacement concept has been applied.

Coordinator `ensure` verified3302/project3eb35f2e4a07/PID37260. This task-owned server was
stopped after repeated compile/control timeouts to release memory; fresh ensure/identity are
required before final preview. Baseline3174 belongs to clean `ag-hud-fold` at981a4a8,
identity98f1cf4a6cc2/PID36996; unrelated servers were not stopped. CUA control failed repeatedly;
bounded local automated Chrome visual harnesses are used with synthetic fixtures. Patient
record-only governed fixture is PT-001; movement fixtureWF-009 is default-view only.

Next: finish independent operational/coordination/access polish, integrate released reviewed
patches, resolve the scoped ownership question, then fresh combined1920visual/actions and
selected offline gates. No main integration, publication or deployment authority.
Private worker reports/evidence: `%TEMP%/ward-polish-34-20261002/`.
Canonical receipt reconciliation: unsynced; prepare the existing local receipt bridge.
