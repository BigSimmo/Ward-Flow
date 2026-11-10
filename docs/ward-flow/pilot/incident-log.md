# Pilot incident log

_Created 2026-11-08 - template for logging shadow pilot incidents; checked against source at `main` `d85618e6`; Documentation owns._

**For:** anyone on a pilot ward, the bed coordinator on shift, and Josh. **Status:** current
template. Copy the blank table into the pilot's own log (paper or a shared sheet the site
approves). Do not keep the live log in this repository.

In the shadow pilot the ward whiteboard is the record. Ward Flow runs beside it with invented
patients. If the two disagree, **the whiteboard wins**. Log the difference. Never act on Ward Flow
alone.

## What to log

Log anything that did, or could, affect bed flow or privacy. For example:

- **Wrong offer:** Ward Flow showed a bed, ward or referral that did not match the whiteboard.
- **Lost update:** a change someone made is missing, or came back different after a reload.
- **Outage:** Ward Flow would not load, kept saying the connection is unavailable, or kept showing **Retry**.
- **Privacy concern:** a real patient's details typed in, a screen photographed or shared, a
  password seen or shared, or someone signed in who should not be. Also follow the
  [breach plan](breach-plan.md) straight away.
- **Anything else** that slowed bed flow, confused staff or looked unsafe.

If you are unsure, log it. A short entry is better than none. Near misses count. The route every desk uses is the
[safety incident route](safety-incident-route.md).

## Fields

| Field                | What to write                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| ID                   | Pilot site code, date and a number, e.g. `SITE-A-2026-11-12-01`                                     |
| Date and time seen   | When you noticed it (24-hour clock, AWST)                                                           |
| Reported by          | Your role, not your name if the log is shared widely                                                |
| Type                 | Wrong offer, lost update, outage, privacy concern, or other                                         |
| Severity             | From the scale below                                                                                |
| What happened        | What you saw, in plain words. Screen name and button if you know them. **No real patient details.** |
| Whiteboard affected? | Yes or no. If yes, what was done on the whiteboard                                                  |
| Who was told         | Roles and times                                                                                     |
| Action taken         | What was done, by whom, when                                                                        |
| Status               | Open, watching or closed                                                                            |
| Review needed?       | Yes or no (see "After the incident")                                                                |

## Severity scale

| Severity   | Plain meaning                                                                                         | Who to tell, and how fast                                      |
| ---------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Urgent** | Could harm a patient, or personal information may have left the pilot. Includes any privacy concern.  | Bed coordinator on shift and Josh, now. Follow the breach plan |
| **High**   | Ward Flow cannot be used for the shift, or it showed something that could have misled a bed decision. | Bed coordinator on shift now; Josh the same day                |
| **Medium** | Something was wrong or missing, but staff noticed and a workaround worked.                            | Log it; Josh within a working day                              |
| **Low**    | A nuisance: slow, confusing wording, a layout problem.                                                | Log it; reviewed weekly                                        |

If in doubt, choose the higher level.

## The first hour

1. **Make it safe.** Use the whiteboard for every bed decision. Tell the people at the bed meeting.
2. **Write the time** you noticed it, and start an entry.
3. **Tell the bed coordinator on shift.** They decide whether the ward stops using Ward Flow for
   now. This matches the app's Help: "Tell the bed coordinator on shift. They decide when everyone
   switches to paper" ([common questions](../desk-guides/common-questions.md#what-if-ward-flow-is-down)).
4. **If it is about privacy**, follow the [breach plan](breach-plan.md) now. Do not forward, repost or
   delete anything.
5. **Keep what you saw.** Note the screen and the message wording. If the app says a change has not
   saved, stay on the page and press **Retry**; do not reload.
6. **Tell Josh** for Urgent and High. He decides any change to the hosted service. Technical first
   steps are in the [operations runbook](../OPERATIONS-RUNBOOK.md#common-incidents-first-steps).
7. **Update the entry** with who was told and what was done.

## After the incident

Ward Flow has no approved post-incident review procedure yet; it is on Josh's parked list
([product brief](../product-brief.md)). Until one is agreed, review every Urgent and High entry,
and any repeated Medium entry, like this:

1. Within a week, Josh, the bed coordinator involved and the pilot site lead (**to be named**) meet
   for 30 minutes.
2. Build a short timeline from the log, the whiteboard and Ward Flow's own history. The bed
   coordinator can open the patient chronology report, which lists one invented patient's events in
   time order.
3. Agree what happened, why, and what changes: a fix, a training note, a [known issue](known-issues.md),
   or a change to the [breach plan](breach-plan.md).
4. Record the outcome and close the entry.

## Log

| ID  | Date and time seen | Reported by | Type | Severity | What happened | Whiteboard affected? | Who was told | Action taken | Status | Review needed? |
| --- | ------------------ | ----------- | ---- | -------- | ------------- | -------------------- | ------------ | ------------ | ------ | -------------- |
|     |                    |             |      |          |               |                      |              |              |        |                |
|     |                    |             |      |          |               |                      |              |              |        |                |

**Invented example** (not a real event, not a real patient):

| ID                   | Date and time seen | Reported by     | Type        | Severity | What happened                                                                                                                                    | Whiteboard affected?                    | Who was told                               | Action taken                                                                              | Status | Review needed? |
| -------------------- | ------------------ | --------------- | ----------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------- | ------ | -------------- |
| SITE-A-2026-11-12-01 | 12 Nov 2026, 09:20 | Nurse in charge | Lost update | Medium   | Pulled a bed for invented patient "Sam Placeholder" on the Movements screen. After the bed meeting the bed showed as Ready again. No error seen. | No. Whiteboard showed the bed as pulled | Bed coordinator 09:25; Josh 11:00 by email | Bed pulled again in Ward Flow at 09:30. Screen and time noted. Josh to check the history. | Open   | Yes (repeat)   |
