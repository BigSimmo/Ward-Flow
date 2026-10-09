import { SHARED_BUILD_HEADER, SHARED_EVENT_MAX_BYTES } from "@/components/ward-management/shared/ward-flow-shared-core";

import {
  accessCodeMatches,
  accessCookieHeader,
  accessTokenValid,
  issueAccessToken,
  readCookie,
  SHARED_ACCESS_COOKIE,
} from "./access";
import type { SharedConfig } from "./config";
import type { SharedWorldService } from "./service";

/**
 * The shared-state route handlers without Next around them, so tests call them with a plain
 * `Request`. The files under `src/app/api/ward-flow/shared/` only wire these to the runtime.
 *
 * Responses carry codes, never stored content, exception text or the access code.
 */

export type SharedHttpDeps = {
  config: SharedConfig;
  /** Built on first use, so a disabled or locked server never opens a database connection. */
  service: () => SharedWorldService;
  nowSeconds?: () => number;
  /** Pause before answering a wrong access code, to slow guessing. */
  failureDelayMs?: number;
  log?: (message: string) => void;
};

const BODY_LIMIT_BYTES = SHARED_EVENT_MAX_BYTES + 1024;

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

const disabled = () => json(404, { error: "shared_state_disabled" });

type Gate = { ok: true; service: SharedWorldService } | { ok: false; response: Response };

function gate(request: Request, deps: SharedHttpDeps, options: { requireAccess: boolean }): Gate {
  const config = deps.config;
  if (!config.enabled) return { ok: false, response: disabled() };
  if (!config.ready) return { ok: false, response: json(503, { error: "shared_state_not_configured" }) };
  if (request.headers.get(SHARED_BUILD_HEADER) !== config.buildId)
    return { ok: false, response: json(426, { error: "reload_required" }) };
  if (options.requireAccess) {
    const token = readCookie(request.headers.get("cookie"), SHARED_ACCESS_COOKIE);
    const nowSeconds = (deps.nowSeconds ?? (() => Math.floor(Date.now() / 1000)))();
    if (!accessTokenValid(token, config.accessCode, nowSeconds))
      return { ok: false, response: json(401, { error: "access_required" }) };
  }
  return { ok: true, service: deps.service() };
}

async function readJsonBody(
  request: Request,
): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json"))
    return { ok: false, response: json(415, { error: "json_required" }) };
  const text = await request.text();
  if (text.length > BODY_LIMIT_BYTES) return { ok: false, response: json(413, { error: "too_large" }) };
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, response: json(400, { error: "bad_request" }) };
  }
}

function field(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

function unavailable(deps: SharedHttpDeps, error: unknown): Response {
  // The error name only: never a message that could quote a payload or a connection string.
  deps.log?.(`ward-flow shared state unavailable: ${error instanceof Error ? error.name : "unknown"}`);
  return json(503, { error: "shared_state_unavailable" });
}

function isSecureRequest(request: Request): boolean {
  if (request.headers.get("x-forwarded-proto") === "https") return true;
  try {
    if (new URL(request.url).protocol === "https:") return true;
  } catch {
    // fall through
  }
  return process.env.NODE_ENV === "production";
}

/** POST access: `{ code }` → 204 with the signed cookie, or 401 after a short pause. */
export async function handleSharedAccess(request: Request, deps: SharedHttpDeps): Promise<Response> {
  const config = deps.config;
  if (!config.enabled) return disabled();
  if (!config.ready) return json(503, { error: "shared_state_not_configured" });
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  if (!accessCodeMatches(field(body.value, "code"), config.accessCode)) {
    await new Promise((resolve) => setTimeout(resolve, deps.failureDelayMs ?? 400));
    return json(401, { error: "access_denied" });
  }
  const nowSeconds = (deps.nowSeconds ?? (() => Math.floor(Date.now() / 1000)))();
  return new Response(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
      "Set-Cookie": accessCookieHeader(issueAccessToken(config.accessCode, nowSeconds), isSecureRequest(request)),
    },
  });
}

/** POST join: `{ dayZeroMs, stateVersion }` → the world at its head. */
export async function handleSharedJoin(request: Request, deps: SharedHttpDeps): Promise<Response> {
  const checked = gate(request, deps, { requireAccess: true });
  if (!checked.ok) return checked.response;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  try {
    const result = await checked.service.join({
      dayZeroMs: field(body.value, "dayZeroMs"),
      stateVersion: field(body.value, "stateVersion"),
    });
    if (result.kind === "bad-request") return json(400, { error: "bad_request" });
    if (result.kind === "version-mismatch") return json(426, { error: "reload_required" });
    return json(200, result.body);
  } catch (error) {
    return unavailable(deps, error);
  }
}

/** GET events: `?worldId=…&after=N` → the events after N. */
export async function handleSharedEventsGet(request: Request, deps: SharedHttpDeps): Promise<Response> {
  const checked = gate(request, deps, { requireAccess: true });
  if (!checked.ok) return checked.response;
  const url = new URL(request.url);
  const afterText = url.searchParams.get("after") ?? "";
  try {
    const result = await checked.service.eventsAfter({
      worldId: url.searchParams.get("worldId"),
      after: /^\d{1,15}$/.test(afterText) ? Number(afterText) : undefined,
    });
    if (result.kind === "bad-request") return json(400, { error: "bad_request" });
    return json(200, result.body);
  } catch (error) {
    return unavailable(deps, error);
  }
}

/** POST events: `{ worldId, baseSeq, eventId, event }` → accepted, conflict or refused. */
export async function handleSharedEventsPost(request: Request, deps: SharedHttpDeps): Promise<Response> {
  const checked = gate(request, deps, { requireAccess: true });
  if (!checked.ok) return checked.response;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  try {
    const result = await checked.service.append({
      worldId: field(body.value, "worldId"),
      baseSeq: field(body.value, "baseSeq"),
      eventId: field(body.value, "eventId"),
      event: field(body.value, "event"),
    });
    switch (result.kind) {
      case "accepted":
        return json(200, { seq: result.seq, duplicate: result.duplicate });
      case "conflict":
        return json(409, { error: "conflict", headSeq: result.headSeq });
      case "refused":
        return json(422, { error: "refused" });
      case "typed-text-not-shared":
        return json(403, { error: "typed_text_not_shared" });
      case "world-replaced":
        return json(410, { error: "world_replaced", currentWorldId: result.currentWorldId });
      case "bad-request":
        return json(400, { error: "bad_request" });
    }
  } catch (error) {
    return unavailable(deps, error);
  }
}
