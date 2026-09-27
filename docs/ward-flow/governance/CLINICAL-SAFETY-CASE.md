# Ward Flow: Clinical Safety Case & Hazard Log (DCB0129 Standard)

**Document Version:** 1.0.0  
**Status:** DRAFT / PROTOTYPE GOVERNANCE BASELINE  
**Clinical Scope:** Western Australian Public Mental Health Services Bed-Coordination Demonstration Prototype  
**Synthetic Isolation Guarantee:** Synthetic records only (0 real patients, 0 production EHR connections)

---

## 1. Executive Summary & Clinical Intent

Ward Flow is a specialized operational bed-coordination and patient flow prototype designed for Western Australian mental health services (encompassing inpatient mental health units, emergency department mental health liaison teams, and community mental health teams).

The primary clinical purpose of the tool is to provide transparent, real-time visibility over:
- Bed capacity across authorized and non-authorized mental health units.
- Patient transfers and referrals between emergency departments and inpatient wards.
- Statutory legal timings and form requirements under the Western Australian *Mental Health Act 2014*.
- Transport coordination logistics for voluntary and involuntary mental health patients.

Because errors in psychiatric bed coordination can result in severe clinical, ethical, and legal harms—including delayed acute care, unauthorized detention, inappropriate gender placement, or heightened risk of self-harm in ED waiting areas—this Clinical Safety Case establishes a formal risk management framework modeled on the **DCB0129 (Clinical Risk Management: Its Application in the Deployment of Health IT Systems)** standard.

---

## 2. Clinical Hazard Log

| Hazard ID | Clinical Scenario / Failure Mode | Potential Clinical Harm | Inherent Risk | Mitigating Technical & Process Controls in Ward Flow | Residual Risk | Verification Gate |
|---|---|---|---|---|---|---|
| **HAZ-01** | Involuntary patient placed in non-authorized bed | Statutory breach, unlawful detention, potential legal liability for treating team | **HIGH** | Reducer hard-guard `destinationNoLongerLawful()` immediately flags involuntary placements on non-authorized units and surfaces a critical alert in the Coordination and Alerts views. | **LOW** | `tests/ward-referral-ed-destination.test.ts` |
| **HAZ-02** | Gender-diverse patient placed without clinical privacy justification | Psychological distress, safety risks, breach of patient dignity | **MEDIUM** | System enforces `GenderPlacement` verification. Single-gender wards require recorded coordinator clinical reasoning (`R2-2`), with mandatory nurse unit manager confirmation. | **LOW** | `tests/ward-non-binary-placement.test.ts` |
| **HAZ-03** | Acute ED patient stranded due to unconfirmed transport booking | Prolonged ED stay, behavioral escalation, delayed psychiatric stabilization | **HIGH** | `BOOK_TRANSPORT` requires a valid CAD emergency transport dispatch number and an estimated time of departure before marking transport as booked; refuses generic placeholders. | **LOW** | `tests/ward-transport-not-needed.test.ts` |
| **HAZ-04** | Expiration of statutory psychiatric examination deadline (e.g. Form 3D) | Unlawful detention beyond statutory limits, patient rights violation | **HIGH** | Prominent countdown clocks with clear warning thresholds; red banner flags displayed across Alerts, Legal Forms, and Handover sheets when due dates approach or elapse. | **LOW** | `tests/ward-legal-forms-derivations.test.ts` |
| **HAZ-05** | Over-reliance on prototype automation or false perception of real EHR synchronization | Misplaced reliance on mock data resulting in clinical miscommunication | **HIGH** | Permanent high-contrast "SYNTHETIC PROTOTYPE ONLY" watermark mounted across all routes; complete absence of live database write endpoints. | **LOW** | `scripts/ward-flow/check-clinical-governance-gate.mjs` |

---

## 3. Human Factors & Cognitive Load Controls

1. **Anti-Alarm Fatigue Protocol:** The Alerts view avoids "blank screen syndrome" by reporting explicitly on all seven watched conditions—firing or not—preventing coordinators from assuming silence equals system health.
2. **Defensive Status Representation:** Severity is never represented by color alone; all critical alerts pair color with accessible text badges (`Critical`, `Urgent`, `Routine`) and distinct SVG iconography.
3. **No Algorithmic Auto-Allocation:** The system never automatically allocates or moves a patient. All bed allocation decisions require explicit, auditable clinician actions.

---

## 4. Pre-Deployment Clinical Safety Officer (CSO) Sign-off Checklist

Before this system may be piloted in any clinical environment with real patient workflows, the following formal sign-offs are mandatory:

- [ ] **Clinical Safety Officer (CSO) Appointment:** Accredited medical practitioner or registered nurse certified in health informatics safety.
- [ ] **Clinical Hazard Workshop:** Multidisciplinary hazard identification workshop with psychiatric liaison nurses, bed managers, and on-call consultant psychiatrists.
- [ ] **Emergency Department Liaison Protocol Validation:** Confirmation that CAD number logging aligns with St John Ambulance / WA Police inter-facility transfer communication protocols.
- [ ] **Residual Risk Acceptance:** Written acceptance of residual clinical risks signed by the Health Service Provider Chief Executive and Executive Director of Clinical Governance.

---

## 5. Governance Declarations

> [!CAUTION]
> This software is currently an engineering prototype executing exclusively on synthetic patient data. It is **NOT CERTIFIED** as a medical device by the Therapeutic Goods Administration (TGA) and must not be used for live patient triage or diagnostic decision-making.
