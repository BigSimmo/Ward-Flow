#!/usr/bin/env node
// Ward Flow review server: serve a finished journeys build so people can look at the screens.
//
//   node scripts/ward-flow/review-server.mjs --dist .next-playwright/<run-id>/dist [--port 3700]
//
// Uses the same offline mockup environment as the journeys' own server (scripts/test-environment.mjs
// plus mockups on and offline mode), because a plain `npm run build` cannot serve Ward Flow. Writes
// "REVIEW SERVER | port | commit | pid" to ward-flow-logs/gate-running.md while it runs and removes
// the line when stopped (Ctrl+C). Only a journeys build folder is accepted.
import { spawn, execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const LOGS = process.env.WARD_FLOW_LOGS ?? "D:/Repos/ward-flow-logs";
const BOARD = path.join(LOGS, "gate-running.md");
const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const dist = opt("--dist");
const port = opt("--port", "3700");
if (!dist || !/^\.next-playwright\/[a-z0-9-]+\/dist$/i.test(dist)) {
  console.log("Usage: review-server.mjs --dist .next-playwright/<run-id>/dist [--port 3700] (a journeys build folder)");
  process.exit(2);
}
const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
if (!existsSync(path.join(root, dist, "BUILD_ID"))) {
  console.log(`review-server: ${dist} has no finished build (no BUILD_ID).`);
  process.exit(1);
}
const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
const { offlineTestEnvironment } = await import(pathToFileURL(path.join(root, "scripts/test-environment.mjs")).href);

const line = `REVIEW SERVER | ${port} | ${commit} | pid ${process.pid}`;
const lines = () => (existsSync(BOARD) ? readFileSync(BOARD, "utf8").split(/\r?\n/).filter(Boolean) : []);
writeFileSync(BOARD, `${[...lines(), line].join("\n")}\n`);
const removeLine = () => {
  const kept = lines().filter((entry) => entry !== line);
  writeFileSync(BOARD, kept.length ? `${kept.join("\n")}\n` : "");
};

const server = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "start", "-p", port], {
  cwd: root,
  stdio: "inherit",
  env: offlineTestEnvironment(process.env, {
    NEXT_DIST_DIR: dist,
    NODE_ENV: "production",
    PORT: port,
    PLAYWRIGHT_OFFLINE_MODE: "true",
    NEXT_PUBLIC_MOCKUPS_ENABLED: "true",
  }),
});
console.log(`review-server: http://127.0.0.1:${port}/mockups/ward-flow from ${dist} (${commit}). Ctrl+C stops it.`);
const stop = () => {
  server.kill();
  removeLine();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
server.on("close", (code) => {
  removeLine();
  process.exit(code ?? 0);
});
