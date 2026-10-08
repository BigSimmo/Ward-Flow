# Ward Flow — remaining remediation tasks

Publication snapshot of the completed local audit/remediation register, 8 October 2026. This PR corrects 49 tasks locally and preserves five original findings already resolved by newer main. The following **39 items remain**: 16 partial, 14 requiring an owner decision, eight requiring external verification and one deferred optional improvement.

This list records remaining scope rather than re-reporting corrected baseline defects. IDs, original ownership/approvals and acceptance criteria are retained. Earlier source-only tests do not verify configured providers, shared staff access, recovery or clinical approval. Publication adds this task document; it performs no deployment or new clinical approval.

## Verification already observed

- Full local suite at `3d01bf9`: 10,881 passed, 146 skipped across 936 passing and nine skipped files; lint/typecheck passed.
- After integrating canonical main `0bbcd34`, candidate `8682118`: 325 tests in 29 relevant files, whole-source lint, all-route production build with normal complete TypeScript check and 12 selected Chromium browser checks passed. Ten bounded Settings checks also passed.
- Documentation candidate `b31c78b`: six files / 77 documentation contracts and staged commit checks passed. The application render fingerprint remained `659b58adf6d90659ab9306947265d23c068146c7ed5b1b973ecbbd9cb9f7f13b`.
- No additional local tests, builds, browser checks or hosted CI observation were requested for this publication. No repeat full-suite result on the merged candidate is claimed.

## Next milestones and critical path

1. Establish Ward-only identity/resource ownership and approve staff/service membership and synthetic retention.
2. Implement trusted shared sign-in, server authorisation, authoritative shared commands/persistence, durable idempotency/history and revision-aware synchronisation. Retain the assessed Azure Functions/Entra/Blob architecture unless measured requirements justify a change.
3. Verify two-user synthetic conflicts, duplicate/retried requests, reconnect, revoked membership and cross-service access; verify monitoring, backups, recovery and rollback against the actual Ward resources.
4. Finish remaining scoped product, browser/accessibility and historical verification work.
5. Obtain qualified clinical/privacy/legal/cultural and intended-purpose regulatory assessments plus institutional pilot authority before real-patient use.

## Prioritised task index

| ID | Priority | Current disposition | Component |
| --- | --- | --- | --- |
| BE-001 | P1 | Requires owner decision | Frontend identity and session integration |
| BE-002 | P1 | Requires owner decision | Authoritative shared persistence |
| BE-003 | P1 | Requires owner decision | Service membership and server-side roles |
| BE-004 | P1 | Requires owner decision | Cross-user update delivery |
| BE-005 | P1 | Requires owner decision | Shared domain commands and allocation invariants |
| BE-010 | P1 | Requires owner decision | Immutable shared action history |
| BE-011 | P1 | Unverified external | Live Azure backend/resource evidence |
| GOV-001 | P1 | Requires owner decision | TGA intended-purpose determination |
| GOV-002 | P1 | Requires owner decision | WA Health privacy and data governance |
| GOV-003 | P1 | Requires owner decision | Safety case / accountable clinical governance |
| OPS-001 | P1 | Unverified external | Staging and environment isolation |
| OPS-003 | P1 | Unverified external | Backups and recovery |
| QA-001 | P1 | Partial | Shared-user acceptance scenarios |
| SPEC-001 | P1 | Partial | Medical deterioration / held-bed lifecycle |
| ARC-001 | P2 | Partial | Domain policy / transition maintainability |
| BE-006 | P2 | Partial | Write outcome and safe retries |
| BE-008 | P2 | Partial | Stored session deletion and retention |
| BE-009 | P2 | Partial | Backend request failure diagnostics |
| CAP-002 | P2 | Requires owner decision | Alert intervention recording |
| CAP-004 | P2 | Requires owner decision | Operational Settings preview controls |
| CAP-005 | P2 | Unverified external | WA Health pathways / directories / PAS / HMDC |
| CAP-006 | P2 | Requires owner decision | Unwired global export / notification / admin surfaces |
| DEV-002 | P2 | Requires owner decision | Canonical blocked Notion work / owner recovery |
| DEV-003 | P2 | Unverified external | Native coding agents / remote device readiness |
| DEV-004 | P2 | Partial | Historical registers and exhaustive semantic verification |
| DOC-003 | P2 | Partial | Screen verification provenance |
| NEW-OBSERVABILITY-001 | P2 | Partial | Next request error instrumentation |
| OPS-002 | P2 | Partial | End-to-end error monitoring |
| OPS-004 | P2 | Unverified external | Release rollback / incident response |
| OPS-005 | P2 | Unverified external | Capacity limits and edge abuse controls |
| QA-002 | P2 | Partial | Ward browser compatibility and accessibility acceptance |
| QA-003 | P2 | Partial | Representative performance and large-state limits |
| QA-004 | P2 | Unverified external | Host JWT / security contract verification |
| RT-008 | P2 | Partial | Discharge status accessibility |
| SEC-003 | P2 | Partial | ESLint glob / braces dependency chain |
| SPEC-005 | P2 | Requires owner decision | Queue ordering policy reconciliation |
| SPEC-007 | P2 | Partial | Community clinician allocation |
| SPEC-012 | P2 | Partial | Community review/assignment capabilities |
| OPT-001 | P3 | Deferred optional | Review approvals for higher-risk releases |

## P1 — remaining tasks

### BE-001 — Frontend identity and session integration

**Disposition:** Requires owner decision. **Area:** Authentication. **Effort:** L.

**Remaining action:** Choose current Ward-only shared backend contract, verified tenant/app/resource identities, service membership/provisioning/revocation and migration/retention policy; implement and verify dependencies from original acceptance criteria. Do not use PsychSift resources or silently choose a new database vendor.

**Current local correction/evidence boundary:** Existing owner-private Azure snapshot API retained and hardened. Shared staff identity/service authority/command database/synchronisation/authenticated durable audit remain absent.

**Dependencies:** BE-011

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- Two synthetic staff users sign in; expired tokens cannot save; sign-out clears sensitive session memory.

**Verification required:**

- Browser auth integration against Ward-only staging; local token expiry tests.

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence.

### BE-002 — Authoritative shared persistence

**Disposition:** Requires owner decision. **Area:** Backend. **Effort:** XL.

**Remaining action:** Choose current Ward-only shared backend contract, verified tenant/app/resource identities, service membership/provisioning/revocation and migration/retention policy; implement and verify dependencies from original acceptance criteria. Do not use PsychSift resources or silently choose a new database vendor.

**Current local correction/evidence boundary:** Existing owner-private Azure snapshot API retained and hardened. Shared staff identity/service authority/command database/synchronisation/authenticated durable audit remain absent.

**Dependencies:** BE-001, BE-003

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- Two users of one approved synthetic service reload the same committed state; isolation prevents another service reading it.

**Verification required:**

- End-to-end save/reload across independent users and browsers; cross-service negative tests.

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence.

### BE-003 — Service membership and server-side roles

**Disposition:** Requires owner decision. **Area:** Authorisation. **Effort:** L.

**Remaining action:** Choose current Ward-only shared backend contract, verified tenant/app/resource identities, service membership/provisioning/revocation and migration/retention policy; implement and verify dependencies from original acceptance criteria. Do not use PsychSift resources or silently choose a new database vendor.

**Current local correction/evidence boundary:** Existing owner-private Azure snapshot API retained and hardened. Shared staff identity/service authority/command database/synchronisation/authenticated durable audit remain absent.

**Dependencies:** BE-001

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- Viewer write refused; foreign service read/write refused; revoked user rejected within agreed revocation interval.

**Verification required:**

- API negative matrix, real signed local JWT fixtures, staging account revocation rehearsal.

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence.

### BE-004 — Cross-user update delivery

**Disposition:** Requires owner decision. **Area:** Synchronisation. **Effort:** L.

**Remaining action:** Choose current Ward-only shared backend contract, verified tenant/app/resource identities, service membership/provisioning/revocation and migration/retention policy; implement and verify dependencies from original acceptance criteria. Do not use PsychSift resources or silently choose a new database vendor.

**Current local correction/evidence boundary:** Existing owner-private Azure snapshot API retained and hardened. Shared staff identity/service authority/command database/synchronisation/authenticated durable audit remain absent.

**Dependencies:** BE-002

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- Peer change becomes visible; reconnect refetches current revision; stale responses do not regress state.

**Verification required:**

- Two-browser network delay/disconnect/reconnect tests.

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence.

### BE-005 — Shared domain commands and allocation invariants

**Disposition:** Requires owner decision. **Area:** Data integrity. **Effort:** XL.

**Remaining action:** Choose current Ward-only shared backend contract, verified tenant/app/resource identities, service membership/provisioning/revocation and migration/retention policy; implement and verify dependencies from original acceptance criteria. Do not use PsychSift resources or silently choose a new database vendor.

**Current local correction/evidence boundary:** Existing owner-private Azure snapshot API retained and hardened. Shared staff identity/service authority/command database/synchronisation/authenticated durable audit remain absent.

**Dependencies:** BE-002, BE-003

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- Competing reservation commands yield one successful allocation; transfer failure cannot leave partial source/destination updates.

**Verification required:**

- Concurrent command race tests, rollback/failure injection and invariant checks.

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence.

### BE-010 — Immutable shared action history

**Disposition:** Requires owner decision. **Area:** Auditability. **Effort:** L.

**Remaining action:** Choose current Ward-only shared backend contract, verified tenant/app/resource identities, service membership/provisioning/revocation and migration/retention policy; implement and verify dependencies from original acceptance criteria. Do not use PsychSift resources or silently choose a new database vendor.

**Current local correction/evidence boundary:** Existing owner-private Azure snapshot API retained and hardened. Shared staff identity/service authority/command database/synchronisation/authenticated durable audit remain absent.

**Dependencies:** BE-001, BE-005

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- Each successful/denied command has correct actor/service/correlation; ordinary user cannot change history; export integrity can be checked.

**Verification required:**

- Attempted audit mutation, clock distinction and export verification tests.

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence.

### BE-011 — Live Azure backend/resource evidence

**Disposition:** Unverified external. **Area:** Verification. **Effort:** M.

**Remaining action:** Perform exact Ward-only provider checks and configuration/restore/rollback/security drills in original criteria after access/authority; do not classify inaccessible services as absent or healthy hosting as end-to-end proof.

**Current local correction/evidence boundary:** Original audit identifies existing provider evidence and explicitly inaccessible configuration; no provider mutation performed.

**Dependencies:** No additional prerequisite recorded; retain the named scope/authority conditions.

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- Evidence pins host/account/tenant/application identities and deployed SHA; save/reload/conflict and denial work on deployed service.

**Verification required:**

- Read-only config evidence and controlled deployed smoke; backup/restore test planned separately.

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence.

### GOV-001 — TGA intended-purpose determination

**Disposition:** Requires owner decision. **Area:** Clinical / regulatory. **Effort:** L.

**Remaining action:** Owner commissions qualified function-scoped TGA assessment, named clinical safety/cultural/legal review and custodian-led PRIS/WAHealth PIA; record scoped institutional acceptance before real patient use.

**Current local correction/evidence boundary:** Draft claims bounded and production-readiness register separates TGA exclusion/exemption, privacy, clinical and institutional approvals. No approvals obtained.

**Dependencies:** No additional prerequisite recorded; retain the named scope/authority conditions.

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- Approved dated assessment covers every released function and claims; any device obligations assigned and evidenced.

**Verification required:**

- Qualified regulatory review with current primary legislation/guidance and change-control triggers.

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence.

### GOV-002 — WA Health privacy and data governance

**Disposition:** Requires owner decision. **Area:** Privacy. **Effort:** XL.

**Remaining action:** Owner commissions qualified function-scoped TGA assessment, named clinical safety/cultural/legal review and custodian-led PRIS/WAHealth PIA; record scoped institutional acceptance before real patient use.

**Current local correction/evidence boundary:** Draft claims bounded and production-readiness register separates TGA exclusion/exemption, privacy, clinical and institutional approvals. No approvals obtained.

**Dependencies:** BE-001, BE-003, BE-008, BE-010

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- Named custodian approves data flows, overseas processing, retention/deletion, contracts, access/correction and incident process; no real data before approval.

**Verification required:**

- Health-service privacy/security review, processor contract and log/browser/backups data-flow tests.

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence.

### GOV-003 — Safety case / accountable clinical governance

**Disposition:** Requires owner decision. **Area:** Clinical safety. **Effort:** XL.

**Remaining action:** Owner commissions qualified function-scoped TGA assessment, named clinical safety/cultural/legal review and custodian-led PRIS/WAHealth PIA; record scoped institutional acceptance before real patient use.

**Current local correction/evidence boundary:** Draft claims bounded and production-readiness register separates TGA exclusion/exemption, privacy, clinical and institutional approvals. No approvals obtained.

**Dependencies:** SPEC-001, SPEC-006, SPEC-013, DOC-001

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- Clinical safety case and all critical controls signed by authorised accountable people for pinned release; rehearsal proves controls.

**Verification required:**

- Clinical tabletop, synthetic adverse scenarios, authorised pathway/Act review and independent acceptance.

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence.

### OPS-001 — Staging and environment isolation

**Disposition:** Unverified external. **Area:** Infrastructure. **Effort:** M.

**Remaining action:** Perform exact Ward-only provider checks and configuration/restore/rollback/security drills in original criteria after access/authority; do not classify inaccessible services as absent or healthy hosting as end-to-end proof.

**Current local correction/evidence boundary:** Original audit identifies existing provider evidence and explicitly inaccessible configuration; no provider mutation performed.

**Dependencies:** BE-011

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- Staging identity/config/data separate from demo and future clinical environment; wrong-origin/project guard fails closed.

**Verification required:**

- Provider config inventory and synthetic isolation test.

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence.

### OPS-003 — Backups and recovery

**Disposition:** Unverified external. **Area:** Infrastructure. **Effort:** M.

**Remaining action:** Perform exact Ward-only provider checks and configuration/restore/rollback/security drills in original criteria after access/authority; do not classify inaccessible services as absent or healthy hosting as end-to-end proof.

**Current local correction/evidence boundary:** Original audit identifies existing provider evidence and explicitly inaccessible configuration; no provider mutation performed.

**Dependencies:** BE-002, BE-011

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- Restore restores consistent domain/audit records within stated targets and does not access foreign resources.

**Verification required:**

- Documented timed restore drill and cross-record validation.

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence.

### QA-001 — Shared-user acceptance scenarios

**Disposition:** Partial. **Area:** QA / backend. **Effort:** L.

**Remaining action:** Implement actual approved shared backend first; execute all ten authenticated conflict/retry/revoke/reconnect scenarios and synthetic representative load/capacity limits on target environment.

**Current local correction/evidence boundary:** New domain/HTTP/client/browser regressions improve local correctness. They do not establish shared-user concurrency or representative operating load.

**Dependencies:** BE-001, BE-002, BE-003, BE-004, BE-005, BE-006

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- All ten essential multi-user scenarios have expected final domain/audit state and permission outcomes; no double reservation/lost update.

**Verification required:**

- Two identities/browser contexts, real disposable authorised persistence and fault proxy; explicit race barriers.

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence. This item remains Partial for the exact higher-level requirement in Remaining_action.

### SPEC-001 — Medical deterioration / held-bed lifecycle

**Disposition:** Partial. **Area:** Frontend/clinical workflow. **Effort:** L.

**Remaining action:** Obtain an explicit qualified clinical decision and implement/test the approved emergency diversion pathway for an already-collected patient before clinical use. Local pre-collection cancel/release/pause/re-clearance and onward-arrival protections are verified; safe collected cancellation refusal is not an implemented diversion service.

**Current local correction/evidence boundary:** Explicit D34 command and guarded ED controls implemented. Bound physical refundfea85da, linked-clearance/physical-arrival protections3c30811, usable stale-completion controls8377a8c and resumed clock4247723 integrated. Scoped actual-producer/domain/DOM checks and final local gates pass; earlier0ffd Chromium D34 cancel/confirm proof retained with exact source qualification. Collected emergency diversion remains a separate approved clinical contract.

**Existing task/decision:** WF-43 / D-34; partially specified, not completed

**Dependencies:** NEW-CAPACITY-001

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- Before transport, deterioration releases exactly one reservation and cancels any uncollected job in one state update.
- D-34 audit reason is recorded; referral visibly paused and cannot be booked/collected/arrived before re-clearance.
- Collected patients follow an explicitly approved emergency diversion pathway instead of refunding an occupied destination.

**Verification required:**

- Reducer scenario from pull → deterioration → denied arrival → fresh clearance → re-placement.
- Repeat event idempotency, no-transport, booked transport, cancellation, source-transfer and capacity conservation tests.

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence. This item remains Partial for the exact higher-level requirement in Remaining_action.


## P2 — remaining tasks

### ARC-001 — Domain policy / transition maintainability

**Disposition:** Partial. **Area:** Architecture. **Effort:** L.

**Remaining action:** After functional stabilisation extract small tested domain seams where consequence justifies migration; complete broad invariant/reader contract probes. No whole-reducer rewrite or lower file count target is commissioned.

**Current local correction/evidence boundary:** Affected policy seams now use current shared status/care workflows and tested producer/reader invariants; duplicated fake screen state removed.

**Dependencies:** SPEC-001, SPEC-013

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- All affected producer/reader paths agree on state invariants; contracts/mutation probes detect omitted guard and wrong profile status.

**Verification required:**

- Existing reducer suite plus named workflow/invariant tests; measure regressions before further refactor.

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence. This item remains Partial for the exact higher-level requirement in Remaining_action.

### BE-006 — Write outcome and safe retries

**Disposition:** Partial. **Area:** Reliability. **Effort:** M.

**Remaining action:** Define shared command idempotency/history/reconciliation semantics through BE005. Latest private snapshot receipt is not unlimited historical command deduplication or admission/referral transaction protection.

**Current local correction/evidence boundary:** Opt-in atomic latest-mutation receipts recover identical committed retry while retaining ETag protection and mismatch refusal.

**Dependencies:** BE-005

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- Lost response then retry returns the original result once; replay cannot duplicate an admission or referral.

**Verification required:**

- Response-loss and duplicate-click/retry tests.

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence. This item remains Partial for the exact higher-level requirement in Remaining_action.

### BE-008 — Stored session deletion and retention

**Disposition:** Partial. **Area:** Privacy. **Effort:** M.

**Remaining action:** Approve retention/expiry/legal-hold/backup policy; validate storage soft-delete/versioning/backups and metadata purge; implement lifecycle and verify recovery/deletion against policy.

**Current local correction/evidence boundary:** Owner-private conditional content erasure/deletion implemented with conflict-safe tombstone semantics.

**Dependencies:** BE-002

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- Owned synthetic records can be deleted and expire as agreed; access is audited; backup handling is specified.

**Verification required:**

- Provider configuration inspection plus safe staging expiry/deletion test.

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence. This item remains Partial for the exact higher-level requirement in Remaining_action.

### BE-009 — Backend request failure diagnostics

**Disposition:** Partial. **Area:** Observability. **Effort:** M.

**Remaining action:** Assign alert owner and verify deployed collection/retention/access and synthetic forced-failure alert route; local logging does not prove hosted observability.

**Current local correction/evidence boundary:** Backend emits correlated allowlisted request/outcome and adapter diagnostics; synthetic failures exercised without payload/token leakage.

**Dependencies:** No additional prerequisite recorded; retain the named scope/authority conditions.

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- Synthetic forced storage/JWKS failures produce a traceable event without tokens, payloads or patient content; owner alert route documented.

**Verification required:**

- Log redaction assertions and Ward-only staging failure/alert evidence.

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence. This item remains Partial for the exact higher-level requirement in Remaining_action.

### CAP-002 — Alert intervention recording

**Disposition:** Requires owner decision. **Area:** Application functionality. **Effort:** M.

**Remaining action:** Resolve exact original owner/takeover/publication holds and approve each missing capability contract/scope; implement agreed events/roles/provenance or formally retain unavailable controls outside pilot scope.

**Current local correction/evidence boundary:** User approved isolated Linux ownership log for parallel task; original Windows candidates/ownership holds and explicit prototype controls preserved. Alert intervention remains truthfully unavailable.

**Dependencies:** BE-005, BE-010

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- In-scope intervention updates linked alert/history with pending/error handling; out-of-scope controls remain clearly unavailable.

**Verification required:**

- Role, repeat-click, refused-action, linked-record and browser tests.

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence.

### CAP-004 — Operational Settings preview controls

**Disposition:** Requires owner decision. **Area:** Clinical / application functionality. **Effort:** L.

**Remaining action:** Resolve exact original owner/takeover/publication holds and approve each missing capability contract/scope; implement agreed events/roles/provenance or formally retain unavailable controls outside pilot scope.

**Current local correction/evidence boundary:** User approved isolated Linux ownership log for parallel task; original Windows candidates/ownership holds and explicit prototype controls preserved. Alert intervention remains truthfully unavailable.

**Dependencies:** BE-003, BE-005

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- Every approved setting has authoritative read/write behaviour and role guards; preview-only controls clearly excluded; no false saved defaults.

**Verification required:**

- Setting→actual workflow behavior tests, invalid change, revoked permission and multi-user propagation.

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence.

### CAP-005 — WA Health pathways / directories / PAS / HMDC

**Disposition:** Unverified external. **Area:** Integration. **Effort:** XL.

**Remaining action:** Verify exact Ward client/device configuration and operational reference/integration owners, approval/version/API boundaries; execute named synthetic acceptance only in authorised environment.

**Current local correction/evidence boundary:** Native cloud devices/agent activation and external PAS/HMDC/reference/bookings capabilities remain inaccessible/unverified. Static reference records do not prove integration.

**Dependencies:** GOV-002, GOV-003

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- Each required feed/pathway has approved contract, service ownership, test and failure fallback; optional integrations explicitly deferred.

**Verification required:**

- Approved reference validation, connector sandbox tests and manual fallback rehearsal.

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence.

### CAP-006 — Unwired global export / notification / admin surfaces

**Disposition:** Requires owner decision. **Area:** Application functionality. **Effort:** L.

**Remaining action:** Resolve exact original owner/takeover/publication holds and approve each missing capability contract/scope; implement agreed events/roles/provenance or formally retain unavailable controls outside pilot scope.

**Current local correction/evidence boundary:** User approved isolated Linux ownership log for parallel task; original Windows candidates/ownership holds and explicit prototype controls preserved. Alert intervention remains truthfully unavailable.

**Dependencies:** No additional prerequisite recorded; retain the named scope/authority conditions.

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- Per-control disposition and owner approval; implemented actions have actual records/downloads/feedback, excluded actions cannot falsely claim completion.

**Verification required:**

- Per-control interaction, output provenance, privacy, errors and permission tests.

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence.

### DEV-002 — Canonical blocked Notion work / owner recovery

**Disposition:** Requires owner decision. **Area:** Task governance. **Effort:** S.

**Remaining action:** Resolve exact original owner/takeover/publication holds and approve each missing capability contract/scope; implement agreed events/roles/provenance or formally retain unavailable controls outside pilot scope.

**Current local correction/evidence boundary:** User approved isolated Linux ownership log for parallel task; original Windows candidates/ownership holds and explicit prototype controls preserved. Alert intervention remains truthfully unavailable.

**Dependencies:** No additional prerequisite recorded; retain the named scope/authority conditions.

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- Every blocked item has owner-approved retain/close/rebase decision and current evidence; no historical approval silently reused.

**Verification required:**

- Canonical tracker review with attributable records; external updates only separately authorised.

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence.

### DEV-003 — Native coding agents / remote device readiness

**Disposition:** Unverified external. **Area:** Development tooling. **Effort:** M.

**Remaining action:** Verify exact Ward client/device configuration and operational reference/integration owners, approval/version/API boundaries; execute named synthetic acceptance only in authorised environment.

**Current local correction/evidence boundary:** Native cloud devices/agent activation and external PAS/HMDC/reference/bookings capabilities remain inaccessible/unverified. Static reference records do not prove integration.

**Dependencies:** No additional prerequisite recorded; retain the named scope/authority conditions.

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- Each intended agent starts Ward-only owned branch, verifies source/server identity and applicable instructions; no shared install/source collision.

**Verification required:**

- Device-local dry run and recorded versions/checks, no access to unrelated projects.

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence.

### DEV-004 — Historical registers and exhaustive semantic verification

**Disposition:** Partial. **Area:** Audit / task governance. **Effort:** XL.

**Remaining action:** Finish exact scenario/mutation/visual verification for each explicitly uncertain substantive historical claim; use frozen current evidence and sibling/type/DOM guards, add confirmed residuals with ownership preserved. An explicit disposition is not proof every historical claim was resolved.

**Current local correction/evidence boundary:** Every1264 original historical candidate now has an explicit distinct disposition in the combined historical reconciliation; manifests/headings/method context are separated from substantive claims. Exact rechecks exposed search, settings-history and graph-coverage findings retained in the master.

**Dependencies:** NEW-SETTINGS-001, NEW-QA-001

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- Every historical candidate has current pinned evidence and resolved/superseded/confirmed/not-applicable decision; confirmed residuals added to master.

**Verification required:**

- File-by-file semantic review, targeted scenarios/mutations and reconciliation validator.

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence. This item remains Partial for the exact higher-level requirement in Remaining_action.

### DOC-003 — Screen verification provenance

**Disposition:** Partial. **Area:** Documentation / QA. **Effort:** S.

**Remaining action:** Complete fresh verification of the remaining screen/state/viewport/theme combinations in the34screen matrix. Preserve actual revisions/dirty inputs and distinct scoped evidence; broad WCAG/assistive-technology/Firefox/WebKit acceptance remains QA-002.

**Current local correction/evidence boundary:** Optional broad render-input fingerprinting and scoped current browser proof are recorded. The maintained JSON preserves34historical verified records, adds current scope to5mapped screens and2supplementary route checks, and distinguishes folder hashes from all-input fingerprints. Current merged scoped Chromium proof passed; no historical provenance backfill or34screen/WCAG claim.

**Dependencies:** No additional prerequisite recorded; retain the named scope/authority conditions.

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- Release screen matrix states current/stale/unverified plainly; screenshots and browser tests match recorded commit.

**Verification required:**

- Generator contract tests and visual evidence review against accepted app.

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence. This item remains Partial for the exact higher-level requirement in Remaining_action.

### NEW-OBSERVABILITY-001 — Next request error instrumentation

**Disposition:** Partial. **Area:** Infrastructure. **Effort:** M.

**Remaining action:** Complete sink/alert/retention ownership through OPS002 and verify exact deployed synthetic signal after configuration; source registration alone does not prove hosted delivery.

**Current local correction/evidence boundary:** Root adds onRequestError handler with incident UUID and allowlisted labels; focused11/11 metadata/failure-isolation tests pass. Coherent source registration/docs commit3c30811 integrated.

**Dependencies:** OPS-002

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- No error/token/body/route/clinical fields exported; failures isolated; deployed synthetic alert reaches owner when commissioned.

**Verification required:**

- Focused regression plus final integrated verification; no hosted/clinical claim

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence. This item remains Partial for the exact higher-level requirement in Remaining_action.

### OPS-002 — End-to-end error monitoring

**Disposition:** Partial. **Area:** Observability. **Effort:** M.

**Remaining action:** Choose privacy-reviewed Ward sink, retention/residency/access/sampling/quotas and alert owner, then test deployed ingestion plus acknowledged alert. No Sentry absence inferred from connector unavailability.

**Current local correction/evidence boundary:** Root request-error instrumentation emits privacy-bounded metadata/incident IDs; backend diagnostics are implemented. Focused instrumentation11/11 passes. No SDK/vendor sink configured. Coherent root local instrumentation/docs commit3c30811 now integrated.

**Dependencies:** BE-009

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- Controlled synthetic failure reaches scrubbed monitoring and owner within target; no clinical payload/browser recording.

**Verification required:**

- Fault injection locally/staging, scrub tests, alert acknowledgement drill.

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence. This item remains Partial for the exact higher-level requirement in Remaining_action.

### OPS-004 — Release rollback / incident response

**Disposition:** Unverified external. **Area:** Operations. **Effort:** M.

**Remaining action:** Perform exact Ward-only provider checks and configuration/restore/rollback/security drills in original criteria after access/authority; do not classify inaccessible services as absent or healthy hosting as end-to-end proof.

**Current local correction/evidence boundary:** Original audit identifies existing provider evidence and explicitly inaccessible configuration; no provider mutation performed.

**Dependencies:** BE-002, OPS-001

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- Synthetic incident and rollback preserve integrity, communicate downtime and meet agreed targets.

**Verification required:**

- Staging rollback drill, replay/reconciliation and escalation tabletop.

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence.

### OPS-005 — Capacity limits and edge abuse controls

**Disposition:** Unverified external. **Area:** Infrastructure / security. **Effort:** M.

**Remaining action:** Perform exact Ward-only provider checks and configuration/restore/rollback/security drills in original criteria after access/authority; do not classify inaccessible services as absent or healthy hosting as end-to-end proof.

**Current local correction/evidence boundary:** Original audit identifies existing provider evidence and explicitly inaccessible configuration; no provider mutation performed.

**Dependencies:** BE-011, BE-006

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- Expected concurrent synthetic staff load stays responsive; excessive requests return safe bounded response and cost alerts fire.

**Verification required:**

- Nonintrusive authorised staging load tests and configuration inspection.

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence.

### QA-002 — Ward browser compatibility and accessibility acceptance

**Disposition:** Partial. **Area:** QA / accessibility. **Effort:** L.

**Remaining action:** Install/run Firefox/WebKit where download access is available (current CDN403); complete supported browser/assistive technology/zoom/dialog/error acceptance. Do not claim whole-app WCAG compliance from seven geometry tests.

**Current local correction/evidence boundary:** Dedicated Ward Firefox/WebKit configuration and runner wiring added. Actual Chromium phone320/390/tablet768 geometry/keyboard tests7/7 pass, with precise source/browser provenance.

**Dependencies:** No additional prerequisite recorded; retain the named scope/authority conditions.

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- Critical tasks complete with no inaccessible action, missing focus, misleading announcements or document overflow at supported sizes.

**Verification required:**

- Cross-browser synthetic E2E, automated accessibility plus manual keyboard/screen-reader checks.

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence. This item remains Partial for the exact higher-level requirement in Remaining_action.

### QA-003 — Representative performance and large-state limits

**Disposition:** Partial. **Area:** QA / performance. **Effort:** M.

**Remaining action:** Implement actual approved shared backend first; execute all ten authenticated conflict/retry/revoke/reconnect scenarios and synthetic representative load/capacity limits on target environment.

**Current local correction/evidence boundary:** New domain/HTTP/client/browser regressions improve local correctness. They do not establish shared-user concurrency or representative operating load.

**Dependencies:** BE-002, BE-005, OPS-001

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- Documented dataset/user limits, timings and recovery meet agreed targets; oversized update leaves prior valid state.

**Verification required:**

- Local profiling and authorised isolated staging load/size boundary tests.

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence. This item remains Partial for the exact higher-level requirement in Remaining_action.

### QA-004 — Host JWT / security contract verification

**Disposition:** Unverified external. **Area:** QA / security. **Effort:** M.

**Remaining action:** Perform exact Ward-only provider checks and configuration/restore/rollback/security drills in original criteria after access/authority; do not classify inaccessible services as absent or healthy hosting as end-to-end proof.

**Current local correction/evidence boundary:** Original audit identifies existing provider evidence and explicitly inaccessible configuration; no provider mutation performed.

**Dependencies:** BE-011, BE-001, BE-003

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- All invalid token classes denied; approved identity works only in scope; production CSP/cache/CORS headers verified; no token logged.

**Verification required:**

- Local test JWKS fixture, synthetic staging accounts and passive response-header capture.

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence.

### RT-008 — Discharge status accessibility

**Disposition:** Partial. **Area:** Frontend. **Effort:** S.

**Remaining action:** Verify blocked-to-unblocked and reverse with unchanged total using target screen reader and keyboard; record assistive technology/version and focus evidence.

**Current local correction/evidence boundary:** Separate polite pipeline state summary and DOM checks added; existing shown-count announcement retained.

**Dependencies:** No additional prerequisite recorded; retain the named scope/authority conditions.

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- Blocked→unblocked and reverse with unchanged shown total yield appropriate announcement and preserve focus.

**Verification required:**

- Screen reader or live-region DOM change check plus browser keyboard interaction.

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence. This item remains Partial for the exact higher-level requirement in Remaining_action.

### SEC-003 — ESLint glob / braces dependency chain

**Disposition:** Partial. **Area:** Security. **Effort:** S.

**Remaining action:** Review supported upstream patch by22Oct2026 or immediately on release/config/input changes; install/test when available. Owner accepts any broader tooling risk. No unsafe Next14 downgrade.

**Current local correction/evidence boundary:** Actual development-only glob reachability assessed; bounded exception retains supported Next16 and literal lint roots. Five audit package entries correspond to one open braces advisory.

**Dependencies:** No additional prerequisite recorded; retain the named scope/authority conditions.

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- Supported fix removes advisory or dated exception documents exposure, mitigation, owner and recheck date.

**Verification required:**

- npm explain braces, targeted lint glob tests and dependency review.

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence. This item remains Partial for the exact higher-level requirement in Remaining_action.

### SPEC-005 — Queue ordering policy reconciliation

**Disposition:** Requires owner decision. **Area:** Frontend/domain. **Effort:** S.

**Remaining action:** Owner must explicitly name ordering for Referral and Patient/Movement tabs and tie-breaks; then change comparator/captions/tests only within that decision.

**Current local correction/evidence boundary:** Existing referral FIFO and movement urgency-first semantics preserved.

**Existing task/decision:** WF-32 / D-32 versus historical item37

**Dependencies:** Owner policy scope decision

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- Current decision names ordering for Referral and Patient/Movement tabs separately.
- Queue captions, comparator and tests assert same scope and tie-break behavior.

**Verification required:**

- Mixed-age/mixed-tier/mixed-flag fixture for both queues; user-visible sort captions.

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence.

### SPEC-007 — Community clinician allocation

**Disposition:** Partial. **Area:** Frontend/community. **Effort:** M.

**Remaining action:** Approve and implement referral-level clinician identity/assignment and recorded review outcome/history/permissions. Demonstration care-directory appointment assignment is not referral assignment.

**Current local correction/evidence boundary:** Misleading clinician/caseload selector removed; acceptance clearly records team decision only. Review opens actual dossier. Unsupported assignment remains expressly disclosed.

**Dependencies:** No additional prerequisite recorded; retain the named scope/authority conditions.

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- UI never claims clinician allocation unless record contains selected staff identity and audit.
- Chosen synthetic clinician survives navigation/reload under applicable persistence mode; concurrent version checked when shared backend introduced.

**Verification required:**

- Choose different clinician, accept, inspect model/audit; stale record and invalid staff assignment cases.

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence. This item remains Partial for the exact higher-level requirement in Remaining_action.

### SPEC-012 — Community review/assignment capabilities

**Disposition:** Partial. **Area:** Frontend/community. **Effort:** L.

**Remaining action:** Approve and implement referral-level clinician identity/assignment and recorded review outcome/history/permissions. Demonstration care-directory appointment assignment is not referral assignment.

**Current local correction/evidence boundary:** Misleading clinician/caseload selector removed; acceptance clearly records team decision only. Review opens actual dossier. Unsupported assignment remains expressly disclosed.

**Existing task/decision:** Historical community Review/Assign lead; freshly confirmed still deliberately unwired

**Dependencies:** No additional prerequisite recorded; retain the named scope/authority conditions.

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- Approved review records reviewer/time/outcome; assignment records responsible service/staff.
- UI updates worklist/counts from authoritative state and preserves history.
- Unsupported demonstration remains visibly disclosed.

**Verification required:**

- Workflow review → assignment → follow-up, cancellation, denied service access and concurrency once shared.

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence. This item remains Partial for the exact higher-level requirement in Remaining_action.


## P3 — remaining tasks

### OPT-001 — Review approvals for higher-risk releases

**Disposition:** Deferred optional. **Area:** Repository governance. **Effort:** S.

**Remaining action:** Consider required human reviewer approvals at the appropriate release stage with repository-owner approval; not a blocker to synthetic local development.

**Current local correction/evidence boundary:** Ruleset checks/thread resolution remain intact; no external access/governance change performed.

**Dependencies:** No additional prerequisite recorded; retain the named scope/authority conditions.

**Original acceptance criteria (retain the completed parts; finish the remaining scope above):**

- Approved governance policy enforced with a test PR; authorised emergency route documented.

**Verification required:**

- Ruleset readback and nonmerging test PR in separately authorised work.

**Verification boundary:** Local remediation gates completed for the documented source scopes: full suite3d01bf9; merged8682118 changed-scope325tests, whole lint, all-route production build with normal TypeScript,12selected Chromium checks and10Settings steps. Final documentation6files77tests and scoped commit guards passed atb31c78b. Original acceptance for live/shared/clinical or broader accessibility remains separate; skipped tests are not passing evidence.

## Related records

- [Local remediation receipt](remediation-2026-10-08.md).
- [Current roadmap](../roadmap.md).
- [Production-readiness requirements](../governance/PRODUCTION-READINESS.md).

The original full 93-item register and local evidence archive remain available in the audit handoff; this repository document carries every remaining ID and its exact remaining action. It creates no GitHub issues and changes no external task ownership.
