import { describe, expect, it } from "vitest";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import {
  buildActionInbox,
  eligibleCandidatesAmong,
  escalationBoard,
  INFORMATIONAL_GATES,
  isOpen,
} from "../src/components/ward-management/ward-derivations";
import type { Movement, Unit } from "../src/components/ward-management/ward-model";
import { causeOf } from "../src/components/ward-management/delays/delays-derivations";
import { INBOX_CATEGORIES } from "../src/components/ward-management/ward-inbox-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
// Clinical owner ruling, 14 Oct 2026: no eligible bed keeps the patient on the waitlist with a
// visible flag and notifies the bed coordinator. Never dropped, never silently released.
describe("no eligible bed (clinical owner ruling 14 Oct 2026)", () => {
  const state = seedWardFlowState();
  const open = state.movements.filter(isOpen);
  const nowhere = escalationBoard(open, state.units, NOW_ANCHOR).nowhereEligible.filter(
    (movement) =>
      movement.acceptedUnitId === undefined &&
      (movement.stage === "placement_requested" || movement.stage === "destination_review"),
  );

  it("the seed holds at least one open, unplaced movement with nowhere eligible", () => {
    expect(nowhere.length).toBeGreaterThan(0);
  });

  // The board lists a movement as having "nowhere eligible" when no ward's verdict is eligible. A ward
  // that failed ONLY because its capacity figure is stale, or ONLY because it declined before, can
  // still be referred to, so those movements are on the board but are not "no eligible bed" for the
  // coordinator (WF-009 in the seed has a ward that failed only a prior decline).
  const stillReferable = (movement: Movement) =>
    eligibleCandidatesAmong(movement, state.units, NOW_ANCHOR, state.units.length).some((candidate) =>
      candidate.verdict.gates.every(
        (gate) => gate.pass || gate.gate === "capacity_freshness" || INFORMATIONAL_GATES.includes(gate.gate),
      ),
    );
  const noBedRowFor = (movement: Movement) =>
    buildActionInbox(open, NOW_ANCHOR, state.units).find(
      (item) => item.id === `${INBOX_CATEGORIES.no_eligible_bed.idPrefix}${movement.id}`,
    );

  it("notifies the bed coordinator with an act-now inbox row for each one with no ward left to refer to", () => {
    const rowed = nowhere.filter((movement) => !stillReferable(movement));
    expect(rowed.length).toBeGreaterThan(0);
    for (const movement of rowed) {
      const row = noBedRowFor(movement);
      expect(row, movement.id).toBeDefined();
      expect(row?.owner).toBe("Bed coordinator");
      expect(row?.tone).toBe("danger");
    }
  });

  it("raises no row while a ward can still be referred to", () => {
    const referable = nowhere.filter(stillReferable);
    expect(referable.map((movement) => movement.id)).toContain("WF-009");
    for (const movement of referable) expect(noBedRowFor(movement), movement.id).toBeUndefined();
  });

  it("keeps each one open and flags no_eligible_bed only when no ward remains referable", () => {
    // The board also includes stale/prior-decline-only cases; those remain open under another cause.
    const genuineNoBed = nowhere.filter((movement) => !stillReferable(movement));
    const referable = nowhere.filter(stillReferable);
    expect(genuineNoBed.length, "no genuine no-bed movement exercised the flag").toBeGreaterThan(0);
    expect(referable.length, "no still-referable movement exercised the exclusion").toBeGreaterThan(0);
    expect(genuineNoBed.length + referable.length).toBe(nowhere.length);

    for (const movement of nowhere) expect(isOpen(movement), movement.id).toBe(true);
    for (const movement of genuineNoBed) {
      expect(causeOf(movement, state.units, NOW_ANCHOR, DEFAULT_DUE_SOON_THRESHOLDS), movement.id).toBe(
        "no_eligible_bed",
      );
    }
    for (const movement of referable) {
      expect(causeOf(movement, state.units, NOW_ANCHOR, DEFAULT_DUE_SOON_THRESHOLDS), movement.id).not.toBe(
        "no_eligible_bed",
      );
    }
  });

  // The three cases below hold one waiting movement and ONE ward that passes every gate, then spoil
  // exactly one thing about that ward, so the only variable is the reason it fails.
  describe("with a single candidate ward", () => {
    const waiting = open.find((movement) => movement.id === "WF-302")!;
    const candidate = eligibleCandidatesAmong(waiting, state.units, NOW_ANCHOR, state.units.length).find(
      (entry) => entry.verdict.eligible,
    )!;
    const rowIds = (movement: Movement, units: Unit[], now = NOW_ANCHOR) =>
      buildActionInbox([movement], now, units)
        .filter((item) => item.id.startsWith(INBOX_CATEGORIES.no_eligible_bed.idPrefix))
        .map((item) => item.id);
    const rowId = `${INBOX_CATEGORIES.no_eligible_bed.idPrefix}${waiting.id}`;

    it("the fixture ward is eligible, so no row is raised", () => {
      expect(rowIds(waiting, [candidate.unit])).toEqual([]);
    });

    it("raises the row when the only ward really has no bed", () => {
      const full = { ...candidate.unit, allocatable: { ...candidate.unit.allocatable, value: 0 } };
      expect(rowIds(waiting, [full])).toEqual([rowId]);
    });

    it("does not raise the row for a ward refused only because its capacity figure is stale", () => {
      const stale = {
        ...candidate.unit,
        allocatable: {
          ...candidate.unit.allocatable,
          confirmedAt: NOW_ANCHOR - candidate.unit.allocatable.staleAfterMinutes - 1,
        },
      };
      const verdict = eligibleCandidatesAmong(waiting, [stale], NOW_ANCHOR, 1)[0]!.verdict;
      expect(verdict.gates.filter((gate) => !gate.pass).map((gate) => gate.gate)).toEqual(["capacity_freshness"]);
      expect(rowIds(waiting, [stale])).toEqual([]);
    });

    it("does not raise the row for a ward that failed only because it declined this movement before", () => {
      const declined: Movement = {
        ...waiting,
        declines: [
          { unitId: candidate.unit.id, at: NOW_ANCHOR - 60, reason: "no_bed" } as Movement["declines"][number],
        ],
      };
      const verdict = eligibleCandidatesAmong(declined, [candidate.unit], NOW_ANCHOR, 1)[0]!.verdict;
      expect(verdict.gates.filter((gate) => !gate.pass).map((gate) => gate.gate)).toEqual(["prior_decline"]);
      expect(rowIds(declined, [candidate.unit])).toEqual([]);
    });
  });
});
