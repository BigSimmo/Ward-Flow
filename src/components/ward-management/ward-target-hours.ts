import { splitDuration } from "@/components/ward-management/ward-clock";

/**
 * A configured target length said in hours: "24 hours", "4 hours", "1 hour". The one wording for the
 * ED access target wherever it is named, so one setting never reads as "1d", "1d 0h" and "24h" on
 * three screens (time audit D4, 13 Nov 2026). A length that is not whole hours keeps the duration
 * form ("4h 30m"). Wording only: the value is the configuration's own.
 */
export function targetHoursText(minutes: number): string {
  if (minutes <= 0 || minutes % 60 !== 0) return splitDuration(minutes);
  const hours = minutes / 60;
  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}
