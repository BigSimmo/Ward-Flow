/**
 * The daily sheet's rows, groups and stamp: plain functions, no component.
 *
 * Its own file (phone size, 13 Nov 2026): the bed meeting TV, the bed meeting sheet and the ward
 * board read only these, and importing them from `ward-daily-sheet.tsx` pulled the whole printed
 * sheet (about 27 KB before compression) onto Capacity's and the bed meeting's first load.
 * `ward-daily-sheet.tsx` re-exports them, so its callers are unchanged.
 */
import {
  admissionsForUnit,
  bedIsOccupied,
  daysInBed,
  isPastExpectedDischarge,
  stayBand,
  stayDayNumber,
  type Admission,
} from "@/components/ward-management/ward-admissions";
import {
  dayOf,
  formatInstant,
  formatSheetMoment,
  type ClockZoneLabel,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { heldUpDueByTomorrow } from "@/components/ward-management/ward-held-up";
import type { BedRelease } from "@/components/ward-management/ward-model";

/** One row on the sheet's person groups. A structural subset of the board's own `Occupant`, named
 *  here so this component states exactly what it reads rather than importing a wider type and
 *  quietly gaining fields. Nothing in it identifies a person: the record holds no name, no date of
 *  birth and no bed, and the sheet must never look as though it does. */
export type DailySheetPerson = {
  key: string;
  days: number | null;
  /** Which day of the stay today is, arrival day = Day 1. An ORDINAL, unlike `days`. */
  dayNumber: number | null;
  bandLabel: string | null;
  pastDate: boolean;
  sex: string;
  /** `null` for an admission created by an ED arrival - Task 17, 2026-08-30. The sheet says so in
   *  words; it never omits the person and never guesses a region. */
  homeRegion: string | null;
  /**
   * Whole hours at an emergency department, or `null` while the person is on the ward.
   *
   * **On the sheet as well as the tile, and the sheet is the half that matters more.** The tile
   * was fixed first and left the paper: a patient at an ED still printed as an ordinary occupant,
   * with a day count and a discharge plan and nothing saying they were not on the ward. **This
   * sheet is read aloud at handover**, which is exactly the moment somebody asks "and where is
   * she?" — and until this, nobody on the page could answer.
   *
   * The paper is also the artefact that leaves the room. A screen is re-read; a printed sheet is
   * carried to a meeting and believed.
   */
  awayAtEdHours: number | null;
  expectedDays: number | null;
  blockReason: string | null;
};

export type DailySheetGroups = {
  /** Recorded as held up by something — `BED_RELEASE_BLOCKERS`, an owner-approved list about the
   *  BED, never about the person — with the discharge due by tomorrow (D-191 item 5): exactly the
   *  stays `heldUpStayKeys` names, so the group lists the people the held-up count counts. */
  heldUp: DailySheetPerson[];
  /** Past the ward's own revisable expected date. Carries no legal or contractual weight. */
  overdue: DailySheetPerson[];
  /** Nobody has said when this person is expected to leave. Kept as its own group rather than
   *  folded into "overdue": an absent plan and a passed plan are different facts, and a meeting
   *  does different things about them. */
  noDate: DailySheetPerson[];
  /**
   * Off the ward at an emergency department, and its own group for a measured reason.
   *
   * **A line on the person's row was not enough, and the measurement is why.** The other three
   * groups are exceptions — stuck, overdue, no date — so a patient who is away but has an ordinary
   * discharge plan and no blocker falls into NONE of them and never printed at all. Measured, not
   * reasoned: the sheet showed **1 of 2** people away on the ward that has them.
   *
   * So being off the ward is its own exception, which is what it always was — it is exactly the
   * question a handover asks ("and where is she?") and exactly the one the sheet could not answer.
   *
   * A person can appear here AND in another group, on purpose, the same way somebody both stuck
   * and overdue appears twice: both facts are true and a meeting acts on both.
   */
  awayFromWard: DailySheetPerson[];
};

/**
 * D19's three "attention" groups, partitioned out of the rows the board already built.
 *
 * **A partition of the SAME array the board renders, not a re-derivation.** `pastDate` is
 * `isPastExpectedDischarge`'s answer and `expectedDays` is the board's own day arithmetic; this
 * function only reads them. Recomputing either from instants here would create a second opinion
 * about whether somebody is overdue, on the one page whose whole job is to be quoted out loud.
 *
 * The groups OVERLAP by design and each says so on screen: somebody can be both held up and past
 * their date, and dropping them from one group to avoid printing them twice would hide exactly the
 * person a flow meeting most needs to discuss. Order is the incoming order, which the board has
 * already sorted soonest-expected-out first — a stable, total order, so the sheet does not
 * reshuffle between two prints of the same picture.
 */
export function dailySheetGroups(
  people: readonly DailySheetPerson[],
  heldUpStays: ReadonlySet<string>,
): DailySheetGroups {
  return {
    heldUp: people.filter((person) => heldUpStays.has(person.key)),
    overdue: people.filter((person) => person.pastDate),
    noDate: people.filter((person) => person.expectedDays === null),
    awayFromWard: people.filter((person) => person.awayAtEdHours !== null),
  };
}

/**
 * The stays held up by tomorrow (Josh, 13 Nov 2026, D-191 item 5; F-105): the admissions behind the
 * releases `heldUpDueByTomorrow` counts, the one rule the Ward page, Capacity and Home count with.
 * A blocker on a discharge after tomorrow stays on that person's row and on Discharges ("any
 * date"); it is not in this group, so the group never lists more people than the count says.
 */
export function heldUpStayKeys(releases: readonly BedRelease[], now: Instant): ReadonlySet<string> {
  return new Set(heldUpDueByTomorrow(releases, now).map((release) => release.admissionId));
}

/**
 * Perth calendar days from `now` to the ward's own expected date, or `null` when there is none:
 * 0 is today, 1 tomorrow, -1 yesterday.
 *
 * Calendar days, not 24-hour blocks (time audit T1, 13 Nov 2026): a block count called a date
 * tomorrow at 08:00 "due today" at 20:00, and a date 19 minutes ago "1 day overdue". Whether the
 * time itself has passed is `isPastExpectedDischarge`, read to the minute, and is what sets tone.
 *
 * Deliberately WITHOUT the floor at zero `arrowTargets` applies. That floor is right there — the
 * destinations panel groups people by how soon the nearest one leaves, and a negative "soonest" is
 * meaningless in an ordering — and it would be wrong here, where the sign is the fact: this panel
 * distinguishes a date still ahead from one already passed, and clamping would silently present
 * every passed date as today. Shared with the daily sheet so the two never disagree.
 */
export function daysUntilExpected(admission: Admission, now: Instant): number | null {
  // A missing and an unusable (non-finite) expected date are equally absent.
  const expected = admission.expectedDischargeAt;
  if (expected === null || !Number.isFinite(expected) || !Number.isFinite(now)) return null;
  return dayOf(expected) - dayOf(now);
}

/** The sheet's person rows for one ward, from its occupied beds. Shared with the ward TV view so
 *  the two read the same rows. */
export function dailySheetPeople(admissions: readonly Admission[], unitId: string, now: Instant): DailySheetPerson[] {
  return admissionsForUnit(admissions, unitId)
    .filter(bedIsOccupied)
    .map((admission) => ({
      key: admission.id,
      days: daysInBed(admission, now),
      dayNumber: stayDayNumber(admission, now),
      bandLabel: stayBand(admission, now)?.label ?? null,
      pastDate: isPastExpectedDischarge(admission, now),
      sex: admission.sex,
      homeRegion: admission.homeRegion,
      awayAtEdHours:
        admission.awayAtEmergencyDepartmentSince === null
          ? null
          : Math.max(0, Math.floor((now - admission.awayAtEmergencyDepartmentSince) / 60)),
      // Perth calendar days, the board's own count (time audit T1).
      expectedDays: daysUntilExpected(admission, now),
      blockReason: admission.blockReason,
    }));
}

/**
 * Stamp the same synthetic instant as the figures. A provider origin allows a complete date,
 * year and zone words on saved output ("AWST" signed in, "demo time" in the demo: `zone`, from
 * `useClockZoneLabel`, F-113). Standalone consumers retain the demonstration-day fallback
 * when no valid calendar origin is available. Never substitute the wall clock for this instant.
 */
export function asAtStamp(
  now: Instant,
  dayZero?: Date,
  zone?: ClockZoneLabel,
): { time: string | null; dayNote: string } {
  const time = Number.isFinite(now)
    ? dayZero !== undefined && Number.isFinite(dayZero.getTime())
      ? formatSheetMoment(now, dayZero, { includeYearAndZone: true, zone })
      : formatInstant(now)
    : null;
  // A non-finite instant yields no day either: `dayOf(NaN)` is `NaN`, and "day NaN" is exactly the
  // kind of stamp this function's own doc comment refuses. No time, no day, same branch.
  const day = time === null ? null : dayOf(now) + 1;
  return {
    time,
    dayNote:
      day === null
        ? "synthetic figures — not a record of any real day"
        : `day ${day} of this demonstration — synthetic figures, not a record of any real day`,
  };
}
