# Community screen handover (1 Nov 2026, 11:30 UTC)

- Design PR #1227 (out of draft, CI green, one open Codex P2 on capture.cjs port 3377), branch claude/project-thread-yu588b @ 7ca1e0c3e.
- Build PR #1234 (ready for review since 12:20 UTC, hosted CI all green), branch claude/project-thread-5o07zz @ f96333d0b. All six BUILD.md §7 stages are in it: the frame for every team, and the Midland sections (Team home, Caseload, In hospital, Referrals with side panel and full referral page, Clinicians) in src/components/ward-management/community/team-2026/, ported from the mock-up.
- Midland demo shows only on the live route (no supplied records, not the old `demonstration` cohort); the check matches teamId against MIDLAND_DEMO_TEAM. Calling a helper on `team` inside useCommunityScreenView trips the React Compiler lint (preserve-manual-memoization), so keep it a plain teamId match.
- Outside commits (Q134, Josh 10:54: keep the ones that match the mock-up, revert the rest): the only one is 2145e3382 (tests pointed at the new tabs). It matches, so it is kept. Nothing was reverted.
- Answered: Q125 and Q126 (09:08), Q132 Midland demo data only (10:53), Q134 (10:54). Q131 (hold Find client or clinician until Team search is approved) is still open; the search is held back.
- Local checks: typecheck, lint, push static gate, all ward-community DOM tests and the new ward-community-midland-demo test passed. Screenshots match the mock-up at 1440px in light and dark.
- CI fixes after the port: knip (unused export), raw colours to tokens, ward names from ward-sites.ts, ACMA fictional mobiles, th scope, 12px avatar text, focus-ring token; H-0117 decline test moved to Albany; Q142 (Josh 11:51) ruled the demo waits in the invented-figures guard.
- Left: Josh to merge #1234; the phone design (BUILD §8); the mock-up's "Demo 10:42" hero chip, which was not ported.
- Claims: signout/claims/20261101T0915Z, T1045Z, T1115Z and T1120Z for claude-project-thread-5o07zz; issue #688 comment 6555932670. Set WARD_SIGNOUT_FILE=/mnt/project-files/ward-flow/signout/sign-out.md.
- Setup: export PATH=/opt/node24/bin:$PATH; npm ci; git config core.hooksPath .githooks. If lint gives odd results, clear node_modules/.cache/eslint*.
- 1 Nov 12:45 UTC: #1234 merged. The phone design (Q155) is built in PR #1248, branch claude/project-thread-5o07zz @ cfbd02802, ready for review with auto-merge (MERGE) armed. The Midland phone tree is team-2026/midland-phone.tsx. Other teams keep CommunityTeamPhone, so the generic phone and intake tests now use Albany.
- Open from the phone design: Switch team in the top bar's place name (shell work, not built); the filled Record button (not a kit variant); the artifact's figures (11 CTO, 6 not seen) differ from the desktop demo data (22, 2), and the build uses the desktop data.
- 1 Nov 15:19 UTC: #1248 merged (head 36506b145). That push added phone layout for the full referral page and 'Not wired in this prototype.' (D4) on the placeholder buttons. Still open: Switch team in the top bar place name (shell work).

- 1 Nov 16:49 UTC: #1249 merged. Switch team opens from the Midland phone bar place line; the Midland phone band uses static insets so the hero no longer shifts on load (CLS ~0.009).
