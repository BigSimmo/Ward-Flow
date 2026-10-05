"use client";

import type { ReactNode } from "react";

import { splitDuration } from "@/components/ward-management/ward-clock";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import type { Movement } from "@/components/ward-management/ward-model";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";

import styles from "./movement-proposal.module.css";

/** Preview routes today; the real movement and transport routes on approval. */
export const PROPOSAL_ROUTES = {
  board: "/mockups/ward-flow/movements/proposal",
  movement: (id: string) => `/mockups/ward-flow/movements/proposal?screen=movement&id=${encodeURIComponent(id)}`,
  transport: "/mockups/ward-flow/movements/proposal?screen=transport",
} as const;

/** Initials only on the proposal screens, so no screenshot of them carries a full name. */
export function patientInitials(
  movement: Movement,
  world: Pick<WardFlowState, "patients" | "referrals" | "movements">,
) {
  const info = resolveSubjectPatient(movement, world);
  return info.patient ? info.initials : "Not recorded";
}

export function waited(minutes: number) {
  return splitDuration(Math.max(0, minutes));
}

/** Preview-only frame: a banner and screen switcher around the proposed screens. */
export function ProposalPreviewBar({
  active,
  current,
}: {
  active: "board" | "movement" | "transport";
  current: string;
}) {
  const tabs = [
    { id: "board", label: "Movements", href: PROPOSAL_ROUTES.board },
    { id: "movement", label: "One movement", href: PROPOSAL_ROUTES.movement("WF-001") },
    { id: "transport", label: "Transport Hub", href: PROPOSAL_ROUTES.transport },
  ] as const;
  return (
    <div className={styles.previewBar} data-testid="movement-proposal-preview-bar">
      <strong>Proposed movement and transport redesign (preview)</strong>
      <nav className={styles.previewTabs} aria-label="Proposed movement screens">
        {tabs.map((tab) => (
          <a key={tab.id} href={tab.href} aria-current={tab.id === active ? "page" : undefined}>
            {tab.label}
          </a>
        ))}
      </nav>
      <a className={styles.link} href={current}>
        Current screen ›
      </a>
    </div>
  );
}

export function ProposalHeader({
  crumbs,
  title,
  badges,
  asAt,
  actions,
}: {
  crumbs: { label: string; href?: string }[];
  title: ReactNode;
  badges?: ReactNode;
  asAt: string;
  actions?: ReactNode;
}) {
  return (
    <header className={styles.header}>
      <div>
        <nav aria-label="Breadcrumb">
          <p className={styles.crumbs}>
            {crumbs.map((crumb, index) => (
              <span key={crumb.label}>
                {index > 0 ? "› " : ""}
                {crumb.href ? <a href={crumb.href}>{crumb.label}</a> : crumb.label}
              </span>
            ))}
          </p>
        </nav>
        <h1 className={styles.title}>
          {title}
          {badges}
        </h1>
      </div>
      <div className={styles.headerEnd}>
        <div className={styles.asAt}>
          <span>{asAt}</span>
          <span className={styles.chip}>
            <span className={styles.chipDot} aria-hidden="true" />
            Synthetic data
          </span>
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
    </header>
  );
}

export type Attention = {
  label: string;
  tone: "danger" | "warn" | "good" | "info";
  href?: string;
  onClick?: () => void;
};

export function Verdict({ children, attention = [] }: { children: ReactNode; attention?: Attention[] }) {
  const toneClass = { danger: styles.attnDanger, warn: styles.attnWarn, good: styles.attnGood, info: styles.attnInfo };
  return (
    <section className={styles.verdict} aria-label="Summary">
      <p className={styles.verdictText}>{children}</p>
      {attention.length ? (
        <ul className={styles.attention} aria-label="Needs attention">
          {attention.map((item) => (
            <li key={item.label} className={`${styles.attn} ${toneClass[item.tone]}`}>
              <span className={styles.attnDot} aria-hidden="true" />
              {item.href ? (
                <a href={item.href}>{item.label}</a>
              ) : item.onClick ? (
                <button type="button" onClick={item.onClick}>
                  {item.label}
                </button>
              ) : (
                item.label
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export type Kpi = {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: "good" | "warn" | "danger";
  pressed?: boolean;
  onSelect?: () => void;
};

/** The figure strip. A figure with `onSelect` filters the list below it and says so. */
export function KpiStrip({ items, label }: { items: Kpi[]; label: string }) {
  const tone = (item: Kpi) =>
    item.tone === "good"
      ? styles.toneGood
      : item.tone === "warn"
        ? styles.toneWarn
        : item.tone === "danger"
          ? styles.toneDanger
          : "";
  return (
    <section className={styles.kpis} aria-label={label}>
      {items.map((item) => {
        const body = (
          <>
            <span className={styles.kpiLabel}>{item.label}</span>
            <span className={`${styles.kpiValue} ${tone(item)}`}>{item.value}</span>
            {item.note ? <span className={styles.kpiNote}>{item.note}</span> : null}
          </>
        );
        return item.onSelect ? (
          <button
            key={item.label}
            type="button"
            className={`${styles.kpi} ${styles.kpiButton}`}
            aria-pressed={item.pressed ?? false}
            onClick={item.onSelect}
          >
            {body}
          </button>
        ) : (
          <div key={item.label} className={styles.kpi}>
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
}: {
  title: string;
  question?: string;
  meta?: ReactNode;
  foot?: ReactNode;
  children: ReactNode;
  flush?: boolean;
}) {
  return (
    <section className={styles.panel} aria-label={title}>
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

export function Pill({
  tone = "quiet",
  children,
}: {
  tone?: "good" | "warn" | "danger" | "quiet" | "accent";
  children: ReactNode;
}) {
  const toneClass = {
    good: styles.pillGood,
    warn: styles.pillWarn,
    danger: styles.pillDanger,
    quiet: styles.pillQuiet,
    accent: styles.pillAccent,
  };
  return <span className={`${styles.pill} ${toneClass[tone]}`}>{children}</span>;
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string; count?: number }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className={styles.segmented} role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.id} type="button" aria-pressed={option.id === value} onClick={() => onChange(option.id)}>
          {option.label}
          {option.count !== undefined ? <span className={styles.segCount}>{option.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Definitions({ items }: { items: { term: string; meaning: string }[] }) {
  return (
    <dl className={styles.definitions} aria-label="What these figures mean">
      {items.map((item) => (
        <div key={item.term}>
          <dt>{item.term}</dt>
          <dd>{item.meaning}</dd>
        </div>
      ))}
    </dl>
  );
}

/** D4: every control the prototype does not connect says so, in exactly these words. */
export const NOT_WIRED = "Not wired in this prototype.";
