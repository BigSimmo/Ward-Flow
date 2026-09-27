/* What the map currently claims, in one flat file a reviewer can diff against source without
   parsing three JSON documents. */
import fs from "node:fs";
import path from "node:path";
// Beside this script, never relative to wherever it was run from.
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const load = (f) => JSON.parse(fs.readFileSync(path.join(here, f), "utf8"));
const st = load("stages.json");
const acts = load("actions.json");
const mach = load("machines.json");
const vocab = load("vocabularies.json");

const L = [];
L.push("# WHAT THE WARD JOURNEY MAP CURRENTLY SHOWS");
L.push("");
L.push(`## ${st.nodes.length} BOXES ON THE ROUTE MAP  (lane = how it is coloured)`);
for (const n of st.nodes) L.push(`- [${n.lane}] ${n.label}${n.sub ? ` — ${n.sub}` : ""}`);
L.push("");
L.push(`## ${acts.length} ACTIONS, and which boxes each is attached to`);
for (const a of acts) L.push(`- ${a.event} :: ${a.name} :: boxes = ${(a.nodes || []).join(", ") || "NONE"}`);
L.push("");
L.push(`## ${(mach.machines || []).length} STATE MACHINES`);
for (const m of mach.machines || [])
  L.push(`- ${m.name}: states = ${(m.states || []).map((x) => x.label || x.id || "?").join(" | ")}`);
L.push("");
L.push(`## ${Object.keys(vocab.lists || vocab).length} WORD LISTS the map names`);
for (const k of Object.keys(vocab.lists || vocab)) L.push(`- ${k}`);
const text = L.join("\n");
/*
 * 🔴 A FIELD READ BY THE WRONG KEY STILL PRINTS. The state names here were read as `x.name` when
 * the field is `x.label`, so every state in all eleven machines came out as "[object Object]" —
 * in a document that was still the right length, still had every heading, and still looked
 * complete. Three reviewers read that section before one of them said so.
 *
 * This is the whole failure mode of a generated document: it cannot be wrong in a way that looks
 * wrong. So refuse to write one containing the tell.
 */
if (text.includes("[object Object]")) {
  console.error(
    "REFUSING to write MAP-INVENTORY.md — something was printed by the wrong key and came out as " +
      "[object Object]. The document would look complete and say nothing.",
  );
  process.exit(1);
}
fs.writeFileSync(path.join(here, "MAP-INVENTORY.md"), text);
console.log(`MAP-INVENTORY.md written — ${L.length} lines`);
