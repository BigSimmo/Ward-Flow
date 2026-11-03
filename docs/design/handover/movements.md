# Movements handover (1 Nov 2026, 09:25 UTC)

1. PR #1222, branch claude/project-thread-t1u1sz, head 9f94cd6c7. Marked ready 09:27 UTC; auto-merge not armed. PR activity watch could not be set up.
2. CI fix pushed: the CSS module build failed on bare `[data-phase]` / `[data-series]` selectors; they are now scoped to .phaseBar/.phaseDots/.phaseKey and .bars/.legend.
3. All 35 failing tests moved to the approved v4 design. Local run of the 10 files: 119 passed. Hosted CI on 9f94cd6c7 was still queued at 09:27 (no result yet).
4. Tests for the removed Tier 1 card (Q102) were dropped: 3 D-b pill tests (service-scope) and "All in Waiting" link (waiting-links). Jump tests now use the Where they wait heat map.
5. One small source change for tests: `data-transport-key` on each Transport now row (movements-screen.tsx).
6. Not done: movements-tier-one-now.tsx is now unused (dead-code check may flag it; delete it with Josh's yes); branch is behind current main (merge main in if CI asks); browser QA vs mock-up https://claude.ai/artifact/SGscDcq4LSpMyCmVrHsdey; phone script budget.
7. Next: read hosted CI on 9f94cd6c7 and fix only if red; arm auto-merge only if Josh says so.
8. Josh's pushed local work: wip/main-checkout-screens-20261101 has a small movements-screen.tsx edit (11 lines) not yet compared; codex/role-runtime-20261025 is older role work, not Movements UI.
9. Claims still active: /mnt/project-files/ward-flow/ownership.md and issue #688 comment 6555948932. Release both when the PR merges.
10. Local run needs Node 24 (PATH=/opt/node24/bin) and WARD_SIGNOUT_FILE=/mnt/project-files/ward-flow/ownership.md; clone must be unshallowed for the push guard.
11. Open questions: none.

## Update 1 Nov 10:57 UTC (resumed)

- Head de35239c4. Outside commits kept (Q134 option 1, both match the mock-up): c00504d (merge main), 94c527c8e (declared tokens, inline-form guard). Nothing reverted.
- Fixed CI red on 94c527c8e: knip (deleted movements-tier-one-now.tsx and 4 dead exports) and 3 browser checks re-pointed to the new layout (ui-ward-roles transport panel x2, ui-ward-responsive-audit Movements panel). Browser checks not run locally (Chromium version mismatch); hosted CI is the proof.
- Branch matches the v4 patch plus the later text cuts. CI re-check scheduled 11:26 UTC.
- Audit note (11:13) checked: "Add movement" and "Arrivals, next" are only in movements-mockup.html, the superseded hand-made v1 HTML, not the approved v4 preview, so they stay out. .focusChip is from the v4 patch, so it stays.
- 11:27: CI on de35239c4: everything green except browser journeys 3, one Discharges test (ui-ward-discharges.spec.ts:459, transferred-to-custody history), which passed on the previous run and touches no Movements code. Re-ran the failed jobs once; re-check 11:42.
- 11:40: PR was conflicted with main (Discharges #1229 also registered its preview). Merged main in as 7c95f5057, keeping both registrations; typecheck, lint and 13 related test files pass locally. PR is ready (not draft). New CI running.

## Update 1 Nov 2026, 12:35 UTC (PR #1222 review and phone fixes)

- All 12 review threads answered and resolved. Fixes: c24f524f9 (count), 92df3d6ae (timeline, pop-up focus, CSS cleanup, tabs), fbf0080d0 (worklist two-line rows below ~53rem column, trGroup merge, .trFeed class).
- Merged origin/main (ac1d7e432); kept both Movements and Handover preview registrations.
- Phone audit fix 3b86a7214: Arrange is now in a PhoneFilterFold ("Arrange the list"), and the three link cards sit after the worklist.
- Not seen on screen: tablet two-line rows and the phone fold. Josh's PC session should screenshot at 820 and 390.
- No reverts were needed under Q134.
