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
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Qodo review, 13 Oct 2026: a pulled bed with every gate clear shows its next step on desktop. Synthetic data. */
const noop = () => {};

describe("patient status card next step on desktop", () => {
  it("renders Mark handover ready as the card's one primary when no gate holds an action", () => {
    const base = seedWardFlowState().movements[0]!;
    const movement: Movement = {
      ...base,
      stage: "pulled",
      pullExpiresAt: NOW_ANCHOR + 60,
      medicalClearance: { cleared: true, at: NOW_ANCHOR - 5 } as Movement["medicalClearance"],
      transportNeed: { needed: false } as Movement["transportNeed"],
    };
    const onHandoverReady = vi.fn();
    const context: PatientStatusContext = {
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
      onHandoverReady,
    };
    const status = buildPatientStatus("held", context);
    expect(status.verdict).toBe("Ready to move");
    expect(status.next).toBeDefined();
    render(<PatientStatusCard mode="held" context={context} />);
    const button = screen.getByRole("button", { name: "Mark handover ready" });
    fireEvent.click(button);
    expect(onHandoverReady).toHaveBeenCalledOnce();
  });
});
