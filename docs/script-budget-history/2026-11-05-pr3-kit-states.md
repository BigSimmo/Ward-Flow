# 2026-11-05 Design audit 3 (kit, focus and states): three budgets nudged

Local production builds (`WARD_GATE_BUILD=1 npm run build`, then `node scripts/check-script-budget.mjs`) on main 60d2e6f0 and on this branch:

- Home `/ward-flow`: 555.9 KB on main, 557.4 KB here. Budget 557.8 unchanged.
- Referrals `/ward-flow/referrals`: 550.3 KB on main, 552.1 KB here. Budget 551.8 raised to 552.6.
- ED `/ward-flow/ed`: 511.1 KB on main, 512.8 KB here. Budget 516.1 unchanged.
- RPH ward `/ward-flow/ward/rph-adult-secure`: 585.6 KB on main, 588.8 KB here. Budget 587.2 raised to 589.3.
- Movement `/ward-flow/movements/WF-001`: 581.7 KB on main, 583.6 KB here. Budget 583.2 raised to 584.1.

Every screen gains about 1.5 to 1.8 KB from the shared kit: the reason text for unavailable controls (K11) on every field, choice and list picker, the sheet's focus fallback to the dock or Menu (D3), and the offline note moved to the page foot. The RPH ward gains another 1.5 KB because its drawers now use the kit's typed HH:MM time box (W14) in place of the browser's time picker. A trim was tried first: the five copies of the "control, then its reason" wrapper in `form.tsx` became one helper, which saved about 0.1 to 0.2 KB. Budgets are set to the measurement plus 0.5 KB. Every rise is under the 5 KB limit.
