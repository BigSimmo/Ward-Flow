import { describe, expect, it } from "vitest";

import { DUE_SORT_OPTIONS, sortDueFirst } from "@/components/ward-management/ward-due-sort";

type Row = { id: string; due?: number | null };

describe("due first sort", () => {
  it("orders by due time, earliest first, and puts rows with no due time last in their old order", () => {
    const rows: Row[] = [
      { id: "none-1" },
      { id: "late", due: 900 },
      { id: "overdue", due: 600 },
      { id: "none-2", due: null },
      { id: "soon", due: 650 },
    ];
    expect(sortDueFirst(rows, (row) => row.due).map((row) => row.id)).toEqual([
      "overdue",
      "soon",
      "late",
      "none-1",
      "none-2",
    ]);
  });

  it("is stable for equal times and never adds, drops or mutates rows", () => {
    const rows: Row[] = [
      { id: "b", due: 700 },
      { id: "a", due: 700 },
      { id: "c", due: Number.NaN },
    ];
    const sorted = sortDueFirst(rows, (row) => row.due);
    expect(sorted.map((row) => row.id)).toEqual(["b", "a", "c"]);
    expect(rows.map((row) => row.id)).toEqual(["b", "a", "c"]);
    expect(sorted).toHaveLength(rows.length);
  });

  it("offers the list's default first", () => {
    expect(DUE_SORT_OPTIONS.map((option) => option.label)).toEqual(["Default", "Due first"]);
  });
});
