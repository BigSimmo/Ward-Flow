---
name: ward-flow-journey-artefacts
description: "The Ward Flow patient-journey artefacts built 17-18 Sept 2026, how they are generated from the engine, and why Stately was rejected"
metadata:
  node_type: memory
  type: project
  originSessionId: 2d57ae3e-f800-40ce-8184-f96d852a4bbe
  modified: 2026-09-17T19:34:57.848Z
---

**Three artefacts, all generated from `src/components/ward-management/` rather than hand-written,
so they can be re-run when the code changes.** Working files live in the session scratchpad, not the
repo — regenerate rather than hunt for them.

🔴 **The explorer is the MASTER TOOL for mapping Ward Flow's flow and behaviour** (Josh, 18 Sept
2026). New behaviour goes on it; questions about "what can happen here" are answered from it.

| Artefact                                                      | What it is                                                                                                                                                                                                              |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ward Journey Explorer** (artifact `3aH6qnByiDjUMTG4U8aBRw`) | The live artefact. Six tabs: the route map, the behaviour (state machines), the bed decision, every action, every word list, and a generated coverage table. ⚠️ **Every count ages — read the artifact, not this row.** |
| **The Ward Journey** (artifact `YK9ne4yWWzZetXmgL2tSN6`)      | The earlier canvas. Superseded by the explorer; kept for history.                                                                                                                                                       |
| `ward-patient-journey.bpmn`                                   | The pathway in BPMN 2.0, for Camunda Modeler / bpmn.io. Pathway level only.                                                                                                                                             |

**The generation chain:** `extract-vocab.mjs` → `vocabularies.json`; `rebuild-map.mjs` →
`stages.json` (the map, computed from `{from,to,route}` edge specs — never hand-placed);
`build-explorer.mjs` injects everything into `explorer-template.html`. Both builders **refuse to
emit** rather than emit something wrong.

## The checks that make it trustworthy — each one PROVEN to fail

`rebuild-map.mjs` refuses on: two boxes overlapping; a line running behind a box it does not join.
`build-explorer.mjs` refuses on: an action modelled nowhere; a line that is not the colour of the
box it leads to; a box neither continued nor terminated; a filter that controls nothing; a colour
with no sentence saying what it means; a lane on the map the legend never names.

⚠️ **The recurring defect shape: a RULE stated in a comment but implemented as a LIST.** The stub
rule, the bypass rule and the colour rule each began as a hand-written list of ids with a comment
claiming it was one rule. Every one of them was wrong the next time a box was added. Derive from
the node list, and run the derivation AFTER the node list is complete.

## Decisions worth not relitigating

- 🔴 **Josh asked for a wireframe and meant a DIAGRAM** — boxes and connecting routes. "Thorough"
  = every option enumerated.
- **Hand-placing boxes does not scale past about twenty.** Generate and auto-layout.
- ⚠️ **Stately / XState was considered and REJECTED** — the engine is a hand-written reducer, so
  using Stately means writing a second description that drifts. Cloud product; Ward Flow never
  leaves this disk.

## Lessons

- **Verify an interchange format in the real renderer** — bpmn-js returned 104 elements, zero
  warnings. See [[a-clean-result-from-measuring-nothing]].
- **A filter keyed on a lane name silently deletes anything whose lane is not listed.**
  See [[compliance-without-coverage]].
- **A subagent's finding is a lead, not a fact.** A four-way Sonnet review on 18 Sept produced ~15
  findings; all were re-read in source before being drawn, and the reading changed several of them.
  See [[adversarial-claims-review]], [[assert-only-about-code-you-opened]].

Related: [[ward-flow-referral-model]], [[a-comment-that-asserts-an-absent-guard]],
[[ward-flow-task-ledger-is-not-outstanding-issues]], [[checks-that-cannot-fail]].
