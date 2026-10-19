# Ward Flow: Aboriginal Cultural Safety Charter & Consultation Specification

**Document Version:** 1.0.0  
**Status:** DRAFT / PROTOTYPE GOVERNANCE BASELINE  
**Policy Alignment:** WA Aboriginal Health and Wellbeing Framework 2015–2030; NSQHS Standards (Aboriginal & Torres Strait Islander User Guide)  
**Authority Reference:** Owner Ruling R2-6 (_Aboriginal cultural safety review deferred by the owner; remains a mandatory gate before real-patient clinical use; closed to further builder questioning_)

_Updated 2026-10-19 - corrected the scope of synthetic-data test evidence; Documentation owns. No consultation or sign-off refreshed._

---

## 1. Principle of Cultural Safety in Mental Health Bed Coordination

Cultural safety in Western Australian healthcare is defined not merely by the absence of overt discrimination, but by an active environment where Aboriginal and Torres Strait Islander individuals, families, and communities feel safe, respected, and heard.

Within mental health bed flow and involuntary patient coordination, historical and ongoing trauma—including past policies of forced removal, institutionalisation, and disproportionate rates of involuntary treatment under mental health legislation—make patient movement and placement extraordinarily sensitive.

---

## 2. Synthetic Patient Data Safeguards

To prevent harm during engineering and design demonstration:

1. **Non-Stigmatising Synthetic Cohorts:** Synthetic patient records representing Aboriginal patients must never embody harmful deficit narratives, exaggerated stereotypes, or clichéd presentations. Clinical details must reflect authentic, diverse healthcare presentations.
2. **Fictional Identity Authoring & Bounded Checks:** Patient names in `src/components/ward-management/ward-patients-seed.ts` are deliberately authored or generated as fictional identities. Synthetic UMRNs include hand-authored `UM1xxxxx` and generated `UM5xxxxx` records. `tests/synthetic-data-guard.test.ts` checks bounded Medicare, hospital-identifier and telephone patterns; `tests/ward-synthetic-data-guard.test.ts` checks that the seeded payload passes that guard. These tests do not check a surname blacklist or prove that a fictional name cannot coincide with a real person.
3. **Catchment Honesty:** Patient residential catchments and regional kinship boundaries must respect Western Australian geography under the WA Health Aboriginal Identification Policy / Standard S2015 tables without inventing fictitious tribal associations.

---

## 3. Operational Requirements for Bed Coordinators

When handling patient placements in live clinical practice (future phase):

- **Kinship & On-Country Considerations:** Where an Aboriginal patient from a regional or remote catchment (e.g. Kimberley, Pilbara, Goldfields) requires acute admission, coordination logic must prioritise keeping the person as close to country and family support networks as clinically safe.
- **Aboriginal Mental Health Worker (AMHW) Involvement:** Triage and intake forms must include explicit prompts to record whether an Aboriginal Mental Health Liaison Officer or Aboriginal Health Worker has been notified.
- **Language & Interpreter Support:** Mandatory notation of language and dialect needs (including Aboriginal English, Kriol, Martu, Pitjantjatjara) in patient dossier views.

---

## 4. Formal Elder & Community Consultation Gate

> [!IMPORTANT]
> **Owner Ruling R2-6 Standing Order:**
> In accordance with Owner Ruling R2-6, builder agents must not re-raise or poll the product owner regarding the timing of the cultural safety review during engineering iterations.
>
> However, **this review remains an absolute, non-bypassable pre-condition before Ward Flow can ever be introduced to a clinical environment.**

### Required Community Stakeholders for Final Sign-Off:

1. **Derbarl Yerrigan Health Service** (Metropolitan Perth consultation).
2. **WA Country Health Service (WACHS) Aboriginal Health Strategy Directorate** (Regional patient flow & repatriation).
3. **Aboriginal Health Council of Western Australia (AHCWA)** (Statewide peak body review).
4. **Independent Aboriginal Lived Experience Advisory Panel** (Consumer rights & cultural dignity).

Signed approvals from designated cultural representatives must be filed at `docs/ward-flow/governance/approvals/aboriginal-cultural-safety-signed.json` prior to any real-patient production release. Under Prototype Operating Mode (`AGENTS.md`, 3 October 2026), JSON sign-off files are non-blocking reference records for the synthetic prototype.
