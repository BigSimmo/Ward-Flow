"use client";

// Referrals redesign: copied from src/components/ward-management/referrals/referral-board-sections.tsx
// (30 October 2026). Changed: Needs reads as short words (Locked, Transport), Fit counts wards
// ("11 wards"), and a refused or cancelled ward is named instead of shown by its internal id.
//
// The referral board's two queue sections (waiting and recently decided), with the outcome detail
// and due timer they draw. Moved out of `referral-board.tsx` to keep it under the line cap.
import { openInformationNeeds } from "./referral-information-needs";
import { ORIGIN_NOT_RECORDED } from "@/components/ward-management/ward-model";
import { personLine } from "./referral-panel-parts";
import { referralFollowUpLine } from "./referral-owner-and-calls-model";
import { ReferralNoReplyFlag, ReferralNotOpenedTag } from "./referral-no-reply-flag";
import { useEffect, useMemo, useRef, useState } from "react";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { useSenderPresentation } from "@/components/ward-management/ward-sender-presentation";
import { referralPresentation } from "@/components/ward-management/ward-partial-view-presenters";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";
import { ReferralQueueCards, ReferralQueueTable } from "./referral-queue-layouts";
import { type Movement, type Referral, type Unit } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { createReadmissionIndex, referralReadmissionFlag } from "@/components/ward-management/ward-readmission";
import { ReadmissionFlag } from "@/components/ward-management/ward-readmission-flag";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { patientAgeText } from "@/components/ward-management/ward-patients";
import { usePatientNameDisplay } from "@/components/ward-management/settings/discreet-names";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { siteByCode } from "@/components/ward-management/ward-sites";
import {
  referralPersonFactsStatingSex,
  acceptedAddressing,
  SEX_NOT_HELD,
} from "@/components/ward-management/ward-referrals";
import {
  Button,
  CardHead,
  Count,
  cx,
  EmptyState,
  Segmented,
  ShowMoreRow,
  StatusGlyph,
  TierTile,
  Timer,
  buttonClass,
  requestConfirm,
} from "@/components/wf";
import Link from "next/link";
import { BedSingle, Undo2 } from "lucide-react";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import { referralDecisionUndoFor, undoRoleRefusal, undoWindowRefusal } from "@/components/ward-management/ward-undo";
import { movementHref, unitHref } from "@/components/ward-management/shell/ward-facade";
import { wardRaise } from "@/components/ward-management/ward-flow-raise";
import { acceptedReferralsAwaitingPull, acceptedWardOf, type AcceptedAwaitingPull } from "./accepted-awaiting-pull";
import { getReferralPriority, referralPriorityLabel } from "./referral-priority";
import { referralWaitLine } from "./referral-wait";
import {
  REFERRAL_SOURCE_WORDS,
  WaitCell,
  askingForShort,
  declineReasonWords,
  isOverdue,
  readyUnitCount,
  staleOnlyUnitCount,
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
  presentationDecidedAt,
  outcomeLabel,
  referralDueAt,
  referralNeedsGenderReview,
} from "./referral-board-model";
import { destinationWords, outcomeDetail, refusalLines } from "./referral-ward-names";
import redesign from "./referral-page.module.css";

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
  const sender = useSenderPresentation();
  const detail = outcomeDetail(referral, units, sender.referralFor(referral));
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
  const timer = <Timer at={dueAt * MS_PER_MINUTE} now={now * MS_PER_MINUTE} wholeMinutes direction="in" hideFlagWord />;
  return dueAt > now ? (
    <span className={styles.v6Due}>due {timer}</span>
  ) : (
    <span className={styles.v6Due}>{timer}</span>
  );
}

export function QueuedSection({
  progressUnavailable = false,
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
  dayZero,
}: {
  /** WF-03: the board's calendar day zero, so each row can show the person's age beside the UMRN. */
  dayZero?: Date;
  progressUnavailable?: boolean;
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
  // Audit PS-07: each card's open bed request, looked up once rather than scanned per card.
  const openMovementByReferral = useMemo(() => {
    const byReferral = new Map<string, Movement>();
    for (const movement of movements)
      if (movement.referralId && !movement.closure && !byReferral.has(movement.referralId))
        byReferral.set(movement.referralId, movement);
    return byReferral;
  }, [movements]);
  // A2-20: initials plus UMRN on a phone when Discreet names is on.
  const nameFor = usePatientNameDisplay();
  const sender = useSenderPresentation();
  return (
    <section className={styles.v6Section} data-testid="ward-referral-board-queued">
      <h2 className="sr-only">
        Awaiting decision <Count n={queued.length} />
      </h2>
      {queued.length === 0 ? (
        <p className={styles.v6Empty} data-testid="ward-referral-board-queued-empty">
          {progressUnavailable
            ? "Referral progress unavailable."
            : searchMiss
              ? filterMiss
                ? "No queued referral matches this chip."
                : "No queued referral matches the search."
              : "No referrals queued."}
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
              <col className={cx(a.colNeeds, redesign.colNeeds)} />
              <col className={a.colFit} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Tier</th>
                <th scope="col">Patient</th>
                <th scope="col" className={a.numHead}>
                  Since referral
                </th>
                <th scope="col">From</th>
                <th scope="col">Asking for</th>
                <th scope="col">Needs</th>
                <th scope="col" className={a.numHead}>
                  Fit
                </th>
              </tr>
            </thead>
            <tbody>
              {queued.map((referral) => {
                const patientInfo = resolveSubjectPatient(referral, queuedResolverState);
                const summary = sender.referralFor(referral);
                const refusals = summary === undefined ? refusalLines(referral, units) : [];
                const sendingHospital =
                  siteByCode(referral.originSiteCode)?.name ?? referral.originSiteCode ?? ORIGIN_NOT_RECORDED;
                const selected = referral.id === selectedId;
                const priority = getReferralPriority(referral, now);
                const ready = summary === undefined ? readyUnitCount(referral, units, now) : undefined;
                const staleOnly = ready === 0 ? staleOnlyUnitCount(referral, units, now) : 0;
                const ward = wardArm(referral)?.destination;
                // Redesign (Josh, 30 Oct 2026): short words, not icons alone; "Locked" is the app's word (F-24).
                const needs = [
                  ward?.secureBedNeeded ? { word: "Locked", label: "Locked bed requested" } : undefined,
                  ward?.involuntaryBedNeeded ? { word: "Involuntary", label: "Involuntary bed requested" } : undefined,
                  ward?.highAcuityNursingNeeded
                    ? { word: "High acuity", label: "High acuity nursing requested" }
                    : undefined,
                  referral.transportNeeded ? { word: "Transport", label: "Transport requested" } : undefined,
                ].filter((need): need is { word: string; label: string } => need !== undefined);

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
                          <span className={a.mono}>{patientInfo.umrn}</span>
                          {patientAgeText(patientInfo.patient, dayZero, now)} · {personLine(referral)}
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
                      <ReferralNoReplyFlag
                        referral={referral}
                        now={now}
                        className={a.rowNote}
                        testId={`ward-referral-board-no-reply-${referral.id}`}
                      />
                      <ReferralNotOpenedTag
                        referral={referral}
                        now={now}
                        className={a.rowNote}
                        testId={`ward-referral-board-not-opened-${referral.id}`}
                      />
                    </td>
                    <td className={a.numCell} data-testid={`ward-referral-board-wait-${referral.id}`}>
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
                          <span aria-hidden="true">{referral.originSiteCode ?? ORIGIN_NOT_RECORDED}</span>
                          <span className="sr-only">{sendingHospital}</span>
                        </span>
                        <span className={cx(a.sub, a.fromSource)}>{REFERRAL_SOURCE_WORDS[referral.source]}</span>
                      </span>
                    </td>
                    <td>
                      <span className={a.arms}>
                        {(summary === undefined
                          ? armChips(referral, units)
                          : [{ words: "Awaiting answer", refused: false, titles: [] }]
                        ).map(({ words, refused, titles }) => (
                          <span key={words} className={cx(a.arm, refused && a.armNo)} title={titles.join("\n")}>
                            {/* Polish: an open destination is a worded tag; only a refused one keeps its glyph. */}
                            {refused ? <StatusGlyph tone="closed" size={9} /> : null}
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
                        <span className={cx(a.needs, redesign.needWords)}>
                          {needs.map((need) => (
                            <span key={need.label} title={need.label}>
                              <span aria-hidden="true">{need.word}</span>
                              <span className="sr-only">{need.label}</span>
                            </span>
                          ))}
                        </span>
                      ) : (
                        // Polish (Josh, 9 Nov 2026): empty cells say so in words, not a dash.
                        <span className={a.none}>None</span>
                      )}
                    </td>
                    <td className={a.numCell}>
                      {ready === undefined ? (
                        <span
                          className={a.none}
                          title={summary === undefined ? "No ward bed asked for" : "Destination details are restricted"}
                        >
                          {summary === undefined ? "Not a bed" : "Restricted"}
                        </span>
                      ) : (
                        <span className={a.fit} data-zero={ready === 0 ? "true" : undefined}>
                          {/* Redesign (Josh, 30 Oct 2026): the figure counts wards, so it says so. */}
                          <b>{ready}</b> {ready === 1 ? "ward" : "wards"}
                          {ready === 0 && staleOnly > 0 ? (
                            <span
                              className={a.sub}
                              data-testid={`ward-referral-board-fit-stale-${referral.id}`}
                              title={`${staleOnly} ${staleOnly === 1 ? "ward fits" : "wards fit"} on every check but their bed count was last confirmed too long ago. Ask the ward to confirm beds.`}
                            >
                              {` · ${staleOnly} need bed check`}
                            </span>
                          ) : null}
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
              const summary = sender.referralFor(referral);
              const refusals = summary === undefined ? refusalLines(referral, units) : [];
              const accepted =
                summary === undefined || summary?.state === "accepted" ? acceptedAddressing(referral) : undefined;
              const linkedMovement = summary === undefined ? openMovementByReferral.get(referral.id) : undefined;
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
                        <b>{referral.originSiteCode ?? ORIGIN_NOT_RECORDED}</b> to{" "}
                        {summary === undefined ? askingForShort(referral) : "Awaiting answer"}
                      </span>
                      {/* v10 phone row: age band and sex, then how many bed needs, never the region. */}
                      <span className={a.cardFacts} data-testid={`ward-referral-board-card-service-${referral.id}`}>
                        {[
                          ...referralPersonFactsStatingSex(referral)
                            .slice(0, 2)
                            .filter((fact) => fact !== SEX_NOT_HELD),
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
                  <ReferralNoReplyFlag
                    referral={referral}
                    now={now}
                    className={a.cardNote}
                    testId={`ward-referral-board-card-no-reply-${referral.id}`}
                  />
                  <ReferralNotOpenedTag
                    referral={referral}
                    now={now}
                    className={a.cardNote}
                    testId={`ward-referral-board-card-not-opened-${referral.id}`}
                  />
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
function armChips(referral: Referral, units: readonly Unit[]) {
  const chips = new Map<string, { words: string; refused: boolean; titles: string[] }>();
  for (const arm of referral.destinations) {
    const open = arm.state === "queued" && arm.withdrawnAt === undefined;
    const refused = arm.state === "declined";
    if (!open && !refused) continue;
    const asked = open ? openInformationNeeds(arm.informationNeeds).length : 0;
    const words = `${shortKind(arm.destination.kind)}${
      open && arm.waitlistedAt !== undefined ? ", on the waiting list" : refused ? " refused" : ""
    }${asked > 0 ? `, needs ${asked} item${asked === 1 ? "" : "s"}` : open && arm.openedAt !== undefined ? ", opened" : ""}`;
    const title = refused
      ? `${destinationWords(arm.destination, units)} refused: ${declineReasonWords(arm.declineReason)}`
      : destinationWords(arm.destination, units);
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
  undoRole,
  actingUnitId,
  onPull,
}: {
  decided: Referral[];
  displayDecided?: Referral[];
  decidedTotal: number;
  units: Unit[];
  /** RQ7: the desk that may take a recent decision back from its row. Left out, no Undo shows. */
  undoRole?: WardFlowRole;
  actingUnitId?: string;
  /** RQ7: pulls the bed for an accepted ward referral from its row. Left out, no Pull bed shows. */
  onPull?: (item: AcceptedAwaitingPull) => void;
  movements?: Movement[];
  patients?: Patient[];
  now: Instant;
  selectedId?: string;
  onSelect: (id: string) => void;
  onResetFilters?: () => void;
}) {
  // Audit PS-07: one state object, so the resolver's identity-keyed index is built once per render,
  // not once per row (a fresh object per row rebuilt the whole patient index for every row).
  const decidedResolverState = useMemo(
    () => ({ patients, referrals: decided, movements }),
    [patients, decided, movements],
  );
  const nameFor = usePatientNameDisplay();
  const sender = useSenderPresentation();
  // Community desk (Josh, 31 Oct 2026): the History tab above carries the count, and the note on
  // what an acceptance does is the coordinator's reminder, so both are left out. A long list opens
  // on its first rows, then Show more (owner rule).
  const communityDesk = useEffectiveWardAccess().role === "community";
  const [showAll, setShowAll] = useState(false);
  // RQ7 (Josh, 3 Nov 2026): History is where a decision's next step is taken, not just read.
  // Each row carries its own next step: Pull bed (an accepted ward bed with none pulled yet), Open
  // movement (once a journey exists) and Undo (in the undo window, for the desk allowed to).
  const toPull = useMemo(() => {
    const items = onPull ? acceptedReferralsAwaitingPull(decided, units, movements) : [];
    return new Map(items.map((item) => [item.referral.id, item]));
  }, [onPull, decided, units, movements]);
  // Every accepted ward bed still to pull: the coordinator's pull sheet items, plus any other
  // accepted ward arm with no bed held and no journey raised.
  const pullIds = useMemo(() => {
    if (!onPull) return new Set<string>();
    return new Set(
      decided
        .filter((referral) => {
          if (toPull.has(referral.id)) return true;
          const accepted = acceptedAddressing(referral);
          if (!accepted || accepted.heldBedNumber !== undefined || accepted.withdrawnAt !== undefined) return false;
          if (movements.some((movement) => movement.referralId === referral.id)) return false;
          return acceptedWardOf(referral, units) !== undefined;
        })
        .map((referral) => referral.id),
    );
  }, [onPull, decided, toPull, movements, units]);
  const declinedCount = decided.filter((referral) =>
    referral.destinations.every((line) => line.state === "declined" || line.withdrawnAt !== undefined),
  ).length;
  const [chosenOnly, setOnly] = useState<"all" | "pull" | "declined">("all");
  // A filter with no rows left (last bed pulled, last decline undone) falls back to All.
  const only =
    (chosenOnly === "pull" && pullIds.size === 0) || (chosenOnly === "declined" && declinedCount === 0)
      ? "all"
      : chosenOnly;
  const shownDecided =
    only === "pull"
      ? displayDecided.filter((referral) => pullIds.has(referral.id))
      : only === "declined"
        ? displayDecided.filter((referral) =>
            referral.destinations.every((line) => line.state === "declined" || line.withdrawnAt !== undefined),
          )
        : displayDecided;
  const hiddenRows = communityDesk && !showAll ? Math.max(0, shownDecided.length - FIRST_DECIDED) : 0;
  const listed = hiddenRows > 0 ? shownDecided.slice(0, FIRST_DECIDED) : shownDecided;
  const rowActions = (referral: Referral, suffix = "") => (
    <DecidedRowActions
      referral={referral}
      now={now}
      suffix={suffix}
      units={units}
      movements={movements}
      toPull={toPull.get(referral.id)}
      onPull={onPull}
      undoRole={undoRole}
      actingUnitId={actingUnitId}
    />
  );
  return (
    <section className={cx(styles.v6Section, styles.v6Decided)} data-testid="ward-referral-board-decided">
      <CardHead
        eyebrow
        title={
          <>
            Recently decided
            {communityDesk ? null : (
              <>
                {" "}
                <Count n={decided.length < decidedTotal ? `${decided.length} of ${decidedTotal}` : decidedTotal} />
              </>
            )}
          </>
        }
      />
      {communityDesk ? null : (
        <p className={styles.v6Note} data-testid="ward-referral-board-decided-note">
          Acceptance records the decision only. No bed is pulled, no patient is moved and no transport is arranged.
        </p>
      )}
      {pullIds.size > 0 || declinedCount > 0 ? (
        <div className={a.decidedFilter}>
          <Segmented
            label="Show decided referrals"
            value={only}
            onChange={setOnly}
            items={[
              { id: "all", label: "All", count: displayDecided.length },
              ...(pullIds.size > 0 ? [{ id: "pull" as const, label: "Bed to pull", count: pullIds.size }] : []),
              ...(declinedCount > 0 ? [{ id: "declined" as const, label: "Declined", count: declinedCount }] : []),
            ]}
          />
        </div>
      ) : null}
      {decided.length === 0 ? (
        <p className={styles.v6Empty} data-testid="ward-referral-board-decided-empty">
          None decided yet.
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
                <th scope="col">
                  <span className="sr-only">Next step</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shownDecided.map((referral) => {
                const patientInfo = resolveSubjectPatient(referral, decidedResolverState);
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
                      <div>{outcomeLabel(referral, sender.referralFor(referral))}</div>
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
                    <td>{decidedWaitLabel(referral, sender.referralFor(referral))}</td>
                    <td>
                      {presentationDecidedAt(referral, sender.referralFor(referral)) !== undefined
                        ? formatInstantWithDay(presentationDecidedAt(referral, sender.referralFor(referral))!, now)
                        : "Not recorded"}
                    </td>
                    <td className={a.decidedActionsCell}>{rowActions(referral)}</td>
                  </tr>
                );
              })}
            </tbody>
          </WardTable>

          <ul className={cx(styles.cardList, styles.v6List)} data-testid="ward-referral-board-decided-cards">
            {listed.map((referral) => {
              const patientInfo = resolveSubjectPatient(referral, decidedResolverState);
              const presentation = referralPresentation(referral, sender.referralFor(referral));
              const accepted = presentation.kind !== "unavailable" && presentation.state === "accepted";
              const decidedAt = presentationDecidedAt(referral, sender.referralFor(referral));
              const selected = referral.id === selectedId;
              // Community desk: a referral asked of the team names only the team, so an accepted
              // row drops the repeated "to <team>" and the name gets the line.
              const ownTeamRow =
                communityDesk && referral.destinations.every((line) => line.destination.kind === "community_team");
              return (
                <li
                  key={referral.id}
                  className={cx(styles.v6Item, a.decidedItem, selected && styles.v6ItemOn)}
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
                        <span className="sr-only">{outcomeLabel(referral, sender.referralFor(referral))}, </span>
                        <strong>{nameFor(patientInfo.formalName, patientInfo.umrn)}</strong>
                        {ownTeamRow && accepted ? null : (
                          <>
                            {" "}
                            {accepted ? "to " : ""}
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
                          </>
                        )}
                      </span>
                    </span>
                    <span className={styles.v6RowTime}>
                      {decidedAt !== undefined ? (
                        <>
                          <span className="sr-only">Decided </span>
                          {/* Community desk: the day alone ("30 days ago"), so the name is not cut;
                              the clock time stays in the spoken label and the tooltip. */}
                          {communityDesk ? (
                            <span title={formatInstantWithDay(decidedAt, now)}>
                              <span className="sr-only">{formatInstantWithDay(decidedAt, now)}</span>
                              <span aria-hidden="true">{dayOnly(formatInstantWithDay(decidedAt, now))}</span>
                            </span>
                          ) : (
                            formatInstantWithDay(decidedAt, now)
                          )}
                        </>
                      ) : (
                        "Not recorded"
                      )}
                    </span>
                  </button>
                  {rowActions(referral, "-card")}
                </li>
              );
            })}
          </ul>
          {communityDesk && shownDecided.length > FIRST_DECIDED ? (
            <ShowMoreRow expanded={showAll} onClick={() => setShowAll((value) => !value)}>
              {showAll ? "Show fewer" : `Show ${hiddenRows} more`}
            </ShowMoreRow>
          ) : null}
        </>
      )}
    </section>
  );
}

/** Community desk: decided rows shown before Show more (owner rule). */
const FIRST_DECIDED = 8;

/** "10:42, 30 days ago" read as "30 days ago": the clock time of a decision weeks ago is noise on a row. */
function dayOnly(when: string): string {
  return when.replace(/^\d{1,2}:\d{2}, /, "");
}

/**
 * RQ7: a decided row's next step. Open movement once a journey exists, Pull bed for an accepted
 * ward bed with none pulled, and Undo while the decision is inside the undo window for a desk that
 * may take it back. Nothing shows when there is no next step.
 */
function DecidedRowActions({
  referral,
  units,
  movements,
  toPull,
  onPull,
  undoRole,
  actingUnitId,
  now,
  suffix = "",
}: {
  referral: Referral;
  now: Instant;
  /** Test id suffix, as the table and the card list draw the same row. */
  suffix?: string;
  units: readonly Unit[];
  movements: readonly Movement[];
  toPull: AcceptedAwaitingPull | undefined;
  onPull?: (item: AcceptedAwaitingPull) => void;
  undoRole?: WardFlowRole;
  actingUnitId?: string;
}) {
  // The Undo confirmation can stay open while the clock moves; dispatch the time it resolves at.
  const nowRef = useRef(now);
  useEffect(() => {
    nowRef.current = now;
  }, [now]);
  // Optional: a board drawn outside the provider (a test or the redesign preview) offers no Undo.
  const flow = useOptionalWardFlowSelect("undoRecords", "dispatch");
  const undoRecords = flow?.undoRecords;
  const record = undoRole ? referralDecisionUndoFor(undoRecords, referral.id) : undefined;
  const canUndo =
    record !== undefined &&
    undoRole !== undefined &&
    undoWindowRefusal(record.at, now) === null &&
    undoRoleRefusal(record, undoRole, actingUnitId) === null;
  const movement =
    movements.find((item) => item.referralId === referral.id && item.closure === undefined) ??
    // A journey that did not proceed is no next step; the referral is back on the pull list instead.
    movements.find((item) => item.referralId === referral.id && item.closure?.outcome !== "did_not_proceed");
  // Any other accepted ward bed with no bed held yet: the same link the decide panel gives, to the
  // accepting ward's bed board, where the bed is held.
  const accepted = acceptedAddressing(referral);
  const wardToHold =
    !movement && !toPull && onPull && accepted && accepted.heldBedNumber === undefined && !accepted.withdrawnAt
      ? acceptedWardOf(referral, units)
      : undefined;
  if (!canUndo && !movement && !toPull && !wardToHold) return null;
  return (
    <span className={a.decidedActions} data-testid={`ward-referral-board-decided-actions-${referral.id}${suffix}`}>
      {canUndo ? (
        <Button
          variant="ghost"
          size="sm"
          icon={Undo2}
          data-testid={`ward-referral-board-decided-undo-${referral.id}${suffix}`}
          onClick={() => {
            void requestConfirm({
              title: "Undo this decision?",
              message: "The referral goes back to the queue as it was before the decision.",
              confirmLabel: "Undo decision",
            }).then((confirmed) => {
              if (!confirmed || !undoRole || !flow) return;
              wardRaise(
                flow.dispatch,
                undoRole,
                nowRef.current,
              )("UNDO_REFERRAL_DECISION", {
                recordSeq: record.seq,
                referralId: referral.id,
                actingUnitId,
              });
            });
          }}
        >
          Undo
        </Button>
      ) : null}
      {movement ? (
        <Link
          href={movementHref(movement.id)}
          className={buttonClass({ variant: "ghost", size: "sm" })}
          data-testid={`ward-referral-board-decided-movement-${referral.id}${suffix}`}
        >
          Open movement
        </Link>
      ) : toPull && onPull ? (
        <Button
          variant="ghost"
          size="sm"
          icon={BedSingle}
          data-testid={`ward-referral-board-decided-pull-${referral.id}${suffix}`}
          onClick={() => onPull(toPull)}
        >
          Pull bed
        </Button>
      ) : wardToHold ? (
        <Link
          href={`${unitHref(wardToHold.unitId)}?tab=board`}
          className={buttonClass({ variant: "ghost", size: "sm" })}
          title={`Open ${wardToHold.unitName} bed board`}
          data-testid={`ward-referral-board-decided-hold-${referral.id}${suffix}`}
        >
          <BedSingle size={14} strokeWidth={1.75} aria-hidden="true" />
          Pull bed
        </Link>
      ) : null}
    </span>
  );
}
