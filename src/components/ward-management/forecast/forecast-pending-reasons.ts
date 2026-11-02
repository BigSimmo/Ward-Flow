import { parseForecastMissReasons, type ForecastMissReasonEntry } from "./forecast-miss-reasons";
import { forecastVersion } from "./forecast-shared-types";

export const FORECAST_PENDING_PREFIX = "ward-flow-forecast-pending:";
export const FORECAST_PENDING_LIMIT = 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ForecastPendingScope = { actorId: string; scopeKey: string; scenario: string; generation: number };
export type PendingForecastReason = {
  operationId: string;
  expectedDayVersion: number;
  entry: ForecastMissReasonEntry;
  status: "queued" | "failed" | "conflict";
};
type PendingStorage = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

export function forecastPendingKey(scope: ForecastPendingScope, operationId = ""): string {
  return `${FORECAST_PENDING_PREFIX}${encodeURIComponent(scope.actorId)}:${scope.scopeKey}:${encodeURIComponent(scope.scenario)}:${scope.generation}:${operationId}`;
}

/** Strictly closed values only; neither a raw API reply nor typed text can become a saved draft. */
export function parsePendingForecastReason(raw: string | null): PendingForecastReason | null {
  if (!raw || raw.length > 1024) return null;
  try {
    const value = JSON.parse(raw) as Partial<PendingForecastReason>;
    if (
      !value ||
      typeof value !== "object" ||
      Object.keys(value).length !== 4 ||
      typeof value.operationId !== "string" ||
      !UUID.test(value.operationId) ||
      !forecastVersion(value.expectedDayVersion) ||
      !["queued", "failed", "conflict"].includes(value.status ?? "")
    )
      return null;
    const [entry] = parseForecastMissReasons(JSON.stringify([value.entry]));
    return entry
      ? { operationId: value.operationId, expectedDayVersion: value.expectedDayVersion, entry, status: value.status! }
      : null;
  } catch {
    return null;
  }
}

export function samePendingForecastReason(
  current: PendingForecastReason | null,
  expected: PendingForecastReason,
): boolean {
  return (
    !!current &&
    current.operationId === expected.operationId &&
    current.expectedDayVersion === expected.expectedDayVersion &&
    current.entry.day === expected.entry.day &&
    current.entry.reason === expected.entry.reason &&
    current.entry.by === expected.entry.by &&
    current.entry.at === expected.entry.at
  );
}

function keys(storage: PendingStorage, scope: ForecastPendingScope): string[] {
  const prefix = forecastPendingKey(scope);
  const found: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(prefix)) found.push(key);
  }
  return found.sort();
}

function retainedCount(storage: PendingStorage, scope: ForecastPendingScope): number {
  const prefix = `${FORECAST_PENDING_PREFIX}${encodeURIComponent(scope.actorId)}:${scope.scopeKey}:`;
  let count = 0;
  for (let index = 0; index < storage.length; index += 1) if (storage.key(index)?.startsWith(prefix)) count += 1;
  return count;
}

export function readPendingForecastReasons(
  storage: PendingStorage,
  scope: ForecastPendingScope,
): PendingForecastReason[] {
  return keys(storage, scope)
    .slice(0, FORECAST_PENDING_LIMIT)
    .flatMap((key) => {
      const entry = parsePendingForecastReason(storage.getItem(key));
      return entry && key === forecastPendingKey(scope, entry.operationId) ? [entry] : [];
    });
}

/** Previous worlds are never replayed into this one, but remain available for explicit removal. */
export function readInactiveForecastReasons(
  storage: PendingStorage,
  scope: ForecastPendingScope,
): { scope: ForecastPendingScope; draft: PendingForecastReason }[] {
  const prefix = `${FORECAST_PENDING_PREFIX}${encodeURIComponent(scope.actorId)}:${scope.scopeKey}:`;
  const inactive: { scope: ForecastPendingScope; draft: PendingForecastReason }[] = [];
  for (let index = 0; index < storage.length && inactive.length < FORECAST_PENDING_LIMIT; index += 1) {
    const key = storage.key(index);
    if (!key?.startsWith(prefix) || key.startsWith(forecastPendingKey(scope))) continue;
    const [scenario = "", generation = "", operationId = "", extra] = key.slice(prefix.length).split(":");
    if (
      extra !== undefined ||
      !/^[a-z0-9-]{1,32}$/.test(scenario ?? "") ||
      !/^\d+$/.test(generation ?? "") ||
      !forecastVersion(Number(generation))
    )
      continue;
    const draft = parsePendingForecastReason(storage.getItem(key));
    const earlier = { ...scope, scenario, generation: Number(generation) };
    if (draft && draft.operationId === operationId && key === forecastPendingKey(earlier, operationId))
      inactive.push({ scope: earlier, draft });
  }
  return inactive;
}

/** One key per operation preserves different tabs' drafts instead of replacing a shared array. */
export function writePendingForecastReason(
  storage: PendingStorage,
  scope: ForecastPendingScope,
  pending: PendingForecastReason,
): boolean {
  if (!parsePendingForecastReason(JSON.stringify(pending))) return false;
  const key = forecastPendingKey(scope, pending.operationId);
  if (storage.getItem(key) === null && retainedCount(storage, scope) >= FORECAST_PENDING_LIMIT) return false;
  const raw = JSON.stringify(pending);
  storage.setItem(key, raw);
  return storage.getItem(key) === raw;
}

/** An acknowledgement retires its own operation only, never a later choice for the same day. */
export function removePendingForecastReason(
  storage: PendingStorage,
  scope: ForecastPendingScope,
  operationId: string,
): void {
  storage.removeItem(forecastPendingKey(scope, operationId));
}
