// Lightweight structured logger with redaction (plan item 1.2). API routes log
// operational context (status, error name, request id) but must never emit secrets
// or patient-identifying text (clinical query/answer content, emails). Values under
// sensitive keys are redacted and long strings truncated before serialization.

import { scanIdentifierText } from "@/lib/synthetic-data-guard";

type LogLevel = "debug" | "info" | "warn" | "error";

const REDACTED = "[redacted]";
const MAX_STRING_LENGTH = 512;
const MAX_DEPTH = 5;

// Keys whose values may carry secrets or PII. Matched case-insensitively as substrings.
// `query`, `question` and `answer` are deliberately unanchored: `_` and letters are
// word characters, so a `\b`-bounded `query` matched the bare key only and let
// `queryText`, `query_text`, `rawQuery`, `normalizedQuery`, `answerText` and
// `answer_text` through. Over-redacting a `queryMode`-style label is the accepted
// cost of a redaction layer that does not depend on call-site discipline.
//
// Ward Flow identity fields are included (12 October 2026 review, A4-9): record numbers (`umrn`,
// `mrn`, `ihi`, Medicare), the person's name fields (`givenName`, `familyName`, `fullName`,
// `surname`, `preferredName`), date of birth, contact details and free-text `notes`/`comment`.
// A bare `name` key is left readable: in Ward Flow it names an error class, a ward or a site.
const SENSITIVE_KEY =
  /authorization|cookie|token|secret|api[-_]?key|password|service[-_]?role|email|query|question|prompt|\bcontent\b|answer|patient|mrn|ihi|medicare|given[-_]?name|family[-_]?name|first[-_]?name|last[-_]?name|full[-_]?name|surname|preferred[-_]?name|date[-_]?of[-_]?birth|\bdob\b|phone|mobile|address|notes?\b|comment|free[-_]?text|typed/i;

// Synthetic UMRNs (two letters and six digits, `UM100001`) still identify a patient record in a
// log line, so they are redacted alongside the real identifier shapes the synthetic-data scan finds.
const WARD_FLOW_RECORD_VALUE = /\bUM\d{6}\b|\bUMRN\b/i;

function hasSensitiveValue(value: string): boolean {
  return WARD_FLOW_RECORD_VALUE.test(value) || scanIdentifierText(value) !== null;
}

function redactValue(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    if (hasSensitiveValue(value)) return REDACTED;
    return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}…[truncated]` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (depth >= MAX_DEPTH) return "[depth-limited]";
  if (value instanceof Error) return { name: value.name, message: redactValue(value.message, depth + 1) };
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redactValue(item, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactValue(val, depth + 1);
    }
    return out;
  }
  return String(value);
}

export function redactLogContext(context: Record<string, unknown>): Record<string, unknown> {
  return redactValue(context, 0) as Record<string, unknown>;
}

const LEVEL_RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

// This module is server-oriented, but bundlers that reach it from a shared module
// (or a standalone bundle such as the design-system export) inline it into browser
// code, where a bare `process.env` read throws ReferenceError and unmounts the
// React tree. Read the environment defensively instead of assuming Node.
function env(): Record<string, string | undefined> {
  return typeof process !== "undefined" && process.env ? process.env : {};
}

function activeLevel(): LogLevel {
  const configured = env().LOG_LEVEL?.toLowerCase();
  if (configured && configured in LEVEL_RANK) return configured as LogLevel;
  return env().NODE_ENV === "production" ? "info" : "debug";
}

type SentryLogForwarder = (level: "warn" | "error", message: string, context?: Record<string, unknown>) => void;

let sentryLogForwarder: SentryLogForwarder | null = null;

/**
 * Register a Sentry Logs bridge from server instrumentation after `Sentry.init`.
 * Kept as a callback so this module never imports `@sentry/nextjs` (bundler-safe).
 */
export function registerSentryLogForwarder(forwarder: SentryLogForwarder | null) {
  sentryLogForwarder = forwarder;
}

/**
 * One JSON log line. The logger's own `level`, `message` and `timestamp` are written after the
 * context, so a context key with one of those names cannot overwrite them (A4-11).
 */
export function formatLogLine(
  level: LogLevel,
  message: string,
  redactedContext?: Record<string, unknown>,
  now: Date = new Date(),
): string {
  return JSON.stringify({ ...(redactedContext ?? {}), level, message, timestamp: now.toISOString() });
}

function emit(level: LogLevel, message: string, context?: Record<string, unknown>) {
  // Keep tests quiet; they assert on responses, not log output.
  if (env().NODE_ENV === "test") return;
  if (LEVEL_RANK[level] < LEVEL_RANK[activeLevel()]) return;
  const redacted = context ? redactLogContext(context) : undefined;
  const line = formatLogLine(level, message, redacted);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  // Forward warn/error to privacy-scrubbed Sentry Logs when instrumentation registered a bridge.
  if ((level === "warn" || level === "error") && sentryLogForwarder) {
    try {
      sentryLogForwarder(level, message, redacted);
    } catch {
      // Optional observability must never interfere with request handling.
    }
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => emit("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) => emit("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => emit("error", message, context),
};
