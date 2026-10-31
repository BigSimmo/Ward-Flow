// Walk-through 26 Oct 2026, synthetic seed only. WT-07: after the officer's Delivered, every screen
// reads one status and the pull clock stops. WT-06: Update arrival offers the CAD number the booking
// already logged.
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/ward-flow/coordinator",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

import { ArrivalTimeModal } from "@/components/ward-management/referrals/arrival-time-modal";
import { eligibilityWarning } from "@/components/ward-management/ward-derivations";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement, TransportJob, Unit } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { deliveredAwaitingWard, movementStatusLabel } from "@/components/ward-management/ward-stage-copy";

afterEach(() => cleanup());

function seedMovement(): Movement {
  const movement = seedWardFlowState().movements.find((candidate) => candidate.acceptedUnitId !== undefined);
  expect(movement).toBeDefined();
  return movement!;
}

const job = (extra: Partial<TransportJob>) => ({ cadNumber: "CAD-0001", ...extra }) as TransportJob;

describe("one status after Delivered (WT-07)", () => {
  it("names the delivered state until the ward confirms, and only then", () => {
    const moving = { ...seedMovement(), stage: "moving", closure: undefined } as Movement;
    const delivered = { ...moving, transport: job({ collectedAt: NOW_ANCHOR - 30, arrivedAt: NOW_ANCHOR - 5 }) };
    expect(deliveredAwaitingWard(delivered)).toBe(true);
    expect(movementStatusLabel(delivered)).toBe("Arrived at ward, awaiting ward confirmation");

    const enRoute = { ...moving, transport: job({ collectedAt: NOW_ANCHOR - 30 }) };
    expect(deliveredAwaitingWard(enRoute)).toBe(false);
    expect(movementStatusLabel(enRoute)).toBe("Moving");

    const arrived = { ...delivered, stage: "arrived" } as Movement;
    expect(deliveredAwaitingWard(arrived)).toBe(false);
    expect(movementStatusLabel(arrived)).toBe("Arrived");
  });

  it("keeps the free-bed count off a journey that already holds its bed", () => {
    const state = seedWardFlowState();
    const base = seedMovement();
    const unit = state.units.find((candidate) => candidate.id === base.acceptedUnitId)!;
    const full: Unit = { ...unit, allocatable: { ...unit.allocatable, value: 0 } };
    const waiting = { ...base, stage: "accepted_awaiting_bed", closure: undefined } as Movement;
    expect(eligibilityWarning(waiting, full, NOW_ANCHOR)?.text ?? "").toMatch(/allocatable/u);
    for (const stage of ["pulled", "handover_ready", "moving"] as const) {
      const holding = { ...waiting, stage } as Movement;
      expect(eligibilityWarning(holding, full, NOW_ANCHOR)?.text ?? "").not.toMatch(/allocatable/u);
    }
  });
});

describe("Update arrival offers the booked CAD number (WT-06)", () => {
  function renderModal(movement: Movement) {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ArrivalTimeModal isOpen onClose={vi.fn()} movement={movement} />
      </WardFlowProvider>,
    );
    return screen.getByRole("textbox", { name: /CAD/iu });
  }

  it("prefills the CAD number from the live booking and says where it came from", () => {
    const movement = { ...seedMovement(), stage: "pulled", arrivalDetails: undefined, transport: job({}) } as Movement;
    const input = renderModal(movement);
    expect(input).toHaveValue("CAD-0001");
    expect(input).toHaveAccessibleDescription("From the transport booking");
  });

  it("keeps a number already typed on the plan, and never carries a cancelled booking's", () => {
    const planned = {
      ...seedMovement(),
      stage: "pulled",
      arrivalDetails: { trackingNumber: "SJA-412", estimatedArrivalAt: NOW_ANCHOR + 60 },
      transport: job({}),
    } as Movement;
    expect(renderModal(planned)).toHaveValue("SJA-412");
    cleanup();
    const cancelled = {
      ...planned,
      arrivalDetails: undefined,
      transport: job({ cancelledAt: NOW_ANCHOR - 10 }),
    } as Movement;
    const input = renderModal(cancelled);
    expect(input).toHaveValue("");
    expect(input).not.toHaveAccessibleDescription();
  });
  it("offers the booked provider as the travel mode and the booked estimate as the ETA (form-friction 87, 88)", () => {
    const booked = {
      ...seedMovement(),
      stage: "pulled",
      arrivalDetails: undefined,
      transport: job({ provider: "RFDS", estimatedAt: NOW_ANCHOR + 45 }),
    } as Movement;
    renderModal(booked);
    const mode = screen.getByLabelText("How they are travelling");
    expect(mode).toHaveValue("rfds");
    expect(mode).toHaveAccessibleDescription("From the transport booking");
    expect(screen.getByText(/from the transport booking\)/u)).toBeInTheDocument();
    // D-91 (31 Oct 2026): the kit's time buttons write into the typed box; none is pressed or filled
    // before a person picks one (they were toggles with aria-pressed before).
    expect(screen.getByRole("button", { name: /^\+1h/u })).not.toHaveAttribute("aria-pressed");
    expect(screen.getByLabelText("Type the ETA")).toHaveValue("");
  });

  it("opens the ETA blank with no booking, fills the typed box from a time button, and takes a typed 1440", () => {
    const unbooked = {
      ...seedMovement(),
      stage: "pulled",
      arrivalDetails: undefined,
      transport: undefined,
    } as Movement;
    renderModal(unbooked);
    expect(screen.getByLabelText("How they are travelling")).toHaveValue("");
    expect(screen.getByText("Not set")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("How they are travelling"), { target: { value: "ambulance" } });
    fireEvent.click(screen.getByTestId("save-arrival-plan-button"));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter the estimated time of arrival.");
    // NOW_ANCHOR is 10:42 on the board clock, so +1h writes 11:42 into the typed box (D-91).
    fireEvent.click(screen.getByRole("button", { name: /^\+1h/u }));
    expect(screen.getByLabelText("Type the ETA")).toHaveValue("11:42");
    expect(screen.getByLabelText("Day of the typed ETA")).toHaveValue("today");
    fireEvent.change(screen.getByLabelText("Type the ETA"), { target: { value: "1440" } });
    expect(screen.getByLabelText("Type the ETA")).not.toHaveAttribute("aria-invalid");
    fireEvent.change(screen.getByLabelText("Type the ETA"), { target: { value: "144" } });
    expect(screen.getByLabelText("Type the ETA")).toHaveAttribute("aria-invalid", "true");
  });

  it("sets the day to Tomorrow when a time button lands past midnight (D-91)", () => {
    const unbooked = {
      ...seedMovement(),
      stage: "pulled",
      arrivalDetails: undefined,
      transport: undefined,
    } as Movement;
    render(
      <WardFlowProvider initialNow={23 * 60 + 50}>
        <ArrivalTimeModal isOpen onClose={vi.fn()} movement={unbooked} />
      </WardFlowProvider>,
    );
    expect(screen.getByLabelText("Day of the typed ETA")).toHaveValue("today");
    fireEvent.click(screen.getByRole("button", { name: /^\+15m/u }));
    expect(screen.getByLabelText("Type the ETA")).toHaveValue("00:05");
    expect(screen.getByLabelText("Day of the typed ETA")).toHaveValue("tomorrow");
    fireEvent.click(screen.getByRole("button", { name: /^Now/u }));
    expect(screen.getByLabelText("Type the ETA")).toHaveValue("23:50");
    expect(screen.getByLabelText("Day of the typed ETA")).toHaveValue("today");
  });
});
