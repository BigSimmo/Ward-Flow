"use client";

// PersonEntry: one person's discharge plan, shared by the bed board's slide-out and its printed
// sheet. Split out of ward-board.tsx to keep that file under the line cap.
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { resolveSubjectPatient, type ResolvedPatientInfo } from "@/components/ward-management/ward-patient-resolver";
import { patientAgeYears } from "@/components/ward-management/ward-patients";
import { calendarDateOf } from "@/components/ward-management/ward-clock";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import styles from "./board.module.css";
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
  if (occupant.dischargeBarrier) return `Discharge barrier: ${occupant.dischargeBarrier}`;
  if (occupant.blockReason !== null) return `Held up: ${occupant.blockReason}`;
  return "Discharge barrier unrecorded (Stay ≥ 7d)";
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
              <span aria-hidden="true" className={styles.statusGlyph}>
                ▲{" "}
              </span>
              <span>Past date</span>
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
              ? "At an emergency department — the bed is still theirs."
              : `At an emergency department for ${occupant.awayAtEdHours} ${occupant.awayAtEdHours === 1 ? "hour" : "hours"} — the bed is still theirs.`}
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
            {occupant.dischargeDateSetBy !== null
              ? `Date set by ${occupant.dischargeDateSetBy}`
              : "Date set — the role that set it is not recorded"}
            , and {movesPhrase(occupant.dischargeDateMoves)}.{" "}
            {occupant.confirmed
              ? occupant.dischargeConfirmedBy !== null
                ? `Confirmed by ${occupant.dischargeConfirmedBy} — a decision, not a plan.`
                : "Confirmed — a decision, not a plan; the role that confirmed it is not recorded."
              : "Not confirmed — the ward's plan, not yet its decision."}
          </p>
        )}
        {occupant.blockReason !== null && !blockerInBarrierTag(occupant) && (
          <p className={styles.personBlocker}>Held up by: {occupant.blockReason}.</p>
        )}
      </>
    );
  }

  // Detail panel view (idPrefix === "ward-board-selected-person")
  const patient = resolvedPatient?.patient;
  const age = patient
    ? patientAgeYears(patient, displayDate ?? (clock ? calendarDateOf(clock.now, clock.dayZero) : new Date()))
    : null;
  const displayName = resolvedPatient?.formalName || resolveSubjectPatient({ id: occupant.key }, {}).formalName;

  return (
    <>
      {/* 1. Identity & Stay Card */}
      <div className={styles.detailIdCard}>
        <div className={styles.detailStayRow}>
          <p className={`${styles.personStay} ${styles.flushMargin}`}>
            {occupant.days === null ? (
              <span className={styles.personNoStay}>No stay yet — not arrived</span>
            ) : (
              <>
                <span className={styles.personDays} data-testid={`${idPrefix}-${occupant.key}-days`}>
                  {occupant.days} day{occupant.days === 1 ? "" : "s"}
                </span>
                <span className={styles.daysUnit}>here</span>
                {occupant.bandLabel !== null && <span className={styles.personBand}>{occupant.bandLabel}</span>}
              </>
            )}
            {occupant.pastDate && (
              <span className={styles.pastMark}>
                <span aria-hidden="true" className={styles.statusGlyph}>
                  ▲{" "}
                </span>
                <span>Past date</span>
              </span>
            )}
          </p>
        </div>

        <div className={styles.detailName}>{displayName}</div>

        <div className={styles.detailChips}>
          {age !== null && <span className={styles.detailChip}>{age} yrs</span>}
          <span className={styles.detailChip}>{occupant.sex}</span>
          <span className={styles.detailChip}>Gender: {occupant.gender ?? "Not recorded"}</span>
          <span className={styles.detailChip}>{occupant.homeRegion ?? "Region unrecorded"}</span>
          {resolvedPatient?.umrn && <span className={styles.detailChip}>UMRN {resolvedPatient.umrn}</span>}
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

      {/* 2. Catchment & Demographic Card */}
      <div className={styles.detailSectionCard}>
        <div className={styles.detailSectionHeading}>Catchment & Team</div>
        <div className={styles.catchmentGrid}>
          <div className={styles.catchmentItem}>
            <span className={styles.catchmentLabel}>Home Region</span>
            <span className={styles.catchmentValue}>{occupant.homeRegion ?? "Not recorded"}</span>
          </div>
          <div className={styles.catchmentItem}>
            <span className={styles.catchmentLabel}>Suburb</span>
            <span className={styles.catchmentValue}>{patient?.suburb ?? "Not recorded"}</span>
          </div>
          <div className={styles.catchmentItem}>
            <span className={styles.catchmentLabel}>Community Team</span>
            <span className={styles.catchmentValue}>{patient?.catchmentCommunityTeam ?? "Not recorded"}</span>
          </div>
          <div className={styles.catchmentItem}>
            <span className={styles.catchmentLabel}>Legal Status</span>
            <span className={styles.catchmentValue}>{patient?.legalStatus ?? "Not recorded"}</span>
          </div>
        </div>
      </div>

      {/* 3. Clinical & Transport Card */}
      <div className={styles.detailSectionCard}>
        <div className={styles.detailSectionHeading}>Clinical & Transport</div>
        {occupant.awayAtEdHours !== null && (
          <p className={styles.personAway} data-testid="ward-board-person-away">
            {occupant.awayAtEdHours === 0
              ? "At an emergency department — the bed is still theirs."
              : `At an emergency department for ${occupant.awayAtEdHours} ${occupant.awayAtEdHours === 1 ? "hour" : "hours"} — the bed is still theirs.`}
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
      </div>

      {/* 4. What is Happening Today / Leaving Plan Card */}
      <div className={styles.detailSectionCard}>
        <div className={styles.detailSectionHeading}>What is happening today</div>
        <p className={styles.personExpected}>{expectedPhrase(occupant.expectedDays)}</p>
        {occupant.expectedDays !== null && (
          <p className={styles.personLine}>
            {occupant.dischargeDateSetBy !== null
              ? `Date set by ${occupant.dischargeDateSetBy}`
              : "Date set — the role that set it is not recorded"}
            {/* A moved date is said once, by the flag below, not twice. */}
            {occupant.dischargeDateMoves > 0 ? "" : `, and ${movesPhrase(occupant.dischargeDateMoves)}`}.{" "}
            {occupant.confirmed
              ? occupant.dischargeConfirmedBy !== null
                ? `Confirmed by ${occupant.dischargeConfirmedBy} — a decision, not a plan.`
                : "Confirmed — a decision, not a plan; the role that confirmed it is not recorded."
              : "Not confirmed — the ward's plan, not yet its decision."}
          </p>
        )}
        {occupant.dischargeDateMoves > 0 && (
          <div className={styles.dateMovedAlert}>
            This discharge date has moved {occupant.dischargeDateMoves}{" "}
            {occupant.dischargeDateMoves === 1 ? "time" : "times"}.
          </div>
        )}
        {occupant.blockReason !== null && !blockerInBarrierTag(occupant) && (
          <p className={styles.personBlocker}>Held up by: {occupant.blockReason}.</p>
        )}
      </div>
    </>
  );
}
