// H-0330 and H-0372 (Josh approved 27 Oct 2026 03:09Z). Synthetic data only.
import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { dateOfBirthProblem } from "@/components/ward-management/ward-patient-registration-reducer";
import { referralQueueOrder } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

describe("referral queue ties break by id, not urgency (H-0330, D-32)", () => {
  it("orders two referrals raised at the same moment by id, whatever their urgency", () => {
    const queued = referralQueueOrder(seedWardFlowState().referrals);
    const template = queued[0];
    expect(template).toBeDefined();
    if (!template) return;
    // RF-SYN-B is more urgent (lower tier) but its id sorts after RF-SYN-A.
    const later = { ...template, id: "RF-SYN-B", raisedAt: template.raisedAt - 10_000, urgency: 1 };
    const earlier = { ...template, id: "RF-SYN-A", raisedAt: template.raisedAt - 10_000, urgency: 3 };
    const ids = referralQueueOrder([later, earlier] as typeof queued).map((referral) => referral.id);
    expect(ids).toEqual(["RF-SYN-A", "RF-SYN-B"]);
  });

  it("still puts the longer wait first", () => {
    const template = referralQueueOrder(seedWardFlowState().referrals)[0];
    if (!template) throw new Error("seed has no queued referral");
    const newer = { ...template, id: "RF-SYN-A", raisedAt: template.raisedAt - 5_000 };
    const older = { ...template, id: "RF-SYN-Z", raisedAt: template.raisedAt - 10_000 };
    expect(referralQueueOrder([newer, older]).map((referral) => referral.id)).toEqual(["RF-SYN-Z", "RF-SYN-A"]);
  });
});

describe("the birth date check uses the event's demo day (H-0372)", () => {
  const today = new Date("2026-10-27T04:00:00Z");

  it("tightens the bound to a demo day before the real date", () => {
    expect(dateOfBirthProblem("2026-10-20", today, "2026-10-19")).toBe("ADD_PATIENT date of birth is in the future");
    expect(dateOfBirthProblem("2026-10-19", today, "2026-10-19")).toBeUndefined();
  });

  it("never loosens the bound past the real date, and ignores a malformed demo day", () => {
    expect(dateOfBirthProblem("2026-11-01", today, "2026-12-01")).toBe("ADD_PATIENT date of birth is in the future");
    expect(dateOfBirthProblem("2026-10-26", today, "2026-02-31")).toBeUndefined();
    expect(dateOfBirthProblem("2026-10-26", today, "yesterday")).toBeUndefined();
    expect(dateOfBirthProblem("2026-10-26", today)).toBeUndefined();
  });

  it("the reducer refuses a birth date after the demo day it is sent", () => {
    const seed = seedWardFlowState();
    const event = {
      type: "ADD_PATIENT" as const,
      role: "coordinator" as const,
      now: NOW_ANCHOR,
      umrn: "SYN-PA-372",
      givenName: "Demo",
      familyName: "Person",
      dateOfBirth: "2020-06-02",
    };
    const refused = wardFlowReducer(seed, { ...event, demoToday: "2020-06-01" });
    expect(refused.patients).toHaveLength(seed.patients.length);
    expect(refused.rejections.at(-1)?.reason).toBe("ADD_PATIENT date of birth is in the future");
    const stored = wardFlowReducer(seed, { ...event, demoToday: "2020-06-02" });
    expect(stored.patients).toHaveLength(seed.patients.length + 1);
  });
});
