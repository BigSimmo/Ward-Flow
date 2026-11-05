// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "./migrate.mjs";
import { createWorkspaceStore } from "./postgres.mjs";
import { createHandler } from "./server.mjs";
import { dropTestDatabase } from "./drop-test-database.test-support.mjs";

const url = process.env.WARD_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Directory tests require disposable loopback PostgreSQL");
test("real PostgreSQL: access HTTP continuation discovers a newly granted 501st role", { skip: !url }, async () => {
  const engine = await import("./dist/engine.mjs");
  const control = new Pool({ connectionString: url });
  const database = `wardflow_directory_${randomUUID().replaceAll("-", "")}`;
  await control.query(`CREATE DATABASE ${database}`);
  const target = new URL(/** @type {string} */ (url));
  target.pathname = `/${database}`;
  const pool = new Pool({ connectionString: target.href });
  try {
    await migrate(pool);
    let now = new Date();
    const workspaceId = randomUUID(),
      actor = randomUUID();
    const store = createWorkspaceStore(pool, { workspaceId, engine, clock: () => now, log: () => {} });
    const world = await store.read(actor);
    const scope = { kind: "ward", unitIds: [world.payload.state.units[0].id] };
    await pool.query(
      "INSERT INTO ward_flow.memberships(id,workspace_id,actor_id,role,scope,granted_by,granted_at,expires_at) SELECT gen_random_uuid(),$1,gen_random_uuid(),'ward',$2,$3,$4,$5 FROM generate_series(1,500)",
      [workspaceId, scope, actor, now, new Date(now.getTime() + 3600000)],
    );
    now = new Date(now.getTime() + 1000);
    const admin = await store.viewer(actor, { bootstrap: true });
    const grant = await store.grantAccess(admin, {
      actorId: randomUUID(),
      role: "ward",
      scope,
      expiresAt: new Date(now.getTime() + 3600000),
    });
    assert.equal(grant.status, 200);
    const handler = createHandler({
      config: { workspaceId, coordinatorIds: [actor], origin: "http://localhost" },
      sharedStore: store,
      authenticate: async (_headers, { session }) => {
        Object.assign(session, { startedAt: Date.now(), signedInAt: Date.now(), sessionId: randomUUID() });
        return actor;
      },
      log: () => {},
    });
    const get = async (cursor = "") => {
      const response = await handler(
        new Request(`http://backend/v1/workspace/access${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, {
          headers: { authorization: "Bearer synthetic-directory", "x-ward-working-as": "bootstrap" },
        }),
      );
      assert.equal(response.status, 200);
      return response.json();
    };
    const first = await get();
    assert.equal(first.memberships.length, 500);
    assert.equal(first.complete, false);
    const second = await get(first.nextCursor);
    assert.equal(second.complete, true);
    assert.deepEqual(
      second.memberships.map((m) => m.id),
      [grant.body.membership.id],
    );
  } finally {
    await pool.end();
    await dropTestDatabase(control, database);
    await control.end();
  }
});
