import { describe, expect, it, vi } from "vitest";
import { readAuditBatch } from "@/components/ward-management/shell/ward-desk-audit";
import type { SharedActivityAuditPage } from "@/components/ward-management/ward-shared-client";

describe("permitted Activity continuation", () => {
  it("follows empty permission-filtered pages to find older relevant events", async () => {
    const event = { sequence: "40", action: "CLOSE_UNIT", outcome: "accepted", committed_at: "2026-11-04T12:00:00Z" };
    const read = vi
      .fn<(before?: string) => Promise<SharedActivityAuditPage>>()
      .mockResolvedValueOnce({ events: [], complete: false, nextCursor: "100" })
      .mockResolvedValueOnce({ events: [event], complete: true, nextCursor: null });
    expect(await readAuditBatch(read)).toEqual({ events: [event], complete: true, nextCursor: null });
    expect(read.mock.calls).toEqual([[undefined], ["100"]]);
  });
  it("bounds sparse traversal and preserves a usable continuation", async () => {
    const read = vi.fn(async (before?: string) => ({
      events: [],
      complete: false,
      nextCursor: String(Number(before ?? 1000) - 1),
    }));
    expect(await readAuditBatch(read)).toEqual({ events: [], complete: false, nextCursor: "980" });
    expect(read).toHaveBeenCalledTimes(20);
  });
  it("refuses a nonadvancing cursor instead of spinning or claiming completeness", async () => {
    const read = vi.fn(async () => ({ events: [], complete: false, nextCursor: "100" }));
    await expect(readAuditBatch(read, "100")).rejects.toThrow("did not advance");
    expect(read).toHaveBeenCalledTimes(1);
  });
});
