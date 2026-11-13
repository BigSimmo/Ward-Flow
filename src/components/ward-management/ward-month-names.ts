/**
 * The one short spelling of each month, as `Intl` en-AU writes it and so as `perthDateText` prints
 * it: September is "Sept", not "Sep" (time audit D14, 13 Nov 2026). Every hand-written date uses
 * this list, so a screen never shows both spellings.
 */
export const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sept",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** The month (0-11) a short month name gives, reading a typed "Sep" and "Sept" alike; -1 for none. */
export function monthIndexOfShort(text: string): number {
  return (MONTH_SHORT as readonly string[]).indexOf(text === "Sep" ? "Sept" : text);
}
