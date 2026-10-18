"use client";

// The network view's queue column (waiting movements and the referral queue) and the referral
// placement summary with its clocks. Moved out of `ward-management-network.tsx` for the line cap.
import { ListChecks } from "lucide-react";
import { elapsedLabel, movementHealthService, stageCopy } from "@/components/ward-management/ward-derivations";
import { formatElapsed, type Instant } from "@/components/ward-management/ward-clock";
import type { Movement, MovementStage, Referral } from "@/components/ward-management/ward-model";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { referralClocks, REFERRAL_CLOCK_TERMS, referralPersonFacts } from "@/components/ward-management/ward-referrals";
import { patientIdentityLine, resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import styles from "./ward-management-network.module.css";
import type { Dispatch, SetStateAction } from "react";

/**
 * Task 7 (spec D8-5). What the aside says while a referral is the diagram's subject: who is being
 * placed, and where the answers are.
 *
 * It deliberately carries NO tally and NO banner. "N of M units accept this referral right now"
 * and "no unit of this age band exists in this network" are the coordinator's match view's own
 * sentences, and the second must always be met before the first — repeating either here would be
 * a second surface answering one question, in wording that could drift from the original. The
 * verdicts themselves are on the unit nodes, where the beds are, from the one function the match
 * view uses.
 *
 * The referral's five facts and its wait, and nothing else: no band (that is step two), no
 * kilometre, no free text, no comparative word about any bed.
 */
/**
 * THE TWO CLOCKS A REFERRAL CARRIES, worded so a stopped one cannot read as a running one.
 *
 * This replaces `referralWaitLabel`, which was `formatElapsed(minutesUntil(now, raisedAt))` — a
 * clock with no stop condition. It counted from the referral forever, including long after the
 * person was triaged and sitting in a department.
 *
 * ⚠️ MEASURED ON THE SEED, AND THE MEASUREMENT CORRECTED MY OWN CLAIM. Four hours into the
 * demonstration `RF-003` reads "4h 55m waiting" against a true referral wait of 25 MINUTES — nearly
 * twelvefold. I was about to report that as visible here. IT IS NOT: `RF-003` is `accepted`, and
 * `referralQueueOrder` filters to `queued`, so this screen never shows it. Every referral this
 * queue DOES show was triaged before the referral was raised, so the old label was right for all
 * of them.
 *
 * So on this surface the defect is LATENT rather than live — the wrong function was wired in, and
 * the fixture happens to contain no queued referral that exposes it. It becomes visible the moment
 * a queued referral is triaged during a demonstration; `RF-001` is queued and not yet in a
 * department, so triaging it does exactly that.
 *
 * ⚠️ AN INFLATED WAIT IS WHY THIS SURVIVES ANYWHERE: a wrong clock looks wrong, a wrong length of
 * stay looks plausible. The fixture's own longest wait is hours, so a doubled figure reads as a
 * busy night rather than as a bug.
 *
 * Wording comes from `REFERRAL_CLOCK_TERMS`, never from here — the same rule as `urgencyTierLabel`
 * below, because a second spelling of one field is this project's most expensive defect class.
 *
 * ⚠️ NEVER SAY "ARRIVED". The field is `triagedAt`. A patient arrives, waits, and is triaged some
 * time later; on a busy night that gap is not small. "In department" is measured from triage and
 * must never be worded as arrival.
 */
export function referralClockLines(referral: Referral, now: Instant): { department: string; referral: string } {
  const { sinceReferral, sinceReferralRunning, inDepartment } = referralClocks(referral, now);
  return {
    // `undefined` means not in the department yet — NEVER 0. "0m in department" reads as "just
    // got there", the exact opposite of the truth.
    department:
      inDepartment === undefined
        ? REFERRAL_CLOCK_TERMS.notInDepartment
        : `${formatElapsed(inDepartment)} ${REFERRAL_CLOCK_TERMS.inDepartment}`,
    referral: `${formatElapsed(sinceReferral)} ${
      sinceReferralRunning ? REFERRAL_CLOCK_TERMS.sinceReferral : REFERRAL_CLOCK_TERMS.sinceReferralStopped
    }`,
  };
}

export function ReferralPlacementSummary({ referral, who, now }: { referral: Referral; who: string; now: Instant }) {
  return (
    <>
      <header className={styles.panelHeader}>
        <h2>
          <ListChecks aria-hidden="true" /> Referral placement · {who}
        </h2>
      </header>
      <p className={styles.patientLine} data-tier={referral.urgency} data-testid="ward-network-placement-tier">
        {urgencyTierLabel(referral.urgency)}
      </p>
      <p className={styles.patientSubLine} data-testid="ward-network-placement-facts">
        {referralPersonFacts(referral).join(" · ")}
      </p>
      {/* Both clocks, side by side. The owner's decision (P9-D2): the GAP between them is the
          signal — a long time in department with a short time since referral says the delay is
          upstream of mental health, and the reverse says it is ours. One number cannot say either. */}
      <p className={styles.patientSubLine} data-testid="ward-network-placement-clocks">
        {referralClockLines(referral, now).department} &middot; {referralClockLines(referral, now).referral}
      </p>
    </>
  );
}

/** The queue column: the waiting movements, filterable by stage, and the referral queue. */
export function NetworkQueueColumn({
  openMovements,
  stageFilter,
  setStageFilter,
  visibleQueue,
  setSelectedPatientId,
  setSelectedReferralId,
  setSelectedUnitId,
  selectedReferral,
  patient,
  isPhone,
  umrnLookup,
  now,
  referralQueue,
}: {
  openMovements: number;
  stageFilter: MovementStage | null;
  setStageFilter: Dispatch<SetStateAction<MovementStage | null>>;
  visibleQueue: Movement[];
  setSelectedPatientId: Dispatch<SetStateAction<string | null>>;
  setSelectedReferralId: Dispatch<SetStateAction<string | null>>;
  setSelectedUnitId: Dispatch<SetStateAction<string | null>>;
  selectedReferral: Referral | null;
  patient: Movement;
  isPhone: boolean;
  umrnLookup: Parameters<typeof resolveSubjectPatient>[1];
  now: Instant;
  referralQueue: Referral[];
}) {
  return (
    <div className={styles.queueColumn}>
      <section className={styles.queuePanel} aria-label="Waiting">
        <header className={styles.panelHeader}>
          <h2>Waiting</h2>
          {/*
                ⚠️ `openMovements`, NEVER the filtered length. This figure is read as "how much
                demand is there", and a filter that could shrink it would let a coordinator who has
                not noticed the filter take a fraction of the waiting list for the whole of it —
                with the rows beneath it agreeing, so nothing on the screen could contradict it.

                ⚠️ AND THE NAME IS `open-total`, NOT `queue-count`, FOR A REASON THAT COSTS TWO RED
                TESTS TO REDISCOVER. The rows below are `ward-network-queue-<id>`, and the suites
                count them with `getAllByTestId(/^ward-network-queue-/)`. Any testid starting
                `ward-network-queue-` therefore joins that count as a phantom row: the first draft
                of this element was `ward-network-queue-count`, and the row totals silently became
                44 and 16 instead of 43 and 14. Do not name anything in this panel with that prefix
                unless it is a row.
              */}
          <span className={styles.count} data-testid="ward-network-open-total">
            {openMovements}
          </span>
        </header>
        {stageFilter ? (
          <p className={styles.queueFilterNotice} data-testid="ward-network-filter-notice">
            <span>
              Showing {visibleQueue.length} of {openMovements} &mdash; {stageCopy[stageFilter].label}
            </span>
            <button type="button" className={styles.queueFilterClear} onClick={() => setStageFilter(null)}>
              Show the whole queue
            </button>
          </p>
        ) : null}
        <div className={styles.queueList} role="region" aria-label="Waiting list" tabIndex={0}>
          {visibleQueue.map((candidate) => (
            <button
              type="button"
              key={candidate.id}
              onClick={() => {
                setSelectedPatientId(candidate.id);
                setSelectedReferralId(null);
                setSelectedUnitId(null);
              }}
              aria-pressed={selectedReferral === null && candidate.id === patient.id}
              data-testid={`ward-network-queue-${candidate.id}`}
              className={styles.queueRow}
            >
              <span className={styles.queueTop}>
                <strong>
                  {isPhone
                    ? resolveSubjectPatient(candidate, umrnLookup).umrn
                    : patientIdentityLine(resolveSubjectPatient(candidate, umrnLookup))}
                </strong>
                <span className={styles.elapsed}>{elapsedLabel(candidate, now)}</span>
              </span>
              <span className={styles.queueMeta}>
                <span
                  className={styles.tier}
                  data-tier={candidate.urgency}
                  data-label={urgencyTierLabel(candidate.urgency)}
                >
                  {candidate.urgency}
                </span>
                {candidate.cohort} · {candidate.security} ward
              </span>
              <span className={styles.queueMeta}>
                {movementHealthService(candidate) ?? "Origin service not identified"} · {candidate.legalStatus}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/*
       * Task 7. The second subject the diagram can answer for. It sits beside the movement queue
       * rather than replacing it — a coordinator places both, and neither list is a shortlist of
       * the other. Selecting a referral here makes it the diagram's subject; selecting it again
       * hands the diagram back to the movement above, so every control does something.
       */}
      <section className={styles.queuePanel} aria-label="Referral queue">
        <header className={styles.panelHeader}>
          <h2>Referral queue</h2>
          <span className={styles.count}>{referralQueue.length}</span>
        </header>
        <div className={styles.queueList} role="region" aria-label="Referral queue list" tabIndex={0}>
          {referralQueue.map((referral) => (
            <button
              type="button"
              key={referral.id}
              onClick={() => {
                setSelectedReferralId((current) => (current === referral.id ? null : referral.id));
                setSelectedUnitId(null);
              }}
              aria-pressed={selectedReferral?.id === referral.id}
              data-testid={`ward-network-referral-${referral.id}`}
              className={styles.queueRow}
            >
              <span className={styles.queueTop}>
                <strong>
                  {isPhone
                    ? resolveSubjectPatient(referral, umrnLookup).umrn
                    : patientIdentityLine(resolveSubjectPatient(referral, umrnLookup))}
                </strong>
                {/* The referral clock only: a queue row is about how long this has waited for a
                        decision, and the department clock is on the detail panel where there is room
                        for the comparison. It carries its own term, so a stopped clock reads as
                        "referral to triage" rather than as a wait still being served. */}
                <span className={styles.elapsed}>{referralClockLines(referral, now).referral}</span>
              </span>
              {/* `urgencyTierLabel`, never a bare digit: the referral board already spells a
               *  referral's tier this way on every row, and a second spelling of one field is
               *  this project's most expensive defect class. */}
              <span className={styles.queueMeta} data-tier={referral.urgency}>
                {urgencyTierLabel(referral.urgency)}
              </span>
              <span className={styles.queueMeta}>{referralPersonFacts(referral).join(" · ")}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
