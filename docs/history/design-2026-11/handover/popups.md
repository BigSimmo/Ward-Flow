# Pop-ups handover (1 Nov 2026, 09:22 UTC)

- PR #1226 "Top bar Activity button opens Home's Activity panel on every page (Q99)", branch claude/project-thread-vpsn10-activity, head 1329c0ad. Auto-merge armed (Josh's yes); never turn it off or merge by hand.
- CI at faacab65: one red, unit shard 7 (tests/ward-inline-form-holds.test.ts: register missing coordinator/activity-panel.tsx). Coverage and "Ward Flow required" failed after it.
- Fix pushed 1329c0ad: added activity-panel.tsx as "popup" to REGISTER. Not run locally (container has Node 22, repo needs 24). Hosted CI at 09:27: every job green incl. unit shard 7; only the "Ward Flow required" summary was still queued; bot-author policy showed cancelled (a superseded run).
- Claim noted on issue #688. PR activity subscription failed (likely another session holds it), so check CI by hand.
- Q122 (tally line "Synthetic state · demo time") and Q123 (no search box in the bar drawer, chips stay): Josh said yes to both. The build already matches, so no code change.
- helper6/print-overlays: already merged as #1003 (27 Oct), and main now has newer versions of its files. No new PR, because one would revert main.
- Next: confirm "Ward Flow required" is green on #1226 at 1329c0ad. If it's green, auto-merge lands it. Then release claims/20261101T0812Z-claude-project-thread-vpsn10-activity.md and give the text-cut thread the merge hash. If it's red, read the failed job log and fix on the branch.
- Leftover: ward-bar-activity.tsx, useWardBarActivity and the old drawer styles stay until the mock-up viewer stops importing them.
- DONE 10:41 UTC: #1226 merged green into main as 6cdad2d2c. Left for Josh's PC: release claims/20261101T0812Z-claude-project-thread-vpsn10-activity.md (that log is not reachable from the cloud).
