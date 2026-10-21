// tests/ward-handover-act-now-shared.test.ts
import { describe, expect, it } from "vitest";

import { activeActNowItems } from "../src/components/ward-management/ward-act-now-items";
import { groupOf, isActNow, toHandoverRow } from "../src/components/ward-management/handover/handover-model";
import { isOpen } from "../src/components/ward-management/ward-derivations";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/**
 * L1 (site review, 12 Oct 2026): Handover read "Act now 3" while Alerts read 2. The sheet now reads
 * the shared act-now list (`activeActNowItems`). Audit 6 (Josh, 20 Oct 2026): exactly that list, with a
 * journey a person flagged urgent on its own Flagged urgent line beneath, never dropped.
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

  it("is exactly the shared list, so Handover's Act now equals Alerts'", () => {
    const act = rows.filter((row) => isActNow(row, NOW_ANCHOR));
    expect(act.map((row) => row.id).sort()).toEqual(
      rows
        .filter((row) => shared.has(row.id))
        .map((row) => row.id)
        .sort(),
    );
  });

  it("lists every other journey flagged urgent on its own line beneath Act now", () => {
    const cutoff = NOW_ANCHOR + 8 * 60;
    const urgentOnly = rows.filter((row) => row.urgent && !shared.has(row.id));
    expect(urgentOnly.length).toBeGreaterThan(0);
    for (const row of urgentOnly) expect(groupOf(row, NOW_ANCHOR, cutoff)).toBe("urg");
    for (const row of rows.filter((candidate) => shared.has(candidate.id)))
      expect(groupOf(row, NOW_ANCHOR, cutoff)).toBe("act");
  });

  it("drops a snoozed alert from the sheet with the shared list", () => {
    const row = rows.find((candidate) => shared.has(candidate.id) && !candidate.urgent);
    expect(row).toBeDefined();
    expect(isActNow({ ...row!, actNow: false }, NOW_ANCHOR)).toBe(false);
  });
});
