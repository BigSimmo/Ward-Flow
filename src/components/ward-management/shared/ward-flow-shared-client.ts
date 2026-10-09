import type { WardFlowEvent } from "../ward-flow-events";
import {
  SHARED_API_BASE,
  SHARED_BUILD_HEADER,
  type SharedEventsResponse,
  type SharedJoinResponse,
} from "./ward-flow-shared-core";

/**
 * The browser's calls to the shared-state API. Each returns a small tagged result and never throws:
 * a network failure is `offline`, so the sync loop can keep the person's work queued and retry.
 */

export type SharedCallFailure =
  { kind: "locked" } | { kind: "reload-required" } | { kind: "unavailable" } | { kind: "offline" };

type Fetcher = typeof fetch;

function failureFor(status: number): SharedCallFailure {
  if (status === 401) return { kind: "locked" };
  if (status === 426) return { kind: "reload-required" };
  return { kind: "unavailable" };
}

async function call(
  fetcher: Fetcher,
  buildId: string,
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
): Promise<
  | { ok: true; status: number; body: unknown }
  | { ok: false; failure: SharedCallFailure; status?: number; body?: unknown }
> {
  let response: Response;
  try {
    response = await fetcher(`${SHARED_API_BASE}${path}`, {
      method: init.method,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        [SHARED_BUILD_HEADER]: buildId,
        ...(init.body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    return { ok: false, failure: { kind: "offline" } };
  }
  let body: unknown = null;
  try {
    body = response.status === 204 ? null : await response.json();
  } catch {
    body = null;
  }
  if (response.ok) return { ok: true, status: response.status, body };
  return { ok: false, failure: failureFor(response.status), status: response.status, body };
}

export async function submitSharedAccessCode(
  code: string,
  buildId: string,
  fetcher: Fetcher = fetch,
): Promise<{ kind: "ok" } | { kind: "wrong-code" } | SharedCallFailure> {
  const result = await call(fetcher, buildId, "/access", { method: "POST", body: { code } });
  if (result.ok) return { kind: "ok" };
  if (result.status === 401) return { kind: "wrong-code" };
  return result.failure;
}

export async function joinSharedWorld(
  input: { dayZeroMs: number; stateVersion: number },
  buildId: string,
  fetcher: Fetcher = fetch,
): Promise<{ kind: "ok"; body: SharedJoinResponse } | SharedCallFailure> {
  const result = await call(fetcher, buildId, "/join", { method: "POST", body: input });
  if (!result.ok) return result.failure;
  return { kind: "ok", body: result.body as SharedJoinResponse };
}

export async function fetchSharedEvents(
  worldId: string,
  after: number,
  buildId: string,
  fetcher: Fetcher = fetch,
): Promise<{ kind: "ok"; body: SharedEventsResponse } | SharedCallFailure> {
  const query = `?worldId=${encodeURIComponent(worldId)}&after=${after}`;
  const result = await call(fetcher, buildId, `/events${query}`, { method: "GET" });
  if (!result.ok) return result.failure;
  return { kind: "ok", body: result.body as SharedEventsResponse };
}

export type SharedPostResult =
  | { kind: "accepted"; seq: number }
  | { kind: "conflict" }
  | { kind: "refused" }
  | { kind: "typed-text-not-shared" }
  | { kind: "world-replaced" }
  | SharedCallFailure;

export async function postSharedEvent(
  input: { worldId: string; baseSeq: number; eventId: string; event: WardFlowEvent },
  buildId: string,
  fetcher: Fetcher = fetch,
): Promise<SharedPostResult> {
  const result = await call(fetcher, buildId, "/events", { method: "POST", body: input });
  if (result.ok) {
    const seq = (result.body as { seq?: unknown } | null)?.seq;
    return typeof seq === "number" ? { kind: "accepted", seq } : { kind: "unavailable" };
  }
  switch (result.status) {
    case 409:
      return { kind: "conflict" };
    case 422:
      return { kind: "refused" };
    case 403:
      // The proxy's cross-site guard also answers 403; only the server's own code means typed text.
      return (result.body as { error?: unknown } | null)?.error === "typed_text_not_shared"
        ? { kind: "typed-text-not-shared" }
        : { kind: "unavailable" };
    case 410:
      return { kind: "world-replaced" };
    default:
      return result.failure;
  }
}
