# 14 Nov 2026, design Lane A: kit, style and print (PR #1672, D-224)

Measured by CI's production build of the PR head merged with main 9a4b85e
(`scripts/check-script-budget.mjs`). Each new limit is the measurement plus 0.4, well inside the
5 KB allowance.

Raised:

- Coordinator `/ward-flow` 604.6 to 605.7 (measured 605.3; main alone 604.4), Referrals 603.5 to
  604.4 (604.0), ED 556.8 to 557.6 (557.2), Ward 641.1 to 642.2 (641.8), Movement 635.0 to 636.0
  (635.6), ED board 695.6 to 696.7 (696.3), Bed meeting 605.9 to 606.8 (606.4), Statistics 652.8 to
  653.6 (653.2).

Why: the growth (about 0.9 KB) is in shared kit parts every screen loads: the toast's two-line
clamp and Details button (R-STYLE-5), the kit Icon size rule (R-STYLE-4), the dialog that stays
open across layouts (R-STRUCT-36), the one-line refusal lines in `ward-refusal-words.ts`
(R-STYLE-17) and MissingValue's guard against "undefined".

What was tried first: the new parts screens adopt later (InfoTip, RowLink, ClampText) are imported
by file path, not through the kit barrel, so they add nothing until a screen uses them. The refusal
lines share one helper rather than writing each sentence out twice.
