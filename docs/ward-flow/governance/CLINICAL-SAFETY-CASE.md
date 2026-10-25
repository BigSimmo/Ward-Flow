# Ward Flow: Clinical Safety Case & Hazard Log (DCB0129 Standard)

**Document Version:** 1.1.0 (draft)  
**Status:** DRAFT / PROTOTYPE GOVERNANCE BASELINE. Not signed. No clinical review held.  
**Clinical Scope:** Western Australian Public Mental Health Services Bed-Coordination Demonstration Prototype  
**Synthetic Isolation Guarantee:** Synthetic records only (0 real patients, 0 production EHR connections)

> [!NOTE]
> **Prototype Operating Mode (`AGENTS.md`, 3 October 2026):** Ward Flow executes exclusively on **100% synthetic data** with zero live EHR connections and zero real patient information. This Clinical Safety Case serves as presentation reference material for WA Health stakeholders alongside automated legal-language (`scripts/ward-flow/check-ward-legal-language.mjs`) and synthetic-data (`scripts/ward-flow/check-clinical-governance-gate.mjs`) verification gates, rather than a live clinical deployment sign-off.

_Updated 2026-10-24 - merged the 24 Oct shared-folder safety case and hazard log drafts; this repository copy is canonical (Josh, 24 Oct 2026); Documentation owns._

_Updated 2026-10-24 - HAZ-05 control (c) now describes the D-72 scrubbed device copy; Documentation owns. No clinical review, residual-risk acceptance or sign-off refreshed._

_Updated 2026-10-23 - HAZ-03 now records the CAD number plausibility check (#430), applied to repatriation logs too, awaiting owner re-rating; Documentation owns._

> [!IMPORTANT]
> **What the 24 October merge is, and is not.** Sections 2 to 4 and 6 to 11 come from an AI-prepared draft written on 24 October 2026 from the code and the audit reports. It follows the structure of the NHS England standard **DCB0129** (clinical risk management for manufacturers of health IT). DCB0129 is not mandated in Western Australia. It is used here as a recognised template. Every rating is a **drafter's proposal**, rated for use with **real patients**. No clinician has reviewed any rating. No clinical safety owner has been named. Nothing in this document says Ward Flow is safe for clinical use. The sign-off table in section 12 is blank on purpose, and under the Prototype Operating Mode no simulated sign-off may be added.

---

## 1. Executive Summary & Clinical Intent

Ward Flow is a specialized operational bed-coordination and patient flow prototype designed for Western Australian mental health services (encompassing inpatient mental health units, emergency department mental health liaison teams, and community mental health teams).

The primary clinical purpose of the tool is to provide transparent, real-time visibility over:

- Bed capacity across authorized and non-authorized mental health units.
- Patient transfers and referrals between emergency departments and inpatient wards.
- Mental Health Act 2014 form details and expiry times that a clinician has typed from the paper form. Ward Flow never computes a legal period or expiry (D-70).
- Transport coordination logistics for voluntary and involuntary mental health patients.

Because errors in psychiatric bed coordination can result in severe clinical, ethical, and legal harms—including delayed acute care, unauthorized detention, inappropriate gender placement, or heightened risk of self-harm in ED waiting areas—this Clinical Safety Case establishes a formal risk management framework modeled on the **DCB0129 (Clinical Risk Management: Its Application in the Deployment of Health IT Systems)** standard.

### 1.1 Current position (drafter's view, 24 October 2026)

1. Ward Flow is an **operational coordination tool**. It does not diagnose, treat, score or recommend. Its main safety risks are **information hazards**: the wrong patient, a wrong or stale fact shown as current, an action that cannot be undone, or a change lost.
2. The hazard log in section 7 holds **24 hazards** (H-01 to H-24). The five baseline hazards in section 6 (HAZ-01 to HAZ-05) map into it. Most findings from the 20 October clinical safety audit were reported fixed and pinned by tests. That was not re-verified for this document.
3. **Open, in the drafter's view:**
   - **2 hazards rated high (risk 4):** H-01, wrong patient on the ward bed board (B-01, B-02, P1, fixes in progress, not verified here); and H-08, a change made from an inline panel can overwrite another desk's newer change (rerun finding D-03).
   - **13 hazards rated medium (risk 3).** Eight need software fixes or owner decisions (H-04, H-05, H-06, H-07, H-10, H-17, H-20, H-23). Five depend mostly on processes outside the software (H-12, H-13, H-14, H-18, H-19).
4. **Drafter's recommendation:** acceptable for a **synthetic** pilot and clinician trial. **Not acceptable for real patients** until the risk-4 hazards are closed and verified, the open risk-3 hazards are closed or formally accepted, and the conditions in section 10 are met. This is a recommendation only. Acceptance belongs to the clinical safety owner and the deploying health service.

---

## 2. Scope and intended use

### 2.1 Intended purpose

To give clinicians and coordinators a shared, current view of mental health bed capacity, ED waits, referrals, ward answers, transport and typed Mental Health Act form details, so that **people** can decide placements faster and with fewer phone calls.

### 2.2 Intended users and setting

Bed coordinators, bed managers, ward nurses in charge, ED mental health liaison, community mental health teams, transport officers and executives (counts only), in WA public mental health services. Used on ward PCs, phones and a bed meeting TV.

### 2.3 Out of scope: what Ward Flow deliberately does not do

Ward Flow is **not** to be used, and is built so it cannot be used, for:

- risk or acuity scoring;
- "best match" ward suggestions or automatic placement;
- re-sorting the ED queue;
- calculating Mental Health Act periods or expiry, including the under-18 periods;
- releasing a pulled bed automatically when its Pull time limit passes;
- sending patient details by email.

These are Josh's standing never-build rules (19 October 2026). The guard test `tests/ward-never-build-drift-guard.test.ts` (PR #689) fails the build on common forms of drift.

**Foreseeable misuse:** treating Ward Flow as the medical record; treating a typed form expiry as the legal truth without the paper; relying on bed counts without checking their age; using the synthetic demo with real details.

### 2.4 Regulatory status (for a regulatory adviser to confirm)

Software used only to manage beds and logistics is generally outside the TGA's definition of a medical device. Drift into scoring, recommending or calculating clinical or legal outcomes could change that. This is a second reason for the never-build list. **Not yet confirmed by a regulatory adviser.** See GOV-001 in [PRODUCTION-READINESS.md](PRODUCTION-READINESS.md).

---

## 3. Clinical risk management system (proposed)

| Element               | Proposal                                                                                                                                                                                                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clinical safety owner | **To be named by Josh.** A registered clinician (psychiatrist or senior mental health nurse) with clinical safety training, independent of day-to-day building. Not appointed.                                                                                                   |
| Hazard identification | 20 Oct clinical safety audit; 24 Oct clinical safety rerun (static, browser, engine fuzzing, undo and stale-view specialists); time, saves, roles, numbers and controls audits; never-build sweeps. **Still needed:** a multidisciplinary hazard workshop with pilot-site staff. |
| Risk evaluation       | DCB0129-style matrix (section 4).                                                                                                                                                                                                                                                |
| Controls              | Engine refusals, confirmations naming the patient, undo, "Not recorded" wording, stale markers, server role checks, guard tests.                                                                                                                                                 |
| Verification          | Automated tests and browser journeys. The 24 Oct test-harness audit reported 15,348 of 15,349 unit tests running on hosted CI. That figure was not re-run for this document.                                                                                                     |
| Change control        | Every change goes through a pull request with the required CI check "Ward Flow required"; the daily release moves the `live` branch (6 am Perth). **Gap:** no rule yet that a change touching a hazard's control re-opens that hazard for clinical safety owner review.          |
| Incident reporting    | **Gap.** No route yet for pilot users to report a safety incident or near miss. In-app feedback is deferred to the pilot. An incident response plan exists only as an owner working paper outside the repository (24 Oct 2026, not adopted).                                     |

---

## 4. Risk matrix

Severity:

| Level        | Meaning in this setting                                                                                    |
| ------------ | ---------------------------------------------------------------------------------------------------------- |
| Minor        | Inconvenience; no delay to care                                                                            |
| Significant  | Short delay or extra calls; no lasting harm                                                                |
| Considerable | Delay in admission, wrong ward type, or a lawful-detention question; potential for short-term harm         |
| Major        | Patient placed unsafely, detained without authority, or a missed deterioration; potential for serious harm |
| Catastrophic | Death or permanent harm, or harm to many patients                                                          |

Likelihood: Very low, Low, Medium, High, Very high.

Risk: 1 = acceptable; 2 = acceptable where further reduction is impractical; 3 = undesirable, needs reduction or formal acceptance; 4 = unacceptable without mitigation; 5 = unacceptable.

| Likelihood ↓ / Severity → | Minor | Significant | Considerable | Major | Catastrophic |
| ------------------------- | ----- | ----------- | ------------ | ----- | ------------ |
| Very high                 | 3     | 4           | 4            | 5     | 5            |
| High                      | 2     | 3           | 3            | 4     | 5            |
| Medium                    | 2     | 2           | 3            | 3     | 4            |
| Low                       | 1     | 2           | 2            | 3     | 4            |
| Very low                  | 1     | 1           | 2            | 2     | 3            |

The baseline table in section 6 keeps its earlier HIGH / MEDIUM / LOW words. The hazard log in section 7 uses the numbered matrix above. Neither has been reviewed by a clinician.

---

## 5. Source IDs used in this document

- **HAZ-** = baseline hazards in section 6. **H-** = hazard log entries in section 7.
- **CS-** = 20 Oct clinical safety audit. **A-, B-, D-** = 24 Oct rerun findings (static, browser, and undo and stale-view specialists). In sections 1 and 7, D-01 to D-07 are **rerun findings, not owner decisions**. Owner decisions are named "decision D-nn" or appear in [decisions.md](../decisions.md) (for example D-18, D-31, D-69, D-70, D-71, D-72, D-79).
- **NB-** = never-build register. **TC-** = time audit. **SM2-** = saves audit. **NA2-** = numbers audit. **P-, PS-, PR-** = privacy audit and privacy impact assessment draft findings.
- Paths are under `src/components/ward-management/` unless shown otherwise.
- Snapshot: audits of 24 Oct 2026 (main `2d6f9263`, `d1e61c12`, `5d9cab00`; draft source `64beeda1`). "Fixed" means fixed in source and pinned by a passing test, as reported by those audits. It was not re-verified for this merge.

---

## 6. Baseline hazards (HAZ-01 to HAZ-05)

These are the repository's original five hazards, kept as written. Each maps to a hazard log entry in section 7: HAZ-01 → H-02, HAZ-02 → H-03, HAZ-03 → H-12, HAZ-04 → H-09, HAZ-05 → H-13.

| Hazard ID  | Clinical Scenario / Failure Mode                                                                      | Potential Clinical Harm                                                                               | Inherent Risk | Mitigating Technical & Process Controls in Ward Flow                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Residual Risk                        | Verification Gate                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **HAZ-01** | Involuntary patient placed in non-authorized bed                                                      | Statutory breach, unlawful detention, potential legal liability for treating team                     | **HIGH**      | Two-layer protection: (1) `requiresAuthorisedDestination(patient.legalStatus)` in `src/components/ward-management/ward-eligibility.ts` acts as the hard acceptance guard preventing placement into an un-authorised ward; (2) `destinationNoLongerLawful()` in `src/components/ward-management/ward-derivations.ts` is the post-acceptance read derivation that surfaces a warning banner if legal status changes after acceptance.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | **LOW**                              | `tests/ward-referral-ed-destination.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **HAZ-02** | Inappropriate single-sex room/wing placement or unconfirmed high-acuity placement into a standard bed | Psychological distress, safety risks, breach of patient dignity, or inadequate nursing acuity support | **MEDIUM**    | Two distinct controls: (a) **Single-sex room/wing protection** (`R7` / `D-31` in `ward-eligibility.ts`): non-overridable refusal for binary sex mismatch on single-sex rooms/wards, and mandatory coordinator review (`R2-2`) for `X` / `non_binary` / `not_stated`; (b) **High-acuity staffing-capacity protection** (`PULL_PATIENT` in `ward-flow-reducer.ts`): when high-acuity staffing capacity is exhausted, placement requires a valid `overrideReason` and `numConsulted === true`, recording the staffing-capacity override for review.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | **LOW**                              | `tests/ward-non-binary-placement.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **HAZ-03** | Acute ED patient stranded due to unconfirmed transport booking                                        | Prolonged ED stay, behavioral escalation, delayed psychiatric stabilization                           | **HIGH**      | `BOOK_TRANSPORT` records a booking already made by phone. `src/components/ward-management/ward-flow-transport-events.ts` requires a CAD number and a finite estimated time, alongside provider, escort and transport legal status answers. Since #430 the CAD number must pass `cadNumberProblem()` in `src/components/ward-management/ward-cad-number.ts`: at most 24 letters, digits, spaces, hyphens or slashes, at least one digit, not all zeros or one repeated character, and no placeholder word such as TBC, TBA, N/A, pending or unknown. The ED, community and patient booking forms read the same rule, so they do not offer a booking the engine would refuse. This is a plausibility floor, not St John WA dispatch-number syntax, which has not been confirmed. It does not verify dispatch authenticity or establish confirmed transport availability. The repatriation form (`out-of-area-model.ts`) and the `RECORD_REPATRIATION` engine check (`ward-flow-record-stay-events.ts`) read the same rule; the receiving ward's agreement does not re-check the number the sent plan already carries.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Not validated by these source checks | `tests/ward-book-transport.test.ts` covers required phone-logged facts and engine placeholder refusal; `tests/ward-cad-number.test.ts` covers the CAD rule and the booking form; `tests/ward-refusal-gaps-new-actions.test.ts` and `tests/ward-out-of-area-repatriation.test.ts` cover the repatriation refusal and agreement. Finite-time validation is in `ward-flow-transport-events.ts`. None establishes clinical residual-risk acceptance; the owner re-rates. |
| **HAZ-04** | Expiration of recorded psychiatric examination or order paper expiry timestamp                        | Unlawful detention beyond statutory limits, patient rights violation                                  | **HIGH**      | Per Owner Ruling `D-70` (which replaced `D-29`), Ward Flow never computes deadlines from statutory durations anywhere: screens display only clinician-entered paper expiry timestamps (`legalFormExpiryIso` / `legalForm.dueAt`) with warning thresholds when recorded due times approach or elapse, and say no deadline is recorded when there is none. The Legal forms demo period table was removed on 20 October 2026.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | **LOW**                              | `tests/ward-legal-forms-derivations.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **HAZ-05** | Over-reliance on prototype automation or false perception of real EHR synchronization                 | Misplaced reliance on mock data resulting in clinical miscommunication                                | **HIGH**      | Four controls with separate evidence: (a) the synthetic-prototype disclosure in `src/components/ward-management/shell/ward-prototype-footer.tsx`; (b) synthetic seed records in `src/components/ward-management/ward-patients-seed.ts`, checked by `tests/ward-synthetic-data-guard.test.ts`; (c) the local persistence boundary (D-18, as amended by D-72): `WARD_FLOW_TEXT_SAFE_EVENT_TYPES` and `eventCarriesTypedTextPayload()` in `src/components/ward-management/ward-flow-persistence-classification.ts` feed the sticky `typedTextSeen` flag in `src/components/ward-management/ward-flow-provider.tsx`. After typed text, the provider saves only a copy made by `src/components/ward-management/ward-flow-typed-text-scrub.ts` with typed values replaced; if a safe copy cannot be made, or storage fails, it stops device saves, and `clearWardFlowDemoState()` in `src/components/ward-management/ward-flow-demo-storage.ts` attempts removal. Storage failure is surfaced, not a guarantee of erasure. `tests/ward-flow-provider-persistence-privacy.dom.test.tsx` exercises this boundary. (d) Shared mode uses the authenticated `/v1/workspace` and `/v1/workspace/commands` handlers in `backend/ward-flow/shared-http.mjs`, reached through `src/components/ward-management/ward-shared-client.ts`; it does not use the local browser-persistence policy as a server safeguard. The shared prototype remains synthetic-only; provider and environment truth is maintained in [DATABASE.md](../DATABASE.md). No live EHR integration is established by these controls. | **LOW**                              | Source disclosure/seed gate: `scripts/ward-flow/check-clinical-governance-gate.mjs`; persistence test and shared-handler evidence are separate.                                                                                                                                                                                                                                                                                                                      |

---

## 7. Hazard log (H-01 to H-24)

### 7.1 Summary

| ID   | Hazard                                                                         | Initial risk | Residual risk now | State                                                                     |
| ---- | ------------------------------------------------------------------------------ | ------------ | ----------------- | ------------------------------------------------------------------------- |
| H-01 | Action taken on, or shown for, the wrong patient                               | 5            | **4**             | Open: B-01, B-02 (P1), B-03, B-04, B-05, D-01, D-04, B-10                 |
| H-02 | Involuntary patient placed in a ward not authorised for them (HAZ-01)          | 4            | 2                 | Controlled, apart from A-01                                               |
| H-03 | Placement against bed sex designation, or beyond high-acuity staffing (HAZ-02) | 3 to 4       | 2                 | Controlled                                                                |
| H-04 | Unrecorded or invented clinical fact shown as recorded                         | 4            | **3**             | Open: A-03 (P2), A-04; A-05 latent                                        |
| H-05 | Stale bed or status figure shown as current                                    | 3 to 4       | **3**             | Open: A-01 (Find a bed shows no age)                                      |
| H-06 | Pull time limit shown as cleared while it is still running                     | 3            | **3**             | Open: A-02 (P2)                                                           |
| H-07 | Consequential step taken by one tap, without confirmation or undo              | 3 to 4       | **3**             | Open: D-02 (P2), B-06, B-07, B-08, B-09                                   |
| H-08 | Concurrent change silently overwrites another desk's newer change              | 4            | **4**             | Open: D-03 (P2; P1 before shared clinical use)                            |
| H-09 | Mental Health Act form time misread, mis-entered or calculated (HAZ-04)        | 4 to 5       | 2                 | Controlled (TC-01 fixed; TC-03 open, low)                                 |
| H-10 | Decision-support drift: ranking, suggestion or score anchors a placement       | 3 to 4       | **3**             | Open: A-01 (Find a bed ranks and caps)                                    |
| H-11 | Waiting patient overlooked through queue re-ordering                           | 4            | 2                 | Controlled                                                                |
| H-12 | Patient stranded by unconfirmed or implausible transport booking (HAZ-03)      | 4            | 3                 | Partly controlled (CAD plausibility only)                                 |
| H-13 | Over-reliance: Ward Flow treated as the record or as a live EHR (HAZ-05)       | 4            | 3                 | Partly controlled                                                         |
| H-14 | Alarm fatigue: too many red markers                                            | 3            | 3                 | Open: CS-17 thresholds not reviewed                                       |
| H-15 | Wrong date or time from time zones, midnight or shift changes                  | 4            | 2                 | Controlled (TC-03 low)                                                    |
| H-16 | Typed change lost or wiped before the server confirms                          | 3            | 2                 | Controlled for main forms (SM2 fixes, some in branch only); siblings open |
| H-17 | Figures disagree between screens                                               | 3            | **3**             | Open: six P2 mismatches (numbers audit 24 Oct)                            |
| H-18 | Service unavailable at a critical moment                                       | 4            | 3                 | Partly controlled (downtime pack draft; no point-in-time backup)          |
| H-19 | Unauthorised access to patient records                                         | 4            | 3                 | Partly controlled; see the privacy impact assessment draft                |
| H-20 | Patient details leave the system in copies or prints                           | 3            | 3                 | Owner decision pending (D-71 item 7)                                      |
| H-21 | Ward's pulled bed released by another desk's recorded action                   | 3            | 2                 | Owner decision pending (rerun finding D-07: confirmed and undoable)       |
| H-22 | Undo restores the wrong state                                                  | 3            | 2                 | Controlled; fuzz coverage gap (rerun finding D-06)                        |
| H-23 | Wrong-patient risk from look-alike names                                       | 4            | 3                 | Shares H-01 controls; B-10 open                                           |
| H-24 | Cultural safety: Aboriginal status shown or used inappropriately               | 3            | 2                 | Field not displayed pending review                                        |

Severity (Sev): Mi, Si, Co, Ma, Ca = Minor, Significant, Considerable, Major, Catastrophic. Likelihood (Lik): VL, L, M, H, VH = Very low, Low, Medium, High, Very high.

### 7.2 Hazard detail

#### H-01 Action taken on, or shown for, the wrong patient

| Field                        | Entry                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cause                        | Lists or beds paired by position, not identity; views that silently swap the person when the list changes; drawers keyed by bed rather than person.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Effect                       | Staff see or act on a different person's bed, pull, discharge or referral.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Harm                         | Wrong person discharged or moved; pulled bed lost; bed given to the wrong patient; delayed admission.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Initial                      | Sev Ca, Lik H, **risk 5**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Controls in place            | CS-01 pulled bed paired by `pulledBy` (`ward/ward-screen-derivations.ts`); CS-08 answer view keeps the journey id; CS-07 and CS-09 confirmations show name, UMRN and bed; CS-15 nothing acts on an unpicked patient; CS-16 UMRN on every ED row; seed namesake offset fixed.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Open                         | **B-01 (P1)** a second bed-board move renumbers other patients' beds and survives reload (likely `ward/ward-bed-layout.ts`). **B-02 (P1)** ending one bed's pull or hold moves another patient's bed and shows an unnamed "Occupied" bed. **B-03 (P2)** Referrals panel switches to another patient when the chosen referral is decided elsewhere. **B-04 (P2)** ward bed drawer follows the bed, not the person. **D-01 (P2)** ward answer view swaps patient when the selected request leaves; desktop "Accept in principle" is one click. **D-04 (P3)** local two-tab demo. **B-05 (P2)** Destination and placement sheet has no identifiers. **B-10 (P3)** look-alike names with too few identifiers. |
| Additional controls proposed | Key every bed layout, drawer and selection by admission or journey id; close with a named notice when the subject leaves; identifiers on every sheet that acts; UMRN on place-mode tiles and phone rows.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Residual (now)               | Sev Ca, Lik M, **risk 4**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Residual (after proposed)    | Sev Ca, Lik VL, risk 3. Accept only after workshop review.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Status                       | **Open.** Fixes were in progress on 24 Oct and are not verified here.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Verification                 | Browser replays of the B-01 and B-02 sequences after reload; DOM tests for B-03, B-04 and D-01.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

#### H-02 Involuntary patient placed in a ward not authorised for them (HAZ-01)

| Field        | Entry                                                                                                                                                                                                                                                                      |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cause        | Placement into an unauthorised ward; legal status changes after acceptance.                                                                                                                                                                                                |
| Harm         | Detention without authority; unlawful placement.                                                                                                                                                                                                                           |
| Initial      | Sev Ma, Lik M, risk 3, treated as 4 because of the legal consequence                                                                                                                                                                                                       |
| Controls     | `requiresAuthorisedDestination` engine refusal (`ward-eligibility.ts`); `destinationNoLongerLawful` banner after a status change; single legal-status classifier `involuntaryBedNeededForLegalStatus` (decision D-69); referral form runs the same check per ward (CS-06). |
| Open         | Tools "Find a bed" starts on Voluntary and skips the eligibility engine (A-01; see H-10).                                                                                                                                                                                  |
| Residual     | Sev Ma, Lik VL, **risk 2**                                                                                                                                                                                                                                                 |
| Status       | Controlled, apart from A-01.                                                                                                                                                                                                                                               |
| Verification | `tests/ward-referral-ed-destination.test.ts`, `tests/ward-legal-status.test.ts`, the `tests/ward-referral-drawer-ward-gates*` tests.                                                                                                                                       |

#### H-03 Placement against bed sex designation, or beyond high-acuity staffing (HAZ-02)

| Field        | Entry                                                                                                                                                                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Controls     | Non-overridable refusal for a binary designation mismatch (R7, decision D-31); coordinator review for X, non-binary or not stated; gender never inferred from sex; high-acuity staffing override needs a reason and the NUM consulted. |
| Initial      | Sev Ma, Lik M, risk 3 to 4                                                                                                                                                                                                             |
| Residual     | Sev Ma, Lik VL, **risk 2**                                                                                                                                                                                                             |
| Status       | Controlled.                                                                                                                                                                                                                            |
| Verification | `tests/ward-non-binary-placement.test.ts`; CS-06 probe (8 of 16 combinations wrong on 20 Oct; reported fixed).                                                                                                                         |

#### H-04 Unrecorded or invented clinical fact shown as recorded

| Field    | Entry                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cause    | Seeded or computed text shown beside recorded facts; absence of a record shown as absence of the fact.                                                                                                                                                                                                                                                                                                                                                                       |
| Harm     | A ward accepts on a medical clearance nobody recorded; a form or CTO assumed absent.                                                                                                                                                                                                                                                                                                                                                                                         |
| Initial  | Sev Ma, Lik H, risk 4                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Controls | CS-02 invented narrative and "Admit to" removed; CS-14 "Not recorded" wording on ED and notifications.                                                                                                                                                                                                                                                                                                                                                                       |
| Open     | **A-03 (P2)** the full referral view (decision D-79) shows "Medically cleared" and a computed clearance time from the seeded dossier when the engine has none (`ward/ward-referral-detail.tsx`). **A-04 (P3)** "No forms in force" and "CTO: None" when nothing is recorded. **A-05 (P4)** latent invented diagnosis and acuity-tier text in a community fallback; deleting it needs Josh's yes. **A-07 (P4)** redacted community admissions default to real-looking values. |
| Proposed | Read clearance only from recorded events; label letter content as such; "Not recorded" for absent forms and CTOs; delete the fallback.                                                                                                                                                                                                                                                                                                                                       |
| Residual | Sev Ma, Lik M, **risk 3** now; risk 2 after the proposed controls.                                                                                                                                                                                                                                                                                                                                                                                                           |
| Status   | Open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

#### H-05 Stale bed or status figure shown as current

| Field    | Entry                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------- |
| Controls | CS-10 "confirmed {time}" on the TV and the referral form; CS-13 "Stale" when the shared refresh fails; TV offline marker. |
| Open     | **A-01** Tools "Find a bed" shows free beds with no age. SM2-14 (P4) banner wording after a server error.                 |
| Initial  | Sev Co, Lik H, risk 3 to 4                                                                                                |
| Residual | **Risk 3** now; 2 after A-01 is fixed.                                                                                    |
| Status   | Open.                                                                                                                     |

#### H-06 Pull time limit shown as cleared while it is still running

| Field              | Entry                                                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Cause              | The patient page replaces the Pull time limit countdown with the arrival time; a hard-coded "4h".                       |
| Harm               | A coordinator does not act on a lapsed Pull time limit; the bed is blocked or lost.                                     |
| Open               | **A-02 (P2)** `patients/patient-now-arrival-section.tsx`. The engine keeps the timer. No timer releases the bed itself. |
| Initial / residual | Sev Co, Lik H, **risk 3**; 2 after the fix.                                                                             |
| Status             | Open.                                                                                                                   |

#### H-07 Consequential step taken by one tap, without confirmation or undo

| Field              | Entry                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Controls           | CS-07 ward departure, ED outcome and "left the department" confirm with name and UMRN; undo on arrival, Form 1A and accept.                                                                                                                                                                                                                                                                                                                                                                                                 |
| Open               | **D-02 (P2)** releasing a pulled or diverted bed is one tap with no confirmation and no undo on three surfaces (`movements/movement-workspace-cockpit.tsx`, `ed/ed-screen-referred.tsx`, `ward/ward-arrivals-corridor.tsx`). **B-06 (P3)** the withdraw confirmation says "all 0 of them" and does not say the pulled bed will be released. **B-07 (P3)** the accept confirmation takes default focus at phone width. **B-09 (P3)** a double tap on "Pull a bed" lands on "Release". **B-08 (P3)** toasts that name nobody. |
| Initial / residual | Sev Co, Lik H, risk 3 to 4; **risk 3** now; 2 after the fixes.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Status             | Open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

#### H-08 Concurrent change silently overwrites another desk's newer change

| Field              | Entry                                                                                                                                                                                                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Controls           | CS-19 revision checked at commit for sheets and popups; SM2-05 observation level sends the expected version (fixed in a branch, not yet merged when audited).                                                                                                                                |
| Open               | **D-03 (P2; P1 before shared clinical use)** inline panels (release pull, legal status, urgency, transport cancel, decline, accept) send the latest snapshot as their basis, so they never see "changed while you were looking" (`ward-shared-client.ts`). SM2-13 (P4) stale urgency picker. |
| Harm               | Legal status or urgency reverted; a bed released after another desk re-used it.                                                                                                                                                                                                              |
| Initial / residual | Sev Ma, Lik H, risk 4; **risk 4** now; 2 after the fix.                                                                                                                                                                                                                                      |
| Status             | **Open.**                                                                                                                                                                                                                                                                                    |

#### H-09 Mental Health Act form time misread, mis-entered or calculated (HAZ-04)

| Field              | Entry                                                                                                                                                                                                                                                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Controls           | No computed periods anywhere (decision D-70; never-build rule); the engine writes `dueAt` only from typed fields; the period table was removed; "under 18" is recorded but never used in a time; CS-11 a past expiry shows a danger mark and words; TC-01 an extension needs a date and refuses a past expiry (#684). |
| Owner exception    | NB-12 "time left" counted down to an expiry a person typed from the form is kept (decision D-71 item 5). It computes nothing about the Act.                                                                                                                                                                           |
| Open               | **TC-03 (P3)** a form written just before midnight cannot be recorded once past midnight. It is refused, so nothing wrong is stored.                                                                                                                                                                                  |
| Initial / residual | Sev Ca, Lik M, risk 4 to 5; **risk 2**.                                                                                                                                                                                                                                                                               |
| Status             | Controlled. The paper form remains the legal record.                                                                                                                                                                                                                                                                  |

#### H-10 Decision-support drift: ranking, suggestion or score anchors a placement

| Field              | Entry                                                                                                                                                                                                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Controls           | Never-build rule; NB-1 to NB-11 removed or rewritten (fixed order, no caps, plain reasons); never-build guard test (PR #689); two sweeps (20 and 24 Oct).                                                                                                                                                           |
| Owner exception    | NB-8 road-time list of nearest ready beds, captioned "Distance only, not suitability" (decision D-71 item 6). It is a distance fact, not a suitability suggestion.                                                                                                                                                  |
| Open               | **A-01 (P2)** Tools "Find a bed" ranks wards (home service, then most free beds), caps the list at 6, defaults to Voluntary and says "fit this patient" (`tools/ward-bed-finder.tsx`). This breaches the never-build rule and needs a fix. The transport officer list defaults to "next action" (owner to confirm). |
| Harm               | A clinician is anchored to a ward the engine would refuse, or away from the right one.                                                                                                                                                                                                                              |
| Initial / residual | Sev Co, Lik H, risk 3 to 4; **risk 3** now; 2 after A-01 is fixed.                                                                                                                                                                                                                                                  |
| Status             | Open.                                                                                                                                                                                                                                                                                                               |

#### H-11 Waiting patient overlooked through queue re-ordering

CS-04 reported fixed: Home, Waiting, Movements and step-down lists show wait order; the ED board defaults to longest wait; flags highlight rows instead of moving them. **Controlled. Risk 2** (initial 4).

#### H-12 Patient stranded by unconfirmed or implausible transport booking (HAZ-03)

| Field    | Entry                                                                                                                                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Controls | The booking records a phone booking; CAD number, finite ETA, provider, escort and legal answers required; CAD plausibility rule (#430); SM2-02 the booking dialog keeps its values until the server answers. |
| Gap      | Plausibility only; no link to St John WA dispatch; real CAD format unconfirmed.                                                                                                                              |
| Residual | Sev Co, Lik M, **risk 3**. Proposed for acceptance with a process control: phone confirmation.                                                                                                               |
| Status   | Partly controlled.                                                                                                                                                                                           |

#### H-13 Over-reliance: Ward Flow treated as the record or as a live EHR (HAZ-05)

| Field    | Entry                                                                                                            |
| -------- | ---------------------------------------------------------------------------------------------------------------- |
| Controls | Synthetic banners and footer; synthetic-data guard; local persistence boundary; demo and shared modes separated. |
| Gap      | No decision yet on which system is the record of truth (raised in the privacy impact assessment draft).          |
| Residual | **Risk 3.** Proposed for acceptance with training and policy.                                                    |

#### H-14 Alarm fatigue: too many red markers

| Field    | Entry                                                                               |
| -------- | ----------------------------------------------------------------------------------- |
| Evidence | CS-17: 33 of 70 waiting patients red; 26% to 67% red per ED in the synthetic seed.  |
| Controls | Colour never alone; the Alerts view reports every watched condition.                |
| Open     | Thresholds stay as they are unless Josh names a change; not reviewed by clinicians. |
| Residual | Sev Si, Lik H, **risk 3**                                                           |
| Proposed | Clinician threshold review during the trial.                                        |

#### H-15 Wrong date or time from time zones, midnight or shift changes

Perth time everywhere; one board clock; 227 probe lines identical across five time zones; CS-18 age fixed; TC-01 and TC-02 fixed (#684). **Controlled. Risk 2.** TC-03 and TC-05 to TC-08 open (P3 or P4).

#### H-16 Typed change lost or wiped before the server confirms

Controls: SM2-01 seclusion and incident forms, SM2-02 transport, SM2-03 Ask more wards, SM2-04 observation (some fixed in a branch only when audited). Open: SM2-03 sibling forms; SM2-07 the decline form vanishes; SM2-11 refusals shown only in the status bar; SM2-12 open forms lost on session expiry. **Risk 2**; 3 until the branch is merged.

#### H-17 Figures disagree between screens

| Field    | Entry                                                                                                                                                                                                                                                    |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Evidence | Numbers audit 24 Oct: the headline figures agree (62 waiting, 26 ready in the synthetic seed). Six P2 mismatches, including the Handover pulled-bed count including closed beds, and the ED bed figure showing 17 when only 8 patients had a bed pulled. |
| Harm     | Staff believe a bed is pulled for a patient when it is not.                                                                                                                                                                                              |
| Residual | Sev Co, Lik H, **risk 3**; 2 after the fixes.                                                                                                                                                                                                            |
| Status   | Open.                                                                                                                                                                                                                                                    |

#### H-18 Service unavailable at a critical moment

| Field    | Entry                                                                                                                                                                       |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Controls | Downtime pack print; offline markers; uptime check every 30 minutes; daily release window.                                                                                  |
| Gap      | No point-in-time backup or tested restore; free-plan hosting; the signed-in site sleeps when idle. Downtime procedures are a draft working paper, not agreed with any site. |
| Residual | Sev Co, Lik M, **risk 3**. Proposed for acceptance with paper fallback procedures.                                                                                          |

#### H-19 Unauthorised access to patient records

Server-side role scoping, row security and append-only logs. Open: no multi-factor sign-in, offshore app hosting, admin grant limits. See the privacy impact assessment draft (findings P-01, P-02, P-03, P-06). **Risk 3.**

#### H-20 Patient details leave the system in copies or prints

Copies are stamped synthetic, with UMRN and date of birth stripped. Names remain in copies, prints and CSV (NB-13 to NB-15, PR-02). Whether real names may appear in copied text is an owner decision before any real data (decision D-71 item 7). Patient details are never sent by email. **Risk 3.**

#### H-21 Ward's pulled bed released by another desk's recorded action

Rerun finding D-07: recording a revoked or community-order examination releases the ward's pulled bed in the same ED step, with a notice and a 5-minute undo. NB-24-4: the ED "Medical deterioration" release is confirmed by a person (decision D-34). A person's recorded action triggers it, not a timer, so it is not a never-build breach. **Owner decision pending. Risk 2.**

#### H-22 Undo restores the wrong state

Engine undo restores exactly (rerun D-06 probes). The fuzz generator does not cover five undo events (rerun finding D-06). `RELEASE_BED` is dead code (rerun finding D-05). **Risk 2.** Proposed: extend the fuzz generator.

#### H-23 Wrong-patient risk from look-alike names

Shares the H-01 controls. B-10 open. **Risk 3** until UMRN shows on place-mode tiles and phone rows.

#### H-24 Cultural safety: Aboriginal status shown or used inappropriately

The field is stored. Its display is not settled, pending the Aboriginal health review. The Aboriginal Cultural Safety Charter is reference material. **Risk 2.** Re-open if the field is displayed.

---

## 8. Key safety arguments (drafter's, not reviewed)

1. **No automated clinical decisions.** No timer or effect places, accepts, moves or releases anyone. The 24 Oct static review found every dispatch is a click handler and the backend has no scheduled jobs. The never-build guard test pins this.
2. **The engine refuses unsafe placements.** Legal-status authorisation (HAZ-01), bed sex designation with no override, and the high-acuity staffing override with a reason (HAZ-02) are enforced in the engine. The referral form shows the same gates before a referral is sent (CS-06 reported fixed).
3. **Legal times are only what a person typed.** The engine writes `dueAt` only from event fields. There is no period table (removed 20 Oct, decision D-70). "Under 18" is recorded but never used in a time.
4. **Truthful status.** "Not recorded" where nothing is recorded (CS-14), with new instances open in H-04. Stale markers on the shared refresh and the TV (CS-10, CS-13).
5. **Patient identity on consequential steps.** Confirmations name the patient and UMRN (CS-07, CS-09). Selections are kept by journey id, not list position (CS-08). **However,** browser testing on 24 Oct found bed-board renumbering that shows patients in the wrong beds (B-01, B-02). This argument does not hold until those are fixed and verified.
6. **Role-scoped access** is enforced at the server (roles audit, 24 Oct).
7. **Tests really run.** The 24 Oct test-harness audit reported that no command can report "passed" after running nothing.

---

## 9. Human Factors & Cognitive Load Controls

1. **Anti-Alarm Fatigue Protocol:** The Alerts view avoids "blank screen syndrome" by reporting explicitly on all seven watched conditions—firing or not—preventing coordinators from assuming silence equals system health. Red-marker volume is still high in the synthetic seed (H-14).
2. **Defensive Status Representation:** Severity is never represented by color alone; all critical alerts pair color with accessible text badges (`Critical`, `Urgent`, `Routine`) and distinct SVG iconography.
3. **No Algorithmic Auto-Allocation:** The system never automatically allocates or moves a patient. All bed allocation decisions require explicit, auditable clinician actions.

### 9.1 Residual risk statement (drafter's)

If the open items in section 7 are closed and verified, the drafter expects every hazard to sit at risk 2 or below, except H-12, H-13, H-14, H-18 and H-19. Those depend on processes outside the software: transport confirmation by phone, the paper record, threshold review, downtime procedures and privacy controls. They would need **formal acceptance** by the clinical safety owner, with stated conditions. No such acceptance exists.

---

## 10. Pre-Deployment Clinical Safety Officer (CSO) Sign-off Checklist and open actions

Before this system may be piloted in any clinical environment with real patient workflows, the following formal sign-offs are mandatory. None is done.

- [ ] **Clinical Safety Officer (CSO) Appointment:** Accredited medical practitioner or registered nurse certified in health informatics safety. Called the clinical safety owner in the 24 Oct merge; to be named by Josh.
- [ ] **Clinical Hazard Workshop:** Multidisciplinary hazard identification workshop with psychiatric liaison nurses, bed managers, and on-call consultant psychiatrists.
- [ ] **Emergency Department Liaison Protocol Validation:** Confirmation that CAD number logging aligns with St John Ambulance / WA Police inter-facility transfer communication protocols.
- [ ] **Residual Risk Acceptance:** Written acceptance of residual clinical risks signed by the Health Service Provider Chief Executive and Executive Director of Clinical Governance.

Open actions merged from the 24 Oct draft (conditions before any use with real patients):

- [ ] Close and verify H-01 (B-01, B-02, B-03, B-04, D-01) and H-08 (rerun finding D-03), with tests that would have caught them.
- [ ] Close or formally accept every risk-3 hazard.
- [ ] Run the clinician trial (human test kit) and log its findings as hazards.
- [ ] Add an incident and near-miss reporting route for pilot users.
- [ ] Add a change-control rule: a change to any control in the hazard log needs clinical safety owner review.
- [ ] Complete a privacy impact assessment. A draft exists only as an owner working paper outside the repository (24 Oct 2026, not adopted).
- [ ] Agree downtime and paper fallback procedures and an incident response plan with pilot sites. Drafts exist only as owner working papers outside the repository (24 Oct 2026, not adopted).
- [ ] Confirm the regulatory position (section 2.4) with a regulatory adviser.

---

## 11. Known limitations of this document

- Ratings are proposals by a non-clinical drafter. No clinician has reviewed them.
- Hosted settings were not read for the draft (the cloud proxy blocked the provider sites).
- Fixes for B-01 and B-02 were in progress on 24 Oct and are **not verified** here.
- The 19 "closing the loop" features had no open pull request on 24 Oct and were not assessed.
- No hazard workshop with pilot-site staff has been held.
- The audit findings were reported by AI audits and were not re-verified for this merge. Line numbers from the audits are left out because they drift.

---

## 12. Sign-off and review record

To be completed by named people. **Left blank on purpose.** No simulated sign-off may be added (Prototype Operating Mode).

| Role                                                    | Name | Decision | Date | Signature |
| ------------------------------------------------------- | ---- | -------- | ---- | --------- |
| Clinical safety owner (to be named by Josh)             |      |          |      |           |
| Project owner (manufacturer)                            |      |          |      |           |
| Deploying health service clinical safety lead           |      |          |      |           |
| Executive Director of Clinical Governance (or delegate) |      |          |      |           |

| Date | Reviewer role | Hazards reviewed | Changes |
| ---- | ------------- | ---------------- | ------- |
|      |               |                  |         |

---

## 13. Governance Declarations

> [!CAUTION]
> This software is currently an engineering prototype executing exclusively on synthetic patient data. It is **NOT CERTIFIED** as a medical device by the Therapeutic Goods Administration (TGA) and must not be used for live patient triage or diagnostic decision-making.
