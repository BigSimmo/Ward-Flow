import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import {
  WARD_FEATURE_FLAGS_STORAGE_KEY,
  setWardFeatureFlagOnDevice,
} from "@/components/ward-management/shell/ward-feature-flag-store";
import { stalePreparingReleases } from "@/components/ward-management/ward-bed-availability";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";

/** Top 25 item 4: a bed left being made ready asks the ward to confirm it, and never opens itself. */
let flow: ReturnType<typeof useWardFlow> | undefined;
function Grab() {
  const value = useWardFlow();
  useEffect(() => {
    flow = value;
  });
  return null;
}

afterEach(() => {
  cleanup();
  act(() => {
    setWardFeatureFlagOnDevice("top25-cleaning-reminder", null);
  });
  window.localStorage.removeItem(WARD_FEATURE_FLAGS_STORAGE_KEY);
  window.history.replaceState(null, "", "/");
  flow = undefined;
});

const STALE = CLINICAL_VALUES.preparingBedStale.value;
const seed = seedWardFlowStateAt(0);
const release = seed.bedReleases.find((candidate) => candidate.state === "discharged")!;

describe("stale preparing beds", () => {
  it("lists a bed being made ready only from the clinical threshold", () => {
    const preparing = { ...release, preparing: true, confirmedAt: NOW_ANCHOR };
    expect(stalePreparingReleases(release.unitId, [preparing], NOW_ANCHOR + STALE - 1)).toHaveLength(0);
    expect(stalePreparingReleases(release.unitId, [preparing], NOW_ANCHOR + STALE)).toHaveLength(1);
    expect(stalePreparingReleases(release.unitId, [{ ...preparing, preparing: false }], NOW_ANCHOR + STALE)).toEqual(
      [],
    );
  });
});

function setUp(flagOn: boolean) {
  act(() => {
    setWardFeatureFlagOnDevice("top25-cleaning-reminder", flagOn);
  });
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Grab />
      <WardScreen unitId={release.unitId} />
    </WardFlowProvider>,
  );
  act(() => {
    flow!.dispatch({
      type: "SET_BED_PREPARATION",
      role: "ward",
      now: NOW_ANCHOR,
      releaseId: release.id,
      actingUnitId: release.unitId,
      preparing: true,
    });
  });
  act(() => {
    flow!.dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: NOW_ANCHOR, minutes: STALE + 5 });
  });
}

const reminderButtons = () =>
  screen
    .queryAllByRole("button")
    .filter((button) => /^Check bed Bed \d+ still being made ready/.test(button.textContent ?? ""));

describe("cleaning reminder on the ward screen", () => {
  it("asks the ward to confirm the bed and opens it only on Ready", () => {
    setUp(true);
    const buttons = reminderButtons();
    expect(buttons.length).toBeGreaterThan(0);
    fireEvent.click(buttons[0]);
    expect(screen.getByTestId("ward-drawer-cleaning-reminder")).toHaveTextContent(/If the bed is ready, tap Ready/);
    const stillPreparing = () => flow!.bedReleases.filter((candidate) => candidate.preparing).length;
    const before = stillPreparing();
    fireEvent.click(screen.getByRole("button", { name: "Ready" }));
    expect(stillPreparing()).toBe(before - 1);
  });

  it("adds nothing when the flag is off", () => {
    setUp(false);
    expect(reminderButtons()).toHaveLength(0);
  });
});
