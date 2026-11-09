# Transport redesign: status (1 Nov 2026, 08:40 UTC)

1. State: built and pushed; PR marked ready and auto-merge armed 08:36:59 UTC (Josh 08:33). Work paused at 08:37 per Josh.
2. PR #1221 https://github.com/BigSimmo/Ward-Flow/pull/1221 · branch claude/project-thread-fb5wrm · commit 3575bde98 (pushed).
3. Left: hosted CI result; Needs transport unit tests (optional follow-up); viewer entry (viewer-entry.patch) once Movements/Handover viewer PRs land.
4. Next step (when Josh resumes): check hosted CI on #1221; if red, fix on the same branch. If green, auto-merge lands it and the daily release ships it.
5. Mock-up: https://claude.ai/artifact/VjuiDLsutRJ1tsePC94Gbz (viewer/ holds the page shells; screenshots/ the views).
6. Codex found 2 real-looking issues in my new booking panel (unverified): (a) ward/community desks' Log booking omits actingUnitId/actingPlaceId, so their save is refused; (b) no useHoldOpenForm on the desktop booking panel, so stale-form conflict protection is skipped. Fix both first on resume (officer-needs-transport.tsx). Auto-merge is armed and user-owned; it may merge before the fix.
7. Hosted 'Ward Flow static checks' failed on 3575bde (08:43 UTC), so auto-merge cannot fire yet. Cause not investigated (paused). Log: https://github.com/BigSimmo/Ward-Flow/actions/runs/41289586363/job/124798271647
8. 'Ward Flow unit shard 6' also failed on 3575bde (08:45 UTC); not investigated (paused). https://github.com/BigSimmo/Ward-Flow/actions/runs/41289586363/job/124798271706
9. 'Ward Flow unit shard 4' failed too (08:47 UTC); not investigated (paused). https://github.com/BigSimmo/Ward-Flow/actions/runs/41289586363/job/124798271722
10. 'Ward Flow coverage' failed too (08:53 UTC); not investigated (paused). https://github.com/BigSimmo/Ward-Flow/actions/runs/41289586363/job/124800619244
11. 'release-gate-desktop journeys' failed too (08:54 UTC); not investigated (paused). https://github.com/BigSimmo/Ward-Flow/actions/runs/41289586363/job/124799749454
