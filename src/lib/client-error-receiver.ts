// TE-04: the server half of browser error reporting (src/lib/browser-error-report.ts). The route
// (src/app/api/client-error/route.ts) hands each request here. A report must be exactly the four
// closed fields, each from its allow-list; anything else is refused unread. Accepted reports go to
// the server log as one `ward.client_error` line, like `ward.request_failed` in instrumentation.ts.
import { logger } from "@/lib/logger";

/**
 * Every page's route template, ids as `[id]`. tests/client-error-report.test.ts keeps this in step
 * with src/app: a new page adds its line here. A screen outside the list is logged as `other`.
 */
export const CLIENT_ROUTE_TEMPLATES: ReadonlySet<string> = new Set([
  "/",
  "/mockups/ward-flow-redesign",
  "/mockups/ward-flow-redesign/[id]",
  "/sign-in",
  "/bedchart",
  "/bedchart-sign-in",
  "/bedchart/activity",
  "/bedchart/alerts",
  "/bedchart/bed-meeting",
  "/bedchart/bed-meeting/agenda",
  "/bedchart/board/[id]",
  "/bedchart/capacity",
  "/bedchart/command",
  "/bedchart/community",
  "/bedchart/community/[id]",
  "/bedchart/constellation",
  "/bedchart/delays",
  "/bedchart/discharges",
  "/bedchart/ed",
  "/bedchart/ed/[id]",
  "/bedchart/escalation",
  "/bedchart/exceptions",
  "/bedchart/governance",
  "/bedchart/handover",
  "/bedchart/help",
  "/bedchart/hub",
  "/bedchart/hub/catchments",
  "/bedchart/leave",
  "/bedchart/legal-forms",
  "/bedchart/movements",
  "/bedchart/movements/[id]",
  "/bedchart/network",
  "/bedchart/night",
  "/bedchart/about",
  "/bedchart/on-call",
  "/bedchart/out-of-area",
  "/bedchart/people/[id]",
  "/bedchart/people/[id]/triage",
  "/bedchart/people/new",
  "/bedchart/queue",
  "/bedchart/referrals",
  "/bedchart/referrals/new",
  "/bedchart/reports/chronology",
  "/bedchart/reports/downtime",
  "/bedchart/review",
  "/bedchart/search",
  "/bedchart/seclusion",
  "/bedchart/settings",
  "/bedchart/statistics",
  "/bedchart/statistics/community/[id]",
  "/bedchart/statistics/compare",
  "/bedchart/statistics/ed/[id]",
  "/bedchart/statistics/eds",
  "/bedchart/statistics/overview",
  "/bedchart/statistics/service/[id]",
  "/bedchart/statistics/services",
  "/bedchart/statistics/teams",
  "/bedchart/statistics/ward/[id]",
  "/bedchart/statistics/wards",
  "/bedchart/statistics/weekly",
  "/bedchart/transport",
  "/bedchart/transport/officer",
  "/bedchart/triage/new",
  "/bedchart/waiting",
  "/bedchart/ward/[id]",
  "/bedchart/ward/[id]/answer",
  "/bedchart/wards",
]);

const FIELDS = ["type", "route", "release", "role"] as const;
const CODE_NAME = /^[A-Za-z_$][\w$]{0,63}$/;
const RELEASE = /^[A-Za-z0-9_.-]{1,40}$/;
/** WARD_ACCESS_ROLES (ward-role-access.ts) plus `none`; host code may not import ward code, so the
 * test keeps this copy in step. */
export const CLIENT_ERROR_ROLES: ReadonlySet<string> = new Set([
  "coordinator",
  "bed_manager",
  "ward",
  "ed",
  "community",
  "officer",
  "executive",
  "admin",
  "none",
]);
const BODY_BYTES = 512;
/** Lines a minute, across every browser, and each kind once a minute. */
export const CLIENT_ERROR_LINES_PER_MINUTE = 30;
const KINDS_KEPT = 200;

type ClientErrorFields = Record<(typeof FIELDS)[number], string>;

/** The four allow-listed fields, or null for anything else. An unlisted screen becomes `other`. */
function parseClientErrorReport(value: unknown): ClientErrorFields | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const keys = Object.keys(value);
  if (keys.length !== FIELDS.length || !FIELDS.every((field) => keys.includes(field))) return null;
  const { type, route, release, role } = value as Record<string, unknown>;
  if (typeof type !== "string" || !CODE_NAME.test(type)) return null;
  if (typeof route !== "string" || route.length > 80) return null;
  if (typeof release !== "string" || !RELEASE.test(release)) return null;
  if (typeof role !== "string" || !CLIENT_ERROR_ROLES.has(role)) return null;
  return { type, route: CLIENT_ROUTE_TEMPLATES.has(route) ? route : "other", release, role };
}

let windowStart = 0;
let linesThisWindow = 0;
const lastLogged = new Map<string, number>();

/** True when this kind may be logged now: under the per-minute cap and not logged in the last minute. */
function allowClientErrorLine(kind: string, at: number = Date.now()): boolean {
  if (at - windowStart >= 60_000) {
    windowStart = at;
    linesThisWindow = 0;
  }
  if (linesThisWindow >= CLIENT_ERROR_LINES_PER_MINUTE) return false;
  const last = lastLogged.get(kind);
  if (last !== undefined && at - last < 60_000) return false;
  if (last === undefined && lastLogged.size >= KINDS_KEPT) lastLogged.delete(lastLogged.keys().next().value!);
  lastLogged.delete(kind);
  lastLogged.set(kind, at);
  linesThisWindow += 1;
  return true;
}

/** Test hook: forget the rate limit. */
export function resetClientErrorLimit() {
  windowStart = 0;
  linesThisWindow = 0;
  lastLogged.clear();
}

const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const answer = (status: number) => new Response(null, { status, headers: HEADERS });

/** 204 when taken (or quietly dropped as a repeat), 400 or 413 when refused, 429 over the cap. */
export async function receiveClientError(request: Request): Promise<Response> {
  if (!/^application\/json\b/i.test(request.headers.get("content-type") ?? "")) return answer(400);
  const length = request.headers.get("content-length");
  if (length === null || !/^\d+$/.test(length.trim())) return answer(400);
  if (Number(length) > BODY_BYTES) return answer(413);
  let fields: ClientErrorFields | null;
  try {
    const text = await request.text();
    if (text.length > BODY_BYTES) return answer(413);
    fields = parseClientErrorReport(JSON.parse(text));
  } catch {
    return answer(400);
  }
  if (!fields) return answer(400);
  const kind = `${fields.type} ${fields.route} ${fields.release} ${fields.role}`;
  if (linesThisWindow >= CLIENT_ERROR_LINES_PER_MINUTE && Date.now() - windowStart < 60_000) return answer(429);
  if (allowClientErrorLine(kind))
    logger.error("ward.client_error", {
      errorType: fields.type,
      route: fields.route,
      release: fields.release,
      role: fields.role,
    });
  return answer(204);
}
