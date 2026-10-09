import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { collectWardModuleGraph, wardModuleSpecifiers } from "./helpers/ward-module-graph";

function fixtureGraph(sources: Record<string, string>) {
  const files = new Map(Object.entries(sources).map(([file, source]) => [resolve("/synthetic-ward", file), source]));
  return collectWardModuleGraph([resolve("/synthetic-ward", "entry.tsx")], {
    readSource: (file) => {
      const source = files.get(file);
      if (source === undefined) throw new Error(`Missing fixture module ${file}`);
      return source;
    },
    resolveSpecifier: (specifier, from) => {
      if (!specifier.startsWith(".")) return null;
      return files.has(resolve(dirname(from), `${specifier}.ts`)) ? resolve(dirname(from), `${specifier}.ts`) : null;
    },
  });
}

describe("Ward type-inclusive boundary module graph", () => {
  it("follows a nested literal dynamic import through sourced re-exports to the actual boundary violation", () => {
    const graph = fixtureGraph({
      "entry.tsx": 'export function select() { return import("./bridge"); }',
      "bridge.ts": 'export * from "./unsafe";',
      "unsafe.ts": 'import type { Referral } from "./ward-model"; export type Unsafe = Referral;',
      "ward-model.ts": "export type Referral = { destinations: string[] };",
    });
    const forbidden = [...graph].filter(([, source]) => /import type \{ Referral \}/.test(source));
    expect(forbidden.map(([file]) => file)).toEqual([resolve("/synthetic-ward", "unsafe.ts")]);
    expect(graph.has(resolve("/synthetic-ward", "ward-model.ts"))).toBe(true);
  });

  it("retains type-only imports/re-exports, side effects and cycles without inventing value-export edges", () => {
    const graph = fixtureGraph({
      "entry.tsx":
        'import type { Scoped } from "./typed"; import "./effect"; export const caption = "import(\"./fake\")";',
      "typed.ts": 'export type { Scoped } from "./types";',
      "types.ts": 'import type { Scoped } from "./typed"; export type Scoped = number;',
      "effect.ts": "export const sideEffect = true;",
    });
    expect([...graph.keys()].sort()).toEqual(
      ["entry.tsx", "typed.ts", "types.ts", "effect.ts"].map((file) => resolve("/synthetic-ward", file)).sort(),
    );
    expect(
      wardModuleSpecifiers('export const Caption = "import(\"./fake\")"; // import("./comment")', "component.tsx"),
    ).toEqual([]);
  });

  it("includes no-substitution template import paths and inline import types", () => {
    expect(
      wardModuleSpecifiers(
        'const lazy = () => import(`./lazy`); type Props = import("./props").Props;',
        "component.tsx",
      ),
    ).toEqual(["./lazy", "./props"]);
  });

  it.each(["import(target)", "import(`./${target}`)", 'import("./" + target)', "import()"])(
    "fails closed for an unresolved computed dynamic edge: %s",
    (expression) => {
      expect(() => fixtureGraph({ "entry.tsx": `export const load = () => ${expression};` })).toThrow(
        /Cannot resolve dynamic import.*entry\.tsx/,
      );
    },
  );
});
