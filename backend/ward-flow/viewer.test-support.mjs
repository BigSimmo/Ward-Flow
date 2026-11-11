// @ts-check
/** The statewide coordinator view a bootstrap account gets from `store.viewer()`. */
export const STATEWIDE_VIEW = Object.freeze({
  status: "ok",
  version: 8,
  membershipId: null,
  access: { role: "coordinator", scope: { kind: "statewide" } },
  grants: [],
  recentGrant: false,
});

/**
 * A fake store's `viewer()`: accounts named in WARD_COORDINATOR_USER_IDS work as the statewide
 * coordinator, and nobody else holds a role.
 */
export async function bootstrapViewer(actorId, { bootstrap = false } = {}) {
  return bootstrap ? { ...STATEWIDE_VIEW, actorId } : { status: "none" };
}

/**
 * True for the store's one statement that resolves a desk: the account's memberships, each with
 * its break glass openings, and (on the pool) the workspace revision (workspace-access.mjs).
 * @param {unknown} sql
 */
export const isMembershipRead = (sql) => String(sql).startsWith("SELECT (SELECT coalesce(json_agg(x ORDER BY");

/**
 * Answers that statement from a fake database that still answers its two parts separately: the
 * memberships read (with its own parameters) and, per membership, the break glass read.
 * @param {(sql: string, values?: any[]) => Promise<{ rows: any[] }>} query
 * @param {string} sql
 * @param {any[]} values
 */
export async function answerMembershipRead(query, sql, values) {
  const inner = /FROM \((SELECT id, role, scope[^]*?)\) m\) x\)/.exec(sql)?.[1];
  if (!inner) throw new Error("Not the membership read");
  const covers = values.length > 4;
  const { rows } = await query(
    `${inner.replace("$5", "$4")} ORDER BY granted_at, id`,
    covers ? [values[0], values[1], values[2], values[4]] : values.slice(0, 3),
  );
  const grants = new Map();
  for (const row of rows)
    grants.set(
      row,
      (
        await query(
          "SELECT patient_id, opened_at, until FROM ward_flow.break_glass b WHERE workspace_id=$1 AND actor_id=$2 AND membership_id=$3 AND until > $4",
          [values[0], values[1], row.id, values[3]],
        )
      ).rows,
    );
  return membershipReadRows(rows, (row) => grants.get(row) ?? []);
}

/**
 * A fake database's answer to that statement, as Postgres sends it: the memberships as JSON (so
 * times are text), each with `grants(membership)` as its break glass rows.
 * @param {any[]} memberships
 * @param {(membership: any) => any[]} [grants]
 * @param {{ revision: number | string, updatedAt: Date } | null} [workspace]
 */
export function membershipReadRows(memberships, grants = () => [], workspace = null) {
  const json = (/** @type {unknown} */ value) => JSON.parse(JSON.stringify(value));
  return {
    rows: [
      {
        memberships: memberships.map((membership) => ({ ...json(membership), grants: json(grants(membership)) })),
        ...(workspace ? { revision: workspace.revision, updated_at: workspace.updatedAt } : {}),
      },
    ],
  };
}
