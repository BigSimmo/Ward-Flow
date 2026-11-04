import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WardBoardCompactPrint } from "@/components/ward-management/board/ward-board-compact-print";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Occupant, Tile } from "@/components/ward-management/board/ward-board-model";
import { unitById } from "@/components/ward-management/ward-sites";

const unit = unitById("rph-adult-secure")!;
const dayZero = new Date("2026-11-01T16:00:00.000Z");

afterEach(() => vi.useRealTimers());

describe("compact bed board print", () => {
  it("keeps every tile when the board is larger than one sheet and names the precise recorded day", () => {
    const tiles: Tile[] = Array.from({ length: 31 }, (_, index) => ({ kind: "empty", key: `empty-${index}` }));
    tiles[0] = { kind: "waiting", key: "synthetic-admission" };
    const occupant = {
      key: "synthetic-admission",
      days: null,
      awayAtEdHours: null,
      pastDate: false,
      confirmed: false,
      blockReason: "Awaiting transport",
      dischargeBarrier: null,
      stepDownCandidate: false,
    } as Occupant;
    const admission = {
      id: "synthetic-admission",
      bedNumber: 4,
      expectedDischargeAt: 24 * 60 + 9 * 60,
    } as Admission;
    render(
      <WardBoardCompactPrint
        unit={unit}
        tiles={tiles}
        occupants={[occupant]}
        admissions={[admission]}
        nameFor={() => "Testwood-Longsurname, Alexandra"}
        dayZero={dayZero}
      />,
    );
    expect(screen.getAllByTestId("ward-board-print-page")).toHaveLength(2);
    expect(screen.getAllByTestId("ward-board-print-bed")).toHaveLength(31);
    const first = within(screen.getAllByTestId("ward-board-print-bed")[0]!);
    expect(first.getByText("Bed 4 · Testwood-Longsurname, Alexandra")).toBeInTheDocument();
    expect(first.getByText("Pulled; not arrived")).toBeInTheDocument();
    expect(first.getByText(/Expected Tue, 3 Nov 2026, 09:00 AWST/)).toBeInTheDocument();
    expect(first.getByText("Held up: Awaiting transport")).toBeInTheDocument();
    expect(first.queryByText("Ready")).not.toBeInTheDocument();
  });

  it("stamps actual Perth time again before printing, independently of the simulation day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-31T15:59:59.234Z"));
    render(
      <WardBoardCompactPrint
        unit={unit}
        tiles={[{ kind: "closed", key: "closed-0" }]}
        occupants={[]}
        admissions={[]}
        nameFor={() => "Name not recorded"}
        dayZero={dayZero}
      />,
    );
    expect(screen.getByTestId("ward-board-print-time")).toHaveTextContent("Thu, 31 Dec 2026, 23:59 AWST");
    vi.setSystemTime(new Date("2026-12-31T16:00:00Z"));
    fireEvent(window, new Event("beforeprint"));
    expect(screen.getByTestId("ward-board-print-time")).toHaveTextContent("Fri, 1 Jan 2027, 00:00 AWST");
    expect(screen.getByText(/Check the live board before acting\. Synthetic data\./)).toBeInTheDocument();
  });
});
