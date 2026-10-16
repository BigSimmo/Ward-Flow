// @ts-check
import assert from "node:assert/strict";
import { test } from "node:test";

const refresh = { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", unitId: "rph-adult-secure" };

test("the saved audit copy is bounded, and reviewed entries are kept", async () => {
  const engine = await import("./dist/engine.mjs");
  const world = engine.seedWorld(new Date("2026-10-07T10:00:00Z"));
  const template = world.state.auditEvents[0] ?? null;
  const entry = (index) => ({ ...(template ?? {}), id: `audit-test-${index}`, sequence: index + 1 });
  const state = {
    ...world.state,
    auditEvents: Array.from({ length: engine.PERSISTED_AUDIT_EVENTS + 5 }, (_, index) => entry(index)),
    auditReviews: [{ eventId: "audit-test-1" }],
  };
  const bounded = engine.boundAudit(state);
  assert.equal(bounded.auditEvents.length, engine.PERSISTED_AUDIT_EVENTS + 1);
  assert.equal(bounded.auditEvents[0].id, "audit-test-1", "a reviewed entry stays");
  assert.equal(bounded.auditEvents.at(-1).id, `audit-test-${engine.PERSISTED_AUDIT_EVENTS + 4}`);
  assert.equal(engine.boundAudit(world.state), world.state, "a short list is left alone");
});

test("the saved audit copy keeps this scenario's record-access receipts", async () => {
  const engine = await import("./dist/engine.mjs");
  const world = engine.seedWorld(new Date("2026-10-07T10:00:00Z"));
  const template = world.state.auditEvents[0] ?? {};
  const generation = world.state.worldGeneration;
  const entry = (index) => ({ ...template, id: `audit-test-${index}`, sequence: index + 1 });
  const access = (id, entryGeneration) => ({ ...template, id, category: "record-access", generation: entryGeneration });
  const state = {
    ...world.state,
    auditEvents: [
      access("access-old-scenario", generation - 1),
      access("access-open-record", generation),
      ...Array.from({ length: engine.PERSISTED_AUDIT_EVENTS }, (_, index) => entry(index)),
    ],
    auditReviews: [],
  };
  const ids = engine.boundAudit(state).auditEvents.map((kept) => kept.id);
  assert.ok(ids.includes("access-open-record"), "an open record can still be read after trimming");
  assert.ok(!ids.includes("access-old-scenario"), "a receipt from an earlier scenario is trimmed");
});

test("demo controls are recognised by their demo-only role", async () => {
  const engine = await import("./dist/engine.mjs");
  for (const type of ["ADVANCE_CLOCK", "RESET_SCENARIO", "SET_SCENARIO"])
    assert.equal(engine.demoOnlyCommand({ type, role: "demo" }), true);
  assert.equal(engine.demoOnlyCommand(refresh), false);
});
