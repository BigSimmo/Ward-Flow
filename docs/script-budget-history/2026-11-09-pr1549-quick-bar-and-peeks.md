# 9 Nov 2026, Quick bar and peek panels (PR #1549)

Raised, each by 3.0 KB on top of `main` as of `3900d1388` (after PR #1543's own raises): `/ward-flow` 562.1 to 565.1, referrals 562.0 to 565.0, ED 516.9 to 519.9, ward `/ward-flow/ward/rph-adult-secure` 595.3 to 598.3, movements `/ward-flow/movements/WF-001` 589.7 to 592.7, `/ward-flow/ed/arm-ed` 654.0 to 657.0 and statistics 608.9 to 611.9. Capacity 662.5 to 667.5 (5.0 KB; main alone was already over its limit). Bed meeting is unchanged.

Measured sizes, KB gzipped, from hosted CI's production build at `1dbe80b2d` (before `main`'s PR #1543 was merged in, which adds 0.4 to 1.0 KB to four routes):

| Route                   | Old limit | New limit | Measured |
| ----------------------- | --------- | --------- | -------- |
| `/ward-flow`            | 562.1     | 565.1     | 563.1    |
| referrals               | 562.0     | 565.0     | 562.6    |
| ED                      | 516.9     | 519.9     | 517.8    |
| ward `rph-adult-secure` | 595.3     | 598.3     | 595.2    |
| movements `WF-001`      | 589.7     | 592.7     | 590.3    |
| Capacity                | 662.5     | 667.5     | 666.6    |
| `arm-ed`                | 654.0     | 657.0     | 655.1    |
| statistics              | 608.9     | 611.9     | 609.9    |

Measured locally on this PR against `main` 079d46ed6 built the same way: growth of 2.2 to 2.9 KB on every route, and 3.0 KB on Capacity. Hosted CI has measured about 0.9 KB above the local figure.

Why it grew: the layout now holds the Patient peek host (the sheet itself loads on first use) and the Quick bar slot (the Quick bar itself loads only on the desk's home), so every route carries their small loaders. Capacity grew 0.6 KB more than the rest; the cause is not proven.

Trim made: the first push imported the hero's slot from the design kit's index inside the server layout, which put the whole kit into every route's first download (about 48 KB). The slot now lives in its own small file, the Quick bar loads only on the desk's home, the Ward peek no longer pulls Search's code, and Capacity loads the Ward peek when a drawer opens. Every raise is within the 5 KB per screen allowance in HOW-WE-WORK section 6.
