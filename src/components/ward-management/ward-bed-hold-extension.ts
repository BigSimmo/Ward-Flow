import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import {
  PULL_HOLD_EXTENSION_MINUTES,
  PULL_HOLD_MAX_TOTAL_MINUTES,
  type PullHoldExtensionMinutes,
} from "@/components/ward-management/ward-operational-defaults";
import type { Movement } from "@/components/ward-management/ward-model";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";

// Split from `ward-bed-hold.ts` (9 Nov 2026) so the extension rule and its wording load only with
// the screens and the engine slice that use them, never in every phone screen's shared first load.
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
