# ED screen handover (1 Nov 2026, resumed 10:40 UTC)

- PR: #1231 (draft), branch claude/project-thread-pvkr4r. Contains #1223's commits plus the knip fix; close #1223 once #1231 merges.
- Mock-up: https://claude.ai/artifact/DoEjjRkurbQV1ziz1u9S52 (same patch as #1223). Compared at 1440 light, 1280 dark and enlarged: matches.
- Done: handover table, cells, styles (ed/ed-handover*.tsx, ed-handover.module.css), Lists card (ed-lists-desktop.tsx), header, access card; RECORD_LEGAL_FORM_CODE (Q124: form only, time blank, never now) and RECORD_ED_PRESENTATION (Q103); What's new line.
- Q128 (Josh yes, 10:53): Clear the form left out; Decline is inside the opened referral (EdInboxDecline in ed-screen-inbox.tsx). Ask for a bed stays on the new-referral row.
- Outside commits kept (Q134 option 1): 9d3969a4 removes the typed presentation draft, which matches the plan. None reverted.
- Tests: old ED tests that read the full Lists (inbox, Decline, Still to be moved, Recently answered, Expects) now run at phone width via tests/helpers/ed-phone-lists.ts. ward-ed-presentation-keeps-draft deleted (its component is gone) and recorded in diff-integrity.json.
- At 1280 the header figures wrap to two lines, as in the mock-up.
- Next: hosted CI to green, then mark ready. Auto-merge only with Josh's yes.

## 1 Nov, 11:22 UTC

- Josh said yes: close #1223 once #1231 merges (#1231 holds everything in #1223).
- CI on 93eb8c7a: unit shards failed on registry tests for the two new events (history count, permissions, sweep and fuzz candidates, undo), the handover table's name, the Form register-title test, the bay column index and What's new (21 > 20; dropped the oldest line). Fixes in the next push.
- Pushed f52b35a6 with those fixes, plus phone referral buttons at 48px (audit). Kept .listTag and .bandButton (verbatim from the mock-up, same exception as Transport). Next: hosted CI green, then mark #1231 ready; close #1223 after #1231 merges (Josh's yes).

## 1 Nov, 15:30 UTC: done

- #1231 merged (Josh marked it ready and armed auto-merge; the two Codex review points were fixed in a0ee65fa). #1223 was closed at 12:30 UTC. No ED build work is left in this thread.
