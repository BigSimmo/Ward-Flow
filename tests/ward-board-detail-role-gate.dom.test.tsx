// Demo-Actions-AC1-1/2/3 (master stress test, 14 Nov 2026), synthetic seed only: the board's bed
// record offers a step only to a desk whose role may take it (the permission matrix). The site bed
// manager keeps Record hold-up and is not shown steps that saved nothing.
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/ward-flow/ward/board",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

import { WardBoard } from "@/components/ward-management/board/ward-board";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { setDeskRole } from "@/components/ward-management/ward-role-gate";
import { WARD_ADMISSIONS_ANCHOR } from "@/components/ward-management/ward-admissions-seed";

afterEach(() => {
  cleanup();
  setDeskRole("coordinator");
});

function openAnOccupiedBed() {
  const state = seedWardFlowState();
  const occupied = state.admissions.find((admission) => admission.state === "occupied");
  if (!occupied) throw new Error("the seed contains nobody occupying a bed");
  render(
    <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
      <WardBoard unitId={occupied.unitId} />
    </WardFlowProvider>,
  );
  const beds = screen.getByTestId("ward-board-beds");
  const tile = within(beds)
    .getAllByRole("listitem")
    .find((candidate) => candidate.getAttribute("data-bed-kind") === "occupied");
  if (!tile) throw new Error("the board rendered no occupied bed tile");
  fireEvent.click(within(tile).getByRole("button"));
  return screen.getByTestId("ward-board-detail");
}

describe("the board's bed record follows the permission matrix", () => {
  it("offers the ward its bed steps", () => {
    setDeskRole("ward", "/ward-flow/ward/board");
    const detail = openAnOccupiedBed();
    expect(within(detail).getByTestId("ward-board-stepdown-toggle")).toBeInTheDocument();
    expect(within(detail).getByTestId("ward-board-record-leaving-submit")).toBeInTheDocument();
    expect(within(detail).getByRole("button", { name: "Move the date" })).toBeInTheDocument();
  });

  it("does not offer the site bed manager steps its role may not take, and keeps Record hold-up", () => {
    setDeskRole("bed_manager", "/ward-flow/ward/board");
    const detail = openAnOccupiedBed();
    expect(within(detail).queryByTestId("ward-board-stepdown-toggle")).toBeNull();
    expect(within(detail).queryByTestId("ward-board-record-leaving-submit")).toBeNull();
    expect(within(detail).queryByTestId("ward-board-record-leaving")).toBeNull();
    expect(within(detail).queryByTestId("ward-board-away-at-ed")).toBeNull();
    expect(within(detail).queryByRole("button", { name: "Move the date" })).toBeNull();
    expect(within(detail).getByRole("button", { name: "Record hold-up" })).toBeInTheDocument();
  });
});
