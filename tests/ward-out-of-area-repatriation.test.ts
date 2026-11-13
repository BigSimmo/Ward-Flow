import { describe, expect, it } from "vitest";

import {
  BLANK_REPAT_DRAFT,
  departTimeUnreadable,
  missingAnswers,
  planWarningsLine,
  type RepatDraft,
} from "@/components/ward-management/out-of-area/out-of-area-model";
import {
  canSendReturnPlan,
  returnPlanBlockReason,
  returnPlanMissingToSend,
} from "@/components/ward-management/out-of-area/out-of-area-return-plan";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { TYPED_TEXT_NOT_KEPT } from "@/components/ward-management/ward-flow-demo-storage-constants";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { outOfAreaLedger } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";

// A16-04: the app shows only travel bands someone has checked (none yet). This file tests a
// mechanism that needs bands, so importing this swaps in the tests' own invented table.
import "./helpers/ward-test-travel-bands";

const COMPLETE_SEND_DRAFT: RepatDraft = {
  homeHospital: "RPH",
  receivingWardAgreed: undefined,
  mode: "road",
  provider: "Ambulance service",
  cadNumber: "CAD-4410",
  transportLegalStatus: "voluntary",
  estimatedTime: "23:30",
  estimatedDay: "tomorrow",
  form4CReceived: undefined,
  escortRequired: undefined,
};

describe("out-of-area repatriation — return plan gate and reducer transitions", () => {
  // Form rule (design audit W13, Josh's card 3, 5 Nov 2026): the provider and depart time warn and a
  // blank CAD is "CAD to follow", so only the hospital, road or flight and legal status block.
  it("blocks sending an incomplete return plan and names the remaining count", () => {
    expect(canSendReturnPlan(BLANK_REPAT_DRAFT)).toBe(false);
    expect(returnPlanMissingToSend(BLANK_REPAT_DRAFT)).toEqual([
      "receiving hospital",
      "road or flight",
      "legal status",
    ]);
    expect(returnPlanBlockReason(BLANK_REPAT_DRAFT)).toBe("Answer the 3 left first.");
  });

  it("sends with no provider, no depart time and CAD to follow, and warns about each", () => {
    const sparse: RepatDraft = { ...COMPLETE_SEND_DRAFT, provider: undefined, cadNumber: "", estimatedTime: "" };
    expect(canSendReturnPlan(sparse)).toBe(true);
    expect(planWarningsLine(sparse, NOW_ANCHOR)).toBe(
      "Not recorded: provider, depart time. CAD to follow. You can still record.",
    );
    // A typed placeholder is a wrong answer, not a blank one, and still blocks (HAZ-03, #430).
    expect(returnPlanMissingToSend({ ...sparse, cadNumber: "TBC" })).toEqual(["CAD number"]);
  });

  it("lists the omissions without 'You can still record' while a blocking answer is missing", () => {
    expect(planWarningsLine(BLANK_REPAT_DRAFT, NOW_ANCHOR)).toBe("Not recorded: provider, depart time. CAD to follow.");
    const noHospital: RepatDraft = { ...COMPLETE_SEND_DRAFT, homeHospital: "", provider: undefined };
    expect(canSendReturnPlan(noHospital)).toBe(false);
    expect(planWarningsLine(noHospital, NOW_ANCHOR)).toBe("Not recorded: provider.");
  });

  it("blocks a typed depart time that cannot be read, while a blank one only warns", () => {
    const unreadable: RepatDraft = { ...COMPLETE_SEND_DRAFT, estimatedTime: "half past" };
    expect(departTimeUnreadable(unreadable)).toBe(true);
    expect(returnPlanMissingToSend(unreadable)).toEqual(["depart time"]);
    expect(canSendReturnPlan(unreadable)).toBe(false);
    expect(missingAnswers({ ...unreadable, receivingWardAgreed: true })).toEqual(["depart time"]);
    // Blocking, so it is not also listed as a warning, and the line makes no promise.
    expect(planWarningsLine(unreadable, NOW_ANCHOR)).toBe("");
    const blank: RepatDraft = { ...COMPLETE_SEND_DRAFT, estimatedTime: "   " };
    expect(departTimeUnreadable(blank)).toBe(false);
    expect(returnPlanMissingToSend(blank)).toEqual([]);
    expect(planWarningsLine(blank, NOW_ANCHOR)).toBe("Not recorded: depart time. You can still record.");
  });

  it("records a return with no provider, depart time or CAD, and the record says so", () => {
    const seeded = seedWardFlowState();
    const { entries } = outOfAreaLedger(wardAdmissions, allUnits(), NOW_ANCHOR);
    const admissionId = entries[0]!.admission.id;
    const after = wardFlowReducer(seeded, {
      type: "RECORD_REPATRIATION",
      role: "coordinator",
      now: NOW_ANCHOR,
      admissionId,
      homeHospital: "RPH",
      receivingWardAgreed: false,
      mode: "road",
      cadNumber: "",
      transportLegalStatus: "voluntary",
    });
    expect(after.rejections.length).toBe(seeded.rejections.length);
    const record = after.repatriations?.find((row) => row.admissionId === admissionId);
    expect(record).toMatchObject({ cadNumber: "", mode: "road" });
    expect(record && "provider" in record).toBe(false);
    expect(record && "estimatedAt" in record).toBe(false);
  });

  it("keeps the sent plan's provider and depart time when the agreement omits them, and a given value wins", () => {
    const seeded = seedWardFlowState();
    const { entries } = outOfAreaLedger(wardAdmissions, allUnits(), NOW_ANCHOR);
    const admissionId = entries[0]!.admission.id;
    const sent = wardFlowReducer(seeded, {
      type: "RECORD_REPATRIATION",
      role: "coordinator",
      now: NOW_ANCHOR,
      admissionId,
      homeHospital: "RPH",
      receivingWardAgreed: false,
      mode: "road",
      provider: "Ambulance service",
      cadNumber: "CAD-4410",
      transportLegalStatus: "voluntary",
      estimatedAt: NOW_ANCHOR + 120,
    });
    const agreement = {
      type: "RECORD_REPATRIATION" as const,
      role: "coordinator" as const,
      now: NOW_ANCHOR + 5,
      admissionId,
      homeHospital: "RPH",
      receivingWardAgreed: true,
      mode: "road" as const,
      cadNumber: "CAD-4410",
      transportLegalStatus: "voluntary" as const,
    };
    const kept = wardFlowReducer(sent, agreement).repatriations?.find((row) => row.admissionId === admissionId);
    expect(kept).toMatchObject({
      receivingWardAgreed: true,
      provider: "Ambulance service",
      estimatedAt: NOW_ANCHOR + 120,
    });
    const given = wardFlowReducer(sent, { ...agreement, estimatedAt: NOW_ANCHOR + 240 }).repatriations?.find(
      (row) => row.admissionId === admissionId,
    );
    expect(given).toMatchObject({ provider: "Ambulance service", estimatedAt: NOW_ANCHOR + 240 });
  });

  it("allows sending the return plan once hospital, transport, and dispatch are answered, before ward agreement", () => {
    expect(canSendReturnPlan(COMPLETE_SEND_DRAFT)).toBe(true);
    expect(returnPlanMissingToSend(COMPLETE_SEND_DRAFT)).toEqual([]);
    expect(returnPlanBlockReason(COMPLETE_SEND_DRAFT)).toBeUndefined();
    expect(planWarningsLine(COMPLETE_SEND_DRAFT, NOW_ANCHOR)).toBe("");
  });

  it("records a pending repatriation on Send to ward and opens the return movement when Mark ward agreed runs", () => {
    const seeded = seedWardFlowState();
    const { entries } = outOfAreaLedger(wardAdmissions, allUnits(), NOW_ANCHOR);
    const target = entries[0]!;
    const admissionId = target.admission.id;
    const movementsBefore = seeded.movements.length;

    const afterSend = wardFlowReducer(seeded, {
      type: "RECORD_REPATRIATION",
      role: "coordinator",
      now: NOW_ANCHOR,
      admissionId,
      homeHospital: "RPH",
      receivingWardAgreed: false,
      mode: "road",
      provider: "Ambulance service",
      cadNumber: "CAD-4410",
      transportLegalStatus: "voluntary",
      estimatedAt: NOW_ANCHOR + 120,
    });

    const pendingRecord = afterSend.repatriations?.find((rec) => rec.admissionId === admissionId);
    expect(pendingRecord).toBeDefined();
    expect(pendingRecord?.receivingWardAgreed).toBe(false);
    expect(afterSend.movements).toHaveLength(movementsBefore);

    // The board upgrades the sent plan in place; there is no undo step in between.
    const afterAgree = wardFlowReducer(afterSend, {
      type: "RECORD_REPATRIATION",
      role: "coordinator",
      now: NOW_ANCHOR,
      admissionId,
      homeHospital: pendingRecord!.homeHospital,
      receivingWardAgreed: true,
      mode: pendingRecord!.mode,
      provider: pendingRecord!.provider,
      cadNumber: pendingRecord!.cadNumber,
      transportLegalStatus: pendingRecord!.transportLegalStatus,
      estimatedAt: pendingRecord!.estimatedAt,
    });

    const agreedRecords = afterAgree.repatriations?.filter((rec) => rec.admissionId === admissionId) ?? [];
    expect(agreedRecords).toHaveLength(1);
    const agreedRecord = agreedRecords[0];
    expect(agreedRecord?.receivingWardAgreed).toBe(true);
    expect(agreedRecord?.agreedAt).toBe(NOW_ANCHOR);
    expect(agreedRecord?.agreedBy).toBe("coordinator");
    // The original send keeps its time, sender and hospital.
    expect(agreedRecord?.at).toBe(pendingRecord!.at);
    expect(agreedRecord?.by).toBe(pendingRecord!.by);
    expect(agreedRecord?.homeHospital).toBe(pendingRecord!.homeHospital);
    expect(afterAgree.movements).toHaveLength(movementsBefore + 1);

    // Undoing the agreement returns the plan to awaiting the ward; the sent plan itself stays.
    const afterUndo = wardFlowReducer(afterAgree, {
      type: "UNDO_REPATRIATION",
      role: "coordinator",
      now: NOW_ANCHOR + 1,
      admissionId,
    });
    expect(afterUndo.rejections).toHaveLength(afterAgree.rejections.length);
    const restored = afterUndo.repatriations?.filter((rec) => rec.admissionId === admissionId) ?? [];
    expect(restored).toHaveLength(1);
    expect(restored[0]?.receivingWardAgreed).toBe(false);
    expect(afterUndo.movements).toHaveLength(movementsBefore);
  });

  it("checks a new CAD number on the agreement, but not the plan's own number kept as the placeholder", () => {
    const seeded = seedWardFlowState();
    const { entries } = outOfAreaLedger(wardAdmissions, allUnits(), NOW_ANCHOR);
    const admissionId = entries[0]!.admission.id;
    const plan = {
      type: "RECORD_REPATRIATION" as const,
      role: "coordinator" as const,
      now: NOW_ANCHOR,
      admissionId,
      homeHospital: "RPH",
      receivingWardAgreed: false,
      mode: "road" as const,
      provider: "Ambulance service" as const,
      cadNumber: "CAD-4410",
      transportLegalStatus: "voluntary" as const,
      estimatedAt: NOW_ANCHOR + 120,
    };
    const afterSend = wardFlowReducer(seeded, plan);
    // A device keeps the plan with its CAD number as the placeholder, and the board's agreement
    // re-sends what the record holds.
    const restored = {
      ...afterSend,
      repatriations: afterSend.repatriations!.map((rec) =>
        rec.admissionId === admissionId ? { ...rec, cadNumber: TYPED_TEXT_NOT_KEPT } : rec,
      ),
    };
    const agreed = wardFlowReducer(restored, { ...plan, receivingWardAgreed: true, cadNumber: TYPED_TEXT_NOT_KEPT });
    expect(agreed.rejections).toHaveLength(restored.rejections.length);
    expect(agreed.repatriations?.find((rec) => rec.admissionId === admissionId)?.receivingWardAgreed).toBe(true);

    const retyped = wardFlowReducer(afterSend, { ...plan, receivingWardAgreed: true, cadNumber: "TBA" });
    expect(retyped.rejections.at(-1)?.reason).toBe(
      "RECORD_REPATRIATION cadNumber refused: the CAD number looks like a placeholder, so enter the number the provider gave",
    );
    expect(retyped.repatriations?.find((rec) => rec.admissionId === admissionId)?.receivingWardAgreed).toBe(false);
  });
});
