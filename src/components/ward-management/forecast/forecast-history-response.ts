/** Preserve the forecast endpoint's conflict record without converting its revision token. */
export function forecastHistoryFailure(value: unknown): Error & { code?: unknown; history?: unknown } {
  const body = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return Object.assign(new Error(typeof body.error === "string" ? body.error : "Forecast history could not be read"), {
    code: typeof body.code === "string" ? body.code : undefined,
    history: body.history,
  });
}
