import { createHash } from "node:crypto";
import { Pool } from "pg";
import { DefaultAzureCredential } from "@azure/identity";
import { errorFields, freshAlerts } from "./push.mjs";

const SUBSCRIPTION_PAGE = 200;
/** A device whose sends keep failing for a reason that may pass is tried this many times. */
export const MAX_DELIVERY_ATTEMPTS = 5;

export function createPostgresPool(config, credential = new DefaultAzureCredential()) {
  const pool = new Pool({
    host: config.host,
    database: config.database,
    user: config.user,
    port: 5432,
    password: async () => {
      const token = await credential.getToken("https://ossrdbms-aad.database.windows.net/.default");
      if (!token) throw new Error("Database identity unavailable");
      return token.token;
    },
    ssl: { rejectUnauthorized: true },
    max: 4,
    connectionTimeoutMillis: 6000,
    idleTimeoutMillis: 30000,
    statement_timeout: 10000,
  });
  pool.on("error", () => {
    console.error("Ward Flow database connection unavailable");
  });
  return pool;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}

/**
 * @param push Optional phone push from push.mjs `createPush`: `{ send, payload, coordinatorIds,
 *   maxPerAccount }`. `send(subscription, payload)` resolves `{ outcome }` as in push.mjs.
 *   Absent means the feature is off.
 * @param log Structured diagnostics: closed event names and push.mjs `errorFields` only.
 * @param deliveryWaitMs How long a command response waits for phone delivery before returning;
 *   delivery carries on in the background after that.
 * @param retryAfterMs How long a claimed delivery waits before another attempt may claim it: the
 *   gap between retries, and how long an interrupted delivery waits for the sweep.
 */
export function createWorkspaceStore(
  pool,
  {
    workspaceId,
    engine,
    clock = () => new Date(),
    push = null,
    log = (event) => console.error(JSON.stringify(event)),
    deliveryWaitMs = 1500,
    retryAfterMs = 60_000,
  },
) {
  const snapshot = (row, at) => ({
    dataMode: row.data_mode,
    revision: Number(row.revision),
    payload: row.payload,
    now: engine.worldNow(row.payload, at),
  });
  async function transaction(run) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await run(client, clock());
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  async function lock(client, actorId, at) {
    const created = await client.query(
      "INSERT INTO ward_flow.workspaces(id, revision, payload) VALUES ($1, 1, $2) ON CONFLICT DO NOTHING RETURNING id",
      [workspaceId, engine.seedWorld(at)],
    );
    if (created.rowCount)
      await client.query(
        "INSERT INTO ward_flow.audit(workspace_id, actor_id, action, outcome, prior_revision, revision, changes) VALUES ($1, $2, 'INITIALISE_WORKSPACE', 'accepted', 0, 1, '{}')",
        [workspaceId, actorId],
      );
    const { rows } = await client.query(
      "SELECT data_mode, revision, payload FROM ward_flow.workspaces WHERE id=$1 AND data_mode='prototype' FOR UPDATE",
      [workspaceId],
    );
    if (rows[0]?.data_mode !== "prototype") throw new Error("Workspace data mode mismatch");
    if (!engine.validWorld(rows[0]?.payload)) throw new Error("Stored workspace is incompatible");
    return rows[0];
  }
  /**
   * Inside the workspace lock: the act-now rows not announced at the last evaluation. The first
   * evaluation compares with `before` (the state the command started from), so turning the feature
   * on never announces alerts that were already there. A reset world starts a new baseline, as
   * the open-tab notifier does. In the same transaction, queues a pending delivery for each
   * new item on each active device of an account still named as coordinator, except the account
   * that made the change. Returns whether anything was queued.
   */
  async function evaluatePush(client, world, before, at, excludeActorId) {
    if (!push) return false;
    const current = engine.actNowAlerts(world, at);
    const stored = await client.query(
      "SELECT item_ids FROM ward_flow.push_baselines WHERE workspace_id=$1 AND data_mode='prototype' FOR UPDATE",
      [workspaceId],
    );
    const reset = before.state.worldGeneration !== world.state.worldGeneration;
    const previous = reset
      ? current.map((alert) => alert.id)
      : stored.rowCount
        ? stored.rows[0].item_ids
        : engine.actNowAlerts(before, at).map((alert) => alert.id);
    await client.query(
      "INSERT INTO ward_flow.push_baselines(workspace_id, item_ids, evaluated_at) VALUES ($1, $2, $3) ON CONFLICT (workspace_id) DO UPDATE SET item_ids=EXCLUDED.item_ids, evaluated_at=EXCLUDED.evaluated_at",
      [workspaceId, JSON.stringify(current.map((alert) => alert.id)), at],
    );
    // An item no longer red is never announced late; its rows go, so the table stays small. Done
    // here, under the workspace and baseline locks, so it can never race a commit that has just
    // queued a new item (deliver() reads the world without a lock and could hold a stale red set).
    await client.query(
      "DELETE FROM ward_flow.push_deliveries d USING ward_flow.push_subscriptions s WHERE d.subscription_id = s.id AND s.workspace_id=$1 AND NOT (d.item_id = ANY($2::text[]))",
      [workspaceId, current.map((alert) => alert.id)],
    );
    const fresh = freshAlerts(previous, current);
    if (!fresh.length) return false;
    // An item that left and came back red is announced again, as the open-tab notifier does.
    const queued = await client.query(
      "INSERT INTO ward_flow.push_deliveries(subscription_id, item_id) SELECT s.id, item FROM ward_flow.push_subscriptions s CROSS JOIN unnest($4::text[]) AS item WHERE s.workspace_id=$1 AND s.data_mode='prototype' AND s.revoked_at IS NULL AND s.actor_id = ANY($2::uuid[]) AND ($3::uuid IS NULL OR s.actor_id <> $3::uuid) ON CONFLICT (subscription_id, item_id) DO UPDATE SET status='pending', attempts=0, last_attempt_at=NULL",
      [workspaceId, push.coordinatorIds, excludeActorId, fresh.map((alert) => alert.id)],
    );
    return queued.rowCount > 0;
  }
  /**
   * After commit, and from the sweep: send each device one notification for its due pending
   * deliveries, a page of devices at a time. Rows are claimed (attempts + 1, last attempt now)
   * before sending, so a concurrent sweep never sends them too, and a delivery cut off mid-way
   * (an instance recycled after the command returned) is picked up once `retryAfterMs` passes.
   *
   * Sent rows are marked sent. A device the push service reports gone is deleted with its rows.
   * A failure that may pass leaves that device's rows pending for a later sweep, up to
   * MAX_DELIVERY_ATTEMPTS; any other refusal marks them failed. Retries only ever go to the device
   * that failed, so the worker's `renotify` never re-buzzes a device that already has the alert.
   */
  async function deliver() {
    const counts = { sent: 0, expired: 0, failed: 0 };
    const failures = {};
    try {
      const at = clock();
      const readRed = async () => {
        const { rows: worlds } = await pool.query(
          "SELECT payload FROM ward_flow.workspaces WHERE id=$1 AND data_mode='prototype'",
          [workspaceId],
        );
        if (!worlds[0] || !engine.validWorld(worlds[0].payload)) return null;
        return new Map(engine.actNowAlerts(worlds[0].payload, at).map((alert) => [alert.id, alert]));
      };
      const due = "d.status='pending' AND d.attempts < $3 AND (d.last_attempt_at IS NULL OR d.last_attempt_at <= $4)";
      let after = "0";
      for (;;) {
        const { rows } = await pool.query(
          `UPDATE ward_flow.push_deliveries d SET attempts = d.attempts + 1, last_attempt_at = $5 FROM ward_flow.push_subscriptions s WHERE d.subscription_id = s.id AND ${due} AND d.subscription_id IN (SELECT DISTINCT d.subscription_id FROM ward_flow.push_deliveries d JOIN ward_flow.push_subscriptions s ON s.id = d.subscription_id WHERE s.workspace_id=$1 AND s.data_mode='prototype' AND s.revoked_at IS NULL AND s.actor_id = ANY($2::uuid[]) AND ${due} AND d.subscription_id > $6 ORDER BY d.subscription_id LIMIT $7) RETURNING d.subscription_id AS id, d.item_id, s.endpoint, s.p256dh, s.auth`,
          [
            workspaceId,
            push.coordinatorIds,
            MAX_DELIVERY_ATTEMPTS,
            new Date(at.getTime() - retryAfterMs),
            at,
            after,
            SUBSCRIPTION_PAGE,
          ],
        );
        if (!rows.length) break;
        // Read the world after each claim. The claim has seen every commit that queued or cleared
        // its rows, so this read neither misses a new item nor sends one already cleared. A world
        // that cannot be read leaves the claimed rows to come due again for a later delivery.
        const red = await readRed();
        if (!red) return;
        const devices = new Map();
        const unseen = { ids: [], items: [] };
        for (const row of rows) {
          const item = red.get(row.item_id);
          // An item no longer red is released unclaimed for the next evaluation to clear,
          // never sent as an empty entry or marked sent with the device's other rows.
          if (!item) {
            unseen.ids.push(row.id);
            unseen.items.push(row.item_id);
            continue;
          }
          const device = devices.get(row.id) ?? { ...row, items: [] };
          device.items.push(item);
          devices.set(row.id, device);
        }
        after = rows.map((row) => row.id).reduce((a, b) => (BigInt(a) > BigInt(b) ? a : b));
        if (unseen.ids.length)
          await pool.query(
            "UPDATE ward_flow.push_deliveries d SET attempts = d.attempts - 1, last_attempt_at = NULL FROM unnest($1::bigint[], $2::text[]) AS u(id, item) WHERE d.subscription_id = u.id AND d.item_id = u.item AND d.status='pending' AND d.last_attempt_at=$3",
            [unseen.ids, unseen.items, at],
          );
        const list = [...devices.values()];
        const results = await Promise.all(list.map((device) => push.send(device, push.payload(device.items))));
        const ids = { sent: [], expired: [], retry: [], rejected: [] };
        results.forEach((result, index) => {
          counts[result.outcome] += 1;
          if (result.outcome === "failed") {
            failures[result.category] = (failures[result.category] ?? 0) + 1;
            ids[result.retry ? "retry" : "rejected"].push(list[index].id);
          } else ids[result.outcome].push(list[index].id);
        });
        const claimed = "subscription_id = ANY($1::bigint[]) AND status='pending' AND last_attempt_at=$2";
        if (ids.sent.length) {
          await pool.query(`UPDATE ward_flow.push_deliveries SET status='sent' WHERE ${claimed}`, [ids.sent, at]);
          await pool.query("UPDATE ward_flow.push_subscriptions SET last_success_at=$2 WHERE id = ANY($1::bigint[])", [
            ids.sent,
            at,
          ]);
        }
        if (ids.expired.length)
          await pool.query("DELETE FROM ward_flow.push_subscriptions WHERE id = ANY($1::bigint[])", [ids.expired]);
        if (ids.rejected.length)
          await pool.query(`UPDATE ward_flow.push_deliveries SET status='failed' WHERE ${claimed}`, [ids.rejected, at]);
        if (ids.retry.length)
          await pool.query(
            `UPDATE ward_flow.push_deliveries SET status = CASE WHEN attempts >= $3 THEN 'failed' ELSE 'pending' END WHERE ${claimed}`,
            [ids.retry, at, MAX_DELIVERY_ATTEMPTS],
          );
        if (new Set(rows.map((row) => row.id)).size < SUBSCRIPTION_PAGE) break;
      }
      if (counts.failed) log({ event: "ward_backend_push_delivery_failures", ...counts, failures });
    } catch (error) {
      // A push is a courtesy after the committed change. Its failure never alters the command result.
      log({ event: "ward_backend_push_delivery_unavailable", ...counts, ...errorFields(error) });
    }
  }
  return {
    pushEnabled: !!push,
    async ready() {
      const version = push ? 3 : 2;
      const { rows } = await pool.query("SELECT version FROM ward_flow.migrations WHERE version=$1", [version]);
      if (!rows.length) throw new Error("Shared schema unavailable");
    },
    async subscribe(actorId, subscription) {
      if (!push) throw new Error("push-disabled");
      return transaction(async (client, at) => {
        await lock(client, actorId, at);
        const owned = await client.query(
          "SELECT count(*)::int AS count FROM ward_flow.push_subscriptions WHERE workspace_id=$1 AND actor_id=$2 AND revoked_at IS NULL AND endpoint <> $3",
          [workspaceId, actorId, subscription.endpoint],
        );
        if (owned.rows[0].count >= push.maxPerAccount) return "limit";
        // The endpoint is unique across every account and workspace. A device is taken over only
        // once its previous owner's record is revoked (they turned alerts off or signed out); an
        // active record of another account or workspace is never overwritten.
        const existing = await client.query(
          "SELECT workspace_id, actor_id, revoked_at, p256dh, auth FROM ward_flow.push_subscriptions WHERE endpoint=$1 FOR UPDATE",
          [subscription.endpoint],
        );
        const holder = existing.rows[0];
        // Presenting the record's own p256dh and auth proves possession of the browser subscription
        // (the auth secret exists only in that browser and here), so a device whose earlier owner
        // never signed out cleanly can still be taken over from the device itself.
        const sameDevice = holder && holder.p256dh === subscription.p256dh && holder.auth === subscription.auth;
        if (
          holder &&
          holder.revoked_at === null &&
          !sameDevice &&
          (holder.workspace_id !== workspaceId.toLowerCase() || holder.actor_id !== actorId.toLowerCase())
        )
          return "in-use";
        // Its old pending rows go first: turning alerts on never announces an item queued before,
        // or for someone else.
        await client.query(
          "DELETE FROM ward_flow.push_deliveries d USING ward_flow.push_subscriptions s WHERE d.subscription_id = s.id AND s.endpoint=$1",
          [subscription.endpoint],
        );
        const stored = await client.query(
          "INSERT INTO ward_flow.push_subscriptions(workspace_id, actor_id, endpoint, p256dh, auth, created_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (endpoint) DO UPDATE SET workspace_id=EXCLUDED.workspace_id, actor_id=EXCLUDED.actor_id, p256dh=EXCLUDED.p256dh, auth=EXCLUDED.auth, created_at=EXCLUDED.created_at, last_success_at=NULL, revoked_at=NULL WHERE ward_flow.push_subscriptions.revoked_at IS NOT NULL OR (ward_flow.push_subscriptions.p256dh=EXCLUDED.p256dh AND ward_flow.push_subscriptions.auth=EXCLUDED.auth) OR (ward_flow.push_subscriptions.workspace_id=EXCLUDED.workspace_id AND ward_flow.push_subscriptions.actor_id=EXCLUDED.actor_id)",
          [workspaceId, actorId, subscription.endpoint, subscription.p256dh, subscription.auth, at],
        );
        // A concurrent first claim by another account can win the insert; it is not overwritten.
        if (!stored.rowCount) return "in-use";
        return "subscribed";
      });
    },
    async unsubscribe(actorId, endpoint) {
      if (!push) throw new Error("push-disabled");
      const { rowCount } = await pool.query(
        "UPDATE ward_flow.push_subscriptions SET revoked_at=$4 WHERE workspace_id=$1 AND actor_id=$2 AND endpoint=$3 AND revoked_at IS NULL",
        [workspaceId, actorId, endpoint, clock()],
      );
      return rowCount ? "unsubscribed" : "not-found";
    },
    /** Whether this account has an active phone alert record for this device endpoint. */
    async pushStatus(actorId, endpoint) {
      if (!push) throw new Error("push-disabled");
      const { rowCount } = await pool.query(
        "SELECT 1 FROM ward_flow.push_subscriptions WHERE workspace_id=$1 AND actor_id=$2 AND endpoint=$3 AND revoked_at IS NULL",
        [workspaceId, actorId, endpoint],
      );
      return rowCount > 0;
    },
    /**
     * The timer trigger calls this. Time alone can turn a row red (a wait passing its target), so
     * it re-evaluates; then it sends whatever is due, including retries and deliveries an earlier
     * invocation did not finish.
     */
    async sweepPush() {
      if (!push) return;
      await transaction(async (client, at) => {
        const { rows } = await client.query(
          "SELECT data_mode, revision, payload FROM ward_flow.workspaces WHERE id=$1 AND data_mode='prototype' FOR UPDATE",
          [workspaceId],
        );
        if (!rows[0] || !engine.validWorld(rows[0].payload)) return;
        await evaluatePush(client, rows[0].payload, rows[0].payload, at, null);
      });
      await deliver();
    },
    async read(actorId) {
      const at = clock();
      const { rows } = await pool.query(
        "SELECT data_mode, revision, payload FROM ward_flow.workspaces WHERE id=$1 AND data_mode='prototype'",
        [workspaceId],
      );
      if (rows[0] && engine.validWorld(rows[0].payload)) return snapshot(rows[0], at);
      return transaction(async (client, now) => snapshot(await lock(client, actorId, now), now));
    },
    async audit() {
      const { rows } = await pool.query(
        "SELECT sequence, actor_id, actor_role, data_mode, action, outcome, prior_revision, revision, changes, committed_at FROM ward_flow.audit WHERE workspace_id=$1 AND data_mode='prototype' ORDER BY sequence DESC LIMIT 200",
        [workspaceId],
      );
      return rows;
    },
    async command(actorId, commandId, expectedRevision, event) {
      if (!engine.validCommand(event)) throw new Error("invalid-command");
      const fingerprint = createHash("sha256")
        .update(JSON.stringify(canonical({ expectedRevision, event })))
        .digest("hex");
      let queued = false;
      const response = await transaction(async (client, at) => {
        queued = false;
        const row = await lock(client, actorId, at);
        const previous = await client.query(
          "SELECT fingerprint, status, result FROM ward_flow.commands WHERE workspace_id=$1 AND actor_id=$2 AND command_id=$3",
          [workspaceId, actorId, commandId],
        );
        if (previous.rowCount) {
          const receipt = previous.rows[0];
          if (receipt.fingerprint !== fingerprint)
            return {
              status: 422,
              body: { error: "Command ID was already used for a different request", snapshot: snapshot(row, at) },
            };
          return { status: receipt.status, body: { ...receipt.result, replayed: true, snapshot: snapshot(row, at) } };
        }
        let outcome = "stale";
        let status = 409;
        let changes = {};
        let reason = "The workspace changed. Review the latest board before trying again.";
        const priorRevision = Number(row.revision);
        if (priorRevision === expectedRevision) {
          const applied = engine.applyCommand(row.payload, event, at);
          ({ outcome, changes, reason } = applied);
          status = outcome === "accepted" ? 200 : 422;
          if (outcome === "accepted") {
            const before = row.payload;
            row.revision = priorRevision + 1;
            row.payload = applied.world;
            await client.query("UPDATE ward_flow.workspaces SET revision=$2, payload=$3, updated_at=$4 WHERE id=$1", [
              workspaceId,
              row.revision,
              row.payload,
              at,
            ]);
            if (push) {
              // Phone push must never cost the coordinator their change: an evaluation error rolls
              // back to here, is logged, and the command still commits.
              await client.query("SAVEPOINT push_evaluation");
              try {
                queued = await evaluatePush(client, row.payload, before, at, actorId);
                await client.query("RELEASE SAVEPOINT push_evaluation");
              } catch (error) {
                await client.query("ROLLBACK TO SAVEPOINT push_evaluation");
                queued = false;
                log({ event: "ward_backend_push_evaluation_failure", ...errorFields(error) });
              }
            }
          }
        }
        const result = { outcome, commandRevision: Number(row.revision), ...(reason ? { error: reason } : {}) };
        await client.query(
          "INSERT INTO ward_flow.audit(workspace_id, actor_id, command_id, action, outcome, prior_revision, revision, changes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
          [workspaceId, actorId, commandId, event.type, outcome, priorRevision, row.revision, changes],
        );
        await client.query(
          "INSERT INTO ward_flow.commands(workspace_id, actor_id, command_id, fingerprint, status, result) VALUES ($1,$2,$3,$4,$5,$6)",
          [workspaceId, actorId, commandId, fingerprint, status, result],
        );
        return { status, body: { ...result, snapshot: snapshot(row, at) } };
      });
      if (queued) {
        // Wait briefly so a quick delivery finishes in this invocation, but never hold the save
        // response on a slow push service. Delivery continues; what it does not finish stays
        // pending in the outbox and the sweep sends it.
        let timer;
        await Promise.race([
          deliver(),
          new Promise((resolve) => {
            timer = setTimeout(resolve, deliveryWaitMs);
          }),
        ]);
        clearTimeout(timer);
      }
      return response;
    },
  };
}
