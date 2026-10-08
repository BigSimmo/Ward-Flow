import assert from "node:assert/strict";
import DATA from "./data.mjs";

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
console.log(
  `WA_PATHWAYS_STRUCTURE_PASS ${DATA.nodes.length} nodes; ${DATA.edges.length} unique conditioned links; ${DATA.scenarios.length} valid example journeys; 16 required route families; no dangling IDs or nonterminal dead ends`,
);
