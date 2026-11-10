# Desk task-fit walk on a busy day (template)

**Audience:** Josh, builders and whoever runs the walk. **Status:** draft template, not yet run. **Owner:** Documentation. **Written:** 10 November 2026 for M95 of the master audit list.

The [8 November desk walk](desk-walk-2026-11-08.md) checked access and page errors. This walk checks **task fit**: on the busiest synthetic day, can each desk do its normal and exception jobs, with nothing it needs hidden and nothing it may not do looking tappable? Run it before each client demonstration. Copy this file to `desk-task-fit-walk-YYYY-MM-DD.md`, fill it in, and keep the template unchanged.

**Still to do (a person or an agent with a browser):** run the walk, record the results, and file each finding as an issue. Filing issues uses GitHub, so it needs Josh's yes for that step. Nothing below has been run yet.

## How to run it

- Synthetic data only. Use the demo reset's **Winter surge** day (every ward full or nearly full, more people waiting in ED). For the ED desk, also run **ED crisis**. Never type a real name; use the seed's synthetic patients.
- Local server (`npm run ensure`), role access on (`?flags=role-access:on`), each desk chosen the way the tour spec chooses one. Desktop 1440 by 900, then phone 390 by 844.
- For each task: do it, then note **Found** (could you find the control within about 10 seconds?), **Done** (did it finish?), **Hidden** (was anything needed off screen, behind More or folded away without a hint?) and **Looks tappable** (did a control you may not use look like you could press it?).
- An agent can run this in a browser. It must report what it saw, and must not claim a pass for a step it did not do.

## Record

Date, commit, scenario, device, who ran it:

| Desk              | Task (normal / exception)                                    | Found | Done | Hidden | Looks tappable | Note or issue |
| ----------------- | ------------------------------------------------------------ | ----- | ---- | ------ | -------------- | ------------- |
| Bed coordinator   | Normal: find the longest ED wait and open the person         |       |      |        |                |               |
| Bed coordinator   | Normal: refer a waiting person to a ward and see it accepted |       |      |        |                |               |
| Bed coordinator   | Exception: a pulled bed whose pull time limit has passed     |       |      |        |                |               |
| Bed coordinator   | Exception: a ward declines; ask more wards                   |       |      |        |                |               |
| Site bed manager  | Normal: confirm the site's ready beds on Capacity            |       |      |        |                |               |
| Site bed manager  | Exception: a ward that has not confirmed its beds            |       |      |        |                |               |
| Nurse in charge   | Normal: answer a referral (can take, after a discharge)      |       |      |        |                |               |
| Nurse in charge   | Normal: record a discharge and see the bed come free         |       |      |        |                |               |
| Nurse in charge   | Exception: a discharge held up; record why                   |       |      |        |                |               |
| ED clinician      | Normal: raise a person needing a bed                         |       |      |        |                |               |
| ED clinician      | Exception: a person waiting over 24 hours; escalate          |       |      |        |                |               |
| Community team    | Normal: refer from the team's own desk                       |       |      |        |                |               |
| Community team    | Exception: a referral the team cannot take; decline it       |       |      |        |                |               |
| Transport officer | Normal: accept a job and mark the patient collected          |       |      |        |                |               |
| Transport officer | Exception: the bed for a booked job is given back            |       |      |        |                |               |
| Executive         | Normal: read occupancy and waits on Statistics               |       |      |        |                |               |
| Executive         | Exception: try to open a patient (must not be offered)       |       |      |        |                |               |
| Access admin      | Normal: review who has access                                |       |      |        |                |               |
| Access admin      | Exception: try a clinical action (must not be offered)       |       |      |        |                |               |
| Every desk        | Help: find the task in Help and run Show me                  |       |      |        |                |               |
| Every desk, phone | The same normal task on the phone, with the floating bar     |       |      |        |                |               |

## Findings

List each finding with the desk, the task, what was seen and the issue number once filed. Clinical wording, legal status or eligibility questions go to Josh, not into a fix.
