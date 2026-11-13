import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { Movement, Unit, Admission, WardFlowState, Referral, BedRelease } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { GENERAL_OBSERVATION } from "@/components/ward-management/ward-observation";

export const TEST_NOW = NOW_ANCHOR;

export function createIsolatedState(): WardFlowState {
  const base = seedWardFlowState();
  return {
    ...base,
    // Ensure all movements have explicit gender to avoid test noise
    movements: base.movements.map((m) => ({
      ...m,
      gender: m.gender ?? (m.sex === "Male" ? ("Male" as const) : ("Female" as const)),
    })),
    rejections: [],
  };
}

export type JourneyHelper = {
  state: WardFlowState;
  movementId: string;
  unitId: string;
  send: (event: Omit<WardFlowEvent, "now"> & { now?: number }) => WardFlowState;
  bookTransport: (options?: { cad?: string; provider?: string }) => WardFlowState;
  recordClearance: (cleared: boolean) => WardFlowState;
  advanceToMoving: () => WardFlowState;
  advanceToArrived: () => WardFlowState;
  currentMovement: () => Movement;
  lastRejection: () => string | undefined;
};

export function createTestJourney(options?: {
  gender?: "Male" | "Female";
  legalStatus?: "Voluntary" | "Involuntary";
  legalFormCode?: string | null;
  initialClearance?: boolean;
  unitId?: string;
  edId?: string;
  extendedHold?: boolean;
}): JourneyHelper {
  let state = createIsolatedState();
  const gender = options?.gender ?? "Female";
  const legalStatus = options?.legalStatus ?? "Voluntary";
  const legalFormCode = options?.legalFormCode ?? (legalStatus === "Involuntary" ? "1A" : null);
  const edId = options?.edId ?? "jhc-ed";
  const unitId = options?.unitId ?? "scgh-adult-open";

  const send = (event: Omit<WardFlowEvent, "now"> & { now?: number }): WardFlowState => {
    state = wardFlowReducer(state, { ...event, now: event.now ?? TEST_NOW } as WardFlowEvent);
    return state;
  };

  // 1. Raise Referral
  send({
    type: "RAISE_REFERRAL",
    role: "ed",
    edId,
    draft: {
      cohort: "Adult",
      security: "Open",
      sex: gender,
      gender,
      observation: GENERAL_OBSERVATION,
      highAcuity: false,
      legalStatus,
      urgency: 2,
      legalFormCode,
    },
  });

  const movementId = state.movements.at(-1)!.id;

  // Initial medical clearance if requested
  if (options?.initialClearance !== undefined) {
    send({
      type: "RECORD_MOVEMENT_MEDICAL_CLEARANCE",
      role: "ed",
      movementId,
      cleared: options.initialClearance,
    });
  }

  // 2. Refer to unit and Accept in principle
  send({ type: "REFER_TO_UNITS", role: "coordinator", movementId, unitIds: [unitId] });
  send({
    type: "ACCEPT_IN_PRINCIPLE",
    role: "ward",
    movementId,
    unitId,
    actingUnitId: unitId,
    ...(options?.extendedHold ? { extendedHold: true as const } : {}),
  });
  send({ type: "PULL_PATIENT", role: "ward", movementId, unitId, actingUnitId: unitId });

  const bookTransport = (bookOpts?: { cad?: string; provider?: string }) => {
    return send({
      type: "BOOK_TRANSPORT",
      role: "ed",
      movementId,
      provider: bookOpts?.provider ?? "Ambulance service",
      escortRequired: false,
      cadNumber: bookOpts?.cad ?? "SYN-CAD-E2E-1",
      transportLegalStatus: legalStatus.toLowerCase() as "voluntary" | "involuntary",
      estimatedAt: TEST_NOW + 60,
    });
  };

  const recordClearance = (cleared: boolean) => {
    return send({
      type: "RECORD_MOVEMENT_MEDICAL_CLEARANCE",
      role: "ed",
      movementId,
      cleared,
    });
  };

  const advanceToMoving = () => {
    send({ type: "HANDOVER_READY", role: "ed", movementId });
    send({ type: "TRANSPORT_ACCEPTED", role: "officer", movementId });
    send({ type: "TRANSPORT_EN_ROUTE", role: "officer", movementId });
    send({ type: "PATIENT_COLLECTED", role: "officer", movementId });
    return state;
  };

  const advanceToArrived = () => {
    advanceToMoving();
    send({ type: "PATIENT_ARRIVED", role: "ward", movementId, actingUnitId: unitId });
    return state;
  };

  const currentMovement = (): Movement => {
    const found = state.movements.find((m) => m.id === movementId);
    if (!found) throw new Error(`Movement ${movementId} not found in state`);
    return found;
  };

  const lastRejection = (): string | undefined => {
    return state.rejections.at(-1)?.reason;
  };

  return {
    get state() {
      return state;
    },
    movementId,
    unitId,
    send,
    bookTransport,
    recordClearance,
    advanceToMoving,
    advanceToArrived,
    currentMovement,
    lastRejection,
  };
}
