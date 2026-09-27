# F02 Ward Answer populated correction r19

Date: 2026-09-13  
Scope: `ward/ward-screen.tsx` and `ward/ward.module.css` only, plus this report.

## Evidence and reason

I inspected the original served pair:

- `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/ward-answer-populated-app-1440-light-r19.png`
- `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/ward-answer-populated-mock-1440-light-r19.png`

The populated app card reduced `WF-002` to one compact fact line, an eligibility warning, and two large actions. The drawing places the request's current facts and this ward's eligibility gates before those actions. The earlier empty RPH evidence could not reveal this structural gap.

Exact pre-edit copies are retained under `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-ward-answer-populated-r19/`.

| Source                                                | Before SHA-256                                                     | After SHA-256                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `src/components/ward-management/ward/ward-screen.tsx` | `4F5AFCD752FF501B11576741B6E7FED337C6789725BA269E8E52C35841759AE2` | `C46D3F9F65C118B47BAED20A357AB52A32C768D194BCBB2001D11D691E494821` |
| `src/components/ward-management/ward/ward.module.css` | `5AA831BAA30019C2921575714F236E2F9B4A653ADFCC208DAD5D73D2BFFD2359` | `06610798293E4628E39A0E1B109BD5A04AF041948B7588C07952716989FAEDAE` |

## Structural correction

Each visible Answer request now presents, in drawing order:

1. Movement id, current urgency tier or urgent flag, and current waiting duration.
2. The existing eligibility summary.
3. An explicit statement that the movement record holds no patient name or age and that this ward view does not invent them through another-record join.
4. A definition list of current movement facts: cohort, bed kind, sex, specialling request, high-acuity nursing request, legal status, origin department, and referral timing.
5. Every gate returned by the existing `eligibility(movement, unit, now)` result, in its existing order, with its actual pass state and existing detail text.
6. The pre-existing restriction and eligibility warnings, followed by the unchanged Accept in principle and Decline controls and forms.

The narrow layout stacks definition-list pairs and gate verdicts without hiding any fact. Existing print visibility remains governed by the screen's wildcard print reset and Answer print rule.

## Behavior and deviations

- No eligibility rule was added or copied. The screen calls the existing eligibility function and renders its returned gates.
- Eligibility remains informative. A failed gate does not disable or intercept Accept in principle or Decline; their prior `referralAnswerBlocked` logic, dispatches, rejection handling, and handlers are byte-unchanged.
- The movement record has no patient name or age, so neither appears. No referral, admission, or patient record is joined to manufacture an identity.
- Seeded `WF-002` has no `referredAt`. Its row says that no ward-referral time is recorded and separately reports the existing waiting duration since movement opening. It does not substitute `openedAt` under a Referred label.
- No other referral destinations, counts, names, or parallel-referral badge are exposed, preserving FD-22.
- Gate labels are presentation-only labels exhaustively typed against `EligibilityGate`; pass/fail and detail content come from the authoritative result.

## Verification

- `npx prettier --check src/components/ward-management/ward/ward-screen.tsx src/components/ward-management/ward/ward.module.css` — passed.
- `npx eslint src/components/ward-management/ward/ward-screen.tsx` — passed with no output.
- Snapshot diff inspection found only the additive Answer facts/gates presentation, the replacement of the compact duplicate fact line with the urgency badge, and required imports/labels. No action-handler or dispatch line changed.

Focused tests were not run because the U04 heavy-run owner holds admission. Browser/server verification was not run by this worker. Served visual closure and phone review remain pending with the controller.

## Correction after focused FD-23 execution

The original statement above that snapshot diff inspection found "only the additive Answer facts/gates presentation" was incorrect. The r19 markup was rendered unconditionally inside the shared incoming-referral card, so the normal Ward overview also received the new header, origin department, facts, and gates. A controller-run focused batch exposed this through the existing FD-23 guard: the normal ward card for co-addressed `WF-013` on `bty-older-adult` named St John of God Midland Emergency Department.

The current correction restores the exact pre-r19 compact header for `presentation !== "answer"` and renders the new summary, identity absence, facts, and gates only when `presentation === "answer"`. Answer's From value is now the neutral sentence "Emergency department. Origin department is not disclosed in this ward view." No emergency-department lookup is imported or rendered. Existing action callbacks and dispatches remain unchanged.

Current corrected hashes:

| Source                                                | Corrected SHA-256                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------ |
| `src/components/ward-management/ward/ward-screen.tsx` | `41A6D29BA79A47B6C40186E2649FF464C2389D42A817349A77C7D6641496F614` |
| `tests/ward-answer-current-facts.dom.test.tsx`        | `E00EB836402298F26282BC80740052B883C7EF41DA2D19610DF54B0BBD419016` |

The corrected source and added co-addressed Answer privacy case have not yet been test-run. Controller rerun is pending.
