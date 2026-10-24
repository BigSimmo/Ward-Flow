import type { Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import { boundedBedAvailability } from "@/components/ward-management/ward-ready-beds";

/*
 * Audit 2 E-07 (Josh, decision 3, 20 Oct 2026; built 24 Oct as a warning while Josh chooses how
 * strict it is): a ward's yes uses up one of its Ready beds. Ready (`min(allocatable, empty)`)
 * already nets out pulled beds, because `PULL_PATIENT` lowers `allocatable`. An acceptance changes
 * no figure, so this counts the yeses the ward's own numbers cannot see yet, and the accept screens
 * say so before a person says yes again. It reports a count; it never refuses, picks a ward or
 * ranks a patient.
 */

/** Stages at which the bed is already reserved and so already subtracted from `allocatable`. */
const RESERVED_STAGES = new Set<Movement["stage"]>(["pulled", "handover_ready", "moving", "arrived"]);

type PromiseSources = {
  readonly movements: readonly Movement[];
  readonly referrals: readonly Referral[];
};

/** What is being accepted now, so it is not counted against itself. */
export type ReadyBedPromiseSubject = { referralId?: string; movementId?: string };

/**
 * Yeses this ward has given that have not yet reserved a bed: open movements accepted here and not
 * yet pulled (`pullExpiresAt` marks a pull that has since stepped back, still reserved), and
 * front-door referrals accepted here that no movement has started from.
 */
export function readyBedsPromised(sources: PromiseSources, unitId: string, subject: ReadyBedPromiseSubject): number {
  const movements = sources.movements.filter(
    (movement) =>
      movement.id !== subject.movementId &&
      movement.acceptedUnitId === unitId &&
      !movement.closure &&
      !RESERVED_STAGES.has(movement.stage) &&
      movement.pullExpiresAt === undefined,
  ).length;
  const referrals = sources.referrals.filter(
    (referral) =>
      referral.id !== subject.referralId &&
      !sources.movements.some((movement) => movement.referralId === referral.id) &&
      referral.destinations.some(
        (arm) => arm.state === "accepted" && arm.withdrawnAt === undefined && arm.acceptedUnitId === unitId,
      ),
  ).length;
  return movements + referrals;
}

/**
 * Ready beds and the yeses already counting on them, when the yeses use them all up. `undefined`
 * when a bed is still free for this acceptance, or when Ready is 0 (the screens already say there
 * is no bed then).
 */
export function readyBedsAllPromised(
  sources: PromiseSources,
  unit: Unit,
  subject: ReadyBedPromiseSubject,
): { ready: number; promised: number } | undefined {
  const ready = boundedBedAvailability(unit).available;
  if (ready === 0) return undefined;
  const promised = readyBedsPromised(sources, unit.id, subject);
  return promised >= ready ? { ready, promised } : undefined;
}

/** The warning the accept screens show. */
export function readyBedsPromisedSentence(unitName: string, figures: { ready: number; promised: number }): string {
  const beds = `${figures.ready} Ready ${figures.ready === 1 ? "bed" : "beds"}`;
  const yeses = `${figures.promised} ${figures.promised === 1 ? "patient" : "patients"}`;
  return `${unitName} has ${beds} and has already said yes to ${yeses} waiting for one.`;
}
