"use client";

import { ArrowRight, BedDouble, Check, Clock, Info } from "lucide-react";
import { useMemo, useState } from "react";

import { Avatar, Badge, Icon, cx, durMinutes } from "@/components/wf";
import { NotWiredButton } from "@/components/ward-management/not-wired-button";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { GateResult } from "@/components/ward-management/ward-eligibility";
import { deriveMakeRoomChains, type MakeRoomChain } from "@/components/ward-management/ward-make-room";
import type { Unit } from "@/components/ward-management/ward-model";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { boundedBedAvailability } from "@/components/ward-management/ward-ready-beds";
import { edById, edShortName } from "@/components/ward-management/ward-sites";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { makeRoomPreview } from "./make-room-preview";
import styles from "./make-room-panel.module.css";

/**
 * A, conservative: one row per waiting referral, the plan opens in place.
 * B, recommended: a plan card with the route and numbered moves.
 * C, bold: a route map of the wards with each move drawn between them, then the moves with checks.
 */
export type MakeRoomVariant = "simple" | "recommended" | "fuller";

const VARIANT_TITLES: Record<MakeRoomVariant, string> = {
  simple: "Mockup A, compact list",
  recommended: "Mockup B, plan cards",
  fuller: "Mockup C, route map",
};

/** Plain names for the checks a move passes, in the order a clinician reads them. */
const CHECK_LABELS: Partial<Record<GateResult["gate"], string>> = {
  gender_designation: "Sex",
  authorisation: "Legal",
  cohort: "Age group",
  security: "Security",
  acuity: "Acuity",
  specialling: "Specialling",
  forensic: "Forensic",
  capacity_freshness: "Bed count current",
};

type Move = {
  key: string;
  who: string;
  fromName: string;
  to: Unit;
  isReferral: boolean;
  checks: GateResult[];
};

type NameOf = (subject: Parameters<ReturnType<typeof usePatientOf>>[0]) => string;

function movesOf(chain: MakeRoomChain, nameOf: NameOf): Move[] {
  return [
    ...chain.stepDowns.map((step) => ({
      key: step.admission.id,
      who: nameOf(step.admission),
      fromName: step.fromUnit.name,
      to: step.toUnit,
      isReferral: false,
      checks: step.checks,
    })),
    {
      key: chain.movement.id,
      who: nameOf(chain.movement),
      fromName: edShortName(edById(chain.movement.originEdId)),
      to: chain.targetUnit,
      isReferral: true,
      checks: chain.checks,
    },
  ];
}

function movesLabel(count: number) {
  return count === 2 ? "Two moves" : "Three moves";
}

function readyBeds(unit: Unit) {
  return boundedBedAvailability(unit).available;
}

function Checks({ checks, compact }: { checks: GateResult[]; compact: boolean }) {
  const shown = checks.filter((check) => CHECK_LABELS[check.gate]);
  if (compact) {
    return (
      <span className={styles.allChecks}>
        <Icon icon={Check} size={14} />
        All {shown.length} checks pass
      </span>
    );
  }
  return (
    <ul className={styles.checkList} aria-label="Checks this move passes">
      {shown.map((check) => (
        <li key={check.gate} className={styles.checkChip} title={check.detail}>
          <Icon icon={Check} size={14} />
          {CHECK_LABELS[check.gate]}
        </li>
      ))}
    </ul>
  );
}

function Stepper({ moves, detailed }: { moves: Move[]; detailed: boolean }) {
  return (
    <ol className={styles.stepper}>
      {moves.map((move, index) => (
        <li key={move.key} className={styles.stepItem}>
          <span className={cx(styles.stepNumber, index === 0 && styles.stepNumberNow)} aria-hidden="true">
            {index + 1}
          </span>
          <div className={styles.stepBody}>
            <div className={styles.stepTop}>
              <p className={styles.stepTitle}>
                {move.isReferral ? "Admit" : "Move"} <strong>{move.who}</strong> to {move.to.name}
              </p>
              {index === 0 ? (
                <Badge tone="success" size="sm">
                  Can start now
                </Badge>
              ) : (
                <Badge tone="neutral" size="sm">
                  After step {index}
                </Badge>
              )}
            </div>
            <p className={styles.stepSub}>
              From {move.fromName}.{" "}
              {index === 0
                ? `${move.to.name} has ${readyBeds(move.to)} Ready ${readyBeds(move.to) === 1 ? "bed" : "beds"} now.`
                : `Takes the bed freed by step ${index}.`}
            </p>
            <Checks checks={move.checks} compact={!detailed} />
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Where each patient goes, read left to right: the waiting patient into the full ward, and so on to a Ready bed. */
function RouteStrip({ chain, moves }: { chain: MakeRoomChain; moves: Move[] }) {
  const wards = [chain.targetUnit, ...[...chain.stepDowns].reverse().map((step) => step.toUnit)];
  return (
    <ol className={styles.route} aria-label="Where each patient goes, from the waiting patient to the Ready bed">
      <li className={styles.routeStop}>
        <span className={styles.routeWard}>{moves.at(-1)?.fromName}</span>
        <span className={cx(styles.routeBeds, styles.routeBedsWaiting)}>Waiting</span>
      </li>
      {wards.map((ward, index) => {
        const ready = index === wards.length - 1;
        return (
          <li key={ward.id} className={styles.routeStop}>
            <span className={styles.routeLink} aria-hidden="true">
              <Icon icon={ArrowRight} size={14} />
            </span>
            <span className={styles.routeWard}>{ward.name}</span>
            <span className={cx(styles.routeBeds, ready ? styles.routeBedsReady : styles.routeBedsFull)}>
              <Icon icon={BedDouble} size={14} />
              {ready ? `${readyBeds(ward)} Ready` : "Full"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Bold option: each ward as a column with its bed state, and each move drawn as a chip between them. */
function RouteMap({ chain, moves }: { chain: MakeRoomChain; moves: Move[] }) {
  const columns = [...chain.stepDowns.map((step) => step.toUnit), chain.targetUnit];
  return (
    <div className={styles.map} role="group" aria-label="Route map">
      {columns.map((ward, index) => {
        const move = moves[index];
        return (
          <div key={ward.id} className={styles.mapStep}>
            <div className={cx(styles.mapWard, index === 0 && styles.mapWardReady)}>
              <span className={styles.mapWardName}>{ward.name}</span>
              <span className={styles.mapWardBeds}>
                <Icon icon={BedDouble} size={14} />
                {index === 0 ? `${readyBeds(ward)} Ready now` : "Full now"}
              </span>
            </div>
            {move ? (
              <div className={styles.mapMove}>
                <span className={styles.mapMoveNumber}>{index + 1}</span>
                <Avatar name={move.who} size="md" decorative />
                <span className={styles.mapMoveText}>
                  <strong>{move.who}</strong>
                  <span>from {move.fromName}</span>
                </span>
                <span className={styles.mapMoveFoot}>
                  {index === 0 ? (
                    <Badge tone="success" size="sm">
                      Can start now
                    </Badge>
                  ) : (
                    <Badge tone="neutral" size="sm">
                      After step {index}
                    </Badge>
                  )}
                  <Checks checks={move.checks} compact />
                </span>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function PlanHeader({ chain, moves, now }: { chain: MakeRoomChain; moves: Move[]; now: Instant }) {
  const waitingFor = durMinutes(Math.max(0, now - chain.movement.openedAt));
  const waiting = moves.at(-1)!;
  return (
    <div className={styles.planHead}>
      <Avatar name={waiting.who} size="lg" decorative />
      <div className={styles.planHeadText}>
        <p className={styles.planTitle}>
          A bed can be freed on {chain.targetUnit.name} for <strong>{waiting.who}</strong>
        </p>
        <p className={styles.planMeta}>
          <span>
            <Icon icon={Clock} size={14} /> Waiting {waitingFor} in {waiting.fromName}
          </span>
          <span>{chain.movement.legalStatus}</span>
          <span>{chain.movement.security === "Secure" ? "Needs a secure bed" : "Needs an open bed"}</span>
        </p>
      </div>
      <Badge tone="info">{movesLabel(moves.length)}</Badge>
    </div>
  );
}

function PlanFooter({ chain, withDismiss }: { chain: MakeRoomChain; withDismiss: boolean }) {
  return (
    <div className={styles.planFoot}>
      <p className={styles.planNote}>
        <Icon icon={Info} size={14} />
        Starting raises each move in order through the usual steps. If one falls through, the later moves pause and you
        are told.
      </p>
      <div className={styles.planActions}>
        {withDismiss ? (
          <NotWiredButton size="sm" variant="ghost" label="Not now" name={`Not now for ${chain.targetUnit.name}`} />
        ) : null}
        <NotWiredButton size="sm" variant="pri" label="Start plan" name={`Start plan for ${chain.targetUnit.name}`} />
      </div>
    </div>
  );
}

function CompactRow({ chain, moves, now }: { chain: MakeRoomChain; moves: Move[]; now: Instant }) {
  const [open, setOpen] = useState(false);
  const waiting = moves.at(-1)!;
  const panelId = `make-room-compact-${chain.movement.id}`;
  return (
    <li className={styles.compactRow}>
      <button
        type="button"
        className={styles.compactButton}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={styles.compactWho}>
          <strong>{waiting.who}</strong>
          <span className={styles.compactMeta}>
            Waiting {durMinutes(Math.max(0, now - chain.movement.openedAt))} in {waiting.fromName}
          </span>
        </span>
        <span className={styles.compactWard}>{chain.targetUnit.name}</span>
        <Badge tone="info" size="sm">
          {movesLabel(moves.length)}
        </Badge>
        <span className={styles.compactToggle}>{open ? "Hide plan" : "Show plan"}</span>
      </button>
      <div id={panelId} hidden={!open} className={styles.compactPlan}>
        <Stepper moves={moves} detailed={false} />
        <PlanFooter chain={chain} withDismiss={false} />
      </div>
    </li>
  );
}

/**
 * MAKE ROOM PLANS, mockup stage (`make-room-chains`). Each waiting referral whose ward is full but
 * could be freed by moving patients already marked for step down, shown three ways for Josh to pick.
 * It only suggests: starting a plan is not wired yet.
 */
export function MakeRoomPanel({ now, variant }: { now: Instant; variant: MakeRoomVariant }) {
  const { admissions, units, movements, patients, referrals } = useWardFlowSelect(
    "admissions",
    "units",
    "movements",
    "patients",
    "referrals",
  );
  const patientOf = usePatientOf();
  const nameOf: NameOf = (subject) => patientOf(subject).displayName;
  const preview = useMemo(() => makeRoomPreview({ admissions, units }), [admissions, units]);
  const chains = useMemo(
    () =>
      deriveMakeRoomChains({
        admissions: preview.admissions,
        units: preview.units,
        movements,
        patients,
        referrals,
        now,
      }),
    [preview, movements, patients, referrals, now],
  );

  return (
    <WardPanel
      title={`Make room, ${VARIANT_TITLES[variant]}`}
      count={`${chains.length} ${chains.length === 1 ? "plan" : "plans"}`}
      testId={`make-room-${variant}`}
    >
      <div className={styles.body}>
        <p className={styles.intro}>
          Waiting referrals whose ward is full, where moving patients already marked for step down would free a bed.
          Same health service only, up to three moves, every move checked.
        </p>
        <p className={styles.previewNote}>Preview data: some wards are shown full so plans appear.</p>
        {chains.length === 0 ? (
          <p className={styles.empty}>No waiting referral needs room made right now.</p>
        ) : variant === "simple" ? (
          <ul className={styles.compactList}>
            {chains.map((chain) => (
              <CompactRow key={chain.movement.id} chain={chain} moves={movesOf(chain, nameOf)} now={now} />
            ))}
          </ul>
        ) : (
          <ul className={styles.plans}>
            {chains.map((chain) => {
              const moves = movesOf(chain, nameOf);
              return (
                <li key={chain.movement.id} className={styles.plan}>
                  <PlanHeader chain={chain} moves={moves} now={now} />
                  {variant === "fuller" ? (
                    <RouteMap chain={chain} moves={moves} />
                  ) : (
                    <RouteStrip chain={chain} moves={moves} />
                  )}
                  {variant === "fuller" ? null : <Stepper moves={moves} detailed={false} />}
                  <PlanFooter chain={chain} withDismiss />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </WardPanel>
  );
}
