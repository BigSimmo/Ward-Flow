import type { ReactNode } from "react";

import styles from "./oversight-proposal.module.css";

/**
 * Shared pieces for the 5 October 2026 oversight and settings proposal. Kept apart from the live
 * screens on purpose: nothing here is imported by a current route, so the current screens are
 * unchanged until a proposal is approved.
 */

export type Tone = "good" | "warn" | "danger" | "quiet" | "accent";

const DOT: Record<Tone, string> = {
  good: styles.dotGood,
  warn: styles.dotWarn,
  danger: styles.dotDanger,
  quiet: styles.dotQuiet,
  accent: "",
};

const PILL: Record<Tone, string> = {
  good: styles.pillGood,
  warn: styles.pillWarn,
  danger: styles.pillDanger,
  quiet: "",
  accent: styles.pillAccent,
};

const VALUE: Partial<Record<Tone, string>> = {
  good: styles.toneGood,
  warn: styles.toneWarn,
  danger: styles.toneDanger,
};

const PROPOSALS = [
  { id: "governance", label: "Governance", current: "/mockups/ward-flow/governance" },
  { id: "legal-forms", label: "Legal forms", current: "/mockups/ward-flow/legal-forms" },
  { id: "out-of-area", label: "Out of area", current: "/mockups/ward-flow/out-of-area" },
  { id: "settings", label: "Settings", current: "/mockups/ward-flow/settings" },
] as const;

export type ProposalId = (typeof PROPOSALS)[number]["id"];

/** Preview-only frame: says this is a proposal, switches between the set and links to the current screen. */
export function ProposalPreviewBar({ active }: { active: ProposalId }) {
  const current = PROPOSALS.find((entry) => entry.id === active)!;
  return (
    <div className={styles.previewBar} data-testid="oversight-proposal-preview-bar">
      <strong>Proposed redesign (preview)</strong>
      <nav className={styles.previewTabs} aria-label="Proposed oversight screens">
        {PROPOSALS.map((entry) => (
          <a key={entry.id} href={`${entry.current}/proposal`} aria-current={entry.id === active ? "page" : undefined}>
            {entry.label}
          </a>
        ))}
      </nav>
      <a className={styles.link} href={current.current}>
        Current {current.label.toLowerCase()} ›
      </a>
    </div>
  );
}

export function ProposalHeader({
  crumb,
  title,
  subtitle,
  asAt,
  actions,
}: {
  crumb: string;
  title: string;
  subtitle?: string;
  asAt?: string;
  actions?: ReactNode;
}) {
  return (
    <header className={styles.header}>
      <div>
        <p className={styles.crumbs}>{crumb}</p>
        <h1 className={styles.title}>{title}</h1>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
      <div className={styles.asAt}>
        {asAt ? <span>{asAt}</span> : null}
        <span className={styles.chip}>
          <span className={styles.chipDot} aria-hidden="true" />
          Synthetic data
        </span>
        {actions}
      </div>
    </header>
  );
}

export type Attention = { tone: Tone; label: ReactNode; href?: string };

/** The screen's answer in one sentence, then what needs attention now. */
export function Verdict({ children, attention = [] }: { children: ReactNode; attention?: Attention[] }) {
  return (
    <section className={styles.verdict} aria-label="Summary">
      <p className={styles.verdictText}>{children}</p>
      {attention.length > 0 ? (
        <ul className={styles.attention} aria-label="Needs attention now">
          {attention.map((item, index) => (
            <li key={index} className={styles.attn}>
              <span className={`${styles.dot} ${DOT[item.tone]}`} aria-hidden="true" />
              {item.href ? <a href={item.href}>{item.label}</a> : item.label}
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
  tone?: Tone;
  /** When set the tile is a filter toggle. */
  pressed?: boolean;
  onPress?: () => void;
};

export function KpiStrip({ items, label }: { items: Kpi[]; label: string }) {
  return (
    <section className={styles.kpis} aria-label={label}>
      {items.map((item) => {
        const body = (
          <>
            <span className={styles.kpiLabel}>{item.label}</span>
            <span className={`${styles.kpiValue} ${item.tone ? (VALUE[item.tone] ?? "") : ""}`}>{item.value}</span>
            {item.note ? <span className={styles.kpiNote}>{item.note}</span> : null}
          </>
        );
        return item.onPress ? (
          <button
            key={item.label}
            type="button"
            className={styles.kpi}
            aria-pressed={item.pressed ?? false}
            onClick={item.onPress}
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

export function Pill({ tone = "quiet", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`${styles.pill} ${PILL[tone]}`}>{children}</span>;
}

/** D4: a control that is not connected says so, in exactly these words. */
export const NOT_WIRED = "Not wired in this prototype.";

export function NotWiredButton({ children }: { children: ReactNode }) {
  return (
    <span className={styles.toolbar}>
      <button type="button" className={styles.button} disabled>
        {children}
      </button>
      <span className={styles.notWired}>{NOT_WIRED}</span>
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
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className={styles.segmented} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
