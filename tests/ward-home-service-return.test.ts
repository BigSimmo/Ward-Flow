// Closing-the-loop features (24 Oct 2026, package E): "Repatriation: asked vs agreed". The return
// request and the home service's answer are recorded apart, each with the desk and the time.
import { describe, expect, it } from "vitest";

import {
  homeServiceReturnOf,
  homeServiceReturnStage,
  reviewDayInstant,
  reviewDayText,
} from "@/components/ward-management/out-of-area/home-service-return";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const ADMISSION = "AD-RPHS-18";

function requested() {
  return wardFlowReducer(seedWardFlowState(), {
    type: "RECORD_HOME_SERVICE_RETURN",
    role: "coordinator",
    now: NOW_ANCHOR,
    admissionId: ADMISSION,
    step: "requested",
    homeHospital: "BUN",
    nextReviewAt: reviewDayInstant(NOW_ANCHOR, 1),
  });
}

describe("return requested vs home service agreed", () => {
  it("records the request with desk and time, and no answer yet", () => {
    const record = homeServiceReturnOf(requested().homeServiceReturns, ADMISSION)!;
    expect(record).toMatchObject({ homeHospital: "BUN", requestedAt: NOW_ANCHOR, requestedBy: "coordinator" });
    expect(record.answer).toBeUndefined();
    expect(homeServiceReturnStage(record)).toBe("requested");
    expect(reviewDayText(record.nextReviewAt!, NOW_ANCHOR)).toBe("Review tomorrow");
  });

  it("records the answer and agreed prerequisites apart from the request, in listed order", () => {
    const state = wardFlowReducer(requested(), {
      type: "RECORD_HOME_SERVICE_RETURN",
      role: "coordinator",
      now: NOW_ANCHOR + 60,
      admissionId: ADMISSION,
      step: "answered",
      answer: "agreed",
      prerequisites: ["transport_arranged", "home_bed_available"],
    });
    const record = homeServiceReturnOf(state.homeServiceReturns, ADMISSION)!;
    expect(record.requestedAt).toBe(NOW_ANCHOR);
    expect(record).toMatchObject({ answer: "agreed", answeredAt: NOW_ANCHOR + 60, answeredBy: "coordinator" });
    expect(record.prerequisites).toEqual(["home_bed_available", "transport_arranged"]);
    expect(homeServiceReturnStage(record)).toBe("agreed");
    // Recording an answer never queues a return movement: that stays RECORD_REPATRIATION's step.
    expect(state.movements.length).toBe(requested().movements.length);
  });

  it("refuses an answer with no request, an off-list prerequisite, and a declined answer with prerequisites", () => {
    const base = seedWardFlowState();
    const noRequest = wardFlowReducer(base, {
      type: "RECORD_HOME_SERVICE_RETURN",
      role: "coordinator",
      now: NOW_ANCHOR,
      admissionId: ADMISSION,
      step: "answered",
      answer: "agreed",
      prerequisites: [],
    });
    expect(homeServiceReturnOf(noRequest.homeServiceReturns, ADMISSION)).toBeUndefined();
    const offList = wardFlowReducer(requested(), {
      type: "RECORD_HOME_SERVICE_RETURN",
      role: "coordinator",
      now: NOW_ANCHOR,
      admissionId: ADMISSION,
      step: "answered",
      answer: "agreed",
      prerequisites: ["anything" as never],
    });
    expect(homeServiceReturnOf(offList.homeServiceReturns, ADMISSION)?.answer).toBeUndefined();
    const declined = wardFlowReducer(requested(), {
      type: "RECORD_HOME_SERVICE_RETURN",
      role: "coordinator",
      now: NOW_ANCHOR,
      admissionId: ADMISSION,
      step: "answered",
      answer: "declined",
      prerequisites: ["transport_arranged"],
    });
    expect(homeServiceReturnOf(declined.homeServiceReturns, ADMISSION)?.answer).toBeUndefined();
  });

  it("is the coordinator's step only", () => {
    const state = wardFlowReducer(seedWardFlowState(), {
      type: "RECORD_HOME_SERVICE_RETURN",
      role: "ward",
      now: NOW_ANCHOR,
      admissionId: ADMISSION,
      step: "requested",
      homeHospital: "BUN",
    });
    expect(homeServiceReturnOf(state.homeServiceReturns, ADMISSION)).toBeUndefined();
  });

  it("survives the stored-state check, and a record naming no stay is refused", () => {
    const state = requested();
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(state)))).toBe(true);
    const orphan = { ...state, homeServiceReturns: [{ ...state.homeServiceReturns![0]!, admissionId: "AD-NOPE" }] };
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(orphan)))).toBe(false);
  });
});
