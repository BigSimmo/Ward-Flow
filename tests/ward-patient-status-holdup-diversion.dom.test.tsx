import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import {
  PatientStatusCard,
  buildPatientStatus,
  type PatientStatusContext,
} from "@/components/ward-management/patients/patient-status-card";
import { etaAndNext } from "@/components/ward-management/patients/patient-now-screen-helpers";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// R-STRUCT-25, R-STRUCT-26, R-MOVE-8 on synthetic seed data.
const noop = () => {};
function ctx(movement: Movement, overrides: Partial<PatientStatusContext> = {}): PatientStatusContext {
  return {
    movement,
    hasBedHold: true,
    now: NOW_ANCHOR,
    dayZero: new Date(0),
    onOpenPlacement: noop,
    onClearance: noop,
    onBookTransport: noop,
    onArrivalTime: noop,
    onRecordReturn: noop,
    onMarkAbsent: noop,
    onAbsenceStep: noop,
    onRecordCto: noop,
    onEndCto: noop,
    ...overrides,
  };
}
const base = seedWardFlowState().movements[0]!;

describe("recorded hold-up (R-STRUCT-25)", () => {
  it("says the recorded hold-up, with Change, instead of 'Bed is the blocker'", () => {
    const movement = { ...base, stage: "destination_review" as const, blocker: "Confirming destination options" };
    const status = buildPatientStatus("find", ctx(movement));
    expect(status.meta).toBe("Confirming destination options");
    expect(status.metaAction?.label).toBe("Change");
  });
  it("keeps 'Bed is the blocker' when nothing is recorded", () => {
    const movement = { ...base, stage: "destination_review" as const, blocker: "" };
    expect(buildPatientStatus("find", ctx(movement)).meta).toBe("Bed is the blocker");
  });
});

describe("diversion headline (R-STRUCT-26)", () => {
  const diverted: Movement = {
    ...base,
    stage: "moving",
    transport: {
      ...(base.transport ?? { provider: "Synthetic crew" }),
      collectedAt: NOW_ANCHOR - 20,
      diversion: {
        at: NOW_ANCHOR - 5,
        by: "officer",
        place: "Back at the sending emergency department",
        reason: "Another reason — needs follow-up",
      },
    } as Movement["transport"],
  };
  it("heads the page 'Diverted back to ...', arrival 'Not coming', no Due row or Update arrival", () => {
    const status = buildPatientStatus("transit", ctx(diverted, { acceptedUnitName: "Test ward" }));
    expect(status.verdict).toMatch(/^Diverted back to /);
    expect(status.cells.find((c) => c.key === "arrival")?.value).toBe("Not coming");
    expect(JSON.stringify(status.cells)).not.toMatch(/Update arrival|Due /);
  });
  it("gives the one filled button as Review the bed", () => {
    const onReviewBed = vi.fn();
    render(
      <PatientStatusCard mode="transit" context={ctx(diverted, { acceptedUnitName: "Test ward", onReviewBed })} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Review the bed" }));
    expect(onReviewBed).toHaveBeenCalledTimes(1);
  });
  it("header figure names the next step, not a count", () => {
    expect(etaAndNext("transit", ctx(diverted))).toMatchObject({ value: "review the bed", label: "next step" });
  });
});

describe("header ETA and next step (R-MOVE-8)", () => {
  it("shows the next step only before an ETA exists, then ETA with next", () => {
    const moving = { ...base, stage: "handover_ready" as const, arrivalDetails: undefined, transport: undefined };
    expect(etaAndNext("transit", ctx(moving)).label).toBe("next step");
    const withEta = {
      ...moving,
      arrivalDetails: { estimatedArrivalAt: NOW_ANCHOR + 30 },
    } as unknown as Movement;
    const fig = etaAndNext("transit", ctx(withEta));
    expect(fig.label).toBe("ward ETA · next: collection");
  });
});
