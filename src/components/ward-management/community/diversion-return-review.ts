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
 *
 * 🔒 **Shared mode (D-152).** A community desk is not sent the later ED request, so the server finds
 * the return in the whole workspace (`diversionReturnsForTeam`) and sends that desk only
 * `{ referralId, returnedAt }` for a referral it already holds. The browser rebuilds the prompt from
 * its own copy of that referral, so the record adds one time and nothing else.
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

/**
 * Shared mode only (D-152): one return to ED the server found for a referral this community desk
 * took. A referral id the desk already holds and one time: no ED, no movement, no person.
 */
export type DiversionReturnRecord = { referralId: string; returnedAt: Instant };

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

type ReturnSource = {
  referrals: readonly Referral[];
  movements: readonly Movement[];
  /** Shared mode only: returns the server found that this desk's copy cannot show (D-152). */
  diversionReturns?: readonly DiversionReturnRecord[];
};

type FoundReturn = { referralId: string; patientId: PatientId; takenAt: Instant; returnedAt: Instant };

/** Each referral this team took whose person was back in ED within the window, and still shows. */
function foundReturns(
  source: ReturnSource,
  matchesTeam: TeamMatch,
  windowMinutes: number,
  now: Instant,
): FoundReturn[] {
  const found: FoundReturn[] = [];
  for (const referral of source.referrals) {
    const patientId = referral.patientId;
    if (patientId === undefined) continue;
    const takenAt = takenByTeamAt(referral, matchesTeam);
    if (takenAt === undefined) continue;
    const returnedAt = [
      ...source.movements
        .filter((movement) => movement.patientId === patientId && isEdOriginJourney(movement))
        .map((movement) => movement.openedAt),
      ...(source.diversionReturns ?? [])
        .filter((record) => record.referralId === referral.id)
        .map((record) => record.returnedAt),
    ]
      .filter((at) => Number.isFinite(at) && at > takenAt && at - takenAt <= windowMinutes && at <= now)
      .reduce<Instant | undefined>((first, at) => (first === undefined || at < first ? at : first), undefined);
    if (returnedAt === undefined || now - returnedAt > windowMinutes) continue;
    found.push({ referralId: referral.id, patientId, takenAt, returnedAt });
  }
  return found;
}

/**
 * This team's prompts, newest return first. A return counts when an ED bed request for the same
 * person opened after the team took them and no later than the window; the prompt then shows for
 * the same window from the return, and leaves after it. In shared mode a server-found return for
 * the same referral counts the same way.
 */
export function diversionReturnPrompts(
  source: ReturnSource,
  matchesTeam: TeamMatch,
  windowMinutes: number,
  now: Instant,
): DiversionReturnPrompt[] {
  return foundReturns(source, matchesTeam, windowMinutes, now)
    .map(({ referralId, patientId, takenAt, returnedAt }) => ({
      id: `diversion-return:${referralId}:${returnedAt}`,
      subject: { patientId },
      takenAt,
      returnedAt,
    }))
    .sort((a, b) => b.returnedAt - a.returnedAt || a.id.localeCompare(b.id));
}

/**
 * The server's side (D-152): this team's returns, found in the WHOLE workspace before the desk's
 * copy is cut. Only the referral id and the time back leave; `scopeWardFlowState` sends them to a
 * community desk alone, and only for a referral that desk is already sent.
 */
export function diversionReturnsForTeam(
  source: { referrals: readonly Referral[]; movements: readonly Movement[] },
  matchesTeam: TeamMatch,
  windowMinutes: number,
  now: Instant,
): DiversionReturnRecord[] {
  return foundReturns(source, matchesTeam, windowMinutes, now)
    .map(({ referralId, returnedAt }) => ({ referralId, returnedAt }))
    .sort((a, b) => a.returnedAt - b.returnedAt || a.referralId.localeCompare(b.referralId));
}

/** D-152: a shared copy's returns each name a referral that copy holds, or the copy is refused. */
export function diversionReturnsResolve(state: {
  referrals?: readonly { id: string }[];
  diversionReturns?: readonly DiversionReturnRecord[];
}): boolean {
  const held = new Set((state.referrals ?? []).map((referral) => referral.id));
  return (state.diversionReturns ?? []).every((row) => held.has(row.referralId));
}
