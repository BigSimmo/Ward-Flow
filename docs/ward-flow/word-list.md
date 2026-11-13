# Ward Flow word list

**Audience:** anyone writing on-screen text, Help, guides, the demo script or TV copy. **Status:** maintained,
the single source of truth for Ward Flow's words. **Owner:** Documentation. **Written:** 24 October 2026 from
`main` plus PR #680, after a wording audit of every screen. **Updated:** 5 November 2026 (design audit 2), to
agree with [DESIGN-SYSTEM §6](../design/DESIGN-SYSTEM.md#6-words).

Use one word for one idea, everywhere. If a word is not here, use plain Australian English and add it here
when a second screen needs it. Code names (`HOLD_BED`, `ward-bed-hold.ts`, `bed_held`) are not screen text and
do not change.

`tests/ward-word-list.test.ts` enforces the "Do not say" column for screen text and checks that every Ward Flow
word in the in-app Help glossary is on this list.

## Beds

| Say                  | Means                                                                                                        | Do not say                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| **Pulled**           | A bed kept for one named, accepted incoming patient (D-81).                                                  | bed held, held bed or hold for an incoming patient; "Inbound" as a bed status              |
| **Pull time limit**  | How long a pulled bed is kept. When it passes, the bed shows Pull expired and a person moves or releases it. | hold time limit; reserved time                                                             |
| Pull the bed         | The button that pulls a bed.                                                                                 | hold the bed                                                                               |
| **Pull expired**     | A pulled bed whose pull time limit has passed. A person decides what happens next.                           | bed hold expired                                                                           |
| Pulled bed released  | A pulled bed given back to the ward.                                                                         | bed hold released; held bed released after transport (say "Pulled bed released after ...") |
| the pull on the bed  | The pull itself, in a sentence.                                                                              | hold on the bed                                                                            |
| Needs the bed pulled | A step that waits for a pull.                                                                                | needs the bed held                                                                         |
| **Held bed**         | A bed kept for its own patient on leave or away (at an ED, absent without leave).                            | pulled, for a leave bed                                                                    |
| **Ready**            | A bed the ward has confirmed is clean and staffed for an admission.                                          | ready vacant                                                                               |
| **Confirmed beds**   | The bed figures a ward last confirmed, with the time it did so.                                              |                                                                                            |
| Closed               | A bed out of service that cannot be given to anyone.                                                         |                                                                                            |
| **Held up**          | A discharge or move that is delayed. Not a bed state.                                                        |                                                                                            |

## A patient's movement

The stage words are Home's set, everywhere a stage is named in one word (Josh, 5 November 2026, design audit
card 6): **Needs a bed**, **Bed agreed**, **Ready to move**, **Moving**. The detailed steps below are only
sub-labels under those four, in order: **Referred**, **Review**, **Accepted**, **Pulled**, **Handover ready**,
**Moving**, **Arrived**.

| Stage (Home's set) | Detailed steps under it          |
| ------------------ | -------------------------------- |
| **Needs a bed**    | Referred, Review                 |
| **Bed agreed**     | Accepted, Pulled                 |
| **Ready to move**  | Handover ready                   |
| **Moving**         | Moving, then Arrived on the ward |

| Say                | Means                                                                                    | Do not say                    |
| ------------------ | ---------------------------------------------------------------------------------------- | ----------------------------- |
| **Movement**       | One patient's move to a bed, from the request to arrival.                                | journey                       |
| **Referred**       | A destination has been asked for, and nothing has answered yet.                          |                               |
| **Review**         | At least one unit is weighing up whether it can take the patient.                        |                               |
| **Accepted**       | A unit has agreed in principle, and no bed is pulled yet.                                |                               |
| **Handover ready** | The bed and paperwork are ready. Only the physical move is left.                         |                               |
| **Moving**         | The patient has been collected and the move is under way.                                |                               |
| **Arrived**        | The patient has arrived, and this leg of the movement is complete.                       |                               |
| waiting list       | Patients still waiting for a bed: "on the waiting list". "Waitlisted" is fine as a verb. | the waitlist, a waitlist      |
| Declined           | A ward said no to a referral.                                                            | rejected, refused (for wards) |
| **Out of area**    | A patient in a bed outside their home health service. No hyphen in headings or labels.   |                               |
| **Act now**        | Something due now or overdue. Lists that have it keep it in its own Act now group.       |                               |

## Records and forms

| Say                     | Means                                                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Legal form**          | The legal form a person recorded for a movement, with its due time as recorded.                                                                                                             |
| **Tentative diagnosis** | A broad ICD-10-AM Chapter V block from a fixed list. Never a confirmed diagnosis.                                                                                                           |
| **UMRN**                | Unit medical record number. Ward Flow uses invented ones only.                                                                                                                              |
| **CAD number**          | The St John WA booking number for an ambulance transfer.                                                                                                                                    |
| **Form 1A**             | Referral for examination by a psychiatrist. Titles follow the Chief Psychiatrist register. Any time shown is as typed from the paper form.                                                  |
| **Form 3A**             | Detention order. Titles follow the Chief Psychiatrist register. Any time shown is as typed from the paper form.                                                                             |
| **Form 3B**             | Continuation of detention. Titles follow the Chief Psychiatrist register. Any time shown is as typed from the paper form.                                                                   |
| **Form 3D**             | Order authorising reception and detention in an authorised hospital for further examination. Titles follow the Chief Psychiatrist register. Any time shown is as typed from the paper form. |
| **Form 4A**             | Transport order. Titles follow the Chief Psychiatrist register. Any time shown is as typed from the paper form.                                                                             |
| **Form 4C**             | Transfer order. Titles follow the Chief Psychiatrist register. Any time shown is as typed from the paper form.                                                                              |
| **Form 5A**             | Community Treatment Order. Titles follow the Chief Psychiatrist register. Any time shown is as typed from the paper form.                                                                   |
| **Form 5B**             | Continuation of Community Treatment Order. Titles follow the Chief Psychiatrist register. Any time shown is as typed from the paper form.                                                   |
| **Form 6A**             | Inpatient treatment order in authorised hospital. Titles follow the Chief Psychiatrist register. Any time shown is as typed from the paper form.                                            |
| Absent without leave    | Written in full on screen.                                                                                                                                                                  |
| Specialling             | One-to-one or two-staff constant nursing.                                                                                                                                                   |

## People, services and short forms

| Say               | Means                                                                                                          |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| **ECT**           | Electroconvulsive therapy.                                                                                     |
| **NIC**           | Nurse in charge.                                                                                               |
| **NUM**           | Nurse unit manager.                                                                                            |
| **CAHS**          | Child and Adolescent Health Service.                                                                           |
| **EMHS**          | East Metropolitan Health Service.                                                                              |
| **NMHS**          | North Metropolitan Health Service.                                                                             |
| **SMHS**          | South Metropolitan Health Service.                                                                             |
| **WACHS**         | WA Country Health Service.                                                                                     |
| **ED**            | Emergency department, after first use.                                                                         |
| **AWOL**          | Absent without leave. On screen, written in full where there is room.                                          |
| **CTO**           | Community treatment order.                                                                                     |
| **EDD**           | Expected date of discharge.                                                                                    |
| **ETA**           | Estimated time of arrival, as quoted by the transport provider or the ward.                                    |
| **MDT**           | Multidisciplinary team.                                                                                        |
| **MHA**           | The Mental Health Act, the WA law the legal forms are named from. Never "MHA 2014".                            |
| **ATS**           | Australasian Triage Scale category, as recorded at ED triage.                                                  |
| **RAMP**          | Risk Assessment and Management Plan, the WA mental health form.                                                |
| **PSP**           | Personal support person: a carer, close family member, nominated person or guardian.                           |
| **MHAS**          | Mental Health Advocacy Service.                                                                                |
| **GP**            | General practitioner.                                                                                          |
| **BPSD**          | Behavioural and psychological symptoms of dementia.                                                            |
| **AWST**          | Australian Western Standard Time, Perth time. Signed-in times are AWST; the demo's board clock says demo time. |
| **CAMHS**         | Child and Adolescent Mental Health Service.                                                                    |
| **HDU**           | High dependency unit: a ward area for patients who need closer care.                                           |
| **KPI**           | Key performance indicator, such as the national seven-day follow-up measure.                                   |
| **MHERL**         | Mental Health Emergency Response Line, the WA crisis phone line.                                               |
| **PIR**           | Post-incident review. The PIR chronology lists one patient's events in time order.                             |
| **QR code**       | A square barcode a phone camera can read to open a link, such as a desk's Ward Flow link.                      |
| **ATSI**          | Aboriginal and Torres Strait Islander.                                                                         |
| **CMHT**          | Community mental health team.                                                                                  |
| **CNS**           | Clinical nurse specialist.                                                                                     |
| **DOB**           | Date of birth.                                                                                                 |
| **ECG**           | Electrocardiogram, a recording of the heart's rhythm.                                                          |
| **EMR**           | Electronic medical record.                                                                                     |
| **FDV**           | Family and domestic violence. The FDV951 is WA Health's screening form.                                        |
| **HMDC**          | Hospital Morbidity Data Collection, WA Health's record of hospital stays.                                      |
| **ISBAR**         | Identify, Situation, Background, Assessment, Recommendation: the order of a handover.                          |
| **MBBS**          | Bachelor of Medicine, Bachelor of Surgery, a medical degree.                                                   |
| **MHN**           | Mental health nurse.                                                                                           |
| **NICE**          | National Institute for Health and Care Excellence, the UK guideline body.                                      |
| **PAS**           | Patient administration system, the hospital's admissions and bed record.                                       |
| **PSOLIS**        | Psychiatric Services Online Information System, WA's mental health record.                                     |
| **RN**            | Registered nurse.                                                                                              |
| **SMHMR**         | The form-number prefix for WA's statewide standardised mental health documents.                                |
| **SW**            | Social worker.                                                                                                 |
| **AHD**           | Advance health directive.                                                                                      |
| **BD**            | Twice a day, on a medicine line.                                                                               |
| **CK**            | Creatine kinase, a blood test.                                                                                 |
| **CR**            | Controlled release, on a medicine line.                                                                        |
| **IM**            | Intramuscular, given as an injection into a muscle.                                                            |
| **MRO**           | Multi-resistant organism.                                                                                      |
| **MSE**           | Mental state examination.                                                                                      |
| **OT**            | Occupational therapist.                                                                                        |
| **RACF**          | Residential aged care facility.                                                                                |
| **RAT**           | Rapid antigen test.                                                                                            |
| **SAT**           | State Administrative Tribunal, WA's tribunal for guardianship and administration.                              |
| Sign in, sign out | Never log in or log out.                                                                                       |

**Bed coordinator** is the coordinator's name on every screen (Josh, 26 October 2026, A19). Do not say
"flow coordinator" or "bed manager" for this role. "Bed flow coordinator" stays only as an on-call title.

**Criminal Law (Mental Impairment) Act 2023** is always written in full, never as an abbreviation such as
"CLMA" (Josh, clinical check pack E1, 13 November 2026). It is a WA Act, in operation from 1 September 2024.

## Screens, figures and urgency

Added 26 October 2026 with the Help glossary, so the two stay in step.

| Say                      | Means                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| **Being made ready**     | A released bed still being prepared. It may not be offered as Ready yet.                             |
| **Confirmed out**        | A discharge the ward has confirmed. An expected discharge is not confirmed yet.                      |
| **Past date**            | Still on the ward after the expected discharge date.                                                 |
| **Short**                | More people waiting than beds that fit, for one kind of bed. Spare and Enough are the other two.     |
| **Cohort**               | The age group a bed is for: Adult, Older adult or Youth.                                             |
| **Locked bed**           | A bed designated locked. Describes the bed, not the patient's legal status. Never "secure bed".      |
| **CLD**                  | Criteria led discharge, with the criteria the treating psychiatrist set.                             |
| **CLD ready**            | Every criterion for criteria led discharge is met.                                                   |
| **Fit to travel**        | The ED doctor's recorded medical clearance, needed before transport.                                 |
| **Road distance**        | Indicative distance by road on public map data. Never live traffic or a clinical travel time.        |
| **Access target**        | An ED performance target set in Settings. Never a legal deadline.                                    |
| **Overdue waits**        | Patients waiting longer than the target for their urgency tier.                                      |
| **T1**                   | Urgency tier 1, most urgent, as recorded on the referral.                                            |
| **T2**                   | Urgency tier 2, urgent.                                                                              |
| **T3**                   | Urgency tier 3, least urgent.                                                                        |
| **Tier**                 | The urgency recorded on the referral, T1 to T3. Lists stay in wait order; the tier only marks a row. |
| **Catchment**            | The area a community mental health team covers.                                                      |
| **Constant observation** | Staff stay with the patient, shown as 1:1 or 2:1. A person records it.                               |
| **Shift brief**          | A ward's sheet for the shift: who came in, is going, is stuck or is overdue.                         |
| **Notices**              | A ward's own messages under the bell: buzzes, urgent tasks and notices.                              |
| **Activity**             | The header drawer of recent changes and notices.                                                     |
| **Board time**           | The clock every screen works from, in Perth time (AWST).                                             |
| **Demo**                 | The Demo panel: scenario, clock and reset for the invented data. The live pill reads "Demo 10:42".   |
| **Synthetic**            | Invented. Every patient, bed figure and record in Ward Flow is made up.                              |

## Help glossary additions (5 November 2026)

Added with the Help glossary for the chronology, statistics and the newly walked screens, so the two stay in
step.

| Say                     | Means                                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Accept in principle** | A ward agrees it can take the patient. A bed is pulled as a separate step.                                     |
| **Gate**                | One of a ward's own checks for a patient, marked Pass or Does not pass. It informs the answer.                 |
| **Stranded**            | A prompt, not a judgement: a long stay with no expected discharge date, or waiting on others.                  |
| **Step-down**           | A patient the ward has marked as a candidate for subacute care.                                                |
| **Stale count**         | A ward's bed figures not confirmed lately, so they may be out of date.                                         |
| **Mismatch**            | People waiting against beds that fit, for each kind of bed, on Capacity.                                       |
| **Chronology**          | One patient's events in time order, built from the records for a post-incident review.                         |
| **Audit trail**         | Coordinator changes and overrides, with their reasons.                                                         |
| **Session log**         | What this browser session recorded, for this session only.                                                     |
| **CSV**                 | A plain spreadsheet file. Download CSV saves what you are looking at.                                          |
| **Downtime pack**       | A printable copy of the last snapshot, for when the system is down.                                            |
| **Snapshot**            | A copy of the figures at one time. Only the bed coordinator takes a new one.                                   |
| **Caseload**            | The people a community team is looking after.                                                                  |
| **Read alike**          | Community team names that look similar, set side by side.                                                      |
| **Cover**               | One ward or one ED handed to another desk for at most 12 hours.                                                |
| **In use**              | Beds occupied or pulled, as a share of a ward's beds.                                                          |
| **Occupancy**           | The share of beds in use.                                                                                      |
| **Typical**             | The median: half took less time and half took more.                                                            |
| **Slowest 1 in 10**     | The time the slowest tenth took longer than.                                                                   |
| **Stay so far**         | How long people in a bed now have been there. Not a finished length of stay.                                   |
| **Open ED movement**    | A movement that started at an ED and has not closed, including people in transit.                              |
| **Fewer than 5**        | Shown in place of a small count of people, so no one can be picked out.                                        |
| **Not recorded**        | Nobody recorded this figure. Ward Flow does not guess it.                                                      |
| **Pilot measures**      | The weekly report's own measures, such as referral to arrival.                                                 |
| **Bed meeting**         | The regular meeting on beds, with an agenda built from fixed rules.                                            |
| **Ward promise**        | A time a ward said it would ring back.                                                                         |
| **Surge**               | A Settings choice that tightens some rules at once for a busy period.                                          |
| **Undo window**         | How long a recorded decision or bed move can still be undone: 5 minutes. A software limit, not a clinical one. |
| **Wards asked at once** | A coordinator normally asks up to three wards at once. A fourth needs a recorded reason.                       |

## Save problems

Every message for a save that failed or is not confirmed says what happened, then what to do now. The
sentences live in one place, `src/components/ward-management/ward-save-failure.ts`; screens use them rather
than writing their own. A refusal that gives the workflow's own reason ("No allocatable bed on this ward.
Nothing was changed.") says that reason, because it already names what to change.

| Say                        | Means                                                                    | Do not say                                   |
| -------------------------- | ------------------------------------------------------------------------ | -------------------------------------------- |
| **Save is not confirmed.** | Ward Flow has no answer for this save; it may or may not have been kept. | "Review the board before trying again" alone |
| **Nothing was saved.**     | The change definitely did not reach the board.                           | failed to persist, error saving              |
| **Press Retry**            | Resend the same change. It is never saved twice.                         | resubmit, reload the page                    |
| **Check the board**        | Look at the current board before making the change again.                | review the workflow requirements             |
| **Waiting on this page**   | Offline: the change is kept in this page's memory and sends by itself.   | held (only for a leave bed, D-85), queued    |

When another desk changed a record first (P058), the message names the record type (bed, stay, movement, referral, alert or discharge, otherwise record) and the desk only, never a patient name, UMRN, bed number or record id: **Another desk changed this bed first. Review the latest board before trying again.** Only queued actions on that same record are stopped: **1 queued action on this bed was not sent. Check the board, then try again.** These conflict sentences live in `src/components/ward-management/ward-conflict-scope.ts` and `staleReason` in `backend/ward-flow/records.mjs`.

## Style

- Australian spelling (colour, centre, organise, cancelled, stabilisation). Do not say US spelling (organize, stabilization, utilization, canceled, behavior, favorite).
- Sentence case for buttons, labels and headings ("On leave", not "On Leave"; "Stand down", not "Stand Down").
- Say what happened, then what to do next. No exclamation marks.
- Empty lines say "Nobody", not "No one", and end a whole sentence with a full stop ("Nobody waiting in ED.").
- Short durations ("4h", "1h 30m"), never "240 minutes".

## One word for each thing (design audit 2, 5 November 2026)

This is the DESIGN-SYSTEM §6 table, with the exact phrases `tests/ward-word-list.test.ts` keeps off screen.
"Releases held up" stays on the Ward page only (Q305). Held is only a patient's own bed kept for leave or
away; pulled is a bed kept for an incoming patient; held up is a delay.

| Say                            | Do not say                                                            |
| ------------------------------ | --------------------------------------------------------------------- |
| Alerts                         | Tasks, for Alerts ("Alerts or Tasks", "Tasks drawer", "called Tasks") |
| Movement                       | Journey, as a label; journey                                          |
| Held up                        | blockers; barrier; "With blockers"                                    |
| held-up discharges             | held-up releases (Releases held up stays on Ward, Q305)               |
| Discharge due                  | due out ("No discharge due", not "Nobody due out")                    |
| Bed board                      | Stays and discharges                                                  |
| New referral                   | Raise a referral                                                      |
| Add patient                    | New patient; Add a patient                                            |
| Open or close a bed            | Open, close or hold (hold is for a leave bed)                         |
| Locked bed                     | secure bed (Secure stays only inside ward names)                      |
| synthetic numbers              | mock numbers                                                          |
| on Home                        | on Command                                                            |
| Pull expired, bed still pulled | bed pull expired                                                      |
| Stand down                     | Stand Down                                                            |
| 4h                             | minutes for a long duration ("240 minutes")                           |
| on the board                   | demo night (the live pill "Demo 10:42" stays, HOW-WE-WORK §6)         |
| Nobody                         | No one ("Nobody waiting", not "No one waiting")                       |

## Plain words (wording audit, 26 October 2026)

Held is only for a patient's own leave or away bed (D-85). Held up is for delays.

| Say                            | Do not say                              |
| ------------------------------ | --------------------------------------- |
| Discharges held up             | beds held by blockers                   |
| the pull time limit passed at  | was held until (for a pulled bed)       |
| Not recorded                   | not held (for a missing number or time) |
| record                         | dossier                                 |
| Authorised hospital            | involuntary-capable                     |
| Expected arrival (as recorded) | real-time ETA                           |
| Ward capacity                  | live capacity telemetry                 |
| Current broadcast              | active statewide directive              |
| Release pulled bed             | Release bed (for a pulled bed)          |
| Error reference                | Digest                                  |
