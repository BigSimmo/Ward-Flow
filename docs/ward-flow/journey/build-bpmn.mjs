// Emits a BPMN 2.0 file of the Ward Flow patient pathway, laid out top-to-bottom so it
// matches the route map. Opens in Camunda Modeler or bpmn.io.
//
// Deliberately at PATHWAY level: the sequence, the decisions, and the things that interrupt it.
// The 71 individual actions live in the explorer — a BPMN diagram of all of them would be
// exactly as unreadable as any other diagram of all of them.
import fs from "node:fs";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

// x is the lane centre; the pathway runs down the middle, branches sit either side.
const SPINE = 560,
  LEFT = 120,
  RIGHT = 1010;
const TASK_W = 200,
  TASK_H = 80,
  GW = 50,
  EV = 36;

/** type: start | end | task | gateway | parallel | interrupt  */
const N = [
  { id: "Start_referral", type: "start", name: "A referral is raised", x: SPINE + TASK_W / 2 - EV / 2, y: 60 },
  { id: "Task_address", type: "task", name: "Address it to up to three places at once", x: SPINE, y: 150 },
  { id: "Gw_answer", type: "gateway", name: "How does each place answer?", x: SPINE + TASK_W / 2 - GW / 2, y: 280 },
  { id: "End_declined", type: "end", name: "Declined everywhere — the person stops moving", x: LEFT + 82, y: 283 },
  { id: "End_withdrawn", type: "end", name: "The referrer withdraws", x: LEFT + 82, y: 380 },
  { id: "Task_accepted", type: "task", name: "A ward accepts", x: SPINE, y: 380 },
  { id: "Task_movement", type: "task", name: "A movement is created — this is what moves", x: SPINE, y: 500 },
  { id: "Task_askWards", type: "task", name: "Ask one or more wards", x: SPINE, y: 620 },
  { id: "Gw_ward", type: "gateway", name: "Does a ward take the patient?", x: SPINE + TASK_W / 2 - GW / 2, y: 750 },
  { id: "Task_declined", type: "task", name: "A ward declines — seven reasons", x: LEFT, y: 725 },
  { id: "End_abandoned", type: "end", name: "Bed search abandoned — did not proceed", x: RIGHT + 82, y: 758 },
  { id: "Task_community", type: "task", name: "Sent to a community team instead", x: RIGHT, y: 620 },
  { id: "Task_inPrinciple", type: "task", name: "A ward accepts in principle", x: SPINE, y: 850 },
  { id: "Task_pull", type: "task", name: "Pull and hold a named bed", x: SPINE, y: 970 },
  { id: "Task_releasePull", type: "task", name: "Give the held bed back — four reasons", x: LEFT, y: 970 },
  { id: "Gw_transport", type: "gateway", name: "Is transport needed?", x: SPINE + TASK_W / 2 - GW / 2, y: 1100 },
  { id: "Task_book", type: "task", name: "Book transport — five answers, none defaulted", x: SPINE, y: 1190 },
  { id: "Task_cancel", type: "task", name: "Cancel before collection — four reasons", x: LEFT, y: 1190 },
  { id: "Task_handover", type: "task", name: "Handover ready", x: SPINE, y: 1310 },
  { id: "Task_enroute", type: "task", name: "The crew accepts and sets off", x: SPINE, y: 1430 },
  { id: "Task_collect", type: "task", name: "The patient is collected", x: SPINE, y: 1550 },
  { id: "Task_stop", type: "task", name: "Stop the journey — say where they now are", x: LEFT, y: 1550 },
  { id: "End_heldBed", type: "end", name: "Movement closed, bed still held", x: LEFT + 82, y: 1683 },
  { id: "Task_arrive", type: "task", name: "The ward confirms they have arrived", x: SPINE, y: 1670 },
  { id: "Task_onWard", type: "task", name: "On the ward", x: SPINE, y: 1790 },
  { id: "Task_away", type: "task", name: "Away at an ED, or on leave — bed kept", x: RIGHT, y: 1790 },
  { id: "Task_ready", type: "task", name: "Clinically ready to leave", x: SPINE, y: 1910 },
  { id: "Gw_split", type: "parallel", name: "Two tracks, joined by nothing", x: SPINE + TASK_W / 2 - GW / 2, y: 2040 },
  { id: "Task_leaves", type: "task", name: "The person leaves — eight recorded ways", x: LEFT + 120, y: 2130 },
  {
    id: "Task_bedFree",
    type: "task",
    name: "The bed is released — expected, confirmed, discharged",
    x: RIGHT - 120,
    y: 2130,
  },
  { id: "End_gone", type: "end", name: "Gone", x: LEFT + 202, y: 2263 },
  { id: "End_bedFree", type: "end", name: "Bed counted as available", x: RIGHT - 38, y: 2263 },
];

// Interrupting boundary events — the shapes BPMN exists for.
const BOUNDARY = [
  {
    id: "Bnd_revoked",
    attachedTo: "Task_enroute",
    name: "Legal authority revoked — collection refused while a bed is held",
    x: SPINE + TASK_W - 18,
    y: 1430 + TASK_H - 18,
    target: "Task_stop",
  },
  {
    id: "Bnd_absconds",
    attachedTo: "Task_onWard",
    name: "The patient absconds — NO RECORD EXISTS",
    x: SPINE - 18,
    y: 1790 + TASK_H - 18,
    target: "End_absconds",
  },
];
N.push({ id: "End_absconds", type: "end", name: "Nothing can record this", x: LEFT + 202, y: 1923 });

const F = [
  ["Start_referral", "Task_address"],
  ["Task_address", "Gw_answer"],
  ["Gw_answer", "End_declined", "Declined by all"],
  ["Gw_answer", "End_withdrawn", "Referrer withdraws"],
  ["Gw_answer", "Task_accepted", "A ward says yes"],
  ["Task_accepted", "Task_movement"],
  ["Task_movement", "Task_askWards"],
  ["Task_askWards", "Gw_ward"],
  ["Gw_ward", "Task_declined", "No"],
  ["Task_declined", "Task_askWards", "ask another"],
  ["Gw_ward", "End_abandoned", "Search abandoned"],
  ["Gw_ward", "Task_inPrinciple", "Yes"],
  ["Task_askWards", "Task_community", "Community instead"],
  ["Task_community", "End_abandoned"],
  ["Task_inPrinciple", "Task_pull"],
  ["Task_pull", "Task_releasePull", "Given back"],
  ["Task_releasePull", "Task_inPrinciple", "back to awaiting a bed"],
  ["Task_pull", "Gw_transport"],
  ["Gw_transport", "Task_arrive", "None needed"],
  ["Gw_transport", "Task_book", "Yes"],
  ["Task_book", "Task_cancel", "Cancelled"],
  ["Task_cancel", "Task_pull", "bed still held"],
  ["Task_book", "Task_handover"],
  ["Task_handover", "Task_enroute"],
  ["Task_enroute", "Task_collect"],
  ["Task_collect", "Task_arrive"],
  ["Task_stop", "End_heldBed"],
  ["Task_arrive", "Task_onWard"],
  ["Task_onWard", "Task_away", "Temporarily"],
  ["Task_away", "Task_onWard", "returns"],
  ["Task_onWard", "Task_ready"],
  ["Task_ready", "Gw_split"],
  ["Gw_split", "Task_leaves"],
  ["Gw_split", "Task_bedFree"],
  ["Task_leaves", "End_gone"],
  ["Task_bedFree", "End_bedFree"],
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const size = (t) => (t === "task" ? [TASK_W, TASK_H] : t === "gateway" || t === "parallel" ? [GW, GW] : [EV, EV]);
const byId = Object.fromEntries(N.map((n) => [n.id, n]));
const centre = (n) => {
  const [w, h] = size(n.type);
  return [n.x + w / 2, n.y + h / 2];
};

const tag = {
  start: "startEvent",
  end: "endEvent",
  task: "task",
  gateway: "exclusiveGateway",
  parallel: "parallelGateway",
};

let els = "";
for (const n of N) els += `    <bpmn:${tag[n.type]} id="${n.id}" name="${esc(n.name)}" />\n`;
for (const b of BOUNDARY)
  els +=
    `    <bpmn:boundaryEvent id="${b.id}" name="${esc(b.name)}" attachedToRef="${b.attachedTo}" cancelActivity="true">\n` +
    `      <bpmn:errorEventDefinition id="${b.id}_def" />\n    </bpmn:boundaryEvent>\n`;

let flows = "";
const allFlows = [];
F.forEach(([s, t, label], i) => {
  const id = `Flow_${i + 1}`;
  allFlows.push([id, s, t]);
  flows += `    <bpmn:sequenceFlow id="${id}" sourceRef="${s}" targetRef="${t}"${label ? ` name="${esc(label)}"` : ""} />\n`;
});
BOUNDARY.forEach((b, i) => {
  const id = `Flow_b${i + 1}`;
  allFlows.push([id, b.id, b.target]);
  flows += `    <bpmn:sequenceFlow id="${id}" sourceRef="${b.id}" targetRef="${b.target}" />\n`;
});

let di = "";
for (const n of N) {
  const [w, h] = size(n.type);
  di +=
    `      <bpmndi:BPMNShape id="${n.id}_di" bpmnElement="${n.id}"${n.type !== "task" ? ' isMarkerVisible="true"' : ""}>\n` +
    `        <dc:Bounds x="${n.x}" y="${n.y}" width="${w}" height="${h}" />\n` +
    (n.type !== "task"
      ? `        <bpmndi:BPMNLabel><dc:Bounds x="${n.x - 60}" y="${n.y + h + 6}" width="${w + 120}" height="40" /></bpmndi:BPMNLabel>\n`
      : "") +
    `      </bpmndi:BPMNShape>\n`;
}
for (const b of BOUNDARY)
  di +=
    `      <bpmndi:BPMNShape id="${b.id}_di" bpmnElement="${b.id}">\n` +
    `        <dc:Bounds x="${b.x}" y="${b.y}" width="${EV}" height="${EV}" />\n` +
    `        <bpmndi:BPMNLabel><dc:Bounds x="${b.x - 80}" y="${b.y + EV + 6}" width="200" height="40" /></bpmndi:BPMNLabel>\n` +
    `      </bpmndi:BPMNShape>\n`;

const anchor = (id) => {
  const b = BOUNDARY.find((x) => x.id === id);
  if (b) return [b.x + EV / 2, b.y + EV / 2];
  return centre(byId[id]);
};
for (const [id, s, t] of allFlows) {
  const [x1, y1] = anchor(s),
    [x2, y2] = anchor(t);
  const wp =
    x1 === x2 || y1 === y2
      ? [
          [x1, y1],
          [x2, y2],
        ]
      : [
          [x1, y1],
          [x1, y2],
          [x2, y2],
        ];
  di +=
    `      <bpmndi:BPMNEdge id="${id}_di" bpmnElement="${id}">\n` +
    wp.map(([x, y]) => `        <di:waypoint x="${Math.round(x)}" y="${Math.round(y)}" />\n`).join("") +
    `      </bpmndi:BPMNEdge>\n`;
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="WardFlow_PatientJourney"
                  targetNamespace="http://wardflow.local/patient-journey">
  <bpmn:collaboration id="Collab_1">
    <bpmn:participant id="Participant_1" name="The patient's journey through Ward Flow" processRef="Process_journey" />
  </bpmn:collaboration>
  <bpmn:process id="Process_journey" name="Ward Flow — the patient's journey" isExecutable="false">
${els}${flows}  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_1">
    <bpmndi:BPMNPlane id="Plane_1" bpmnElement="Process_journey">
${di}    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
`;

const out = path.join(here, "ward-patient-journey.bpmn");
fs.writeFileSync(out, xml, "utf8");

// Fail loudly rather than shipping a file Camunda will refuse to open.
const ids = new Set([...N.map((n) => n.id), ...BOUNDARY.map((b) => b.id)]);
const dangling = allFlows.filter(([, s, t]) => !ids.has(s) || !ids.has(t));
if (dangling.length) throw new Error("flows point at elements that do not exist: " + JSON.stringify(dangling));
console.log(
  `wrote ward-patient-journey.bpmn — ${N.length} elements, ${BOUNDARY.length} interrupting events, ${allFlows.length} flows`,
);
