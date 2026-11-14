import { splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import type { LeaveBed } from "@/components/ward-management/ward-model";
import { LEAVE_BED_OPEN_WARNING_MINUTES } from "@/components/ward-management/ward-operational-defaults";

/**
 * The signed 24-hour leave rule (`leaveOpenWarning`, AK-V-53): once a bed has been held for a person on
 * leave this long, every screen that lists the leave says to consider opening it. Words only; nothing
 * is opened. The one rule for the ward desk, the Coming and going rows, the Leave page and the alert.
 */
export function leaveOpenWarning(leave: Pick<LeaveBed, "confirmedAt">, now: Instant): string | undefined {
  const away = now - leave.confirmedAt;
  return away >= LEAVE_BED_OPEN_WARNING_MINUTES
    ? `On leave ${splitDuration(away)}. Consider opening the bed.`
    : undefined;
}
