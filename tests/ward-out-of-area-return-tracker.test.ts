import { describe, expect, it } from "vitest";

import { returnStepsDone } from "@/components/ward-management/out-of-area/out-of-area-return-tracker";
import { BLANK_REPAT_DRAFT, currentReturnMovement } from "@/components/ward-management/out-of-area/out-of-area-model";
import type { RepatriationRecord } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";

/** OA1 return tracker (3 Nov 2026). Synthetic shapes only. */
const agreed = { receivingWardAgreed: true } as RepatriationRecord;
const transport = { provider: "Patient transport service" } as unknown as Movement["transport"];

describe("returnStepsDone", () => {
  it("counts nothing before a receiving hospital is chosen", () => {
    expect(returnStepsDone(BLANK_REPAT_DRAFT, undefined, undefined)).toBe(0);
  });

  it("does not call the return complete when the recorded movement is still waiting for its bed", () => {
    // Codex review on #1371: recording the return creates a movement at placement requested.
    expect(returnStepsDone(BLANK_REPAT_DRAFT, agreed, { transport: undefined, closure: undefined })).toBe(2);
  });

  it("marks transport booked from the movement's own booking, then placed home only once it arrives", () => {
    expect(returnStepsDone(BLANK_REPAT_DRAFT, agreed, { transport, closure: undefined })).toBe(3);
    const arrived = { outcome: "arrived" } as Movement["closure"];
    expect(returnStepsDone(BLANK_REPAT_DRAFT, agreed, { transport, closure: arrived })).toBe(4);
    const stopped = { outcome: "did_not_proceed" } as Movement["closure"];
    expect(returnStepsDone(BLANK_REPAT_DRAFT, agreed, { transport, closure: stopped })).toBe(2);
  });
});

it("does not count a cancelled or stopped transport as booked", () => {
  for (const state of [{ cancelledAt: 10 }, { stoppedAt: 10 }]) {
    expect(
      returnStepsDone(BLANK_REPAT_DRAFT, agreed, { transport: { ...transport!, ...state }, closure: undefined }),
    ).toBe(2);
  }
});

it("prefers the newest open return over older closed or open movements", () => {
  const make = (id: string, openedAt: number, closure?: Movement["closure"]) =>
    ({ id, openedAt, sourceAdmissionId: "synthetic-admission", closure }) as Movement;
  const stopped = make("stopped", 1, { outcome: "did_not_proceed" } as Movement["closure"]);
  const old = make("old-open", 2);
  const current = make("current-open", 3);
  expect(currentReturnMovement([stopped, old, current], "synthetic-admission")).toBe(current);
  expect(currentReturnMovement([current, stopped, old], "synthetic-admission")).toBe(current);
  expect(currentReturnMovement([stopped, old], "other-admission")).toBeUndefined();
  const arrived = make("arrived", 4, { outcome: "arrived" } as Movement["closure"]);
  expect(currentReturnMovement([stopped, arrived], "synthetic-admission")).toBe(arrived);
});
