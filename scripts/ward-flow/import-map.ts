// Import map and layer guard (Tier 7 plan, M139, 10 Nov 2026). Prints where the app's runtime
// imports go between layers, the most-imported files, any import cycle and the screen-to-screen
// imports, and checks them against a frozen baseline that may only shrink.
//
//   node scripts/run-tsx.mjs scripts/ward-flow/import-map.ts                    print the map
//   node scripts/run-tsx.mjs scripts/ward-flow/import-map.ts --json             the map as JSON
//   node scripts/run-tsx.mjs scripts/ward-flow/import-map.ts --check            fail on a breach
//   node scripts/run-tsx.mjs scripts/ward-flow/import-map.ts --update-baseline  lower the baseline
//
// It walks the same runtime graph as tests/architecture-boundaries.test.ts (one resolver, in
// tests/helpers/module-graph.ts): `src/` only, type-only imports left out. A TypeScript type query
// such as `import("./x").T` is a type, not an import, so it is not an edge either. The guard test is
// tests/ward-import-map-guard.test.ts. Layers:
//
//   kit          src/components/wf/
//   lib          src/lib/
//   ward-root    files directly in src/components/ward-management/ (engine, model, provider)
//   shell        src/components/ward-management/shell/ and shell-next/ (the chrome that mounts screens)
//   screen:<x>   any other folder under src/components/ward-management/
//   route        src/app/ (mockups apart)
//   mockup       src/app/mockups/
//   component    the rest of src/components/
//   other        everything else in src/
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { relative, runtimeGraph } from "../../tests/helpers/module-graph";

const WARD = "src/components/ward-management/";
const SHARED_WARD_FOLDERS = new Set(["shell", "shell-next"]);
export const BASELINE_PATH = join(dirname(fileURLToPath(import.meta.url)), "import-map-baseline.json");

export type ImportMapBaseline = {
  /** Every runtime import cycle allowed today, each as a sorted file list. Today: none. */
  cycles: string[][];
  /** Imports from one ward screen folder into another (shell apart). May only fall. */
  screenToScreenImports: number;
};

export function layerOf(file: string): string {
  if (file.startsWith("src/components/wf/")) return "kit";
  if (file.startsWith("src/lib/")) return "lib";
  if (file.startsWith(WARD)) {
    const rest = file.slice(WARD.length);
    if (!rest.includes("/")) return "ward-root";
    const folder = rest.split("/")[0];
    return SHARED_WARD_FOLDERS.has(folder) ? "shell" : `screen:${folder}`;
  }
  if (file.startsWith("src/app/mockups/")) return "mockup";
  if (file.startsWith("src/app/")) return "route";
  if (file.startsWith("src/components/")) return "component";
  return "other";
}

const isScreen = (layer: string) => layer.startsWith("screen:");
const isWard = (layer: string) => isScreen(layer) || layer === "ward-root" || layer === "shell";
const group = (layer: string) => (isScreen(layer) ? "screen" : layer);

/** Strongly connected components with more than one file, or a file that imports itself. */
export function findCycles(graph: Map<string, string[]>): string[][] {
  let nextIndex = 0;
  const indexes = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const cycles: string[][] = [];
  const visit = (file: string) => {
    indexes.set(file, nextIndex);
    lowLinks.set(file, nextIndex);
    nextIndex += 1;
    stack.push(file);
    onStack.add(file);
    for (const dependency of graph.get(file) ?? []) {
      if (!indexes.has(dependency)) {
        visit(dependency);
        lowLinks.set(file, Math.min(lowLinks.get(file)!, lowLinks.get(dependency)!));
      } else if (onStack.has(dependency)) {
        lowLinks.set(file, Math.min(lowLinks.get(file)!, indexes.get(dependency)!));
      }
    }
    if (lowLinks.get(file) !== indexes.get(file)) return;
    const component: string[] = [];
    let current: string;
    do {
      current = stack.pop()!;
      onStack.delete(current);
      component.push(current);
    } while (current !== file);
    if (component.length > 1 || (graph.get(file) ?? []).includes(file)) cycles.push(component.sort());
  };
  for (const file of graph.keys()) if (!indexes.has(file)) visit(file);
  return cycles.sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]));
}

export type ImportMap = ReturnType<typeof buildImportMap>;

/** Summarise a graph whose keys and values are repository-relative paths. */
export function buildImportMap(graph: Map<string, string[]>) {
  const layerSizes: Record<string, number> = {};
  const layerEdges: Record<string, number> = {};
  const fanIn = new Map<string, number>();
  const screenPairs: Record<string, number> = {};
  const kitOrLibIntoWard: string[] = [];
  const liveIntoMockup: string[] = [];
  let edges = 0;
  let screenToScreenImports = 0;

  for (const file of graph.keys()) {
    const layer = group(layerOf(file));
    layerSizes[layer] = (layerSizes[layer] ?? 0) + 1;
  }
  for (const [file, dependencies] of graph) {
    const from = layerOf(file);
    for (const target of dependencies) {
      const to = layerOf(target);
      edges += 1;
      fanIn.set(target, (fanIn.get(target) ?? 0) + 1);
      const key = `${group(from)} -> ${group(to)}`;
      layerEdges[key] = (layerEdges[key] ?? 0) + 1;
      if ((from === "kit" || from === "lib") && isWard(to)) kitOrLibIntoWard.push(`${file} -> ${target}`);
      if (from !== "mockup" && to === "mockup") liveIntoMockup.push(`${file} -> ${target}`);
      if (isScreen(from) && isScreen(to) && from !== to) {
        screenToScreenImports += 1;
        const pair = `${from.slice(7)} -> ${to.slice(7)}`;
        screenPairs[pair] = (screenPairs[pair] ?? 0) + 1;
      }
    }
  }

  const sortCounts = (record: Record<string, number>) =>
    Object.entries(record).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return {
    files: graph.size,
    edges,
    layerSizes: Object.fromEntries(sortCounts(layerSizes)),
    layerEdges: Object.fromEntries(sortCounts(layerEdges)),
    topFanIn: [...fanIn]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 15)
      .map(([file, importers]) => ({ file, importers })),
    cycles: findCycles(graph),
    kitOrLibIntoWard: kitOrLibIntoWard.sort(),
    liveIntoMockup: liveIntoMockup.sort(),
    screenToScreenImports,
    screenFolderPairs: Object.keys(screenPairs).length,
    topScreenPairs: sortCounts(screenPairs)
      .slice(0, 15)
      .map(([pair, imports]) => ({ pair, imports })),
  };
}

/** The repository's own runtime graph, as relative paths. */
export function repositoryImportMap() {
  const { graph } = runtimeGraph();
  const relativeGraph = new Map<string, string[]>();
  for (const [file, dependencies] of graph) relativeGraph.set(relative(file), dependencies.map(relative));
  return buildImportMap(relativeGraph);
}

export function readBaseline(): ImportMapBaseline {
  return JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as ImportMapBaseline;
}

/** Every way the map breaks the frozen rules; empty when it passes. */
export function breaches(map: ImportMap, baseline: ImportMapBaseline): string[] {
  const problems: string[] = [];
  const allowed = new Set(baseline.cycles.map((cycle) => [...cycle].sort().join("|")));
  for (const cycle of map.cycles) {
    if (!allowed.has(cycle.join("|")))
      problems.push(`new or grown import cycle (${cycle.length} files): ${cycle.join(", ")}`);
  }
  for (const edge of map.kitOrLibIntoWard) problems.push(`the kit or src/lib imports ward code: ${edge}`);
  for (const edge of map.liveIntoMockup) problems.push(`live code imports a mockup: ${edge}`);
  if (map.screenToScreenImports > baseline.screenToScreenImports)
    problems.push(
      `screen-to-screen imports rose from ${baseline.screenToScreenImports} to ${map.screenToScreenImports}; ` +
        "move the shared part to the ward root or the kit instead",
    );
  return problems;
}

export function formatMap(map: ImportMap): string {
  const lines = [
    `Import map: ${map.files} files in src/, ${map.edges} runtime imports (type-only imports left out).`,
    "",
    "Files per layer:",
    ...Object.entries(map.layerSizes).map(([layer, count]) => `  ${String(count).padStart(5)}  ${layer}`),
    "",
    "Imports between layers (from -> to):",
    ...Object.entries(map.layerEdges).map(([pair, count]) => `  ${String(count).padStart(5)}  ${pair}`),
    "",
    "Most imported files:",
    ...map.topFanIn.map(({ file, importers }) => `  ${String(importers).padStart(5)}  ${file}`),
    "",
    `Import cycles: ${map.cycles.length}`,
    ...map.cycles.map((cycle) => `  ${cycle.length} files: ${cycle.join(", ")}`),
    `Kit or src/lib importing ward code: ${map.kitOrLibIntoWard.length}`,
    `Live code importing mockups: ${map.liveIntoMockup.length}`,
    `Screen-to-screen imports (shell apart): ${map.screenToScreenImports}, across ${map.screenFolderPairs} folder pairs`,
    ...map.topScreenPairs.map(({ pair, imports }) => `  ${String(imports).padStart(5)}  ${pair}`),
  ];
  return lines.join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const map = repositoryImportMap();
  const argv = process.argv.slice(2);
  if (argv.includes("--update-baseline")) {
    const baseline = readBaseline();
    const problems = breaches(map, baseline);
    if (problems.length > 0) {
      console.error("[import-map] REFUSED: the baseline can only fall. Fix these first:");
      for (const problem of problems) console.error(`  ${problem}`);
      process.exit(1);
    }
    const next: ImportMapBaseline = {
      ...baseline,
      cycles: map.cycles,
      screenToScreenImports: map.screenToScreenImports,
    };
    writeFileSync(BASELINE_PATH, `${JSON.stringify(next, null, 2)}\n`);
    console.log(
      `[import-map] baseline written: ${map.cycles.length} cycles, ${map.screenToScreenImports} screen-to-screen imports.`,
    );
  } else if (argv.includes("--check")) {
    const problems = breaches(map, readBaseline());
    if (problems.length > 0) {
      console.error("[import-map] Layer rules broken:");
      for (const problem of problems) console.error(`  ${problem}`);
      process.exit(1);
    }
    console.log(
      `[import-map] ${map.files} files, ${map.cycles.length} cycles, ${map.screenToScreenImports} screen-to-screen imports. Not risen.`,
    );
  } else {
    console.log(argv.includes("--json") ? JSON.stringify(map, null, 2) : formatMap(map));
  }
}
