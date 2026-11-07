// @ts-check
// Synthetic local PostgreSQL; fake push sender and clock, no provider calls.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Pool } from "pg";
import { dropTestDatabase } from "./drop-test-database.test-support.mjs";
import { migrate } from "./migrate.mjs";
import { MIGRATIONS } from "./migrations.mjs";
import { createWorkspaceStore } from "./postgres.mjs";
import { verifyRuntimeRole } from "./portable-postgres.mjs";

const url = process.env.WARD_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Backend regressions require isolated loopback PostgreSQL");

async function databaseFixture(run) {
  const admin = new Pool({ connectionString: url, max: 1 });
  const database = `wardflow_audit_${randomUUID().replaceAll("-", "")}`;
  const target = new URL(/** @type {string} */ (url));
  target.pathname = `/${database}`;
  await admin.query(`CREATE DATABASE ${database}`);
  const pool = new Pool({ connectionString: target.href, max: 4 });
  try {
    await migrate(pool);
    await run(pool, target);
  } finally {
    await pool.end();
    await dropTestDatabase(admin, database);
    await admin.end();
  }
}

function signal() {
  let resolve = () => {};
  const promise = new Promise((done) => {
    resolve = () => done(undefined);
  });
  return { promise, resolve };
}

test(
  "real PostgreSQL: the twenty-first granted role is selectable and later cover joins an own ward",
  { skip: !url },
  async () => {
    const engine = await import("./dist/engine.mjs");
    await databaseFixture(async (pool) => {
      const at = new Date("2026-11-05T00:00:00Z"),
        workspaceId = randomUUID(),
        lead = randomUUID(),
        actor = randomUUID();
      const store = createWorkspaceStore(pool, { workspaceId, engine, clock: () => at });
      const leadView = await store.viewer(lead, { bootstrap: true });
      const world = (await store.read(lead, leadView)).payload;
      const ownScope = { kind: "ward", unitIds: [world.state.units[0].id] };
      const own = await store.grantAccess(leadView, {
        actorId: actor,
        role: "ward",
        scope: ownScope,
        expiresAt: new Date(at.getTime() + 86_400_000),
      });
      assert.equal(own.status, 200);
      let latest;
      for (let index = 0; index < 20; index++) {
        const given = await store.grantAccess(leadView, {
          actorId: actor,
          role: "coordinator",
          scope: { kind: "statewide" },
          expiresAt: new Date(at.getTime() + (index + 1) * 60_000),
        });
        assert.equal(given.status, 200);
        latest = given.body.membership.id;
      }
      const choices = await store.viewer(actor);
      assert.equal(choices.status, "choose");
      assert.ok(choices.choices);
      assert.equal(choices.choices.length, 21);
      assert.equal((await store.viewer(actor, { workingAs: latest })).status, "ok");
      const coverScope = { kind: "ward", unitIds: [world.state.units[1].id] };
      assert.equal((await store.giveCover(leadView, { actorId: actor, scope: coverScope, minutes: 60 })).status, 200);
      const ward = await store.viewer(actor, { workingAs: own.body.membership.id });
      assert.deepEqual([...ward.access.scope.unitIds].sort(), [...ownScope.unitIds, ...coverScope.unitIds].sort());
    });
  },
);

test(
  "real PostgreSQL: runtime checks reject archive, forecast and Help grant drift through schema 17",
  { skip: !url },
  async (t) => {
    await databaseFixture(async (owner, target) => {
      // A separate restricted login, never the owner pool, runs the actual catalogue checks.
      const runtimeTarget = new URL(target);
      runtimeTarget.username = "wardflow_backend";
      runtimeTarget.password = "";
      await owner.query(await readFile(new URL("./infra/postgres-runtime-role.sql", import.meta.url), "utf8"));
      const runtime = new Pool({ connectionString: runtimeTarget.href, max: 1 });
      const verify = () => verifyRuntimeRole(runtime, "wardflow_backend", true, "unavailable", "unsafe");
      try {
        await verify();
        const policies = [
          {
            table: "archived_records",
            required: ["SELECT", "INSERT"],
            forbidden: ["UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"],
            column: "body",
            appendOnly: true,
          },
          {
            table: "forecast_snapshots",
            required: ["SELECT", "INSERT"],
            forbidden: ["UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"],
            column: "ready_gap_now",
            appendOnly: true,
          },
          {
            table: "forecast_miss_reasons",
            required: ["SELECT", "INSERT", "UPDATE"],
            forbidden: ["DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"],
            column: "reason",
            appendOnly: false,
          },
          {
            table: "account_preferences",
            required: ["SELECT", "INSERT", "UPDATE"],
            forbidden: ["DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"],
            column: "tips_off",
            appendOnly: false,
          },
        ];
        for (const policy of policies) {
          for (const privilege of policy.required)
            await t.test(`${policy.table} requires ${privilege}`, async () => {
              await owner.query(`REVOKE ${privilege} ON ward_flow.${policy.table} FROM wardflow_backend`);
              try {
                await assert.rejects(verify(), /unsafe/);
              } finally {
                await owner.query(`GRANT ${privilege} ON ward_flow.${policy.table} TO wardflow_backend`);
              }
              await verify();
            });
          const forbidden = [
            ...policy.forbidden,
            `REFERENCES (${policy.column})`,
            ...(policy.appendOnly ? [`UPDATE (${policy.column})`] : []),
          ];
          for (const privilege of forbidden)
            await t.test(`${policy.table} forbids ${privilege}`, async () => {
              await owner.query(`GRANT ${privilege} ON ward_flow.${policy.table} TO wardflow_backend`);
              try {
                await assert.rejects(verify(), /unsafe/);
              } finally {
                await owner.query(`REVOKE ${privilege} ON ward_flow.${policy.table} FROM wardflow_backend`);
              }
              await verify();
            });
        }
        // Both existing provider grant scripts satisfy the same current policy.
        for (const role of ["anon", "authenticated"])
          await owner.query(
            `DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='${role}') THEN CREATE ROLE ${role} NOLOGIN; END IF; END $$`,
          );
        await owner.query(await readFile(new URL("./infra/supabase-runtime-role.sql", import.meta.url), "utf8"));
        await verify();
        // Conditional checks must not resolve tables absent from an older supported schema.
        for (const migration of [...MIGRATIONS].reverse().filter(({ version }) => version > 5)) {
          const file = `./infra/rollback-${migration.file}`;
          const client = await owner.connect();
          try {
            await client.query("BEGIN");
            await client.query(await readFile(new URL(file, import.meta.url), "utf8"));
            await client.query("COMMIT");
          } catch (error) {
            await client.query("ROLLBACK");
            throw error;
          } finally {
            client.release();
          }
          await verify();
        }
      } finally {
        await runtime.end();
      }
    });
  },
);

test(
  "real PostgreSQL: later push pages get fresh leases and old acknowledgements cannot finish a reclaimed page",
  { skip: !url, timeout: 30_000 },
  async () => {
    const actualEngine = await import("./dist/engine.mjs");
    await databaseFixture(async (pool) => {
      const start = Date.parse("2026-11-05T00:00:00Z");
      let now = start;
      const workspaceId = randomUUID();
      const actors = Array.from({ length: 21 }, () => randomUUID());
      const projectionTimes = [];
      const engine = {
        ...actualEngine,
        actNowAlerts: (_world, at) => {
          projectionTimes.push(at.getTime());
          return [{ id: "SYNTHETIC-ITEM", kind: "act-now", site: "Synthetic site" }];
        },
      };
      await createWorkspaceStore(pool, { workspaceId, engine, clock: () => new Date(now) }).read(actors[0]);
      await pool.query(
        "INSERT INTO ward_flow.push_subscriptions(workspace_id,actor_id,endpoint,p256dh,auth) SELECT $1,($2::uuid[])[((n-1)/10)+1],$3 || n,'synthetic','synthetic' FROM generate_series(1,201) n",
        [workspaceId, actors, `https://synthetic.invalid/${workspaceId}/`],
      );
      await pool.query(
        "INSERT INTO ward_flow.push_deliveries(subscription_id,item_id) SELECT id,'SYNTHETIC-ITEM' FROM ward_flow.push_subscriptions WHERE workspace_id=$1",
        [workspaceId],
      );
      const { promise: pageEntered, resolve: entered } = signal();
      const { promise: pageGate, resolve: releasePage } = signal();
      const { promise: retryEntered, resolve: retrying } = signal();
      const { promise: retryGate, resolve: releaseRetry } = signal();
      const sent = [],
        retried = [],
        logs = [];
      const common = {
        workspaceId,
        engine,
        clock: () => new Date(now),
        retryAfterMs: 60_000,
        log: (entry) => logs.push(entry),
      };
      const push = { coordinatorIds: actors, maxPerAccount: 10, payload: () => ({ synthetic: true }) };
      const a = createWorkspaceStore(pool, {
        ...common,
        push: {
          ...push,
          send: async (row) => {
            sent.push(row.endpoint);
            if (sent.length === 200) now = start + 61_000;
            if (row.endpoint.endsWith("/201")) {
              entered();
              await pageGate;
            }
            return { outcome: "sent" };
          },
        },
      });
      const b = createWorkspaceStore(pool, {
        ...common,
        push: {
          ...push,
          send: async (row) => {
            retried.push(row.endpoint);
            retrying();
            await retryGate;
            return { outcome: "sent" };
          },
        },
      });
      let passA, passB;
      const last = async () =>
        (
          await pool.query(
            "SELECT d.attempts,d.status,d.last_attempt_at FROM ward_flow.push_deliveries d JOIN ward_flow.push_subscriptions s ON s.id=d.subscription_id WHERE s.workspace_id=$1 AND s.endpoint LIKE '%/201'",
            [workspaceId],
          )
        ).rows[0];
      try {
        passA = a.sweepPush();
        await pageEntered;
        assert.equal(
          now - (await last()).last_attempt_at.getTime(),
          0,
          "page two starts its own lease after the slow earlier page",
        );
        assert.ok(projectionTimes.includes(now), "alert projection uses the fresh page time");
        await b.sweepPush();
        assert.deepEqual(retried, [], "another store cannot reclaim the fresh page");
        now += 60_001;
        passB = b.sweepPush();
        await retryEntered;
        const reclaimed = await last();
        assert.equal(reclaimed.attempts, 2, "a genuinely expired interrupted send is recoverable");
        releasePage();
        await passA;
        assert.equal((await last()).status, "pending", "the older acknowledgement cannot terminalise the newer claim");
        releaseRetry();
        await passB;
        assert.equal((await last()).status, "sent");
        assert.equal(retried.length, 1);
        assert.equal(sent.length, 201);
        assert.deepEqual(logs, []);
      } finally {
        releasePage();
        releaseRetry();
        await Promise.allSettled([passA, passB].filter(Boolean));
      }
    });
  },
);
