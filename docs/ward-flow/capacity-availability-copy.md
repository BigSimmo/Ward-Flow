# Capacity availability wording

Task: resume the 1 October Design Scan recommendation from task-28. Parent implementation authority:
`01a0fe58-6434-7205-8baa-61d50d5540db`. Base: locally verified Ward Flow `origin/main`, `92c16afe`.

The Capacity summary is labelled **Available capacity** in both the whole-network and selected-service
views. A preparation warning now states: **Included in capacity; cannot be pulled until ready.**

This is a wording correction. Cleaning/preparation still does not subtract from reported capacity.
Immediate pull availability still excludes beds pending preparation. Expected future releases remain
outside available capacity. No counting, reducer, future-release or pull-guard code changes.

Focused synthetic coverage is prepared in `tests/ward-capacity-available-copy.dom.test.tsx` for both
scopes, absence of a preparation warning, unchanged counting versus pull availability and future-release
exclusion. Three existing Capacity suites update only their accessible summary-name selectors.

The earlier Statistics chart and obsolete ward-link recommendations are already addressed in this
base's source. Their visual confirmation remains pending. The eight old route timeouts remain pending
runtime verification: Search, Settings, Sovereign, Patient detail, Community statistics, ED statistics,
Ward overview and Ward answer. No server is launched while the parent test hold remains in force.

Verification status: prepared source and tests; runtime, test and formatting evidence must be recorded
separately. Local execution is available through the reviewed route; this does not release the shared
heavy-test recovery hold. No publication, merge or deployment is included.
