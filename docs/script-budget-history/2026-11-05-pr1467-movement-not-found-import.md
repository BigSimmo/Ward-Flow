# 2026-11-05 PR #1467 Movement budget lowered

A local production build of this PR (based on main e87bc995) measured Movement `/ward-flow/movements/WF-001` at 580.6 KB, down from 620.1 KB on main. The budget is lowered from 620.3 to 582.0.

The movement page imported its not-found view through `ward-management-console.tsx`, which pulled the movement cockpit chunk into first load. The page now imports the view from its own module. The other four screens did not move beyond build noise, so their budgets are unchanged.
