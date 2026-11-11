// Every lazily loaded reducer slice, registered on import. See `ward-flow-reducer-slice-registry.ts`.
// Keep this file out of any static import from page code: a static import puts every slice back into
// a phone's first load. Only `backend/ward-flow/engine.ts` and the test setup import it directly.
import { reduceBroadcastAlertEvent } from "./alerts/ward-broadcast-reducer";
import { reduceDischargeDependencyEvent } from "./discharges/discharge-dependency-events";
import { type DischargeCheckEvent, reduceDischargeCheckEvent } from "./discharges/discharge-check-events";
import { reduceBedClosureEvent } from "./ward-flow-bed-closure-events";
import { reduceBedEvent } from "./ward-flow-bed-events";
import { reduceBedMeetingEvent } from "./ward-flow-bed-meeting-events";
import { reduceWardDiagnosis } from "./ward-flow-diagnosis-events";
import { reduceLoopCheckEvent } from "./ward-flow-loop-check-events";
import { reducePilotControlEvent } from "./ward-flow-pilot-control-events";
import { reducePlacementEvent } from "./ward-flow-placement-events";
import { reduceProtectedRecordEvent } from "./ward-flow-protected-record-events";
import { reduceRecordedFactEvent } from "./ward-flow-record-events";
import { registerReducerSlices } from "./ward-flow-reducer-slice-registry";
import { reduceReferralAnswerEvent } from "./ward-flow-referral-answer-events";
import { reduceReferralAskEvent } from "./ward-flow-referral-ask-events";
import { reduceReferralCommitmentEvent } from "./ward-flow-referral-commitment-events";
import { reduceReferralFollowUpEvent } from "./ward-flow-referral-followup-events";
import { reduceReferralOwnerEvent } from "./ward-flow-referral-owner-events";
import { reduceReferralSendEvent } from "./ward-flow-referral-send-events";
import { reduceArrivalCheckEvent, reduceReleaseNoticeEvent } from "./ward-flow-release-notice-events";
import { reduceRestrictivePracticeEvent } from "./ward-flow-restrictive-practice-events";
import { reduceTransportEvent } from "./ward-flow-transport-events";
import { reduceUndoEvent } from "./ward-flow-undo-events";
import {
  type MarkWeekendDischargeReviewedEvent,
  reduceWeekendDischargeReview,
} from "./ward-flow-weekend-review-events";
import { reduceWardClosureEvent } from "./ward-flow-ward-closure-events";
import { type ChiefPsychiatristNotifiedEvent, reduceChiefPsychiatristNotified } from "./ward-flow-under-18-events";
import { reducePatientArchive } from "./ward-patient-archive-reducer";
import { reducePatientCarePlanEvent } from "./ward-patient-care-plan-reducer";
import { reducePatientRegistration } from "./ward-patient-registration-reducer";
import { reduceSiteHandoverSignOff } from "./site-sign-off/site-handover-sign-off-reducer";
import { reduceTriageSigned } from "./triage/triage-signed-reducer";
import { reduceHandoverWork } from "@/components/ward-management/handover-work-reducer";
// A local command can seed a demonstration scenario, so its networks load with the slices.
import "./ward-scenario-networks";

/** Features 14, 37 and 13 (9 Nov 2026): the weekend discharge review, discharge checklist and follow-up reply.
 *  Item 4 (11 Nov 2026): the Chief Psychiatrist notified time for a person under 18 on an adult ward. */
// Types come from the slice itself: this file may import only slices (ward-reducer-lazy-slices test).
type CheckSliceArgs = Parameters<typeof reduceDischargeCheckEvent>;

function reduceDischargeFollowThroughEvent(
  state: CheckSliceArgs[0],
  event: DischargeCheckEvent | MarkWeekendDischargeReviewedEvent | ChiefPsychiatristNotifiedEvent,
  reject: CheckSliceArgs[2],
): ReturnType<typeof reduceDischargeCheckEvent> {
  if (event.type === "RECORD_CHIEF_PSYCHIATRIST_NOTIFIED") return reduceChiefPsychiatristNotified(state, event, reject);
  return event.type === "MARK_WEEKEND_DISCHARGE_REVIEWED"
    ? reduceWeekendDischargeReview(state, event, reject)
    : reduceDischargeCheckEvent(state, event, reject);
}

const slices = {
  reduceArrivalCheckEvent,
  reduceBedClosureEvent,
  reduceBedEvent,
  reduceBedMeetingEvent,
  reduceBroadcastAlertEvent,
  reduceDischargeDependencyEvent,
  reduceDischargeFollowThroughEvent,
  reduceHandoverWork,
  reduceLoopCheckEvent,
  reducePatientArchive,
  reducePatientCarePlanEvent,
  reducePatientRegistration,
  reducePilotControlEvent,
  reducePlacementEvent,
  reduceProtectedRecordEvent,
  reduceRecordedFactEvent,
  reduceReferralAnswerEvent,
  reduceReferralAskEvent,
  reduceReferralCommitmentEvent,
  reduceReferralFollowUpEvent,
  reduceReferralOwnerEvent,
  reduceReferralSendEvent,
  reduceReleaseNoticeEvent,
  reduceRestrictivePracticeEvent,
  reduceSiteHandoverSignOff,
  reduceTransportEvent,
  reduceTriageSigned,
  reduceUndoEvent,
  reduceWardClosureEvent,
  reduceWardDiagnosis,
};

export type WardFlowReducerSlices = typeof slices;

registerReducerSlices(slices);
