// @ts-check
// Audit M35: the audit trail is complete, ordered and add-only. A synthetic day is saved through
// the real store on CI's isolated loopback PostgreSQL (WARD_TEST_DATABASE_URL); the board is then
// rebuilt from the audit rows alone and must match. A grant test shows no login can change or
// remove an audit row. Synthetic seed data only; no provider is contacted.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Pool } from "pg";
import { dropTestDatabase } from "./drop-test-database.test-support.mjs";
import { migrate } from "./migrate.mjs";
import { createWorkspaceStore } from "./postgres.mjs";
import { assembleWorld } from "./records.mjs";

const url = process.env.WARD_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Audit trail tests require isolated loopback PostgreSQL");

const AT = new Date("2026-10-07T10:00:00Z");
const C = "coordinator";
// engine.ts SKIP_FACT_KEYS: the board's own audit, review and undo lists and transient refusals
// are not board facts, so the audit row's fact diff leaves them out.
const NOT_IN_FACTS = new Set(["auditEvents", "auditReviews", "rejections", "undoRecords"]);
const WITHHELD = "withheld from the audit";

async function databaseFixture(prefix, run) {
  const admin = new Pool({ connectionString: url, max: 1 });
  const database = `wardflow_${prefix}_${randomUUID().replaceAll("-", "")}`;
  const target = new URL(/** @type {string} */ (url));
  target.pathname = `/${database}`;
  await admin.query(`CREATE DATABASE ${database}`);
  const pool = new Pool({ connectionString: target.href, max: 4 });
  try {
    await migrate(pool);
    await run(pool);
  } finally {
    await pool.end();
    await dropTestDatabase(admin, database);
    await admin.end();
  }
}

/** Stable JSON with sorted keys, so jsonb's own key order never decides a comparison. */
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

/**
 * The same contact and file details engine.ts `auditableFact` keeps out of an audit row. A rebuilt
 * board cannot hold what the audit never had, so both sides are compared without them.
 */
function asAudited(key, row) {
  if (key !== "referrals" || !row?.intake) return row;
  const intake = row.intake;
  const clearance = intake.medicalClearance;
  return {
    ...row,
    intake: {
      ...intake,
      ...(intake.referrer === undefined ? {} : { referrer: WITHHELD }),
      ...(clearance && typeof clearance === "object"
        ? {
            medicalClearance: Object.fromEntries(
              Object.entries(clearance).map(([field, value]) =>
                field === "contactName" || field === "contactPhone" ? [field, WITHHELD] : [field, value],
              ),
            ),
          }
        : {}),
      ...(Array.isArray(intake.charts)
        ? {
            charts: intake.charts.map((chart) => (chart && "base64" in chart ? { ...chart, base64: WITHHELD } : chart)),
          }
        : {}),
    },
  };
}

/** Each board fact as a comparable value: arrays as a sorted list of rows, others as they are. */
function facts(state) {
  const out = {};
  for (const [key, value] of Object.entries(state)) {
    if (NOT_IN_FACTS.has(key)) continue;
    out[key] = Array.isArray(value) ? value.map((row) => canonical(asAudited(key, row))).sort() : canonical(value);
  }
  return out;
}

/** Applies one audit row's fact diff: array rows removed and added, other values replaced. */
function replayFacts(board, diff) {
  for (const [key, change] of Object.entries(diff)) {
    const current = board[key];
    if (Array.isArray(current)) {
      for (const removed of change.before.map((row) => canonical(row))) {
        const index = current.indexOf(removed);
        assert.ok(index >= 0, `audit removes a ${key} row the rebuilt board does not hold`);
        current.splice(index, 1);
      }
      current.push(...change.after.map((row) => canonical(row)));
      current.sort();
    } else board[key] = canonical(change.after);
  }
}

test(
  "real PostgreSQL: a synthetic day rebuilds from the audit log to match the board, with every attempt attributed in order",
  { skip: !url, timeout: 120_000 },
  async () => {
    const engine = await import("./dist/engine.mjs");
    await databaseFixture("m35_replay", async (pool) => {
      const workspaceId = randomUUID();
      const [nurse, coordinator] = [randomUUID(), randomUUID()];
      const store = createWorkspaceStore(pool, { workspaceId, engine, clock: () => AT, demoEvents: true });
      assert.equal((await store.read(nurse)).revision, 1);
      // [actor, event, expected status, the old revision it is sent from, if any]
      /** @type {Array<[string, any, number | "refused", number?]>} */
      const day = [
        [
          nurse,
          {
            type: "ACCEPT_REFERRAL",
            role: C,
            referralId: "RF-011",
            destinationKind: "psychiatric_ward",
            unitId: "rph-adult-secure",
            bedNumber: 1,
          },
          200,
        ],
        // Refused: the bed is now held for the accepted referral.
        [coordinator, { type: "PLACE_IN_BED", role: C, admissionId: "AD-RPHS-01", bedNumber: 1 }, 422],
        [
          nurse,
          {
            type: "HOLD_REFERRAL_BED",
            role: C,
            referralId: "RF-003",
            unitId: "scgh-adult-open",
            actingUnitId: "scgh-adult-open",
            bedNumber: 1,
          },
          200,
        ],
        [
          coordinator,
          { type: "ACCEPT_IN_PRINCIPLE", role: C, movementId: "WF-010", unitId: "gry-adult-secure", bedNumber: 1 },
          200,
        ],
        [nurse, { type: "PATIENT_ARRIVED", role: C, movementId: "WF-014" }, 200],
        [coordinator, { type: "PLACE_IN_BED", role: C, admissionId: "AD-RPHS-02", bedNumber: 2 }, 200],
        [nurse, { type: "ADVANCE_CLOCK", role: "demo", minutes: 120 }, 200],
        [coordinator, { type: "REQUEST_CAPACITY_REFRESH", role: C, unitId: "rph-adult-secure" }, 200],
        // Sent from an old revision into a bed taken since: refused or stale, never applied.
        [nurse, { type: "PLACE_IN_BED", role: C, admissionId: "AD-GRYS-01", bedNumber: 1 }, "refused", 1],
      ];
      const sent = [];
      let revision = 1;
      for (const [actor, event, expected, from] of day) {
        const commandId = randomUUID();
        const expectedRevision = from ?? revision;
        const result = await store.command(actor, commandId, expectedRevision, event);
        if (expected === "refused") assert.ok([409, 422].includes(result.status), `${event.type} ${result.status}`);
        else assert.equal(result.status, expected, `${event.type}: ${result.body.error ?? ""}`);
        revision = result.body.commandRevision;
        sent.push({ actor, commandId, event, status: result.status });
        // A lost reply: the retry replays the first answer and writes no second audit row.
        if (sent.length === 2) {
          const retry = await store.command(actor, commandId, expectedRevision, event);
          assert.equal(retry.body.replayed, true);
          assert.equal(retry.status, result.status);
        }
      }

      const { rows } = await pool.query(
        "SELECT sequence, actor_id, command_id, action, outcome, prior_revision, revision, changes FROM ward_flow.audit WHERE workspace_id=$1 ORDER BY sequence",
        [workspaceId],
      );
      // Attribution, in order: the workspace start, then one row per attempt in the order sent.
      assert.equal(rows[0].action, "INITIALISE_WORKSPACE");
      const attempts = rows.slice(1);
      assert.deepEqual(
        attempts.map((row) => [row.actor_id, row.command_id, row.action]),
        sent.map((entry) => [entry.actor, entry.commandId, entry.event.type]),
        "each attempt is audited once, as its sender, in the order it was made",
      );
      assert.deepEqual(
        attempts.map((row) => row.outcome),
        sent.map((entry) => (entry.status === 200 ? "accepted" : entry.status === 409 ? "stale" : "denied")),
      );
      let at = 1;
      for (const row of attempts) {
        assert.equal(Number(row.prior_revision), at, `${row.action} starts from the revision before it`);
        assert.equal(Number(row.revision), row.outcome === "accepted" ? at + 1 : at);
        at = Number(row.revision);
      }

      // Rebuild: the seed, then each accepted row's fact diff, and nothing else.
      const rebuilt = facts(engine.seedWorld(AT).state);
      for (const row of attempts)
        if (row.outcome === "accepted") replayFacts(rebuilt, row.changes.facts);
        else assert.deepEqual(row.changes, {}, "a refused attempt changes nothing");
      // The saved board itself, as the tables hold it (a desk's read leaves some details out).
      const { rows: workspace } = await pool.query("SELECT revision, payload FROM ward_flow.workspaces WHERE id=$1", [
        workspaceId,
      ]);
      assert.equal(Number(workspace[0].revision), at, "the audit's last revision is the board's");
      const { rows: records } = await pool.query(
        "SELECT collection, record_id, kind, ordinal, revision, body FROM ward_flow.workspace_records WHERE workspace_id=$1",
        [workspaceId],
      );
      const board = assembleWorld(workspace[0].payload, records).state;
      assert.ok(engine.validWorld({ ...assembleWorld(workspace[0].payload, records) }));
      const saved = facts(board);
      const differing = [...new Set([...Object.keys(rebuilt), ...Object.keys(saved)])].filter(
        (key) => canonical(rebuilt[key]) !== canonical(saved[key]),
      );
      assert.deepEqual(differing, [], "the board rebuilt from the audit log matches the saved board");
    });
  },
);

test(
  "real PostgreSQL: no login can change or remove an audit row; the backend may only add and read",
  { skip: !url, timeout: 60_000 },
  async (t) => {
    await databaseFixture("m35_grants", async (pool) => {
      for (const role of ["anon", "authenticated"])
        await pool.query(
          `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${role}') THEN CREATE ROLE ${role} NOLOGIN; END IF; END $$`,
        );
      await pool.query(await readFile(new URL("./infra/supabase-runtime-role.sql", import.meta.url), "utf8"));
      const workspaceId = randomUUID();
      await pool.query("INSERT INTO ward_flow.workspaces(id, revision, payload) VALUES ($1, 1, '{}'::jsonb)", [
        workspaceId,
      ]);
      const insert = `INSERT INTO ward_flow.audit(workspace_id, actor_id, action, outcome, prior_revision, revision, changes) VALUES ('${workspaceId}', '${randomUUID()}', 'INITIALISE_WORKSPACE', 'accepted', 0, 1, '{}'::jsonb)`;
      await pool.query(insert);

      /** Every non-superuser role, login or not, that could change or remove an audit row by grant. */
      async function editors() {
        const { rows } = await pool.query(
          "SELECT r.rolname AS role, p.privilege FROM pg_roles r CROSS JOIN unnest(ARRAY['UPDATE','DELETE','TRUNCATE']) AS p(privilege) WHERE NOT r.rolsuper AND r.rolname NOT LIKE 'pg\\_%' AND (has_table_privilege(r.oid, 'ward_flow.audit', p.privilege) OR (p.privilege = 'UPDATE' AND has_any_column_privilege(r.oid, 'ward_flow.audit', 'UPDATE'))) ORDER BY 1, 2",
        );
        return rows.map((row) => `${row.role} ${row.privilege}`);
      }
      const { rows: publicGrant } = await pool.query(
        "SELECT count(*)::int AS n FROM information_schema.role_table_grants WHERE table_schema='ward_flow' AND table_name='audit' AND grantee='PUBLIC'",
      );

      await t.test("no role but a superuser holds UPDATE, DELETE or TRUNCATE on the audit table", async () => {
        assert.deepEqual(await editors(), []);
        assert.equal(publicGrant[0].n, 0, "nothing is granted to PUBLIC");
      });

      await t.test("the backend login adds and reads audit rows and is refused every change", async () => {
        const runtime = await pool.connect();
        try {
          await runtime.query("BEGIN");
          await runtime.query("SET LOCAL ROLE wardflow_backend");
          await runtime.query(insert);
          const { rowCount } = await runtime.query("SELECT 1 FROM ward_flow.audit WHERE workspace_id=$1", [
            workspaceId,
          ]);
          assert.equal(rowCount, 2);
          for (const sql of [
            "UPDATE ward_flow.audit SET action='FORGED' WHERE true",
            "DELETE FROM ward_flow.audit WHERE true",
            "TRUNCATE ward_flow.audit",
          ]) {
            await runtime.query("SAVEPOINT attempt");
            await assert.rejects(runtime.query(sql), (error) => /** @type {any} */ (error).code === "42501", sql);
            await runtime.query("ROLLBACK TO SAVEPOINT attempt");
          }
        } finally {
          await runtime.query("ROLLBACK");
          runtime.release();
        }
      });

      await t.test("even the table owner is stopped by the append-only guard", async () => {
        for (const sql of [
          "UPDATE ward_flow.audit SET action='FORGED' WHERE true",
          "DELETE FROM ward_flow.audit WHERE true",
          "TRUNCATE ward_flow.audit",
        ])
          await assert.rejects(pool.query(sql), /append-only/, sql);
      });

      await t.test("the grant check notices a mistaken edit grant", async () => {
        await pool.query("GRANT UPDATE (action), DELETE ON ward_flow.audit TO wardflow_backend");
        try {
          assert.deepEqual(await editors(), ["wardflow_backend DELETE", "wardflow_backend UPDATE"]);
        } finally {
          await pool.query("REVOKE UPDATE (action), DELETE ON ward_flow.audit FROM wardflow_backend");
        }
        assert.deepEqual(await editors(), []);
      });
    });
  },
);
