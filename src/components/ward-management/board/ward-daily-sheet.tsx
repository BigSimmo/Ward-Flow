import { useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Copy, FileText, Printer, X } from "lucide-react";
import { buttonClass, Card, CardHead, CountBubble, Icon, StatusGlyph, type WfTone } from "@/components/wf";
import { dayOf, formatInstant, type Instant } from "@/components/ward-management/ward-clock";
import type { Unit } from "@/components/ward-management/ward-model";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { WardFlowContext } from "@/components/ward-management/ward-flow-provider";
import {
  admissionsForUnit,
  bedIsOccupied,
  daysInBed,
  isPastExpectedDischarge,
  stayBand,
  stayDayNumber,
} from "@/components/ward-management/ward-admissions";
import { tentativeDiagnosisPhrase } from "@/components/ward-management/ward-diagnosis";
import { arrowTargets, sinceYesterday } from "@/components/ward-management/ward-board-derivations";
import { releaseBand } from "@/components/ward-management/ward-bed-availability";
import { CAPACITY_FIGURE_LABELS } from "@/components/ward-management/ward-morning-rollup";

import styles from "./ward-daily-sheet.module.css";

/**
 * THE WARD'S DAILY SHEET — the page a charge nurse carries into the morning meeting.
 *
 * Spec: D19 ("the printed page is the ward's handover sheet ... who came in, who is going, who is
 * stuck, who is overdue"), DB-10 (the sheet is current at the moment it is printed, and the stamp
 * that says so is load-bearing), DB-11 (nothing is frozen — one live picture, on screen and on
 * paper) and DB-12 (the stamp must read the SAME instant the figures read).
 *
 * **It derives nothing.** Every figure and every row arrives as a prop, already computed by
 * `ward-board.tsx` from the shared derivations (`headlineAvailable`, `constraintSentence`,
 * `sinceYesterday`, `arrowTargets`, `derivedBedReleases`, `daysInBed`, `stayBand`,
 * `isPastExpectedDischarge`). That is deliberate and it is the whole safety property of this file:
 * a sheet that re-counted anything would be a second answer to a number a clinician is holding
 * next to the screen, and the two would disagree the first time either was corrected. The only
 * thing computed here is which of the already-built rows falls into which of D19's four groups —
 * a partition, never an arithmetic.
 *
 * **What it does NOT contain, and why.** D10's editable half — dates typed in a column, shorthand
 * like `+7`, the one "nothing has changed" button — is absent. That half of the daily sheet writes
 * to the model, and this board's exemption to read the admission seed is bounded precisely by its
 * dispatching nothing (spec DB-19); building the editable sheet here would break that boundary and
 * fire the companion assertion. It is a separate piece of work on a surface allowed to emit events.
 * Stated on the sheet itself, so nobody reads its absence as "there is nothing to update".
 */

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
  /** Already phrased by `tentativeDiagnosisPhrase`, never a bare block code. */
  tentativeDiagnosis: string | null;
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
   *  BED, never about the person. */
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
export function dailySheetGroups(people: readonly DailySheetPerson[]): DailySheetGroups {
  return {
    heldUp: people.filter((person) => person.blockReason !== null),
    overdue: people.filter((person) => person.pastDate),
    noDate: people.filter((person) => person.expectedDays === null),
    awayFromWard: people.filter((person) => person.awayAtEdHours !== null),
  };
}

/**
 * The "as at" stamp, and it is the safeguard DB-10 and DB-11 traded the frozen view for.
 *
 * **It reads the instant handed to it — the same `now` every figure on the sheet reads (DB-12).**
 * It must never call `wallClockNow()`: this prototype's screens take their `now` from a shared
 * value that a demo control can move, so a stamp on the wall clock beside figures from a moved
 * clock would assert a moment that is not the moment being shown. A stamp that can lie is worse
 * than no stamp, because the freeze was removed on the strength of it.
 *
 * **There is still no DATE, and that is stated rather than silently dropped — but the SAFEGUARD
 * DB-10 wanted now works.** DB-10 requires date AND time, for a real reason: paper outlives its
 * day, and a sheet stamped `15:22` read the next morning distinguishes nothing from one stamped
 * `15:22` the morning before. Two sheets that are two moments must not look like two claims about
 * one.
 *
 * A calendar date is still not available and is still not invented. But `a3d199fa7` gave an
 * `Instant` a DAY (`dayOf`), so the sheet can now carry which day of the demonstration it was
 * taken on — and that is sufficient for the failure DB-10 actually names, without fabricating the
 * one element the decision made load-bearing. Two sheets from different days are now visibly two
 * moments.
 *
 * **The `+ 1` is presentation and lives only here.** `dayOf` returns 0 for the opening day, and
 * "day 0" reads as a defect to anybody not holding `ward-clock.ts` open. Nothing computes from
 * this string; it is read aloud and pinned to a wall.
 *
 * **THE CALENDAR ARRIVED, AND THE SHEET STILL DOES NOT PRINT A DATE. That is a choice now, not a
 * limitation.** `b1198cf6e` gave the clock a real date (`dayZero` on the provider,
 * `calendarDateOf`), so this sheet COULD say "30 August". It does not, for two reasons, and the
 * second is the one that matters:
 *
 *   1. A reader of a ward sheet is oriented to now, not to a calendar — which is why
 *      `formatInstantWithDay` prefers "yesterday" and "3 days ago" over dates.
 *   2. **A dated sheet invites the reader to believe the FIGURES are dated, and they are not.**
 *      Every number on this page is synthetic. A real date beside invented figures is the one
 *      combination that makes a prototype look like a record.
 *
 * So the old "this prototype holds no calendar date" clause was removed the moment it became
 * false — it was a true statement about a missing capability, and leaving it in place after the
 * capability arrived would have made the sheet lie about the system rather than about the day.
 * What replaced it says what is actually true: the figures are synthetic, whatever the clock knows.
 *
 * A non-finite instant yields no time rather than `NaN:NaN` — the conservative direction this
 * whole feature takes: a sheet that cannot say when it was taken must not appear to.
 */
export function asAtStamp(now: Instant): { time: string | null; dayNote: string } {
  const time = Number.isFinite(now) ? formatInstant(now) : null;
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

const TNUM = { fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum" 1' } as const;

/** One person's line on the sheet. Deliberately shorter than the board's own `PersonEntry`: a
 *  handover sheet is read aloud, so each row is the day count, who they are and the one fact that
 *  put them in this group. The full plan — who set the date, how often it moved, whether the ward
 *  confirmed it — is on the "Who is in these beds" pages that follow, and is not repeated here.
 *
 *  The glyph is the group's shape (StatusGlyph is `aria-hidden`): the heading and the words in the
 *  row carry the meaning, the shape only lets a scanning eye find the group again. */
function SheetPerson({ person, testId, tone }: { person: DailySheetPerson; testId: string; tone: WfTone }) {
  return (
    <li className={styles.row} data-testid={testId}>
      <span className={styles.rowGlyph}>
        <StatusGlyph tone={tone} />
      </span>
      <div className={styles.rowText}>
        <p className={styles.rowLead}>
          {/* `dayNumber`, never `days`. `days` is a DURATION and is 0 for everybody admitted since
           *  yesterday; this line is an ORDINAL, and printing the duration here read "Day 0". Both
           *  arrive as props — this file still derives nothing. See `stayDayNumber`. */}
          {person.dayNumber === null ? (
            <span className={styles.rowLeadText}>No stay yet — not arrived</span>
          ) : (
            <span className={styles.rowLeadText} style={TNUM}>
              Day {person.dayNumber}
            </span>
          )}
          {person.bandLabel !== null && (
            <span className={styles.rowValue} style={TNUM}>
              {person.bandLabel}
            </span>
          )}
        </p>
        {/*
         * DIRECTLY AFTER THE LEAD, and above everything else about them, because it changes what
         * every line below it means: a day count, a discharge plan and a diagnosis all read
         * differently about somebody who is not on the ward. Only for the people it applies to, and
         * it says the bed is still theirs in the same breath: "away" on a bed sheet otherwise reads
         * as "so the bed is free", and it is not — the ward is holding it.
         */}
        {person.awayAtEdHours !== null && (
          <p className={styles.rowAway} data-testid={`${testId}-away`}>
            {person.awayAtEdHours === 0
              ? "At an emergency department — the bed is still theirs."
              : `At an emergency department, ${person.awayAtEdHours} ${person.awayAtEdHours === 1 ? "hour" : "hours"} — the bed is still theirs.`}
          </p>
        )}
        <p className={styles.rowLine}>{personFacts(person)}</p>
        {/* "Tentative" leads the line, as it does on the board's own panel and for the same reason: a
          reader scanning a column takes the first words of each row, so a qualification at the end is
          the half that gets skipped. Both states are stated; silence would leave a reader unable to
          tell "nobody wrote one down" from "this sheet does not show them". */}
        <p className={styles.rowLine}>
          {person.tentativeDiagnosis !== null
            ? `Tentative diagnosis: ${person.tentativeDiagnosis}.`
            : "Tentative diagnosis: none recorded."}
        </p>
        {person.blockReason !== null && <p className={styles.rowLine}>Held up by: {person.blockReason}.</p>}
        {person.pastDate && person.expectedDays !== null && (
          <p className={styles.rowLine}>
            <span style={TNUM}>{-person.expectedDays}</span> day
            {person.expectedDays === -1 ? "" : "s"} past the ward&apos;s expected date.
          </p>
        )}
      </div>
    </li>
  );
}

/** A group with nothing in it says so in words. An empty list under a heading reads as a panel that
 *  failed to load rather than as a ward with nobody in that state — and on a sheet somebody is
 *  reading aloud, "nothing failed to print" is exactly the assurance that has to be explicit. */
function SheetGroup({
  heading,
  headingId,
  testId,
  emptyText,
  people,
  tone,
  note,
}: {
  heading: string;
  headingId: string;
  testId: string;
  emptyText: string;
  people: readonly DailySheetPerson[];
  tone: WfTone;
  note?: string;
}) {
  return (
    <Card className={styles.group} aria-labelledby={headingId} data-testid={testId}>
      <CardHead
        level={3}
        eyebrow
        id={headingId}
        title={heading}
        meta={<CountBubble n={people.length} />}
        className={styles.groupHead}
      />
      <p
        className={people.length === 0 ? styles.empty : styles.visuallyHidden}
        data-testid={`${testId}-count`}
        style={TNUM}
      >
        {people.length === 0 ? (
          emptyText
        ) : (
          <>
            <span style={TNUM}>{people.length}</span> on this ward.
          </>
        )}
      </p>
      {people.length > 0 && (
        <ol className={styles.rows}>
          {people.map((person) => (
            <SheetPerson key={person.key} person={person} tone={tone} testId={`${testId}-${person.key}`} />
          ))}
        </ol>
      )}
      {note !== undefined && <p className={styles.note}>{note}</p>}
    </Card>
  );
}

/** One figure tile. The label sits after a space so the tile's text reads as a phrase
 *  ("3 left this ward") to a screen reader, a copy and the tests; CSS capitalises it on screen. */
function FigureTile({ value, label, testId }: { value: number; label: string; testId?: string }) {
  return (
    <div className={styles.tile} data-testid={testId}>
      <strong className={styles.tileValue} style={TNUM}>
        {value}
      </strong>{" "}
      <span className={styles.tileLabel} title={label}>
        {label}
      </span>
    </div>
  );
}

/** The going-out tile names its basis in words, exactly as the card below does: "4 beds" without
 *  "confirmed" or "expected" beside it is two different claims sharing a number. */
function outgoingTileLabel(basis: string): string {
  return /\s*today$/iu.test(basis) ? `${basis.replace(/\s*today$/iu, "")} free today` : `${basis} to free`;
}

export type WardDailySheetProps = {
  /** `sinceYesterday`, already scoped to this ward by the board. */
  movement?: { discharged: number; pulled: number; datesMoved: number };
  /** How many people are recorded as coming in — the board's own `buildIncoming` length, split by
   *  whether the bed has already gone. */
  incomingPulled?: number;
  incomingWaitlisted?: number;
  /** How many beds the ward expects to free today, and on which of the two bases — the board's own
   *  `outgoingToday` result and the label it renders for that basis. */
  outgoingCount?: number;
  outgoingBasisLabel?: string;
  /** `arrowTargets` for this unit: where the people in these beds are expected to head, nearest
   *  first, already limited to the board's display horizon. */
  destinations?: readonly { region: string; count: number; nearestDays: number }[];
  /** The board's occupants, in the board's order. */
  people?: readonly DailySheetPerson[];
  /** Optional instant or shift timestamp for the sheet */
  now?: Instant;
  shiftTimestamp?: string | null;
  /** Optional unit for automatic derivations */
  unit?: Unit;
  /** Optional interactive print trigger callback */
  onPrint?: () => void;
  onClose?: () => void;
  /**
   * Rendered inside a modal body whose header already carries the title and the "as at" stamp.
   * The sheet then drops its own visible heading and intro (the heading stays for assistive
   * technology) and its panel edge. Defaults to true when `onClose` is passed — the ward page's
   * modal — and false on the board, where the sheet is its own printed page.
   */
  embedded?: boolean;
};

/**
 * The sheet itself.
 *
 * Reading order is D19's, verbatim: **who came in · who is going · who is stuck · who is overdue**.
 *
 * The headline number, the sentence that qualifies it (D11) and the "as at" stamp (DB-10) are NOT
 * repeated here: they are in the page heading directly above, which is the top of the same printed
 * page, and a second copy of a figure on one sheet is a figure that can disagree with itself.
 *
 * Nothing here is a control: a sheet is read, not operated, and the board is where anything is
 * done — so there is no button on this component at all, which is also why the global print reset
 * (`header, nav, button { display: none !important }`) can take nothing away from it. That reset is
 * why the sheet is a `<section>` and its title an `<h2>`, never a `<header>`. The dialog's Copy,
 * Print and Close live in `WardDailySheetDialog`, outside this section.
 */
/**
 * The person facts line — sex and home region — in the ONE place both renderings read it.
 *
 * ⚠️ **THE "OFF THE WARD" LINE PRINTED THE LITERAL WORD "null" AND THIS SHEET IS READ ALOUD.**
 * `DailySheetPerson.homeRegion` is `string | null`, and `PULL_PATIENT` creates every runtime
 * admission with `homeRegion: null` (reducer, "the fact does not exist on a movement anywhere in
 * the model"). The row rendering guarded it; the "Off the ward" summary interpolated it bare, so
 * a pulled-then-away patient read as **"Female, from null — at an emergency department"**.
 *
 * Not reachable from the seed — both seeded away-patients carry a region — which is exactly why it
 * survived: it needs a patient who was pulled at runtime and then recorded away.
 *
 * ⚠️ **ONE FUNCTION RATHER THAN A SECOND COPY OF THE TERNARY.** The defect was two renderings of one
 * fact disagreeing about whether it can be absent. Fixing the second by pasting the first's guard
 * leaves the same shape in place for the third. This file's own comment calls the sheet something
 * "carried to a meeting and believed"; the guard belongs where the sentence is built, once.
 */
function personFacts(person: DailySheetPerson): string {
  return `${person.sex}, ${person.homeRegion === null ? "home region not recorded" : `from ${person.homeRegion}`}`;
}

export function WardDailySheet({
  movement,
  incomingPulled,
  incomingWaitlisted,
  outgoingCount,
  outgoingBasisLabel,
  destinations,
  people,
  now,
  shiftTimestamp,
  unit,
  onPrint,
  onClose,
  embedded,
}: WardDailySheetProps) {
  const isEmbedded = embedded ?? onClose !== undefined;
  const currentNow = now ?? 0;
  // Prefer the provider's live admissions when this sheet is opened from ward-screen's unit-only
  // path; the frozen seed is only a last resort for isolated renders without a provider.
  const liveFlow = useContext(WardFlowContext);
  const liveAdmissions = liveFlow?.admissions;
  const liveBedReleases = liveFlow?.bedReleases;
  const admissionSource = liveAdmissions ?? wardAdmissions;

  const resolvedPeople = useMemo(() => {
    if (people !== undefined) return people;
    if (!unit) return [];
    return admissionsForUnit(admissionSource, unit.id)
      .filter(bedIsOccupied)
      .map((admission) => ({
        key: admission.id,
        days: daysInBed(admission, currentNow),
        dayNumber: stayDayNumber(daysInBed(admission, currentNow)),
        bandLabel: stayBand(admission, currentNow)?.label ?? null,
        pastDate: isPastExpectedDischarge(admission, currentNow),
        sex: admission.sex,
        homeRegion: admission.homeRegion,
        tentativeDiagnosis: tentativeDiagnosisPhrase(admission.tentativeDiagnosis),
        awayAtEdHours:
          admission.awayAtEmergencyDepartmentSince === null
            ? null
            : Math.max(0, Math.floor((currentNow - admission.awayAtEmergencyDepartmentSince) / 60)),
        expectedDays:
          admission.expectedDischargeAt != null && Number.isFinite(admission.expectedDischargeAt)
            ? Math.floor((admission.expectedDischargeAt - currentNow) / 1440)
            : null,
        blockReason: admission.blockReason,
      }));
  }, [people, unit, currentNow, admissionSource]);

  const resolvedMovement = useMemo(() => {
    if (movement !== undefined) return movement;
    // Filtered by hand, as ward-board does: `admissionsForUnit` drops departed admissions, which
    // would pin `discharged` at zero on the unit-only path.
    if (unit)
      return sinceYesterday(
        admissionSource.filter((admission) => admission.unitId === unit.id),
        currentNow,
      );
    return { discharged: 0, pulled: 0, datesMoved: 0 };
  }, [movement, unit, currentNow, admissionSource]);

  const resolvedDestinations = useMemo(() => {
    if (destinations !== undefined) return destinations;
    if (unit) return arrowTargets(admissionsForUnit(admissionSource, unit.id), currentNow);
    return [];
  }, [destinations, unit, currentNow, admissionSource]);

  // Unit-only path (ward-screen): count incoming and outgoing from the same live collections
  // ward-board passes in, so the sheet does not print zeros against a ward that has arrivals or
  // releases. Outgoing uses the board's default basis (confirmed) and its label, so the two sheets
  // agree. Explicit props still win, and an isolated render with no provider keeps zero.
  const liveIncoming = useMemo(() => {
    if (!unit || liveAdmissions === undefined) return null;
    const arriving = admissionsForUnit(liveAdmissions, unit.id);
    return {
      pulled: arriving.filter((admission) => admission.state === "pulled").length,
      waitlisted: arriving.filter((admission) => admission.state === "waitlisted").length,
    };
  }, [unit, liveAdmissions]);
  const liveOutgoingCount = useMemo(() => {
    if (!unit || liveBedReleases === undefined) return null;
    return liveBedReleases.filter(
      (release) =>
        release.unitId === unit.id &&
        release.state === "confirmed" &&
        releaseBand(release, currentNow) !== "beyond-today",
    ).length;
  }, [unit, liveBedReleases, currentNow]);

  const resolvedIncomingPulled = incomingPulled ?? liveIncoming?.pulled ?? 0;
  const resolvedIncomingWaitlisted = incomingWaitlisted ?? liveIncoming?.waitlisted ?? 0;
  const resolvedOutgoingCount = outgoingCount ?? liveOutgoingCount ?? 0;
  const resolvedOutgoingBasis =
    outgoingBasisLabel ?? (liveOutgoingCount !== null ? CAPACITY_FIGURE_LABELS.confirmedToday : "Expected");

  const groups = dailySheetGroups(resolvedPeople);
  const incomingTotal = resolvedIncomingPulled + resolvedIncomingWaitlisted;

  const resolvedTimestamp = shiftTimestamp ?? (now !== undefined && asAtStamp(now).time ? asAtStamp(now).time : null);

  return (
    <section
      id="ward-daily-sheet"
      className={`${styles.sheet} ${isEmbedded ? styles.embedded : styles.standalone}`}
      aria-labelledby="ward-daily-sheet-heading"
      data-testid="ward-daily-sheet"
      style={TNUM}
    >
      <h2 id="ward-daily-sheet-heading" className={isEmbedded ? styles.visuallyHidden : styles.heading}>
        Shift brief
      </h2>
      {isEmbedded ? null : (
        <p className={styles.intro}>Live at the moment stamped above. Nothing here is held from an earlier hour.</p>
      )}

      {resolvedTimestamp && !isEmbedded ? (
        <p className={styles.stamp} data-testid="ward-daily-sheet-shift-timestamp" style={TNUM}>
          Shift timestamp: <span style={TNUM}>{resolvedTimestamp}</span>
        </p>
      ) : null}

      {/* FIGURE TILES. Every value is a prop or the count of a row list the board already built;
        nothing here is arithmetic. The three since-yesterday tiles keep their test id on a wrapper
        that takes no box, so the line still reads "3 left this ward" end to end. */}
      <div className={styles.tiles}>
        <FigureTile value={resolvedOutgoingCount} label={outgoingTileLabel(resolvedOutgoingBasis)} />
        <FigureTile value={resolvedIncomingPulled} label="pulled" />
        <FigureTile value={resolvedIncomingWaitlisted} label="waiting, no bed" />
        <div className={styles.tileGroup} data-testid="ward-daily-sheet-since" style={TNUM}>
          <FigureTile value={resolvedMovement.discharged} label="left this ward" />
          <FigureTile
            value={resolvedMovement.pulled}
            label={`bed${resolvedMovement.pulled === 1 ? "" : "s"} given away`}
          />
          <FigureTile
            value={resolvedMovement.datesMoved}
            label={`expected date${resolvedMovement.datesMoved === 1 ? "" : "s"} moved`}
          />
        </div>
      </div>

      <div className={styles.groups}>
        {/* WHO CAME IN. The two states are kept apart on the sheet exactly as they are on the board:
          a pulled bed is already gone from this ward's count while a waitlisted person holds
          nothing, and one undifferentiated "incoming" number would let a meeting plan against a bed
          that is already spoken for. */}
        <Card className={styles.group} aria-labelledby="ward-daily-sheet-in-heading" data-testid="ward-daily-sheet-in">
          <CardHead
            level={3}
            eyebrow
            id="ward-daily-sheet-in-heading"
            title="Who came in"
            meta={<CountBubble n={incomingTotal} />}
            className={styles.groupHead}
          />
          <div data-testid="ward-daily-sheet-in-count" style={TNUM}>
            {incomingTotal === 0 ? (
              <p className={styles.empty}>Nobody is recorded as coming in to this ward.</p>
            ) : (
              <ul className={styles.rows}>
                <li className={styles.row}>
                  <span className={styles.rowGlyph}>
                    <StatusGlyph tone="info" />
                  </span>
                  <p className={styles.rowLead}>
                    <span className={styles.rowLeadText}>Bed already given away</span>{" "}
                    <span className={styles.rowValue} style={TNUM}>
                      {resolvedIncomingPulled}
                    </span>
                  </p>
                </li>
                <li className={styles.row}>
                  <span className={styles.rowGlyph}>
                    <StatusGlyph tone="neutral" />
                  </span>
                  <p className={styles.rowLead}>
                    <span className={styles.rowLeadText}>Waiting with no bed given</span>{" "}
                    <span className={styles.rowValue} style={TNUM}>
                      {resolvedIncomingWaitlisted}
                    </span>
                  </p>
                </li>
              </ul>
            )}
          </div>
          <p className={styles.note}>
            No arrival time is shown: the record holds when a bed was given away, and nothing about when anybody will
            get here.
          </p>
        </Card>

        {/* WHO IS GOING. Beds first — the figure the ward is judged on — then where the people in
          these beds are expected to head, which is the part a community team is waiting for. */}
        <Card
          className={styles.group}
          aria-labelledby="ward-daily-sheet-out-heading"
          data-testid="ward-daily-sheet-out"
        >
          <CardHead
            level={3}
            eyebrow
            id="ward-daily-sheet-out-heading"
            title="Who is going"
            meta={<CountBubble n={resolvedOutgoingCount} />}
            className={styles.groupHead}
          />
          <ul className={styles.rows}>
            {/* The basis is named in WORDS, from the same label the board's toggle prints, because a
              sheet has no toggle on it and "4 beds" without "confirmed" or "expected" is two
              different claims sharing a number. */}
            <li className={styles.row}>
              <span className={styles.rowGlyph}>
                <StatusGlyph tone="success" />
              </span>
              <p className={styles.rowLead} data-testid="ward-daily-sheet-out-count" style={TNUM}>
                <span className={styles.rowLeadText}>
                  {resolvedOutgoingBasis}: <span style={TNUM}>{resolvedOutgoingCount}</span> bed
                  {resolvedOutgoingCount === 1 ? "" : "s"} expected to free today.
                </span>
              </p>
            </li>
          </ul>
          {resolvedDestinations.length === 0 ? (
            <p className={styles.empty}>Nobody in these beds has an expected date inside the board&apos;s window.</p>
          ) : (
            <ul className={styles.rows} data-testid="ward-daily-sheet-destinations">
              {resolvedDestinations.map((target) => (
                <li
                  key={target.region}
                  className={styles.row}
                  data-testid={`ward-daily-sheet-destination-${target.region}`}
                  style={TNUM}
                >
                  <span className={styles.rowGlyph}>
                    <StatusGlyph tone="neutral" />
                  </span>
                  <span className={styles.rowText}>
                    <span className={`${styles.rowLead} ${styles.rowLeadText}`}>
                      {target.region}
                      <span className={styles.visuallyHidden}>: </span>
                    </span>
                    <span className={styles.rowLine} style={{ display: "block" }}>
                      <span style={TNUM}>{target.count}</span> {target.count === 1 ? "person" : "people"}, soonest{" "}
                      {target.nearestDays === 0 ? (
                        "due now or overdue"
                      ) : (
                        <>
                          in <span style={TNUM}>{target.nearestDays}</span> day
                          {target.nearestDays === 1 ? "" : "s"}
                        </>
                      )}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className={styles.note}>
            Beds are not people: a bed release records nothing about who is leaving. The destinations above are where
            the people currently in these beds are expected to head.
          </p>
        </Card>

        <SheetGroup
          heading="Who is stuck"
          headingId="ward-daily-sheet-stuck-heading"
          testId="ward-daily-sheet-stuck"
          emptyText="Nobody on this ward is recorded as held up."
          people={groups.heldUp}
          tone="danger"
          note="Held-up reasons are about the BED, from a fixed list. An absent reason is silence, never a finding that nothing is outstanding."
        />

        <SheetGroup
          heading="Who is overdue"
          headingId="ward-daily-sheet-overdue-heading"
          testId="ward-daily-sheet-overdue"
          emptyText="Nobody on this ward is past the ward's own expected date."
          people={groups.overdue}
          tone="warning"
          note="The expected date is the ward's own revisable plan. It carries no legal or contractual weight, and being past it is not a failure of anything."
        />

        <SheetGroup
          heading="Nobody has said when they are going"
          headingId="ward-daily-sheet-no-date-heading"
          testId="ward-daily-sheet-no-date"
          emptyText="Everybody in a bed on this ward has an expected date."
          people={groups.noDate}
          tone="neutral"
          note="An absent date means nobody has set one. It never reads as a plan to stay, and the system never guesses one."
        />

        {/*
         * OFF THE WARD — A LINE, NOT A GROUP. Owner, 2026-08-30: "Remove the away column."
         *
         * **The column goes and the FACT stays, and that is not over-caution.** Of the two people
         * seeded away, one has an ordinary discharge date and no blocker, so they appear in NONE of
         * the groups above. Deleting the line removes them from the printed sheet entirely — and a
         * patient silently absent from the sheet that is read aloud at handover is the one failure
         * nobody in the room can see.
         *
         * It flows last in the card columns as one short card, a sibling AFTER every group and never
         * nested inside one (tests/ward-daily-sheet-placement.dom.test.tsx). It carries no heading of
         * its own, so D19's five-heading reading order is untouched. Says the bed is still theirs, as
         * every other rendering of this fact does.
         */}
        <p className={styles.awayCard} data-testid="ward-daily-sheet-away">
          <strong>Off the ward:</strong>{" "}
          {groups.awayFromWard.length === 0
            ? "none."
            : `${groups.awayFromWard
                .map((person) => personFacts(person))
                .join("; ")} — at an emergency department. The bed stays theirs.`}
        </p>
      </div>

      {/* The honest limit of the sheet, on the sheet. D10's editable half — the ward's one-minute
        update — is not here, and its absence must not read as "there is nothing to update". */}
      <p className={styles.footnote} data-testid="ward-daily-sheet-limits">
        This sheet is read-only. Updating a discharge date, or confirming that nothing has changed, is not done from
        here.
      </p>

      {onPrint ? (
        <div className={styles.printRow}>
          <button
            type="button"
            onClick={onPrint}
            data-testid="ward-daily-sheet-print"
            className={buttonClass({ variant: "sec", size: "sm" })}
          >
            Print daily sheet
          </button>
        </div>
      ) : null}

      <style>{`
        [data-testid="ward-daily-sheet"] button,
        [data-testid="ward-daily-sheet"] [role="button"],
        [data-testid="ward-daily-sheet"] a {
          min-height: var(--ward-tap, 48px);
          min-width: var(--ward-tap, 48px);
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        @media print {
          [data-testid="ward-daily-sheet"],
          [data-testid="ward-daily-sheet"] * {
            color-scheme: light !important;
            background-color: transparent !important;
            color: CanvasText !important;
            border-color: CanvasText !important;
            box-shadow: none !important;
            text-shadow: none !important;
          }
          [data-testid="ward-daily-sheet"] {
            background-color: Canvas !important;
            color: CanvasText !important;
          }
        }
      `}</style>
    </section>
  );
}

export type WardDailySheetDialogProps = WardDailySheetProps & {
  onClose: () => void;
};

const subscribeNever = () => () => {};
const clipboardAvailable = () =>
  typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * THE SHIFT BRIEF AS A DIALOG — the ward page's "Shift brief" button.
 *
 * A centred glass dialog over a scrim on desktop and a full-screen solid sheet on a phone. It adds
 * the chrome the sheet itself must never carry (Copy, Print, Close — the sheet holds no control, see
 * `WardDailySheet`) and nothing else: every figure is still the sheet's, from the same props.
 *
 * Rendered in-tree, never through a portal: portalled content leaves the shell's print reset
 * (tests/ward-shell-print-ancestor.test.ts), and this dialog's job includes being printed.
 *
 * - Escape and the scrim close it; Tab stays inside it; focus returns to the opener on close.
 * - Copy writes the brief's own rendered text to the clipboard. It is offered only where the
 *   clipboard API exists, and only on desktop (CSS hides it on a phone).
 * - Print is `window.print()`, the ward page's existing behaviour.
 * - The stamp reads the SAME instant the figures read (DB-12) and prints no calendar date
 *   (see `asAtStamp`): "day N of this demonstration", never a weekday or a month.
 */
export function WardDailySheetDialog({ onClose, ...sheetProps }: WardDailySheetDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const scrimPressRef = useRef(false);
  // Read on the client only; the server snapshot says no clipboard, so nothing is offered blind.
  const canCopy = useSyncExternalStore(subscribeNever, clipboardAvailable, () => false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const wardName = sheetProps.unit?.name ?? null;
  const title = wardName === null ? "Shift brief" : `${wardName} shift brief`;
  const stamp = sheetProps.now !== undefined ? asAtStamp(sheetProps.now) : null;
  const stampLine =
    stamp === null || stamp.time === null
      ? null
      : [`As at ${stamp.time}`, stamp.dayNote, sheetProps.shiftTimestamp ?? null].filter(Boolean).join(" · ");

  // Focus moves into the dialog on open and returns to whatever opened it on close.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();
    return () => {
      if (opener && opener.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || panelRef.current === null) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      );
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!panelRef.current.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && (active === first || active === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (copyState === "idle") return;
    const timer = window.setTimeout(() => setCopyState("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  function copyBrief() {
    const sheet = panelRef.current?.querySelector<HTMLElement>('[data-testid="ward-daily-sheet"]');
    if (!sheet || typeof navigator.clipboard?.writeText !== "function") {
      setCopyState("failed");
      return;
    }
    const text = [title, stampLine, sheet.innerText.trim()].filter(Boolean).join("\n\n");
    navigator.clipboard.writeText(text).then(
      () => setCopyState("copied"),
      () => setCopyState("failed"),
    );
  }

  return (
    // The scrim is the centring frame; only a click that starts AND ends on the scrim itself closes,
    // so a text selection dragged out of the brief does not dismiss it.
    <div
      className={styles.scrim}
      data-testid="ward-daily-sheet-scrim"
      onPointerDown={(event) => {
        scrimPressRef.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && scrimPressRef.current) onClose();
        scrimPressRef.current = false;
      }}
    >
      <div
        ref={panelRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ward-daily-sheet-dialog-title"
        tabIndex={-1}
        data-testid="ward-daily-sheet-modal"
      >
        <div className={styles.dialogHead}>
          <Icon icon={FileText} size={20} className={styles.dialogIcon} />
          <div className={styles.dialogTitleWrap}>
            <h2 id="ward-daily-sheet-dialog-title" className={styles.dialogTitle}>
              {title}
            </h2>
            {stampLine ? (
              <span className={styles.dialogStamp} data-testid="ward-daily-sheet-dialog-stamp" style={TNUM}>
                {stampLine}
              </span>
            ) : null}
          </div>
          <div className={styles.dialogActions}>
            {canCopy ? (
              <button
                type="button"
                className={buttonClass({ variant: "ghost", size: "sm", className: styles.copyButton })}
                onClick={copyBrief}
                data-testid="ward-daily-sheet-copy"
              >
                <Icon icon={Copy} size={14} />
                <span aria-live="polite">
                  {copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy"}
                </span>
              </button>
            ) : null}
            <button
              type="button"
              className={buttonClass({ variant: "sec", size: "sm" })}
              onClick={() => (sheetProps.onPrint ? sheetProps.onPrint() : window.print())}
              aria-label="Print shift brief"
              data-testid="ward-daily-sheet-print"
            >
              <Icon icon={Printer} size={14} />
              <span>Print</span>
            </button>
            <button
              type="button"
              className={buttonClass({ variant: "ghost", size: "sm", iconOnly: true })}
              onClick={onClose}
              aria-label="Close shift brief"
              data-testid="ward-daily-sheet-close"
            >
              <Icon icon={X} size={16} />
            </button>
          </div>
        </div>
        <div className={styles.dialogBody}>
          <WardDailySheet {...sheetProps} onPrint={undefined} embedded />
        </div>
      </div>
    </div>
  );
}
