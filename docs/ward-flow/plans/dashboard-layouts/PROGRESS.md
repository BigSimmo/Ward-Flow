# Q003 progress

Plan: [Dashboard layouts](../2026-09-13-dashboard-layouts.md). Branch `codex/task-ward-flow-live-state-20260831`, HEAD `1ef9ed3975078b789e9b5d70b3f000c64edc3809`. Continuation of current task; existing dirty changes preserved. Three disjoint local page groups dispatched; root owns common layout and remaining screens. No fresh visual acceptance claimed.

## Implementation handoff — 2026-09-13

Q003 layout implementation is complete across the route inventory in L1–L4. Three Sol implementers worked on disjoint files; one Sol reviewer performed a bounded source pass; Astra integrated and inspected the renderings. Sixty source files carry this batch, plus one stale test-heading expectation. No engine, data, action, permission or drawing changes. No commit, push, deployment or provider operation.

Desktop workspaces use page-specific heights and readable lower bounds. Neighbouring panels align; stacked summaries share the primary column's bottom. Headings and controls remain stationary while bodies scroll. Phone layouts release desktop bounds; forms, record-reading pages, settings, sign-in, comparison statistics and Digest retain natural document flow. Deliberate exceptions and exact file lists are in [L1](L1.md), [L2](L2.md), [L3](L3.md) and [L4](L4.md).

### Integration findings resolved

- Handover: stopped nested table rows compressing into tiny scroll areas; the 573px report body now scrolls 4352px of content beneath its stationary filter.
- Referrals: constrained parent grid minimums, prevented stretched headings, and removed an implicit narrow column in selected details. RF-001 was selected and its eligibility/decision controls remained accessible.
- Network: queue rows retain their content height instead of shrinking/clipping.
- Narrow desktops: Hub/Search stack through 1120px; Referrals through 1280px. Actual 1001px captures show no document horizontal overflow.
- Keyboard access: Capacity uses explicit body wrappers, Community has 11 labelled targets, and Statistics has 42 contextual targets. Capacity's Home/PageDown proof moved the body from 0 to 349px while neighbour top remained 142.078px and page scroll remained 231px.
- Statistics landing: Community and Referrals measured top 1711px and bottom 2543px for both panels at 1440x1000.
- Discharges: preserved whole ward names with a readable table minimum inside paired panels; print removes that minimum.

### Local verification

Initial focused tests and typecheck were blocked before execution by a legitimate independent Ward audit holding the repository lease. The audit was left untouched. When it finished, the checks ran:

1. `.superpowers/sdd/2026-09-12-visual-rebuild-wave-one/run-focused.mjs` with the fourteen files listed in `CHECKS.md`: **files handed in 14; files that ran 14; tests collected 336; passed 333; failed 3**.
2. Two failures came from nested Capacity region names matching the outer summary panels. Those two inner wrappers now use labelled focusable groups, retaining keyboard access without duplicate region identities. One On-call expectation still named the superseded heading; the pre-Q003 snapshot already says `Data provenance and coverage`. Only that stale expected heading was updated; all test cases remain.
3. Corrective run of the Capacity and On-call files: **files handed in 2; files that ran 2; tests collected 32; passed 32; failed 0**. The other twelve unchanged passing files were reused. This yields 336 passing test cases across the focused scope; it is not a repeated fourteen-file run.
4. `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/run-typecheck-r26.mjs`: exit 0, no diagnostics. Later changes were only role/expected-heading literals and formatting.
5. Scoped Prettier and final whitespace review; no full suite, build or repeated broad gate. Logs are in `.superpowers/sdd/dashboard-layouts/`.

### Rendered evidence and limits

Preview: `http://localhost:3606/mockups/ward-flow`. `/api/local-project-id` identifies this checkout as `clinical-kb:d0a358b585df`. The previous 3605 runtime had a missing Turbopack cache file. A separate task-owned cache and configuration restored the preview without deleting the old cache or killing the old process. Root tsconfig, package manifests and lockfile remain unchanged.

Actual captures are in `.superpowers/sdd/dashboard-layouts/screens/`. Inspected desktop families include Command, Movements, Delays, Capacity, ward overview, bed board, ED, Community, Network, referral register/selected detail, statistics overview/service/landing, Handover, legal forms, Alerts, Governance, Out of area, Discharges, On-call and Officer. Hub, Search and Referrals were also inspected at 1001px. Legal forms, Capacity, Movements and Referrals have representative 820px/390px captures, including dark mode. Capture filenames containing `dark` are not by themselves theme proof: the first statistics-overview capture was taken during route/theme settling and is excluded as dark acceptance; early Network transition capture is superseded by `network-light-1440-final.png`. Early Handover/referral captures document defects and are superseded by `handover-final-1440.png` and `referrals-selected-final-1440.png`.

Capacity print emulation expanded all four new bodies (`scrollHeight === clientHeight`, overflow visible). This is CSS print-expansion evidence, not physical printing or complete pagination proof. Movements' fresh navigations no longer produced the earlier SVG-title hydration error; the browser log retains the two historical entries at 04:29:52 UTC.

This was a proportional layout verification pass, **not a renewed six-view drawing comparison for all 34 screens**. The old canonical records are preserved in `screen-verification-before-Q003.json`. Twenty-nine affected entries are reopened; five unchanged form/reading/entry pages retain their prior evidence. The regenerated canonical record reports **5 of 34 looked at, 0 structural problems**. The lower count means the new layout delta is not being passed off as historical full-screen acceptance. Full 390/820/1440 light/dark mockup sign-off remains a separate outstanding verification item; no 9/10 score or full design equality is claimed.
