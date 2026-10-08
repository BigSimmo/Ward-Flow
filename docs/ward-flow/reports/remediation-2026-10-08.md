# Ward Flow audit remediation — 8 October 2026

Task identity: `Ward-Flow-audit-remediation-20261008`. Source baseline: dedicated
`BigSimmo/Ward-Flow` main `e7b7f325346ea7abb5004bd2e60e63f64f5c9f95` (PR #121).
Scope: authorised local fixes, parallel isolated worktrees and verification.
No push, GitHub task edits, merge, provider changes or deployment are included.

The original audit preserves 79 stable task IDs. Its complete local artefacts are
in `/workspace/ward-flow-audit/2026-10-08`; remediation status/evidence is in
`/workspace/ward-flow-remediation-output`. A local path is not a hosted record or
external approval. Final statuses require integrated source and actual tests.

## Parallel scope

| Owner group      | Audit tasks                                        | Scope                                                                               |
| ---------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Domain           | SPEC-001, SPEC-013, D2-CURRENT-001–002             | Deterioration, held-arrival links, preparation/count integrity, restore             |
| Community        | SPEC-006–012                                       | Source-backed dossiers, outcome-checked actions, shared care-journey reuse          |
| Workflows        | SPEC-002–003, RT-002–008, CAP-001–003              | Lifecycle headlines, discharge controls, truthful routing and placement review      |
| Responsive       | UI-001–006, QA-002                                 | Mobile containment, keyboard tables and bounded browser checks                      |
| Tooling          | STD-001, SPEC-014, RT-001, SEC-001–004, CI-001–003 | Tokens, map IDs, secret redaction, dependencies and CI                              |
| Backend          | BE-006–009, BE-012                                 | Envelopes, conditional retries/deletion, diagnostics and fetch bounds               |
| Integration/docs | DOC-001–004, DOC-STD-001                           | Current claims, form terminology, governance boundaries and verification provenance |

Agents claim exact files in the user-approved Linux log. Windows branches,
unpublished candidates and original task-owner holds are retained.

## Evidence boundary and remaining work

Audit baseline: 916 files / 10,688 tests passed; backend mocks: 24 passed.
Those results do not prove changed code. Fresh integrated checks are recorded
below when complete. Source/mock tests do not prove deployed JWT, CORS, storage,
backup, monitoring or multi-user acceptance.

The [production-readiness register](../governance/PRODUCTION-READINESS.md) records
remaining shared-backend, provider and qualified approval decisions. Explicitly
unavailable features remain visible until their contracts are implemented.
The unpatched development dependency `braces` needs a supported upstream fix or
bounded exception, never an unsafe Next downgrade. Historical claims require
fresh semantic checks before closure.
