# Integrity audit follow-up — 3 November 2026

Task: repair the data-integrity audit findings, defer substantial design or visual work, and open a feature PR. Base: `a6d8a0fd2e2191df3900e63ffdf000381f1968ee`, `BigSimmo/Ward-Flow` main. No migration, deployment or merge is part of this task. All examples and tests are synthetic.

## Completed scope

| Audit ID | Change                                                                                                                                                                                                                               | Regression evidence                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| F1       | Bind clearance and transport form lifetimes to their movement and world, invalidating drafts when the edited movement changes under the same patient route.                                                                          | Patient regression: open/attest A, switch active movement to B, require a newly opened form and attestation.                                    |
| F2       | A local demo tab that has edited, restored or imported a day keeps ownership of it. Successful session saving cannot make its work eligible for replacement by a delayed peer snapshot. Untouched tabs can still follow another tab. | Tab regressions: accepted saved work, repeated peer messages, restored work and reset; existing untouched-tab adoption and save/recovery tests. |
| F4       | Moved to PR #1334 (Josh, 3 Nov 2026): the partial receipt fix now lives there, so this PR no longer changes the receipt.                                                                                                             | Covered by #1334's receipt recovery tests.                                                                                                      |
| F6       | Keep leave, gone to ED, return from ED and discharge forms and answers until a current accepted command confirms the save. Retain failed input and show the returned failure through the existing refusal surface.                   | Patient regression: deferred/failed discharge, leave and gone to ED, repeat click, accepted retry; pending return from ED.                      |

No screen layout or styling redesign is included. The existing notice/refusal surfaces carry save outcomes. Local tab snapshots are not a multi-writer merge protocol: once a tab owns its day it does not adopt another tab's replacement day automatically. This deliberately favours retaining work over silently synchronising divergent histories. Authenticated shared mode continues to use server conflict handling.

## Substantial design deferred

These findings remain open, rather than being described as fixed by unrelated changes:

- **F3 — durable forecast save recovery and truthful pending status.** The forecast history side API needs a separately persisted pending outbox scoped to actor, desk and world. It needs an explicit pending/failed/confirmed presentation and safe acknowledgement/removal rules. Replaying the existing local history blindly would overwrite colleagues' newer choices. Acceptance: failed POST followed by reopen preserves pending intent; safe acknowledgement clears only that intent; account/desk/world changes never replay elsewhere.
- **F5 — concurrent forecast reason replacement.** Add a per-day version and conditional write plus idempotent lost-response reconciliation. Coordinate the database migration, compatibility with older writers and API/client conflict contract; do not silently impose a new schema in a UI fix. Acceptance: stale same-day edit is refused with retained answers; unrelated days remain writable; an older retry cannot overwrite a newer choice. Existing SQL is last-writer-wins and remains so in this PR.
- **Forecast combined-write atomicity and reset fencing (audit appendix).** The current UI sends snapshot and reason separately, but the API accepts both. Resolve the transaction/generation-lock boundary alongside the side API's versioned write design, or explicitly reject combined bodies. Acceptance: second-write failure rolls back the first, and a reset between generation check and write cannot acknowledge an invisible old-world save.
- **Visual redesign and full multi-writer demo conflict resolution.** Any conflict-choice interface, merge UI, or changed visual design is deferred by the owner's instruction. The conservative local ownership fence prevents destructive adoption without inventing that interface.

These deferrals require a design decision and focused implementation, not merely more testing. Real patient use is outside this synthetic prototype's authority.

## Verification boundary

New regressions were run before fixes and failed on the audited behaviours. Focused tests exercise real providers/components/client code with synthetic transport/channel/SQL dependencies. They do not establish hosted PostgreSQL atomicity or authenticated multi-session behaviour.

The source checkout uses the required Node 24.22.1 and pinned npm 11.17.0 with guarded locked installs (499 root and 34 backend package locations). Dependency lifecycle scripts were disabled. No package or lockfile changes are part of the repair.

Cloud-browser control remains unavailable. No screenshots, physical-device acceptance, hosted demo writes or deployed-commit assertions are supplied. The local selected PR gate is run before publication; its final result and any limitations are recorded in the PR description. Full suites, real PostgreSQL integration, production build and browser journeys are left to hosted CI by the repository's lean PR-verification policy. A PR does not establish deployment or clinical acceptance.

## Bounded staff-note history

The runtime retains its existing maximum of 20 staff notes. The oldest entry is preserved here when adding this repair note, rather than losing its wording:

- 2026-10-31 (`2026-10-31-redesign-capacity`): Capacity has a new look: beds ready first, the bed forecast, a bed map of every ward and this shift's checks.

- 2026-10-31 (`2026-10-31-redesign-referrals`): Referrals and Ward answer are tidier: rows wrap in full, and Accept and Decline sit in a bar at the foot.

- 2026-10-31 (`2026-10-31-redesign-records`): Waiting, Alerts, Legal forms, Patients, Movements and the patient record have a new look for each desk.
