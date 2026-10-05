"use client";

import { useMemo, type ReactNode } from "react";

import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { formatSheetMoment, splitDuration } from "@/components/ward-management/ward-clock";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import type { Movement } from "@/components/ward-management/ward-model";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { movementBelongsToService } from "@/components/ward-management/ward-service-scope";
import { edById } from "@/components/ward-management/ward-sites";

import styles from "./flow-proposal.module.css";

export type FlowProposalScreen = "delays" | "alerts" | "on-call";

const SCREENS: { id: FlowProposalScreen; label: string }[] = [
  { id: "delays", label: "Delays" },
  { id: "alerts", label: "Alerts" },
  { id: "on-call", label: "On-call" },
];

export function proposalHref(screen: FlowProposalScreen, query?: Record<string, string>): string {
  const search = query ? `?${new URLSearchParams(query).toString()}` : "";
  return `/mockups/ward-flow/${screen}/proposal${search}`;
}

/** Live shared state for every proposal screen, scoped by the header's service picker like the real screens. */
export function useFlowProposal() {
  const world = useWardFlow();
  const now = useWardFlowClock();
  const service = useServiceScope();
  const patientOf = usePatientOf();
  const { movements, units, dayZero } = world;
  const scoped = useMemo(
    () =>
      service === null ? movements : movements.filter((m: Movement) => movementBelongsToService(m, service, units)),
    [movements, service, units],
  );
  return {
    world,
    now,
    service,
    scoped,
    asAt: `As at ${formatSheetMoment(now, dayZero)}`,
    initialsOf: (movement: Movement) => patientOf(movement).initials,
  };
}

export function edName(movement: Movement): string {
  if (movement.originEdId === undefined) return "No ED recorded";
  const name = edById(movement.originEdId)?.name;
  return name ? name.replace(/ Emergency Department$/, " ED") : "ED not found";
}

export const wait = (minutes: number) => splitDuration(Math.max(0, minutes));

/** Preview-only frame: banner, screen switcher, link back to the current screen. */
export function PreviewBar({ active }: { active: FlowProposalScreen }) {
  return (
    <div className={styles.previewBar} data-testid="flow-proposal-preview-bar">
      <strong>Proposed redesign (preview)</strong>
      <nav className={styles.previewTabs} aria-label="Proposed screens">
        {SCREENS.map((entry) => (
          <a key={entry.id} href={proposalHref(entry.id)} aria-current={entry.id === active ? "page" : undefined}>
            {entry.label}
          </a>
        ))}
      </nav>
      <a className={styles.link} href={`/mockups/ward-flow/${active}`}>
        Current {SCREENS.find((entry) => entry.id === active)?.label.toLowerCase()} screen ›
      </a>
    </div>
  );
}

export function ProposalHeader({
  crumb,
  title,
  answer,
  asAt,
  action,
}: {
  crumb: string;
  title: string;
  answer: ReactNode;
  asAt: string;
  action?: ReactNode;
}) {
  return (
    <header className={styles.header}>
      <div>
        <p className={styles.crumbs}>{crumb}</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.answer} data-testid="proposal-answer">
          {answer}
        </p>
      </div>
      <div className={styles.asAt}>
        <span>{asAt}</span>
        <span className={styles.chip}>
          <span className={styles.chipDot} aria-hidden="true" />
          Synthetic data
        </span>
        {action}
      </div>
    </header>
  );
}

export type Kpi = {
  id: string;
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: "good" | "warn" | "danger";
};

const TONE: Record<NonNullable<Kpi["tone"]>, string> = {
  good: styles.toneGood,
  warn: styles.toneWarn,
  danger: styles.toneDanger,
};

/** The figure strip. With `onSelect`, each figure is also the filter for the list below it. */
export function KpiStrip({
  items,
  label,
  selected,
  onSelect,
}: {
  items: Kpi[];
  label: string;
  selected?: string;
  onSelect?: (id: string) => void;
}) {
  return (
    <section className={styles.kpis} aria-label={label}>
      {items.map((item) => {
        const body = (
          <>
            <span className={styles.kpiLabel}>{item.label}</span>
            <span className={`${styles.kpiValue} ${item.tone ? TONE[item.tone] : ""}`}>{item.value}</span>
            {item.note ? <span className={styles.kpiNote}>{item.note}</span> : null}
          </>
        );
        return onSelect ? (
          <button
            key={item.id}
            type="button"
            className={styles.kpi}
            aria-pressed={selected === item.id}
            onClick={() => onSelect(item.id)}
          >
            {body}
          </button>
        ) : (
          <div key={item.id} className={styles.kpi}>
            {body}
          </div>
        );
      })}
    </section>
  );
}

export function Panel({
  title,
  question,
  meta,
  foot,
  children,
  flush = false,
  id,
}: {
  title: string;
  question?: string;
  meta?: ReactNode;
  foot?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  id?: string;
}) {
  return (
    <section className={styles.panel} aria-label={title} id={id}>
      <div className={styles.panelHead}>
        <div>
          <h2 className={styles.panelTitle}>{title}</h2>
          {question ? <p className={styles.panelQuestion}>{question}</p> : null}
        </div>
        {meta ? <span className={styles.panelMeta}>{meta}</span> : null}
      </div>
      {flush ? children : <div className={styles.panelBody}>{children}</div>}
      {foot ? <div className={styles.panelFoot}>{foot}</div> : null}
    </section>
  );
}

/** D4: the exact words for a control this prototype does not connect. */
export const NOT_WIRED = "Not wired in this prototype.";
