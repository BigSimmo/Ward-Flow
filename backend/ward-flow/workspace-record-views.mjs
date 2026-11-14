// @ts-check
// Audit pages, record openings, list and TV reads and the coordinator's review lists for the
// workspace store (postgres.mjs).
import {
  ACCESS_COVER_MIGRATION,
  LIST_VIEW_MIGRATION,
  RECORD_ACCESS_MIGRATION,
  REFERRAL_VIEW_MIGRATION,
  ROLE_ACCESS_MIGRATION,
} from "./migrations.mjs";
import { recordDetailOf } from "./record-detail.mjs";
import { minutesFrom } from "./workspace-shared.mjs";

/** The same desk opening the same record on the same screen again this soon adds no new row. */
const VIEW_REPEAT_MS = 60_000;
/** Most record access rows one read returns. */
const VIEW_LIST_LIMIT = 200;
/** How far back the coordinator's record views reach (D-80 item 14). */
const REVIEW_DAYS = 7;
/** Minutes from `now` to a stored time, as the screens place server times on the demo clock. */
/**
 * R-FIGS-13 (Josh, 14 Nov 2026): why a record was opened, for the Access log's Reason column. An
 * opening made while the same account held a break glass grant on that person names the grant's
 * picked reason (a list id, never typed words); any other opening reads null, inside the desk's
 * own scope. Read from the break glass table both migrations already keep: no new column.
 */
const BREAK_GLASS_REASON =
  "(SELECT b.reason FROM ward_flow.break_glass b WHERE b.workspace_id = r.workspace_id AND b.data_mode = r.data_mode AND b.actor_id = r.actor_id AND b.patient_id = r.patient_id AND r.viewed_at >= b.opened_at AND r.viewed_at <= b.until ORDER BY b.id DESC LIMIT 1) AS break_glass_reason";
const minutesBefore = (time, now) => Math.round((new Date(time).getTime() - now.getTime()) / 60_000);
/** Most record openings one account may log in a minute, so no desk can flood the log. */
const VIEW_RATE_LIMIT = 60;
/** A desk's whole-list or TV reads are logged at most once in this window for each account (H-0731). */
const LIST_VIEW_REPEAT_MS = 15 * 60_000;

export function recordViewsStore({
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
}) {
  // #839: when this process last logged each desk's list read (`logList`), at most 1000 desks.
  const listLogged = new Map();
  /**
   * A bounded audit page; its cursor includes progress through rows outside this desk.
   * @param {string | null} [cursor]
   */
  async function auditPage(view, cursor = null) {
    const whole = !view || engine.wholeNetwork(view.access);
    const scoped = view && view.version >= ROLE_ACCESS_MIGRATION ? ", actor_scope" : "";
    const statewide = whole || view.access.scope.kind === "statewide";
    let payload;
    if (!statewide) {
      payload = (await readWorld(pool, "payload"))?.payload;
      if (!payload || !engine.validWorld(payload)) return { events: [], complete: true, nextCursor: null };
    }
    // Scan at most ten raw pages per request, applying scope before the public 200-row cap.
    // Sequence stays as the database's bigint text: never round a cursor through Number.
    const selected = [];
    let before = cursor;
    for (let page = 0; page < 10; page++) {
      const { rows } = await pool.query(
        `SELECT sequence, actor_id, command_id, actor_role${scoped}, data_mode, action, outcome, prior_revision, revision, changes, committed_at FROM ward_flow.audit WHERE workspace_id=$1 AND data_mode='prototype'${whole ? "" : " AND action LIKE 'ACCESS\\_%'"}${before === null ? "" : " AND sequence < $2::bigint"} ORDER BY sequence DESC LIMIT 200`,
        before === null ? [workspaceId] : [workspaceId, before],
      );
      for (const row of rows) {
        before = row.sequence;
        const access = statewide ? null : engine.parseAccess(row.changes?.role, row.changes?.scope);
        if (statewide || (access && engine.scopeWithin(payload, access.scope, view.access.scope))) {
          const { command_id, ...event } = row;
          selected.push({
            ...event,
            ...(view?.actorId === row.actor_id && typeof command_id === "string" ? { ownCommandId: command_id } : {}),
          });
        }
        if (selected.length === 200) return { events: selected, complete: false, nextCursor: String(before) };
      }
      if (rows.length < 200) return { events: selected, complete: true, nextCursor: null };
    }
    return { events: selected, complete: false, nextCursor: String(before) };
  }
  return {
    auditPage,
    /**
     * Readiness review item 9: who opened which patient record. One row each time a desk opens a
     * patient or movement page, naming its role and place. A repeat by the same account of the
     * same record on the same screen within a minute adds nothing, so a reload cannot flood the
     * log. Only a record this desk can see is logged (its place, or a break glass grant), so a desk
     * cannot write openings of records it never had, and one account logs at most
     * VIEW_RATE_LIMIT a minute. The table refuses every change and removal (migration 11), which
     * is why nothing goes in unchecked. Before 11 nothing is kept.
     *
     * H-0731: the reply then carries that patient's detail (`record-detail.mjs`), which no board
     * holds, so a desk is only sent it for an opening the server has logged, now or in the last
     * minute. Nothing is sent when the opening could not be logged.
     */
    async logView(view, patientId, surface) {
      if (view?.access?.role === "executive")
        return { status: 403, body: { error: "Record access is not part of your role" } };
      if (!(view.version >= RECORD_ACCESS_MIGRATION)) return { status: 200, body: { logged: false } };
      // Before 13 the log's check takes a patient or movement page only.
      if (surface === "referral" && !(view.version >= REFERRAL_VIEW_MIGRATION))
        return { status: 200, body: { logged: false } };
      const at = clock();
      // Fresh audit P-2: most openings repeat one already logged this minute, or come past the rate
      // limit, and log nothing. Check that first on the record_access_actor index, so only an
      // opening that may be logged pays for reading and scoping the whole board. The insert below
      // checks both again under its lock.
      const since = new Date(at.getTime() - VIEW_REPEAT_MS);
      const { rows: recent } = await pool
        .query(
          "SELECT EXISTS (SELECT 1 FROM ward_flow.record_access WHERE workspace_id=$1 AND actor_id=$2 AND membership_id IS NOT DISTINCT FROM $7::uuid AND patient_id=$3 AND surface=$4 AND viewed_at > $5) AS repeated, (SELECT count(*) FROM ward_flow.record_access WHERE workspace_id=$1 AND actor_id=$2 AND viewed_at > $5) >= $6 AS limited",
          [workspaceId, view.actorId, patientId, surface, since, VIEW_RATE_LIMIT, view.membershipId ?? null],
        )
        .catch((error) => {
          forgetVersionOnMissing(error);
          throw error;
        });
      if (recent[0]?.limited && !recent[0]?.repeated) return { status: 200, body: { logged: false } };
      return currentRecordRead(
        view,
        async (client, loggedAt, current, stored) => {
          if (current?.access?.role === "executive")
            return { status: 403, body: { error: "Record access is not part of your role" } };
          if (!stored || !engine.validWorld(stored.payload)) return { status: 200, body: { logged: false } };
          // Recheck the repeat window at the refreshed time after both locks. A preliminary repeat
          // may have expired while waiting, and its earlier authority never authorises this reply.
          const { rows: lockedRecent } = await client.query(
            "SELECT EXISTS (SELECT 1 FROM ward_flow.record_access WHERE workspace_id=$1 AND actor_id=$2 AND membership_id IS NOT DISTINCT FROM $7::uuid AND patient_id=$3 AND surface=$4 AND viewed_at > $5) AS repeated, (SELECT count(*) FROM ward_flow.record_access WHERE workspace_id=$1 AND actor_id=$2 AND viewed_at > $5) >= $6 AS limited",
            [
              workspaceId,
              current.actorId,
              patientId,
              surface,
              new Date(loggedAt.getTime() - VIEW_REPEAT_MS),
              VIEW_RATE_LIMIT,
              current.membershipId ?? null,
            ],
          );
          if (lockedRecent[0]?.limited && !lockedRecent[0]?.repeated) return { status: 200, body: { logged: false } };
          const { state } = engine.scopeWorld(stored.payload, current.access, loggedAt, current.grants);
          const visible =
            surface === "patient"
              ? state.patients.some((patient) => patient.id === patientId)
              : surface === "referral"
                ? // A ward bed request needs no front-door referral link to be opened.
                  state.referrals.some((referral) => referral.patientId === patientId) ||
                  state.movements.some((movement) => movement.patientId === patientId)
                : state.movements.some((movement) => movement.id === patientId || movement.patientId === patientId);
          if (!visible) return { status: 404, body: { error: "That record is not one this desk can open" } };
          // A movement page names its journey; the detail is its patient's.
          const opened = state.patients.some((patient) => patient.id === patientId)
            ? patientId
            : state.movements.find((movement) => movement.id === patientId)?.patientId;
          const patient = state.patients.find((candidate) => candidate.id === opened);
          const sent = (logged) => ({
            status: 200,
            body: {
              logged,
              ...(patient
                ? {
                    opened: patient.id,
                    detail: recordDetailOf(patient),
                    generation: stored.payload.state.worldGeneration,
                  }
                : {}),
            },
          });
          if (lockedRecent[0]?.repeated) return sent(false);
          const { rowCount } = await client
            .query(
              "INSERT INTO ward_flow.record_access(workspace_id, actor_id, membership_id, actor_role, actor_scope, patient_id, surface, viewed_at) SELECT $1,$2,$3,$4,$5,$6,$7,$8 WHERE NOT EXISTS (SELECT 1 FROM ward_flow.record_access WHERE workspace_id=$1 AND actor_id=$2 AND membership_id IS NOT DISTINCT FROM $3::uuid AND patient_id=$6 AND surface=$7 AND viewed_at > $9) AND (SELECT count(*) FROM ward_flow.record_access WHERE workspace_id=$1 AND actor_id=$2 AND viewed_at > $9) < $10",
              [
                workspaceId,
                current.actorId,
                current.membershipId ?? null,
                current.access.role,
                current.access.scope,
                patientId,
                surface,
                loggedAt,
                new Date(loggedAt.getTime() - VIEW_REPEAT_MS),
                VIEW_RATE_LIMIT,
              ],
            )
            .catch((error) => {
              forgetVersionOnMissing(error);
              throw error;
            });
          // A repeat that committed meanwhile was logged within the minute too; the rate limit was not.
          if (rowCount > 0) return sent(true);
          const { rows: again } = await client.query(
            "SELECT 1 FROM ward_flow.record_access WHERE workspace_id=$1 AND actor_id=$2 AND membership_id IS NOT DISTINCT FROM $6::uuid AND patient_id=$3 AND surface=$4 AND viewed_at > $5",
            [
              workspaceId,
              current.actorId,
              patientId,
              surface,
              new Date(loggedAt.getTime() - VIEW_REPEAT_MS),
              current.membershipId ?? null,
            ],
          );
          return again.length ? sent(false) : { status: 200, body: { logged: false } };
        },
        true,
      );
    },
    /**
     * The newest record openings, optionally for one patient. The statewide coordinator reads them
     * all. A service coordinator reads those of the last 7 days for the records in its own part of
     * the workspace, for its review list (D-80 item 14). An access admin below statewide reads the
     * openings by desks inside its own place. That place filter runs in the query, so openings
     * elsewhere never crowd those out of the limit: the desks that have opened anything are few, so
     * each is checked here and only those inside are asked for. The HTTP layer refuses everyone else
     * before this runs. `minutes` is the opening's time as minutes from the server's now.
     */
    async recordViews(view, patientId = null) {
      if (!(view.version >= RECORD_ACCESS_MIGRATION)) return [];
      const at = clock();
      if (view.access.role === "coordinator" && view.access.scope.kind !== "statewide") {
        const inPlace = await recordsInPlace(view, at);
        if (inPlace?.length === 0) return [];
        const params = [workspaceId, new Date(at.getTime() - REVIEW_DAYS * 86_400_000)];
        const patient = patientId ? ` AND patient_id=$${params.push(patientId)}` : "";
        const place = inPlace ? ` AND patient_id = ANY($${params.push(inPlace)})` : "";
        const { rows } = await pool.query(
          `SELECT id, actor_id, actor_role, actor_scope, patient_id, surface, viewed_at, ${BREAK_GLASS_REASON} FROM ward_flow.record_access r WHERE workspace_id=$1 AND data_mode='prototype' AND viewed_at > $2${patient}${place} ORDER BY id DESC LIMIT ${VIEW_LIST_LIMIT}`,
          params,
        );
        return rows.map((row) => ({ ...row, minutes: minutesBefore(row.viewed_at, at) }));
      }
      const params = [workspaceId];
      let where = "workspace_id=$1 AND data_mode='prototype'";
      if (patientId) {
        params.push(patientId);
        where += ` AND patient_id=$${params.length}`;
      }
      if (view.access.scope.kind !== "statewide") {
        const world = await read(view.actorId);
        const { rows: desks } = await pool.query(
          `SELECT DISTINCT actor_role, actor_scope FROM ward_flow.record_access WHERE ${where}`,
          params,
        );
        const inside = desks
          .filter((desk) => {
            const access = engine.parseAccess(desk.actor_role, desk.actor_scope);
            return !!access && engine.scopeWithin(world.payload, access.scope, view.access.scope);
          })
          .map((desk) => JSON.stringify([desk.actor_role, desk.actor_scope]));
        if (inside.length === 0) return [];
        params.push(inside);
        where += ` AND jsonb_build_array(actor_role, actor_scope) = ANY($${params.length}::jsonb[])`;
      }
      const { rows } = await pool.query(
        `SELECT id, actor_id, actor_role, actor_scope, patient_id, surface, viewed_at, ${BREAK_GLASS_REASON} FROM ward_flow.record_access r WHERE ${where} ORDER BY id DESC LIMIT ${VIEW_LIST_LIMIT}`,
        params,
      );
      return rows.map((row) => ({ ...row, minutes: minutesFrom(row.viewed_at, at) }));
    },
    /**
     * H-0731: the server's own record that this desk was sent its whole list (`list`) or the TV
     * board (`tv`), written as it sends them, so a browser that never reports what it opens is
     * still in the log. A list read names no single record, so its patient is "*". One row per
     * account, desk and screen in LIST_VIEW_REPEAT_MS, so polling cannot flood the log. Before 15
     * nothing is kept.
     */
    async logList(view, surface) {
      if (!(view.version >= LIST_VIEW_MIGRATION) || (surface !== "list" && surface !== "tv")) return false;
      // #839: a row this process wrote inside the window means the insert below would add nothing,
      // so its four round trips are skipped. Rows are never removed inside the window.
      const key = JSON.stringify([view.actorId, view.membershipId ?? null, surface]);
      const since = clock().getTime() - (listLogged.get(key) ?? -Infinity);
      if (since >= 0 && since < LIST_VIEW_REPEAT_MS) return false;
      let logged = 0;
      return transaction(async (client, loggedAt) => {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1 || ':' || $2 || ':record-access'))", [
          workspaceId,
          view.actorId,
        ]);
        loggedAt.setTime(clock().getTime());
        const { rowCount } = await client
          .query(
            "INSERT INTO ward_flow.record_access(workspace_id, actor_id, membership_id, actor_role, actor_scope, patient_id, surface, viewed_at) SELECT $1,$2,$3,$4,$5,'*',$6,$7 WHERE NOT EXISTS (SELECT 1 FROM ward_flow.record_access WHERE workspace_id=$1 AND actor_id=$2 AND membership_id IS NOT DISTINCT FROM $3 AND patient_id='*' AND surface=$6 AND viewed_at > $8)",
            [
              workspaceId,
              view.actorId,
              view.membershipId ?? null,
              view.access.role,
              view.access.scope,
              surface,
              loggedAt,
              new Date(loggedAt.getTime() - LIST_VIEW_REPEAT_MS),
            ],
          )
          .catch((error) => {
            forgetVersionOnMissing(error);
            throw error;
          });
        if (rowCount > 0) logged = loggedAt.getTime();
        return rowCount > 0;
      }).then((added) => {
        // Noted only once committed, so a rolled back write is tried again.
        if (added) {
          if (listLogged.size >= 1000) listLogged.delete(listLogged.keys().next().value);
          listLogged.delete(key);
          listLogged.set(key, logged);
        }
        return added;
      });
    },
    /**
     * D-80 item 14: the newest break glass openings for the coordinator's review list, with the
     * desk that opened each (its role and place, from its membership) and why. Scoped as a service
     * coordinator's `recordViews`; the HTTP layer gives them to coordinators only. The record itself shows only on the screens the coordinator already has.
     */
    async breakGlassOpenings(view) {
      if (!(view.version >= ROLE_ACCESS_MIGRATION)) return [];
      const at = clock();
      const inPlace = await recordsInPlace(view, at);
      if (inPlace?.length === 0) return [];
      const params = [workspaceId, new Date(at.getTime() - REVIEW_DAYS * 86_400_000)];
      const place = inPlace ? ` AND b.patient_id = ANY($${params.push(inPlace)})` : "";
      const { rows } = await pool.query(
        `SELECT b.id, m.role AS actor_role, m.scope AS actor_scope, b.patient_id, b.reason, b.opened_at, b.until FROM ward_flow.break_glass b JOIN ward_flow.memberships m ON m.id = b.membership_id WHERE b.workspace_id=$1 AND b.data_mode='prototype' AND b.opened_at > $2${place} ORDER BY b.id DESC LIMIT ${VIEW_LIST_LIMIT}`,
        params,
      );
      return rows.map(({ opened_at: opened, until, ...row }) => ({
        ...row,
        minutes: { opened: minutesBefore(opened, at), until: minutesBefore(until, at) },
      }));
    },
    /**
     * Master audit M58 (D-129): each cover given in the last 7 days, for the coordinator's review
     * list beside the break glass openings: the giver's desk, the cover, its reason and its times,
     * from the ACCESS_COVER audit rows. Below statewide, only cover inside the coordinator's place.
     */
    async coversGiven(view) {
      if (!(view.version >= ACCESS_COVER_MIGRATION)) return [];
      const at = clock();
      const statewide = engine.wholeNetwork(view.access) || view.access.scope.kind === "statewide";
      const world = statewide ? null : (await readWorld(pool, "payload"))?.payload;
      if (!statewide && (!world || !engine.validWorld(world))) return [];
      const { rows } = await pool.query(
        `SELECT sequence::text AS id, actor_role, actor_scope, changes, committed_at FROM ward_flow.audit WHERE workspace_id=$1 AND data_mode='prototype' AND action='ACCESS_COVER' AND outcome='accepted' AND committed_at > $2 ORDER BY sequence DESC LIMIT ${VIEW_LIST_LIMIT}`,
        [workspaceId, new Date(at.getTime() - REVIEW_DAYS * 86_400_000)],
      );
      return rows.flatMap(({ id, actor_role, actor_scope, changes, committed_at: given }) => {
        const cover = engine.parseAccess(changes?.role, changes?.scope);
        const until = new Date(changes?.expiresAt);
        if (!cover || !Number.isFinite(until.getTime())) return [];
        if (!statewide && !engine.scopeWithin(world, cover.scope, view.access.scope)) return [];
        return [
          {
            id,
            actor_role,
            actor_scope,
            role: cover.role,
            scope: cover.scope,
            reason: typeof changes.reason === "string" ? changes.reason : null,
            minutes: { given: minutesBefore(given, at), until: minutesBefore(until, at) },
          },
        ];
      });
    },
  };
}
