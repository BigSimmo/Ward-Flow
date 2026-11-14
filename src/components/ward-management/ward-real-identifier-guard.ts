/**
 * A soft guard for real-looking identifiers (R-STRUCT-35, Demo-Feel-B2d-S-3, Josh, 14 Nov 2026).
 * The prototype takes synthetic data only. A value shaped like a real 8-digit UMRN, a Medicare
 * number or an Australian mobile number gets one quiet line of words. It never blocks a save and
 * never changes what is saved. Synthetic UMRNs here are two letters then digits ("UM100047").
 */
export const REAL_IDENTIFIER_WARNING = "This looks like a real identifier. Use made-up data in this prototype.";

const REAL_UMRN = /^\d{8}$/u;
// Medicare: ten digits, the first 2 to 6, optionally spaced 4-5-1, optionally with a reference digit.
const REAL_MEDICARE = /^[2-6]\d{3}\s?\d{5}\s?\d(?:\s?\d)?$/u;
// Australian mobile: 04xx xxx xxx or +61 4xx xxx xxx.
const REAL_MOBILE = /^(?:\+?61\s?|0)4\d{2}\s?\d{3}\s?\d{3}$/u;

export function looksLikeRealIdentifier(value: string | undefined): boolean {
  const text = (value ?? "").trim();
  if (text === "") return false;
  return REAL_UMRN.test(text) || REAL_MEDICARE.test(text) || REAL_MOBILE.test(text);
}

/** The warning when any of these values looks real, otherwise undefined. */
export function realIdentifierWarning(values: readonly (string | undefined)[]): string | undefined {
  return values.some(looksLikeRealIdentifier) ? REAL_IDENTIFIER_WARNING : undefined;
}
