"use client";

// Redesign (approved 31 Oct 2026): the record's cards and chips on the kit's radii.

// PersonEntry: one person's discharge plan, shared by the bed board's record drawer and its printed
// sheet. Split out of ward-board.tsx to keep that file under the line cap.
import { StatusGlyph } from "@/components/wf";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import type { ResolvedPatientInfo } from "@/components/ward-management/ward-patient-resolver";
import { patientAgeYears } from "@/components/ward-management/ward-patients";
import { calendarDateOf } from "@/components/ward-management/ward-clock";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import styles from "./board.module.css";
import redesign from "./ward-board-panels.module.css";
import { expectedPhrase, movesPhrase, type Occupant } from "./ward-board-model";

/** True when the long-stay tag already names the recorded blocker, so the plan does not repeat it. */
function blockerInBarrierTag(occupant: Occupant): boolean {
  return (
    occupant.days !== null &&
    occupant.days >= CLINICAL_VALUES.longStayPrompt.value &&
    !occupant.dischargeBarrier &&
    occupant.blockReason !== null
  );
}

/** The long-stay tag. A recorded blocker answers it, so it never says "unrecorded" beside one (UX audit, 21 Oct 2026). */
function barrierText(occupant: Occupant): string {
  if (occupant.dischargeBarrier) return `Held up by: ${occupant.dischargeBarrier}`;
  if (occupant.blockReason !== null) return `Held up: ${occupant.blockReason}`;
  return "Hold-up not recorded (stay ≥ 7d)";
}

/**
 * One person's discharge plan, rendered identically wherever it appears.
 *
 * **One renderer, two places, on purpose.** The slide-out shows the selected person and the
 * printed sheet shows all of them; two copies of this markup would drift the first time either
 * changed, and the two readings of the same record would then disagree on paper and on screen.
 * `idPrefix` is the only difference between them, and it exists so the printed list keeps the
 * `ward-board-person-*` test ids the existing suite already pins while the slide-out's copy sits
 * under a distinct prefix and cannot be double-counted by a query for either.
 */
export function PersonEntry({
  occupant,
  idPrefix,
  resolvedPatient,
  displayDate,
}: {
  occupant: Occupant;
  idPrefix: string;
  resolvedPatient?: ResolvedPatientInfo;
  displayDate?: Date;
}) {
  // With no date passed, the age is read on the board clock's day, not the device's (audit 24-6 TC-07).
  const clock = useOptionalWardFlowSelect("now", "dayZero");
  if (idPrefix === "ward-board-person") {
    return (
      <>
        <p className={styles.personStay}>
          {occupant.days === null ? (
            <span className={styles.personNoStay}>No stay yet — not arrived</span>
          ) : (
            <>
              <span className={styles.personDays} data-testid={`${idPrefix}-${occupant.key}-days`}>
                {occupant.days} day{occupant.days === 1 ? "" : "s"}
              </span>
              {occupant.bandLabel !== null && <span className={styles.personBand}>{occupant.bandLabel}</span>}
            </>
          )}
          {occupant.pastDate && (
            <span className={styles.pastMark}>
              <StatusGlyph tone="warning" size={10} className={styles.statusGlyph} /> <span>Past date</span>
            </span>
          )}
        </p>
        <p className={styles.personWho}>
          {occupant.sex} · Gender: {occupant.gender ?? "Not recorded"},{" "}
          {occupant.homeRegion === null ? "home region not recorded" : `from ${occupant.homeRegion}`}
        </p>
        {occupant.stepDownCandidate && (
          <p className={styles.personFlagLine}>
            <span className={styles.stepDownTag} data-testid={`${idPrefix}-${occupant.key}-stepdown`}>
              Flagged for step-down
            </span>
          </p>
        )}
        {occupant.days !== null && occupant.days >= CLINICAL_VALUES.longStayPrompt.value && (
          <p className={styles.personFlagLine}>
            <span
              className={
                occupant.dischargeBarrier || occupant.blockReason ? styles.barrierTag : styles.barrierTagWarning
              }
              data-testid={`${idPrefix}-${occupant.key}-barrier`}
            >
              {barrierText(occupant)}
            </span>
          </p>
        )}
        {occupant.awayAtEdHours !== null && (
          <p className={styles.personAway} data-testid="ward-board-person-away">
            {occupant.awayAtEdHours === 0
              ? "At an emergency department; bed still theirs."
              : `At an emergency department for ${occupant.awayAtEdHours} ${occupant.awayAtEdHours === 1 ? "hour" : "hours"}; bed still theirs.`}
          </p>
        )}
        <p className={styles.personLine}>
          {occupant.tentativeDiagnosis !== null
            ? `Tentative diagnosis: ${occupant.tentativeDiagnosis}.`
            : "Tentative diagnosis: none recorded."}
        </p>
        {occupant.wardDiagnosis !== null && (
          <p className={styles.personLine} data-testid={`${idPrefix}-${occupant.key}-ward-diagnosis`}>
            {`Ward's tentative diagnosis: ${occupant.wardDiagnosis.phrase}, recorded by ${occupant.wardDiagnosis.recordedBy} at ${occupant.wardDiagnosis.recordedAt}. The one above is kept.`}
          </p>
        )}
        <p className={styles.personExpected}>{expectedPhrase(occupant.expectedDays)}</p>
        {occupant.expectedDays !== null && (
          <p className={styles.personLine}>
            {occupant.dischargeDateSetBy !== null ? `Date set by ${occupant.dischargeDateSetBy}` : "Date set"}, and{" "}
            {movesPhrase(occupant.dischargeDateMoves)}.{" "}
            {occupant.confirmed
              ? occupant.dischargeConfirmedBy !== null
                ? `Confirmed by ${occupant.dischargeConfirmedBy}.`
                : "Confirmed."
              : "Not confirmed."}
          </p>
        )}
        {occupant.blockReason !== null && !blockerInBarrierTag(occupant) && (
          <p className={styles.personBlocker}>Held up by: {occupant.blockReason}.</p>
        )}
      </>
    );
  }

  // Detail panel view (idPrefix === "ward-board-selected-person"). Drawer review (6 Nov 2026): the
  // drawer's head already names the person, carries the UMRN and the stay, and shows a passed date
  // as its status pill, so none of those repeat here. The record reads as flat hairline sections,
  // not cards inside the drawer's card.
  const patient = resolvedPatient?.patient;
  const age = patient
    ? patientAgeYears(patient, displayDate ?? (clock ? calendarDateOf(clock.now, clock.dayZero) : new Date()))
    : null;

  return (
    <>
      <div className={redesign.recordFacts}>
        <div className={styles.detailChips}>
          {age !== null && <span className={`${styles.detailChip} ${redesign.chip}`}>{age} yrs</span>}
          {/* B11 (Josh, 5 Nov 2026): named, so it reads apart from the Gender chip beside it. */}
          <span className={`${styles.detailChip} ${redesign.chip}`}>Sex: {occupant.sex}</span>
          <span className={`${styles.detailChip} ${redesign.chip}`}>Gender: {occupant.gender ?? "Not recorded"}</span>
          {occupant.bandLabel !== null && (
            <span className={`${styles.detailChip} ${redesign.chip}`}>{occupant.bandLabel}</span>
          )}
        </div>

        {occupant.stepDownCandidate && (
          <div className={styles.personFlagBlock}>
            <span className={styles.stepDownTag} data-testid={`${idPrefix}-${occupant.key}-stepdown`}>
              Flagged for step-down
            </span>
          </div>
        )}
        {occupant.days !== null && occupant.days >= CLINICAL_VALUES.longStayPrompt.value && (
          <div className={styles.personFlagBlock}>
            <span
              className={
                occupant.dischargeBarrier || occupant.blockReason ? styles.barrierTag : styles.barrierTagWarning
              }
              data-testid={`${idPrefix}-${occupant.key}-barrier`}
            >
              {barrierText(occupant)}
            </span>
          </div>
        )}
      </div>

      <section className={redesign.recordSection}>
        <h3 className={redesign.recordHeading}>What is happening today</h3>
        <p className={styles.personExpected}>{expectedPhrase(occupant.expectedDays)}</p>
        {occupant.expectedDays !== null && (
          <p className={styles.personLine}>
            {occupant.dischargeDateSetBy !== null ? `Date set by ${occupant.dischargeDateSetBy}` : "Date set"}
            {/* A moved date is said once, by the line below, not twice. */}
            {occupant.dischargeDateMoves > 0 ? "" : `, and ${movesPhrase(occupant.dischargeDateMoves)}`}.{" "}
            {occupant.confirmed
              ? occupant.dischargeConfirmedBy !== null
                ? `Confirmed by ${occupant.dischargeConfirmedBy}.`
                : "Confirmed."
              : "Not confirmed."}
          </p>
        )}
        {occupant.dischargeDateMoves > 0 && (
          // A plain line, not a tinted banner (D-94).
          <p className={styles.personLine}>
            This discharge date has moved {occupant.dischargeDateMoves}{" "}
            {occupant.dischargeDateMoves === 1 ? "time" : "times"}.
          </p>
        )}
        {occupant.blockReason !== null && !blockerInBarrierTag(occupant) && (
          <p className={styles.personBlocker}>Held up by: {occupant.blockReason}.</p>
        )}
      </section>

      <section className={redesign.recordSection}>
        <h3 className={redesign.recordHeading}>Catchment and team</h3>
        <div className={styles.catchmentGrid}>
          <div className={styles.catchmentItem}>
            <span className={styles.catchmentLabel}>Home region</span>
            <span className={styles.catchmentValue}>{occupant.homeRegion ?? "Not recorded"}</span>
          </div>
          <div className={styles.catchmentItem}>
            <span className={styles.catchmentLabel}>Suburb</span>
            <span className={styles.catchmentValue}>{patient?.suburb ?? "Not recorded"}</span>
          </div>
          <div className={styles.catchmentItem}>
            <span className={styles.catchmentLabel}>Community team</span>
            <span className={styles.catchmentValue}>{patient?.catchmentCommunityTeam ?? "Not recorded"}</span>
          </div>
          <div className={styles.catchmentItem}>
            <span className={styles.catchmentLabel}>Legal status</span>
            <span className={styles.catchmentValue}>{patient?.legalStatus ?? "Not recorded"}</span>
          </div>
        </div>
      </section>

      <section className={redesign.recordSection}>
        <h3 className={redesign.recordHeading}>Clinical</h3>
        {occupant.awayAtEdHours !== null && (
          <p className={styles.personAway} data-testid="ward-board-person-away">
            {occupant.awayAtEdHours === 0
              ? "At an emergency department; bed still theirs."
              : `At an emergency department for ${occupant.awayAtEdHours} ${occupant.awayAtEdHours === 1 ? "hour" : "hours"}; bed still theirs.`}
          </p>
        )}
        <p className={styles.personLine}>
          {occupant.tentativeDiagnosis !== null
            ? `Tentative diagnosis: ${occupant.tentativeDiagnosis}.`
            : "Tentative diagnosis: none recorded."}
        </p>
        {occupant.wardDiagnosis !== null && (
          <p className={styles.personLine} data-testid={`${idPrefix}-${occupant.key}-ward-diagnosis`}>
            {`Ward's tentative diagnosis: ${occupant.wardDiagnosis.phrase}, recorded by ${occupant.wardDiagnosis.recordedBy} at ${occupant.wardDiagnosis.recordedAt}. The one above is kept.`}
          </p>
        )}
      </section>
    </>
  );
}
