import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { observationAt, type Observation } from "@/components/ward-management/ward-observation";
import { WardObservationControl } from "@/components/ward-management/ward/ward-observation-control";
import { pickObservationInterval, pickObservationLevel } from "./helpers/ward-choice-chips";

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
    pickObservationLevel("within_sight");
    fireEvent.click(screen.getByTestId("ward-observation-save"));
    expect(onSave).toHaveBeenCalledWith({ level: "within_sight", intervalMinutes: null, reviewAt }, undefined);
  });

  it("keeps a review time outside today or tomorrow unless the box is edited", () => {
    const reviewAt = 5 * 24 * 60 + 8 * 60;
    const { onSave } = renderControl(observationAt("general", reviewAt));
    fireEvent.click(screen.getByTestId("ward-observation-change"));
    expect(screen.getByTestId("ward-observation-review-time")).toHaveValue("");
    fireEvent.click(screen.getByTestId("ward-observation-save"));
    expect(onSave).toHaveBeenCalledWith({ level: "general", intervalMinutes: null, reviewAt }, undefined);
  });

  it("clears the review time only when the box is emptied", () => {
    const { onSave } = renderControl(observationAt("general", NOW + 60));
    fireEvent.click(screen.getByTestId("ward-observation-change"));
    fireEvent.change(screen.getByTestId("ward-observation-review-time"), { target: { value: "" } });
    fireEvent.click(screen.getByTestId("ward-observation-save"));
    expect(onSave).toHaveBeenCalledWith({ level: "general", intervalMinutes: null, reviewAt: null }, undefined);
  });

  it("reopens on the recorded interval, not one left from a cancelled edit", () => {
    const { onSave } = renderControl({ level: "intermittent", intervalMinutes: 30, reviewAt: null });
    fireEvent.click(screen.getByTestId("ward-observation-change"));
    expect(screen.getByTestId("ward-observation-interval")).toHaveAttribute("data-value", "30");
    pickObservationInterval(15);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByTestId("ward-observation-change"));
    expect(screen.getByTestId("ward-observation-interval")).toHaveAttribute("data-value", "30");
    fireEvent.click(screen.getByTestId("ward-observation-save"));
    expect(onSave).toHaveBeenCalledWith({ level: "intermittent", intervalMinutes: 30, reviewAt: null }, undefined);
  });
  it("shows a historical conflict and permits a deliberate confirmation of the current level", () => {
    const observation = observationAt("two_staff");
    const onSave = vi.fn();
    const view = render(
      <WardObservationControl
        observation={observation}
        now={NOW}
        editingToken="current"
        conflictingObservation={observationAt("arms_length")}
        onSave={onSave}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Observation records disagree");
    fireEvent.click(screen.getByTestId("ward-observation-change"));
    fireEvent.click(screen.getByTestId("ward-observation-save"));
    expect(onSave).toHaveBeenCalledWith(observation, "current");
    view.rerender(<WardObservationControl observation={observation} now={NOW} onSave={onSave} />);
    expect(screen.queryByTestId("ward-observation-conflict")).toBeNull();
  });
});
