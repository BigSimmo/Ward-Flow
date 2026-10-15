import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { bedMeetingSheet } from "@/components/ward-management/capacity/bed-meeting-derivations";
import { BedMeetingTvScreen } from "@/components/ward-management/bed-meeting/bed-meeting-tv";
import { WardDemoReset } from "@/components/ward-management/demo-reset/ward-demo-reset";
import { isPhoneDesktopOnlyPath } from "@/components/ward-management/shell/ward-phone-desktop-only";
import {
  WARD_FEATURE_FLAGS_STORAGE_KEY,
  setWardFeatureFlagOnDevice,
} from "@/components/ward-management/shell/ward-feature-flag-store";
import { railEntries } from "@/components/ward-management/shell/ward-rail-entries";
import { createPatientResolver } from "@/components/ward-management/ward-patient-resolver";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WARD_BED_MEETING_TV_HREF } from "@/components/ward-management/ward-nav";
import { activateScenarioNetwork } from "@/components/ward-management/ward-scenarios";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(() => {
  act(() => {
    setWardFeatureFlagOnDevice("bed-meeting-tv", null);
    setWardFeatureFlagOnDevice("demo-reset", null);
  });
  window.localStorage.removeItem(WARD_FEATURE_FLAGS_STORAGE_KEY);
  activateScenarioNetwork("standard");
});

function renderTv() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <BedMeetingTvScreen />
    </WardFlowProvider>,
  );
}

describe("the bed meeting TV view", () => {
  it("shows the same figures as the printed bed meeting sheet", () => {
    renderTv();
    const state = seedWardFlowStateAt(0);
    const sheet = bedMeetingSheet({
      units: state.units,
      movements: state.movements,
      bedReleases: state.bedReleases,
      admissions: state.admissions,
      leaveBeds: state.leaveBeds,
      now: NOW_ANCHOR,
      service: null,
      nameOf: () => "",
    });
    const figure = (testId: string) => within(screen.getByTestId(testId)).getAllByRole("definition")[0].textContent;
    const shown = (value: number) => (value === 0 ? "None" : String(value));
    expect(figure("bed-meeting-tv-ready")).toBe(shown(sheet.capacity.ready));
    expect(figure("bed-meeting-tv-locked")).toBe(shown(sheet.capacity.lockedReady));
    expect(figure("bed-meeting-tv-ed")).toBe(shown(sheet.ed.waiting));
    expect(figure("bed-meeting-tv-discharges")).toBe(shown(sheet.discharges.confirmed + sheet.discharges.expected));
    expect(figure("bed-meeting-tv-delays")).toBe(shown(sheet.delays.total));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Bed meeting · All services");
  });

  it("is read only and shows initials, never full names, on the shared screen", () => {
    renderTv();
    const tv = screen.getByTestId("bed-meeting-tv");
    // Only leaving the view or going full screen; nothing that changes a record.
    const buttons = within(tv).queryAllByRole("button");
    expect(buttons.every((button) => button.dataset.testid === "bed-meeting-tv-fullscreen")).toBe(true);
    expect(tv.querySelector("input, select, textarea, form")).toBeNull();

    const state = seedWardFlowStateAt(0);
    const resolve = createPatientResolver(state);
    const waits = within(screen.getByTestId("bed-meeting-tv-waits-panel")).getAllByRole("listitem");
    expect(waits.length).toBeGreaterThan(0);
    for (const movement of state.movements) {
      const { displayName } = resolve({ movementId: movement.id });
      if (displayName.length > 3) expect(tv.textContent).not.toContain(displayName);
    }
  });

  it("says it is switched off, and leaves the menu, when its flag is off", () => {
    act(() => setWardFeatureFlagOnDevice("bed-meeting-tv", false));
    renderTv();
    expect(screen.queryByTestId("bed-meeting-tv")).toBeNull();
    expect(screen.getByTestId("bed-meeting-tv-off")).toHaveTextContent("Turn it on in Settings");
    const off = railEntries((flag) => flag === undefined).map((entry) => entry.href);
    expect(off).not.toContain(WARD_BED_MEETING_TV_HREF);
    expect(railEntries().map((entry) => entry.href)).toContain(WARD_BED_MEETING_TV_HREF);
  });

  it("is a desktop page: a phone gets the larger screen card", () => {
    expect(isPhoneDesktopOnlyPath(WARD_BED_MEETING_TV_HREF)).toBe(true);
  });
});

function ScenarioProbe() {
  const { scenario } = useWardFlow();
  return <output data-testid="scenario">{scenario}</output>;
}

describe("the one tap demo reset", () => {
  it("loads each scenario through the shared reducer in one tap", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardDemoReset />
        <ScenarioProbe />
      </WardFlowProvider>,
    );
    for (const [testId, scenario] of [
      ["ward-demo-reset-winter-surge", "winter-surge"],
      ["ward-demo-reset-ed-crisis", "ed-crisis"],
      ["ward-demo-reset-quiet-day", "quiet-day"],
    ] as const) {
      fireEvent.click(screen.getByTestId(testId));
      expect(screen.getByTestId("scenario")).toHaveTextContent(scenario);
      expect(screen.getByTestId(testId)).toHaveAttribute("aria-pressed", "true");
    }
  });

  it("is absent while its flag is off", () => {
    act(() => setWardFeatureFlagOnDevice("demo-reset", false));
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardDemoReset />
      </WardFlowProvider>,
    );
    expect(screen.queryByTestId("ward-demo-reset")).toBeNull();
  });
});
