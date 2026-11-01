"use client";

/**
 * The side panels of the refined Handover page: the patient flow panel (what a coordinator needs
 * for one journey) and the sign-off sheet, which is what the panel shows when no patient is picked
 * (Josh, 9 Oct 2026: "the placeholder on the right is a sign off sheet for the handover").
 */
import Link from "next/link";
import dynamic from "next/dynamic";
import { useId } from "react";
import { Check, ClipboardCopy, Clock, Route, Truck, UserRound, X } from "lucide-react";
import { Badge, Button, Card, Count, Icon, SrOnly, StatusGlyph, buttonClass, durMinutes } from "@/components/wf";
import { formatInstant, formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { MovementStage } from "@/components/ward-management/ward-model";
import { CHROME_ROLE_LABELS, type WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import { rowTone, type ColumnContext } from "./handover-columns";
import { bedHold } from "@/components/ward-management/ward-bed-hold";
import { noFormWords } from "@/components/ward-management/ward-legal-status";
import {
  isbarLines,
  isCollected,
  legalLong,
  nextStep,
  obsLong,
  pullHasLapsed,
  STAGE_LABEL,
  wardIsStale,
  type HandoverRow,
  type HandoverWard,
} from "./handover-model";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { handoverScopeValue } from "./handover-scope";
import styles from "./handover-refined.module.css";

/* Q40, Q61 to Q63 (Josh, 31 Oct 2026): the site bed manager's own site sign-off. Its code loads only
   for that login, so no other desk's first load grows. */
const SiteSignOff = dynamic(() => import("./handover-site-sign-off").then((m) => m.HandoverSiteSignOff), {
  loading: () => null,
});

/** The site sign-off, shown only to a site bed manager at its own site; nothing for any other desk. */
export function HandoverSiteSignOffSlot({ phone, onScope }: { phone: boolean; onScope: (scopeValue: string) => void }) {
  const access = useEffectiveWardAccess();
  if (access.role !== "bed_manager" || access.scope.kind !== "site") return null;
  return (
    <SiteSignOff
      siteCode={access.scope.siteCode}
      phone={phone}
      onOpenWard={(id) => onScope(handoverScopeValue({ kind: "ward", id }))}
    />
  );
}

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
        : noFormWords(row.legalStatus),
    ],
    ["Observation", obsLong(row)],
    [
      "Bed pull",
      row.pullExpiresAt === undefined
        ? row.stage === "pulled"
          ? "No pull time recorded"
          : "None"
        : isCollected(row)
          ? `Pulled while the patient is in transit (until ${formatInstantWithDay(row.pullExpiresAt, now)})`
          : hold !== null && pullHasLapsed(row, now)
            ? `${bedHold(row.pullExpiresAt, now)!.label}, at ${formatInstantWithDay(row.pullExpiresAt, now)}`
            : `Until ${formatInstantWithDay(row.pullExpiresAt, now)}, ${bedHold(row.pullExpiresAt, now)!.short}`,
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
        <span className={styles.tier}>
          <span aria-hidden="true">T{row.tier}</span>
          <SrOnly>Tier {row.tier}</SrOnly>
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
          {isbarLines(row, now, ctx.readyBeds).map((line) => (
            <div key={line.key}>
              <dt title={line.label}>{line.key}</dt>
              <dd title={line.text}>{line.text}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className={styles.panelFoot}>
        <Link href="/ward-flow/movements" className={buttonClass({ variant: "sec", size: "sm" })}>
          <Icon icon={Truck} size={14} />
          Movements
        </Link>
        {openPatientHref ? (
          <Link href={openPatientHref} className={buttonClass({ variant: "pri", size: "sm" })}>
            Open patient
          </Link>
        ) : (
          <Button variant="pri" size="sm" disabledReason="UMRN not recorded">
            Open patient
          </Button>
        )}
      </div>
    </Card>
  );
}

export type SignOffCheck = { id: string; done: boolean; text: string; action?: { label: string; onClick: () => void } };

export function HandoverSignOffPanel({
  title,
  subtitle,
  checks,
  signedAt,
  signedBy = null,
  viewerRole = "coordinator",
  now,
  canSignOff,
  cannotSignReason,
  onSignOff,
  onUndoSignOff,
}: {
  title: string;
  subtitle: string;
  checks: SignOffCheck[];
  signedAt: Instant | null;
  /** The role recorded on this shift's sign-off, as History shows it; null while unsigned. */
  signedBy?: WardFlowRole | null;
  /** The desk viewing the page, who would sign an unsigned handover. */
  viewerRole?: WardChromeRole;
  now: Instant;
  canSignOff: boolean;
  cannotSignReason?: string;
  onSignOff: () => void;
  /** Takes back this shift's sign-off. Once signed, the foot offers this instead of a second sign-off. */
  onUndoSignOff: () => void;
}) {
  const baseId = useId();
  // Codex P2 on #707: a recorded sign-off names the role on its record (as History does), never the
  // desk that happens to be viewing it; only an unsigned handover names the viewer, who would sign.
  const signer = signedAt !== null && signedBy !== null ? signedBy : viewerRole;
  const signerLabel =
    signer === "coordinator" ? "Bed coordinator" : signer === "demo" ? "Demo" : CHROME_ROLE_LABELS[signer];
  const signerIsYou = signedAt === null || signedBy === null || signedBy === viewerRole;
  return (
    <Card
      as="section"
      className={styles.panel}
      aria-labelledby={`${baseId}-ward-handover-sign-off-title`}
      data-testid="ward-handover-sign-off"
    >
      <div className={styles.panelHead}>
        <Icon icon={Check} size={16} />
        <div className={styles.panelName}>
          <b id={`${baseId}-ward-handover-sign-off-title`}>{title}</b>
          <span>{subtitle}</span>
        </div>
      </div>
      <div className={styles.section}>
        <span className={styles.sectionHead}>
          Before you sign
          <span className={styles.checksDone}>
            {checks.filter((check) => check.done).length} of {checks.length} clear
          </span>
        </span>
        <span className={styles.checkMeter} aria-hidden="true">
          {checks.map((check) => (
            <i key={check.id} data-done={check.done ? "true" : undefined} />
          ))}
        </span>
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
          <b>{signerLabel}</b>
          {signerIsYou ? <span>you</span> : null}
        </div>
      </div>
      {signedAt !== null ? (
        <div className={styles.section}>
          <div className={styles.signed} data-testid="ward-handover-sign-off-visible-status" role="status">
            <StatusGlyph tone="success" size={9} />
            Signed off at {formatInstantWithDay(signedAt, now)} as {signerLabel.toLowerCase()}. Recorded in History.
          </div>
        </div>
      ) : null}
      <div className={styles.signFoot}>
        {signedAt !== null ? (
          // A4-27 (audit round 2): once signed, no second primary. The signed time shows above.
          <Button variant="ghost" size="sm" onClick={onUndoSignOff} data-testid="ward-handover-sign-off-undo">
            Undo sign-off
          </Button>
        ) : (
          <Button
            variant="pri"
            size="sm"
            icon={Check}
            onClick={onSignOff}
            disabledReason={!canSignOff ? (cannotSignReason ?? "Complete sign-off checks first") : cannotSignReason}
            data-testid="ward-handover-sign-off-button"
          >
            {`Sign off at ${formatInstant(now)}`}
          </Button>
        )}
      </div>
    </Card>
  );
}
