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
import { daysInBed } from "@/components/ward-management/ward-admissions";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { deriveAfternoonDischarges } from "@/components/ward-management/ward-derivations";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";

/** Top 25 item 5: a stay due out within the discharge prep window asks for its barrier. */
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
    setWardFeatureFlagOnDevice("top25-discharge-prep", null);
  });
  window.localStorage.removeItem(WARD_FEATURE_FLAGS_STORAGE_KEY);
  window.history.replaceState(null, "", "/");
  flow = undefined;
});

describe("discharge prep window", () => {
  it("lists occupied stays due out from now to the clinical window, and no further", () => {
    const state = seedWardFlowStateAt(0);
    const stay = state.admissions.find((admission) => admission.state === "occupied")!;
    const window = CLINICAL_VALUES.dischargePrepWindow.value;
    const at = (expectedDischargeAt: number) => [{ ...stay, expectedDischargeAt }];
    expect(deriveAfternoonDischarges(at(NOW_ANCHOR + window), NOW_ANCHOR)).toHaveLength(1);
    expect(deriveAfternoonDischarges(at(NOW_ANCHOR + window + 1), NOW_ANCHOR)).toHaveLength(0);
    expect(deriveAfternoonDischarges(at(NOW_ANCHOR - 1), NOW_ANCHOR)).toHaveLength(0);
  });
});

function setUp(flagOn: boolean) {
  act(() => {
    setWardFeatureFlagOnDevice("top25-discharge-prep", flagOn);
  });
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Grab />
      <WardScreen unitId={seedWardFlowStateAt(0).units[0].id} />
    </WardFlowProvider>,
  );
  const unitId = seedWardFlowStateAt(0).units[0].id;
  const now = NOW_ANCHOR;
  const stay = flow!.admissions.find(
    (admission) =>
      admission.unitId === unitId &&
      admission.state === "occupied" &&
      (daysInBed(admission, now) ?? 0) >= CLINICAL_VALUES.longStayPrompt.value &&
      !flow!.leaveBeds.some((bed) => bed.admissionId === admission.id),
  )!;
  expect(stay).toBeDefined();
  act(() => {
    flow!.dispatch({
      type: "UPDATE_EXPECTED_DISCHARGE",
      role: "ward",
      now,
      admissionId: stay.id,
      actingUnitId: unitId,
      expectedDischargeAt: now + 120,
    });
  });
  return stay.id;
}

describe("discharge prep on the ward screen", () => {
  it("shows the stay due out with its barrier and sets the barrier from the bed drawer", () => {
    const admissionId = setUp(true);
    const dueButtons = () =>
      screen.queryAllByRole("button").filter((button) => /^Open bed Bed \d+ due out /.test(button.textContent ?? ""));
    const labels = dueButtons().map((button) => button.textContent);
    expect(labels.length).toBeGreaterThan(0);
    // Open each due bed until the one this test moved shows its barrier picker.
    let select: HTMLElement | null = null;
    for (const label of labels) {
      fireEvent.click(dueButtons().find((button) => button.textContent === label)!);
      fireEvent.click(screen.getByRole("tab", { name: "Plan to leave" }));
      select = screen.queryByTestId("ward-drawer-barrier-select");
      if (select) break;
      fireEvent.click(screen.getByRole("button", { name: "Close bed drawer" }));
    }
    expect(select).not.toBeNull();
    expect(screen.getByTestId("ward-drawer-discharge-prep")).toHaveTextContent(/Due out within 24 hours/);
    fireEvent.change(select!, { target: { value: "NDIS" } });
    expect(flow!.admissions.find((admission) => admission.id === admissionId)?.dischargeBarrier).toBe("NDIS");
  });

  it("adds nothing when the flag is off", () => {
    setUp(false);
    expect(screen.queryAllByText(/^Bed \d+ due out /)).toHaveLength(0);
    expect(screen.queryByTestId("ward-drawer-barrier-select")).toBeNull();
  });
});
