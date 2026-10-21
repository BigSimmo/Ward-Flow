# Ward Flow — mockup ↔ route ↔ screen

> 🔴 **GENERATED. DO NOT EDIT BY HAND.** `node scripts/ward-flow/screen-map.mjs`; `--check` fails
> on a stale map or an unmapped item.

**70 mockups · 54 routes · 32 screen folders.**

⚠️ The PAIRING is hand-authored — no rule derives that `command-third-edition.html` is route `/`.
**COMPLETENESS is not**: everything is discovered from disk, so a new or renamed file shows up as
UNMAPPED rather than disappearing.

## The 34 with a build contract

| Mockup | Route | Screen folder | Route exists |
|---|---|---|---|
| `command-third-edition.html` | `/` | `coordinator/` | yes |
| `delays-third-edition.html` | `/waiting` | `delays/` | yes |
| `movement-third-edition.html` | `/movements` | `movements/` | yes |
| `capacity-third-edition.html` | `/capacity` | `capacity/` | yes |
| `ward-third-edition.html` | `/ward/[unitId]` | `ward/` | yes |
| `wards-third-edition.html` | `/wards` | `wards/` | yes |
| `bed-board-third-edition.html` | `/board/[unitId]` | `board/` | yes |
| `emergency-department-third-edition.html` | `/ed/[edId]` | `ed/` | yes |
| `community-team-third-edition.html` | `/community/[teamId]` | `community/` | yes |
| `patient-search-third-edition.html` | `/search` | `search/` | yes |
| `patient-now-third-edition.html` | `/people/[patientId]` | `patients/` | yes |
| `search-hub-third-edition.html` | `/hub` | `hub/` | yes |
| `raise-a-referral-third-edition.html` | `/referrals/new` | `referrals/` | yes |
| `statistics-overview-third-edition.html` | `/statistics/overview` | `statistics/` | yes |
| `statistics-ward-third-edition.html` | `/statistics/ward/[unitId]` | `statistics/` | yes |
| `statistics-community-third-edition.html` | `/statistics/community/[teamId]` | `statistics/` | yes |
| `statistics-emergency-department-third-edition.html` | `/statistics/ed/[edId]` | `statistics/` | yes |
| `network-third-edition.html` | `/network` | `network/` | yes |
| `governance-third-edition.html` | `/governance` | `governance/` | yes |
| `handover-third-edition.html` | `/handover` | `handover/` | yes |
| `discharges-third-edition.html` | `/discharges` | `discharges/` | yes |
| `out-of-area-third-edition.html` | `/out-of-area` | `out-of-area/` | yes |
| `on-call-third-edition.html` | `/on-call` | `on-call/` | yes |
| `alerts-third-edition.html` | `/alerts` | `alerts/` | yes |
| `transport-officer-third-edition.html` | `/transport/officer` | `officer/` | yes |
| `legal-forms-third-edition.html` | `/legal-forms` | `legal-forms/` | yes |
| `add-a-patient-third-edition.html` | `/people/new` | `patients/` | yes |
| `referrals-third-edition.html` | `/referrals` | `referrals/` | yes |
| `settings-third-edition.html` | `/settings` | `settings/` | yes |
| `statistics-third-edition.html` | `/statistics` | `statistics/` | yes |
| `statistics-compare-third-edition.html` | `/statistics/compare` | `statistics/` | yes |
| `statistics-service-third-edition.html` | `/statistics/service/[serviceId]` | `statistics/` | yes |
| `sign-in-third-edition.html` | `/ward-flow-sign-in` | `../ward-flow-sign-in/` | yes |
| `ward-answer-third-edition.html` | `/ward/[unitId]/answer` | `ward/` | yes |

## Drawn, no build contract

| Mockup | Route | Route exists |
|---|---|---|
| `design-system-third-edition.html` | — | — |
| `ward-flow-digest.html` | `/mockups/ward-flow-digest` | yes |
| `movement-gantt-third-edition.html` | — | — |
| `network-horizon-third-edition.html` | — | — |
| `sovereign-chrome-and-drawers-perfected.html` | — | — |
| `perfected-activity-drawer.html` | — | — |
| `perfected-drawers-showcase.html` | — | — |
| `perfected-service-popover.html` | — | — |
| `perfected-tasks-drawer.html` | — | — |
| `perfected-tools-drawer.html` | — | — |
| `settings-perfected-third-edition.html` | — | — |
| `add-a-patient-third-edition-claude-draft.html` | — | — |
| `patient-now-original-third-edition.html` | — | — |
| `sovereign-sidebar-ultimate.html` | — | — |
| `handover-perfected-third-edition.html` | — | — |
| `ward-perfected-third-edition.html` | — | — |
| `wards-cards-third-edition.html` | — | — |
| `patient-now-perfected.html` | — | — |
| `patient-search-perfected-third-edition.html` | — | — |
| `movement-service-filter-experiment.html` | — | — |
| `raise-a-referral-perfected-third-edition.html` | — | — |
| `header-text-5-variations.html` | — | — |
| `header-text-inside-capsule-variations.html` | — | — |
| `header-text-perfected-variations.html` | — | — |
| `header-text-redesign-mockups.html` | — | — |
| `header-text-clean-perfected.html` | — | — |
| `header-text-perfected-specification.html` | — | — |
| `header-badge-size-variations.html` | — | — |
| `ward-decisions-perfected-third-edition.html` | — | — |
| `delays-perfected-third-edition.html` | — | — |
| `notification-popup-third-edition.html` | — | — |
| `ward-before-after-redesign.html` | — | — |
| `needs-you-now-home-mockup.html` | — | — |
| `one-ward-page-mockup.html` | — | — |

## Superseded — never build from these

- `patient-search-console.html`
- `patient-search-working.html`

## What the checks found

### ⚠️ ROUTE WITH NO MOCKUP — undrawn, or needs an entry — 19

- `/bed-meeting`
- `/bed-meeting/agenda`
- `/command`
- `/community`
- `/constellation`
- `/delays`
- `/ed`
- `/escalation`
- `/exceptions`
- `/movements/[movementId]`
- `/queue`
- `/reports/chronology`
- `/reports/downtime`
- `/statistics/eds`
- `/statistics/services`
- `/statistics/teams`
- `/statistics/wards`
- `/statistics/weekly`
- `/transport`

⚠️ **An UNREACHABLE entry is not always a defect** — a component may be mounted by a route file
this check cannot follow. **It is always worth opening.** `ed-home.tsx` was found exactly this way:
a whole emergency-department index screen with no route and no importer.
