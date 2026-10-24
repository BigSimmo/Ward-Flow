import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { HandoverScopeControl } from "@/components/ward-management/handover/handover-page-parts";
import { activateScenarioNetwork } from "@/components/ward-management/ward-scenarios";
import type { Unit } from "@/components/ward-management/ward-model";

afterEach(() => {
  cleanup();
  activateScenarioNetwork("standard");
});

it("refreshes ED options on a mounted handover control when the network changes", () => {
  activateScenarioNetwork("standard");
  const units: Unit[] = [];
  const onChange = vi.fn();
  const { rerender } = render(<HandoverScopeControl value="network" onChange={onChange} units={units} />);
  const options = () => within(screen.getByRole("group", { name: "Emergency department" }));
  expect(options().getByRole("option", { name: "Royal Perth Hospital Emergency Department" })).toBeInTheDocument();
  activateScenarioNetwork("wa-synthetic");
  rerender(<HandoverScopeControl value="network" onChange={onChange} units={units} />);
  expect(options().getByRole("option", { name: "Fictional Quartz Emergency Department" })).toBeInTheDocument();
  expect(options().queryByRole("option", { name: "Royal Perth Hospital Emergency Department" })).toBeNull();
  activateScenarioNetwork("standard");
  rerender(<HandoverScopeControl value="network" onChange={onChange} units={units} />);
  expect(options().getByRole("option", { name: "Royal Perth Hospital Emergency Department" })).toBeInTheDocument();
  expect(options().queryByRole("option", { name: "Fictional Quartz Emergency Department" })).toBeNull();
  expect(onChange).not.toHaveBeenCalled();
});
