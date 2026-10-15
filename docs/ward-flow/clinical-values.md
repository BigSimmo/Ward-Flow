# Clinical values

Every threshold and timing that flags, colours or escalates a patient, referral or bed in Ward Flow,
with whether it is synthetic or clinically signed. Synthetic data only: no value here is a clinical,
legal or service standard until a named clinician signs it.

- **Source of truth:** `src/components/ward-management/ward-clinical-values.ts`. The screens, the
  engine and this page all read from it. Settings shows the same list under Data and about,
  Reference, Clinical values.
- **Synthetic** means a prototype default nobody has clinically signed. It may be Josh's product
  default (the source names the decision) or a figure an earlier build typed in ("No decision
  recorded").
- **Signed** means a named clinician signed it on a date. To sign a value, change its status in the
  source file to `signed` with `signedBy` and `signedOn`. The type will not accept one without the
  other.
- **Other figures seen** lists a different figure another screen or document used for the same rule.
  Where screens disagreed, the figure the main app runs on was kept.
- Mental Health Act periods are not here. They live only in
  `src/components/ward-management/legal-forms/act-periods-demo.ts` (D-29). Legal form titles come
  from the Chief Psychiatrist register, not from this list.
- `tests/ward-clinical-values.test.ts` fails if a threshold is typed as a number elsewhere in the ward
  code, or if the table below drifts from the source file. Do not edit the table by hand. Run
  `UPDATE_CLINICAL_VALUES_DOC=1 npx vitest run tests/ward-clinical-values.test.ts` to rewrite it.

<!-- prettier-ignore-start -->
<!-- clinical-values:start -->

| Group | Rule | Value | Status | Source | Other figures seen | Id |
| --- | --- | --- | --- | --- | --- | --- |
| Referral tiers | Tier 1 referral shown as overdue after | 1 hour | Synthetic value | D-54 (10 Oct 2026); one rule since the L4 site review, 12 Oct 2026 | 8 hours (Home queue before 12 Oct 2026) | `tierOneOverdue` |
| Referral tiers | Tier 2 referral shown as overdue after | 4 hours | Synthetic value | D-54 (10 Oct 2026); one rule since the L4 site review, 12 Oct 2026 | 24 hours (Home queue before 12 Oct 2026) | `tierTwoOverdue` |
| Referral tiers | Tier 3 referral shown as overdue after | 24 hours | Synthetic value | D-54 (10 Oct 2026); one rule since the L4 site review, 12 Oct 2026 | 72 hours (Home queue before 12 Oct 2026) | `tierThreeOverdue` |
| Referral tiers | Any referral shown as overdue after | 72 hours | Synthetic value | D-54 (10 Oct 2026) | None recorded | `anyTierOverdue` |
| Emergency department waits | ED pressure shown as elevated from a wait of | 3 hours | Synthetic value | D-22 (26 Sep 2026), labelled default | None recorded | `edElevatedPressure` |
| Emergency department waits | ED pressure shown as severe, and first escalation step, from a wait of | 8 hours | Synthetic value | D-22 (26 Sep 2026), labelled default; the ACEM eight hour line came off screens under D-24 | None recorded | `edSeverePressure` |
| Emergency department waits | ED wait escalated to a state coordinator broadcast from | 12 hours | Synthetic value | No decision recorded (Top 25 escalation ladder, 15 Oct 2026) | None recorded | `edSecondEscalation` |
| Emergency department waits | ED wait shown with the act now edge from | 22 hours | Synthetic value | No decision recorded (Top 25 escalation ladder, 15 Oct 2026) | None recorded | `edLadderActNowEdge` |
| Emergency department waits | Wait in hospital shown as long, and top escalation step, from | 24 hours | Synthetic value | D-24 (26 Sep 2026), Josh's default, shown neutral | None recorded | `longWait` |
| Emergency department waits | ED access target, counted from arrival | 24 hours, default, changeable in Settings | Synthetic value | Owner ruling 22 Aug 2026 (ward-model.ts provenance) | 4 hours (the original spec, superseded 22 Aug 2026) | `edAccessTarget` |
| Emergency department waits | Psychiatric bed released after a medical trip expected to last | 24 hours | Synthetic value | FD-19 (30 Aug 2026) (ward-model.ts provenance) | None recorded | `edMedicalBedRelease` |
| Bed occupancy | Bed alert line on the rail, statistics and meters | 85% | Synthetic value | Josh, v6 shell boards 02 and 03b, 7 Oct 2026; D-24 had taken the eighty five line off until sourced | 90% (the occupancy colour band, and All wards before 11 Oct 2026); 90% (the WEAT target line removed under D-24) | `bedAlertLine` |
| Bed occupancy | Service occupancy colour band, amber from | 90% | Synthetic value | D-22 (26 Sep 2026), labelled default | 85% (the bed alert line) | `occupancyAmber` |
| Bed occupancy | Service occupancy colour band, surge from | 95% | Synthetic value | D-22 (26 Sep 2026), labelled default | None recorded | `occupancySurge` |
| Bed occupancy | Service occupancy colour band, red from | 98% | Synthetic value | D-22 (26 Sep 2026), labelled default | None recorded | `occupancyCritical` |
| Legal form warnings | Typed legal due time, urgent warning before it | 1 hour, default, changeable in Settings | Synthetic value | D-24 (26 Sep 2026), Josh's default | None recorded | `dueSoonUrgent` |
| Legal form warnings | Typed legal due time, first warning before it | 3 hours, default, changeable in Settings | Synthetic value | D-24 (26 Sep 2026), Josh's default | 4 hours (Top 25 paper form radar amber) | `dueSoon` |
| Legal form warnings | Paper form radar turns amber within (or the first warning, if Settings sets it longer) | 4 hours | Synthetic value | No decision recorded (Top 25 paper form radar, 15 Oct 2026) | 3 hours (Settings first warning default (D-24)) | `paperFormRadarAmber` |
| Legal form warnings | Paper form radar shows the act now edge within | 6 hours | Synthetic value | No decision recorded (Top 25 paper form radar, 15 Oct 2026) | None recorded | `paperFormRadarEdge` |
| Alerts and holds | Unanswered Pull now returns to the coordinator after | 15 minutes | Synthetic value | Josh accepted, global alerts option A, 10 Oct 2026 | None recorded | `pullNowAnswer` |
| Alerts and holds | Pull now stays live, if nobody pulls or stands it down, for | 4 hours | Synthetic value | Global alerts option A, 10 Oct 2026 | None recorded | `pullNowLive` |
| Alerts and holds | Pull hold on an accepting bed lasts | 4 hours, default, changeable in Settings | Synthetic value | Owner answer 35, 17 Sep 2026 (ward-model.ts provenance) | None recorded | `pullHold` |
| Alerts and holds | Bed hold without a confirmed dispatch flagged for review after | 2 hours | Synthetic value | Josh, 26 Sep 2026, his default | None recorded | `bedHoldReview` |
| Alerts and holds | Ward bed count named as not checked after | 1 hour | Synthetic value | No decision recorded (v10 Home, 10 Oct 2026) | None recorded | `bedCountFresh` |
| Alerts and holds | Downtime pack shown as stale after | 1 hour | Synthetic value | No decision recorded (v10 Downtime pack, 10 Oct 2026) | None recorded | `downtimePackStale` |
| Alerts and holds | Bed left as preparing or cleaning flagged after | 61 minutes | Synthetic value | No decision recorded (Top 25 ghost bed clear, 15 Oct 2026) | None recorded | `preparingBedStale` |
| Arrivals and answers | Arrival counted as late, past the estimate, after | 1 hour | Synthetic value | D-22 (26 Sep 2026), labelled default | None recorded | `lateArrivalGrace` |
| Arrivals and answers | Ward that has not answered a referral, first reminder after | 2 hours | Synthetic value | D-22 (26 Sep 2026), labelled default | None recorded | `silentWardFirstReminder` |
| Arrivals and answers | Ward that has not answered a referral, second reminder after | 4 hours | Synthetic value | D-22 (26 Sep 2026), labelled default | None recorded | `silentWardSecondReminder` |
| Arrivals and answers | Decision target, ward answers a referral within | 2 hours, default, changeable in Settings | Synthetic value | Stream A, 9 Oct 2026, labelled default | None recorded | `wardAnswerTarget` |
| Arrivals and answers | Decision target, transfer accepted within | 4 hours, default, changeable in Settings | Synthetic value | Stream A, 9 Oct 2026, labelled default | None recorded | `transferAcceptanceTarget` |
| Arrivals and answers | Decision target, transport booked within | 1 hour, default, changeable in Settings | Synthetic value | Stream A, 9 Oct 2026, labelled default | None recorded | `transportBookedTarget` |
| Arrivals and answers | Accepted patient not yet moving flagged as a stuck handover after | 1 hour | Synthetic value | No decision recorded (Top 25 stuck handover timer, 15 Oct 2026) | None recorded | `handoverStuck` |
| Arrivals and answers | Expected arrival flagged after waiting, voluntary | 48 hours | Synthetic value | Josh, 7 Sep 2026 | None recorded | `expectFlagVoluntary` |
| Arrivals and answers | Expected arrival flagged after waiting, involuntary | 7 days | Synthetic value | Josh, 7 Sep 2026 | None recorded | `expectFlagInvoluntary` |
| Arrivals and answers | Expected referral flagged to reconsider after | 72 hours | Synthetic value | Josh, 7 Sep 2026 | None recorded | `expectReconsider` |
| Discharge, leave and absence | Discharge prep prompt opens before the expected discharge | 24 hours | Synthetic value | No decision recorded (Top 25 discharge prep, 15 Oct 2026) | None recorded | `dischargePrepWindow` |
| Discharge, leave and absence | Leave bed flagged to consider opening, or converting to discharge, after | 24 hours | Synthetic value | D-23 (26 Sep 2026), Josh's default | None recorded | `leaveOpenWarning` |
| Discharge, leave and absence | Bed held for a person absent without leave flagged for review after | 4 hours | Synthetic value | No decision recorded (Top 25 absence tracker, 15 Oct 2026) | None recorded | `awolBedHoldWarning` |
| Discharge, leave and absence | Community treatment order follow up booked within, after departure | 7 days | Synthetic value | No decision recorded (Top 25 CTO handshake, 15 Oct 2026); flagged in the 15 Oct repo review | None recorded | `ctoFollowUpWindow` |
| Discharge, leave and absence | Stay long enough to prompt a discharge plan, and escalation dossier, from | 7 days | Synthetic value | Ward board long stay line; no decision recorded for the Top 25 dossier | None recorded | `longStayPrompt` |
| Discharge, leave and absence | Delayed discharge escalated, by recorded hours, after more than | 72 hours | Synthetic value | No decision recorded (Top 25 long stay dossier, 15 Oct 2026) | None recorded | `delayedDischargeEscalation` |
| Discharge, leave and absence | Readmission flag, discharged from a ward within | 28 days | Synthetic value | No decision recorded; a prompt to look, not a reporting standard | None recorded | `readmissionWindow` |

<!-- clinical-values:end -->
<!-- prettier-ignore-end -->
