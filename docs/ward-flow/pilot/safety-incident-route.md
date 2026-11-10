# Safety incident and near-miss route

_Created 2026-11-10 - audit item M130; one route for every pilot desk, drawn from the [incident log](incident-log.md) and [breach plan](breach-plan.md); Documentation owns._

**For:** everyone on a pilot ward. **Status:** draft. Not yet tested with a synthetic report
(see the test at the end). The pilot lead (**to be named**) owns it once named.

## One route

Something went wrong, or **nearly** went wrong, that could affect a patient, a bed decision or
privacy:

1. **Make it safe.** Use the whiteboard and phone for every bed decision. The whiteboard wins.
2. **Tell the bed coordinator on shift, now.** In person or by phone. That is the one route, for
   every desk.
3. **The bed coordinator logs it** in the pilot's [incident log](incident-log.md) (type and
   severity from that page) and tells Josh for Urgent and High.
4. **Privacy concern** (real details typed in, a screen photographed, a password seen): the bed
   coordinator also starts the [breach plan](breach-plan.md) straight away.
5. **The hospital's own incident system** too, if the site's rules say so (pilot site lead to
   confirm).

**Near misses count.** Log them like incidents, with type "other" and the words "near miss" in
**What happened**. They show where a control almost failed.

## Report a problem in the app

**Help > Report a problem** makes a text report to paste into an email or message to the pilot
lead. It is for faults and suggestions. It is **not** the safety route: it sends nothing by
itself and nobody watches it on shift. For anything unsafe, follow the route above first, then
use Report a problem to describe it if that helps.

Gap: the in-app Report a problem screen does not yet point to this route. That is a small wording
change for a later PR, with Josh's yes on the words.

## Test once with a synthetic report

Before the pilot starts, run this once and record it:

1. Someone on a pilot ward tells the bed coordinator on shift: "Near miss: invented patient
   'Sam Placeholder' showed as ready on Movements but the whiteboard had the bed pulled."
2. The bed coordinator logs it in the pilot's incident log, severity Medium.
3. Josh is told within a working day and the entry is closed.

| Date | Desk that reported | Logged by | Minutes from report to log | Josh told | Closed | Lessons |
| ---- | ------------------ | --------- | -------------------------- | --------- | ------ | ------- |
|      |                    |           |                            |           |        |         |

_Prototype on synthetic data. Not for real patients._
