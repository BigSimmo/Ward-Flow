# F02/F13a Ward, Wards, ED adversarial review (r1)

Scope: source-only comparison of the returned six existing files plus the new answer route against the preserved `before-F02` snapshot, using `F02-F13a-implementation-report-r1.md`. No tests, browser, server, Git, or provider operations.

## Verdict

No additional concrete actionable defect found.

- Ward overview remains the default `/mockups/ward-flow/ward/[unitId]` presentation. The new answer route explicitly passes `presentation="answer"`; the shared `WardScreen` keeps one provider read and one set of reducer handlers. Answer mode hides overview-only direct children through the scoped `data-presentation="answer"` rules while retaining governance, answer navigation, and the awaiting-answer panel. The previous overview mutations remain mounted in the default mode.
- Unknown ward IDs still fail closed with a named `ward-unit-unresolved` message and never fall back to another unit. The answer metadata uses the same fixture lookup convention as the existing dynamic route.
- The Wards index retains service grouping, unplaced-unit handling, per-unit links and its no-bed-figures restraint. The new answer link is reachable from each ward overview’s existing unit card; the index continues to point to the overview route.
- ED resolves the requested `edId` before rendering, fails closed for an unknown department, uses `allEmergencyDepartments()` for the selector, marks the current department with `aria-current="page"`, and preserves existing ED-specific action/state handlers. Selector links retain the dynamic ED route and current-context labels.
- CSS module changes are locally scoped; the new ED selector rules are descended from the screen scope. Existing panel/table/action content and test IDs remain present per the implementation report’s snapshot comparison. No duplicated reducer/event implementation or lost source behavior was identified.

## Controller-owned visual questions

The report’s desktop references do not prove the required 390/820/1440 light/dark DOD. Runtime review should check answer-mode omission/order, Wards directory wrapping, ED selector overflow, and shared bar title/primary-action mapping. These are pending visual evidence rather than source findings.
