import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// CQ-08 (H-0910): the engine code map had drifted. Eleven reducer event modules were added with no
// mention there, and nothing failed. Every `ward-flow-*-events.ts` file must now be named in the
// "Event modules" list of docs/ward-flow/code-map/engine.md.

const ROOT = path.resolve(__dirname, "..");
const ENGINE = path.join(ROOT, "src/components/ward-management");

function eventModules(): string[] {
  return readdirSync(ENGINE)
    .filter((name) => /^ward-flow-.+-events\.ts$/.test(name))
    .sort();
}

function moduleSection(): string {
  const map = readFileSync(path.join(ROOT, "docs/ward-flow/code-map/engine.md"), "utf8");
  const start = map.indexOf("### Event modules");
  const end = map.indexOf("\n## ", start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return map.slice(start, end);
}

describe("engine code map event modules", () => {
  it("names every reducer event module", () => {
    const section = moduleSection();
    const modules = eventModules();
    expect(modules.length).toBeGreaterThan(0);
    expect(modules.filter((name) => !section.includes(`\`${name}\``))).toEqual([]);
  });
});
