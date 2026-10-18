import { describe, expect, it } from "vitest";
import { selectedScripts, validateSelectedScripts } from "../scripts/verify-pr-local.mjs";
describe("actual Ward local verification plan", () => {
  it("checks maintained links, current architecture and inventory for every acceptance scope", () => {
    for (const file of ["README.md", "AGENTS.md", "src/app/page.tsx", "backend/ward-flow/backend.test.mjs"])
      expect(selectedScripts({ entries: [{ file, status: "M" }] })).toEqual(
        expect.arrayContaining(["docs:check-links", "docs:check-index", "docs:check-inventory"]),
      );
  });
  it("keeps Ward prose static, maintained policy exact, and source or unknown conservative", () => {
    const select = (file: string, status = "M") => selectedScripts({ entries: [{ file, status }] });
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
  it("selects browser coverage in the default and extended plans without a second ladder", () => {
    const scope = { entries: [{ file: "src/app/page.tsx", status: "M" }] };
    expect(selectedScripts(scope)).toEqual(selectedScripts(scope, true));
  });
});
