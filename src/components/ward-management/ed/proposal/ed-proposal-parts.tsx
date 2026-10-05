"use client";

import { useMemo, type ReactNode } from "react";

import { formatSheetMoment } from "@/components/ward-management/ward-clock";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";

import type { Tone } from "./ed-proposal-figures";
import styles from "./ed-proposal.module.css";

/** Preview routes today; the real `/ed` routes on approval. */
export function edProposalHref(edId?: string): string {
  return edId ? `/mockups/ward-flow/ed/proposal?ed=${encodeURIComponent(edId)}` : "/mockups/ward-flow/ed/proposal";
}

/** Every proposal panel reads live shared state and the provider's one clock through this hook. */
export function useEdProposalWorld() {
  const world = useWardFlow();
  const now = useWardFlowClock();
  return useMemo(
    () => ({
      world,
      now,
      accessTarget: world.configuration.edAccessTargetMinutes,
      asAt: `As at ${formatSheetMoment(now, world.dayZero)}`,
    }),
    [world, now],
  );
}

export function ProposalHeader({
  crumbs,
  title,
  service,
  asAt,
  actions,
}: {
  crumbs: { label: string; href?: string }[];
  title: string;
  service?: string;
  asAt: string;
  actions?: ReactNode;
}) {
  return (
    <header className={styles.header}>
      <div>
        <nav aria-label="Breadcrumb">
          <ol className={styles.crumbs}>
            {crumbs.map((crumb, index) => (
              <li key={crumb.label} aria-current={index === crumbs.length - 1 ? "page" : undefined}>
                {index > 0 ? <span aria-hidden="true">› </span> : null}
                {crumb.href ? (
                  <a className={styles.link} href={crumb.href}>
                    {crumb.label}
                  </a>
                ) : (
                  crumb.label
                )}
              </li>
            ))}
          </ol>
        </nav>
        <h1 className={styles.title}>
          {title}
          {service ? <span className={styles.titleService}>{service}</span> : null}
        </h1>
      </div>
      <div className={styles.headerSide}>
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

export function Answer({ lead, sub }: { lead: string; sub?: ReactNode }) {
  return (
    <section className={styles.answer} aria-label="Answer">
      <p className={styles.answerLead}>{lead}</p>
      {sub ? <p className={styles.answerSub}>{sub}</p> : null}
    </section>
  );
}

export type Kpi = { label: string; value: ReactNode; note?: ReactNode; tone?: Tone };

const TONE_CLASS: Record<Tone, string> = {
  danger: styles.toneDanger,
  warn: styles.toneWarn,
  good: styles.toneGood,
  quiet: "",
};

export function KpiStrip({ items, label }: { items: Kpi[]; label: string }) {
  return (
    <section className={styles.kpis} aria-label={label}>
      {items.map((item) => (
        <div className={styles.kpi} key={item.label}>
          <p className={styles.kpiLabel}>{item.label}</p>
          <p className={`${styles.kpiValue} ${item.tone ? TONE_CLASS[item.tone] : ""}`}>{item.value}</p>
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

const TONE_GLYPH: Record<Tone, string> = { danger: "!", warn: "▲", good: "✓", quiet: "•" };
const TONE_WORD: Record<Tone, string | undefined> = {
  danger: "Urgent",
  warn: "Needs action",
  good: undefined,
  quiet: undefined,
};

/** A status tag: glyph and words carry the meaning, colour only reinforces it. */
export function Tag({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={styles.tag} data-tone={tone}>
      <span className={styles.glyph} aria-hidden="true">
        {TONE_GLYPH[tone]}
      </span>
      {TONE_WORD[tone] ? <span className="sr-only">{TONE_WORD[tone]}: </span> : null}
      {children}
    </span>
  );
}

export function PreviewBar({ current }: { current: { label: string; href: string } }) {
  return (
    <div className={styles.previewBar} data-testid="ed-proposal-preview-bar">
      <strong>Proposed ED redesign (preview)</strong>
      <a className={styles.link} href={edProposalHref()}>
        ED Hub
      </a>
      <a className={styles.link} href={current.href}>
        Current screen ›
      </a>
    </div>
  );
}
