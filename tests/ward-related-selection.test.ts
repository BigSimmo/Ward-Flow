import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { selectRelatedTests } from "../scripts/ward-flow/related-test-selection.mjs";

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "ward-related-contract-"));
  const write = (file: string, source: string) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), source);
  };
  write("src/value.ts", "export const value = 1;");
  write("tests/a.test.ts", 'import { value } from "../src/value";');
  write("tests/b.test.ts", 'import { value } from "../src/value";');
  write("tests/ward-one-appearance-key.test.ts", 'import { readFileSync } from "node:fs";');
  return { root, write };
}

describe("declared source-reading dependency selection", () => {
  it("keeps mandatory source-reading contracts when runtime import fan-out is capped", () => {
    const { root } = fixture();
    const selected = selectRelatedTests({ root, changed: ["src/value.ts"], cap: 1 });
    expect(selected.partial).toBe(true);
    expect(selected.selected).toContain("tests/ward-one-appearance-key.test.ts");
    expect(selected.note).toContain("batch gate covers the rest");
  });
  it("reports source guards deferred to a full unit lane as partial evidence", () => {
    const { root } = fixture();
    const selected = selectRelatedTests({ root, changed: ["src/value.ts"], includeSourceGuards: false });
    expect(selected.selected).not.toContain("tests/ward-one-appearance-key.test.ts");
    expect(selected.deferredSourceGuards).toEqual(["tests/ward-one-appearance-key.test.ts"]);
    expect(selected.partial).toBe(true);
  });
  it("resolves emitted .js specifiers back to local TypeScript inputs", () => {
    const { root, write } = fixture();
    write("src/reexport.ts", 'export { value } from "./value.js";');
    write("tests/c.test.ts", 'import { value } from "../src/reexport";');
    expect(selectRelatedTests({ root, changed: ["src/value.ts"] }).selected).toContain("tests/c.test.ts");
  });
  it("refuses paths outside the checkout", () => {
    const { root } = fixture();
    expect(() => selectRelatedTests({ root, changed: ["../elsewhere.ts"] })).toThrow(/inside the checkout/);
  });
});
