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
 * @param {{ pool: { query: Function }, workspaceId: string, engine: any, readPayload: () => Promise<unknown>, view: any, cursor?: string | null, minimumVersion: number }} input
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
      if (!sender || !engine.scopeWithin(payload, sender.scope, view.access.scope)) continue;
      events.push({ sequence: row.sequence, action: row.action, outcome: row.outcome, committed_at: row.committed_at });
      if (events.length === 200) return { events, complete: false, nextCursor: String(before) };
    }
    if (rows.length < 200) return { events, complete: true, nextCursor: null };
  }
  return { events, complete: false, nextCursor: String(before) };
}
