// @ts-check
// H-0694, H-0179 (Josh approved 27 Oct 2026 03:32Z): a whole-network desk skips the role check, so
// the command is recorded under the desk's own role, never the role its screen sent. Synthetic only.
import assert from "node:assert/strict";
import { test } from "node:test";

test("a statewide coordinator's command is recorded as the coordinator's, whatever the screen sent", async () => {
  const engine = await import("./dist/engine.mjs");
  const at = new Date("2026-10-07T10:00:00Z");
  const world = engine.seedWorld(at);
  const unitId = world.state.units[0].id;
  const sent = { type: "REQUEST_CAPACITY_REFRESH", role: "ward", actingUnitId: unitId, unitId };
  const stamped = engine.deskCommand(engine.STATEWIDE, sent);
  assert.deepEqual(stamped, { ...sent, role: "coordinator" });
  assert.equal(sent.role, "ward", "the supplied command is not changed in place");
  assert.equal(engine.commandRefusal(world, engine.STATEWIDE, stamped, at), null);
});

test("the demonstration controls keep their demo role, and narrower desks are left to the role check", async () => {
  const engine = await import("./dist/engine.mjs");
  const at = new Date("2026-10-07T10:00:00Z");
  const world = engine.seedWorld(at);
  const demo = { type: "ADVANCE_CLOCK", role: "demo", minutes: 15 };
  assert.equal(engine.deskCommand(engine.STATEWIDE, demo), demo);
  const ward = engine.parseAccess("ward", { kind: "ward", unitIds: [world.state.units[0].id] });
  const sent = { type: "RECEIVE_REFERRAL", role: "ed" };
  assert.equal(engine.deskCommand(ward, sent), sent);
  const service = engine.parseAccess("coordinator", { kind: "service", service: world.state.units[0].service });
  if (service) assert.equal(engine.deskCommand(service, sent), sent);
  assert.equal(engine.deskCommand(engine.STATEWIDE, { type: "ADVANCE_CLOCK" }).role, undefined);
});
