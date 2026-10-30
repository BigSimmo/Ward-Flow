"use client";
// Fork of src/components/ward-management/ed/ed-overview.tsx (role view: as ED clinician).

import Link from "next/link";
import type { ReactNode } from "react";
import { Plus, Tv } from "lucide-react";
import { bedMeetingTvHref } from "@/components/ward-management/ward-nav";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { useWardFeatureFlag } from "@/components/ward-management/shell/ward-feature-flag-store";

import {
  Button,
  CheckingFoot,
  Hero,
  HeroStat,
  LiveChip,
  PhoneHero,
  StatusGlyph,
  buttonClass,
  cx,
  useIsPhone,
  type CheckingItem,
  type WfTone,
} from "@/components/wf";
import { healthServiceAcronym } from "@/components/ward-management/ward-service-scope";

import styles from "@/components/ward-management/ed/ed-overview.module.css";

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
export function AsEdOverview({
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
}: Props) {
  const isPhone = useIsPhone();
  const tvViewsOn = useWardFeatureFlag("bed-meeting-tv");
  // DA-09: an ED desk opens only its own department and not the TV, so those links follow the role filter.
  const canOpen = useCanOpenHref();
  // WT-24: an ED desk's copy holds only its own department's people, so another department's 0 would
  // be a false figure. Those tiles say the figure is not shown here instead.
  const edDesk = useEffectiveWardAccess().role === "ed";
  const current = departments.find((department) => department.id === departmentId);
  if (!current) return null;

  // Simplification A1 (Josh, 19 Oct 2026): three figures on every size, the same three the phone has
  // always shown. "Over 8h" is left to the board's own wait column.
  const heroChips = chips.filter((chip) => chip.id !== "severe");
  // Only worth saying when the board holds somebody who is not waiting; otherwise it repeats the title.
  const boardSplit = onBoardParts.length > 1 ? onBoardParts.join(", ") : null;
  const checkValue = (id: string) => checks.find((check) => check.id === id)?.value;
  // ROLE BRANCH (ed): the hero's Raise referral repeated the app bar's New referral, which opens
  // the same slide-out (Josh, 30 Oct 2026). Only the bar's button stays; Add patient keeps its place (P142).
  const addPatientHref = "/ward-flow/people/new";
  const actions = (
    <>
      {canOpen(addPatientHref) ? (
        <Link
          href={addPatientHref}
          className={buttonClass({ variant: "light", size: "sm", className: styles.raiseReferral })}
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
      className={styles.overview}
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
              {actions}
            </>
          }
        />
      ) : (
        <Hero
          level={1}
          eyebrow={`Emergency department · ${current.service}`}
          title={
            <>
              <span className={styles.titleName}>{shortName(current.name)} </span>
              <span className={styles.answer}>
                <b className={styles.answerNum}>{onBoard}</b> on the board
              </span>
            </>
          }
          titleMeta={boardSplit ? <span data-testid="ward-ed-board-split">{boardSplit}</span> : undefined}
          bar={
            <div className={styles.chips} role="group" aria-label="Highlight people on the board">
              {heroChips.map((chip) => (
                <HeroStat
                  key={chip.id}
                  inline
                  value={chip.value}
                  label={chip.label}
                  tone={chip.value > 0 ? chip.tone : undefined}
                  pressed={highlight === chip.id}
                  onToggle={() => onHighlight(highlight === chip.id ? null : chip.id)}
                />
              ))}
            </div>
          }
          barAside={
            highlight && highlightNote ? (
              <span className={styles.note} aria-live="polite" data-testid="ward-ed-highlight-note">
                <span>{highlightNote}</span>
                <Button variant="onHero" size="sm" onClick={() => onHighlight(null)}>
                  Clear
                </Button>
              </span>
            ) : null
          }
          foot={<CheckingFoot items={checks} />}
          footAside={<span>Board updates once a minute</span>}
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
      {/* Role view (as ED clinician): an ED desk opens only its own department, so every other tile
          said "Not shown at this desk". The strip is left out for that desk; the title already
          gives its own waiting count. Every other desk keeps the strip as before. */}
      {edDesk ? null : (
        <nav className={styles.strip} aria-label="Emergency departments">
          <ul className={styles.list}>
            {departments.map((department) => {
              const isCurrent = department.id === departmentId;
              const href = `/ward-flow/ed/${department.id}`;
              const notShown = edDesk && !isCurrent && !canOpen(href);
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
                    {notShown ? <small>Not shown at this desk</small> : <b>{department.waiting}</b>}
                    {notShown ? null : <small>waiting</small>}
                  </span>
                  <span className={styles.longest}>
                    {notShown ? null : department.waiting === 0 ? (
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
