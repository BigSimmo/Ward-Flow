import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import DATA from "./data.mjs";
import { createAudit } from "./audit.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../..");
const original = JSON.parse(fs.readFileSync(path.join(here, "../stages.json"), "utf8"));
const actions = JSON.parse(fs.readFileSync(path.join(here, "../actions.json"), "utf8"));
const machines = JSON.parse(fs.readFileSync(path.join(here, "../machines.json"), "utf8"));
const audit = createAudit(original, actions);
const git = (args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
const artifactData = {
  ...DATA,
  audit,
  provenance: {
    base: "ce1f865ba1cdd2983245b5ca072a230977f14000",
    branch: git(["branch", "--show-current"]),
    inputHash: createHash("sha256")
      .update(fs.readFileSync(path.join(here, "data.mjs")))
      .update(fs.readFileSync(path.join(here, "template.html")))
      .update(fs.readFileSync(path.join(here, "audit.mjs")))
      .update(JSON.stringify(audit.inputHashes))
      .update(JSON.stringify({ original, actions, machines }))
      .digest("hex"),
    sourceKind: "Curated WA review model; not executable app workflow",
  },
  prototype: {
    stages: original,
    actionRecords: actions,
    nodes: original.nodes.length,
    actions: actions.length,
    machines: machines.machines.length,
    references: ["../stages.json", "../actions.json", "../machines.json"],
    status:
      "Connection overlay checked against two reducer branches; remaining app behaviour and historical gaps not revalidated",
  },
};
const scriptData = JSON.stringify(artifactData).replace(/</gu, "\\u003c");
const template = fs.readFileSync(path.join(here, "template.html"), "utf8");
const marker = "const DATA = {}; // __MODEL_DATA__";
if (template.split(marker).length !== 2) throw new Error("Template must contain exactly one data marker");
const html = template.replace(marker, `const DATA = ${scriptData};`);
const csv = (rows) =>
  rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/gu, '""')}"`).join(",")).join("\n") + "\n";
const byId = new Map(DATA.nodes.map((n) => [n.id, n]));
const outputs = {
  "explorer.html": html,
  "pathways.csv": csv([
    ["id", "from", "to", "interaction", "route", "evidence_basis", "conditions", "source_ids"],
    ...DATA.edges.map((e) => [
      e.id,
      byId.get(e.from).label,
      byId.get(e.to).label,
      e.type,
      e.label,
      e.basis,
      [...e.guards, e.note].join(" | "),
      e.sourceIds.join(" | "),
    ]),
  ]),
  "connections.csv": csv([
    ["from", "to", "status", "direct_route_ids", "reasoning", "structural_example_only", "example_limit"],
    ...audit.orderedPairs.map((pair) => [
      byId.get(pair.from).label,
      byId.get(pair.to).label,
      pair.status,
      pair.routeIds.join(" | "),
      pair.reasoning,
      pair.structuralExample.map((id) => byId.get(id).label).join(" -> "),
      pair.exampleLimit,
    ]),
  ]),
  "connection-audit.csv": csv([
    ["id", "from", "to", "interaction", "route", "basis", "conditions", "source_ids"],
    ...DATA.edges
      .filter((e) => e.auditAdded)
      .map((e) => [
        e.id,
        byId.get(e.from).label,
        byId.get(e.to).label,
        e.type,
        e.label,
        e.basis,
        [...e.guards, e.note].join(" | "),
        e.sourceIds.join(" | "),
      ]),
  ]),
  "master-connections.csv": csv([
    ["id", "from_box", "to_box", "disposition", "event_or_annotation", "condition", "source"],
    ...audit.masterDirected.map((e) => [
      e.id,
      e.from,
      e.to,
      e.disposition,
      e.event || e.note,
      e.condition || "Original schematic link; inspect source wording and applicable workflow conditions.",
      e.source || "docs/ward-flow/journey/stages.json",
    ]),
  ]),
};
for (const [name, body] of Object.entries(outputs)) {
  const target = path.join(here, name);
  if (process.argv.includes("--check")) {
    if (!fs.existsSync(target) || fs.readFileSync(target, "utf8") !== body)
      throw new Error(`${name} is stale; rebuild from these sources`);
  } else fs.writeFileSync(target, body);
}
console.log(
  `WA_PATHWAYS_${process.argv.includes("--check") ? "CHECK" : "BUILD"}_PASS ${DATA.nodes.length} settings/teams/states; ${DATA.edges.length} conditional links; ${DATA.sources.length} source records; ${DATA.nodes.length ** 2} ordered pairs`,
);
