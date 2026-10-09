import { Timer } from "lucide-react";

import { splitDuration, type Instant } from "./ward-clock";
import type { WardConfiguration } from "./ward-configuration";
import type { InboxItem } from "./ward-derivations";
import { INBOX_CATEGORIES } from "./ward-inbox-reducer";
import type { Movement } from "./ward-model";

/**
 * DECISION TARGETS — stream A, 9 Oct 2026.
 *
 * A labelled default target per step of a movement, set in Settings (`WardConfiguration`). Each is
 * a prototype default, never a clinical, legal or service standard. A step's clock starts at a
 * time the record itself holds and stops when the record shows the step done:
 *
 *   - Referral decision: from `referredAt` until a ward accepts or every referred ward has answered.
 *   - Transfer acceptance: from `acceptedAt` (acceptance in principle) until the bed is pulled.
 *   - Transport booked: from the recorded move to `pulled` until a transport job is booked.
 *
 * A step whose start time the record does not hold has no target running. Nothing is backfilled
 * from `openedAt`, the same discipline `Movement.referredAt` documents.
 */
export type DecisionTargetStep = "referral_decision" | "transfer_acceptance" | "transport_booked";

type StepDefinition = {
  readonly step: DecisionTargetStep;
  readonly label: string;
  readonly configKey: keyof Pick<
    WardConfiguration,
    "referralDecisionTargetMinutes" | "transferAcceptanceTargetMinutes" | "transportBookedTargetMinutes"
  >;
  readonly category: "target_referral_decision" | "target_transfer_acceptance" | "target_transport_booked";
  readonly owner: string;
  readonly overdueTitle: string;
};

export const DECISION_TARGET_STEPS: readonly StepDefinition[] = [
  {
    step: "referral_decision",
    label: "Referral decision",
    configKey: "referralDecisionTargetMinutes",
    category: "target_referral_decision",
    owner: "Coordinator",
    overdueTitle: "Referral decision overdue",
  },
  {
    step: "transfer_acceptance",
    label: "Transfer acceptance",
    configKey: "transferAcceptanceTargetMinutes",
    category: "target_transfer_acceptance",
    owner: "Accepting ward",
    overdueTitle: "Transfer acceptance overdue",
  },
  {
    step: "transport_booked",
    label: "Transport booked",
    configKey: "transportBookedTargetMinutes",
    category: "target_transport_booked",
    owner: "Sending team",
    overdueTitle: "Transport booking overdue",
  },
];

export type DecisionTargetReading = {
  step: DecisionTargetStep;
  label: string;
  startedAt: Instant;
  dueAt: Instant;
  targetMinutes: number;
  /** Negative once overdue. */
  minutesLeft: number;
  overdue: boolean;
  /** `42m left` or `1h 05m overdue`: a duration with units, never a clock time. */
  text: string;
};

const DECIDING_STAGES: readonly Movement["stage"][] = ["placement_requested", "destination_review"];

function lastPulledAt(movement: Movement): Instant | undefined {
  for (let index = movement.stageChanges.length - 1; index >= 0; index -= 1) {
    const change = movement.stageChanges[index]!;
    if (change.to === "pulled") return change.at;
  }
  return undefined;
}

/** When the step this movement is waiting on started, or undefined when no target is running. */
function pendingStep(movement: Movement): { step: DecisionTargetStep; startedAt: Instant } | undefined {
  if (movement.closure || movement.stage === "arrived") return undefined;
  if (
    movement.referredAt !== undefined &&
    movement.acceptedUnitId === undefined &&
    movement.referredUnitIds.length > 0 &&
    DECIDING_STAGES.includes(movement.stage)
  ) {
    return { step: "referral_decision", startedAt: movement.referredAt };
  }
  if (
    movement.stage === "accepted_awaiting_bed" &&
    movement.acceptedUnitId !== undefined &&
    movement.acceptedAt !== undefined
  ) {
    return { step: "transfer_acceptance", startedAt: movement.acceptedAt };
  }
  if (movement.stage === "pulled") {
    const booked = movement.transport !== undefined && movement.transport.cancelledAt === undefined;
    const pulledAt = lastPulledAt(movement);
    if (!booked && pulledAt !== undefined) return { step: "transport_booked", startedAt: pulledAt };
  }
  return undefined;
}

/** The decision target running on this movement right now, read against the configured defaults. */
export function decisionTargetReading(
  movement: Movement,
  now: Instant,
  configuration: WardConfiguration,
): DecisionTargetReading | undefined {
  const pending = pendingStep(movement);
  if (!pending) return undefined;
  const definition = DECISION_TARGET_STEPS.find((entry) => entry.step === pending.step)!;
  const targetMinutes = configuration[definition.configKey];
  const dueAt = pending.startedAt + targetMinutes;
  const minutesLeft = dueAt - now;
  const overdue = minutesLeft < 0;
  return {
    step: pending.step,
    label: definition.label,
    startedAt: pending.startedAt,
    dueAt,
    targetMinutes,
    minutesLeft,
    overdue,
    text: overdue ? `${splitDuration(-minutesLeft)} overdue` : `${splitDuration(minutesLeft)} left`,
  };
}

/**
 * One act-now inbox row per open movement whose decision target has passed. Concatenated onto
 * `buildActionInbox`'s rows by every screen that lists alerts or tasks, so an overdue target shows
 * on Alerts, in Tasks and in browser notifications alike. Callers pass open movements only, the
 * same scoping `buildActionInbox` requires.
 */
export function decisionTargetInboxItems(
  movements: readonly Movement[],
  now: Instant,
  configuration: WardConfiguration,
): InboxItem[] {
  const items: InboxItem[] = [];
  for (const movement of movements) {
    const reading = decisionTargetReading(movement, now, configuration);
    if (!reading?.overdue) continue;
    const definition = DECISION_TARGET_STEPS.find((entry) => entry.step === reading.step)!;
    const category = INBOX_CATEGORIES[definition.category];
    items.push({
      id: `${category.idPrefix}${movement.id}`,
      kind: category.kind,
      tone: "danger",
      icon: Timer,
      title: definition.overdueTitle,
      detail: `${movement.id} · ${reading.text} · target ${splitDuration(reading.targetMinutes)}, default set in Settings`,
      owner: definition.owner,
      movementId: movement.id,
      dueAt: reading.dueAt,
    });
  }
  return items;
}
