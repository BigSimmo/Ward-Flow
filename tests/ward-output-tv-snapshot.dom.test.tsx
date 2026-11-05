import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    replace: _replace,
    ...rest
  }: {
    children: ReactNode;
    href: string;
    replace?: boolean;
  }) => {
    void _replace;
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
}));

import "@/components/ward-management/ward-scenario-networks";
import { BedMeetingTvScreen } from "@/components/ward-management/bed-meeting/bed-meeting-tv";
import { edTvSheet } from "@/components/ward-management/bed-meeting/tv-derivations";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { createPatientResolver } from "@/components/ward-management/ward-patient-resolver";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { activateScenarioNetwork } from "@/components/ward-management/ward-scenarios";

function ChangeScenario() {
  const { dispatch, now, scenario } = useWardFlow();
  return (
    <button
      onClick={() => dispatch({ type: "SET_SCENARIO", role: "demo", now, scenario: "quiet-day" })}
      data-testid="change-scenario"
    >
      {scenario}
    </button>
  );
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  activateScenarioNetwork("standard");
});

it("keeps identities with the frozen records during a supported scenario replacement, then updates together", async () => {
  const state = seedWardFlowState();
  const edId = state.movements.find((movement) => movement.originEdId)?.originEdId;
  if (!edId) throw new Error("Synthetic ED fixture missing");
  const identify = createPatientResolver(state);
  const initial = edTvSheet({
    ...state,
    edId,
    now: NOW_ANCHOR,
    accessTargetMinutes: 1440,
    thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
    nameOf: (movement) => identify(movement).formalName,
  })!;
  const name = initial.people[0].name;
  expect(name).not.toBe("Name not recorded");
  const online = vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(true);
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ChangeScenario />
      <BedMeetingTvScreen ed={edId} board="flow" />
    </WardFlowProvider>,
  );
  expect(screen.getAllByText(name).length).toBeGreaterThan(0);
  online.mockReturnValue(false);
  act(() => {
    window.dispatchEvent(new Event("offline"));
  });
  fireEvent.click(screen.getByTestId("change-scenario"));
  await waitFor(() => expect(screen.getByTestId("change-scenario")).toHaveTextContent("quiet-day"));
  expect(screen.getAllByText(name).length).toBeGreaterThan(0);
  online.mockReturnValue(true);
  act(() => {
    window.dispatchEvent(new Event("online"));
  });
  await waitFor(() => expect(screen.queryAllByText(name)).toHaveLength(0));
});
