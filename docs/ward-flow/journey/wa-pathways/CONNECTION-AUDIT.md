# Connection audit — 8 October 2026

Task `01a11902-8a33-7663-9fde-058cdaf3063b`, Ward Flow. Requested stage: local review/Fast Preview.
Baseline: local commit `f9ceea02`; cached repository base `ce1f865ba1cdd2983245b5ca072a230977f14000`.
Original diagram layout and source files are preserved.

## Findings and changes

The WA service-category register grows from **293 to 409 conditional links**: **116 additions**.
Existing links are retained. Every addition is marked in the wireframe and exported in
[connection-audit.csv](connection-audit.csv), with its interaction, evidence basis, guards and notes.
Of the additions, 19 describe documented WA pathway families and 97 are conditional design
proposals. Neither classification guarantees access or acceptance for an individual person.
The source register grows from 26 to 30 references. This is a finite category audit, not a claim
that every current facility, statutory procedure or operational route has been verified.

The preserved master map has **111 original boxes and 161 original connecting paths**.
Nine source-supported connections are drawn as a separate purple dashed overlay:

| Missing connection                                    | Added condition and interaction                                                                                                                                                                                                                                   |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Seven open bed-search stages → community referral arm | `REFER_TO_COMMUNITY_TEAM`, before collection, named team, and conclusive examination when applicable. Create/reuse the real community arm; close this bed search; cancel uncollected transport and release its held admission. Team acceptance still comes later. |
| Community diversion result → community referral arm   | Continue the created/reused referral into its actual response process; do not confuse a sent referral with acceptance.                                                                                                                                            |
| Repatriation record → new placement request           | `RECORD_REPATRIATION` creates a distinct bed-search movement only when `receivingWardAgreed` is true. No transport booking or original-patient departure follows automatically.                                                                                   |

Source: `src/components/ward-management/ward-flow-reducer.ts`, inspected branches at lines 2861
and 8886. The input hashes are embedded in the generated artefact. No runtime app claim is made.
The overlay can be hidden to inspect the original lines alone. No original node is moved or replaced.

**Eight existing double-arrow return directions** were drawn but absent from the selected-box
neighbour list. The list now includes their implied reverse direction. The exported master register
has 178 directional records: 161 original links, eight implied reverse directions and nine additions.
Original annotations/self-loops are schematic links; these counts are not counts of clinical transfers.

The master already catalogues all **98 role-map event labels** and **98 distinct reducer case
labels** found by static comparison. None was absent from the 98-action catalogue. This does not
verify every guard, caller, button, action meaning or runtime branch.

## Wider care connections reviewed

| Family previously incomplete                  | Treatment in this audit                                                                                                                                                                                                    |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Planned child inpatient referral              | Published GP/school/community-organisation referral family; receiving suitability and acceptance remain required.                                                                                                          |
| Youth HITH and intensive outreach             | Published programme-specific referrer families. HITH and outreach have different criteria; no blanket entitlement for every GP or every child inpatient.                                                                   |
| Eating-disorder continuum                     | Team consultation, medical admission, emergency reassessment, day care, age transition and programme closure remain different interactions. Psychiatric admission proposals require the actual suitable receiving setting. |
| Medical/HITH/residential interfaces           | Physical deterioration, continuing primary care, housing and agreed discharge interfaces; exact provider arrangements marked as proposals.                                                                                 |
| Rehabilitation and supported residence        | CCU/clinical rehabilitation and supported accommodation have distinct remits and provider criteria.                                                                                                                        |
| Regional and cross-border care                | Specialty assessment, suitable country repatriation and agreed interstate handover. No implication that each country site supplies every specialty or security level.                                                      |
| PICU onward care and exceptions               | Conditional care/handover interfaces plus refusal, absence and confirmed death. Direct discharge is a proposal; never a recommendation to omit clinically required step-down.                                              |
| Located after an unexplained absence          | Review return to the **actual originating/accepted service**, with lawful authority, reassessment and admission/bed checks. Not an unrestricted destination menu.                                                          |
| Actual departure without stable accommodation | Record actual circumstances and unresolved housing needs. Visibility does not endorse an unsafe discharge or replace it with a fictional home.                                                                             |
| Justice release and forensic transition       | Separate justice/court authority, clinical handover and housing acceptance; no automatic recall, release or detention power invented.                                                                                      |

The public primary sources reviewed include:

- [NMHS youth services](https://www.nmhs.health.wa.gov.au/Hospitals-and-Services/Mental-Health/Specialties/Youth).
- [CAHS mental health referrals](https://www.cahs.health.wa.gov.au/For-health-professionals/Referrals-to-our-services/Mental-Health).
- [PCH eating-disorder services](https://www.pch.health.wa.gov.au/Our-services/Mental-Health/Eating-Disorders-Service).
- [MHC residential support](https://www.mhc.wa.gov.au/getting-help/other-support-services/residential-services-for-mental-health).
- [CAHS Crisis Connect](https://www.cahs.health.wa.gov.au/CAMHS-ETS).

Published programme descriptions establish certain referral/care families; they do not establish
universal local admission permission. Added inferred links are explicitly **design connections**.

## Every pair stays reviewable

[connections.csv](connections.csv) enumerates all **1,600 ordered pairs**, including same-category
pairs. The wireframe's Review & sources view has an origin/destination checker using that same
register. Each pair has a disposition and explanation:

| Disposition                                                        | Pairs |
| ------------------------------------------------------------------ | ----: |
| Explicit conditional links                                         |   407 |
| Unconfirmed direct movement/discharge interface                    |   365 |
| Unconfirmed direct referral/shared-care interface                  |   534 |
| Circumstance/return interface requiring specific review            |   135 |
| Outcome possible in principle; direct episode rule unconfirmed     |    47 |
| Same-category reassessment/provider change not separately modelled |    32 |
| Re-entry requires a new episode after recorded closure             |    40 |
| Outside living-patient flow after confirmed death                  |    40 |

Two pairs have more than one interaction, hence 409 links across 407 linked pairs. Classification
of every pair is **mechanical triage plus the curated family review**, not 1,600 individually
approved clinical decisions. Missing direct edges do not prove impossibility. Optional indirect
examples show graph connectivity only: each real step still needs independent clinical/service/legal
confirmation. Review, absence and closure edges are excluded from those generated care examples.

## Gaps deliberately left visible

- A held-bed release after stopped transport has an action but no dedicated result box. Its detail
  panel records that gap; it is not misconnected to an admitted patient's discharge-bed record.
- Historical absence and other defect wording in the original master was not revalidated through
  the current app. Source counts and matching event labels do not establish behavioural completeness.
- Site-specific bed access/escalation, security/population fit, age/catchment criteria, capacity,
  private funding, cross-border agreements, court authority and full current statutory/forms detail
  remain unconfirmed. Further programmes/facilities may require finer categories.
- PCH's detailed eating-disorder page and the generic CAHS referral summary use different age-entry
  wording. The model records the disagreement and requires the actual receiving programme's rule;
  it does not impose a universal age boundary.
- Headers, source starts, parallel records and explanatory notes need not have patient-flow arrows.
  A closed episode can be followed by a new assessment through entry routes; death cannot generate
  another living-patient care route. No invented direct arrow is added for either circumstance.

## Reproducibility and proof limits

Run `node docs/ward-flow/journey/wa-pathways/verify.mjs`, rebuild with `build.mjs`, then run
`build.mjs --check`. The verifier covers route integrity, every pair's disposition, indirect examples,
restricted absence-return semantics, master overlay endpoints and reverse-arrow preservation.
Generated source/artifact hashes and local browser evidence are recorded in this task's private
checkpoint. Static checks are not clinical review or full app QA. No integration, publication,
hosted CI, merge, deployment, provider mutation or real-patient use was performed.
