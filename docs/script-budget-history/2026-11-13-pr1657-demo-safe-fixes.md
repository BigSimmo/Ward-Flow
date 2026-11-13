# 13 Nov 2026, demo-safe fixes (PR #1657, D-190)

Nine limits are raised, on top of `main` at `92630b1`:

- Coordinator `/ward-flow`: 582.3 to 585.2
- Referrals `/ward-flow/referrals`: 586.8 to 589.9
- ED `/ward-flow/ed`: 536.4 to 538.5
- Ward `/ward-flow/ward/rph-adult-secure`: 615.8 to 618.2
- Movement `/ward-flow/movements/WF-001`: 613.5 to 616.9
- Capacity `/ward-flow/capacity`: 660.0 to 662.4
- ED board `/ward-flow/ed/arm-ed`: 674.7 to 677.9
- Bed meeting `/ward-flow/bed-meeting`: 593.8 to 596.3
- Statistics `/ward-flow/statistics`: 633.9 to 636.4

Measured with a local `npm run build` and `scripts/check-script-budget.mjs`, which matched hosted CI's figures to about 0.5 KB. Each limit is the larger of the local and hosted measurements plus 0.2. Every rise is under the 5 KB allowance.

Why it grew: the script every page shares grew from 482.4 to 484.1 KB, and other near-universal script grew too, so every page rose by a similar 2 to 3 KB. There is no single culprit. Matching modules between this build and `main`'s by their contents found about 3.8 KB raw (1.5 KB gzipped) spread over many small additions from the audit fixes. The largest are: the demo phone number blocks (0.9 KB raw), the referral-state helpers for closed and not-asked wards and booked transport (0.6), the shift-window helpers (0.57), the one legal-form progression module and the examination wording (0.5, 0.2 and 0.17), the reducer's pull path for a raised referral (0.44), the layout's quick-hero provider (0.47) and a small memo helper (0.34).

What was tried first: dropping the `files` path lists from the runtime demo phone number blocks saves 0.12 KB gzipped, which leaves every page at least 1.9 KB over. Lazy-loading does not fit, because the growth is in shell-wide derivations, the reducer and seed modules that every page reads.
