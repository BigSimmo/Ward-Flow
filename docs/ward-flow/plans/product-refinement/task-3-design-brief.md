# Q004 Task 3 — domain design, read-only source phase

Read this first. Owner explicitly commissioned NEW audit capture/review actions and NEW patient-linked discharge records/access controls. Design the smallest coherent implementation in the existing Ward local prototype before dependent screens use it.

Read Ward README, relevant ward-model, reducer/provider/actions/role contracts, discharge/bed-release/legal/audit/access records and focused existing tests. All source is READ ONLY in this phase. Only write your report to `docs/ward-flow/plans/product-refinement/task-3-design.md`. Do not create new source, start servers, run tests, use providers/Git writes, or spawn agents.

Required output: existing contracts/data available, proposed exact new types/actions/state/storage and read/write guards, explicit legacy-anonymous handling, patient identity linkage validation (no inferred matching), captured event categories and actor/subject/timestamp/outcome provenance, append-only event and review state semantics, targeted allowed/denied/stale/legacy test cases, exact owned source/test file list for implementation, and unresolved material questions only. Existing role boundaries must not be silently broadened. Frontend hiding alone is not an access control; this remains synthetic local prototype, not a hosted security claim. Preserve eligibility/ranking and existing admission/discharge semantics. No new legal deadlines or clinical decisions. Settings/auth/security production integration is out of scope.

State persistence must follow existing provider/reset conventions and truthfully distinguish this-session events from historical data not recorded. A review action must not retroactively change an event or confer clinical authority. Patient-related information must not be added to unrestricted general logs. Plan contracts for Capacity ward summary/Discharges tabs, Discharges board and Governance without changing their source yet.

Report succinct implementable design with reasoning and risks, not speculative architecture. Parent will send to independent review before implementation. Announce acknowledgement and return a short report pointer when ready.
