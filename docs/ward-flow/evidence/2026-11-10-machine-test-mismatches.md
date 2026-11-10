# Machine test mismatches for Josh (M26)

_Created 2026-11-10 - audit item M26, approved as a list by Josh (D-130); Documentation owns._

**Status:** open questions for Josh. **Nothing has changed.** The movement diagram
(`docs/ward-flow/journey/machines.json`) and the engine disagree on the moves below. The test
`tests/ward-audit-m26-other-machines.test.ts` names each one, so a new mismatch fails the build.

For each, either the diagram is wrong (a docs change) or the engine is (a clinical behaviour change
Josh rules on). The recommendation keeps the engine as it is and corrects the diagram, unless noted.

| #   | Machine      | What differs                                                                                                               | Recommendation                                    |
| --- | ------------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Z1  | Referral     | A reassessment can turn a decline into an acceptance. The engine allows it; the diagram draws no arrow out of Declined.    | Draw the arrow.                                   |
| Z2  | Transport    | The diagram has a Cancelled state; the engine deletes the job on cancel, so Cancelled is never reached.                    | Remove the Cancelled state from the diagram.      |
| Z3  | Bed release  | Recording the person leaving, or a transfer arriving, also marks the bed as being made ready. The diagram doesn't show it. | Show it on the Discharged arrows.                 |
| Z4  | Bed release  | The engine accepts the Stuck flag on a confirmed release; the diagram only draws it from Expected.                         | Draw it from Confirmed too.                       |
| Z5  | Bed release  | The engine sets Being made ready on a confirmed or already discharged release; the diagram draws it from Expected only.    | Draw it from both.                                |
| Z6  | Expected     | The engine records medical clearance while the patient is still only expected; the diagram only allows it once arrived.    | Draw it from Expected (clearance can come first). |
| Z7  | Legal status | Any value can be recorded as any other. The note says so and the engine agrees; the diagram draws four example arrows.     | Keep the note as the statement; draw no more.     |
| Z9  | Daily check  | The engine completes a commitment straight from Showing and never acknowledges one. The diagram goes via Acknowledged.     | Draw Showing to Ticked for commitments.           |
| Z10 | Daily check  | The diagram draws Acknowledged to Ticked, but only fact rows can be acknowledged and they can't be completed.              | Remove that arrow.                                |
| Z11 | Daily check  | On reopen the diagram goes back to Acknowledged; the engine goes back to Showing.                                          | Draw reopen to Showing.                           |
| Z12 | Legal form   | Expiry can be recorded before a receipt. The note and engine agree; the diagram only draws it from Recorded as received.   | Draw it from Not recorded too.                    |

## Related finding (M35)

The Map report counted a ward transfer out as a discharge, and referral declines and arrivals wrote
no audit row. Both are fixed in the held clinical PR (D-130).

## After Josh rules

If Josh agrees with every recommendation, the change is to `machines.json` only, and each pair
leaves the test's named list.
