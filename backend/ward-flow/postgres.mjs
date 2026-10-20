// @ts-check
import { createHash, randomUUID } from "node:crypto";
import {
  ACCESS_COVER_MIGRATION,
  LATEST_MIGRATION,
  MINIMUM_RUNTIME_MIGRATION,
  RECORDS_MIGRATION,
  RECORD_ACCESS_MIGRATION,
  ROLE_ACCESS_MIGRATION,
} from "./migrations.mjs";
import { errorFields, freshAlerts } from "./push.mjs";
import { assembleWorld, conflicts, markerKind, planSave } from "./records.mjs";

const SUBSCRIPTION_PAGE = 200;
/** Desks with a phone turned on, read a page at a time when new alerts are queued. */
const DESK_PAGE = 500;
/** A device whose sends keep failing for a reason that may pass is tried this many times. */
export const MAX_DELIVERY_ATTEMPTS = 5;
/** How long the schema version is trusted before it is read again. */
const VERSION_TRUSTED_MS = 60_000;
/** A break glass record opened or ended this recently still sends the whole scoped workspace on a poll. */
const GRANT_SETTLE_MS = 60_000;
/** Most break glass grants one desk is sent at once. */
const GRANT_LIST_LIMIT = 50;
/** How often a role's "last used" time is written: once an hour is enough for a 90 day rule. */
const LAST_USED_EVERY_MS = 3_600_000;
/** A membership still in use, as the viewer counts it: cover, or used since `param` (a cutoff). */
const inUse = (param) => `(m.kind = 'cover' OR coalesce(m.last_used_at, m.granted_at) > ${param}::timestamptz)`;
/** Open requests for access kept at once, so made-up accounts cannot fill the table. */
const MAX_OPEN_REQUESTS = 200;
/** The most a whole workspace may hold, as before migration 10 split it into rows. */
const MAX_WORLD_BYTES = 8_388_608;
const RECORD_COLUMNS = "collection, record_id, kind, ordinal, revision, body";
/** Whether a stored workspace row stands in for rows of `ward_flow.workspace_records`. */
const hasMarkers = (payload) =>
  !!payload?.state &&
  typeof payload.state === "object" &&
  Object.values(payload.state).some((value) => markerKind(value));
/** The same desk opening the same record on the same screen again this soon adds no new row. */
const VIEW_REPEAT_MS = 60_000;
/** Most record access rows one read returns. */
const VIEW_LIST_LIMIT = 200;
/** Most record openings one account may log in a minute, so no desk can flood the log. */
const VIEW_RATE_LIMIT = 60;

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
  // A cache lifetime marker, never an access grant. Exclude clinical revision and clock time;
  // include the absolute expiry of every active opening so closing one changes this desk's key.
  const accessContext = (at, view) => {
    if (!view?.actorId || !view.access) return {};
    const scope = view.access.scope;
    const access = {
      role: view.access.role,
      scope: Array.isArray(scope.unitIds) ? { ...scope, unitIds: [...scope.unitIds].sort() } : scope,
    };
    const grants = (view.grants ?? [])
      .filter((grant) => new Date(grant.until).getTime() > at.getTime())
      .map((grant) => [grant.patientId, new Date(grant.until).toISOString()])
      .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
    return {
      accessContext: createHash("sha256")
        .update(
          JSON.stringify(
            canonical({
              version: 1,
              workspaceId,
              actorId: view.actorId,
              membershipId: view.membershipId ?? null,
              access,
              grants,
            }),
          ),
        )
        .digest("hex"),
    };
  };
  const snapshot = (row, at, view) => ({
    dataMode: row.data_mode,
    // Whether the demonstration controls work here, so the screens can say when they do not.
    demoControls: demoEvents,
    revision: Number(row.revision),
    ...accessContext(at, view),
    payload: view ? engine.scopeWorld(row.payload, view.access, at, view.grants) : row.payload,
    now: engine.worldNow(row.payload, at),
  });
  /** The cutoff before which a role not used since switches off (synthetic, clinical values). */
  const unusedBefore = (at) => new Date(at.getTime() - engine.ACCESS_UNUSED_MINUTES * 60_000);
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
        "SELECT actor_id, role, scope FROM ward_flow.memberships WHERE workspace_id=$1 AND kind='cover' AND role='ward' AND revoked_at IS NULL AND expires_at > $2 AND actor_id = ANY($3::uuid[])",
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
   * Live memberships matching `where`, oldest grant first, kept by `keep` as they are read, up to
   * `cap`. Pages on (granted_at, id), with the time carried as text so its microseconds survive the
   * driver. At most ten pages, to bound one request.
   */
  async function pagedMemberships(where, params, keep, cap = 500) {
    const kept = [];
    let last = null;
    const next = params.length + 1;
    for (let page = 0; page < 10 && kept.length < cap; page += 1) {
      const { rows } = await pool.query(
        `SELECT *, granted_at::text AS granted_key FROM ward_flow.memberships WHERE ${where}${last ? ` AND (granted_at, id) > ($${next}::timestamptz, $${next + 1}::uuid)` : ""} ORDER BY granted_at, id LIMIT 500`,
        last ? [...params, last.granted_key, last.id] : params,
      );
      kept.push(...rows.filter(keep));
      if (rows.length < 500) break;
      last = rows[rows.length - 1];
    }
    return kept.slice(0, cap);
  }
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
      // A transaction owns this clock value; lock() refreshes it after any row-lock wait.
      const result = await run(client, new Date(clock().getTime()));
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
  /**
   * Whether this workspace's records are kept as rows (migration 10). A stored row with markers
   * says so by itself. One without them is a whole workspace (from before 10, or written by hand):
   * once this store has seen the database at 10, the next save moves it into rows. The cached
   * version is only a hint here, so a lock never waits on reading it.
   */
  function keepsRecords(payload) {
    return hasMarkers(payload) || known.version >= RECORDS_MIGRATION;
  }
  /**
   * The workspace row with its whole world in `payload`, read without a lock. Once the database is
   * known to be at 10, one statement reads the workspace row and its records together, so they
   * always come from the same moment. Until then the workspace row is read alone, and read again
   * with its records if it turns out to hold markers.
   */
  async function readWorld(connection, columns = "data_mode, revision, payload") {
    for (let attempt = 0; ; attempt += 1) {
      const records = known.version >= RECORDS_MIGRATION;
      try {
        const { rows } = await connection.query(
          `SELECT ${columns}${records ? `, (SELECT coalesce(jsonb_agg(jsonb_build_object('collection', r.collection, 'record_id', r.record_id, 'kind', r.kind, 'ordinal', r.ordinal, 'revision', r.revision, 'body', r.body)), '[]'::jsonb) FROM ward_flow.workspace_records r WHERE r.workspace_id = w.id) AS records` : ""} FROM ward_flow.workspaces w WHERE id=$1 AND data_mode='prototype'`,
          [workspaceId],
        );
        const row = rows[0];
        if (!row) return null;
        if (records) return { ...row, payload: assembleWorld(row.payload, row.records) };
        if (attempt === 0 && hasMarkers(row.payload)) {
          known = { version: 0, until: 0 };
          if ((await schemaVersion()) >= RECORDS_MIGRATION) continue;
        }
        return row;
      } catch (error) {
        forgetVersionOnMissing(error);
        if (attempt === 0 && error?.code === "42P01") continue;
        throw error;
      }
    }
  }
  /**
   * The workspace row under `lock` ("UPDATE" or "SHARE"), with its whole world in `payload`, the
   * stored workspace row in `core` and its records in `stored`. The records are read after the
   * lock is held, so a save that committed while this waited is never missed.
   */
  async function lockedWorld(client, mode) {
    const { rows } = await client.query(
      `SELECT data_mode, revision, payload FROM ward_flow.workspaces WHERE id=$1 AND data_mode='prototype' FOR ${mode}`,
      [workspaceId],
    );
    const row = rows[0];
    if (!row) return null;
    if (!keepsRecords(row.payload)) return { ...row, core: null, stored: [] };
    const { rows: stored } = await client.query(
      `SELECT ${RECORD_COLUMNS} FROM ward_flow.workspace_records WHERE workspace_id=$1`,
      [workspaceId],
    );
    return { ...row, core: row.payload, stored, payload: assembleWorld(row.payload, stored) };
  }
  /**
   * Saves `world` at `revision` over `row` from `lockedWorld`. From migration 10 only the records
   * whose content or place in a list changed are written, and each keeps the revision its content
   * last changed at; before 10 the whole world is the workspace row.
   */
  async function saveWorld(client, row, world, revision, at) {
    if (!row.core) {
      await client.query("UPDATE ward_flow.workspaces SET revision=$2, payload=$3, updated_at=$4 WHERE id=$1", [
        workspaceId,
        revision,
        world,
        at,
      ]);
      return;
    }
    if (JSON.stringify(world).length > MAX_WORLD_BYTES) throw new Error("Workspace too large");
    const plan = planSave(row.stored, world, revision, row.core);
    await client.query("UPDATE ward_flow.workspaces SET revision=$2, payload=$3, updated_at=$4 WHERE id=$1", [
      workspaceId,
      revision,
      plan.core,
      at,
    ]);
    await writeRecords(client, plan, at);
  }
  async function writeRecords(client, plan, at) {
    if (plan.deletes.length)
      await client.query(
        "DELETE FROM ward_flow.workspace_records WHERE workspace_id=$1 AND (collection, record_id) IN (SELECT * FROM unnest($2::text[], $3::text[]))",
        [workspaceId, plan.deletes.map((row) => row.collection), plan.deletes.map((row) => row.recordId)],
      );
    if (plan.upserts.length)
      await client.query(
        "INSERT INTO ward_flow.workspace_records(workspace_id, collection, record_id, kind, ordinal, revision, body, updated_at) SELECT $1, r.collection, r.record_id, r.kind, r.ordinal, r.revision, r.body, $3 FROM jsonb_to_recordset($2::jsonb) AS r(collection text, record_id text, kind text, ordinal integer, revision bigint, body jsonb) ON CONFLICT (workspace_id, collection, record_id) DO UPDATE SET kind=EXCLUDED.kind, ordinal=EXCLUDED.ordinal, body=EXCLUDED.body, updated_at=CASE WHEN ward_flow.workspace_records.revision = EXCLUDED.revision THEN ward_flow.workspace_records.updated_at ELSE EXCLUDED.updated_at END, revision=EXCLUDED.revision",
        [
          workspaceId,
          JSON.stringify(
            plan.upserts.map((part) => ({
              collection: part.collection,
              record_id: part.recordId,
              kind: part.kind,
              ordinal: part.ordinal,
              revision: part.revision,
              body: part.body,
            })),
          ),
          at,
        ],
      );
  }
  async function lock(client, actorId, at, view) {
    let row = await lockedWorld(client, "UPDATE");
    if (!row) {
      const seed = engine.seedWorld(at);
      const records = (await schemaVersion()) >= RECORDS_MIGRATION;
      const split = records ? planSave([], seed, 1) : null;
      const created = await client.query(
        "INSERT INTO ward_flow.workspaces(id, revision, payload) VALUES ($1, 1, $2) ON CONFLICT DO NOTHING RETURNING id",
        [workspaceId, split ? split.core : seed],
      );
      if (created.rowCount) {
        if (split) await writeRecords(client, split, at);
        await audit(client, view, actorId, {
          action: "INITIALISE_WORKSPACE",
          outcome: "accepted",
          priorRevision: 0,
          revision: 1,
          changes: {},
        });
      }
      row = await lockedWorld(client, "UPDATE");
    }
    at.setTime(clock().getTime());
    if (row?.data_mode !== "prototype") throw new Error("Workspace data mode mismatch");
    if (!engine.validWorld(row.payload)) throw new Error("Stored workspace is incompatible");
    // A selected ward desk can include several cover memberships. Resolve all of them again
    // under the same workspace lock as revocation, using the time after any lock wait. Checking
    // only the selected/base membership would leave ended cover in the request's write scope.
    if (view?.membershipId) {
      const current = await resolveViewer(actorId, { workingAs: view.membershipId }, client, at, view.version);
      if (current.status !== "ok") throw new Error("role-ended");
      Object.assign(view, current);
    }
    return row;
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
      [workspaceId, push.coordinatorIds, excludeActorId, fresh.map((alert) => alert.id)],
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
          `SELECT DISTINCT m.id, m.actor_id, m.role, m.scope, m.kind FROM ward_flow.push_subscriptions s JOIN ward_flow.memberships m ON m.id = s.membership_id WHERE s.workspace_id=$1 AND s.revoked_at IS NULL AND m.revoked_at IS NULL AND m.expires_at > $2 AND ${inUse("$3")}${last ? " AND m.id > $4" : ""} ORDER BY m.id LIMIT ${DESK_PAGE}`,
          [workspaceId, at, unusedBefore(at), ...(last ? [last] : [])],
        );
        if (!desks.length) break;
        const accesses = await deskAccesses(client, desks, at);
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
  async function deliver() {
    const counts = { sent: 0, expired: 0, failed: 0 };
    const failures = {};
    try {
      const at = clock();
      const readRed = async () => {
        const stored = await readWorld(pool, "payload");
        if (!stored || !engine.validWorld(stored.payload)) return null;
        const world = stored.payload;
        return { world, red: new Map(engine.actNowAlerts(world, at).map((alert) => [alert.id, alert])) };
      };
      // A crash after the final claim has no send result to terminalise it. Only expired
      // leases may be retired; an in-flight final attempt still owns its result.
      await pool.query(
        "UPDATE ward_flow.push_deliveries d SET status='failed' FROM ward_flow.push_subscriptions s WHERE d.subscription_id=s.id AND s.workspace_id=$1 AND d.status='pending' AND d.attempts >= $2 AND d.last_attempt_at <= $3",
        [workspaceId, MAX_DELIVERY_ATTEMPTS, new Date(at.getTime() - retryAfterMs)],
      );
      const due = "d.status='pending' AND d.attempts < $3 AND (d.last_attempt_at IS NULL OR d.last_attempt_at <= $4)";
      // A bootstrap coordinator's device while it is still named; from 9 also a device held by a
      // role that is still active and still in use, as the viewer counts it.
      const byRole = (await schemaVersion()) >= ACCESS_COVER_MIGRATION;
      const listener = byRole
        ? `((s.membership_id IS NULL AND s.actor_id = ANY($2::uuid[])) OR EXISTS (SELECT 1 FROM ward_flow.memberships m WHERE m.id = s.membership_id AND m.revoked_at IS NULL AND m.expires_at > $5 AND ${inUse("$8")}))`
        : "s.actor_id = ANY($2::uuid[])";
      // The desk a device was turned on from, so a retry is checked against that desk's place.
      const desk = byRole ? ", s.membership_id AS desk_id" : "";
      let after = "0";
      for (;;) {
        const { rows } = await pool.query(
          `UPDATE ward_flow.push_deliveries d SET attempts = d.attempts + 1, last_attempt_at = $5 FROM ward_flow.push_subscriptions s WHERE d.subscription_id = s.id AND ${due} AND d.subscription_id IN (SELECT DISTINCT d.subscription_id FROM ward_flow.push_deliveries d JOIN ward_flow.push_subscriptions s ON s.id = d.subscription_id WHERE s.workspace_id=$1 AND s.data_mode='prototype' AND s.revoked_at IS NULL AND ${listener} AND ${due} AND d.subscription_id > $6 ORDER BY d.subscription_id LIMIT $7) RETURNING d.subscription_id AS id, d.item_id, s.endpoint, s.p256dh, s.auth${desk}`,
          [
            workspaceId,
            push.coordinatorIds,
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
        const read = await readRed();
        if (!read) return;
        const { world, red } = read;
        const devices = new Map();
        const unseen = { ids: [], items: [] };
        const outside = { ids: [], items: [] };
        const deskIds = [...new Set(rows.map((row) => row.desk_id).filter(Boolean))];
        const accesses = deskIds.length
          ? await deskAccesses(
              pool,
              (
                await pool.query(
                  "SELECT id, actor_id, role, scope, kind FROM ward_flow.memberships WHERE id = ANY($1::uuid[])",
                  [deskIds],
                )
              ).rows,
              at,
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
              outside.ids.push(row.id);
              outside.items.push(row.item_id);
              continue;
            }
          }
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
        if (outside.ids.length)
          await pool.query(
            "DELETE FROM ward_flow.push_deliveries d USING unnest($1::bigint[], $2::text[]) AS u(id, item) WHERE d.subscription_id = u.id AND d.item_id = u.item AND d.status='pending' AND d.last_attempt_at=$3",
            [outside.ids, outside.items, at],
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
    if (view?.membershipId) return scopedRead(actorId, view);
    const at = clock();
    const stored = await readWorld(pool);
    if (stored && engine.validWorld(stored.payload)) return snapshot(stored, at, view);
    return transaction(async (client, now) => snapshot(await lock(client, actorId, now, view), now, view));
  }
  /**
   * A member's full snapshot, with the role and covers resolved again under a share lock on the
   * workspace row. Access changes hold that row FOR UPDATE, so a revocation either commits before
   * this resolve (and the poll is refused) or waits until the reply is built. Polls do not block
   * one another. An uninitialised or incompatible workspace falls back to the locked write path.
   */
  async function scopedRead(actorId, view) {
    const version = await schemaVersion();
    const ready = await transaction(async (client, at) => {
      const row = await lockedWorld(client, "SHARE");
      if (!row || !engine.validWorld(row.payload)) return null;
      at.setTime(clock().getTime());
      const current = await resolveViewer(actorId, { workingAs: view.membershipId }, client, at, version);
      if (current.status !== "ok") throw new Error("role-ended");
      // The HTTP reply uses this request's view for its access metadata too.
      Object.assign(view, current);
      return snapshot(row, at, current);
    });
    if (ready) return ready;
    const current = await viewer(actorId, { workingAs: view.membershipId });
    if (current.status !== "ok") throw new Error("role-ended");
    return transaction(async (client, now) => {
      const row = await lock(client, actorId, now, current);
      Object.assign(view, current);
      return snapshot(row, now, current);
    });
  }
  /**
   * Who this account is working as. The role always comes from here, never from the browser.
   * An account named in WARD_COORDINATOR_USER_IDS (the bootstrap) works as the statewide
   * coordinator; one that also holds memberships picks, as any account with more than one role
   * does. Any other account needs one active membership: none is refused, and more than one must
   * say which with `workingAs`. Checked on
   * every request, so a removed or expired role stops at once.
   */
  async function viewer(actorId, options = {}) {
    return resolveViewer(actorId, options, pool, clock(), await schemaVersion());
  }
  /** Resolve through the caller's connection so locked writes never use a stale joined scope. */
  async function resolveViewer(actorId, { bootstrap = false, workingAs = null }, connection, at, version) {
    const choices = bootstrap ? [{ membershipId: null, access: engine.STATEWIDE, own: engine.STATEWIDE }] : [];
    if (version >= ROLE_ACCESS_MIGRATION) {
      // From 9, a role not worked as for the set time is switched off (cover is too short to go
      // unused), and cover is a membership of its own kind.
      const covers = version >= ACCESS_COVER_MIGRATION;
      const { rows } = await connection
        .query(
          covers
            ? "SELECT id, role, scope, kind, last_used_at FROM ward_flow.memberships WHERE workspace_id=$1 AND data_mode='prototype' AND actor_id=$2 AND revoked_at IS NULL AND expires_at > $3 AND (kind = 'cover' OR coalesce(last_used_at, granted_at) > $4) ORDER BY granted_at, id LIMIT 20"
            : "SELECT id, role, scope, 'role' AS kind FROM ward_flow.memberships WHERE workspace_id=$1 AND data_mode='prototype' AND actor_id=$2 AND revoked_at IS NULL AND expires_at > $3 ORDER BY granted_at, id LIMIT 20",
          covers ? [workspaceId, actorId, at, unusedBefore(at)] : [workspaceId, actorId, at],
        )
        .catch((error) => {
          forgetVersionOnMissing(error);
          throw error;
        });
      const roles = [];
      const wardCovers = [];
      for (const row of rows) {
        // A row the access table would not allow is skipped, never widened.
        const access = engine.parseAccess(row.role, row.scope);
        if (!access) continue;
        if (row.kind === "cover" && access.role === "ward")
          wardCovers.push({ membershipId: row.id, access, lastUsed: row.last_used_at ?? null });
        // Cover gives no place of its own, so it can never be passed on (own: null).
        else
          roles.push({
            membershipId: row.id,
            access,
            own: row.kind === "cover" ? null : access,
            lastUsed: row.last_used_at ?? null,
          });
      }
      // Cover of a ward joins a nurse in charge's own ward, so night cover of two wards is one desk.
      // Held with no ward of their own, or for an ED, cover is a choice of who to work as.
      const wardRoles = roles.filter((choice) => choice.access.role === "ward");
      for (const choice of roles)
        choices.push(
          choice.access.role === "ward" && wardCovers.length
            ? {
                ...choice,
                access: engine.withCover(
                  choice.access,
                  wardCovers.map((cover) => cover.access.scope),
                ),
              }
            : choice,
        );
      if (!wardRoles.length) for (const cover of wardCovers) choices.push({ ...cover, own: null });
    }
    const chosen = workingAs
      ? choices.find((choice) => (choice.membershipId ?? "bootstrap") === workingAs)
      : choices.length === 1
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
    const writeEvery = new Date(at.getTime() - LAST_USED_EVERY_MS);
    if (
      chosen.membershipId &&
      version >= ACCESS_COVER_MIGRATION &&
      (!chosen.lastUsed || new Date(chosen.lastUsed) < writeEvery)
    )
      // When this role was last worked as, for the "not used" switch-off. Written at most hourly,
      // and only sent when due, so the board's poll does not cost a write each time.
      await connection
        .query(
          "UPDATE ward_flow.memberships SET last_used_at=$2 WHERE id=$1 AND (last_used_at IS NULL OR last_used_at < $3)",
          [chosen.membershipId, at, writeEvery],
        )
        .catch((error) => {
          forgetVersionOnMissing(error);
          throw error;
        });
    if (chosen.membershipId) {
      const { rows } = await connection.query(
        `SELECT patient_id, opened_at, until FROM ward_flow.break_glass WHERE workspace_id=$1 AND actor_id=$2 AND membership_id=$3 AND until > $4 ORDER BY until DESC LIMIT ${GRANT_LIST_LIMIT}`,
        [workspaceId, actorId, chosen.membershipId, new Date(at.getTime() - GRANT_SETTLE_MS)],
      );
      const nowMs = at.getTime();
      recentGrant = rows.some((row) => {
        const openedAtMs =
          row.opened_at !== undefined && row.opened_at !== null ? new Date(row.opened_at).getTime() : NaN;
        const untilMs = new Date(row.until).getTime();
        return (
          (nowMs >= openedAtMs && nowMs - openedAtMs <= GRANT_SETTLE_MS) ||
          (nowMs >= untilMs && nowMs - untilMs <= GRANT_SETTLE_MS)
        );
      });
      // The list is capped, so a capped list may leave out a grant that just ended: ask directly.
      if (!recentGrant && rows.length >= GRANT_LIST_LIMIT) {
        const settling = await connection.query(
          "SELECT EXISTS (SELECT 1 FROM ward_flow.break_glass WHERE workspace_id=$1 AND actor_id=$2 AND membership_id=$3 AND ((opened_at <= $4 AND opened_at >= $5) OR (until <= $4 AND until >= $5))) AS settling",
          [workspaceId, actorId, chosen.membershipId, at, new Date(at.getTime() - GRANT_SETTLE_MS)],
        );
        recentGrant = settling.rows[0]?.settling === true;
      }
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
      // The role as granted, before any cover joined it: what this desk may give cover of. `null`
      // when the desk is working as cover, which is never given on.
      ownAccess: chosen.own === undefined ? chosen.access : chosen.own,
      grants,
      recentGrant,
    };
  }
  /** Minutes from `at` to a stored time, so a screen can place it on its own clock. */
  const minutesFrom = (value, at) => (value ? Math.round((new Date(value).getTime() - at.getTime()) / 60_000) : null);
  /** A membership as an access admin sees it. */
  const presentMembership = (row, at = clock()) => ({
    id: row.id,
    actorId: row.actor_id,
    role: row.role,
    scope: row.scope,
    kind: row.kind ?? "role",
    grantedBy: row.granted_by,
    grantedAt: new Date(row.granted_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at).toISOString() : null,
    // Kept for older clients: every role is usable without a separate approval (D-66).
    approved: true,
    approvedBy: row.approved_by,
    minutes: {
      granted: minutesFrom(row.granted_at, at),
      expires: minutesFrom(row.expires_at, at),
      lastUsed: minutesFrom(row.last_used_at, at),
    },
  });
  /** A request for access as an access admin sees it. */
  const presentRequest = (row, at = clock()) => ({
    id: row.id,
    actorId: row.actor_id,
    role: row.role,
    scope: row.scope,
    requestedAt: new Date(row.requested_at).toISOString(),
    decision: row.decision,
    minutes: { requested: minutesFrom(row.requested_at, at) },
  });
  const refused = (status, error) => ({ status, body: { error } });
  const notAdmin = "Granting and removing roles is not part of your role.";
  /**
   * Inside one locked transaction: approve or remove a membership the access admin's own place
   * covers. `change` returns a refusal, or the columns to set.
   */
  // Roles live in the tables migration 8 adds; before it, the access routes say so instead of failing.
  function accessRefusal(view) {
    if (!engine.managesAccess(view.access)) return refused(403, notAdmin);
    if (!(view.version >= ROLE_ACCESS_MIGRATION))
      return refused(409, "Roles are not set up on this database yet. Apply migration 8 first.");
    return null;
  }
  // From 9 the giver of cover may end it too, so cover needs no access admin at either end.
  function coverRefusalBefore9(view) {
    if (!(view.version >= ACCESS_COVER_MIGRATION))
      return refused(
        409,
        "Cover and requests for access are not set up on this database yet. Apply migration 9 first.",
      );
    return null;
  }
  async function changeMembership(view, membershipId, action, change, { coverGiver = false } = {}) {
    const blocked = coverGiver && !engine.managesAccess(view.access) ? coverRefusalBefore9(view) : accessRefusal(view);
    if (blocked) return blocked;
    return transaction(async (client, at) => {
      const row = await lock(client, view.actorId, at, view);
      const { rows } = await client.query(
        "SELECT * FROM ward_flow.memberships WHERE id=$1 AND workspace_id=$2 AND revoked_at IS NULL AND expires_at > $3 FOR UPDATE",
        [membershipId, workspaceId, at],
      );
      const membership = rows[0];
      if (!membership) return refused(404, "That role is not active.");
      const access = engine.parseAccess(membership.role, membership.scope);
      const ownCover = coverGiver && membership.kind === "cover" && membership.granted_by === view.actorId;
      // A coordinator sees all cover inside its place, so may end any of it there (revokeRefusal).
      const placeCover =
        coverGiver &&
        membership.kind === "cover" &&
        view.access.role === "coordinator" &&
        !!access &&
        engine.scopeWithin(row.payload, access.scope, view.access.scope);
      if (!ownCover && !placeCover && !engine.managesAccess(view.access)) return refused(403, notAdmin);
      // A row the access table cannot read is left to a statewide admin.
      const covered =
        ownCover ||
        placeCover ||
        (access
          ? engine.scopeWithin(row.payload, access.scope, view.access.scope)
          : view.access.scope.kind === "statewide");
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
      return { status: 200, body: { membership: presentMembership(updated[0], at) } };
    });
  }
  /** Inside the workspace lock: a new role for a person until a set time, audited. */
  async function insertGrant(client, row, view, { actorId, access, expiresAt, kind = "role" }, at, action) {
    const id = randomUUID();
    const { rows } = await client.query(
      kind === "cover"
        ? "INSERT INTO ward_flow.memberships(id, workspace_id, actor_id, role, scope, granted_by, granted_at, expires_at, kind) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'cover') RETURNING *"
        : "INSERT INTO ward_flow.memberships(id, workspace_id, actor_id, role, scope, granted_by, granted_at, expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
      [id, workspaceId, actorId, access.role, access.scope, view.actorId, at, expiresAt],
    );
    const revision = Number(row.revision);
    await audit(client, view, view.actorId, {
      action,
      outcome: "accepted",
      priorRevision: revision,
      revision,
      changes: {
        membershipId: id,
        actorId,
        role: access.role,
        scope: access.scope,
        expiresAt: expiresAt.toISOString(),
      },
    });
    return rows[0];
  }
  /** Who may hear phone alerts as this desk: a whole-network bootstrap, or a role from 9 on. */
  function pushByRole(view) {
    return (
      view.membershipId !== null &&
      view.version >= ACCESS_COVER_MIGRATION &&
      engine.PUSH_ROLES.includes(view.access.role)
    );
  }
  return {
    pushEnabled: !!push,
    async ready() {
      const { rows } = await pool.query("SELECT max(version) AS version FROM ward_flow.migrations");
      const version = rows[0]?.version;
      if (!Number.isInteger(version) || version < MINIMUM_RUNTIME_MIGRATION || version > LATEST_MIGRATION)
        throw new Error("Shared schema unavailable");
    },
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
          "ON CONFLICT (endpoint) DO UPDATE SET workspace_id=EXCLUDED.workspace_id, actor_id=EXCLUDED.actor_id, p256dh=EXCLUDED.p256dh, auth=EXCLUDED.auth, created_at=EXCLUDED.created_at, last_success_at=NULL, revoked_at=NULL" +
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
    /**
     * The timer trigger calls this. Time alone can turn a row red (a wait passing its target), so
     * it re-evaluates; then it sends whatever is due, including retries and deliveries an earlier
     * invocation did not finish.
     */
    async sweepPush() {
      if (!push) return;
      await transaction(async (client, at) => {
        const row = await lockedWorld(client, "UPDATE");
        if (!row || !engine.validWorld(row.payload)) return;
        await evaluatePush(client, row.payload, row.payload, at, null);
      });
      await deliver();
    },
    read,
    /**
     * The 3 second poll. When the workspace is still at `knownRevision`, returns only the revision
     * and the world clock (read from two small fields, so the whole record is not sent or checked);
     * otherwise the full snapshot, as `read` does. A member desk also names its `knownContext`, and
     * gets the cheap answer only while that still matches; its browser reads in full every minute,
     * because what a desk may see also changes with time (hand-off windows).
     */
    async poll(actorId, knownRevision, view, knownContext = null) {
      const at = clock();
      // Re-resolve scoped access immediately before reading. A role or one of its covers may have
      // ended since the HTTP handler resolved the view; never use that stale scope for a snapshot.
      // Audit F-04: a member desk whose access is unchanged (same role, place, cover and openings,
      // as this request resolved them) may take the cheap answer too. Nothing is sent with it, so
      // a role ending mid-request discloses nothing; the desk's next full read is refused.
      const scoped = !!(view?.membershipId || view?.recentGrant);
      if (
        scoped &&
        (view.recentGrant || typeof knownContext !== "string" || accessContext(at, view).accessContext !== knownContext)
      )
        return { notModified: false, snapshot: await scopedRead(actorId, view) };
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
     * The accounts holding any current role here, waiting approval included. The sign-in check
     * reads this list now and then (cached) before it calls Supabase, so made-up accounts get only a
     * small allowance. Before migration 8 there are no roles to hold. Running cover is a membership,
     * so its holder counts; a request for access is not, so its asker stays in the no-role allowance.
     */
    async roleHolders() {
      if ((await schemaVersion()) < ROLE_ACCESS_MIGRATION) return [];
      const { rows } = await pool
        .query(
          "SELECT DISTINCT actor_id FROM ward_flow.memberships WHERE workspace_id=$1 AND data_mode='prototype' AND revoked_at IS NULL AND expires_at > $2",
          [workspaceId, clock()],
        )
        .catch((error) => {
          forgetVersionOnMissing(error);
          throw error;
        });
      return rows.map((row) => String(row.actor_id));
    },
    /**
     * The newest audit rows. The statewide coordinator reads them all, break glass included. An
     * access admin reads only role changes inside their own place, never which patient was opened.
     * The HTTP layer refuses everyone else before this runs.
     */
    async audit(view) {
      const whole = !view || engine.wholeNetwork(view.access);
      const scoped = view && view.version >= ROLE_ACCESS_MIGRATION ? ", actor_scope" : "";
      const { rows } = await pool.query(
        `SELECT sequence, actor_id, actor_role${scoped}, data_mode, action, outcome, prior_revision, revision, changes, committed_at FROM ward_flow.audit WHERE workspace_id=$1 AND data_mode='prototype'${whole ? "" : " AND action LIKE 'ACCESS\\_%'"} ORDER BY sequence DESC LIMIT 200`,
        [workspaceId],
      );
      if (whole || view.access.scope.kind === "statewide") return rows;
      const payload = (await readWorld(pool, "payload"))?.payload;
      if (!payload || !engine.validWorld(payload)) return [];
      return rows.filter((row) => {
        const access = engine.parseAccess(row.changes?.role, row.changes?.scope);
        return !!access && engine.scopeWithin(payload, access.scope, view.access.scope);
      });
    },
    /**
     * Every active or waiting role and cover inside the access admin's own place, with when each
     * was last used, and from 9 the open requests for access there too.
     */
    async listAccess(view) {
      const blocked = accessRefusal(view);
      if (blocked) return blocked;
      const at = clock();
      const world = await read(view.actorId);
      const inside = (row) => {
        const access = engine.parseAccess(row.role, row.scope);
        return !!access && engine.scopeWithin(world.payload, access.scope, view.access.scope);
      };
      // The place filter runs here, so read oldest grant first a page at a time until this admin's
      // own 500 are found: roles elsewhere never crowd them out.
      const memberships = await pagedMemberships(
        "workspace_id=$1 AND revoked_at IS NULL AND expires_at > $2",
        [workspaceId, at],
        inside,
      );
      const requests =
        view.version >= ACCESS_COVER_MIGRATION
          ? (
              await pool.query(
                "SELECT * FROM ward_flow.access_requests WHERE workspace_id=$1 AND decision IS NULL ORDER BY requested_at, id LIMIT $2",
                [workspaceId, MAX_OPEN_REQUESTS],
              )
            ).rows
          : [];
      return {
        status: 200,
        body: {
          memberships: memberships.map((row) => presentMembership(row, at)),
          requests: requests.filter(inside).map((row) => presentRequest(row, at)),
        },
      };
    },
    /**
     * Gives a person a role at a place until a set time. Nobody grants themselves a role or one
     * wider than their own. Granted roles work immediately without another approval (D-66).
     */
    async grantAccess(view, request) {
      const blocked = accessRefusal(view);
      if (blocked) return blocked;
      const access = engine.parseAccess(request.role, request.scope);
      if (!access) return refused(400, "A role and a place that go together are required.");
      if (request.actorId === view.actorId) return refused(422, "Nobody grants themselves a role.");
      return transaction(async (client, at) => {
        const row = await lock(client, view.actorId, at, view);
        if (!(request.expiresAt > at)) return refused(400, "A role needs an end date in the future.");
        if (!engine.scopeExists(row.payload, access.scope)) return refused(422, "That place is not in the workspace.");
        if (!engine.scopeWithin(row.payload, access.scope, view.access.scope))
          return refused(403, "That role is wider than your own.");
        const granted = await insertGrant(
          client,
          row,
          view,
          { actorId: request.actorId, access, expiresAt: request.expiresAt },
          at,
          "ACCESS_GRANT",
        );
        return { status: 200, body: { membership: presentMembership(granted, at) } };
      });
    },
    /**
     * Cover of one ward or ED for a colleague, for one shift at most (feature 2). Given by a
     * coordinator inside its place, or by a nurse in charge or ED clinician for their own ward or
     * ED. Needs no access admin, and ends by itself. Cover is a membership, so it counts as a role
     * holder for the sign-in pre-check while it runs.
     */
    async giveCover(view, request) {
      const blocked = coverRefusalBefore9(view);
      if (blocked) return blocked;
      const shape = request.scope ? engine.coverAccess(request.scope) : null;
      const cover = shape ? engine.parseAccess(shape.role, request.scope) : null;
      if (!cover) return refused(400, "Cover is for one ward or one ED.");
      return transaction(async (client, at) => {
        const row = await lock(client, view.actorId, at, view);
        const giver = view.ownAccess === undefined ? view.access : view.ownAccess;
        if (!giver) return refused(403, "Cover cannot be passed on. Ask the ward's nurse in charge or a coordinator.");
        const refusal = engine.coverRefusal(
          row.payload,
          giver,
          view.actorId,
          request.actorId,
          cover.scope,
          request.minutes,
        );
        if (refusal) return refused(422, refusal);
        const expiresAt = new Date(at.getTime() + request.minutes * 60_000);
        const given = await insertGrant(
          client,
          row,
          view,
          { actorId: request.actorId, access: cover, expiresAt, kind: "cover" },
          at,
          "ACCESS_COVER",
        );
        return { status: 200, body: { membership: presentMembership(given, at) } };
      });
    },
    /** The cover this desk gave or holds, and for a coordinator all cover inside its place. */
    async listCovers(view) {
      const blocked = coverRefusalBefore9(view);
      if (blocked) return blocked;
      const at = clock();
      const world = await read(view.actorId);
      const coordinator = view.access.role === "coordinator";
      // Read a page at a time and filtered as read, so cover elsewhere never crowds out this desk's.
      const rows = await pagedMemberships(
        coordinator
          ? "workspace_id=$1 AND kind='cover' AND revoked_at IS NULL AND expires_at > $2"
          : "workspace_id=$1 AND kind='cover' AND revoked_at IS NULL AND expires_at > $2 AND (granted_by=$3 OR actor_id=$3)",
        coordinator ? [workspaceId, at] : [workspaceId, at, view.actorId],
        (row) => {
          if (row.granted_by === view.actorId || row.actor_id === view.actorId) return true;
          const access = engine.parseAccess(row.role, row.scope);
          return coordinator && !!access && engine.scopeWithin(world.payload, access.scope, view.access.scope);
        },
        200,
      );
      return {
        status: 200,
        body: {
          covers: rows.map((row) => presentMembership(row, at)),
        },
      };
    },
    /**
     * A signed-in person with no role asks for one (feature 7). Open to any signed-in account, so
     * it is checked hard: a real place, one open request each, and a cap on open requests. A
     * request is not a role, so it never counts as a role holder for the sign-in pre-check.
     */
    /** Whether this database takes requests for access yet (from migration 9). */
    async takesRequests() {
      return (await schemaVersion()) >= ACCESS_COVER_MIGRATION;
    },
    async requestAccess(actorId, request) {
      if ((await schemaVersion()) < ACCESS_COVER_MIGRATION)
        return refused(409, "Asking for access is not set up on this database yet.");
      const access = engine.parseAccess(request.role, request.scope);
      if (!access) return refused(400, "A role and a place that go together are required.");
      return transaction(async (client, at) => {
        const row = await lock(client, actorId, at);
        const { rows } = await client.query(
          "SELECT count(*) FILTER (WHERE actor_id=$2)::int AS mine, count(*)::int AS open FROM ward_flow.access_requests WHERE workspace_id=$1 AND decision IS NULL",
          [workspaceId, actorId],
        );
        const refusal = engine.requestRefusal(row.payload, access, rows[0].mine);
        if (refusal) return refused(422, refusal);
        if (rows[0].open >= MAX_OPEN_REQUESTS)
          return refused(429, "Too many requests are waiting. Ask your access admin directly.");
        const { rows: stored } = await client.query(
          "INSERT INTO ward_flow.access_requests(id, workspace_id, actor_id, role, scope, requested_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING *",
          [randomUUID(), workspaceId, actorId, access.role, access.scope, at],
        );
        if (!stored.length) return refused(422, "You have already asked. An access admin will answer it.");
        return { status: 200, body: { request: presentRequest(stored[0], at) } };
      });
    },
    /** This account's own open request, so the screen can say it is waiting. */
    async ownRequest(actorId) {
      if ((await schemaVersion()) < ACCESS_COVER_MIGRATION) return { status: 200, body: { request: null } };
      const at = clock();
      const { rows } = await pool.query(
        "SELECT * FROM ward_flow.access_requests WHERE workspace_id=$1 AND actor_id=$2 AND decision IS NULL LIMIT 1",
        [workspaceId, actorId],
      );
      return { status: 200, body: { request: rows[0] ? presentRequest(rows[0], at) : null } };
    },
    /**
     * An access admin answers a request. Approving grants the asked-for role until `expiresAt`,
     * through the same rules as a grant, so nobody approves a role wider than their own.
     */
    async decideRequest(view, requestId, decision, expiresAt) {
      const blocked = accessRefusal(view) ?? coverRefusalBefore9(view);
      if (blocked) return blocked;
      if (decision !== "approved" && decision !== "declined") return refused(400, "Approve or decline.");
      return transaction(async (client, at) => {
        const row = await lock(client, view.actorId, at, view);
        const { rows } = await client.query(
          "SELECT * FROM ward_flow.access_requests WHERE id=$1 AND workspace_id=$2 AND decision IS NULL FOR UPDATE",
          [requestId, workspaceId],
        );
        const request = rows[0];
        if (!request) return refused(404, "That request has already been answered.");
        const access = engine.parseAccess(request.role, request.scope);
        if (!access || !engine.scopeWithin(row.payload, access.scope, view.access.scope))
          return refused(403, "That role is wider than your own.");
        if (request.actor_id === view.actorId) return refused(422, "Nobody grants themselves a role.");
        let membership = null;
        if (decision === "approved") {
          if (!(expiresAt > at)) return refused(400, "A role needs an end date in the future.");
          if (!engine.scopeExists(row.payload, access.scope))
            return refused(422, "That place is not in the workspace.");
          membership = await insertGrant(
            client,
            row,
            view,
            { actorId: request.actor_id, access, expiresAt },
            at,
            "ACCESS_GRANT",
          );
        } else {
          const revision = Number(row.revision);
          await audit(client, view, view.actorId, {
            action: "ACCESS_DECLINE",
            outcome: "accepted",
            priorRevision: revision,
            revision,
            changes: { requestId, actorId: request.actor_id, role: request.role, scope: request.scope },
          });
        }
        const { rows: answered } = await client.query(
          "UPDATE ward_flow.access_requests SET decision=$2, decided_by=$3, decided_at=$4 WHERE id=$1 RETURNING *",
          [requestId, decision, view.actorId, at],
        );
        return {
          status: 200,
          body: {
            request: presentRequest(answered[0], at),
            ...(membership ? { membership: presentMembership(membership, at) } : {}),
          },
        };
      });
    },
    /** Older clients may still ask to approve a role; grants now work immediately. */
    approveAccess(view, membershipId) {
      return changeMembership(view, membershipId, "ACCESS_APPROVE", () => "That role is not waiting for approval.");
    },
    /** Ends a role now. Cover is ended by its giver too, with no access admin. */
    revokeAccess(view, membershipId) {
      return changeMembership(view, membershipId, "ACCESS_REVOKE", () => ["revoked_at", "revoked_by"], {
        coverGiver: true,
      });
    },
    pushByRole,
    /** Granting access, cover or breaking glass needs a sign-in this recent. */
    stepUpMinutes: engine.STEP_UP_MINUTES,
    /** A sign-in older than this is refused, so the person signs in again (ISM-0428). */
    sessionLimitMinutes: engine.SESSION_LIMIT_MINUTES,
    /**
     * Readiness review item 9: who opened which patient record. One row each time a desk opens a
     * patient or movement page, naming its role and place. A repeat by the same account of the
     * same record on the same screen within a minute adds nothing, so a reload cannot flood the
     * log. Only a record this desk can see is logged (its place, or a break glass grant), so a desk
     * cannot write openings of records it never had, and one account logs at most
     * VIEW_RATE_LIMIT a minute. The table refuses every change and removal (migration 11), which
     * is why nothing goes in unchecked. Before 11 nothing is kept.
     */
    async logView(view, patientId, surface) {
      if (!(view.version >= RECORD_ACCESS_MIGRATION)) return { status: 200, body: { logged: false } };
      const at = clock();
      const stored = await readWorld(pool, "payload");
      if (!stored || !engine.validWorld(stored.payload)) return { status: 200, body: { logged: false } };
      const { state } = engine.scopeWorld(stored.payload, view.access, at, view.grants);
      const visible =
        surface === "patient"
          ? state.patients.some((patient) => patient.id === patientId)
          : state.movements.some((movement) => movement.id === patientId || movement.patientId === patientId);
      if (!visible) return { status: 404, body: { error: "That record is not one this desk can open" } };
      return transaction(async (client, loggedAt) => {
        // Serialize each account's check and insert. A separate lock statement gives the
        // following INSERT a fresh snapshot after an earlier opening commits.
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1 || ':' || $2 || ':record-access'))", [
          workspaceId,
          view.actorId,
        ]);
        loggedAt.setTime(clock().getTime());
        const { rowCount } = await client.query(
          "INSERT INTO ward_flow.record_access(workspace_id, actor_id, membership_id, actor_role, actor_scope, patient_id, surface, viewed_at) SELECT $1,$2,$3,$4,$5,$6,$7,$8 WHERE NOT EXISTS (SELECT 1 FROM ward_flow.record_access WHERE workspace_id=$1 AND actor_id=$2 AND patient_id=$6 AND surface=$7 AND viewed_at > $9) AND (SELECT count(*) FROM ward_flow.record_access WHERE workspace_id=$1 AND actor_id=$2 AND viewed_at > $9) < $10",
          [
            workspaceId,
            view.actorId,
            view.membershipId ?? null,
            view.access.role,
            view.access.scope,
            patientId,
            surface,
            loggedAt,
            new Date(loggedAt.getTime() - VIEW_REPEAT_MS),
            VIEW_RATE_LIMIT,
          ],
        );
        return { status: 200, body: { logged: rowCount > 0 } };
      });
    },
    /**
     * The newest record openings, optionally for one patient. Only the statewide coordinator reads
     * them; the HTTP layer refuses everyone else before this runs.
     */
    async recordViews(view, patientId = null) {
      if (!(view.version >= RECORD_ACCESS_MIGRATION)) return [];
      const { rows } = await pool.query(
        `SELECT id, actor_id, actor_role, actor_scope, patient_id, surface, viewed_at FROM ward_flow.record_access WHERE workspace_id=$1 AND data_mode='prototype'${patientId ? " AND patient_id=$2" : ""} ORDER BY id DESC LIMIT ${VIEW_LIST_LIMIT}`,
        patientId ? [workspaceId, patientId] : [workspaceId],
      );
      return rows;
    },
    /**
     * Readiness review item 8: a sign-out ends the sign-in here at once, not when its token
     * expires. The row lasts as long as any token of that sign-in could still be accepted: the
     * session limit from when it began. Sign-outs past that are removed. Before migration 11 it
     * answers false and the sign-in ends when its token expires.
     */
    async signOutSession(actorId, sessionId, startedAt) {
      if ((await schemaVersion()) < RECORD_ACCESS_MIGRATION) return false;
      const at = clock();
      const limitMs = engine.SESSION_LIMIT_MINUTES * 60_000;
      const from = Number.isFinite(startedAt) ? Math.min(startedAt, at.getTime()) : at.getTime();
      const until = new Date(Math.max(from + limitMs, at.getTime() + 60_000));
      await pool.query(
        "INSERT INTO ward_flow.session_sign_outs(session_id, workspace_id, actor_id, signed_out_at, until) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (session_id) DO NOTHING",
        [sessionId, workspaceId, actorId, at, until],
      );
      await pool.query("DELETE FROM ward_flow.session_sign_outs WHERE workspace_id=$1 AND until < $2", [
        workspaceId,
        at,
      ]);
      return true;
    },
    /**
     * Whether this sign-in was signed out here. From migration 11 a sign-in with no session id
     * cannot be signed out, so it is refused too.
     */
    async sessionSignedOut(sessionId) {
      if ((await schemaVersion()) < RECORD_ACCESS_MIGRATION) return false;
      if (typeof sessionId !== "string") return true;
      const { rows } = await pool
        .query("SELECT 1 FROM ward_flow.session_sign_outs WHERE session_id=$1 LIMIT 1", [sessionId])
        .catch((error) => {
          forgetVersionOnMissing(error);
          throw error;
        });
      return rows.length > 0;
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
     * @param {{ revisionOnly?: boolean, view?: { status?: string, choices?: readonly unknown[], actorId?: string, version?: number, membershipId?: string | null, access?: { role: string, scope: Record<string, unknown> }, ownAccess?: { role: string, scope: Record<string, unknown> } | null, grants?: readonly { patientId: string, until: Date }[], recentGrant?: boolean } | null }} [options]
     */
    async command(actorId, commandId, expectedRevision, event, options = {}) {
      const { revisionOnly = false, view } = options;
      // A community sender's team is authenticated by the selected membership, not by the
      // browser-supplied label. Bind it before applying the event so scope can safely recognise
      // the sender as the owner of the referral later.
      if (
        view?.access?.role === "community" &&
        view.access.scope.kind === "team" &&
        event.type === "RECEIVE_REFERRAL"
      ) {
        event = { ...event, sendingTeamName: view.access.scope.teamName };
      }
      const supplied = event;
      event = engine.storableCommand(event);
      if (!engine.validCommand(event)) throw new Error("invalid-command");
      const demoRefused = !demoEvents && engine.demoOnlyCommand(event);
      const fingerprintOf = (value) =>
        createHash("sha256")
          .update(JSON.stringify(canonical({ expectedRevision, event: value })))
          .digest("hex");
      const fingerprint = fingerprintOf(event);
      // Audit F-01: a receipt written before file content was dropped was fingerprinted with it, so
      // an older tab retrying that same command still matches its receipt.
      const legacyFingerprint = supplied === event ? fingerprint : fingerprintOf(supplied);
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
          if (receipt.fingerprint !== fingerprint && receipt.fingerprint !== legacyFingerprint)
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
        let completion = {};
        let reason = row.core
          ? "Someone else changed this record first. Review the latest board before trying again."
          : "The workspace changed. Review the latest board before trying again.";
        let code = null;
        const priorRevision = Number(row.revision);
        // The sender's own role and place, checked before the revision, so a desk never learns
        // whether a record outside its place changed. A refusal can still show that an id
        // exists, because ids it cannot find fall through to the engine's own not-found reply.
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
        } else if (
          priorRevision === expectedRevision ||
          (row.core && expectedRevision > 0 && expectedRevision < priorRevision)
        ) {
          // From migration 10 a command sent against an older revision still applies to the
          // latest workspace, unless someone else has since changed a record it changes or names.
          const applied = engine.applyCommand(row.payload, event, at);
          const after = applied.outcome === "accepted" ? applied.world : row.payload;
          const stale =
            priorRevision !== expectedRevision &&
            conflicts({
              stored: row.stored,
              core: row.core,
              before: row.payload,
              after,
              event,
              expectedRevision,
              priorRevision,
            });
          if (!stale) {
            ({ outcome, changes, reason } = applied);
            completion = applied.completion ?? {};
            status = outcome === "accepted" ? 200 : 422;
          }
          if (!stale && outcome === "accepted") {
            const before = row.payload;
            row.revision = priorRevision + 1;
            row.payload = applied.world;
            await saveWorld(client, row, row.payload, row.revision, at);
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
          ...(outcome === "accepted" ? completion : {}),
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
