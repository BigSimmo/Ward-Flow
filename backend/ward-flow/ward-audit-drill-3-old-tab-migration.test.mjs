// @ts-check
// Compound drill 3 (master audit list, 10 Nov 2026; links M10, M33, M34), server half: an old open
// tab, plus a migration, plus waiting saves. Real loopback HTTP and PostgreSQL in a disposable
// database. The previous backend runs on the schema one migration back; the newest migration is
// applied while it runs (as the release does); a new backend starts beside it; the old tab's saves,
// made against the board it read before the release, then reach both backends. The rollback script
// is run at the end and both backends must keep answering. The old-tab client half is
// tests/ward-audit-drill-3-old-tab-migration.dom.test.tsx. Synthetic data only.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Pool } from "pg";
import { LATEST_MIGRATION, MIGRATIONS, readMigration } from "./migrations.mjs";
import { drillDatabaseUrl, drillFixture } from "./ward-audit-drill.test-support.mjs";

const previous = LATEST_MIGRATION - 1;

test(
  "real PostgreSQL HTTP: waiting saves from a tab opened before a migration land once on the old and new backends",
  { skip: !drillDatabaseUrl, timeout: 90_000 },
  async (t) => {
    const f = await drillFixture(t, { actors: 2, migrateTo: previous });
    const [tab, otherDesk] = f.actors;
    const oldBackend = await f.startBackend();

    // Before the release: the tab reads its board, then makes two saves while offline.
    const opened = (await f.request(oldBackend.base, tab)).body.snapshot;
    const units = opened.payload.state.units.map((unit) => unit.id);
    const waitingNew = f.command({ type: "REQUEST_CAPACITY_REFRESH", unitId: units[0] }, opened.revision);
    const waitingOld = f.command({ type: "REQUEST_CAPACITY_REFRESH", unitId: units[1] }, opened.revision);
    // Another desk saves a different record on the old backend meanwhile.
    const meanwhile = await f.request(
      oldBackend.base,
      otherDesk,
      f.command({ type: "REQUEST_CAPACITY_REFRESH", unitId: units[2] }, opened.revision),
    );
    assert.equal(meanwhile.status, 200);

    // The release: the newest migration is applied while the old backend is still serving.
    const migrator = new Pool({ connectionString: f.primary.url, max: 1 });
    try {
      const latest = MIGRATIONS.find((row) => row.version === LATEST_MIGRATION);
      assert.ok(latest);
      const started = Date.now();
      await migrator.query(await readMigration(latest));
      t.diagnostic(
        `drill 3: migration ${LATEST_MIGRATION} applied in ${Date.now() - started} ms while the old backend served`,
      );
    } finally {
      await migrator.end();
    }
    const newBackend = await f.startBackend();

    // The old tab reconnects: one waiting save reaches the new backend, one the old.
    const toNew = await f.request(newBackend.base, tab, waitingNew);
    const toOld = await f.request(oldBackend.base, tab, waitingOld);
    for (const answer of [toNew, toOld])
      assert.ok([200, 409].includes(answer.status), `waiting save answered ${answer.status}`);
    // Each waiting save names a different record from the other desk's, so each is accepted.
    assert.equal(toNew.status, 200, JSON.stringify(toNew.body?.error ?? toNew.body?.outcome));
    assert.equal(toOld.status, 200, JSON.stringify(toOld.body?.error ?? toOld.body?.outcome));

    // A Retry of each, sent to the other backend, replays its receipt: nothing applies twice.
    const replayOld = await f.request(oldBackend.base, tab, waitingNew);
    const replayNew = await f.request(newBackend.base, tab, waitingOld);
    assert.equal(replayOld.body.replayed, true);
    assert.equal(replayNew.body.replayed, true);
    const fromNew = (await f.request(newBackend.base, otherDesk)).body.snapshot;
    const fromOld = (await f.request(oldBackend.base, otherDesk)).body.snapshot;
    assert.equal(fromNew.revision, opened.revision + 3, "three saves, each applied once");
    assert.equal(fromOld.revision, fromNew.revision, "both backends read the same board");
    assert.ok(f.engine.validWorld(fromNew.payload));
    const receipts = (await f.receipts()).map((row) => row.id);
    for (const save of [waitingNew, waitingOld]) assert.equal(receipts.filter((id) => id === save.commandId).length, 1);

    // The rollback script for the newest migration: both backends keep answering afterwards.
    const rollback = await readFile(
      new URL(
        `./infra/rollback-${String(LATEST_MIGRATION).padStart(3, "0")}-${MIGRATIONS.at(-1)?.file.slice(4)}`,
        import.meta.url,
      ),
      "utf8",
    );
    const admin = new Pool({ connectionString: f.primary.url, max: 1 });
    try {
      await admin.query("BEGIN");
      await admin.query(rollback);
      await admin.query("COMMIT");
    } finally {
      await admin.end();
    }
    for (const backend of [oldBackend, newBackend]) {
      const read = await f.request(backend.base, otherDesk);
      assert.equal(read.status, 200);
      const save = await f.request(
        backend.base,
        otherDesk,
        f.command({ type: "REQUEST_CAPACITY_REFRESH", unitId: units[3] }, read.body.snapshot.revision),
      );
      assert.equal(save.status, 200, `after rollback: ${JSON.stringify(save.body?.error ?? save.body)}`);
    }
  },
);
