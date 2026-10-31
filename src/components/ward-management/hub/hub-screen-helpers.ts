// Pure display helpers and constants for the Places screen (hub-screen.tsx). Split out to keep
// hub-screen.tsx under the line cap.
import { type HubEntry, type HubKind } from "@/components/ward-management/hub/hub-derivations";

/** Review point 21: a directory orders by service or by name; with no bed figures there is no "Most ready". */
export type Order = "service" | "name";

/** Ward services shown open before the rest fold, when nothing is typed. */
export const OPEN_SERVICES = 2;

/** Rows a group shows before "Show more". */
export const GROUP_ROWS = 8;

/** All wards, the second page that carries beds (Capacity's bed map is the first). */
export const ALL_WARDS_HREF = "/ward-flow/wards";

/** needsAttention's own words for a stale ward, used alone so no bed figure is quoted here. */
export const STALE_REASON = "The last bed confirmation is stale — check with the ward.";

/** Round 2: "Open" sat beside Open buttons, so the security word names the ward. */
export const SECURITY_WORD: Record<NonNullable<HubEntry["security"]>, string> = {
  Open: "Open ward",
  Locked: "Locked ward",
  Mixed: "Mixed security",
};

/**
 * A place's fixed facts in words, in the list row's order, for the site desk's preview line.
 * "Undesignated" accepts either sex, so it is not a constraint and is left out.
 */
export function placeFacts(entry: HubEntry): string[] {
  return [
    entry.cohort,
    entry.security === undefined ? undefined : SECURITY_WORD[entry.security],
    entry.forensic === true ? "Forensic ward" : undefined,
    entry.sexDesignation === "Undesignated" ? undefined : entry.sexDesignation,
  ].filter((fact): fact is string => fact !== undefined);
}

export const KIND_WORD_LONG: Record<HubKind, string> = {
  ward: "Ward",
  ed: "Emergency department",
  community: "Community team",
};
