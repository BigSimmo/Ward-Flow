# Responsive audit remediation

Task IDs: UI-001 through UI-006; bounded cross-browser coverage for QA-002.
Base: dedicated Ward Flow main `e7b7f325346ea7abb5004bd2e60e63f64f5c9f95`.

Local scroll containers now establish positioning contexts so absolutely positioned accessible
labels cannot escape the clipped table, department strip or movement stages and expand the page.
Narrow referral legends and directory action rows wrap without changing the approved design.
The service site label respects its available width and retains its complete accessible text.
Statistics table regions have names and keyboard focus for sideways scrolling.

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
