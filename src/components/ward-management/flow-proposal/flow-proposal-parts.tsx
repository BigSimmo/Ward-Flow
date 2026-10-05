import type { ReactNode } from "react";

import styles from "./flow-proposal.module.css";

/**
 * Shared frame pieces for the referrals, handover and discharges redesign proposal (5 October
 * 2026). Same shapes as the statistics proposal's parts, so every proposed screen opens the same
 * way: breadcrumb and title, the as-at time, one answer sentence, then the work.
 */

export const NOT_WIRED = "Not wired in this prototype.";

export type ProposalScreen = "intake" | "board" | "handover" | "discharges";

export const PROPOSAL_ROUTES: Record<ProposalScreen, { label: string; href: string; current: string }> = {
  intake: {
    label: "Make a referral",
    href: "/mockups/ward-flow/referrals/new/proposal",
    current: "/mockups/ward-flow/referrals/new",
  },
  board: {
    label: "Referral board",
    href: "/mockups/ward-flow/referrals/proposal",
    current: "/mockups/ward-flow/referrals",
  },
  handover: { label: "Handover", href: "/mockups/ward-flow/handover/proposal", current: "/mockups/ward-flow/handover" },
  discharges: {
    label: "Discharges",
    href: "/mockups/ward-flow/discharges/proposal",
    current: "/mockups/ward-flow/discharges",
  },
};

/** Preview-only strip: names the screen as a proposal and links to its current version. */
export function PreviewBar({ screen }: { screen: ProposalScreen }) {
  return (
    <div className={styles.previewBar} data-testid="flow-proposal-preview-bar">
      <strong>Proposed redesign (preview)</strong>
      <nav className={styles.previewTabs} aria-label="Proposed care coordination screens">
        {(Object.keys(PROPOSAL_ROUTES) as ProposalScreen[]).map((key) => (
          <a key={key} href={PROPOSAL_ROUTES[key].href} aria-current={key === screen ? "page" : undefined}>
            {PROPOSAL_ROUTES[key].label}
          </a>
        ))}
      </nav>
      <a className={styles.link} href={PROPOSAL_ROUTES[screen].current}>
        Current {PROPOSAL_ROUTES[screen].label.toLowerCase()} ›
      </a>
    </div>
  );
}

export function ProposalHeader({
  crumbs,
  title,
  asAt,
  actions,
}: {
  crumbs: { label: string; href?: string }[];
  title: string;
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
        <h1 className={styles.title}>{title}</h1>
      </div>
      <div className={styles.asAt}>
        <span>{asAt}</span>
        <span className={styles.chip}>
          <span className={styles.chipDot} aria-hidden="true" />
          Synthetic data
        </span>
        {actions}
      </div>
    </header>
  );
}

export type Attention = { tone: "danger" | "warn" | "good" | "info"; label: string; href?: string };

/** The answer sentence, then what needs attention now, each a link to where it is dealt with. */
export function Verdict({ children, attention = [] }: { children: ReactNode; attention?: Attention[] }) {
  const toneClass = {
    danger: styles.attnDanger,
    warn: styles.attnWarn,
    good: styles.attnGood,
    info: styles.attnInfo,
  };
  return (
    <section className={styles.verdict} aria-label="Summary">
      <p className={styles.verdictText}>{children}</p>
      {attention.length ? (
        <ul className={styles.attention} aria-label="Needs attention">
          {attention.map((item) => (
            <li key={item.label} className={`${styles.attn} ${toneClass[item.tone]}`}>
              <span className={styles.attnDot} aria-hidden="true" />
              {item.href ? <a href={item.href}>{item.label}</a> : item.label}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export type Kpi = { label: string; value: ReactNode; note?: ReactNode; tone?: "good" | "warn" | "danger" };

export function KpiStrip({ items, label }: { items: Kpi[]; label: string }) {
  const tone = { good: styles.toneGood, warn: styles.toneWarn, danger: styles.toneDanger };
  return (
    <section className={styles.kpis} aria-label={label}>
      {items.map((item) => (
        <div className={styles.kpi} key={item.label}>
          <p className={styles.kpiLabel}>{item.label}</p>
          <p className={`${styles.kpiValue} ${item.tone ? tone[item.tone] : ""}`}>{item.value}</p>
          {item.note ? <p className={styles.kpiNote}>{item.note}</p> : null}
        </div>
      ))}
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
  className = "",
}: {
  title: string;
  question?: string;
  meta?: ReactNode;
  foot?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  className?: string;
}) {
  return (
    <section className={`${styles.panel} ${className}`} aria-label={title}>
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

/** A segmented filter whose buttons say how many records each choice shows. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string; count?: number }[];
  onChange: (next: T) => void;
}) {
  return (
    <div className={styles.segmented} role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.id} type="button" aria-pressed={option.id === value} onClick={() => onChange(option.id)}>
          {option.label}
          {option.count !== undefined ? <span className={styles.count}>{option.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function TierBadge({ urgency, label }: { urgency: 1 | 2 | 3; label: string }) {
  const tone = { 1: styles.tier1, 2: styles.tier2, 3: styles.tier3 }[urgency];
  return (
    <span className={`${styles.tier} ${tone}`}>
      <span className={styles.tierMark} aria-hidden="true">
        {urgency}
      </span>
      {label}
    </span>
  );
}

export function Pill({
  tone = "quiet",
  children,
}: {
  tone?: "good" | "warn" | "danger" | "quiet";
  children: ReactNode;
}) {
  const toneClass = {
    good: styles.pillGood,
    warn: styles.pillWarn,
    danger: styles.pillDanger,
    quiet: styles.pillQuiet,
  };
  return <span className={`${styles.pill} ${toneClass[tone]}`}>{children}</span>;
}

/** Plural that never prints "referral(s)". */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** A table that scrolls sideways instead of being cut off by its panel. */
export function TableScroll({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.tableScroll} role="region" aria-label={`${label} table`} tabIndex={0}>
      {children}
    </div>
  );
}
