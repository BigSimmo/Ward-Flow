"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Plus } from "lucide-react";

import {
  Button,
  CheckingFoot,
  Hero,
  HeroStat,
  StatusGlyph,
  buttonClass,
  cx,
  type CheckingItem,
  type WfTone,
} from "@/components/wf";
import { healthServiceAcronym } from "@/components/ward-management/ward-service-scope";

import styles from "./ed-overview.module.css";

export type EdOverviewDepartment = {
  id: string;
  name: string;
  code: string;
  service: string;
  waiting: number;
  longest: string;
  breaches: number;
};

/** A hero highlight chip (v10: at most five; this page uses four). Pressing one dims the other rows. */
export type EdOverviewChip = { id: string; label: string; value: number; tone?: WfTone };

type Props = {
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
  onRaiseReferral: () => void;
  referralOpen?: boolean;
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
  departments,
  onBoard,
  chips,
  highlight,
  onHighlight,
  highlightNote,
  checks,
  onRaiseReferral,
  referralOpen = false,
}: Props) {
  const current = departments.find((department) => department.id === departmentId);
  if (!current) return null;

  return (
    <section
      className={styles.overview}
      aria-label="Emergency department overview"
      data-testid={`ward-ed-card-${departmentId}`}
    >
      <Hero
        level={1}
        eyebrow={`Emergency department · ${current.service}`}
        title={
          <>
            {shortName(current.name)}{" "}
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
          <button
            type="button"
            className={buttonClass({ variant: "light", size: "sm" })}
            data-testid="ward-ed-raise-referral-toggle"
            aria-expanded={referralOpen}
            aria-controls="ward-ed-referral-intake"
            onClick={onRaiseReferral}
          >
            <Plus size={14} aria-hidden="true" />
            Raise referral
          </button>
        }
      />
      <nav className={styles.strip} aria-label="Emergency departments">
        <ul className={styles.list}>
          {departments.map((department) => {
            const isCurrent = department.id === departmentId;
            return (
              <li key={department.id}>
                <Link
                  href={`/mockups/ward-flow/ed/${department.id}`}
                  className={cx(styles.tile, isCurrent && styles.current)}
                  data-ed={department.id}
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
