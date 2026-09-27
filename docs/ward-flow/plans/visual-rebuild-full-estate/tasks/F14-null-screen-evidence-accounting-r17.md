# Null-screen visual evidence accounting — r17

Date: 2026-09-13  
Prepared by: `/root/hub_inventory`

This report transcribes visual evidence already recorded in the named r16/r17 reports into JSON-ready screen objects. It does not update `screen-verification.json`, `PROGRESS.md`, or any generated record. Every object deliberately uses `deviates`: these are partial, first-viewport observations and many captures precede later corrections. None is a current visual match, full definition-of-done result, or human acceptance.

The `mockupSha256` values below are copied from `docs/ward-flow/mockups/MANIFEST.json` (`sha256-lf`). The array is valid JSON and each element can replace the matching null screen entry as a whole, or its `verified` member can be copied into the existing entry.

```json
[
  {
    "mockup": "movement-third-edition.html",
    "route": "/movements",
    "verified": {
      "date": "2026-09-13",
      "who": "Codex independent visual reviewer (gpt-5.6-sol); human acceptance pending",
      "widths": [390, 820, 1440],
      "themes": ["light", "dark"],
      "verdict": "deviates",
      "mockupSha256": "c526e7712c7bf74901f7b117f1aac39b8b384c219d797f7abed61d8a84a229ff",
      "notes": "All six r16 app/drawing first-viewport cells were inspected at 390, 820 and 1440 in light and dark; evidence-list digest and findings are in tasks/F01-F02-F13-visual-review-r16.md. The review found the route primary action absent. The traffic schematic had already been rebuilt from engine-authoritative corridors, but the capture does not prove lower content, interaction, scroll ends, print, forced colours or physical-device behavior. No current-match or full-DOD claim: the open primary-action finding and later shared-shell work require fresh capture."
    }
  },
  {
    "mockup": "ward-third-edition.html",
    "route": "/ward/[unitId]",
    "verified": {
      "date": "2026-09-13",
      "who": "Codex independent visual reviewer (gpt-5.6-sol); human acceptance pending",
      "widths": [390, 820, 1440],
      "themes": ["light", "dark"],
      "verdict": "deviates",
      "mockupSha256": "faf965e8fde959fe77ad15d8019e1585feabe7a50eb68ce8af93c23c431b1d9a",
      "notes": "All six r16 app/drawing first-viewport cells were inspected at 390, 820 and 1440 in light and dark; evidence-list digest and observations are in tasks/F01-F02-F13-visual-review-r16.md. No page-local P1/P2 was found in the visible regions, and the extra ready-bed summary was retained as working behavior. This remains partial looking: lower update workflows, interactions, focus, print and forced colours were not proved, and the report notes post-capture shared-bar changes. Fresh current-source capture is required before any match or full-DOD claim."
    }
  },
  {
    "mockup": "wards-third-edition.html",
    "route": "/wards",
    "verified": {
      "date": "2026-09-13",
      "who": "Codex independent visual reviewer (gpt-5.6-sol); human acceptance pending",
      "widths": [390, 820, 1440],
      "themes": ["light", "dark"],
      "verdict": "deviates",
      "mockupSha256": "bbe943321f3811e3f8e6b0973572524299e3e796d10b74a71b5a3e6b674bf28f",
      "notes": "All six r16 app/drawing first-viewport cells were inspected at 390, 820 and 1440 in light and dark; evidence-list digest and findings are in tasks/F01-F02-F13-visual-review-r16.md. The captured directory was one column sparser than the drawing at 820 and 1440 and lacked its route primary action. Engine catalog, grouping and 23 current wards remain authoritative. These findings plus later shell work need fresh capture; lower content, journeys, focus, print and forced colours remain unverified."
    }
  },
  {
    "mockup": "ward-answer-third-edition.html",
    "route": "/ward/[unitId]/answer",
    "verified": {
      "date": "2026-09-13",
      "who": "Codex independent visual reviewer (gpt-5.6-sol); human acceptance pending",
      "widths": [390, 820, 1440],
      "themes": ["light", "dark"],
      "verdict": "deviates",
      "mockupSha256": "a81fbd1e1e40a224feaac7cd5a1a34e514965ea5cb291fc4f0614b4507e00826",
      "notes": "All six r16 app/drawing first-viewport cells were inspected at 390, 820 and 1440 in light and dark; evidence-list digest and findings are in tasks/F01-F02-F13-visual-review-r16.md. The captured breadcrumb collapsed and the nested route had no active rail destination. Both were corrected later in tasks/ward-answer-rail-correction-r1.md, so every r16 app cell predates the correction. The captured RPH case also had an empty answer queue and cannot prove populated request/gate layout. Fresh populated and empty captures plus interaction/print evidence are required; no current-match or full-DOD claim."
    }
  },
  {
    "mockup": "patient-search-third-edition.html",
    "route": "/search",
    "verified": {
      "date": "2026-09-13",
      "who": "Codex independent visual reviewer (gpt-5.6-sol); human acceptance pending",
      "widths": [390, 820, 1440],
      "themes": ["light", "dark"],
      "verdict": "deviates",
      "mockupSha256": "4cd96fd0ff6555fbad9f84579e29ce64e6d682cad0dd1f896a12a67505451ee0",
      "notes": "All six r17 app/drawing first-viewport cells were inspected at 390, 820 and 1440 in light and dark in tasks/F00-service-tasks-search-visual-review-r17.md; the earlier six-cell r16 review and contrast/order correction are in tasks/F03-search-visual-review-r16.md and tasks/F03-search-correction-r16.md. Results correctly remain above Search in the left column. The r17 review found the idle desktop preview panel still collapsed; the captured dark active Everything state also predates the controller-owned contrast correction. Fresh six-cell capture is required after those corrections. Internal scroll ends, selection, keyboard, lower content, print and forced colours remain unverified."
    }
  },
  {
    "mockup": "patient-now-third-edition.html",
    "route": "/people/[patientId]",
    "verified": {
      "date": "2026-09-13",
      "who": "Codex Luna visual reviewer/correction author; human acceptance pending",
      "widths": [390, 820, 1440],
      "themes": ["light", "dark"],
      "verdict": "deviates",
      "mockupSha256": "ed139727d3b633300584938937cb04e510898b5f321730213cd81a56086a39c4",
      "notes": "All six r16 app/drawing first-viewport cells were inspected at 390, 820 and 1440 in light and dark in tasks/F03-now-visual-review-r16.md. That review found light-theme unreadable identity/action text and a staggered desktop grid, then applied a bounded source correction. A later 1440-light-only polish used a newer pair in tasks/F03-patient-now-polish-r17.md. The six-cell r16 matrix therefore does not represent current source. Fresh six-cell capture, lower record sections, tab/referral journeys, keyboard, print and forced-colour checks are required; no independent post-correction match or full-DOD claim."
    }
  },
  {
    "mockup": "raise-a-referral-third-edition.html",
    "route": "/referrals/new",
    "verified": {
      "date": "2026-09-13",
      "who": "Codex independent visual reviewer (gpt-6); human acceptance pending",
      "widths": [390, 820, 1440],
      "themes": ["light", "dark"],
      "verdict": "deviates",
      "mockupSha256": "1e7e5a084bb5113b6b2c548045cfaef87c68d9710384771ab0bb8f643a97f94c",
      "notes": "All six r16 app/drawing first-viewport cells were inspected at 390, 820 and 1440 in light and dark as the referral-intake subset of tasks/F04-F07-visual-review-r16.md. The capture showed the light-theme token failure and obsolete phone reserve; tasks/F04-F07-correction-report-r16.md changed the shared referral presentation afterward, and tasks/referral-intake-r17-css-correction-r1.md records a further 1440-light correction to field density and register treatment. Fresh six-cell capture is mandatory. Answering, validation, Send behavior, lower destinations, keyboard and print remain unverified."
    }
  },
  {
    "mockup": "referrals-third-edition.html",
    "route": "/referrals",
    "verified": {
      "date": "2026-09-13",
      "who": "Codex independent visual reviewer (gpt-6); human acceptance pending",
      "widths": [390, 820, 1440],
      "themes": ["light", "dark"],
      "verdict": "deviates",
      "mockupSha256": "60540121681203115c2e05f04a84ead49f00cc2d0124dc75840326ba2c4cb1c6",
      "notes": "All six r16 app/drawing first-viewport cells were inspected at 390, 820 and 1440 in light and dark as the referrals subset of tasks/F04-F07-visual-review-r16.md. The review found light-theme token inversion, obsolete phone reserve and oversized generic queue cards. Tasks/F04-F07-correction-report-r16.md subsequently introduced the canonical bridge and compact bounded triage register, so the reviewed captures are stale. Fresh six-cell and selected/unselected captures, scroll-end, action, keyboard, print and forced-colour evidence are required; no current-match or full-DOD claim."
    }
  },
  {
    "mockup": "add-a-patient-third-edition.html",
    "route": "/people/new",
    "verified": {
      "date": "2026-09-13",
      "who": "Codex independent visual reviewer (gpt-6); human acceptance pending",
      "widths": [390, 820, 1440],
      "themes": ["light", "dark"],
      "verdict": "deviates",
      "mockupSha256": "2af4db0a8531ef10cc24884c31f4f50492574f1010cd5deb101ec76cd0562ff0",
      "notes": "All six r16 app/drawing first-viewport cells were inspected at 390, 820 and 1440 in light and dark as the add-patient subset of tasks/F04-F07-visual-review-r16.md. The review found light-theme text loss, obsolete phone reserve and a one-column 820 identity form. Tasks/F04-F07-correction-report-r16.md corrected those presentation issues afterward while preserving the four required identity facts and optional Gender, so the captures predate current source. Fresh six-cell capture plus validation/submission, existing-record selection, keyboard and lower-content evidence are required; no current-match or full-DOD claim."
    }
  },
  {
    "mockup": "statistics-third-edition.html",
    "route": "/statistics",
    "verified": {
      "date": "2026-09-13",
      "who": "Codex independent visual reviewer (gpt-5.6-sol); human acceptance pending",
      "widths": [390, 820, 1440],
      "themes": ["light", "dark"],
      "verdict": "deviates",
      "mockupSha256": "656aaf90665a33d5bc96ee1bd06f28ba01845a93d82aa4d55fb392f80ec08bc0",
      "notes": "All six r16 app/drawing first-viewport cells were inspected at 390, 820 and 1440 in light and dark in tasks/F05-F11-statistics-visual-review-r16.md. The landing uses real supported measurements rather than the drawing's fabricated history, as documented in tasks/F11-statistics-landing-correction-r8.md. The r16 review found an obsolete phone reserve; current capture status after controller corrections is not certified. Fresh six-cell and lower-page capture are required, including disclosure/chooser reachability, keyboard, print and forced colours. This is partial looking and a deviates verdict, not a current match or full DOD."
    }
  },
  {
    "mockup": "statistics-community-third-edition.html",
    "route": "/statistics/community/[teamId]",
    "verified": {
      "date": "2026-09-13",
      "who": "Codex independent visual reviewer (gpt-5.6-sol); human acceptance pending",
      "widths": [390, 820, 1440],
      "themes": ["light", "dark"],
      "verdict": "deviates",
      "mockupSha256": "0c3433eb02fb59b3637e53bc76f6ae08b9c0eb1b512b115ec61257f6df048747",
      "notes": "All six r16 app/drawing first-viewport cells were inspected at 390, 820 and 1440 in light and dark in tasks/F05-F11-statistics-visual-review-r16.md. The review retained engine-authoritative Bentley/absence values but found Caseload and Time-to-first-contact subregions split into extra raised cards. The report requests regrouping and fresh capture; tasks/F05-F11-community-kpi-implementation-r1.md is source/static evidence only and does not close runtime appearance. Lower tables, entity switching, disclosures, keyboard, print and forced colours remain unverified; no current-match or full-DOD claim."
    }
  },
  {
    "mockup": "statistics-service-third-edition.html",
    "route": "/statistics/service/[serviceId]",
    "verified": {
      "date": "2026-09-13",
      "who": "Codex visual reviewer (self-review for this authored screen); human acceptance pending",
      "widths": [390, 820, 1440],
      "themes": ["light", "dark"],
      "verdict": "deviates",
      "mockupSha256": "80cd8c1c8b8b8e96714f4ef2b2d4ed1c1eca3e4e1d441c12a4b6160e3ea5576d",
      "notes": "All six r16 app/drawing first-viewport cells were inspected at 390, 820 and 1440 in light and dark in tasks/F05-F11-statistics-visual-review-r16.md. Engine-derived service values and explicit absences were retained. The review found the route Export action absent and states that post-capture neutral-footer and long-title corrections still require fresh evidence; the Service portion was not an independent source acceptance. Fresh six-cell and lower-page evidence, entity switching, keyboard, print and forced colours remain required; no current-match or full-DOD claim."
    }
  },
  {
    "mockup": "out-of-area-third-edition.html",
    "route": "/out-of-area",
    "verified": {
      "date": "2026-09-13",
      "who": "Codex visual reviewer/correction author (gpt-6); human acceptance pending",
      "widths": [390, 820, 1440],
      "themes": ["light", "dark"],
      "verdict": "deviates",
      "mockupSha256": "9de29b5a4166442080ad1c138093fed691ea5bedec6ef7810ed45a32c6ccc055",
      "notes": "All six r16 app/drawing first-viewport cells were inspected at 390, 820 and 1440 in light and dark in tasks/OOA-handover-correction-report-r16.md. The reviewed app used a table instead of the drawing's selectable record rows. That report then changed the screen to record cards at all screen widths, retained the canonical print table and all five truthful groups, and corrected At-a-glance/card hierarchy. The same reviewer authored the correction and no post-change image exists in the report. Fresh six-cell, selected-placement, scroll-end, keyboard, print and forced-colour evidence are required; no independent current-match or full-DOD claim."
    }
  },
  {
    "mockup": "handover-third-edition.html",
    "route": "/handover",
    "verified": {
      "date": "2026-09-13",
      "who": "Codex visual reviewer/correction author (gpt-6); human acceptance pending",
      "widths": [390, 820, 1440],
      "themes": ["light", "dark"],
      "verdict": "deviates",
      "mockupSha256": "0389907aa51840b6df22b954ccba0c00254fee7fb3d3fc16a92f170417b187ed",
      "notes": "All six r16 app/drawing first-viewport cells were inspected at 390, 820 and 1440 in light and dark in tasks/OOA-handover-correction-report-r16.md. The reviewed app showed the legacy sky-blue Print treatment, an undefined heading token and inconsistent caption typography. That report corrected the scoped accent aliases, heading token and page-local typography afterward while preserving filtering, print and sign-off behavior. No post-change image is recorded. Fresh six-cell, changed-filter, sign-off, urgent-outside, keyboard, print and forced-colour evidence are required; no independent current-match or full-DOD claim."
    }
  }
]
```

## Remaining null-screen evidence classification

The five null screens outside the requested object set are not wholly unreviewed, but their available evidence is narrower or stale:

- `/ed/[edId]`: all six r16 cells were viewed in `tasks/F02-ed-visual-correction-r16.md`, but the same task then corrected tier contrast and Department-list hierarchy. It is implementation/self-review evidence without a post-correction matrix, so it should remain null until fresh independent capture review.
- `/network`: all six r16 cells were viewed before the source correction recorded in `tasks/network-r16-correction-r1.md`. That report is correction-author evidence and explicitly says lower phone flow content and interaction remain unreviewed. No post-correction certified matrix is recorded.
- `/governance`: independent `tasks/F06-F08-visual-review-r9.md` covers only 1440 and 390 light first viewports. Its nested-host finding was corrected later in `tasks/F06-F08-visual-corrections-r9.md`; no fresh dark/820/post-correction review is recorded.
- `/discharges`: the same independent r9 report covers only 1440 and 390 light and found the phone panel-type divergence. `tasks/F06-F08-visual-corrections-r9.md` then changed the phone table/card presentation. No post-correction six-cell review is recorded.
- `/statistics/ward/[unitId]`: `tasks/F05-F11-visual-review-r11.md` and `tasks/F05-ward-statistics-correction-r11.md` cover only 1440 and 390 light before the Ward layout and shared text-token corrections. No post-correction dark/820 matrix is recorded.

Therefore none of the remaining five is a true no-evidence screen, but none has a current certified review suitable for a six-cell verification object. The r9/r11 reports provide more than a root-only 1440-light glance for Governance, Discharges and Ward Statistics; ED and Network have six-cell correction-author inspection. All five still require fresh independent current-source capture review.

## Shared limits

The evidence records only visible screenshot regions. It does not establish below-fold panel order, internal scroll endpoints, meaningful changed states, keyboard/focus behavior, print/PDF output, forced colours, zoom, reduced motion, physical-device behavior, successful focused gates, full-suite status, or human acceptance. Recent page and shared-shell corrections make historical captures useful diagnosis but not current visual acceptance.
