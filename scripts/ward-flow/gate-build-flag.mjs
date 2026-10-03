#!/usr/bin/env node
// Ward Flow gate: may this batch's app build skip its own type check (WARD_GATE_BUILD=1)?
//
//   node scripts/ward-flow/gate-build-flag.mjs [--base <ref>] [--head <ref>]
//
// Prints WARD_GATE_BUILD=0|1 and WARD_GATE_SKIP_TOOLING=0|1 (R32: skip tooling tests when the
// batch changes no scripts, hooks, package, test setup or tool config). Josh's ruling (25 September 2026): skip it only
// when the batch changes no page, layout or route file. The gate's full tsc covers everything else,
// but only the build validates Next's generated route types, so any route-shaped file keeps the
// build's own check on. Default base is the ward line; the diff is base...head.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LINE = "origin/main";

const ROUTE_FILE =
  /(^|\/)src\/app\/(.+\/)?(page|layout|route|template|default|loading|error|global-error|not-found)\.[cm]?[jt]sx?$|^src\/(proxy|middleware)\.[jt]s$|^(middleware|next\.config)\.[cm]?[jt]s$|^tsconfig[^/]*\.json$|(^|\/)next-env[^/]*\.d\.ts$/;

/** True when any changed file is a route-shaped file whose types only the Next build validates. */
export function touchesRouteFiles(files) {
  return files.some((file) => ROUTE_FILE.test(file.replace(/\\/g, "/")));
}

const TOOLING_FILE =
  /^(scripts\/|\.githooks\/|\.husky\/|tests\/setup\/)|^(package|package-lock)\.json$|^(vitest|playwright|next)\.config\.|^vitest\.[\w.-]+\.(m?[jt]s)$|^tsconfig[^/]*\.json$/;

/** True when the batch changes tooling, so the gate must run the tooling tests (R32). */
export function touchesTooling(files) {
  return files.some((file) => TOOLING_FILE.test(file.replace(/\\/g, "/")));
}

const same = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
if (process.argv[1] && same(process.argv[1], fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
  const files = execFileSync("git", ["diff", "--name-only", `${opt("--base", LINE)}...${opt("--head", "HEAD")}`], {
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);
  console.log(`WARD_GATE_BUILD=${touchesRouteFiles(files) ? 0 : 1}`);
  console.log(`WARD_GATE_SKIP_TOOLING=${touchesTooling(files) ? 0 : 1}`);
}
