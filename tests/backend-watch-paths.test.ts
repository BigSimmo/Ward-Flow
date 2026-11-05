import { readFileSync } from "node:fs";
import { posix } from "node:path";

import { describe, expect, it } from "vitest";

import { watched } from "../backend/ward-flow/watch-paths.mjs";

/** Trace root npm lifecycle entry points and their project-local static imports without running them. */
function installInputs() {
  const manifest = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
  const pending: string[] = [];
  for (const lifecycle of ["preinstall", "postinstall"]) {
    for (const command of manifest.scripts[lifecycle].split(/\s*&&\s*/u)) {
      const entry = /^node (scripts\/[\w/.-]+\.(?:mjs|cjs|js))(?:\s|$)/u.exec(command)?.[1];
      if (!entry) throw new Error(`Update install-input tracing for ${lifecycle}: ${command}`);
      pending.push(entry);
    }
  }
  const inputs = new Set<string>();
  while (pending.length) {
    const input = pending.pop()!;
    if (inputs.has(input)) continue;
    inputs.add(input);
    const source = readFileSync(input, "utf8");
    for (const match of source.matchAll(/(?:import|export)\s[^;]*?\bfrom\s*["'](\.[^"']+)["']/gu)) {
      const dependency = posix.normalize(posix.join(posix.dirname(input), match[1]));
      if (dependency.startsWith("../")) throw new Error(`Install input leaves this repository: ${dependency}`);
      pending.push(dependency);
    }
  }
  return [...inputs];
}

describe("backend redeploy install and runtime inputs", () => {
  it("watches root npm policy and the actual lifecycle entry points and their local imports", () => {
    const inputs = installInputs();
    expect(inputs).toContain("scripts/check-node-engine.cjs");
    expect(inputs).toContain("scripts/dependency-inventory-policy.mjs");
    expect([".npmrc", ...inputs].filter((path) => !watched(path))).toEqual([]);
  });

  it("watches supported root version selectors even when a provider override may supersede them", () => {
    for (const selector of [".nvmrc", ".node-version"]) {
      expect(readFileSync(selector, "utf8").trim()).not.toBe("");
      expect(watched(selector), selector).toBe(true);
    }
  });

  it("keeps documentation, unrelated frontend changes and lookalike install files outside the contract", () => {
    for (const path of ["docs/hosting.md", "src/app/page.tsx", "scripts/check-node-engine.cjs.bak"]) {
      expect(watched(path), path).toBe(false);
    }
  });
});
