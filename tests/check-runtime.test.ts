import { existsSync, readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

import { describe, expect, it } from "vitest";

import packageJson from "../package.json";
import { NODE_MINIMUM_VERSION, checkNodeRuntime, checkNpmRuntime } from "../scripts/check-runtime";

function preinstallResult(version: string) {
  const source = readFileSync(new URL("../scripts/check-node-engine.cjs", import.meta.url), "utf8");
  const diagnostics: string[] = [];
  const stopped = new Error("preinstall exited");
  let status = 0;
  try {
    runInNewContext(source, {
      process: {
        versions: { node: version },
        env: { npm_config_user_agent: "npm/11.17.0" },
        exit(code: number) {
          status = code;
          throw stopped;
        },
      },
      console: { error: (message: string) => diagnostics.push(message) },
    });
  } catch (error) {
    if (error !== stopped) throw error;
  }
  return { status, diagnostics };
}

describe("runtime release gate", () => {
  it("accepts the Node 24 release target", () => {
    expect(checkNodeRuntime("24.22.1")).toMatchObject({
      ok: true,
      expectedMajor: 24,
    });
  });

  it("rejects older and newer major runtimes", () => {
    expect(checkNodeRuntime("23.7.0")).toMatchObject({ ok: false });
    expect(checkNodeRuntime("25.0.0")).toMatchObject({ ok: false });
  });

  // A matching major used to be sufficient, so 24.13.0 passed every gate and
  // then failed `npm ci` with an opaque EBADENGINE for jsdom.
  it("rejects a matching major that is below the dependency floor", () => {
    const result = checkNodeRuntime("24.13.0");
    expect(result.ok).toBe(false);
    expect(result.message).toContain(NODE_MINIMUM_VERSION);
    expect(result.message).toContain(".nvmrc");
    expect(result.message).toContain(".node-version");
    expect(result.message).toContain("version manager");
    expect(result.message).toContain("node --version");
    expect(result.message).toContain("current shell");
  });

  it("accepts runtimes at or above the floor", () => {
    expect(checkNodeRuntime(NODE_MINIMUM_VERSION)).toMatchObject({ ok: true });
    expect(checkNodeRuntime("24.23.0")).toMatchObject({ ok: true });
  });

  it.each([
    ["24.19.0", false],
    ["24.22.0", false],
    ["24.22.1-rc.1", false],
    ["24.x.1", false],
    ["24.22.1", true],
    ["24.23.0", true],
    ["25.0.0", false],
  ] as const)("enforces the patched release range for Node %s at install and verification", (version, ok) => {
    const verification = checkNodeRuntime(version);
    const installed = preinstallResult(version);
    expect(verification.ok).toBe(ok);
    expect(installed.status).toBe(ok ? 0 : 1);
    if (ok) expect(installed.diagnostics).toEqual([]);
    else expect(installed.diagnostics.join("\n")).toContain(packageJson.engines.node);
  });

  it("keeps locked root runtime metadata equal to the package declaration", () => {
    const lockfile = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
    expect(lockfile.packages[""].engines).toEqual(packageJson.engines);
  });

  it("keeps both local runtime selectors within the patched release range", () => {
    for (const relative of [".nvmrc", ".node-version"]) {
      const version = readFileSync(new URL(`../${relative}`, import.meta.url), "utf8").trim();
      expect(checkNodeRuntime(version).ok, relative).toBe(true);
    }
  });

  it("keeps the floor equal to the package.json engines.node declaration", () => {
    const declared = packageJson.engines.node.match(/>=\s*(\d+\.\d+\.\d+)/)?.[1];
    expect(declared).toBe(NODE_MINIMUM_VERSION);
  });

  // The preinstall hook is COPYed into the Docker image on its own, so it
  // cannot import package.json and restates the range as a literal instead.
  it("keeps the preinstall hook's declared range equal to package.json engines.node", () => {
    const source = readFileSync(new URL("../scripts/check-node-engine.cjs", import.meta.url), "utf8");
    const declared = source.match(/const nodeRange = "([^"]+)"/)?.[1];
    expect(declared).toBe(packageJson.engines.node);
  });

  // The SessionStart hook provisions Node before npm exists, so it restates the
  // bounds in shell. Checking only the floor let a Node 25 container skip
  // provisioning and then fail npm ci against the "<25" half of the range.
  const sessionStartHook = new URL("../.claude/hooks/session-start.sh", import.meta.url);
  function describeRuntimeHook(name: string, body: () => void) {
    if (existsSync(sessionStartHook)) describe(name, body);
  }
  if (!existsSync(sessionStartHook)) {
    it("keeps the public checkout free of an incomplete Claude runtime hook", () => {
      // `.claude/settings.json` may carry the cloud Supermemory save hook alone; no runtime hook ships.
      expect(existsSync(new URL("../.claude/hooks", import.meta.url))).toBe(false);
    });
  }
  describeRuntimeHook("SessionStart hook runtime bounds", () => {
    const hook = readFileSync(sessionStartHook, "utf8");
    const engineFloor = packageJson.engines.node.match(/>=\s*(\d+\.\d+\.\d+)/)?.[1];
    const engineCeiling = packageJson.engines.node.match(/<\s*(\d+)/)?.[1];

    it("declares the same floor and exclusive ceiling as package.json engines.node", () => {
      expect(hook.match(/^NODE_MINIMUM="([^"]+)"/m)?.[1]).toBe(engineFloor);
      expect(hook.match(/^NODE_MAJOR_CEILING="([^"]+)"/m)?.[1]).toBe(engineCeiling);
    });

    it("pins an install version that is itself inside the supported range", () => {
      const pinned = hook.match(/^NODE_VERSION="([^"]+)"/m)?.[1];
      expect(pinned).toBeDefined();
      expect(checkNodeRuntime(pinned!)).toMatchObject({ ok: true });
      expect(Number(pinned!.split(".")[0])).toBeLessThan(Number(engineCeiling));
    });

    it("uses a Bash-native comparison without GNU sort", () => {
      expect(hook).not.toContain("sort -V");
      expect(hook).toContain("(( actual_patch >= minimum_patch ))");
    });
  });

  it("reports unparsable runtime versions as failures", () => {
    expect(checkNodeRuntime("not-a-version")).toMatchObject({ ok: false });
  });

  it("accepts the npm 11 release package manager", () => {
    expect(checkNpmRuntime("npm/11.12.1 node/v24.15.0 win32 x64")).toMatchObject({
      ok: true,
      expectedMajor: 11,
    });
  });

  it("rejects newer npm majors for release verification", () => {
    expect(checkNpmRuntime("npm/12.0.0 node/v24.15.0 win32 x64")).toMatchObject({ ok: false });
  });
});
