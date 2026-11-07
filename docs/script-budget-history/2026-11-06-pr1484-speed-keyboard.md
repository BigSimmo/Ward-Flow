# 6 Nov 2026, #1484 front-end audit fix PR 2 (speed and keyboard access)

Measured locally on this branch and on `main` at `60eff461`, both built with `WARD_GATE_BUILD=1 npm run build` and measured with the same phone user agent (`scripts/check-script-budget.mjs`). Main alone in brackets.

Raised, each by this PR's own growth:

- Referrals `/ward-flow/referrals`: 559.4 KB (558.0). Budget 559.4 raised to 559.7.
- RPH ward `/ward-flow/ward/rph-adult-secure`: 591.8 KB (590.1). Budget 591.5 raised to 592.0.
- Movement `/ward-flow/movements/WF-001`: 587.1 KB (586.0). Budget 587.0 raised to 587.4.

Not raised: Home 560.7 KB (559.4) against 561.0, and ED 515.5 KB (514.5) against 516.1.

The growth is 1.1 to 1.7 KB on every screen, in the shared shell and kit code every route carries: the rail's capacity strip and link names (CB-3, axe 4.14 label content), the skip link's visible-main check (BA-4), the Data Saver check in idle preloading (PERF-06), and the accessible names in the shared phone row, hero and capacity row parts. The ward screen adds the bed tile names. No new import was found; the chunk lists differ only in their numbering. Each raise is under 1 KB and inside the 5 KB per screen allowance in HOW-WE-WORK section 6.

New budgets (PERF-02), at the measured size plus 0.3 KB:

- Capacity `/ward-flow/capacity`: 656.1 KB (698.6). Budget 656.4.
- ED detail `/ward-flow/ed/arm-ed`: 648.4 KB (647.1). Budget 648.7.
- Bed meeting TV `/ward-flow/bed-meeting`: 568.2 KB (629.3). Budget 568.5.
- Statistics `/ward-flow/statistics`: 607.5 KB (605.5). Budget 607.8.

Capacity fell 42.5 KB and Bed meeting TV 61.1 KB because both now import `groupDischarges` from the discharge board model instead of the discharge board UI (PERF-03). Not yet measured on hosted CI.

After main (#1482, Help and tour) merged in at `8847fc14`, hosted CI measured Capacity at 656.8 KB against the new 656.4 budget. The 0.7 KB came in with #1482's shared Help code, which every route carries; this PR's own Capacity change is unchanged. Budget 656.4 raised to 657.1, the measured size plus 0.3 KB, the same rule as the other new budgets. Every other screen was within budget on that run.
