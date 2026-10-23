"use client";

import type { HealthService } from "../ward-model";
import { unitHealthService } from "../ward-service-scope";

import { ArrowRight, BedDouble, Check, Clock, Info } from "lucide-react";
import { useMemo } from "react";

import { Avatar, Badge, Icon, SrOnly, cx, durMinutes } from "@/components/wf";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { EligibilityGate, GateResult } from "@/components/ward-management/ward-eligibility";
import { deriveMakeRoomChains, type MakeRoomChain } from "@/components/ward-management/ward-make-room";
import type { BedRelease, Unit } from "@/components/ward-management/ward-model";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { boundedBedAvailability } from "@/components/ward-management/ward-ready-beds";
import { edById, edShortName } from "@/components/ward-management/ward-sites";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { makeRoomPreview } from "./make-room-preview";
import styles from "./make-room-panel.module.css";
import { originName } from "@/components/ward-management/ward-movement-origin";

/** Plain names for every check a move can pass, so the count shown is the count run. */
const CHECK_LABELS: Record<EligibilityGate, string> = {
  gender_designation: "Sex",
  sex_mix: "Sex mix",
  authorisation: "Legal",
  legal_status: "Legal status",
  cohort: "Age group",
  age: "Age",
  security: "Security",
  acuity: "Acuity",
  specialling: "Specialling",
  forensic: "Forensic",
  prior_decline: "Not declined before",
  allocatable_bed: "Bed free",
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
      fromName: edShortName(edById(chain.movement.originEdId)) || (originName(chain.movement) ?? ""),
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

/** Said beside the Ready figure, in the other screens' wording. Silent when nothing is being made ready. */
function preparationNote(pending: number) {
  if (pending === 0) return "";
  return ` ${pending} of the ready ${pending === 1 ? "bed is" : "beds are"} still being made ready.`;
}

function Checks({ checks }: { checks: GateResult[] }) {
  const names = checks.map((check) => CHECK_LABELS[check.gate]);
  return (
    <span className={styles.allChecks} title={names.join(", ")}>
      <Icon icon={Check} size={14} />
      All {names.length} checks pass
      <SrOnly>: {names.join(", ")}</SrOnly>
    </span>
  );
}

function Stepper({ moves, bedReleases }: { moves: Move[]; bedReleases: BedRelease[] }) {
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
                ? `${move.to.name} has ${readyBeds(move.to)} Ready ${readyBeds(move.to) === 1 ? "bed" : "beds"} now.${preparationNote(bedsPendingPreparation(move.to.id, bedReleases))}`
                : `Takes the bed freed by step ${index} once that bed is marked Ready.`}
            </p>
            <Checks checks={move.checks} />
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

function PlanFooter() {
  return (
    <div className={styles.planFoot}>
      <p className={styles.planNote}>
        <Icon icon={Info} size={14} />
        Starting raises each move in order through the usual steps. If one falls through, the later moves pause and you
        are told.
      </p>
    </div>
  );
}

/**
 * MAKE ROOM PLANS, mockup stage (`make-room-chains`). Each waiting referral whose ward is full but
 * could be freed by moving patients already marked for step down, as plan cards (option B, Josh
 * 17 Oct 2026). It only suggests: starting a plan is not wired yet.
 */
export function MakeRoomPanel({ now, service = null }: { now: Instant; service?: HealthService | null }) {
  const { admissions, units, movements, patients, referrals, bedReleases } = useWardFlowSelect(
    "admissions",
    "bedReleases",
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
        bedReleases,
        now,
      }).filter((chain) => service === null || unitHealthService(chain.targetUnit) === service),
    [preview, movements, patients, referrals, bedReleases, now, service],
  );

  return (
    <WardPanel
      title="Make room"
      count={`${chains.length} ${chains.length === 1 ? "plan" : "plans"}`}
      testId="make-room"
    >
      <div className={styles.body}>
        <p className={styles.intro}>
          Waiting referrals whose ward is full, where moving patients already marked for step down would free a bed.
          Same health service only, up to three moves, every move checked.
        </p>
        <p className={styles.previewNote}>Preview data: some wards are shown full so plans appear.</p>
        {chains.length === 0 ? (
          <p className={styles.empty}>No eligible make-room plans available.</p>
        ) : (
          <ul className={styles.plans}>
            {chains.map((chain) => {
              const moves = movesOf(chain, nameOf);
              return (
                <li key={chain.movement.id} className={styles.plan}>
                  <PlanHeader chain={chain} moves={moves} now={now} />
                  <RouteStrip chain={chain} moves={moves} />
                  <Stepper moves={moves} bedReleases={bedReleases} />
                  <PlanFooter />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </WardPanel>
  );
}
