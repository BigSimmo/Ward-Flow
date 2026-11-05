import type { Movement } from "@/components/ward-management/ward-model";

/**
 * THE TYPED LEDGER FIELDS (H13, Josh 3 Nov 2026: "go ahead with all recommendations").
 *
 * The Forms ledger shows three facts the clinician copied from the paper, never worked out here:
 * the region (metro or country), the age band, and whether the current form has already had an
 * extension typed against it. Nothing in this file computes a legal time or an expiry (D-72, D-93).
 */

const REGION_WORD = { metro: "Metro", country: "Country" } as const;
const AGE_WORD = { adult: "Adult", under_18: "Under 18" } as const;

/** "Metro", "Country" or "Not recorded", exactly as typed from the current paper. */
export function regionWord(movement: Movement): string {
  const region = movement.legalForm?.region;
  return region ? REGION_WORD[region] : "Not recorded";
}

/** "Adult", "Under 18" or "Not recorded", exactly as typed from the current paper. */
export function ageBandWord(movement: Movement): string {
  const band = movement.legalForm?.ageBand;
  return band ? AGE_WORD[band] : "Not recorded";
}

/**
 * How many extensions have been typed against the CURRENT form. The expiry history runs across
 * every form on the movement, so only entries recorded since the current form replaced the one
 * before it count.
 */
export function extensionsOfCurrentForm(movement: Movement): number {
  const earlier = movement.legalForm?.earlierForms;
  const replaced = earlier && earlier.length > 0 ? earlier[earlier.length - 1] : undefined;
  const since = replaced ? replaced.at : Number.NEGATIVE_INFINITY;
  // The clock moves in whole minutes, so an extension and a replacement can share a minute. An
  // extension in that same minute belongs to the replaced form when it typed the replaced form's
  // last expiry, which the replacement kept as history.
  return (movement.legalFormExpiryHistory ?? []).filter(
    (entry) =>
      entry.basis === "extension" && (entry.at > since || (entry.at === since && entry.dueAt !== replaced?.dueAt)),
  ).length;
}

/** The paper form that extends a current form, for the two extensions that can be made once only. */
const ONCE_ONLY_EXTENSION: Readonly<Record<string, string>> = { "1A": "1B", "4A": "4B" };

/**
 * A warning, never a block (H13): a Form 1B or 4B can be made once, so a second extension typed
 * against the same 1A or 4A is named for the person to check against the paper. Undefined when
 * there is nothing to warn about.
 */
export function onceOnlyExtensionWarning(movement: Movement): string | undefined {
  const code = movement.legalForm?.code;
  const extension = code ? ONCE_ONLY_EXTENSION[code] : undefined;
  if (!extension || extensionsOfCurrentForm(movement) === 0) return undefined;
  return `Form ${code} already has an extension recorded. A Form ${extension} can only be made once, so check the paper.`;
}

/** "Once, as typed" when the current form has an extension recorded, else undefined. */
export function extendedWord(movement: Movement): string | undefined {
  const count = extensionsOfCurrentForm(movement);
  if (count === 0) return undefined;
  return count === 1 ? "Once, as typed" : `${count} times, as typed`;
}
