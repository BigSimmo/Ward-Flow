# 2026-11-05 PR #1467 Movement budget lowered, RPH ward nudged

CI run 42013669125 measured this PR merged with main e87bc995 (main alone from main's saved measurements):

- Movement `/ward-flow/movements/WF-001`: 580.6 KB (main alone 620.1 KB). Budget 620.3 lowered to 582.0.
- RPH ward `/ward-flow/ward/rph-adult-secure`: 592.3 KB (main alone 591.7 KB). Budget 592.0 raised to 592.5.

The movement page imported its not-found view through `ward-management-console.tsx`, which pulled the movement cockpit chunk into first load. The page now imports the view from its own module. Moving those modules out of the shared chunks regroups webpack's split chunks, which costs the RPH ward 0.6 KB; a local build reproduced the same 0.6 KB, so it is not noise. Net saving across the five screens is about 39 KB. The other three screens did not move.

After merging main 8cbf3a17 (#1448 raised the RPH ward to 594.0 KB against a measured 593.5 KB), this PR keeps main's higher number and adds its own 0.6 KB regrouping on top: RPH ward 594.0 raised to 594.6. Movement stays lowered at 582.0.

Second pass, same PR (Josh asked for the same leak on every other screen). Six more static imports pulled lazy-only code into first load: the referral drawer stylesheet (through `documentLabel`), the history and corrections panel (through the fold context), the clearance check words (through the whole submission validator), the ward bed board (through `nameParts`), Home's hidden Overrides tab register, and the recovery storage module (through its outcome words). Each now imports from a small module of its own. A local build on main 8cbf3a17 measured Home 556.8, Referrals 550.8, ED 511.5, RPH ward 586.2 and Movement 582.2 KB. Budgets are set to the measurement plus 1.0 KB: Home 558.8 to 557.8, Referrals 564.8 to 551.8, RPH ward 594.6 to 587.2, and Movement 582.0 to 583.2, because Movement measured 1.6 KB above this PR's first pass once main 8cbf3a17 was merged in. ED is unchanged.
