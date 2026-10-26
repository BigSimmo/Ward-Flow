// Production audit 24 Oct 2026: calendar days on the destinations list (EDR-01) and the short legal
// word on out of area stays (EDR-02). Synthetic seed data only.
import { describe, expect, it } from "vitest";

import type { Admission } from "@/components/ward-management/ward-admissions";
import { arrowTargets } from "@/components/ward-management/ward-board-derivations";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { stayLegalShort } from "@/components/ward-management/ward-stay-legal";

const seed = seedWardFlowState();
const occupied = seed.admissions.find(
  (admission) => admission.state === "occupied" && admission.homeRegion !== null,
) as Admission;

describe("arrowTargets counts calendar days (EDR-01)", () => {
  // 15:00 on day 3.
  const now = 3 * MINUTES_PER_DAY + 15 * 60;
  const at = (expectedDischargeAt: number) => arrowTargets([{ ...occupied, expectedDischargeAt }], now)[0];

  it("reads 14:00 tomorrow as tomorrow, not due now", () => {
    expect(at(4 * MINUTES_PER_DAY + 14 * 60)).toMatchObject({ nearestDays: 1, nearestDue: false });
  });

  it("reads 09:00 the day after tomorrow as two days away", () => {
    expect(at(5 * MINUTES_PER_DAY + 9 * 60)?.nearestDays).toBe(2);
  });

  it("separates later today from due now or overdue", () => {
    expect(at(3 * MINUTES_PER_DAY + 20 * 60)).toMatchObject({ nearestDays: 0, nearestDue: false });
    expect(at(now)).toMatchObject({ nearestDays: 0, nearestDue: true });
    expect(at(MINUTES_PER_DAY)).toMatchObject({ nearestDays: 0, nearestDue: true });
  });
});

describe("stayLegalShort words the recorded status (EDR-02)", () => {
  // A stay linked to a seed movement, so the movement's recorded status is the one read.
  const stay: Admission = { ...occupied, movementId: seed.movements[0]!.id };
  const withStatus = (legalStatus: string) => ({
    ...seed,
    movements: seed.movements.map((movement) =>
      movement.id === stay.movementId
        ? ({ ...movement, legalStatus, legalForm: undefined } as unknown as Movement)
        : movement,
    ),
  });

  it.each([
    ["Voluntary", "Voluntary"],
    ["Involuntary inpatient", "Involuntary"],
    ["Community treatment order", "CTO"],
    ["Referred for psychiatric examination", "Referred for exam"],
    ["Detained awaiting examination", "Awaiting exam"],
    ["Not recorded", undefined],
  ])("%s reads as %s", (status, word) => {
    expect(stayLegalShort(stay, withStatus(status))).toBe(word);
  });
});
