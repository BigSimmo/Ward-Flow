# App files only tests use: triage (M94)

_Dated 10 November 2026, audit item M94. One-off triage; Engine owns. Nothing here was removed._

Evidence boundary: one local run of `npx knip --production --no-exit-code --include files` on branch `claude/project-thread-bnphlk` (from main 29352cd0), 10 Nov 2026. It listed 23 files. Test counts are files under `tests/` that import each one. Knip cannot see `next.config.ts` aliases or `scripts/` entry points, so some rows are false positives.

Removals follow the dead-code rule ([dead-code-deletion.md](../../agents/dead-code-deletion.md)): each needs Josh's yes, with what would be lost stated first.

## Keep: used outside the app bundle (knip false positives)

| File                                                             | Why it stays                                                          |
| ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| `src/components/ward-management/live-build/ward-no-demo-data.ts` | `next.config.ts` swaps it in for the demo data in a live shared build |
| `src/lib/ward-shared-build-settings.ts`                          | Read by `next.config.ts` at build time (CB-5)                         |
| `src/components/ward-management/help-content/ward-help-print.ts` | Entry for `scripts/build-help-cheat-sheets.mjs`                       |

## Keep: test-only by design (guard data)

| File                                                                                                                                                       | Why it stays                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `statistics/statistics-claims-register.ts`, `statistics-claims-shared.ts`, `statistics-claims-statistics-screen.ts`, `statistics-claims-other-surfaces.ts` | The claims register: the statements statistics screens make, checked by guard tests. Data for tests, not screen code  |
| `statistics/statistics-disclaimers.tsx`                                                                                                                    | Only the claims register reads it. Josh to say whether the two sentences should show on screen again or the file goes |

## Candidates for removal (Josh decides each)

These are screen or helper code no route renders any more. Each is kept alive only by its own tests.

| File                                             | Test files | What would be lost                                                                                                                                |
| ------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ward-management-console.tsx`                    | 15         | The old movement workspace and its 15 test files                                                                                                  |
| `statistics/statistics-overview-screen.tsx`      | 11         | The old all-services statistics section                                                                                                           |
| `shell/ward-rail.tsx`                            | 4          | The v6 rail, replaced by `shell-next/next-rail`                                                                                                   |
| `search/patient-typeahead.tsx`                   | 3          | A name typeahead no screen mounts                                                                                                                 |
| `coordinator/coordinator-cockpit.tsx`            | 2          | The old coordinator cockpit                                                                                                                       |
| `statistics/hospital-capacity-matrix.tsx`        | 2          | The "Beds by ward" matrix                                                                                                                         |
| `patients/patient-journey.ts`                    | 1          | The v10 journey strip model                                                                                                                       |
| `patients/person-by-umrn.tsx`                    | 1          | The `/people/<UMRN>` lookup                                                                                                                       |
| `board/ward-board-toast.tsx`                     | 1          | The bed board's own toast                                                                                                                         |
| `ward/ward-page-action-toast.tsx`                | 1          | The ward page's own toast (audit A-1)                                                                                                             |
| `ward-role-alerts.ts`                            | 1          | Phone alerts for the officer and community desks (D-80). Check first: D-80 may still want these wired, which would make this a gap, not dead code |
| `site-sign-off/bed-manager-tasks.ts`             | 1          | The site bed manager's own tasks (D-80, question 61). Same check as above                                                                         |
| `shell/ward-figure-scope.ts`                     | 1          | A chosen-service helper                                                                                                                           |
| `ward-service-colors.ts`                         | 1          | The WA health service colour key                                                                                                                  |
| `src/components/clinical-dashboard/use-theme.ts` | 1          | A thin theme hook over `@/lib/theme-client`                                                                                                       |

Paths without a folder prefix are under `src/components/ward-management/`.

## Still to do (a person)

1. Josh: rule on the two D-80 rows (`ward-role-alerts.ts`, `bed-manager-tasks.ts`): wire them in, or remove.
2. Josh: approve or refuse the other removals. An approved removal deletes the file and the tests that exist only for it, in one PR.
