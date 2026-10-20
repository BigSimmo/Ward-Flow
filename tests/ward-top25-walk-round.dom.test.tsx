import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  bedStripWord,
  useWalkRound,
  WalkRoundRowMarks,
  WardWalkRound,
  type WalkRoundBed,
} from "@/components/ward-management/ward/ward-walk-round";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";

vi.mock("@/components/ward-management/shell/ward-live-region", async (importActual) => ({
  ...(await importActual<typeof import("@/components/ward-management/shell/ward-live-region")>()),
  announceToWardShell: vi.fn(),
}));

// Made-up beds, deliberately out of bed order so the walk has to sort them.
const beds: WalkRoundBed[] = [
  {
    bedNumber: 2,
    number: "02",
    name: "Tom R.",
    note: "Accommodation",
    stateWord: "Barrier",
    changeKey: "occupied|barrier",
    glyph: "warning",
    days: "23d",
    accessibleName: "Bed 2",
  },
  {
    bedNumber: 1,
    number: "01",
    name: "Mia K.",
    note: "Expected out today",
    stateWord: "Due out",
    changeKey: "occupied|due",
    glyph: "info",
    days: "12d",
    accessibleName: "Bed 1",
  },
  {
    bedNumber: 3,
    number: "03",
    name: "Free to offer",
    note: "Free to offer",
    stateWord: "Free",
    changeKey: "ready",
    glyph: null,
    days: "",
    accessibleName: "Bed 3",
  },
];

function list(mark: (bedNumber: number) => { reviewed: boolean; changed: boolean }, walkFrom: (n: number) => void) {
  return (
    <ul>
      {beds.map((bed) => (
        <li key={bed.bedNumber}>
          <button type="button" onClick={() => walkFrom(bed.bedNumber)}>
            List bed {bed.number}
          </button>
          <WalkRoundRowMarks mark={mark(bed.bedNumber)} />
          {mark(bed.bedNumber).reviewed ? <span>Reviewed</span> : null}
        </li>
      ))}
    </ul>
  );
}

/** The ward page holds the round; `phone` false stands in for turning the phone to landscape. */
function Harness({
  bedList = beds,
  onOpenBed = vi.fn(),
  phone = true,
}: {
  bedList?: WalkRoundBed[];
  onOpenBed?: (n: number) => void;
  phone?: boolean;
}) {
  const [round, setRound] = useWalkRound("ward-a", bedList);
  return phone ? (
    <WardWalkRound beds={bedList} round={round} setRound={setRound} onOpenBed={onOpenBed} renderList={list} />
  ) : (
    <p>Desktop list</p>
  );
}

describe("phone round (item 23, redrawn as Option B on 20 Oct 2026)", () => {
  it("walks beds in bed order on their own card, marks them reviewed and goes back to the list", () => {
    render(<Harness />);
    expect(screen.getByText("List bed 01")).toBeTruthy();
    expect(screen.getByTestId("walk-round-progress").textContent).toBe("0 of 3 reviewed");
    // Option B: no bed strip; the list is the round.
    expect(screen.queryByRole("group", { name: "Beds in bed order" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Start the round" }));
    expect(screen.getByRole("region", { name: "Bed 01, 1 of 3" })).toBeTruthy();
    // The card has the page: the list steps aside, and the back arrow has focus.
    expect(screen.queryByText("List bed 01")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Back to the round" }));
    expect(screen.getByText("No change since the round started")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Reviewed, next bed" }));
    expect(screen.getByRole("region", { name: "Bed 02, 2 of 3" })).toBeTruthy();
    expect(screen.getByTestId("walk-round-progress").textContent).toBe("1 of 3 reviewed");
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Back to the round" }));
    expect(screen.getByText("List bed 02")).toBeTruthy();
    expect(screen.getAllByText("Reviewed")).toHaveLength(1);
    const carryOn = screen.getByRole("button", { name: "Carry on from bed 02" });
    expect(document.activeElement).toBe(carryOn);
  });

  it("starts from a tapped list row and finishes on the last bed", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("List bed 03"));
    fireEvent.click(screen.getByRole("button", { name: "Reviewed, finish" }));
    expect(screen.getByText("List bed 03")).toBeTruthy();
    expect(screen.getByTestId("walk-round-progress").textContent).toBe("1 of 3 reviewed");
  });

  it("opens the bed's existing panel to update it", () => {
    const onOpenBed = vi.fn();
    render(<Harness onOpenBed={onOpenBed} />);
    fireEvent.click(screen.getByText("List bed 02"));
    fireEvent.click(screen.getByRole("button", { name: "Update this bed" }));
    expect(onOpenBed).toHaveBeenCalledWith(2);
  });

  it("marks a bed changed this round when its state moves, not when only its text ticks", () => {
    const { rerender } = render(<Harness />);
    expect(screen.queryByText("Changed")).toBeNull();
    const ticked = beds.map((bed) => (bed.bedNumber === 2 ? { ...bed, note: "Pull 26m left" } : bed));
    rerender(<Harness bedList={ticked} />);
    expect(screen.queryByText("Changed")).toBeNull();
    const moved = beds.map((bed) =>
      bed.bedNumber === 1 ? { ...bed, note: "Discharge confirmed", changeKey: "occupied|confirmed" } : bed,
    );
    rerender(<Harness bedList={moved} />);
    expect(screen.getAllByText("Changed")).toHaveLength(1);
    fireEvent.click(screen.getByText("List bed 01"));
    expect(screen.getByText("Changed this round")).toBeTruthy();
  });

  it("keeps the round when the layout leaves the phone and comes back", () => {
    const { rerender } = render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Start the round" }));
    fireEvent.click(screen.getByRole("button", { name: "Reviewed, next bed" }));
    const announce = vi.mocked(announceToWardShell);
    rerender(<Harness phone={false} />);
    announce.mockClear();
    rerender(<Harness />);
    expect(screen.getByTestId("walk-round-progress").textContent).toBe("1 of 3 reviewed");
    // Coming back mid round says which bed the round is on.
    expect(announce).toHaveBeenLastCalledWith("Now on bed 02.");
  });

  it("starts a finished round again from nothing", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Start the round" }));
    fireEvent.click(screen.getByRole("button", { name: "Reviewed, next bed" }));
    fireEvent.click(screen.getByRole("button", { name: "Reviewed, next bed" }));
    fireEvent.click(screen.getByRole("button", { name: "Reviewed, finish" }));
    expect(screen.getByTestId("walk-round-progress").textContent).toBe("3 of 3 reviewed");
    fireEvent.click(screen.getByRole("button", { name: "Start again from bed 01" }));
    expect(screen.getByTestId("walk-round-progress").textContent).toBe("0 of 3 reviewed");
    expect(screen.getByRole("region", { name: "Bed 01, 1 of 3" })).toBeTruthy();
  });
  it("tells a screen reader which bed it is on and when the round is finished, not on first show", () => {
    const announce = vi.mocked(announceToWardShell);
    announce.mockClear();
    render(<Harness />);
    expect(announce).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Start the round" }));
    expect(announce).toHaveBeenLastCalledWith("Now on bed 01.");
    fireEvent.click(screen.getByRole("button", { name: "Reviewed, next bed" }));
    expect(announce).toHaveBeenLastCalledWith("Now on bed 02.");
    fireEvent.click(screen.getByRole("button", { name: "Reviewed, next bed" }));
    fireEvent.click(screen.getByRole("button", { name: "Reviewed, finish" }));
    expect(announce).toHaveBeenLastCalledWith("Round finished. Every bed reviewed.");
  });
});

// C3 (phone simplification, 19 Oct 2026): each bed in the round has a word for its state, so a
// colour never carries the meaning alone. Each word comes from the bed's existing state.
describe("the bed state word (C3)", () => {
  const none = { free: false, preparing: false, awayAtEd: false, leaving: false };
  const occupied = { status: "occupied" } as const;

  it.each([
    ["Free", occupied, { ...none, free: true }],
    ["Preparing", { status: "ready" }, { ...none, preparing: true }],
    ["Closed", { status: "closed" }, none],
    ["Absent", { status: "leave", statusText: "Absent without leave" }, none],
    ["Leave", { status: "leave", statusText: "On leave" }, none],
    ["Held up", { ...occupied, blockReason: "Awaiting a bed elsewhere" }, none],
    ["At ED", occupied, { ...none, awayAtEd: true }],
    ["Past date", { ...occupied, pastDate: true }, none],
    ["Barrier", { ...occupied, dischargeBarrier: "Accommodation" }, none],
    ["Held", { status: "incoming" }, none],
    ["Due out", occupied, { ...none, leaving: true }],
    ["Occupied", occupied, none],
  ] as const)("reads %s", (word, bed, flags) => {
    expect(bedStripWord(bed as Parameters<typeof bedStripWord>[0], flags)).toBe(word);
  });
});
