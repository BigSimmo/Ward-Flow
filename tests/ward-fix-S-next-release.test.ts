// F-24 (13 Nov 2026, PR 2): the ED access card's "Next release" is drawn from the same supply as
// the line it sits in. The line skips a held-up release (it frees no bed), so the card must not name
// one either; before this fix it named the earliest release of any kind, held up or not, which is
// how "Others are ahead in the line" could sit beside a release the count had ignored.
import { describe, expect, it } from "vitest";

import { edAccessRisk } from "@/components/ward-management/forecast/ed-access-risk";
import { releaseText } from "@/components/ward-management/forecast/ed-access-risk-card";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { isWaitingInEd } from "@/components/ward-management/ward-ed-presence";
import { bedReleases, wardMovements } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";

const now = NOW_ANCHOR;
const baseUnit = allUnits().find((entry) => !entry.isClosed && entry.cohort === "Adult")!;
// No bed ready now, so the line is served only by releases.
const unit = {
  ...baseUnit,
  empty: { ...baseUnit.empty, value: 0 },
  allocatable: { ...baseUnit.allocatable, value: 0 },
};
const stay = (id: string, expectedDischargeAt: number) => ({
  ...wardAdmissions[0]!,
  id,
  unitId: unit.id,
  bedKind: "locked" as const,
  state: "occupied" as const,
  expectedDischargeAt,
});
const release = (id: string, admissionId: string, blocker: (typeof bedReleases)[number]["blocker"]) => ({
  ...bedReleases[0]!,
  id,
  unitId: unit.id,
  admissionId,
  state: "expected" as const,
  blocker,
  expectedAt: now,
});
const movement = {
  ...wardMovements.find(isWaitingInEd)!,
  id: "WF-NEXT-RELEASE" as (typeof wardMovements)[number]["id"],
  stage: "accepted_awaiting_bed" as const,
  security: "Secure" as const,
  cohort: "Adult" as const,
  openedAt: now,
  admissionId: undefined,
  allocatedBed: undefined,
  acceptedUnitId: unit.id,
  closure: undefined,
};

describe("F-24: the named next release is one the line counts", () => {
  const heldUpStay = stay("ADM-HELD", now + 30);
  const cleanStay = stay("ADM-CLEAN", now + 300);
  const releases = [
    release("REL-HELD", heldUpStay.id, "Awaiting placement confirmation"),
    release("REL-CLEAN", cleanStay.id, null),
  ];

  it("skips a held-up release for both the slot and the named release", () => {
    const risk = edAccessRisk([movement], [unit], releases, [heldUpStay, cleanStay], now, 120, []);
    expect(risk.atRisk).toHaveLength(1);
    const row = risk.atRisk[0]!;
    // The line's own slot: the held-up release at now + 30 would have met the target; it is skipped.
    expect(row.slotAt).toBe(now + 300);
    // The card names the same release, never the held-up one the line ignored.
    expect(row.nextRelease).toEqual({ unitId: unit.id, unitName: unit.name, at: now + 300 });
    expect(row.ahead).toBe(0);
  });

  it("writes no held-up clause and no 'ahead' line for the first in line", () => {
    const row = edAccessRisk([movement], [unit], releases, [heldUpStay, cleanStay], now, 120, []).atRisk[0]!;
    const text = releaseText(row, now, true);
    expect(text).not.toMatch(/held up/u);
    expect(text).not.toMatch(/ahead in the line/u);
    expect(text).toMatch(/^Next locked adult release /u);
  });

  it("names no release when every release in the line is held up", () => {
    const allHeld = [release("REL-HELD", heldUpStay.id, "Awaiting placement confirmation")];
    const row = edAccessRisk([movement], [unit], allHeld, [heldUpStay], now, 120, []).atRisk[0]!;
    expect(row.slotAt).toBeNull();
    expect(row.nextRelease).toBeNull();
  });
});
