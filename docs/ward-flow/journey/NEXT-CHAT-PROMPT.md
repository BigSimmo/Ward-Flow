# Prompt for the next Journey Explorer chat

> **Historical prompt; do not use as instructions.** It predates the 27 September source review,
> the current 96-action map and the ward-line rule that only the fold steward folds branches.
> See `CURRENT-REVIEW.md` and the Ward Flow README for current status and ownership.

Paste everything below the line into a new chat.

---

Continue the Ward Journey Explorer work.

Read `docs/ward-flow/journey/HANDOVER.md` first, including its "Update, 25 September 2026" section.
Work in your own new branch off the ward line `codex/task-ward-flow-live-state-20260831`, not in the
shared `D:/Worktrees/Database/ward-lead` folder, then fold back into the ward line when done. Before
folding, check that `git status` in ward-lead is empty and never overwrite anyone's uncommitted work.
Do not push. "Fold into main" means the local ward line only. Be efficient: run only the tests your
change touches, and avoid the 20-minute full suite unless a figure on the page needs it.

Outstanding, in order:

1. **Two unreached refusals have no test yet** (lines as of `3e38413195`; re-find by message):
   - PULL_PATIENT "points at admission …, which is not a bed held at …": no route to it was found.
     Either find one, or pin it as unreachable with a comment citing the code.
   - PULL_PATIENT's high-acuity refusal on a second pull: reachable in principle with a new
     high-acuity referral walked to a pull, stepped back, and pulled again at a full ward.
     Follow `tests/ward-refusal-gaps-bed-holding.test.ts`: real events only, one control per case.
2. **Refresh the page figure** once the next full run happens anyway. It shows 38 unreached; a
   targeted run of the new tests reached 27 of those, so it should drop to 11. Command:
   `node scripts/run-vitest.mjs run --coverage --coverage.reportOnFailure=true ward-` then
   `npm run ward:journey`. Without `reportOnFailure` the report is silently deleted.
3. **Josh is to rule on eleven actions with no screen** (build a screen, or remove): recording a
   patient discharge (old path), arrival-lateness check, legal form continuation, country extension of
   the legal clock, flag a legal mismatch, override a legal mismatch, raise a hand-set 48-hour/7-day
   clock, clear it, release the bed and reopen the search in one step, send a message to a ward,
   sweep beds held during leave. Do not build or remove any until he rules.
4. **Engine and screen issues found, handed to the audit session. Check whether they have been fixed**:
   the alerts page's "of 23 units acknowledged" has 23 typed in rather than counted from the data;
   the broadcast-alert dispatch does not check severity, category or scope against their lists and
   turns a duration of zero or less into four hours; a repeat acknowledgement is silently ignored, and
   no check is made that the unit exists or the alert is still active; standing down an already
   stood-down alert is not refused; and the community screen records a clinical contact with the role
   fixed as "community" whatever the viewer's role.
5. **Keep the map current.** Whenever the engine gains an action, `npm run ward:journey` refuses
   until it is added to `actions.json` and `build-explorer.mjs`'s WRITES or `machines.json`.
