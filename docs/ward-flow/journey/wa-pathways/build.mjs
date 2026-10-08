import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import DATA from "./data.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../..");
const original = JSON.parse(fs.readFileSync(path.join(here, "../stages.json"), "utf8"));
const actions = JSON.parse(fs.readFileSync(path.join(here, "../actions.json"), "utf8"));
const machines = JSON.parse(fs.readFileSync(path.join(here, "../machines.json"), "utf8"));
const git = (args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
const artifactData = {
  ...DATA,
  provenance: {
    base: "ce1f865ba1cdd2983245b5ca072a230977f14000",
    branch: git(["branch", "--show-current"]),
    inputHash: createHash("sha256")
      .update(fs.readFileSync(path.join(here, "data.mjs")))
      .update(fs.readFileSync(path.join(here, "template.html")))
      .update(JSON.stringify({ original, actions, machines }))
      .digest("hex"),
    sourceKind: "Curated WA review model; not executable app workflow",
  },
  prototype: {
    nodes: original.nodes.length,
    actions: actions.length,
    machines: machines.machines.length,
    references: ["../stages.json", "../actions.json", "../machines.json"],
    status: "Source snapshot only; app interactions and historical gaps not revalidated",
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
    ["from", "to", "status", "direct_route_ids"],
    ...DATA.nodes.flatMap((from) =>
      DATA.nodes.map((to) => {
        const direct = DATA.edges.filter((e) => e.from === from.id && e.to === to.id);
        return [
          from.label,
          to.label,
          direct.length
            ? "Explicit conditional link(s)"
            : from.id === to.id
              ? "No same-category link modelled"
              : "No direct link modelled; not evidence of impossibility",
          direct.map((e) => e.id).join(" | "),
        ];
      }),
    ),
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
