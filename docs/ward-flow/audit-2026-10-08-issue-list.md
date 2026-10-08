# Ward Flow issue list — 8 October 2026

Every bug and issue found in the core-engine review and the four follow-up area reviews, ranked. Synthetic data only; nothing here has been fixed. Details, scenarios and evidence for each ID are in [`audit-2026-10-08-core-engine-review.md`](audit-2026-10-08-core-engine-review.md).

**88 issues:** P1 13, P2 28, P3 31, P4 16. S2-12 is merged into A2-2.

**Evidence levels.** _Reproduced_: replayed against the real reducer (slices 1–2 by the verification file; area items by the area reviewer). _Script-confirmed_: checked by running the code. _Code-confirmed_: plainly visible in the code. _Unverified_: found by one reviewer reading the code, not yet checked. Reproduced: 28; Script-confirmed: 7; Code-confirmed: 7; Unverified: 46.

**ID prefixes.** S1/S2: core-engine slices 1 and 2. A1: who may do what. A2: saving and loading state. A3: what the screens show. A4: security plumbing.

## P1 — fix first: breaks patient flow, safety-relevant state, or lets one ward act for another

| ID    | Issue                                                                                      | Evidence         | Where                                          |
| ----- | ------------------------------------------------------------------------------------------ | ---------------- | ---------------------------------------------- |
| S1-1  | Discharge recorded mid-transfer strands the patient; arrival at the new ward is refused    | Reproduced       | `ward-flow-reducer.ts:1878`                    |
| S2-1  | Stopped or diverted seeded journeys can never release their bed                            | Reproduced       | `ward-flow-reducer.ts:8120, 8006`              |
| S2-2  | Clearing the blocker text lifts the revoked-examination hold; the patient can be collected | Reproduced       | `ward-flow-reducer.ts:4675`                    |
| S1-2  | Bed pull checks one patient for an existing bed but admits another (double bed)            | Code-confirmed   | `ward-flow-reducer.ts:2320, 4304`              |
| A1-1  | Any ward can accept and pull a bed on another ward's behalf                                | Reproduced       | `ward-flow-events.ts:2112; reducer 3529, 3858` |
| A1-3  | Any ward can decline or waitlist on another ward's behalf                                  | Reproduced       | `ward-flow-events.ts:2117; reducer 4369`       |
| S2-11 | Ward callers can accept or decline referrals for any ward                                  | Code-confirmed   | `ward-flow-reducer.ts:6354`                    |
| A1-2  | Any ward or community caller can withdraw an ED's referral, recorded as the referrer       | Reproduced       | `ward-flow-events.ts:2328`                     |
| A1-5  | Ward or community can shorten a legal form expiry, with no audit                           | Reproduced       | `ward-flow-events.ts:2480`                     |
| A2-1  | Saving a scenario always fails after any referral sent through the drawer                  | Script-confirmed | `ward-flow-storage-validation.ts:89`           |
| A2-2  | Free text can reach browser storage as a discharge barrier and reloads (also S2-12)        | Script-confirmed | `ward-flow-reducer.ts:8483`                    |
| A4-3  | Backend stores any payload labelled synthetic; no server-side identifier check             | Unverified       | `backend/ward-flow/server.mjs:141`             |
| A4-5  | Mockup routes are public in production; their admin gate was removed                       | Unverified       | `src/proxy.ts:137`                             |

## P2 — wrong records, missed notices, misleading screens

| ID    | Issue                                                                                   | Evidence         | Where                                         |
| ----- | --------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------- |
| S2-3  | Arrival into a full ward is uncounted; the next discharge shows a phantom free bed      | Reproduced       | `ward-flow-reducer.ts:4861`                   |
| S1-4  | Withdrawing a referral cancels transport without telling the officer; wards not told    | Reproduced       | `ward-flow-reducer.ts:3744, 3782`             |
| S2-4  | Referrer-withdrawal cascade sends no notices and leaves wards listed                    | Code-confirmed   | `ward-flow-reducer.ts:7135`                   |
| S1-5  | Revoked-exam closure leaves wards listed as referred; can claim a bed was released      | Reproduced       | `ward-flow-reducer.ts:3265`                   |
| S2-7  | Release-and-reopen from accepted-awaiting-bed reports a bed release that never happened | Reproduced       | `ward-flow-reducer.ts:8810`                   |
| S2-10 | Any ward can book (and later cancel) transport for any movement                         | Reproduced       | `ward-flow-reducer.ts:7523`                   |
| A1-10 | Any ward can record 'no transport needed', allowing arrival without transport           | Unverified       | `ward-flow-events.ts:2082`                    |
| A1-8  | Any of four roles can set arrival details and cancel another ward's bed hold            | Unverified       | `ward-flow-events.ts:2475`                    |
| A1-9  | Non-ED roles can mark the medical workup done                                           | Reproduced       | `ward-flow-events.ts:2478`                    |
| A1-15 | Coordinator cockpit records its decisions as 'Ward manager'                             | Unverified       | `patients/patient-transit-operations.tsx:169` |
| A1-6  | Audit rows for walk-in journeys lose the patient                                        | Reproduced       | `ward-audit.ts:289`                           |
| A1-4  | Legal form continuation code lost from the audit (5B, 3C, 6B, 6C)                       | Reproduced       | `ward-audit.ts:486`                           |
| A2-4  | Null times load from storage and raise false 'legal due time passed' alerts             | Script-confirmed | `ward-flow-storage-validation.ts:86`          |
| A2-5  | Closed-list fields not checked on load; makes type-only bugs reachable                  | Script-confirmed | `ward-flow-storage-validation.ts:336`         |
| A2-3  | More safe-listed events store caller text than the classification admits                | Script-confirmed | `ward-flow-persistence-classification.ts:100` |
| A2-6  | A failed save leaves an older snapshot that reload restores silently                    | Unverified       | `ward-flow-provider.tsx:840`                  |
| A2-7  | 'Clear transient cache' is undone within 30 seconds                                     | Unverified       | `settings/settings-screen.tsx:708`            |
| A3-2  | Handover shows patients in the vehicle as expired pulled beds                           | Unverified       | `ward-derivations.ts:1439`                    |
| A3-10 | Beds held after a stopped transport drop off the handover                               | Unverified       | `ward-derivations.ts:1432`                    |
| A3-3  | 'Nowhere eligible' lists patients who already have a bed                                | Unverified       | `ward-derivations.ts:1545`                    |
| A3-1  | Bed-kind shortfall double-counts pulled patients                                        | Unverified       | `capacity/capacity-derivations.ts:112`        |
| A3-14 | Capacity boxes can add up to more beds than the ward has                                | Unverified       | `capacity/capacity-derivations.ts:346`        |
| A3-5  | Patients with an accepted referral vanish from patient search                           | Unverified       | `ward-derivations.ts:1697`                    |
| A3-8  | Fully withdrawn referrals disappear from the referral board                             | Unverified       | `ward-referrals.ts:665`                       |
| A3-9  | Handover says 'declined by all' when a ward never declined                              | Unverified       | `ward-derivations.ts:1461`                    |
| A4-6  | Page routes ending in an image extension skip CSP and accept spoofed headers            | Unverified       | `src/proxy.ts:152`                            |
| A4-1  | Synthetic-data guard misses common real Australian identifier formats                   | Script-confirmed | `src/lib/synthetic-data-guard.ts:14`          |
| A4-10 | 'Copy diagnostics' can copy patient names and UMRNs                                     | Unverified       | `src/lib/privacy.ts:6`                        |

## P3 — smaller correctness, audit and screen accuracy

| ID    | Issue                                                                          | Evidence       | Where                                  |
| ----- | ------------------------------------------------------------------------------ | -------------- | -------------------------------------- |
| S2-6  | Repatriation can be recorded from an ended stay; it then stalls at the pull    | Reproduced     | `ward-flow-reducer.ts:8967`            |
| S1-3  | Community-team referral drops the patient link for walk-ins                    | Reproduced     | `ward-flow-reducer.ts:2959`            |
| S1-6  | Override recorded against wards that needed none; empty overrides appended     | Reproduced     | `ward-flow-reducer.ts:3472`            |
| S1-7  | Waitlist entries survive acceptance elsewhere; can block a real waitlist       | Reproduced     | `ward-flow-reducer.ts:3601`            |
| S1-8  | Re-pull after a step back keeps the old hold expiry                            | Reproduced     | `ward-flow-reducer.ts:3960`            |
| S2-5  | Arrival details accepted on closed movements; false 'arriving late' notices    | Reproduced     | `ward-flow-reducer.ts:8379`            |
| S2-9  | Security gate means different things on the two eligibility paths              | Code-confirmed | `ward-eligibility.ts:601`              |
| S2-13 | Transfer-out advances the discharge revision twice                             | Reproduced     | `ward-flow-reducer.ts:4937`            |
| S2-14 | Withdraw button offered where the reducer refuses                              | Code-confirmed | `ward-referrals.ts:124`                |
| S2-15 | Alert stand-down recorded against a role that did not act                      | Code-confirmed | `alerts/ward-broadcast-reducer.ts:146` |
| S1-12 | Ward event without a ward id can change another ward's expected discharge      | Reproduced     | `ward-flow-reducer.ts:1992`            |
| S1-14 | ED medical bed release set to 24 hours; owner ruling FD-19 says 48             | Code-confirmed | `ward-model.ts:534`                    |
| A1-7  | A ward's own referral is recorded as from a community team                     | Unverified     | `ward-flow-events.ts:2342`             |
| A1-11 | Legal expiry audit labels first entries as extensions                          | Unverified     | `ward-audit.ts:509`                    |
| A1-12 | Cross-ward refusals audited as 'transition', not 'scope'                       | Unverified     | `ward-flow-reducer.ts:4984`            |
| A1-13 | Any role can acknowledge an alert as any ward or the coordinator desk          | Unverified     | `ward-flow-events.ts:2499`             |
| A1-14 | Either side can add corrections to the other side's referral                   | Unverified     | `ward-flow-events.ts:2430`             |
| A2-8  | Backend returns 503 instead of 409 on racing first saves; test cannot catch it | Unverified     | `backend/ward-flow/database.mjs:224`   |
| A2-10 | 'Since last look' survives reset and scenario load                             | Unverified     | `coordinator/since-last-look.ts:15`    |
| A2-15 | Reload after midnight discards the day with a 'damaged' message                | Unverified     | `ward-flow-provider.tsx:404`           |
| A3-4  | Delays files referable patients under 'No suitable bed'                        | Unverified     | `delays/delays-derivations.ts:254`     |
| A3-6  | Waitlist answers counted as declines                                           | Unverified     | `ward-derivations.ts:1253`             |
| A3-7  | 'Ward silent' measured from the first referral, not each ward's                | Unverified     | `delays/delays-derivations.ts:619`     |
| A3-11 | 'Nothing recorded for N' ignores accept, pull and handover                     | Unverified     | `delays/delays-derivations.ts:358`     |
| A3-12 | Revoked-exam hold routed to Transport, who cannot act                          | Unverified     | `delays/delays-derivations.ts:268`     |
| A3-13 | 'Figures may not have settled' stuck on for non-binary records                 | Unverified     | `capacity/capacity-derivations.ts:384` |
| A3-15 | 'Freeing' uses a different day rule from the rest of the capacity row          | Unverified     | `capacity/capacity-derivations.ts:338` |
| A4-2  | Synthetic-data guard skips identifiers stored as numbers                       | Unverified     | `src/lib/synthetic-data-guard.ts:71`   |
| A4-7  | Root-level public/*.html mockups served and indexable in production            | Unverified     | `src/proxy.ts:126`                     |
| A4-8  | Tenant-wide backend mode accepts guest accounts and any client app             | Unverified     | `backend/ward-flow/auth.mjs:41`        |
| A4-13 | Dev server exposed on the LAN; local check trusts the Host header              | Unverified     | `src/lib/local-project-guard.ts:114`   |

## P4 — defensive gaps, latent code, performance and tidy-up

| ID    | Issue                                                                 | Evidence         | Where                                          |
| ----- | --------------------------------------------------------------------- | ---------------- | ---------------------------------------------- |
| S1-9  | Off-list examination outcome treated as revocation (type-only)        | Reproduced       | `ward-flow-reducer.ts:3155`                    |
| S1-10 | Off-list ED outcome accepted (type-only)                              | Reproduced       | `ward-flow-reducer.ts:2573`                    |
| S1-11 | Duplicate ward ids accepted in a referral (type-only)                 | Reproduced       | `ward-flow-reducer.ts:3317`                    |
| S1-13 | Referral fields not checked against their lists (type-only)           | Reproduced       | `ward-flow-reducer.ts:2343`                    |
| S2-8  | Off-list step-back target crashes later dispatches (type-only)        | Reproduced       | `ward-flow-reducer.ts:8183`                    |
| A2-9  | Cloud vault bypasses all save/load protections (not yet wired)        | Unverified       | `src/lib/cloud-scenario-vault.ts:22`           |
| A4-4  | Synthetic-data guard is not called anywhere live                      | Unverified       | `src/lib/synthetic-data-guard.ts:56`           |
| A4-9  | Logger redaction misses Ward Flow identifiers (logger unused)         | Script-confirmed | `src/lib/logger.ts:19`                         |
| A4-11 | Log context can overwrite level and message (logger unused)           | Unverified       | `src/lib/logger.ts:84`                         |
| A4-12 | CSRF guard allows header-less mutations; no mutation routes exist yet | Unverified       | `src/lib/api-csrf.ts:111`                      |
| A4-14 | Digest route relies on the proxy alone in production                  | Unverified       | `src/app/mockups/ward-flow-digest/route.ts:14` |
| A2-11 | Whole world written to storage every 30 seconds with no change        | Unverified       | `ward-flow-provider.tsx:829`                   |
| A2-12 | New BroadcastChannel per dispatch re-renders every other tab          | Unverified       | `ward-flow-provider.tsx:674`                   |
| A2-13 | Validator re-types lists that exist as constants; will drift          | Unverified       | `ward-flow-storage-validation.ts:535`          |
| A2-14 | Unused WardFlowClockProvider computes a different time                | Unverified       | `ward-flow-provider.tsx:1013`                  |
| A4-15 | Stale PsychSift security plumbing and fail-open webhook exemption     | Unverified       | `src/lib/privacy.ts:1`                         |

## Patterns

- **Ward scoping is missing across many events** (A1-1, A1-3, A1-8, A1-10, A1-13, S1-12, S2-10, S2-11). One shared check — the acting ward must be the target ward — would close most of P1's permission items together.
- **Closures don't tidy up after themselves** (S1-4, S1-5, S2-4, S2-7, A3-9, A3-10). Several close paths skip the notices and list-clearing the others do; a single shared close helper would fix them consistently.
- **Seeded journeys without an admission record fall through** (S2-1, S2-2, A3-10). Release and hold logic assumes `admissionId` exists.
- **Stored and imported state is trusted** (A2-4, A2-5, A2-3, A2-2). Tightening the load validator makes the P4 type-only items unreachable.
- **The synthetic-data guard is advisory only** (A4-1 to A4-4, A4-9, A4-10). Matters before any shared or cloud save is switched on.
