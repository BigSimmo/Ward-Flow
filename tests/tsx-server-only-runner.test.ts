import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("standalone TSX server-only compatibility", () => {
  it("routes package TSX commands through the server-only-aware runner", () => {
    const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
      scripts: Record<string, string>;
    };
    const directTsx = Object.entries(packageJson.scripts).filter(([, command]) => command.startsWith("tsx "));
    expect(directTsx).toEqual([]);
    const bareTsxTargets = Object.entries(packageJson.scripts).filter(
      ([, command]) => /(^|&&\s*)tsx\s/.test(command) || command.includes("npx tsx"),
    );
    expect(bareTsxTargets).toEqual([]);
    // check:production-readiness:ci and check:supabase-project (the ingestion worker's
    // readiness gates) went with PsychSift on 25 September 2026, and check:drift with its
    // drift tooling on 26 September 2026; check:runtime is the surviving script that still
    // routes a standalone TSX command through the server-only-aware runner.
    expect(packageJson.scripts["check:runtime"]).toContain("scripts/run-tsx.mjs");
  });

  // The "boots the worker image from the server-only-safe esbuild bundle" case was removed:
  // worker/**, Dockerfile.worker, and scripts/build-worker.mjs were PsychSift's ingestion
  // worker and went with PsychSift on 25 September 2026 — there is no worker image left to boot.

  it("keeps the Next server-only marker while stubbing it only for standalone runners", () => {
    // The env.ts assertion this case also carried was dropped: `src/lib/env.ts` was retired as
    // a PsychSift leftover on 27 September 2026 (Josh, full permission 26 Sept 2026), and with
    // it the only file in src/ that opened with `import "server-only";`.
    expect(readFileSync(new URL("../scripts/register-server-only.mjs", import.meta.url), "utf8")).toContain(
      'specifier === "server-only"',
    );
  });

  it("bounds Vitest workers and uses the shared non-destructive run lock", () => {
    const runner = readFileSync(new URL("../scripts/run-vitest.mjs", import.meta.url), "utf8");
    const config = readFileSync(new URL("../vitest.config.mts", import.meta.url), "utf8");
    expect(runner).toContain("acquireHeavyRunLock");
    expect(runner).toContain("vitestLeaseMode");
    expect(runner).toContain("VITEST_MAX_WORKERS: String(sharedWorkers)");
    expect(runner).not.toContain("taskkill");
    // Workers stay bounded to a finite default (tunable via VITEST_MAX_WORKERS) so a
    // parallel run can never spawn unlimited workers and thrash the host.
    expect(config).toMatch(
      /maxWorkers:\s*process\.env\.VITEST_MAX_WORKERS\s*\?\s*Number\(process\.env\.VITEST_MAX_WORKERS\)\s*:\s*\d+/,
    );
    expect(config).toContain("testTimeout: 30_000");
    expect(config).toContain("cacheDir: vitestCacheDirectory(process.cwd())");
  });
});
