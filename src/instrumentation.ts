import type { Instrumentation } from "next";
import { logger } from "./lib/logger";

// Next.js calls register() once when a server instance starts, before it serves
// any requests.
export async function register() {
  // Only the Node.js server runtime needs the guard below. The Edge runtime
  // doesn't build production bundles the way this check validates.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  if (process.env.NODE_ENV !== "production") return;

  // Playwright validates a real production build, but its runner must remain a
  // provider-free demo. Permit that otherwise-invalid combination only for the
  // runner's isolated output and inert loopback environment. A partial or
  // externally-addressed configuration still fails closed below.
  //
  // src/proxy.ts `shouldBlockProductionMockups` relies on this refusal: it only
  // lets mockups through when PLAYWRIGHT_OFFLINE_MODE and NEXT_PUBLIC_MOCKUPS_ENABLED
  // are both set, and trusts that this function has already refused to start any
  // process where that combination doesn't also mean the isolated test profile.
  if (process.env.PLAYWRIGHT_OFFLINE_MODE === "true") {
    const isolatedOutput = /^\.next-playwright\/[a-z0-9-]+\/dist$/i.test(process.env.NEXT_DIST_DIR ?? "");
    const providerFree =
      process.env.NEXT_PUBLIC_DEMO_MODE === "true" &&
      process.env.RAG_PROVIDER_MODE === "offline" &&
      process.env.NEXT_PUBLIC_SUPABASE_URL === "http://127.0.0.1:1" &&
      !process.env.SUPABASE_SERVICE_ROLE_KEY &&
      !process.env.OPENAI_API_KEY;
    if (isolatedOutput && providerFree) return;
    throw new Error("Refusing to start: invalid isolated Playwright offline environment.");
  }
}

/** Server operational failures only: never forward raw errors, URLs, headers or bodies. */
export const onRequestError: Instrumentation.onRequestError = async (_error, request, context) => {
  try {
    const method = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"].includes(request.method)
      ? request.method
      : "unknown";
    const routerKind = ["Pages Router", "App Router"].includes(context.routerKind) ? context.routerKind : "unknown";
    const routeType = ["render", "route", "action", "proxy"].includes(context.routeType)
      ? context.routeType
      : "unknown";
    logger.error("ward.request_failed", { incidentId: crypto.randomUUID(), method, routerKind, routeType });
  } catch {
    // Monitoring must not interfere with Next's handling of the original error.
  }
};
