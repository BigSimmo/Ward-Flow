import { NextResponse } from "next/server";
import type { LocalProjectIdentityPayload, LocalServerRuntimeMode } from "@/lib/local-project-identity";
import { appName, localProjectId, projectPortEnd, projectPortStart } from "@/lib/local-server-utils.mjs";

const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function portFor(url: URL) {
  const explicit = Number.parseInt(url.port, 10);
  if (Number.isInteger(explicit)) return explicit;
  if (url.protocol === "http:") return 80;
  if (url.protocol === "https:") return 443;
  return null;
}

export function isLocalUrl(url: URL) {
  return localHosts.has(url.hostname.toLowerCase());
}

export function isManagedProjectPort(port: number | null) {
  return port !== null && port >= projectPortStart && port <= projectPortEnd;
}

/**
 * Read at request time rather than captured in a module constant, so a route recompiled by
 * `next dev` reports the server it is actually running inside.
 */
function localServerRuntimeMode(): LocalServerRuntimeMode {
  if (process.env.NODE_ENV === "development") return "development";
  if (process.env.NODE_ENV === "production") return "production";
  // `test`, or anything a future runner sets. Deliberately NOT folded into "production": the two
  // are refused for different reasons and the refusal says which.
  return "other";
}

/**
 * The three URL-derived fields, computed once so the URL-only builder and the request-level one
 * cannot drift into disagreeing about what "local" means — which is exactly how the managed-port
 * half of this guard went inert.
 */
function localOriginFacts(url: URL) {
  const local = isLocalUrl(url);
  const port = local ? portFor(url) : null;

  return {
    local,
    currentUrl: local && port ? `${url.protocol}//${url.hostname}:${port}` : null,
    currentPort: port,
    safeLocalOrigin: !local || isManagedProjectPort(port),
  };
}

/**
 * ⚠️ **JUDGES BY THE URL ALONE, WHICH NO REAL REQUEST CAN BE JUDGED BY — SEE
 * `localProjectRequestIdentityPayload`.** This is the base payload and the shape used by callers
 * that hold a URL and no headers. It reports `pid: null` rather than guessing that a `localhost`
 * URL means the caller is on this machine.
 */
export function localProjectIdentityPayload(requestUrl: string): LocalProjectIdentityPayload {
  const facts = localOriginFacts(new URL(requestUrl));

  return {
    appName,
    projectId: localProjectId(process.cwd()),
    identityPath: "/api/local-project-id",
    localServer: {
      currentUrl: facts.currentUrl,
      currentPort: facts.currentPort,
      projectPortStart,
      projectPortEnd,
      safeLocalOrigin: facts.safeLocalOrigin,
      requestOrigin: null,
      requestReferer: null,
      unsafeLocalCaller: null,
      runtimeMode: localServerRuntimeMode(),
      pid: null,
    },
  };
}

function unsafeLocalCallerFromHeader(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!isLocalUrl(url)) return null;
    return isManagedProjectPort(portFor(url)) ? null : url.origin;
  } catch {
    return null;
  }
}

/**
 * The URL this request should be judged by.
 *
 * 🔴 **`request.url` CARRIES THE ADDRESS THE SERVER BOUND TO, NOT THE ONE THE CALLER ASKED FOR, AND
 * READING THE CODE WILL NOT TELL YOU THAT.** Measured 2026-09-07 against this project's live
 * `next dev` on port 4215: `curl http://localhost:4215/api/local-project-id` arrives with
 * `request.url === "http://0.0.0.0:4215/api/local-project-id"`, because the dev server binds
 * `0.0.0.0`. `0.0.0.0` is not a loopback name, so `isLocalUrl(new URL(request.url))` was false for
 * every request that has ever reached this guard — which made `!local` permanently true and left
 * `safeLocalOrigin` unable to reject an unmanaged port at all. Only the Origin/Referer half below
 * was still deciding anything.
 *
 * `Host` is what the caller actually addressed, and it survives that normalisation. Handles
 * `[::1]:4215` as well as `localhost:4215` by letting `URL` do the bracket and port parsing rather
 * than a regular expression. The protocol comes from the request URL, so it is the answering
 * server's own scheme and not something a header can assert.
 *
 * ⚠️ **THE `!local` BRANCH IS WHAT KEEPS THE DEPLOYMENT SERVING.** In production `Host` is the
 * browser-facing domain, so the whole port rule is skipped there. That is not an assumption this
 * file introduces: `src/lib/api-csrf.ts` already admits `Host`/`X-Forwarded-Host` as the addressed
 * host precisely because Railway terminates TLS in front of the app, so every state-changing
 * request in production already depends on it being the public host.
 */
function judgedRequestUrl(request: Request): URL {
  const requestUrl = new URL(request.url);
  const host = request.headers.get("host");
  if (!host) return requestUrl;

  try {
    const fromHost = new URL(`${requestUrl.protocol}//${host}`);
    return fromHost.hostname ? fromHost : requestUrl;
  } catch {
    // An unparseable Host cannot be trusted to loosen anything; fall back to the URL, which is
    // what this guard judged by before the header was consulted at all.
    return requestUrl;
  }
}

export function localProjectRequestIdentityPayload(request: Request): LocalProjectIdentityPayload {
  const payload = localProjectIdentityPayload(request.url);
  const facts = localOriginFacts(judgedRequestUrl(request));
  const requestOrigin = request.headers.get("origin");
  const requestReferer = request.headers.get("referer");
  const unsafeLocalCaller = unsafeLocalCallerFromHeader(requestOrigin) ?? unsafeLocalCallerFromHeader(requestReferer);

  return {
    ...payload,
    localServer: {
      ...payload.localServer,
      currentUrl: facts.currentUrl,
      currentPort: facts.currentPort,
      requestOrigin,
      requestReferer,
      unsafeLocalCaller,
      safeLocalOrigin: facts.safeLocalOrigin && !unsafeLocalCaller,
      // Local callers only — a process id is not something to hand out on the public deployment.
      // The same `local` decision as the port rule above, so the two cannot disagree.
      pid: facts.local ? process.pid : null,
    },
  };
}

export function isSafeLocalProjectRequest(request: Request) {
  return localProjectRequestIdentityPayload(request).localServer.safeLocalOrigin;
}

export class UnsafeLocalProjectOriginError extends Error {
  constructor(readonly payload: LocalProjectIdentityPayload) {
    super(
      `Local requests for ${payload.appName} must use a managed project port. Run npm run ensure and use the printed URL.`,
    );
    this.name = "UnsafeLocalProjectOriginError";
  }
}

export function assertSafeLocalProjectRequest(request: Request) {
  const payload = localProjectRequestIdentityPayload(request);
  if (!payload.localServer.safeLocalOrigin) {
    throw new UnsafeLocalProjectOriginError(payload);
  }
}

export function unsafeLocalProjectResponse(payload: LocalProjectIdentityPayload) {
  return NextResponse.json(
    {
      error: "Use the ensured Ward Flow local URL before calling this API.",
      run: "npm run ensure",
      identity: payload,
    },
    {
      status: 409,
      headers: {
        "Cache-Control": "no-store",
        "X-Clinical-KB-Local-Guard": "unsafe-local-origin",
      },
    },
  );
}

export function localProjectOriginErrorResponse(error: UnsafeLocalProjectOriginError) {
  return unsafeLocalProjectResponse(error.payload);
}
