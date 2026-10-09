# Ward Flow production-readiness register

Updated 8 October 2026 against audited main `e7b7f325346ea7abb5004bd2e60e63f64f5c9f95`.
This is an evidence and acceptance register, not approval. The owner-approved
synthetic prototype remains independent from real-patient readiness (D-36).

| Area / audit IDs                              | Current evidence                                                                            | Exact remaining decision or verification                                                                                                      | Acceptance evidence                                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Intended purpose / GOV-001                    | Internal D-37 position; operational coordination plus clinical-status/timer functions       | Qualified assessor reviews every function, claims and intended users against current TGA instruments                                          | Signed determination with source versions, scope and exclusion/exemption/device obligations               |
| Clinical safety / GOV-003                     | Draft safety case and synthetic invariant tests                                             | Appoint accountable clinical safety owner; review hazards, residual risk and downtime process                                                 | Owned hazard log, verified mitigations, acceptance and controlled-pilot conditions                        |
| Privacy / GOV-002                             | Synthetic-only operation; D-18 browser-persistence guard                                    | Named custodian conducts PIA, processor/residency/retention/access/logging review under current WA PRIS and mandatory Health policies         | Institutional acceptance covering every data flow, processor, retention, disclosure and incident duty     |
| Forms / DOC-001, CAP-005                      | Corrected draft forms pack; D-29 labelled advisory periods                                  | Qualified WA legal/clinical review of names, periods, rights, gazettal and correction semantics                                               | Signed scoped review, approved reference sources/versions and negative workflow tests                     |
| Cultural safety / GOV-003                     | Draft charter; independent engagement parked                                                | Owner commissions appropriate independent review                                                                                              | Review, agreed changes, verification and accountable acceptance                                           |
| Reference data / CAP-005                      | Demonstration catchments/directory; operational-use approvals false                         | Verify contacts, catchments, capacity, gazettal, escalation and external PAS/HMDC workflows with source owners                                | Approved/versioned data, update ownership, tested failures and acknowledgements                           |
| Trusted shared operation / BE-001–005, BE-010 | Role simulation and disconnected private snapshots                                          | Approve synthetic workspace/service membership authority; implement staff identity, trusted commands, roles, peer freshness and actor history | Two-user, conflict, retry, reconnect, cross-service denial and revocation through configured auth/storage |
| Retention / BE-008                            | No approved automatic retention policy                                                      | Determine retention by record type, legal holds, deletion and backup-copy handling                                                            | Approved policy and measured deletion/retention checks; no arbitrary expiry                               |
| Recovery / OPS-003–004                        | Backup/restore and coordinated rollback not directly verified                               | Confirm named Ward backup/restore facilities, recovery targets, data/app compatibility and support owners                                     | Synthetic restore drill, rollback rehearsal, measured recovery and incident exercise                      |
| Infrastructure / BE-011, OPS-001–002, OPS-005 | Named Ward Railway frontend verified at audit baseline; Azure, Sentry and limits unverified | Verify exact resources, staging isolation, config names, JWT/CORS, TLS, alert destinations, quotas and budgets                                | Redacted runtime/deployment evidence and owned test alert; no secret values                               |
| Pilot / QA-001–004                            | Local/CI checks, not clinical acceptance                                                    | Agree accounts, phase boundaries, browser/load limits, training, supervision and stop conditions                                              | Scoped acceptance, user training, support owners and institutional authority                              |

## Authoritative sources checked in the audit

- [WA OIC PRIS commencement](https://www.wa.gov.au/organisation/office-of-the-information-commissioner/what-parts-of-the-pris-act-have-commenced): privacy obligations commenced **1 July 2026**; the notifiable information-breach scheme is scheduled **1 January 2027**. Recheck commencement and applicability before use.
- [WA Health MP0194/26 Privacy and Responsible Information Sharing](https://www.health.wa.gov.au/About-us/Policy-frameworks/Information-Management/Mandatory-requirements/Governance/Privacy-and-Responsible-Information-Sharing-Policy) and applicable Information Security policy **MP0067/17**. Australian hosting alone does not establish compliance.
- [TGA software exclusions](https://www.tga.gov.au/products/medical-devices/software-and-artificial-intelligence-ai/overview/software-based-medical-device-exclusions), [health-facility management Item 14G](https://www.tga.gov.au/resources/guidance/understanding-health-facility-management-software-exclusion), and [CDSS guidance](https://www.tga.gov.au/resources/guidance/understanding-clinical-decision-support-system-software-regulation). Bed/admissions/workflow functions may be excluded where the intended purpose satisfies the instrument; assess all functions. Exempt CDSS remains a regulated device with applicable notification, Essential Principles and reporting duties. Exclusion and exemption are different.
- [Official WA forms](https://www.chiefpsychiatrist.wa.gov.au/laws-and-rights/legislation/mental-health-act-2014-forms) and [current Act](https://www.legislation.wa.gov.au/legislation/statutes.nsf/main_mrtitle_13534_homepage.html).

This local documentation update did not obtain external approval or perform new
live provider tests. Recheck source versions when making an implementation decision.

## Three separate release conditions

**Reliable active development:** clean exact-lock setup, confirmed defects fixed,
truthful controls, useful regressions and green checks on the integrated tree.

**Authenticated shared synthetic pilot:** development conditions plus verified
identity, service authority, atomic shared state, revision/conflict/reconnect
behaviour, environment isolation and owned recovery/monitoring.

**Real-patient deployment:** shared-pilot conditions plus scoped institutional,
clinical, privacy, legal, cultural and regulatory acceptance above. An AI review
or an internally adopted standard does not supply that acceptance.
