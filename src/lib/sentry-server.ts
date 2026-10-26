// Optional server-side Sentry error reporting. Off unless SENTRY_DSN is set.
//
// Uses the lean @sentry/core server client rather than @sentry/nextjs, which
// would add the Sentry CLI, bundler plugins and native parsers to production
// dependencies. Server only: no browser SDK, no CSP origin and no phone bundle
// weight. Every event is scrubbed to error type, stack frames and the
// allow-listed tags below. Messages, request data, users, breadcrumbs and
// extras are dropped, so typed text and record content cannot leave the server.
import type {
  BaseTransportOptions,
  ClientOptions,
  ErrorEvent,
  Log,
  Transport,
  TransportMakeRequestResponse,
} from "@sentry/core";
import {
  createStackParser,
  createTransport,
  dedupeIntegration,
  getCurrentScope,
  linkedErrorsIntegration,
  logger as sentryLogs,
} from "@sentry/core";
import { nodeStackLineParser, ServerRuntimeClient } from "@sentry/core/server";
import { registerSentryLogForwarder } from "./logger";

const REDACTED = "[redacted]";
const ALLOWED_TAGS = new Set(["incidentId", "method", "routerKind", "routeType"]);
const ALLOWED_CONTEXTS = new Set(["runtime", "os", "app"]);

type Env = Record<string, string | undefined>;

export type ServerSentrySettings = {
  dsn: string;
  environment: string;
  release?: string;
  enableLogs: boolean;
};

/** Read the opt-in settings. Returns null (reporting off) without a DSN or under tests. */
export function serverSentrySettings(env: Env): ServerSentrySettings | null {
  const dsn = env.SENTRY_DSN?.trim();
  if (!dsn || env.NODE_ENV === "test") return null;
  return {
    dsn,
    environment: env.SENTRY_ENVIRONMENT?.trim() || env.NODE_ENV || "production",
    release: env.SENTRY_RELEASE?.trim() || env.RAILWAY_GIT_COMMIT_SHA?.trim() || undefined,
    enableLogs: env.SENTRY_ENABLE_LOGS !== "false",
  };
}

/** Reduce an event to error types, stack frames and allow-listed tags. */
export function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  const tags = Object.fromEntries(Object.entries(event.tags ?? {}).filter(([key]) => ALLOWED_TAGS.has(key)));
  const contexts = Object.fromEntries(
    Object.entries(event.contexts ?? {}).filter(([key]) => ALLOWED_CONTEXTS.has(key)),
  );
  const values = event.exception?.values?.map((value) => ({
    type: value.type,
    value: value.value === undefined ? undefined : REDACTED,
    mechanism: value.mechanism,
    stacktrace: value.stacktrace && {
      frames: value.stacktrace.frames?.map((frame) => ({
        filename: frame.filename,
        module: frame.module,
        function: frame.function,
        lineno: frame.lineno,
        colno: frame.colno,
        in_app: frame.in_app,
      })),
    },
  }));
  return {
    type: event.type,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    level: event.level,
    environment: event.environment,
    release: event.release,
    sdk: event.sdk,
    tags,
    contexts,
    ...(values ? { exception: { values } } : {}),
  } as ErrorEvent;
}

/** Logs arrive already redacted by logger.ts; keep only the event name and those attributes. */
function scrubSentryLog(log: Log): Log {
  return { level: log.level, message: log.message, attributes: log.attributes };
}

function fetchTransport(options: BaseTransportOptions): Transport {
  return createTransport(options, async (request): Promise<TransportMakeRequestResponse> => {
    const response = await fetch(options.url, {
      method: "POST",
      body: request.body as BodyInit,
      headers: options.headers,
    });
    return {
      statusCode: response.status,
      headers: {
        "x-sentry-rate-limits": response.headers.get("X-Sentry-Rate-Limits"),
        "retry-after": response.headers.get("Retry-After"),
      },
    };
  });
}

// PS-13 (H-0961): at most one report per kind every 5 minutes, like the backend's
// error-report.mjs, so an outage cannot use up the Sentry quota in hours.
export const SERVER_REPORT_INTERVAL_MS = 5 * 60 * 1000;
const REPORT_KINDS_KEPT = 500;
const lastReported = new Map<string, number>();

/** True when this kind of report has not been sent in the last five minutes. */
export function allowServerReport(kind: string, at: number = Date.now()): boolean {
  const last = lastReported.get(kind);
  if (last !== undefined && at - last < SERVER_REPORT_INTERVAL_MS) return false;
  if (lastReported.size >= REPORT_KINDS_KEPT && last === undefined) {
    const oldest = lastReported.keys().next().value;
    if (oldest !== undefined) lastReported.delete(oldest);
  }
  lastReported.delete(kind);
  lastReported.set(kind, at);
  return true;
}

/** Test hook: forget every kind already reported. */
export function resetServerReportThrottle() {
  lastReported.clear();
}

function failureKind(error: unknown, tags: Record<string, string>): string {
  const name = error instanceof Error ? error.name : typeof error;
  return `failure:${name}:${tags.routeType ?? ""}:${tags.method ?? ""}`;
}

let client: ServerRuntimeClient | null = null;

/** Start reporting when SENTRY_DSN is set. Safe to call more than once. */
export function startServerSentry(env: Env = process.env): boolean {
  if (client) return true;
  const settings = serverSentrySettings(env);
  if (!settings) return false;
  const options: ClientOptions = {
    dsn: settings.dsn,
    environment: settings.environment,
    release: settings.release,
    // Collect nothing beyond the error itself; beforeSend drops the rest regardless.
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
    traceLifecycle: "static",
    integrations: [dedupeIntegration(), linkedErrorsIntegration()],
    stackParser: createStackParser(nodeStackLineParser()),
    transport: fetchTransport,
    beforeBreadcrumb: () => null,
    beforeSend: scrubSentryEvent,
    beforeSendLog: scrubSentryLog,
  };
  client = new ServerRuntimeClient(options);
  getCurrentScope().setClient(client);
  client.init();
  // logger.ts warn/error lines go to Sentry Logs unless SENTRY_ENABLE_LOGS=false.
  if (settings.enableLogs) {
    registerSentryLogForwarder((level, message, context) => {
      if (allowServerReport(`log:${level}:${message}`)) sentryLogs[level](message, context);
    });
  }
  return true;
}

/** Report a server failure with allow-listed tags only. No-op when reporting is off. */
export function captureServerFailure(error: unknown, tags: Record<string, string>) {
  if (!client) return;
  if (!allowServerReport(failureKind(error, tags))) return;
  const scope = getCurrentScope().clone();
  scope.setTags(tags);
  client.captureException(error, undefined, scope);
}
