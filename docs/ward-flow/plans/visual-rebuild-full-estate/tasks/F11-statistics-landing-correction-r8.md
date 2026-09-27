# F11 Statistics landing correction r8

Date: 2026-09-13  
Writer: `/root/hub_inventory`  
Scope: Statistics landing presentation only

## Visual inputs

Inspected at original detail:

- `statistics-app-1440-light-r8.png`
- `statistics-mock-1440-light-r8.png`
- `statistics-app-390-light-r8.png`
- `statistics-mock-390-light-r8.png`

These are pre-change design inputs. No post-change visual acceptance is claimed.

## Before-source evidence

Byte-exact copies are stored beneath:

`.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-F11-statistics-landing-r8/`

| Source                                                                                  | Before SHA-256                                                     |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/components/ward-management/statistics/statistics-screen.tsx`                       | `F4529C572D27C8BCD9D9CDF4BD3BC4673BC275C7EF106ED2CE3A820CB8192FB5` |
| `src/components/ward-management/statistics/statistics-landing-third-edition.module.css` | `E19F9CA710170A9889A3EC0223564F308D463050B02188A20722645256330C4E` |

## Implementation

- Made `Across all services` the first visible page panel. The unrestricted coordinator claim remains explicit and precedes every figure, but now sits as a compact native disclosure inside that panel instead of consuming a separate page-level block.
- Kept every `STATISTICS_SECTIONS` label, description, href, fragment, and index test id. The complete index now sits in a second labelled disclosure within the Across panel, after the current metric band.
- Moved the unchanged synthetic-prototype statement to a compact provenance footer after the working panels and choosers. No safety copy was removed.
- Replaced the Flow panel's prose-first presentation with a compact `Recorded pull-to-arrival range`: labelled shortest, average, and longest values; an explicit zero-spread statement when the existing values coincide across more than one record; and visible measured, ended, still-running, and impossible-chronology-excluded counts.
- Retained the complete prior clinician explanation, null-average explanation, range rationale, constant-gap caveat, population statement, chronology exclusion, and all existing test ids inside a labelled native details disclosure below the compact view.
- Applied the existing Ward-local `usePrintableDisclosures` pattern and `source-print` marker to the access, index, Across measurement, and Flow measurement disclosures. Print therefore expands them temporarily and restores their prior open and `name` states. Actual print output was not run in this scope.
- Kept the remaining panel order unchanged: Where the pressure is, Emergency departments, Community teams, Referrals for a bed, and the existing service chooser remain where the component already placed them.

## Behavior and design deviations

- All values still come directly from `pullToArrival`, `bedsBeingPrepared`, `refusedAndNothingPending`, and the other existing statistics helpers. No data model, reducer, scope, threshold, ranking, or clinical derivation changed.
- The drawing's fourteen-day admissions and discharges trend is not reproduced because this working screen has no historical series for it. The Flow panel instead visualizes the actual supported shortest/average/longest pull-to-arrival measurement and labels it as a recorded range rather than implying a trend.
- A zero-width range remains three explicitly labelled equal values plus the sentence `No recorded spread`; it is not drawn as false variation. A null average renders `Not available`, never zero.
- Negative or reversed chronology remains excluded by the existing helper and its existing full explanation; the visible compact count reports those excluded records without changing the exclusion.
- Both original audiences remain in their respective printable native disclosures after the compact views.

## Source checks

- Prettier formatted the two owned files once.
- TypeScript syntax parse: `TSX_PARSE_OK`.
- CSS Modules pure-mode parse: `CSS_MODULE_PURE_OK`.
- Static comparison found all 66 prior literal test-id prefixes still present.
- Static invariants confirmed the section-map links, disclaimers, `pullToArrival` call, and all average/range/population/exclusion fields remain referenced.
- No tests, browser, server, or Git operations were run, as instructed.

## After-source evidence

| Source                                                                                  | After SHA-256                                                      |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/components/ward-management/statistics/statistics-screen.tsx`                       | `58ED4C5915107B4BBCDFC56B0F1D910B82C94858E85A5D2BE3242188C76ADE6C` |
| `src/components/ward-management/statistics/statistics-landing-third-edition.module.css` | `184A71A4F4BA77376F4238A89EAFDAE5E5D05977D6ECD364E5E585508C42CBCA` |

Runtime, responsive, and print acceptance remain controller-owned.
