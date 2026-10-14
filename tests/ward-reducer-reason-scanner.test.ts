import path from "node:path";
import { describe, expect, it } from "vitest";
import { scanReducerReasonChecks } from "./helpers/ward-reducer-reason-checks";

function scan(sources: Record<string, string>) {
  return scanReducerReasonChecks("engine/root-reducer.ts", (file) => {
    const text = sources[file.replaceAll("\\", "/")];
    if (text === undefined) throw new Error(`Missing fixture ${file}`);
    return text;
  });
}

describe("runtime reducer reason inspection", () => {
  it("attributes a multiline wrong-list check to its imported typed event handler", () => {
    const result = scan({
      "engine/root-reducer.ts": 'import { handle } from "./child-reducer"; export const reduce = handle;',
      "engine/child-reducer.ts": `export function handle(event: Extract<Event, { type: "FLAG_MOVEMENT_URGENT" }>) {
        if (!WRONG_REASONS.includes(
          event.reason
        )) return false;
      }`,
    });
    expect(result.checks).toEqual([{ event: "FLAG_MOVEMENT_URGENT", list: "WRONG_REASONS" }]);
  });

  it("follows runtime default bindings despite type-only named bindings", () => {
    const result = scan({
      "engine/root-reducer.ts": 'import handle, { type State } from "./child-reducer"; export const reduce = handle;',
      "engine/child-reducer.ts":
        'export default function handle(event: Extract<Event, { type: "FLAG_MOVEMENT_URGENT" }>) { if (!URGENT_MARK_REASONS.includes(event.reason)) return false; }',
    });
    expect(result.sources).toEqual([
      path.normalize("engine/root-reducer.ts"),
      path.normalize("engine/child-reducer.ts"),
    ]);
    expect(result.checks).toEqual([{ event: "FLAG_MOVEMENT_URGENT", list: "URGENT_MARK_REASONS" }]);
  });

  it("ignores comments, string literals and type-only import edges", () => {
    const result = scan({
      "engine/root-reducer.ts": `import type { State } from "./missing-reducer";
        import { type Event } from "./other-missing-reducer";
        // !COMMENT_REASONS.includes(event.reason)
        const prose = "!STRING_REASONS.includes(event.reason)";`,
    });
    expect(result.sources).toEqual([path.normalize("engine/root-reducer.ts")]);
    expect(result.checks).toEqual([]);
  });

  it("follows alias and namespace runtime imports", () => {
    const result = scan({
      "engine/root-reducer.ts":
        'import * as child from "@/components/ward-management/child-reducer"; export const reduce = child.handle;',
      "src/components/ward-management/child-reducer.ts":
        'export function handle(event: Event) { switch (event.type) { case "RELEASE_PULL": if (!RELEASE_PULL_REASONS.includes(event.reason)) return false; } }',
    });
    expect(result.checks).toEqual([{ event: "RELEASE_PULL", list: "RELEASE_PULL_REASONS" }]);
  });

  it("fails closed when a runtime-imported reducer cannot be inspected", () => {
    expect(() => scan({ "engine/root-reducer.ts": 'import { handle } from "./missing-reducer";' })).toThrow(
      "Missing fixture",
    );
  });

  it("inspects each source once even with duplicate imports and cycles", () => {
    const result = scan({
      "engine/root-reducer.ts": 'import { handle } from "./child-reducer"; import * as child from "./child-reducer";',
      "engine/child-reducer.ts":
        'import { reduce } from "./root-reducer"; export function handle(event: Event) { switch(event.type) { case "RELEASE_PULL": if (!RELEASE_PULL_REASONS.includes(event.reason)) return false; } }',
    });
    expect(result.sources).toHaveLength(2);
    expect(result.checks).toEqual([{ event: "RELEASE_PULL", list: "RELEASE_PULL_REASONS" }]);
    expect(result.cases.map((item) => item.name)).toEqual(["RELEASE_PULL"]);
  });
});
