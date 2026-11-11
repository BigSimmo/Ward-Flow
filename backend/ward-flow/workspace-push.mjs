// @ts-check
// Phone push for the workspace store (postgres.mjs): queueing act-now alerts inside a save,
// delivering them after commit or from the sweep, and each device's subscription.
import { ACCESS_COVER_MIGRATION } from "./migrations.mjs";
import { errorFields, freshAlerts } from "./push.mjs";
import { singleFlight } from "./workspace-shared.mjs";

const SUBSCRIPTION_PAGE = 200;
/** Desks with a phone turned on, read a page at a time when new alerts are queued. */
const DESK_PAGE = 500;
/** A device whose sends keep failing for a reason that may pass is tried this many times. */
export const MAX_DELIVERY_ATTEMPTS = 5;
/** A membership still in use, as the viewer counts it: cover, or used since `param` (a cutoff). */
const inUse = (param) => `(m.kind = 'cover' OR coalesce(m.last_used_at, m.granted_at) > ${param}::timestamptz)`;

/**
 * Phone push as createWorkspaceStore uses it: push.mjs `createPush`.
 * @typedef {{
 *   send: (subscription: any, payload: any) => Promise<any>,
 *   payload: (alerts: any) => any,
 *   coordinatorIds: string[],
 *   maxPerAccount: number,
 * }} WorkspacePush
 */

/** The store's push evaluation and delivery, sharing its pool, schema version and world reads. */
export function createPushDelivery({
  pool,
  workspaceId,
  engine,
  clock,
  push,
  log,
  retryAfterMs,
  schemaVersion,
  readWorld,
  transaction,
  unusedBefore,
  MAX_TERM,
}) {
  /**
   * The place each desk (a membership a phone was turned on from) works across, as the viewer
   * builds it: a nurse in charge's own ward plus any ward cover that account holds, so night cover
   * reaches their phone too. Cover held as its own desk is never widened by other cover.
   */
  async function deskAccesses(client, desks, at) {
    const holders = [...new Set(desks.filter((d) => d.role === "ward" && d.kind !== "cover").map((d) => d.actor_id))];
    const covers = new Map();
    if (holders.length) {
      const { rows } = await client.query(
        `SELECT actor_id, role, scope FROM ward_flow.memberships WHERE workspace_id=$1 AND kind='cover' AND role='ward' AND revoked_at IS NULL AND expires_at > $2 AND granted_at > $2::timestamptz - ${MAX_TERM} AND actor_id = ANY($3::uuid[])`,
        [workspaceId, at, holders],
      );
      for (const row of rows) {
        const cover = engine.parseAccess(row.role, row.scope);
        if (cover) covers.set(row.actor_id, [...(covers.get(row.actor_id) ?? []), cover.scope]);
      }
    }
    const result = new Map();
    for (const desk of desks) {
      const access = engine.parseAccess(desk.role, desk.scope);
      if (!access) continue;
      const extra = access.role === "ward" && desk.kind !== "cover" ? covers.get(desk.actor_id) : undefined;
      result.set(desk.id, extra?.length ? engine.withCover(access, extra) : access);
    }
    return result;
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
    const byRole = (await schemaVersion()) >= ACCESS_COVER_MIGRATION;
    // An item that left and came back red is announced again, as the open-tab notifier does.
    const queued = await client.query(
      `INSERT INTO ward_flow.push_deliveries(subscription_id, item_id) SELECT s.id, item FROM ward_flow.push_subscriptions s CROSS JOIN unnest($4::text[]) AS item WHERE s.workspace_id=$1 AND s.data_mode='prototype' AND s.revoked_at IS NULL${byRole ? " AND s.membership_id IS NULL" : ""} AND s.actor_id = ANY($2::uuid[]) AND ($3::uuid IS NULL OR s.actor_id <> $3::uuid) ON CONFLICT (subscription_id, item_id) DO UPDATE SET status='pending', attempts=0, last_attempt_at=NULL`,
      // A bootstrap coordinator hears act-now rows only, never an officer's or a team's updates.
      [
        workspaceId,
        push.coordinatorIds,
        excludeActorId,
        fresh.filter((alert) => alert.kind === "act-now").map((alert) => alert.id),
      ],
    );
    let count = queued.rowCount;
    if (byRole) {
      // From 9, a device turned on from a desk held by membership hears that desk's own act-now
      // rows only: the fresh items its scoped workspace still shows. Desks are read a page at a
      // time, so none is ever left out, and each page's rows are queued in one statement.
      const freshIds = new Set(fresh.map((alert) => alert.id));
      let last = null;
      for (;;) {
        const { rows: desks } = await client.query(
          `SELECT DISTINCT m.id, m.actor_id, m.role, m.scope, m.kind FROM ward_flow.push_subscriptions s JOIN ward_flow.memberships m ON m.id = s.membership_id WHERE s.workspace_id=$1 AND s.revoked_at IS NULL AND m.revoked_at IS NULL AND m.expires_at > $2 AND m.granted_at > $2::timestamptz - ${MAX_TERM} AND ${inUse("$3")}${last ? " AND m.id > $4" : ""} ORDER BY m.id LIMIT ${DESK_PAGE}`,
          [workspaceId, at, unusedBefore(at), ...(last ? [last] : [])],
        );
        if (!desks.length) break;
        const accesses = await deskAccesses(client, desks, at);
        /** @type {{ desks: string[], items: string[] }} */
        const pairs = { desks: [], items: [] };
        for (const desk of desks) {
          const access = accesses.get(desk.id);
          if (!access) continue;
          for (const alert of engine.scopedActNowAlerts(world, access, at))
            if (freshIds.has(alert.id)) {
              pairs.desks.push(desk.id);
              pairs.items.push(alert.id);
            }
        }
        if (pairs.desks.length) {
          const own = await client.query(
            "INSERT INTO ward_flow.push_deliveries(subscription_id, item_id) SELECT s.id, p.item FROM unnest($2::uuid[], $3::text[]) AS p(desk, item) JOIN ward_flow.push_subscriptions s ON s.membership_id = p.desk WHERE s.workspace_id=$1 AND s.data_mode='prototype' AND s.revoked_at IS NULL AND ($4::uuid IS NULL OR s.actor_id <> $4::uuid) ON CONFLICT (subscription_id, item_id) DO UPDATE SET status='pending', attempts=0, last_attempt_at=NULL",
            [workspaceId, pairs.desks, pairs.items, excludeActorId],
          );
          count += own.rowCount;
        }
        if (desks.length < DESK_PAGE) break;
        last = desks[desks.length - 1].id;
      }
    }
    return count > 0;
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
  // H-0289: saves share one delivery pass on the 4-connection pool instead of one pass each. The
  // five-minute sweep runs its own pass, so a delivery stuck on a dead connection never holds it.
  const deliver = singleFlight(() => deliverOnce());
  // A subscribe keeps its ID but starts a new registration and clears its old deliveries. Lock
  // the workspace before subscriptions and deliveries, as subscribe does. An evaluation holds
  // the workspace exclusively while deleting old deliveries and inserting new ones (whose FK
  // locks subscriptions), so this order also avoids a cycle with that writer. Keep exact SQL
  // microseconds: a JavaScript Date loses same-clock replacements.
  async function withPushClaims(claims, at, run) {
    if (!claims.length) return;
    await transaction(async (client) => {
      await client.query("SELECT id FROM ward_flow.workspaces WHERE id=$1 AND data_mode='prototype' FOR KEY SHARE", [
        workspaceId,
      ]);
      const registrations = new Map(claims.map((claim) => [claim.id, claim.registration_at]));
      const { rows } = await client.query(
        "SELECT s.id FROM ward_flow.push_subscriptions s JOIN unnest($1::bigint[], $2::text[]) AS u(id, registered) ON s.id=u.id WHERE s.workspace_id=$3 AND s.revoked_at IS NULL AND s.created_at=u.registered::timestamptz ORDER BY s.id FOR UPDATE OF s",
        [[...registrations.keys()], [...registrations.values()], workspaceId],
      );
      const active = new Set(rows.map((row) => row.id));
      const current = claims.filter((claim) => active.has(claim.id));
      if (!current.length) return;
      // Lock the actual captured items too. In particular, expiry must not delete a device
      // after a newer worker has reclaimed its pending item while the provider was awaited.
      const locked = await client.query(
        "SELECT d.subscription_id AS id, d.item_id FROM ward_flow.push_deliveries d JOIN unnest($1::bigint[], $2::text[]) AS u(id, item) ON d.subscription_id=u.id AND d.item_id=u.item WHERE d.status='pending' AND d.last_attempt_at=$3 ORDER BY d.subscription_id, d.item_id FOR UPDATE OF d",
        [current.map((claim) => claim.id), current.map((claim) => claim.item_id), at],
      );
      const lockedItems = new Set(locked.rows.map((row) => `${row.id}\0${row.item_id}`));
      const owned = current.filter((claim) => lockedItems.has(`${claim.id}\0${claim.item_id}`));
      if (owned.length) await run(client, owned);
    });
  }
  async function clearPushClaims(claims, at, discard) {
    await withPushClaims(claims, at, async (client, owned) => {
      const matched = "d.subscription_id=u.id AND d.item_id=u.item AND d.status='pending' AND d.last_attempt_at=$3";
      await client.query(
        discard
          ? `DELETE FROM ward_flow.push_deliveries d USING unnest($1::bigint[], $2::text[]) AS u(id, item) WHERE ${matched}`
          : `UPDATE ward_flow.push_deliveries d SET attempts=d.attempts - 1, last_attempt_at=NULL FROM unnest($1::bigint[], $2::text[]) AS u(id, item) WHERE ${matched}`,
        [owned.map((claim) => claim.id), owned.map((claim) => claim.item_id), at],
      );
    });
  }
  async function deliverOnce() {
    const counts = { sent: 0, expired: 0, failed: 0 };
    const failures = {};
    try {
      const passAt = clock();
      const readRed = async (at) => {
        const stored = await readWorld(pool, "payload");
        if (!stored || !engine.validWorld(stored.payload)) return null;
        const world = stored.payload;
        return { world, red: new Map(engine.actNowAlerts(world, at).map((alert) => [alert.id, alert])) };
      };
      // A crash after the final claim has no send result to terminalise it. Only expired
      // leases may be retired; an in-flight final attempt still owns its result.
      await pool.query(
        "UPDATE ward_flow.push_deliveries d SET status='failed' FROM ward_flow.push_subscriptions s WHERE d.subscription_id=s.id AND s.workspace_id=$1 AND d.status='pending' AND d.attempts >= $2 AND d.last_attempt_at <= $3",
        [workspaceId, MAX_DELIVERY_ATTEMPTS, new Date(passAt.getTime() - retryAfterMs)],
      );
      const due = "d.status='pending' AND d.attempts < $3 AND (d.last_attempt_at IS NULL OR d.last_attempt_at <= $4)";
      // A bootstrap coordinator's device while it is still named; from 9 also a device held by a
      // role that is still active and still in use, as the viewer counts it. Pre-ceiling grants
      // can carry later expiry dates: their maximum lifetime still ends at granted_at + MAX_TERM.
      const byRole = (await schemaVersion()) >= ACCESS_COVER_MIGRATION;
      const listener = byRole
        ? `((s.membership_id IS NULL AND s.actor_id = ANY($2::uuid[])) OR EXISTS (SELECT 1 FROM ward_flow.memberships m WHERE m.id = s.membership_id AND m.revoked_at IS NULL AND m.expires_at > $5 AND m.granted_at > $5::timestamptz - ${MAX_TERM} AND ${inUse("$8")}))`
        : "s.actor_id = ANY($2::uuid[])";
      // The desk a device was turned on from, so a retry is checked against that desk's place.
      const desk = byRole ? ", s.membership_id AS desk_id" : "";
      let after = "0";
      for (;;) {
        // Earlier pages can outlive a lease. Each new page owns its own current claim time,
        // which also guards every acknowledgement below. A truly expired in-flight claim is
        // still recoverable; a lost provider response can therefore still yield a duplicate.
        const at = clock();
        const { rows } = await pool.query(
          `UPDATE ward_flow.push_deliveries d SET attempts = d.attempts + 1, last_attempt_at = $5 FROM ward_flow.push_subscriptions s WHERE d.subscription_id = s.id AND ${due} AND d.subscription_id IN (SELECT DISTINCT d.subscription_id FROM ward_flow.push_deliveries d JOIN ward_flow.push_subscriptions s ON s.id = d.subscription_id WHERE s.workspace_id=$1 AND s.data_mode='prototype' AND s.revoked_at IS NULL AND ${listener} AND ${due} AND d.subscription_id > $6 ORDER BY d.subscription_id LIMIT $7) RETURNING d.subscription_id AS id, d.item_id, to_char(s.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS registration_at, s.endpoint, s.p256dh, s.auth${desk}`,
          [
            workspaceId,
            // A delivery runs only while push is on.
            /** @type {WorkspacePush} */ (push).coordinatorIds,
            MAX_DELIVERY_ATTEMPTS,
            new Date(at.getTime() - retryAfterMs),
            at,
            after,
            SUBSCRIPTION_PAGE,
            ...(byRole ? [unusedBefore(at)] : []),
          ],
        );
        if (!rows.length) break;
        // Read the world after each claim. The claim has seen every commit that queued or cleared
        // its rows, so this read neither misses a new item nor sends one already cleared. A world
        // that cannot be read leaves the claimed rows to come due again for a later delivery.
        const read = await readRed(at);
        if (!read) return;
        const { world, red } = read;
        const devices = new Map();
        const unseen = [];
        const outside = [];
        // Recheck membership after claiming and reading the world. A removal committed between
        // those awaits must not lend its old scope to an already queued delivery.
        const deskIds = [...new Set(rows.map((row) => row.desk_id).filter(Boolean))];
        const membershipAt = clock();
        const accesses = deskIds.length
          ? await deskAccesses(
              pool,
              (
                await pool.query(
                  `SELECT id, actor_id, role, scope, kind FROM ward_flow.memberships m WHERE id = ANY($1::uuid[]) AND m.workspace_id=$2 AND m.revoked_at IS NULL AND m.expires_at > $3 AND m.granted_at > $3::timestamptz - ${MAX_TERM} AND ${inUse("$4")}`,
                  [deskIds, workspaceId, membershipAt, unusedBefore(membershipAt)],
                )
              ).rows,
              membershipAt,
            )
          : new Map();
        const scoped = new Map();
        for (const row of rows) {
          const item = red.get(row.item_id);
          // A desk's device hears only what that desk's place still shows. An item that has moved
          // outside it since it was queued is dropped for this device, never sent on a retry.
          if (item && row.desk_id) {
            if (!scoped.has(row.desk_id)) {
              const access = accesses.get(row.desk_id);
              scoped.set(
                row.desk_id,
                new Set(access ? engine.scopedActNowAlerts(world, access, at).map((a) => a.id) : []),
              );
            }
            if (!scoped.get(row.desk_id).has(row.item_id)) {
              outside.push(row);
              continue;
            }
          }
          // An item no longer red is released unclaimed for the next evaluation to clear,
          // never sent as an empty entry or marked sent with the device's other rows.
          if (!item) {
            unseen.push(row);
            continue;
          }
          const device = devices.get(row.id) ?? { ...row, items: [] };
          device.items.push(item);
          devices.set(row.id, device);
        }
        after = rows.map((row) => row.id).reduce((a, b) => (BigInt(a) > BigInt(b) ? a : b));
        await clearPushClaims(unseen, at, false);
        await clearPushClaims(outside, at, true);
        // Scope loading can await another query. Re-read eligibility at a fresh time immediately
        // before sending, so a max-term boundary crossed during those awaits never lends an old
        // membership to the pending delivery. Bootstrap recipients were checked against config.
        const pendingDevices = [...devices.values()];
        const pendingDesks = [...new Set(pendingDevices.map((device) => device.desk_id).filter(Boolean))];
        const sendingAt = clock();
        const eligibleDesks = pendingDesks.length
          ? (
              await pool.query(
                `SELECT id, actor_id, role, scope, kind FROM ward_flow.memberships m WHERE id = ANY($1::uuid[]) AND m.workspace_id=$2 AND m.revoked_at IS NULL AND m.expires_at > $3 AND m.granted_at > $3::timestamptz - ${MAX_TERM} AND ${inUse("$4")}`,
                [pendingDesks, workspaceId, sendingAt, unusedBefore(sendingAt)],
              )
            ).rows
          : [];
        // Rejoin covers at this same fresh authority time. Rechecking just the base membership
        // would keep an expired cover's earlier scope while the base desk remains active.
        const sendingAccesses = await deskAccesses(pool, eligibleDesks, sendingAt);
        const sendingItems = new Map();
        for (const [deskId, access] of sendingAccesses)
          sendingItems.set(deskId, new Set(engine.scopedActNowAlerts(world, access, sendingAt).map((item) => item.id)));
        const noLongerAllowed = [];
        const list = pendingDevices.flatMap((device) => {
          if (!device.desk_id) return [device];
          const allowed = sendingItems.get(device.desk_id);
          const items = device.items.filter((item) => {
            if (allowed?.has(item.id)) return true;
            noLongerAllowed.push({ ...device, item_id: item.id });
            return false;
          });
          return items.length ? [{ ...device, items }] : [];
        });
        // Device-level delivery outcomes apply only to the items actually sent. Remove omitted
        // claims first, or a mixed own/expired-cover batch would falsely mark the latter sent.
        await clearPushClaims(noLongerAllowed, at, true);
        const sender = /** @type {WorkspacePush} */ (push);
        const results = await Promise.all(list.map((device) => sender.send(device, sender.payload(device.items))));
        /** @type {Record<"sent" | "expired" | "retry" | "rejected", string[]>} */
        const ids = { sent: [], expired: [], retry: [], rejected: [] };
        results.forEach((result, index) => {
          counts[result.outcome] += 1;
          if (result.outcome === "failed") {
            failures[result.category] = (failures[result.category] ?? 0) + 1;
            ids[result.retry ? "retry" : "rejected"].push(list[index].id);
          } else ids[result.outcome].push(list[index].id);
        });
        const sentClaims = list.flatMap((device) => device.items.map((item) => ({ ...device, item_id: item.id })));
        await withPushClaims(sentClaims, at, async (client, owned) => {
          const claimed = "d.subscription_id=u.id AND d.item_id=u.item AND d.status='pending' AND d.last_attempt_at=$3";
          for (const outcome of ["sent", "expired", "rejected", "retry"]) {
            const current = owned.filter((claim) => ids[outcome].includes(claim.id));
            if (!current.length) continue;
            const params = [current.map((claim) => claim.id), current.map((claim) => claim.item_id), at];
            if (outcome === "expired") {
              await client.query("DELETE FROM ward_flow.push_subscriptions WHERE id = ANY($1::bigint[])", [params[0]]);
              continue;
            }
            const updated = await client.query(
              `UPDATE ward_flow.push_deliveries d SET status=${outcome === "sent" ? "'sent'" : outcome === "rejected" ? "'failed'" : "CASE WHEN attempts >= $4 THEN 'failed' ELSE 'pending' END"} FROM unnest($1::bigint[], $2::text[]) AS u(id, item) WHERE ${claimed} RETURNING d.subscription_id AS id`,
              outcome === "retry" ? [...params, MAX_DELIVERY_ATTEMPTS] : params,
            );
            if (outcome === "sent" && updated.rows.length)
              await client.query(
                "UPDATE ward_flow.push_subscriptions SET last_success_at=GREATEST(last_success_at,$2) WHERE id = ANY($1::bigint[])",
                [updated.rows.map((row) => row.id), at],
              );
          }
        });
        if (new Set(rows.map((row) => row.id)).size < SUBSCRIPTION_PAGE) break;
      }
      if (counts.failed) log({ event: "ward_backend_push_delivery_failures", ...counts, failures });
    } catch (error) {
      // A push is a courtesy after the committed change. Its failure never alters the command result.
      log({ event: "ward_backend_push_delivery_unavailable", ...counts, ...errorFields(error) });
    }
  }
  return { evaluatePush, deliver, deliverOnce };
}

/** The store's phone alert subscription methods. */
export function pushStore({ pool, workspaceId, push, schemaVersion, transaction, lock }) {
  return {
    /** `membershipId`: the desk the device was turned on from, or null for a bootstrap coordinator. */
    async subscribe(actorId, subscription, membershipId = null) {
      if (!push) throw new Error("push-disabled");
      const byRole = (await schemaVersion()) >= ACCESS_COVER_MIGRATION;
      if (membershipId && !byRole) throw new Error("push-disabled");
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
        const takeover =
          "ON CONFLICT (endpoint) DO UPDATE SET workspace_id=EXCLUDED.workspace_id, actor_id=EXCLUDED.actor_id, p256dh=EXCLUDED.p256dh, auth=EXCLUDED.auth, created_at=GREATEST(EXCLUDED.created_at,ward_flow.push_subscriptions.created_at + interval '1 microsecond'), last_success_at=NULL, revoked_at=NULL" +
          (byRole ? ", membership_id=EXCLUDED.membership_id" : "") +
          " WHERE ward_flow.push_subscriptions.revoked_at IS NOT NULL OR (ward_flow.push_subscriptions.p256dh=EXCLUDED.p256dh AND ward_flow.push_subscriptions.auth=EXCLUDED.auth) OR (ward_flow.push_subscriptions.workspace_id=EXCLUDED.workspace_id AND ward_flow.push_subscriptions.actor_id=EXCLUDED.actor_id)";
        const stored = await client.query(
          byRole
            ? `INSERT INTO ward_flow.push_subscriptions(workspace_id, actor_id, endpoint, p256dh, auth, created_at, membership_id) VALUES ($1,$2,$3,$4,$5,$6,$7) ${takeover}`
            : `INSERT INTO ward_flow.push_subscriptions(workspace_id, actor_id, endpoint, p256dh, auth, created_at) VALUES ($1,$2,$3,$4,$5,$6) ${takeover}`,
          byRole
            ? [workspaceId, actorId, subscription.endpoint, subscription.p256dh, subscription.auth, at, membershipId]
            : [workspaceId, actorId, subscription.endpoint, subscription.p256dh, subscription.auth, at],
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
    /**
     * Whether this account has an active phone alert record for this device endpoint. From 9 it
     * must also be for the desk now worked as (`membershipId`, null for a bootstrap coordinator),
     * so after a role switch the setting reads off and turning it on moves the device across.
     */
    async pushStatus(actorId, endpoint, membershipId = null) {
      if (!push) throw new Error("push-disabled");
      const byRole = (await schemaVersion()) >= ACCESS_COVER_MIGRATION;
      const { rowCount } = await pool.query(
        "SELECT 1 FROM ward_flow.push_subscriptions WHERE workspace_id=$1 AND actor_id=$2 AND endpoint=$3 AND revoked_at IS NULL" +
          (byRole ? " AND membership_id IS NOT DISTINCT FROM $4::uuid" : ""),
        byRole ? [workspaceId, actorId, endpoint, membershipId] : [workspaceId, actorId, endpoint],
      );
      return rowCount > 0;
    },
  };
}
