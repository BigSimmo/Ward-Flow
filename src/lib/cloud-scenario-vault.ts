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
  revision: z.number(),
});

const LoadResponseSchema = z.object({
  revision: z.number(),
  payload: z.unknown(),
  updated_at: z.string(),
});

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

export type ReadinessResult =
  | { status: "ready" }
  | { status: "unauthorised"; message: string }
  | { status: "unavailable"; message: string }
  | { status: "offline" };

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
      const raw = await response.json();
      const parsed = SaveResponseSchema.safeParse(raw);
      if (!parsed.success) {
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
      const raw = await response.json();
      const parsed = LoadResponseSchema.safeParse(raw);
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
    return {
      status: "offline",
      message: error instanceof Error ? error.message : "Cloud endpoint unreachable.",
    };
  }
}

/**
 * Readiness uses the authenticated `/readyz` path, which verifies the caller's token and probes blob
 * storage on every call. `/healthz` is deliberately not used: it answers before authentication or any
 * storage access, so it reports healthy during token-verifier or storage outages, exactly when saves
 * and loads fail.
 */
export async function checkCloudReadiness(endpoint: string, token: string): Promise<ReadinessResult> {
  const trimmedToken = token.trim();
  if (!trimmedToken) {
    return { status: "unauthorised", message: "Sign in to check cloud readiness." };
  }
  const cleanEndpoint = endpoint.replace(/\/+$/, "");
  try {
    const response = await fetch(`${cleanEndpoint}/readyz`, {
      method: "GET",
      headers: { Authorization: `Bearer ${trimmedToken}` },
    });
    if (response.ok) {
      return { status: "ready" };
    }
    if (response.status === 401 || response.status === 403) {
      return {
        status: "unauthorised",
        message: "Sign in with an authorised Microsoft health service account.",
      };
    }
    return { status: "unavailable", message: `HTTP ${response.status}` };
  } catch {
    return { status: "offline" };
  }
}
