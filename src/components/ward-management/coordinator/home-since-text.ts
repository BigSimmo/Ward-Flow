import type { ChangesSinceLastLook } from "./since-last-look";

/**
 * Home's "What changed since my last shift" line (feature 40, 9 Nov 2026). Counts only, in the same
 * words as the Since you last looked sheet, most useful first. Pure, so the words are tested once.
 */

function count(n: number, one: string, many: string): string | undefined {
  return n > 0 ? `${n} ${n === 1 ? one : many}` : undefined;
}

/** The count parts, in order: referrals, beds, delays, escalations, then the rest. */
export function sinceBannerParts(changes: ChangesSinceLastLook): string[] {
  const beds = changes.bedsFreed.reduce((sum, entry) => sum + entry.count, 0);
  const updates = changes.updates?.length ?? 0;
  return [
    count(changes.newReferralIds.length, "new referral", "new referrals"),
    count(beds, "bed freed", "beds freed"),
    count(changes.newDelays.length, "new delay", "new delays"),
    count(changes.newEscalationIds.length, "new escalation", "new escalations"),
    count(changes.newMovementIds.length, "new movement", "new movements"),
    count(changes.acceptanceWithdrawn?.length ?? 0, "acceptance withdrawn", "acceptances withdrawn"),
    count(changes.dischargeDatesMoved?.length ?? 0, "discharge date moved", "discharge dates moved"),
    count(updates, "record updated", "records updated"),
  ].filter((part): part is string => part !== undefined);
}

/** At most this many parts are named; the rest are "N more". Keeps the line one line on desktop. */
const SINCE_BANNER_MAX_PARTS = 3;

/**
 * "Since you were last here, 15:02 yesterday: 4 new referrals · 3 beds freed · 2 new delays". Before
 * any review this session the comparison starts at the shift start, and the words say so. Undefined
 * when nothing is new (the banner is then hidden).
 */
export function sinceBannerText(changes: ChangesSinceLastLook, sinceLabel: string): string | undefined {
  const parts = sinceBannerParts(changes);
  if (parts.length === 0) return undefined;
  const lead = changes.basis === "shift" ? "Since the shift started" : "Since you were last here";
  const shown = parts.slice(0, SINCE_BANNER_MAX_PARTS);
  const rest = parts.length - shown.length;
  return `${lead}, ${sinceLabel}: ${shown.join(" · ")}${rest > 0 ? ` · ${rest} more` : ""}`;
}
