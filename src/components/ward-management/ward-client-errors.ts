type BrowserFrame = { filename: string; lineno: number; colno: number };
export type BrowserErrorEvent = { type: string; frames: BrowserFrame[] };
const TYPES = new Set([
  "Error",
  "TypeError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "URIError",
  "EvalError",
  "AggregateError",
  "ChunkLoadError",
  "DOMException",
]);
const reported = new Map<string, number>();

/** Never include the message, page address, user, record, breadcrumb or arbitrary stack text. */
export function browserErrorEvent(error: unknown): BrowserErrorEvent {
  const value = error instanceof Error ? error : null;
  const frames: BrowserFrame[] = [];
  for (const line of (value?.stack ?? "").slice(0, 16_000).split("\n")) {
    const match = line.match(/(https?:\/\/[^\s)]+):(\d+):(\d+)\)?$/);
    if (!match) continue;
    try {
      const path = new URL(match[1]).pathname;
      if (!/^\/_next\/static\/chunks\/(?:\d{1,10}-)?[a-f0-9]{8,64}\.js$/i.test(path)) continue;
      const lineno = Number(match[2]);
      const colno = Number(match[3]);
      if (
        !Number.isSafeInteger(lineno) ||
        lineno <= 0 ||
        lineno > 10_000_000 ||
        !Number.isSafeInteger(colno) ||
        colno < 0 ||
        colno > 10_000_000
      )
        continue;
      frames.push({ filename: path, lineno, colno });
      if (frames.length === 20) break;
    } catch {
      /* A malformed frame is omitted. */
    }
  }
  return { type: TYPES.has(value?.name ?? "") ? value!.name : "Error", frames };
}

/** Lazy callers load this only after an error. Reporting is opt-in and never retried. */
export async function reportBrowserError(error: unknown): Promise<void> {
  if (process.env.NEXT_PUBLIC_WARD_CLIENT_ERROR_REPORTING !== "true") return;
  const event = browserErrorEvent(error);
  const now = Date.now();
  if (now - (reported.get(event.type) ?? -Infinity) < 300_000) return;
  reported.set(event.type, now);
  try {
    await fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      credentials: "same-origin",
      redirect: "error",
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    /* Diagnostics must never interfere with recovery. */
  }
}
