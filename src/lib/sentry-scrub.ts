import type { ErrorEvent } from "@sentry/core";

const ERROR_TYPES = new Set([
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
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROUTE_TYPES = new Set(["render", "route", "route-handler", "api", "action", "middleware"]);

function filename(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const path = value.replace(/^https?:\/\/[^/]+/, "").split(/[?#]/)[0];
  // Hash-only build assets cannot smuggle record text through a path that merely contains a hash.
  if (/^\/_next\/static\/chunks\/(?:\d{1,10}-)?[a-f0-9]{8,64}\.js$/i.test(path)) return path;
  if (["app.js", "main.js", "webpack.js"].includes(path)) return path;
  return "[redacted]";
}

/** Only bounded, independently validated diagnostic fields may cross the reporting boundary. */
export function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  const tags: Record<string, string> = {};
  for (const [key, value] of Object.entries(event.tags ?? {})) {
    if (typeof value !== "string") continue;
    if (
      (key === "incidentId" && UUID.test(value)) ||
      (key === "method" && /^(GET|POST|DELETE|PUT|PATCH|HEAD|OPTIONS)$/.test(value)) ||
      (key === "routeType" && ROUTE_TYPES.has(value)) ||
      (key === "routerKind" && ["App Router", "Pages Router", "app", "pages"].includes(value))
    )
      tags[key] = value;
  }
  const runtime = event.contexts?.runtime;
  const contexts =
    runtime && ["node", "browser"].includes(String(runtime.name))
      ? {
          runtime: {
            name: runtime.name,
            ...(typeof runtime.version === "string" && /^v?\d+(?:\.\d+){0,3}$/.test(runtime.version)
              ? { version: runtime.version }
              : {}),
          },
        }
      : {};
  return {
    ...(event.event_id && /^[a-f0-9]{32}$/i.test(event.event_id) ? { event_id: event.event_id } : {}),
    ...(typeof event.timestamp === "number" && Number.isFinite(event.timestamp) ? { timestamp: event.timestamp } : {}),
    ...(event.level && ["fatal", "error", "warning", "log", "info", "debug"].includes(event.level)
      ? { level: event.level }
      : {}),
    ...(event.environment && ["production", "staging", "demo", "development", "test"].includes(event.environment)
      ? { environment: event.environment }
      : {}),
    ...(event.release && /^[a-f0-9]{7,40}$/i.test(event.release) ? { release: event.release } : {}),
    tags,
    contexts,
    ...(event.exception?.values
      ? {
          exception: {
            values: event.exception.values.slice(0, 5).map((value) => ({
              type: ERROR_TYPES.has(value.type ?? "") ? value.type : "Error",
              ...(value.value === undefined ? {} : { value: "[redacted]" }),
              ...(value.stacktrace
                ? {
                    stacktrace: {
                      frames: value.stacktrace.frames?.slice(-50).map((frame) => ({
                        filename: filename(frame.filename),
                        ...(Number.isSafeInteger(frame.lineno) && frame.lineno! > 0 ? { lineno: frame.lineno } : {}),
                        ...(Number.isSafeInteger(frame.colno) && frame.colno! >= 0 ? { colno: frame.colno } : {}),
                        ...(typeof frame.in_app === "boolean" ? { in_app: frame.in_app } : {}),
                      })),
                    },
                  }
                : {}),
            })),
          },
        }
      : {}),
  } as ErrorEvent;
}
