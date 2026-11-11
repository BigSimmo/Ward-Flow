# Usability sessions with ward staff under pressure (session plan)

**Audience:** Josh and whoever runs the sessions. **Status:** draft plan; no session held yet. **Owner:** Documentation. **Written:** 10 November 2026 for M105 of the master audit list.

Two or three short sessions in which ward staff, including at least one person new to Ward Flow, work through synthetic exception and recovery scenarios while being interrupted. Recommended before real data, but not part of the real-data gate. The aim is to find where the screens slow people down or mislead them when they are busy, not to test the people.

**Still to do (a person):** agree the sessions with the pilot site, recruit the staff, hold the sessions and log the findings. None of this has happened. Josh decides whether findings that touch clinical wording or rules change anything.

## Ground rules

- **Synthetic data only.** The demo reset's Winter surge or ED crisis day. Nobody types a real patient's name or details, even as an example.
- **No real staff names in the notes.** Call people P1, P2, P3, with their role (for example "P2, nurse in charge, new to Ward Flow"). Keep any contact list off the repository.
- Each person can stop at any time. Nothing is recorded on video unless they agree first, and recordings stay off the repository.
- Ward Flow is a prototype, not clinical decision support. Say so at the start.

## Each session (about 45 minutes)

| Time   | Part                                                                                    |
| ------ | --------------------------------------------------------------------------------------- |
| 5 min  | Welcome, ground rules, the person's role and how long they have used Ward Flow          |
| 5 min  | A first look: "Where would you start your shift?" No help given                         |
| 25 min | Three scenarios below, with interruptions; the person thinks aloud                      |
| 10 min | What was hardest, what they would change, anything that worried them about patient care |

**Interruptions** (one or two per scenario, at a moment the facilitator picks): a phone call that needs an answer from the board ("How many beds have you got?"), a colleague asking them to look at another patient, a toast or update arriving from another desk, the device going offline for a minute.

## Scenarios (pick three to suit the person's desk)

1. **A pulled bed runs out of time.** A bed pulled for an incoming patient shows Pull expired. Decide what happens next and record it.
2. **A referral the ward cannot take now.** Answer a referral with "After a discharge", then the discharge is held up.
3. **A discharge undone.** Record a discharge, then use Undo, then record it again after a phone call.
4. **The connection drops mid-task.** Start a bed move, go offline, come back, and check what was saved.
5. **The wrong patient opened.** Two patients with similar names; confirm the right one with the UMRN before acting.
6. **A new person's first shift.** Someone new to Ward Flow finds a task through Help and runs Show me.

## What to log

For each scenario: did they finish, how long it took, where they hesitated or went wrong, what they said, and whether anything could have led to a wrong action for a patient. Rate each finding: **stops the job**, **slows it**, or **minor**. Log findings in a dated file, `usability-session-YYYY-MM-DD.md` beside this plan, then file issues (filing them uses GitHub, so it needs Josh's yes).
