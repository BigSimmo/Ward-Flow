import { splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { edMedicalTripBedRetention } from "@/components/ward-management/ward-derivations-transport";
import { ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS, type LeaveBed } from "@/components/ward-management/ward-model";
import { LEAVE_BED_OPEN_WARNING_MINUTES } from "@/components/ward-management/ward-operational-defaults";

const MINUTES_PER_HOUR = 60;

/**
 * The signed 24-hour leave rule (`leaveOpenWarning`, AK-V-53): once a bed has been held for a person on
 * leave this long, every screen that lists the leave says to consider opening it. Words only; nothing
 * is opened. The one rule for the ward desk, the Coming and going rows, the Leave page and the alert.
 *
 * D-106 (PLACEMENT-019): a medical trip recorded as expected to last over 24 hours flags the held bed
 * for review from the start, through `edMedicalTripBedRetention`. Words only; the bed is never freed.
 */
export function leaveOpenWarning(
  leave: Pick<LeaveBed, "confirmedAt"> & Partial<Pick<LeaveBed, "expectedReturn" | "kind">>,
  now: Instant,
): string | undefined {
  const away = now - leave.confirmedAt;
  if (away >= LEAVE_BED_OPEN_WARNING_MINUTES) return `On leave ${splitDuration(away)}. Consider opening the bed.`;
  if (leave.kind === "medical_trip" && leave.expectedReturn !== undefined) {
    const retention = edMedicalTripBedRetention({
      expectedStayHours: (leave.expectedReturn - leave.confirmedAt) / MINUTES_PER_HOUR,
    });
    if (retention.requiresReview)
      return `Medical trip expected to last over ${ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS} hours. Review the held bed.`;
  }
  return undefined;
}
