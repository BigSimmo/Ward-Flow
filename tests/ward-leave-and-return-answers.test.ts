import { describe, expect, it } from "vitest";

import { validSharedCommand } from "../backend/ward-flow/command-schemas";
import {
  BLANK_REPAT_DRAFT,
  involuntaryReturnAnswers,
} from "@/components/ward-management/out-of-area/out-of-area-model";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { outOfAreaLedger } from "@/components/ward-management/ward-referrals";
import { isValidSharedWardFlowState } from "@/components/ward-management/ward-shared-state-validation";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";

/**
 * Josh, 27 Oct 2026. #101: the Patient page's "Leave authorised by the treating psychiatrist" tick is
 * saved on the leave. #177: an involuntary return's Form 4C and escort answers are saved on the
 * return. Every answer is optional and none is ever a refusal. Synthetic seed only.
 */
describe("#101 the leave authority tick is saved on the leave", () => {
  const seeded = seedWardFlowState();
  const stay = seeded.admissions.find(
    (a) =>
      a.state === "occupied" &&
      a.awayAtEmergencyDepartmentSince === null &&
      !seeded.leaveBeds.some((bed) => bed.admissionId === a.id),
  )!;
  const leave = (extra: Partial<Extract<WardFlowEvent, { type: "RECORD_LEAVE_BED" }>> = {}) =>
    ({
      type: "RECORD_LEAVE_BED",
      role: "ward",
      now: NOW_ANCHOR,
      unitId: stay.unitId,
      actingUnitId: stay.unitId,
      admissionId: stay.id,
      expectedReturn: NOW_ANCHOR + 240,
      ...extra,
    }) as const;

  it.each([true, false])("stores the ward's answer (%s) and accepts the leave either way", (answer) => {
    const after = wardFlowReducer(seeded, leave({ psychiatristAuthorised: answer }));
    expect(after.rejections).toHaveLength(seeded.rejections.length);
    expect(after.leaveBeds.find((bed) => bed.admissionId === stay.id)?.psychiatristAuthorised).toBe(answer);
    const stored = JSON.parse(JSON.stringify(after));
    expect(isValidStoredWardFlowState(stored)).toBe(true);
    stored.leaveBeds.find((bed: { admissionId: string }) => bed.admissionId === stay.id).psychiatristAuthorised = "yes";
    expect(isValidStoredWardFlowState(stored)).toBe(false);
  });

  it("stores nothing when the question was not asked", () => {
    const after = wardFlowReducer(seeded, leave());
    const bed = after.leaveBeds.find((row) => row.admissionId === stay.id)!;
    expect(bed).toBeDefined();
    expect(Object.hasOwn(bed, "psychiatristAuthorised")).toBe(false);
  });

  it("is accepted by the shared command check as a yes or no only", () => {
    expect(validSharedCommand(leave({ psychiatristAuthorised: true }))).toBe(true);
    expect(validSharedCommand({ ...leave(), psychiatristAuthorised: "yes" })).toBe(false);
  });
});

describe("#177 an involuntary return's Form 4C and escort answers are saved on the return", () => {
  const seeded = seedWardFlowState();
  const admissionId = outOfAreaLedger(wardAdmissions, allUnits(), NOW_ANCHOR).entries[0]!.admission.id;
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
    transportLegalStatus: "involuntary" as const,
    estimatedAt: NOW_ANCHOR + 120,
  };
  const recordOf = (state: typeof seeded) => state.repatriations.find((row) => row.admissionId === admissionId);

  it("sends only answered questions, and only for an involuntary return", () => {
    expect(involuntaryReturnAnswers(BLANK_REPAT_DRAFT)).toEqual({});
    expect(involuntaryReturnAnswers({ ...BLANK_REPAT_DRAFT, transportLegalStatus: "involuntary" })).toEqual({});
    expect(
      involuntaryReturnAnswers({ ...BLANK_REPAT_DRAFT, transportLegalStatus: "voluntary", form4CReceived: true }),
    ).toEqual({});
    expect(
      involuntaryReturnAnswers({
        ...BLANK_REPAT_DRAFT,
        transportLegalStatus: "involuntary",
        form4CReceived: false,
        escortRequired: true,
      }),
    ).toEqual({ form4CReceived: false, escortRequired: true });
  });

  it("stores both answers, and the ward's agreement keeps them when it does not repeat them", () => {
    const sent = wardFlowReducer(seeded, { ...plan, form4CReceived: true, escortRequired: false });
    expect(sent.rejections).toHaveLength(seeded.rejections.length);
    expect(recordOf(sent)).toMatchObject({ form4CReceived: true, escortRequired: false });
    expect(isValidSharedWardFlowState(JSON.parse(JSON.stringify(sent)))).toBe(true);

    const agreed = wardFlowReducer(sent, { ...plan, receivingWardAgreed: true });
    expect(agreed.rejections).toHaveLength(sent.rejections.length);
    expect(recordOf(agreed)).toMatchObject({ receivingWardAgreed: true, form4CReceived: true, escortRequired: false });
    expect(isValidSharedWardFlowState(JSON.parse(JSON.stringify(agreed)))).toBe(true);
  });

  it("records a return with both left blank, storing neither", () => {
    const sent = wardFlowReducer(seeded, plan);
    expect(sent.rejections).toHaveLength(seeded.rejections.length);
    const record = recordOf(sent)!;
    expect(Object.hasOwn(record, "form4CReceived")).toBe(false);
    expect(Object.hasOwn(record, "escortRequired")).toBe(false);
  });

  it("is refused by the shared checks when an answer is not a yes or no", () => {
    expect(validSharedCommand({ ...plan, form4CReceived: true, escortRequired: false })).toBe(true);
    expect(validSharedCommand({ ...plan, form4CReceived: "yes" })).toBe(false);
    const sent = JSON.parse(JSON.stringify(wardFlowReducer(seeded, { ...plan, form4CReceived: true })));
    sent.repatriations[0].form4CReceived = "yes";
    expect(isValidSharedWardFlowState(sent)).toBe(false);
  });
});
