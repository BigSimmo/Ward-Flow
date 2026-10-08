import assert from "node:assert/strict";
import fs from "node:fs";
import DATA from "./data.mjs";
import { createAudit } from "./audit.mjs";

const unique = (items, kind) => {
  assert.equal(new Set(items.map((x) => x.id)).size, items.length, `Duplicate ${kind} ID`);
};
unique(DATA.nodes, "node");
unique(DATA.edges, "edge");
unique(DATA.sources, "source");
const nodes = new Map(DATA.nodes.map((n) => [n.id, n]));
const sources = new Set(DATA.sources.map((s) => s.id));
const interactions = new Set(DATA.interactions.map((i) => i.id));
for (const node of DATA.nodes) {
  assert(
    DATA.groups.some((g) => g.id === node.group),
    `Unknown group ${node.id}`,
  );
  assert(
    DATA.edges.some((e) => e.to === node.id),
    `No inbound route: ${node.id}`,
  );
  if (node.kind !== "endpoint")
    assert(
      DATA.edges.some((e) => e.from === node.id),
      `Non-endpoint without onward route: ${node.id}`,
    );
  for (const id of node.sourceIds) assert(sources.has(id), `Missing node source ${id}`);
}
for (const edge of DATA.edges) {
  assert(nodes.has(edge.from) && nodes.has(edge.to), `Dangling edge ${edge.id}`);
  assert(interactions.has(edge.type), `Unknown interaction ${edge.id}`);
  assert(["design", "documented"].includes(edge.basis), `Unlabelled evidence ${edge.id}`);
  assert(edge.guards.length >= 4 && edge.note, `Missing conditions ${edge.id}`);
  if (edge.basis === "documented") assert(edge.sourceIds.length, `Documented family without source ${edge.id}`);
  for (const id of edge.sourceIds) assert(sources.has(id), `Missing edge source ${id}`);
  assert(nodes.get(edge.from).kind !== "endpoint", `Terminal outcome has an outgoing route: ${edge.id}`);
}
for (const row of DATA.entryRoutes)
  for (const id of row.sourceIds) assert(sources.has(id), `Missing entry source ${id}`);
for (const scenario of DATA.scenarios) {
  for (let i = 1; i < scenario.steps.length; i++) {
    assert(
      DATA.edges.some((e) => e.from === scenario.steps[i - 1] && e.to === scenario.steps[i]),
      `Scenario has invented hop ${scenario.id} ${i}`,
    );
  }
}
// Coverage obligations for this review: distinguish direct/parallel care, cycles, and real outcomes.
for (const [from, to] of [
  ["acute", "acute"],
  ["cmh", "cmh"],
  ["acute", "leave"],
  ["leave", "acute"],
  ["acute", "hith"],
  ["cmh", "susd"],
  ["acute", "susd"],
  ["custody", "forensic"],
  ["forensic", "forensiccommunity"],
  ["regional", "acute"],
  ["acute", "interstate"],
  ["aodcommunity", "cmh"],
  ["ed", "medical"],
  ["acute", "missing"],
  ["cmh", "closed"],
  ["medical", "death"],
]) {
  assert(
    DATA.edges.some((e) => e.from === from && e.to === to),
    `Required family missing ${from} -> ${to}`,
  );
}
assert.equal(DATA.nodes.find((n) => n.id === "leave").kind, "state");
assert.equal(DATA.nodes.find((n) => n.id === "missing").kind, "state");
assert.equal(DATA.nodes.find((n) => n.id === "followup").kind, "team");
assert.equal(DATA.nodes.find((n) => n.id === "death").kind, "endpoint");
assert(DATA.legalTransitions.length >= 10 && DATA.gaps.length >= 7);
const stages = JSON.parse(fs.readFileSync(new URL("../stages.json", import.meta.url)));
const actions = JSON.parse(fs.readFileSync(new URL("../actions.json", import.meta.url)));
const audit = createAudit(stages, actions);
assert.equal(audit.orderedPairs.length, DATA.nodes.length ** 2);
assert.equal(new Set(audit.orderedPairs.map((p) => `${p.from}/${p.to}`)).size, DATA.nodes.length ** 2);
assert.deepEqual(audit.eventCoverage.unmappedCases, [], "Reducer event catalogue has drifted");
assert.deepEqual(audit.eventCoverage.unmappedRoles, [], "Role event catalogue has drifted");
const masterIds = new Set(stages.nodes.map((n) => n.id));
for (const edge of audit.masterAdditions) {
  assert(masterIds.has(edge.from) && masterIds.has(edge.to), `Dangling master overlay: ${edge.id}`);
  assert(edge.condition && edge.source && edge.event, `Unguarded master overlay: ${edge.id}`);
}
for (const edge of stages.edges.filter((e) => e.both))
  assert(
    audit.masterDirected.some((e) => e.from === edge.to && e.to === edge.from),
    "Double-arrow return lost",
  );
for (const pair of audit.orderedPairs) {
  assert(pair.status && pair.reasoning && pair.exampleLimit, "Unclassified ordered pair");
  for (const id of pair.routeIds)
    assert(
      DATA.edges.some((e) => e.id === id && e.from === pair.from && e.to === pair.to),
      "Incorrect pair route",
    );
  if (pair.from === "missing" && pair.routeIds.length) {
    for (const id of pair.routeIds.filter((id) => DATA.edges.find((e) => e.id === id).auditAdded))
      assert(
        DATA.edges.find((e) => e.id === id).note.includes("originating/accepted service"),
        "Absence return became an unrestricted destination choice",
      );
  }
  for (let i = 1; i < pair.structuralExample.length; i++)
    assert(
      DATA.edges.some(
        (e) =>
          e.from === pair.structuralExample[i - 1] &&
          e.to === pair.structuralExample[i] &&
          !["review", "absence", "closure"].includes(e.type),
      ),
      "Structural example crosses an exceptional outcome",
    );
}
console.log(
  `WA_CONNECTION_AUDIT_PASS ${audit.orderedPairs.length} classified pairs; ${audit.addedLinks} guarded additions; ${audit.masterAdditions.length} master continuations; ${audit.reverseDirections} double-arrow return directions; no uncatalogued static event labels`,
);
console.log(
  `WA_PATHWAYS_STRUCTURE_PASS ${DATA.nodes.length} nodes; ${DATA.edges.length} unique conditioned links; ${DATA.scenarios.length} valid example journeys; 16 required route families; no dangling IDs or nonterminal dead ends`,
);
