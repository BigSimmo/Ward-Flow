import type { ReactNode } from "react";

import type { BedFigures } from "./statistics-proposal-figures";
import styles from "./statistics-proposal.module.css";

/** Where a proposal screen links to. Preview routes today; the real statistics routes on approval. */
export type ProposalScreen = "statewide" | "service" | "ward" | "ed" | "community" | "compare";

export function proposalHref(screen: ProposalScreen, id?: string): string {
  const query = new URLSearchParams({ screen });
  if (id) query.set("id", id);
  return `/mockups/ward-flow/statistics/proposal?${query.toString()}`;
}

export function ProposalHeader({
  crumbs,
  title,
  swatch,
  asAt,
}: {
  crumbs: { label: string; href?: string }[];
  title: string;
  swatch?: string;
  asAt: string;
}) {
  return (
    <header className={styles.header}>
      <div>
        <nav aria-label="Statistics breadcrumb">
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
          {swatch ? <span className={styles.swatch} style={{ background: swatch }} aria-hidden="true" /> : null}
          {title}
        </h1>
      </div>
      <div className={styles.asAt}>
        <span>{asAt}</span>
        <span className={styles.chip}>
          <span className={styles.chipDot} aria-hidden="true" />
          Synthetic data
        </span>
      </div>
    </header>
  );
}

export type Kpi = {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: "good" | "warn" | "danger";
  keyClass?: string;
};

export function KpiStrip({ items, label }: { items: Kpi[]; label: string }) {
  return (
    <section className={styles.kpis} aria-label={label}>
      {items.map((item) => (
        <div className={styles.kpi} key={item.label}>
          <p className={styles.kpiLabel}>
            {item.keyClass ? <span className={`${styles.key} ${item.keyClass}`} aria-hidden="true" /> : null}
            {item.label}
          </p>
          <p
            className={`${styles.kpiValue} ${
              item.tone === "good"
                ? styles.toneGood
                : item.tone === "warn"
                  ? styles.toneWarn
                  : item.tone === "danger"
                    ? styles.toneDanger
                    : ""
            }`}
          >
            {item.value}
          </p>
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

/** Ready · Pulled · Closed · Occupied, always in that order and always adding up to the beds. */
export function BedBar({
  figures,
  large = false,
  scaleTo,
}: {
  figures: BedFigures;
  large?: boolean;
  scaleTo?: number;
}) {
  const total = scaleTo ?? figures.beds;
  const width = (count: number) => `${total > 0 ? (count / total) * 100 : 0}%`;
  return (
    <div
      className={`${styles.bar} ${large ? styles.barLarge : ""}`}
      role="img"
      aria-label={`${figures.beds} beds: ${figures.occupied} occupied, ${figures.pulled} pulled, ${figures.closed} closed, ${figures.ready} ready`}
    >
      <span className={styles.segOccupied} style={{ width: width(figures.occupied) }} />
      <span className={styles.segPulled} style={{ width: width(figures.pulled) }} />
      <span className={styles.segClosed} style={{ width: width(figures.closed) }} />
      <span className={styles.segReady} style={{ width: width(figures.ready) }} />
    </div>
  );
}

export function BedLegend({ figures }: { figures?: BedFigures }) {
  const rows = [
    { label: "Occupied", className: styles.segOccupied, value: figures?.occupied },
    { label: "Pulled (bed given, patient not yet arrived)", className: styles.segPulled, value: figures?.pulled },
    { label: "Closed", className: styles.segClosed, value: figures?.closed },
    { label: "Ready", className: styles.segReady, value: figures?.ready },
  ];
  return (
    <ul className={styles.legend}>
      {rows.map((row) => (
        <li key={row.label}>
          <span className={`${styles.key} ${row.className}`} aria-hidden="true" />
          {row.value !== undefined ? <strong>{row.value}</strong> : null}
          {row.label}
        </li>
      ))}
    </ul>
  );
}

export function OccupancyPill({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const tone = pct >= 95 ? styles.pillDanger : pct >= 90 ? styles.pillWarn : styles.pillQuiet;
  return <span className={`${styles.pill} ${tone}`}>{pct}%</span>;
}

export function ReadyPill({ value }: { value: number }) {
  return <span className={`${styles.pill} ${value === 0 ? styles.pillDanger : styles.pillGood}`}>{value}</span>;
}

export function Definitions() {
  return (
    <dl className={styles.definitions} aria-label="How these figures are counted">
      <div>
        <dt>Occupancy</dt>
        <dd>Occupied beds ÷ all beds. People on leave keep their bed and count as occupied.</dd>
      </div>
      <div>
        <dt>Pulled</dt>
        <dd>A bed given to someone who has not arrived yet. Not counted as occupied.</dd>
      </div>
      <div>
        <dt>Closed</dt>
        <dd>Empty, but the ward is not offering it.</dd>
      </div>
      <div>
        <dt>Waiting for a bed</dt>
        <dd>Open requests from emergency departments. The same number on every screen.</dd>
      </div>
    </dl>
  );
}
