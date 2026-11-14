# Statistics definitions (draft)

_Updated 2026-11-14 - Windows table added (figures, D-220); first draft 2026-11-10 for master audit list item M121; Documentation owns._

**Status: DRAFT for Josh.** One row per published figure: what it counts, what it divides by, what it
shows when there are too few to count, and the one place it is worked out. Where the code has more
than one place, or no written small-number rule, the row says so. The definitions come from the
source comments and existing rulings; a row marked **to rule** needs Josh's choice before it is
final. Hand-worked tests: `tests/ward-audit-m121-statistics-arithmetic.test.ts`. M24 proves the
screens agree with each other; this page and that test prove the shared number is right.

| Figure                    | Numerator                                                                     | Denominator                      | Small numbers and empty                                                                                                      | One implementation                                                                                                                                                                                                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Beds in use               | Occupied + Pulled beds (`bedStates`); leave is a marker inside Occupied       | (a count)                        | 0 is a real count                                                                                                            | `occupiedBeds` (`statistics/statistics-occupancy.ts`), `wardBedsInUse` (`ward-occupancy.ts`)                                                                                                                                                                                              |
| Occupancy                 | Beds in use                                                                   | Beds on the ward or wards        | **To rule:** a ward with no beds should read "no beds"; the helper returns 0 and several screens print 0%                    | `occupancyPercent` (`statistics-occupancy.ts`). **Also worked out inline** in `statistics-ward-screen.tsx`, `statistics-service-screen.tsx`, and with **occupied only** in `statistics-journey-view.tsx` ("Of beds"), `executive-statistics-derivations.ts` and `statistics-map-view.tsx` |
| Length of stay            | Minutes from arrival to leaving (or to now while on the ward)                 | Stays measured                   | No stays: no average (never 0 days). Arrival after leaving is counted as incoherent, not measured                            | `lengthOfStay` and `averageLengthOfStayDays` (`ward-statistics.ts`)                                                                                                                                                                                                                       |
| Median ED wait            | The middle wait of people waiting in the department now                       | People waiting                   | None waiting: no median. **To rule:** no minimum count (the clearance median needs five)                                     | `median` (`statistics/executive-statistics-derivations.ts`). **Also worked out inline** in the same file (`medianWaitMinutes`, about line 299)                                                                                                                                            |
| Time to medical clearance | Median minutes from arrival to a recorded "cleared"                           | Journeys with "cleared" recorded | Under five journeys: "Too few" (`CLEARANCE_MEDIAN_MIN_JOURNEYS` = 5). A clearance before arrival counts as 0 minutes         | `clearanceMedian` and `edClearanceMedian` (`ed/ed-clearance-time.ts`)                                                                                                                                                                                                                     |
| Delayed bed-days          | Minutes from ready-since (or arrival, if later) to leaving, within the period | (a sum, shown in days)           | A stay with no ready-since date, or cleared, counts nothing. The whole delay goes under the reason recorded now              | `delayedBedDaysByReason` (`ward-delayed-discharge.ts`)                                                                                                                                                                                                                                    |
| Readmitted within 28 days | Arrivals of a person discharged from a ward in the 28 days before             | (a count; one per arrival)       | 0 is a real count. A prompt to look, not a performance measure                                                               | `readmissionsArrivedIn` and `createReadmissionIndex` (`ward-readmission.ts`)                                                                                                                                                                                                              |
| Frequent presenter        | ED presentations with a full date in the 12 months up to and including today  | (a count against the threshold)  | A month-only date ("Mar 2026") is not counted. Threshold from `ward-clinical-values.ts` (`frequentPresenterEdPresentations`) | `edPresentationsInWindow` and `frequentPresenterTag` (`ward-patient-care-plans.ts`)                                                                                                                                                                                                       |

## Windows

Every count runs over one of these windows, on the board's day (`dayOf`, `ward-clock.ts`), on the
Perth clock (R-FIGS-14, owner ruling item 12; D-220: the week is Monday 12:00 am to the next Monday
12:00 am). The rows live in `src/components/ward-management/figures/figure-windows.ts`, whose
`windowLine` writes a window's real start on screen with am/pm and no zone words ("Sat 14 Nov,
12:00 am to now"; the app is on Perth time throughout, Josh 14 Nov 2026). On
the signed-in site a day starts at 8:00 am Perth until PR B moves day 0 to Perth midnight (F2); the
line shows that start honestly. `tests/figure-windows-doc.test.ts` fails if this table drifts from
the rows. Do not edit it by hand. Run
`UPDATE_FIGURE_WINDOWS_DOC=1 node scripts/run-vitest.mjs run tests/figure-windows-doc.test.ts` to rewrite it.

<!-- prettier-ignore-start -->
<!-- figure-windows:start -->

| Window | Starts | Ends | Used by | Edges set by | Id |
| --- | --- | --- | --- | --- | --- |
| Now | The board's time now | The board's time now | Beds in use, occupancy, Beds ready now, Need a bed, Waiting in ED, held up, alerts | A snapshot of the records at `now` | `now` |
| Today | 12:00 am on the board's day | Now | Referrals today, admitted today, gone today, due today | `dayOf` (`ward-clock.ts`) | `today` |
| By tomorrow | Any earlier date (overdue included) | 12:00 am the day after tomorrow | Held up (D-191 item 5) | `releaseBand` (`ward-bed-availability.ts`) | `by-tomorrow` |
| Next 7 days | 12:00 am today | 12:00 am seven days later (today and the next six days) | Discharge planned, expected discharges | `isDueWithinDays` (`statistics/statistics-dates.ts`) | `next-7-days` |
| Week | Monday 12:00 am | The next Monday 12:00 am; this week so far ends now | Weekly report | `reportWeek` (`reports/weekly-report.ts`) | `week` |
| ED wait bands | Each journey's start in the ED (`openedAt`) | Now | Over 8 h and over 24 h in ED, the ED wait bands | `inEdOver` (`ward-shared-figures.ts`), `ED_WAIT_BANDS` (`statistics/statistics-ed-waits.ts`) | `ed-wait` |
| 28 days | 28 days before each arrival | The arrival | Readmitted within 28 days | `READMISSION_WINDOW_DAYS` (`ward-readmission.ts`) | `readmission` |
| 12 months | 12:00 am the day after today's date 12 months ago | 12:00 am tomorrow (today included) | Frequent presenter | `edPresentationsInWindow` (`ward-patient-care-plans.ts`) | `frequent-presenter` |
| Hours | The start of the earliest shown hour | Now (the current hour so far) | Session trends | `sessionTrends` (`statistics/statistics-session-trends.ts`) | `hours` |
| Last 24 hours | 24 hours before now | Now | A release confirmed in the last 24 hours (a rolling window, not the calendar day) | `releaseBand` (`ward-bed-availability.ts`) | `discharged-rolling` |
| Any date | No start: every open item | No end | Held up · any date | `blockedDischargesByReason` (`statistics/statistics-derivations.ts`) | `any-date` |

<!-- figure-windows:end -->
<!-- prettier-ignore-end -->

## Found while writing this

1. **"Of beds" divides occupied beds only.** `statistics-journey-view.tsx` prints "Of beds" as
   Occupied / Beds beside an in-use figure that includes Pulled. The L1 ruling (site review
   12 Oct 2026, quoted in `statistics-occupancy.ts`) says every occupancy percentage reads In use.
   `executive-statistics-derivations.ts` (about line 939) and `statistics-map-view.tsx` also divide
   an `occupied` value. Not changed: a statistics definition is Josh's call (todo in the test).
2. **No beds reads 0%.** `hospital-capacity-matrix.tsx` prints `0%`, and the copy tools print
   "Occupancy: 0% (0 of 0 beds in use)", for a ward with no beds. Two tool cards already show "—".
3. **Three medians.** `median`, an inline copy beside it, and `clearanceMedian`. They agree on the
   tested values, but only `clearanceMedian` has a small-number rule.
4. **About 150 inline `* 100` expressions** in `src/` (some are bar widths, not published figures).
   `tests/ward-audit-m121-inline-percent-baseline.json` holds today's count per file; the test fails
   when any file gains one. Lower a file's number when a percentage moves to a shared helper.
