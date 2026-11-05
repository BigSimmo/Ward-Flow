// @ts-check
/** A bounded keyset page. Scope is applied before the visible-row cap; continuation also
 * advances through filtered rows, so another place cannot starve this desk's directory.
 * @param {{query:(sql:string, values:any[])=>Promise<{rows:any[]}>, workspaceId:string, at:Date, cursor?:string|null, keep:(row:any)=>boolean}} options
 */
export async function membershipPage({ query, workspaceId, at, cursor = null, keep }) {
  /** @type {[string, string] | null} */
  let after = null;
  if (cursor !== null) {
    try {
      if (typeof cursor !== "string" || cursor.length > 512 || !/^[A-Za-z0-9_-]+$/.test(cursor)) return null;
      const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
      if (
        !Array.isArray(value) ||
        value.length !== 2 ||
        typeof value[0] !== "string" ||
        value[0].length > 64 ||
        !Number.isFinite(Date.parse(value[0])) ||
        !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}(?::?\d{2})?)$/.test(value[0]) ||
        typeof value[1] !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value[1])
      )
        return null;
      // Date.parse normalises impossible dates (for example 30 February); PostgreSQL refuses
      // them. Reject those here so a client-supplied cursor stays a 400 rather than a query error.
      const [year, month, day] = value[0].slice(0, 10).split("-").map(Number);
      const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
      const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) return null;
      after = [value[0], value[1]];
    } catch {
      return null;
    }
  }
  const memberships = [];
  const continuation = () => Buffer.from(JSON.stringify(after)).toString("base64url");
  for (let page = 0; page < 10; page++) {
    const { rows } = await query(
      `SELECT *, granted_at::text AS granted_key FROM ward_flow.memberships WHERE workspace_id=$1 AND revoked_at IS NULL AND expires_at > $2${after ? " AND (granted_at, id) > ($3::timestamptz, $4::uuid)" : ""} ORDER BY granted_at, id LIMIT 500`,
      after ? [workspaceId, at, ...after] : [workspaceId, at],
    );
    for (const row of rows) {
      after = [row.granted_key, row.id];
      if (keep(row)) memberships.push(row);
      if (memberships.length === 500) return { memberships, complete: false, nextCursor: continuation() };
    }
    if (rows.length < 500) return { memberships, complete: true, nextCursor: null };
  }
  return { memberships, complete: false, nextCursor: continuation() };
}
