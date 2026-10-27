/**
 * Audit row P148 (owner ruling, 27 Oct 2026, option A): referral text is cleaned QUIETLY before a
 * new `RECEIVE_REFERRAL` command is sent (client) and before it is stored (server, `storableCommand`).
 *
 * Removed: bidi controls U+202A-202E and U+2066-2069, and C0 control characters except newline.
 * Then outer spaces are trimmed. Inner text, including newlines, is kept as written. Nothing is
 * ever rejected here; an over-length value is still refused by the reducer, measured on the cleaned
 * value. Already-stored records are never rewritten: this runs only on incoming commands, never on
 * read or replay.
 */
const INVISIBLE = /[\u202A-\u202E\u2066-\u2069\u0000-\u0009\u000B-\u001F]/g;

export function cleanReferralText(value: string): string {
  return value.replace(INVISIBLE, "").trim();
}

type Fields = Record<string, unknown>;
const isFields = (value: unknown): value is Fields => !!value && typeof value === "object" && !Array.isArray(value);

/** Copies `holder`, cleaning only the named typed-text keys that hold a string. Anything else passes. */
function cleanKeys(holder: unknown, keys: readonly string[]): unknown {
  if (!isFields(holder)) return holder;
  const copy: Fields = { ...holder };
  for (const key of keys) if (typeof copy[key] === "string") copy[key] = cleanReferralText(copy[key]);
  return copy;
}

/**
 * Cleans ONLY the referral's typed text (owner, 27 Oct 2026 10:32 PM: "strip only referral text"):
 * `history`, `sendingTeamName`, and in `intake` the reason, catchment team name, referrer contact,
 * medical-clearance contact and arrival reference. Codes, ids, times and chart data pass unchanged.
 */
export function cleanReferralFields<T>(value: T): T {
  if (!isFields(value)) return value;
  const command = cleanKeys(value, ["history", "sendingTeamName"]) as Fields;
  const intake = (isFields(value.intake) ? value.intake : null) ?? (value.catchment !== undefined ? value : null);
  if (!intake) return command as T;
  const cleaned = cleanKeys(intake, ["reasonForReferral"]) as Fields;
  cleaned.catchment = cleanKeys(intake.catchment, ["teamName"]);
  cleaned.referrer = cleanKeys(intake.referrer, ["name", "email", "phone", "role", "location"]);
  cleaned.medicalClearance = cleanKeys(intake.medicalClearance, ["contactName", "contactPhone"]);
  if (intake.arrival !== undefined) cleaned.arrival = cleanKeys(intake.arrival, ["reference"]);
  for (const key of ["catchment", "referrer", "medicalClearance"]) if (intake[key] === undefined) delete cleaned[key];
  return (intake === value ? { ...command, ...cleaned } : { ...command, intake: cleaned }) as T;
}

/** The referrer contact, cleaned, so the drawer's own checks judge what will actually be sent. */
export function cleanReferralContact<T extends Record<string, string>>(contact: T): T {
  return cleanKeys(contact, ["name", "email", "phone", "role", "location"]) as T;
}
