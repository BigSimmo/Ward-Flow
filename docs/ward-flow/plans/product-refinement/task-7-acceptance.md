# Task 7 independent review

2026-09-13. **Scoped Task 7 visual review accepted for the referral register and raise-referral flow.** Autofill corrections, the sending-team control and focused behavior checks are also verified. The limits below still apply to broader journey and device claims.

## Source and authored tests

Reviewed intake and board changes against `task-7-before`, then re-read the corrected intake source and `tests/ward-referral-query-prefill.dom.test.tsx`.

- **Resolved:** `initialDraft` now applies supported stored sex and suburb instead of discarding them. Unsupported values remain unanswered; gender is not substituted for sex.
- **Resolved:** the newly invented DOB-to-cohort thresholds were removed. Age band remains unanswered; other clinical needs, home region, urgency and destinations receive no new defaults. Existing explicit source/origin query prefills remain.
- Same-person rerenders/query changes preserve edits; changing the linked subject starts a fresh draft. Submission/eligibility/identity guards remain unchanged. No additional authority bypass was found in this scoped review.
- Authored tests cover stored-value prefill, unsupported sex, same-person edit preservation and changed-subject reset.

## Actual visual evidence

All images below were inspected directly from `.superpowers/sdd/2026-09-13-product-refinement/screens/`.

| Screen/state                                  | Live captures                                                                                         | Served reference                                   |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Register, no selection                        | `q004-review-referrals-light-1440.png`, `q004-review-referrals-dark-1440.png`                         | `referrals-task7-reference-light-1440.png`         |
| Register, RF-001 selected                     | `q004-review-referrals-selected-dark-820.png`, `q004-review-referrals-selected-detail-dark-820.png`   | Same served register reference, for structure only |
| Linked intake, supported prefill              | `q004-review-intake-prefill-light-1440.png`, `q004-review-intake-prefill-dark-1440.png`               | `referral-intake-task7-reference-light-1440.png`   |
| Linked intake, responsive                     | `q004-review-intake-prefill-dark-820.png`, `q004-review-intake-prefill-dark-390.png`                  | Same served intake reference, for structure only   |
| Linked intake, sending-team control corrected | `q004-review-intake-sending-field-fixed-dark-1440.png`                                                | Same served intake reference, for structure only   |
| Linked intake, history and destinations       | `q004-review-referral-intake-history-dark-1440.png`, `q004-review-referral-intake-send-dark-1440.png` | Same served intake reference, for structure only   |

The register's captured empty-selection state is readable in both themes; the light capture is scrolled past its top toolbar. Intake shows the linked-record identity context, duplicate-open notice, Female/Ashfield prefill and editable provenance. Age band and home region visibly remain unanswered. Desktop summary agrees with the form; responsive first-step controls stack without material clipping or overlap in the shown regions. The controller separately confirmed unanswered source/urgency and the field values through the live DOM.

The dark 820 register captures show the six-item queue with RF-001 visibly selected, followed by the corresponding decision detail. The detail preserves the referral identity, urgency, cohort, source, wait and 0-of-23 availability result. Candidate units, exclusion reasons and the disabled `Accept anyway` actions remain readable; no acceptance is implied before a reason is recorded.

The corrected 1440 dark capture closes the sending-team P2. The optional field now has the same clear full-width control boundary, surface and minimum height as the surrounding inputs, with its focus outline contained inside the Step 2 column. Its label, hint and blank optional value remain distinct, and the following Urgency control is neither displaced nor clipped.

The two lower-flow captures show the optional written-history field, all three destination choices, the live unanswered summary and the disabled `Send referral` action with the missing answers stated. The history caution is close to its bordered edge but remains legible without overlap or clipping. No material defect was found in these inspected states.

## Focused verification

The retained runner report at `C:/Users/joshs/AppData/Local/Temp/ward-tests-A7lBi8/report-0.json` records 61 of 61 tests passed across exactly these three files, with zero failures:

- `tests/ward-referral-suburb-pin.test.ts`
- `tests/ward-referral-query-prefill.dom.test.tsx`
- `tests/ward-shell-third-edition.dom.test.tsx`

This verdict is taken from the report's recorded file and test results; no missing console summary has been reconstructed.

## Reuse and remaining limits

These screenshots do not establish a successful or refused submission, expanded disclosures, every responsive/theme combination, print or physical-device behavior. No dark served-reference pairing is claimed from the light references. The focused tests provide DOM behavior evidence for the named prefill, edit-preservation, reset, suburb and shell contracts; they do not expand the visual evidence beyond the captures listed above. The two screens are recorded as scoped acceptances in the canonical verification index; no source, tests, browser setup or server state was changed by this review consolidation.
