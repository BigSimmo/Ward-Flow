// tests/ward-handover-act-now-shared.test.ts
import { describe, expect, it } from "vitest";

import { activeActNowItems } from "../src/components/ward-management/ward-act-now-items";
import { isActNow, toHandoverRow } from "../src/components/ward-management/handover/handover-model";
import { isOpen } from "../src/components/ward-management/ward-derivations";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/**
 * L1 (site review, 12 Oct 2026): Handover read "Act now 3" while Alerts read 2. The sheet now reads
 * the shared act-now list (`activeActNowItems`), plus any journey a person flagged urgent.
 */
describe("Handover act now reads the shared act-now list", () => {
  const seed = seedWardFlowState();
  const shared = new Set(activeActNowItems(seed, NOW_ANCHOR).map((item) => item.movementId));
  const rows = seed.movements.filter(isOpen).map((movement) => ({
    ...toHandoverRow(movement, seed.units, seed.patients, seed.referrals),
    actNow: shared.has(movement.id),
  }));

  it("is act now for every journey on the shared list", () => {
    expect(shared.size).toBeGreaterThan(0);
    for (const row of rows.filter((candidate) => shared.has(candidate.id)))
      expect(isActNow(row, NOW_ANCHOR)).toBe(true);
  });

  it("adds only journeys flagged urgent to the shared list", () => {
    const act = rows.filter((row) => isActNow(row, NOW_ANCHOR));
    const extra = act.filter((row) => !shared.has(row.id));
    expect(extra.every((row) => row.urgent)).toBe(true);
    expect(act.length).toBe(shared.size + extra.length);
  });

  it("drops a snoozed alert from the sheet with the shared list", () => {
    const row = rows.find((candidate) => shared.has(candidate.id) && !candidate.urgent);
    expect(row).toBeDefined();
    expect(isActNow({ ...row!, actNow: false }, NOW_ANCHOR)).toBe(false);
  });
});
