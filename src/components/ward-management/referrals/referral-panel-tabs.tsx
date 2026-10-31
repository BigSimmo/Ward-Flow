"use client";
// Referrals redesign, round 5 (Josh, 31 October 2026): the panel's Patient and Timeline tabs,
// streamlined. Forks of ReferralPatientTab and ReferralTimeline in
// src/components/ward-management/referrals/referral-board-parts.tsx.
//
// Patient: the reason leads, then only the needs that apply as small tags, readiness as one bar,
// the referrer with Call and the documents as chips, legal status with the safeguard sentence word
// for word, and the written history. Owner, calls and ward commitments fold behind one row each.
// "Units ready" left (the Place tab counts it); the two "not recorded" legal rows became one line.
//
// Timeline: one rail, newest last, a live Now row and the due marker in time order. Asks from wards
// and the history and corrections fold below.

import { useState, type ReactNode } from "react";
import { Phone } from "lucide-react";

import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { Referral, Unit } from "@/components/ward-management/ward-model";
import { referralClocks } from "@/components/ward-management/ward-referrals";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { formatReferralIntakeTime } from "@/components/ward-management/ward-referral-seed-time";
import {
  OVERDUE_AFTER_ANY_TIER_MINUTES,
  OVERDUE_AFTER_MINUTES_BY_TIER,
} from "@/components/ward-management/ward-operational-defaults";
import { REFERRAL_SOURCE_WORDS, isOverdue, openArms, referralTimeline, wardArm } from "./referral-board-parts";
import { CLEARANCE_CHECKS, CLEARANCE_CHECK_LABELS, CLEARANCE_STATUS_LABELS } from "./referral-submission";
import { ReferralOwnerAndCalls } from "./referral-owner-and-calls-lazy";
import { ReferralCommitments } from "./referral-commitments-lazy";
import { ReferralInformationNeedsPanel } from "./referral-information-needs-lazy";
import { useSenderPresentation } from "@/components/ward-management/ward-sender-presentation";
import { referralPresentation } from "@/components/ward-management/ward-partial-view-presenters";
import { StatusGlyph, cx, durMinutes } from "@/components/wf";

import { ReferralDocuments } from "./referral-documents";
import { LiveDot } from "./referral-panel-parts";
import redesign from "./referral-page.module.css";
import s from "./referral-tabs.module.css";

function Block({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className={s.block}>
      <header className={s.blockHead}>
        <h3>{title}</h3>
        {aside ? <span>{aside}</span> : null}
      </header>
      {children}
    </section>
  );
}

function Fold({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={redesign.disclosureRow}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
      </button>
      {open ? <div className={s.foldBody}>{children}</div> : null}
    </>
  );
}

/** The bed needs that apply, as short words. Empty when none do. */
export function needTags(referral: Referral): string[] {
  const ward = wardArm(referral)?.destination;
  return [
    ward?.secureBedNeeded ? "Locked bed" : undefined,
    ward?.involuntaryBedNeeded ? "Involuntary bed" : undefined,
    ward?.highAcuityNursingNeeded ? "High acuity nursing" : undefined,
    referral.transportNeeded ? "Transport" : undefined,
  ].filter((word): word is string => word !== undefined);
}

export function PatientTab({
  referral,
  now,
  personName,
  readOnly = false,
}: {
  referral: Referral;
  now: Instant;
  personName: string;
  readOnly?: boolean;
}) {
  const { dayZero } = useWardFlowSelect("dayZero");
  const intake = referral.intake;
  const [readMore, setReadMore] = useState(false);
  const [historyMore, setHistoryMore] = useState(false);
  const reason = intake?.reasonForReferral?.trim() ?? "";
  const history = referral.history?.trim() ?? "";
  const checks = intake?.clearanceChecklist;
  const checkRows = checks ? CLEARANCE_CHECKS.filter((check) => checks[check] !== undefined) : [];
  const done = checkRows.filter((check) => checks?.[check] === "done").length;
  const site = siteByCode(referral.originSiteCode)?.name ?? referral.originSiteCode;
  const tags = needTags(referral);
  const legal = intake?.legalStatus?.trim();
  const legalMissing = !legal || /^not recorded$/i.test(legal);
  const asksForBed = wardArm(referral) !== undefined;

  return (
    <div className={s.tab} data-testid="ward-referral-patient-tab">
      <Block title="Why referred" aside={formatInstantWithDay(referral.raisedAt, now)}>
        {reason ? (
          <>
            <p className={cx(s.lead, !readMore && reason.length > 220 && s.clamp)}>{reason}</p>
            {reason.length > 220 ? (
              <button type="button" className={s.link} onClick={() => setReadMore((open) => !open)}>
                {readMore ? "Show less" : "Read all"}
              </button>
            ) : null}
          </>
        ) : (
          <p className={s.muted}>Reason for referral not recorded.</p>
        )}
        <dl className={s.cells}>
          <div>
            <dt>Triage</dt>
            <dd>{referral.atsCategory !== undefined ? `ATS ${referral.atsCategory}` : "Not recorded"}</dd>
          </div>
          <div>
            <dt>Home</dt>
            <dd>{referral.suburb.kind === "named" ? referral.suburb.name : referral.homeRegion}</dd>
          </div>
        </dl>
      </Block>

      {asksForBed || referral.transportNeeded ? (
        <Block title="Needs">
          {tags.length > 0 ? (
            <ul className={s.tags}>
              {tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          ) : (
            <p className={s.muted}>Open bed, no extra needs recorded.</p>
          )}
        </Block>
      ) : null}

      {intake ? (
        <Block
          title="Ready to transfer"
          aside={
            intake.medicalClearance.cleared ? (
              <span className={s.good}>Medically cleared</span>
            ) : (
              <>
                Clearance expected{" "}
                {formatReferralIntakeTime(intake.medicalClearance.expectedAt, intake.medicalClearance, dayZero, now)}
              </>
            )
          }
        >
          {checkRows.length > 0 ? (
            <div className={s.ready}>
              <div className={s.readyBar} role="img" aria-label={`${done} of ${checkRows.length} checks done`}>
                {checkRows.map((check) => (
                  <i key={check} data-state={checks?.[check]} />
                ))}
              </div>
              <span className={s.mono}>
                {done}/{checkRows.length}
              </span>
            </div>
          ) : null}
          <ul className={s.checks}>
            {checkRows.map((check) => (
              <li key={check}>
                <StatusGlyph tone={checks![check] === "done" ? "success" : "neutral"} size={9} />
                <span>{CLEARANCE_CHECK_LABELS[check]}</span>
                <span className={s.checkState}>{CLEARANCE_STATUS_LABELS[checks![check]!]}</span>
              </li>
            ))}
            <li>
              <StatusGlyph tone={intake.triageAndRampCompleted ? "success" : "neutral"} size={9} />
              <span>Triage and RAMP</span>
              <span className={s.checkState}>{intake.triageAndRampCompleted ? "Done" : "Not completed"}</span>
            </li>
          </ul>
        </Block>
      ) : null}

      <Block title="Referrer">
        <div className={s.contact}>
          <span className={s.who}>
            <b>{intake?.referrer.name ?? "Not recorded"}</b>
            <span>
              {intake
                ? `${intake.referrer.role} · ${intake.referrer.location}`
                : `${REFERRAL_SOURCE_WORDS[referral.source]} · ${site}`}
            </span>
          </span>
          {intake?.referrer.phone ? (
            <a className={s.call} href={`tel:${intake.referrer.phone.replace(/\s+/g, "")}`}>
              <Phone size={13} aria-hidden="true" />
              <span className={s.mono}>{intake.referrer.phone}</span>
            </a>
          ) : (
            // PR15: an absent number is said to be absent, never left blank or invented.
            <span>Direct contact not recorded</span>
          )}
        </div>
        <p className={s.subhead}>Documents</p>
        <ReferralDocuments charts={intake?.charts ?? []} toFollow={intake?.chartsToFollow} personName={personName} />
      </Block>

      <Block title="Legal status">
        <p className={cx(s.legal, legalMissing && s.legalMissing)}>
          {legalMissing ? <StatusGlyph tone="warning" size={9} /> : null}
          {legalMissing ? "Not recorded" : legal}
        </p>
        <p className={s.muted}>Referral details do not establish consent, detention authority or a register check.</p>
        {/* Referrals redesign (31 Oct 2026): the two checks the receiving unit still has to make,
            kept word for word from today's Patient tab so a bed request never reads as authority. */}
        <ul className={s.checks}>
          <li>
            <StatusGlyph tone="neutral" size={9} />
            <span>Consent or detention authority</span>
            <span className={s.checkState}>Not recorded in this referral</span>
          </li>
          <li>
            <StatusGlyph tone="neutral" size={9} />
            <span>Chief Psychiatrist register check</span>
            <span className={s.checkState}>Register check not recorded on this referral.</span>
          </li>
        </ul>
      </Block>

      <Block title="Written history">
        {history ? (
          <>
            <p className={cx(s.text, !historyMore && history.length > 180 && s.clamp)}>{history}</p>
            {history.length > 180 ? (
              <button type="button" className={s.link} onClick={() => setHistoryMore((open) => !open)}>
                {historyMore ? "Show less" : "Read all"}
              </button>
            ) : null}
          </>
        ) : (
          <p className={s.muted}>Not written yet.</p>
        )}
      </Block>

      <div className={s.folds}>
        <Fold label="Owner and calls">
          <ReferralOwnerAndCalls referral={referral} now={now} readOnly={readOnly} />
        </Fold>
        <Fold label="Ward commitments">
          <ReferralCommitments referral={referral} now={now} readOnly={readOnly} />
        </Fold>
      </div>
    </div>
  );
}

function decisionWindow(referral: Referral): number {
  return Math.min(OVERDUE_AFTER_MINUTES_BY_TIER[referral.urgency], OVERDUE_AFTER_ANY_TIER_MINUTES);
}

type Row = {
  at: Instant;
  tone: "success" | "closed" | "info" | "neutral" | "danger" | "warning";
  text: ReactNode;
  kind?: "now" | "due";
};

export function TimelineTab({
  referral,
  units,
  now,
  children,
}: {
  referral: Referral;
  units: Unit[];
  now: Instant;
  /** History and corrections, folded below the rail. */
  children?: ReactNode;
}) {
  const sender = useSenderPresentation();
  const summary = sender.referralFor(referral);
  const presentation = referralPresentation(referral, summary);
  if (presentation.kind === "unavailable") return <p role="status">Referral progress unavailable.</p>;
  const settled = summary !== undefined && (presentation.state !== "queued" || presentation.withdrawn);
  const open = summary === undefined ? openArms(referral).length > 0 : !settled;
  const clocks = referralClocks(referral, now);
  const running = open && clocks.sinceReferralRunning;
  const dueAt = referral.raisedAt + decisionWindow(referral);
  const overdue = isOverdue(referral, now);
  const rows: Row[] = referralTimeline(referral, units, summary).map((entry) => ({ ...entry }));
  if (running) {
    rows.push({
      at: dueAt,
      tone: overdue ? "danger" : "neutral",
      text: `${overdue ? "Decision was due" : "Decision due"} (tier ${referral.urgency})`,
      kind: "due",
    });
    rows.push({
      at: now,
      tone: overdue ? "danger" : "success",
      text: (
        <>
          Now · waiting <span className={s.mono}>{durMinutes(clocks.sinceReferral)}</span>
        </>
      ),
      kind: "now",
    });
  }
  rows.sort((a, b) => a.at - b.at || (a.kind === "now" ? 1 : b.kind === "now" ? -1 : 0));
  return (
    <div className={s.tab} data-testid="ward-referral-timeline-tab">
      <ol className={s.rail} aria-label="Referral timeline">
        {rows.map((row, index) => (
          <li key={`${row.at}-${index}`} data-kind={row.kind} data-tone={row.tone}>
            <span className={s.railDot} aria-hidden="true">
              {row.kind === "now" ? <LiveDot tone={overdue ? "danger" : "success"} /> : null}
            </span>
            <span className={s.railText}>{row.text}</span>
            <span className={s.railAt}>{formatInstantWithDay(row.at, now)}</span>
          </li>
        ))}
      </ol>
      <ReferralInformationNeedsPanel referral={referral} now={now} />
      {/* Referrals redesign (31 Oct 2026): the build notes keep Written history and Corrections in
          full on the Timeline tab; only the decision pane folds them. */}
      {children}
    </div>
  );
}
