// tests/ward-ed-blocked-reasons.test.ts
//
// Fix list 1.3 (15 Oct 2026): the blocked-reason rules moved out of `ed-screen.tsx` and
// `community-screen.tsx` into pure modules. Each rule here: one blocked case, one allowed case, and
// the exact reason text the screen renders.
import { describe, expect, it } from "vitest";

import {
  bookTransportBlockedReason,
  communityReferralBlockedReason,
  declineReasonBlockedReason,
  dischargeChoiceBlockedReason,
  edOutcomeBlockedReason,
  examinationBlockedReason,
  handoverBlockedReason,
  referralDraftBlockedReason,
  transportLegalFormNotice,
  withdrawReferralBlockedReason,
  type ReferralDraftAnswers,
} from "@/components/ward-management/ed/ed-blocked-reasons";
import {
  CANCEL_TRANSPORT_UNCHOSEN,
  COMMUNITY_DECLINE_REASON_UNCHOSEN,
  cancelTransportBlockedReason,
  communityDeclineBlockedReason,
} from "@/components/ward-management/community/community-blocked-reasons";
import {
  instantFromEstimatedTimeInputs,
  transportAnswersBlockedReason,
  type TransportAnswersDraft,
} from "@/components/ward-management/ward-transport-answers";
import {
  COMMUNITY_DECLINE_REASONS,
  ED_DECLINE_REASONS,
  type Movement,
  type TransportJob,
} from "@/components/ward-management/ward-model";
import { CANCEL_TRANSPORT_REASONS } from "@/components/ward-management/ward-change-reasons";

const NOW = 10_000;
const COLLECTED =
  'The patient has been collected. Ask the coordinator to stop the journey, using the "Stop transport" control on the console; the bed stays held until it is released.';
const NOT_UNTIL_EXAMINED = "Not offered until the examination outcome is recorded.";

function movement(overrides: Partial<Movement> = {}): Movement {
  return {
    id: "WF-T01",
    originEdId: "ed-test",
    openedAt: NOW - 60,
    flaggedUrgent: false,
    urgency: 2,
    cohort: "Adult",
    security: "Open",
    sex: "Female",
    specialling: false,
    highAcuity: false,
    legalStatus: "Voluntary",
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "placement_requested",
    owner: "Test owner",
    referredUnitIds: [],
    declines: [],
    blocker: "No blocker",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
    ...overrides,
  } as Movement;
}

const job = (extra: Partial<TransportJob> = {}) =>
  ({ id: "TJ-1", provider: "Ambulance service", escortRequired: true, ...extra }) as TransportJob;
const closed = { closure: { at: NOW, outcome: "did_not_proceed" as const, reason: "Test closure" } };
const collected = { transport: job({ collectedAt: NOW - 5 } as Partial<TransportJob>) };
const onFormUnexamined = { legalStatus: "Detained awaiting examination" as const };
const onFormExamined = {
  legalStatus: "Detained awaiting examination" as const,
  examination: { at: NOW - 30, outcome: "inpatient_order" as const },
};

describe("declineReasonBlockedReason", () => {
  it("blocks until a reason is chosen, with the exact text", () => {
    expect(declineReasonBlockedReason(undefined)).toBe(
      "Choose a reason before recording this decline. None is chosen for you: a reason nobody picked would be filed as this team's own answer.",
    );
  });
  it("allows once a reason is chosen", () => {
    expect(declineReasonBlockedReason(ED_DECLINE_REASONS[0])).toBeUndefined();
  });
});

describe("referralDraftBlockedReason", () => {
  const complete: ReferralDraftAnswers = {
    patientFound: false,
    unidentified: true,
    cohort: "Adult",
    security: "Open",
    sex: "Female",
    gender: "not_recorded",
    legalStatus: "Voluntary",
    urgency: 2,
    specialling: false,
    highAcuity: false,
    legalFormDueAtDate: "",
    legalFormDueAtTime: "",
  };
  it("allows a fully answered draft", () => {
    expect(referralDraftBlockedReason(complete)).toBeUndefined();
  });
  it.each<[Partial<ReferralDraftAnswers>, string]>([
    [{ unidentified: false }, 'Find the patient by name or UMRN, or choose "Not yet identified".'],
    [
      { cohort: undefined },
      "Choose a cohort before raising this referral. None is chosen for you: a cohort nobody picked would be filed as this patient's own record.",
    ],
    [
      { security: undefined },
      "Choose a security level before raising this referral. None is chosen for you: a security level nobody picked would be filed as this patient's own record.",
    ],
    [
      { sex: undefined },
      "Choose a sex before raising this referral. None is chosen for you: a sex nobody picked would be filed as this patient's own record.",
    ],
    [{ gender: undefined }, 'Choose a gender, or "Not yet recorded". None is chosen for you.'],
    [
      { legalStatus: undefined },
      "Choose a legal status before raising this referral. None is chosen for you: a legal status nobody picked would be filed as this patient's own record.",
    ],
    [
      { urgency: undefined },
      "Choose an urgency tier before raising this referral. None is chosen for you: an urgency tier nobody picked would be filed as this patient's own record.",
    ],
    [
      { specialling: undefined },
      'State whether one-to-one nursing is required before raising this referral. None is chosen for you: an unanswered box would be filed as "not required", and the reducer only checks a ward\'s one-to-one capacity when the patient is recorded as needing it.',
    ],
    [
      { highAcuity: undefined },
      "State whether high-acuity nursing is required before raising this referral. None is chosen for you: an unanswered box would be filed as “not required”, and the acuity gate only checks a ward’s high-acuity staffing when the patient is recorded as needing it.",
    ],
    [
      { legalFormDueAtDate: "2026-10-15" },
      "Enter both the date and the time written on the form, or leave both blank.",
    ],
  ])("blocks %o with the exact text", (change, reason) => {
    expect(referralDraftBlockedReason({ ...complete, ...change })).toBe(reason);
  });
  it("accepts a found patient in place of 'Not yet identified'", () => {
    expect(referralDraftBlockedReason({ ...complete, unidentified: false, patientFound: true })).toBeUndefined();
  });
});

describe("examinationBlockedReason", () => {
  it("blocks a repeat examination, naming the patient", () => {
    const m = movement(onFormExamined);
    expect(examinationBlockedReason(m, "Alex Test")).toBe("Alex Test was already examined.");
    expect(examinationBlockedReason(m)).toBe("This patient was already examined.");
  });
  it("allows a first examination, and a repeat after 'further examination ordered'", () => {
    expect(examinationBlockedReason(movement())).toBeUndefined();
    expect(
      examinationBlockedReason(movement({ examination: { at: NOW, outcome: "further_examination_ordered" } })),
    ).toBeUndefined();
  });
});

describe("communityReferralBlockedReason", () => {
  it("blocks a closed movement, a collected patient and an unexamined form, with the exact text", () => {
    expect(communityReferralBlockedReason(movement(closed))).toBe("Cannot refer a closed movement (Test closure).");
    expect(communityReferralBlockedReason(movement(collected))).toBe(COLLECTED);
    expect(communityReferralBlockedReason(movement(onFormUnexamined))).toBe(NOT_UNTIL_EXAMINED);
  });
  it("allows a voluntary patient and an examined patient on a form", () => {
    expect(communityReferralBlockedReason(movement())).toBeUndefined();
    expect(communityReferralBlockedReason(movement(onFormExamined))).toBeUndefined();
  });
});

describe("edOutcomeBlockedReason", () => {
  it("blocks a closed movement and a collected patient, with the exact text", () => {
    expect(edOutcomeBlockedReason(movement(closed))).toBe(
      "Cannot record an outcome for a closed movement (Test closure).",
    );
    expect(edOutcomeBlockedReason(movement(collected))).toBe(COLLECTED);
  });
  it("allows an open, uncollected movement, even on an unexamined form", () => {
    expect(edOutcomeBlockedReason(movement(onFormUnexamined))).toBeUndefined();
  });
});

describe("dischargeChoiceBlockedReason", () => {
  it("blocks discharge for a patient on a form without a conclusive examination", () => {
    expect(dischargeChoiceBlockedReason(movement(onFormUnexamined))).toBe(NOT_UNTIL_EXAMINED);
    expect(
      dischargeChoiceBlockedReason(
        movement({ ...onFormUnexamined, examination: { at: NOW, outcome: "further_examination_ordered" } }),
      ),
    ).toBe(NOT_UNTIL_EXAMINED);
  });
  it("allows a voluntary patient and an examined patient on a form", () => {
    expect(dischargeChoiceBlockedReason(movement())).toBeUndefined();
    expect(dischargeChoiceBlockedReason(movement(onFormExamined))).toBeUndefined();
  });
});

describe("handoverBlockedReason", () => {
  it("blocks a pulled bed with no transport, and any stage other than pulled, with the exact text", () => {
    expect(handoverBlockedReason(movement({ stage: "pulled" }), "Alex Test")).toBe(
      "Alex Test has no transport booked — book it first, then mark the handover ready.",
    );
    expect(handoverBlockedReason(movement())).toBe(
      "This patient is placement requested, not bed pulled — a handover can only be marked ready once a bed is pulled.",
    );
  });
  it("allows a pulled bed with transport booked, or with 'no transport needed' recorded", () => {
    expect(handoverBlockedReason(movement({ stage: "pulled", transport: job() }))).toBeUndefined();
    expect(
      handoverBlockedReason(
        movement({ stage: "pulled", transportNeed: { needed: false } as Movement["transportNeed"] }),
      ),
    ).toBeUndefined();
  });
});

describe("bookTransportBlockedReason", () => {
  it("blocks before a bed is pulled, and a second booking, with the exact text", () => {
    expect(bookTransportBlockedReason(movement(), "Alex Test")).toBe(
      "Alex Test is placement requested, not bed pulled — transport can only be booked once a bed is pulled, or after handover is marked ready.",
    );
    expect(bookTransportBlockedReason(movement({ stage: "pulled", transport: job() }))).toBe(
      "This patient already has transport booked. Booking again would replace a job the provider may already have accepted, and take its timestamps with it — an existing job has to be cancelled before a new one can be booked.",
    );
  });
  it("allows booking once pulled or handover-ready with no job", () => {
    expect(bookTransportBlockedReason(movement({ stage: "pulled" }))).toBeUndefined();
    expect(bookTransportBlockedReason(movement({ stage: "handover_ready" }))).toBeUndefined();
  });
});

describe("transportLegalFormNotice", () => {
  it("warns for an involuntary patient with no Form 4A, with the exact text", () => {
    expect(transportLegalFormNotice(movement(onFormUnexamined))).toBe(
      "No Form 4A (Transport order) is recorded for this patient.",
    );
  });
  it("says nothing for a voluntary patient or one already carrying a 4A", () => {
    expect(transportLegalFormNotice(movement())).toBeUndefined();
    expect(
      transportLegalFormNotice(movement({ ...onFormUnexamined, legalForm: { code: "4A" } as Movement["legalForm"] })),
    ).toBeUndefined();
  });
});

describe("withdrawReferralBlockedReason", () => {
  it("blocks a closed movement, a collected patient and no live referral, with the exact text", () => {
    expect(withdrawReferralBlockedReason(movement(closed), "Alex Test")).toBe(
      "Alex Test has already closed (Test closure). A withdrawal cannot be added to a movement that has ended.",
    );
    expect(withdrawReferralBlockedReason(movement({ ...collected, referredUnitIds: ["u1"] }))).toBe(COLLECTED);
    expect(withdrawReferralBlockedReason(movement())).toBe("This patient holds no live referral to withdraw.");
  });
  it("allows a live referral, and an accepted one before collection", () => {
    expect(withdrawReferralBlockedReason(movement({ referredUnitIds: ["u1"] }))).toBeUndefined();
    expect(withdrawReferralBlockedReason(movement({ acceptedUnitId: "u1" }))).toBeUndefined();
  });
});

describe("transportAnswersBlockedReason (shared by ED and community)", () => {
  const answered: TransportAnswersDraft = {
    provider: "Ambulance service",
    escortRequired: false,
    cadNumber: "CAD-1",
    transportLegalStatus: "voluntary",
    estimatedTime: "14:30",
    estimatedDay: "today",
  };
  it("lists every missing answer in order, with the exact text", () => {
    expect(
      transportAnswersBlockedReason(
        {
          provider: undefined,
          escortRequired: undefined,
          cadNumber: " ",
          transportLegalStatus: undefined,
          estimatedTime: "",
          estimatedDay: "today",
        },
        NOW,
      ),
    ).toBe(
      "Before booking, choose who is collecting the patient, answer the escort question, enter the CAD transport number, state whether the transport is voluntary or involuntary, enter the estimated time. None is filled in for you: the record has to say that this team decided.",
    );
    expect(transportAnswersBlockedReason({ ...answered, estimatedTime: "14:3" }, NOW)).toBe(
      "Before booking, enter the estimated time. None is filled in for you: the record has to say that this team decided.",
    );
  });
  it("allows a fully answered booking", () => {
    expect(transportAnswersBlockedReason(answered, NOW)).toBeUndefined();
  });
  it("resolves the estimated time against today or tomorrow, refusing a malformed one", () => {
    const startOfToday = Math.floor(NOW / 1440) * 1440;
    expect(instantFromEstimatedTimeInputs("0930", "today", NOW)).toBe(startOfToday + 570);
    expect(instantFromEstimatedTimeInputs("09:30", "tomorrow", NOW)).toBe(startOfToday + 1440 + 570);
    expect(instantFromEstimatedTimeInputs("", "today", NOW)).toBeUndefined();
  });
});

describe("community blocked reasons", () => {
  it("blocks a community decline until a reason is chosen, with the exact text", () => {
    expect(communityDeclineBlockedReason(undefined)).toBe(COMMUNITY_DECLINE_REASON_UNCHOSEN);
    expect(COMMUNITY_DECLINE_REASON_UNCHOSEN).toBe(
      "Choose the reason this team cannot take this referral before declining it.",
    );
    expect(communityDeclineBlockedReason(COMMUNITY_DECLINE_REASONS[0])).toBeUndefined();
  });
  it("blocks a transport cancel until a reason is chosen, with the exact text", () => {
    expect(cancelTransportBlockedReason(undefined)).toBe(CANCEL_TRANSPORT_UNCHOSEN);
    expect(CANCEL_TRANSPORT_UNCHOSEN).toBe(
      "Choose why the transport job is being cancelled first. The provider is told.",
    );
    expect(cancelTransportBlockedReason(CANCEL_TRANSPORT_REASONS[0])).toBeUndefined();
  });
});
