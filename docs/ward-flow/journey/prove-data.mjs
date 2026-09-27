/*
 * The probe for the defect that got furthest: a page built with no data in it, reported as a
 * success. Break the marker the way the formatter broke it — by changing the text around it — and
 * the build must refuse rather than write a blank page and print its usual summary.
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { guardClean, restore, writeStubbornly } from "./probe-io.mjs";

const T = "explorer-template.html";
// Refuses rather than adopting a file an interrupted run left broken — see probe-io.mjs.
const tpl = guardClean(T, ["marker removed by the probe"]);
const MARKER = /\/\*__DATA__\*\/\s*null/;
if (!MARKER.test(tpl)) throw new Error("the marker is already missing; this probe would prove nothing");

const before = fs.statSync("ward-journey-explorer.html").size;
writeStubbornly(T, tpl.replace(MARKER, "null /* marker removed by the probe */"));

let out = "",
  code = 0;
try {
  out = execFileSync("node", ["build-explorer.mjs"], { encoding: "utf8" });
} catch (e) {
  code = e.status;
  out = (e.stderr || "") + (e.stdout || "");
} finally {
  restore(T, tpl);
}

const after = fs.statSync("ward-journey-explorer.html").size;
const refused = code !== 0 && out.includes("would open blank");
const untouched = after === before;

console.log(
  refused && untouched
    ? "PROVEN: a page that would open blank is refused, and the last good page is left alone."
    : `NOT PROVEN — exit ${code}, page ${untouched ? "untouched" : "OVERWRITTEN"}:\n${out}`,
);

execFileSync("node", ["build-explorer.mjs"], { encoding: "utf8" });
process.exit(refused && untouched ? 0 : 1);
