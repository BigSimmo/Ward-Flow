// TC-05 (audits 24 and 26 Oct 2026, H-0218 and H-0774): the shared-mode board clock moves between poll answers.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sharedBoardNow } from "@/components/ward-management/ward-shared-clock";

const RECEIVED = Date.UTC(2026, 9, 26, 2, 0, 0);

describe("shared-mode board clock between poll answers", () => {
  it("shows the server's minute when the answer has just arrived", () => {
    expect(sharedBoardNow(900, RECEIVED, RECEIVED)).toBe(900);
    expect(sharedBoardNow(900, RECEIVED, RECEIVED + 59_000)).toBe(900);
  });

  it("advances by whole minutes while polls are failing, so a due time still turns overdue", () => {
    expect(sharedBoardNow(900, RECEIVED, RECEIVED + 60_000)).toBe(901);
    expect(sharedBoardNow(900, RECEIVED, RECEIVED + 45 * 60_000 + 30_000)).toBe(945);
  });

  it("never runs backwards when the device clock is set back, and needs a real receipt time", () => {
    expect(sharedBoardNow(900, RECEIVED, RECEIVED - 3 * 3_600_000)).toBe(900);
    expect(sharedBoardNow(900, 0, RECEIVED)).toBe(900);
    expect(sharedBoardNow(900, Number.NaN, RECEIVED)).toBe(900);
  });

  it("is what the provider reads in shared mode, not the bare snapshot minute", () => {
    const source = readFileSync("src/components/ward-management/ward-flow-provider.tsx", "utf8");
    expect(source).toContain("sharedBoardNow(shared.snapshot.now, shared.receivedAt)");
  });
});
