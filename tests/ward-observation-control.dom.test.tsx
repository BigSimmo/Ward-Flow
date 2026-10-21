import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { observationAt, type Observation } from "@/components/ward-management/ward-observation";
import { WardObservationControl } from "@/components/ward-management/ward/ward-observation-control";

const NOW = 2 * 24 * 60 + 9 * 60; // Day 2, 09:00.

function renderControl(observation: Observation) {
  const onSave = vi.fn<(next: Observation) => void>();
  const view = render(<WardObservationControl observation={observation} now={NOW} onSave={onSave} />);
  return { onSave, view };
}

describe("changing the observation level in the bed drawer", () => {
  it("keeps the recorded review time when only the level changes", () => {
    const reviewAt = 2 * 24 * 60 + 14 * 60 + 30;
    const { onSave } = renderControl(observationAt("general", reviewAt));
    fireEvent.click(screen.getByTestId("ward-observation-change"));
    expect(screen.getByTestId("ward-observation-review-time")).toHaveValue("14:30");
    fireEvent.change(screen.getByTestId("ward-observation-level"), { target: { value: "within_sight" } });
    fireEvent.click(screen.getByTestId("ward-observation-save"));
    expect(onSave).toHaveBeenCalledWith({ level: "within_sight", intervalMinutes: null, reviewAt });
  });

  it("keeps a review time outside today or tomorrow unless the box is edited", () => {
    const reviewAt = 5 * 24 * 60 + 8 * 60;
    const { onSave } = renderControl(observationAt("general", reviewAt));
    fireEvent.click(screen.getByTestId("ward-observation-change"));
    expect(screen.getByTestId("ward-observation-review-time")).toHaveValue("");
    fireEvent.click(screen.getByTestId("ward-observation-save"));
    expect(onSave).toHaveBeenCalledWith({ level: "general", intervalMinutes: null, reviewAt });
  });

  it("clears the review time only when the box is emptied", () => {
    const { onSave } = renderControl(observationAt("general", NOW + 60));
    fireEvent.click(screen.getByTestId("ward-observation-change"));
    fireEvent.change(screen.getByTestId("ward-observation-review-time"), { target: { value: "" } });
    fireEvent.click(screen.getByTestId("ward-observation-save"));
    expect(onSave).toHaveBeenCalledWith({ level: "general", intervalMinutes: null, reviewAt: null });
  });

  it("reopens on the recorded interval, not one left from a cancelled edit", () => {
    const { onSave } = renderControl({ level: "intermittent", intervalMinutes: 30, reviewAt: null });
    fireEvent.click(screen.getByTestId("ward-observation-change"));
    expect(screen.getByTestId("ward-observation-interval")).toHaveValue("30");
    fireEvent.change(screen.getByTestId("ward-observation-interval"), { target: { value: "15" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByTestId("ward-observation-change"));
    expect(screen.getByTestId("ward-observation-interval")).toHaveValue("30");
    fireEvent.click(screen.getByTestId("ward-observation-save"));
    expect(onSave).toHaveBeenCalledWith({ level: "intermittent", intervalMinutes: 30, reviewAt: null });
  });
});
