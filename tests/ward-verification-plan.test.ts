import { describe, expect, it } from "vitest";
import {
  deferredToHostedCi,
  selectedScripts,
  summarizePrLocalRun,
  validateSelectedScripts,
} from "../scripts/verify-pr-local.mjs";
// A Ward prose page no test reads. Built by joining so the planner's scan of test text for doc
// paths (A6-F09) does not count this file as reading it.
const PROSE_DOC = "docs/history/" + "prose-only.md";
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
    expect(select(PROSE_DOC)).not.toContain("check:ward-expected-reds");
    expect(select("AGENTS.md")).toContain("check:ward-policy-contracts");
    expect(select("AGENTS.md")).not.toContain("test:e2e:ward-journeys");
    for (const file of ["src/app/page.tsx", "unrecognised", "docs/other-policy.md"]) {
      expect(select(file)).toContain("check:ward-expected-reds");
      expect(select(file)).toContain("test:e2e:ward-journeys");
    }
    expect(select("docs/ward-flow/old.md", "D")).toContain("test:e2e:ward-journeys");
    expect(select("backend/ward-flow/backend.test.mjs")).toContain("test:backend:integration");
    for (const file of ["README.md", "AGENTS.md", "src/app/page.tsx", "backend/ward-flow/backend.test.mjs"])
      expect(() => validateSelectedScripts(select(file))).not.toThrow();
  });
  it("runs affected tests by default and leaves whole-suite gates to hosted CI, naming each one", () => {
    const lean = (file: string, status = "M") => selectedScripts({ entries: [{ file, status }] });
    for (const file of ["src/app/page.tsx", "unrecognised", "tests/ward-waitlist.test.ts"]) {
      const selected = lean(file);
      expect(selected).toContain("test:related");
      for (const heavy of ["check:ward-expected-reds", "build", "test:e2e:ward-journeys", "test:backend:integration"])
        expect(selected).not.toContain(heavy);
      expect(() => validateSelectedScripts(selected)).not.toThrow();
    }
    expect(lean("src/app/page.tsx")).toEqual(expect.arrayContaining(["lint", "typecheck"]));
    expect(lean("backend/ward-flow/engine.ts")).toContain("typecheck:backend");
    expect(lean(PROSE_DOC)).not.toContain("test:related");
    const scope = { entries: [{ file: "src/app/page.tsx", status: "M" }] };
    expect(deferredToHostedCi(scope).join(" ")).toMatch(/check:ward-expected-reds.*build.*test:e2e:ward-journeys/);
    expect(deferredToHostedCi(scope, { full: true })).toEqual([]);
    // An explicit --files scope cannot be followed by test:related, so it keeps the full unit gate.
    expect(selectedScripts(scope, false, { explicitFiles: true })).toContain("check:ward-expected-reds");
    expect(selectedScripts(scope, false, { explicitFiles: true })).not.toContain("test:related");
    expect(deferredToHostedCi(scope, { explicitFiles: true }).join(" ")).not.toMatch(/check:ward-expected-reds/);
    expect(deferredToHostedCi({ entries: [{ file: PROSE_DOC, status: "M" }] })).toEqual([]);
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
      expect(selected).toContain("test:backend:integration");
      expect(selected).toContain("check:ward-expected-reds");
      expect(selected.indexOf("typecheck:backend")).toBeLessThan(selected.indexOf("test:backend:integration"));
    }
    expect(
      selectedScripts({ entries: [{ file: "tests/ward-waitlist.test.ts", status: "M" }] }, false, { full: true }),
    ).not.toContain("test:backend:integration");
  });
  it("selects production builds under --full for every app or backend scope and skips them for unit tests alone, documents and policy", () => {
    for (const entries of [
      [{ file: "src/app/page.tsx", status: "M" }],
      [],
      [{ file: "backend/ward-flow/engine.ts", status: "M" }],
    ])
      expect(selectedScripts({ entries }, false, { full: true })).toContain("build");
    // Unit test files never reach the app bundle, so a change of unit tests alone runs them without
    // a production build (D-146); the full unit gate still runs.
    const testsOnly = selectedScripts({ entries: [{ file: "tests/ward-waitlist.test.ts", status: "M" }] }, false, {
      full: true,
    });
    expect(testsOnly).not.toContain("build");
    expect(testsOnly).toContain("check:ward-expected-reds");
    for (const file of ["README.md", "AGENTS.md"])
      expect(selectedScripts({ entries: [{ file, status: "M" }] }, false, { full: true })).not.toContain("build");
    expect(selectedScripts({ frontend_static: true })).toEqual(expect.arrayContaining(["lint", "typecheck"]));
    expect(selectedScripts({ unit: true })).not.toContain("lint");
  });
  it("keeps skipped database evidence visible when an earlier command fails", () => {
    expect(
      summarizePrLocalRun(["typecheck:backend", "test:backend:integration"], {
        failedScript: "typecheck:backend",
        failedExitCode: 1,
      }),
    ).toContain("Backend PostgreSQL integration: NOT RUN");
  });
});
