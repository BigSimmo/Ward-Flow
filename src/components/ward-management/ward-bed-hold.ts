import { formatInstantWithDay, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import {
  DUE_SOON_URGENT_MINUTES,
  PULL_HOLD_EXTENSION_MINUTES,
  PULL_HOLD_MAX_TOTAL_MINUTES,
  type PullHoldExtensionMinutes,
} from "@/components/ward-management/ward-operational-defaults";
import type { Movement } from "@/components/ward-management/ward-model";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";

/**
 * ONE BED-HOLD RULE for every page that shows a pulled bed (audit A4-4, A4-1, A1-3, A1-4, A4-3;
 * 13 Oct 2026). Movement detail, ED, Handover, the Ward page and the Home patient sheet each used
 * to word a hold their own way, so one patient could read "4h hold clock active" on one page and
 * "expired 10m ago" on another. They all read this instead.
 *
 * Read from the stored `Movement.pullExpiresAt` only, never an invented hold length:
 * - `lapsed`: the hold time has passed. Act now: the coral overdue marker, and the ward's Act now.
 * - `at-risk`: under `BED_HOLD_AT_RISK_MINUTES` left. The round amber dot only, never Act now, so
 *   Act now keeps to what genuinely needs doing now (alarm fatigue).
 * - `held`: more time than that left. Plain.
 */
/** Josh's one-hour warning default, the same one the legal clocks use. */
export const BED_HOLD_AT_RISK_MINUTES = DUE_SOON_URGENT_MINUTES;

type BedHoldState = "held" | "at-risk" | "lapsed";

export type BedHold = {
  state: BedHoldState;
  expiresAt: Instant;
  /** Minutes left (held, at risk) or minutes since it lapsed (lapsed). Never negative. */
  minutes: number;
  /** The sentence: "Pull expired 10m ago", "Pull 27m left". Screens say pull, never hold (Task 7). */
  label: string;
  /** The same without the noun, for a row already about the hold: "Expired 10m ago", "27m left". */
  short: string;
  /** The next step the hold asks for. */
  nextStep: string;
};

export function bedHold(pullExpiresAt: Instant | undefined, now: Instant): BedHold | null {
  if (pullExpiresAt === undefined || !Number.isFinite(pullExpiresAt)) return null;
  const left = pullExpiresAt - now;
  if (left <= 0) {
    const over = splitDuration(Math.max(0, -left));
    return {
      state: "lapsed",
      expiresAt: pullExpiresAt,
      minutes: Math.max(0, -left),
      label: `Pull expired ${over} ago`,
      short: `Expired ${over} ago`,
      nextStep: "Move or release",
    };
  }
  const remaining = splitDuration(left);
  return {
    state: left < BED_HOLD_AT_RISK_MINUTES ? "at-risk" : "held",
    expiresAt: pullExpiresAt,
    minutes: left,
    label: `Pull ${remaining} left`,
    short: `${remaining} left`,
    nextStep: "Book transport",
  };
}

/** True when the hold has lapsed: the one bed-hold condition that belongs in Act now. */
export function bedHoldLapsed(pullExpiresAt: Instant | undefined, now: Instant): boolean {
  return bedHold(pullExpiresAt, now)?.state === "lapsed";
}

/**
 * Feature 11 (Josh, 9 Nov 2026): extending a pulled bed's hold. The engine (`EXTEND_PULL`) and the
 * "Extend pull" buttons read these, so a chip is only offered when the engine would take it.
 */
type ExtendableMovement = Pick<
  Movement,
  "stage" | "pullExpiresAt" | "pullExtensions" | "stageChanges" | "closure" | "transport"
>;

/**
 * When the current pull was made: the latest `to: "pulled"` stage change. A hand-authored record
 * with no stage change is read back from its limit as the configured Pull time limit
 * (`state.configuration.pullHoldMinutes`, passed in) plus any extensions, so the cap still applies.
 */
function latestPulledAt(
  movement: Omit<ExtendableMovement, "closure" | "transport" | "stage">,
  pullHoldMinutes: number,
): Instant | undefined {
  for (let index = movement.stageChanges.length - 1; index >= 0; index -= 1) {
    const change = movement.stageChanges[index];
    if (change?.to === "pulled") return change.at;
  }
  if (movement.pullExpiresAt === undefined) return undefined;
  const extended = (movement.pullExtensions ?? []).reduce((sum, extension) => sum + extension.minutes, 0);
  return movement.pullExpiresAt - extended - pullHoldMinutes;
}

/** The new Pull time limit an extension would set: a lapsed hold is extended from now. */
export function extendedPullExpiry(pullExpiresAt: Instant, minutes: number, now: Instant): Instant {
  return Math.max(pullExpiresAt, now) + minutes;
}

/**
 * The extension amounts the engine would accept now; empty when the hold cannot be extended.
 * `pullHoldMinutes` is the configured Pull time limit (`state.configuration.pullHoldMinutes`).
 */
export function pullExtensionChoices(
  movement: ExtendableMovement,
  now: Instant,
  pullHoldMinutes: number,
): PullHoldExtensionMinutes[] {
  if (movement.closure || movement.stage !== "pulled" || movement.pullExpiresAt === undefined) return [];
  if (movement.transport?.collectedAt !== undefined) return [];
  const pulledAt = latestPulledAt(movement, pullHoldMinutes);
  if (pulledAt === undefined) return [];
  const expiresAt = movement.pullExpiresAt;
  return PULL_HOLD_EXTENSION_MINUTES.filter(
    (minutes) => extendedPullExpiry(expiresAt, minutes, now) - pulledAt <= PULL_HOLD_MAX_TOTAL_MINUTES,
  );
}

/** "Pulled until 14:30 · extended" once a hold has been extended; null otherwise. */
export function heldUntilExtendedLabel(
  movement: Pick<Movement, "stage" | "pullExpiresAt" | "pullExtensions">,
  now: Instant,
): string | null {
  if (movement.stage !== "pulled" || movement.pullExpiresAt === undefined) return null;
  if (!movement.pullExtensions?.length) return null;
  return `Pulled until ${formatInstantWithDay(movement.pullExpiresAt, now)} · extended`;
}

/** `EXTEND_PULL`, moved unchanged from `ward-flow-events.ts` for its line cap (9 Nov 2026). */
export type ExtendPullEvent = {
  /**
   * Feature 11 (Josh, 9 Nov 2026): adds a chosen amount to a pulled bed's Pull time limit,
   * never past `PULL_HOLD_MAX_TOTAL_MINUTES` from the pull. Same roles as `PULL_PATIENT`.
   * Recorded on `Movement.pullExtensions`.
   */
  type: "EXTEND_PULL";
  role: WardFlowRole;
  now: Instant;
  movementId: string;
  minutes: PullHoldExtensionMinutes;
  /** As `RELEASE_PULL`: the unit a `ward` caller claims to act as. Claim, not proof. */
  actingUnitId?: string;
};
