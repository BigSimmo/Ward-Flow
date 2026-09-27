import { describe, expect, it } from "vitest";

import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { LEGAL_CLOCK_FORM_CODES } from "@/components/ward-management/ward-legal-clock";
import { TRANSPORT_PROVIDERS } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

function movementWithForm(code: string | undefined): { before: WardFlowState; movementId: string } {
  const seeded = seedWardFlowState();
  const source = seeded.movements.find((movement) => !movement.closure);
  if (!source) throw new Error("seed must include an open movement");
  const movementId = `WF-FIVE-GAPS-${code ?? "none"}`;
  const before: WardFlowState = {
    ...seeded,
    movements: [
      ...seeded.movements,
      {
        ...source,
        id: movementId as typeof source.id,
        legalForm: code === undefined ? undefined : { code },
        legalClock: undefined,
        legalFormReceivedAt: undefined,
        closure: undefined,
      },
    ],
  };
  return { before, movementId };
}

describe("RECORD_LEGAL_FORM_RECEIVED accepts the nine clock forms", () => {
  it.each([...LEGAL_CLOCK_FORM_CODES])("accepts Form %s", (code) => {
    const { before, movementId } = movementWithForm(code);
    const after = wardFlowReducer(before, {
      type: "RECORD_LEGAL_FORM_RECEIVED",
      role: "ed",
      now: NOW,
      movementId,
    });
    expect(after.rejections, after.rejections.at(-1)?.reason).toEqual([]);
    expect(after.movements.find((candidate) => candidate.id === movementId)?.legalFormReceivedAt).toBe(NOW);
  });

  it("refuses a movement with no legal form", () => {
    const { before, movementId } = movementWithForm(undefined);
    const after = wardFlowReducer(before, {
      type: "RECORD_LEGAL_FORM_RECEIVED",
      role: "ed",
      now: NOW,
      movementId,
    });
    expect(after.rejections.length).toBeGreaterThan(0);
    expect(after.rejections.at(-1)?.reason).toMatch(/receivable legal form/);
    expect(after.movements.find((candidate) => candidate.id === movementId)?.legalFormReceivedAt).toBeUndefined();
  });

  it("refuses Form 3B, which is not one of the receivable codes", () => {
    const { before, movementId } = movementWithForm("3B");
    const after = wardFlowReducer(before, {
      type: "RECORD_LEGAL_FORM_RECEIVED",
      role: "ed",
      now: NOW,
      movementId,
    });
    expect(after.rejections.length).toBeGreaterThan(0);
    expect(after.rejections.at(-1)?.reason).toMatch(/3B/);
    expect(after.movements.find((candidate) => candidate.id === movementId)?.legalFormReceivedAt).toBeUndefined();
  });
});

describe("RECORD_REPATRIATION is one phone-log, not an in-app booking", () => {
  function dispatch(state: WardFlowState, admissionId: string, overrides: Record<string, unknown> = {}) {
    return wardFlowReducer(state, {
      type: "RECORD_REPATRIATION",
      role: "coordinator",
      now: NOW,
      admissionId,
      homeHospital: "RPH",
      receivingWardAgreed: true,
      mode: "road",
      provider: TRANSPORT_PROVIDERS[0],
      cadNumber: "CAD-4412",
      transportLegalStatus: "voluntary",
      estimatedAt: NOW + 90,
      ...overrides,
    } as Parameters<typeof wardFlowReducer>[1]);
  }

  it("stores home hospital, receiving-ward agreement, road or flight, and the phone-log fields", () => {
    const before = seedWardFlowState();
    const admission = before.admissions[0];
    expect(admission, "seed must include an admission").toBeDefined();
    const jobsBefore = before.movements.filter((movement) => movement.transport !== undefined).length;

    const after = dispatch(before, admission!.id);
    expect(after.rejections, after.rejections.at(-1)?.reason).toEqual([]);
    expect(after.repatriations).toHaveLength(1);
    expect(after.repatriations[0]).toEqual({
      admissionId: admission!.id,
      at: NOW,
      by: "coordinator",
      homeHospital: "RPH",
      receivingWardAgreed: true,
      mode: "road",
      provider: TRANSPORT_PROVIDERS[0],
      cadNumber: "CAD-4412",
      transportLegalStatus: "voluntary",
      estimatedAt: NOW + 90,
    });
    expect(after.movements.filter((movement) => movement.transport !== undefined)).toHaveLength(jobsBefore);
  });

  it("refuses a second record for the same admission", () => {
    const before = seedWardFlowState();
    const admissionId = before.admissions[0]!.id;
    const first = dispatch(before, admissionId);
    const second = dispatch(first, admissionId, { cadNumber: "CAD-4413", mode: "flight" });
    expect(second.rejections.at(-1)?.reason).toMatch(/already has a repatriation record/);
    expect(second.repatriations).toHaveLength(1);
  });
});

describe("RECORD_HANDOVER_SIGN_OFF stores role and time only", () => {
  it("appends the caller's role and the instant, and nothing else", () => {
    const before = seedWardFlowState();
    const after = wardFlowReducer(before, {
      type: "RECORD_HANDOVER_SIGN_OFF",
      role: "coordinator",
      now: NOW,
    });
    expect(after.rejections).toEqual([]);
    expect(after.handoverSignOffs).toEqual([{ at: NOW, by: "coordinator" }]);
    expect(Object.keys(after.handoverSignOffs[0]!).sort()).toEqual(["at", "by"]);
  });
});

describe("RECORD_CLINICAL_CONTACT stores team, time, and role", () => {
  it("records the contact and does not invent a sent message", () => {
    const teamId = COMMUNITY_TEAM_PAGES[0]?.id;
    expect(teamId, "community team list must not be empty").toBeDefined();
    const before = seedWardFlowState();
    const after = wardFlowReducer(before, {
      type: "RECORD_CLINICAL_CONTACT",
      role: "community",
      now: NOW,
      teamId: teamId!,
    });
    expect(after.rejections, after.rejections.at(-1)?.reason).toEqual([]);
    expect(after.clinicalContacts).toEqual([{ teamId, at: NOW, by: "community" }]);
    expect(after.notices).toEqual(before.notices);
  });

  it("refuses an unknown team", () => {
    const after = wardFlowReducer(seedWardFlowState(), {
      type: "RECORD_CLINICAL_CONTACT",
      role: "community",
      now: NOW,
      teamId: "no-such-team",
    });
    expect(after.rejections.at(-1)?.reason).toMatch(/does not name a real team/);
    expect(after.clinicalContacts).toEqual([]);
  });
});

describe("RECORD_ESCALATION still only records the escalation", () => {
  it("stores the instant, tried units and contact, and does not mark a transmission", () => {
    const before = seedWardFlowState();
    const movement = before.movements.find((candidate) => !candidate.closure);
    expect(movement).toBeDefined();
    const after = wardFlowReducer(before, {
      type: "RECORD_ESCALATION",
      role: "coordinator",
      now: NOW,
      movementId: movement!.id,
      triedUnitIds: [before.units[0]!.id],
      contact: "State bed management",
    });
    expect(after.rejections, after.rejections.at(-1)?.reason).toEqual([]);
    expect(after.movements.find((candidate) => candidate.id === movement!.id)?.escalation).toEqual({
      at: NOW,
      triedUnitIds: [before.units[0]!.id],
      contact: "State bed management",
    });
    expect(JSON.stringify(after.movements.find((candidate) => candidate.id === movement!.id)?.escalation)).not.toMatch(
      /transmit/i,
    );
  });
});
