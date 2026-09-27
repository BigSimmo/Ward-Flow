import fs from "node:fs";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const read = (f) => JSON.parse(fs.readFileSync(path.join(here, f), "utf8"));
const stages = read("stages.json");
const machines = read("machines.json");
const actions = read("actions.json");

// Read the palette and the filter table FROM THE PAGE, never a copy kept here. A checker
// holding its own copy of the thing it checks reports on the copy, and stays green (or red)
// after the real thing changes.
const tpl = fs.readFileSync(path.join(here, "explorer-template.html"), "utf8");
const LANE_COLOUR = Object.fromEntries(
  [
    ...tpl
      .slice(tpl.indexOf("const LANE_COLOUR"), tpl.indexOf("// The filter buttons"))
      .matchAll(/(\w+):\s*"var\(--([a-z-]+)\)"/g),
  ].map((m) => [m[1], m[2]]),
);
// A note used to borrow a stall's grey and now carries its own annotation colour, read from
// the page like every other lane. Only the headings are still outside the palette by design.
LANE_COLOUR.heading = "-";
const FILTERS = [
  ...tpl.matchAll(/\{ id: "(\w+)",\s+label: "[^"]+",\s+colour: "var\(--[a-z-]+\)",\s*covers: \[([^\]]+)\]/g),
].map((m) => m[1]);
const COVERS = Object.fromEntries(
  [...tpl.matchAll(/\{ id: "(\w+)",\s+label: "[^"]+",\s+colour: "var\(--[a-z-]+\)",\s*covers: \[([^\]]+)\]/g)].map(
    (m) => [m[1], m[2].split(",").map((x) => x.trim().replace(/"/g, ""))],
  ),
);

console.log("=== 1. FILTER BUTTONS: does each one actually control anything on the map?");
const nodeLanes = {},
  edgeLanes = {};
for (const n of stages.nodes) nodeLanes[n.lane] = (nodeLanes[n.lane] || 0) + 1;
for (const e of stages.edges) {
  const l = e.lane || "expected";
  edgeLanes[l] = (edgeLanes[l] || 0) + 1;
}
for (const f of FILTERS) {
  const n = COVERS[f].reduce((a, l) => a + (nodeLanes[l] || 0), 0);
  const e = COVERS[f].reduce((a, l) => a + (edgeLanes[l] || 0), 0);
  console.log(
    `  ${f.padEnd(10)} boxes ${String(n).padStart(2)}  lines ${String(e).padStart(2)}  ${n + e === 0 ? "<-- CONTROLS NOTHING" : ""}`,
  );
}

console.log("\n=== 2. COLOUR: which meanings share one colour?");
const byColour = {};
for (const [lane, c] of Object.entries(LANE_COLOUR)) {
  if (c === "-") continue;
  if (!(nodeLanes[lane] || edgeLanes[lane])) continue;
  (byColour[c] ||= []).push(lane);
}
for (const [c, lanes] of Object.entries(byColour))
  console.log(
    `  ${c.padEnd(8)} ${lanes.join(", ")}${lanes.length > 1 ? "   <-- " + lanes.length + " MEANINGS, ONE COLOUR" : ""}`,
  );

console.log("\n=== 3. MODELLED BEHAVIOUR WITH NO BOX ON THE ROUTE MAP");
const mapText = stages.nodes
  .map((n) => `${n.label} ${n.sub || ""}`)
  .join(" ")
  .toLowerCase();
const probes = {
  "the expects door (triaged, not yet arrived)": ["expect", "not here yet", "turned up", "in the department"],
  "legal status changing": ["legal status", "voluntary", "involuntary"],
  "an examination outcome": ["examination", "inpatient order", "community order"],
  "the bed-eligibility decision (13 gates)": ["eligib", "suit", "gate", "refus"],
  escalation: ["escalat"],
  "flagging a patient urgent": ["urgent"],
  "notices to a ward or officer": ["notice", "told", "notified"],
  "the coordinator's inbox": ["inbox", "acknowledg"],
  "a legal form arriving": ["legal form", "form 1a", "paperwork"],
  "approved leave": ["leave"],
  "a second examination": ["further examination", "second examination"],
  "medical clearance": ["clearance", "cleared"],
};
for (const [what, words] of Object.entries(probes)) {
  const hit = words.some((w) => mapText.includes(w));
  if (!hit) console.log(`  MISSING: ${what}`);
}

console.log("\n=== 4. ACTIONS ATTACHED TO NO MAP BOX");
const attached = new Set(actions.flatMap((a) => a.nodes || []));
const orphanActions = actions.filter((a) => !(a.nodes || []).length);
console.log(`  ${orphanActions.length} of ${actions.length} actions sit on no box:`);
const byGroup = {};
for (const a of orphanActions) (byGroup[a.group] ||= []).push(a.name);
for (const [g, list] of Object.entries(byGroup)) console.log(`    ${g}: ${list.length}`);

console.log("\n=== 5. MAP BOXES WITH NO ACTIONS BEHIND THEM");
const ids = new Set(stages.nodes.filter((n) => !["heading", "note"].includes(n.lane)).map((n) => n.id));
const bare = [...ids].filter((id) => !attached.has(id));
for (const id of bare) console.log(`  ${stages.nodes.find((n) => n.id === id).label}`);
