// @ts-check
import { archiveAfterCommit, commandTimer } from "./after-commit.mjs";
import { createHash } from "node:crypto";
import {
  ARCHIVE_MIGRATION,
  LATEST_MIGRATION,
  MINIMUM_RUNTIME_MIGRATION,
  RECORDS_MIGRATION,
  ROLE_ACCESS_MIGRATION,
} from "./migrations.mjs";
import { errorFields } from "./push.mjs";
import {
  assembleWorld,
  conflictingCollection,
  conflictRecordType,
  coveredRecords,
  jsonbTextByteLength,
  staleReason,
  markerKind,
  planSave,
  recordToken,
  splitWorld,
} from "./records.mjs";
import {
  ARCHIVE_PRESSURE_AFTER_MINUTES,
  SCOPED_REPLY_CACHE_ENTRIES,
  WORKSPACE_ALERT_EVERY_MS,
  WORKSPACE_PRESSURE_BYTES,
} from "./config.mjs";
import { logFailure } from "./error-report.mjs";
import { LruCache, registerPart } from "./reply-cache.mjs";
import { withoutRecordDetail } from "./record-detail.mjs";
import { forecastHistoryStore } from "./forecast-history.mjs";
import { accountPreferencesStore } from "./account-preferences.mjs";
import { deskAuditPage } from "./desk-audit.mjs";
import { ownCommandReceipt } from "./own-command-receipt.mjs";
import { canonical } from "./workspace-shared.mjs";
import { createPushDelivery, pushStore } from "./workspace-push.mjs";
import { createReviewAuthority } from "./workspace-review-authority.mjs";
import { accessStore, createViewer } from "./workspace-access.mjs";
import { recordViewsStore } from "./workspace-record-views.mjs";

// The store's areas live in workspace-*.mjs; these names stay exported from here.
export { singleFlight } from "./workspace-shared.mjs";
export { MAX_DELIVERY_ATTEMPTS } from "./workspace-push.mjs";

/** H-0291: the board would pass its size limit, so nothing was saved. A refusal, not a fault. */
export class WorkspaceTooLargeError extends Error {
  constructor() {
    super("Workspace too large");
    this.name = "WorkspaceTooLargeError";
  }
}
/** How long the schema version is trusted before it is read again. */
const VERSION_TRUSTED_MS = 60_000;
/** The most a whole workspace may hold, as before migration 10 split it into rows. */
const MAX_WORLD_BYTES = 8_388_608;
/** Past this a save logs a warning, well before the limit refuses every save (config.mjs). */
export const WARN_WORLD_BYTES = WORKSPACE_PRESSURE_BYTES;
/** The size warning is logged at most this often by one server. */
const SIZE_WARNING_EVERY_MS = 600_000;
/**
 * From migration 14, closed records are looked for once in this many saves, and on every save
 * (with the shorter window in config.mjs) once the workspace passes `WORKSPACE_PRESSURE_BYTES`.
 */
export const ARCHIVE_EVERY_REVISIONS = 20;
/** The newest archived records one desk reads for History. */
export const ARCHIVE_READ_LIMIT = 5000;
/** The archive reply's record hashes are 48 bits, summed modulo this so the sum stays exact. */
export const ARCHIVE_SUM_MODULUS = 2 ** 48;
const RECORD_COLUMNS = "collection, record_id, kind, ordinal, revision, body";
/**
 * A copy of `value` with object keys in PostgreSQL's jsonb order (shorter keys first, then by
 * bytes), so a record kept from a save reads back exactly as the database would send it.
 */
function jsonbOrdered(value) {
  if (Array.isArray(value)) return value.map(jsonbOrdered);
  if (!value || typeof value !== "object") return value;
  const keys = Object.keys(value).map((key) => ({ key, bytes: Buffer.from(key, "utf8") }));
  keys.sort((a, b) => a.bytes.length - b.bytes.length || Buffer.compare(a.bytes, b.bytes));
  return Object.fromEntries(keys.map(({ key }) => [key, jsonbOrdered(value[key])]));
}
/** Whether a stored workspace row stands in for rows of `ward_flow.workspace_records`. */
const hasMarkers = (payload) =>
  !!payload?.state &&
  typeof payload.state === "object" &&
  Object.values(payload.state).some((value) => markerKind(value));

/**
 * The UTF-8 byte size of a world as the database's jsonb text measures it, once per save (audits
 * PS-12, M162): the 8 MiB limit is the old `octet_length(payload::text)` CHECK on the whole world.
 */
const worldBytes = jsonbTextByteLength;

/**
 * The audit row's `changes` as stored. A reset or new scenario replaces the whole board, so the
 * engine names every audit entry of the new scenario as this command's domain audit (H-0642). The
 * permanent audit row keeps how many there were and their SHA-256 instead of the whole list; the
 * entries themselves are in the saved workspace and can be regenerated from the scenario.
 */
export function storedAuditChanges(changes) {
  if (!changes || changes.reset !== true || !Array.isArray(changes.domainAudit)) return changes;
  return {
    ...changes,
    domainAudit: {
      summary: true,
      count: changes.domainAudit.length,
      sha256: createHash("sha256").update(JSON.stringify(changes.domainAudit)).digest("hex"),
    },
  };
}
/** @typedef {import("./workspace-push.mjs").WorkspacePush} WorkspacePush */

/**
 * @param push Optional phone push from push.mjs `createPush`: `{ send, payload, coordinatorIds,
 *   maxPerAccount }`. `send(subscription, payload)` resolves `{ outcome }` as in push.mjs.
 *   Absent means the feature is off.
 * @param log Structured diagnostics: closed event names and push.mjs `errorFields` only.
 * @param deliveryWaitMs How long a command response waits for phone delivery before returning;
 *   delivery carries on in the background after that.
 * @param slowCommandMs P011: a command at least this slow logs its step timings (no patient data).
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
    push = /** @type {WorkspacePush | null} */ (null),
    log = (event) => console.error(JSON.stringify(event)),
    // The operator alert when the live workspace nears its limit: the backend error report.
    alert = logFailure,
    // The size thresholds from config.mjs; tests pass smaller ones.
    sizeLimits = {
      pressureBytes: WORKSPACE_PRESSURE_BYTES,
      pressureAfterMinutes: ARCHIVE_PRESSURE_AFTER_MINUTES,
      alertEveryMs: WORKSPACE_ALERT_EVERY_MS,
    },
    deliveryWaitMs = 1500,
    slowCommandMs = 500,
    retryAfterMs = 60_000,
    demoEvents = false,
    // M113: the bootstrap coordinators at a time (auth.mjs `bootstrapCoordinators`), so a
    // bootstrap account's archive and audit reads are re-checked under the lock as a membership
    // is. The HTTP server always passes it; the store's own tests may leave it out.
    bootstrapCoordinatorIds = /** @type {((atMs: number) => string[]) | null} */ (null),
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
  /**
   * Scoped boards this server built for full reads (audit PS-05), keyed by the committed workspace
   * row they came from (revision and update time), the workspace minute and everything the scoping
   * reads: the desk's role and place, and its break glass openings in workspace minutes. Two desks
   * share an entry only when the scoping rule gets identical inputs, so one desk's board is never
   * sent to another place. Entries are registered reply parts, so each is serialised and compressed
   * once (reply-cache.mjs). Like the record cache below, this is per process (audit PS-15).
   * @type {LruCache<{ payload: any, partial: any }>}
   */
  const scopedReplies = new LruCache(SCOPED_REPLY_CACHE_ENTRIES);
  /** The committed row whose scoped boards this cache currently holds. @type {string | null} */
  let scopedReplyStamp = null;
  // A read crossing an incompatible-row refusal must not repopulate this cache.
  let scopedReplyEpoch = 0;
  // Only a read entering this generation may replace it with a different committed row.
  let scopedReplyTicket = {};
  /** Full public reports only, from committed locked reads; never a candidate save. */
  const executiveReplies = new LruCache(SCOPED_REPLY_CACHE_ENTRIES);
  async function executiveSnapshot(connection, row, at, view, stamp) {
    const unavailable = () => new Error("Executive reporting is unavailable");
    const context = accessContext(at, view);
    const accessUntil = view?.accessUntil;
    if (
      !view?.membershipId ||
      typeof context.accessContext !== "string" ||
      !Number.isFinite(accessUntil) ||
      accessUntil <= clock().getTime()
    )
      throw new Error("role-ended");
    if (
      !connection ||
      known.version < ARCHIVE_MIGRATION ||
      !Number.isSafeInteger(row.archived) ||
      row.archived < 0 ||
      row.archived > ARCHIVE_READ_LIMIT ||
      typeof engine.executiveReport !== "function"
    )
      throw unavailable();
    const now = engine.worldNow(row.payload, at);
    const key =
      typeof stamp === "string"
        ? JSON.stringify([
            stamp,
            row.payload.state.worldGeneration,
            row.archived,
            now,
            view.actorId,
            context.accessContext,
            accessUntil,
          ])
        : null;
    let report = key ? executiveReplies.get(key) : undefined;
    if (!report) {
      // The same global retention window as History, before role scoping. A missing tail is
      // unavailable: it must never silently turn an older reporting week into zero.
      const { rows } = await connection.query(
        `SELECT collection, record_id, closed_at, body FROM ward_flow.archived_records WHERE workspace_id=$1 AND world_generation=$2 ORDER BY closed_at DESC, collection, record_id LIMIT ${ARCHIVE_READ_LIMIT}`,
        [workspaceId, row.payload.state.worldGeneration],
      );
      if (rows.length !== row.archived) throw unavailable();
      const state = { ...row.payload.state };
      const collections = new Set(engine.ARCHIVED_COLLECTIONS);
      const seen = new Set();
      for (const record of rows) {
        const identity = `${record.collection}\0${record.record_id}`;
        if (
          !collections.has(record.collection) ||
          !record.body ||
          record.body.id !== record.record_id ||
          !Number.isFinite(Number(record.closed_at)) ||
          seen.has(identity)
        )
          throw unavailable();
        seen.add(identity);
      }
      for (const collection of collections) {
        const live = state[collection];
        if (!Array.isArray(live)) throw unavailable();
        const liveIds = new Set(live.map((record) => record.id));
        state[collection] = [
          ...live,
          ...rows
            .filter((record) => record.collection === collection && !liveIds.has(record.record_id))
            .map((record) => record.body),
        ];
      }
      const world = { ...row.payload, state };
      if (!engine.validWorld(world)) throw unavailable();
      try {
        report = engine.executiveReport(world, view.access, at);
      } catch {
        throw unavailable();
      }
      if (report?.network?.asAt?.now !== now) throw unavailable();
      if (accessUntil <= clock().getTime()) throw new Error("role-ended");
      if (key) {
        registerPart(report);
        executiveReplies.set(key, report);
      }
    }
    // Projection is expensive. Membership must still be live when the result leaves the store.
    if (accessUntil <= clock().getTime()) throw new Error("role-ended");
    return {
      kind: "executive-aggregate",
      dataMode: "prototype",
      actorId: view.actorId,
      revision: Number(row.revision),
      ...context,
      accessUntil,
      now,
      report,
      demoControls: false,
    };
  }
  function scopedParts(row, at, view, senderView, stamp, entryTicket) {
    const reviewable = reviewIdsFor(row, row.payload, view, at);
    const build = () => ({
      partial: senderView ? engine.partialViewForWorld(row.payload, view.access, at, view.grants) : undefined,
      // H-0731: no desk is sent the detail no list shows; `logView` sends it for one opened record.
      payload: withoutRecordDetail(
        view ? engine.scopeWorld(row.payload, view.access, at, view.grants, reviewable) : row.payload,
      ),
    });
    if (typeof stamp !== "string") return build();
    // A different committed row replaces old boards; in-flight replies keep their own immutable parts.
    if (stamp !== scopedReplyStamp) {
      if (entryTicket !== scopedReplyTicket) {
        // A late read keeps its own reply parts without evicting a different current board.
        const parts = build();
        registerPart(parts.payload);
        if (parts.partial) registerPart(parts.partial);
        return parts;
      }
      scopedReplies.clear();
      scopedReplyStamp = stamp;
      scopedReplyTicket = {};
    }
    const wholeNetwork = !view || engine.wholeNetwork(view.access);
    const now = engine.worldNow(row.payload, at);
    const key = createHash("sha256")
      .update(
        JSON.stringify(
          canonical({
            stamp,
            // Statewide projection returns the world unchanged; only its reply clock moves.
            now: wholeNetwork ? null : now,
            senderView,
            reviewable,
            access: view ? view.access : null,
            // As the engine turns them into workspace minutes (engine.ts `worldGrants`).
            grants:
              view && !wholeNetwork
                ? (view.grants ?? []).map((grant) => [
                    grant.patientId,
                    now + Math.max(0, Math.ceil((new Date(grant.until).getTime() - at.getTime()) / 60_000)),
                  ])
                : null,
          }),
        ),
      )
      .digest("hex");
    let parts = scopedReplies.get(key);
    if (!parts) {
      parts = build();
      registerPart(parts.payload);
      if (parts.partial) registerPart(parts.partial);
      scopedReplies.set(key, parts);
    }
    return parts;
  }
  /**
   * The snapshot a desk is sent. `stamp` names the committed workspace row `row` was read from;
   * only a read path passes it, so a board built inside a save that might still roll back is
   * never kept for other requests. The payload may then be shared: no caller may change it.
   */
  const snapshot = async (
    row,
    at,
    view,
    stamp,
    connection = null,
    replyTicket = /** @type {object | undefined} */ (undefined),
  ) => {
    if (view?.access?.role === "executive") return executiveSnapshot(connection, row, at, view, stamp);
    const context = accessContext(at, view);
    const revision = Number(row.revision);
    const senderView =
      typeof context.accessContext === "string" &&
      (view?.access?.role === "ward" || view?.access?.role === "bed_manager");
    const parts = scopedParts(row, at, view, senderView, stamp, replyTicket);
    return {
      dataMode: row.data_mode,
      // Whether the demonstration controls work here for this desk, so the screens can say when they
      // do not. They are the statewide coordinator's alone (commandRefusal), so no other desk is told
      // they work (role access plan v2, D-80).
      demoControls: demoEvents && (!view?.access || engine.wholeNetwork(view.access)),
      revision,
      ...context,
      ...(view
        ? {
            accessUntil: Math.min(
              view.accessUntil ?? Infinity,
              ...(view.grants ?? []).map((grant) => new Date(grant.until).getTime()),
            ),
          }
        : {}),
      ...(senderView
        ? {
            partialView: {
              revision,
              accessContext: context.accessContext,
              view: parts.partial,
            },
          }
        : {}),
      payload: parts.payload,
      now: engine.worldNow(row.payload, at),
      // From migration 14: how many records this world generation has archived, so a desk reads the
      // archive again for History only when the number changes.
      ...(Number.isSafeInteger(row.archived) ? { archived: row.archived } : {}),
    };
  };
  /** The cutoff before which a role not used since switches off (synthetic, clinical values). */
  const unusedBefore = (at) => new Date(at.getTime() - engine.ACCESS_UNUSED_MINUTES * 60_000);
  // A role reads as ended 12 months after it was given, whatever end date it was stored with, so a
  // grant made before the ceiling was checked stops there too (RA-06). A whole number, so safe inline.
  const MAX_TERM = `interval '${Math.trunc(Number(engine.ACCESS_MAX_TERM_MINUTES))} minutes'`;
  let known = { version: 0, until: 0 };
  /**
   * The workspace records this server last read or saved (limits audit, 25 Oct 2026: reading the
   * whole board from the database on every save and refresh would use up Supabase's monthly data
   * allowance in about a day). `confirmed` is a state read from the database. `pending` is the
   * state a save of this server wrote, trusted only once the database shows that save committed.
   * Each is named by the workspace row's revision and update time. A matching workspace row needs
   * no record read; otherwise only records whose content changed since `confirmed` are sent. The
   * bodies here are never handed out: every reader gets its own copy.
   * @type {{ revision: number, updatedAt: number, rows: Map<string, any> } | null}
   */
  let confirmed = null;
  /** @type {{ revision: number, updatedAt: number, rows: Map<string, any> } | null} */
  let pending = null;
  const rowKey = (collection, recordId) => `${collection}\u0000${recordId}`;
  /** The cached state the workspace row names, promoting a committed save; null when none does. */
  function cachedState(revision, updatedAt) {
    const at = updatedAt instanceof Date ? updatedAt.getTime() : Number.NaN;
    // A restored database is not a delta from the future state this process read. A changed
    // stamp at the same revision is also a replacement, rather than an ordinary advancing save.
    // Forget candidates too: a later save can reuse their revision/time after the restoration.
    if (
      confirmed &&
      (Number(revision) < confirmed.revision || (Number(revision) === confirmed.revision && at !== confirmed.updatedAt))
    ) {
      confirmed = null;
      pending = null;
      scopedReplies.clear();
      executiveReplies.clear();
      archivedKnown = null;
      archiveHeld = null;
    }
    if (pending && pending.revision === Number(revision) && pending.updatedAt === at) confirmed = pending;
    // A save still committing is newer than this row; any other pending state never committed.
    if (!pending || pending.revision <= Number(revision)) pending = null;
    return confirmed && confirmed.revision === Number(revision) && confirmed.updatedAt === at ? confirmed : null;
  }
  /** Remembers `rows` as the state at this workspace row, and returns copies for the caller. */
  function remember(revision, updatedAt, rows, keep = true, copy = true) {
    if (keep && updatedAt instanceof Date)
      confirmed = {
        revision: Number(revision),
        updatedAt: updatedAt.getTime(),
        rows: new Map(rows.map((row) => [rowKey(row.collection, row.record_id), row])),
      };
    return copy ? copies(rows) : rows;
  }
  const copies = (rows) => rows.map((row) => ({ ...row, body: structuredClone(row.body) }));
  /**
   * Rows read with only the bodies changed since `confirmed` (`fresh`), completed from it. Null
   * when an unchanged row is missing there (a rollback put records back, say): read them all.
   */
  function completed(rows) {
    const out = [];
    for (const { fresh, ...row } of rows) {
      if (fresh) out.push(row);
      else {
        const kept = confirmed?.rows.get(rowKey(row.collection, row.record_id));
        if (!kept) return null;
        out.push({ ...row, body: kept.body });
      }
    }
    return out;
  }
  /** When this server last logged the workspace size warning, and last alerted the operator. */
  let sizeWarnedAt = -Infinity;
  let sizeAlertedAt = -Infinity;
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
    if (error?.code === "42P01" || error?.code === "42703") {
      known = { version: 0, until: 0 };
      // A rolled-back archive table may come back empty: count it again.
      archivedKnown = null;
    }
  }
  /**
   * One audit row's INSERT, naming the sender's role and place once migration 8 holds them. Its
   * placeholders start after `offset`, so a caller can write it in the same statement as another.
   */
  function auditInsert(view, actorId, row, offset = 0) {
    const values = [
      workspaceId,
      actorId,
      row.commandId ?? null,
      row.action,
      row.outcome,
      row.priorRevision,
      row.revision,
      storedAuditChanges(row.changes),
    ];
    const roles = view && view.version >= ROLE_ACCESS_MIGRATION;
    if (roles) values.push(view.access.role, view.access.scope);
    return {
      sql: `INSERT INTO ward_flow.audit(workspace_id, actor_id, command_id, action, outcome, prior_revision, revision, changes${roles ? ", actor_role, actor_scope" : ""}) VALUES (${values.map((_, index) => `$${offset + index + 1}`).join(",")})`,
      values,
    };
  }
  async function audit(client, view, actorId, row) {
    const { sql, values } = auditInsert(view, actorId, row);
    await client.query(sql, values);
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
      // An uncommitted candidate is never evidence for a later writer's matching revision/time.
      // Invalidate before awaiting rollback, including when COMMIT's reply itself was lost.
      pending = null;
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
   *
   * `copy: false` (read-only callers that never change the world, audit PS-05) shares the cached
   * record bodies instead of copying them. Such a read also names the committed row it came from
   * in `stamp` ("revision:updated-at"), which keys the scoped reply cache.
   */
  async function readWorld(connection, columns = "data_mode, revision, payload", { copy = true } = {}) {
    for (let attempt = 0; ; attempt += 1) {
      const records = known.version >= RECORDS_MIGRATION;
      // Records are sent only when the workspace row is not the cached one, and then only the
      // bodies changed since it (the limits audit). A second read sends them all if one is missing.
      const base = attempt === 0 ? (pending ?? confirmed) : null;
      const since = attempt === 0 ? (confirmed?.revision ?? -1) : -1;
      try {
        const { rows } = await connection.query(
          `SELECT ${columns}${records ? `, w.revision AS cache_revision, date_trunc('milliseconds', w.updated_at) AS cache_updated_at, CASE WHEN w.revision = $2 AND date_trunc('milliseconds', w.updated_at) = $3 THEN NULL ELSE (SELECT coalesce(jsonb_agg(jsonb_build_object('collection', r.collection, 'record_id', r.record_id, 'kind', r.kind, 'ordinal', r.ordinal, 'revision', r.revision, 'fresh', r.revision > $4, 'body', CASE WHEN r.revision > $4 THEN r.body END)), '[]'::jsonb) FROM ward_flow.workspace_records r WHERE r.workspace_id = w.id) END AS records` : ""} FROM ward_flow.workspaces w WHERE id=$1 AND data_mode='prototype'`,
          records ? [workspaceId, base?.revision ?? -1, base ? new Date(base.updatedAt) : null, since] : [workspaceId],
        );
        const row = rows[0];
        if (!row) return null;
        if (records) {
          const { cache_revision: revision, cache_updated_at: updatedAt, records: read, ...fields } = row;
          const cached = cachedState(revision, updatedAt);
          let stored;
          if (read === null && cached) stored = copy ? copies([...cached.rows.values()]) : [...cached.rows.values()];
          else {
            const whole = read && completed(read);
            if (!whole) {
              confirmed = null;
              if (attempt === 0) continue;
              throw new Error("Stored workspace records are incomplete");
            }
            stored = remember(revision, updatedAt, whole, true, copy);
          }
          const payload = assembleWorld(row.payload, stored);
          if (copy || !(updatedAt instanceof Date)) return { ...fields, payload };
          return { ...fields, payload, stamp: `${Number(revision)}:${updatedAt.getTime()}` };
        }
        if (attempt === 0 && hasMarkers(row.payload)) {
          known = { version: 0, until: 0 };
          if ((await schemaVersion()) >= RECORDS_MIGRATION) continue;
        }
        return row;
      } catch (error) {
        forgetVersionOnMissing(error);
        if (attempt === 0 && /** @type {{ code?: unknown } | null | undefined} */ (error)?.code === "42P01") continue;
        throw error;
      }
    }
  }
  /**
   * The workspace row under `lock` ("UPDATE" or "SHARE"), with its whole world in `payload`, the
   * stored workspace row in `core` and its records in `stored`. The records are read after the
   * lock is held, so a save that committed while this waited is never missed.
   */
  async function lockedWorld(client, mode, keep = true, { copy = true } = {}) {
    const { rows } = await client.query(
      `SELECT data_mode, revision, payload, date_trunc('milliseconds', updated_at) AS cache_updated_at FROM ward_flow.workspaces WHERE id=$1 AND data_mode='prototype' FOR ${mode}`,
      [workspaceId],
    );
    const found = rows[0];
    if (!found) return null;
    const { cache_updated_at: updatedAt, ...row } = found;
    if (!keepsRecords(row.payload)) return { ...row, core: null, stored: [] };
    // Under the lock no save can commit, so the cached state is exact when the row names it, and
    // otherwise only bodies changed since it are read (the limits audit, 25 Oct 2026).
    const cached = keep ? cachedState(row.revision, updatedAt) : null;
    let stored;
    if (cached) stored = copy ? copies([...cached.rows.values()]) : [...cached.rows.values()];
    else {
      const since = keep ? (confirmed?.revision ?? -1) : -1;
      const { rows: read } = await client.query(
        `SELECT ${RECORD_COLUMNS.replace("body", "CASE WHEN revision > $2 THEN body END AS body")}, revision > $2 AS fresh FROM ward_flow.workspace_records WHERE workspace_id=$1`,
        [workspaceId, since],
      );
      let whole = completed(read);
      if (!whole) {
        confirmed = null;
        ({ rows: whole } = await client.query(
          `SELECT ${RECORD_COLUMNS} FROM ward_flow.workspace_records WHERE workspace_id=$1`,
          [workspaceId],
        ));
      }
      // A read after this transaction's own writes (a new workspace) is never remembered: it may
      // still roll back.
      stored = remember(row.revision, updatedAt, whole, keep, copy);
    }
    // `cache`: the cached state `stored` was copied from, which a save here builds on.
    return {
      ...row,
      core: row.payload,
      stored,
      cache: keep ? confirmed : null,
      payload: assembleWorld(row.payload, stored),
      // Read-only callers (`copy: false`) key the scoped reply cache by the locked, committed row.
      ...(!copy && keep && updatedAt instanceof Date
        ? { stamp: `${Number(row.revision)}:${updatedAt.getTime()}` }
        : {}),
    };
  }
  /**
   * Saves `world` at `revision` over `row` from `lockedWorld`. From migration 10 only the records
   * whose content or place in a list changed are written, and each keeps the revision its content
   * last changed at; before 10 the whole world is the workspace row.
   * @param {number} [measured]
   */
  async function saveWorld(client, row, world, revision, at, measured = undefined) {
    if (!row.core) {
      await client.query("UPDATE ward_flow.workspaces SET revision=$2, payload=$3, updated_at=$4 WHERE id=$1", [
        workspaceId,
        revision,
        world,
        at,
      ]);
      return;
    }
    // Audit PS-12: the caller passes the size it already measured for the archive decision.
    const bytes = measured ?? worldBytes(world);
    if (bytes > WARN_WORLD_BYTES && at.getTime() - sizeWarnedAt >= SIZE_WARNING_EVERY_MS) {
      sizeWarnedAt = at.getTime();
      log({ event: "ward_backend_workspace_size_warning", bytes, limit: MAX_WORLD_BYTES });
    }
    // Audit PS-02: tell the operator, through the error report, while there is still room.
    if (bytes > sizeLimits.pressureBytes && at.getTime() - sizeAlertedAt >= sizeLimits.alertEveryMs) {
      sizeAlertedAt = at.getTime();
      try {
        alert({ event: "ward_backend_workspace_size_alert", errorName: "WorkspaceNearLimit" });
      } catch {
        // An alert must never cost the save.
      }
    }
    if (bytes > MAX_WORLD_BYTES) throw new WorkspaceTooLargeError();
    const plan = planSave(row.stored, world, revision, row.core);
    // One round trip under the workspace lock: the workspace row, the records gone and the
    // records changed are written by one statement, so they still commit or fail together.
    await writeRecords(client, plan, at, { revision, core: plan.core });
    pending = savedState(row, plan, revision, at);
  }
  /**
   * The records as this save leaves them, from the cached rows it started from; trusted once the
   * database shows the save committed (`cachedState`). Null when a row it kept is not cached.
   */
  function savedState(row, plan, revision, at) {
    if (!row.cache) return null;
    const rows = new Map();
    for (const kept of row.stored) {
      const key = rowKey(kept.collection, kept.record_id);
      const cached = row.cache.rows.get(key);
      if (!cached) return null;
      rows.set(key, cached);
    }
    for (const gone of plan.deletes) rows.delete(rowKey(gone.collection, gone.recordId));
    for (const part of plan.upserts)
      rows.set(rowKey(part.collection, part.recordId), {
        collection: part.collection,
        record_id: part.recordId,
        kind: part.kind,
        ordinal: part.ordinal,
        revision: String(part.revision),
        body: jsonbOrdered(part.body),
      });
    return { revision: Number(revision), updatedAt: at.getTime(), rows };
  }
  /**
   * From migration 14, moves this world's closed records older than 30 days into the archive table
   * (`engine.archiveClosed`), in the save's own transaction, and returns the smaller world. Each row
   * is written before the record leaves the workspace, so nothing is lost if the save fails. The
   * move has its own audit row naming each record moved, under the save that triggered it (GV-27).
   * `afterMinutes` is the shorter window used once the workspace is near its limit (audit PS-02).
   * Returns the world and how many archive rows this save added.
   * @param {number} [afterMinutes]
   */
  async function archiveOld(client, world, revision, at, view, actorId, afterMinutes = undefined) {
    const { world: kept, archived } = engine.archiveClosed(world, at, afterMinutes);
    if (!archived.length) return { world, inserted: 0 };
    const written = await client.query(
      "INSERT INTO ward_flow.archived_records(workspace_id, world_generation, collection, record_id, closed_at, body, archived_revision, archived_at) SELECT $1, $2, r.collection, r.record_id, r.closed_at, r.body, $3, $4 FROM jsonb_to_recordset($5::jsonb) AS r(collection text, record_id text, closed_at integer, body jsonb) ON CONFLICT DO NOTHING",
      [
        workspaceId,
        world.state.worldGeneration,
        revision,
        at,
        JSON.stringify(
          archived.map((record) => ({
            collection: record.collection,
            record_id: record.id,
            closed_at: record.closedAt,
            body: record.body,
          })),
        ),
      ],
    );
    await audit(client, view, actorId, {
      action: "ARCHIVE_CLOSED_RECORDS",
      outcome: "accepted",
      priorRevision: revision,
      revision,
      changes: {
        archived: archived.map((record) => ({ collection: record.collection, recordId: record.id })),
      },
    });
    return { world: kept, inserted: written?.rowCount ?? 0 };
  }
  /**
   * How many records this world generation has archived; `undefined` before migration 14 (as last
   * read) or when the count cannot be read, so a read never fails over the History extra. Inside a transaction
   * the count runs under a savepoint: a failed count (the table rolled back under a cached version)
   * must never abort the save it rides on, which would otherwise end in a silent rollback.
   * @param {((entry: { generation: number, revision: number, count: number }) => void) | null} [settle]
   */
  async function archivedCount(connection, world, revision, settle = null) {
    // The version this store last read, never a new read: the History count must not change when
    // the store notices a rollback.
    if (known.version < ARCHIVE_MIGRATION) return undefined;
    const cached = cachedArchiveCount(world, revision);
    if (cached !== undefined) return cached;
    const guarded = connection !== pool;
    if (guarded) await connection.query("SAVEPOINT archived_count");
    try {
      const { rows } = await connection.query(
        "SELECT count(*)::integer AS archived FROM ward_flow.archived_records WHERE workspace_id=$1 AND world_generation=$2",
        [workspaceId, world.state.worldGeneration],
      );
      if (guarded) await connection.query("RELEASE SAVEPOINT archived_count");
      const count = rows[0]?.archived ?? 0;
      const entry = { generation: world.state.worldGeneration, revision: Number(revision), count };
      // A count taken after this transaction's own archive rows is kept only once it commits.
      if (settle) settle(entry);
      else if (Number.isSafeInteger(entry.revision)) archivedKnown = entry;
      return count;
    } catch (error) {
      if (guarded) await connection.query("ROLLBACK TO SAVEPOINT archived_count");
      forgetVersionOnMissing(error);
      archivedKnown = null;
      return undefined;
    }
  }
  /**
   * Audit PS-11: the archive count this server last read or saved, for one world generation at one
   * workspace revision. Archive rows are only ever added, and only by a save, which moves the
   * revision under the workspace lock; so while the workspace row still shows that revision the
   * count is exact, and a revision moved by any server (this one or another) means a fresh count.
   * Per process, like the record cache (audit PS-15). No schema change is needed.
   * @type {{ generation: number, revision: number, count: number } | null}
   */
  let archivedKnown = null;
  /**
   * P011: the routine archive of a committed save, in its own short transaction. It moves records
   * only while the workspace is still at that save's revision, and saves the smaller world as the
   * next revision; otherwise it does nothing and the next eligible save archives instead.
   */
  async function archiveCommitted(actorId, view, revision) {
    return transaction(async (client, at) => {
      const row = await lock(client, actorId, at, view);
      if (!row.core || Number(row.revision) !== revision) return false;
      const next = revision + 1;
      const { world } = await archiveOld(client, row.payload, next, at, view, actorId);
      if (world === row.payload) return false;
      row.revision = next;
      row.payload = world;
      await saveWorld(client, row, world, next, at);
      return true;
    });
  }
  function cachedArchiveCount(world, revision) {
    if (known.version < ARCHIVE_MIGRATION || !archivedKnown) return undefined;
    return archivedKnown.generation === world?.state?.worldGeneration && archivedKnown.revision === Number(revision)
      ? archivedKnown.count
      : undefined;
  }
  /**
   * History's archive rows held in this process (audit PS-01): the newest `ARCHIVE_READ_LIMIT` of
   * one world generation, newest closed first, with how many there are and the newest revision
   * read. Rows are written once and never changed, and saves archive under the workspace lock in
   * revision order, so each read asks the database only for rows archived after `through`.
   * @type {{ generation: number, through: number, total: number, rows: Array<{ collection: string, id: string, closedAt: number, body: any, archivedRevision: number }> } | null}
   */
  let archiveHeld = null;
  /** @type {Promise<unknown>} One refresh at a time, so two reads never count the same rows twice. */
  let archiveRefresh = Promise.resolve();
  const archiveOrder = (a, b) =>
    b.closedAt - a.closedAt ||
    (a.collection < b.collection ? -1 : a.collection > b.collection ? 1 : 0) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  function heldArchive(generation, connection = pool) {
    const refresh = archiveRefresh.then(async () => {
      if (archiveHeld?.generation !== generation) archiveHeld = { generation, through: 0, total: 0, rows: [] };
      const held = /** @type {NonNullable<typeof archiveHeld>} */ (archiveHeld);
      const { rows } = await connection
        .query(
          'SELECT collection, record_id, closed_at, body, archived_revision, count(*) OVER ()::integer AS archived, max(archived_revision) OVER () AS through FROM ward_flow.archived_records WHERE workspace_id=$1 AND world_generation=$2 AND archived_revision > $3 ORDER BY closed_at DESC, collection COLLATE "C", record_id COLLATE "C" LIMIT $4',
          [workspaceId, generation, held.through, ARCHIVE_READ_LIMIT],
        )
        .catch((error) => {
          forgetVersionOnMissing(error);
          if (archiveHeld === held) archiveHeld = null;
          throw error;
        });
      if (!rows.length || archiveHeld !== held) return held;
      const fresh = rows.map((row) => ({
        collection: row.collection,
        id: row.record_id,
        closedAt: row.closed_at,
        body: row.body,
        archivedRevision: Number(row.archived_revision) || 0,
      }));
      const keys = new Set(fresh.map((row) => `${row.collection}\0${row.id}`));
      archiveHeld = {
        generation,
        through: Math.max(held.through, Number(rows[0].through) || 0),
        total: held.total + (rows[0].archived ?? rows.length),
        rows: [...held.rows.filter((row) => !keys.has(`${row.collection}\0${row.id}`)), ...fresh]
          .sort(archiveOrder)
          .slice(0, ARCHIVE_READ_LIMIT),
      };
      return archiveHeld;
    });
    archiveRefresh = refresh.catch(() => {});
    return refresh;
  }
  /**
   * Writes a save plan's records and, with `workspace`, the workspace row too, in one statement:
   * each earlier step is a data-modifying WITH, which PostgreSQL always runs to completion with
   * the statement, so the writes commit or fail together. A plan's deletes and upserts never
   * name the same record (planSave), so no row is changed twice in the one statement.
   * @param {{ revision: number, core: any }} [workspace]
   */
  async function writeRecords(client, plan, at, workspace = undefined) {
    // Each step keeps its own placeholders, in the order it had as a statement of its own.
    const values = [workspaceId];
    const param = (value) => `$${values.push(value)}`;
    const steps = [];
    if (workspace)
      steps.push(
        `UPDATE ward_flow.workspaces SET revision=${param(workspace.revision)}, payload=${param(workspace.core)}, updated_at=${param(at)} WHERE id=$1`,
      );
    if (plan.deletes.length)
      steps.push(
        `DELETE FROM ward_flow.workspace_records WHERE workspace_id=$1 AND (collection, record_id) IN (SELECT * FROM unnest(${param(plan.deletes.map((row) => row.collection))}::text[], ${param(plan.deletes.map((row) => row.recordId))}::text[]))`,
      );
    if (plan.upserts.length) {
      const rows = param(
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
      );
      steps.push(
        `INSERT INTO ward_flow.workspace_records(workspace_id, collection, record_id, kind, ordinal, revision, body, updated_at) SELECT $1, r.collection, r.record_id, r.kind, r.ordinal, r.revision, r.body, ${param(at)} FROM jsonb_to_recordset(${rows}::jsonb) AS r(collection text, record_id text, kind text, ordinal integer, revision bigint, body jsonb) ON CONFLICT (workspace_id, collection, record_id) DO UPDATE SET kind=EXCLUDED.kind, ordinal=EXCLUDED.ordinal, body=EXCLUDED.body, updated_at=CASE WHEN ward_flow.workspace_records.revision = EXCLUDED.revision THEN ward_flow.workspace_records.updated_at ELSE EXCLUDED.updated_at END, revision=EXCLUDED.revision`,
      );
    }
    const last = steps.pop();
    if (!last) return;
    await client.query(
      steps.length ? `WITH ${steps.map((step, index) => `step${index} AS (${step})`).join(", ")} ${last}` : last,
      values,
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
      row = await lockedWorld(client, "UPDATE", false);
    }
    at.setTime(clock().getTime());
    const refusal =
      row?.data_mode !== "prototype"
        ? "Workspace data mode mismatch"
        : engine.validWorld(row.payload)
          ? null
          : "Stored workspace is incompatible";
    if (refusal) {
      // Incident 4 Nov 2026: the cached rows can be what made this world invalid (read part way
      // through a hand edit, or corrected later without a revision bump), and a cache hit would
      // serve them until a restart. Forget them, so the next request reads every row again.
      confirmed = null;
      pending = null;
      scopedReplies.clear();
      scopedReplyStamp = null;
      scopedReplyEpoch += 1;
      throw new Error(refusal);
    }
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
  async function read(actorId, view) {
    const replyEpoch = scopedReplyEpoch;
    const replyTicket = scopedReplyTicket;
    if (view?.access?.role === "executive" && !view.membershipId) throw new Error("role-ended");
    if (view?.membershipId) return scopedRead(actorId, view);
    const at = clock();
    // Read only: the cached record bodies are shared, not copied (audit PS-05).
    const stored = await readWorld(pool, undefined, { copy: false });
    if (stored && engine.validWorld(stored.payload)) {
      stored.archived = await archivedCount(pool, stored.payload, stored.revision);
      await prepareReviewAuthority(pool, stored, view);
      return snapshot(stored, at, view, replyEpoch === scopedReplyEpoch ? stored.stamp : undefined, null, replyTicket);
    }
    return transaction(async (client, now) => {
      const row = await lock(client, actorId, now, view);
      row.archived = await archivedCount(client, row.payload, row.revision);
      await prepareReviewAuthority(client, row, view);
      return snapshot(row, now, view, undefined, client);
    });
  }
  /**
   * A member's full snapshot, with the role and covers resolved again under a share lock on the
   * workspace row. Access changes hold that row FOR UPDATE, so a revocation either commits before
   * this resolve (and the poll is refused) or waits until the reply is built. Polls do not block
   * one another. An uninitialised or incompatible workspace falls back to the locked write path.
   */
  async function scopedRead(actorId, view) {
    const replyEpoch = scopedReplyEpoch;
    const replyTicket = scopedReplyTicket;
    const version = await schemaVersion();
    const ready = await transaction(async (client, at) => {
      const row = await lockedWorld(client, "SHARE", true, { copy: false });
      if (!row || !engine.validWorld(row.payload)) return null;
      at.setTime(clock().getTime());
      const current = await resolveViewer(actorId, { workingAs: view.membershipId }, client, at, version);
      if (current.status !== "ok") throw new Error("role-ended");
      // The HTTP reply uses this request's view for its access metadata too.
      Object.assign(view, current);
      row.archived = await archivedCount(client, row.payload, row.revision);
      await prepareReviewAuthority(client, row, current);
      return snapshot(row, at, current, replyEpoch === scopedReplyEpoch ? row.stamp : undefined, client, replyTicket);
    });
    if (ready) return ready;
    const current = await viewer(actorId, { workingAs: view.membershipId });
    if (current.status !== "ok") throw new Error("role-ended");
    return transaction(async (client, now) => {
      const row = await lock(client, actorId, now, current);
      Object.assign(view, current);
      row.archived = await archivedCount(client, row.payload, row.revision);
      await prepareReviewAuthority(client, row, current);
      return snapshot(row, now, current, undefined, client);
    });
  }
  /** A signed-in bootstrap coordinator's view (no membership), once the server names the list. */
  const bootstrapView = (view) =>
    bootstrapCoordinatorIds !== null && typeof view?.actorId === "string" && !view.membershipId;
  /** Detail/history reads share the same authority boundary as a full scoped snapshot. */
  async function currentRecordRead(view, send, recordAccess = false) {
    return transaction(async (client, at) => {
      const row = await lockedWorld(client, "SHARE", true, { copy: false });
      if (recordAccess)
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1 || ':' || $2 || ':record-access'))", [
          workspaceId,
          view.actorId,
        ]);
      // A role/cover may end while either lock is awaited. Resolve after both, not from the
      // handler's initial view or the transaction's earlier clock value.
      at.setTime(clock().getTime());
      let current = view;
      if (view?.membershipId) {
        current = await resolveViewer(view.actorId, { workingAs: view.membershipId }, client, at, view.version);
        if (current.status !== "ok") throw new Error("role-ended");
        Object.assign(view, current);
      } else if (bootstrapView(view) && !bootstrapCoordinatorIds?.(at.getTime()).includes(view.actorId))
        // M113: a bootstrap account past its end date, or taken off the list, stops here too.
        throw new Error("role-ended");
      return send(client, at, current, row);
    });
  }
  const { viewer, resolveViewer } = createViewer({
    pool,
    workspaceId,
    engine,
    clock,
    schemaVersion,
    forgetVersionOnMissing,
    unusedBefore,
    MAX_TERM,
  });
  const { recordsInPlace, prepareReviewAuthority, reviewIdsFor, breakGlassReviewRefusal } = createReviewAuthority({
    pool,
    workspaceId,
    engine,
    readWorld,
  });
  const { evaluatePush, deliver, deliverOnce } = createPushDelivery({
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
  });
  const accessMethods = accessStore({
    pool,
    workspaceId,
    engine,
    clock,
    schemaVersion,
    forgetVersionOnMissing,
    transaction,
    lock,
    audit,
    read,
    snapshot,
    prepareReviewAuthority,
    unusedBefore,
    MAX_TERM,
  });
  const { auditPage, ...recordViewMethods } = recordViewsStore({
    pool,
    workspaceId,
    engine,
    clock,
    forgetVersionOnMissing,
    transaction,
    read,
    readWorld,
    currentRecordRead,
    recordsInPlace,
  });
  const store = {
    pushEnabled: !!push,
    async ready() {
      const { rows } = await pool.query("SELECT max(version) AS version FROM ward_flow.migrations");
      const version = rows[0]?.version;
      if (!Number.isInteger(version) || version < MINIMUM_RUNTIME_MIGRATION || version > LATEST_MIGRATION)
        throw new Error("Shared schema unavailable");
    },
    ...pushStore({ pool, workspaceId, push, schemaVersion, transaction, lock }),
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
      await deliverOnce();
    },
    read,
    /**
     * The 3 second poll. When the workspace is still at `knownRevision`, returns only the revision
     * and the world clock (read from two small fields, so the whole record is not sent or checked);
     * otherwise the full snapshot, as `read` does. A member desk also names its `knownContext`, and
     * gets the cheap answer only while that still matches; its browser reads in full every minute,
     * because what a desk may see also changes with time (hand-off windows).
     * @param {any} actorId
     * @param {any} knownRevision
     * @param {any} [view]
     * @param {string | null} [knownContext]
     */
    async poll(actorId, knownRevision, view, knownContext = null) {
      if (view?.access?.role === "executive") return { notModified: false, snapshot: await read(actorId, view) };
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
    // Migration 17: each signed-in account's Help memory.
    ...accountPreferencesStore({ pool, workspaceId, schemaVersion, forgetVersionOnMissing }),
    // Proposal 013 (migration 16): each desk's shared forecast snapshots and miss reasons.
    ...forecastHistoryStore({
      pool,
      workspaceId,
      schemaVersion,
      worldGeneration: async () => {
        const stored = await readWorld(pool);
        return stored && engine.validWorld(stored.payload) ? stored.payload.state.worldGeneration : null;
      },
      forgetVersionOnMissing,
    }),
    /**
     * History's archived records (migration 14): the newest `ARCHIVE_READ_LIMIT` of this world
     * generation, newest closed first, narrowed by the desk's place exactly as its live workspace is
     * (`engine.scopeArchive`). Before 14 there is no archive and the list is empty. With `since`,
     * only the records archived after that revision are sent (audit PS-01).
     * @param {any} view
     * @param {number} [since]
     * @returns {Promise<{ archived: number, records: any[], through?: number, sum?: string, since?: number, floor?: Array<number | string>, revision?: number, partialView?: { revision: number, accessContext: string, view: any } }>}
     */
    async archive(view, since) {
      if (view?.access?.role === "executive") throw new Error("Executive reporting does not include record access");
      if ((await schemaVersion()) < ARCHIVE_MIGRATION) {
        archiveHeld = null;
        return { archived: 0, records: [] };
      }
      const send = async (connection, at, current, stored) => {
        if (current?.access?.role === "executive")
          throw new Error("Executive reporting does not include record access");
        if (!stored || !engine.validWorld(stored.payload)) return { archived: 0, records: [] };
        const held = await heldArchive(stored.payload.state.worldGeneration, connection);
        const records = held.rows;
        const shown = current
          ? engine.scopeArchive(stored.payload, records, current.access, at, current.grants)
          : records;
        // Audit PS-01: each record carries a short hash of the copy this desk is shown, and the reply
        // the sum of them all. A desk that already holds the archive names the revision it holds
        // (`since`) and is sent only the records archived after it; it keeps the rest, drops what
        // falls below `floor`, and checks the sum. Any mismatch (its place, a break glass record or a
        // masking rule changed) and it reads the whole archive again, so it never keeps a stale copy.
        let sum = 0;
        const hashed = shown.map((record) => {
          const hash = createHash("sha256")
            .update(`${record.collection}\0${record.id}\0${JSON.stringify(record.body)}`)
            .digest("hex")
            .slice(0, 12);
          sum = (sum + Number.parseInt(hash, 16)) % ARCHIVE_SUM_MODULUS;
          return { record, hash };
        });
        const partial = typeof since === "number" && Number.isSafeInteger(since) && since >= 0 && since <= held.through;
        // A retention marker must not disclose a record outside this desk.
        // Checksum mismatch already forces a full reread when no authorised floor remains.
        const last = held.total > records.length ? shown.at(-1) : undefined;
        // The sender progress for the archived records shown, worked out here from the full stored
        // records (never from the masked copies sent below) and bound to this desk's access view and
        // the revision it was worked out at, as the live snapshot's is. Ward and bed manager desks only.
        const context = accessContext(at, current);
        const senderView =
          typeof context.accessContext === "string" &&
          (current?.access?.role === "ward" || current?.access?.role === "bed_manager");
        return {
          archived: held.total,
          through: held.through,
          sum: sum.toString(16).padStart(12, "0"),
          ...(partial ? { since } : {}),
          ...(last ? { floor: [last.closedAt, last.collection, last.id] } : {}),
          records: hashed
            .filter(({ record }) => !partial || record.archivedRevision > /** @type {number} */ (since))
            .map(({ record, hash }) => ({
              collection: record.collection,
              body: record.body,
              closedAt: record.closedAt,
              hash,
            })),
          ...(senderView
            ? {
                revision: Number(stored.revision),
                partialView: {
                  revision: Number(stored.revision),
                  accessContext: context.accessContext,
                  view: engine.archivePartialViewForWorld(stored.payload, records, current.access, at, current.grants),
                },
              }
            : {}),
        };
      };
      // Every queued archive refresh already owns its connection. A bootstrap refresh
      // must not wait for a pool slot held by scoped readers queued behind that refresh.
      return currentRecordRead(view, send);
    },
    // Roles, cover, requests for access, sign-outs and break glass (workspace-access.mjs).
    ...accessMethods,
    /**
     * The newest audit rows. The statewide coordinator reads them all, break glass included. An
     * access admin reads only role changes inside their own place, never which patient was opened.
     * The HTTP layer refuses everyone else before this runs.
     */
    auditPage,
    /** P056: a desk's Activity, the kind and time of changes made inside its own place (desk-audit.mjs). */
    deskAuditPage: (view, cursor = null) =>
      deskAuditPage({
        pool,
        workspaceId,
        engine,
        view,
        cursor,
        minimumVersion: ROLE_ACCESS_MIGRATION,
        readPayload: async () => (await readWorld(pool, "payload"))?.payload,
      }),
    // Legacy callers keep their array result; HTTP uses auditPage's explicit continuation.
    async audit(view, cursor = null) {
      return (await store.auditPage(view, cursor)).events;
    },
    /** Receipt lookup reveals only the authenticated actor's outcome, never stored request text.
     * @param {string} actorId @param {string} commandId @param {any} [view]
     */
    async receipt(actorId, commandId, view = null) {
      const { rows } = await pool.query(
        "SELECT status, result FROM ward_flow.commands WHERE workspace_id=$1 AND actor_id=$2 AND command_id=$3",
        [workspaceId, actorId, commandId],
      );
      return ownCommandReceipt(
        rows[0],
        view?.access?.role === "executive" ? null : accessContext(clock(), view).accessContext,
        !!view && view.actorId === actorId,
      );
    },
    /** Granting access, cover or breaking glass needs a sign-in this recent. */
    stepUpMinutes: engine.STEP_UP_MINUTES,
    /** A sign-in older than this is refused, so the person signs in again (ISM-0428). */
    sessionLimitMinutes: engine.SESSION_LIMIT_MINUTES,
    // Record openings, list reads and the coordinator's review lists (workspace-record-views.mjs).
    ...recordViewMethods,
    /**
     * `options.revisionOnly`: an accepted command (or a replay still authorised in the same desk)
     * answers without the snapshot.
     * The client asks for this when more of its commands are queued, and reads the board once at
     * the end. A refused, stale or access-changed replay carries the current snapshot. `options.view` is the
     * sender's desk from `viewer()`: the command is checked against its role and place, and the
     * reply carries only its part of the workspace. `options.seen` maps record tokens to the later
     * revision the sender has seen each at (CS-19 follow-up, `conflicts` in records.mjs); an
     * accepted reply names the records it checked as `covered`.
     * @param {{ revisionOnly?: boolean, seen?: Record<string, number> | null, view?: { status?: string, choices?: readonly unknown[], actorId?: string, version?: number, membershipId?: string | null, accessUntil?: number, access?: { role: string, scope: Record<string, unknown> }, ownAccess?: { role: string, scope: Record<string, unknown> } | null, grants?: readonly { patientId: string, until: Date }[], recentGrant?: boolean } | null }} [options]
     */
    async command(actorId, commandId, expectedRevision, event, options = {}) {
      const { revisionOnly = false, view, seen = null } = options;
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
      // Decision 41 (Josh, 31 Oct 2026): a ward's handover sign-off names its ward. A one-ward desk's
      // ward comes from its membership, as the team does above; a desk working several wards must
      // name one, and commandRefusal keeps it to the desk's own wards.
      if (
        view?.access?.role === "ward" &&
        view.access.scope.kind === "ward" &&
        Array.isArray(view.access.scope.unitIds) &&
        view.access.scope.unitIds.length === 1 &&
        (event?.type === "RECORD_HANDOVER_SIGN_OFF" || event?.type === "UNDO_HANDOVER_SIGN_OFF") &&
        event.unitId === undefined
      ) {
        event = { ...event, unitId: view.access.scope.unitIds[0] };
      }
      const supplied = event;
      const storable = engine.storableCommand(event);
      // H-0694, H-0179: a whole-network desk is recorded under its own role, never the screen's.
      event = view?.access ? engine.deskCommand(view.access, storable) : storable;
      // Audit E-06: a guard refusal is a refusal with its reason, like any other, not a bad request.
      const privacyRefusal = engine.privacyRefusal(event);
      if (!privacyRefusal && !engine.validCommand(event)) throw new Error("invalid-command");
      const demoRefused = !demoEvents && engine.demoOnlyCommand(event);
      const fingerprintOf = (value) =>
        createHash("sha256")
          .update(JSON.stringify(canonical({ expectedRevision, event: value, ...(seen ? { seen } : {}) })))
          .digest("hex");
      const fingerprint = fingerprintOf(event);
      // Audit F-01: a receipt written before file content was dropped was fingerprinted with it, so
      // an older tab retrying that same command still matches its receipt.
      const legacyFingerprint = supplied === event ? fingerprint : fingerprintOf(supplied);
      // A receipt written before the desk role was stamped holds the stored, unstamped command.
      const unstampedFingerprint = storable === event ? fingerprint : fingerprintOf(storable);
      let queued = false;
      /** The archive count this save leaves, kept for later reads once the save commits (PS-11). */
      let archiveSettled = null;
      /** P011: a routine archive this save found due, run once it has committed. */
      let archiveDue = null;
      const commandTiming = commandTimer();
      const response = await transaction(async (client, at) => {
        queued = false;
        archiveSettled = null;
        archiveDue = null;
        commandTiming.skip();
        const row = await lock(client, actorId, at, view);
        commandTiming.lap("lock");
        await prepareReviewAuthority(client, row, view, event);
        const previous = await client.query(
          "SELECT fingerprint, status, result FROM ward_flow.commands WHERE workspace_id=$1 AND actor_id=$2 AND command_id=$3",
          [workspaceId, actorId, commandId],
        );
        if (previous.rowCount) {
          row.archived = await archivedCount(client, row.payload, row.revision);
          const receipt = previous.rows[0];
          if (![fingerprint, legacyFingerprint, unstampedFingerprint].includes(receipt.fingerprint))
            return {
              status: 422,
              body: {
                error: "Command ID was already used for a different request",
                snapshot: await snapshot(row, at, view, undefined, client),
              },
            };
          // A receipt confirms what already happened; it cannot lend the desk its earlier access.
          // Context includes the selected membership, joined cover and active record openings.
          // Permission alone is insufficient: a still-visible target may have wider related details
          // in its old partial-referral reason, checked records or Undo completion. Legacy receipts
          // have no provenance, so their details cannot safely be attributed to this desk either.
          const { receiptAccessContext, ...recordedResult } = receipt.result;
          const sameAccess =
            Object.hasOwn(receipt.result, "receiptAccessContext") &&
            receiptAccessContext === (accessContext(at, view).accessContext ?? null);
          const detailsAllowed =
            view?.access?.role !== "executive" &&
            sameAccess &&
            (!view ||
              (!engine.commandRefusal(
                row.payload,
                view.access,
                event,
                at,
                view.grants,
                reviewIdsFor(row, row.payload, view, at),
              ) &&
                !breakGlassReviewRefusal(row, view, event, at)));
          // A command can create related records whose ids were absent from the request. Those
          // records may later move outside this unchanged desk while the original request remains
          // permitted (for example, moving a new planned booking to another service). Checked
          // record tokens must therefore name only records still in the desk's current projection.
          let replaySnapshot;
          if (detailsAllowed && Array.isArray(recordedResult.covered)) {
            replaySnapshot = await snapshot(row, at, view, undefined, client);
            if (!("payload" in replaySnapshot)) throw new Error("Executive reporting is unavailable");
            const visible = new Set([...splitWorld(replaySnapshot.payload).parts.keys()].map(recordToken));
            recordedResult.covered = recordedResult.covered.filter((token) => visible.has(token));
          }
          const replayResult = detailsAllowed
            ? recordedResult
            : {
                outcome: recordedResult.outcome,
                commandRevision: recordedResult.commandRevision,
                ...(receipt.status !== 200
                  ? {
                      error: "This earlier command was not applied. Its details are unavailable in your current role.",
                    }
                  : recordedResult.outcome === "partly"
                    ? {
                        error:
                          "Part of this change was saved. The remaining details are unavailable in your current role.",
                      }
                    : {}),
              };
          return {
            status: receipt.status,
            body: {
              ...replayResult,
              replayed: true,
              ...(detailsAllowed && revisionOnly && receipt.status === 200
                ? {}
                : { snapshot: replaySnapshot ?? (await snapshot(row, at, view, undefined, client)) }),
            },
          };
        }
        let outcome = "stale";
        let status = 409;
        let changes = {};
        let completion = {};
        let reason = row.core
          ? "Another desk changed this record first. Review the latest board before trying again."
          : "The workspace changed. Review the latest board before trying again.";
        let code = null;
        let recordType = null;
        let partly = null;
        let covered = null;
        const priorRevision = Number(row.revision);
        const archivedBefore = cachedArchiveCount(row.payload, priorRevision);
        const generationBefore = row.payload.state.worldGeneration;
        let archivedRows = 0;
        // The sender's own role and place, checked before the revision, so a desk never learns
        // whether a record outside its place changed. A refusal can still show that an id
        // exists, because ids it cannot find fall through to the engine's own not-found reply.
        const scopeRefusal = view
          ? (engine.commandRefusal(
              row.payload,
              view.access,
              event,
              at,
              view.grants,
              reviewIdsFor(row, row.payload, view, at),
            ) ?? breakGlassReviewRefusal(row, view, event, at))
          : null;
        if (privacyRefusal) {
          outcome = "denied";
          status = 422;
          reason = privacyRefusal;
        } else if (scopeRefusal) {
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
          const clash =
            priorRevision === expectedRevision
              ? null
              : conflictingCollection({
                  stored: row.stored,
                  core: row.core,
                  before: row.payload,
                  after,
                  event,
                  expectedRevision,
                  priorRevision,
                  seen,
                });
          const stale = clash !== null;
          // P058: the reply names the record type only, never a patient, bed or record id.
          if (stale) reason = staleReason(clash);
          if (stale) recordType = conflictRecordType(clash);
          if (!stale) {
            ({ outcome, changes, reason } = applied);
            partly = applied.partly ?? null;
            completion = applied.completion ?? {};
            status = outcome === "accepted" ? 200 : 422;
          }
          if (!stale && outcome === "accepted") {
            const before = row.payload;
            // CS-19 follow-up: the records this save checked, so the sender's open popups can say
            // they have seen them at this revision.
            // Only records the sender's own view shows: a side effect outside its place stays unnamed.
            if (row.core) {
              const worlds = [before, applied.world];
              const scoped = view
                ? worlds.map((world) =>
                    engine.scopeWorld(world, view.access, at, view.grants, reviewIdsFor(row, world, view, at)),
                  )
                : worlds;
              const visible = scoped.every((world, index) => world === worlds[index]) ? null : scoped;
              covered = coveredRecords({
                core: row.core,
                before,
                after: applied.world,
                event,
                visible: /** @type {any} */ (visible),
              });
            }
            commandTiming.lap("apply");
            row.revision = priorRevision + 1;
            row.payload = applied.world;
            // Josh, 25 Oct 2026: closed records older than 30 days leave the live workspace, looked
            // for every few saves and on every save once the workspace passes the size warning, so
            // a workspace near its limit is never stuck waiting for a round revision it cannot reach.
            // Josh, 26 Oct 2026 (audit PS-02): past that size the window is shorter (config.mjs).
            // The size is measured once here and handed to saveWorld (audit PS-12).
            let bytes = row.core ? worldBytes(row.payload) : undefined;
            const pressed = bytes !== undefined && bytes > sizeLimits.pressureBytes;
            if (
              row.core &&
              (row.revision % ARCHIVE_EVERY_REVISIONS === 0 || pressed) &&
              (await schemaVersion()) >= ARCHIVE_MIGRATION
            ) {
              // P011 (Josh, 10:12 PM AWST): a routine archive waits until this save has committed;
              // one forced by size still runs here, so this save itself stays under the limit.
              if (!pressed) archiveDue = { revision: row.revision };
              const archiving = !pressed
                ? { world: row.payload, inserted: 0 }
                : await archiveOld(
                    client,
                    row.payload,
                    row.revision,
                    at,
                    view,
                    actorId,
                    pressed ? sizeLimits.pressureAfterMinutes : undefined,
                  );
              archivedRows = archiving.inserted;
              if (archiving.world !== row.payload) {
                row.payload = archiving.world;
                bytes = worldBytes(row.payload);
              }
            }
            commandTiming.lap("archive");
            await saveWorld(client, row, row.payload, row.revision, at, bytes);
            commandTiming.lap("save");
            if (push) {
              // Phone push must never cost the coordinator their change: an evaluation error rolls
              // back to here, is logged, and the command still commits. A savepoint left open is
              // released by COMMIT, so a successful check costs no RELEASE round trip.
              await client.query("SAVEPOINT push_evaluation");
              try {
                queued = await evaluatePush(client, row.payload, before, at, actorId);
              } catch (error) {
                await client.query("ROLLBACK TO SAVEPOINT push_evaluation");
                queued = false;
                log({ event: "ward_backend_push_evaluation_failure", ...errorFields(error) });
              }
              commandTiming.lap("push");
            }
          }
        }
        // Audit E-05: a partly refused "Refer to wards" is saved and audited as accepted (the audit
        // row's domain audit holds each ward's outcome); the sender is told which ward was held back.
        const result = {
          outcome: outcome === "accepted" && partly ? "partly" : outcome,
          commandRevision: Number(row.revision),
          ...(outcome === "accepted" ? completion : {}),
          ...(reason ? { error: reason } : outcome === "accepted" && partly ? { error: partly } : {}),
          ...(code ? { code } : {}),
          ...(outcome === "stale" ? { code: "stale", recordType: recordType ?? "record" } : {}),
          ...(covered?.length ? { covered } : {}),
        };
        // The command's audit row and its receipt go in one statement (one round trip under the
        // workspace lock): a data-modifying WITH always runs with its statement, so both are
        // written or neither is, and a failed receipt still rolls back the whole save.
        const audited = auditInsert(
          view,
          actorId,
          { commandId, action: event.type, outcome, priorRevision, revision: row.revision, changes },
          6,
        );
        await client.query(
          `WITH audited AS (${audited.sql}) INSERT INTO ward_flow.commands(workspace_id, actor_id, command_id, fingerprint, status, result) VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            workspaceId,
            actorId,
            commandId,
            fingerprint,
            status,
            {
              ...result,
              receiptAccessContext: accessContext(at, view).accessContext ?? null,
            },
            ...audited.values,
          ],
        );
        const settle = (entry) => {
          archiveSettled = entry;
        };
        if (
          Number(row.revision) !== priorRevision &&
          archivedBefore !== undefined &&
          row.payload.state.worldGeneration === generationBefore
        ) {
          // Audit PS-11: the count before this save plus the rows it added, with no count query.
          row.archived = archivedBefore + archivedRows;
          settle({ generation: generationBefore, revision: Number(row.revision), count: row.archived });
        } else if (!(revisionOnly && status === 200))
          row.archived = await archivedCount(client, row.payload, row.revision, settle);
        return {
          status,
          body: {
            ...result,
            ...(revisionOnly && status === 200 ? {} : { snapshot: await snapshot(row, at, view, undefined, client) }),
          },
        };
      });
      commandTiming.lap("commit");
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
        commandTiming.lap("deliver");
      }
      // Committed: later reads at this revision can use the count without asking the database.
      if (archiveSettled && known.version >= ARCHIVE_MIGRATION) archivedKnown = archiveSettled;
      // P011: never undoes the committed save; a failure is logged and the next eligible save retries.
      const archived = await archiveAfterCommit({
        due: archiveDue,
        log,
        errorFields,
        run: (revision) => archiveCommitted(actorId, view, revision),
      });
      if (archived === "archived") archivedKnown = null;
      if (archived !== "none") commandTiming.lap("archiveAfter");
      // P011 slice A: only a slow command is logged, with step timings and no patient data.
      const timing = commandTiming.fields(event.type, response.status);
      if (timing.totalMs >= slowCommandMs) log(timing);
      return response;
    },
  };
  // These readers project against the initial request's authority. Recheck before returning
  // their result, under the same workspace SHARE boundary used by detail and archive reads.
  // Keep the potentially pooled reads outside that lock: initialization may need an UPDATE.
  for (const name of [
    "auditPage",
    "deskAuditPage",
    "listAccess",
    "listCovers",
    "recordViews",
    "breakGlassOpenings",
    "coversGiven",
    "forecastHistory",
  ]) {
    const readProtected = store[name].bind(store);
    store[name] = async (view, ...args) => {
      const originalScope = JSON.stringify(view?.access);
      const result = await readProtected(view, ...args);
      if (!view?.membershipId && !bootstrapView(view)) return result;
      return currentRecordRead(view, async (_client, _at, current) => {
        if (JSON.stringify(current.access) !== originalScope) throw new Error("role-ended");
        return result;
      });
    };
  }
  return store;
}
