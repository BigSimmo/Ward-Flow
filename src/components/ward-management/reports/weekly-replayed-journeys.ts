/**
 * D-273 (Josh, 21 Nov 2026): Weekly's "Where the time goes" reads finished steps from a few sample
 * journeys REPLAYED through the real reducer, never from backfilled stage times. The seeded world's
 * movements keep empty `stageChanges` (the never-backfilled rule, `ward-movement-stage-changes`),
 * so on its own the screen reads "not enough data" for every step that needs a move into "pulled",
 * "moving" or "arrived".
 *
 * Each journey here is raised, referred, accepted, pulled, booked, handed over, collected and
 * arrived by dispatching the ordinary events into `wardFlowReducer` on a scratch copy of the plain
 * seed, so every time it carries is one the reducer recorded. Only the resulting movements leave
 * this file, and only Weekly's step figures read them: they are kept apart from the plain seed and
 * from every other screen, and the live world never holds them. Weekly reads them only while
 * example history is on (`statistics-samples.ts`), and its step card says so.
 *
 * One journey a day for the fourteen days before today, each starting at a fixed time of day, so any
 * whole week (Monday to Sunday) of the last two holds exactly seven of them, whatever weekday today is.
 */
import { GENDER_PLACEMENT_REASONS } from "@/components/ward-management/ward-change-reasons";
import { MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import { eligibility } from "@/components/ward-management/ward-eligibility";
import type { WardFlowEvent, WardFlowRole } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";

import type { ReportWeek } from "./weekly-report";
import { GENERAL_OBSERVATION } from "@/components/ward-management/ward-observation";

export const REPLAYED_JOURNEY_DAYS = 14;

/**
 * Who acts at each step of a replayed journey. There is no session here for the shell to stamp a desk
 * from (D-222, D-223): the replay is a scripted journey, and each step is taken by the desk that
 * takes it in the app.
 */
const ACTED_AS = { ed: "ed", ward: "ward", coordinator: "coordinator", officer: "officer" } as const satisfies Record<
  string,
  WardFlowRole
>;

/** The journey's first event, minutes after midnight. */
const START_MINUTE = 7 * 60;

/** Minutes for each step, journey by journey: ask, answer, hold, leave (booked to collected), travel. */
const STEP_MINUTES: readonly (readonly [number, number, number, number, number])[] = [
  [25, 70, 150, 95, 40],
  [40, 110, 210, 120, 35],
  [15, 55, 95, 80, 50],
  [60, 150, 260, 140, 45],
  [30, 85, 120, 100, 30],
  [45, 95, 180, 110, 55],
  [20, 65, 140, 90, 40],
];

/**
 * The walk's own today: day 0, the plain seed's day (its now is `NOW_ANCHOR`, 10:42 on day 0). The
 * journeys keep the times the reducer recorded; Weekly counts them against its week moved back to
 * this day (`replayedJourneyWeek`), so nothing is shifted after it was recorded.
 */
const WALK_DAY: Instant = 0;

let walked: readonly Movement[] | undefined;

function walk(): readonly Movement[] {
  const today = WALK_DAY;
  let state: WardFlowState = seedWardFlowState();
  const seededIds = new Set(state.movements.map((movement) => movement.id));
  const dispatch = (event: WardFlowEvent) => {
    const before = state.rejections.length;
    state = wardFlowReducer(state, event);
    return state.rejections.length === before;
  };
  const journeys: Movement[] = [];
  for (let day = REPLAYED_JOURNEY_DAYS; day >= 1; day -= 1) {
    const [ask, answer, hold, leave, travel] = STEP_MINUTES[day % STEP_MINUTES.length];
    let at = today - day * MINUTES_PER_DAY + START_MINUTE;
    const raised = dispatch({
      type: "RAISE_REFERRAL",
      role: ACTED_AS.ed,
      now: at,
      edId: "jhc-ed",
      draft: {
        cohort: "Adult",
        security: "Open",
        sex: day % 2 === 0 ? "Female" : "Male",
        observation: GENERAL_OBSERVATION,
        highAcuity: false,
        legalStatus: "Voluntary",
        urgency: 2,
        legalFormCode: null,
      },
    });
    const movement = state.movements.at(-1);
    if (!raised || !movement || seededIds.has(movement.id)) continue;
    // Turn about the eligible wards, so the walk never runs one ward out of Ready beds.
    const eligible = state.units.filter((candidate) => eligibility(movement, candidate, at).eligible);
    const unit = eligible[day % Math.max(1, eligible.length)];
    if (!unit) continue;
    const movementId = movement.id;
    const ward = { movementId, unitId: unit.id, actingUnitId: unit.id } as const;
    const steps: WardFlowEvent[] = [];
    at += ask;
    steps.push({
      type: "REFER_TO_UNITS",
      role: ACTED_AS.coordinator,
      now: at,
      movementId,
      unitIds: [unit.id],
      genderPlacementReason: GENDER_PLACEMENT_REASONS[0],
      genderPlacementChecked: true,
    });
    at += answer;
    steps.push({ type: "ACCEPT_IN_PRINCIPLE", role: ACTED_AS.ward, now: at, ...ward });
    at += hold;
    steps.push({ type: "PULL_PATIENT", role: ACTED_AS.ward, now: at, ...ward });
    const collectedAt = at + leave;
    steps.push({
      type: "BOOK_TRANSPORT",
      role: ACTED_AS.ed,
      now: at + 10,
      movementId,
      provider: "Ambulance service",
      escortRequired: true,
      cadNumber: `CAD-STUB-${String(day).padStart(4, "0")}`,
      transportLegalStatus: "voluntary",
      estimatedAt: collectedAt,
    });
    steps.push({ type: "HANDOVER_READY", role: ACTED_AS.ed, now: at + 20, movementId });
    steps.push({ type: "TRANSPORT_ACCEPTED", role: ACTED_AS.officer, now: at + 25, movementId });
    steps.push({ type: "TRANSPORT_EN_ROUTE", role: ACTED_AS.officer, now: at + 30, movementId });
    steps.push({ type: "PATIENT_COLLECTED", role: ACTED_AS.officer, now: collectedAt, movementId });
    steps.push({ type: "PATIENT_ARRIVED", role: ACTED_AS.coordinator, now: collectedAt + travel, movementId });
    if (!steps.every(dispatch)) continue;
    const finished = state.movements.find((candidate) => candidate.id === movementId);
    if (finished?.stage === "arrived") journeys.push(finished);
  }
  return journeys;
}

/** The replayed journeys: one a day for the fourteen days before the walk's own day. */
export function replayedJourneyMovements(): readonly Movement[] {
  walked ??= walk();
  return walked;
}

/**
 * `week` moved back by whole days from `now`'s day to the walk's day, so the replayed journeys stand
 * in the same place against it as if they had been walked in the fourteen days before `now`.
 */
export function replayedJourneyWeek(week: ReportWeek, now: Instant): ReportWeek {
  const days = Math.floor(now / MINUTES_PER_DAY) * MINUTES_PER_DAY - WALK_DAY;
  return { ...week, start: week.start - days, end: week.end - days, countedEnd: week.countedEnd - days };
}
