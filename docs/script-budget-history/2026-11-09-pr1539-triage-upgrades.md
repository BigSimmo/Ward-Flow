# 9 Nov 2026, triage upgrades (PR #1539)

Raised: capacity `/ward-flow/capacity`, budget 659.8 to 662.5. Hosted CI measured 662.0 KB on this PR, and 659.9 KB for main alone, so main was already 0.1 KB over.

Why it grew: this PR changes only triage screens. A local build found the new triage code only in the triage chunk, not in capacity's. The most likely cause is this PR's What's new text: the build inlines it into the shared Help chunks that every route loads, and capacity had the least headroom. A local build measures differently from hosted CI, so this cause is not proven. Trim made: the six What's new lines from this PR are merged into two. Trim considered: the remaining growth is shared Help and What's new text, which can't be split out of this route from a triage PR. The raise is within the 5 KB per screen allowance in HOW-WE-WORK section 6.
