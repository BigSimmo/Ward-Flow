"use client";

// The referral board's two queue sections (waiting and recently decided), with the outcome detail
// and due timer they draw. Moved out of `referral-board.tsx` to keep it under the line cap.
import { openInformationNeeds } from "./referral-information-needs";
import { referralFollowUpLine } from "./referral-owner-and-calls-model";
import { useMemo } from "react";
import { Lock, Scale, Truck, Users } from "lucide-react";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";
import { ReferralQueueCards, ReferralQueueTable } from "./referral-queue-layouts";
import { type Movement, type Referral, type Unit } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { createReadmissionIndex, referralReadmissionFlag } from "@/components/ward-management/ward-readmission";
import { ReadmissionFlag } from "@/components/ward-management/ward-readmission-flag";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { usePatientNameDisplay } from "@/components/ward-management/settings/discreet-names";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { siteByCode } from "@/components/ward-management/ward-sites";
import {
  referralPersonFactsStatingSex,
  acceptedAddressing,
  referralDecidedAt,
  referralDestinationLabel,
  referralState,
} from "@/components/ward-management/ward-referrals";
import { Button, CardHead, Count, EmptyState, StatusGlyph, TierTile, Timer, cx } from "@/components/wf";
import { getReferralPriority, referralPriorityLabel } from "./referral-priority";
import { referralWaitLine } from "./referral-wait";
import {
  REFERRAL_SOURCE_WORDS,
  WaitCell,
  askingForShort,
  declineReasonWords,
  isOverdue,
  readyUnitCount,
  wardArm,
} from "./referral-board-parts";
import styles from "./referrals.module.css";
import a from "./referral-board.module.css";
import {
  ALSO_CANCELLED_LEAD,
  ALSO_REFUSED_LEAD,
  GENDER_REVIEW_FLAG,
  QUEUED_REFUSED_LEAD,
  decidedWaitLabel,
  demographicLabel,
  outcomeDetail,
  outcomeLabel,
  referralDueAt,
  referralNeedsGenderReview,
  refusalLines,
} from "./referral-board-model";

/**
 * The detail cell's parts, rendered so a coordinator cannot mistake one for another: the outcome
 * first, at the cell's own weight, then the refusals, then the cancellations, each quieter and led
 * by a word that says what it is. Never joined into one run — "Bunbury adult ward · Emergency
 * department: Belongs to another service" reads as two outcomes, which is the new defect a
 * straight concatenation would have created. The lead word carries the distinction in TEXT, so
 * nothing here depends on the quieter colour being noticed as quieter.
 */
function OutcomeDetail({
  referral,
  units,
  refusalsTestId,
  cancelledTestId,
}: {
  referral: Referral;
  units: Unit[];
  refusalsTestId: string;
  cancelledTestId: string;
}) {
  const detail = outcomeDetail(referral, units);
  return (
    <>
      <span className={styles.outcomeDetailPrimary}>{detail.outcome}</span>
      {detail.alsoRefused.length > 0 ? (
        <span className={styles.outcomeDetailRefusals} data-testid={refusalsTestId}>
          {`${ALSO_REFUSED_LEAD} — ${detail.alsoRefused.join(" · ")}`}
        </span>
      ) : null}
      {detail.alsoCancelled.length > 0 ? (
        <span className={styles.outcomeDetailRefusals} data-testid={cancelledTestId}>
          {`${ALSO_CANCELLED_LEAD} — ${detail.alsoCancelled.join(" · ")}`}
        </span>
      ) : null}
    </>
  );
}

const MS_PER_MINUTE = 60_000;

/** The referral's due time as a countdown, or how far past it is, from the shared Timer. */
function DueTimer({ dueAt, now }: { dueAt: Instant; now: Instant }) {
  const timer = <Timer at={dueAt * MS_PER_MINUTE} now={now * MS_PER_MINUTE} direction="in" hideFlagWord />;
  return dueAt > now ? (
    <span className={styles.v6Due}>due {timer}</span>
  ) : (
    <span className={styles.v6Due}>{timer}</span>
  );
}

export function QueuedSection({
  queued,
  allReferrals = queued,
  now,
  selectedId,
  onSelect,
  units = [],
  movements = [],
  patients = [],
  readmissionIndex,
  isHighlighted = () => false,
  isDimmed = () => false,
  searchMiss = false,
  filterMiss = false,
}: {
  queued: Referral[];
  /** The phone's chip filter, not the search, narrowed the queue to nothing. */
  filterMiss?: boolean;
  /** The search narrowed an open queue to nothing: say so rather than "no referral is queued". */
  searchMiss?: boolean;
  /** Every referral, not just the queue: a prior stay links to its person through its own referral. */
  allReferrals?: Referral[];
  now: Instant;
  selectedId: string | undefined;
  onSelect: (referralId: string) => void;
  units?: Unit[];
  movements?: Movement[];
  patients?: Patient[];
  readmissionIndex: ReturnType<typeof createReadmissionIndex>;
  isHighlighted?: (referral: Referral) => boolean;
  /** v10: a highlight dims the rows it does not match (`data-dim`); every row stays in place. */
  isDimmed?: (referral: Referral) => boolean;
}) {
  const queuedResolverState = useMemo(
    () => ({ patients, referrals: allReferrals, movements }),
    [patients, allReferrals, movements],
  );
  // A2-20: initials plus UMRN on a phone when Discreet names is on.
  const nameFor = usePatientNameDisplay();
  return (
    <section className={styles.v6Section} data-testid="ward-referral-board-queued">
      <h2 className="sr-only">
        Awaiting decision <Count n={queued.length} />
      </h2>
      {queued.length === 0 ? (
        <p className={styles.v6Empty} data-testid="ward-referral-board-queued-empty">
          {searchMiss
            ? filterMiss
              ? "No queued referral matches this chip."
              : "No queued referral matches the search."
            : "None. No referral is currently queued."}
        </p>
      ) : (
        <>
          <ReferralQueueTable>
            <colgroup>
              <col className={a.colTier} />
              <col className={a.colPatient} />
              <col className={a.colWait} />
              <col className={a.colFrom} />
              <col className={a.colAsk} />
              <col className={a.colNeeds} />
              <col className={a.colFit} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Tier</th>
                <th scope="col">Patient</th>
                <th scope="col">Since referral</th>
                <th scope="col">From</th>
                <th scope="col">Asking for</th>
                <th scope="col">Needs</th>
                <th scope="col">Fit</th>
              </tr>
            </thead>
            <tbody>
              {queued.map((referral) => {
                const patientInfo = resolveSubjectPatient(referral, queuedResolverState);
                const refusals = refusalLines(referral);
                const sendingHospital = siteByCode(referral.originSiteCode)?.name ?? referral.originSiteCode;
                const selected = referral.id === selectedId;
                const priority = getReferralPriority(referral, now);
                const ready = readyUnitCount(referral, units, now);
                const ward = wardArm(referral)?.destination;
                const needs = [
                  ward?.secureBedNeeded ? { icon: Lock, label: "Secure bed requested" } : undefined,
                  ward?.involuntaryBedNeeded ? { icon: Scale, label: "Involuntary bed requested" } : undefined,
                  ward?.highAcuityNursingNeeded ? { icon: Users, label: "High acuity nursing requested" } : undefined,
                  referral.transportNeeded ? { icon: Truck, label: "Transport requested" } : undefined,
                ].filter((need): need is { icon: typeof Lock; label: string } => need !== undefined);

                return (
                  <tr
                    key={referral.id}
                    className={cx(a.row, selected && a.rowOn)}
                    data-testid={`ward-referral-board-row-${referral.id}`}
                    data-referral-id={referral.id}
                    data-highlighted={isHighlighted(referral) ? "true" : undefined}
                    data-dim={isDimmed(referral) ? "true" : undefined}
                    data-overdue={isOverdue(referral, now) ? "true" : undefined}
                    onClick={() => onSelect(referral.id)}
                  >
                    <td>
                      <span
                        className={a.tier}
                        data-priority={priority}
                        data-testid={`ward-referral-board-priority-${referral.id}`}
                        title={`${urgencyTierLabel(referral.urgency)} · ${referralPriorityLabel(priority)}`}
                      >
                        <span aria-hidden="true">
                          <TierTile tier={referral.urgency} />
                        </span>
                        <span className="sr-only">
                          {urgencyTierLabel(referral.urgency)}, {referralPriorityLabel(priority)}
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className={a.who}>
                        <button
                          type="button"
                          className={a.rowSelect}
                          data-testid={`ward-referral-board-select-${referral.id}`}
                          aria-pressed={selected}
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelect(referral.id);
                          }}
                        >
                          {nameFor(patientInfo.formalName, patientInfo.umrn)}
                        </button>
                        <span className={a.sub}>
                          <span className={a.mono}>{patientInfo.umrn}</span> · {demographicLabel(referral)}
                        </span>
                      </span>
                      <ReadmissionFlag
                        flag={referralReadmissionFlag(referral, readmissionIndex)}
                        testId={`ward-referral-board-readmission-${referral.id}`}
                      />
                      {referralNeedsGenderReview(referral) ? (
                        <span className={a.rowNote} data-testid={`ward-referral-board-review-${referral.id}`}>
                          <StatusGlyph tone="warning" size={8} /> {GENDER_REVIEW_FLAG}
                        </span>
                      ) : null}
                      {/* Fix plan item 4: who is chasing it and when it was last rung about. */}
                      {referralFollowUpLine(referral, now) ? (
                        <span className={a.rowNote} data-testid={`ward-referral-board-follow-up-${referral.id}`}>
                          {referralFollowUpLine(referral, now)}
                        </span>
                      ) : null}
                    </td>
                    <td data-testid={`ward-referral-board-wait-${referral.id}`}>
                      <span className="sr-only">{referralWaitLine(referral, now)}</span>
                      <span aria-hidden="true">
                        <WaitCell referral={referral} now={now} />
                      </span>
                    </td>
                    <td data-testid={`ward-referral-board-hospital-${referral.id}`}>
                      <span className={a.who}>
                        {/* Audit 11 Oct 2026: the site code, as phone shows, so names and figures are not cut. */}
                        <span
                          className={cx(a.truncate, a.mono)}
                          title={`${sendingHospital}, ${REFERRAL_SOURCE_WORDS[referral.source]}`}
                        >
                          <span aria-hidden="true">{referral.originSiteCode}</span>
                          <span className="sr-only">{sendingHospital}</span>
                        </span>
                        <span className={cx(a.sub, a.fromSource)}>{REFERRAL_SOURCE_WORDS[referral.source]}</span>
                      </span>
                    </td>
                    <td>
                      <span className={a.arms}>
                        {armChips(referral).map(({ words, refused, titles }) => (
                          <span key={words} className={cx(a.arm, refused && a.armNo)} title={titles.join("\n")}>
                            <StatusGlyph tone={refused ? "closed" : "neutral"} size={9} />
                            {words}
                          </span>
                        ))}
                      </span>
                      {refusals.length > 0 ? (
                        <span className="sr-only" data-testid={`ward-referral-board-refusals-${referral.id}`}>
                          {`${QUEUED_REFUSED_LEAD} — ${refusals.join(" · ")}`}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      {needs.length > 0 ? (
                        <span className={a.needs}>
                          {needs.map((need) => (
                            <span key={need.label} title={need.label}>
                              <need.icon size={14} aria-hidden="true" />
                              <span className="sr-only">{need.label}</span>
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className={a.none}>
                          <span className="sr-only">None recorded</span>
                        </span>
                      )}
                    </td>
                    <td>
                      {ready === undefined ? (
                        <span className={a.none} title="No ward bed asked for">
                          <span className="sr-only">No ward bed asked for</span>
                        </span>
                      ) : (
                        <span className={a.fit}>
                          <b>{ready}</b> ready
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </ReferralQueueTable>

          <ReferralQueueCards>
            {queued.map((referral) => {
              const patientInfo = resolveSubjectPatient(referral, queuedResolverState);
              const refusals = refusalLines(referral);
              const accepted = acceptedAddressing(referral);
              const linkedMovement = movements.find((m) => m.referralId === referral.id && !m.closure);
              const unitId = accepted?.acceptedUnitId ?? linkedMovement?.acceptedUnitId;
              const assignedUnit = unitId ? units.find((u) => u.id === unitId) : undefined;
              const selected = referral.id === selectedId;
              const dueAt = referralDueAt(referral, now);
              const cardWait = referralWaitLine(referral, now);
              const cardWard = wardArm(referral)?.destination;
              const cardNeeds = [
                cardWard?.secureBedNeeded,
                cardWard?.involuntaryBedNeeded,
                cardWard?.highAcuityNursingNeeded,
                referral.transportNeeded,
              ].filter(Boolean).length;

              return (
                <li
                  key={referral.id}
                  className={cx(a.card, selected && a.cardOn)}
                  data-highlighted={isHighlighted(referral) ? "true" : undefined}
                  data-dim={isDimmed(referral) ? "true" : undefined}
                  data-overdue={isOverdue(referral, now) ? "true" : undefined}
                >
                  <button
                    type="button"
                    className={a.cardButton}
                    data-testid={`ward-referral-board-card-select-${referral.id}`}
                    aria-pressed={selected}
                    onClick={() => onSelect(referral.id)}
                  >
                    <span
                      className={a.cardTier}
                      data-tier={referral.urgency}
                      data-testid={`ward-referral-board-card-tier-${referral.id}`}
                      title={urgencyTierLabel(referral.urgency)}
                    >
                      <TierTile tier={referral.urgency} />
                    </span>
                    <span className={a.cardMain}>
                      <span className={a.cardName}>
                        <strong>{nameFor(patientInfo.formalName, patientInfo.umrn)}</strong>
                        <ReadmissionFlag
                          flag={referralReadmissionFlag(referral, readmissionIndex)}
                          expandable={false}
                          testId={`ward-referral-board-card-readmission-${referral.id}`}
                        />
                      </span>
                      <span className={a.cardRoute}>
                        <b>{referral.originSiteCode}</b> to {askingForShort(referral)}
                      </span>
                      {/* v10 phone row: age band and sex, then how many bed needs, never the region. */}
                      <span className={a.cardFacts} data-testid={`ward-referral-board-card-service-${referral.id}`}>
                        {[
                          ...referralPersonFactsStatingSex(referral).slice(0, 2),
                          ...(cardNeeds > 0 ? [`${cardNeeds} ${cardNeeds === 1 ? "need" : "needs"}`] : []),
                        ].join(" · ")}
                        {assignedUnit ? ` · Bed at ${assignedUnit.name}` : ""}
                      </span>
                    </span>
                    <span className={a.cardClock}>
                      <span className={a.cardWait} data-testid={`ward-referral-board-card-wait-${referral.id}`}>
                        {cardWait.endsWith(" waiting") ? (
                          <>
                            {cardWait.slice(0, -" waiting".length)}
                            <span className="sr-only"> waiting</span>
                          </>
                        ) : (
                          cardWait
                        )}
                      </span>
                      {dueAt !== undefined ? <DueTimer dueAt={dueAt} now={now} /> : null}
                    </span>
                  </button>
                  {refusals.length > 0 ? (
                    <span className={a.cardNote} data-testid={`ward-referral-board-card-refusals-${referral.id}`}>
                      {`${QUEUED_REFUSED_LEAD} — ${refusals.join(" · ")}`}
                    </span>
                  ) : null}
                  {referralNeedsGenderReview(referral) ? (
                    <span className={a.cardNote} data-testid={`ward-referral-board-card-review-${referral.id}`}>
                      {GENDER_REVIEW_FLAG}
                    </span>
                  ) : null}
                  {referralFollowUpLine(referral, now) ? (
                    <span className={a.cardNote} data-testid={`ward-referral-board-card-follow-up-${referral.id}`}>
                      {referralFollowUpLine(referral, now)}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ReferralQueueCards>
        </>
      )}
    </section>
  );
}

const SHORT_KIND: Record<Referral["destinations"][number]["destination"]["kind"], string> = {
  psychiatric_ward: "Ward bed",
  emergency_department: "ED review",
  community_team: "Community",
};

/** One chip per distinct need, so three wards asked read "Ward bed" once, with each ward in the title. */
function armChips(referral: Referral) {
  const chips = new Map<string, { words: string; refused: boolean; titles: string[] }>();
  for (const arm of referral.destinations) {
    const open = arm.state === "queued" && arm.withdrawnAt === undefined;
    const refused = arm.state === "declined";
    if (!open && !refused) continue;
    const asked = open ? openInformationNeeds(arm.informationNeeds).length : 0;
    const words = `${shortKind(arm.destination.kind)}${
      open && arm.waitlistedAt !== undefined ? ", waitlisted" : refused ? " refused" : ""
    }${asked > 0 ? `, needs ${asked} item${asked === 1 ? "" : "s"}` : open && arm.openedAt !== undefined ? ", opened" : ""}`;
    const title = refused
      ? `${referralDestinationLabel(arm.destination)} refused: ${declineReasonWords(arm.declineReason)}`
      : referralDestinationLabel(arm.destination);
    const chip = chips.get(words) ?? { words, refused, titles: [] };
    chip.titles.push(title);
    chips.set(words, chip);
  }
  return [...chips.values()];
}

function shortKind(kind: Referral["destinations"][number]["destination"]["kind"]): string {
  return SHORT_KIND[kind];
}

export function DecidedSection({
  decided,
  displayDecided = decided,
  decidedTotal,
  units,
  movements = [],
  patients = [],
  now,
  selectedId,
  onSelect,
  onResetFilters,
}: {
  decided: Referral[];
  displayDecided?: Referral[];
  decidedTotal: number;
  units: Unit[];
  movements?: Movement[];
  patients?: Patient[];
  now: Instant;
  selectedId?: string;
  onSelect: (id: string) => void;
  onResetFilters?: () => void;
}) {
  const nameFor = usePatientNameDisplay();
  return (
    <section className={cx(styles.v6Section, styles.v6Decided)} data-testid="ward-referral-board-decided">
      <CardHead
        eyebrow
        title={
          <>
            Recently decided{" "}
            <Count n={decided.length < decidedTotal ? `${decided.length} of ${decidedTotal}` : decidedTotal} />
          </>
        }
      />
      <p className={styles.v6Note} data-testid="ward-referral-board-decided-note">
        Acceptance records the decision only. No bed is pulled, no patient is moved and no transport is arranged.
      </p>
      {decided.length === 0 ? (
        <p className={styles.v6Empty} data-testid="ward-referral-board-decided-empty">
          None. No referral has been decided yet.
        </p>
      ) : displayDecided.length === 0 ? (
        <EmptyState
          className={styles.v6EmptyState}
          title="No decided referrals match the current search or filters."
          action={
            onResetFilters ? (
              <Button variant="sec" size="sm" onClick={onResetFilters}>
                Reset filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <WardTable
            className={styles.table}
            wrapperClassName={styles.tableScroll}
            testId="ward-referral-board-decided-table"
          >
            <thead>
              <tr>
                <th scope="col">Referral</th>
                <th scope="col">Outcome</th>
                <th scope="col">Detail</th>
                <th scope="col">Waited</th>
                <th scope="col">Decided</th>
              </tr>
            </thead>
            <tbody>
              {displayDecided.map((referral) => {
                const patientInfo = resolveSubjectPatient(referral, { patients, referrals: decided, movements });
                return (
                  <tr
                    key={referral.id}
                    className={referral.id === selectedId ? styles.selectedRow : undefined}
                    data-testid={`ward-referral-board-decided-row-${referral.id}`}
                  >
                    <td>
                      <button
                        type="button"
                        className={styles.rowSelectButton}
                        data-testid={`ward-referral-board-select-decided-${referral.id}`}
                        aria-pressed={referral.id === selectedId}
                        onClick={() => onSelect(referral.id)}
                      >
                        {patientInfo.umrn}
                      </button>
                    </td>
                    <td>
                      <div>{outcomeLabel(referral)}</div>
                      <span className={styles.decidedPatientName}>
                        <strong>{nameFor(patientInfo.formalName, patientInfo.umrn)}</strong>
                      </span>
                    </td>
                    <td data-testid={`ward-referral-board-decided-detail-${referral.id}`}>
                      <OutcomeDetail
                        referral={referral}
                        units={units}
                        refusalsTestId={`ward-referral-board-decided-refusals-${referral.id}`}
                        cancelledTestId={`ward-referral-board-decided-cancelled-${referral.id}`}
                      />
                    </td>
                    <td>{decidedWaitLabel(referral)}</td>
                    <td>
                      {referralDecidedAt(referral) !== undefined
                        ? formatInstantWithDay(referralDecidedAt(referral)!, now)
                        : "Not recorded"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </WardTable>

          <ul className={cx(styles.cardList, styles.v6List)} data-testid="ward-referral-board-decided-cards">
            {displayDecided.map((referral) => {
              const patientInfo = resolveSubjectPatient(referral, { patients, referrals: decided, movements });
              const accepted = referralState(referral) === "accepted";
              const decidedAt = referralDecidedAt(referral);
              const selected = referral.id === selectedId;
              return (
                <li
                  key={referral.id}
                  className={cx(styles.v6Item, selected && styles.v6ItemOn)}
                  data-testid={`ward-referral-board-decided-card-${referral.id}`}
                >
                  <button
                    type="button"
                    className={cx(styles.v6Row, styles.v6RowDecided)}
                    data-testid={`ward-referral-board-select-decided-card-${referral.id}`}
                    aria-pressed={selected}
                    onClick={() => onSelect(referral.id)}
                  >
                    <span className={styles.v6RowTier} title={urgencyTierLabel(referral.urgency)}>
                      <TierTile tier={referral.urgency} />
                    </span>
                    <span className={styles.v6RowMain}>
                      <span className={styles.v6RowLine}>
                        <StatusGlyph tone={accepted ? "success" : "closed"} size={10} />
                        <span className="sr-only">{outcomeLabel(referral)}, </span>
                        <strong>{nameFor(patientInfo.formalName, patientInfo.umrn)}</strong> {accepted ? "to " : ""}
                        <span
                          className={styles.v6RowOutcome}
                          data-testid={`ward-referral-board-decided-detail-card-${referral.id}`}
                        >
                          <OutcomeDetail
                            referral={referral}
                            units={units}
                            refusalsTestId={`ward-referral-board-decided-refusals-card-${referral.id}`}
                            cancelledTestId={`ward-referral-board-decided-cancelled-card-${referral.id}`}
                          />
                        </span>
                      </span>
                    </span>
                    <span className={styles.v6RowTime}>
                      {decidedAt !== undefined ? (
                        <>
                          <span className="sr-only">Decided </span>
                          {formatInstantWithDay(decidedAt, now)}
                        </>
                      ) : (
                        "Not recorded"
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
