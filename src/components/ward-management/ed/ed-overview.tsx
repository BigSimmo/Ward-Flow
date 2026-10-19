"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Plus, Tv } from "lucide-react";
import { bedMeetingTvHref } from "@/components/ward-management/ward-nav";
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

import styles from "./ed-overview.module.css";

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
  chips: EdOverviewChip[];
  /** The pressed chip, or null when nothing is highlighted. */
  highlight: string | null;
  onHighlight: (id: string | null) => void;
  /** "N of M past 24h, everyone stays on the board" while a chip is pressed. */
  highlightNote?: ReactNode;
  checks: CheckingItem[];
  /** Opens the one referral slide-out, from this department (option B, 13 Oct 2026). */
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
 * Each tile is a link to that department; the current one carries `aria-current="page"`. A tile's
 * triangle means people there are past the access target; the count beside it says how many wait.
 */
export function EdOverview({
  departmentId,
  sinceLastLook,
  departments,
  onBoard,
  chips,
  highlight,
  onHighlight,
  highlightNote,
  checks,
  onRaiseReferral,
}: Props) {
  const isPhone = useIsPhone();
  const tvViewsOn = useWardFeatureFlag("bed-meeting-tv");
  const current = departments.find((department) => department.id === departmentId);
  if (!current) return null;

  const checkValue = (id: string) => checks.find((check) => check.id === id)?.value;
  const raiseButton = (
    <button
      type="button"
      className={buttonClass({ variant: "light", size: "sm", className: styles.raiseReferral })}
      data-testid="ward-ed-raise-referral-toggle"
      onClick={onRaiseReferral}
    >
      <Plus size={14} aria-hidden="true" />
      Raise referral
    </button>
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
              {/* F-08 (phone review, Oct 2026): "updating", since "live" beside the Demo pill contradicts it. */}
              Longest {checkValue("longest") ?? "—"} · target {checkValue("target") ?? "—"} · updating
            </>
          }
          figures={chips
            .filter((chip) => chip.id !== "severe")
            .map((chip) => ({
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
              {raiseButton}
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
          bar={
            <div className={styles.chips} role="group" aria-label="Highlight people on the board">
              {chips.map((chip) => (
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
              {tvViewsOn ? (
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
              {raiseButton}
            </>
          }
        />
      )}
      <nav className={styles.strip} aria-label="Emergency departments">
        <ul className={styles.list}>
          {departments.map((department) => {
            const isCurrent = department.id === departmentId;
            return (
              <li key={department.id}>
                <Link
                  href={`/ward-flow/ed/${department.id}`}
                  className={cx(styles.tile, isCurrent && styles.current)}
                  data-ed={department.id}
                  data-service={department.service}
                  aria-current={isCurrent ? "page" : undefined}
                  title={`${department.name} (${department.service})`}
                >
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
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </section>
  );
}
