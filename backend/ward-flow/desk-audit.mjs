// @ts-check
/**
 * P056: the Activity feed of a desk that is neither the statewide coordinator nor an access admin.
 * It reads only the changes made by desks whose own place lies wholly inside this desk's place, and
 * only what kind of change it was, whether it was recorded, and when. The change facts (which can
 * name patients), the actor and the actor's place are never sent. Role changes and break glass
 * openings stay with the readers who already have them. A row whose sender's place is missing or
 * unreadable, or a world that cannot be read, gives fewer events, never more.
 */
const WITHHELD_ACTIONS = /^(ACCESS_|BREAK_GLASS)/;

/**
 * Whether a sender's place lies wholly inside the reading desk's place. A statewide or service desk
 * keeps the engine's own rule; that rule refuses every narrower desk, so a ward, ED or site desk is
 * answered here: a ward reads wards made only of its own wards, an ED its own ED, a site the wards,
 * EDs and site at that site. Any other place, or any place it cannot read, contains nothing.
 */
function senderInside(engine, payload, inner, outer) {
  if (outer.kind === "statewide" || outer.kind === "service") return engine.scopeWithin(payload, inner, outer);
  const wards = (test) => inner.kind === "ward" && inner.unitIds.length > 0 && inner.unitIds.every(test);
  if (outer.kind === "ward") return wards((id) => outer.unitIds.includes(id));
  if (outer.kind === "ed") return inner.kind === "ed" && inner.edId === outer.edId;
  if (outer.kind !== "site") return false;
  const places = engine.accessPlaces(payload);
  if (inner.kind === "site") return inner.siteCode === outer.siteCode;
  if (inner.kind === "ed") return places.edSiteCode(inner.edId) === outer.siteCode;
  return wards((id) => places.unitSiteCode(id) === outer.siteCode);
}

/** * @param {{ pool: { query: Function }, workspaceId: string, engine: any, readPayload: () => Promise<unknown>, view: any, cursor?: string | null, minimumVersion: number }} input
 */
export async function deskAuditPage({ pool, workspaceId, engine, readPayload, view, cursor = null, minimumVersion }) {
  const none = { events: [], complete: true, nextCursor: null };
  if (!view || !(view.version >= minimumVersion) || !view.access?.scope) return none;
  const payload = await readPayload();
  if (!payload || !engine.validWorld(payload)) return none;
  const events = [];
  let before = cursor;
  for (let page = 0; page < 10; page++) {
    const { rows } = await pool.query(
      `SELECT sequence, actor_role, actor_scope, action, outcome, committed_at FROM ward_flow.audit WHERE workspace_id=$1 AND data_mode='prototype' AND actor_scope IS NOT NULL AND action NOT LIKE 'ACCESS\\_%'${before === null ? "" : " AND sequence < $2::bigint"} ORDER BY sequence DESC LIMIT 200`,
      before === null ? [workspaceId] : [workspaceId, before],
    );
    for (const row of rows) {
      before = row.sequence;
      if (typeof row.action !== "string" || WITHHELD_ACTIONS.test(row.action)) continue;
      const sender = engine.parseAccess(row.actor_role, row.actor_scope);
      if (!sender || !senderInside(engine, payload, sender.scope, view.access.scope)) continue;
      events.push({ sequence: row.sequence, action: row.action, outcome: row.outcome, committed_at: row.committed_at });
      if (events.length === 200) return { events, complete: false, nextCursor: String(before) };
    }
    if (rows.length < 200) return { events, complete: true, nextCursor: null };
  }
  return { events, complete: false, nextCursor: String(before) };
}
