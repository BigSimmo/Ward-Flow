import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  usePathname: () => "/ward-flow/people/WF-030",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { movementById } from "@/components/ward-management/ward-movements";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR, unitById } from "@/components/ward-management/ward-sites";

/**
 * Patient page design fixes (Josh, 19 Oct 2026). WF-030 is a seeded Tier 3 movement at Handover
 * ready with no recorded stage changes: the case Josh's screenshots showed reading inconsistently.
 */
function renderAt(movementId = "WF-030") {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <PatientNowScreen movementId={movementId} />
    </WardFlowProvider>,
  );
}

describe("patient page design fixes", () => {
  const movement = movementById("WF-030")!;
  const ward = unitById(movement.acceptedUnitId!)!.name;

  it("says a Handover ready patient is ready to go, not already on the way", () => {
    expect(movement.stage).toBe("handover_ready");
    expect(movement.stageChanges).toEqual([]);
    renderAt();
    const root = screen.getByTestId("ward-person-screen");
    expect(root).toHaveTextContent(`Ready to go to ${ward}`);
    expect(root).not.toHaveTextContent(`On the way to ${ward}`);
  });

  it("names an earlier stage without a recorded change honestly and closes its card on another tab", () => {
    renderAt();
    fireEvent.click(screen.getByTestId("ward-patient-stage-btn-accepted_awaiting_bed"));
    const card = screen.getByTestId("ward-patient-stage-panel-accepted_awaiting_bed");
    expect(card).toHaveTextContent("No time recorded");
    expect(card).not.toHaveTextContent("No transition recorded");
    // Still never marked complete: no transition is inferred.
    const steps = screen.getByRole("list", { name: /The seven stages/ });
    expect(steps.querySelector('[data-s="recorded"]')).toBeNull();
    expect(within(steps).getByTestId("ward-patient-stage-btn-moving")).toHaveTextContent("Not reached yet");

    fireEvent.click(screen.getByRole("tab", { name: /History/u }));
    expect(screen.queryByTestId("ward-patient-stage-panel-accepted_awaiting_bed")).not.toBeInTheDocument();
  });

  it("shows the overdue limit rather than the same wait twice", () => {
    // WF-005: Tier 2, opened 5h 30m before the anchor, past the 4h limit.
    renderAt("WF-005");
    const root = screen.getByTestId("ward-person-screen");
    expect(root).toHaveTextContent("Overdue · 4h limit");
    expect(root).toHaveTextContent("5h 30msince opened");
    expect(root).not.toHaveTextContent("Overdue wait ·");
  });

  it("History reads stage times as not recorded and the example label as plain words", () => {
    renderAt();
    fireEvent.click(screen.getByRole("tab", { name: /History/u }));
    const pane = document.getElementById("pnpane-history")!;
    expect(pane).toHaveTextContent("Stage times not recorded");
    expect(pane).not.toHaveTextContent("0 stage changes");
    const label = within(pane).getByTestId("pn-history-example-label");
    expect(label.className).toBe("");
  });
});
