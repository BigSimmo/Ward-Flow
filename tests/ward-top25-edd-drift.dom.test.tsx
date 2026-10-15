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
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { eddMovedBadge } from "@/components/ward-management/ward/ward-beds-matrix";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";

/** Top 25 item 21: a discharge date the ward has moved several times carries a badge. */
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
    setWardFeatureFlagOnDevice("top25-edd-drift", null);
  });
  window.localStorage.removeItem(WARD_FEATURE_FLAGS_STORAGE_KEY);
  window.history.replaceState(null, "", "/");
  flow = undefined;
});

describe("eddMovedBadge", () => {
  it("names a date moved three or more times and nothing below that", () => {
    expect(eddMovedBadge(2)).toBeNull();
    expect(eddMovedBadge(3)).toBe("Date moved 3 times");
    expect(eddMovedBadge(null)).toBeNull();
  });
});

const UNIT_ID = seedWardFlowStateAt(0).units[0].id;

function setUp(flagOn: boolean) {
  act(() => {
    setWardFeatureFlagOnDevice("top25-edd-drift", flagOn);
  });
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Grab />
      <WardScreen unitId={UNIT_ID} />
    </WardFlowProvider>,
  );
  const stay = flow!.admissions.find(
    (admission) =>
      admission.unitId === UNIT_ID &&
      admission.state === "occupied" &&
      admission.expectedDischargeAt !== null &&
      !flow!.leaveBeds.some((bed) => bed.admissionId === admission.id),
  )!;
  const start = stay.expectedDischargeAt!;
  for (let move = 1; move <= 3 - stay.dischargeDateMoves; move += 1) {
    act(() => {
      flow!.dispatch({
        type: "UPDATE_EXPECTED_DISCHARGE",
        role: "ward",
        now: NOW_ANCHOR,
        admissionId: stay.id,
        actingUnitId: UNIT_ID,
        expectedDischargeAt: start + move * 1440,
      });
    });
  }
  return stay.id;
}

describe("the moved date badge on the ward screen", () => {
  it("shows on the bed tile and beside the date in the bed drawer", async () => {
    const admissionId = setUp(true);
    const card = (await screen.findAllByTestId(/^ward-bed-card-/)).find(
      (element) => element.getAttribute("data-admission-id") === admissionId,
    )!;
    expect(card).toHaveTextContent("Date moved 3 times");
    fireEvent.click(card);
    fireEvent.click(await screen.findByRole("tab", { name: "Plan to leave" }));
    expect(document.querySelector('[role="dialog"][aria-labelledby="drawer-bed-title"]')).toHaveTextContent(
      "Date moved 3 times",
    );
  });

  it("shows nothing when the flag is off", async () => {
    setUp(false);
    await screen.findAllByTestId(/^ward-bed-card-/);
    expect(screen.queryAllByTestId("ward-bed-edd-moved")).toHaveLength(0);
  });
});
