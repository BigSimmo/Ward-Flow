// @ts-check
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { migrate } from "./migrate.mjs";
import { createWorkspaceStore } from "./postgres.mjs";
import * as engine from "./dist/engine.mjs";

const url = process.env.WARD_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Isolated loopback database required");
const methods = [
  "auditPage",
  "deskAuditPage",
  "recordViews",
  "breakGlassOpenings",
  "listAccess",
  "listCovers",
  "forecastHistory",
];
for (const method of methods)
  for (const ending of ["revoked", "expired"])
    test(`PostgreSQL ${method}: ${ending} during lock wait refuses`, { skip: !url, timeout: 15000 }, async () => {
      const application = `access-read-repairs-${randomUUID()}`;
      const pool = new Pool({ connectionString: url, max: 3, statement_timeout: 8000, application_name: application });
      const control = await pool.connect();
      const workspaceId = randomUUID(),
        actorId = randomUUID(),
        membershipId = randomUUID();
      let locked = false;
      let wake = () => {};
      const dispatched = new Promise((resolve) => {
        wake = () => resolve(undefined);
      });
      const observed = {
        query: pool.query.bind(pool),
        connect: async () => {
          const client = await pool.connect();
          return {
            release: client.release.bind(client),
            query: (sql, params) => {
              const result = client.query(sql, params);
              if (sql.includes("FROM ward_flow.workspaces") && sql.includes("FOR SHARE")) wake();
              return result;
            },
          };
        },
      };
      const at = new Date("2026-11-04T12:00:00Z");
      let now = at;
      try {
        await migrate(pool);
        const setup = createWorkspaceStore(pool, { workspaceId, engine, clock: () => now });
        await setup.read(actorId);
        const role = method === "listAccess" ? "admin" : "coordinator";
        await control.query(
          "INSERT INTO ward_flow.memberships(id,workspace_id,actor_id,role,scope,granted_by,granted_at,expires_at,last_used_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$7)",
          [
            membershipId,
            workspaceId,
            actorId,
            role,
            { kind: "statewide" },
            randomUUID(),
            at,
            new Date(at.getTime() + 60000),
          ],
        );
        const view = await setup.viewer(actorId, { workingAs: membershipId });
        assert.equal(view.status, "ok");
        // A legitimate read before the competing change remains valid.
        await setup[method](view);
        await control.query("BEGIN");
        locked = true;
        await control.query("SELECT id FROM ward_flow.workspaces WHERE id=$1 FOR UPDATE", [workspaceId]);
        const store = createWorkspaceStore(observed, { workspaceId, engine, clock: () => now });
        const pending = store[method]({ ...view });
        const refused = assert.rejects(pending, /role-ended/);
        await dispatched;
        let waiting = false;
        for (let attempt = 0; attempt < 100; attempt++) {
          await control.query("SELECT pg_stat_clear_snapshot()");
          const status = await control.query(
            "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE '%FOR SHARE%') AS blocked",
            [application],
          );
          if (status.rows[0].blocked) {
            waiting = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        assert.equal(waiting, true, "observe the actual PostgreSQL lock wait before ending authority");
        if (ending === "revoked")
          await control.query("UPDATE ward_flow.memberships SET revoked_at=$2, revoked_by=granted_by WHERE id=$1", [
            membershipId,
            at,
          ]);
        else now = new Date(at.getTime() + 120000);
        await control.query("COMMIT");
        locked = false;
        await refused;
      } finally {
        if (locked) await control.query("ROLLBACK");
        control.release();
        // These rows contain synthetic test data only, in one uniquely named workspace.
        await pool.query("DELETE FROM ward_flow.workspaces WHERE id=$1", [workspaceId]).catch(() => {});
        await pool.end();
      }
    });
