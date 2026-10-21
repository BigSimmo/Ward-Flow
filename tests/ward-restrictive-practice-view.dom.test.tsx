import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SeclusionScreen } from "@/components/ward-management/restrictive-practice/seclusion-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** D-72 on screen: record seclusion with a typed time, see it in use, end it, and log an incident. */
function clock(minutesAgo: number) {
  const minute = (((NOW_ANCHOR - minutesAgo) % 1440) + 1440) % 1440;
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

function renderScreen() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <SeclusionScreen />
    </WardFlowProvider>,
  );
}

/** The first ward in the picker with a patient on it, chosen so the start form has someone to name. */
function chooseWardWithPatients() {
  const picker = screen.getByTestId("seclusion-ward") as HTMLSelectElement;
  for (const option of Array.from(picker.options)) {
    fireEvent.change(picker, { target: { value: option.value } });
    if (within(screen.getByTestId("seclusion-start-patient")).getAllByRole("option").length > 1) return;
  }
  throw new Error("no ward in the seed has a patient on it");
}

describe("seclusion, restraint and incidents view", () => {
  it("says it is operational only and computes no legal limit", () => {
    renderScreen();
    expect(screen.getByTestId("seclusion-scope-note")).toHaveTextContent(
      /Operational view only.*nothing here works out an order length, a review or any legal limit/,
    );
    expect(screen.getByTestId("seclusion-in-use")).toHaveTextContent(
      "No seclusion or restraint is recorded as in use.",
    );
  });

  it("records a start at a typed time, shows it in use and in the room status, then records the end", () => {
    renderScreen();
    chooseWardWithPatients();
    const start = screen.getByTestId("seclusion-start");
    expect(start).toHaveAttribute("aria-disabled", "true");
    const patients = within(screen.getByTestId("seclusion-start-patient")).getAllByRole("option");
    fireEvent.change(screen.getByTestId("seclusion-start-patient"), {
      target: { value: patients[1]!.getAttribute("value") },
    });
    fireEvent.change(screen.getByTestId("seclusion-start-practice"), { target: { value: "seclusion" } });
    fireEvent.change(screen.getByTestId("seclusion-start-time"), { target: { value: "99:99" } });
    expect(start).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Type the time as HH:MM.")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("seclusion-start-time"), { target: { value: clock(20) } });
    expect(start).not.toHaveAttribute("aria-disabled");
    fireEvent.click(start);

    expect(within(screen.getByTestId("seclusion-in-use")).getByText(/^Seclusion ·/)).toBeInTheDocument();
    expect(screen.getByTestId("seclusion-room-status")).toHaveTextContent(`In use since ${clock(20)}`);

    const episode = screen.getByTestId("seclusion-episode");
    fireEvent.click(within(episode).getByTestId("seclusion-episode-end-open"));
    fireEvent.change(within(episode).getByTestId("seclusion-episode-end-time"), { target: { value: clock(5) } });
    fireEvent.click(within(episode).getByTestId("seclusion-episode-end"));
    expect(screen.queryByTestId("seclusion-episode")).not.toBeInTheDocument();
    expect(screen.getByTestId("seclusion-in-use")).toHaveTextContent(
      "No seclusion or restraint is recorded as in use.",
    );
  });

  it("records the room as out of service and an incident from the fixed list", () => {
    renderScreen();
    fireEvent.click(screen.getByTestId("seclusion-room-out-of-service"));
    expect(screen.getByTestId("seclusion-room-status")).toHaveTextContent(/^Out of service · recorded by/);
    fireEvent.change(screen.getByTestId("seclusion-incident-category"), { target: { value: "fall" } });
    fireEvent.change(screen.getByTestId("seclusion-incident-time"), { target: { value: clock(30) } });
    fireEvent.click(screen.getByTestId("seclusion-incident-record"));
    expect(within(screen.getByTestId("seclusion-incidents")).getByText("Fall")).toBeInTheDocument();
  });
});
