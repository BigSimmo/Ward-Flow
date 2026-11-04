// @ts-check
import assert from "node:assert/strict";
import { test } from "node:test";

const at = new Date("2026-11-04T10:00:00Z");

async function fixture() {
  const engine = await import("./dist/engine.mjs");
  const world = engine.seedWorld(at);
  const access = engine.parseAccess("ward", { kind: "ward", unitIds: [world.state.units[0].id] });
  assert.ok(access);
  const own = engine.scopeWorld(world, access, at);
  const patient = world.state.patients.find((candidate) => !own.state.patients.some(({ id }) => candidate.id === id));
  assert.ok(patient, "synthetic foreign record exists");
  const until = new Date(at.getTime() + 60 * 60_000);
  const sees = (source, grants) =>
    engine.scopeWorld(source, access, at, grants).state.patients.some(({ id }) => id === patient.id);
  return { engine, world, access, own, patient, until, sees };
}

test("a generation-bound exceptional opening permits the original record, with expiry enforced", async () => {
  const { world, patient, until, sees } = await fixture();
  const grant = { patientId: patient.id, until, generation: world.state.worldGeneration };
  assert.equal(sees(world, []), false);
  assert.equal(sees(world, [grant]), true);
  assert.equal(sees(world, [{ ...grant, until: at }]), false);
});

test("a reused patient ID never inherits another generation's exceptional opening", async () => {
  const { world, patient, until, sees } = await fixture();
  const generation = world.state.worldGeneration;
  const replacement = {
    ...world,
    state: {
      ...world.state,
      worldGeneration: generation + 1,
      patients: world.state.patients.map((candidate) =>
        candidate.id === patient.id ? { ...candidate, address: "synthetic replacement" } : candidate,
      ),
    },
  };
  assert.equal(sees(replacement, [{ patientId: patient.id, until, generation }]), false);
  assert.equal(sees(replacement, [{ patientId: patient.id, until, generation: generation + 1 }]), true);
});

test("legacy unbound openings apply only before the first reset", async () => {
  const { world, patient, until, sees } = await fixture();
  const legacy = { patientId: patient.id, until };
  assert.equal(world.state.worldGeneration, 0);
  assert.equal(sees(world, [legacy]), true);
  assert.equal(sees({ ...world, state: { ...world.state, worldGeneration: 1 } }, [legacy]), false);
});

test("stale exceptional openings do not remove the desk's ordinary care access", async () => {
  const { engine, world, access, own, patient, until } = await fixture();
  assert.ok(own.state.patients.length > 0);
  const reset = { ...world, state: { ...world.state, worldGeneration: 1 } };
  const projected = engine.scopeWorld(reset, access, at, [{ patientId: patient.id, until, generation: 0 }]);
  for (const record of own.state.patients) assert.ok(projected.state.patients.some(({ id }) => id === record.id));
});
