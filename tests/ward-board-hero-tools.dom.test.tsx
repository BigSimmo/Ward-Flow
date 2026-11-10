// The Stays and discharges hero's tools (redesign approved by Josh, 31 Oct 2026). Change ward is a
// role branch: a ward desk (nurse in charge) opens only its own ward(s), so the list holds only
// those, and the control is left out when there is just the one. Every other desk lists every ward.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WardAccess } from "@/components/ward-management/ward-role-access";
import type { Unit } from "@/components/ward-management/ward-model";

const desk: { access: WardAccess } = { access: { role: "coordinator", scope: { kind: "statewide" } } };

vi.mock("@/components/ward-management/shell/ward-access-store", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/shell/ward-access-store")>()),
  useEffectiveWardAccess: () => desk.access,
}));

const { WardBoardTools } = await import("@/components/ward-management/board/ward-board-hero");
const { WardFlowProvider } = await import("@/components/ward-management/ward-flow-provider");
const { NOW_ANCHOR } = await import("@/components/ward-management/ward-sites");

const UNITS = [
  { id: "synthetic-ward-a", name: "Synthetic Ward A" },
  { id: "synthetic-ward-b", name: "Synthetic Ward B" },
  { id: "synthetic-ward-c", name: "Synthetic Ward C" },
] as unknown as Unit[];

function renderTools() {
  // The Change ward list reads the ward network, so the tools render inside the provider.
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardBoardTools sheetOpen={false} onToggleSheet={() => {}} units={UNITS} currentUnitId="synthetic-ward-a" />
    </WardFlowProvider>,
  );
}

afterEach(() => {
  cleanup();
  desk.access = { role: "coordinator", scope: { kind: "statewide" } };
});

describe("Stays and discharges hero tools", () => {
  it("lists every ward for a coordinator", () => {
    renderTools();
    // Page tops (9 Nov 2026): Change ward is a hero chip whose count is the number of wards listed.
    expect(screen.getByRole("button", { name: "Change ward, 3 wards" })).toBeInTheDocument();
  });

  it("leaves Change ward out for a ward desk that opens only its own ward", () => {
    desk.access = { role: "ward", scope: { kind: "ward", unitIds: ["synthetic-ward-a"] } };
    renderTools();
    expect(screen.queryByRole("button", { name: /^Change ward/ })).toBeNull();
    // The shift brief stays: it is the nurse in charge's own tool.
    expect(screen.getByTestId("ward-board-top-sheet-toggle")).toHaveTextContent("Shift brief");
    expect(screen.getByTestId("ward-board-top-sheet-toggle")).toHaveAttribute("aria-expanded", "false");
  });

  it("lists only a ward desk's own wards when it holds more than one", () => {
    desk.access = { role: "ward", scope: { kind: "ward", unitIds: ["synthetic-ward-a", "synthetic-ward-c"] } };
    renderTools();
    fireEvent.click(screen.getByRole("button", { name: "Change ward, 2 wards" }));
    const panel = screen.getByRole("dialog", { name: "Switch ward" });
    expect(within(panel).queryByText(/Synthetic Ward B/)).toBeNull();
    expect(within(panel).getByText(/Synthetic Ward C/)).toBeInTheDocument();
  });
});
