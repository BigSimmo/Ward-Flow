# F14 batch adversarial source review r34

## Scope and method

Read-only differential review of the current changes in:

- `coordinator/coordinator-screen.tsx`
- `search/record-preview.tsx`
- `governance-registers.tsx`
- `ward-management-modes.tsx`
- `alerts/alerts-screen.tsx`
- the focused Command, Search preview, Governance, and Alerts DOM contracts

The review traced the changed render paths to `ShortlistPanel`, `FlowDiagram`, `referralState`, `allOverrides`, `OverrideRegister`, and the `REFER_TO_UNITS` reducer case. It looked specifically for lost state transitions, changed action authority, misleading derived state, privacy expansion, and assertions weakened around those risks. It did not re-review layout/CSS, run tests, use a browser, or inspect unrelated estate screens.

## Result

No actionable P1 or P2 logical, state, or privacy regression was found in the bounded diff.

- **Command selection remains internally consistent.** Passing `setSelectedUnitId` directly makes a chosen unit remain the unit whose gates are explained while the shortlist button independently toggles membership in `referTargets`. The candidate's `aria-pressed` continues to represent the real multi-select referral target, while `data-showing` represents the single gate-detail subject. The new focused test exercises diagram selection, target selection, eligibility heading, and the unit-specific override label against one real candidate. No dispatch or gate authority changed.
- **Referral summaries now follow the canonical derived state.** `buildReferralSummary` uses `referralState`: any accepted destination takes precedence, all destinations must have declined for the declined state, and partial/no decisions remain queued. The new wording removes the previous contradiction where a person-linked accepted referral could still say it was waiting and that no bed had accepted. It does not add a patient join or expose any field beyond the referral facts already rendered by this preview.
- **Governance detail is a read of the existing accountability record.** The detail uses the same unrestricted `allOverrides(movements)` population as the register and the same descending timestamp order, so its default item is the first visible register entry. It renders the recorded movement id, unit destinations, fixed reason, role, and time. It explicitly withholds review status, reviewer identity, review outcome, and a historical gate verdict because those fields do not exist. Unit names are resolved from the already supplied network-wide unit list; the existing id fallback prevents a recorded destination from silently disappearing.
- **Governance deadline copy now matches the live derivation.** The source model retains legal deadlines and Alerts evaluates them through the existing action-inbox derivation. The updated text says the proposed effectiveness measure is unpublished rather than falsely saying deadlines were removed. No effectiveness formula or alert derivation changed.
- **Alerts' override copy is neutral to gate outcome.** `REFER_TO_UNITS` can record an override reason without retaining the historical verdict, including where a reason accompanies an otherwise eligible destination. The current text therefore says only that a referral was made by override and names the retained fields. It no longer asserts that a failing check necessarily existed. The focused assertion pins both the prior-verdict absence and the retained record facts.

## Test-evidence boundary

The controller supplied evidence that the earlier focused batch passed 41 tests, and that the later three-file batch passed 25 of 26 cases before its stale Alerts wording assertion was updated. I did not run the updated assertion, so its post-edit result remains pending the controller's next admitted lease.

The tests are proportionate for the changed risks: they cover Command's two distinct selection meanings, accepted-referral wording, a real reducer-recorded override, absence of invented historical gate detail, retained legal deadlines, and Alerts' neutral record description. The Governance register test's introductory comment still describes the workbench as “not yet wired” even though `GovernanceView` now mounts it; that is stale commentary only and does not weaken a behavior assertion or create a P1/P2 product risk.

## Reviewed source hashes

- `coordinator-screen.tsx` — `A3B77F96C736DB926152B307878ED87A682EE461962B08228E3E2F23E413B692`
- `record-preview.tsx` — `FFAF9681800E9D51A28BE8BAC8ACDCD0DA1CA4A555AF5A9B38BC87C25CA5B597`
- `governance-registers.tsx` — `C5045480479ED1B8489203E7290A8C9D64AFFF74591616AA0E79D7D9DEBCCB3D`
- `ward-management-modes.tsx` — `466EC610B2E6776C0BE64F66A269555CDCF5BC67E621208C42538FF8080BEE5A`
- `alerts-screen.tsx` — `9FF5DE5AEF000CFAAF6DF4A7353C06F90E642646F3276342E1DF73389A5B36A4`

## Limits

This is source-only evidence over the named diff and focused contracts. It does not establish rendered layout, browser interaction, print behavior, full-suite status, or complete estate acceptance.
