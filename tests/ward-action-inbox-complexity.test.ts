import { CircleAlert, Truck } from "lucide-react";
import { describe, expect, it } from "vitest";
import { buildActionInbox } from "@/components/ward-management/ward-derivations";
import { DECLINE_REASONS, type Movement } from "@/components/ward-management/ward-model";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { allUnits } from "@/components/ward-management/ward-sites";

const now = 600;
function pending(id: Movement["id"], overrides: Partial<Movement> = {}): Movement {
  return {
    ...structuredClone(wardMovements[0]),
    id,
    owner: `Owner ${id}`,
    stage: "pulled",
    closure: undefined,
    acceptedUnitId: undefined,
    legalStatus: "Involuntary inpatient",
    legalForm: { code: "4A", kind: "transport", dueAt: now - 1 },
    pullExpiresAt: now - 1,
    declines: ["a", "b", "c"].map((unitId) => ({ unitId, at: now - 2, reason: DECLINE_REASONS[0] })),
    transport: { id: `TR-${id}`, provider: "Patient transport service", escortRequired: true, acceptedAt: 540 },
    ...overrides,
  };
}

describe("action inbox category composition", () => {
  it("keeps category order, movement order, attribution and complete row presentation", () => {
    const units = allUnits();
    const unauthorised = units.find((unit) => unit.id === "sjgs-adult-open")!;
    expect(unauthorised.authorised).toBe(false);
    const movements = [
      pending("WF-second", { acceptedUnitId: unauthorised.id }),
      pending("WF-first", { acceptedUnitId: unauthorised.id }),
      pending("WF-fourth"),
      pending("WF-third"),
    ];
    const before = structuredClone(movements);
    const items = buildActionInbox(movements, now, units);
    const expected = [
      ...["WF-second", "WF-first"].map((id) => ({
        id: `destination-unlawful-${id}`,
        movementId: id,
        owner: `Owner ${id}`,
        kind: "fact",
        tone: "danger",
        icon: CircleAlert,
        title: "Accepted destination no longer suitable",
        detail: `${id} · ${unauthorised.name} is not set up for involuntary admissions (demo) for Involuntary inpatient`,
      })),
      ...["WF-second", "WF-first", "WF-fourth", "WF-third"].map((id) => ({
        id: `legal-${id}`,
        movementId: id,
        owner: `Owner ${id}`,
        kind: "fact",
        tone: "danger",
        icon: CircleAlert,
        title: "Legal due time passed",
        detail: `${id} · 1m overdue`,
      })),
      ...["WF-second", "WF-first", "WF-fourth", "WF-third"].map((id) => ({
        id: `bed-pull-${id}`,
        movementId: id,
        owner: `Owner ${id}`,
        kind: "fact",
        tone: "danger",
        icon: CircleAlert,
        title: "Bed pull expired",
        detail: `${id} · 1m overdue`,
      })),
      ...["WF-fourth", "WF-third"].map((id) => ({
        id: `declines-${id}`,
        movementId: id,
        owner: `Owner ${id}`,
        kind: "fact",
        tone: "danger",
        icon: CircleAlert,
        title: "Multiple destinations declined",
        detail: `${id} · 3 destinations have declined`,
      })),
      ...["WF-second", "WF-first", "WF-fourth", "WF-third"].map((id) => ({
        id: `transport-${id}`,
        movementId: id,
        owner: `Owner ${id}`,
        kind: "fact",
        tone: "warning",
        icon: Truck,
        title: "Transport awaiting departure",
        detail: `${id} · accepted 09:00`,
      })),
    ];
    expect(items).toEqual(expected);
    expect(movements).toEqual(before);
  });

  it.each([
    { label: "missing", dueAt: undefined },
    { label: "exactly now", dueAt: now },
    { label: "future", dueAt: now + 1 },
    { label: "nonfinite", dueAt: NaN },
  ])("does not invent a legal or expired-pull row for a $label deadline", ({ dueAt }) => {
    const movement = pending("WF-boundary", {
      legalForm: { code: "4A", kind: "transport", dueAt },
      pullExpiresAt: dueAt,
      declines: [],
      transport: undefined,
    });
    expect(buildActionInbox([movement], now, allUnits())).toEqual([]);
  });

  it.each([{ cancelledAt: now }, { enRouteAt: now }, { acceptedAt: undefined }])(
    "omits transport once it is cancelled, departed, or not accepted: %j",
    (patch) => {
      const movement = pending("WF-transport", { legalForm: undefined, pullExpiresAt: undefined, declines: [] });
      Object.assign(movement.transport!, patch);
      expect(buildActionInbox([movement], now, allUnits())).toEqual([]);
    },
  );
});
