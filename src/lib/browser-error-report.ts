// TE-04 (front-end audit, Josh's card 5, 5 Nov 2026): name-free browser error counts.
//
// A report holds four closed fields and nothing else: the error's type (its constructor name, which
// is code, never its message), the screen as a route template (ids become `[id]`, and the query and
// hash are never read), the release this page was built from and the desk's role. No message,
// stack, address, query, record text or typed text is ever read here. The receiver
// (src/app/api/client-error/route.ts) checks each field against its allow-list again.

/** Where reports go. Same origin, so the CSP and the proxy's CSRF guard already cover it. */
export const CLIENT_ERROR_PATH = "/api/client-error";
/** At most this many reports a minute, and each type on each screen once per page load. */
export const CLIENT_REPORTS_PER_MINUTE = 3;

// The segment after one of these is a record or place id in every Ward Flow route.
const ID_PARENTS = new Set([
  "board",
  "ward",
  "community",
  "ed",
  "movements",
  "people",
  "service",
  "ward-flow-redesign",
]);
const CODE_NAME = /^[A-Za-z_$][\w$]{0,63}$/;
const ROLE = /^[a-z_]{1,24}$/;

/** A pathname's `people/P123/triage` becomes `people/[id]/triage`. Takes a pathname only. */
export function routeTemplate(pathname: string): string {
  const parts = pathname.split("/");
  for (let i = 2; i < parts.length; i++)
    if (ID_PARENTS.has(parts[i - 1]) && parts[i] && parts[i] !== "new") parts[i] = "[id]";
  return parts.join("/").replace(/\/+$/, "") || "/";
}

/** The thrown value's constructor name, or its primitive type. Never its message or name property. */
export function errorType(thrown: unknown): string {
  if (thrown === null || thrown === undefined) return "Unknown";
  if (typeof thrown !== "object" && typeof thrown !== "function") return typeof thrown;
  const name = (Object.getPrototypeOf(thrown) as { constructor?: { name?: unknown } } | null)?.constructor?.name;
  return typeof name === "string" && CODE_NAME.test(name) ? name : "Unknown";
}

/** The desk's role id from Switch workstation (`ward-access-store.ts`), or `none`. Never the place. */
function deskRole(storage: Pick<Storage, "getItem"> | undefined): string {
  try {
    const role = (JSON.parse(storage?.getItem("wardflow:access-desk-v1") ?? "null") as { role?: unknown } | null)?.role;
    return typeof role === "string" && ROLE.test(role) ? role : "none";
  } catch {
    return "none";
  }
}

export type ClientErrorReport = { type: string; route: string; release: string; role: string };

/** Listens for uncaught errors and rejections and reports each, rate-limited. Returns the clean-up. */
export function installBrowserErrorReport(
  target: Window,
  release: string,
  send: (body: string) => void = (body) =>
    void fetch(CLIENT_ERROR_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {}),
): () => void {
  const seen = new Set<string>();
  const times: number[] = [];
  const report = (thrown: unknown) => {
    try {
      const now = Date.now();
      while (times.length && now - times[0] > 60_000) times.shift();
      const body: ClientErrorReport = {
        type: errorType(thrown),
        route: routeTemplate(target.location.pathname),
        release,
        role: deskRole(target.sessionStorage),
      };
      const key = `${body.type} ${body.route}`;
      if (seen.has(key) || times.length >= CLIENT_REPORTS_PER_MINUTE) return;
      seen.add(key);
      times.push(now);
      send(JSON.stringify(body));
    } catch {
      // Reporting must never add an error of its own.
    }
  };
  const onError = (event: ErrorEvent) => report(event.error);
  const onRejection = (event: PromiseRejectionEvent) => report(event.reason);
  target.addEventListener("error", onError);
  target.addEventListener("unhandledrejection", onRejection);
  return () => {
    target.removeEventListener("error", onError);
    target.removeEventListener("unhandledrejection", onRejection);
  };
}
