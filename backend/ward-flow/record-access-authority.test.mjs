// @ts-check
// A05/A06: real loopback HTTP, signed synthetic sessions and PostgreSQL. The scheduling gates
// delay a real public store call or SQL result; they never provide permission or fake SQL rows.
import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { once } from "node:events";
import { test } from "node:test";
import { Pool } from "pg";
import { LATEST_MIGRATION } from "./migrations.mjs";
import { createWorkspaceStore } from "./postgres.mjs";
import { createHandler, listen } from "./server.mjs";
import { createSupabaseAuthenticator } from "./supabase-auth.mjs";
import { APPROVED_SUPABASE_PROJECT, APPROVED_SUPABASE_URL } from "./supabase-config.mjs";
import { isMembershipRead } from "./viewer.test-support.mjs";

const url = process.env.WARD_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Record authority regressions require an isolated loopback PostgreSQL server");
const origin = "http://127.0.0.1";

function barrier() {
  let reached = () => {};
  let resume = () => {};
  const signal = new Promise((resolve) => {
    reached = () => resolve(undefined);
  });
  const held = new Promise((resolve) => {
    resume = () => resolve(undefined);
  });
  return {
    signal,
    async stop() {
      reached();
      await held;
    },
    release() {
      resume();
    },
  };
}

async function bounded(promise, message, milliseconds = 8_000) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Scheduling instrumentation at the SQL boundary; every statement/result is real PostgreSQL. */
function observedPool(pool, dispatched) {
  const wrap = (connection) => ({
    query(sql, parameters) {
      const result = connection.query(sql, parameters);
      dispatched(String(sql));
      return result;
    },
  });
  return {
    ...wrap(pool),
    async connect() {
      const client = await pool.connect();
      return { ...wrap(client), release: client.release.bind(client) };
    },
  };
}

async function fixture(t) {
  const engine = await import("./dist/engine.mjs");
  let now = Date.now();
  const clock = () => new Date(now);
  const workspaceId = randomUUID();
  const actors = Array.from({ length: 3 }, () => randomUUID());
  const application = `ward-record-authority-${randomUUID()}`;
  const pools = [0, 1].map(
    (index) =>
      new Pool({
        connectionString: url,
        max: 4,
        application_name: `${application}-${index}`,
        statement_timeout: 8_000,
        connectionTimeoutMillis: 3_000,
      }),
  );
  const control = new Pool({ connectionString: url, max: 2, connectionTimeoutMillis: 3_000, statement_timeout: 8_000 });
  const gates = [];
  const blockers = [];
  const servers = [];
  const pending = new Set();
  const hooks = /** @type {any} */ ({ detail: null, archive: null, dispatched: null });
  let idleErrors = 0;
  for (const pool of [...pools, control])
    pool.on("error", () => {
      idleErrors++;
    });
  // At most ten database connections and two application requests in flight in these cases.
  t.after(async () => {
    for (const gate of gates) gate.release();
    for (const client of blockers) {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
    for (const server of servers) {
      await new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections?.();
      });
    }
    await Promise.allSettled([...pending]);
    await Promise.all([...pools, control].map((pool) => pool.end()));
    assert.equal(idleErrors, 0, "no idle database connection failed");
  });
  const version = await control.query("SELECT max(version)::int AS version FROM ward_flow.migrations");
  assert.equal(version.rows[0]?.version, LATEST_MIGRATION, "root must migrate the fresh disposable database first");
  const key = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const config = {
    coordinatorIds: actors.slice(0, 1),
    origin,
    workspaceId,
    dataMode: "prototype",
    push: null,
    supabase: {
      projectRef: APPROVED_SUPABASE_PROJECT,
      url: APPROVED_SUPABASE_URL,
      publishableKey: "synthetic-offline-only",
    },
  };
  const authenticate = createSupabaseAuthenticator(config, {
    now: () => now,
    fetch: async (destination) => {
      assert.equal(
        destination === `${APPROVED_SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
        true,
        "authentication may request only the locally supplied JWKS",
      );
      return Response.json({
        keys: [{ ...key.publicKey.export({ format: "jwk" }), kid: "local-record-authority", alg: "ES256", use: "sig" }],
      });
    },
  });
  const tokens = actors.map((actor) => {
    const part = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const issued = Math.floor(now / 1_000);
    const signed = `${part({ alg: "ES256", kid: "local-record-authority", typ: "JWT" })}.${part({
      sub: actor,
      iss: `${APPROVED_SUPABASE_URL}/auth/v1`,
      aud: "authenticated",
      role: "authenticated",
      iat: issued,
      exp: issued + 7_200,
      session_id: randomUUID(),
      amr: [{ method: "password", timestamp: issued }],
    })}`;
    return `Bearer ${signed}.${sign("sha256", Buffer.from(signed), { key: key.privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
  });
  const stores = pools.map((pool, index) =>
    createWorkspaceStore(index ? pool : observedPool(pool, (sql) => hooks.dispatched?.(sql)), {
      workspaceId,
      engine,
      clock,
      log: () => {},
      alert: () => {},
    }),
  );
  const bases = [];
  for (const [index, store] of stores.entries()) {
    const wrapped = index
      ? store
      : {
          ...store,
          async logView(view, patientId, surface) {
            await hooks.detail?.();
            return store.logView(view, patientId, surface);
          },
          async archive(view, since) {
            await hooks.archive?.();
            return store.archive(view, since);
          },
        };
    const server = listen(createHandler({ config, authenticate, sharedStore: wrapped, log: () => {} }), {
      port: 0,
      host: "127.0.0.1",
      trustedProxyAddresses: [],
    });
    servers.push(server);
    await bounded(once(server, "listening"), "local HTTP listener did not start");
    const address = server.address();
    assert.ok(address && typeof address === "object");
    bases.push(`http://127.0.0.1:${address.port}`);
  }
  const call = (actor, path = "", body, membership, server = 0) => {
    const request = (async () => {
      const response = await fetch(`${bases[server]}/v1/workspace${path}`, {
        method: body === undefined ? "GET" : "POST",
        redirect: "error",
        signal: AbortSignal.timeout(12_000),
        headers: {
          authorization: tokens[actor],
          origin,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
          ...(membership ? { "x-ward-working-as": membership } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: await response.json() };
    })();
    pending.add(request);
    void request.then(
      () => pending.delete(request),
      () => pending.delete(request),
    );
    return request;
  };
  const initial = await call(0);
  assert.equal(initial.status, 200, "bootstrap can initialise this new synthetic workspace");
  const world = engine.seedWorld(clock());
  const details = new Set(
    world.state.patients
      .filter((patient) =>
        [patient.address, patient.interpreterLanguage].some((value) => typeof value === "string" && value.length > 0),
      )
      .map((patient) => patient.id),
  );
  const wardAccess = (unitIds) => {
    const access = engine.parseAccess("ward", { kind: "ward", unitIds });
    assert.ok(access);
    return access;
  };
  let selected;
  for (const unit of world.state.units) {
    const access = wardAccess([unit.id]);
    const state = engine.scopeWorld(world, access, clock()).state;
    const patient = state.patients.find((candidate) => details.has(candidate.id));
    const movement = state.movements.find((candidate) => candidate.closure);
    if (patient && movement) {
      selected = { unit: unit.id, patient: patient.id, movement };
      break;
    }
  }
  assert.ok(selected, "the synthetic seed supplies visible detail and a closed movement in one ward");
  const chosen = selected;
  const unitA = chosen.unit;
  const basePatients = new Set(
    engine.scopeWorld(world, wardAccess([unitA]), clock()).state.patients.map((patient) => patient.id),
  );
  const unitB = world.state.units.find(
    (unit) =>
      unit.id !== unitA &&
      engine
        .scopeWorld(world, wardAccess([unit.id]), clock())
        .state.patients.some((patient) => details.has(patient.id) && !basePatients.has(patient.id)),
  )?.id;
  assert.ok(unitB, "a second synthetic ward has protected detail outside the base ward");
  const grant = async (unitIds = [unitA]) => {
    const result = await call(0, "/access/grant", {
      actorId: actors[1],
      role: "ward",
      scope: { kind: "ward", unitIds },
      expiresInMinutes: 120,
    });
    assert.equal(result.status, 200, "administrator grants the synthetic ward role");
    assert.equal(typeof result.body.membership?.id, "string");
    return result.body.membership.id;
  };
  const membership = await grant();
  const open = (desk = membership, patient = chosen.patient, server = 0) =>
    call(1, "/record-access", { patientId: patient, surface: "patient" }, desk, server);
  const revoke = async (desk = membership) => {
    const result = await call(0, "/access/revoke", { membershipId: desk }, undefined, 1);
    assert.equal(result.status, 200, "independent administrator revocation committed");
  };
  const gate = (kind) => {
    const value = barrier();
    gates.push(value);
    hooks[kind] = async () => {
      hooks[kind] = null;
      await value.stop();
    };
    return value;
  };
  const audit = async () => {
    const result = await call(0, "/record-access");
    assert.equal(result.status, 200, "coordinator reads the public record-access log");
    return result.body.views.filter(
      (row) => row.actor_id === actors[1] && row.patient_id === chosen.patient && row.surface === "patient",
    );
  };
  const archiveFixture = async () => {
    const record = { ...chosen.movement, id: `${chosen.movement.id}-A05-ARCHIVED` };
    assert.ok(record.closure);
    await control.query(
      "INSERT INTO ward_flow.archived_records(workspace_id, world_generation, collection, record_id, closed_at, body, archived_revision) VALUES($1,$2,'movements',$3,$4,$5,$6)",
      [workspaceId, world.state.worldGeneration, record.id, record.closure.at, record, initial.body.snapshot.revision],
    );
    const result = await call(1, "/archive", undefined, membership);
    assert.equal(result.status, 200);
    assert.equal(
      result.body.records.some((row) => row.body.id === record.id),
      true,
      "the archive race starts from a real nonempty authorised archive",
    );
  };
  const lock = async (kind) => {
    const blocker = await control.connect();
    blockers.push(blocker);
    await blocker.query("BEGIN");
    if (kind === "account")
      await blocker.query("SELECT pg_advisory_xact_lock(hashtext($1 || ':' || $2 || ':record-access'))", [
        workspaceId,
        actors[1],
      ]);
    else await blocker.query("SELECT id FROM ward_flow.workspaces WHERE id=$1 FOR UPDATE", [workspaceId]);
    const pid = (await blocker.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
    return { blocker, pid };
  };
  const waitBlocked = async (pid, request, kind) => {
    let finished = false;
    void request.then(
      () => {
        finished = true;
      },
      () => {
        finished = true;
      },
    );
    for (let attempt = 0; attempt < 100; attempt++) {
      // Autocommit observer avoids a cached pg_stat_activity snapshot inside the blocker transaction.
      const result = await control.query(
        "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND $2::int=ANY(pg_blocking_pids(pid)) AND query LIKE $3) AS blocked",
        [`${application}-0`, pid, kind === "account" ? "%pg_advisory_xact_lock%" : "%FROM ward_flow.workspaces%"],
      );
      if (result.rows[0].blocked) return;
      assert.equal(finished, false, "the protected read must wait for the actual database lock");
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.fail("the actual PostgreSQL lock wait was not observed");
  };
  return {
    call,
    open,
    revoke,
    grant,
    gate,
    audit,
    archiveFixture,
    lock,
    waitBlocked,
    control,
    hooks,
    workspaceId,
    actors,
    membership,
    patient: chosen.patient,
    details,
    unitA,
    unitB,
    clock,
    advance: (milliseconds) => {
      now += milliseconds;
    },
  };
}

function integration(name, run) {
  test(`real PostgreSQL: ${name}`, { skip: !url, timeout: 30_000 }, async (t) => run(await fixture(t)));
}

function refused(result) {
  assert.equal(
    [403, 404].includes(result.status),
    true,
    "ended access is refused rather than returning a protected record",
  );
  assert.equal(Object.hasOwn(result.body, "detail"), false, "no detail accompanies refusal");
  assert.equal(Object.hasOwn(result.body, "records"), false, "no archive accompanies refusal");
  assert.equal(Object.hasOwn(result.body, "partialView"), false, "no scoped archive projection accompanies refusal");
}

integration("A05 detail refuses after committed revocation", async (f) => {
  const gate = f.gate("detail");
  const pending = f.open();
  await bounded(gate.signal, "detail did not reach the post-authentication barrier");
  await f.revoke();
  gate.release();
  refused(await pending);
  assert.equal(
    (await f.call(1, "", undefined, f.membership)).status,
    403,
    "new requests confirm that revocation is effective",
  );
});

integration("A05 repeated detail refuses after committed revocation", async (f) => {
  const first = await f.open();
  assert.equal(first.status, 200);
  assert.equal(first.body.logged, true);
  assert.equal(Object.keys(first.body.detail ?? {}).length > 0, true, "fixture begins with protected detail");
  const gate = f.gate("detail");
  const pending = f.open();
  await bounded(gate.signal, "repeat did not reach the post-authentication barrier");
  await f.revoke();
  gate.release();
  refused(await pending);
});

integration("A05 archive refuses after committed revocation", async (f) => {
  await f.archiveFixture();
  const gate = f.gate("archive");
  const pending = f.call(1, "/archive", undefined, f.membership);
  await bounded(gate.signal, "archive did not reach the post-authentication barrier");
  await f.revoke();
  gate.release();
  refused(await pending);
});

integration("A05 authorised read before revocation remains valid", async (f) => {
  const answer = await f.open();
  assert.equal(answer.status, 200);
  assert.equal(Object.keys(answer.body.detail ?? {}).length > 0, true);
  await f.revoke();
  refused(await f.open());
});

integration("A05 detail refreshes joined cover after revocation", async (f) => {
  const base = await f.call(1, "", undefined, f.membership);
  const baseIds = new Set(base.body.snapshot.payload.state.patients.map((row) => row.id));
  const cover = await f.call(0, "/access/cover", {
    actorId: f.actors[1],
    scope: { kind: "ward", unitIds: [f.unitB] },
    minutes: 60,
    reason: "busy",
  });
  assert.equal(cover.status, 200);
  const joined = await f.call(1, "", undefined, f.membership);
  const candidate = joined.body.snapshot.payload.state.patients.find(
    (row) => !baseIds.has(row.id) && f.details.has(row.id),
  );
  assert.ok(candidate, "cover makes a seeded record with protected detail visible outside the base ward");
  const gate = f.gate("detail");
  const pending = f.open(f.membership, candidate.id);
  await bounded(gate.signal, "covered detail did not reach the barrier");
  await f.revoke(cover.body.membership.id);
  gate.release();
  const response = await pending;
  // The base role survives, so the refusal is record visibility rather than account access.
  assert.equal(response.status, 404);
  assert.equal(Object.hasOwn(response.body, "detail"), false);
});

for (const kind of ["workspace", "account"]) {
  integration(`A05 detail refreshes expiry after ${kind} lock wait`, async (f) => {
    await f.control.query("UPDATE ward_flow.memberships SET expires_at=$2 WHERE id=$1 AND workspace_id=$3", [
      f.membership,
      new Date(f.clock().getTime() + 20_000),
      f.workspaceId,
    ]);
    const held = await f.lock(kind);
    const pending = f.open();
    await f.waitBlocked(held.pid, pending, kind);
    f.advance(30_000);
    await held.blocker.query("COMMIT");
    refused(await pending);
  });
}

integration("A06 preserves desk provenance across repeats", async (f) => {
  const secondDesk = await f.grant([f.unitA, f.unitB]);
  const first = await f.open();
  const second = await f.open(secondDesk);
  const third = await f.open(secondDesk);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(third.status, 200);
  const views = await f.audit();
  assert.equal(views.length, 2, "both effective desks have durable audit provenance");
  assert.equal(
    views.some((row) => row.actor_scope.unitIds.length === 1),
    true,
  );
  assert.equal(
    views.some((row) => row.actor_scope.unitIds.length === 2),
    true,
  );
  assert.equal(third.body.logged, false, "same-desk repeat is still coalesced");
});

integration("A06 concurrent same-desk repeats coalesce", async (f) => {
  const answers = await Promise.all([f.open(), f.open(f.membership, f.patient, 1)]);
  assert.equal(
    answers.every((answer) => answer.status === 200),
    true,
  );
  assert.equal(answers.filter((answer) => answer.body.logged).length, 1);
  assert.equal((await f.audit()).length, 1);
});

integration("A06 membership switch preserves the account-wide rate cap", async (f) => {
  const secondDesk = await f.grant([f.unitA, f.unitB]);
  // Fixture rows fill the documented account-wide minute budget, not a per-membership budget.
  await f.control.query(
    "INSERT INTO ward_flow.record_access(workspace_id, actor_id, membership_id, actor_role, actor_scope, patient_id, surface, viewed_at) SELECT $1,$2,$3,'ward',$4,'PT-SYN-AUTH-LIMIT-' || n,'patient',$5 FROM generate_series(1,60) AS n",
    [f.workspaceId, f.actors[1], f.membership, { kind: "ward", unitIds: [f.unitA] }, f.clock()],
  );
  const answer = await f.open(secondDesk);
  assert.equal(answer.status, 200);
  assert.equal(answer.body.logged, false);
  assert.equal(Object.hasOwn(answer.body, "detail"), false);
  assert.equal((await f.audit()).length, 0, "no new target record opening bypasses the shared cap");
});

integration("A06 bootstrap repeats retain null-membership provenance", async (f) => {
  const first = await f.call(0, "/record-access", { patientId: f.patient, surface: "patient" });
  const second = await f.call(0, "/record-access", { patientId: f.patient, surface: "patient" });
  assert.equal(first.status, 200);
  assert.equal(first.body.logged, true);
  assert.equal(second.status, 200);
  assert.equal(second.body.logged, false);
  assert.equal(Object.keys(second.body.detail ?? {}).length > 0, true);
});

// Regression for the mixed bootstrap/scoped archive queue: all SQL is real, while the
// first archive query is paused before dispatch so followers can occupy the small pool.
test(
  "real PostgreSQL: archive refresh completes under mixed-desk pool saturation",
  { skip: !url, timeout: 30_000 },
  async (t) => {
    const f = await fixture(t);
    await f.archiveFixture();
    const engine = await import("./dist/engine.mjs");
    const pool = new Pool({ connectionString: url, max: 2, connectionTimeoutMillis: 3_000, statement_timeout: 8_000 });
    const gate = barrier();
    let paused = false;
    let scopedResolved = 0;
    const requests = [];
    const wrap = (connection) => ({
      async query(sql, parameters) {
        if (!paused && String(sql).startsWith("SELECT collection, record_id, closed_at")) {
          paused = true;
          await gate.stop();
        }
        const result = await connection.query(sql, parameters);
        if (isMembershipRead(sql)) scopedResolved++;
        return result;
      },
    });
    const store = createWorkspaceStore(
      {
        ...wrap(pool),
        async connect() {
          const client = await pool.connect();
          return { ...wrap(client), release: client.release.bind(client) };
        },
      },
      { workspaceId: f.workspaceId, engine, clock: f.clock, log: () => {}, alert: () => {} },
    );
    t.after(async () => {
      gate.release();
      await Promise.allSettled(requests);
      await pool.end();
    });
    const desk = await store.viewer(f.actors[1], { workingAs: f.membership });
    assert.equal(desk.status, "ok");
    scopedResolved = 0;
    requests.push(store.archive(undefined));
    await bounded(gate.signal, "bootstrap archive never reached the real SQL scheduling gate");
    requests.push(store.archive({ ...desk }), store.archive({ ...desk }));
    await bounded(
      (async () => {
        while (!(
          pool.totalCount === 2 &&
          pool.idleCount === 0 &&
          (scopedResolved === 2 || (scopedResolved === 1 && pool.waitingCount === 1))
        ))
          await new Promise((resolve) => setTimeout(resolve, 10));
      })(),
      "two archive clients did not saturate the real pool",
    );
    gate.release();
    const answers = await bounded(Promise.all(requests), "archive refresh queue starved its own pool", 1_500);
    assert.equal(answers.length, 3);
    assert.equal(
      answers.every((answer) => answer.archived > 0 && answer.records.length > 0),
      true,
    );
    assert.equal(pool.waitingCount, 0, "all pool checkouts complete");
    const missing = createWorkspaceStore(pool, {
      workspaceId: randomUUID(),
      engine,
      clock: f.clock,
      log: () => {},
      alert: () => {},
    });
    assert.deepEqual(
      await missing.archive(undefined),
      { archived: 0, records: [] },
      "bootstrap archive keeps the empty result for a workspace that has not been created",
    );
  },
);
