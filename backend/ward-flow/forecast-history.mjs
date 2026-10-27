// @ts-check
// Shared forecast history (proposal 013, migration 16; forecast integration, Josh, 27 Oct 2026).
// The daily forecast snapshots behind the Statistics track record, and the reasons people record
// for a missed day, kept on the server so every device and colleague at the same desk sees one
// track record. Counts, a demo day, a closed list of reasons and a role only. Synthetic data only.
import { createHash } from "node:crypto";
import { FORECAST_HISTORY_MIGRATION } from "./migrations.mjs";

/** The newest snapshots and reasons a desk is sent, matching the browser's own limits. */
const FORECAST_SNAPSHOT_LIMIT = 60;
const FORECAST_REASON_LIMIT = 200;

/** The closed lists the browser offers (forecast-miss-reasons.ts) and the table checks. */
const FORECAST_MISS_REASONS = Object.freeze([
  "discharge_postponed",
  "transfer_cancelled",
  "capacity_changed",
  "unexpected_admission",
  "other",
]);
const FORECAST_REASON_ROLES = Object.freeze([
  "coordinator",
  "ward",
  "ed",
  "officer",
  "community",
  "bed_manager",
  "executive",
]);

const INT_MIN = -2147483648;
const INT_MAX = 2147483647;
const whole = (/** @type {unknown} */ value) =>
  typeof value === "number" && Number.isInteger(value) && value >= INT_MIN && value <= INT_MAX;

/**
 * A POST body, checked: the world generation the browser counted in, and today's snapshot or a
 * day's reason (or both). Null when anything is missing or out of shape.
 * @param {any} body
 * @returns {{ generation: number, snapshot?: { day: number, at: number, nowGap: number, tomorrow: { low: number, likely: number, high: number } }, reason?: { day: number, reason: string, by: string, at: number } } | null}
 */
export function forecastHistoryInput(body) {
  if (typeof body !== "object" || body === null) return null;
  const { generation, snapshot, reason } = body;
  if (!(typeof generation === "number" && Number.isSafeInteger(generation) && generation >= 0)) return null;
  if (snapshot === undefined && reason === undefined) return null;
  /** @type {ReturnType<typeof forecastHistoryInput>} */
  const input = { generation };
  if (snapshot !== undefined) {
    const tomorrow = snapshot?.tomorrow;
    if (
      !whole(snapshot?.day) ||
      !whole(snapshot.at) ||
      !whole(snapshot.nowGap) ||
      !whole(tomorrow?.low) ||
      !whole(tomorrow.likely) ||
      !whole(tomorrow.high) ||
      !(tomorrow.low <= tomorrow.likely && tomorrow.likely <= tomorrow.high)
    )
      return null;
    input.snapshot = {
      day: snapshot.day,
      at: snapshot.at,
      nowGap: snapshot.nowGap,
      tomorrow: { low: tomorrow.low, likely: tomorrow.likely, high: tomorrow.high },
    };
  }
  if (reason !== undefined) {
    if (
      !whole(reason?.day) ||
      !whole(reason.at) ||
      !FORECAST_MISS_REASONS.includes(reason.reason) ||
      !FORECAST_REASON_ROLES.includes(reason.by)
    )
      return null;
    input.reason = { day: reason.day, reason: reason.reason, by: reason.by, at: reason.at };
  }
  return input;
}

/**
 * Each desk's forecast counts only the records it is shown, so its history is its own: the key is
 * the desk's role and place, from the server's record of the desk, never from the browser.
 * @param {{ access: { role: string, scope: unknown }, actorId?: string }} view
 */
export function forecastScopeKey(view) {
  return createHash("sha256")
    .update(JSON.stringify([view.access.role, view.access.scope ?? null]))
    .digest("hex");
}

/**
 * The store's two forecast history calls. Before migration 16 both answer `{ shared: false }`, and
 * the browser keeps its own history as it did before.
 * @param {{
 *   pool: { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[], rowCount?: number | null }> },
 *   workspaceId: string,
 *   schemaVersion: () => Promise<number>,
 *   worldGeneration: () => Promise<number | null>,
 *   forgetVersionOnMissing: (error: any) => void,
 * }} dependencies
 */
export function forecastHistoryStore({ pool, workspaceId, schemaVersion, worldGeneration, forgetVersionOnMissing }) {
  const query = (/** @type {string} */ sql, /** @type {unknown[]} */ params) =>
    pool.query(sql, params).catch((error) => {
      forgetVersionOnMissing(error);
      throw error;
    });

  async function history(view, generation) {
    const scopeKey = forecastScopeKey(view);
    const [snapshots, reasons] = await Promise.all([
      query(
        `SELECT demo_day, taken_at, ready_gap_now, tomorrow_low, tomorrow_likely, tomorrow_high FROM ward_flow.forecast_snapshots WHERE workspace_id=$1 AND data_mode='prototype' AND world_generation=$2 AND scope_key=$3 ORDER BY demo_day DESC LIMIT ${FORECAST_SNAPSHOT_LIMIT}`,
        [workspaceId, generation, scopeKey],
      ),
      query(
        `SELECT demo_day, reason, chosen_by, chosen_at FROM ward_flow.forecast_miss_reasons WHERE workspace_id=$1 AND data_mode='prototype' AND world_generation=$2 AND scope_key=$3 ORDER BY demo_day DESC LIMIT ${FORECAST_REASON_LIMIT}`,
        [workspaceId, generation, scopeKey],
      ),
    ]);
    return {
      shared: true,
      generation,
      snapshots: snapshots.rows.reverse().map((row) => ({
        day: row.demo_day,
        at: row.taken_at,
        nowGap: row.ready_gap_now,
        tomorrow: { low: row.tomorrow_low, likely: row.tomorrow_likely, high: row.tomorrow_high },
      })),
      reasons: reasons.rows
        .reverse()
        .map((row) => ({ day: row.demo_day, reason: row.reason, by: row.chosen_by, at: row.chosen_at })),
    };
  }

  return {
    /** This desk's shared history in the current world generation. */
    async forecastHistory(view) {
      if ((await schemaVersion()) < FORECAST_HISTORY_MIGRATION) return { shared: false };
      const generation = await worldGeneration();
      if (generation === null) return { shared: false };
      return history(view, generation);
    },
    /**
     * Records today's snapshot (the first of a demo day stands) or a day's reason (a later one
     * replaces it), then answers with the desk's history. A browser still counting in an earlier
     * world generation is refused, so a reset never mixes two worlds' days.
     * @param {any} view
     * @param {NonNullable<ReturnType<typeof forecastHistoryInput>>} input
     */
    async recordForecast(view, input) {
      if ((await schemaVersion()) < FORECAST_HISTORY_MIGRATION) return { status: 200, body: { shared: false } };
      const generation = await worldGeneration();
      if (generation === null) return { status: 200, body: { shared: false } };
      if (generation !== input.generation)
        return {
          status: 409,
          body: { code: "world-changed", error: "The demonstration was reset. Read the board again." },
        };
      const scopeKey = forecastScopeKey(view);
      const { snapshot, reason } = input;
      if (snapshot)
        await query(
          "INSERT INTO ward_flow.forecast_snapshots(workspace_id, world_generation, scope_key, demo_day, taken_at, ready_gap_now, tomorrow_low, tomorrow_likely, tomorrow_high) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING",
          [
            workspaceId,
            generation,
            scopeKey,
            snapshot.day,
            snapshot.at,
            snapshot.nowGap,
            snapshot.tomorrow.low,
            snapshot.tomorrow.likely,
            snapshot.tomorrow.high,
          ],
        );
      if (reason)
        await query(
          "INSERT INTO ward_flow.forecast_miss_reasons(workspace_id, world_generation, scope_key, demo_day, reason, chosen_by, chosen_at, actor_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (workspace_id, world_generation, scope_key, demo_day) DO UPDATE SET reason=EXCLUDED.reason, chosen_by=EXCLUDED.chosen_by, chosen_at=EXCLUDED.chosen_at, actor_id=EXCLUDED.actor_id, updated_at=now()",
          [workspaceId, generation, scopeKey, reason.day, reason.reason, reason.by, reason.at, view.actorId],
        );
      return { status: 200, body: await history(view, generation) };
    },
  };
}
