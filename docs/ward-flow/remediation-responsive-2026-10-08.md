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

Implementation checkpoint: browser execution and visual evidence are pending integration into the
root's verified local server. This document does not claim deployed behaviour or complete
application accessibility. The root maintains the shared screen verification registry.

Browser setup limitation: the isolated Firefox/WebKit install stopped at Firefox v1538 because
all automatic Playwright CDN/Microsoft mirror requests returned HTTP 403 `Domain forbidden`.
WebKit download was not reached. Cross-browser application behaviour remains unverified; those
projects can run where the supported browser downloads are available. Chromium local verification
will use the existing container executable rather than claim an unexecuted browser pass.
