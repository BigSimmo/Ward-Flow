import type { Referral } from "@/components/ward-management/ward-model";

/**
 * HOW A REFERRAL'S SENDING TEAM READS ON SCREEN — one decision, in one place.
 *
 * The owner was asked directly, 2026-09-12: *"Should a referral record which team or service sent
 * it, not just which hospital?"* — **"Yes it should"**, and shown wherever a referral's origin
 * already appears. `Referral.sendingTeamName` holds it; this decides how it is worded.
 *
 * 🔴 **IT LIVES HERE RATHER THAN AT THE THREE CALL SITES ON PURPOSE.** Origin is rendered in three
 * places — the community queue, the coordinator's priority queue and the search record preview —
 * and each words it differently already. **Three faithful copies of one wording decision is a
 * decision already made three times**, and the day somebody sharpens one of them the other two
 * become quietly different claims about the same fact.
 *
 * 🔴 **"SENT BY" IS LOAD-BEARING AND MUST NOT BECOME "FROM".** Every call site already says *from*
 * about a SITE — a hospital, a code, a channel. **The sending team is a different fact about the
 * same referral**, and two facts sharing one preposition read as one fact. *"Referral from RPH ·
 * sent by Armadale Community Mental Health Service"* says a team sent a person to a hospital.
 * *"Referral from RPH · from Armadale…"* says nothing legible at all, and invites a reader to take
 * the team as the place.
 *
 * ⚠️ **AND IT IS NOT A REFERRER.** `referral-referrer.ts` — its sibling in this directory, named
 * that way so the distinction is visible in the file list rather than only in prose — answers WHO,
 * a person, and D-12 forbids an organisation standing in a field labelled as one. **A service is
 * not a human being.** These two helpers must never be merged, however similar their call sites
 * look.
 */

/**
 * The sending team as a display fragment, or `undefined` where the record names none.
 *
 * ⚠️ **`undefined` RATHER THAN AN EMPTY STRING, AND RATHER THAN A PLACEHOLDER.** An
 * ambulance service and an emergency department's own medical staff are legitimate sources with no
 * sending team; a caller must be able to render NOTHING for them. A `"Not recorded"` here would put
 * an absence on every one of those rows — an absence promoted to a headline, which is a design
 * defect this prototype has already ruled against elsewhere.
 *
 * A blank or whitespace-only value cannot reach a stored `Referral` — `RECEIVE_REFERRAL` refuses
 * one rather than normalising it away — but it is treated as absent here anyway, because a display
 * helper that renders `" · sent by "` for a value it did not expect is worse than one that renders
 * nothing.
 */
export function sendingTeamFragment(referral: Referral): string | undefined {
  const name = referral.sendingTeamName?.trim();
  return name === undefined || name === "" ? undefined : `sent by ${name}`;
}

/**
 * `line` with the sending team appended where there is one, using the separator the caller's own
 * line already uses.
 *
 * The separator is a parameter because the three origin lines do not agree on one — the community
 * queue and the search preview use `" · "`, and a caller with different punctuation must not have
 * to choose between this helper and its own house style.
 */
export function withSendingTeam(line: string, referral: Referral, separator = " · "): string {
  const fragment = sendingTeamFragment(referral);
  return fragment === undefined ? line : `${line}${separator}${fragment}`;
}
