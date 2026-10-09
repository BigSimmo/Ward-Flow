/**
 * Cloud Scenario Vault Client
 *
 * Provides safe, non-destructive snapshot saving and loading between the
 * Ward Flow frontend and the Azure backend (Azure Functions / Blob Storage).
 *
 * Enforces:
 * 1. Client-side synthetic data inspection before network transmission.
 * 2. Explicit optimistic concurrency (expectedRevision) to prevent accidental overwrites.
 * 3. Graceful offline handling without throwing unhandled exceptions.
 */

import { z } from "zod";
import { checkSyntheticPayload } from "./synthetic-data-guard";

const SaveResponseSchema = z.object({
  revision: z.number().int().min(1).max(2_147_483_646),
});

const LoadResponseSchema = z.object({
  revision: z.number().int().min(1).max(2_147_483_646),
  payload: z.record(z.string(), z.unknown()),
  updated_at: z.iso.datetime({ offset: true }),
});

export type CloudRequestOptions = {
  /** Applies to response bodies too. Defaults to 10s; caller may choose 1–60,000ms. */
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Keep the same UUID and payload when retrying an unconfirmed save. */
  requestId?: string;
};

class RequestStopped extends Error {
  constructor(readonly status: "timeout" | "cancelled") {
    super(status);
  }
}

/** Bound the complete operation even when a transport ignores abort (including test transports). */
async function requestCloud(url: string, init: RequestInit, options: CloudRequestOptions) {
  const timeoutMs = options.timeoutMs ?? 10_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) throw new Error("invalid_timeout");
  if (options.signal?.aborted) throw new RequestStopped("cancelled");
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel = () => {};
  const stopped = new Promise<never>((_, reject) => {
    const stop = (status: "timeout" | "cancelled") => {
      reject(new RequestStopped(status));
      controller.abort();
    };
    cancel = () => stop("cancelled");
    options.signal?.addEventListener("abort", cancel, { once: true });
    timer = setTimeout(() => stop("timeout"), timeoutMs);
  });
  try {
    return await Promise.race([
      stopped,
      (async () => {
        const response = await fetch(url, { ...init, redirect: "error", signal: controller.signal });
        const data: unknown = response.status === 200 ? await response.json().catch(() => undefined) : undefined;
        return { response, data };
      })(),
    ]);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", cancel);
  }
}

function endpointBase(endpoint: string): string | null {
  try {
    const url = new URL(endpoint);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.protocol !== "https:" &&
        !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
    )
      return null;
    return url.href.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

type RequestFailure =
  | { status: "timeout" | "cancelled"; message: string }
  | { status: "offline"; message: string }
  | { status: "unavailable"; message: string };
function requestFailure(error: unknown): RequestFailure {
  if (error instanceof RequestStopped)
    return {
      status: error.status,
      message:
        error.status === "timeout"
          ? "Cloud request timed out; changes were not confirmed. Reload before repeating changes."
          : "Cloud request cancelled; changes were not confirmed. Reload before repeating changes.",
    };
  if (error instanceof Error && error.message === "invalid_timeout")
    return { status: "unavailable", message: "Invalid cloud request timeout." };
  // Fetch exception messages can contain URLs or transport diagnostics. Keep them private.
  return { status: "offline", message: "Cloud endpoint unreachable; changes were not confirmed." };
}

export type SaveScenarioResult =
  | { status: "saved"; revision: number }
  | { status: "conflict"; message: string }
  | { status: "unauthorised"; message: string }
  | { status: "unsafe_payload"; reason: string; sample?: string }
  | { status: "oversized"; message: string }
  | { status: "unavailable"; message: string }
  | { status: "offline"; message: string }
  | InterruptedResult;
type InterruptedResult = { status: "timeout" | "cancelled"; message: string };

export type LoadScenarioResult =
  | { status: "loaded"; revision: number; payload: unknown; updatedAt: string }
  | { status: "not_found" }
  | { status: "unauthorised"; message: string }
  | { status: "unavailable"; message: string }
  | { status: "offline"; message: string }
  | InterruptedResult;

export type ReadinessResult =
  | { status: "ready" }
  | { status: "unauthorised"; message: string }
  | { status: "unavailable"; message: string }
  | { status: "offline" }
  | InterruptedResult;

export async function saveCloudScenario(
  endpoint: string,
  token: string,
  sessionId: string,
  expectedRevision: number,
  payload: unknown,
  options: CloudRequestOptions = {},
): Promise<SaveScenarioResult> {
  // Pre-flight privacy & clinical safety check
  const privacyCheck = checkSyntheticPayload(payload);
  if (!privacyCheck.safe) {
    return {
      status: "unsafe_payload",
      reason: privacyCheck.reason,
      sample: privacyCheck.sample,
    };
  }

  const cleanEndpoint = endpointBase(endpoint);
  if (!cleanEndpoint)
    return { status: "unavailable", message: "Use an approved HTTPS cloud endpoint or local loopback endpoint." };
  const url = `${cleanEndpoint}/v1/sessions/${encodeURIComponent(sessionId.toLowerCase())}`;

  try {
    const { response, data } = await requestCloud(
      url,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          classification: "synthetic",
          expectedRevision,
          payload,
          ...(options.requestId ? { requestId: options.requestId } : {}),
        }),
      },
      options,
    );

    if (response.status === 200) {
      const parsed = SaveResponseSchema.safeParse(data);
      if (!parsed.success || parsed.data.revision !== expectedRevision + 1) {
        return {
          status: "unavailable",
          message: "Cloud response did not match expected scenario schema.",
        };
      }
      return { status: "saved", revision: parsed.data.revision };
    }

    if (response.status === 409) {
      return {
        status: "conflict",
        message: "Session has been modified on cloud; reload before saving.",
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        status: "unauthorised",
        message: "Sign in with an authorised Microsoft health service account.",
      };
    }

    if (response.status === 413) {
      return {
        status: "oversized",
        message: "Scenario payload exceeds the 1MB cloud storage limit.",
      };
    }

    return {
      status: "unavailable",
      message: `Cloud storage responded with status ${response.status}.`,
    };
  } catch (error) {
    return requestFailure(error);
  }
}

export async function loadCloudScenario(
  endpoint: string,
  token: string,
  sessionId: string,
  options: CloudRequestOptions = {},
): Promise<LoadScenarioResult> {
  const cleanEndpoint = endpointBase(endpoint);
  if (!cleanEndpoint)
    return { status: "unavailable", message: "Use an approved HTTPS cloud endpoint or local loopback endpoint." };
  const url = `${cleanEndpoint}/v1/sessions/${encodeURIComponent(sessionId.toLowerCase())}`;

  try {
    const { response, data } = await requestCloud(
      url,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token.trim()}`,
        },
      },
      options,
    );

    if (response.status === 200) {
      const parsed = LoadResponseSchema.safeParse(data);
      if (!parsed.success) {
        return {
          status: "unavailable",
          message: "Cloud response did not match expected scenario schema.",
        };
      }
      return {
        status: "loaded",
        revision: parsed.data.revision,
        payload: parsed.data.payload,
        updatedAt: parsed.data.updated_at,
      };
    }

    if (response.status === 404) {
      return { status: "not_found" };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        status: "unauthorised",
        message: "Sign in with an authorised Microsoft health service account.",
      };
    }

    return {
      status: "unavailable",
      message: `Cloud storage responded with status ${response.status}.`,
    };
  } catch (error) {
    return requestFailure(error);
  }
}

/**
 * Readiness uses the authenticated `/readyz` path, which verifies the caller's token and probes blob
 * storage on every call. `/healthz` is deliberately not used: it answers before authentication or any
 * storage access, so it reports healthy during token-verifier or storage outages, exactly when saves
 * and loads fail.
 */
export async function checkCloudReadiness(
  endpoint: string,
  token: string,
  options: CloudRequestOptions = {},
): Promise<ReadinessResult> {
  const trimmedToken = token.trim();
  if (!trimmedToken) {
    return { status: "unauthorised", message: "Sign in to check cloud readiness." };
  }
  const cleanEndpoint = endpointBase(endpoint);
  if (!cleanEndpoint)
    return { status: "unavailable", message: "Use an approved HTTPS cloud endpoint or local loopback endpoint." };
  try {
    const { response, data } = await requestCloud(
      `${cleanEndpoint}/readyz`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${trimmedToken}` },
      },
      options,
    );
    if (response.status === 200 && z.object({ storage: z.literal("ready") }).safeParse(data).success) {
      return { status: "ready" };
    }
    if (response.status === 401 || response.status === 403) {
      return {
        status: "unauthorised",
        message: "Sign in with an authorised Microsoft health service account.",
      };
    }
    return { status: "unavailable", message: `HTTP ${response.status}` };
  } catch (error) {
    const failure = requestFailure(error);
    return failure.status === "offline" ? { status: "offline" } : failure;
  }
}

export type DeleteScenarioResult =
  | { status: "deleted" | "not_found" }
  | { status: "conflict" | "unauthorised"; message: string }
  | ReturnType<typeof requestFailure>;

/** Erases an owner's snapshot at a known revision; a deleted session ID cannot be reused. */
export async function deleteCloudScenario(
  endpoint: string,
  token: string,
  sessionId: string,
  expectedRevision: number,
  options: CloudRequestOptions = {},
): Promise<DeleteScenarioResult> {
  const cleanEndpoint = endpointBase(endpoint);
  if (!cleanEndpoint)
    return { status: "unavailable", message: "Use an approved HTTPS cloud endpoint or local loopback endpoint." };
  try {
    const { response } = await requestCloud(
      `${cleanEndpoint}/v1/sessions/${encodeURIComponent(sessionId.toLowerCase())}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token.trim()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ expectedRevision }),
      },
      options,
    );
    if (response.status === 204) return { status: "deleted" };
    if (response.status === 404) return { status: "not_found" };
    if (response.status === 409) return { status: "conflict", message: "Session changed; reload before deleting." };
    if (response.status === 401 || response.status === 403)
      return { status: "unauthorised", message: "Sign in with an authorised Microsoft health service account." };
    return { status: "unavailable", message: `Cloud storage responded with status ${response.status}.` };
  } catch (error) {
    return requestFailure(error);
  }
}
