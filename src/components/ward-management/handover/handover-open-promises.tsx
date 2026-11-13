"use client";

import { useId, useState } from "react";
import Link from "next/link";

import { referralBoardHref } from "@/components/ward-management/ed/ed-bed-search-step";
import {
  commitmentsDueBy,
  promiseOverdue,
  type ReferralCommitmentStatus,
} from "@/components/ward-management/referrals/referral-commitments-model";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { Referral, Unit } from "@/components/ward-management/ward-model";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { usePatientNameDisplay } from "@/components/ward-management/settings/discreet-names";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { useRouteRole } from "@/components/ward-management/ward-role-gate";
import { useWardAccessSnapshot } from "@/components/ward-management/shell/ward-access-store";
import { ChevronRight, PhoneCall } from "lucide-react";
import {
  Button,
  FormalName,
  Icon,
  ShowMoreRow,
  StatusGlyph,
  foldHidden,
  foldLimit,
  type HeroActProps,
} from "@/components/wf";

import { useCarerCallbacksDue } from "@/components/ward-management/carer-callbacks";
import { HandoverOwnWork } from "@/components/ward-management/handover-own-work";

export { useCarerCallbacksDue as useCarerDue } from "@/components/ward-management/carer-callbacks";
import styles from "./handover-open-promises.module.css";

/** About eight rows, then the kit's Show more (DESIGN-SYSTEM.md section 4). */
const PROMISE_ROWS = 8;

/** "1 carer call back", "2 carer call backs". */
function carerCallbacksWords(count: number): string {
  return `${count} carer call ${count === 1 ? "back" : "backs"}`;
}

/**
 * When to chase one open promise. `sortAt` is the earlier of the next callback and the promised
 * time, overdue or not, so the card lists by when to ring next. `shownAt` is the time the row
 * prints: an overdue row keeps its promised time ("since 09:00"), any other row prints `sortAt`.
 */
export function promiseChaseTimes(
  status: ReferralCommitmentStatus,
  now: Instant,
): {
  overdue: boolean;
  callback?: Instant;
  promised?: Instant;
  sortAt: Instant;
  shownAt: Instant;
  isCallback: boolean;
} {
  const overdue = promiseOverdue(status, now);
  const callback = status.nextCallbackAt?.at;
  const promised = status.step?.step === "promised" ? status.promisedFor : undefined;
  const sortAt =
    callback !== undefined && promised !== undefined ? Math.min(callback, promised) : (callback ?? promised ?? now);
  const shownAt = overdue ? promised! : sortAt;
  return {
    overdue,
    callback,
    promised,
    sortAt,
    shownAt,
    isCallback: !overdue && callback !== undefined && callback === sortAt,
  };
}

/**
 * How many open ward promises there are, and how many are overdue. Feeds the Handover hero's
 * strip (Josh, Note 12, 8 Nov 2026), which opens the card below it. Same items as the card.
 */
export function openPromiseCounts(referrals: readonly Referral[], now: Instant): { total: number; overdue: number } {
  const items = commitmentsDueBy(referrals, Number.POSITIVE_INFINITY);
  return {
    total: items.length,
    overdue: items.filter((item) => promiseOverdue(item.status, now)).length,
  };
}

/**
 * The Handover hero's promises strip (Josh, Note 12, 8 Nov 2026): like Home's next step, one line
 * with the count and overdue count, and a button that opens the card at the top of the page.
 * Nothing when there are no open promises. The page leaves it out while print preview is open.
 */
/**
 * Page tops (Josh, 9 Nov 2026): the ward replies as the top's one act row. Overdue replies are the
 * act-now line ("1 ward reply overdue"); replies still to come are a quieter amber line. The button
 * ("Show list") shows or hides the card (`onOpenChange`), or with `onShow` takes the reader to it.
 */
export function promisesHeroAct(
  referrals: readonly Referral[],
  now: Instant,
  open: boolean,
  onOpenChange: (open: boolean) => void,
  /** Batch 3 item 23: carer call backs past their best-after time (`useCarerCallbacksDue`). */
  carerDue = 0,
): HeroActProps | undefined {
  const { total, overdue } = openPromiseCounts(referrals, now);
  if (total === 0 && carerDue === 0) return undefined;
  const ward =
    total === 0
      ? undefined
      : overdue > 0
        ? `${overdue} ward ${overdue === 1 ? "reply" : "replies"} overdue`
        : `${total} ward ${total === 1 ? "reply" : "replies"} due`;
  return {
    tone: overdue > 0 ? "danger" : "warning",
    title: ward
      ? carerDue > 0
        ? `${ward} · ${carerCallbacksWords(carerDue)}`
        : ward
      : `${carerCallbacksWords(carerDue)} due`,
    testId: "ward-handover-promises-act",
    action: {
      // Neutral words: the card may hold carer call backs only, so "replies" would misname it.
      label: open ? "Hide list" : "Show list",
      phoneLabel: open ? "Hide" : "Show",
      pressed: open,
      testId: "ward-handover-promises-toggle",
      onClick: () => onOpenChange(!open),
    },
  };
}

/** Phone: the replies card always shows under the top, so the act row's button takes the reader to it. */
export function promisesPhoneAct(referrals: readonly Referral[], now: Instant, carerDue = 0): HeroActProps | undefined {
  const act = promisesHeroAct(referrals, now, false, () => undefined, carerDue);
  if (!act) return undefined;
  return {
    ...act,
    action: {
      label: "Show list",
      phoneLabel: "Show",
      testId: "ward-handover-promises-toggle",
      onClick: () =>
        document.querySelector('[data-testid="ward-handover-open-promises"]')?.scrollIntoView({ block: "start" }),
    },
  };
}

/**
 * OPEN PROMISES CARRIED OVER AT HANDOVER (closing-the-loop package A, 24 Oct 2026). Response
 * commitments still open that carry a promised time or a next callback, overdue or still to come,
 * each with its recorded time and linked to its referral (no invented shift length), so the incoming coordinator inherits them.
 * Read only, in recorded order, and nothing is ranked. Renders nothing when none is due.
 * Each row is one tap target: the name and ward, then the step and times underneath.
 * On a phone it sits below the Since previous handover card as a rounded card like it.
 */
export function HandoverOpenPromises({
  open = true,
  ...props
}: {
  referrals: readonly Referral[];
  units: readonly Unit[];
  now: Instant;
  layout?: "page" | "rail" | "phone";
  /** The page's hero shows or hides the promises card; your open work below it shows either way. */
  open?: boolean;
}) {
  const layout = props.layout ?? "page";
  return (
    <>
      {open ? <PromisesCard {...props} /> : null}
      {/* Batch 3 item 21: your own open work to hand on sits with the promises carried over. */}
      {layout === "rail" ? null : <HandoverOwnWork now={props.now} layout={layout} />}
    </>
  );
}

function PromisesCard({
  referrals,
  units,
  now,
  layout = "page",
}: {
  referrals: readonly Referral[];
  units: readonly Unit[];
  now: Instant;
  layout?: "page" | "rail" | "phone";
}) {
  const baseId = useId();
  const [showAll, setShowAll] = useState(false);
  const patientOf = usePatientOf();
  const nameFor = usePatientNameDisplay();
  // Batch 3 item 23: carer call backs past their best-after time join the same list, as one kind.
  const carerDue = useCarerCallbacksDue(now);
  const stays = useOptionalWardFlowSelect("admissions")?.admissions;
  const routeRole = useRouteRole();
  const previewing = useWardAccessSnapshot().previewOf !== null;
  const raise = useWardRaise(routeRole);
  const items = commitmentsDueBy(referrals, Number.POSITIVE_INFINITY);
  if (items.length === 0 && carerDue.length === 0) return null;
  const wardName = (unitId: string) => units.find((unit) => unit.id === unitId)?.name ?? "Ward not recorded";
  const at = (instant: Instant) => formatInstantWithDay(instant, now);
  /*
   * Round 6 (Josh, 1 Nov 2026): what this card is for. A ward's answer the coordinator is still
   * waiting on, carried to the next shift so nobody drops it. Each row says, in one line, when to
   * chase, who it is about and what the ward said. Listed by that time, earliest first: a clock
   * order, not a clinical ranking.
   */
  const rows = items
    .map((item) => {
      const status = item.status;
      const { overdue, callback, promised, sortAt, shownAt: when, isCallback } = promiseChaseTimes(status, now);
      const ward = wardName(item.unitId);
      const what =
        promised !== undefined
          ? `${ward} promised an answer by ${at(promised)}`
          : status.step?.step === "acknowledged"
            ? `${ward} acknowledged, no time promised`
            : `Waiting for ${ward} to respond`;
      const then = callback !== undefined && (overdue || promised !== undefined) ? `ring again ${at(callback)}` : null;
      return { kind: "ward" as const, item, overdue, when, sortAt, ward, what, then, isCallback };
    })
    .sort((left, right) => left.sortAt - right.sortAt);
  const carerRows = carerDue.map((record) => ({ kind: "carer" as const, record, sortAt: record.bestAfter }));
  const merged = [...rows, ...carerRows].sort((left, right) => left.sortAt - right.sortAt);
  const hidden = foldHidden(merged.length, PROMISE_ROWS);
  const shown = showAll || hidden === 0 ? merged : merged.slice(0, foldLimit(merged.length, PROMISE_ROWS));
  const heading =
    carerRows.length === 0 ? "Ward replies due" : rows.length === 0 ? "Carer call backs due" : "Promises due";
  return (
    <section
      className={styles.panel}
      data-layout={layout}
      aria-labelledby={`${baseId}-heading`}
      data-testid="ward-handover-open-promises"
    >
      <h2 id={`${baseId}-heading`} className={styles.heading}>
        <Icon icon={PhoneCall} size={16} className={styles.headIcon} />
        {heading}
        <span className={styles.count}>{merged.length}</span>
        {/* The overdue count is the page top's act row; each row still says Overdue. */}
        <span className={styles.note}>Earliest first</span>
      </h2>
      <ul className={styles.list} id={`${baseId}-list`}>
        {shown.map((row) => {
          if (row.kind === "carer") {
            const { record } = row;
            const stay = stays?.find((admission) => admission.id === record.admissionId);
            const who = stay
              ? patientOf(stay)
              : patientOf(record.movementId ? { movementId: record.movementId } : null);
            return (
              <li key={record.id} data-testid={`ward-handover-carer-callback-${record.id}`}>
                <div className={styles.row} data-kind="carer">
                  <span className={styles.time}>
                    <span className={styles.clock}>{at(record.bestAfter)}</span>
                    <span className={styles.timeNote}>call back</span>
                  </span>
                  <span className={styles.who}>
                    <span className={styles.name}>
                      <FormalName name={nameFor(who.formalName, who.umrn)} />
                    </span>
                    {who.umrn ? <span className={styles.umrn}>{who.umrn}</span> : null}
                  </span>
                  <span className={styles.what}>Carer wants a call back</span>
                  {previewing ? (
                    <span />
                  ) : (
                    <Button
                      variant="sec"
                      size="sm"
                      className={styles.made}
                      data-testid="ward-handover-carer-callback-made"
                      onClick={() =>
                        void raise("MARK_CARER_CALLBACK_MADE", {
                          callbackId: record.id,
                          ...(routeRole === "ward" && record.unitId ? { actingUnitId: record.unitId } : {}),
                        })
                      }
                    >
                      Call made
                    </Button>
                  )}
                </div>
              </li>
            );
          }
          const { item, overdue, when, what, then, isCallback } = row;
          const who = patientOf(item.referral);
          return (
            <li key={`${item.referral.id}-${item.unitId}`} data-testid={`ward-handover-promise-${item.referral.id}`}>
              <Link
                href={referralBoardHref(item.referral.id)}
                className={styles.row}
                data-overdue={overdue || undefined}
              >
                <span className={styles.time}>
                  {overdue ? (
                    <span className={styles.overdue}>
                      <StatusGlyph tone="danger" size={8} />
                      Overdue
                    </span>
                  ) : (
                    <span className={styles.clock}>{at(when)}</span>
                  )}
                  <span className={styles.timeNote}>
                    {overdue ? `since ${at(when)}` : isCallback ? "ring back" : "answer due"}
                  </span>
                </span>
                <span className={styles.who}>
                  <span className={styles.name}>
                    <FormalName name={nameFor(who.formalName, who.umrn)} />
                  </span>
                  {who.umrn ? <span className={styles.umrn}>{who.umrn}</span> : null}
                </span>
                <span className={styles.what}>
                  {what}
                  {then ? <span className={styles.then}> · {then}</span> : null}
                </span>
                <span className={styles.open}>
                  Open
                  <Icon icon={ChevronRight} size={14} />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {hidden > 0 ? (
        <ShowMoreRow onClick={() => setShowAll((all) => !all)} expanded={showAll} controls={`${baseId}-list`}>
          {showAll ? "Show fewer" : `Show ${hidden} more`}
        </ShowMoreRow>
      ) : null}
    </section>
  );
}
