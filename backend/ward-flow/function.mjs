import { app } from "@azure/functions";
import { randomUUID } from "node:crypto";
import { readConfig } from "./config.mjs";
import { openStorage, createStore } from "./database.mjs";
import { createPush, errorFields } from "./push.mjs";
import { createAuthenticator } from "./auth.mjs";
import { createHandler } from "./server.mjs";

let handlerPromise;
let sharedStoreRef;

function handler() {
  handlerPromise ??= (async () => {
    const config = readConfig();
    const storage = await openStorage(config.storage);
    let sharedStore;
    if (config.shared) {
      const { createPostgresPool, createWorkspaceStore } = await import("./postgres.mjs");
      const engine = await import("./dist/engine.mjs");
      sharedStore = createWorkspaceStore(createPostgresPool(config.postgres), {
        workspaceId: config.workspaceId,
        engine,
        push: await createPush(config),
      });
    }
    sharedStoreRef = sharedStore;
    return createHandler({
      config,
      store: createStore(storage),
      authenticate: await createAuthenticator(config),
      sharedStore,
    });
  })().catch((error) => {
    handlerPromise = undefined;
    throw error;
  });
  return handlerPromise;
}

export async function handleHttp(
  request,
  _context,
  getHandler = handler,
  log = (event) => console.error(JSON.stringify(event)),
) {
  try {
    const webRequest = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      ...(["GET", "HEAD"].includes(request.method) ? {} : { body: request.body, duplex: "half" }),
    });
    const response = await (await getHandler())(webRequest);
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: Buffer.from(await response.arrayBuffer()),
    };
  } catch {
    const requestId = randomUUID();
    try {
      log({ event: "ward_backend_adapter_failure", requestId, status: 503 });
    } catch {
      // Diagnostics are optional and contain no original request/error data.
    }
    return {
      status: 503,
      headers: { "cache-control": "no-store", "x-request-id": requestId },
      jsonBody: { error: "Service unavailable" },
    };
  }
}

// Easy Auth authenticates at the host; the handler verifies the signed API token again.
app.http("wardFlowHealth", { route: "healthz", methods: ["GET"], authLevel: "anonymous", handler: handleHttp });
app.http("wardFlowReady", { route: "readyz", methods: ["GET"], authLevel: "anonymous", handler: handleHttp });
app.http("wardFlowSession", {
  route: "v1/sessions/{id}",
  methods: ["GET", "PUT", "DELETE", "OPTIONS"],
  authLevel: "anonymous",
  handler: handleHttp,
});
app.http("wardFlowWorkspace", {
  route: "v1/workspace",
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  handler: handleHttp,
});
app.http("wardFlowWorkspaceAction", {
  route: "v1/workspace/{action}",
  methods: ["GET", "POST", "OPTIONS"],
  authLevel: "anonymous",
  handler: handleHttp,
});

// Phone push: time alone can turn a row red (a wait passing its target), so a timer re-checks the
// act-now list every five minutes. Registered only when shared mode and all three VAPID settings
// are present, so an installation with the feature off pays for no extra invocations.
export async function sweepPush(
  _timer,
  _context,
  getHandler = handler,
  log = (event) => console.error(JSON.stringify(event)),
) {
  try {
    await getHandler();
    await sharedStoreRef?.sweepPush();
  } catch (error) {
    // Name, code (such as a PostgreSQL SQLSTATE) and a URL-free message tell a missing grant from
    // an engine or configuration fault. Never an endpoint, key or payload.
    log({ event: "ward_backend_push_sweep_failure", ...errorFields(error) });
  }
}
if (
  process.env.WARD_SHARED_ENABLED === "true" &&
  ["WARD_FLOW_VAPID_PUBLIC_KEY", "WARD_FLOW_VAPID_PRIVATE_KEY", "WARD_FLOW_VAPID_SUBJECT"].every((key) =>
    process.env[key]?.trim(),
  )
)
  app.timer("wardFlowPushSweep", { schedule: "0 */5 * * * *", handler: sweepPush });
