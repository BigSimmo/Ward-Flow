import type { ForecastHistoryEntry } from "./forecast-history";
import type { ForecastMissReasonEntry } from "./forecast-miss-reasons";

export type ForecastWriteInput = { operationId: string; scopeKey: string } & (
  { snapshot: ForecastHistoryEntry } | { reason: ForecastMissReasonEntry; expectedDayVersion: number }
);

export type ForecastWriteResult = { status: "accepted" | "conflict" | "failed" | "unavailable" | "cancelled" };

export type ForecastSharedMetadata = {
  scopeKey: string | null;
  historyRevision: number | null;
  writable: boolean;
  reasonVersions: Record<string, number>;
};

export const forecastOperationId = () => globalThis.crypto.randomUUID();
export const forecastVersion = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

/** Legacy history stays readable; writes require the versioned server contract. */
export function forecastSharedMetadata(value: Record<string, unknown>): ForecastSharedMetadata {
  const scopeKey = typeof value.scopeKey === "string" && /^[a-f0-9]{64}$/.test(value.scopeKey) ? value.scopeKey : null;
  const historyRevision = forecastVersion(value.historyRevision) ? value.historyRevision : null;
  const reasonVersions: Record<string, number> = {};
  if (value.reasonVersions && typeof value.reasonVersions === "object")
    for (const [day, version] of Object.entries(value.reasonVersions))
      if (/^-?\d+$/.test(day) && Number.isSafeInteger(Number(day)) && forecastVersion(version))
        reasonVersions[day] = version;
  return {
    scopeKey,
    historyRevision,
    writable: value.writable === true && scopeKey !== null && historyRevision !== null,
    reasonVersions,
  };
}

/** Preserve only recognised business refusals; callers must still check the outcome and receipt. */
export function forecastHistoryResponse(response: { ok: boolean; status: number }, value: unknown): unknown {
  const code = value && typeof value === "object" ? (value as { code?: unknown }).code : undefined;
  if (
    response.ok ||
    (response.status === 409 &&
      [
        "forecast-conflict",
        "forecast-upgrade-required",
        "forecast-scope-changed",
        "forecast-version-required",
      ].includes(String(code))) ||
    (response.status === 422 && code === "forecast-operation-reused")
  )
    return value;
  throw new Error("Forecast history could not be read");
}
