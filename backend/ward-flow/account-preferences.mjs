// @ts-check
// Help remembered by account (migration 17; Josh, 4 Nov 2026, "Yes to all recommendations" on the
// eight suggestions, item 3). Each signed-in account's Help memory: the desks whose tour is done,
// the page tips already seen, whether tips are turned off, and the What's new lines already read.
// Kept per account, not per desk, so a new phone, PC or browser does not show them all again.
// Desk role ids, static Help topic ids and What's new entry ids only, each checked against a closed
// shape here and again by the table: no patient detail, no paths and no typed text.
import { PREFERENCES_MIGRATION } from "./migrations.mjs";

/** The desks with a tour: the chrome roles and the access admin (ward-help-store.ts). */
const TOUR_ROLES = Object.freeze([
  "coordinator",
  "ward",
  "ed",
  "officer",
  "community",
  "bed_manager",
  "executive",
  "admin",
]);
/** A page tip's mark: a desk role id and a static Help topic id (ward-help-hints.tsx). */
const TIP_MARK = /^([a-z_]{2,20}):[a-z][a-z-]{0,39}$/;
/** A What's new entry id: its date and a slug (whats-new/*.json). */
const WHATS_NEW_ID = /^[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9-]{1,80}$/;
/** The most of each list one account keeps, as the table checks. */
const LIMITS = Object.freeze({ tours: 16, tips: 200, whatsNew: 200 });

/**
 * One list from a body, checked: each item must match, and the list must fit. Null when it does not.
 * @param {unknown} value
 * @param {(item: string) => boolean} valid
 * @param {number} limit
 * @returns {string[] | null}
 */
function list(value, valid, limit) {
  if (!Array.isArray(value) || value.length > limit) return null;
  if (!value.every((item) => typeof item === "string" && valid(item))) return null;
  return [...new Set(value)];
}

/**
 * A POST body, checked: any of the three lists to add to what the account holds, and `tipsOff`
 * when the person changed it. Null when anything is out of shape or nothing is sent.
 * @param {any} body
 * @returns {{ tours?: string[], tips?: string[], whatsNew?: string[], tipsOff?: boolean } | null}
 */
export function accountPreferencesInput(body) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const allowed = new Set(["tours", "tips", "whatsNew", "tipsOff"]);
  const keys = Object.keys(body);
  if (keys.length === 0 || !keys.every((key) => allowed.has(key))) return null;
  /** @type {NonNullable<ReturnType<typeof accountPreferencesInput>>} */
  const input = {};
  if (body.tours !== undefined) {
    const tours = list(body.tours, (item) => TOUR_ROLES.includes(item), LIMITS.tours);
    if (!tours) return null;
    input.tours = tours;
  }
  if (body.tips !== undefined) {
    const tips = list(
      body.tips,
      (item) => {
        const match = TIP_MARK.exec(item);
        return match !== null && TOUR_ROLES.includes(match[1]);
      },
      LIMITS.tips,
    );
    if (!tips) return null;
    input.tips = tips;
  }
  if (body.whatsNew !== undefined) {
    const whatsNew = list(body.whatsNew, (item) => WHATS_NEW_ID.test(item), LIMITS.whatsNew);
    if (!whatsNew) return null;
    input.whatsNew = whatsNew;
  }
  if (body.tipsOff !== undefined) {
    if (typeof body.tipsOff !== "boolean") return null;
    input.tipsOff = body.tipsOff;
  }
  return input;
}

/** @param {any} row */
function reply(row) {
  return {
    shared: true,
    tours: row?.tours_seen ?? [],
    tips: row?.tips_seen ?? [],
    whatsNew: row?.whats_new_seen ?? [],
    // null: the account never chose, so the device's own choice stands.
    tipsOff: typeof row?.tips_off === "boolean" ? row.tips_off : null,
  };
}

/**
 * The store's two preference calls. Before migration 17 both answer `{ shared: false }`, and the
 * browser keeps its own memory as it did before.
 * @param {{
 *   pool: { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[], rowCount?: number | null }> },
 *   workspaceId: string,
 *   schemaVersion: () => Promise<number>,
 *   forgetVersionOnMissing: (error: any) => void,
 * }} dependencies
 */
export function accountPreferencesStore({ pool, workspaceId, schemaVersion, forgetVersionOnMissing }) {
  const query = (/** @type {string} */ sql, /** @type {unknown[]} */ params) =>
    pool.query(sql, params).catch((error) => {
      forgetVersionOnMissing(error);
      throw error;
    });
  const SELECT =
    "SELECT tours_seen, tips_seen, tips_off, whats_new_seen FROM ward_flow.account_preferences WHERE workspace_id=$1 AND data_mode='prototype' AND actor_id=$2";

  return {
    /** This account's Help memory. */
    async accountPreferences(/** @type {{ actorId: string }} */ view) {
      if ((await schemaVersion()) < PREFERENCES_MIGRATION) return { shared: false };
      return reply((await query(SELECT, [workspaceId, view.actorId])).rows[0]);
    },
    /**
     * Adds to this account's lists (seen on any device counts as seen) and records `tipsOff` when
     * it was sent, then answers with the whole memory. One statement, so two devices saving at once
     * both keep their marks. A list already fits its limit on the way in (`accountPreferencesInput`);
     * a full list keeps its newest marks.
     * @param {{ actorId: string }} view
     * @param {NonNullable<ReturnType<typeof accountPreferencesInput>>} input
     */
    async recordAccountPreferences(view, input) {
      if ((await schemaVersion()) < PREFERENCES_MIGRATION) return { shared: false };
      const result = await query(
        `INSERT INTO ward_flow.account_preferences AS held(workspace_id, actor_id, tours_seen, tips_seen, whats_new_seen, tips_off)
         VALUES ($1, $2, $3::text[], $4::text[], $5::text[], $6)
         ON CONFLICT (workspace_id, actor_id) DO UPDATE SET
           tours_seen = ARRAY(SELECT DISTINCT unnest(held.tours_seen || EXCLUDED.tours_seen) ORDER BY 1),
           tips_seen = ARRAY(SELECT mark FROM (SELECT mark, min(at) AS at FROM unnest(held.tips_seen || EXCLUDED.tips_seen) WITH ORDINALITY AS joined(mark, at) GROUP BY mark ORDER BY min(at) DESC LIMIT ${LIMITS.tips}) AS kept ORDER BY at),
           whats_new_seen = ARRAY(SELECT id FROM (SELECT id, min(at) AS at FROM unnest(held.whats_new_seen || EXCLUDED.whats_new_seen) WITH ORDINALITY AS joined(id, at) GROUP BY id ORDER BY min(at) DESC LIMIT ${LIMITS.whatsNew}) AS kept ORDER BY at),
           tips_off = coalesce(EXCLUDED.tips_off, held.tips_off),
           updated_at = now()
         RETURNING tours_seen, tips_seen, tips_off, whats_new_seen`,
        [workspaceId, view.actorId, input.tours ?? [], input.tips ?? [], input.whatsNew ?? [], input.tipsOff ?? null],
      );
      return reply(result.rows[0]);
    },
  };
}
