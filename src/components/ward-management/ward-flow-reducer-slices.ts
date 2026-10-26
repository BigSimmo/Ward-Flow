// Every lazily loaded reducer slice, registered on import. See `ward-flow-reducer-slice-registry.ts`.
// Keep this file out of any static import from page code: a static import puts every slice back into
// a phone's first load. Only `backend/ward-flow/engine.ts` and the test setup import it directly.
import { reduceBroadcastAlertEvent } from "./alerts/ward-broadcast-reducer";
import { reduceDischargeDependencyEvent } from "./discharges/discharge-dependency-events";
import { reduceBedEvent } from "./ward-flow-bed-events";
import { reduceBedMeetingEvent } from "./ward-flow-bed-meeting-events";
import { reduceWardDiagnosis } from "./ward-flow-diagnosis-events";
import { reduceLoopCheckEvent } from "./ward-flow-loop-check-events";
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
import { reduceWardClosureEvent } from "./ward-flow-ward-closure-events";
import { reducePatientRegistration } from "./ward-patient-registration-reducer";

const slices = {
  reduceArrivalCheckEvent,
  reduceBedEvent,
  reduceBedMeetingEvent,
  reduceBroadcastAlertEvent,
  reduceDischargeDependencyEvent,
  reduceLoopCheckEvent,
  reducePatientRegistration,
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
  reduceTransportEvent,
  reduceUndoEvent,
  reduceWardClosureEvent,
  reduceWardDiagnosis,
};

export type WardFlowReducerSlices = typeof slices;

registerReducerSlices(slices);
