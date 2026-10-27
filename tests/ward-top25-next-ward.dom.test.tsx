import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NextWardAfterRefusal } from "@/components/ward-management/coordinator/next-ward-after-refusal";
import { deriveNextWardsAfterRefusal } from "@/components/ward-management/ward-derivations";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";

const seeded = seedWardFlowState();
const now = seeded.auditCaptureStartedAt as Instant;

function declinedMovement(): { movement: Movement; declinedUnitId: string } {
  const base = seeded.movements.find(
    (m) => m.referredUnitIds.length === 0 && m.acceptedUnitId === undefined && m.declines.length === 0,
  )!;
  // Decline any ward, then read the list from a different ward's point of view.
  const first = { unit: seeded.units[0]! };
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
    const waitlisted = {
      ...movement,
      declines: [{ unitId: declinedUnitId, at: now, reason: "no_suitable_bed" as const }],
    };
    expect(deriveNextWardsAfterRefusal(waitlisted, seeded.units, now)).toBeUndefined();
  });

  // Audit 1, Josh 20 Oct (CS-03, NB-3): every eligible unasked ward, fixed order, no cap.
  it("lists every eligible unasked ward in health service then name order, with no cap", () => {
    const { movement } = declinedMovement();
    const next = deriveNextWardsAfterRefusal(movement, seeded.units, now)!;
    expect(next.candidates.length, "the seed gave three or fewer, so the no-cap check proves nothing").toBeGreaterThan(
      3,
    );
    const keys = next.candidates.map((c) => [siteByCode(c.unit.siteCode)?.service ?? "", c.unit.name] as const);
    const sorted = [...keys].sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
    expect(keys).toEqual(sorted);
  });

  it("adds a listed ward to the referral selection, never referring by itself", () => {
    const { movement } = declinedMovement();
    const onChoose = vi.fn();
    render(
      <NextWardAfterRefusal
        movement={movement}
        units={seeded.units}
        now={now}
        chosenUnitIds={[]}
        onChoose={onChoose}
      />,
    );
    expect(screen.getByText(/Last refusal: .*acuity mix\./)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Wards not yet asked that pass every check" })).toBeTruthy();
    expect(screen.queryByText(/next wards to ask|best/iu)).toBeNull();
    const rows = screen.getAllByTestId("ward-next-ward-row");
    expect(rows.length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "Add to referral" })[0]!);
    expect(onChoose).toHaveBeenCalledTimes(1);
  });
});
