# Q005 sidebar organisation

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/plans/README.md`.** Kept for history; do not follow.

Owner request, 2026-09-13. Supersedes earlier sidebar ordering; Patients appears only in the third group, following the owner's correction.

| Group             | Destinations, in order                                         |
| ----------------- | -------------------------------------------------------------- |
| Operations        | Command, Movement, Capacity, Delays, Network                   |
| Service Hubs      | Search Hub, ED Hub, Ward Hub, Community Hub, Transport Hub     |
| Care Coordination | Patients, Make Referrals, Referral Board, Handover, Discharges |
| Oversight         | Governance, Statistics, Legal, Out of area                     |

The mounted sidebar and mobile More pages menu use these 19 unique destinations from the existing route registry. Ward Hub opens the wards directory; ED Hub retains the existing ED workspace; Transport Hub uses the officer route with updated header, document title and accessible heading. Other page entries are removed from these menus; underlying routes and contextual links are preserved. Account/settings/appearance controls remain in the utility area. Detail pages highlight the appropriate parent hub, including Movement and Statistics subpages. Make Referrals remains distinct from Referral Board.

Verification: independent source review; actual desktop 1440px dark upper sidebar and light lower sidebar/Transport Hub; 390px grouped More pages menu with visible section headings; Patients click opened `/mockups/ward-flow/search`, marked Patients active and closed the menu. Browser viewport override was reset afterward. Formatting and scoped diff checks passed. The focused shell test was updated for group/order/uniqueness and parent-route selection, but its runner did not start because another Ward audit held test admission. No lease bypass, broad test run, commit or deployment. Existing Q004 page-body evidence remains valid; its old navigation appearance is superseded by this observation, not silently reverified on every page.

Before copies: `.superpowers/sdd/2026-09-13-navigation-before/`. Pending focused command when admission is available: `node .superpowers/sdd/2026-09-13-product-refinement/run-focused.mjs tests/ward-shell-third-edition.dom.test.tsx`.
