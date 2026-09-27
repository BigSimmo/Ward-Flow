/*
 * The probe for the defect that got past three reviewers: a generated document that is the right
 * length, has every heading, and says nothing, because a field was read by the wrong key. Break a
 * state's label and the inventory must refuse rather than print "[object Object]".
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const M = path.join(here, "machines.json");
const OUT = path.join(here, "MAP-INVENTORY.md");
const original = fs.readFileSync(M, "utf8");
const before = fs.readFileSync(OUT, "utf8");

const broken = JSON.parse(original);
// A state that has neither a label nor an id is exactly what reading the wrong key looks like.
broken.machines[0].states[0] = { kind: "start", x: 0, y: 0, w: 1, h: 1 };
fs.writeFileSync(M, JSON.stringify(broken, null, 1));

let out = "",
  code = 0;
try {
  out = execFileSync("node", [path.join(here, "make-inventory.mjs")], { encoding: "utf8" });
} catch (e) {
  code = e.status;
  out = (e.stderr || "") + (e.stdout || "");
} finally {
  fs.writeFileSync(M, original);
}

const after = fs.readFileSync(OUT, "utf8");
// A "?" placeholder is the honest fallback and must NOT refuse; the refusal is for [object Object].
const refusedOrFellBackHonestly = code !== 0 ? out.includes("[object Object]") : !after.includes("[object Object]");
const untouched = code === 0 || after === before;

console.log(
  refusedOrFellBackHonestly && untouched
    ? code !== 0
      ? "PROVEN: an inventory that would print [object Object] is refused, and the last good one is left alone."
      : "PROVEN: a field with no readable name falls back to a visible placeholder, never to [object Object]."
    : `NOT PROVEN — exit ${code}:\n${out}`,
);

execFileSync("node", [path.join(here, "make-inventory.mjs")], { encoding: "utf8" });
process.exit(refusedOrFellBackHonestly && untouched ? 0 : 1);
