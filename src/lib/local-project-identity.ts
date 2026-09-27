/**
 * How the server answering this request was started.
 *
 * 🔴 **THE IDENTITY CHECK ALONE CANNOT TELL A DEV SERVER FROM A BROWSER GATE'S PRODUCTION ONE, AND
 * `npm run ensure` USED TO ADOPT EITHER.** `scripts/run-playwright.mjs` builds an isolated
 * production bundle and runs `next start` from the SAME project root, so its server answers
 * `/api/local-project-id` with the right `appName` and the right `projectId` — `projectId` is a hash
 * of the project root (`local-server-utils.mjs:47`), which the gate shares by design.
 *
 * What you get when `ensure` adopts it is a server that passes every documented safety check, serves
 * every route with full markup, is **frozen at the gate's build time** so none of your current
 * changes are in it, and has `data-testid` stripped by the production compile so the markers you
 * grep for are absent. The failure presents as "my change is missing from the page", which sends
 * somebody debugging their own correct work — and every agent instruction in this repository says to
 * use `npm run ensure`, so following the rule is what exposes you.
 *
 * ⚠️ **It is a concurrency race, not a stale leftover.** Observed 2026-09-07 with
 * `npm run verify:phone-chrome` live; when that gate finished, its server exited and the port closed
 * on its own. `run-playwright.mjs` cleans up correctly. The exposure is simply that several sessions
 * work in this repository at once, so one session's `ensure` routinely runs while another's gate is
 * up.
 */
export type LocalServerRuntimeMode = "development" | "production" | "other";

export type LocalProjectIdentityPayload = {
  appName: string;
  projectId: string;
  identityPath: "/api/local-project-id";
  localServer: {
    currentUrl: string | null;
    currentPort: number | null;
    projectPortStart: number;
    projectPortEnd: number;
    safeLocalOrigin: boolean;
    requestOrigin: string | null;
    requestReferer: string | null;
    unsafeLocalCaller: string | null;
    /**
     * `"development"` only under `next dev`. A `next build` inlines `process.env.NODE_ENV`, so a
     * production bundle cannot report anything else even if the environment is later changed.
     */
    runtimeMode: LocalServerRuntimeMode;
    /**
     * The answering server's own process id, so a refusal can name the process to look at without
     * inspecting the process table — which has no portable form (`Get-CimInstance Win32_Process` on
     * Windows, `ps` elsewhere).
     *
     * Local callers only. This route is reachable on the public deployment too, and a process id is
     * not something to hand out there.
     */
    pid: number | null;
  };
};

export async function readLocalProjectIdentity() {
  const response = await fetch("/api/local-project-id", { cache: "no-store" });
  if (!response.ok) return null;
  return (await response.json()) as LocalProjectIdentityPayload;
}

export function unsafeLocalProjectMessage(identity: LocalProjectIdentityPayload | null) {
  const range =
    typeof identity?.localServer?.projectPortStart === "number" &&
    typeof identity.localServer.projectPortEnd === "number"
      ? ` Use the URL printed by npm run ensure; managed ports are ${identity.localServer.projectPortStart}-${identity.localServer.projectPortEnd}.`
      : " Use the URL printed by npm run ensure.";
  return `This tab is not using the guarded Ward Flow local URL.${range}`;
}
