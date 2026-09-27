# Ward Flow: Western Australian Mental Health Act 2014 Compliance Dossier

**Document Version:** 1.0.0  
**Statutory Basis:** *Mental Health Act 2014* (WA) [MHA 2014] & Chief Psychiatrist’s Statutory Guidelines  
**Status:** DRAFT / PROTOTYPE COMPLIANCE MAPPING  
**Clinical Scope:** Statutory mental health form tracking and involuntary admission gates in bed coordination

---

## 1. Statutory Context & Principles

The Western Australian *Mental Health Act 2014* provides the legal framework for the assessment, treatment, and care of persons with mental illness. Under Part 3 (Principles), services must promote voluntary treatment wherever possible and ensure involuntary powers are exercised as a last resort, for the minimum duration necessary, and in strict compliance with human rights and statutory timeframes.

Bed coordination software directly impacts the administration of the Act during the critical transition points between emergency triage, inter-hospital transport, and inpatient admission.

---

## 2. Statutory Forms & Timeframe Mappings

Ward Flow models the following statutory forms as explicit clinical records, maintaining strict adherence to legal nomenclature:

| Form | Statutory Provision | Purpose in Patient Flow | Legal Timeframe / Constraints in Ward Flow |
|---|---|---|---|
| **Form 1A** | MHA 2014 s. 26 | Referral for examination by a psychiatrist | Valid for 72 hours from execution. Model does not infer deadlines; displays entered practitioner time. |
| **Form 3A** | MHA 2014 s. 58 | Order authorising detention in an authorised hospital for further examination | Authorises detention for up to 24 hours to conduct an examination. Countdown clock alerts coordinators as deadline approaches. |
| **Form 3D** | MHA 2014 s. 62 | Order extending detention period for further examination | Allows an extension of up to 72 hours. Prototype displays time typed by clinician (`R2-3`); no computed durations. |
| **Form 4A** | MHA 2014 s. 86 | Transport order | Authorises transport officers or police to convey person to an authorised hospital. CAD transport number logging required. |
| **Form 5A** | MHA 2014 s. 89 | Involuntary inpatient treatment order | Confirms involuntary status. **Absolute constraint:** Can ONLY be admitted to a Gazetted Authorised Hospital. |

---

## 3. Strict Statutory Safety Guardrails

### A. Authorised Hospital Restriction (Gazetted Beds Only)
Under MHA 2014 s. 89 and s. 542, an involuntary inpatient can only be received and treated in an authorised hospital (or authorised unit) gazetted by the Governor.
- **Enforcement:** `destinationNoLongerLawful()` in `ward-derivations.ts` automatically rejects involuntary placement on non-authorised units and creates a P0 Critical Breach alert in the coordination console if a patient's legal status changes to involuntary while allocated to an open/unauthorised ward.

### B. Prohibition on Inferred Statutory Status
- In accordance with clinical governance rulings, Ward Flow **never infers or computes legal expirations automatically**. A form is legally valid or revoked only when an Authorised Medical Practitioner (AMP) records a signed examination outcome.
- Automated tests verify that no timer auto-discharges or auto-converts a patient's legal status without human clinical entry.

### C. Seclusion and Bodily Restraint Exclusion
- Under Part 14 of the MHA 2014, seclusion and mechanical/physical restraint are heavily regulated clinical interventions requiring specialized Chief Psychiatrist registers.
- **Architecture Principle:** Ward Flow is strictly a bed-flow and capacity coordination tool. It **must never** incorporate modules for authorizing, timing, or logging seclusion or restraint events.

---

## 4. Legal Sign-off Requirements Prior to Clinical Deployment

Before live operational implementation, the following legal verifications are required:

1. **State Solicitor’s Office (SSO) or Health Service Legal Counsel Review:** Confirmation that electronic form representations meet evidentiary standards under the *Electronic Transactions Act 2011* (WA).
2. **Office of the Chief Psychiatrist (OCP) Consultation:** Audit of terminology, form registers, and reporting triggers against OCP clinical monitoring standards.
3. **Mental Health Tribunal & Mental Health Advocacy Service Liaison:** Confirmation that patient notification tracking respects statutory advocacy rights.
