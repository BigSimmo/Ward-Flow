# 12 Nov 2026, component review fixes (PR #1639, D-162)

Every limit is lowered on top of `main` at `740bdeb`, because the shared shell shrank by 8.5 KB:

- Home `/ward-flow`: 589.7 to 582.3
- Referrals `/ward-flow/referrals`: 594.7 to 586.8
- ED `/ward-flow/ed`: 544.2 to 536.4
- Ward `/ward-flow/ward/rph-adult-secure`: 625.4 to 615.8
- Movement `/ward-flow/movements/WF-001`: 620.3 to 613.2
- Capacity `/ward-flow/capacity`: 666.9 to 660.0
- ED site `/ward-flow/ed/arm-ed`: 678.6 to 674.7
- Bed meeting `/ward-flow/bed-meeting`: 600.7 to 593.8
- Statistics `/ward-flow/statistics`: 641.3 to 633.9

Measured with a local `next build --webpack` and `scripts/check-script-budget.mjs`, which matched hosted CI's figures for the earlier head to 0.1 KB. In KB: Home 582.1, Referrals 586.6, ED 536.2, Ward 615.6, Movement 613.0, Capacity 659.8, ED site 674.5, Bed meeting 593.6 and Statistics 633.7. Each limit is the measurement plus 0.2.

Why it changed: `ward-flow-reducer.ts` re-exported one refusal sentence from the lazily loaded protected-record slice. A value re-export loads the whole module, so the slice and its helpers rode in the shell that every screen loads. The sentence now lives in `ward-protected-refusal-reasons.ts`, and the lazy-slice test also catches `export … from` re-exports. The same PR wraps every `next/dynamic` loader in `withLoadRetry`, which first put each screen 0.5 to 4 KB over. The net result is still 4 to 9 KB under the old limits.
