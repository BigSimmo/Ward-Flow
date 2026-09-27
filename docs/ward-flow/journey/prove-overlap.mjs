/* A check nobody has seen fail is a check nobody has seen. Add an overlapping box and make
   sure the rebuild refuses and names both boxes. */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { guardClean, restore, writeStubbornly } from "./probe-io.mjs";
const p = "rebuild-map.mjs";
// Refuses rather than adopting a file an interrupted run left broken — see probe-io.mjs.
const orig = guardClean(p, ["probeClash"]);
const probe = orig.replace(
  "/* ── compute the paths",
  'add({ id: "probeClash", lane: "expected", x: WD.x + 10, y: 210, w: 200, h: 40, label: "PROBE" });\n/* ── compute the paths',
);
if (probe === orig) throw new Error("probe anchor not found");
writeStubbornly(p, probe);
let out = "",
  code = 0;
try {
  execFileSync("node", [p], { encoding: "utf8" });
} catch (e) {
  code = e.status;
  out = (e.stderr || "") + (e.stdout || "");
} finally {
  restore(p, orig);
}
const named = out.includes("PROBE") && out.includes("A referral is raised");
console.log(
  code !== 0 && named
    ? "PROVEN: the rebuild refuses on an overlapping box, and names both boxes."
    : `NOT PROVEN — exit ${code}, output:\n${out}`,
);
process.exit(code !== 0 && named ? 0 : 1);
