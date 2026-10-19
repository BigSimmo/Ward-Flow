import type { JourneyStage } from "@/components/wf";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";
import { recordedEdDeparture } from "@/components/ward-management/ward-ed-presence";

/**
 * JourneyRibbon stages for one person in an emergency department (v10 ED page, person sheet): where
 * their time in the department went, built only from times the record holds. Each recorded
 * milestone (medical clearance, psychiatric review, referral, bed accepted, left the department)
 * closes the stage before it; the last stage runs to now and is named by where the person is up to.
 *
 * A milestone with no recorded time is left out rather than guessed, so a person with nothing
 * recorded shows one stage, "In the department" up to now. Milestones recorded before arrival (a
 * community-formed patient's form, say) or after now are ignored; the ribbon is the department clock.
 */
export function edJourneyStages(
  movement: Pick<
    Movement,
    "id" | "openedAt" | "examination" | "referredAt" | "acceptedAt" | "leftDepartmentAt" | "closure" | "transport"
  > &
    Partial<Pick<Movement, "stageChanges">>,
  clearance: { cleared: boolean; at: Instant } | undefined,
  currentLabel: string,
  now: Instant,
): JourneyStage[] {
  const departure = recordedEdDeparture(movement);
  const end = Math.max(movement.openedAt, Math.min(now, departure ?? movement.closure?.at ?? now));
  const milestones: { at: Instant; stageBefore: string }[] = [];
  const add = (at: Instant | undefined, stageBefore: string) => {
    if (at === undefined || at < movement.openedAt || at > end) return;
    milestones.push({ at, stageBefore });
  };
  if (clearance?.cleared) add(clearance.at, "To clearance");
  add(movement.examination?.at, "To review");
  add(movement.referredAt, "To referral");
  add(movement.acceptedAt, "Finding a bed");
  add(departure, "Waiting to leave");
  milestones.sort((a, b) => a.at - b.at);

  const stages: JourneyStage[] = [];
  let from = movement.openedAt;
  milestones.forEach((milestone, index) => {
    stages.push({ id: `${movement.id}-${index}`, label: milestone.stageBefore, minutes: milestone.at - from });
    from = milestone.at;
  });
  if (from < end || (departure === undefined && movement.closure === undefined))
    stages.push({
      id: `${movement.id}-now`,
      label: milestones.length === 0 ? "In the department" : currentLabel,
      minutes: end - from,
      now: departure === undefined && movement.closure === undefined,
    });
  return stages;
}
