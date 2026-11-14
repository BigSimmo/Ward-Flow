import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BED_FINDER_GENDER_REVIEW, WardBedFinder } from "@/components/ward-management/tools/ward-bed-finder";
import { ToolFindBed } from "@/components/ward-management/tools/ward-tool-find-bed";
import { NO_INTERVAL_ERROR, WardObservationControl } from "@/components/ward-management/ward/ward-observation-control";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { observationAt, type Observation } from "@/components/ward-management/ward-observation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { pickObservationInterval, pickObservationLevel } from "./helpers/ward-choice-chips";

// D-187 (Josh, 13 Nov 2026). Item 19 (Q44): choosing Intermittent leaves the interval blank until
// someone picks 15 or 30 minutes, and it cannot be recorded without one; a recorded interval still
// pre-fills. Item 14 (Q36): the bed finder's Ward for offers genders beyond Female and Male, which
// show the coordinator-review message and filter no ward. Synthetic data only.

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/capacity",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const NOW = 2 * 24 * 60 + 9 * 60; // Day 2, 09:00.

function renderControl(observation: Observation) {
  const onSave = vi.fn<(next: Observation) => void>();
  render(<WardObservationControl observation={observation} now={NOW} onSave={onSave} />);
  fireEvent.click(screen.getByTestId("ward-observation-change"));
  return onSave;
}

const intervalRadios = () =>
  within(screen.getByRole("radiogroup", { name: "Check every" })).getAllByRole("radio") as HTMLElement[];

describe("D-187 item 19 (Q44): the Intermittent interval starts blank", () => {
  it("leaves both intervals unpicked and refuses to record until one is chosen", () => {
    const onSave = renderControl(observationAt("general", null));
    pickObservationLevel("intermittent");
    expect(screen.getByTestId("ward-observation-interval")).toHaveAttribute("data-value", "");
    for (const radio of intervalRadios()) expect(radio).toHaveAttribute("aria-checked", "false");

    fireEvent.click(screen.getByTestId("ward-observation-save"));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByTestId("ward-observation-error")).toHaveTextContent(NO_INTERVAL_ERROR);
    expect(NO_INTERVAL_ERROR).toBe("Choose how often to check: 15 or 30 minutes.");

    pickObservationInterval(15);
    expect(screen.queryByTestId("ward-observation-error")).toBeNull();
    fireEvent.click(screen.getByTestId("ward-observation-save"));
    expect(onSave).toHaveBeenCalledWith({ level: "intermittent", intervalMinutes: 15, reviewAt: null }, undefined);
  });

  it("records 30 when 30 is picked: both signed values are still offered", () => {
    const onSave = renderControl(observationAt("general", null));
    pickObservationLevel("intermittent");
    expect(intervalRadios().map((radio) => radio.textContent)).toEqual(["15 minutes", "30 minutes"]);
    pickObservationInterval(30);
    fireEvent.click(screen.getByTestId("ward-observation-save"));
    expect(onSave).toHaveBeenCalledWith({ level: "intermittent", intervalMinutes: 30, reviewAt: null }, undefined);
  });

  it("pre-fills a recorded interval, which someone chose", () => {
    const onSave = renderControl({ level: "intermittent", intervalMinutes: 15, reviewAt: null });
    expect(screen.getByTestId("ward-observation-interval")).toHaveAttribute("data-value", "15");
    fireEvent.click(screen.getByTestId("ward-observation-save"));
    expect(onSave).toHaveBeenCalledWith({ level: "intermittent", intervalMinutes: 15, reviewAt: null }, undefined);
  });

  it("needs no interval for any other level", () => {
    const onSave = renderControl(observationAt("general", null));
    pickObservationLevel("within_sight");
    fireEvent.click(screen.getByTestId("ward-observation-save"));
    expect(onSave).toHaveBeenCalledWith({ level: "within_sight", intervalMinutes: null, reviewAt: null }, undefined);
  });
});

describe("D-187 item 14 (Q36): Ward for in the bed finder", () => {
  it("Find a bed (Tools): Non-binary shows the coordinator-review message and filters no ward", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToolFindBed onNavigate={vi.fn()} />
      </WardFlowProvider>,
    );
    const tool = screen.getByTestId("ward-tools-bed-finder");
    fireEvent.click(
      within(within(tool).getByRole("radiogroup", { name: "Legal status" })).getByRole("radio", { name: "Voluntary" }),
    );
    const wardFor = within(tool).getByRole("group", { name: "Ward for" });
    expect(
      within(wardFor)
        .getAllByRole("button")
        .map((chip) => chip.textContent),
    ).toEqual(["Any", "Female", "Male", "Non-binary", "Different term"]);
    const total = () => within(tool).getByRole("status").textContent;
    const anyTotal = total();
    expect(screen.queryByTestId("ward-bed-finder-gender-review")).toBeNull();

    fireEvent.click(within(wardFor).getByRole("button", { name: "Non-binary" }));
    expect(screen.getByTestId("ward-bed-finder-gender-review")).toHaveTextContent(BED_FINDER_GENDER_REVIEW);
    expect(screen.getByTestId("ward-bed-finder-summary")).toHaveTextContent(
      "Adult · Any bed · Non-binary, coordinator review · Voluntary",
    );
    expect(total()).toBe(anyTotal);

    fireEvent.click(within(wardFor).getByRole("button", { name: "Female" }));
    expect(screen.queryByTestId("ward-bed-finder-gender-review")).toBeNull();
    expect(screen.getByTestId("ward-bed-finder-summary")).toHaveTextContent(
      "Adult · Any bed · Female ward · Voluntary",
    );
  });

  it("the sheet's bed finder offers the same choices and message", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardBedFinder onNavigate={vi.fn()} />
      </WardFlowProvider>,
    );
    const finder = screen.getByTestId("ward-tools-bed-finder");
    const wardFor = within(finder).getByRole("group", { name: "Ward for" });
    expect(
      within(wardFor)
        .getAllByRole("button")
        .map((chip) => chip.textContent),
    ).toEqual(["Any", "Female", "Male", "Non-binary", "Different term"]);
    fireEvent.click(within(wardFor).getByRole("button", { name: "Different term" }));
    expect(screen.getByTestId("ward-bed-finder-gender-review")).toHaveTextContent(BED_FINDER_GENDER_REVIEW);
  });
});
