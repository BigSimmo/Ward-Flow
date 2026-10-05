import type { ReactNode } from "react";

import styles from "./community-proposal.module.css";

/**
 * Building blocks for the community redesign proposal. They mirror the statistics proposal's parts
 * (branch claude/project-thread-gnfwy1) so both proposals read as one product; on approval the two
 * copies should become one shared module rather than living twice.
 */

export const PROPOSAL_ROOT = "/mockups/ward-flow/community/proposal";

export function proposalTeamHref(teamId: string): string {
  return `${PROPOSAL_ROOT}/${encodeURIComponent(teamId)}`;
}

export function ProposalHeader({
  crumbs,
  title,
  subtitle,
  asAt,
  actions,
}: {
  crumbs: { label: string; href?: string }[];
  title: string;
  subtitle?: ReactNode;
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
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
      <div className={styles.headerSide}>
        <div className={styles.asAt}>
          <span>{asAt}</span>
          <span className={styles.chip}>
            <span className={styles.chipDot} aria-hidden="true" />
            Synthetic data
          </span>
        </div>
        {actions ? <div className={styles.headerActions}>{actions}</div> : null}
      </div>
    </header>
  );
}

export type Kpi = {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: "good" | "warn" | "danger";
  href?: string;
};

export function KpiStrip({ items, label }: { items: Kpi[]; label: string }) {
  const tone = { good: styles.toneGood, warn: styles.toneWarn, danger: styles.toneDanger };
  return (
    <section className={styles.kpis} aria-label={label}>
      {items.map((item) => {
        const body = (
          <>
            <p className={styles.kpiLabel}>{item.label}</p>
            <p className={`${styles.kpiValue} ${item.tone ? tone[item.tone] : ""}`}>{item.value}</p>
            {item.note ? <p className={styles.kpiNote}>{item.note}</p> : null}
          </>
        );
        return item.href ? (
          <a className={`${styles.kpi} ${styles.kpiLink}`} key={item.label} href={item.href}>
            {body}
          </a>
        ) : (
          <div className={styles.kpi} key={item.label}>
            {body}
          </div>
        );
      })}
    </section>
  );
}

export function Panel({
  id,
  title,
  question,
  meta,
  foot,
  children,
  flush = false,
}: {
  id?: string;
  title: string;
  question?: string;
  meta?: ReactNode;
  foot?: ReactNode;
  children: ReactNode;
  flush?: boolean;
}) {
  return (
    <section id={id} className={styles.panel} aria-label={title} tabIndex={id ? -1 : undefined}>
      <div className={styles.panelHead}>
        <div>
          <h2 className={styles.panelTitle}>{title}</h2>
          {question ? <p className={styles.panelQuestion}>{question}</p> : null}
        </div>
        {meta !== undefined ? <span className={styles.panelMeta}>{meta}</span> : null}
      </div>
      {flush ? children : <div className={styles.panelBody}>{children}</div>}
      {foot ? <div className={styles.panelFoot}>{foot}</div> : null}
    </section>
  );
}

export function TableScroll({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.tableScroll} role="region" aria-label={`${label} table`} tabIndex={0}>
      {children}
    </div>
  );
}

export type Attention = { tone: "danger" | "warn" | "good" | "info"; label: string; href?: string };

/** The answer first: one plain sentence, then the few things that need someone's attention now. */
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

export function Empty({ children }: { children: ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}

/** Preview-only frame above each proposal page: says what it is and links back to the current page. */
export function PreviewBar({ currentHref, label }: { currentHref: string; label: string }) {
  return (
    <div className={styles.previewBar} data-testid="community-proposal-preview-bar">
      <strong>Proposed community redesign (preview)</strong>
      <span>{label}</span>
      <a className={styles.link} href={currentHref}>
        Current page ›
      </a>
    </div>
  );
}
