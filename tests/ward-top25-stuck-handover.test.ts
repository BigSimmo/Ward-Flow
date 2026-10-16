import { describe, expect, it } from "vitest";

import { taskItems } from "@/components/ward-management/ward-act-now-items";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { buildActionInbox } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";

const seeded = seedWardFlowState();
const now = seeded.auditCaptureStartedAt;
const target = seeded.configuration.transportBookedTargetMinutes;

function awaitingDeparture(acceptedMinutesAgo: number): Movement {
  const withTransport = seeded.movements.find((m) => m.transport !== undefined)!;
  return {
    ...withTransport,
    id: "WF-STUCK-TEST",
    transport: {
      ...withTransport.transport!,
      acceptedAt: now - acceptedMinutesAgo,
      enRouteAt: undefined,
      cancelledAt: undefined,
    },
  };
}

function row(movement: Movement, stuckHandoverMinutes?: number) {
  return buildActionInbox([movement], now, seeded.units, { stuckHandoverMinutes }).find(
    (item) => item.movementId === movement.id && item.id.startsWith("transport"),
  );
}

describe("Top 25 item 12: stuck handover on the transport awaiting departure row", () => {
  it("uses the transport booked target, not a separate stuck handover value", () => {
    expect(target).toBe(CLINICAL_VALUES.transportBookedTarget.value);
    expect("handoverStuck" in CLINICAL_VALUES).toBe(false);
  });

  it("names the handover stuck for the sending team once the target passes", () => {
    const stuck = row(awaitingDeparture(target + 30), target)!;
    expect(stuck.title).toBe("Handover waiting too long");
    expect(stuck.owner).toBe("Sending team");
    expect(stuck.tone).toBe("warning");
  });

  it("leaves the row as before under the target or with the flag off", () => {
    const early = row(awaitingDeparture(target - 1), target)!;
    expect(early.title).toBe("Transport awaiting departure");
    const off = row(awaitingDeparture(target + 30))!;
    const on = row(awaitingDeparture(target + 30), target)!;
    expect(off.title).toBe("Transport awaiting departure");
    expect(off.id).toBe(on.id);
  });

  it("threads through the shared task list", () => {
    const movement = awaitingDeparture(target + 30);
    const items = taskItems({ ...seeded, movements: [movement], stuckHandoverMinutes: target }, now);
    expect(items.some((item) => item.title === "Handover waiting too long")).toBe(true);
  });
});
