# 14 Nov 2026, combined clinical items and live re-check fixes (PR #1668)

Measured with a local `npm run build` (webpack) and `node scripts/check-script-budget.mjs` on the
merged tree (main 9000803ed plus this PR). Four routes were 0.1 to 0.2 KB over main's limits:
Home `/ward-flow` 597.4 (limit 597.2), Ward `/ward-flow/ward/rph-adult-secure` 632.3 (632.2),
Movement `/ward-flow/movements/WF-001` 627.5 (627.5) and Statistics `/ward-flow/statistics` 645.6
(645.5). Hosted CI measured the same figures.

The growth is new first-load text and checks from this PR, mainly the D-209 authorisation labels
and the D-188 pull-level check on the transit card. Hosted CI measured the same figures before the
D-211 commit, so D-211 adds nothing measurable. The trim tried first: an exported constant left unused by D-209
(`AUTHORISATION_REGISTER_DATE`) was made module-private; it made no measurable difference.

Raised, each well under the 5 KB allowance:

- Home 597.2 to 597.7, Ward 632.2 to 632.6, Movement 627.5 to 627.8, Statistics 645.5 to 645.9.
