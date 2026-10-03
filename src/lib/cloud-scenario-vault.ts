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

import { checkSyntheticPayload } from "./synthetic-data-guard";

export type SaveScenarioResult =
  | { status: "saved"; revision: number }
  | { status: "conflict"; message: string }
  | { status: "unauthorised"; message: string }
  | { status: "unsafe_payload"; reason: string; sample?: string }
  | { status: "oversized"; message: string }
  | { status: "unavailable"; message: string }
  | { status: "offline"; message: string };

export type LoadScenarioResult =
  | { status: "loaded"; revision: number; payload: unknown; updatedAt: string }
  | { status: "not_found" }
  | { status: "unauthorised"; message: string }
  | { status: "unavailable"; message: string }
  | { status: "offline"; message: string };

export type ReadinessResult = { status: "ready" } | { status: "unavailable"; message: string } | { status: "offline" };

export async function saveCloudScenario(
  endpoint: string,
  token: string,
  sessionId: string,
  expectedRevision: number,
  payload: unknown,
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

  const cleanEndpoint = endpoint.replace(/\/+$/, "");
  const url = `${cleanEndpoint}/v1/sessions/${encodeURIComponent(sessionId.toLowerCase())}`;

  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        classification: "synthetic",
        expectedRevision,
        payload,
      }),
    });

    if (response.status === 200) {
      const data = (await response.json()) as { revision: number };
      return { status: "saved", revision: data.revision };
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
    return {
      status: "offline",
      message: error instanceof Error ? error.message : "Cloud endpoint unreachable.",
    };
  }
}

export async function loadCloudScenario(
  endpoint: string,
  token: string,
  sessionId: string,
): Promise<LoadScenarioResult> {
  const cleanEndpoint = endpoint.replace(/\/+$/, "");
  const url = `${cleanEndpoint}/v1/sessions/${encodeURIComponent(sessionId.toLowerCase())}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token.trim()}`,
      },
    });

    if (response.status === 200) {
      const data = (await response.json()) as {
        revision: number;
        payload: unknown;
        updated_at: string;
      };
      return {
        status: "loaded",
        revision: data.revision,
        payload: data.payload,
        updatedAt: data.updated_at,
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
    return {
      status: "offline",
      message: error instanceof Error ? error.message : "Cloud endpoint unreachable.",
    };
  }
}

export async function checkCloudReadiness(endpoint: string, authToken?: string): Promise<ReadinessResult> {
  const cleanEndpoint = endpoint.replace(/\/+$/, "");
  try {
    const url = authToken ? `${cleanEndpoint}/readyz` : `${cleanEndpoint}/healthz`;
    const headers: Record<string, string> = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
    const response = await fetch(url, { method: "GET", headers });
    if (response.ok) {
      return { status: "ready" };
    }
    return { status: "unavailable", message: `HTTP ${response.status}` };
  } catch {
    return { status: "offline" };
  }
}
