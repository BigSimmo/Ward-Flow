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
  throw new Error("Opening lifecycle tests require isolated loopback PostgreSQL");

test(
  "real PostgreSQL: exceptional openings survive resolution without crossing a reset generation",
  { skip: !url, timeout: 30_000 },
  async () => {
    const pool = new Pool({ connectionString: url, max: 4 });
    const workspaceId = randomUUID();
    const lead = randomUUID();
    const nurse = randomUUID();
    let at = new Date("2026-11-04T12:00:00Z");
    try {
      await migrate(pool);
      const store = createWorkspaceStore(pool, {
        workspaceId,
        engine,
        clock: () => at,
        demoEvents: true,
        slowCommandMs: 60_000,
      });
      const leadView = await store.viewer(lead, { bootstrap: true });
      const initial = await store.read(lead, leadView);
      const scope = { kind: "ward", unitIds: [initial.payload.state.units[0].id] };
      const granted = await store.grantAccess(leadView, {
        actorId: nurse,
        role: "ward",
        scope,
        expiresAt: new Date(at.getTime() + 24 * 60 * 60_000),
      });
      assert.equal(granted.status, 200);
      const membershipId = granted.body.membership.id;
      const viewer = () => store.viewer(nurse, { workingAs: membershipId });
      const before = await store.read(nurse, await viewer());
      const foreign = initial.payload.state.patients.find(
        (candidate) => !before.payload.state.patients.some(({ id }) => id === candidate.id),
      );
      assert.ok(foreign, "there is a synthetic record outside the ward's care");
      const sees = (snapshot) => snapshot.payload.state.patients.some(({ id }) => id === foreign.id);
      const opened = await store.breakGlass(await viewer(), foreign.id, "handover");
      assert.equal(opened.status, 200);
      assert.equal(sees(opened.body.snapshot), true);
      assert.equal(sees(await store.read(nurse, await viewer())), true);

      // A pre-repair immutable opening has no generation-bearing audit record. It belongs only to
      // generation zero and must not follow the reused ID. INSERT preserves the existing history.
      const legacy = await pool.query(
        "INSERT INTO ward_flow.break_glass(workspace_id, actor_id, membership_id, patient_id, reason, opened_at, until) VALUES ($1,$2,$3,$4,'handover',$5,$6) RETURNING id::text AS id",
        [workspaceId, nurse, membershipId, foreign.id, at, new Date(opened.body.until)],
      );
      assert.equal(
        (await viewer()).grants.every(({ generation }) => generation === 0),
        true,
      );
      const beforeReset = await store.read(lead, leadView);
      const reset = await store.command(
        lead,
        randomUUID(),
        beforeReset.revision,
        { type: "RESET_SCENARIO", role: "demo" },
        { view: leadView },
      );
      assert.equal(reset.status, 200);
      const resetWorld = await store.read(lead, leadView);
      assert.equal(resetWorld.payload.state.worldGeneration, 1);
      assert.ok(
        resetWorld.payload.state.patients.some(({ id }) => id === foreign.id),
        "supported reset reuses ID",
      );
      assert.equal(
        sees(await store.read(nurse, await viewer())),
        false,
        "neither bound generation-zero nor legacy opening authorises the new record",
      );

      const reopened = await store.breakGlass(await viewer(), foreign.id, "handover");
      assert.equal(reopened.status, 200);
      assert.equal(sees(reopened.body.snapshot), true);
      assert.equal(sees(await store.read(nurse, await viewer())), true);
      assert.equal(opened.body.until, reopened.body.until, "identical expiry must not confuse opening identity");
      const resolved = await viewer();
      assert.deepEqual(resolved.grants.map(({ generation }) => generation).sort(), [0, 0, 1]);
      const history = await pool.query(
        "SELECT b.id::text AS id, b.until, a.changes FROM ward_flow.break_glass b LEFT JOIN ward_flow.audit a ON a.workspace_id=b.workspace_id AND a.actor_id=b.actor_id AND a.action='BREAK_GLASS' AND a.changes->>'openingId'=b.id::text WHERE b.workspace_id=$1 ORDER BY b.id",
        [workspaceId],
      );
      assert.equal(history.rows.length, 3, "reset and reopening preserve all original history");
      assert.deepEqual(
        history.rows.filter(({ changes }) => changes).map(({ changes }) => changes.worldGeneration),
        [0, 1],
      );
      assert.equal(history.rows.find(({ id }) => id === legacy.rows[0].id).changes, null);
      at = new Date(at.getTime() + (engine.BREAK_GLASS_MINUTES + 1) * 60_000);
      assert.equal((await viewer()).grants.length, 0);
      assert.equal(sees(await store.read(nurse, await viewer())), false);
    } finally {
      await pool.end();
    }
  },
);

test(
  "real PostgreSQL: the accepted 21st membership and 21st joined cover are usable",
  { skip: !url, timeout: 30_000 },
  async () => {
    const pool = new Pool({ connectionString: url, max: 4 });
    const workspaceId = randomUUID();
    const lead = randomUUID();
    const nurse = randomUUID();
    let at = new Date("2026-11-04T12:00:00Z");
    try {
      await migrate(pool);
      const store = createWorkspaceStore(pool, { workspaceId, engine, clock: () => at });
      const leadView = await store.viewer(lead, { bootstrap: true });
      const initial = await store.read(lead, leadView);
      const [ownUnit, coverUnit] = initial.payload.state.units.map(({ id }) => id);
      const scope = { kind: "ward", unitIds: [ownUnit] };
      const memberships = [];
      for (let index = 0; index < 21; index++) {
        at = new Date(at.getTime() + 1); // Establish insertion order independently of random UUIDs.
        const result = await store.grantAccess(leadView, {
          actorId: nurse,
          role: "ward",
          scope,
          expiresAt: new Date(at.getTime() + 24 * 60 * 60_000),
        });
        assert.equal(result.status, 200);
        memberships.push(result.body.membership.id);
      }
      const selected = await store.viewer(nurse, { workingAs: memberships[20] });
      assert.equal(selected.status, "ok");
      assert.equal(selected.membershipId, memberships[20]);
      const choices = await store.viewer(nurse);
      assert.equal(choices.status, "choose");
      assert.equal(choices.choices?.length, 21);

      // A separate account gets twenty ordinary rows followed by a cover. This tests the row that
      // used to be truncated before cover joining, while keeping the chosen ordinary desk valid.
      const coveredNurse = randomUUID();
      let baseMembership;
      for (let index = 0; index < 20; index++) {
        at = new Date(at.getTime() + 1);
        const result = await store.grantAccess(leadView, {
          actorId: coveredNurse,
          role: "ward",
          scope,
          expiresAt: new Date(at.getTime() + 24 * 60 * 60_000),
        });
        assert.equal(result.status, 200);
        baseMembership ??= result.body.membership.id;
      }
      at = new Date(at.getTime() + 1);
      const cover = await store.giveCover(leadView, {
        actorId: coveredNurse,
        scope: { kind: "ward", unitIds: [coverUnit] },
        minutes: 60,
      });
      assert.equal(cover.status, 200);
      const covered = await store.viewer(coveredNurse, { workingAs: baseMembership });
      assert.equal(covered.status, "ok");
      assert.ok(covered.access.scope.unitIds.includes(ownUnit));
      assert.ok(covered.access.scope.unitIds.includes(coverUnit));
    } finally {
      await pool.end();
    }
  },
);
