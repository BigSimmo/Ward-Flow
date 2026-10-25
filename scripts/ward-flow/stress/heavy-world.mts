// Builds a very busy synthetic world (hundreds of journeys) by driving the real engine with the
// fuzz generator plus a steady stream of new ED referrals, keeping only accepted steps. Writes a
// demo scenario file the browser can load. Synthetic data only.
//   node scripts/run-tsx.mjs scripts/ward-flow/stress/heavy-world.mts --scenario=winter-surge --journeys=400 --out=file.json
import { writeFileSync } from "node:fs";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { activateScenarioNetwork, type WardScenario } from "@/components/ward-management/ward-scenarios";
import { buildScenarioFile } from "@/components/ward-management/ward-flow-scenario-file";
import { WARD_FLOW_STORED_STATE_VERSION } from "@/components/ward-management/ward-flow-demo-storage-constants";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";
import { observationAt } from "@/components/ward-management/ward-observation";
import { nextEvent, nowFor, seededRandom } from "../../../tests/helpers/ward-engine-fuzz";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);
const scenario = (args.scenario ?? "winter-surge") as WardScenario;
const target = Number(args.journeys ?? 400);
const seed = Number(args.seed ?? 4242);
activateScenarioNetwork(scenario);
const eds = allEmergencyDepartments().map((ed) => ed.id);
const random = seededRandom(seed);
let state: WardFlowState = seedWardFlowState(scenario);
const SKIP = new Set([
  "RESET_SCENARIO",
  "SET_SCENARIO",
  "ADVANCE_CLOCK",
  "RECORD_REPATRIATION",
  "RECORD_SUPPORT_NOTIFICATION",
]);
let accepted = 0,
  refused = 0,
  step = 0;
const open = (s: WardFlowState) => s.movements.filter((m) => !m.closure && m.stage !== "arrived").length;
const maxSteps = Number(args.steps ?? 6000);
while (step < maxSteps) {
  step += 1;
  let event: WardFlowEvent;
  const raising = state.movements.length < target * 0.9 && step % (args.every ? Number(args.every) : 6) === 0;
  if (raising) {
    event = {
      type: "RAISE_REFERRAL",
      role: "ed",
      now: nowFor(state, step),
      edId: eds[step % eds.length],
      draft: {
        cohort: (["Adult", "Older adult", "Youth"] as const)[step % 3],
        security: step % 5 ? "Open" : "Secure",
        sex: step % 2 ? "Female" : "Male",
        gender: step % 2 ? "Female" : "Male",
        observation: observationAt("general"),
        highAcuity: step % 7 === 0,
        legalStatus: "Voluntary",
        urgency: (step % 3) + 1,
        legalFormCode: null,
      },
    } as unknown as WardFlowEvent;
  } else {
    event = nextEvent(state, random, step);
    if (SKIP.has(event.type) || event.role === "demo") continue;
  }
  const next = wardFlowReducer(state, event);
  if (next.rejections.length > state.rejections.length) refused += 1;
  else accepted += 1;
  state = { ...next, rejections: [] };
}
const stages: Record<string, number> = {};
for (const m of state.movements) {
  const k = m.closure ? "closed" : m.stage;
  stages[k] = (stages[k] ?? 0) + 1;
}
const built = buildScenarioFile(state, nowFor(state, step), WARD_FLOW_STORED_STATE_VERSION, new Date());
const summary = {
  scenario,
  seed,
  steps: step,
  accepted,
  refused,
  movements: state.movements.length,
  openJourneys: open(state),
  patients: state.patients.length,
  admissions: state.admissions.length,
  occupied: state.admissions.filter((a) => a.state === "occupied").length,
  referrals: state.referrals.length,
  units: state.units.length,
  beds: state.units.reduce((s, u) => s + u.beds, 0),
  stages,
  fileOk: built.ok,
  reason: built.ok ? undefined : built.reason,
};
console.log(JSON.stringify(summary, null, 2));
if (built.ok && args.out) {
  const text = built.json;
  writeFileSync(args.out, text);
  console.log("bytes", text.length);
}
