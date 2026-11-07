# 7 Nov 2026, triage and risk built into the app (PR number to follow)

Measured locally (Ward Flow production build, `next build --webpack` into an owned `.next-playwright` directory) on branch `triage-app-build`, against the same measurement of its base `c6d8bd3cd` (in brackets).

Raised, each to the measured size plus about 0.2 KB:

- Home `/ward-flow`: 561.8 KB (560.0). Budget 561.3 raised to 562.1.
- Referrals `/ward-flow/referrals`: 559.8 KB (558.6). Budget 559.7 raised to 560.0.
- All EDs `/ward-flow/ed`: 516.6 KB (515.4). Budget 516.1 raised to 516.9.
- My ward `/ward-flow/ward/rph-adult-secure`: 593.5 KB (591.4). Budget 592.4 raised to 593.8.
- Movement `/ward-flow/movements/WF-001`: 588.1 KB (586.6). Budget 587.8 raised to 588.4.
- Capacity `/ward-flow/capacity`: 657.8 KB (655.9). Budget 657.1 raised to 658.0.
- ED detail `/ward-flow/ed/arm-ed`: 652.1 KB (647.9). Budget 649.0 raised to 652.3.
- Bed meeting TV `/ward-flow/bed-meeting`: 569.6 KB (567.5). Budget 568.9 raised to 569.8.
- Statistics `/ward-flow/statistics`: 608.6 KB (606.1). Budget 607.8 raised to 608.9.

Why it grew: every screen carries the shell and the engine. The triage form, its lists, the reducer slice and the stored-state schema are all loaded on demand and are in no phone first load (checked in the built chunks). What the first load gains is small: the bar's New button and its on-demand menu loader, New triage in the phone Create sheet, two route titles and back links, two role-access screens, and the new event's entries in the event role, persistence, history and shared scoping tables. The rest of the measured growth is webpack moving shared modules between chunks (the Home page chunk grew 3.4 KB while a shared chunk shrank 3.2 KB). Trim tried: the new route's nav reason string was shortened; it changed the measurements by under 0.1 KB. Every raise is under the 5 KB per screen allowance in HOW-WE-WORK section 6. Not yet measured on hosted CI.
