import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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
  it("follows the real shared HTTP contract's immutable variable imports", () => {
    const { root, write } = fixture();
    write(
      "tests/ward-shared-backend-contract.test.ts",
      readFileSync(new URL("./ward-shared-backend-contract.test.ts", import.meta.url), "utf8"),
    );
    write("backend/ward-flow/shared-http.mjs", "export function createSharedHandler() {};");
    write("backend/ward-flow/viewer.test-support.mjs", "export function bootstrapViewer() {};");
    const selection = selectRelatedTests({ root, changed: ["backend/ward-flow/shared-http.mjs"] });
    expect(selection.selected).toContain("tests/ward-shared-backend-contract.test.ts");
  });
  it("follows constant dynamic imports and marks unresolved or shadowed loads incomplete", () => {
    const { root, write } = fixture();
    write("tests/constant.test.ts", 'const modulePath = "../src/value"; await import(modulePath);');
    expect(selectRelatedTests({ root, changed: ["src/value.ts"] }).selected).toContain("tests/constant.test.ts");
    write("tests/dynamic.test.ts", "const modulePath = process.env.MODULE_PATH; await import(modulePath);");
    const uncertain = selectRelatedTests({ root, changed: ["src/value.ts"] });
    expect(uncertain.partial).toBe(true);
    expect(uncertain.note).toContain("unresolved module loads");
    write(
      "tests/dynamic.test.ts",
      'const modulePath = "../src/value"; function load(modulePath) { return import(modulePath); }',
    );
    expect(selectRelatedTests({ root, changed: ["src/value.ts"] }).partial).toBe(true);
  });
  it("keeps directly changed tests selected without scanning unrelated modules", () => {
    const { root } = fixture();
    expect(selectRelatedTests({ root, changed: ["tests/a.test.ts"] }).selected).toEqual(["tests/a.test.ts"]);
  });
  it("refuses paths outside the checkout", () => {
    const { root } = fixture();
    expect(() => selectRelatedTests({ root, changed: ["../elsewhere.ts"] })).toThrow(/inside the checkout/);
  });
});

describe("pinning tests are always selected with the file they pin (Deep-DP5-3)", () => {
  it("selects the permission table's pin even when nothing imports it from the changed file", () => {
    const root = mkdtempSync(path.join(tmpdir(), "ward-related-pin-"));
    const write = (file: string, source: string) => {
      mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      writeFileSync(path.join(root, file), source);
    };
    write("src/components/ward-management/ward-flow-event-roles.ts", "export const ROLES = 1;");
    write("tests/ward-event-permissions.test.ts", "export {};");
    const result = selectRelatedTests({
      root,
      changed: ["src/components/ward-management/ward-flow-event-roles.ts"],
    });
    expect(result.selected).toContain("tests/ward-event-permissions.test.ts");
  });

  it("selects nothing extra for an unrelated file", () => {
    const root = mkdtempSync(path.join(tmpdir(), "ward-related-pin-"));
    mkdirSync(path.join(root, "src"), { recursive: true });
    writeFileSync(path.join(root, "src/other.ts"), "export const other = 1;");
    expect(selectRelatedTests({ root, changed: ["src/other.ts"] }).selected).toEqual([]);
  });
});
