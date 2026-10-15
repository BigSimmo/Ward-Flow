import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PreMatchCleaningNote } from "@/components/ward-management/coordinator/prematch-cleaning-note";
import { preMatchCleaningState } from "@/components/ward-management/ward-bed-availability";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { BedRelease, Movement } from "@/components/ward-management/ward-model";

const seeded = seedWardFlowState();
const unit = seeded.units[0]!;
const movement = seeded.movements[0]!;

const release: BedRelease = {
  id: "release-test",
  unitId: unit.id,
  admissionId: "admission-test",
  state: "discharged",
  expectedAt: 0,
  waitingOn: null,
  blocker: null,
  blockedBy: null,
  preparing: true,
  preparationNote: null,
  confirmedAt: 0,
  confirmedBy: "Test ward",
};
const preparing: BedRelease = release;
const ready: BedRelease = { ...release, preparing: false };
const paused: Movement = { ...movement, medicalDeterioration: { at: 10, by: "ed" } };
const resumed: Movement = { ...movement, medicalDeterioration: { at: 10, by: "ed", resumedAt: 20 } };

describe("Top 25 item 15: pre-match a bed while it is being made ready", () => {
  it("is silent when no bed on the ward is being made ready", () => {
    expect(preMatchCleaningState(movement, unit.id, [ready])).toBeUndefined();
  });

  it("reads the medical pause from the movement, and a resumed pause is no pause", () => {
    expect(preMatchCleaningState(paused, unit.id, [preparing])).toEqual({ bedsBeingMadeReady: 1, medicalPause: true });
    expect(preMatchCleaningState(resumed, unit.id, [preparing])?.medicalPause).toBe(false);
  });

  it("shows both labels on the shortlist note", () => {
    render(<PreMatchCleaningNote movement={paused} unit={unit} bedReleases={[preparing]} />);
    expect(screen.getByText("Bed being made ready")).toBeTruthy();
    expect(screen.getByText("Placement paused, medical")).toBeTruthy();
  });
});
