// @ts-check
// Who a desk works as, and roles, cover, requests for access, sign-outs and break glass openings
// for the workspace store (postgres.mjs).
import { createHash, randomUUID } from "node:crypto";
import { ACCESS_COVER_MIGRATION, RECORD_ACCESS_MIGRATION, ROLE_ACCESS_MIGRATION } from "./migrations.mjs";
import { membershipPage } from "./membership-page.mjs";
import { canonical, minutesFrom } from "./workspace-shared.mjs";

/** A break glass record opened or ended this recently still sends the whole scoped workspace on a poll. */
const GRANT_SETTLE_MS = 60_000;
/** Most break glass grants one desk is sent at once. */
const GRANT_LIST_LIMIT = 50;
/** How often a role's "last used" time is written: once an hour is enough for a 90 day rule. */
const LAST_USED_EVERY_MS = 3_600_000;
/** Open requests for access kept at once, so made-up accounts cannot fill the table. */
const MAX_OPEN_REQUESTS = 500;
/** Open requests waiting for one health service (or statewide) at once (review 8 Nov 2026). */
const MAX_OPEN_REQUESTS_PER_PLACE = 50;
/**
 * An unanswered request stops counting towards the caps after this long, so junk requests cannot
 * block new staff for good. It stays listed, newest first, until an access admin answers it.
 */
const REQUEST_LAPSE_MS = 14 * 24 * 60 * 60_000;
/**
 * Lapsed requests stay open, so more than MAX_OPEN_REQUESTS can wait across the workspace. The
 * admin list reads this many (newest first) before filtering to the admin's place, so a place's
 * own requests are not crowded out by other places' (about 140 days of a sustained flood).
 */
const REQUEST_SCAN_LIMIT = 5_000;

export function createViewer({
  pool,
  workspaceId,
  engine,
  clock,
  schemaVersion,
  forgetVersionOnMissing,
  unusedBefore,
  MAX_TERM,
}) {
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
  /**
   * `touch: false` (fresh audit X-2) skips the "last worked as" write, for the push opt-out that a
   * signed-out or expired sign-in may still call, so it cannot keep an unused role switched on.
   */
  async function resolveViewer(
    actorId,
    { bootstrap = false, workingAs = null, touch = true },
    connection,
    at,
    version,
  ) {
    const choices = bootstrap ? [{ membershipId: null, access: engine.STATEWIDE, own: engine.STATEWIDE }] : [];
    let needsService = false;
    if (version >= ROLE_ACCESS_MIGRATION) {
      // From 9, a role not worked as for the set time is switched off (cover is too short to go
      // unused), and cover is a membership of its own kind.
      const covers = version >= ACCESS_COVER_MIGRATION;
      const { rows } = await connection
        .query(
          covers
            ? `SELECT id, role, scope, kind, last_used_at, expires_at FROM ward_flow.memberships WHERE workspace_id=$1 AND data_mode='prototype' AND actor_id=$2 AND revoked_at IS NULL AND expires_at > $3 AND granted_at > $3::timestamptz - ${MAX_TERM} AND (kind = 'cover' OR coalesce(last_used_at, granted_at) > $4) ORDER BY granted_at, id`
            : `SELECT id, role, scope, expires_at, 'role' AS kind FROM ward_flow.memberships WHERE workspace_id=$1 AND data_mode='prototype' AND actor_id=$2 AND revoked_at IS NULL AND expires_at > $3 AND granted_at > $3::timestamptz - ${MAX_TERM} ORDER BY granted_at, id`,
          covers ? [workspaceId, actorId, at, unusedBefore(at)] : [workspaceId, actorId, at],
        )
        .catch((error) => {
          forgetVersionOnMissing(error);
          throw error;
        });
      const roles = [];
      const wardCovers = [];
      for (const row of rows) {
        // A row the access table would not allow is skipped, never widened. One that names no
        // health service is noted, so the account is told why it has no role (RA-02).
        const access = engine.parseAccess(row.role, row.scope);
        if (!access) {
          if (engine.accessNeedsService(row.role, row.scope)) needsService = true;
          continue;
        }
        if (row.kind === "cover" && access.role === "ward")
          wardCovers.push({
            membershipId: row.id,
            access,
            lastUsed: row.last_used_at ?? null,
            accessUntil: new Date(row.expires_at).getTime(),
          });
        // Cover gives no place of its own, so it can never be passed on (own: null).
        else
          roles.push({
            membershipId: row.id,
            access,
            own: row.kind === "cover" ? null : access,
            lastUsed: row.last_used_at ?? null,
            accessUntil: new Date(row.expires_at).getTime(),
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
                accessUntil: Math.min(choice.accessUntil, ...wardCovers.map((cover) => cover.accessUntil)),
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
        : needsService && !choices.length
          ? { status: "none", needsService: true }
          : { status: "none" };
    let grants = [];
    let recentGrant = false;
    const writeEvery = new Date(at.getTime() - LAST_USED_EVERY_MS);
    if (
      touch &&
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
        `SELECT patient_id, opened_at, until FROM ward_flow.break_glass b WHERE workspace_id=$1 AND actor_id=$2 AND membership_id=$3 AND until > $4 AND EXISTS (SELECT 1 FROM ward_flow.audit a JOIN ward_flow.workspaces w ON w.id=a.workspace_id AND w.data_mode='prototype' WHERE a.workspace_id=b.workspace_id AND a.actor_id=b.actor_id AND a.action='BREAK_GLASS' AND a.outcome='accepted' AND a.changes->>'membershipId'=b.membership_id::text AND a.changes->>'patientId'=b.patient_id AND a.changes->>'reason'=b.reason AND a.changes->>'until'=to_char(b.until AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AND coalesce(a.changes->'worldGeneration', '0'::jsonb)=w.payload->'state'->'worldGeneration') ORDER BY until DESC LIMIT ${GRANT_LIST_LIMIT}`,
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
      accessUntil: "accessUntil" in chosen && typeof chosen.accessUntil === "number" ? chosen.accessUntil : Infinity,
      access: chosen.access,
      // The role as granted, before any cover joined it: what this desk may give cover of. `null`
      // when the desk is working as cover, which is never given on.
      ownAccess: chosen.own === undefined ? chosen.access : chosen.own,
      grants,
      recentGrant,
    };
  }
  return { viewer, resolveViewer };
}

/** The store's access methods: roles, cover, requests, sign-outs and break glass. */
export function accessStore({
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
}) {
  // D-80: a role's end date is at most 12 months away.
  const tooLong = (expiresAt, at) => expiresAt.getTime() > at.getTime() + engine.ACCESS_MAX_TERM_MINUTES * 60_000;
  // A2-02: the app sends a role's length in whole minutes and the server sets the end on its own
  // clock, so a double tap or retry of one grant lands a few milliseconds or seconds later. A
  // repeat whose end is within this of a live grant's end is that grant. It is under a minute, so
  // two deliberately different lengths (at least a minute apart) are never merged.
  const GRANT_END_TOLERANCE = "interval '30 seconds'";
  // A2-01/A2-03: an opening or cover sent without a request key (an older tab) that repeats one
  // made this recently, and still in force, is a retry of it rather than a second one.
  const UNKEYED_RETRY_MS = 60_000;
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
  async function insertGrant(
    client,
    row,
    view,
    { actorId, access, expiresAt, kind = "role", reason = undefined },
    at,
    action,
  ) {
    if (kind === "role") {
      const { rows: existing } = await client.query(
        `SELECT * FROM ward_flow.memberships WHERE workspace_id=$1 AND data_mode='prototype' AND actor_id=$2 AND role=$3 AND scope=$4::jsonb AND granted_by=$5 AND expires_at BETWEEN $6::timestamptz - ${GRANT_END_TOLERANCE} AND $6::timestamptz + ${GRANT_END_TOLERANCE} AND expires_at > $7 AND revoked_at IS NULL${view.version >= ACCESS_COVER_MIGRATION ? " AND kind='role'" : ""} AND granted_at > $7::timestamptz - ${MAX_TERM}${view.version >= ACCESS_COVER_MIGRATION ? " AND coalesce(last_used_at, granted_at) > $8" : ""} ORDER BY granted_at, id LIMIT 1`,
        [
          workspaceId,
          actorId,
          access.role,
          JSON.stringify(access.scope),
          view.actorId,
          expiresAt,
          at,
          ...(view.version >= ACCESS_COVER_MIGRATION ? [unusedBefore(at)] : []),
        ],
      );
      if (existing.length) return existing[0];
    }
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
        // M58: cover keeps why it was given, from the list, for the coordinator's review list.
        ...(reason ? { reason } : {}),
      },
    });
    return rows[0];
  }
  /**
   * M58: an opening or cover sent with a request key is done once, kept as a receipt beside the
   * board's command receipts. A retry or double tap of the same request finds the first answer,
   * so it adds no row and no audit line; the same key on a different request is refused.
   */
  const requestFingerprint = (value) =>
    createHash("sha256")
      .update(JSON.stringify(canonical(value)))
      .digest("hex");
  async function earlierAnswer(client, actorId, intentKey, fingerprint) {
    if (intentKey === undefined) return null;
    const { rows } = await client.query(
      "SELECT fingerprint, status, result FROM ward_flow.commands WHERE workspace_id=$1 AND actor_id=$2 AND command_id=$3",
      [workspaceId, actorId, intentKey],
    );
    if (!rows.length) return null;
    if (rows[0].fingerprint !== fingerprint)
      return { refusal: refused(422, "That request was already used for a different change.") };
    return { result: rows[0].result };
  }
  async function keepAnswer(client, actorId, intentKey, fingerprint, result) {
    if (intentKey === undefined) return;
    await client.query(
      "INSERT INTO ward_flow.commands(workspace_id, actor_id, command_id, fingerprint, status, result) VALUES ($1,$2,$3,$4,$5,$6)",
      [workspaceId, actorId, intentKey, fingerprint, 200, { outcome: "accepted", ...result }],
    );
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
     * Every active or waiting role and cover inside the access admin's own place, with when each
     * was last used, and from 9 the open requests for access there too.
     * @param {any} view
     * @param {string | null} [cursor]
     */
    async listAccess(view, cursor = null) {
      const blocked = accessRefusal(view);
      if (blocked) return blocked;
      const at = clock();
      const world = await read(view.actorId);
      const inside = (row) => {
        const access = engine.parseAccess(row.role, row.scope);
        return !!access && engine.scopeWithin(world.payload, access.scope, view.access.scope);
      };
      // A role that names no health service gives nothing and has no place to filter by, so only a
      // statewide access admin sees it, marked to be given again with a service (RA-02).
      const statewide = view.access.scope.kind === "statewide";
      const needsGrant = (row) => statewide && engine.accessNeedsService(row.role, row.scope);
      // The place filter runs here, so read oldest grant first a page at a time until this admin's
      // own page is found: roles elsewhere never crowd it out. A cursor continues the directory.
      const page = await membershipPage({
        query: (sql, values) => pool.query(sql, values),
        workspaceId,
        at,
        cursor,
        keep: (row) => inside(row) || needsGrant(row),
      });
      if (!page) return refused(400, "The roles cursor is invalid. Reload the list.");
      const memberships = page.memberships;
      const requests =
        view.version >= ACCESS_COVER_MIGRATION
          ? (
              await pool.query(
                "SELECT * FROM ward_flow.access_requests WHERE workspace_id=$1 AND decision IS NULL ORDER BY requested_at DESC, id LIMIT $2",
                [workspaceId, REQUEST_SCAN_LIMIT],
              )
            ).rows
          : [];
      return {
        status: 200,
        body: {
          memberships: memberships.map((row) =>
            needsGrant(row) ? { ...presentMembership(row, at), needsGrantAgain: true } : presentMembership(row, at),
          ),
          requests: requests
            .filter(inside)
            .slice(0, MAX_OPEN_REQUESTS)
            .map((row) => presentRequest(row, at)),
          complete: page.complete,
          nextCursor: page.nextCursor,
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
        if (tooLong(request.expiresAt, at)) return refused(400, engine.ACCESS_TOO_LONG);
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
      // M58 (D-129): like break glass, a reason from the list, refused before the database.
      if (!engine.COVER_REASON_IDS.includes(request?.reason))
        return refused(400, "A reason from the list is required.");
      const blocked = coverRefusalBefore9(view);
      if (blocked) return blocked;
      const shape = request.scope ? engine.coverAccess(request.scope) : null;
      const cover = shape ? engine.parseAccess(shape.role, request.scope) : null;
      if (!cover) return refused(400, "Cover is for one ward or one ED.");
      const fingerprint = requestFingerprint({
        kind: "cover",
        membershipId: view.membershipId ?? null,
        actorId: request.actorId,
        scope: cover.scope,
        minutes: request.minutes,
      });
      return transaction(async (client, at) => {
        const row = await lock(client, view.actorId, at, view);
        const earlier = await earlierAnswer(client, view.actorId, request.intentKey, fingerprint);
        if (earlier?.refusal) return earlier.refusal;
        if (earlier) {
          const { rows: given } = await client.query(
            "SELECT * FROM ward_flow.memberships WHERE id=$1 AND workspace_id=$2",
            [earlier.result.membershipId, workspaceId],
          );
          return given.length
            ? { status: 200, body: { membership: presentMembership(given[0], at) } }
            : refused(409, "That cover was already given. Reload the list.");
        }
        const giver = view.ownAccess === undefined ? view.access : view.ownAccess;
        if (!giver) return refused(403, "Cover cannot be passed on. Ask the ward's nurse in charge or a coordinator.");
        // D-80: only a colleague who already holds a ward or ED role, still in use, may be given cover.
        const { rows: held } = await client.query(
          `SELECT role FROM ward_flow.memberships WHERE workspace_id=$1 AND data_mode='prototype' AND actor_id=$2 AND kind='role' AND revoked_at IS NULL AND expires_at > $3 AND granted_at > $3::timestamptz - ${MAX_TERM} AND coalesce(last_used_at, granted_at) > $4 AND role IN ('ward','ed') LIMIT 1`,
          [workspaceId, request.actorId, at, unusedBefore(at)],
        );
        const refusal = engine.coverRefusal(
          row.payload,
          giver,
          view.actorId,
          request.actorId,
          cover.scope,
          request.minutes,
          held.map((membership) => membership.role),
        );
        if (refusal) return refused(422, refusal);
        if (request.intentKey === undefined) {
          // A2-03: with no key, the same cover from this giver given in the last minute is a retry.
          const { rows: recent } = await client.query(
            "SELECT * FROM ward_flow.memberships WHERE workspace_id=$1 AND data_mode='prototype' AND actor_id=$2 AND role=$3 AND scope=$4::jsonb AND granted_by=$5 AND kind='cover' AND revoked_at IS NULL AND granted_at > $6 AND expires_at > $7 AND expires_at - granted_at = make_interval(mins => $8) ORDER BY granted_at, id LIMIT 1",
            [
              workspaceId,
              request.actorId,
              cover.role,
              JSON.stringify(cover.scope),
              view.actorId,
              new Date(at.getTime() - UNKEYED_RETRY_MS),
              at,
              request.minutes,
            ],
          );
          if (recent.length) return { status: 200, body: { membership: presentMembership(recent[0], at) } };
        }
        const expiresAt = new Date(at.getTime() + request.minutes * 60_000);
        const given = await insertGrant(
          client,
          row,
          view,
          { actorId: request.actorId, access: cover, expiresAt, kind: "cover", reason: request.reason },
          at,
          "ACCESS_COVER",
        );
        await keepAnswer(client, view.actorId, request.intentKey, fingerprint, { membershipId: given.id });
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
          "SELECT count(*) FILTER (WHERE actor_id=$2)::int AS mine FROM ward_flow.access_requests WHERE workspace_id=$1 AND decision IS NULL",
          [workspaceId, actorId],
        );
        const refusal = engine.requestRefusal(row.payload, access, rows[0].mine);
        if (refusal) return refused(422, refusal);
        const { rows: recent } = await client.query(
          "SELECT role, scope FROM ward_flow.access_requests WHERE workspace_id=$1 AND decision IS NULL AND requested_at >= $2 LIMIT $3",
          [workspaceId, new Date(at.getTime() - REQUEST_LAPSE_MS), MAX_OPEN_REQUESTS],
        );
        const place = engine.requestPlace(row.payload, access.scope);
        const samePlace = recent.filter((open) => {
          const parsed = engine.parseAccess(open.role, open.scope);
          return parsed !== null && engine.requestPlace(row.payload, parsed.scope) === place;
        }).length;
        if (recent.length >= MAX_OPEN_REQUESTS || samePlace >= MAX_OPEN_REQUESTS_PER_PLACE)
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
          if (tooLong(expiresAt, at)) return refused(400, engine.ACCESS_TOO_LONG);
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
     * number in one shift is marked as a pattern for the coordinator. `intentKey`: the browser's
     * key for this one opening (M58), so a retry of it is not a second opening.
     * @param {any} view @param {string} patientId @param {string} reason @param {string} [intentKey]
     */
    async breakGlass(view, patientId, reason, intentKey = undefined) {
      if (!engine.BREAK_GLASS_REASON_IDS.includes(reason)) return refused(400, "A reason from the list is required.");
      const fingerprint = requestFingerprint({
        kind: "break-glass",
        membershipId: view.membershipId ?? null,
        patientId,
        reason,
      });
      return transaction(async (client, at) => {
        const row = await lock(client, view.actorId, at, view);
        const refusal = view.membershipId ? engine.breakGlassRefusal(row.payload, view.access, patientId, at) : null;
        if (refusal || !view.membershipId)
          return refused(422, refusal ?? "Opening a record outside your care is not part of your role.");
        // M58: a retry of the same opening answers as the first did, with no second row or audit line.
        let earlier = await earlierAnswer(client, view.actorId, intentKey, fingerprint);
        if (earlier?.refusal) return earlier.refusal;
        // A2-01: with no key, the same opening (desk, patient, reason) made in the last minute, still
        // open and in this world generation (a reset starts afresh) is a retry. It answers with that
        // opening's end and the pattern flag as it was then, counting no new row.
        if (intentKey === undefined) {
          const { rows: recent } = await client.query(
            `SELECT opened_at, until FROM ward_flow.break_glass b WHERE workspace_id=$1 AND actor_id=$2 AND membership_id=$3 AND patient_id=$4 AND reason=$5 AND opened_at > $6 AND until > $7 AND EXISTS (SELECT 1 FROM ward_flow.audit a WHERE a.workspace_id=b.workspace_id AND a.actor_id=b.actor_id AND a.action='BREAK_GLASS' AND a.outcome='accepted' AND a.changes->>'membershipId'=b.membership_id::text AND a.changes->>'patientId'=b.patient_id AND a.changes->>'until'=to_char(b.until AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AND coalesce(a.changes->'worldGeneration', '0'::jsonb)=$8::jsonb) ORDER BY opened_at, id LIMIT 1`,
            [
              workspaceId,
              view.actorId,
              view.membershipId,
              patientId,
              reason,
              new Date(at.getTime() - UNKEYED_RETRY_MS),
              at,
              JSON.stringify(row.payload.state.worldGeneration ?? 0),
            ],
          );
          if (recent.length) {
            const openedAt = new Date(recent[0].opened_at);
            const { rows: counted } = await client.query(
              "SELECT count(*)::int AS count FROM ward_flow.break_glass WHERE workspace_id=$1 AND actor_id=$2 AND opened_at > $3 AND opened_at <= $4",
              [
                workspaceId,
                view.actorId,
                new Date(openedAt.getTime() - engine.BREAK_GLASS_SHIFT_HOURS * 3_600_000),
                openedAt,
              ],
            );
            earlier = {
              result: {
                until: new Date(recent[0].until).toISOString(),
                pattern: counted[0].count > engine.BREAK_GLASS_PER_SHIFT,
              },
            };
          }
        }
        if (earlier) {
          const kept = new Date(earlier.result.until);
          if (!(kept > at)) return refused(409, "That opening has ended. Open the record again.");
          const opened = { ...view, grants: [...view.grants, { patientId, until: kept }] };
          await prepareReviewAuthority(client, row, opened);
          return {
            status: 200,
            body: {
              until: kept.toISOString(),
              pattern: earlier.result.pattern === true,
              snapshot: await snapshot(row, at, opened, undefined, client),
            },
          };
        }
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
          ...(intentKey === undefined ? {} : { commandId: intentKey }),
          action: "BREAK_GLASS",
          outcome: "accepted",
          priorRevision: revision,
          revision,
          changes: {
            patientId,
            reason,
            until: until.toISOString(),
            membershipId: view.membershipId,
            pattern,
            worldGeneration: row.payload.state.worldGeneration,
            openedAt: at.toISOString(),
          },
        });
        await keepAnswer(client, view.actorId, intentKey, fingerprint, { until: until.toISOString(), pattern });
        const opened = { ...view, grants: [...view.grants, { patientId, until }] };
        await prepareReviewAuthority(client, row, opened);
        return {
          status: 200,
          body: { until: until.toISOString(), pattern, snapshot: await snapshot(row, at, opened, undefined, client) },
        };
      });
    },
  };
}
