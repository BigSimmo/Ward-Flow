import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { localProjectIdentityPayload, localProjectRequestIdentityPayload } from "@/lib/local-project-guard";
import {
  adoptableRuntimeMode,
  appName,
  describeUnadoptableServer,
  localProjectId,
  serverAdoptionVerdict,
} from "@/lib/local-server-utils.mjs";

/**
 * ═══ `ensure` ADOPTED A BROWSER GATE'S PRODUCTION SERVER, AND EVERY SAFETY CHECK PASSED ══════════
 *
 * Observed 2026-09-07 in `D:/Worktrees/Database/ward-builder-two`:
 *
 *     $ npm run ensure
 *     Ward Flow is already running at http://localhost:4215
 *     PID 29268 = node next start --hostname 0.0.0.0 --port 4215
 *
 * `scripts/run-playwright.mjs` builds an isolated production bundle and runs `next start` from the
 * SAME project root. `projectId` is a hash of that root, so the gate's server answers
 * `/api/local-project-id` with the right `appName` and the right `projectId` — which was the whole
 * of what `ensure` checked. What the caller then gets is a server that:
 *
 *   - passes the documented identity check,
 *   - serves every route with correct titles and full markup,
 *   - is frozen at the gate's build, so none of the current tree's changes are in it,
 *   - has `data-testid` stripped by the production compile, so markers grepped for are absent.
 *
 * It presents as "my change is missing from the page". Every agent instruction in this repository
 * says to run `npm run ensure` and never assume a port — so following the rule is what exposes you,
 * and the symptom points at the reader's own correct work.
 *
 * ⚠️ **A CONCURRENCY RACE, NOT A STALE LEFTOVER, AND THE DISTINCTION CHANGES WHAT TO FIX.** The
 * first reading was that the server had outlived its run. It had not: `verify:phone-chrome` was live
 * at the time, and when it finished the server exited and the port closed on its own.
 * `run-playwright.mjs` cleans up correctly and is not what needs repair. The exposure is that
 * several sessions work in this repository at once, so one session's `ensure` routinely runs while
 * another's gate is up.
 *
 * ## What this file pins, and why each part is here
 *
 * A predicate can be perfect and unreachable, and a guarded field can have nothing that emits it.
 * So this covers three separate things, and the first two are the ones that rot quietly:
 *
 *   1. **Something produces `runtimeMode`** — `localProjectIdentityPayload` really emits it, and it
 *      really tracks the runtime. A guard on a field nothing writes passes forever.
 *   2. **`ensure` consults the predicate** — a source scan, because the decision lives in a detached
 *      script with a top-level `await main()` that cannot be imported without running it.
 *   3. **The predicate decides correctly**, including the fail-closed case.
 */

const PROJECT_ID = localProjectId(process.cwd());

function payload({
  runtimeMode,
  projectId = PROJECT_ID,
  name = appName,
  pid = 29268,
}: {
  runtimeMode?: string | undefined;
  projectId?: string;
  name?: string;
  pid?: number | null;
}) {
  const localServer: Record<string, unknown> = { pid };
  // An absent KEY, not a key set to undefined — this is a server built before the field existed,
  // and the two differ under `in` and under JSON round-tripping.
  if (runtimeMode !== undefined) localServer.runtimeMode = runtimeMode;
  return { appName: name, projectId, localServer };
}

describe("something actually produces the runtime mode the guard reads", () => {
  it("the identity payload reports development under a dev server", () => {
    vi.stubEnv("NODE_ENV", "development");
    const identity = localProjectIdentityPayload("http://localhost:4215/api/local-project-id");
    expect(identity.localServer.runtimeMode).toBe("development");
    expect(
      identity.localServer.runtimeMode,
      "the value the predicate adopts on must be the value a dev server reports, or the guard " +
        "refuses every server including the right one",
    ).toBe(adoptableRuntimeMode);
    vi.unstubAllEnvs();
  });

  it("the identity payload reports production under a browser gate's next start", () => {
    // The exact condition of the incident: `run-playwright.mjs:409` sets NODE_ENV=production and
    // spawns `next start` at `:257`.
    vi.stubEnv("NODE_ENV", "production");
    expect(localProjectIdentityPayload("http://localhost:4215/api/local-project-id").localServer.runtimeMode).toBe(
      "production",
    );
    vi.unstubAllEnvs();
  });

  it("carries the answering process id to local callers, and never off-machine", () => {
    /*
     * ⚠️ **THIS ASSERTS THROUGH `localProjectRequestIdentityPayload`, THE FUNCTION THE ROUTE
     * ACTUALLY CALLS, BECAUSE THE URL-ONLY ONE CANNOT DECIDE THIS.** The first version gated the
     * pid on the payload's own `local` flag and asserted against `localProjectIdentityPayload`.
     * Both agreed with each other and both were wrong: dumping the live dev server's response
     * showed `currentUrl: null` and `currentPort: null` for a plain `curl http://localhost:4215/…`,
     * so `local` is false even for a real localhost request and the pid was null for everybody.
     *
     * A test written against the same mistaken assumption as the code would have gone green. What
     * caught it was reading the running server's actual output — which is why the assertion now
     * goes through the request-level function with a real `Host` header.
     */
    const local = localProjectRequestIdentityPayload(
      new Request("http://localhost:4215/api/local-project-id", { headers: { host: "localhost:4215" } }),
    );
    expect(local.localServer.pid).toBe(process.pid);

    for (const host of ["127.0.0.1:4215", "[::1]:4215"]) {
      expect(
        localProjectRequestIdentityPayload(
          new Request("http://localhost:4215/api/local-project-id", { headers: { host } }),
        ).localServer.pid,
        `${host} is this machine and must be told the process id`,
      ).toBe(process.pid);
    }

    const remote = localProjectRequestIdentityPayload(
      new Request("https://psychiatry.tools/api/local-project-id", { headers: { host: "psychiatry.tools" } }),
    );
    expect(remote.localServer.pid, "a process id must not be served off this machine").toBeNull();

    // The URL-only builder has no headers to judge by, so it must not guess.
    expect(
      localProjectIdentityPayload("http://localhost:4215/api/local-project-id").localServer.pid,
      "the header-less builder must report null rather than assume the caller is local",
    ).toBeNull();
  });
});

describe("ensure consults the predicate rather than deciding on identity alone", () => {
  const script = readFileSync("scripts/ensure-local-server.mjs", "utf8");
  const source = script.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/^\s*\/\/.*$/gmu, "");

  it("calls the shared verdict", () => {
    expect(
      source.includes("serverAdoptionVerdict("),
      "scripts/ensure-local-server.mjs no longer asks serverAdoptionVerdict whether a server may be " +
        "adopted. Everything else in this file can pass while ensure goes back to adopting any " +
        "server that answers with the right project id — which is the whole defect.",
    ).toBe(true);
  });

  it("no longer decides adoption on appName and projectId by itself", () => {
    expect(
      /payload\?\.appName === appName/u.test(source),
      "the original two-field identity test is back in ensure-local-server.mjs. That test is what " +
        "adopted a browser gate's production server: the gate shares this project root, so it " +
        "matches on both fields by construction.",
    ).toBe(false);
  });
});

describe("the adoption verdict", () => {
  it("adopts a dev server for this project", () => {
    const verdict = serverAdoptionVerdict(payload({ runtimeMode: "development" }), PROJECT_ID);
    expect(verdict.adopt).toBe(true);
    expect(describeUnadoptableServer(4215, verdict), "an adopted server must not be narrated").toBeNull();
  });

  it("REFUSES a production server for this project — the incident", () => {
    const verdict = serverAdoptionVerdict(payload({ runtimeMode: "production" }), PROJECT_ID);
    expect(
      verdict.adopt,
      "ensure adopted a browser gate's `next start`, whose pages are frozen at the gate's build and " +
        "have data-testid stripped. It answers the identity route correctly because it shares this " +
        "project root — that is exactly why the identity route alone cannot be the test.",
    ).toBe(false);
    expect(verdict.reason).toBe("not-a-dev-server");
  });

  it("REFUSES a server that reports no runtime mode, rather than assuming it is friendly", () => {
    // Fail closed. Refusing a real dev server costs a second dev server on the next port — wasteful,
    // visible, self-correcting. Adopting a production one costs a debugging session against work
    // that was never wrong. A `next build` also inlines NODE_ENV and so cannot report a mode, while
    // `next dev` recompiles the route on demand and picks the field up on its next request — so
    // silence is evidence of a frozen build more often than of a stale dev server.
    const verdict = serverAdoptionVerdict(payload({}), PROJECT_ID);
    expect(verdict.adopt).toBe(false);
    expect(verdict.reason).toBe("runtime-mode-unreported");
  });

  it("refuses another project, and says nothing about it", () => {
    for (const other of [
      payload({ runtimeMode: "development", projectId: "clinical-kb:000000000000" }),
      payload({ runtimeMode: "development", name: "SomeOtherApp" }),
      null,
    ]) {
      const verdict = serverAdoptionVerdict(other, PROJECT_ID);
      expect(verdict.adopt).toBe(false);
      expect(verdict.reason).toBe("not-this-project");
      expect(
        describeUnadoptableServer(4215, verdict),
        "a port held by an unrelated project is the ordinary case ensure has always walked past. " +
          "Narrating it would bury the one line that matters among a thousand scanned ports.",
      ).toBeNull();
    }
  });
});

describe("the refusal tells the reader what to look at", () => {
  const verdict = serverAdoptionVerdict(payload({ runtimeMode: "production", pid: 29268 }), PROJECT_ID);
  const message = describeUnadoptableServer(4215, verdict) ?? "";

  it("names the port and the process, so the server can be identified without a process query", () => {
    expect(message).toContain("4215");
    expect(message).toContain("29268");
  });

  it("names the likely cause, because the cause is another session rather than the reader", () => {
    // The symptom is "my change is missing". Without this the reader debugs their own correct work.
    expect(message.toLowerCase()).toContain("gate");
    expect(message).toMatch(/verify:(ui|phone-chrome)/u);
  });

  it("says what is wrong with the pages it serves, not merely that it was refused", () => {
    expect(message).toContain("data-testid");
    expect(message.toLowerCase()).toMatch(/frozen|current changes/u);
  });

  it("still names the process when a server reports no mode at all", () => {
    const silent = serverAdoptionVerdict(payload({ pid: 4242 }), PROJECT_ID);
    expect(describeUnadoptableServer(4215, silent) ?? "").toContain("4242");
  });
});
