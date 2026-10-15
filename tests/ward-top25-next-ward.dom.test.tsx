import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NextWardAfterRefusal } from "@/components/ward-management/coordinator/next-ward-after-refusal";
import { deriveNextWardsAfterRefusal, deriveTopCompatibleWards } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";

const seeded = seedWardFlowState();
const now = seeded.auditCaptureStartedAt as Instant;

function declinedMovement(): { movement: Movement; declinedUnitId: string } {
  const base = seeded.movements.find(
    (m) => m.referredUnitIds.length === 0 && m.acceptedUnitId === undefined && m.declines.length === 0,
  )!;
  const first = deriveTopCompatibleWards(base, seeded.units, 3, now)[0]!;
  return {
    movement: { ...base, declines: [{ unitId: first.unit.id, at: now, reason: "acuity_mix" }] },
    declinedUnitId: first.unit.id,
  };
}

describe("Top 25 item 3: next ward after a refusal", () => {
  it("suggests only eligible wards that have not been asked", () => {
    const { movement, declinedUnitId } = declinedMovement();
    const next = deriveNextWardsAfterRefusal(movement, seeded.units, now)!;
    expect(next.latestDecline.unitId).toBe(declinedUnitId);
    expect(next.candidates.length).toBeGreaterThan(0);
    expect(next.candidates.every((c) => c.unit.id !== declinedUnitId && c.failingGates.length === 0)).toBe(true);
  });

  it("says nothing before a refusal or after an acceptance", () => {
    const { movement } = declinedMovement();
    expect(deriveNextWardsAfterRefusal({ ...movement, declines: [] }, seeded.units, now)).toBeUndefined();
    expect(deriveNextWardsAfterRefusal({ ...movement, acceptedUnitId: "x" }, seeded.units, now)).toBeUndefined();
  });

  it("does not treat a ward that waitlisted as a refusal", () => {
    const { movement, declinedUnitId } = declinedMovement();
    const waitlisted = { ...movement, declines: [{ unitId: declinedUnitId, at: now, reason: "no_bed" as const }] };
    expect(deriveNextWardsAfterRefusal(waitlisted, seeded.units, now)).toBeUndefined();
  });

  it("adds a suggested ward to the referral selection, never referring by itself", () => {
    const { movement } = declinedMovement();
    const onChoose = vi.fn();
    render(
      <NextWardAfterRefusal
        movement={movement}
        units={seeded.units}
        now={now}
        chosenUnitIds={[]}
        slotsLeft={3}
        onChoose={onChoose}
      />,
    );
    expect(screen.getByText(/Last refusal: .*acuity mix\./)).toBeTruthy();
    const rows = screen.getAllByTestId("ward-next-ward-row");
    expect(rows.length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "Add to referral" })[0]!);
    expect(onChoose).toHaveBeenCalledTimes(1);
  });
});
