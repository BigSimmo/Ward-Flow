import { describe, expect, it } from "vitest";

import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { WARD_ADMISSIONS_ANCHOR, wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { BedRelease } from "@/components/ward-management/ward-model";
import {
  LONG_STAY_PROMPT_DAYS,
  STRANDED_WAITING_BLOCKERS,
  strandedFlags,
  strandedPromptText,
} from "@/components/ward-management/ward-stranded";

const NOW = WARD_ADMISSIONS_ANCHOR;

/** A seeded occupied admission, re-shaped per case so every field stays a real one. */
function base(): Admission {
  const found = wardAdmissions.find((admission) => admission.state === "occupied");
  if (!found) throw new Error("the seed holds nobody in a bed");
  return {
    ...found,
    id: "case",
    arrivedAt: NOW - 2 * MINUTES_PER_DAY,
    expectedDischargeAt: null,
    blockReason: null,
    dischargeBarrier: null,
  };
}

function stay(days: number, changes: Partial<Admission> = {}): Admission {
  return { ...base(), arrivedAt: NOW - days * MINUTES_PER_DAY - 1, ...changes };
}

function release(admissionId: string, changes: Partial<BedRelease> = {}): BedRelease {
  return {
    id: `rel-${admissionId}`,
    unitId: "unit-1",
    admissionId,
    state: "confirmed",
    expectedAt: NOW,
    waitingOn: null,
    blocker: null,
    blockedBy: null,
    preparing: false,
    preparationNote: null,
    confirmedAt: NOW,
    confirmedBy: "ward",
    ...changes,
  };
}

describe("stranded-patient prompts", () => {
  it("prompts a long stay with no expected discharge date", () => {
    const [flag] = strandedFlags([stay(LONG_STAY_PROMPT_DAYS)], NOW);
    expect(flag?.reasons).toEqual(["long-stay-no-plan"]);
    expect(strandedPromptText(flag!)).toBe("No expected discharge date recorded yet");
  });

  it("does not prompt a long stay that already has a plan, or a short stay without one", () => {
    expect(strandedFlags([stay(30, { expectedDischargeAt: NOW + MINUTES_PER_DAY })], NOW)).toEqual([]);
    expect(strandedFlags([stay(LONG_STAY_PROMPT_DAYS - 1)], NOW)).toEqual([]);
  });

  it("treats an unusable expected date as no plan", () => {
    expect(strandedFlags([stay(20, { expectedDischargeAt: Number.NaN })], NOW)[0]?.reasons).toEqual([
      "long-stay-no-plan",
    ]);
  });

  it("prompts every waiting-outside-the-ward hold, whatever the stay", () => {
    for (const blocker of STRANDED_WAITING_BLOCKERS) {
      const [flag] = strandedFlags([stay(1, { blockReason: blocker, expectedDischargeAt: NOW })], NOW);
      expect(flag?.reasons).toEqual(["ready-but-waiting"]);
      expect(flag?.waitingOn).toBe(blocker);
    }
    const [accommodation] = strandedFlags([stay(1, { blockReason: "Awaiting accommodation" })], NOW);
    expect(strandedPromptText(accommodation!)).toBe("Ready but waiting: accommodation");
  });

  it("ignores same-day logistics holds", () => {
    for (const blocker of ["Awaiting clean", "Awaiting pharmacy", "Awaiting transport"] as const) {
      expect(strandedFlags([stay(1, { blockReason: blocker, expectedDischargeAt: NOW })], NOW)).toEqual([]);
    }
  });

  it("carries both reasons when both apply", () => {
    const [flag] = strandedFlags([stay(40, { blockReason: "Funding or plan decision pending" })], NOW);
    expect(flag?.reasons).toEqual(["long-stay-no-plan", "ready-but-waiting"]);
    expect(strandedPromptText(flag!)).toBe(
      "No expected discharge date recorded yet · Ready but waiting: funding or plan decision pending",
    );
  });

  it("reads only people actually in a bed", () => {
    const pulled = stay(30, { state: "pulled", arrivedAt: null, blockReason: "Awaiting accommodation" });
    const departed = stay(30, { state: "departed", blockReason: "Awaiting accommodation" });
    expect(strandedFlags([pulled, departed], NOW)).toEqual([]);
  });

  it("orders longest stay first and stably", () => {
    const flags = strandedFlags([stay(10, { id: "b" }), stay(40, { id: "c" }), stay(10, { id: "a" })], NOW);
    expect(flags.map((flag) => flag.admissionId)).toEqual(["c", "a", "b"]);
  });

  it("finds at least one prompt in the synthetic seed, so the panel has something to show", () => {
    expect(strandedFlags(wardAdmissions, NOW).length).toBeGreaterThan(0);
  });

  it("triggers ready-but-waiting from an active bed release blocker", () => {
    const admission = stay(1, { blockReason: null, expectedDischargeAt: NOW });
    const activeRelease = release(admission.id, { blocker: "Awaiting accommodation" });
    const [flag] = strandedFlags([admission], NOW, [activeRelease]);
    expect(flag?.reasons).toEqual(["ready-but-waiting"]);
    expect(flag?.waitingOn).toBe("Awaiting accommodation");
    expect(strandedPromptText(flag!)).toBe("Ready but waiting: accommodation");
  });

  it("ignores bed release blocker when the release is already discharged", () => {
    const admission = stay(1, { blockReason: null, expectedDischargeAt: NOW });
    const dischargedRelease = release(admission.id, { state: "discharged", blocker: "Awaiting accommodation" });
    expect(strandedFlags([admission], NOW, [dischargedRelease])).toEqual([]);
  });

  it("ignores bed release blocker when it is a same-day logistics hold", () => {
    const admission = stay(1, { blockReason: null, expectedDischargeAt: NOW });
    const cleanRelease = release(admission.id, { blocker: "Awaiting clean" });
    expect(strandedFlags([admission], NOW, [cleanRelease])).toEqual([]);
  });
});
