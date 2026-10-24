import { describe, expect, it } from "vitest";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { toHandoverRow, type RowGroup } from "@/components/ward-management/handover/handover-model";
import {
  paginateHandoverItems,
  paginateHandoverExtras,
  paperItemKey,
  type PaperItem,
  type PaperMeasurements,
} from "@/components/ward-management/handover/handover-print-pagination";

const seed = seedWardFlowState();
const rows = seed.movements
  .slice(0, 4)
  .map((movement) => toHandoverRow(movement, seed.units, seed.patients, seed.referrals));
const group: RowGroup = { id: "bed", title: "Finding a ward", why: "", rows };

function measurement(budget: number, items: PaperItem[], rowHeight: number, isbarHeight = 0): PaperMeasurements {
  return {
    mainBudget: budget,
    extraBudget: budget,
    firstPageCost: 0,
    itemHeights: Object.fromEntries(
      items.map((item) => [
        paperItemKey(item),
        item.kind === "group" ? 20 : item.kind === "row" ? rowHeight : isbarHeight,
      ]),
    ),
    extraHeights: {},
    extraHeads: {},
  };
}

describe("measured handover paper pagination", () => {
  it("carries wrapped rows onto more pages without dropping or duplicating a patient", () => {
    const items: PaperItem[] = [
      { kind: "group", group, continued: false },
      ...rows.map((row) => ({ kind: "row" as const, row })),
    ];
    const pages = paginateHandoverItems(items, 500, 0, measurement(220, items, 100));
    expect(pages).toHaveLength(2);
    expect(
      pages
        .flat()
        .filter((item) => item.kind === "row")
        .map((item) => item.row.id),
    ).toEqual(rows.map((row) => row.id));
    expect(pages[1]![0]).toEqual({ kind: "group", group, continued: true });
    for (const page of pages) expect(page.filter((item) => item.kind === "row")).toHaveLength(2);
  });

  it("keeps an ISBAR block with its patient when wrapping takes the remaining page space", () => {
    const items: PaperItem[] = [
      { kind: "group", group, continued: false },
      ...rows.slice(0, 2).flatMap((row): PaperItem[] => [
        { kind: "row", row },
        { kind: "isbar", row },
      ]),
    ];
    const pages = paginateHandoverItems(items, 500, 0, measurement(200, items, 100, 80));
    expect(pages).toHaveLength(2);
    for (const page of pages) {
      expect(page.map((item) => item.kind)).toEqual(["group", "row", "isbar"]);
      expect(page[1]!.kind === "row" && page[2]!.kind === "isbar" && page[1]!.row.id).toBe(
        page[2]!.kind === "isbar" && page[2]!.row.id,
      );
    }
  });

  it("does not orphan a new group heading at a page end", () => {
    const second: RowGroup = { ...group, id: "moving", rows: [rows[1]!] };
    const items: PaperItem[] = [
      { kind: "group", group, continued: false },
      { kind: "row", row: rows[0]! },
      { kind: "group", group: second, continued: false },
      { kind: "row", row: rows[1]! },
    ];
    const pages = paginateHandoverItems(items, 500, 0, measurement(150, items, 100));
    expect(pages.map((page) => page.map((item) => item.kind))).toEqual([
      ["group", "row"],
      ["group", "row"],
    ]);
    expect(pages[1]![0]).toEqual({ kind: "group", group: second, continued: false });
  });

  it("reserves the measured summary and out-of-scope note on page one", () => {
    const items: PaperItem[] = [
      { kind: "group", group, continued: false },
      ...rows.map((row) => ({ kind: "row" as const, row })),
    ];
    const measured = { ...measurement(220, items, 100), firstPageCost: 80 };
    const pages = paginateHandoverItems(items, 500, 0, measured);
    expect(pages.map((page) => page.filter((item) => item.kind === "row").length)).toEqual([1, 2, 1]);
  });

  it("paginates the measured discharge sections as well as patient rows", () => {
    const measured: PaperMeasurements = {
      ...measurement(200, [], 0),
      extraHeads: { holds: 35 },
      extraHeights: { noHolds: 100, sigs: 120 },
    };
    const pages = paginateHandoverExtras([[{ kind: "noHolds" }, { kind: "sigs" }]], 500, measured);
    expect(pages).toHaveLength(2);
    expect(pages[0]![0]![0]!.id).toBe("holds");
    expect(pages[1]![0]![0]!.id).toBe("sigs");
  });
});
