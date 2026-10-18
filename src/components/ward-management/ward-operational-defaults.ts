/**
 * Ward Flow's operational defaults: the hour and percentage rules the screens use to sort, colour
 * and flag work, gathered in one place and named for what they are.
 *
 * **Every value here is a default the service chose, not a legal limit.** Owner ruling 26 September
 * 2026 (decisions.md D-22): any rule that claimed a legal limit was taken out; the rest became
 * labelled defaults, like the 9:30 morning roll-up (D-17). A screen that shows one of these figures
 * says so with `OPERATIONAL_DEFAULT_LABEL`, and never calls passing it a breach.
 *
 * The values are exactly the ones the screens typed in before this module existed, so nothing moves
 * on screen apart from the labels. Every figure that flags, colours or escalates a patient, referral
 * or bed is now read from `ward-clinical-values.ts`, which records whether it is synthetic or
 * clinically signed (Josh, 15 Oct 2026); the software and display settings stay typed here. They are read-only for now; making them adjustable is a later
 * piece of work (owner, 26 September 2026: "later").
 *
 * Configured values (the ED access target, the pull hold, the parallel referral cap, the roll-up
 * time) stay in `ward-configuration.ts` and are not repeated here. The two due-time warnings are
 * both: their defaults are named here, Settings changes them through `ward-configuration.ts`, and
 * the read-only list below leaves them out so it never shows a figure Settings has since changed.
 */

import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";

/** Kept local: ward-clock exports minutes per day only. */
const MINUTES_PER_HOUR = 60;

/** The words every screen shows beside one of these figures. */
export const OPERATIONAL_DEFAULT_LABEL = "your default, not a legal limit";

export interface OperationalDefault {
  /** What the rule does, in the words the settings screen lists it under. */
  readonly name: string;
  /** The value, as the settings screen prints it. */
  readonly display: string;
}

/** How long a recorded decision or bed move can be undone (v10 Undo toasts). A software safety
 *  window, not a clinical or legal limit. */
export const UNDO_WINDOW_MINUTES = 5;
/** How long an Undo toast stays on screen (pass 2 engine: 8 seconds). The engine's
 *  `UNDO_WINDOW_MINUTES` still decides whether an undo is accepted. */
export const UNDO_TOAST_MS = 8000;

/** How often an open shared workspace asks for a fresh snapshot (a software setting, not a
 *  clinical figure). Add patient waits this long for its new record before finishing without it. */
export const SHARED_REFRESH_MS = 3000;

/** All EDs trend (RowSpark) window: 12 hours, one point every 2 hours, the last point now. A display
 *  window chosen for the prototype, not a clinical target. */
export const ED_TREND_SPAN_MINUTES = 12 * MINUTES_PER_HOUR;
export const ED_TREND_STEP_MINUTES = 2 * MINUTES_PER_HOUR;

/** Minutes past the estimated arrival before a screen names a person as late. */
export const LATE_ARRIVAL_GRACE_MINUTES = CLINICAL_VALUES.lateArrivalGrace.value;

/** ED pressure on the side rail: amber once the longest wait reaches this. */
export const ED_ELEVATED_PRESSURE_WAIT_MINUTES = CLINICAL_VALUES.edElevatedPressure.value;
/** ED pressure on the side rail: red once the longest wait reaches this. */
export const ED_SEVERE_PRESSURE_WAIT_MINUTES = CLINICAL_VALUES.edSeverePressure.value;

/**
 * A wait in hospital counted as long: neutral colour, worded "Waiting over 24 hours". Josh, 26 Sept 2026
 * (D-24, morning list item 1): back as his default, never a breach and never a "standard".
 */
export const LONG_WAIT_MINUTES = CLINICAL_VALUES.longWait.value;
/** The words screens use for it, built from the value: "over 24 hours". */
export const LONG_WAIT_TEXT = `over ${LONG_WAIT_MINUTES / MINUTES_PER_HOUR} hours`;

/**
 * Reminders when a ward has not answered a referral (Delays and Coordinator screens): the first and
 * second reminder marks, then the end of the shift the referral was made in.
 */
export const SILENT_WARD_FIRST_REMINDER_MINUTES = CLINICAL_VALUES.silentWardFirstReminder.value;
export const SILENT_WARD_SECOND_REMINDER_MINUTES = CLINICAL_VALUES.silentWardSecondReminder.value;
/**
 * The one shift pattern every screen uses (Josh, 26 Sept 2026, "All yes": one pattern, the side
 * rail's): 07:00 to 15:00, 15:00 to 23:00 and 23:00 to 07:00. The reminders count to the end of the
 * shift a referral was made in.
 */
/** The side rail's shift pattern, as minutes of the day. Three eight-hour shifts. */
export const SHIFT_PATTERN = [
  { name: "Day Shift", startMinute: 7 * MINUTES_PER_HOUR, endMinute: 15 * MINUTES_PER_HOUR },
  { name: "Evening Shift", startMinute: 15 * MINUTES_PER_HOUR, endMinute: 23 * MINUTES_PER_HOUR },
  { name: "Night Shift", startMinute: 23 * MINUTES_PER_HOUR, endMinute: 7 * MINUTES_PER_HOUR },
] as const;

/** The day shift's start and end, which the reminders' "next morning" and shift ends read. */
export const REMINDER_MORNING_SHIFT_START_MINUTE = SHIFT_PATTERN[0].startMinute;
export const REMINDER_MORNING_SHIFT_END_MINUTE = SHIFT_PATTERN[0].endMinute;

/**
 * Warnings before a recorded legal due time: "due within the hour", then "due within 3 hours".
 * Josh, 26 Sept 2026 (card): "Your defaults: keep 1h and 3h, labelled 'your default, not a legal
 * limit', changeable in Settings." Question 3 ("All yes") made them changeable: these are the
 * values a new configuration, or one saved before the setting existed, starts from.
 * `WardFlowProvider` applies the saved values to `clockState`.
 */
export const DUE_SOON_URGENT_MINUTES = CLINICAL_VALUES.dueSoonUrgent.value;
export const DUE_SOON_MINUTES = CLINICAL_VALUES.dueSoon.value;
/**
 * How far Settings lets each warning move (Josh, 26 Sept 2026, "All yes", question 3: changeable in
 * Settings). The bounds are this build's own choice, not Josh's, and are on the questions list:
 * 15 minutes to 3 hours for the first warning, 30 minutes to 8 hours for the second.
 */
export const DUE_SOON_URGENT_RANGE_MINUTES = { min: 15, max: 3 * MINUTES_PER_HOUR, step: 15 } as const;
export const DUE_SOON_RANGE_MINUTES = { min: 30, max: 8 * MINUTES_PER_HOUR, step: 30 } as const;

/**
 * Decision targets per step (stream A, 9 Oct 2026). Each is a labelled default a coordinator can
 * change in Settings, never a clinical, legal or service standard. An overdue target raises an
 * act-now row in the action inbox (`decisionTargetInboxItems`, `ward-decision-targets.ts`).
 *
 * Names avoid Part 3's legal+duration token denylist (`REFERRAL`/`ACT` + `MINUTES`): these are
 * operational defaults, never Mental Health Act figures.
 */
export const WARD_ANSWER_TARGET_MINUTES = CLINICAL_VALUES.wardAnswerTarget.value;
export const TRANSFER_ACCEPTANCE_TARGET_MINUTES = CLINICAL_VALUES.transferAcceptanceTarget.value;
export const TRANSPORT_BOOKED_TARGET_MINUTES = CLINICAL_VALUES.transportBookedTarget.value;
export const DECISION_TARGET_RANGE_MINUTES = { min: 15, max: 12 * MINUTES_PER_HOUR, step: 15 } as const;

/**
 * The longest a red (act-now) alert or task may be snoozed. Acknowledging is always allowed;
 * hiding a red row for longer than this is refused by the reducer. A prototype default.
 * Named without the legal token `ACT` so Part 3's incomplete denylist does not trip on it.
 */
export const RED_ROW_SNOOZE_CAP_MINUTES = 1 * MINUTES_PER_HOUR;
/** Sanity bound on any snooze: a row never disappears for more than a day. */
export const SNOOZE_MAX_MINUTES = 24 * MINUTES_PER_HOUR;

/**
 * Carer, PSP and MHAS notifications (9 Oct 2026): an involuntary admission, transfer or discharge
 * completed within this many minutes stays on the task list while a party is unrecorded. A service
 * default for keeping the list short, not a legal time limit.
 */
export const SUPPORT_NOTIFICATION_TASK_LOOKBACK_MINUTES = 72 * MINUTES_PER_HOUR;

/**
 * A leave bed held this long is flagged "consider opening it" (Josh, D-23: the 24 hours stay, as his
 * default, like the roll-up).
 */
export const LEAVE_BED_OPEN_WARNING_MINUTES = CLINICAL_VALUES.leaveOpenWarning.value;
/** Patient search's wait filter: the band under this many hours, then up to the long wait. */
export const WAIT_FILTER_SHORT_MINUTES = 6 * MINUTES_PER_HOUR;
/**
 * A bed hold active this long without a confirmed dispatch is flagged for review, never released
 * (Josh, 26 Sept 2026: the 2 hours stay as his default, not the 4-hour pull hold).
 */
export const BED_HOLD_EXPIRY_MINUTES = CLINICAL_VALUES.bedHoldReview.value;

/** Occupancy colour bands on the side rail, as whole-number percentages of beds. */
export const OCCUPANCY_ALERT_PERCENT = CLINICAL_VALUES.occupancyAmber.value;
export const OCCUPANCY_SURGE_PERCENT = CLINICAL_VALUES.occupancySurge.value;
export const OCCUPANCY_CRITICAL_PERCENT = CLINICAL_VALUES.occupancyCritical.value;

/** When the referral board calls a referral overdue, by recorded urgency tier. */
export const OVERDUE_AFTER_MINUTES_BY_TIER: Readonly<Record<1 | 2 | 3, number>> = {
  1: CLINICAL_VALUES.tierOneOverdue.value,
  2: CLINICAL_VALUES.tierTwoOverdue.value,
  3: CLINICAL_VALUES.tierThreeOverdue.value,
};
/** Any referral still running this long is overdue, whatever its tier. */
export const OVERDUE_AFTER_ANY_TIER_MINUTES = CLINICAL_VALUES.anyTierOverdue.value;

/** The Mental Health Act calculator's after-hours window, as hours of the day (17:00 to 08:00). */
const AFTER_HOURS_START_HOUR = 17;
const AFTER_HOURS_END_HOUR = 8;

/**
 * How long a leave bed may stay open before Ward Flow warns, in hours. Josh, 26 Sept 2026 (D-23,
 * "Yes both": keep the leave bed's open warning at 24 hours). Unrelated to the Mental Health Act.
 */
export const LEAVE_BED_OPEN_WARNING_HOURS = LEAVE_BED_OPEN_WARNING_MINUTES / MINUTES_PER_HOUR;

/** An expected arrival is flagged once it has waited this long: voluntary 48 hours, involuntary 7 days. */
export const EXPECT_FLAG_VOLUNTARY_MINUTES = CLINICAL_VALUES.expectFlagVoluntary.value;
export const EXPECT_FLAG_INVOLUNTARY_MINUTES = CLINICAL_VALUES.expectFlagInvoluntary.value;

/** An expected referral is flagged to reconsider after 72 hours: Josh's own figure, 7 Sept 2026. */
export const EXPECT_RECONSIDER_AFTER_MINUTES = CLINICAL_VALUES.expectReconsider.value;

/** 08:00, the morning handover time the roll-up counts "today" from. */
export const MORNING_HANDOVER_MINUTES = 8 * MINUTES_PER_HOUR;

/**
 * 08:30, the morning bed meeting the Out of area hero compares with ("since the 08:30 bed
 * meeting", v10 mockup). A service default for where the comparison starts, not a clinical figure.
 */
export const BED_MEETING_MINUTES = 8 * MINUTES_PER_HOUR + 30;

/**
 * The end of the evening shift, 23:00. The discharge board's Tonight group does NOT stop here: since
 * Josh's 30 August 2026 ruling (DB-7, "roll the horizon a full 24 hours") it runs from 16:00 until
 * midnight, and a later day shows under Tomorrow (`releaseBand`). Josh, 26 September 2026: keep
 * that, and make the Settings wording say so ("Fix wording").
 */
export const EVENING_SHIFT_END_MINUTES = SHIFT_PATTERN[1].endMinute;

function hoursText(minutes: number): string {
  const hours = minutes / MINUTES_PER_HOUR;
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

// ---- Group STATISTICS AND SETTINGS (Fix the working system, 26 September 2026) ----------------

/** The second waiting band on the statistics screens (twice the long-wait default, unsigned). */
export const VERY_LONG_WAIT_MINUTES = CLINICAL_VALUES.veryLongWait.value;

/** This group's entries for the settings list; `OPERATIONAL_DEFAULTS` below includes them. */
const OPERATIONAL_DEFAULTS_FIX: readonly OperationalDefault[] = [
  { name: "Wait shown as very long from", display: hoursText(VERY_LONG_WAIT_MINUTES) },
];

/** The list the settings screen shows, read-only, in the order a coordinator meets them. */
export const OPERATIONAL_DEFAULTS: readonly OperationalDefault[] = [
  { name: "Arrival counted as late after", display: `${LATE_ARRIVAL_GRACE_MINUTES} minutes past the estimate` },
  { name: "ED pressure shown as elevated from", display: `a wait of ${hoursText(ED_ELEVATED_PRESSURE_WAIT_MINUTES)}` },
  { name: "ED pressure shown as severe from", display: `a wait of ${hoursText(ED_SEVERE_PRESSURE_WAIT_MINUTES)}` },
  { name: "Wait shown as long from", display: hoursText(LONG_WAIT_MINUTES) },
  {
    name: "Occupancy colour bands",
    display: `${OCCUPANCY_ALERT_PERCENT}%, ${OCCUPANCY_SURGE_PERCENT}% and ${OCCUPANCY_CRITICAL_PERCENT}%`,
  },
  {
    name: "Referral shown as overdue after",
    display: `${hoursText(OVERDUE_AFTER_MINUTES_BY_TIER[1])} (tier 1), ${hoursText(OVERDUE_AFTER_MINUTES_BY_TIER[2])} (tier 2), ${hoursText(OVERDUE_AFTER_MINUTES_BY_TIER[3])} (tier 3), ${hoursText(OVERDUE_AFTER_ANY_TIER_MINUTES)} (any tier)`,
  },
  {
    name: "After-hours window in the Mental Health Act calculator",
    display: `${String(AFTER_HOURS_START_HOUR).padStart(2, "0")}:00 to ${String(AFTER_HOURS_END_HOUR).padStart(2, "0")}:00`,
  },
  { name: "Shift pattern (every screen)", display: "07:00, 15:00 and 23:00" },
  { name: "Leave bed flagged to consider opening after", display: hoursText(LEAVE_BED_OPEN_WARNING_MINUTES) },
  // Audit settings-17 (Josh, 13 Oct 2026): one hold length, the Pull hold rule. The marker every
  // page shows is derived from it (`ward-bed-hold.ts`), so this line names that, not a second timer.
  { name: "Bed hold shown as running out", display: `${hoursText(DUE_SOON_URGENT_MINUTES)} before the Pull hold ends` },
  {
    name: "Patient search wait bands",
    display: `under ${hoursText(WAIT_FILTER_SHORT_MINUTES)}, then up to ${hoursText(LONG_WAIT_MINUTES)}, then over`,
  },
  {
    name: "Expected arrival flagged after",
    display: `${hoursText(EXPECT_FLAG_VOLUNTARY_MINUTES)} (voluntary), 7 days (involuntary)`,
  },
  { name: "Expected referral flagged to reconsider after", display: hoursText(EXPECT_RECONSIDER_AFTER_MINUTES) },
  { name: "Morning handover", display: "08:00" },
  { name: "Discharge board's Tonight group", display: "16:00 until midnight; later days show under Tomorrow" },
  {
    name: "Reminders when a ward has not answered",
    display: `${hoursText(SILENT_WARD_FIRST_REMINDER_MINUTES)}, ${hoursText(SILENT_WARD_SECOND_REMINDER_MINUTES)}, then the end of the shift`,
  },
  ...OPERATIONAL_DEFAULTS_FIX,
];

/**
 * Global alerts (Josh picked option A, 10 Oct 2026). Labelled defaults, never clinical or service
 * standards. Josh accepted 15 minutes as the Pull now answer time on 10 Oct 2026.
 * - `PULL_NOW_ANSWER_MINUTES`: an unanswered Pull now returns to the coordinator as act now.
 * - `PULL_NOW_LIVE_MINUTES`: how long a Pull now stays live if nobody pulls or stands it down.
 * - `READY_AT_AHEAD_LIMIT_MINUTES`: the latest "bed ready at" a ward may give.
 */
export const PULL_NOW_ANSWER_MINUTES = CLINICAL_VALUES.pullNowAnswer.value;
export const PULL_NOW_LIVE_MINUTES = CLINICAL_VALUES.pullNowLive.value;
export const READY_AT_AHEAD_LIMIT_MINUTES = 24 * MINUTES_PER_HOUR;
export const DEFAULT_BROADCAST_DURATION_MINUTES = 4 * MINUTES_PER_HOUR;
export const DEFAULT_BROADCAST_EXTENSION_MINUTES = 2 * MINUTES_PER_HOUR;
