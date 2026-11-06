import type { Instant } from "./ward-clock";

/**
 * The one order check for times typed from a legal form (MHA 2014), shared by the engine and every
 * form that records them (F2, frontend audit 5 Nov 2026). The times stay as typed and are not
 * legally checked: a form cannot have been written after now, and its typed expiry must come after
 * the time it was written or started.
 */
export const WRITTEN_LATER_THAN_NOW = "The time written cannot be later than now";
const EXPIRY_NOT_AFTER_WRITTEN = "The expiry must be later than the time written";

/** What is wrong with the typed order, or undefined when it is fine. Missing values are not checked here. */
export function legalFormTimeOrderProblem(
  writtenAt: Instant | undefined,
  paperExpiresAt: Instant | undefined,
  now: Instant,
): string | undefined {
  if (writtenAt !== undefined && writtenAt > now) return WRITTEN_LATER_THAN_NOW;
  if (writtenAt !== undefined && paperExpiresAt !== undefined && paperExpiresAt <= writtenAt)
    return EXPIRY_NOT_AFTER_WRITTEN;
  return undefined;
}
