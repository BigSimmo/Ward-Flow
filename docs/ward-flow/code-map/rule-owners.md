# Rule owners

_Started 2026-11-10 for audit item M93. Engine owns. Checked by `tests/ward-audit-m93-rule-owners.test.ts`._

Each workflow rule in [`machines.json`](../journey/machines.json) (the M26 catalogue) is decided in one place. This page names that file for every move. Paths are under `src/components/ward-management/`. `ward-flow-reducer.ts` only routes an event to its slice; `ward-flow-subject-id.ts`, `ward-audit.ts`, `governance-event-facts.tsx` and `ed/ed-screen-model.ts` name or describe an event and decide nothing.

Eligibility (the "Can this ward take this patient?" gates) is decided in `ward-eligibility.ts`. Who may see a record is decided in `ward-access-scope.ts`.

| Machine     | Move                                        | Decided in                                                       |
| ----------- | ------------------------------------------- | ---------------------------------------------------------------- |
| referral    | `RECEIVE_REFERRAL`                          | `ward-flow-referral-answer-events.ts`                            |
| referral    | `ACCEPT_REFERRAL`                           | `ward-flow-referral-answer-events.ts`                            |
| referral    | `DECLINE_REFERRAL`                          | `ward-flow-referral-answer-events.ts`                            |
| referral    | `RECORD_REFERRER_WITHDRAWAL`                | `ward-flow-record-events.ts`                                     |
| movement    | `RAISE_REFERRAL`                            | `ward-flow-referral-send-events.ts`                              |
| movement    | `REFER_TO_UNITS`                            | `ward-flow-referral-send-events.ts`                              |
| movement    | `DECLINE`                                   | `ward-flow-referral-answer-events.ts`                            |
| movement    | `WITHDRAW_WARD_REQUEST`                     | `ward-flow-referral-send-events.ts`                              |
| movement    | `ACCEPT_IN_PRINCIPLE`                       | `ward-flow-referral-answer-events.ts`                            |
| movement    | `WITHDRAW_ACCEPTANCE`                       | `ward-flow-referral-answer-events.ts`                            |
| movement    | `PULL_PATIENT`                              | `ward-flow-placement-events.ts`                                  |
| movement    | `RELEASE_PULL`                              | `ward-flow-placement-events.ts`                                  |
| movement    | `HANDOVER_READY`                            | `ward-flow-transport-events.ts`                                  |
| movement    | `PATIENT_COLLECTED`                         | `ward-flow-transport-events.ts`                                  |
| movement    | `PATIENT_ARRIVED`                           | `ward-flow-transport-events.ts`                                  |
| movement    | `WITHDRAW_REFERRAL`                         | `ward-flow-referral-send-events.ts`                              |
| movement    | `RECORD_ED_OUTCOME`                         | `ward-flow-record-events.ts`                                     |
| movement    | `REFER_TO_COMMUNITY_TEAM`                   | `ward-flow-referral-send-events.ts`                              |
| movement    | `RECORD_EXAMINATION`                        | `ward-flow-record-events.ts`                                     |
| movement    | `STOP_TRANSPORT`                            | `ward-flow-transport-events.ts`                                  |
| movement    | `RECORD_ADMISSION_CARE`                     | `ward-flow-protected-record-events.ts`                           |
| movement    | `STEP_BACK_STAGE`                           | `ward-flow-placement-events.ts`                                  |
| admission   | `PULL_PATIENT`                              | `ward-flow-placement-events.ts`                                  |
| admission   | `PATIENT_ARRIVED`                           | `ward-flow-transport-events.ts`                                  |
| admission   | `RECORD_LEAVING`                            | `ward-flow-record-stay-events.ts`, `ward-flow-record-events.ts`  |
| admission   | `RECORD_ADMISSION_CARE`                     | `ward-flow-protected-record-events.ts`                           |
| admission   | `RECORD_AWAY_AT_EMERGENCY_DEPARTMENT`       | `ward-flow-record-stay-events.ts`, `ward-flow-record-events.ts`  |
| admission   | `RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT` | `ward-flow-record-stay-events.ts`, `ward-flow-record-events.ts`  |
| admission   | `RELEASE_PULL`                              | `ward-flow-placement-events.ts`                                  |
| admission   | `RELEASE_HELD_BED`                          | `ward-flow-placement-events.ts`                                  |
| admission   | `WITHDRAW_REFERRAL`                         | `ward-flow-referral-send-events.ts`                              |
| admission   | `RECORD_ED_OUTCOME`                         | `ward-flow-record-events.ts`                                     |
| admission   | `REFER_TO_COMMUNITY_TEAM`                   | `ward-flow-referral-send-events.ts`                              |
| admission   | `RECORD_EXAMINATION`                        | `ward-flow-record-events.ts`                                     |
| transport   | `BOOK_TRANSPORT`                            | `ward-flow-transport-events.ts`                                  |
| transport   | `TRANSPORT_ACCEPTED`                        | `ward-flow-transport-events.ts`                                  |
| transport   | `TRANSPORT_EN_ROUTE`                        | `ward-flow-transport-events.ts`                                  |
| transport   | `PATIENT_COLLECTED`                         | `ward-flow-transport-events.ts`                                  |
| transport   | `PATIENT_ARRIVED`                           | `ward-flow-transport-events.ts`                                  |
| transport   | `CANCEL_TRANSPORT`                          | `ward-flow-transport-events.ts`                                  |
| transport   | `STOP_TRANSPORT`                            | `ward-flow-transport-events.ts`                                  |
| bedrelease  | `FLAG_BED_RELEASE`                          | `ward-flow-bed-events.ts`                                        |
| bedrelease  | `CONFIRM_BED_RELEASE`                       | `ward-flow-bed-events.ts`                                        |
| bedrelease  | `REVERT_BED_RELEASE`                        | `ward-flow-bed-events.ts`                                        |
| bedrelease  | `RECORD_LEAVING`                            | `ward-flow-record-stay-events.ts`, `ward-flow-record-events.ts`  |
| bedrelease  | `RECORD_ADMISSION_CARE`                     | `ward-flow-protected-record-events.ts`                           |
| bedrelease  | `BLOCK_BED_RELEASE`                         | `ward-flow-bed-events.ts`                                        |
| bedrelease  | `CLEAR_BED_RELEASE_BLOCK`                   | `ward-flow-bed-events.ts`                                        |
| bedrelease  | `SET_BED_PREPARATION`                       | `ward-flow-bed-events.ts`                                        |
| expects     | `RECEIVE_REFERRAL`                          | `ward-flow-referral-answer-events.ts`                            |
| expects     | `RECORD_ARRIVED_IN_DEPARTMENT`              | `ward-flow-record-events.ts`                                     |
| expects     | `RECORD_MEDICAL_CLEARANCE`                  | `ward-flow-record-events.ts`                                     |
| legalstatus | `CHANGE_LEGAL_STATUS`                       | `ward-flow-referral-send-events.ts`                              |
| examination | `RECORD_EXAMINATION`                        | `ward-flow-record-events.ts`                                     |
| notice      | `ACCEPT_REFERRAL`                           | `ward-flow-referral-answer-events.ts`                            |
| notice      | `MARK_NOTICE_READ`                          | `ward-inbox-reducer.ts`                                          |
| inbox       | `ACKNOWLEDGE_INBOX_ITEM`                    | `ward-inbox-reducer.ts`                                          |
| inbox       | `COMPLETE_INBOX_ITEM`                       | `ward-inbox-reducer.ts`                                          |
| inbox       | `REOPEN_INBOX_ITEM`                         | `ward-inbox-reducer.ts`                                          |
| legalform   | `RECORD_LEGAL_FORM_RECEIVED`                | `ward-flow-record-events.ts`                                     |
| legalform   | `CORRECT_LEGAL_FORM_RECEIPT`                | `ward-flow-referral-send-events.ts`                              |
| legalform   | `RECORD_LEGAL_FORM_EXPIRY`                  | `ward-flow-record-legal-events.ts`, `ward-flow-record-events.ts` |

## Screens that still decide a rule themselves

Known on 10 Nov 2026: these screen files compare a legal status with `"Voluntary"` directly instead of calling `requiresAuthorisedDestination` or `involuntaryBedNeededForLegalStatus` in `ward-eligibility.ts`. Most choose words; `movements/movement-workflow-actions.tsx` decides whether a move needs an authorised ward. The guard lets this list shrink but not grow.

- `coordinator/shortlist-panel.tsx`
- `delays/delays-board-rows.tsx`
- `ed/ed-preview.tsx`
- `ed/ed-screen-desktop.tsx`
- `ed/ed-screen-person-sheet.tsx`
- `movements/movement-workflow-actions.tsx`
- `movements/movements-stage-row.tsx`
- `patients/patient-documents-tab.tsx`
- `patients/patient-now-cards.tsx`
- `referrals/ward-referral-drawer-referral-step.tsx`
- `search/patient-search.tsx`
- `../ward-redesign/ed-board/ed-screen-desktop.tsx` and `../ward-redesign/legal-copies/ed-screen-person-sheet.tsx`
