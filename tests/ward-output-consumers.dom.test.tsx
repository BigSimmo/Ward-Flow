import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DowntimePack } from "@/components/ward-management/reports/downtime-pack";

const view = vi.hoisted(() => ({ phone: false, pack: null as DowntimePack | null }));
vi.mock("@/components/wf", async (original) => ({
  ...(await original<typeof import("@/components/wf")>()),
  useIsPhone: () => view.phone,
}));
vi.mock("@/components/ward-management/ward-flow-provider", () => ({
  useWardFlowClock: () => 600,
  useWardFlowSelect: () => ({ dayZero: new Date("2026-11-04T00:00:00+08:00"), worldGeneration: 1 }),
  useOptionalWardFlowSelect: () => null,
}));
vi.mock("@/components/ward-management/ward-role-gate", () => ({ useRouteRole: () => "coordinator" }));
vi.mock("@/components/ward-management/use-online-status", () => ({ useOnlineStatus: () => true }));
vi.mock("@/components/ward-management/reports/downtime-pack-context", () => ({
  useDowntimePackAccess: () => ({ owner: null, ready: true }),
}));
vi.mock("@/components/ward-management/reports/use-take-downtime-pack", () => ({
  useTakeDowntimePack: () => () => undefined,
}));
vi.mock("@/components/ward-management/reports/downtime-pack", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/reports/downtime-pack")>()),
  lastDowntimePack: () => view.pack,
  subscribeDowntimePack: () => () => undefined,
}));
vi.mock("@/components/ward-management/shell/ward-prototype-footer", () => ({ WardPrototypeFooter: () => null }));

import { DowntimePackScreen } from "@/components/ward-management/reports/downtime-pack-screen";

function pack(): DowntimePack {
  return {
    generatedAt: 600,
    wards: [],
    totals: {
      beds: 0,
      ready: 0,
      pulled: 0,
      occupied: 0,
      closed: 0,
      beingMadeReady: 0,
      pendingPreparation: 0,
      onLeave: 0,
    },
    edQueue: [],
    pendingMoves: [
      {
        movementId: "synthetic-move",
        person: "Synthetic move",
        from: "Sending ward",
        to: "Receiving ward",
        stage: "Bed pulled",
        plannedAt: null,
        transportEta: null,
        observation: "General, hourly",
      },
    ],
    legalForms: [
      {
        movementId: "synthetic-form",
        person: "Synthetic form",
        form: "Form 1A",
        legalStatus: "Voluntary",
        madeAt: null,
        receivedAt: null,
        typedExpiryAt: null,
      },
    ],
    leftEd: 0,
  };
}
afterEach(() => {
  cleanup();
  view.phone = false;
  view.pack = null;
});

describe("output audit rendered wording", () => {
  it("labels bed totals as the wards actually captured in the snapshot", () => {
    const counts = { beds: 4, ready: 1, pulled: 0, occupied: 3, closed: 0, beingMadeReady: 0, onLeave: 0 };
    view.pack = {
      ...pack(),
      wards: [
        {
          unitId: "synthetic-ward",
          name: "Synthetic ward",
          service: "Adult",
          beds: 4,
          counts,
          pendingPreparation: 0,
        },
      ],
      totals: { ...counts, pendingPreparation: 0 },
    };
    render(<DowntimePackScreen />);
    expect(screen.getByRole("rowheader", { name: "Wards in this snapshot" })).toBeTruthy();
    expect(screen.queryByText("All wards")).toBeNull();
  });

  it("prints no bed figures for a desk that sees no ward (R-FIGS-8, D-214)", () => {
    view.pack = pack();
    render(<DowntimePackScreen />);
    expect(screen.queryByRole("rowheader", { name: "Wards in this snapshot" })).toBeNull();
  });

  it.each([
    [/^Moves/u, "Synthetic move"],
    [/^Forms/u, "Synthetic form"],
  ] as const)("keeps a missing time unknown on phone %s rows and in their facts", (label, name) => {
    view.phone = true;
    view.pack = pack();
    render(<DowntimePackScreen />);
    fireEvent.click(screen.getByRole("radio", { name: label }));
    const row = screen.getByRole("button", { name: new RegExp(name) });
    expect(row.textContent).toContain("Not recorded");
    expect(row.textContent).not.toContain("None");
    fireEvent.click(row);
    expect(within(screen.getByRole("dialog", { name })).getAllByText("Not recorded").length).toBeGreaterThan(0);
  });
});
