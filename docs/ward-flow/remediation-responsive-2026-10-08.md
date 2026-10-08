# Responsive audit remediation

Task IDs: UI-001 through UI-006; bounded cross-browser coverage for QA-002.
Audit base: dedicated Ward Flow main `e7b7f325346ea7abb5004bd2e60e63f64f5c9f95`.
Fresh reconciliation: main `4cd9be8471535c224ad86c791251f73c345b9dae`.

PRs #122 and #125 already repair the audited phone department strip, movement stages, directory,
referral legends and statistics tables. Duplicate candidate CSS has been removed after inspecting
the newer approved phone design; those earlier findings must be reconciled against that main.

The remaining service-statistics overflow comes from its absolutely positioned complete accessible
identity escaping the clipped hero eyebrow. The service identity wrapper now establishes the
local positioning context, retaining all accessible text and the accepted visual design.
Statistics table regions also have names, keyboard focus and a visible focus indicator for sideways
scrolling.

`tests/ui-ward-responsive-audit.spec.ts` checks the seven affected routes at 320, 390 and 768 pixels.
Chromium collects it through the existing Ward mockup project. Dedicated Firefox and WebKit
projects collect only this bounded prototype proof, keeping inherited production checks separate.

Local verification: seven Chromium browser tests passed against integration commit
`d5bdf2362a6e1ede267a73b378349610dea6b92f`. Every affected route had document widths exactly
320, 390 and 768 pixels at those viewports. Keyboard scrolling passed for the named statistics
tables. Service identity remained complete in accessible text; its scoped dark appearance also
passed. The browser was system Chromium `151.0.7922.173`.

The separate visual capture retained 21 light screenshots (seven routes at each width) and one
390px dark service screenshot, with hashes and unchanged start/end source revision. Only the
root's instrumentation documentation/test work was dirty during capture. Evidence is preserved in
the local remediation output as `responsive-final-results.json`,
`responsive-final-provenance.json` and `responsive-screenshot-provenance.json`.

UI-001 through UI-005 are reconciled to the newer main's existing phone repairs; UI-006 is
corrected locally. This does not claim deployed behaviour, complete application accessibility or
full resolution of QA-002. The root maintains the shared screen verification registry.

Browser setup limitation: the isolated Firefox/WebKit install stopped at Firefox v1538 because
all automatic Playwright CDN/Microsoft mirror requests returned HTTP 403 `Domain forbidden`.
WebKit download was not reached. Cross-browser application behaviour remains unverified; those
projects can run where the supported browser downloads are available. Chromium local verification
will use the existing container executable rather than claim an unexecuted browser pass.
