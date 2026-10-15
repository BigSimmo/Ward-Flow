import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LongStaySummary } from "@/components/ward-management/handover/long-stay-summary";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { longStaySummaries } from "@/components/ward-management/ward-stranded";

const seeded = seedWardFlowState();
const now = seeded.auditCaptureStartedAt;
const base = seeded.admissions.find((admission) => admission.state === "occupied")!;
const day = 24 * 60;
const escalateHours = CLINICAL_VALUES.delayedDischargeEscalation.value;

const waiting: Admission = {
  ...base,
  id: "ADM-WAIT",
  arrivedAt: now - 10 * day,
  expectedDischargeAt: now - (escalateHours + 6) * 60,
  blockReason: "Awaiting accommodation",
  dischargeBarrier: null,
};
const noPlan: Admission = {
  ...base,
  id: "ADM-NOPLAN",
  arrivedAt: now - (CLINICAL_VALUES.longStayPrompt.value + 2) * day,
  expectedDischargeAt: null,
  blockReason: null,
};

describe("Top 25 item 20: long stay and delayed discharge summary", () => {
  it("places the escalation point after the recorded expected discharge date", () => {
    const [summary] = longStaySummaries([waiting], now, []);
    expect(summary!.flag.reasons).toContain("ready-but-waiting");
    expect(summary!.escalationAt).toBe(waiting.expectedDischargeAt! + escalateHours * 60);
    expect(summary!.hoursPastExpected).toBe(escalateHours + 6);
    expect(summary!.escalationReached).toBe(true);
    expect(summary!.blockReason).toBe("Awaiting accommodation");
  });

  it("has no escalation point while no expected date is recorded", () => {
    const [summary] = longStaySummaries([noPlan], now, []);
    expect(summary!.flag.reasons).toEqual(["long-stay-no-plan"]);
    expect(summary!.escalationAt).toBeUndefined();
    expect(summary!.escalationReached).toBe(false);
  });

  it("renders one row per flagged person on the handover", () => {
    render(
      <LongStaySummary
        admissions={[waiting, noPlan]}
        bedReleases={[]}
        now={now}
        nameFor={(admission) => `Person ${admission.id}`}
        wardFor={() => "Test ward"}
      />,
    );
    expect(screen.getByText("Long stays and delayed discharges (2)")).toBeTruthy();
    expect(screen.getByText("Escalation point reached")).toBeTruthy();
    expect(screen.getByText(/once one is recorded/)).toBeTruthy();
  });
});
