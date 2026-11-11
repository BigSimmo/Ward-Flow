import type { Instant } from "../ward-clock";
import { isEdOriginJourney } from "../ward-ed-presence";
import type { Movement, Referral } from "../ward-model";
import type { PatientId } from "../ward-patients";

/**
 * Check on people diverted from admission (feature build plan batch 3, item 28; D-136 item 1).
 *
 * A person whose bed request marked an alternative to admission "Tried" (D-110), and whom a
 * community team then took, who comes back to an emergency department within the signed window
 * (`CLINICAL_VALUES.diversionReturnReview`, read by the caller and passed in), gives that team one
 * prompt: "Please review: returned to ED". Only the team that took them sees it.
 *
 * 🔒 **A REVIEW PROMPT ONLY.** Never a judgement of the alternative, a score or a rank. The prompt
 * carries no reason, diagnosis or risk, and no typed text: the person, the time back and nothing
 * else. Derived from the record each time it is read; nothing is stored and no event is raised.
 *
 * 🔒 **FD-23.** This reads the full referral record, so only the provider calls it
 * (`useDiversionReturnPrompts`); the team page receives the small `DiversionReturnPrompt` below and
 * never the referral, its other places or the later ED record.
 */

export type DiversionReturnPrompt = {
  /** Stable for the pair: the referral the team took, and the time back in ED. */
  id: string;
  /** The person, for the team page to name. Nothing else about them. */
  subject: { patientId: PatientId };
  /** When the team took them. */
  takenAt: Instant;
  /** When they were back in ED: the opening of an ED bed request for the same person. */
  returnedAt: Instant;
};

/** True when the team the page belongs to is the one this addressing names. */
export type TeamMatch = (teamName: string | undefined) => boolean;

/** When this team took the person, or undefined when the referral is not a diversion to it. An
 *  accepted ward cancels the community answer, so an accepted community place means no admission. */
function takenByTeamAt(referral: Referral, matchesTeam: TeamMatch): Instant | undefined {
  if (!(referral.alternativesConsidered ?? []).some((entry) => entry.outcome === "tried")) return undefined;
  const arm = referral.destinations.find(
    (candidate) =>
      candidate.destination.kind === "community_team" &&
      candidate.state === "accepted" &&
      candidate.decidedAt !== undefined &&
      matchesTeam(candidate.destination.teamName),
  );
  return arm?.decidedAt;
}

/**
 * This team's prompts, newest return first. A return counts when an ED bed request for the same
 * person opened after the team took them and no later than the window; the prompt then shows for
 * the same window from the return, and leaves after it.
 */
export function diversionReturnPrompts(
  source: { referrals: readonly Referral[]; movements: readonly Movement[] },
  matchesTeam: TeamMatch,
  windowMinutes: number,
  now: Instant,
): DiversionReturnPrompt[] {
  const prompts: DiversionReturnPrompt[] = [];
  for (const referral of source.referrals) {
    const patientId = referral.patientId;
    if (patientId === undefined) continue;
    const takenAt = takenByTeamAt(referral, matchesTeam);
    if (takenAt === undefined) continue;
    const returnedAt = source.movements
      .filter((movement) => movement.patientId === patientId && isEdOriginJourney(movement))
      .map((movement) => movement.openedAt)
      .filter((at) => Number.isFinite(at) && at > takenAt && at - takenAt <= windowMinutes && at <= now)
      .reduce<Instant | undefined>((first, at) => (first === undefined || at < first ? at : first), undefined);
    if (returnedAt === undefined || now - returnedAt > windowMinutes) continue;
    prompts.push({ id: `diversion-return:${referral.id}:${returnedAt}`, subject: { patientId }, takenAt, returnedAt });
  }
  return prompts.sort((a, b) => b.returnedAt - a.returnedAt || a.id.localeCompare(b.id));
}
