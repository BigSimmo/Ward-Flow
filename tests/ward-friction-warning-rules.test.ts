import { describe, expect, it } from "vitest";
import {
  referralCatchmentWords,
  referralContactError,
  referralIntakeError,
  referrerContactWords,
  type ReferralIntakeDetails,
} from "../src/components/ward-management/referrals/referral-submission";
import { referralLetterText } from "../src/components/ward-management/referrals/referral-letter";
import { changeReasonLabels } from "../src/components/ward-management/ward-change-reasons";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/*
 * Josh's warning-not-blocker rule (27 Oct 2026): anything not important, or that may not be to hand,
 * warns and never blocks. One reducer test for each engine rule changed (findings 15, 40, 44 and 51).
 * Finding 188 is in ward-top25-referral-cap.test.ts and finding 72 in ward-criteria-led-discharge.test.ts.
 * Synthetic seed and synthetic values only.
 */

const NOW = NOW_ANCHOR;

function run(event: Record<string, unknown>) {
  const before = seedWardFlowState();
  const after = wardFlowReducer(before, { now: NOW, ...event } as WardFlowEvent);
  return { before, after, refusal: after.rejections.slice(before.rejections.length).at(-1)?.reason };
}

describe("finding 15: an urgency change needs no reason", () => {
  it("records the change without a reason, marked as not given", () => {
    const target = seedWardFlowState().movements[0]!;
    const { after, refusal } = run({ type: "CHANGE_URGENCY", role: "coordinator", movementId: target.id, urgency: 1 });
    expect(refusal).toBeUndefined();
    const updated = after.movements.find((movement) => movement.id === target.id)!;
    expect(updated.urgency).toBe(1);
    expect(updated.urgencyChanges.at(-1)).toMatchObject({ to: 1, reason: "not_given" });
    expect(changeReasonLabels.not_given).toBe("No reason given");
  });

  it("still refuses a reason that is not on the list", () => {
    const target = seedWardFlowState().movements[0]!;
    const { refusal } = run({
      type: "CHANGE_URGENCY",
      role: "coordinator",
      movementId: target.id,
      urgency: 1,
      reason: "typed text",
    });
    expect(refusal).toContain("URGENCY_CHANGE_REASONS");
  });

  it("still needs a reason for a legal status change", () => {
    const target = seedWardFlowState().movements[0]!;
    const { refusal } = run({
      type: "CHANGE_LEGAL_STATUS",
      role: "coordinator",
      movementId: target.id,
      legalStatus: "Voluntary",
    });
    expect(refusal).toContain("LEGAL_STATUS_CHANGE_REASONS");
  });
});

const INTAKE: ReferralIntakeDetails = {
  catchment: { teamName: "Synthetic Clinic", confirmed: true },
  reasonForReferral: "Synthetic referral for assessment",
  legalStatus: "Voluntary",
  riskFlags: [],
  medicalClearance: { cleared: true },
  triageAndRampCompleted: true,
  additionalDocuments: false,
  charts: [],
  chartsToFollow: ["medication", "observation"],
  referrer: { name: "Demo Sender", phone: "0000 000 000", email: "", role: "Nurse", location: "Demo ED" },
};

const WARD_ARM = {
  kind: "psychiatric_ward",
  unitId: "scgh-adult-open",
  sex: "Female",
  gender: "Female",
  secureBedNeeded: false,
  involuntaryBedNeeded: false,
  highAcuityNursingNeeded: false,
};

function receive(intake: ReferralIntakeDetails, destinations: readonly Record<string, unknown>[]) {
  return run({
    type: "RECEIVE_REFERRAL",
    role: "community",
    ageBand: "Adult",
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "unknown", reason: "not_known" },
    source: "community",
    urgency: 2,
    originSiteCode: "SCGH",
    transportNeeded: false,
    history: "Synthetic patient story",
    intake,
    destinations,
  });
}

describe("finding 40: catchment not known for a ward or ED referral", () => {
  const notKnown: ReferralIntakeDetails = { ...INTAKE, catchment: { teamName: "", confirmed: true, notKnown: true } };

  it("accepts a ward referral with the catchment not known, and the letter flags it", () => {
    expect(referralIntakeError(notKnown)).toBeNull();
    const { after, refusal } = receive(notKnown, [WARD_ARM]);
    expect(refusal).toBeUndefined();
    expect(after.referrals.at(-1)?.intake?.catchment).toEqual({ teamName: "", confirmed: true, notKnown: true });
    expect(referralCatchmentWords(notKnown.catchment)).toBe("Catchment not known");
    expect(referralCatchmentWords(INTAKE.catchment)).toBe("Synthetic Clinic · confirmed");
  });

  it("refuses it for a community team referral, which needs the team", () => {
    const { refusal } = receive(notKnown, [
      { kind: "community_team", teamName: "Synthetic Clinic", purpose: "follow_up" },
    ]);
    expect(refusal).toContain("needs the patient's catchment team");
  });

  it("still refuses a blank team when the catchment is not marked as not known", () => {
    expect(referralIntakeError({ ...INTAKE, catchment: { teamName: " ", confirmed: true } })).toBe(
      "Confirm the patient's catchment.",
    );
    expect(
      referralIntakeError({ ...INTAKE, catchment: { teamName: "Synthetic Clinic", confirmed: true, notKnown: true } }),
    ).toBe("Confirm the patient's catchment.");
  });

  it("prints the catchment line on the letter only when one is given", () => {
    const input = {
      destinationPhrase: "a ward",
      patientName: "Synthetic Person",
      umrn: "UM000001",
      ageSex: "30, female",
      suburb: "",
      from: "Demo ED",
      recipients: [],
      urgency: "Tier 2",
      legalStatus: "Voluntary",
      reason: "",
      history: "",
      risks: [],
      clearance: "Cleared",
      referrer: { name: "Demo Sender", role: "Nurse", phone: "0000 000 000" },
    };
    expect(referralLetterText({ ...input, catchment: "Catchment not known" }, "10:00")).toContain(
      "Catchment: Catchment not known",
    );
    expect(referralLetterText(input, "10:00")).not.toContain("Catchment:");
  });
});

describe("finding 44: the referrer email never blocks", () => {
  it("sends with no email, or an email that does not look like one", () => {
    expect(referralContactError(INTAKE.referrer)).toBeNull();
    expect(referralContactError({ ...INTAKE.referrer, email: "not an email" })).toBeNull();
    expect(referralIntakeError(INTAKE)).toBeNull();
    expect(receive(INTAKE, [WARD_ARM]).refusal).toBeUndefined();
  });

  it("still needs the name and a callable phone number", () => {
    expect(referralContactError({ ...INTAKE.referrer, name: "" })).toBe("Enter your name.");
    expect(referralContactError({ ...INTAKE.referrer, phone: "123" })).toBe("Enter your phone number.");
  });

  it("shows the phone alone when no email was given", () => {
    expect(referrerContactWords(INTAKE.referrer)).toBe("0000 000 000");
    expect(referrerContactWords({ phone: "0000 000 000", email: "demo@example.com" })).toBe(
      "0000 000 000 · demo@example.com",
    );
  });
});

describe("finding 51: Add a patient saves the Aboriginal or Torres Strait Islander answer", () => {
  const add = (extra: Record<string, unknown>) =>
    run({
      type: "ADD_PATIENT",
      role: "coordinator",
      umrn: "UM999901",
      givenName: "Synthetic",
      familyName: "Person",
      dateOfBirth: "1990-01-01",
      ...extra,
    });

  it("stores a listed answer on the record", () => {
    const { after, refusal } = add({
      aboriginalOrTorresStraitIslanderStatus: "Aboriginal, not Torres Strait Islander",
    });
    expect(refusal).toBeUndefined();
    expect(after.patients.at(-1)?.aboriginalOrTorresStraitIslanderStatus).toBe(
      "Aboriginal, not Torres Strait Islander",
    );
  });

  it("adds the patient with no answer, and stores none", () => {
    const { after, refusal } = add({});
    expect(refusal).toBeUndefined();
    expect(after.patients.at(-1)).not.toHaveProperty("aboriginalOrTorresStraitIslanderStatus");
  });

  it("refuses an answer that is not on the list", () => {
    expect(add({ aboriginalOrTorresStraitIslanderStatus: "typed text" }).refusal).toContain(
      "Aboriginal or Torres Strait Islander status",
    );
  });
});
