// @ts-check
// Compound drill 4 (master audit list, 10 Nov 2026), server half: a database restore, plus phone
// alerts already sent, plus saves waiting in open tabs, plus recovery notes that name saves the
// restored database has lost. Real loopback HTTP and PostgreSQL. The backup is a byte copy of the
// disposable database; the restore points a fresh backend at that copy, which is the runbook's
// "restore to a new project and repoint" path without its hosted steps. The open-tab half is
// tests/ward-audit-drill-4-restore-alerts-saves.dom.test.tsx. Synthetic data only.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { drillDatabaseUrl, drillFixture } from "./ward-audit-drill.test-support.mjs";

test(
  "real PostgreSQL HTTP: after a restore, lost saves have no receipt, waiting saves are re-checked, and sent alerts are counted",
  { skip: !drillDatabaseUrl, timeout: 90_000 },
  async (t) => {
    const f = await drillFixture(t, { actors: 2 });
    const [deskA, deskB] = f.actors;
    /** @type {string[]} */
    const sent = [];
    const push = {
      coordinatorIds: f.actors,
      maxPerAccount: 10,
      payload: (items) => ({ count: items.length }),
      send: async (_subscription, payload) => {
        sent.push(JSON.stringify(payload));
        return { outcome: "sent" };
      },
    };
    const device = {
      endpoint: `https://synthetic.invalid/push/${randomUUID()}`,
      p256dh: "synthetic-key",
      auth: "synthetic-auth",
    };

    // Before the backup: one save lands, a phone is registered and an alert is queued for it.
    const before = await f.startBackend(undefined, { push });
    let board = (await f.request(before.base, deskA)).body.snapshot;
    const unitIds = board.payload.state.units.map((unit) => unit.id);
    const kept = f.command({ type: "REQUEST_CAPACITY_REFRESH", unitId: unitIds[0] }, board.revision);
    const keptAnswer = await f.request(before.base, deskA, kept);
    assert.equal(keptAnswer.status, 200);
    board = keptAnswer.body.snapshot;
    assert.equal(await before.store.subscribe(deskA, device), "subscribed");
    const alerts = f.engine.actNowAlerts(board.payload, f.at);
    assert.ok(alerts.length > 0, "the synthetic seed has act-now alerts");
    const alertId = alerts[0].id;
    const { rows: subscriptions } = await before.pool.query(
      "SELECT id FROM ward_flow.push_subscriptions WHERE endpoint=$1",
      [device.endpoint],
    );
    await before.pool.query("INSERT INTO ward_flow.push_deliveries(subscription_id,item_id) VALUES($1,$2)", [
      subscriptions[0].id,
      alertId,
    ]);
    const backupRevision = board.revision;
    await f.stopBackend(before);
    const copy = await f.backup();

    // After the backup: the alert goes to the phone, and two more saves land.
    const after = await f.startBackend(undefined, { push });
    await after.store.sweepPush();
    const sentBeforeRestore = sent.length;
    assert.ok(sentBeforeRestore >= 1, "the queued alert was sent before the restore");
    const lostSaves = [];
    for (const unitId of unitIds.slice(1, 3)) {
      const save = f.command({ type: "REQUEST_CAPACITY_REFRESH", unitId }, board.revision);
      const answer = await f.request(after.base, deskA, save);
      assert.equal(answer.status, 200);
      board = answer.body.snapshot;
      lostSaves.push(save);
    }
    const tabRevision = board.revision;
    assert.equal(tabRevision, backupRevision + 2);
    // An open tab still holds a save it has not sent yet, made against the newest board.
    const waiting = f.command({ type: "REQUEST_CAPACITY_REFRESH", unitId: unitIds[3] }, tabRevision);
    await f.stopBackend(after);

    // The restore: a new backend on the backup copy.
    const restored = await f.startBackend(copy.url, { push });
    const reread = (await f.request(restored.base, deskB)).body.snapshot;
    assert.equal(reread.revision, backupRevision, "the restored board is the backup's, older than the open tab's");
    assert.ok(reread.revision < tabRevision);

    // Recovery notes naming the lost saves: the restored database has no receipt for them, and
    // still has the one made before the backup.
    for (const save of lostSaves) assert.equal(await restored.store.receipt(deskA, save.commandId), null);
    assert.notEqual(await restored.store.receipt(deskA, kept.commandId), null);
    const keptReceipts = (await f.receipts(copy.url)).map((row) => row.id);
    for (const save of lostSaves) assert.ok(!keptReceipts.includes(save.commandId));

    // The waiting save, made against a revision the restored database never reached, is answered
    // plainly (never a server fault) and never applied twice.
    const answer = await f.request(restored.base, deskA, waiting);
    assert.equal(answer.status, 409, "refused as stale: the person reviews the restored board first");
    const again = await f.request(restored.base, deskA, waiting);
    assert.equal(again.status, answer.status);
    const finalBoard = (await f.request(restored.base, deskB)).body.snapshot;
    assert.ok(finalBoard.revision <= backupRevision + 1, "the waiting save applied at most once");
    assert.ok(f.engine.validWorld(finalBoard.payload));

    // A lost save resent by the open tab under its old identity is a new save on the restored
    // board (its receipt went with the lost data), so it is checked against today's revision.
    const resend = await f.request(restored.base, deskA, lostSaves[0]);
    assert.ok(resend.status === 200 || resend.status === 409, `lost save resent: ${resend.status}`);

    // Alerts already sent: the restored copy still holds that alert as waiting, so the sweep sends
    // it to the phone again. Recorded, not hidden: the drill doc tells staff to expect a repeat.
    await restored.store.sweepPush();
    const repeats = sent.slice(sentBeforeRestore);
    t.diagnostic(
      `drill 4: backup at r${backupRevision}, tab at r${tabRevision}, restored at r${reread.revision}; ` +
        `waiting save answered ${answer.status} (${answer.body?.outcome ?? answer.body?.code ?? "no outcome"}); ` +
        `lost save resent answered ${resend.status}; alerts sent before restore ${sentBeforeRestore}, ` +
        `sent again after restore ${repeats.length}`,
    );
    assert.ok(repeats.length <= 1, "an alert sent in the gap is repeated at most once after a restore");
  },
);
