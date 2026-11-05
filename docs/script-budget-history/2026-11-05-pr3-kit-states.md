# 2026-11-05 Design audit 3 (kit, focus and states): three budgets nudged

Local production builds (`WARD_GATE_BUILD=1 npm run build`, then `node scripts/check-script-budget.mjs`) on main 60d2e6f0 and on this branch:

- Home `/ward-flow`: 555.9 KB on main, 557.4 KB here. Budget 557.8 unchanged.
- Referrals `/ward-flow/referrals`: 550.3 KB on main, 552.1 KB here. Budget 551.8 raised to 552.6.
- ED `/ward-flow/ed`: 511.1 KB on main, 512.8 KB here. Budget 516.1 unchanged.
- RPH ward `/ward-flow/ward/rph-adult-secure`: 585.6 KB on main, 588.8 KB here. Budget 587.2 raised to 589.3.
- Movement `/ward-flow/movements/WF-001`: 581.7 KB on main, 583.6 KB here. Budget 583.2 raised to 584.1.

Every screen gains about 1.5 to 1.8 KB from the shared kit: the reason text for unavailable controls (K11) on every field, choice and list picker, the sheet's focus fallback to the dock or Menu (D3), and the offline note moved to the page foot. The RPH ward gains another 1.5 KB because its drawers now use the kit's typed HH:MM time box (W14) in place of the browser's time picker. A trim was tried first: the five copies of the "control, then its reason" wrapper in `form.tsx` became one helper, which saved about 0.1 to 0.2 KB. Budgets are set to the measurement plus 0.5 KB. Every rise is under the 5 KB limit.

## Re-measured after main moved (5 Nov 2026, 17:58Z)

Main gained #1469 and #1472, which grew these screens on main alone. CI's budget gate (merged with main 538230f0) measured:

- Home: main alone 557.2 KB, this branch 558.6 KB. Budget 557.8 raised to 559.1.
- Referrals: main alone 551.7 KB, this branch 552.9 KB. Budget 552.6 raised to 553.4.
- RPH ward: main alone 587.0 KB, this branch 589.8 KB. Budget 589.3 raised to 590.3.
- Movement: main alone 583.1 KB, this branch 584.3 KB. Budget 584.1 raised to 584.8.

This branch's own growth over main stays 1.2 to 2.8 KB per screen, under the 5 KB limit. Budgets are the measurement plus 0.5 KB.
