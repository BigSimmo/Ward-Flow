import { describe, expect, it } from "vitest";
import {
  deferredToHostedCi,
  selectedScripts,
  summarizePrLocalRun,
  validateSelectedScripts,
} from "../scripts/verify-pr-local.mjs";
describe("actual Ward local verification plan", () => {
  it("checks maintained links, current architecture and inventory for every acceptance scope", () => {
    for (const file of ["README.md", "AGENTS.md", "src/app/page.tsx", "backend/ward-flow/backend.test.mjs"])
      expect(selectedScripts({ entries: [{ file, status: "M" }] })).toEqual(
        expect.arrayContaining(["docs:check-links", "docs:check-index", "docs:check-inventory"]),
      );
  });
  it("keeps Ward prose static, maintained policy exact, and source or unknown conservative under --full", () => {
    const select = (file: string, status = "M") =>
      selectedScripts({ entries: [{ file, status }] }, false, { full: true });
    expect(select("README.md")).not.toContain("check:ward-expected-reds");
    expect(select("AGENTS.md")).toContain("check:ward-policy-contracts");
    expect(select("AGENTS.md")).not.toContain("test:e2e:ward-journeys");
    for (const file of ["src/app/page.tsx", "unrecognised", "docs/other-policy.md"]) {
      expect(select(file)).toContain("check:ward-expected-reds");
      expect(select(file)).toContain("test:e2e:ward-journeys");
    }
    expect(select("docs/ward-flow/old.md", "D")).toContain("test:e2e:ward-journeys");
    expect(select("backend/ward-flow/backend.test.mjs")).toContain("test:backend");
    for (const file of ["README.md", "AGENTS.md", "src/app/page.tsx", "backend/ward-flow/backend.test.mjs"])
      expect(() => validateSelectedScripts(select(file))).not.toThrow();
  });
  it("runs affected tests by default and leaves whole-suite gates to hosted CI, naming each one", () => {
    const lean = (file: string, status = "M") => selectedScripts({ entries: [{ file, status }] });
    for (const file of ["src/app/page.tsx", "unrecognised", "tests/ward-waitlist.test.ts"]) {
      const selected = lean(file);
      expect(selected).toContain("test:related");
      for (const heavy of ["check:ward-expected-reds", "build", "test:e2e:ward-journeys", "test:backend"])
        expect(selected).not.toContain(heavy);
      expect(() => validateSelectedScripts(selected)).not.toThrow();
    }
    expect(lean("src/app/page.tsx")).toEqual(expect.arrayContaining(["lint", "typecheck"]));
    expect(lean("backend/ward-flow/engine.ts")).toContain("typecheck:backend");
    expect(lean("README.md")).not.toContain("test:related");
    const scope = { entries: [{ file: "src/app/page.tsx", status: "M" }] };
    expect(deferredToHostedCi(scope).join(" ")).toMatch(/check:ward-expected-reds.*build.*test:e2e:ward-journeys/);
    expect(deferredToHostedCi(scope, { full: true })).toEqual([]);
    expect(deferredToHostedCi({ entries: [{ file: "README.md", status: "M" }] })).toEqual([]);
    expect(summarizePrLocalRun(["lint"], { completed: ["lint"], deferred: ["production build (build)"] })).toContain(
      "left to hosted CI",
    );
  });
  it("selects browser coverage in the default and extended plans without a second ladder", () => {
    const scope = { entries: [{ file: "src/app/page.tsx", status: "M" }] };
    expect(selectedScripts(scope)).toEqual(selectedScripts(scope, true));
    expect(selectedScripts(scope, false, { full: true })).toEqual(selectedScripts(scope, true, { full: true }));
    expect(selectedScripts(scope, false, { full: true })).toContain("test:e2e:ward-journeys");
  });
  it("typechecks backend changes and retains backend evidence when history is unknown", () => {
    for (const entries of [[{ file: "backend/ward-flow/command-schemas.ts", status: "M" }], []]) {
      const selected = selectedScripts({ entries }, false, { full: true });
      expect(selected).toContain("typecheck:backend");
      expect(selected).toContain("test:backend");
      expect(selected).toContain("check:ward-expected-reds");
      expect(selected.indexOf("typecheck:backend")).toBeLessThan(selected.indexOf("test:backend"));
    }
    expect(
      selectedScripts({ entries: [{ file: "tests/ward-waitlist.test.ts", status: "M" }] }, false, { full: true }),
    ).not.toContain("test:backend");
  });
  it("selects production builds under --full for every executable scope and skips them for documents and policy", () => {
    for (const entries of [
      [{ file: "src/app/page.tsx", status: "M" }],
      [],
      [{ file: "tests/ward-waitlist.test.ts", status: "M" }],
      [{ file: "backend/ward-flow/engine.ts", status: "M" }],
    ])
      expect(selectedScripts({ entries }, false, { full: true })).toContain("build");
    for (const file of ["README.md", "AGENTS.md"])
      expect(selectedScripts({ entries: [{ file, status: "M" }] }, false, { full: true })).not.toContain("build");
    expect(selectedScripts({ frontend_static: true })).toEqual(expect.arrayContaining(["lint", "typecheck"]));
    expect(selectedScripts({ unit: true })).not.toContain("lint");
  });
  it("keeps skipped database evidence visible when an earlier command fails", () => {
    expect(
      summarizePrLocalRun(["typecheck:backend", "test:backend"], {
        failedScript: "typecheck:backend",
        failedExitCode: 1,
      }),
    ).toContain("Backend PostgreSQL integration: NOT RUN");
  });
});
