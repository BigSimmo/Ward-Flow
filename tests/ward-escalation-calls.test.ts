/**
 * Escalation: who to call and what happened (item 3, D-133). Each ED wait step (D-108) names an
 * on-call role; a recorded call holds a step, that role, one outcome from the fixed list, a time and
 * the desk. Synthetic seed and mock directory numbers only.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ESCALATION_CALL_OUTCOMES,
  ESCALATION_CALL_OUTCOME_LABELS,
  ESCALATION_STEP_ROLE,
  escalationCallText,
  lastEscalationCall,
} from "@/components/ward-management/escalation/escalation-calls";
import { escalationContact, escalationEntry } from "@/components/ward-management/escalation-contact";
import { EVENT_ROLE } from "@/components/ward-management/ward-flow-event-roles";
import { buildOnCallDirectory, MOCK_NUMBER_PREFIX } from "@/components/ward-management/on-call/on-call-directory";
import { edWaitStep } from "@/components/ward-management/ward-ed-wait-steps";
import { isEdOriginJourney } from "@/components/ward-management/ward-ed-presence";
import {
  ED_ELEVATED_PRESSURE_WAIT_MINUTES,
  ED_SEVERE_PRESSURE_WAIT_MINUTES,
  LONG_WAIT_MINUTES,
  VERY_LONG_WAIT_MINUTES,
} from "@/components/ward-management/ward-operational-defaults";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { NOW_ANCHOR, wardSites } from "@/components/ward-management/ward-sites";
import type { Movement } from "@/components/ward-management/ward-model";

const apply = (state: WardFlowState, event: WardFlowEvent) => wardFlowReducer(state, event);
const refusals = (before: WardFlowState, after: WardFlowState) =>
  after.rejections.slice(before.rejections.length).map((rejection) => rejection.reason);

const stepAtAnchor = (movement: Movement) => edWaitStep(Math.max(NOW_ANCHOR - movement.openedAt, 0))?.step ?? 0;

/** An open ED wait that has reached Step 4 at the anchor, so a call at any step is in time. */
function openMovement(state: WardFlowState): Movement {
  const movement = state.movements.find(
    (candidate) => !candidate.closure && isEdOriginJourney(candidate) && stepAtAnchor(candidate) === 4,
  );
  if (!movement) throw new Error("seed has no open ED wait at Step 4");
  return movement;
}

const call = (
  movementId: string,
  overrides: Partial<Extract<WardFlowEvent, { type: "RECORD_ESCALATION_CALL" }>> = {},
) =>
  ({
    type: "RECORD_ESCALATION_CALL",
    role: "ed",
    now: NOW_ANCHOR,
    movementId,
    step: 2,
    roleCalled: "site_bed_manager",
    outcome: "no_answer",
    ...overrides,
  }) as WardFlowEvent;

describe("escalation step to role", () => {
  it("maps each D-108 step to its on-call role, step wording unchanged", () => {
    expect(ESCALATION_STEP_ROLE).toEqual({
      1: "service_bed_coordinator",
      2: "site_bed_manager",
      3: "state_bed_desk",
      4: "executive_on_call",
    });
    // D-108's own wording stays as signed off.
    expect(edWaitStep(Number.MAX_SAFE_INTEGER)?.nextStep).toBe("Tell the executive on call");
  });

  it("finds a directory entry for every step at every ED site, from the synthetic directory", () => {
    const entries = buildOnCallDirectory();
    for (const site of wardSites.filter((candidate) => candidate.emergencyDepartment)) {
      for (const step of [1, 2, 3, 4] as const) {
        const contact = escalationContact(
          step,
          { siteCode: site.code, service: site.service },
          entries,
          undefined,
          NOW_ANCHOR,
        );
        expect(contact, `${site.code} step ${step}`).toBeDefined();
        expect(contact!.checked).toMatch(/^Checked /);
        if (contact!.number) expect(contact!.number.startsWith(MOCK_NUMBER_PREFIX)).toBe(true);
      }
    }
  });

  it("names the site bed manager at Step 2 and the service executive at Step 4", () => {
    const entries = buildOnCallDirectory();
    const site = wardSites.find((candidate) => candidate.emergencyDepartment && candidate.units.length > 0)!;
    const where = { siteCode: site.code, service: site.service };
    const step2 = escalationEntry("site_bed_manager", where, entries)!;
    expect(step2.kind).toBe("afterHours");
    expect(step2.siteCode).toBe(site.code);
    expect(step2.ownerRole).toBe("bed_manager");
    const step4 = escalationEntry("executive_on_call", where, entries)!;
    expect(step4.kind).toBe("executive");
    expect(step4.service).toBe(site.service);
    expect(escalationEntry("state_bed_desk", where, entries)!.id).toBe("sw-bfc");
  });

  it("gives every directory entry an owner desk", () => {
    const entries = buildOnCallDirectory();
    expect(entries.every((entry) => ["bed_manager", "coordinator", "community"].includes(entry.ownerRole))).toBe(true);
    expect(entries.find((entry) => entry.id === "sw-bfc")!.ownerRole).toBe("coordinator");
  });
});

describe("D-108 guard: escalation calls change no step, hour or order", () => {
  it("keeps D-108's step wording and hours exactly", () => {
    const thresholds = [
      ED_ELEVATED_PRESSURE_WAIT_MINUTES,
      ED_SEVERE_PRESSURE_WAIT_MINUTES,
      LONG_WAIT_MINUTES,
      VERY_LONG_WAIT_MINUTES,
    ];
    const steps = thresholds.map((minutes) => edWaitStep(minutes));
    expect(steps.map((step) => [step?.step, step?.fromMinutes, step?.nextStep])).toEqual([
      [1, thresholds[0], "Ask wards with a free bed"],
      [2, thresholds[1], "Call the site bed manager"],
      [3, thresholds[2], "Consider an out-of-area bed and add to the bed meeting"],
      [4, thresholds[3], "Tell the executive on call"],
    ]);
    expect(edWaitStep(thresholds[0]! - 1)).toBeUndefined();
  });

  it("adds no clock, countdown or overdue colour to the escalation files", () => {
    const root = join(process.cwd(), "src/components/ward-management");
    const dir = join(root, "escalation");
    // The contact lookup and the wait-step button sit at the ward root so other screens can load
    // them without importing a screen folder; the same guard covers them.
    const files = [
      ...readdirSync(dir).map((file) => join(dir, file)),
      join(root, "escalation-contact.ts"),
      join(root, "escalation-step-call.tsx"),
    ];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/setInterval|setTimeout|useMinuteNow|minutesUntil|clockState|isClockBreached/u);
      expect(source, file).not.toMatch(/--wf-danger|tone="danger"|tone="warning"/u);
    }
  });

  it("records only: nothing but the movement's escalation calls changes (D-71 order untouched)", () => {
    const seeded = seedWardFlowState();
    const movementId = openMovement(seeded).id;
    const after = apply(seeded, call(movementId));
    expect(after.movements.map((movement) => movement.id)).toEqual(seeded.movements.map((movement) => movement.id));
    const strip = (state: WardFlowState) =>
      state.movements.map((movement) => {
        const rest = { ...movement };
        delete rest.escalationCalls;
        return rest;
      });
    expect(strip(after)).toEqual(strip(seeded));
    expect(after.referrals).toEqual(seeded.referrals);
    expect(after.units).toEqual(seeded.units);
  });
});

describe("RECORD_ESCALATION_CALL", () => {
  it("is recorded by the ED and the coordinator only", () => {
    expect([...EVENT_ROLE.RECORD_ESCALATION_CALL].sort()).toEqual(["coordinator", "ed"]);
    const seeded = seedWardFlowState();
    const movementId = openMovement(seeded).id;
    const ward = apply(seeded, call(movementId, { role: "ward" }));
    expect(refusals(seeded, ward)).toHaveLength(1);
    expect(openMovement(ward).escalationCalls).toBeUndefined();
  });

  it("records the latest call per step and reads back as a fact", () => {
    const seeded = seedWardFlowState();
    const movementId = openMovement(seeded).id;
    const first = apply(seeded, call(movementId));
    expect(refusals(seeded, first)).toEqual([]);
    const second = apply(
      first,
      call(movementId, { role: "coordinator", now: NOW_ANCHOR + 30, outcome: "agreed_plan" }),
    );
    const movement = second.movements.find((candidate) => candidate.id === movementId)!;
    expect(movement.escalationCalls).toEqual([
      { step: 2, roleCalled: "site_bed_manager", outcome: "agreed_plan", at: NOW_ANCHOR + 30, by: "coordinator" },
    ]);
    expect(escalationCallText(lastEscalationCall(movement, 2)!, NOW_ANCHOR + 30)).toMatch(/^Agreed a plan \d\d:\d\d$/);
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(second)))).toBe(true);
  });

  it("takes outcomes only from the fixed list", () => {
    expect(ESCALATION_CALL_OUTCOMES.map((outcome) => ESCALATION_CALL_OUTCOME_LABELS[outcome])).toEqual([
      "Agreed a plan",
      "No bed",
      "No answer",
      "Left a message",
    ]);
    const seeded = seedWardFlowState();
    const movementId = openMovement(seeded).id;
    const typed = apply(seeded, call(movementId, { outcome: "rang twice" as never }));
    expect(refusals(seeded, typed)).toEqual(["RECORD_ESCALATION_CALL outcome is not on the fixed list"]);
  });

  it("refuses a role that is not the step's, a step off the ladder and an unknown movement", () => {
    const seeded = seedWardFlowState();
    const movementId = openMovement(seeded).id;
    const wrongRole = apply(seeded, call(movementId, { roleCalled: "executive_on_call" }));
    expect(refusals(seeded, wrongRole)).toEqual(["RECORD_ESCALATION_CALL roleCalled is not the role for that step"]);
    const wrongStep = apply(seeded, call(movementId, { step: 5 as never }));
    expect(refusals(seeded, wrongStep)).toEqual(["RECORD_ESCALATION_CALL step must be 1 to 4"]);
    const unknown = apply(seeded, call("MV-NOT-REAL"));
    expect(refusals(seeded, unknown)).toHaveLength(1);
  });

  it("refuses a step the wait has not reached yet, and a journey that is not an ED wait", () => {
    const seeded = seedWardFlowState();
    const early = seeded.movements.find(
      (candidate) => !candidate.closure && isEdOriginJourney(candidate) && stepAtAnchor(candidate) === 1,
    )!;
    const tooSoon = apply(seeded, call(early.id, { step: 4, roleCalled: "executive_on_call" }));
    expect(refusals(seeded, tooSoon)).toEqual(["That escalation step has not been reached yet."]);
    // An earlier step than the current one stays recordable: a call made then can be noted late.
    expect(refusals(seeded, apply(seeded, call(early.id, { step: 1, roleCalled: "service_bed_coordinator" })))).toEqual(
      [],
    );
    const transfer = seeded.movements.find((candidate) => !candidate.closure && !isEdOriginJourney(candidate));
    if (transfer) {
      expect(refusals(seeded, apply(seeded, call(transfer.id)))).toEqual(["Escalation calls are for an ED wait only."]);
    }
  });

  it("refuses a stored call with typed text or an outcome off the list", () => {
    const seeded = seedWardFlowState();
    const movementId = openMovement(seeded).id;
    const recorded = apply(seeded, call(movementId));
    const tamper = (patch: Record<string, unknown>) => ({
      ...recorded,
      movements: recorded.movements.map((movement) =>
        movement.id === movementId
          ? { ...movement, escalationCalls: [{ ...movement.escalationCalls![0]!, ...patch }] }
          : movement,
      ),
    });
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(tamper({}))))).toBe(true);
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(tamper({ outcome: "spoke to the registrar" }))))).toBe(
      false,
    );
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(tamper({ note: "typed" }))))).toBe(false);
  });
});
