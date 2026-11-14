import { describe, expect, it } from "vitest";

import { demoNetwork, type DemoNetworkVariant } from "@/components/ward-management/ward-demo-network";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { legalRecordWarnings } from "@/components/ward-management/ward-legal-order-rules";
import type { Movement } from "@/components/ward-management/ward-model";
import {
  SAMPLE_STORIES,
  SAMPLE_STORY_START,
  movementById,
  wardMovements,
} from "@/components/ward-management/ward-movements";
import { SAMPLE_OBSERVATION_MIX_LABEL } from "@/components/ward-management/ward-sample-choices";
import { WARD_SCENARIOS } from "@/components/ward-management/ward-scenarios";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// The held clinical PR's sample-day package (Josh, 13 Nov 2026). D-186 item 3: generated sample
// people are built from one story line each, and agree mechanically only (D-189 item 9(h)). D-187
// item 2: a Form 1A before the examination goes with "Referred for psychiatric examination", with
// Saoirse a named exception (D-189 item 9(b)). D-189 item 1: Calder, Keira, Saoirse and Cyril stay as
// they are. D-189 item 2: the observation mix is labelled, and no level changes. Synthetic data only.

const VARIANTS: readonly DemoNetworkVariant[] = ["demo", "surge", "quiet", "winter", "ed-crisis"];
const generated = () => wardMovements.filter((movement) => /^WF-3\d\d$/u.test(movement.id));
const WAITING = new Set(["placement_requested", "destination_review", "accepted_awaiting_bed", "pulled"]);

describe("D-186 item 3: each generated person is built from one story line", () => {
  it("gives every generated person a line, in order, with nothing left over", () => {
    const people = generated();
    expect(people).toHaveLength(SAMPLE_STORIES.length);
    expect(people.map((movement) => Number(movement.id.slice(3)) - SAMPLE_STORY_START)).toEqual(
      SAMPLE_STORIES.map((_, index) => index),
    );
  });

  it("takes the tier, wait, status, form, review and reason from that line", () => {
    for (const movement of generated()) {
      const [tier, openedMinutesAgo, status, form, review, reason] =
        SAMPLE_STORIES[Number(movement.id.slice(3)) - SAMPLE_STORY_START]!;
      expect(movement.urgency, movement.id).toBe(tier);
      expect(NOW_ANCHOR - movement.openedAt, movement.id).toBe(openedMinutesAgo);
      expect(movement.legalStatus, movement.id).toBe(status);
      expect(movement.legalForm?.code ?? null, movement.id).toBe(form);
      expect(movement.psychReview?.requestedAt ?? null, movement.id).toBe(
        review === null ? null : movement.openedAt + review,
      );
      expect(movement.blocker, movement.id).toBe(reason);
    }
  });

  it("agrees mechanically: the status and form pass the legal order rules, and a review follows arrival", () => {
    for (const [index, [, , status, form, review]] of SAMPLE_STORIES.entries()) {
      const pairing = {
        legalStatus: status,
        legalForm: form ? { code: form, kind: "examination" as const } : undefined,
      };
      expect(legalRecordWarnings(pairing), `line ${index}`).toEqual([]);
      if (review !== null) expect(review, `line ${index}`).toBeGreaterThan(0);
    }
    for (const movement of generated()) {
      expect(legalRecordWarnings(movement), movement.id).toEqual([]);
      if (movement.psychReview) expect(movement.psychReview.requestedAt).toBeGreaterThan(movement.openedAt);
    }
  });

  it("gives a reason that fits the stage: no one on the road or arrived waits on a ward's answer", () => {
    for (const movement of generated()) {
      if (movement.stage === "moving") expect(movement.blocker, movement.id).toBe("None — in transit");
      else if (movement.stage === "arrived") expect(movement.blocker, movement.id).toBe("None — handover complete");
      else {
        expect(WAITING.has(movement.stage), movement.id).toBe(true);
        expect(["Awaiting destination response", "No blocker"], movement.id).toContain(movement.blocker);
      }
    }
  });

  it("builds the demo network's waiting people from story lines that pass the legal order rules", () => {
    for (const variant of VARIANTS)
      for (const movement of demoNetwork(variant).movements)
        expect(legalRecordWarnings(movement), `${variant} ${movement.id}`).toEqual([]);
  });
});

/** A Form 1A on file with no examination recorded, held with "Detained awaiting examination". */
const detainedOnA1A = (movement: Movement) =>
  movement.legalStatus === "Detained awaiting examination" &&
  movement.legalForm?.code === "1A" &&
  movement.examination === undefined;

describe("D-187 item 2: a Form 1A before the examination reads Referred for psychiatric examination", () => {
  it("leaves no Detained-with-1A pairing in the sample day, except Saoirse (D-189 item 9(b))", () => {
    expect(
      seedWardFlowState()
        .movements.filter(detainedOnA1A)
        .map((movement) => movement.id),
    ).toEqual(["WF-010"]);
    for (const scenario of WARD_SCENARIOS)
      for (const movement of seedWardFlowState(scenario).movements.filter(detainedOnA1A))
        expect(movement.id, scenario).toBe("WF-010");
  });

  it("leaves none in any demo network", () => {
    for (const variant of VARIANTS)
      expect(
        demoNetwork(variant)
          .movements.filter(detainedOnA1A)
          .map((movement) => movement.id),
        variant,
      ).toEqual([]);
  });

  it("reads PT-047's ED stay (WF-005) as referred, its form unchanged", () => {
    const stay = movementById("WF-005")!;
    expect(stay.legalStatus).toBe("Referred for psychiatric examination");
    expect(stay.legalForm).toEqual({ code: "1A", kind: "examination" });
    expect(stay.statusChanges).toEqual([]);
  });
});

describe("D-189 item 1: Calder, Keira, Saoirse and Cyril stay as they run today", () => {
  it("keeps Calder (WF-312): tier 1, 13 h 24 m in ED, referred on a 1A, no review, no blocker", () => {
    const calder = movementById("WF-312")!;
    expect([calder.urgency, NOW_ANCHOR - calder.openedAt, calder.legalStatus, calder.legalForm?.code]).toEqual([
      1,
      804,
      "Referred for psychiatric examination",
      "1A",
    ]);
    expect(calder.psychReview).toBeUndefined();
    expect(calder.blocker).toBe("No blocker");
  });

  it("keeps Keira (WF-003): tier 1, locked, general observation, Form 3B", () => {
    const keira = movementById("WF-003")!;
    expect([keira.patientId, keira.urgency, keira.security, keira.observation.level]).toEqual([
      "PT-045",
      1,
      "Secure",
      "general",
    ]);
    expect([keira.legalStatus, keira.legalForm?.code]).toEqual(["Involuntary inpatient", "3B"]);
  });

  it("keeps Saoirse (WF-010) detained awaiting examination on a 1A, with the change that put her there", () => {
    const saoirse = movementById("WF-010")!;
    expect([saoirse.patientId, saoirse.legalStatus, saoirse.legalForm?.code]).toEqual([
      "PT-051",
      "Detained awaiting examination",
      "1A",
    ]);
    expect(saoirse.statusChanges.map((change) => [change.from, change.to])).toEqual([
      ["Voluntary", "Detained awaiting examination"],
    ]);
  });

  it("keeps Cyril's referral (RF-005) on his record", () => {
    const cyril = seedWardFlowState().referrals.find((referral) => referral.id === "RF-005")!;
    expect([cyril.patientId, cyril.ageBand, cyril.source]).toEqual(["PT-060", "Older adult", "ambulance"]);
  });
});

describe("D-189 item 2: the observation mix is labelled, and no level changes", () => {
  it("names the label in the ruling's words", () => {
    expect(SAMPLE_OBSERVATION_MIX_LABEL).toBe("Sample mix, not clinical guidance");
  });

  const levels = (list: readonly { observation?: { level: string; intervalMinutes?: number | null } }[]) => {
    const out: Record<string, number> = {};
    for (const item of list) {
      const key = item.observation
        ? `${item.observation.level}${item.observation.intervalMinutes ? `:${item.observation.intervalMinutes}` : ""}`
        : "none";
      out[key] = (out[key] ?? 0) + 1;
    }
    return out;
  };

  it("keeps the sample day's observation levels as they were before the stories", () => {
    const seed = seedWardFlowState();
    // D-209 item 3 (Josh, 14 Nov 2026): Saoirse (WF-010) moves from General to Intermittent, every 30 minutes.
    expect(levels(seed.movements)).toEqual({ general: 50, within_sight: 9, "intermittent:30": 1 });
    expect(levels(seed.admissions)).toEqual({ general: 311 });
    expect(Object.fromEntries(VARIANTS.map((variant) => [variant, levels(demoNetwork(variant).movements)]))).toEqual({
      demo: { general: 15, within_sight: 8 },
      surge: { general: 22, within_sight: 10 },
      quiet: { general: 5, within_sight: 4 },
      winter: { general: 29, within_sight: 11 },
      "ed-crisis": { general: 33, within_sight: 12 },
    });
    expect(levels(demoNetwork("demo").admissions)).toEqual({ general: 198, within_sight: 8, "intermittent:15": 71 });
  });
});
