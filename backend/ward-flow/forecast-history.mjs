// @ts-check
// Shared forecast history (proposal 013, migration 16; forecast integration, Josh, 27 Oct 2026).
// The daily forecast snapshots behind the Statistics track record, and the reasons people record
// for a missed day, kept on the server so every device and colleague at the same desk sees one
// track record. Counts, a demo day, a closed list of reasons and a role only. Synthetic data only.
import { createHash } from "node:crypto";
import { FORECAST_CONSISTENCY_MIGRATION, FORECAST_HISTORY_MIGRATION } from "./migrations.mjs";

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

/**
 * The role a missed-day reason is recorded under: the desk's own, from the server's record of the
 * desk, never the `by` the browser sent (access audit, 31 Oct 2026). `null` for a desk that records
 * no reasons, such as the access admin, which sees no patients and has no forecast.
 * @param {string} role
 * @returns {string | null}
 */
export function forecastReasonRole(role) {
  return FORECAST_REASON_ROLES.includes(role) ? role : null;
}

const INT_MIN = -2147483648;
const INT_MAX = 2147483647;
const whole = (/** @type {unknown} */ value) =>
  typeof value === "number" && Number.isInteger(value) && value >= INT_MIN && value <= INT_MAX;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const revision = (value) => Number.isSafeInteger(value) && value >= 0 && value < Number.MAX_SAFE_INTEGER;

/**
 * A POST body, checked: the world generation the browser counted in, and today's snapshot or a
 * day's reason (or both). Null when anything is missing or out of shape.
 * @param {any} body
 * Legacy bodies can still be parsed, but the store refuses writes without the retry identity and
 * reason baseline. This lets an older tab receive an explicit review/upgrade response.
 * @returns {{ generation: number, scopeKey?: string, operationId?: string, expectedDayVersion?: number, snapshot?: { day: number, at: number, nowGap: number, tomorrow: { low: number, likely: number, high: number } }, reason?: { day: number, reason: string, by: string, at: number } } | null}
 */
export function forecastHistoryInput(body) {
  if (typeof body !== "object" || body === null) return null;
  const { generation, snapshot, reason } = body;
  if (!(typeof generation === "number" && Number.isSafeInteger(generation) && generation >= 0)) return null;
  if (snapshot === undefined && reason === undefined) return null;
  /** @type {ReturnType<typeof forecastHistoryInput>} */
  const input = { generation };
  if (body.scopeKey !== undefined) {
    if (typeof body.scopeKey !== "string" || !/^[0-9a-f]{64}$/i.test(body.scopeKey)) return null;
    input.scopeKey = body.scopeKey.toLowerCase();
  }
  if (body.operationId !== undefined) {
    if (typeof body.operationId !== "string" || !UUID.test(body.operationId)) return null;
    input.operationId = body.operationId.toLowerCase();
  }
  if (body.expectedDayVersion !== undefined) {
    if (!revision(body.expectedDayVersion)) return null;
    input.expectedDayVersion = body.expectedDayVersion;
  }
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
 * The workspace lock and transaction are shared with ordinary commands. That makes a history's
 * revision and rows one authoritative snapshot, fences resets and access changes, and commits
 * each write with its retry receipt and audit. Before 17 shared history is explicitly read-only.
 * @typedef {{ client: { query: (sql: string, params?: any[]) => Promise<{ rows: any[], rowCount?: number | null }> }, generation: number, revision: number, advance: () => Promise<number>, audit: (entry: any) => Promise<void> }} ForecastContext
 * @param {{
 *   workspaceId: string,
 *   schemaVersion: () => Promise<number>,
 *   withWorkspace: (view: any, write: boolean, run: (context: ForecastContext) => Promise<any>) => Promise<any>,
 *   forgetVersionOnMissing: (error: any) => void,
 * }} dependencies
 */
export function forecastHistoryStore({ workspaceId, schemaVersion, withWorkspace, forgetVersionOnMissing }) {
  const query = (/** @type {ForecastContext} */ context, /** @type {string} */ sql, /** @type {any[]} */ params) =>
    context.client.query(sql, params).catch((error) => {
      forgetVersionOnMissing(error);
      throw error;
    });

  async function history(view, context, writable) {
    const scopeKey = forecastScopeKey(view);
    const { generation } = context;
    if (!revision(context.revision) || context.revision < 1) throw new Error("Forecast revision unavailable");
    const [snapshots, reasons] = await Promise.all([
      query(
        context,
        `SELECT demo_day, taken_at, ready_gap_now, tomorrow_low, tomorrow_likely, tomorrow_high FROM ward_flow.forecast_snapshots WHERE workspace_id=$1 AND data_mode='prototype' AND world_generation=$2 AND scope_key=$3 ORDER BY demo_day DESC LIMIT ${FORECAST_SNAPSHOT_LIMIT}`,
        [workspaceId, generation, scopeKey],
      ),
      query(
        context,
        `SELECT demo_day, reason, chosen_by, chosen_at, ${writable ? "revision" : "1 AS revision"} FROM ward_flow.forecast_miss_reasons WHERE workspace_id=$1 AND data_mode='prototype' AND world_generation=$2 AND scope_key=$3 ORDER BY demo_day DESC LIMIT ${FORECAST_REASON_LIMIT}`,
        [workspaceId, generation, scopeKey],
      ),
    ]);
    return {
      shared: true,
      generation,
      scopeKey,
      historyRevision: context.revision,
      writable,
      reasonVersions: Object.fromEntries(reasons.rows.map((row) => [String(row.demo_day), Number(row.revision)])),
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
      const version = await schemaVersion();
      if (version < FORECAST_HISTORY_MIGRATION) return { shared: false };
      return withWorkspace(view, false, (context) => history(view, context, version >= FORECAST_CONSISTENCY_MIGRATION));
    },
    /**
     * A deliberate reason change compares the server version of that day. An identical retry
     * returns its original outcome and the current history, even after someone else's newer save.
     * Client timestamps describe the choice only; they never decide which write wins.
     * @param {any} view
     * @param {NonNullable<ReturnType<typeof forecastHistoryInput>>} input
     */
    async recordForecast(view, input) {
      const version = await schemaVersion();
      if (version < FORECAST_HISTORY_MIGRATION) return { status: 200, body: { shared: false } };
      const writable = version >= FORECAST_CONSISTENCY_MIGRATION;
      return withWorkspace(view, writable, async (context) => {
        const answer = async (status, metadata) => ({
          status,
          body: {
            ...(await history(view, context, writable)),
            ...(input.operationId ? { operationId: input.operationId } : {}),
            ...metadata,
          },
        });
        if (!writable)
          return answer(409, {
            outcome: "conflict",
            code: "forecast-upgrade-required",
            error:
              "Shared forecast saves are unavailable until the server is upgraded. Your choice has not been saved.",
          });
        if (context.generation !== input.generation)
          return answer(409, {
            outcome: "conflict",
            code: "world-changed",
            error: "The demonstration was reset. Read the board again.",
          });
        if (!input.operationId || !input.scopeKey || (input.reason && input.expectedDayVersion === undefined))
          return answer(409, {
            outcome: "conflict",
            code: "forecast-version-required",
            error: "Read the latest forecast history before saving this choice.",
          });
        const scopeKey = forecastScopeKey(view);
        if (input.scopeKey !== scopeKey)
          return answer(409, {
            outcome: "conflict",
            operationId: input.operationId,
            code: "forecast-scope-changed",
            error: "Your desk's scope changed. Review the current history before saving this choice.",
          });
        if (input.reason) {
          const by = forecastReasonRole(view.access.role);
          if (!by) return answer(403, { error: "This desk does not record forecast reasons." });
          input = { ...input, reason: { ...input.reason, by } };
        }

        const fingerprint = createHash("sha256")
          .update(JSON.stringify({ kind: "forecast-history", scopeKey, ...input }))
          .digest("hex");
        const identity = [workspaceId, view.actorId, input.operationId];
        const previous = await query(
          context,
          "SELECT fingerprint, status, result FROM ward_flow.commands WHERE workspace_id=$1 AND actor_id=$2 AND command_id=$3",
          identity,
        );
        if (previous.rowCount) {
          const receipt = previous.rows[0];
          if (receipt.fingerprint !== fingerprint || receipt.result.kind !== "forecast-history")
            return answer(422, {
              outcome: "conflict",
              operationId: input.operationId,
              code: "forecast-operation-reused",
              error: "This save reference was already used for another change. Review the latest history.",
            });
          const { kind: _kind, ...metadata } = receipt.result;
          return answer(receipt.status, { ...metadata, replayed: true });
        }

        let status = 200;
        let code;
        let error;
        let before = null;
        let reasonSaved = false;
        let snapshotSaved = false;
        const { reason, snapshot } = input;
        const nextRevision = context.revision + 1;
        if (!revision(nextRevision)) throw new Error("Forecast revision unavailable");
        if (reason) {
          const current = await query(
            context,
            "SELECT reason, chosen_by, chosen_at, revision FROM ward_flow.forecast_miss_reasons WHERE workspace_id=$1 AND world_generation=$2 AND scope_key=$3 AND demo_day=$4",
            [workspaceId, context.generation, scopeKey, reason.day],
          );
          before = current.rows[0] ?? null;
          if (Number(before?.revision ?? 0) !== input.expectedDayVersion) status = 409;
          else {
            const saved = await query(
              context,
              "INSERT INTO ward_flow.forecast_miss_reasons(workspace_id, world_generation, scope_key, demo_day, reason, chosen_by, chosen_at, actor_id, revision) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (workspace_id, world_generation, scope_key, demo_day) DO UPDATE SET reason=EXCLUDED.reason, chosen_by=EXCLUDED.chosen_by, chosen_at=EXCLUDED.chosen_at, actor_id=EXCLUDED.actor_id, revision=EXCLUDED.revision, updated_at=now() WHERE ward_flow.forecast_miss_reasons.revision = $10 RETURNING revision",
              [
                workspaceId,
                context.generation,
                scopeKey,
                reason.day,
                reason.reason,
                reason.by,
                reason.at,
                view.actorId,
                nextRevision,
                input.expectedDayVersion,
              ],
            );
            reasonSaved = Boolean(saved.rowCount);
            if (!reasonSaved) status = 409;
          }
        }
        if (status === 409) {
          code = "forecast-conflict";
          error = "Another desk changed this day's reason. Review their choice before saving again.";
        } else if (snapshot) {
          const saved = await query(
            context,
            "INSERT INTO ward_flow.forecast_snapshots(workspace_id, world_generation, scope_key, demo_day, taken_at, ready_gap_now, tomorrow_low, tomorrow_likely, tomorrow_high) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING RETURNING demo_day",
            [
              workspaceId,
              context.generation,
              scopeKey,
              snapshot.day,
              snapshot.at,
              snapshot.nowGap,
              snapshot.tomorrow.low,
              snapshot.tomorrow.likely,
              snapshot.tomorrow.high,
            ],
          );
          snapshotSaved = Boolean(saved.rowCount);
        }
        const priorRevision = context.revision;
        if (reasonSaved || snapshotSaved) await context.advance();
        const metadata = {
          outcome: status === 200 ? "accepted" : "conflict",
          operationId: input.operationId,
          commandRevision: context.revision,
          ...(code ? { code, error } : {}),
        };
        await context.audit({
          action: reason ? "RECORD_FORECAST_REASON" : "RECORD_FORECAST_SNAPSHOT",
          outcome: status === 200 ? "accepted" : "stale",
          commandId: input.operationId,
          priorRevision,
          revision: context.revision,
          changes: {
            forecast: {
              scopeKey,
              generation: context.generation,
              reason: reasonSaved ? { before, after: reason, revision: context.revision } : null,
              snapshot: snapshotSaved ? snapshot : null,
            },
          },
        });
        await query(
          context,
          "INSERT INTO ward_flow.commands(workspace_id, actor_id, command_id, fingerprint, status, result) VALUES ($1,$2,$3,$4,$5,$6)",
          [...identity, fingerprint, status, { kind: "forecast-history", ...metadata }],
        );
        return answer(status, metadata);
      });
    },
  };
}
