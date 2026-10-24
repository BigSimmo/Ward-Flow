import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { WardClosurePanel } from "@/components/ward-management/capacity/ward-closure-panel";
import { MovementLoopChecks } from "@/components/ward-management/loop-checks/loop-checks-lazy";
import type { WardRecordActor } from "@/components/ward-management/ward-discharge-records";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Closing the loop, package D (24 Oct 2026) on screen, from the synthetic demo seed. */
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/ward-management/shell/ward-access", () => ({
  useWardRecordActors: () => [{ role: "coordinator" }],
}));

function Ward({ unitId, actor }: { unitId: string; actor: WardRecordActor }) {
  const { units, now } = useWardFlow();
  const unit = units.find((candidate) => candidate.id === unitId)!;
  return <WardClosurePanel unit={unit} now={now} actor={actor} />;
}

function Move({ movementId }: { movementId: string }) {
  const { movements, units, now } = useWardFlow();
  const movement = movements.find((candidate) => candidate.id === movementId)!;
  return <MovementLoopChecks movement={movement} units={units} now={now} />;
}

const wrap = (children: ReactNode) => render(<WardFlowProvider initialNow={NOW_ANCHOR}>{children}</WardFlowProvider>);

describe("closing the loop on screen", () => {
  it("lists what points at a closed ward, marks one dealt with, and shows the overdue review", async () => {
    wrap(<Ward unitId="gry-older-adult" actor={{ role: "coordinator" }} />);
    const reviews = await screen.findByTestId("ward-restriction-review-admissions_closure");
    expect(within(reviews).getByText("Review overdue")).toBeInTheDocument();
    const list = await screen.findByTestId("ward-closure-transition");
    expect(list.textContent ?? "").not.toMatch(/\b(WF|RF|PT|AD|WR)-\d/);
    expect(list.textContent ?? "").not.toMatch(/suggest|recommend|best/i);
    fireEvent.click(screen.getByTestId("ward-closure-item-done-0"));
    expect(
      within(screen.getByTestId("ward-closure-item-0")).getByText(/Dealt with · Flow coordinator/),
    ).toBeInTheDocument();
    // The ward stays closed: nothing reopens or moves.
    expect(screen.getByTestId("ward-closure-reopen")).toBeInTheDocument();
  });

  it("refuses another ward's marks with a stated reason", async () => {
    wrap(<Ward unitId="gry-older-adult" actor={{ role: "ward", actingUnitId: "rph-adult-secure" }} />);
    const done = await screen.findByTestId("ward-closure-item-done-0");
    expect(done).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(done);
    expect(screen.queryByText(/Dealt with ·/)).not.toBeInTheDocument();
  });

  it("sets a review on an intake limit", async () => {
    wrap(<Ward unitId="gry-adult-secure" actor={{ role: "coordinator" }} />);
    fireEvent.click(await screen.findByTestId("ward-restriction-review-open-intake_constraints"));
    fireEvent.change(screen.getByTestId("ward-restriction-reviewer-intake_constraints"), {
      target: { value: "consultant_psychiatrist" },
    });
    fireEvent.change(screen.getByTestId("ward-restriction-review-after-intake_constraints"), {
      target: { value: "24" },
    });
    fireEvent.click(screen.getByTestId("ward-restriction-review-save-intake_constraints"));
    expect(screen.getByText(/Review by Consultant psychiatrist due/)).toBeInTheDocument();
  });

  it("shows a cancelled move's checklist and records a mark", async () => {
    wrap(<Move movementId="WF-008" />);
    const list = await screen.findByTestId("cancelled-move-checklist");
    expect(within(list).getByText("2 to check")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("cancelled-move-mark-escort-not_applicable"));
    expect(within(list).getByText("1 to check")).toBeInTheDocument();
  });

  it("shows an acceptance with conditions apart from a plain one, and marks one met", async () => {
    wrap(<Move movementId="WF-003" />);
    expect(await screen.findByText("Accepted with conditions (1 outstanding)")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("acceptance-condition-met-after_medical_clearance"));
    expect(screen.getByText("Accepted with conditions (all met)")).toBeInTheDocument();
  });
});
