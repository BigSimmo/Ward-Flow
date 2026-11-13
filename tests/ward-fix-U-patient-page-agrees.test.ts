import { describe, expect, it } from "vitest";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { Movement, Referral, ReferralDestination } from "@/components/ward-management/ward-model";
import { GENERAL_OBSERVATION } from "../src/components/ward-management/ward-observation";
import {
  arrivalTransportFallbackLine,
  arrivalTransportTag,
} from "@/components/ward-management/ward/ward-arrival-transport-words";
import { movementHasBedHold } from "@/components/ward-management/ward-movement-bed-hold";
import { recordedByWords } from "@/components/ward-management/ward-flow-roles";
import { journeyEvents } from "@/components/ward-management/patients/patient-journey-timeline";
import { DUPLICATE_SENTENCES } from "@/components/ward-management/referrals/referral-duplicate";
import { openRequestNotice } from "@/components/ward-management/referrals/referral-open-request-notice";
import { patientHref } from "@/components/ward-management/shell/ward-patient-href";
import { referralDestinationLabel } from "@/components/ward-management/ward-referrals";
import {
  providedInformationNeeds,
  wardAskedWords,
} from "@/components/ward-management/referrals/referral-information-needs";

/**
 * F-41 (A9-24, A9-25, A9-32): the patient page, the Coming in cards and the ED board tell the same
 * story as the record. Synthetic journeys only.
 */
const now = 642;
const unitId = "scgh-adult-open";

function pulledJourney() {
  let state = seedWardFlowState();
  const send = (event: Record<string, unknown>) => {
    state = wardFlowReducer(state, { now, ...event } as WardFlowEvent);
  };
  send({
    type: "RAISE_REFERRAL",
    role: "ed",
    edId: "jhc-ed",
    draft: {
      cohort: "Adult",
      security: "Open",
      sex: "Female",
      gender: "Female",
      observation: GENERAL_OBSERVATION,
      highAcuity: false,
      legalStatus: "Voluntary",
      urgency: 2,
      legalFormCode: null,
    },
  });
  const movementId = state.movements.at(-1)!.id;
  send({ type: "REFER_TO_UNITS", role: "coordinator", movementId, unitIds: [unitId] });
  send({ type: "ACCEPT_IN_PRINCIPLE", role: "ward", movementId, unitId, actingUnitId: unitId });
  send({ type: "PULL_PATIENT", role: "ward", movementId, unitId, actingUnitId: unitId });
  expect(state.rejections).toEqual([]);
  return { state: state as WardFlowState, movement: state.movements.find((m) => m.id === movementId)! };
}

describe("A9-24: the Coming in card's transport words follow the transport record", () => {
  const base = { arrivalDetails: undefined, transport: undefined, transportNeed: undefined } as const;
  it("never says moving, or not set, against the record", () => {
    expect(arrivalTransportTag({ ...base, stage: "accepted_awaiting_bed" })).toBe("No transport booked yet");
    expect(arrivalTransportFallbackLine({ ...base, stage: "accepted_awaiting_bed" })).toBe("No transport booked yet");
    const booked = { id: "TJ-1", provider: "St John WA", escortRequired: false } as unknown as Movement["transport"];
    expect(arrivalTransportTag({ ...base, stage: "handover_ready", transport: booked })).toBe(
      "Transport: St John WA requested",
    );
    expect(arrivalTransportFallbackLine({ ...base, stage: "handover_ready", transport: booked })).not.toContain(
      "moving",
    );
    expect(arrivalTransportFallbackLine({ ...base, stage: "moving", transport: booked })).toBe(
      "Transport moving according to state protocol",
    );
    const collected = { ...booked, collectedAt: now } as Movement["transport"];
    expect(arrivalTransportTag({ ...base, stage: "moving", transport: collected })).toBe("Transport: Collected");
  });
});

describe("A9-25: the patient page agrees with the board", () => {
  it("reads a pulled bed from the stage on a desk that is not sent the ward's stay", () => {
    const { state, movement } = pulledJourney();
    expect(movement.admissionId).toBeDefined();
    expect(movementHasBedHold(movement, state.admissions)).toBe(true);
    // The ED desk's view carries no admission at the receiving ward.
    expect(movementHasBedHold(movement, [])).toBe(true);
    // A stay this view does hold is still checked in full.
    const released = state.admissions.map((admission) =>
      admission.id === movement.admissionId ? { ...admission, state: "occupied" as const } : admission,
    );
    expect(movementHasBedHold(movement, released)).toBe(false);
  });

  it("names the role that recorded a stage, never the role key", () => {
    expect(recordedByWords("ed")).toBe("ED clinician");
    expect(recordedByWords("coordinator")).toBe("Bed coordinator");
    expect(recordedByWords("Ward manager")).toBe("Nurse in charge");
    expect(recordedByWords("Someone else")).toBe("Someone else");
    const { movement } = pulledJourney();
    const texts = journeyEvents(movement, () => undefined).map((event) => event.text);
    expect(texts.some((text) => text.endsWith(", by ward"))).toBe(false);
    expect(texts.some((text) => /, by (ED clinician|Nurse in charge|Bed coordinator)$/.test(text))).toBe(true);
  });

  it("warns on the referral form when the person already has an open request at this department", () => {
    const journey = { movementId: "WF-1", siteCode: "JHC" };
    const none = { sentence: undefined, href: undefined };
    const shared = { referralNotice: none, sameSentence: DUPLICATE_SENTENCES[0] };
    const notice = openRequestNotice({
      personHref: patientHref("PT-901"),
      referralNotice: none,
      sameSentence: DUPLICATE_SENTENCES[0],
      openJourney: journey,
      originSiteCode: "JHC",
      liveMovementId: undefined,
    });
    expect(notice?.sentence).toBe(DUPLICATE_SENTENCES[0]);
    expect(notice?.href).toContain("/ward-flow/people/");
    // An open referral keeps the form's own sentence and link.
    expect(
      openRequestNotice({
        ...shared,
        referralNotice: { sentence: "S", href: undefined },
        personHref: patientHref("PT-901"),
        openJourney: undefined,
        originSiteCode: "JHC",
        liveMovementId: undefined,
      }),
    ).toEqual({ sentence: "S", href: "/ward-flow/referrals" });
    // The journey the form was opened on is not a second request for itself.
    expect(
      openRequestNotice({
        ...shared,
        personHref: patientHref("PT-901"),
        openJourney: journey,
        originSiteCode: "JHC",
        liveMovementId: "WF-1",
      }),
    ).toBeUndefined();
    // Another department keeps its own "Already on an open ED movement at …" line.
    expect(
      openRequestNotice({
        ...shared,
        personHref: patientHref("PT-901"),
        openJourney: journey,
        originSiteCode: "RPH",
        liveMovementId: undefined,
      }),
    ).toBeUndefined();
    expect(
      openRequestNotice({
        ...shared,
        personHref: undefined,
        openJourney: journey,
        originSiteCode: "JHC",
        liveMovementId: undefined,
      }),
    ).toBeUndefined();
  });
});

function wardDestination(unitId: string): ReferralDestination {
  return {
    kind: "psychiatric_ward",
    unitId,
    sex: "Female",
    secureBedNeeded: false,
    involuntaryBedNeeded: false,
    highAcuityNursingNeeded: false,
  };
}

describe("A9-32: a ward's questions to the ED are named and answered visibly", () => {
  it("names the ward, never its internal id", () => {
    const label = referralDestinationLabel(wardDestination("rph-older-adult"));
    expect(label).not.toContain("rph-older-adult");
    expect(label).not.toContain("Ward · ");
    expect(referralDestinationLabel(wardDestination("not-a-listed-ward"))).toBe("Ward · not-a-listed-ward");
  });

  it("counts a ward's open asks for the ED row and lists answered ones as provided", () => {
    const needs = [
      { need: "medical_clearance_result" as const, at: 600 },
      { need: "legal_form_copy" as const, at: 600, metAt: 630 },
    ];
    const referral = {
      destinations: [{ state: "queued", destination: { kind: "psychiatric_ward" }, informationNeeds: needs }],
    } as unknown as Referral;
    expect(wardAskedWords(referral)).toBe("Ward asked for 1 item");
    expect(providedInformationNeeds(needs).map((entry) => entry.need)).toEqual(["legal_form_copy"]);
    const answered = { destinations: [{ ...referral.destinations[0]!, state: "accepted" }] } as unknown as Referral;
    expect(wardAskedWords(answered)).toBeUndefined();
  });
});
