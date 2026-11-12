"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ArrowRightLeft } from "lucide-react";

import { Button, FormalName, Icon, Menu, ShowMoreRow, buttonClass, foldHidden, foldLimit } from "@/components/wf";
import { referralBoardHref } from "@/components/ward-management/ed/ed-bed-search-step";
import { bedMeetingActionLabel } from "@/components/ward-management/bed-meeting/bed-meeting-actions";
import { patientHref } from "@/components/ward-management/shell/ward-patient-href";
import { useEffectiveWardAccess, useWardAccessSnapshot } from "@/components/ward-management/shell/ward-access-store";
import { usePatientNameDisplay } from "@/components/ward-management/settings/discreet-names";
import { CHROME_ROLE_LABELS, type WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { useRouteRole } from "@/components/ward-management/ward-role-gate";

import { handoverDeskOf } from "@/components/ward-management/handover/handover-desk";
import type { HandedItemRecord, HandedItemRef, WorkDesk } from "@/components/ward-management/handover-work-events";
import {
  HANDOVER_OWN_WORK_LEAD_MINUTES,
  handOverTargets,
  incomingHandOvers,
  ownWorkItems,
  ownWorkListOpen,
} from "@/components/ward-management/handover-work-model";
import styles from "./handover-own-work.module.css";

/** The desks that can own handed work (`EVENT_ROLE.HAND_OVER_ITEM`). */
const WORK_DESKS: readonly WardFlowRole[] = ["coordinator", "ward", "ed", "community"];

const NONE: never[] = [];

/** About eight rows, then the kit's Show more (DESIGN-SYSTEM.md section 4). */
const OWN_WORK_ROWS = 8;

/**
 * END-OF-SHIFT HANDOVER OF YOUR WORK (batch 3 item 21, D-136 item 2). On the handover page, from
 * `HANDOVER_OWN_WORK_LEAD_MINUTES` before the shift ends, this desk's own open work: referrals it is
 * handling, bed meeting chases and carer callbacks, each with "Hand to". The receiving desk sees
 * "Handed to you" at any time and taps Accept; until then the item stays with the sender and shows
 * here as not accepted. A prompt only: nothing here blocks sign-out.
 */
export function HandoverOwnWork({ now, layout = "page" }: { now: Instant; layout?: "page" | "phone" }) {
  const baseId = useId();
  const [showAll, setShowAll] = useState(false);
  const flow = useOptionalWardFlowSelect(
    "referrals",
    "movements",
    "admissions",
    "units",
    "carerCallbacks",
    "handedItems",
  );
  const routeRole = useRouteRole();
  const access = useEffectiveWardAccess();
  const previewing = useWardAccessSnapshot().previewOf !== null;
  const raise = useWardRaise(routeRole);
  const patientOf = usePatientOf();
  const nameFor = usePatientNameDisplay();
  if (!flow || !WORK_DESKS.includes(routeRole)) return null;
  const ownWard = routeRole === "ward" ? handoverDeskOf(access, flow.units).ownWard : undefined;
  // A ward desk acts for its one ward; a ward desk spanning several has no single desk to hand from.
  if (routeRole === "ward" && !ownWard) return null;
  const desk: WorkDesk = ownWard ? { role: "ward", unitId: ownWard.id } : { role: routeRole };
  const state = {
    referrals: flow.referrals,
    movements: flow.movements,
    admissions: flow.admissions,
    carerCallbacks: flow.carerCallbacks ?? NONE,
    handedItems: flow.handedItems ?? NONE,
  };
  const listOpen = ownWorkListOpen(now);
  // Unaccepted hand-overs stay with this desk and show at any time; the rest only near shift end.
  const mine = ownWorkItems(state, desk).filter((row) => listOpen || row.pending);
  const incoming = incomingHandOvers(state, desk);
  if (mine.length === 0 && incoming.length === 0) return null;
  // Handed to you first, then this desk's own; the fold counts both as one list.
  const total = incoming.length + mine.length;
  const hidden = foldHidden(total, OWN_WORK_ROWS);
  const limit = showAll || hidden === 0 ? total : foldLimit(total, OWN_WORK_ROWS);
  const incomingShown = incoming.slice(0, limit);
  const mineShown = mine.slice(0, Math.max(0, limit - incomingShown.length));
  const acting = ownWard ? { actingUnitId: ownWard.id } : {};
  const at = (instant: Instant) => formatInstantWithDay(instant, now);
  const deskLabel = (target: WorkDesk) =>
    target.role === "ward"
      ? (flow.units.find((unit) => unit.id === target.unitId)?.name ?? CHROME_ROLE_LABELS.ward)
      : CHROME_ROLE_LABELS[target.role as WardChromeRole];

  /** What the item is, who it is about and where it opens. */
  const describe = (item: HandedItemRef) => {
    if (item.kind === "referral") {
      const referral = flow.referrals.find((candidate) => candidate.id === item.referralId);
      return { what: "Referral", who: patientOf(referral), href: referralBoardHref(item.referralId) };
    }
    if (item.kind === "chase") {
      const record =
        item.movementId !== undefined
          ? flow.movements.find((movement) => movement.id === item.movementId)
          : flow.admissions.find((admission) => admission.id === item.admissionId);
      const who = patientOf(record);
      return {
        what: bedMeetingActionLabel(item.action),
        who,
        href: who.patient ? patientHref(who.patient.id) : undefined,
      };
    }
    const callback = state.carerCallbacks.find((record) => record.id === item.callbackId);
    const stay = flow.admissions.find((admission) => admission.id === callback?.admissionId);
    const who = stay ? patientOf(stay) : patientOf(callback?.movementId ? { movementId: callback.movementId } : null);
    return { what: "Carer call back", who, href: who.patient ? patientHref(who.patient.id) : undefined };
  };

  const whoLine = (who: ReturnType<typeof patientOf>) => (
    <span className={styles.name}>
      <FormalName name={nameFor(who.formalName, who.umrn)} />
    </span>
  );

  const handTo = (item: HandedItemRef, pending: HandedItemRecord | undefined, describedBy: string) => {
    const targets = handOverTargets(state, item);
    if (previewing || targets.length === 0) return null;
    return (
      <Menu
        label="Hand to"
        align="end"
        items={targets.map((target) => ({
          id: `${target.role}-${target.unitId ?? ""}`,
          label: deskLabel(target),
          checked: pending ? pending.to.role === target.role : undefined,
          checkable: pending ? ("radio" as const) : undefined,
          onSelect: () => void raise("HAND_OVER_ITEM", { item, toRole: target.role, ...acting }),
        }))}
        trigger={(props) => (
          <button
            type="button"
            {...props}
            aria-describedby={describedBy}
            className={buttonClass({ variant: "sec", size: "sm" })}
            data-testid="ward-handover-own-work-hand-to"
          >
            Hand to
          </button>
        )}
      />
    );
  };

  return (
    <section
      className={styles.panel}
      data-layout={layout}
      aria-labelledby={`${baseId}-heading`}
      data-testid="ward-handover-own-work"
    >
      <h2 id={`${baseId}-heading`} className={styles.heading}>
        <Icon icon={ArrowRightLeft} size={16} className={styles.headIcon} />
        Your open work
        <span className={styles.count}>{mine.length + incoming.length}</span>
        {listOpen ? <span className={styles.note}>Shift ends within {HANDOVER_OWN_WORK_LEAD_MINUTES} min</span> : null}
      </h2>
      <ul className={styles.list} id={`${baseId}-list`}>
        {incomingShown.map((record, index) => {
          const { what, who, href } = describe(record.item);
          // Every row's button reads the same, so it names the row's item and patient (a11y review).
          const whatId = `${baseId}-in-${index}`;
          return (
            <li key={record.id} className={styles.row} data-testid={`ward-handover-incoming-${record.id}`}>
              <span className={styles.what} id={whatId}>
                <span className={styles.kind}>{what}</span>
                {href ? (
                  <Link href={href} className={styles.link}>
                    {whoLine(who)}
                  </Link>
                ) : (
                  whoLine(who)
                )}
              </span>
              <span className={styles.status}>
                Handed to you by {deskLabel(record.from)}, {at(record.handedAt)}
              </span>
              {previewing ? null : (
                <Button
                  variant="sec"
                  size="sm"
                  data-testid="ward-handover-own-work-accept"
                  aria-describedby={whatId}
                  onClick={() => void raise("ACCEPT_HANDED_ITEM", { handedItemId: record.id, ...acting })}
                >
                  Accept
                </Button>
              )}
            </li>
          );
        })}
        {mineShown.map(({ key, item, sortAt, pending }, index) => {
          const { what, who, href } = describe(item);
          const whatId = `${baseId}-own-${index}`;
          const when =
            item.kind === "referral"
              ? `Yours since ${at(sortAt)}`
              : item.kind === "chase"
                ? `Due ${at(sortAt)}`
                : `Best after ${at(sortAt)}`;
          return (
            <li key={key} className={styles.row} data-testid={`ward-handover-own-${key}`}>
              <span className={styles.what} id={whatId}>
                <span className={styles.kind}>{what}</span>
                {href ? (
                  <Link href={href} className={styles.link}>
                    {whoLine(who)}
                  </Link>
                ) : (
                  whoLine(who)
                )}
              </span>
              <span className={styles.status} data-pending={pending ? "" : undefined}>
                {pending ? `Handed to ${deskLabel(pending.to)}, not accepted yet · still yours` : when}
              </span>
              {handTo(item, pending, whatId)}
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
