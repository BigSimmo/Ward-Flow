import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { WardBoard } from "@/components/ward-management/board/ward-board";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const FUTURE_DAY = (Math.floor(NOW_ANCHOR / MINUTES_PER_DAY) + 3) * MINUTES_PER_DAY;
const RECORDED_DEPARTURE = FUTURE_DAY + 14 * 60 + 7;

function FutureDepartureHarness() {
  const { admissions, dispatch, leaveBeds } = useWardFlow();
  const admission = admissions.find((row) => row.state === "occupied")!;
  return (
    <>
      <button
        onClick={() =>
          dispatch({
            type: "UPDATE_EXPECTED_DISCHARGE",
            role: "coordinator",
            now: NOW_ANCHOR,
            admissionId: admission.id,
            expectedDischargeAt: RECORDED_DEPARTURE,
          })
        }
      >
        Set future departure fixture
      </button>
      <output
        data-testid="departure-probe"
        data-admission={admission.id}
        data-date={admission.expectedDischargeAt}
        data-state={admission.state}
        data-leave-count={leaveBeds.length}
      />
      <WardBoard unitId={admission.unitId} />
    </>
  );
}

function openFutureDepartureEditor() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <FutureDepartureHarness />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Set future departure fixture" }));
  const probe = screen.getByTestId("departure-probe");
  expect(probe).toHaveAttribute("data-date", String(RECORDED_DEPARTURE));
  fireEvent.click(document.getElementById(`ward-board-tile-${probe.getAttribute("data-admission")}`)!);
  fireEvent.click(screen.getByRole("button", { name: "Move the date" }));
  expect(screen.getByLabelText("Expected departure time")).toHaveAttribute("type", "time");
  expect(screen.getByLabelText("Expected departure time")).toHaveValue("14:07");
  expect(screen.getByRole("combobox", { name: "Departure day" })).toHaveValue("recorded");
  return probe;
}

describe("expected departure clock input keeps its separately recorded day", () => {
  it("round-trips the future day and HH:mm unchanged", () => {
    const probe = openFutureDepartureEditor();
    const leaveCount = probe.getAttribute("data-leave-count");
    fireEvent.click(screen.getByRole("button", { name: "Save departure date" }));
    expect(probe).toHaveAttribute("data-date", String(RECORDED_DEPARTURE));
    expect(probe).toHaveAttribute("data-state", "occupied");
    expect(probe).toHaveAttribute("data-leave-count", leaveCount);
  });

  it("cancels clock edits, then saves a new HH:mm on the original future day", () => {
    const probe = openFutureDepartureEditor();
    const leaveCount = probe.getAttribute("data-leave-count");
    fireEvent.change(screen.getByLabelText("Expected departure time"), { target: { value: "09:13" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel date change" }));
    expect(probe).toHaveAttribute("data-date", String(RECORDED_DEPARTURE));
    fireEvent.click(screen.getByRole("button", { name: "Move the date" }));
    expect(screen.getByLabelText("Expected departure time")).toHaveValue("14:07");
    fireEvent.change(screen.getByLabelText("Expected departure time"), { target: { value: "09:13" } });
    fireEvent.click(screen.getByRole("button", { name: "Save departure date" }));
    expect(probe).toHaveAttribute("data-date", String(FUTURE_DAY + 9 * 60 + 13));
    expect(probe).toHaveAttribute("data-state", "occupied");
    expect(probe).toHaveAttribute("data-leave-count", leaveCount);
  });
});
