# Ward Flow word list

**Audience:** anyone writing on-screen text, Help, guides, the demo script or TV copy. **Status:** maintained,
the single source of truth for Ward Flow's words. **Owner:** Documentation. **Written:** 24 October 2026 from
`main` plus PR #680, after a wording audit of every screen.

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

## A patient's journey

The stage words, in order: **Referred**, **Review**, **Accepted**, **Pulled**, **Handover ready**, **Moving**,
**Arrived**.

| Say                | Means                                                                                    | Do not say                    |
| ------------------ | ---------------------------------------------------------------------------------------- | ----------------------------- |
| **Movement**       | One patient's journey to a bed, from the request to arrival.                             |                               |
| **Referred**       | A destination has been asked for, and nothing has answered yet.                          |                               |
| **Review**         | At least one unit is weighing up whether it can take the patient.                        |                               |
| **Accepted**       | A unit has agreed in principle, and no bed is pulled yet.                                |                               |
| **Handover ready** | The bed and paperwork are ready. Only the physical move is left.                         |                               |
| **Moving**         | The patient has been collected and the move is under way.                                |                               |
| **Arrived**        | The patient has arrived, and this leg of the journey is complete.                        |                               |
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

| Say               | Means                                                                               |
| ----------------- | ----------------------------------------------------------------------------------- |
| **ECT**           | Electroconvulsive therapy.                                                          |
| **NIC**           | Nurse in charge.                                                                    |
| **NUM**           | Nurse unit manager.                                                                 |
| **CAHS**          | Child and Adolescent Health Service.                                                |
| **EMHS**          | East Metropolitan Health Service.                                                   |
| **NMHS**          | North Metropolitan Health Service.                                                  |
| **SMHS**          | South Metropolitan Health Service.                                                  |
| **WACHS**         | WA Country Health Service.                                                          |
| **ED**            | Emergency department, after first use.                                              |
| **AWOL**          | Absent without leave. On screen, written in full where there is room.               |
| **CTO**           | Community treatment order.                                                          |
| **EDD**           | Expected date of discharge.                                                         |
| **ETA**           | Estimated time of arrival, as quoted by the transport provider or the ward.         |
| **MDT**           | Multidisciplinary team.                                                             |
| **MHA**           | The Mental Health Act, the WA law the legal forms are named from. Never "MHA 2014". |
| Sign in, sign out | Never log in or log out.                                                            |

**Open question for Josh:** the coordinator's role is called "Bed coordinator" on most screens and
"Flow coordinator" in the recorded decision field and some demo text. One name should win; until Josh
chooses, do not add a third ("bed flow coordinator", "bed manager" for this role).

## Screens, figures and urgency

Added 26 October 2026 with the Help glossary, so the two stay in step.

| Say                      | Means                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| **Being made ready**     | A released bed still being prepared. It may not be offered as Ready yet.                             |
| **Confirmed out**        | A discharge the ward has confirmed. Due out is expected but not confirmed.                           |
| **Past date**            | Still on the ward after the expected discharge date.                                                 |
| **Short**                | More people waiting than beds that fit, for one kind of bed. Spare and Enough are the other two.     |
| **Cohort**               | The age group a bed is for: Adult, Older adult or Youth.                                             |
| **Secure bed**           | A locked bed. Describes the ward, not the patient's legal status.                                    |
| **CLD**                  | Criteria led discharge, with the criteria the treating psychiatrist set.                             |
| **CLD ready**            | Every criterion for criteria led discharge is met.                                                   |
| **Fit to travel**        | The ED doctor's recorded medical clearance, needed before transport.                                 |
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
| **Demo**                 | The Demo panel: scenario, clock and reset for the invented data.                                     |
| **Synthetic**            | Invented. Every patient, bed figure and record in Ward Flow is made up.                              |

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

## Style

- Australian spelling (colour, centre, organise, cancelled, stabilisation). Do not say US spelling (organize, stabilization, utilization, canceled, behavior, favorite).
- Sentence case for buttons, labels and headings ("On leave", not "On Leave").
- Say what happened, then what to do next. No exclamation marks.
