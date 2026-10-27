import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { WardClosurePanel } from "@/components/ward-management/capacity/ward-closure-panel";
import type { WardRecordActor } from "@/components/ward-management/ward-discharge-records";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider } from "@/components/wf";

/** Smart features idea 7 on screen: close a ward with a listed reason, then reopen it. */
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const UNIT = seedWardFlowState().units[0]!;
const UNIT_ID = UNIT.id;

function Panel({ actor }: { actor: WardRecordActor }) {
  const { units, now } = useWardFlow();
  const unit = units.find((candidate) => candidate.id === UNIT_ID)!;
  return <WardClosurePanel unit={unit} now={now} actor={actor} />;
}

function renderPanel(actor: WardRecordActor) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Panel actor={actor} />
    </WardFlowProvider>,
  );
}

describe("ward closure panel", () => {
  it("needs a reason, closes the ward, shows why, and reopens on a tap", () => {
    renderPanel({ role: "coordinator" });
    const closeButton = screen.getByTestId("ward-closure-close");
    expect(closeButton).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(closeButton);
    expect(screen.getByRole("heading", { name: `Close ${UNIT.name} to admissions` })).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("ward-closure-reason"), { target: { value: "staffing" } });
    fireEvent.change(screen.getByTestId("ward-closure-reopen-after"), { target: { value: "8" } });
    fireEvent.click(screen.getByTestId("ward-closure-close"));
    // DR-07: the close asks once before it is recorded.
    expect(screen.getByRole("dialog", { name: `Close ${UNIT.name} to admissions?` })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: `Close ${UNIT.name}` }));

    expect(screen.getByRole("heading", { name: `${UNIT.name} closed to admissions` })).toBeInTheDocument();
    expect(screen.getByText(/^Staffing · since/)).toBeInTheDocument();
    expect(screen.getByText(/^Expected to reopen/)).toBeInTheDocument();
    // Audit 1: the closed panel shows no internal journey numbers.
    expect(screen.getByTestId("ward-closure-panel").textContent ?? "").not.toMatch(/\b(WF|RF|PT|AD|WR)-\d/);

    fireEvent.click(screen.getByTestId("ward-closure-reopen"));
    expect(screen.getByRole("heading", { name: `Close ${UNIT.name} to admissions` })).toBeInTheDocument();
  });

  it("names the reason in the confirm and says the outcome on a toast (NB-01)", async () => {
    render(
      <ToastProvider>
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <Panel actor={{ role: "coordinator" }} />
        </WardFlowProvider>
      </ToastProvider>,
    );
    fireEvent.change(screen.getByTestId("ward-closure-reason"), { target: { value: "staffing" } });
    fireEvent.click(screen.getByTestId("ward-closure-close"));
    expect(screen.getByRole("dialog", { name: `Close ${UNIT.name} to admissions?` })).toHaveTextContent(
      "Reason: Staffing.",
    );
    fireEvent.click(screen.getByRole("button", { name: `Close ${UNIT.name}` }));
    expect(await screen.findByText(`${UNIT.name} closed to admissions: Staffing.`)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("ward-closure-reopen"));
    expect(await screen.findByText(`${UNIT.name} reopened to admissions.`)).toBeInTheDocument();
  });

  it("asks before closing, and Cancel leaves the ward open (DR-07)", () => {
    renderPanel({ role: "coordinator" });
    fireEvent.change(screen.getByTestId("ward-closure-reason"), { target: { value: "staffing" } });
    fireEvent.click(screen.getByTestId("ward-closure-close"));
    expect(screen.getByRole("dialog", { name: `Close ${UNIT.name} to admissions?` })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: `Close ${UNIT.name} to admissions` })).toBeInTheDocument();
  });

  it("lets a ward close only itself", () => {
    renderPanel({ role: "ward", actingUnitId: "some-other-ward" });
    fireEvent.change(screen.getByTestId("ward-closure-reason"), { target: { value: "staffing" } });
    const closeButton = screen.getByTestId("ward-closure-close");
    expect(closeButton).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(closeButton);
    expect(screen.getByRole("heading", { name: `Close ${UNIT.name} to admissions` })).toBeInTheDocument();
  });
});
