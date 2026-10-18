import { describe, expect, it } from "vitest";
import { SCHEMA_TYPES, validSharedCommand } from "../backend/ward-flow/command-schemas";
import { EVENT_ROLE, type WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { CHART_MAX_BYTES } from "@/components/ward-management/referrals/referral-submission";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { buildTurnaroundFixture } from "./helpers/ward-turnaround-fixture";
import { nextEvent, seededRandom } from "./helpers/ward-engine-fuzz";

const allowed = (event: WardFlowEvent) => (EVENT_ROLE[event.type] as readonly string[]).includes(event.role);

describe("shared command schemas", () => {
  it("accept every event the engine itself accepts, across generated sequences", () => {
    // The generator also sends malformed and refused events on purpose. A schema may refuse those;
    // it must never refuse an event the reducer would have accepted.
    const refused: string[] = [];
    const accepted = new Set<string>();
    for (let seed = 1; seed <= 25; seed += 1) {
      const random = seededRandom(seed);
      let state = seedWardFlowState();
      for (let step = 0; step < 120; step += 1) {
        const event = nextEvent(state, random, step);
        let next = state;
        try {
          next = wardFlowReducer(state, event);
        } catch {
          continue;
        }
        if (allowed(event) && next !== state && next.rejections.length === state.rejections.length) {
          accepted.add(event.type);
          const sent = JSON.parse(JSON.stringify(event));
          if (!validSharedCommand(sent)) refused.push(`${event.type} ${JSON.stringify(sent).slice(0, 200)}`);
        }
        state = next;
      }
    }
    // These commands require a current occupied departure; random unrelated events rarely
    // construct that narrow window. Build it through real commands, then exercise both schemas.
    const fixture = buildTurnaroundFixture();
    for (const event of [
      {
        type: "FLAG_MOVEMENT_TURNAROUND_PRIORITY",
        role: "coordinator",
        now: fixture.now,
        movementId: fixture.movementId,
        unitId: fixture.unitId,
        source: "departure",
      },
      {
        type: "FLAG_REFERRAL_TURNAROUND_PRIORITY",
        role: "coordinator",
        now: fixture.now,
        referralId: fixture.referralId,
        unitId: fixture.unitId,
        source: "departure",
      },
    ] as const) {
      const next = wardFlowReducer(fixture.state, event);
      expect(next.rejections).toEqual(fixture.state.rejections);
      expect(next).not.toBe(fixture.state);
      accepted.add(event.type);
      if (!validSharedCommand(JSON.parse(JSON.stringify(event)))) refused.push(event.type);
    }
    expect(refused).toEqual([]);
    expect(SCHEMA_TYPES.filter((type) => accepted.has(type)).length).toBeGreaterThan(SCHEMA_TYPES.length / 2);
    expect(accepted.size).toBeGreaterThan(20);
  });

  it("require the sender's own role and never fill one in", () => {
    const event = { type: "REQUEST_CAPACITY_REFRESH", unitId: "rph-adult-secure" };
    expect(validSharedCommand(event)).toBe(false);
    expect(validSharedCommand({ ...event, role: "officer" })).toBe(false);
    expect(validSharedCommand({ ...event, role: "coordinator" })).toBe(true);
  });

  it("refuse wrong field types on the core commands", () => {
    for (const event of [
      { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", unitId: 7 },
      { type: "RECORD_MEDICAL_CLEARANCE", role: "coordinator", referralId: "r1", cleared: "yes" },
      { type: "CHANGE_URGENCY", role: "coordinator", movementId: "m1", urgency: 4, reason: "clinical" },
      { type: "CONFIRM_CAPACITY", role: "coordinator", unitId: "u", actingUnitId: "u", value: -1 },
      {
        type: "REVIEW_AUDIT_EVENT",
        role: "coordinator",
        eventId: "e",
        expectedGeneration: 0,
        expectedReviewCount: 0,
        decision: "ok",
      },
      { type: "ADVANCE_CLOCK", role: "demo", minutes: "30" },
      { type: "PULL_PATIENT", role: "coordinator", movementId: "", unitId: "u" },
    ])
      expect(validSharedCommand(event), event.type).toBe(false);
  });

  it("bound every command's size and refuse prototype keys", () => {
    const base = { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", unitId: "rph-adult-secure" };
    let deep: unknown = "x";
    for (let level = 0; level < 12; level += 1) deep = { next: deep };
    for (const event of [
      { ...base, note: "x".repeat(4_001) },
      { ...base, list: Array.from({ length: 501 }, () => 1) },
      { ...base, deep },
      { ...base, value: Number.POSITIVE_INFINITY },
      JSON.parse(`{"type":"REQUEST_CAPACITY_REFRESH","role":"coordinator","unitId":"u","__proto__":{"x":1}}`),
      { ...base, type: "NOT_AN_EVENT" },
      [base],
      null,
    ])
      expect(validSharedCommand(event)).toBe(false);
    expect(validSharedCommand({ ...base, note: "x".repeat(4_000) })).toBe(true);
  });

  it("let a referral chart's file content past the text bound (the request size limit still applies)", () => {
    const role = EVENT_ROLE.RECEIVE_REFERRAL[0];
    const chart = (base64: string) => ({
      type: "RECEIVE_REFERRAL",
      role,
      intake: { charts: [{ kind: "medication", name: "chart.pdf", mimeType: "application/pdf", base64 }] },
    });
    expect(validSharedCommand(chart("A".repeat(12_000)))).toBe(true);
    expect(validSharedCommand(chart("A".repeat(4 * Math.ceil(CHART_MAX_BYTES / 3))))).toBe(true);
    expect(validSharedCommand(chart("A".repeat(4 * Math.ceil(CHART_MAX_BYTES / 3) + 4)))).toBe(false);
    expect(validSharedCommand({ ...chart("AAAA"), note: "x".repeat(12_000) })).toBe(false);
  });
});
