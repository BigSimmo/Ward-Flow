# Master-map UX and project/pathway review — 13 October 2026

Task `01a11902-8a33-7663-9fde-058cdaf3063b`, Ward Flow. Local review/Fast Preview continuation
from `caee7080`, in `D:/Worktrees/WardFlow/wa-mental-health-wireframe-20261008`.

## Result

The **master map is the default, first and largest view**. Its 111 original boxes, coordinates,
symbols, colours and 161 original paths remain. Nine earlier audit continuations and eight
implicit double-arrow return directions remain available. Two outdated explanatory passages
have a clearly identified current-review display layer; their original source wording is retained.

The wider WA register has **48 categories, 469 conditional links, 42 reference records and 2,304
ordered category pairs**. This continuation adds eight categories and 60 links to the prior
40-category/409-link model. Of these additions, **27 are documented pathway families and 33
are proposals**. Prior links and category objects are preserved. Eleven examples remain
illustrative; a graph path is not a clinical recommendation or permission to combine services.

## Design review and changes

| Previous issue                                                                    | Resulting behaviour                                                                                                                                                         |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overall journey opened first; master was a secondary view                         | Master opens on a plain file/URL and appears first in navigation and source order.                                                                                          |
| Large introductory material and above-map detail pushed the diagram down the page | Compact master header; the canvas occupies the remaining viewport. Desktop details sit beside the map.                                                                      |
| Selecting/searching a box forced 100% zoom and scrolled the document              | Selection preserves the current zoom and centres inside the map. “Read labels” is an explicit choice.                                                                       |
| It was hard to know where a small visible section belonged                        | An overview navigator marks the visible area; section jumps cover referral, bed search, transport, ward, leaving and parallel records.                                      |
| Large map required repeated scrolling and lost context                            | Scroll, keyboard pan, blank-space drag, centre-preserving zoom and a focus view. Escape exits focus, including from the search field.                                       |
| Search failed when a copied label had different spacing                           | Unicode and whitespace normalisation; word-based matching; previous/next match controls.                                                                                    |
| Dense connecting lines were difficult to follow                                   | Optional highlighting of the selected step's connections; audit overlay can be hidden without removing original paths.                                                      |
| Source notes could be mistaken for current app or clinical facts                  | Current review markers, evidence status and limits; original wording is separately available. Links lead to the corresponding deployed screen and related WA care category. |
| Box details named actions but gave little interaction detail                      | Actions disclose people/roles, prerequisites, resulting records and refusal situations. Self-loop annotations are distinguished from patient progression.                   |
| Phone details would make the canvas too narrow                                    | Native modal step details on smaller widths, with close/Escape and focus return. Existing care-connection modal is retained with the correct accessible label.              |

The accessibility review covers heading/control labels, keyboard navigation, focus, readable
step details, colour-independent status wording, reduced-motion and forced-colour support.
An overview of this many boxes necessarily has small labels: use selection/inspection or “Read
labels”, rather than assume the whole map is readable at every zoom. This is not a formal WCAG
conformance certification or a physical-device claim.

## Wireframe compared with the deployed project and current source

The public synthetic deployment was inspected directly at
[Ward Flow](https://ward-flow-production.up.railway.app/mockups/ward-flow). Observations cover
Home, Community, Legal/forms, Transport, Discharges, the referral worklist/intake overlay and
Network. The intake overlay was opened through its route and inspected without submission.
The deployment revision was not exposed/verified, so these observations are **not attributed
to the local commit**.

The current local comparison used `D:/Repos/Ward-Flow`, branch
`feat/movement-drawer-audit-and-actions` at `5d6ea7ed`, with existing dirty work preserved.
Its 98 role-map labels and 98 distinct reducer case labels are all in the retained catalogue.
Matching names does not establish guard, caller or runtime equivalence. Exact core-source hashes
are recorded in [review-20261013.mjs](review-20261013.mjs) and private evidence.

| Finding                                                          | Evidence and implication                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Community-directory wording was incomplete**                   | Deployed Community displays a synthetic team directory and catchment guide. Current local ED diversion has a team selector. Update the explanation, while retaining the requirement to verify team identity and receiving acceptance.                                                                                                                                                                                   |
| **A legal-form editor remains a prototype stub**                 | Deployed “Record a form” shows “Not wired in this prototype” and a disabled Save form. Current source also marks this control unwired. Keep it as an app follow-up, not a functioning save path. No form was submitted.                                                                                                                                                                                                 |
| **Repatriation linking changed**                                 | Current local repatriation constructs a placement-requested movement linked directly to the existing admission; the older snapshot used `sourceAdmissionId`. The older automatic sending-admission departure block is absent from the current arrival handler. Constructor tests pass, but origin/receiving admission and bed handoff need a dedicated scenario. **No double-counting or deployed failure is claimed.** |
| **Inter-ward approval has a scoped source gate**                 | Protected admission-care transfer acceptance requires the central coordinator. This is not proof that every legacy referral/transfer entry route enforces the same decision. Confirm requesting, receiving and coordinator responsibilities across a complete transfer.                                                                                                                                                 |
| **Bed-release work and patient departure are different records** | The deployed discharge interface separates anonymous planned bed-release work from admission-record history and exposes release barriers. Keep departure, release status, availability and activity coding separate.                                                                                                                                                                                                    |
| **Transport status is not external execution proof**             | Deployed transport shows job stages and next actions. No booking, dispatch, collection or delivery was performed; the UI does not prove a transport provider has acted.                                                                                                                                                                                                                                                 |
| **Network is a capacity/placement view**                         | Deployed Network organises ED pressure and ward capacity. The master is a workflow diagram; the WA register is a broader service-interface design. Their different purposes should remain explicit.                                                                                                                                                                                                                     |
| **Broader WA services exceed the verified app scope**            | A diagram category is not a deployed capability. Dedicated WISH, walk-in, virtual-care, home-admission and other programme workflows were not verified end-to-end in Ward Flow.                                                                                                                                                                                                                                         |

Two focused, offline current-source files passed **22 tests**: community diversion and core-engine
behaviour. Provider tests were disabled. Those tests support the particular tested paths, not a
full programme, legal, deployed, backend or site-acceptance claim.

## Internet/pathway review

This was a bounded search and linked-page review of official WA Health, WACHS, EMHS, MHC,
WAPHA and relevant service-provider material. It reviewed entry, acute/home/virtual care,
specialist/community interfaces, residential support, transport, absence, discharge and external
handover families. It did not crawl the entire internet or approve every facility's operating rules.

New categories/interfaces:

- **Ambulance mental health co-response:** assessment of eligible ambulance callers and a
  clinician/paramedic response where indicated. The programme is not a routine direct booking
  or an inpatient admission. [WA Health](https://www.health.wa.gov.au/Improving-WA-Health/Ambulance-Mental-Health-Co-Response).
- **WAVED:** a distinct accepted virtual emergency assessment channel; programme eligibility
  and current referral arrangements need confirmation. It is different from HITH and mental
  health crisis triage. [WA Health access announcement](https://www.health.wa.gov.au/News/2025/WAVED-Expansion-More-WA-patients-to-access-emergency-care-from-home).
- **WISH:** country child specialist virtual care referred through local hospitals/ICAMHS,
  alongside the local responsible team. [WACHS](https://www.wacountry.health.wa.gov.au/News/2026/08/07/New-virtual-specialist-mental-health-service-for-children).
- **Adult Medicare Mental Health Centres:** initial walk-in access does not universally require
  a GP referral, diagnosis, appointment or Medicare card. Onward care remains conditional.
  [WAPHA](https://news.wapha.org.au/what-are-medicare-mental-health-centres-and-what-support-do-they-provide/).
- **Child/family Kids Hub:** community wellbeing access has distinct local population and
  catchment rules. [Parkerville](https://parkerville.org.au/engage/news/kids-hub-launch),
  [MHC access summary](https://www.mhc.wa.gov.au/getting-help/other-support-services/gps,-psychologists-and-psychiatrists).
- **headspace and digital support:** youth community and remote support remain distinct from
  crisis response, youth inpatient care and home admission. [WA provider](https://headspace.org.au/headspace-centres/rockingham/),
  [eheadspace](https://headspace.org.au/online-and-phone-support/connect-with-us/).
- **Older-adult community coordination:** programme-specific assessment/navigation has
  exclusions and is not an older-adult psychiatric bed. Published opening/referral information
  is not current capacity proof. [EMHS](https://emhs.health.wa.gov.au/Health-Professionals/Older-Adult-Health-Hub-Referrals).

The current ambulance-to-ED policy is **MP 0199/26**, effective 28 August 2026, superseding the
older policy. It reinforces the distinction between transport/arrival and clinical handover.
The policy summary was read; no procedure timings or statutory algorithm were encoded.
[WA Health policy](https://www.health.wa.gov.au/About-us/Policy-frameworks/Clinical-Services-and-Planning/Mandatory-requirements/Emergency-Care/Ambulance-Transfer-of-Care-Policy).

Two source inconsistencies remain explicit: the MHC adult-centre summary and a provider listing
give different hours; the WA mental-health transport page gives conflicting interhospital hours
and states a 2023 review date. Do not hard-code universal availability or country/metro provider
rules. [MHC summary](https://www.mhc.wa.gov.au/getting-help/other-support-services/gps,-psychologists-and-psychiatrists),
[provider listing](https://www.wapha.org.au/medicare-mental-health-centres/mirrabooka/),
[transport page](https://www.health.wa.gov.au/Articles/J_M/Mental-health-patient-transport).

## Remaining review needs

Current full mental-health bed-access/escalation policy, site-specific direct-admission rules,
private funding, forensic/court/cross-border authority, full current statutory forms, emergency
plans and bed/activity coding remain unverified. Consumer-chosen cultural/ACCHO, interpreter,
family and accessibility support stays visible alongside care without automatic routing by identity.
No unconfirmed absence, closure or refusal automatically releases a bed or grants detention power.

The ordered-pair register enumerates every pair in the **finite 48-category taxonomy**. Its
classification combines mechanical triage with the curated family review. Missing direct links
are not evidence of impossibility; indirect graph examples do not prove clinical compatibility.
Forty-two source records have individual access dates and limitations; the 30 earlier records
retain their original dates. No claim of universal perfection or operational approval is made.

## Evidence and delivery

Source integrity, generation consistency, route/pair/example checks and browser evidence are
retained in this task's private `evidence/2026-10-13` folder and checkpoint. The standalone
file remains self-contained. Local wireframe/source-review completion is separate from user
acceptance, app integration, publication, hosted CI, deployment and operational readiness.

Fresh preview checks covered desktop 1280×720, tablet 768×1024 and phone 390×844, master-first
opening, search and preserved zoom, keyboard panning/overview, readable zoom, focus/Escape,
side/modal details, overlay/highlighting, all six views, both new examples and the 60-row latest
download. No preview console errors were observed. Responsive browser sizes do not prove a
physical phone; blank-space drag and pointer overview were not directly exercised. Reduced-motion
and forced-colours styles are included, but this is not an assistive-technology or full WCAG audit.
The original 40 category objects, 409 route objects, 30 source records and nine examples were
checked for deep equality with the preceding commit, alongside unchanged embedded master data,
inline JavaScript parsing, generation consistency and CSV shapes/counts.
