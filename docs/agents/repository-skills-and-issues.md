# Repository Skills and Outstanding-Work Memory

<!-- BEGIN:repository-skills-and-issues -->

## Repository productivity skills

Automatically apply repo-local skills under `.agents/skills/` when their descriptions match the user's request. Run `npm run skills` for the validated catalog of 35 canonical skills. `npm run check:skills` verifies those skills, their compatibility aliases, and the Claude, Cursor, and PsychSift plugin skill surfaces. The older long names remain compatibility aliases and must not be counted as unique skills.

The foundational orchestration skills are:

- `plan`: plan risk-scoped verification before non-trivial changes.
- `fix`: diagnose and repair local verification failures with the smallest reproducer.
- `clinical`: assemble clinical, privacy, source, and rollback evidence.
- `ui`: inspect the running app across routes, breakpoints, and accessibility modes.
- `rag`: validate retrieval and answer changes offline first, then prepare live-eval approval gates.
- `operations`: turn pending operator debt into a deduplicated, approval-gated batch.
- `task`: manage safe start, handoff, merge proof, and cleanup transitions.

Run the matching planner command in `docs/productivity-workflows.md` without side effects by default. Add `-- --run` only to execute its local/offline checks. The workflow engine must never execute commands listed under `approvalRequired`.

## Outstanding-work memory (`/issues`)

Retired on the Ward Flow line on 26 September 2026 at Josh's request. The PsychSift version of
this ledger and its `/issues` skill remain on `origin/main`. Ward Flow's own work is tracked in
`docs/ward-flow-task-ledger.md`, and Ward Flow's records from the old system are archived in
`docs/ward-flow/archive/psychsift-era-records/`.

<!-- END:repository-skills-and-issues -->
