import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { daysInBed } from "@/components/ward-management/ward-admissions";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { deriveAfternoonDischarges } from "@/components/ward-management/ward-derivations";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { chooseChip } from "./helpers/ward-choice-chips";

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

function setUp() {
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

// WH2 (3 Nov 2026): This shift's To do list sits in a sheet opened from its summary on Ward home.
const openThisShift = () => {
  if (!screen.queryByTestId("ward-shift-sheet")) fireEvent.click(screen.getByTestId("ward-hero-act-now"));
};

describe("discharge prep on the ward screen", () => {
  it("shows the stay due out with its barrier and sets the barrier from the bed drawer", () => {
    const admissionId = setUp();
    const dueButtons = () => {
      openThisShift();
      return screen
        .queryAllByRole("button")
        .filter((button) => /^Open bed Bed \d+ discharge due /.test(button.textContent ?? ""));
    };
    const labels = dueButtons().map((button) => button.textContent);
    expect(labels.length).toBeGreaterThan(0);
    // Open each due bed until the one this test moved shows its barrier picker.
    let select: HTMLElement | null = null;
    for (const label of labels) {
      fireEvent.click(dueButtons().find((button) => button.textContent === label)!);
      fireEvent.click(screen.getByRole("tab", { name: "Leaving" }));
      select = screen.queryByTestId("ward-drawer-barrier-select");
      if (select) break;
      fireEvent.click(screen.getByRole("button", { name: "Close bed drawer" }));
    }
    expect(select).not.toBeNull();
    expect(screen.getByTestId("ward-drawer-discharge-prep")).toHaveTextContent(/Discharge due within 24 hours/);
    // WH1: the reasons are folded behind one quiet button until asked for.
    fireEvent.click(within(select!).getByRole("button", { name: /long-stay reason$/ }));
    chooseChip("Long-stay reason", "NDIS", select!);
    expect(flow!.admissions.find((admission) => admission.id === admissionId)?.dischargeBarrier).toBe("NDIS");

    // H-0981 / WS-17: recording a blocker is one choice. The barrier is plain text while that form is open.
    const drawer = within(select!.closest("aside, [role='dialog']") as HTMLElement);
    fireEvent.click(drawer.getByRole("button", { name: /^(Record|Update) hold-up$/ }));
    expect(screen.queryByTestId("ward-drawer-barrier-select")).toBeNull();
    expect(drawer.getByRole("group", { name: /held up/i })).toBeInTheDocument();
    expect(drawer.queryByRole("group", { name: /long-stay reason/i })).toBeNull();
  });
});
