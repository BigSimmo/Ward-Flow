"use client";

/**
 * The side panels of the refined Handover page: the patient flow panel (what a coordinator needs
 * for one journey) and the sign-off sheet, which is what the panel shows when no patient is picked
 * (Josh, 9 Oct 2026: "the placeholder on the right is a sign off sheet for the handover").
 */
import Link from "next/link";
import { Check, ClipboardCopy, Clock, FileText, Route, Truck, UserRound, X } from "lucide-react";
import { Badge, Button, Card, Count, Icon, StatusGlyph, buttonClass, durMinutes } from "@/components/wf";
import { formatInstant, formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { MovementStage } from "@/components/ward-management/ward-model";
import { rowTone, type ColumnContext } from "./handover-columns";
import {
  isbarLines,
  legalLong,
  nextStep,
  obsLong,
  STAGE_LABEL,
  wardIsStale,
  type HandoverRow,
  type HandoverWard,
} from "./handover-model";
import styles from "./handover-refined.module.css";

const STEPS: { stage: MovementStage; label: string }[] = [
  { stage: "placement_requested", label: "Referred" },
  { stage: "destination_review", label: "Review" },
  { stage: "accepted_awaiting_bed", label: "Accepted" },
  { stage: "pulled", label: "Pulled" },
  { stage: "handover_ready", label: "Ready" },
  { stage: "moving", label: "Moving" },
];

function Stepper({ stage }: { stage: MovementStage }) {
  const current = STEPS.findIndex((step) => step.stage === stage);
  return (
    <ol className={styles.stepper} aria-label={`Journey, ${STAGE_LABEL[stage]}`}>
      {STEPS.map((step, index) => (
        <li
          key={step.stage}
          className={index < current ? styles.stepDone : index === current ? styles.stepCurrent : undefined}
          aria-current={index === current ? "step" : undefined}
        >
          <span className={styles.stepDot}>{index < current ? <Check size={11} aria-hidden="true" /> : null}</span>
          <span className={styles.stepLabel}>{step.label}</span>
        </li>
      ))}
    </ol>
  );
}

function WardCapacity({ ward, now }: { ward: HandoverWard | undefined; now: Instant }) {
  if (ward === undefined) return null;
  const stale = wardIsStale(ward, now);
  return (
    <span className={styles.cap}>
      <span className={`${styles.ready} ${ward.ready > 0 ? styles.readyOn : ""}`}>{ward.ready} ready</span>
      {ward.pendingPreparation > 0 ? <span>{ward.pendingPreparation} being made ready</span> : null}
      <span>
        {ward.occupied} of {ward.beds} in beds
      </span>
      <span className={stale ? styles.stale : undefined}>
        {stale ? <StatusGlyph tone="warning" size={8} /> : null}
        {durMinutes(now - ward.confirmedAt)} ago
      </span>
    </span>
  );
}

export function HandoverFlowPanel({
  row,
  ctx,
  wardOf,
  openPatientHref,
  onClose,
  onCopyIsbar,
}: {
  row: HandoverRow;
  ctx: ColumnContext;
  wardOf: (unitId: string) => HandoverWard | undefined;
  /** Built by the page, the one handover file allowed to read a patient link. */
  openPatientHref?: string;
  onClose: () => void;
  onCopyIsbar: (row: HandoverRow) => void;
}) {
  const { now } = ctx;
  const step = nextStep(row, now, ctx.cutoff, ctx.readyBeds);
  const hold = row.pullExpiresAt === undefined ? null : row.pullExpiresAt - now;
  const facts: [string, string][] = [
    ["Legal", legalLong(row)],
    [
      "Form time",
      row.formCode
        ? row.formDueAt !== undefined
          ? `${formatInstantWithDay(row.formDueAt, now)}, as typed`
          : "None typed"
        : "No form",
    ],
    ["Observation", obsLong(row)],
    [
      "Bed pull",
      row.pullExpiresAt === undefined
        ? row.stage === "pulled"
          ? "No pull time recorded"
          : "None"
        : hold !== null && hold <= 0
          ? `Expired ${formatInstantWithDay(row.pullExpiresAt, now)}`
          : `Until ${formatInstantWithDay(row.pullExpiresAt, now)}`,
    ],
    [
      "Transport",
      row.transport
        ? `${row.transport.leg ?? "Booked"}, ${row.transport.escort ? "escort" : "no escort"}`
        : "Not booked",
    ],
    ["Owner", row.owner],
    ["Escalated", row.escalated ? "Yes, state desk" : "No"],
    ["Referred", formatInstantWithDay(row.openedAt, now)],
  ];
  const stepIcon =
    step.tone === "act" ? (
      <StatusGlyph tone="danger" size={9} />
    ) : step.tone === "due" ? (
      <StatusGlyph tone="warning" size={9} />
    ) : (
      <Icon icon={Route} size={14} />
    );

  return (
    <Card
      as="section"
      className={styles.panel}
      aria-label={`Patient flow, ${row.name}`}
      data-testid="ward-handover-flow-panel"
    >
      <div className={styles.panelHead}>
        <StatusGlyph tone={rowTone(row, ctx)} />
        <div className={styles.panelName}>
          <b>{row.name}</b>
          <span>
            <span className={styles.mono}>{row.umrn}</span> · {row.edShort}
          </span>
        </div>
        <span className={styles.tier} aria-label={`Tier ${row.tier}`}>
          T{row.tier}
        </span>
        <Badge title={`Waiting since ${formatInstantWithDay(row.openedAt, now)}`}>
          <Icon icon={Clock} size={14} />
          <span className={styles.mono}>{durMinutes(now - row.openedAt)}</span>
        </Badge>
        <Button variant="ghost" size="sm" iconOnly icon={X} aria-label="Close patient" onClick={onClose} />
      </div>

      <div className={`${styles.next_box} ${styles[`box_${step.tone}`]}`}>
        <span className={styles.nextLabel}>
          {stepIcon}
          Next step
        </span>
        <span className={styles.nextText}>{step.text}</span>
      </div>

      <Stepper stage={row.stage} />

      <div className={styles.section}>
        <span className={styles.sectionHead}>Route</span>
        <div className={styles.route}>
          <span className={`${styles.pin} ${styles.pinFrom}`} />
          <span className={styles.routeBody}>
            <b>{row.edFull}</b>
            <span className={styles.cap}>Waiting since {formatInstantWithDay(row.openedAt, now)}</span>
          </span>
          <span className={styles.routeTime}>From</span>
        </div>
        {row.to ? (
          <div className={styles.route}>
            <span className={`${styles.pin} ${styles.pinTo}`} />
            <span className={styles.routeBody}>
              <b>{row.to.name}</b>
              <WardCapacity ward={wardOf(row.to.unitId)} now={now} />
            </span>
            <span className={styles.routeTime}>
              {row.stage === "moving" && row.eta !== undefined
                ? `ETA ${formatInstantWithDay(row.eta, now)}`
                : row.stage === "pulled"
                  ? "Bed pulled"
                  : "Accepted"}
            </span>
          </div>
        ) : row.asked.length ? (
          row.asked.map((ward) => (
            <div className={styles.route} key={ward.unitId}>
              <span className={`${styles.pin} ${styles.pinAsk}`} />
              <span className={styles.routeBody}>
                <b>{ward.name}</b>
                <WardCapacity ward={wardOf(ward.unitId)} now={now} />
              </span>
              <span className={styles.routeTime}>Reviewing</span>
            </div>
          ))
        ) : (
          <div className={styles.route}>
            <span className={`${styles.pin} ${styles.pinNone}`} />
            <span className={styles.routeBody}>
              <b className={styles.off}>{row.declines.length ? "No ward reviewing now" : "No ward asked yet"}</b>
            </span>
            <span />
          </div>
        )}
      </div>

      {row.declines.length ? (
        <div className={styles.section}>
          <span className={styles.sectionHead}>
            Declined <Count n={row.declines.length} />
          </span>
          <ul className={styles.timeline}>
            {[...row.declines].reverse().map((decline) => (
              <li key={`${decline.unitId}-${decline.at}`}>
                <span className={styles.mono}>{formatInstantWithDay(decline.at, now)}</span>
                <StatusGlyph tone="neutral" size={8} />
                <span>
                  {decline.name}, {decline.reason.toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className={styles.section}>
        <dl className={styles.facts}>
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd title={value}>{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionHead}>
          ISBAR
          <span className={styles.spacer} />
          <Button variant="ghost" size="sm" icon={ClipboardCopy} onClick={() => onCopyIsbar(row)}>
            Copy for EMR
          </Button>
        </span>
        <dl className={styles.isbar}>
          {isbarLines(row, now).map((line) => (
            <div key={line.key}>
              <dt title={line.label}>{line.key}</dt>
              <dd title={line.text}>{line.text}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className={styles.preview} title="Not wired in this prototype.">
        <Icon icon={FileText} size={14} />
        Note for next shift
        <span className={styles.previewTag}>Preview</span>
      </div>

      <div className={styles.panelFoot}>
        <Link href="/mockups/ward-flow/movements" className={buttonClass({ variant: "sec", size: "sm" })}>
          <Icon icon={Truck} size={14} />
          Movements
        </Link>
        {openPatientHref ? (
          <Link href={openPatientHref} className={buttonClass({ variant: "pri", size: "sm" })}>
            Open patient
          </Link>
        ) : (
          <Button variant="pri" size="sm" disabled disabledReason="UMRN not recorded">
            Open patient
          </Button>
        )}
      </div>
    </Card>
  );
}

export const HANDING_TO_ROLES = ["Evening flow coordinator", "After hours manager", "State bed desk"] as const;

export type SignOffCheck = { id: string; done: boolean; text: string; action?: { label: string; onClick: () => void } };

export function HandoverSignOffPanel({
  title,
  subtitle,
  checks,
  signedAt,
  now,
  canSignOff,
  cannotSignReason,
  onSignOff,
}: {
  title: string;
  subtitle: string;
  checks: SignOffCheck[];
  signedAt: Instant | null;
  now: Instant;
  canSignOff: boolean;
  cannotSignReason?: string;
  onSignOff: () => void;
}) {
  return (
    <Card
      as="section"
      className={styles.panel}
      aria-labelledby="ward-handover-sign-off-title"
      data-testid="ward-handover-sign-off"
    >
      <div className={styles.panelHead}>
        <Icon icon={Check} size={16} />
        <div className={styles.panelName}>
          <b id="ward-handover-sign-off-title">{title}</b>
          <span>{subtitle}</span>
        </div>
      </div>
      <div className={styles.section}>
        <span className={styles.sectionHead}>Before you sign</span>
        <ul className={styles.checks} data-testid="ward-handover-sign-off-checks">
          {checks.map((check) => (
            <li key={check.id}>
              <StatusGlyph tone={check.done ? "success" : "warning"} size={9} />
              <span>{check.text}</span>
              {check.action ? (
                <Button variant="ghost" size="sm" onClick={check.action.onClick}>
                  {check.action.label}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.section}>
        <span className={styles.sectionHead}>Handed over by</span>
        <div className={styles.who}>
          <Icon icon={UserRound} size={14} />
          <b>Flow coordinator</b>
          <span>you</span>
        </div>
      </div>
      <div className={styles.section}>
        <span className={styles.sectionHead}>
          Handing to <span className={styles.previewTag}>Preview</span>
        </span>
        <div className={styles.roles} title="Not wired in this prototype.">
          {HANDING_TO_ROLES.map((role) => (
            <span key={role} className={styles.role}>
              {role}
            </span>
          ))}
        </div>
        <span className={styles.label}>Not wired in this prototype. They confirm on their own login.</span>
      </div>
      {signedAt !== null ? (
        <div className={styles.section}>
          <div className={styles.signed} data-testid="ward-handover-sign-off-visible-status" role="status">
            <StatusGlyph tone="success" size={9} />
            Signed off at {formatInstantWithDay(signedAt, now)} as flow coordinator. Recorded in History.
          </div>
        </div>
      ) : null}
      <div className={styles.signFoot}>
        <Button
          variant="pri"
          size="sm"
          icon={Check}
          onClick={onSignOff}
          disabled={!canSignOff}
          disabledReason={cannotSignReason}
          data-testid="ward-handover-sign-off-button"
        >
          {signedAt !== null ? `Sign off again at ${formatInstant(now)}` : `Sign off at ${formatInstant(now)}`}
        </Button>
      </div>
    </Card>
  );
}
