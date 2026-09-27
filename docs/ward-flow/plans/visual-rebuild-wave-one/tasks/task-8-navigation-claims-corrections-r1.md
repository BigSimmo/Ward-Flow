# Task 8 navigation and claims corrections — revision 1

Date: 2026-09-13  
Execution model: `gpt-5.6-sol / medium`  
Plan SHA256: `2E6A6F90C7986829895E6FE8AD4D0C33CBDE3F973D35FDA8ABA6570B520F07C9`

## Result

Three stale contracts were corrected without changing a product interface, route, handler or derivation.

- The dynamic-route ledger retains the exact concrete Board route and its mechanical `1 of 23 instances reachable without state` figure. Its exact builder list now includes the canonical `wardBoardHref` definition, and the orphan explanation records the indirect Change ward navigation without pretending the textual scan can count helper-produced instances.
- The legacy fixed-phone-bar reserve check no longer requires padding in the three exact modules beneath the normal-flow third-edition rail. The exceptions are non-vacuous and the same assertion positively pins both halves of the 1000px structure: `WardRail` becomes static and the shared shell becomes a column. All other enumerated legacy shell modules retain the existing reserve requirement.
- The Community switcher claim remains unchanged and true. Its evidence in `statistics-claims-register.ts` now follows the current native disclosure from the labelled navigation through the Change team summary and the filtered `COMMUNITY_TEAM_PAGES` link map. No other registered claim changed.

## Output hashes

- `tests/ward-nav.test.ts` — `500D80D89C850268F48576C901F9BA2EDB4B115AE0F8A644F1FA941F4E3E6D87`
- `tests/ward-sidebar-phone-contract.test.ts` — `A286D0C54237338DF66346BA34D5614BBB4922C58B5B17FD0F8A806E0F827C0F`
- `src/components/ward-management/statistics/statistics-claims-register.ts` — `A5B1AD79A11E8AE1FBE300011CB996A7AEE7898E5975B3630460148256E780AC`

## Inspection and verification boundary

- The collapsed-whitespace Community evidence fragment occurs exactly once in `community-screen.tsx` (`count=1`).
- `git diff --check -- tests/ward-nav.test.ts tests/ward-sidebar-phone-contract.test.ts src/components/ward-management/statistics/statistics-claims-register.ts` — passed with no output.
- Tests and browser checks were not run under the controller-owned verification boundary.
