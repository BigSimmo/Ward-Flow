import { describe, expect, it } from "vitest";
import { activityUndo } from "@/components/ward-management/coordinator/activity-undo";
import type { StepUndo } from "@/components/ward-management/ward-undo";
import type { WardCommandMetadata } from "@/components/ward-management/ward-command-metadata";

const record: StepUndo = {
  kind: "step",
  undoType: "UNDO_BED_STEP",
  subjectId: "bed:synthetic-ward:4",
  seq: 7,
  at: 20,
  role: "ward",
  unitId: "synthetic-ward",
  action: "SET_BED_CLOSED",
  changes: [],
};
const step: WardCommandMetadata["undoStep"] = { undoType: record.undoType, subjectId: record.subjectId, seq: 7 };
const build = (
  ownStep = step,
  records = [record],
  now = 21,
  role: "ward" | "ed" = "ward",
  placeId = "synthetic-ward",
) => activityUndo(ownStep, records, { movements: [], admissions: [], referrals: [] }, role, placeId, now);

describe("Activity's own-command Undo", () => {
  it("names exactly this accepted command's current record, including its sequence", () => {
    expect(build()).toEqual({
      event: {
        type: "UNDO_BED_STEP",
        role: "ward",
        now: 21,
        recordSeq: 7,
        actingUnitId: "synthetic-ward",
        unitId: "synthetic-ward",
        bedNumber: 4,
      },
    });
    expect(build({ ...step!, seq: 6 }).reason).toMatch(/later|available/i);
    expect(build(step, []).reason).toMatch(/available/i);
  });
  it("refuses an absent attribution, expired window and wrong working role or ward", () => {
    expect(
      activityUndo(undefined, [record], { movements: [], admissions: [], referrals: [] }, "ward", "synthetic-ward", 21)
        .reason,
    ).toMatch(/Undo record/i);
    expect(build(step, [record], 26).reason).toMatch(/5 minutes/);
    expect(build(step, [record], 21, "ed").reason).toMatch(/Ward, bed manager or coordinator only/);
    expect(build(step, [record], 21, "ward", "another-ward").reason).toMatch(/ward/i);
  });
});
