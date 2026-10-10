import { createHash } from "node:crypto";
import { Pool } from "pg";
import { DefaultAzureCredential } from "@azure/identity";
import { errorFields, freshAlerts } from "./push.mjs";

const SUBSCRIPTION_PAGE = 200;

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
   * the open-tab notifier does. Returns the batch to deliver after commit, or null.
   */
  async function evaluatePush(client, world, before, at, excludeActorId) {
    if (!push) return null;
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
    const fresh = freshAlerts(previous, current);
    if (!fresh.length) return null;
    return { payload: push.payload(fresh), itemIds: fresh.map((alert) => alert.id), excludeActorId };
  }
  /**
   * After commit: send to every active subscription of an account still named as coordinator,
   * except the account that made the change, a page at a time so none is skipped. Subscriptions
   * the push service reports gone are deleted; successes are noted.
   *
   * If any send fails for another reason (rate limit, timeout, outage), the batch's items leave
   * the announced list so the next command or the five-minute sweep tries again. Recipients that
   * already succeeded may then get the alert twice; the fixed Topic and notification tag collapse
   * the repeat on the device, so it shows as one notification.
   */
  async function deliver(batch) {
    if (!batch) return;
    const counts = { sent: 0, expired: 0, failed: 0 };
    const failures = {};
    try {
      let after = 0;
      for (;;) {
        const { rows } = await pool.query(
          "SELECT id, endpoint, p256dh, auth FROM ward_flow.push_subscriptions WHERE workspace_id=$1 AND data_mode='prototype' AND revoked_at IS NULL AND actor_id = ANY($2::uuid[]) AND ($3::uuid IS NULL OR actor_id <> $3::uuid) AND id > $4 ORDER BY id LIMIT $5",
          [workspaceId, push.coordinatorIds, batch.excludeActorId, after, SUBSCRIPTION_PAGE],
        );
        if (!rows.length) break;
        after = rows[rows.length - 1].id;
        const results = await Promise.all(rows.map((row) => push.send(row, batch.payload)));
        const expired = [];
        const sent = [];
        results.forEach((result, index) => {
          counts[result.outcome] += 1;
          if (result.outcome === "expired") expired.push(rows[index].id);
          if (result.outcome === "sent") sent.push(rows[index].id);
          if (result.outcome === "failed") failures[result.category] = (failures[result.category] ?? 0) + 1;
        });
        if (expired.length)
          await pool.query("DELETE FROM ward_flow.push_subscriptions WHERE id = ANY($1::bigint[])", [expired]);
        if (sent.length)
          await pool.query("UPDATE ward_flow.push_subscriptions SET last_success_at=$2 WHERE id = ANY($1::bigint[])", [
            sent,
            clock(),
          ]);
        if (rows.length < SUBSCRIPTION_PAGE) break;
      }
      if (counts.failed) {
        await pool.query(
          "UPDATE ward_flow.push_baselines SET item_ids = COALESCE((SELECT jsonb_agg(value) FROM jsonb_array_elements_text(item_ids) AS value WHERE value <> ALL($2::text[])), '[]'::jsonb) WHERE workspace_id=$1",
          [workspaceId, batch.itemIds],
        );
        log({ event: "ward_backend_push_delivery_failures", ...counts, failures });
      }
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
        // One device endpoint belongs to whoever signed in on it most recently.
        await client.query(
          "INSERT INTO ward_flow.push_subscriptions(workspace_id, actor_id, endpoint, p256dh, auth, created_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (endpoint) DO UPDATE SET workspace_id=EXCLUDED.workspace_id, actor_id=EXCLUDED.actor_id, p256dh=EXCLUDED.p256dh, auth=EXCLUDED.auth, created_at=EXCLUDED.created_at, last_success_at=NULL, revoked_at=NULL",
          [workspaceId, actorId, subscription.endpoint, subscription.p256dh, subscription.auth, at],
        );
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
    /** Time alone can turn a row red (a wait passing its target). The timer trigger calls this. */
    async sweepPush() {
      if (!push) return;
      const batch = await transaction(async (client, at) => {
        const { rows } = await client.query(
          "SELECT data_mode, revision, payload FROM ward_flow.workspaces WHERE id=$1 AND data_mode='prototype' FOR UPDATE",
          [workspaceId],
        );
        if (!rows[0] || !engine.validWorld(rows[0].payload)) return null;
        return evaluatePush(client, rows[0].payload, rows[0].payload, at, null);
      });
      await deliver(batch);
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
      let pushBatch = null;
      const response = await transaction(async (client, at) => {
        pushBatch = null;
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
                pushBatch = await evaluatePush(client, row.payload, before, at, actorId);
                await client.query("RELEASE SAVEPOINT push_evaluation");
              } catch (error) {
                await client.query("ROLLBACK TO SAVEPOINT push_evaluation");
                pushBatch = null;
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
      if (pushBatch) {
        // Wait briefly so a quick delivery finishes in this invocation, but never hold the save
        // response on a slow push service; delivery continues and the sweep retries what is lost.
        let timer;
        await Promise.race([
          deliver(pushBatch),
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
