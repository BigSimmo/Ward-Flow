# 6 Nov 2026, Help and first-run tour expansion (#1482)

Raised `/ward-flow/ward/rph-adult-secure` from 591.5 to 592.4 KB.

CI run 42140585257's successor on head 79b84429 measured this PR merged with main 02230f9c: RPH ward 591.9 KB, main alone 591.2 KB. This PR's own growth on that screen is 0.7 KB. Home 560.2, Referrals 558.9, ED 515.3 and Movement 586.5 KB stay under their budgets.

Diagnosis: the welcome cards, tour player, Show me and the Help sheet all stay lazy (`next/dynamic`), and the eager offer file got smaller. The likely source is the header search help (`ward-global-search-help.tsx`), which the phone menu results import eagerly. It reads `HOW_TOS` and the walk tables, and this PR adds 31 how-tos and 21 walks to them. This was not split chunk by chunk.

Trim tried: none fits inside this PR. Making the phone menu's search help lazy, or moving the how-to text out of the search index, changes search code this PR does not own. Worth a follow-up. The raise is 0.9 KB above the old budget, well inside the 5 KB per screen allowance in HOW-WE-WORK section 6.
