"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Plus, Tv } from "lucide-react";
import { bedMeetingTvHref } from "@/components/ward-management/ward-nav";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { useWardFeatureFlag } from "@/components/ward-management/shell/ward-feature-flag-store";

import {
  Button,
  Hero,
  LiveChip,
  PhoneHero,
  StatusGlyph,
  buttonClass,
  cx,
  phoneRows,
  useIsPhone,
  type CheckingItem,
  type WfTone,
} from "@/components/wf";
import { healthServiceAcronym } from "@/components/ward-management/ward-service-scope";

import styles from "./ed-overview.module.css";
import handover from "./ed-handover.module.css";
import waiting from "@/components/ward-management/delays/delays-board.module.css";
import polish from "@/components/ward-management/delays/waiting-polish.module.css";

type EdOverviewDepartment = {
  id: string;
  name: string;
  code: string;
  service: string;
  waiting: number;
  longest: string;
  breaches: number;
};

/** A hero highlight chip (v10: at most five; this page uses four). Pressing one dims the other rows. */
type EdOverviewChip = { id: string; label: string; value: number; tone?: WfTone };

type Props = {
  sinceLastLook?: ReactNode;
  departmentId: string;
  departments: EdOverviewDepartment[];
  /** People on this department's psychiatry board: the answer title's figure. */
  onBoard: number;
  /**
   * How that figure splits (`waitingSplit`): "5 waiting" first, the strip tile's own figure, then
   * anybody else on the board ("1 in transit"). Shown beside the title so the two numbers reconcile.
   */
  onBoardParts?: readonly string[];
  chips: EdOverviewChip[];
  /** The pressed chip, or null when nothing is highlighted. */
  highlight: string | null;
  onHighlight: (id: string | null) => void;
  /** "N of M past 24h, everyone stays on the board" while a chip is pressed. */
  highlightNote?: ReactNode;
  checks: CheckingItem[];
  /**
   * Opens the one referral slide-out, from this department (option B, 13 Oct 2026). An ED desk does
   * not get this button: the app bar's New referral opens the same slide-out (Josh, 30 Oct 2026).
   */
  onRaiseReferral: () => void;
};

const shortName = (name: string) => name.replace(/ Emergency Department$/, "");

/** "South" for a metropolitan service, otherwise its acronym ("WACHS", "CAHS"). */
function serviceShort(service: string): string {
  if (service.endsWith(" Metro")) return service.slice(0, -" Metro".length);
  return healthServiceAcronym(service) || service;
}

/**
 * The department's hero (v6 Emergency mockup) and the strip of every emergency department under it.
 * Each tile the desk may open is a link to that department; the current one carries `aria-current="page"`. A tile's
 * triangle means people there are past the access target; the count beside it says how many wait.
 */
export function EdOverview({
  departmentId,
  sinceLastLook,
  departments,
  onBoard,
  onBoardParts = [],
  chips,
  highlight,
  onHighlight,
  highlightNote,
  checks,
  onRaiseReferral,
}: Props) {
  const isPhone = useIsPhone();
  const tvViewsOn = useWardFeatureFlag("bed-meeting-tv");
  // DA-09: an ED desk opens only its own department and not the TV, so those links follow the role filter.
  const canOpen = useCanOpenHref();
  // WT-24 and the ED desk redesign (Josh, 30 Oct 2026): an ED desk's copy holds only its own
  // department's people, so every other tile could only say "Not shown at this desk". The strip is
  // left out for that desk (the title already gives its own count), and so is the hero's Raise
  // referral, which repeated the app bar's New referral. Every other desk keeps both.
  const edDesk = useEffectiveWardAccess().role === "ed";
  const current = departments.find((department) => department.id === departmentId);
  if (!current) return null;

  // Simplification A1 (Josh, 19 Oct 2026): three figures on every size, the same three the phone has
  // always shown. "Over 8h" is left to the board's own wait column.
  const heroChips = chips.filter((chip) => chip.id !== "severe");
  // Only worth saying when the board holds somebody who is not waiting; otherwise it repeats the title.
  const boardSplit = onBoardParts.length > 1 ? onBoardParts.join(", ") : null;
  const checkValue = (id: string) => checks.find((check) => check.id === id)?.value;
  // Phone (Josh, 31 Oct 2026): the hero buttons are Home's 40px hero pills side by side (`phoneRows`).
  const raiseButton = edDesk ? null : (
    <button
      type="button"
      className={buttonClass({ variant: "light", size: "sm", className: cx(styles.raiseReferral, phoneRows.heroPill) })}
      data-testid="ward-ed-raise-referral-toggle"
      onClick={onRaiseReferral}
    >
      <Plus size={14} aria-hidden="true" />
      Raise referral
    </button>
  );
  // P142 (Josh, 27 Oct 2026, 10:12 PM AWST): Add patient sits beside the referral button.
  const addPatientHref = "/ward-flow/people/new";
  const actions = (
    <>
      {raiseButton}
      {canOpen(addPatientHref) ? (
        <Link
          href={addPatientHref}
          className={buttonClass({
            variant: "light",
            size: "sm",
            className: cx(styles.raiseReferral, phoneRows.heroPill),
          })}
          data-testid="ward-ed-add-patient"
        >
          <Plus size={14} aria-hidden="true" />
          Add patient
        </Link>
      ) : null}
    </>
  );

  return (
    <section
      className={cx(styles.overview, handover.overviewGround)}
      aria-label="Emergency department overview"
      data-testid={`ward-ed-card-${departmentId}`}
    >
      {isPhone ? (
        // v10 phone: a compact hero. Eyebrow with the Live chip, the answer, one sub line (longest
        // wait and the access target), three divided figures that toggle a highlight, and the one
        // light action. The checking foot stays on desktop and tablet.
        <PhoneHero
          level={1}
          className={styles.phoneHero}
          eyebrow={`Emergency · ${current.service}`}
          chip={<LiveChip state="live" age={null} onHero />}
          title={
            <>
              <b className={styles.answerNum}>{onBoard}</b> on the psychiatry board
            </>
          }
          sub={
            <>
              {boardSplit ? (
                <>
                  <span data-testid="ward-ed-board-split">{boardSplit}</span>
                  <br />
                </>
              ) : null}
              {/* F-08 (phone review, Oct 2026): "updating", since "live" beside the Demo pill contradicts it. */}
              Longest {checkValue("longest") ?? "—"} · target {checkValue("target") ?? "—"} · updating
            </>
          }
          // C1 (phone simplification, 19 Oct 2026): the card shrinks to this one line as the board scrolls.
          condensed={`${onBoard} on the psychiatry board · longest ${checkValue("longest") ?? "—"}`}
          figures={heroChips.map((chip) => ({
            id: chip.id,
            value: chip.value,
            label: chip.label,
            tone: chip.value > 0 ? chip.tone : undefined,
            pressed: highlight === chip.id,
            onPress: () => onHighlight(highlight === chip.id ? null : chip.id),
          }))}
          actions={
            <>
              {highlight && highlightNote ? (
                <span className={styles.note} aria-live="polite" data-testid="ward-ed-highlight-note">
                  <span>{highlightNote}</span>
                  <Button variant="onHero" size="sm" onClick={() => onHighlight(null)}>
                    Clear
                  </Button>
                </span>
              ) : null}
              {sinceLastLook}
              <div className={phoneRows.heroPills}>{actions}</div>
            </>
          }
        />
      ) : (
        <Hero
          level={1}
          eyebrow={`Emergency department · ${current.service}`}
          // Round 3 (Josh, 1 Nov 2026): the title is the department alone. Its counts sit beside it as
          // the Waiting page's header figures, and the checking line is the Waiting page's slim bar.
          title={<span className={styles.titleName}>{shortName(current.name)}</span>}
          stats={
            <div className={waiting.stats} role="group" aria-label="Highlight people on the board">
              <div className={`${waiting.stat} ${waiting.statStatic}`}>
                <span className={waiting.statV}>{onBoard}</span>
                <span className={waiting.statL}>On the board</span>
              </div>
              {heroChips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  className={waiting.stat}
                  aria-pressed={highlight === chip.id}
                  onClick={() => onHighlight(highlight === chip.id ? null : chip.id)}
                >
                  <span className={waiting.statV}>{chip.value}</span>
                  <span className={waiting.statL}>
                    {chip.value > 0 && chip.tone ? <StatusGlyph tone={chip.tone} size={8} /> : null}
                    {chip.label}
                  </span>
                </button>
              ))}
            </div>
          }
          bar={
            <div className={polish.heroBar}>
              {boardSplit ? (
                <span className={polish.strip} data-testid="ward-ed-board-split">
                  <span className={polish.stripValue}>{boardSplit}</span>
                </span>
              ) : null}
              {checks.map((check) => (
                <span key={check.id} className={polish.strip}>
                  {check.tone && !check.unavailable ? <StatusGlyph tone={check.tone} size={8} /> : null}
                  <span className={polish.stripLabel}>{check.label}</span>
                  <span className={polish.stripValue}>{check.unavailable ? "not checked" : check.value}</span>
                </span>
              ))}
              {highlight && highlightNote ? (
                <span
                  className={`${styles.note} ${handover.heroNote}`}
                  aria-live="polite"
                  data-testid="ward-ed-highlight-note"
                >
                  <span>{highlightNote}</span>
                  <Button variant="onHero" size="sm" onClick={() => onHighlight(null)}>
                    Clear
                  </Button>
                </span>
              ) : null}
            </div>
          }
          aside={
            <>
              {/* This department's own TV screen, behind the `bed-meeting-tv` flag. */}
              {tvViewsOn && canOpen(bedMeetingTvHref({ ed: departmentId })) ? (
                <Link
                  href={bedMeetingTvHref({ ed: departmentId })}
                  className={buttonClass({ variant: "onHero", size: "sm" })}
                  data-testid="ward-ed-open-tv"
                >
                  <Tv size={14} aria-hidden="true" />
                  On TV
                </Link>
              ) : null}
              {sinceLastLook}
              {actions}
            </>
          }
        />
      )}
      {edDesk ? null : (
        <nav className={styles.strip} aria-label="Emergency departments">
          {/* Phone (31 Oct 2026): the department pills slide sideways with the kit's soft right-edge fade. */}
          <ul className={cx(styles.list, phoneRows.chipRow, styles.deptRow)}>
            {departments.map((department) => {
              const isCurrent = department.id === departmentId;
              const href = `/ward-flow/ed/${department.id}`;
              const tile = {
                className: cx(styles.tile, isCurrent && styles.current),
                "data-ed": department.id,
                "data-service": department.service,
                title: `${department.name} (${department.service})`,
              };
              const body = (
                <>
                  <span className={styles.tileTop}>
                    <strong className={styles.code}>{department.code}</strong>
                    <span className={styles.service}>{serviceShort(department.service)}</span>
                  </span>
                  <span className={styles.waiting}>
                    <b>{department.waiting}</b>
                    <small>waiting</small>
                  </span>
                  <span className={styles.longest}>
                    {department.waiting === 0 ? (
                      <span className={styles.quiet}>No one waiting</span>
                    ) : (
                      <>
                        {department.breaches > 0 ? <StatusGlyph tone="danger" size={8} /> : null}
                        <span className={styles.mono}>{department.longest}</span> max
                        {department.breaches > 0 ? (
                          <span className={styles.srOnly}>, {department.breaches} over target</span>
                        ) : null}
                      </>
                    )}
                  </span>
                </>
              );
              return (
                <li key={department.id}>
                  {/* DA-09: a department this desk cannot open keeps its figures but is not a link. */}
                  {canOpen(href) ? (
                    <Link href={href} aria-current={isCurrent ? "page" : undefined} {...tile}>
                      {body}
                    </Link>
                  ) : (
                    <div {...tile}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </section>
  );
}
