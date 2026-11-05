import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHECK_INDEX_STEPS, WRITE_GENERATOR_STEPS } from "../scripts/ward-flow/maintain-docs-and-organisation.mjs";
import { documentChecks } from "../scripts/ward-ci-public/plan.mjs";

const scripts = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).scripts;

const workflow = readFileSync(new URL("../.github/workflows/ward-flow.yml", import.meta.url), "utf8");

describe("documentation delivery checks", () => {
  it("routes existing journey commands through isolated generation and proofs", () => {
    expect(scripts["ward:journey"]).toBe("node docs/ward-flow/journey/verify.mjs --write");
    expect(scripts["ward:journey:prove"]).toBe("node docs/ward-flow/journey/verify.mjs --prove");
  });
  it.each([
    "src/components/ward-management/ward-flow-event-roles.ts",
    "docs/ward-flow/journey/actions.json",
    "src/components/ward-management/help/ward-help-guide.ts",
    "public/help/coordinator.html",
  ])("selects documentation checks when a delivery input changes: %s", (file) => {
    expect(documentChecks([{ status: "M", file }]).doc_contracts).toBe(true);
  });
  it("includes journey and printable parity in maintenance and committed CI checks", () => {
    for (const command of [
      "docs/ward-flow/journey/verify.mjs --check",
      "scripts/build-help-cheat-sheets.mjs --output public/help --check",
    ]) {
      expect(CHECK_INDEX_STEPS.some((step) => step.args.join(" ") === command)).toBe(true);
      expect(workflow).toContain(`run: node ${command}`);
    }
    expect(
      WRITE_GENERATOR_STEPS.some((step) => step.args.join(" ") === "docs/ward-flow/journey/verify.mjs --write"),
    ).toBe(true);
  });
});
