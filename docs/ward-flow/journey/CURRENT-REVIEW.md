# Journey Explorer review — 27 September 2026

**Working-branch status:** The generated page and inventory were rebuilt successfully with all 96
actions represented. Refusal test coverage was not measured for this build, and the page says so.
The narrow ready check passed on the merged tree: Ward type checking found no errors and no unit
tests were related to these documentation files. The checked tree was merged into this branch,
which is READY-FAST in the shared fold queue. The branch has not been folded; the fold steward
owns the final gate and local ward-line fold.

The 96 action descriptions, 111 route nodes and action-to-screen claims were compared with the
current ward engine and UI dispatch sites on the local ward line. This is a source review; it does
not establish that all journeys work in a running app. The seven-tab Explorer remains a map of the
prototype, and no clinical or screen behaviour was changed by this review.

## Corrections incorporated in the map

- Handover can proceed after a recorded no-transport decision; withdrawing an acceptance while its
  bed is held is refused. The bed release now names the occupying admission. See
  `ward-flow-reducer.ts` cases `HANDOVER_READY`, `WITHDRAW_ACCEPTANCE`, `FLAG_BED_RELEASE`.
- Written and continued legal forms store typed times and clear the old clock. Country extension
  is always refused; use `RECORD_LEGAL_FORM_EXPIRY`. The receipt list contains nine forms. See the
  reducer's `RECORD_LEGAL_FORM_*` cases and `ward-flow-events.ts`.
- The map now describes the actual guards for examination, leaving, capacity, release and reopen,
  morning counts, discharge barriers and broadcast alerts. It also records arrival-lateness
  notices, the cleared pull timer, ED withdrawal and the `Different term` placement exception.
- Action locations now include the referral-intake add-person form, Person/Now transport booking,
  Ward and Community notice controls, and the Ward and coordinator diverted-bed controls.

## Source-confirmed product gaps

| Gap | Evidence and consequence |
| --- | --- |
| **Record leave bed cannot submit** | `ward-screen.tsx` `submitLeaveBed` assigns `chosenAdmissionId` to `undefined` and returns before `RECORD_LEAVE_BED` dispatch. The visible ward control cannot create a leave-bed record. |
| **Fabricated inbox ID can be completed** | `ward-flow-reducer.ts` `COMPLETE_INBOX_ITEM` checks the commitment prefix but does not verify that the ID names a real inbox row. Real fact rows remain uncompletable. |
| **Broadcast acknowledgement loses ward identity** | `layout.tsx` mounts `WardBroadcastBanner` without `currentUnitId`; the banner then acknowledges as the coordinator desk. Its global Acknowledge button does not record the viewing ward. |

The Explorer's **What's wrong** tab contains the other mapped route and record gaps. The **Every
action** tab marks actions with no screen; a source dispatch search found no direct UI dispatch for
those entries. This review did not select or implement product fixes.

## Evidence boundary and handoff

The generated event completeness checks establish that the 96 engine actions are represented.
They do not validate descriptive wording or rendered controls; those needed the source comparison
above. The refusal-coverage figure comes from an older full run. Do not describe its unreached
count as a current measurement without a new, matching full coverage report. The fold steward
owns the batch gate and any fold into the local ward line. Nothing here authorises a push or a
live service change.
