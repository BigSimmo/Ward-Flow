// H-0918 (CQ-16): Ward Flow keeps its own copy of the host's chunk-load helper, because
// tests/ward-flow-seam.test.ts forbids ward code importing host modules. This keeps the two copies
// identical apart from the doc comment that says which copy each is.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const withoutDocComments = (path: string) =>
  readFileSync(path, "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/\/\*\*[\s\S]*?\*\//g, "");

describe("chunk-load error helper copies", () => {
  it("keep the same code in the host and Ward Flow copies", () => {
    const host = withoutDocComments("src/lib/chunk-load-error.ts");
    const ward = withoutDocComments("src/components/ward-management/ward-chunk-load-error.ts");
    expect(host.length).toBeGreaterThan(200);
    expect(ward).toBe(host);
  });
});
