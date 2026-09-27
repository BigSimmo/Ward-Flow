// tests/ward-refusal-gaps-new-actions.test.ts
//
// REFUSALS NO TEST HAD EVER REACHED — the repatriation log and the network-wide alert.
//
// `RECORD_REPATRIATION` and the three broadcast-alert actions arrived together in 65090c4db6. A full
// coverage run on 25 September (`docs/ward-flow/journey/refusal-coverage.json`) showed ten of their
// refusals had never executed: every answer the repatriation log insists on except the first two,
// and every refusal the alerts have. The existing repatriation tests send one well-formed log and
// one duplicate, so each "must be answered, and it has no default" guard was present and unproven.
//
// 🔴 EVERY CASE CARRIES ITS CONTROL. The repatriation log checks nine things in a row, so a test
// asserting only "it was refused" would pass while the guard it names never ran. Each case sends
// the SAME log twice, changing one field, and requires the named refusal in the first and its
// absence in the second.
import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { TRANSPORT_PROVIDERS } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

/** The cast IS the test: each of these is a value the type forbids and a stored or replayed event can carry. */
const OFF_LIST = "not-a-value-this-model-knows";

function added(before: WardFlowState, after: WardFlowState) {
  return after.rejections.slice(before.rejections.length).map((rejection) => rejection.reason);
}

function repatriation(state: WardFlowState, overrides: Record<string, unknown> = {}) {
  const admission = state.admissions[0];
  if (!admission) throw new Error("the seed holds no admission, so no repatriation can be logged");
  return wardFlowReducer(state, {
    type: "RECORD_REPATRIATION",
    role: "coordinator",
    now: NOW,
    admissionId: admission.id,
    homeHospital: "RPH",
    receivingWardAgreed: true,
    mode: "road",
    provider: TRANSPORT_PROVIDERS[0],
    cadNumber: "CAD-4412",
    transportLegalStatus: "voluntary",
    estimatedAt: NOW + 90,
    ...overrides,
  } as never);
}

describe("RECORD_REPATRIATION refuses a log with any answer missing or off its list", () => {
  it("the base log this file varies is itself accepted", () => {
    // Without this, every case below could pass on a log refused for some other reason entirely.
    const seeded = seedWardFlowState();
    expect(added(seeded, repatriation(seeded))).toEqual([]);
  });

  const cases: Array<[string, Record<string, unknown>, Record<string, unknown>, string]> = [
    [
      "a home hospital that names no real site",
      { homeHospital: "NOT-A-SITE" },
      { homeHospital: "RPH" },
      "RECORD_REPATRIATION homeHospital NOT-A-SITE does not name a real site",
    ],
    [
      "whether the receiving ward agreed, left unanswered",
      { receivingWardAgreed: undefined },
      { receivingWardAgreed: false },
      "RECORD_REPATRIATION receivingWardAgreed must be answered, and it has no default",
    ],
    [
      "a mode that is neither road nor flight",
      { mode: OFF_LIST },
      { mode: "flight" },
      "RECORD_REPATRIATION mode must be chosen from REPATRIATION_MODES",
    ],
    [
      "a provider not on the list",
      { provider: OFF_LIST },
      { provider: TRANSPORT_PROVIDERS[1] },
      "RECORD_REPATRIATION provider must be chosen from TRANSPORT_PROVIDERS",
    ],
    [
      "a CAD number that is only whitespace",
      { cadNumber: "   " },
      { cadNumber: "CAD-1" },
      "RECORD_REPATRIATION cadNumber must be answered, and it has no default",
    ],
    [
      "voluntary or involuntary, off its list",
      { transportLegalStatus: OFF_LIST },
      { transportLegalStatus: "involuntary" },
      "RECORD_REPATRIATION transportLegalStatus must be chosen from TRANSPORT_LEGAL_STATUSES",
    ],
    [
      "an estimated time that is not a number",
      { estimatedAt: undefined },
      { estimatedAt: NOW + 30 },
      "RECORD_REPATRIATION estimatedAt must be answered, and it has no default",
    ],
  ];

  for (const [what, bad, good, message] of cases) {
    it(`refuses ${what}, and not once it is answered`, () => {
      const seeded = seedWardFlowState();

      const refused = repatriation(seeded, bad);
      expect(added(seeded, refused)).toEqual([message]);
      expect(refused.repatriations ?? [], "a refused log must write nothing").toHaveLength(
        (seeded.repatriations ?? []).length,
      );

      const control = repatriation(seeded, good);
      expect(added(seeded, control)).not.toContain(message);
      expect(added(seeded, control)).toEqual([]);
    });
  }
});

function dispatchAlert(state: WardFlowState, overrides: Record<string, unknown> = {}) {
  return wardFlowReducer(state, {
    type: "DISPATCH_BROADCAST_ALERT",
    role: "coordinator",
    now: NOW,
    title: "ED surge",
    message: "Three departments over their access target.",
    severity: "warning",
    category: "ed_surge",
    targetScope: "all",
    targetScopeLabel: "All inpatient units",
    durationMinutes: 120,
    dispatchedByName: "State Bed Desk",
    ...overrides,
  } as never);
}

describe("the network-wide alert refuses what it cannot act on", () => {
  it("DISPATCH_BROADCAST_ALERT refuses a blank title or message, and not once both are written", () => {
    const seeded = seedWardFlowState();
    const message = "DISPATCH_BROADCAST_ALERT requires a non-empty title and message";

    expect(added(seeded, dispatchAlert(seeded, { title: "  " }))).toEqual([message]);
    expect(added(seeded, dispatchAlert(seeded, { message: "" }))).toEqual([message]);

    const control = dispatchAlert(seeded);
    expect(added(seeded, control)).toEqual([]);
    expect(control.broadcastAlerts ?? []).toHaveLength((seeded.broadcastAlerts ?? []).length + 1);
  });

  it("ACKNOWLEDGE_BROADCAST_ALERT refuses an alert that does not exist, and not one that does", () => {
    const withAlert = dispatchAlert(seedWardFlowState());
    const alertId = withAlert.broadcastAlerts?.[0]?.id;
    expect(alertId, "the control needs a real alert").toBeDefined();
    const unitId = withAlert.units[0]!.id;

    const refused = wardFlowReducer(withAlert, {
      type: "ACKNOWLEDGE_BROADCAST_ALERT",
      role: "ward",
      now: NOW,
      alertId: "BCAST-NOT-REAL",
      unitId,
    });
    expect(added(withAlert, refused)).toEqual(["ACKNOWLEDGE_BROADCAST_ALERT alertId BCAST-NOT-REAL not found"]);

    const control = wardFlowReducer(withAlert, {
      type: "ACKNOWLEDGE_BROADCAST_ALERT",
      role: "ward",
      now: NOW,
      alertId: alertId!,
      unitId,
    });
    expect(added(withAlert, control)).toEqual([]);
    expect(control.broadcastAlerts?.[0]?.acknowledgedUnits).toContain(unitId);
  });

  it("STAND_DOWN_BROADCAST_ALERT refuses an alert that does not exist, and not one that does", () => {
    const withAlert = dispatchAlert(seedWardFlowState());
    const alertId = withAlert.broadcastAlerts?.[0]?.id;
    expect(alertId, "the control needs a real alert").toBeDefined();

    const refused = wardFlowReducer(withAlert, {
      type: "STAND_DOWN_BROADCAST_ALERT",
      role: "coordinator",
      now: NOW,
      alertId: "BCAST-NOT-REAL",
    });
    expect(added(withAlert, refused)).toEqual(["STAND_DOWN_BROADCAST_ALERT alertId BCAST-NOT-REAL not found"]);

    const control = wardFlowReducer(withAlert, {
      type: "STAND_DOWN_BROADCAST_ALERT",
      role: "coordinator",
      now: NOW,
      alertId: alertId!,
    });
    expect(added(withAlert, control)).toEqual([]);
    expect(control.broadcastAlerts?.[0]?.status).toBe("stood_down");
  });
});
