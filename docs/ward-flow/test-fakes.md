# What the tests fake

_Started 2026-11-10 for audit item M90. Testing owns. Checked by `tests/ward-audit-m90-test-fakes.test.ts`._

Evidence boundary: this lists what the offline tests replace with a stand-in, and which test exercises the real part. It proves nothing about hosted runs; CI's own logs do.

About 880 test files replace something (a mocked module, a stubbed browser API, a fixed clock, a stubbed network route or an in-memory store). Most are harmless: a screen test that fakes `next/link` cannot hide a real ward-flow failure. The rows below are the fakes that could. Each high-risk row names the test that runs the real thing, or says it is open and what would close it.

## High-risk fakes

| Fake                        | Where it is faked                                                                                                                                               | Risk   | Real coverage                                                                                                                                                                             |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Postgres store              | Backend tests without `WARD_TEST_DATABASE_URL` use the in-memory store                                                                                          | high   | `backend/ward-flow/postgres.test.mjs` and every `{ skip: !url }` backend test, run against CI's Postgres service in the backend job                                                       |
| Shared backend over HTTP    | `tests/ward-shared-client.test.ts` and other unit tests inject a fake transport or `fetch`                                                                      | high   | `tests/ward-shared-mode.spec.ts`, `tests/ward-shared-recovery.spec.ts`, run by `tests/support/ward-shared-mode-run.mjs` in the CI backend job against a real backend and Postgres         |
| Supabase Auth               | Unit tests mock `@/components/ward-management/ward-supabase-auth`; the shared-mode run uses a local fake Auth server (`tests/support/ward-shared-mode-run.mjs`) | high   | Open: no offline or CI test signs in against real Supabase Auth. Closing it needs a hosted check Josh approves (provider rule 3)                                                          |
| Phone push delivery         | `@/components/ward-management/shell/ward-phone-push` mocked; `PushManager` and service worker stubbed                                                           | high   | Partly: `backend/ward-flow/push.test.mjs` checks VAPID settings and what is announced; `tests/ward-pwa-worker.test.ts` checks the worker. Open: no test delivers a real push to a browser |
| Clock                       | `vi.useFakeTimers`, `vi.setSystemTime`, mocks of `@/components/ward-management/ward-clock`, Playwright `page.clock`                                             | medium | `tests/release-gate-journeys.spec.ts` runs on the real clock; engine rules take `now` as an input, so fixed-time tests exercise the same code                                             |
| Browser storage             | jsdom `localStorage`, `sessionStorage` and IndexedDB; mocks of `@/components/ward-management/ward-flow-demo-storage`                                            | medium | `tests/ui-ward-pwa-lifecycle.spec.ts` and the release-gate journeys use real browser storage                                                                                              |
| Ward Flow provider          | About 60 DOM tests mock `@/components/ward-management/ward-flow-provider` and hand the screen a fixed state                                                     | medium | `tests/release-gate-journeys.spec.ts` and the `ui-ward-*` journeys run screens on the real provider and reducer                                                                           |
| Access scope and role gate  | Mocks of `@/components/ward-management/ward-access-scope`, `ward-role-gate`, `shell/ward-access-store`                                                          | high   | `tests/ward-role-access.test.ts` and `tests/ward-partial-view.test.ts` run the real scope; `backend/ward-flow/role-response-authority.test.mjs` runs the backend's                        |
| Network routes in a browser | `page.route` in `tests/ward-shared-recovery.spec.ts` (drops replies to test recovery) and `tests/ui-ward-chrome-header.spec.ts`                                 | medium | `tests/ward-shared-mode.spec.ts` runs the same saves with no route stubs                                                                                                                  |

## Low-risk fakes

Framework and presentation stand-ins: `next/link`, `next/navigation`, `next/headers`, `next/dynamic`, `next/font/local`, `react`, `html-to-image`, `@axe-core/playwright`, `@/components/wf` and its parts, help, tour and statistics display modules, clipboard and download helpers, `node:fs` and `node:child_process` in tooling tests, and `pg` in the M80 scheduled-jobs test (its receipt clean-up tests pass their own pool; the real driver runs in the backend job). The browser journeys render the real ones.

## Every mocked module

The test fails when a test mocks a module not in this list. Add it here, and to the high-risk table if it could hide a real failure.

```text
../scripts/playwright-base-url
../scripts/ward-flow/test-preparation-profile.mjs
@/app/mockups/ward-flow-redesign/_preview/preview-world
@/components/ward-management/coordinator/home-layout
@/components/ward-management/ed/ed-preview
@/components/ward-management/ed/ed-screen
@/components/ward-management/forecast/forecast-lazy
@/components/ward-management/forecast/use-forecast-model
@/components/ward-management/help/ward-help-report-picture
@/components/ward-management/help/ward-help-store
@/components/ward-management/help/ward-tour-facts
@/components/ward-management/help/ward-tour-more-steps
@/components/ward-management/night-view-figures
@/components/ward-management/patients/patient-now-screen
@/components/ward-management/patients/patient-record-extras
@/components/ward-management/patients/patient-status-card
@/components/ward-management/preload-when-idle
@/components/ward-management/referrals/accepted-ward-referral
@/components/ward-management/referrals/pull-accepted-referral
@/components/ward-management/referrals/referral-history-corrections
@/components/ward-management/reports/downtime-pack
@/components/ward-management/reports/downtime-pack-context
@/components/ward-management/reports/use-own-units
@/components/ward-management/reports/use-take-downtime-pack
@/components/ward-management/search/ward-smart-search
@/components/ward-management/settings/discreet-names
@/components/ward-management/settings/settings-desk-profile
@/components/ward-management/shell-next/next-bar
@/components/ward-management/shell-next/next-rail
@/components/ward-management/shell/ward-access
@/components/ward-management/shell/ward-access-context
@/components/ward-management/shell/ward-access-store
@/components/ward-management/shell/ward-activity-panel-store
@/components/ward-management/shell/ward-command-activity
@/components/ward-management/shell/ward-desk-early
@/components/ward-management/shell/ward-drawer-bus
@/components/ward-management/shell/ward-feature-flag-store
@/components/ward-management/shell/ward-live-region
@/components/ward-management/shell/ward-phone-push
@/components/ward-management/shell/ward-prototype-footer
@/components/ward-management/shell/ward-service-store
@/components/ward-management/shell/ward-shell-public-context
@/components/ward-management/shell/ward-sound-store
@/components/ward-management/statistics/executive-statistics-context
@/components/ward-management/statistics/executive-statistics-projector
@/components/ward-management/statistics/statistics-csv
@/components/ward-management/statistics/statistics-ed-screen
@/components/ward-management/statistics/statistics-ed-swarm
@/components/ward-management/statistics/statistics-hero
@/components/ward-management/statistics/statistics-summary-phone
@/components/ward-management/triage/triage-risk-state
@/components/ward-management/use-online-status
@/components/ward-management/use-ward-nav-counts
@/components/ward-management/ward-access-scope
@/components/ward-management/ward-act-now-items
@/components/ward-management/ward-auth-session
@/components/ward-management/ward-clipboard
@/components/ward-management/ward-clock
@/components/ward-management/ward-command-completion
@/components/ward-management/ward-download
@/components/ward-management/ward-flow-demo-storage
@/components/ward-management/ward-flow-provider
@/components/ward-management/ward-flow-raise
@/components/ward-management/ward-flow-reducer
@/components/ward-management/ward-flow-typed-text-scrub
@/components/ward-management/ward-global-search-help
@/components/ward-management/ward-operational-defaults
@/components/ward-management/ward-patient-archive
@/components/ward-management/ward-patient-name
@/components/ward-management/ward-patients
@/components/ward-management/ward-role-gate
@/components/ward-management/ward-scenario-network-loader
@/components/ward-management/ward-scenarios
@/components/ward-management/ward-sender-presentation
@/components/ward-management/ward-shared-access
@/components/ward-management/ward-sign-out-guard
@/components/ward-management/ward-statistics
@/components/ward-management/ward-supabase-auth
@/components/ward-management/ward/ward-screen-lazy
@/components/wf
@/components/wf/dialog
@/components/wf/toast-choices
@/components/wf/toast-choices-entry
@/components/wf/use-is-phone
@/lib/copy-to-clipboard
@/lib/front-door-pass
@axe-core/playwright
html-to-image
next/dynamic
next/font/local
next/headers
next/link
next/navigation
node:child_process
node:fs
pg
react
```
