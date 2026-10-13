import { describe, expect, it } from "vitest";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { buildActionInbox, escalationBoard, isOpen } from "../src/components/ward-management/ward-derivations";
import { causeOf } from "../src/components/ward-management/delays/delays-derivations";
import { INBOX_CATEGORIES } from "../src/components/ward-management/ward-inbox-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

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

  it("notifies the bed coordinator with an act-now inbox row for each one", () => {
    const inbox = buildActionInbox(open, NOW_ANCHOR, state.units);
    for (const movement of nowhere) {
      const row = inbox.find((item) => item.id === `${INBOX_CATEGORIES.no_eligible_bed.idPrefix}${movement.id}`);
      expect(row, movement.id).toBeDefined();
      expect(row?.owner).toBe("Bed coordinator");
      expect(row?.tone).toBe("danger");
    }
  });

  it("keeps each one open and visibly flagged as no_eligible_bed", () => {
    for (const movement of nowhere) {
      expect(isOpen(movement)).toBe(true);
      expect(causeOf(movement, state.units, NOW_ANCHOR)).toBe("no_eligible_bed");
    }
  });

  it("does not notify for a ward refused only because its capacity figure is stale", () => {
    const later = NOW_ANCHOR + 400;
    const staleRows = buildActionInbox(open, later, state.units).filter((item) =>
      item.id.startsWith(INBOX_CATEGORIES.no_eligible_bed.idPrefix),
    );
    expect(staleRows.length).toBeLessThanOrEqual(nowhere.length);
  });
});
