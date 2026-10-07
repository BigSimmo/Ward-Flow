"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

import { Hero, HeroStat, StatusGlyph, buttonClass, cx, type WfTone } from "@/components/wf";
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

export type EdOverviewFigure = { label: string; value: string | number; tone?: WfTone };

type Props = {
  departmentId: string;
  departments: EdOverviewDepartment[];
  figures: EdOverviewFigure[];
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
export function EdOverview({ departmentId, departments, figures, onRaiseReferral, referralOpen = false }: Props) {
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
        title={shortName(current.name)}
        stats={figures.map((figure) => (
          <HeroStat key={figure.label} value={figure.value} label={figure.label} tone={figure.tone} />
        ))}
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
