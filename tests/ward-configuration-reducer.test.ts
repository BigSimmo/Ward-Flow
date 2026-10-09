import { describe, expect, it } from "vitest";

import { defaultWardConfiguration } from "@/components/ward-management/ward-configuration";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const validPayload = {
  edAccessTargetMinutes: 1200,
  parallelReferralCap: 2,
  pullHoldMinutes: 90,
  morningRollupDeadlineMinutes: 570,
  // The two due-time warnings (Josh, 26 Sept 2026, question 3), at their defaults.
  dueSoonUrgentMinutes: 60,
  dueSoonMinutes: 180,
  // Stream A, 9 Oct 2026: decision targets per step, at their defaults.
  referralDecisionTargetMinutes: 120,
  transferAcceptanceTargetMinutes: 240,
  transportBookedTargetMinutes: 60,
};

function setConfiguration(
  role: WardFlowEvent["role"],
  payload: unknown = validPayload,
): Extract<WardFlowEvent, { type: "SET_CONFIGURATION" }> {
  return { type: "SET_CONFIGURATION", role, now: NOW_ANCHOR, payload };
}

function movement(state: WardFlowState, id: string) {
  const found = state.movements.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing ${id}`);
  return found;
}

describe("SET_CONFIGURATION", () => {
  it("a coordinator's valid payload is accepted and applied", () => {
    const before = seedWardFlowState();
    const after = wardFlowReducer(before, setConfiguration("coordinator"));
    expect(after.configuration).toEqual(validPayload);
  });

  it("a coordinator can set a custom morningRollupDeadlineMinutes (e.g. 600)", () => {
    const before = seedWardFlowState();
    const customPayload = { ...validPayload, morningRollupDeadlineMinutes: 600 };
    const after = wardFlowReducer(before, setConfiguration("coordinator", customPayload));
    expect(after.configuration.morningRollupDeadlineMinutes).toBe(600);
    expect(after.configuration).toEqual(customPayload);
  });

  it.each([
    ["out-of-bounds low", 450],
    ["out-of-bounds high", 700],
    ["off-step", 575],
  ])(
    "refuses invalid morningRollupDeadlineMinutes (%s: %d), naming the field, and configuration is unchanged",
    (_desc, badDeadline) => {
      const before = seedWardFlowState();
      const after = wardFlowReducer(
        before,
        setConfiguration("coordinator", { ...validPayload, morningRollupDeadlineMinutes: badDeadline }),
      );
      expect(after.configuration).toEqual(before.configuration);
      expect(after.rejections.at(-1)?.reason).toContain("morningRollupDeadlineMinutes");
    },
  );

  it("accepts a legacy 3-key payload and defaults morningRollupDeadlineMinutes to 570", () => {
    const before = seedWardFlowState();
    const legacyPayload = { edAccessTargetMinutes: 1200, parallelReferralCap: 2, pullHoldMinutes: 90 };
    const after = wardFlowReducer(before, setConfiguration("coordinator", legacyPayload));
    expect(after.configuration).toEqual({
      ...legacyPayload,
      morningRollupDeadlineMinutes: 570,
      dueSoonUrgentMinutes: 60,
      dueSoonMinutes: 180,
      referralDecisionTargetMinutes: 120,
      transferAcceptanceTargetMinutes: 240,
      transportBookedTargetMinutes: 60,
    });
  });

  it.each(["ed", "ward", "officer", "demo", "community"] as const)(
    "role %s is refused, and configuration is unchanged",
    (role) => {
      const before = seedWardFlowState();
      const after = wardFlowReducer(before, setConfiguration(role));
      expect(after.configuration).toEqual(before.configuration);
      expect(after.configuration).toBe(before.configuration);
    },
  );

  it("an invalid payload is refused, naming the failing field, and configuration is unchanged", () => {
    const before = seedWardFlowState();
    const after = wardFlowReducer(before, setConfiguration("coordinator", { ...validPayload, pullHoldMinutes: 91 }));
    expect(after.configuration).toEqual(before.configuration);
    expect(after.rejections.at(-1)?.reason).toContain("pullHoldMinutes");
  });

  it("an accepted change writes exactly one audit event with outcome accepted and before/requested/after", () => {
    const before = seedWardFlowState();
    const after = wardFlowReducer(before, setConfiguration("coordinator"));
    const entries = after.auditEvents.filter((entry) => entry.category === "configuration");
    expect(entries).toHaveLength(1);
    const entry = entries[0];
    expect(entry.outcome).toBe("accepted");
    expect(entry.category).toBe("configuration");
    if (entry.category === "configuration") {
      expect(entry.details.before).toEqual(defaultWardConfiguration());
      expect(entry.details.requested).toEqual(validPayload);
      expect(entry.details.after).toEqual(validPayload);
    }
  });

  it("a refused change (bad role) writes exactly one audit event with outcome denied", () => {
    const before = seedWardFlowState();
    const after = wardFlowReducer(before, setConfiguration("ward"));
    const entries = after.auditEvents.filter((entry) => entry.category === "configuration");
    expect(entries).toHaveLength(1);
    expect(entries[0].outcome).toBe("denied");
    expect(entries[0].reasonCode).toBe("role");
  });

  it("a refused change (invalid payload) writes exactly one audit event with outcome denied", () => {
    const before = seedWardFlowState();
    const after = wardFlowReducer(before, setConfiguration("coordinator", { not: "a configuration" }));
    const entries = after.auditEvents.filter((entry) => entry.category === "configuration");
    expect(entries).toHaveLength(1);
    expect(entries[0].outcome).toBe("denied");
    expect(entries[0].reasonCode).toBe("invalid-payload");
  });

  it("RESET_SCENARIO restores the default configuration after a saved change", () => {
    const changed = wardFlowReducer(seedWardFlowState(), setConfiguration("coordinator"));
    expect(changed.configuration).toEqual(validPayload);
    const reset: WardFlowState = wardFlowReducer(changed, { type: "RESET_SCENARIO", role: "demo", now: NOW_ANCHOR });
    expect(reset.configuration).toEqual(defaultWardConfiguration());
  });

  it("SET_SCENARIO restores the default configuration after a saved change", () => {
    const changed = wardFlowReducer(seedWardFlowState(), setConfiguration("coordinator"));
    const reset: WardFlowState = wardFlowReducer(changed, {
      type: "SET_SCENARIO",
      role: "demo",
      now: NOW_ANCHOR,
      scenario: "standard",
    });
    expect(reset.configuration).toEqual(defaultWardConfiguration());
  });
});

// Task 4 of the audit-wiring plan, 2026-09-16: the three engine read sites that were reading
// `event.now + 60` and the two `PARALLEL_REFERRAL_CAP` constants now read `state.configuration`.
describe("engine read sites use configuration", () => {
  it("PULL_PATIENT holds a bed for the configured pullHoldMinutes, and an earlier pull keeps its own expiry", () => {
    // Setup copied from tests/ward-flow-reducer.test.ts's "holds" describe block.
    let state = seedWardFlowState();
    // T11 (item 8, owner answer 17 September 2026): WF-017 is referred to fsh-adult-secure below,
    // the network's Male-only bed — gender must be recorded first. Matches WF-017's own `sex`.
    state = {
      ...state,
      movements: state.movements.map((candidate) =>
        candidate.id === "WF-017" ? { ...candidate, gender: "Male" } : candidate,
      ),
    };
    state = wardFlowReducer(state, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: "WF-009",
      unitIds: ["rph-adult-secure"],
    });
    state = wardFlowReducer(state, {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now: NOW_ANCHOR,
      movementId: "WF-009",
      unitId: "rph-adult-secure",
    });
    state = wardFlowReducer(state, {
      type: "PULL_PATIENT",
      role: "ward",
      now: NOW_ANCHOR,
      movementId: "WF-009",
      unitId: "rph-adult-secure",
    });
    const earlierExpiry = movement(state, "WF-009").pullExpiresAt;
    expect(earlierExpiry).toBe(NOW_ANCHOR + 240);

    // The coordinator changes the configured hold to 120 minutes.
    state = wardFlowReducer(state, setConfiguration("coordinator", { ...validPayload, pullHoldMinutes: 120 }));

    // A second pull, on a different movement and unit, reads the new configured hold.
    state = wardFlowReducer(state, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: "WF-017",
      unitIds: ["fsh-adult-secure"],
    });
    state = wardFlowReducer(state, {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now: NOW_ANCHOR,
      movementId: "WF-017",
      unitId: "fsh-adult-secure",
    });
    state = wardFlowReducer(state, {
      type: "PULL_PATIENT",
      role: "ward",
      now: NOW_ANCHOR,
      movementId: "WF-017",
      unitId: "fsh-adult-secure",
    });
    expect(movement(state, "WF-017").pullExpiresAt).toBe(NOW_ANCHOR + 120);

    // The earlier pull's own expiry is untouched by the later configuration change.
    expect(movement(state, "WF-009").pullExpiresAt).toBe(earlierExpiry);
  });

  it("REFER_TO_UNITS reads the configured parallel cap: refuses above it naming the cap, accepts up to it, and never retroactively touches an existing referral", () => {
    // Setup copied from tests/ward-flow-reducer.test.ts's "referral" describe block.
    let state = seedWardFlowState();
    // T11 (item 8, owner answer 17 September 2026): WF-009 and WF-019 are both referred to
    // fsh-adult-secure below, the network's Male-only bed — gender must be recorded first for
    // each. Matches both movements' own `sex`.
    state = {
      ...state,
      movements: state.movements.map((candidate) =>
        candidate.id === "WF-009" || candidate.id === "WF-019" ? { ...candidate, gender: "Male" } : candidate,
      ),
    };
    state = wardFlowReducer(state, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: "WF-009",
      unitIds: ["rph-adult-secure", "fsh-adult-secure", "rgh-adult-secure"],
    });
    expect(movement(state, "WF-009").referredUnitIds).toHaveLength(3);

    // The coordinator lowers the configured cap to 2.
    state = wardFlowReducer(state, setConfiguration("coordinator", { ...validPayload, parallelReferralCap: 2 }));

    // The existing referral is untouched.
    expect(movement(state, "WF-009").referredUnitIds).toHaveLength(3);

    const refused = wardFlowReducer(state, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: "WF-019",
      unitIds: ["rph-adult-secure", "fsh-adult-secure", "rgh-adult-secure"],
    });
    expect(refused.rejections.at(-1)?.reason).toContain("2");
    expect(movement(refused, "WF-019").referredUnitIds).toHaveLength(0);

    const accepted = wardFlowReducer(state, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: "WF-019",
      unitIds: ["rph-adult-secure", "fsh-adult-secure"],
    });
    expect(movement(accepted, "WF-019").referredUnitIds).toHaveLength(2);
  });

  it("RECEIVE_REFERRAL refuses more destinations than the configured parallel cap", () => {
    let state = seedWardFlowState();
    state = wardFlowReducer(state, setConfiguration("coordinator", { ...validPayload, parallelReferralCap: 1 }));

    const receive: Extract<WardFlowEvent, { type: "RECEIVE_REFERRAL" }> = {
      type: "RECEIVE_REFERRAL",
      role: "community",
      now: NOW_ANCHOR,
      ageBand: "Adult",
      destinations: [
        {
          kind: "psychiatric_ward",
          sex: "Female",
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
        { kind: "emergency_department", edId: "rph-ed", purpose: "psychiatric_review" },
      ],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Armadale" },
      source: "community",
      urgency: 2,
      originSiteCode: "SCGH",
      transportNeeded: false,
      history: "",
    };
    const before = state.referrals.length;
    const after = wardFlowReducer(state, receive);
    expect(after.referrals).toHaveLength(before);
    expect(after.rejections.at(-1)?.reason).toContain("1");
  });
});
