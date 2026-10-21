# Clinical values

Every threshold and timing that flags, colours or escalates a patient, referral or bed in Ward Flow,
with whether it is synthetic or signed for the prototype. Synthetic data only: no value here is a
clinical, legal or service standard. Every value, signed or not, still needs formal clinical
governance sign-off before real patient use (D-54).

- **Source of truth:** `src/components/ward-management/ward-clinical-values.ts`. The screens, the
  engine and this page all read from it. Settings shows the same list under Data and about,
  Reference, Clinical values.
- **Synthetic** means a prototype default nobody has clinically signed. It may be Josh's product
  default (the source names the decision) or a figure an earlier build typed in ("No decision
  recorded").
- **Signed** means a named person signed it for the prototype on a date. On 15 Oct 2026 Josh signed,
  as product owner, every value with a recorded source (D-56). On 16 Oct 2026 he signed the rest,
  changing two (D-63). On 20 Oct 2026 (07:02 AWST) he signed the missed bed request window (`missedRequestWindow`, 2 hours). This is not clinical governance sign-off. To sign a value, change its status in the source file to `signed` with `signedBy` and
  `signedOn`. The type will not accept one without the other.
- **Other figures seen** lists a different figure another screen or document used for the same rule.
  Where screens disagreed, the figure the main app runs on was kept.
- **Unknown legal status (D-69):** on 20 Oct 2026 (2:02 PM AWST) Josh ruled, in his own words:
  "Needs an involuntary-capable bed until status is set." A referral with no legal status recorded needs an involuntary-capable bed and
  never defaults to Voluntary. This is an allocation rule, not a threshold, so it is not in the table.
- Mental Health Act periods are not here, and Ward Flow holds none (D-70, which replaced D-29). The
  only form due time is the one a person records. Legal form titles come from the Chief Psychiatrist
  register, not from this list.
- `tests/ward-clinical-values.test.ts` fails if a threshold is typed as a number elsewhere in the ward
  code, or if the table below drifts from the source file. Do not edit the table by hand. Run
  `UPDATE_CLINICAL_VALUES_DOC=1 npx vitest run tests/ward-clinical-values.test.ts` to rewrite it.

<!-- prettier-ignore-start -->
<!-- clinical-values:start -->

| Group | Rule | Value | Status | Source | Other figures seen | Id |
| --- | --- | --- | --- | --- | --- | --- |
| Referral tiers | Tier 1 referral shown as overdue after | 1 hour | Signed for the prototype by Josh (product owner), 2026-10-15 | D-54 (10 Oct 2026); one rule since the L4 site review, 12 Oct 2026 | 8 hours (Home queue before 12 Oct 2026) | `tierOneOverdue` |
| Referral tiers | Tier 2 referral shown as overdue after | 4 hours | Signed for the prototype by Josh (product owner), 2026-10-15 | D-54 (10 Oct 2026); one rule since the L4 site review, 12 Oct 2026 | 24 hours (Home queue before 12 Oct 2026) | `tierTwoOverdue` |
| Referral tiers | Tier 3 referral shown as overdue after | 24 hours | Signed for the prototype by Josh (product owner), 2026-10-15 | D-54 (10 Oct 2026); one rule since the L4 site review, 12 Oct 2026 | 72 hours (Home queue before 12 Oct 2026) | `tierThreeOverdue` |
| Referral tiers | Any referral shown as overdue after | 72 hours | Signed for the prototype by Josh (product owner), 2026-10-15 | D-54 (10 Oct 2026) | None recorded | `anyTierOverdue` |
| Emergency department waits | ED pressure shown as elevated from a wait of | 3 hours | Signed for the prototype by Josh (product owner), 2026-10-15 | D-22 (26 Sep 2026), labelled default | None recorded | `edElevatedPressure` |
| Emergency department waits | ED pressure shown as severe, and first escalation step, from a wait of | 8 hours | Signed for the prototype by Josh (product owner), 2026-10-15 | D-22 (26 Sep 2026), labelled default; the ACEM eight hour line came off screens under D-24 | None recorded | `edSeverePressure` |
| Emergency department waits | Wait in hospital shown as long, and top escalation step, from | 24 hours | Signed for the prototype by Josh (product owner), 2026-10-15 | D-24 (26 Sep 2026), Josh's default, shown neutral | None recorded | `longWait` |
| Emergency department waits | Wait in hospital shown in the second, danger waiting band on statistics, from | 48 hours | Signed for the prototype by Josh (product owner), 2026-10-16 | D-63 (16 Oct 2026), twice the long wait, a display band with no WA or national mark | None recorded | `veryLongWait` |
| Emergency department waits | ED access target, counted from arrival | 24 hours, default, changeable in Settings | Signed for the prototype by Josh (product owner), 2026-10-15 | Owner ruling 22 Aug 2026 (ward-model.ts provenance) | 4 hours (the original spec, superseded 22 Aug 2026) | `edAccessTarget` |
| Emergency department waits | Psychiatric bed released after a medical trip expected to last | 24 hours | Signed for the prototype by Josh (product owner), 2026-10-15 | FD-19 (30 Aug 2026) (ward-model.ts provenance) | None recorded | `edMedicalBedRelease` |
| Bed occupancy | Bed alert line on the rail, statistics and meters | 85% | Signed for the prototype by Josh (product owner), 2026-10-15 | Josh, v6 shell boards 02 and 03b, 7 Oct 2026; D-24 had taken the eighty five line off until sourced | 90% (the occupancy colour band, and All wards before 11 Oct 2026); 90% (the WEAT target line removed under D-24) | `bedAlertLine` |
| Bed occupancy | Service occupancy colour band, amber from | 90% | Signed for the prototype by Josh (product owner), 2026-10-15 | D-22 (26 Sep 2026), labelled default | 85% (the bed alert line) | `occupancyAmber` |
| Bed occupancy | Service occupancy colour band, surge from | 95% | Signed for the prototype by Josh (product owner), 2026-10-15 | D-22 (26 Sep 2026), labelled default | None recorded | `occupancySurge` |
| Bed occupancy | Service occupancy colour band, red from | 98% | Signed for the prototype by Josh (product owner), 2026-10-15 | D-22 (26 Sep 2026), labelled default | None recorded | `occupancyCritical` |
| Legal form warnings | Typed legal due time, urgent warning before it | 1 hour, default, changeable in Settings | Signed for the prototype by Josh (product owner), 2026-10-15 | D-24 (26 Sep 2026), Josh's default | None recorded | `dueSoonUrgent` |
| Legal form warnings | Typed legal due time, first warning before it | 3 hours, default, changeable in Settings | Signed for the prototype by Josh (product owner), 2026-10-15 | D-24 (26 Sep 2026), Josh's default | None recorded | `dueSoon` |
| Alerts and holds | Unanswered Pull now returns to the coordinator after | 15 minutes | Signed for the prototype by Josh (product owner), 2026-10-15 | Josh accepted, global alerts option A, 10 Oct 2026 | None recorded | `pullNowAnswer` |
| Alerts and holds | Pull now stays live, if nobody pulls or stands it down, for | 4 hours | Signed for the prototype by Josh (product owner), 2026-10-15 | Global alerts option A, 10 Oct 2026 | None recorded | `pullNowLive` |
| Alerts and holds | Pull hold on an accepting bed lasts | 4 hours, default, changeable in Settings | Signed for the prototype by Josh (product owner), 2026-10-15 | Owner answer 35, 17 Sep 2026 (ward-model.ts provenance) | None recorded | `pullHold` |
| Alerts and holds | Extra-travel bed hold adds | 1 hour | Signed for the prototype by Josh (product owner), 2026-10-21 | Josh, 21 Oct 2026, D-72 decision card (ward-model.ts provenance) | None recorded | `extraTravelHold` |
| Alerts and holds | Bed hold without a confirmed dispatch flagged for review after | 2 hours | Signed for the prototype by Josh (product owner), 2026-10-15 | Josh, 26 Sep 2026, his default | None recorded | `bedHoldReview` |
| Alerts and holds | Ward bed count named as not checked after | 1 hour | Signed for the prototype by Josh (product owner), 2026-10-16 | D-63 (16 Oct 2026), local workflow choice, no external source | None recorded | `bedCountFresh` |
| Alerts and holds | Downtime pack shown as stale after | 1 hour | Signed for the prototype by Josh (product owner), 2026-10-16 | D-63 (16 Oct 2026), local workflow choice; each health service's business continuity plan sets downtime report refresh | None recorded | `downtimePackStale` |
| Alerts and holds | Bed left as preparing or cleaning flagged after | 61 minutes | Signed for the prototype by Josh (product owner), 2026-10-16 | D-63 (16 Oct 2026), more than an hour, local workflow choice | None recorded | `preparingBedStale` |
| Arrivals and answers | Arrival counted as late, past the estimate, after | 1 hour | Signed for the prototype by Josh (product owner), 2026-10-15 | D-22 (26 Sep 2026), labelled default | None recorded | `lateArrivalGrace` |
| Arrivals and answers | Ward that has not answered a referral, first reminder after | 2 hours | Signed for the prototype by Josh (product owner), 2026-10-15 | D-22 (26 Sep 2026), labelled default | None recorded | `silentWardFirstReminder` |
| Arrivals and answers | Ward that has not answered a referral, second reminder after | 4 hours | Signed for the prototype by Josh (product owner), 2026-10-15 | D-22 (26 Sep 2026), labelled default | None recorded | `silentWardSecondReminder` |
| Arrivals and answers | Bed request with no ward asked counted as missed after | 2 hours | Signed for the prototype by Josh (product owner), 2026-10-20 | Product brief success measure 2 (25 Sep 2026); signed off by owner Josh, 07:02 AWST 20 Oct 2026, prototype | None recorded | `missedRequestWindow` |
| Arrivals and answers | Decision target, ward answers a referral within | 2 hours, default, changeable in Settings | Signed for the prototype by Josh (product owner), 2026-10-15 | Stream A, 9 Oct 2026, labelled default | None recorded | `wardAnswerTarget` |
| Arrivals and answers | Decision target, transfer accepted within | 4 hours, default, changeable in Settings | Signed for the prototype by Josh (product owner), 2026-10-15 | Stream A, 9 Oct 2026, labelled default | None recorded | `transferAcceptanceTarget` |
| Arrivals and answers | Decision target, transport booked within | 1 hour, default, changeable in Settings | Signed for the prototype by Josh (product owner), 2026-10-15 | Stream A, 9 Oct 2026, labelled default | None recorded | `transportBookedTarget` |
| Arrivals and answers | Expected arrival flagged after waiting, voluntary | 48 hours | Signed for the prototype by Josh (product owner), 2026-10-15 | Josh, 7 Sep 2026 | None recorded | `expectFlagVoluntary` |
| Arrivals and answers | Expected arrival flagged after waiting, involuntary | 7 days | Signed for the prototype by Josh (product owner), 2026-10-15 | Josh, 7 Sep 2026 | None recorded | `expectFlagInvoluntary` |
| Arrivals and answers | Expected referral flagged to reconsider after | 72 hours | Signed for the prototype by Josh (product owner), 2026-10-15 | Josh, 7 Sep 2026 | None recorded | `expectReconsider` |
| Discharge, leave and absence | Discharge prep prompt opens before the expected discharge | 24 hours | Signed for the prototype by Josh (product owner), 2026-10-16 | D-63 (16 Oct 2026), local workflow choice; matches the pre-discharge medical review window in the WACHS Criteria Led Discharge Guideline | None recorded | `dischargePrepWindow` |
| Discharge, leave and absence | Criteria led discharge criteria need a fresh psychiatrist review after | 24 hours | Signed for the prototype by Josh (product owner), 2026-10-16 | D-63 (16 Oct 2026), WACHS Criteria Led Discharge Guideline (16 Apr 2026), s 2.5 and s 3: a medical review within this window before discharge. Shortened from the D-60 figure | None recorded | `dischargeCriteriaValidity` |
| Discharge, leave and absence | Leave bed flagged to consider opening after | 24 hours | Signed for the prototype by Josh (product owner), 2026-10-15 | D-23 (26 Sep 2026), Josh's default | None recorded | `leaveOpenWarning` |
| Discharge, leave and absence | Bed held for a person absent without leave flagged for review after | 4 hours | Signed for the prototype by Josh (product owner), 2026-10-16 | D-63 (16 Oct 2026), local workflow choice; MP 0012/16 leaves AWOL procedures to each health service. Review warning paused by D-65, then switched on again on 20 Oct 2026 when Josh turned on all features (flag awol-bed-hold-review) | None recorded | `awolBedHoldWarning` |
| Discharge, leave and absence | Community treatment order follow up booked within, after departure | 7 days | Signed for the prototype by Josh (product owner), 2026-10-15 | D-58 (15 Oct 2026), 7 days from the national KPI for community care within 7 days of discharge (AIHW). The KPI counts a completed contact after discharge from a public acute mental health unit. This check looks for a booking within the window on every discharge, with extra items for a CTO patient | None recorded | `ctoFollowUpWindow` |
| Discharge, leave and absence | Stay long enough to prompt a discharge plan, and escalation dossier, from | 7 days | Signed for the prototype by Josh (product owner), 2026-10-15 | Ward board long stay line; no decision recorded for the Top 25 dossier | None recorded | `longStayPrompt` |
| Discharge, leave and absence | Delayed discharge escalated, by recorded hours, after more than | 72 hours | Signed for the prototype by Josh (product owner), 2026-10-16 | D-63 (16 Oct 2026), local workflow choice, counted from the typed expected date | None recorded | `delayedDischargeEscalation` |
| Discharge, leave and absence | Readmission flag, discharged from a ward within | 28 days | Signed for the prototype by Josh (product owner), 2026-10-15 | D-58 (15 Oct 2026), national mental health KPI for readmission within 28 days (AIHW); a prompt to look | None recorded | `readmissionWindow` |
| Access and privacy | Patient record opened outside your care (break glass) stays open for | 1 hour | Signed for the prototype by Josh (product owner), 2026-10-16 | D-63 (16 Oct 2026), local privacy choice under MP 0015/16 need to know and audit | None recorded | `breakGlassWindow` |
| Access and privacy | Break glass openings in one shift before the coordinator is told it is a pattern | 3 | Signed for the prototype by Josh (product owner), 2026-10-16 | D-63 (16 Oct 2026), local privacy choice; every opening is still reviewed | None recorded | `breakGlassPerShift` |
| Access and privacy | One shift, when counting break glass openings for a pattern, is the last | 12 hours | Signed for the prototype by Josh (product owner), 2026-10-16 | D-63 (16 Oct 2026), the longest common WA shift | None recorded | `breakGlassShift` |
| Access and privacy | Emergency department keeps sight of a patient after they reach the ward for | 24 hours | Signed for the prototype by Josh (product owner), 2026-10-16 | D-63 (16 Oct 2026), local privacy choice | None recorded | `edHandoffWindow` |
| Access and privacy | Ward keeps sight of a patient after they leave, for the follow up, for | 7 days | Signed for the prototype by Josh (product owner), 2026-10-16 | D-63 (16 Oct 2026), the same figure as the 7 day follow up | None recorded | `wardHandoffWindow` |
| Access and privacy | A shared computer locks after no use for | 15 minutes | Signed for the prototype by Josh (product owner), 2026-10-16 | D-63 (16 Oct 2026), Australian Government ISM-0428: lock after at most 15 minutes of inactivity. Checked against the September 2026 ISM on cyber.gov.au (D-65) | None recorded | `idleLock` |
| Access and privacy | Executive headline counts of people below this show as fewer than this | 5 | Signed for the prototype by Josh (product owner), 2026-10-16 | D-63 (16 Oct 2026), common Australian small cell practice (counts under 5) | None recorded | `smallNumberHidden` |
| Access and privacy | Cover for a second ward or ED, given for one shift, lasts at most | 12 hours | Signed for the prototype by Josh (product owner), 2026-10-16 | D-63 (16 Oct 2026), one shift, the same figure as the break glass shift | None recorded | `coverLength` |
| Access and privacy | The signed-in shared site asks for a fresh sign-in after | 12 hours | Signed for the prototype by Josh (product owner), 2026-10-17 | D-65 (17 Oct 2026), Australian Government ISM-0428: sessions end after at most twelve hours. Checked against the September 2026 ISM on cyber.gov.au | None recorded | `sessionLimit` |
| Access and privacy | Granting access or opening a record outside your care needs a sign-in within the last | 10 minutes | Signed for the prototype by Josh (product owner), 2026-10-16 | D-63 (16 Oct 2026), local security choice, stricter than NIST SP 800-63B | None recorded | `stepUpWindow` |
| Access and privacy | Access review lists a role ending within | 14 days | Signed for the prototype by Josh (product owner), 2026-10-16 | D-63 (16 Oct 2026), local choice, two weeks to renew | None recorded | `accessExpiringSoon` |
| Access and privacy | A role not used for this long is switched off by itself | 45 days | Signed for the prototype by Josh (product owner), 2026-10-16 | D-63 (16 Oct 2026), Australian Government ISM-1404 and ISM-1648: access disabled after 45 days of inactivity. Was 90 days. Checked against the September 2026 ISM on cyber.gov.au (D-65) | None recorded | `accessUnused` |

<!-- clinical-values:end -->
<!-- prettier-ignore-end -->
