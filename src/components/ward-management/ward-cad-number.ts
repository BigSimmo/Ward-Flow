/**
 * CAD dispatch number checks (HAZ-03, issue #430). One rule, read by the engine and by every
 * booking form, so a form never offers a booking the engine would refuse.
 *
 * The number is read off the phone call to the provider. The checks here are a plausibility floor,
 * not the provider's own number syntax: St John WA's real dispatch-number format has not been
 * confirmed with the owner, so nothing here claims a number is a real job. What it does stop is a
 * booking logged with a placeholder ("TBC", "N/A", "pending", "CAD-0000") or with free text in the
 * number field, either of which reads on screen as though a job number had been given.
 */

/** Longest number accepted. Dispatch numbers are short; anything longer is free text. */
export const CAD_NUMBER_MAX_LENGTH = 24;

/** Letters, digits and the separators people type between them. Starts and ends on a letter or digit. */
const CAD_NUMBER_SHAPE = /^[A-Z0-9](?:[A-Z0-9 /-]*[A-Z0-9])?$/i;

/**
 * Words typed in place of a number the caller has not been given yet. A number that holds any of
 * them as a whole word is refused, so "TBC", "CAD TBC" and "TBA-1" all fail.
 */
const CAD_PLACEHOLDER_WORDS = new Set([
  "TBC",
  "TBA",
  "TBD",
  "NA",
  "NIL",
  "NONE",
  "NULL",
  "UNKNOWN",
  "PENDING",
  "AWAITING",
  "WAITING",
  "PLACEHOLDER",
  "TEMP",
  "TODO",
  "ASAP",
]);

/**
 * Why `text` cannot be logged as a CAD dispatch number, in words for the booking form, or
 * `undefined` when it can. Blank is reported as not yet entered.
 */
export function cadNumberProblem(text: string): string | undefined {
  const value = text.trim();
  if (value.length === 0) return "enter the CAD transport number";
  if (value.length > CAD_NUMBER_MAX_LENGTH) {
    return `the CAD number is longer than ${CAD_NUMBER_MAX_LENGTH} characters, so enter the number only`;
  }
  // Words are split at separators and at letter-digit boundaries, so "TBC1" holds "TBC". Checked
  // before the shape, so "TBC?" is called a placeholder rather than a bad character.
  const words = value.toUpperCase().split(/[^A-Z0-9]+|(?<=[A-Z])(?=[0-9])|(?<=[0-9])(?=[A-Z])/);
  if (words.some((word) => CAD_PLACEHOLDER_WORDS.has(word))) {
    return "the CAD number looks like a placeholder, so enter the number the provider gave";
  }
  if (!CAD_NUMBER_SHAPE.test(value)) {
    return "the CAD number can hold only letters, digits, spaces, hyphens and slashes";
  }
  const digits = value.replace(/[^0-9]/g, "");
  if (digits.length === 0) return "the CAD number has no digits, so enter the number the provider gave";
  if (/^0+$/.test(digits)) return "the CAD number is all zeros, which looks like a placeholder";
  // "9999" or "X-XXX": one character over and over is a filler, not a job number.
  if (/^([A-Z0-9])\1+$/i.test(value.replace(/[^A-Z0-9]/gi, ""))) {
    return "the CAD number repeats one character, which looks like a placeholder";
  }
  return undefined;
}

/**
 * Travel with no dispatch service behind it, so no CAD number exists to read off a call (form
 * friction audit, 27 Oct 2026). The booking form does not ask for one and the engine does not
 * refuse a booking without one.
 */
const PROVIDERS_WITHOUT_CAD: ReadonlySet<string> = new Set(["Ward escort", "Family or carer"]);

/** Whether a booking with this provider is logged against a CAD number. */
export function providerNeedsCadNumber(provider: string | undefined): boolean {
  return provider === undefined || !PROVIDERS_WITHOUT_CAD.has(provider);
}

/** The words every screen shows for a dispatched job still waiting on its CAD number. */
export const CAD_TO_FOLLOW = "CAD to follow";

/**
 * CAD to follow (Josh, 27 Oct 2026): a dispatched service may be booked before the provider gives
 * its CAD number. The job is not blocked; it shows "CAD to follow" until the number is added
 * (`RECORD_TRANSPORT_CAD`). True for a live dispatched job with no number.
 */
export function cadNumberToFollow(
  transport: { provider: string; cadNumber?: string; cancelledAt?: number; arrivedAt?: number } | undefined,
): boolean {
  return (
    transport !== undefined &&
    transport.cancelledAt === undefined &&
    transport.arrivedAt === undefined &&
    providerNeedsCadNumber(transport.provider) &&
    (transport.cadNumber ?? "").trim().length === 0
  );
}
