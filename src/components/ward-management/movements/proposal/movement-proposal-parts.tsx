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

/** "1 job", "2 jobs": counts on these screens are live, so a fixed plural reads wrong at 1. */
export function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

/** The engine's refusal text names internal fields; show people a plain sentence instead. */
export function plainRefusal(reason: string | undefined) {
  if (!reason) return "The step was not recorded.";
  if (/overrideReason/.test(reason)) return "Choose a reason from the list before going ahead anyway.";
  if (/no movement found/i.test(reason)) return "This movement could not be found. It may have been closed.";
  const text = reason
    .replace(/\b[A-Z]+(?:_[A-Z]+)+\b/g, "this step")
    .replace(/\b[a-z]+[A-Z]\w*\b/g, "a required field");
  return text.charAt(0).toUpperCase() + text.slice(1);
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

/**
 * The answer line: one sentence, then what needs attention as one quiet line ("a · b · c").
 * A dot carries meaning only for a real warning (amber) or an urgent item (red).
 */
export function Verdict({ children, attention = [] }: { children: ReactNode; attention?: Attention[] }) {
  const dotClass = { danger: styles.dotDanger, warn: styles.dotWarn, good: "", info: "" };
  return (
    <section className={styles.verdict} aria-label="Summary">
      <p className={styles.verdictText}>{children}</p>
      {attention.length ? (
        <ul className={styles.attention} aria-label="Needs attention">
          {attention.map((item) => (
            <li key={item.label} className={styles.attn}>
              {dotClass[item.tone] ? (
                <span className={`${styles.dot} ${dotClass[item.tone]}`} aria-hidden="true" />
              ) : null}
              {item.tone === "danger" ? (
                <span className={styles.srOnly}>Urgent: </span>
              ) : item.tone === "warn" ? (
                <span className={styles.srOnly}>Warning: </span>
              ) : null}
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

/**
 * A quiet status label: grey text, with a small dot only when the status means something
 * (red urgent, amber warning, green done). No tinted chips.
 */
export function Pill({
  tone = "quiet",
  children,
}: {
  tone?: "good" | "warn" | "danger" | "quiet" | "accent";
  children: ReactNode;
}) {
  const dotClass = {
    good: styles.dotGood,
    warn: styles.dotWarn,
    danger: styles.dotDanger,
    quiet: "",
    accent: styles.dotAccent,
  };
  return (
    <span className={`${styles.pill} ${tone === "danger" || tone === "warn" ? styles.pillStrong : ""}`}>
      {dotClass[tone] ? <span className={`${styles.dot} ${dotClass[tone]}`} aria-hidden="true" /> : null}
      {children}
    </span>
  );
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
