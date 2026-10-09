"use client";

import { wardAddressing } from "@/components/ward-management/ward-eligibility";
import { lockedBedsFree } from "@/components/ward-management/ward-bed-designation";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ClipboardCopy, Copy, FileText, ListOrdered, Phone, TriangleAlert } from "lucide-react";

import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { Referral, Unit } from "@/components/ward-management/ward-model";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { BedRelease, LeaveBed } from "@/components/ward-management/ward-model";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import { siteByCode } from "@/components/ward-management/ward-sites";
import {
  OVERDUE_AFTER_ANY_TIER_MINUTES,
  OVERDUE_AFTER_MINUTES_BY_TIER,
} from "@/components/ward-management/ward-operational-defaults";
import {
  COMMUNITY_DECLINE_REASON_LABELS,
  DECLINE_REASON_LABELS,
  candidateAccepts,
  referralCandidates,
  referralClocks,
  referralDestinationLabel,
} from "@/components/ward-management/ward-referrals";
import { Button, Sheet, StatusGlyph, TierTile, cx, durMinutes } from "@/components/wf";

import { getReferralPriority } from "./referral-priority";
import {
  CLEARANCE_CHECKS,
  CLEARANCE_CHECK_LABELS,
  CLEARANCE_STATUS_LABELS,
  type ClearanceStatus,
} from "./referral-submission";
import { ReferralDocumentLinks } from "./referral-flow-panels";
import styles from "./referral-board.module.css";

/** The page's one link for counts that open the bed picture. Places lists every ward's ready beds. */
export const REFERRAL_BEDS_HREF = "/mockups/ward-flow/hub";

/** D4: the exact words for a control that is shown for review but not connected. */
export const NOT_WIRED = "Not wired in this prototype.";

export const REFERRAL_SOURCE_WORDS: Record<Referral["source"], string> = {
  community: "Community team",
  crisis_service: "Crisis service",
  police: "Police",
  ambulance: "Ambulance",
  inter_hospital: "Inter-hospital",
  ed_medical: "ED medical staff",
  gp: "GP",
  psychiatric_ward: "Psychiatric ward",
};

const KIND_SHORT: Record<Referral["destinations"][number]["destination"]["kind"], string> = {
  psychiatric_ward: "Ward bed",
  emergency_department: "ED review",
  community_team: "Community",
};

/** An answer still open: queued and not withdrawn by the referrer. */
export function openArms(referral: Referral) {
  return referral.destinations.filter((arm) => arm.state === "queued" && arm.withdrawnAt === undefined);
}

/** The live ward request, or the first recorded one when all are answered (`wardAddressing`). */
export function wardArm(referral: Referral) {
  const arm = wardAddressing(referral);
  return arm ? { arm, destination: arm.destination } : undefined;
}

/** What the referral still asks for, in a few words ("Ward bed and ED review"). */
export function askingForShort(referral: Referral): string {
  const open = openArms(referral);
  return open.length > 0 ? open.map((arm) => KIND_SHORT[arm.destination.kind]).join(" and ") : "Nothing open";
}

/** The bed needs the referrer ticked, as words. Only what the record holds. */
export function needWords(referral: Referral): string[] {
  const ward = wardArm(referral)?.destination;
  const words: string[] = [];
  if (ward) words.push(ward.secureBedNeeded ? "Secure bed" : "Open bed");
  if (ward?.involuntaryBedNeeded) words.push("involuntary");
  if (ward?.highAcuityNursingNeeded) words.push("high acuity");
  if (referral.transportNeeded) words.push("transport");
  return words;
}

/** How many units accept the ward arm right now, or undefined when no ward bed is still asked for. */
export function readyUnitCount(referral: Referral, units: Unit[], now: Instant): number | undefined {
  const ward = wardArm(referral);
  if (!ward || ward.arm.state !== "queued" || ward.arm.withdrawnAt !== undefined) return undefined;
  return referralCandidates(referral, ward.destination, units, now).filter(candidateAccepts).length;
}

export function declineReasonWords(reason: string | undefined): string {
  if (!reason) return "Reason not recorded";
  return (
    (DECLINE_REASON_LABELS as Record<string, string>)[reason] ??
    (COMMUNITY_DECLINE_REASON_LABELS as Record<string, string>)[reason] ??
    reason
  );
}

export function isOverdue(referral: Referral, now: Instant): boolean {
  return getReferralPriority(referral, now) === "overdue";
}

/** The tier's own window, or the any-tier one if that is shorter (Josh's defaults, not legal limits). */
export function decisionWindow(referral: Referral): number {
  return Math.min(OVERDUE_AFTER_MINUTES_BY_TIER[referral.urgency], OVERDUE_AFTER_ANY_TIER_MINUTES);
}

/* ─── Hero band: the waiting runway ─────────────────────────────────────────────────────────── */

/** Piecewise axis: each tier's due time takes an equal share, so a 3 day wait and a 20 minute wait
 *  can sit on one line without the short ones collapsing into a dot. */
const RUNWAY_STOPS: readonly (readonly [number, number])[] = [
  [0, 0],
  [OVERDUE_AFTER_MINUTES_BY_TIER[1], 25],
  [OVERDUE_AFTER_MINUTES_BY_TIER[2], 50],
  [OVERDUE_AFTER_MINUTES_BY_TIER[3], 75],
  [OVERDUE_AFTER_ANY_TIER_MINUTES, 100],
];

function runwayPercent(minutes: number): number {
  const m = Math.max(0, minutes);
  for (let index = 1; index < RUNWAY_STOPS.length; index += 1) {
    const [fromMinutes, fromPercent] = RUNWAY_STOPS[index - 1]!;
    const [toMinutes, toPercent] = RUNWAY_STOPS[index]!;
    if (m <= toMinutes)
      return fromPercent + ((m - fromMinutes) / (toMinutes - fromMinutes)) * (toPercent - fromPercent);
  }
  return 100;
}

function hoursLabel(minutes: number): string {
  return `${Math.round(minutes / 60)}h`;
}

export function WaitRunway({
  queued,
  now,
  selectedId,
  isHighlighted,
  nameOf,
  onSelect,
  compact = false,
}: {
  queued: Referral[];
  now: Instant;
  selectedId: string | undefined;
  isHighlighted: (referral: Referral) => boolean;
  nameOf: (referral: Referral) => string;
  onSelect: (referralId: string) => void;
  compact?: boolean;
}) {
  // Shortest wait first, so the lanes stack upward from the left the way the eye reads them.
  const placed: { referral: Referral; x: number; lane: number; minutes: number }[] = [];
  const laneEnds: number[] = [];
  const gap = compact ? 8 : 4;
  for (const referral of [...queued].sort((a, b) => b.raisedAt - a.raisedAt)) {
    const minutes = referralClocks(referral, now).sinceReferral;
    const x = runwayPercent(minutes);
    let lane = 0;
    while (laneEnds[lane] !== undefined && x - laneEnds[lane]! < gap) lane += 1;
    laneEnds[lane] = x;
    placed.push({ referral, x, lane, minutes });
  }
  const lanes = Math.max(1, laneEnds.length);
  const ticks = [
    { at: 0, label: "0", tier: "" },
    { at: OVERDUE_AFTER_MINUTES_BY_TIER[1], label: hoursLabel(OVERDUE_AFTER_MINUTES_BY_TIER[1]), tier: "T1" },
    { at: OVERDUE_AFTER_MINUTES_BY_TIER[2], label: hoursLabel(OVERDUE_AFTER_MINUTES_BY_TIER[2]), tier: "T2" },
    { at: OVERDUE_AFTER_MINUTES_BY_TIER[3], label: hoursLabel(OVERDUE_AFTER_MINUTES_BY_TIER[3]), tier: "T3" },
    { at: OVERDUE_AFTER_ANY_TIER_MINUTES, label: hoursLabel(OVERDUE_AFTER_ANY_TIER_MINUTES), tier: "any" },
  ];
  return (
    <div className={cx(styles.runway, compact && styles.runwayCompact)} data-testid="ward-referral-runway">
      <div className={styles.bandHead}>
        <span className={styles.bandEyebrow}>Waiting</span>
        <span className={styles.bandKey}>
          <TriangleAlert size={12} aria-hidden="true" />
          overdue
        </span>
      </div>
      <div
        className={styles.runwayTrack}
        style={{ height: `calc(${lanes} * 1.625rem + 0.5rem)` }}
        role="group"
        aria-label="Waiting time against each tier's decision window"
      >
        {[0, 25, 50, 75].map((left) => (
          <span key={left} className={styles.runwaySeg} style={{ left: `${left}%` }} aria-hidden="true" />
        ))}
        {placed.map(({ referral, x, lane, minutes }) => {
          const overdue = isOverdue(referral, now);
          const name = nameOf(referral);
          return (
            <button
              key={referral.id}
              type="button"
              className={cx(
                styles.runwayMarker,
                overdue && styles.runwayMarkerOverdue,
                selectedId === referral.id && styles.runwayMarkerOn,
                isHighlighted(referral) && styles.runwayMarkerHl,
              )}
              style={{ left: `${x}%`, bottom: `calc(${lane} * 1.625rem + 0.375rem)` }}
              title={`${name}, tier ${referral.urgency}, waiting ${durMinutes(minutes)}${overdue ? ", overdue" : ""}`}
              aria-label={`${name}, tier ${referral.urgency}, waiting ${durMinutes(minutes)}${overdue ? ", overdue" : ""}`}
              aria-pressed={selectedId === referral.id}
              onClick={() => onSelect(referral.id)}
            >
              {overdue ? <TriangleAlert size={12} aria-hidden="true" /> : referral.urgency}
            </button>
          );
        })}
      </div>
      <div className={styles.runwayAxis} aria-hidden="true">
        {ticks.map((tick) => (
          <span key={tick.label} style={{ left: `${runwayPercent(tick.at)}%` }}>
            <b>{tick.label}</b>
            {tick.tier && !compact ? <span className={styles.tickTier}> {tick.tier} due</span> : null}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Hero band: beds ready statewide ───────────────────────────────────────────────────────── */

export type BedsReadySummary = { cells: { label: string; value: number }[]; oldestUpdateMinutes: number | undefined };

export function bedsReadySummary(
  units: Unit[],
  admissions: readonly Admission[],
  bedReleases: BedRelease[],
  leaveBeds: readonly LeaveBed[],
  now: Instant,
): BedsReadySummary {
  const totals = { Adult: 0, "Older adult": 0, Youth: 0, Locked: 0 };
  let oldest: number | undefined;
  for (const unit of units) {
    // Every unit counts: a unit without authorisation still takes voluntary admissions.
    const ready = bedStates(unit, admissions, bedReleases, leaveBeds).ready;
    totals[unit.cohort] += ready;
    // Locked is the ready locked portion of any ward, mixed wards included.
    totals.Locked += Math.min(ready, lockedBedsFree(unit));
    const age = Math.max(0, now - unit.allocatable.confirmedAt);
    oldest = oldest === undefined ? age : Math.max(oldest, age);
  }
  return {
    cells: (Object.keys(totals) as (keyof typeof totals)[]).map((label) => ({ label, value: totals[label] })),
    oldestUpdateMinutes: oldest,
  };
}

export function BedsReady({ summary, compact = false }: { summary: BedsReadySummary; compact?: boolean }) {
  return (
    <div className={cx(styles.beds, compact && styles.bedsCompact)} data-testid="ward-referral-beds-ready">
      <div className={styles.bandHead}>
        <span className={styles.bandEyebrow}>Beds ready statewide</span>
        {summary.oldestUpdateMinutes !== undefined ? (
          <span className={styles.bandKey} title="Oldest ward bed confirmation">
            oldest update <span className={styles.mono}>{durMinutes(summary.oldestUpdateMinutes)}</span>
          </span>
        ) : null}
      </div>
      <div className={styles.bedCells}>
        {summary.cells.map((cell) => (
          <Link
            key={cell.label}
            href={REFERRAL_BEDS_HREF}
            className={styles.bedCell}
            aria-label={`${cell.value} ${cell.label.toLowerCase()} beds ready. Open Places`}
          >
            <b>{cell.value}</b>
            <span>{cell.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ─── Bed meeting list ──────────────────────────────────────────────────────────────────────── */

export type MeetingRow = {
  referral: Referral;
  name: string;
  umrn: string;
};

function waitWords(referral: Referral, now: Instant): { waited: string; due: string; overdue: boolean } {
  const clocks = referralClocks(referral, now);
  const overdue = isOverdue(referral, now);
  const dueAt = referral.raisedAt + decisionWindow(referral);
  if (!clocks.sinceReferralRunning) return { waited: durMinutes(clocks.sinceReferral), due: "clock stopped", overdue };
  return {
    waited: durMinutes(clocks.sinceReferral),
    due: overdue ? `${durMinutes(now - dueAt)} overdue` : `due in ${durMinutes(dueAt - now)}`,
    overdue,
  };
}

export function WaitCell({ referral, now }: { referral: Referral; now: Instant }) {
  const { waited, due, overdue } = waitWords(referral, now);
  return (
    <span className={cx(styles.wait, overdue && styles.waitOver)}>
      <b>{waited}</b>
      <span>
        {overdue ? <TriangleAlert size={12} aria-hidden="true" /> : null}
        {due}
      </span>
    </span>
  );
}

function meetingText(rows: MeetingRow[], now: Instant): string {
  return rows
    .map((row, index) => {
      const { waited, due } = waitWords(row.referral, now);
      return [
        `${index + 1}. T${row.referral.urgency} ${row.name} (${row.umrn})`,
        `waiting ${waited}, ${due}`,
        `from ${row.referral.originSiteCode}`,
        `asking for ${askingForShort(row.referral)}`,
        needWords(row.referral).join(", ") || "no bed needs recorded",
      ].join(" | ");
    })
    .join("\n");
}

/** Copies to the clipboard, then says so in the button. Clipboard refusals fall back to no change. */
function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="pri"
      size="sm"
      icon={ClipboardCopy}
      onClick={() => {
        void navigator.clipboard
          ?.writeText(text)
          .then(() => setCopied(true))
          .catch(() => setCopied(false));
      }}
    >
      {copied ? "Copied" : label}
    </Button>
  );
}

export function BedMeetingSheet({
  open,
  onClose,
  rows,
  now,
  summary,
}: {
  open: boolean;
  onClose: () => void;
  rows: MeetingRow[];
  now: Instant;
  summary: BedsReadySummary;
}) {
  const overdue = rows.filter((row) => isOverdue(row.referral, now)).length;
  const tier1 = rows.filter((row) => row.referral.urgency === 1).length;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Bed meeting list"
      description="Queue order, longest wait first. Tier breaks ties."
      contentClassName={styles.meetingSheet}
      footer={
        <div className={styles.sheetFoot}>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
          <CopyButton text={meetingText(rows, now)} label="Copy list" />
        </div>
      }
    >
      <div className={styles.meetingSummary}>
        <span>
          <b>{overdue}</b> overdue
        </span>
        <span>
          <b>{tier1}</b> tier 1
        </span>
        {summary.cells.slice(0, 3).map((cell) => (
          <span key={cell.label}>
            <b>{cell.value}</b> {cell.label.toLowerCase()} beds ready
          </span>
        ))}
      </div>
      <WardTable
        className={styles.meetingTable}
        wrapperClassName={styles.meetingScroll}
        testId="ward-referral-meeting-table"
        ariaLabel="Bed meeting list"
      >
        <thead>
          <tr>
            <th scope="col" className={styles.deskOnly}>
              #
            </th>
            <th scope="col">Tier</th>
            <th scope="col">Patient</th>
            <th scope="col">Since referral</th>
            <th scope="col" className={styles.deskOnly}>
              From
            </th>
            <th scope="col" className={styles.deskOnly}>
              Asking for
            </th>
            <th scope="col" className={styles.deskOnly}>
              Needs
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.referral.id} data-overdue={isOverdue(row.referral, now) ? "true" : undefined}>
              <td className={cx(styles.mono, styles.deskOnly)}>{index + 1}</td>
              <td>
                <TierTile tier={row.referral.urgency} />
              </td>
              <td>
                <span className={styles.who}>
                  <b>{row.name}</b>
                  <span>
                    <span className={styles.mono}>{row.umrn}</span>
                    <span className={styles.phoneOnly}>
                      {" "}
                      · {row.referral.originSiteCode} to {askingForShort(row.referral)}
                    </span>
                  </span>
                </span>
              </td>
              <td>
                <WaitCell referral={row.referral} now={now} />
              </td>
              <td className={cx(styles.mono, styles.deskOnly)} title={siteByCode(row.referral.originSiteCode)?.name}>
                {row.referral.originSiteCode}
              </td>
              <td className={styles.deskOnly}>{askingForShort(row.referral)}</td>
              <td className={styles.deskOnly}>{needWords(row.referral).join(", ") || "None recorded"}</td>
            </tr>
          ))}
        </tbody>
      </WardTable>
    </Sheet>
  );
}

/* ─── Selected referral: alerts, decision clock and ISBAR summary ───────────────────────────── */

export function ReferralAlerts({ referral, readmission }: { referral: Referral; readmission: ReactNode }) {
  const intake = referral.intake;
  const risks = intake?.riskFlags ?? [];
  const legal = intake?.legalStatus?.trim();
  const showLegal = legal !== undefined && legal !== "" && !/^voluntary/i.test(legal);
  if (risks.length === 0 && !readmission && !showLegal) return null;
  return (
    <div className={styles.alerts} aria-label="Alerts" role="group">
      {risks.map((risk) => (
        <span key={risk} className={styles.alert}>
          <StatusGlyph tone="warning" size={9} />
          {risk.charAt(0).toUpperCase() + risk.slice(1)} risk
        </span>
      ))}
      {readmission}
      {showLegal ? <span className={cx(styles.alert, styles.alertQuiet)}>{legal}</span> : null}
    </div>
  );
}

export function DecisionClock({ referral, now }: { referral: Referral; now: Instant }) {
  const clocks = referralClocks(referral, now);
  const window = decisionWindow(referral);
  const dueAt = referral.raisedAt + window;
  const overdue = isOverdue(referral, now);
  const used = Math.min(100, Math.round((clocks.sinceReferral / window) * 100));
  // A clock stopped at triage owes nothing more, so it never warns.
  const near = clocks.sinceReferralRunning && !overdue && used >= 75;
  const tone = overdue ? "danger" : near ? "warning" : "neutral";
  return (
    <div
      className={styles.clock}
      data-tone={tone}
      data-testid={`ward-referral-clock-${referral.id}`}
      title={`Sent ${formatInstantWithDay(referral.raisedAt, now)}. Tier ${referral.urgency} decision window ${durMinutes(window)}.`}
    >
      <div className={styles.clockTop}>
        <span>
          <b className={styles.mono}>{durMinutes(clocks.sinceReferral)}</b> waiting
        </span>
        <span className={styles.clockLeft}>
          {!clocks.sinceReferralRunning ? (
            "Clock stopped at triage"
          ) : overdue ? (
            <>
              <TriangleAlert size={12} aria-hidden="true" />
              <b className={styles.mono}>{durMinutes(now - dueAt)}</b> overdue
            </>
          ) : (
            <>
              {near ? <StatusGlyph tone="warning" size={9} /> : null}
              <b className={styles.mono}>{durMinutes(dueAt - now)}</b> left · due{" "}
              <span className={styles.mono}>{formatInstantWithDay(dueAt, now)}</span>
            </>
          )}
        </span>
      </div>
      <div
        className={styles.clockTrack}
        role="img"
        aria-label={`${used}% of the tier ${referral.urgency} decision window used`}
      >
        <i style={{ width: `${used}%` }} />
      </div>
    </div>
  );
}

function isbarText(referral: Referral, name: string, umrn: string, demographics: string, now: Instant): string {
  const intake = referral.intake;
  const { waited, due } = waitWords(referral, now);
  const site = siteByCode(referral.originSiteCode)?.name ?? referral.originSiteCode;
  return [
    `Identify: ${name}, ${umrn}, ${demographics}.`,
    `Situation: tier ${referral.urgency} referral from ${site} (${REFERRAL_SOURCE_WORDS[referral.source]}), waiting ${waited}, ${due}. Asking for ${askingForShort(referral)}.`,
    `Background: ${intake?.reasonForReferral?.trim() || "Reason not recorded"}. Legal status ${intake?.legalStatus?.trim() || "not recorded"}.`,
    `Assessment: risk flags ${intake?.riskFlags.join(", ") || "not recorded"}. Medical clearance ${intake ? (intake.medicalClearance.cleared ? "cleared" : "pending") : "not recorded"}.`,
    `Recommendation: ${needWords(referral).join(", ") || "no bed needs recorded"}.`,
  ].join("\n");
}

export function IsbarSheet({
  open,
  onClose,
  referral,
  name,
  umrn,
  demographics,
  now,
}: {
  open: boolean;
  onClose: () => void;
  referral: Referral;
  name: string;
  umrn: string;
  demographics: string;
  now: Instant;
}) {
  const text = isbarText(referral, name, umrn, demographics, now);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Referral summary"
      description="ISBAR, from what the referral records. Nothing here is inferred."
      footer={
        <div className={styles.sheetFoot}>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
          <CopyButton text={text} label="Copy summary" />
        </div>
      }
    >
      <dl className={styles.isbar}>
        {text.split("\n").map((line) => {
          const [head, ...rest] = line.split(": ");
          return (
            <div key={head}>
              <dt>{head}</dt>
              <dd>{rest.join(": ")}</dd>
            </div>
          );
        })}
      </dl>
    </Sheet>
  );
}

export const REFERRAL_SHORTCUTS: readonly (readonly [string, string])[] = [
  ["J", "Next referral"],
  ["K", "Previous referral"],
  ["1 2 3", "Place, Patient or Timeline"],
  ["O", "Next overdue referral"],
  ["S", "Referral summary"],
  ["M", "Bed meeting list"],
  ["Esc", "Close the referral"],
  ["?", "These shortcuts"],
];

export function ShortcutsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Keyboard shortcuts">
      <dl className={styles.keys}>
        {REFERRAL_SHORTCUTS.map(([key, words]) => (
          <div key={key}>
            <dt>
              {key.split(" ").map((part) => (
                <kbd key={part}>{part}</kbd>
              ))}
            </dt>
            <dd>{words}</dd>
          </div>
        ))}
      </dl>
    </Sheet>
  );
}

/* ─── Selected referral: Patient tab ────────────────────────────────────────────────────────── */

const CLEARANCE_GLYPH: Record<ClearanceStatus, "success" | "neutral" | "closed"> = {
  done: "success",
  to_follow: "neutral",
  not_done: "closed",
};

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className={styles.pSection}>
      <div className={styles.pSectionHead}>
        <h3>{title}</h3>
        {aside ? <span>{aside}</span> : null}
      </div>
      {children}
    </section>
  );
}

export function ReferralPatientTab({
  referral,
  now,
  readyUnits,
}: {
  referral: Referral;
  now: Instant;
  readyUnits: number | undefined;
}) {
  const intake = referral.intake;
  const ward = wardArm(referral)?.destination;
  const [historyOpen, setHistoryOpen] = useState(false);
  const history = referral.history?.trim() ?? "";
  const longHistory = history.length > 180;
  const checks = intake?.clearanceChecklist;
  const checkRows = checks ? CLEARANCE_CHECKS.filter((check) => checks[check] !== undefined) : [];
  const done = checkRows.filter((check) => checks?.[check] === "done").length;
  const site = siteByCode(referral.originSiteCode)?.name ?? referral.originSiteCode;
  const needs = [
    { label: "Bed", value: ward ? (ward.secureBedNeeded ? "Secure" : "Open") : "Not asked", on: ward?.secureBedNeeded },
    {
      label: "Legal",
      value: ward ? (ward.involuntaryBedNeeded ? "Involuntary bed" : "Not involuntary") : "Not asked",
      on: ward?.involuntaryBedNeeded,
    },
    {
      label: "Nursing",
      value: ward ? (ward.highAcuityNursingNeeded ? "High acuity" : "Standard") : "Not asked",
      on: ward?.highAcuityNursingNeeded,
    },
    { label: "Sex", value: ward ? ward.sex : "Not asked", on: false },
    { label: "Transport", value: referral.transportNeeded ? "Requested" : "Not asked", on: referral.transportNeeded },
    { label: "Units ready", value: readyUnits === undefined ? "No bed asked" : String(readyUnits), on: false },
  ];
  return (
    <div className={styles.pTab} data-testid="ward-referral-patient-tab">
      <Section title="Presentation" aside={intake ? "From the referral form" : "Raised before the referral form"}>
        {intake?.reasonForReferral?.trim() ? (
          <p className={styles.pLead}>{intake.reasonForReferral}</p>
        ) : (
          <p className={styles.pMuted}>Reason for referral not recorded on this referral.</p>
        )}
        <dl className={styles.pCells}>
          <div>
            <dt>Triage category</dt>
            <dd>{referral.atsCategory !== undefined ? `ATS ${referral.atsCategory}` : "Not recorded"}</dd>
          </div>
          <div>
            <dt>Home</dt>
            <dd>{referral.suburb.kind === "named" ? referral.suburb.name : referral.homeRegion}</dd>
          </div>
          <div>
            <dt>Referral raised</dt>
            <dd>{formatInstantWithDay(referral.raisedAt, now)}</dd>
          </div>
        </dl>
      </Section>

      {intake ? (
        <Section
          title="Ready to transfer"
          aside={
            intake.medicalClearance.cleared
              ? "Medically cleared"
              : `Clearance expected ${intake.medicalClearance.expectedAt?.slice(11, 16) ?? "time not recorded"}`
          }
        >
          {checkRows.length > 0 ? (
            <div className={styles.ready}>
              <div className={styles.readyBar} role="img" aria-label={`${done} of ${checkRows.length} checks done`}>
                {checkRows.map((check) => (
                  <i key={check} data-state={checks?.[check]} />
                ))}
              </div>
              <span className={styles.mono}>
                {done} of {checkRows.length} done
              </span>
            </div>
          ) : null}
          <ul className={styles.checks}>
            {checkRows.map((check) => (
              <li key={check}>
                <StatusGlyph tone={CLEARANCE_GLYPH[checks![check]!]} size={9} />
                <span>{CLEARANCE_CHECK_LABELS[check]}</span>
                <span className={styles.checkState}>{CLEARANCE_STATUS_LABELS[checks![check]!]}</span>
              </li>
            ))}
            <li>
              <StatusGlyph tone={intake.triageAndRampCompleted ? "success" : "neutral"} size={9} />
              <span>Triage and RAMP</span>
              <span className={styles.checkState}>{intake.triageAndRampCompleted ? "Done" : "Not completed"}</span>
            </li>
          </ul>
        </Section>
      ) : null}

      <Section title="Bed needs">
        <div className={styles.needGrid}>
          {needs.map((need) => (
            <div key={need.label} className={cx(styles.need, need.on && styles.needOn)}>
              <span>{need.label}</span>
              <b>{need.value}</b>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Referrer">
        <div className={styles.contact}>
          <span className={styles.who}>
            <b>{intake?.referrer.name ?? "Not recorded"}</b>
            <span>
              {intake
                ? `${intake.referrer.role} · ${intake.referrer.location}`
                : `${REFERRAL_SOURCE_WORDS[referral.source]} · ${site}`}
            </span>
          </span>
          {intake?.referrer.phone ? (
            <>
              <span className={styles.mono}>{intake.referrer.phone}</span>
              <Button
                variant="ghost"
                size="sm"
                icon={Copy}
                iconOnly
                aria-label="Copy the referrer's number"
                onClick={() => void navigator.clipboard?.writeText(intake.referrer.phone).catch(() => undefined)}
              />
            </>
          ) : null}
          <Button
            variant="sec"
            size="sm"
            icon={Phone}
            disabledReason={intake?.referrer.phone ? NOT_WIRED : "No phone number recorded on this referral."}
            reasonDisplay="tooltip"
          >
            Call
          </Button>
        </div>
        <dl className={styles.pCells}>
          <div>
            <dt>Direct contact</dt>
            <dd>{intake?.referrer.phone || "Not recorded"}</dd>
          </div>
          <div>
            <dt>Facility</dt>
            <dd>{site}</dd>
          </div>
        </dl>
        {intake?.charts.length ? <ReferralDocumentLinks charts={intake.charts} /> : null}
      </Section>

      <Section title="Recorded legal information" aside="For the receiving unit">
        <p className={styles.pMuted}>
          Referral details do not establish consent, detention authority or a register check.
        </p>
        <ul className={styles.checks}>
          <li>
            <StatusGlyph tone="neutral" size={9} />
            <span>Consent or detention authority</span>
            <span className={styles.checkState}>Not recorded in this referral</span>
          </li>
          <li>
            <StatusGlyph tone="neutral" size={9} />
            <span>Chief Psychiatrist register check</span>
            <span className={styles.checkState}>Register check not recorded on this referral.</span>
          </li>
        </ul>
        <p className={styles.pMuted}>
          {intake?.legalStatus ?? "Legal document details are not recorded on this referral."}
        </p>
      </Section>

      <Section title="Written history">
        {history ? (
          <>
            <p className={cx(styles.pText, longHistory && !historyOpen && styles.clamp)}>{history}</p>
            {longHistory ? (
              <button type="button" className={styles.linkButton} onClick={() => setHistoryOpen((open) => !open)}>
                {historyOpen ? "Show less" : "Show all"}
              </button>
            ) : null}
          </>
        ) : (
          <p className={styles.pMuted}>Not written yet.</p>
        )}
      </Section>
    </div>
  );
}

/* ─── Selected referral: Timeline tab ───────────────────────────────────────────────────────── */

type TimelineEntry = { at: Instant; tone: "success" | "closed" | "info" | "neutral" | "danger"; text: string };

export function referralTimeline(referral: Referral, units: Unit[]): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    {
      at: referral.raisedAt,
      tone: "success",
      text: `Raised by ${REFERRAL_SOURCE_WORDS[referral.source]}, ${siteByCode(referral.originSiteCode)?.name ?? referral.originSiteCode}`,
    },
  ];
  if (referral.triagedAt !== undefined) entries.push({ at: referral.triagedAt, tone: "info", text: "Triaged" });
  for (const arm of referral.destinations) {
    const where = referralDestinationLabel(arm.destination);
    if (arm.waitlistedAt !== undefined)
      entries.push({ at: arm.waitlistedAt, tone: "neutral", text: `${where} waitlisted` });
    if (arm.withdrawnAt !== undefined)
      entries.push({ at: arm.withdrawnAt, tone: "closed", text: `${where} withdrawn by the referrer` });
    if (arm.decidedAt === undefined) continue;
    if (arm.state === "accepted") {
      const unit = units.find((candidate) => candidate.id === arm.acceptedUnitId);
      entries.push({ at: arm.decidedAt, tone: "success", text: `${where} accepted${unit ? ` at ${unit.name}` : ""}` });
    } else if (arm.state === "declined") {
      entries.push({
        at: arm.decidedAt,
        tone: "closed",
        text: `${where} refused: ${declineReasonWords(arm.declineReason)}`,
      });
    } else if (arm.state === "cancelled") {
      entries.push({ at: arm.decidedAt, tone: "closed", text: `${where} cancelled, accepted elsewhere` });
    }
  }
  for (const correction of referral.corrections ?? []) {
    entries.push({ at: correction.at, tone: "info", text: "Correction note added" });
  }
  return entries.sort((a, b) => a.at - b.at);
}

export function ReferralTimeline({
  referral,
  units,
  now,
  children,
}: {
  referral: Referral;
  units: Unit[];
  now: Instant;
  children?: ReactNode;
}) {
  const clocks = referralClocks(referral, now);
  const dueAt = referral.raisedAt + decisionWindow(referral);
  const overdue = isOverdue(referral, now);
  const open = openArms(referral).length > 0;
  const showDue = open && clocks.sinceReferralRunning;
  const all = referralTimeline(referral, units);
  // Overdue: recorded events up to the due time, then the due marker, then later events.
  const entries = showDue && overdue ? all.filter((entry) => entry.at <= dueAt) : all;
  const after = showDue && overdue ? all.filter((entry) => entry.at > dueAt) : [];
  const due = (
    <>
      <li className={cx(styles.timelineDue, overdue && styles.timelineLate)}>
        <span className={styles.timelineAt}>{formatInstantWithDay(dueAt, now)}</span>
        {overdue ? <TriangleAlert size={12} aria-hidden="true" /> : <StatusGlyph tone="neutral" size={9} />}
        <span>
          {overdue ? "Decision was due" : "Decision due"} (tier {referral.urgency})
        </span>
      </li>
      {after.map((entry, index) => (
        <li key={`after-${entry.at}-${index}`}>
          <span className={styles.timelineAt}>{formatInstantWithDay(entry.at, now)}</span>
          <StatusGlyph tone={entry.tone} size={9} />
          <span>{entry.text}</span>
        </li>
      ))}
    </>
  );
  return (
    <div className={styles.pTab} data-testid="ward-referral-timeline-tab">
      <ol className={styles.timeline} aria-label="Referral timeline">
        {entries.map((entry, index) => (
          <li key={`${entry.at}-${index}`}>
            <span className={styles.timelineAt}>{formatInstantWithDay(entry.at, now)}</span>
            <StatusGlyph tone={entry.tone} size={9} />
            <span>{entry.text}</span>
          </li>
        ))}
        {/* The due marker sits in time order: among past events when overdue, after Now when not. */}
        {showDue && overdue ? due : null}
        {open ? (
          <li className={styles.timelineNow}>
            <span className={styles.timelineAt}>{formatInstantWithDay(now, now)}</span>
            <span className={styles.nowDot} aria-hidden="true" />
            <span>
              Now, waiting <span className={styles.mono}>{durMinutes(clocks.sinceReferral)}</span>
            </span>
          </li>
        ) : null}
        {showDue && !overdue ? due : null}
      </ol>
      {children}
    </div>
  );
}

/* ─── Small shared bits ─────────────────────────────────────────────────────────────────────── */

export function HeroTools({
  overdueCount,
  onNextOverdue,
  onMeeting,
}: {
  overdueCount: number;
  onNextOverdue: () => void;
  onMeeting: () => void;
}) {
  return (
    <div className={styles.heroTools}>
      <Button
        variant="onHero"
        size="sm"
        icon={TriangleAlert}
        count={overdueCount > 0 ? overdueCount : undefined}
        disabledReason={overdueCount > 0 ? undefined : "Nothing is overdue."}
        reasonDisplay="tooltip"
        onClick={onNextOverdue}
        data-testid="ward-referral-next-overdue"
      >
        Next overdue
      </Button>
      <Button variant="onHero" size="sm" icon={ListOrdered} onClick={onMeeting} data-testid="ward-referral-meeting">
        Bed meeting list
      </Button>
    </div>
  );
}

export function SummaryButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" icon={FileText} onClick={onClick} title="Referral summary (S)">
      Summary
    </Button>
  );
}
