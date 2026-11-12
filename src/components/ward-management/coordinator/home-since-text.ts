import type { ChangesSinceLastLook } from "./since-last-look";

/**
 * Home's "What changed since my last shift" line (feature 40, 9 Nov 2026). Counts only, escalations
 * first (D-163). Pure, so the words are tested once.
 */

/** At most this many parts are named on a wide line; narrower lines name fewer (CSS container query). */
export const SINCE_BANNER_MAX_PARTS = 3;

/** One count on the line: the figure and its words, split so the figure can be set in mono. */
export type SinceBannerPart = { count: number; label: string; spoken: string };

/** `spoken` keeps "new" for the sentence form, which has no lead word to carry it. */
function part(n: number, one: string, many: string, isNew = false): SinceBannerPart | undefined {
  if (n <= 0) return undefined;
  const label = n === 1 ? one : many;
  return { count: n, label, spoken: `${n} ${isNew ? "new " : ""}${label}` };
}

/**
 * The line's counts, most useful first, without "new" on screen: the lead already
 * says the window ("This shift", "Since 15:02 yesterday"), so "new" on every count was noise.
 */
export function sinceBannerCounts(changes: ChangesSinceLastLook): SinceBannerPart[] {
  const beds = changes.bedsFreed.reduce((sum, entry) => sum + entry.count, 0);
  // Escalations first, then delays, referrals and beds freed (D-163): a phone line names only the
  // first. New movements are routine churn, so they stay in the Review sheet and off this line,
  // unless they are the only change, when the line names them so Review stays reachable.
  const named = [
    part(changes.newEscalationIds.length, "escalation", "escalations", true),
    part(changes.newDelays.length, "delay", "delays", true),
    part(changes.newReferralIds.length, "referral", "referrals", true),
    part(beds, "bed freed", "beds freed"),
    part(changes.acceptanceWithdrawn?.length ?? 0, "acceptance withdrawn", "acceptances withdrawn"),
    part(changes.dischargeDatesMoved?.length ?? 0, "discharge date moved", "discharge dates moved"),
    part(changes.updates?.length ?? 0, "record updated", "records updated"),
  ].filter((entry): entry is SinceBannerPart => entry !== undefined);
  if (named.length > 0) return named;
  const movements = part(changes.newMovementIds.length, "movement", "movements", true);
  return movements ? [movements] : [];
}

/**
 * The line's short lead: "This shift" before any review, else "Since 15:02 yesterday". `day` is the
 * part after the clock face (" yesterday", ", 2 days ago"), which a very narrow line drops.
 */
export function sinceBannerLeadParts(changes: ChangesSinceLastLook, sinceLabel: string): { lead: string; day: string } {
  if (changes.basis === "shift") return { lead: "This shift", day: "" };
  const split = sinceLabel.search(/[ ,]/);
  return split < 0
    ? { lead: `Since ${sinceLabel}`, day: "" }
    : { lead: `Since ${sinceLabel.slice(0, split)}`, day: sinceLabel.slice(split) };
}

/** The whole lead as one string. */
export function sinceBannerLead(changes: ChangesSinceLastLook, sinceLabel: string): string {
  const { lead, day } = sinceBannerLeadParts(changes, sinceLabel);
  return `${lead}${day}`;
}

/**
 * The whole line as one sentence, for the Review button's accessible name and for tests:
 * "Since 15:02 yesterday: 4 new referrals, 3 beds freed, 2 new delays". Undefined when nothing is
 * new (the banner is then hidden).
 */
export function sinceBannerText(changes: ChangesSinceLastLook, sinceLabel: string): string | undefined {
  const parts = sinceBannerCounts(changes).map((entry) => entry.spoken);
  if (parts.length === 0) return undefined;
  const lead = changes.basis === "shift" ? `Since the shift started at ${sinceLabel}` : `Since ${sinceLabel}`;
  return `${lead}: ${parts.join(", ")}`;
}
