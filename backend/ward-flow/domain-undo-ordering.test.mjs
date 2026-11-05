// @ts-check
// Real loopback HTTP/PostgreSQL regressions for observation order and atomic Undo.
// Synthetic signed sessions use an offline public JWKS; all command and transaction code is real.
import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { once } from "node:events";
import { test } from "node:test";
import { isDeepStrictEqual } from "node:util";
import { Pool } from "pg";
import { createHandler, listen } from "./server.mjs";
import { createSupabaseAuthenticator } from "./supabase-auth.mjs";
import { APPROVED_SUPABASE_PROJECT, APPROVED_SUPABASE_URL } from "./supabase-config.mjs";
import { createWorkspaceStore } from "./postgres.mjs";
import { migrate } from "./migrate.mjs";

const url = process.env.WARD_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Domain regressions require an isolated loopback PostgreSQL server");

async function fixture(t) {
  const engine = await import("./dist/engine.mjs");
  const workspaceId = randomUUID();
  const actor = randomUUID();
  const at = new Date();
  const pools = [0, 1].map(() => new Pool({ connectionString: url, max: 2, connectionTimeoutMillis: 3_000 }));
  const servers = [];
  t.after(async () => {
    await Promise.all(
      servers.map(
        (server) =>
          new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve(undefined)))),
      ),
    );
    await Promise.all(pools.map((pool) => pool.end()));
    // Append-only audit rows remain in the UUID-isolated disposable database.
  });
  await migrate(pools[0]);
  const config = {
    coordinatorIds: [actor],
    origin: null,
    host: "127.0.0.1",
    port: 0,
    supabase: {
      projectRef: APPROVED_SUPABASE_PROJECT,
      url: APPROVED_SUPABASE_URL,
      publishableKey: "synthetic-offline-only",
    },
  };
  const key = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const part = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const issued = Math.floor(at.getTime() / 1000);
  const signed = `${part({ alg: "ES256", kid: "local-domain", typ: "JWT" })}.${part({
    sub: actor,
    iss: `${APPROVED_SUPABASE_URL}/auth/v1`,
    aud: "authenticated",
    role: "authenticated",
    iat: issued,
    exp: issued + 3600,
    session_id: randomUUID(),
    amr: [{ method: "password", timestamp: issued }],
  })}`;
  const token = `Bearer ${signed}.${sign("sha256", Buffer.from(signed), { key: key.privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
  const authenticate = createSupabaseAuthenticator(config, {
    now: () => at.getTime(),
    fetch: async (endpoint) => {
      assert.equal(endpoint, `${APPROVED_SUPABASE_URL}/auth/v1/.well-known/jwks.json`);
      return Response.json({
        keys: [{ ...key.publicKey.export({ format: "jwk" }), kid: "local-domain", alg: "ES256", use: "sig" }],
      });
    },
  });
  const bases = [];
  for (const pool of pools) {
    const sharedStore = createWorkspaceStore(pool, { workspaceId, engine, clock: () => new Date(at) });
    const server = listen(createHandler({ config, sharedStore, authenticate, log: () => {} }), config);
    servers.push(server);
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address === "object");
    bases.push(`http://127.0.0.1:${address.port}/v1/workspace`);
  }
  async function request(index, body) {
    const response = await fetch(`${bases[index]}${body ? "/commands" : ""}`, {
      method: body ? "POST" : "GET",
      redirect: "error",
      signal: AbortSignal.timeout(12_000),
      headers: { authorization: token, "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  }
  const initial = await request(0);
  assert.equal(initial.status, 200);
  let snapshot = initial.body.snapshot;
  return {
    get snapshot() {
      return snapshot;
    },
    engine,
    at,
    async command(event, expectedStatus = 200) {
      const command = {
        classification: "synthetic",
        commandId: randomUUID(),
        expectedRevision: snapshot.revision,
        event: { role: "coordinator", now: 0, ...event },
      };
      const answer = await request(0, command);
      assert.equal(answer.status, expectedStatus, `${event.type}: ${answer.body.outcome ?? "unexpected response"}`);
      snapshot = answer.body.snapshot;
      return { command, answer };
    },
    async reload() {
      const result = await request(1);
      assert.equal(result.status, 200);
      snapshot = result.body.snapshot;
      return snapshot;
    },
    async assertAtomicDenial(event) {
      const before = structuredClone(snapshot);
      const { command, answer } = await this.command(event, 422);
      assert.equal(answer.body.outcome, "denied");
      const reloaded = await this.reload();
      assert.equal(reloaded.revision, before.revision, "denied inverse must not commit a revision");
      assert.ok(
        isDeepStrictEqual(reloaded.payload.state, before.payload.state),
        "independent store reload preserves the complete world",
      );
      const replay = await request(1, command);
      assert.equal(replay.status, 422);
      assert.equal(replay.body.replayed, true, "retry replays the refusal receipt");
      const receipt = await pools[1].query(
        "SELECT status FROM ward_flow.commands WHERE workspace_id=$1 AND command_id=$2",
        [workspaceId, command.commandId],
      );
      assert.deepEqual(receipt.rows, [{ status: 422 }]);
      const audit = await pools[1].query(
        "SELECT outcome FROM ward_flow.audit WHERE workspace_id=$1 AND action=$2 ORDER BY sequence DESC LIMIT 1",
        [workspaceId, event.type],
      );
      assert.deepEqual(audit.rows, [{ outcome: "denied" }]);
    },
  };
}

const row = (f, collection, id) => {
  const found = f.snapshot.payload.state[collection].find((entry) => entry.id === id);
  assert.ok(found, `${collection} fixture row exists`);
  return found;
};
const observation = (level) => ({ level, intervalMinutes: null, reviewAt: null });

for (const wardFirst of [false, true]) {
  test(
    `real PostgreSQL HTTP: same-minute legacy observation order survives arrival (ward first ${wardFirst})`,
    { skip: !url },
    async (t) => {
      const f = await fixture(t);
      const movement = row(f, "movements", "WF-011");
      const admission = row(f, "admissions", movement.admissionId);
      assert.equal(admission.movementId, null, "exercise the supported older one-way link");
      assert.notDeepEqual(movement.observation, admission.observation);
      await f.command({ type: "RECORD_TRANSPORT_NEED", movementId: movement.id, needed: false });
      for (const kind of wardFirst ? ["admission", "movement"] : ["movement", "admission"]) {
        const targetRow = row(
          f,
          kind === "movement" ? "movements" : "admissions",
          kind === "movement" ? movement.id : admission.id,
        );
        const target =
          kind === "movement"
            ? { kind, movementId: movement.id }
            : { kind, admissionId: admission.id, actingUnitId: admission.unitId };
        const expected = JSON.stringify([
          kind,
          targetRow.id,
          targetRow.observation.level,
          targetRow.observation.intervalMinutes,
          targetRow.observation.reviewAt,
          targetRow.observationChanges?.length ?? 0,
        ]);
        await f.command({
          type: "RECORD_OBSERVATION_LEVEL",
          target,
          observation: observation(kind === "movement" ? "two_staff" : "arms_length"),
          expected,
        });
      }
      const journeyChange = row(f, "movements", movement.id).observationChanges.at(-1);
      const wardChange = row(f, "admissions", admission.id).observationChanges.at(-1);
      assert.equal(journeyChange.at, wardChange.at, "server clock stays in one minute");
      assert.ok(
        wardFirst ? journeyChange.sequence > wardChange.sequence : wardChange.sequence > journeyChange.sequence,
      );
      await f.command({ type: "PATIENT_ARRIVED", movementId: movement.id, actingUnitId: admission.unitId });
      await f.reload();
      assert.equal(row(f, "admissions", admission.id).observation.level, wardFirst ? "two_staff" : "arms_length");
      assert.equal(row(f, "admissions", admission.id).state, "occupied");
      assert.ok(f.engine.validWorld(f.snapshot.payload));
    },
  );
}

test(
  "real PostgreSQL HTTP: newer leave atomically refuses arrival Undo and replays the receipt",
  { skip: !url },
  async (t) => {
    const f = await fixture(t);
    const movement = row(f, "movements", "WF-011");
    await f.command({ type: "RECORD_TRANSPORT_NEED", movementId: movement.id, needed: false });
    await f.command({ type: "PATIENT_ARRIVED", movementId: movement.id });
    const admission = row(f, "admissions", movement.admissionId);
    assert.equal(admission.state, "occupied");
    await f.command({
      type: "RECORD_LEAVE_BED",
      admissionId: admission.id,
      unitId: admission.unitId,
      actingUnitId: admission.unitId,
      expectedReturn: f.engine.worldNow(f.snapshot.payload, f.at) + 60,
    });
    await f.assertAtomicDenial({ type: "UNDO_TRANSPORT_STEP", movementId: movement.id });
  },
);

for (const [label, replacement] of [
  ["exact", "SYN-DOMAIN-001"],
  ["case and surrounding spaces", " syn-domain-001 "],
]) {
  test(
    `real PostgreSQL HTTP: archive inverse refuses the newer retained-number owner (${label})`,
    { skip: !url },
    async (t) => {
      const f = await fixture(t);
      const details = {
        type: "ADD_PATIENT",
        givenName: "Synthetic",
        familyName: "Identity",
        dateOfBirth: "1980-01-01",
      };
      await f.command({ ...details, umrn: "SYN-DOMAIN-001" });
      const patient = f.snapshot.payload.state.patients.at(-1);
      await f.command({ type: "ARCHIVE_PATIENT", patientId: patient.id, reason: "test" });
      await f.command({ ...details, umrn: replacement });
      await f.assertAtomicDenial({ type: "UNDO_PATIENT_RECORD", patientId: patient.id });
      assert.equal(
        f.snapshot.payload.state.patients.filter((entry) => entry.umrn.trim().toLowerCase() === "syn-domain-001")
          .length,
        1,
      );
    },
  );
}
