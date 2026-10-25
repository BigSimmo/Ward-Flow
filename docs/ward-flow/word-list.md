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

| Say                  | Means                                                                              | Do not say                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Pulled**           | A bed kept for one named, accepted incoming patient (D-81).                        | bed held, held bed or hold for an incoming patient; "Inbound" as a bed status              |
| **Pull time limit**  | How long a pulled bed is kept before it returns to the ward.                       | hold time limit; reserved time                                                             |
| Pull the bed         | The button that pulls a bed.                                                       | hold the bed                                                                               |
| Pull expired         | A pulled bed whose pull time limit has passed. A person decides what happens next. | bed hold expired                                                                           |
| Pulled bed released  | A pulled bed given back to the ward.                                               | bed hold released; held bed released after transport (say "Pulled bed released after ...") |
| the pull on the bed  | The pull itself, in a sentence.                                                    | hold on the bed                                                                            |
| Needs the bed pulled | A step that waits for a pull.                                                      | needs the bed held                                                                         |
| **Held bed**         | A bed kept for its own patient on leave or away (at an ED, absent without leave).  | pulled, for a leave bed                                                                    |
| Ready                | A bed the ward has confirmed is clean and staffed for an admission.                | ready vacant                                                                               |
| **Confirmed beds**   | The bed figures a ward last confirmed, with the time it did so.                    |                                                                                            |
| Closed               | A bed out of service that cannot be given to anyone.                               |                                                                                            |
| Held up              | A discharge or move that is delayed. Not a bed state.                              |                                                                                            |

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
| **Act now**        | Something due now or overdue. It shows first on every list that has it.                  |                               |

## Records and forms

| Say                     | Means                                                                             |
| ----------------------- | --------------------------------------------------------------------------------- |
| **Legal form**          | The legal form a person recorded for a movement, with its due time as recorded.   |
| **Tentative diagnosis** | A broad ICD-10-AM Chapter V block from a fixed list. Never a confirmed diagnosis. |
| **UMRN**                | Unit medical record number. Ward Flow uses invented ones only.                    |
| **CAD number**          | The St John WA booking number for an ambulance transfer.                          |
| Absent without leave    | Written in full on screen.                                                        |
| Specialling             | One-to-one or two-staff constant nursing.                                         |

## People, services and short forms

| Say               | Means                                  |
| ----------------- | -------------------------------------- |
| **ECT**           | Electroconvulsive therapy.             |
| **NIC**           | Nurse in charge.                       |
| **NUM**           | Nurse unit manager.                    |
| **CAHS**          | Child and Adolescent Health Service.   |
| **EMHS**          | East Metropolitan Health Service.      |
| **NMHS**          | North Metropolitan Health Service.     |
| **SMHS**          | South Metropolitan Health Service.     |
| **WACHS**         | WA Country Health Service.             |
| ED                | Emergency department, after first use. |
| Sign in, sign out | Never log in or log out.               |

**Open question for Josh:** the coordinator's role is called "Bed coordinator" on most screens and
"Flow coordinator" in the recorded decision field and some demo text. One name should win; until Josh
chooses, do not add a third ("bed flow coordinator", "bed manager" for this role).

## Style

- Australian spelling (colour, centre, organise, cancelled, stabilisation). Do not say US spelling (organize, stabilization, utilization, canceled, behavior, favorite).
- Sentence case for buttons, labels and headings ("On leave", not "On Leave").
- Say what happened, then what to do next. No exclamation marks.
