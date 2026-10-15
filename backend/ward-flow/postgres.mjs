// @ts-check
import { createHash, randomUUID } from "node:crypto";
import { LATEST_MIGRATION, MINIMUM_RUNTIME_MIGRATION, ROLE_ACCESS_MIGRATION } from "./migrations.mjs";
import { errorFields, freshAlerts } from "./push.mjs";

const SUBSCRIPTION_PAGE = 200;
/** A device whose sends keep failing for a reason that may pass is tried this many times. */
export const MAX_DELIVERY_ATTEMPTS = 5;
/** How long the schema version is trusted before it is read again. */
const VERSION_TRUSTED_MS = 60_000;
/** A break glass record that ended this recently still sends the whole scoped workspace on a poll. */
const GRANT_SETTLE_MS = 60_000;
/** Roles that work only once a second person has approved them. */
const APPROVED_ROLES = ["coordinator", "admin"];

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
 * @param demoEvents Whether the demonstration controls (advance clock, reset or set scenario) may
 *   change the shared workspace. Off unless WARD_SHARED_DEMO_EVENTS=true: one coordinator could
 *   otherwise reset everyone's board.
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
    demoEvents = false,
  },
) {
  /**
   * `view` is the signed-in desk from `viewer()`: its role, place and break glass records. The
   * HTTP layer always passes it, so every reply carries only that desk's part of the workspace.
   * Without one (the store's own tests and the push sweep) the whole workspace is used.
   */
  const snapshot = (row, at, view) => ({
    dataMode: row.data_mode,
    // Whether the demonstration controls work here, so the screens can say when they do not.
    demoControls: demoEvents,
    revision: Number(row.revision),
    payload: view ? engine.scopeWorld(row.payload, view.access, at, view.grants) : row.payload,
    now: engine.worldNow(row.payload, at),
  });
  let known = { version: 0, until: 0 };
  async function schemaVersion() {
    const now = clock().getTime();
    if (known.until > now) return known.version;
    const { rows } = await pool.query("SELECT max(version) AS version FROM ward_flow.migrations");
    const version = rows[0]?.version;
    if (!Number.isInteger(version) || version < MINIMUM_RUNTIME_MIGRATION || version > LATEST_MIGRATION)
      throw new Error("Shared schema unavailable");
    known = { version, until: now + VERSION_TRUSTED_MS };
    return version;
  }
  // After a rollback the cached version can name a table or column that is gone. That request
  // fails, and the next one reads the version again instead of failing for the rest of the minute.
  function forgetVersionOnMissing(error) {
    if (error?.code === "42P01" || error?.code === "42703") known = { version: 0, until: 0 };
  }
  /** One audit row, naming the sender's role and place once migration 8 holds them. */
  async function audit(client, view, actorId, row) {
    const values = [
      workspaceId,
      actorId,
      row.commandId ?? null,
      row.action,
      row.outcome,
      row.priorRevision,
      row.revision,
      row.changes,
    ];
    if (view && view.version >= ROLE_ACCESS_MIGRATION)
      await client.query(
        "INSERT INTO ward_flow.audit(workspace_id, actor_id, command_id, action, outcome, prior_revision, revision, changes, actor_role, actor_scope) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [...values, view.access.role, view.access.scope],
      );
    else
      await client.query(
        "INSERT INTO ward_flow.audit(workspace_id, actor_id, command_id, action, outcome, prior_revision, revision, changes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        values,
      );
  }
  async function transaction(run) {
    const client = await pool.connect();
    let rollbackFailure;
    try {
      await client.query("BEGIN");
      const result = await run(client, clock());
      await client.query("COMMIT");
      return result;
    } catch (error) {
      forgetVersionOnMissing(error);
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        rollbackFailure = rollbackError;
      }
      throw error;
    } finally {
      client.release(rollbackFailure);
    }
  }
  async function lock(client, actorId, at, view) {
    let { rows } = await client.query(
      "SELECT data_mode, revision, payload FROM ward_flow.workspaces WHERE id=$1 AND data_mode='prototype' FOR UPDATE",
      [workspaceId],
    );
    if (!rows.length) {
      const created = await client.query(
        "INSERT INTO ward_flow.workspaces(id, revision, payload) VALUES ($1, 1, $2) ON CONFLICT DO NOTHING RETURNING id",
        [workspaceId, engine.seedWorld(at)],
      );
      if (created.rowCount)
        await audit(client, view, actorId, {
          action: "INITIALISE_WORKSPACE",
          outcome: "accepted",
          priorRevision: 0,
          revision: 1,
          changes: {},
        });
      ({ rows } = await client.query(
        "SELECT data_mode, revision, payload FROM ward_flow.workspaces WHERE id=$1 AND data_mode='prototype' FOR UPDATE",
        [workspaceId],
      ));
    }
    if (rows[0]?.data_mode !== "prototype") throw new Error("Workspace data mode mismatch");
    if (!engine.validWorld(rows[0]?.payload)) throw new Error("Stored workspace is incompatible");
    // `viewer()` ran before this transaction. A revoke takes this same lock, so checking again
    // here means a role removed in between stops this request too.
    if (view?.membershipId) {
      const active = await client.query(
        "SELECT 1 FROM ward_flow.memberships WHERE id=$1 AND workspace_id=$2 AND revoked_at IS NULL AND expires_at > $3",
        [view.membershipId, workspaceId, at],
      );
      if (!active.rowCount) throw new Error("role-ended");
    }
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
    const currentIds = current.map((alert) => alert.id);
    const stored = await client.query(
      "SELECT item_ids FROM ward_flow.push_baselines WHERE workspace_id=$1 AND data_mode='prototype' FOR UPDATE",
      [workspaceId],
    );
    const reset = before.state.worldGeneration !== world.state.worldGeneration;
    const previous = reset
      ? currentIds
      : stored.rowCount
        ? stored.rows[0].item_ids
        : engine.actNowAlerts(before, at).map((alert) => alert.id);
    const baselineUnchanged =
      stored.rowCount > 0 &&
      Array.isArray(stored.rows[0].item_ids) &&
      stored.rows[0].item_ids.length === currentIds.length &&
      stored.rows[0].item_ids.every((id, index) => id === currentIds[index]);
    if (!baselineUnchanged) {
      await client.query(
        "INSERT INTO ward_flow.push_baselines(workspace_id, item_ids, evaluated_at) VALUES ($1, $2, $3) ON CONFLICT (workspace_id) DO UPDATE SET item_ids=EXCLUDED.item_ids, evaluated_at=EXCLUDED.evaluated_at",
        [workspaceId, JSON.stringify(currentIds), at],
      );
    }
    // An item no longer red is never announced late; its rows go, so the table stays small. Done
    // here, under the workspace and baseline locks, so it can never race a commit that has just
    // queued a new item (deliver() reads the world without a lock and could hold a stale red set).
    await client.query(
      "DELETE FROM ward_flow.push_deliveries d USING ward_flow.push_subscriptions s WHERE d.subscription_id = s.id AND s.workspace_id=$1 AND NOT (d.item_id = ANY($2::text[]))",
      [workspaceId, currentIds],
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
  async function read(actorId, view) {
    const at = clock();
    const { rows } = await pool.query(
      "SELECT data_mode, revision, payload FROM ward_flow.workspaces WHERE id=$1 AND data_mode='prototype'",
      [workspaceId],
    );
    if (rows[0] && engine.validWorld(rows[0].payload)) return snapshot(rows[0], at, view);
    return transaction(async (client, now) => snapshot(await lock(client, actorId, now, view), now, view));
  }
  /**
   * Who this account is working as. The role always comes from here, never from the browser.
   * An account named in WARD_COORDINATOR_USER_IDS (the bootstrap) works as the statewide
   * coordinator unless it asks for one of its memberships. Any other account needs one active
   * membership: none is refused, and more than one must say which with `workingAs`. Checked on
   * every request, so a removed or expired role stops at once.
   */
  async function viewer(actorId, { bootstrap = false, workingAs = null } = {}) {
    const at = clock();
    const version = await schemaVersion();
    const choices = bootstrap ? [{ membershipId: null, access: engine.STATEWIDE }] : [];
    if (version >= ROLE_ACCESS_MIGRATION) {
      const { rows } = await pool
        .query(
          "SELECT id, role, scope FROM ward_flow.memberships WHERE workspace_id=$1 AND data_mode='prototype' AND actor_id=$2 AND revoked_at IS NULL AND expires_at > $3 AND (approved_at IS NOT NULL OR NOT (role = ANY($4::text[]))) ORDER BY granted_at, id LIMIT 20",
          [workspaceId, actorId, at, APPROVED_ROLES],
        )
        .catch((error) => {
          forgetVersionOnMissing(error);
          throw error;
        });
      for (const row of rows) {
        // A row the access table would not allow is skipped, never widened.
        const access = engine.parseAccess(row.role, row.scope);
        if (access) choices.push({ membershipId: row.id, access });
      }
    }
    const chosen = workingAs
      ? choices.find((choice) => (choice.membershipId ?? "bootstrap") === workingAs)
      : bootstrap || choices.length === 1
        ? choices[0]
        : undefined;
    if (!chosen)
      return choices.length > 1 && !workingAs
        ? {
            status: "choose",
            choices: choices.map((choice) => ({ workingAs: choice.membershipId ?? "bootstrap", ...choice.access })),
          }
        : { status: "none" };
    let grants = [];
    let recentGrant = false;
    if (chosen.membershipId) {
      const { rows } = await pool.query(
        "SELECT patient_id, until FROM ward_flow.break_glass WHERE workspace_id=$1 AND actor_id=$2 AND membership_id=$3 AND until > $4 ORDER BY until DESC LIMIT 50",
        [workspaceId, actorId, chosen.membershipId, new Date(at.getTime() - GRANT_SETTLE_MS)],
      );
      recentGrant = rows.length > 0;
      grants = rows
        .filter((row) => row.until > at)
        .map((row) => ({ patientId: row.patient_id, until: new Date(row.until) }));
    }
    return {
      status: "ok",
      actorId,
      version,
      membershipId: chosen.membershipId,
      access: chosen.access,
      grants,
      recentGrant,
    };
  }
  /** A membership as an access admin sees it. */
  const presentMembership = (row) => ({
    id: row.id,
    actorId: row.actor_id,
    role: row.role,
    scope: row.scope,
    grantedBy: row.granted_by,
    grantedAt: new Date(row.granted_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
    approved: row.approved_at !== null || !APPROVED_ROLES.includes(row.role),
    approvedBy: row.approved_by,
  });
  const refused = (status, error) => ({ status, body: { error } });
  const notAdmin = "Granting and removing roles is not part of your role.";
  /**
   * Inside one locked transaction: approve or remove a membership the access admin's own place
   * covers. `change` returns a refusal, or the columns to set.
   */
  async function changeMembership(view, membershipId, action, change) {
    if (!engine.managesAccess(view.access)) return refused(403, notAdmin);
    return transaction(async (client, at) => {
      const row = await lock(client, view.actorId, at, view);
      const { rows } = await client.query(
        "SELECT * FROM ward_flow.memberships WHERE id=$1 AND workspace_id=$2 AND revoked_at IS NULL AND expires_at > $3 FOR UPDATE",
        [membershipId, workspaceId, at],
      );
      const membership = rows[0];
      if (!membership) return refused(404, "That role is not active.");
      const access = engine.parseAccess(membership.role, membership.scope);
      // A row the access table cannot read is left to a statewide admin.
      const covered = access
        ? engine.scopeWithin(row.payload, access.scope, view.access.scope)
        : view.access.scope.kind === "statewide";
      if (!covered) return refused(403, "That role is wider than your own.");
      const outcome = change(membership);
      if (typeof outcome === "string") return refused(422, outcome);
      const [column, byColumn] = outcome;
      const { rows: updated } = await client.query(
        `UPDATE ward_flow.memberships SET ${column}=$2, ${byColumn}=$3 WHERE id=$1 RETURNING *`,
        [membershipId, at, view.actorId],
      );
      const revision = Number(row.revision);
      await audit(client, view, view.actorId, {
        action,
        outcome: "accepted",
        priorRevision: revision,
        revision,
        changes: { membershipId, actorId: membership.actor_id, role: membership.role, scope: membership.scope },
      });
      return { status: 200, body: { membership: presentMembership(updated[0]) } };
    });
  }
  return {
    pushEnabled: !!push,
    async ready() {
      const { rows } = await pool.query("SELECT max(version) AS version FROM ward_flow.migrations");
      const version = rows[0]?.version;
      if (!Number.isInteger(version) || version < MINIMUM_RUNTIME_MIGRATION || version > LATEST_MIGRATION)
        throw new Error("Shared schema unavailable");
    },
    async subscribe(actorId, subscription) {
      if (!push) throw new Error("push-disabled");
      return transaction(async (client, at) => {
        // Workspace key-share locks do not conflict with one another; serialize the
        // per-account count and insert so the device limit cannot be exceeded.
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1 || ':' || $2))", [workspaceId, actorId]);
        const present = await client.query(
          "SELECT 1 FROM ward_flow.workspaces WHERE id=$1 AND data_mode='prototype' FOR KEY SHARE",
          [workspaceId],
        );
        if (!present.rowCount) await lock(client, actorId, at);
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
      return transaction(async (client, at) => {
        const { rows, rowCount } = await client.query(
          "UPDATE ward_flow.push_subscriptions SET revoked_at=$4 WHERE workspace_id=$1 AND actor_id=$2 AND endpoint=$3 AND revoked_at IS NULL RETURNING id",
          [workspaceId, actorId, endpoint, at],
        );
        if (rowCount && rows[0]?.id !== undefined)
          await client.query("DELETE FROM ward_flow.push_deliveries WHERE subscription_id=$1", [rows[0].id]);
        return rowCount ? "unsubscribed" : "not-found";
      });
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
    read,
    /**
     * The 3 second poll. When the workspace is still at `knownRevision`, returns only the revision
     * and the world clock (read from two small fields, so the whole record is not sent or checked);
     * otherwise the full snapshot, as `read` does.
     */
    async poll(actorId, knownRevision, view) {
      // A break glass record just opened or ended changes what this desk may see without a new
      // revision, so the whole scoped workspace goes back until it has settled.
      if (view?.recentGrant) return { notModified: false, snapshot: await read(actorId, view) };
      const at = clock();
      const { rows } = await pool.query(
        "SELECT data_mode, revision, payload->>'startedAt' AS started_at, payload->'state'->'clockOffsetMinutes' AS clock_offset FROM ward_flow.workspaces WHERE id=$1 AND data_mode='prototype'",
        [workspaceId],
      );
      const row = rows[0];
      if (
        row &&
        Number(row.revision) === knownRevision &&
        typeof row.started_at === "string" &&
        Number.isFinite(Date.parse(row.started_at)) &&
        Number.isFinite(row.clock_offset)
      )
        return {
          notModified: true,
          dataMode: row.data_mode,
          revision: knownRevision,
          now: engine.worldNow({ startedAt: row.started_at, state: { clockOffsetMinutes: row.clock_offset } }, at),
        };
      return { notModified: false, snapshot: await read(actorId, view) };
    },
    viewer,
    /**
     * The newest audit rows. The statewide coordinator reads them all. An access admin reads only
     * role changes inside their own place, and break glass records when statewide. The HTTP layer
     * refuses everyone else before this runs.
     */
    async audit(view) {
      const whole = !view || engine.wholeNetwork(view.access);
      const scoped = view && view.version >= ROLE_ACCESS_MIGRATION ? ", actor_scope" : "";
      const { rows } = await pool.query(
        `SELECT sequence, actor_id, actor_role${scoped}, data_mode, action, outcome, prior_revision, revision, changes, committed_at FROM ward_flow.audit WHERE workspace_id=$1 AND data_mode='prototype'${whole ? "" : " AND (action LIKE 'ACCESS\\_%' OR action = 'BREAK_GLASS')"} ORDER BY sequence DESC LIMIT 200`,
        [workspaceId],
      );
      if (whole || view.access.scope.kind === "statewide") return rows;
      const world = await pool.query("SELECT payload FROM ward_flow.workspaces WHERE id=$1 AND data_mode='prototype'", [
        workspaceId,
      ]);
      const payload = world.rows[0]?.payload;
      if (!payload || !engine.validWorld(payload)) return [];
      return rows.filter((row) => {
        if (row.action === "BREAK_GLASS") return false;
        const access = engine.parseAccess(row.changes?.role, row.changes?.scope);
        return !!access && engine.scopeWithin(payload, access.scope, view.access.scope);
      });
    },
    /** Every active or waiting role inside the access admin's own place. */
    async listAccess(view) {
      if (!engine.managesAccess(view.access)) return refused(403, notAdmin);
      const at = clock();
      const world = await read(view.actorId);
      const { rows } = await pool.query(
        "SELECT * FROM ward_flow.memberships WHERE workspace_id=$1 AND revoked_at IS NULL AND expires_at > $2 ORDER BY granted_at, id LIMIT 500",
        [workspaceId, at],
      );
      return {
        status: 200,
        body: {
          memberships: rows
            .filter((row) => {
              const access = engine.parseAccess(row.role, row.scope);
              return !!access && engine.scopeWithin(world.payload, access.scope, view.access.scope);
            })
            .map(presentMembership),
        },
      };
    },
    /**
     * Gives a person a role at a place until a set time. Nobody grants themselves a role or one
     * wider than their own, and a coordinator or access admin role waits for a second approver.
     */
    async grantAccess(view, request) {
      if (!engine.managesAccess(view.access)) return refused(403, notAdmin);
      const access = engine.parseAccess(request.role, request.scope);
      if (!access) return refused(400, "A role and a place that go together are required.");
      if (request.actorId === view.actorId) return refused(422, "Nobody grants themselves a role.");
      return transaction(async (client, at) => {
        if (!(request.expiresAt > at)) return refused(400, "A role needs an end date in the future.");
        const row = await lock(client, view.actorId, at, view);
        if (!engine.scopeExists(row.payload, access.scope)) return refused(422, "That place is not in the workspace.");
        if (!engine.scopeWithin(row.payload, access.scope, view.access.scope))
          return refused(403, "That role is wider than your own.");
        const id = randomUUID();
        const { rows } = await client.query(
          "INSERT INTO ward_flow.memberships(id, workspace_id, actor_id, role, scope, granted_by, granted_at, expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
          [id, workspaceId, request.actorId, access.role, access.scope, view.actorId, at, request.expiresAt],
        );
        const revision = Number(row.revision);
        await audit(client, view, view.actorId, {
          action: "ACCESS_GRANT",
          outcome: "accepted",
          priorRevision: revision,
          revision,
          changes: {
            membershipId: id,
            actorId: request.actorId,
            role: access.role,
            scope: access.scope,
            expiresAt: request.expiresAt.toISOString(),
          },
        });
        return { status: 200, body: { membership: presentMembership(rows[0]) } };
      });
    },
    /** The second person's approval of a coordinator or access admin role. */
    approveAccess(view, membershipId) {
      return changeMembership(view, membershipId, "ACCESS_APPROVE", (membership) =>
        !APPROVED_ROLES.includes(membership.role) || membership.approved_at !== null
          ? "That role is not waiting for approval."
          : membership.granted_by === view.actorId || membership.actor_id === view.actorId
            ? "A second person approves this role."
            : ["approved_at", "approved_by"],
      );
    },
    /** Ends a role now. */
    revokeAccess(view, membershipId) {
      return changeMembership(view, membershipId, "ACCESS_REVOKE", () => ["revoked_at", "revoked_by"]);
    },
    /**
     * Opens one patient's record, read only, outside this desk's care for a set time, with a
     * reason. Each opening is kept as the "who looked" record and audited. More than the set
     * number in one shift is marked as a pattern for the coordinator.
     */
    async breakGlass(view, patientId, reason) {
      if (!engine.BREAK_GLASS_REASON_IDS.includes(reason)) return refused(400, "A reason from the list is required.");
      return transaction(async (client, at) => {
        const row = await lock(client, view.actorId, at, view);
        const refusal = view.membershipId ? engine.breakGlassRefusal(row.payload, view.access, patientId, at) : null;
        if (refusal || !view.membershipId)
          return refused(422, refusal ?? "Opening a record outside your care is not part of your role.");
        const until = new Date(at.getTime() + engine.BREAK_GLASS_MINUTES * 60_000);
        await client.query(
          "INSERT INTO ward_flow.break_glass(workspace_id, actor_id, membership_id, patient_id, reason, opened_at, until) VALUES ($1,$2,$3,$4,$5,$6,$7)",
          [workspaceId, view.actorId, view.membershipId, patientId, reason, at, until],
        );
        const { rows } = await client.query(
          "SELECT count(*)::int AS count FROM ward_flow.break_glass WHERE workspace_id=$1 AND actor_id=$2 AND opened_at > $3",
          [workspaceId, view.actorId, new Date(at.getTime() - engine.BREAK_GLASS_SHIFT_HOURS * 3_600_000)],
        );
        const pattern = rows[0].count > engine.BREAK_GLASS_PER_SHIFT;
        const revision = Number(row.revision);
        await audit(client, view, view.actorId, {
          action: "BREAK_GLASS",
          outcome: "accepted",
          priorRevision: revision,
          revision,
          changes: { patientId, reason, until: until.toISOString(), membershipId: view.membershipId, pattern },
        });
        const opened = { ...view, grants: [...view.grants, { patientId, until }] };
        return { status: 200, body: { until: until.toISOString(), pattern, snapshot: snapshot(row, at, opened) } };
      });
    },
    /**
     * `options.revisionOnly`: an accepted command (or its replay) answers without the snapshot.
     * The client asks for this when more of its commands are queued, and reads the board once at
     * the end. A refused or stale command always carries the snapshot. `options.view` is the
     * sender's desk from `viewer()`: the command is checked against its role and place, and the
     * reply carries only its part of the workspace.
     * @param {{ revisionOnly?: boolean, view?: any }} [options]
     */
    async command(actorId, commandId, expectedRevision, event, options = {}) {
      const { revisionOnly = false, view } = options;
      if (!engine.validCommand(event)) throw new Error("invalid-command");
      const demoRefused = !demoEvents && engine.demoOnlyCommand(event);
      const fingerprint = createHash("sha256")
        .update(JSON.stringify(canonical({ expectedRevision, event })))
        .digest("hex");
      let queued = false;
      const response = await transaction(async (client, at) => {
        queued = false;
        const row = await lock(client, actorId, at, view);
        const previous = await client.query(
          "SELECT fingerprint, status, result FROM ward_flow.commands WHERE workspace_id=$1 AND actor_id=$2 AND command_id=$3",
          [workspaceId, actorId, commandId],
        );
        if (previous.rowCount) {
          const receipt = previous.rows[0];
          if (receipt.fingerprint !== fingerprint)
            return {
              status: 422,
              body: { error: "Command ID was already used for a different request", snapshot: snapshot(row, at, view) },
            };
          return {
            status: receipt.status,
            body: {
              ...receipt.result,
              replayed: true,
              ...(revisionOnly && receipt.status === 200 ? {} : { snapshot: snapshot(row, at, view) }),
            },
          };
        }
        let outcome = "stale";
        let status = 409;
        let changes = {};
        let reason = "The workspace changed. Review the latest board before trying again.";
        let code = null;
        const priorRevision = Number(row.revision);
        // The sender's own role and place, checked before anything else: a desk never learns
        // whether a record outside its place exists, or changed.
        const scopeRefusal = view ? engine.commandRefusal(row.payload, view.access, event, at, view.grants) : null;
        if (scopeRefusal) {
          outcome = "denied";
          status = 422;
          reason = scopeRefusal;
          code = "scope";
        } else if (demoRefused) {
          // Refused like any other denial, so the attempt is audited and a retry replays it.
          outcome = "denied";
          status = 422;
          reason = "Demo controls are switched off on the shared workspace.";
        } else if (priorRevision === expectedRevision) {
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
        const result = {
          outcome,
          commandRevision: Number(row.revision),
          ...(reason ? { error: reason } : {}),
          ...(code ? { code } : {}),
        };
        await audit(client, view, actorId, {
          commandId,
          action: event.type,
          outcome,
          priorRevision,
          revision: row.revision,
          changes,
        });
        await client.query(
          "INSERT INTO ward_flow.commands(workspace_id, actor_id, command_id, fingerprint, status, result) VALUES ($1,$2,$3,$4,$5,$6)",
          [workspaceId, actorId, commandId, fingerprint, status, result],
        );
        return {
          status,
          body: { ...result, ...(revisionOnly && status === 200 ? {} : { snapshot: snapshot(row, at, view) }) },
        };
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
