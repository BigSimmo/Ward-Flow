# Handover: is an acceptance step wanted? (draft question)

_Created 2026-11-10 - audit item M19; drafted on branch `claude/project-thread-bnphlk` (from `main` `29352cd0`). Draft only: nothing here is decided._

**Status:** a question for Josh. The test half of M19 is
`tests/ward-audit-m19-handover-last-minutes.test.ts`. The checklist beside the Sign off button
belongs to another thread and is not covered here.

## What happens today (verified in source and tests, 10 Nov 2026)

- **Sign off** records the role, the time and, for one ward's sheet, the ward (decision 41). It
  says the sheet was handed over. It is not worded as an accepted transfer of care: the test scans
  every string on the Handover and site sign-off screens for acceptance wording and finds none.
- **Nothing hides a row.** Pills and chips highlight rows; they never remove them. "Due by" shows
  four rows, then "Show N more" with the count.
- **A note in the last minutes reaches the next shift as a row on the sheet**, and is counted
  "New" on the handover being received (07:00 or 15:00).
- **Finding:** the page opens on the next handover still to come. At 07:01 that is 15:00, whose
  "new since" is 07:00. A bed request opened at 06:58 is on the sheet but not counted "New" or in
  "Since 07:00" for someone who opens the page at 07:01. The test pins this as a `todo`.

## Question 1: should anyone accept a handover?

| Option                                  | What it means                                                                                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. No acceptance step** (recommended) | Sign off stays a record that the outgoing desk handed over. Clinical acceptance stays in the site's own process. Wording keeps saying "Sign off", never "accepted". |
| B. Incoming desk taps "Received"        | A second record that the incoming desk opened and read the sheet. Worded as "read", never as accepting care. A new command and audit row.                           |
| C. Formal acceptance of care            | The incoming clinician accepts responsibility in Ward Flow. A clinical governance change; out of scope for an unvalidated prototype.                                |

**Recommendation: A** while Ward Flow is a prototype on synthetic data, because a tap in an
unvalidated tool must not look like a transfer of clinical responsibility.

## Question 2: should the incoming view reach back to the handover just held?

| Option                                                                                | What it means                                                                                                               |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **A. For the first 30 minutes after a handover, open on that handover** (recommended) | At 07:01 the page opens on 07:00 with "new since 23:00", so a 06:58 note is "New". After 07:30 it moves on to 15:00 as now. |
| B. Keep today's behaviour                                                             | The 06:58 note is on the sheet but not flagged "New" after 07:00.                                                           |

**Recommendation: A**, because the incoming shift reads the sheet just after the boundary and a
last-minute note is the one most likely to be missed. This is a display rule, not a clinical one,
but it changes what the handover page shows, so it needs a ruling first.

What a person still has to do: Josh answers both questions; the answers are recorded as a D entry.
