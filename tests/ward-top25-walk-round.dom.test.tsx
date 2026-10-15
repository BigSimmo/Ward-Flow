import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WalkRoundRowMarks, WardWalkRound, type WalkRoundBed } from "@/components/ward-management/ward/ward-walk-round";

// Made-up beds, deliberately out of bed order so the walk has to sort them.
const beds: WalkRoundBed[] = [
  {
    bedNumber: 2,
    number: "02",
    name: "Tom R.",
    note: "Accommodation",
    glyph: "warning",
    days: "23d",
    accessibleName: "Bed 2",
  },
  {
    bedNumber: 1,
    number: "01",
    name: "Mia K.",
    note: "Expected out today",
    glyph: "info",
    days: "12d",
    accessibleName: "Bed 1",
  },
  {
    bedNumber: 3,
    number: "03",
    name: "Free to offer",
    note: "Free to offer",
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
        </li>
      ))}
    </ul>
  );
}

describe("phone walk round (item 23, option D)", () => {
  it("walks beds in bed order, marks them reviewed and returns to the list", () => {
    render(<WardWalkRound beds={beds} onOpenBed={vi.fn()} renderList={list} />);
    expect(screen.getByText("List bed 01")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("0 of 3 reviewed");

    fireEvent.click(screen.getByRole("button", { name: "Start walk round" }));
    expect(screen.getByRole("region", { name: "Bed 01, 1 of 3" })).toBeTruthy();
    expect(screen.queryByText("List bed 01")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Reviewed, next bed" }));
    expect(screen.getByRole("region", { name: "Bed 02, 2 of 3" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("1 of 3 reviewed");
    expect(screen.getByRole("button", { name: "Walk from bed 01, reviewed" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Back to list" }));
    expect(screen.getByText("List bed 02")).toBeTruthy();
    expect(screen.getAllByText("Reviewed")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Carry on from bed 02" })).toBeTruthy();
  });

  it("starts from a tapped list row and finishes on the last bed", () => {
    render(<WardWalkRound beds={beds} onOpenBed={vi.fn()} renderList={list} />);
    fireEvent.click(screen.getByText("List bed 03"));
    fireEvent.click(screen.getByRole("button", { name: "Reviewed, finish" }));
    expect(screen.getByText("List bed 03")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("1 of 3 reviewed");
  });

  it("opens the bed's existing panel to update it", () => {
    const onOpenBed = vi.fn();
    render(<WardWalkRound beds={beds} onOpenBed={onOpenBed} renderList={list} />);
    fireEvent.click(screen.getByRole("button", { name: "Walk from bed 02" }));
    fireEvent.click(screen.getByRole("button", { name: "Update this bed" }));
    expect(onOpenBed).toHaveBeenCalledWith(2);
  });

  it("marks a bed changed this round when its note moves after the round starts", () => {
    const { rerender } = render(<WardWalkRound beds={beds} onOpenBed={vi.fn()} renderList={list} />);
    expect(screen.queryByText("Changed")).toBeNull();
    const moved = beds.map((bed) => (bed.bedNumber === 1 ? { ...bed, note: "Discharge confirmed" } : bed));
    rerender(<WardWalkRound beds={moved} onOpenBed={vi.fn()} renderList={list} />);
    expect(screen.getAllByText("Changed")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Walk from bed 01" }));
    expect(screen.getByText("Changed this round")).toBeTruthy();
  });
});
