# 8 Nov 2026, repo review fixes (PR #1523)

Raised: ED detail `/ward-flow/ed/arm-ed`, budget 652.3 to 653.3. Hosted CI measured 653.1 KB (rounded) on this PR.

Why it grew: this route was already over its limit on main (PR #1515's note records the CI judge crediting the overage to main). This PR also changes `package-lock.json` (`@types/node` pinned to 24.x, types only, nothing in the bundle), so the CI judge cannot measure main alone and counts the whole overage against this PR. The PR's own client changes are small: arrival lateness now ignores closed movements and search wait times stop at closure. Trim considered: none of that code is separable from the shared engine, so no lazy-load is possible here. The raise is within the 5 KB per screen allowance in HOW-WE-WORK section 6, and the budget-heal issue still asks for a trim on main.
