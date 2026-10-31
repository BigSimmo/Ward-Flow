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

test("the demonstration controls keep their demo role, and desks other than a coordinator are left to the role check", async () => {
  const engine = await import("./dist/engine.mjs");
  const at = new Date("2026-10-07T10:00:00Z");
  const world = engine.seedWorld(at);
  const demo = { type: "ADVANCE_CLOCK", role: "demo", minutes: 15 };
  assert.equal(engine.deskCommand(engine.STATEWIDE, demo), demo);
  // Marking a notice read answers as the notice's addressee, so its role is kept.
  const read = { type: "MARK_NOTICE_READ", role: "ward", noticeId: "NT-SYN-1", actingPlaceId: "ward-a" };
  assert.equal(engine.deskCommand(engine.STATEWIDE, read), read);
  const ward = engine.parseAccess("ward", { kind: "ward", unitIds: [world.state.units[0].id] });
  const sent = { type: "RECEIVE_REFERRAL", role: "ed" };
  assert.equal(engine.deskCommand(ward, sent), sent);
  assert.equal(engine.deskCommand(engine.STATEWIDE, { type: "ADVANCE_CLOCK" }).role, undefined);
});

test("a service coordinator's command is recorded as the coordinator's too, not the ward's or ED's", async () => {
  // Access audit (31 Oct 2026): a service coordinator also skips the role check in commandRefusal, so
  // a change it made on a ward page was written down as the ward's.
  const engine = await import("./dist/engine.mjs");
  const at = new Date("2026-10-07T10:00:00Z");
  const world = engine.seedWorld(at);
  const unit = world.state.units.find((candidate) => candidate.siteCode === "RPH");
  assert.ok(unit, "a synthetic East Metro ward");
  const service = engine.parseAccess("coordinator", { kind: "service", service: "East Metro" });
  assert.ok(service, "a synthetic service coordinator desk");
  const sent = { type: "REQUEST_CAPACITY_REFRESH", role: "ward", actingUnitId: unit.id, unitId: unit.id };
  const stamped = engine.deskCommand(service, sent);
  assert.deepEqual(stamped, { ...sent, role: "coordinator" });
  assert.equal(sent.role, "ward", "the supplied command is not changed in place");
  assert.equal(engine.commandRefusal(world, service, stamped, at), null);
  // The demonstration controls stay the statewide coordinator's alone.
  const demo = { type: "ADVANCE_CLOCK", role: "demo", minutes: 15 };
  assert.equal(engine.deskCommand(service, demo), demo);
  assert.notEqual(engine.commandRefusal(world, service, demo, at), null);
});
