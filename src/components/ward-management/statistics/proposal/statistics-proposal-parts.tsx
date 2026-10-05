import type { ReactNode } from "react";

import { csvCell } from "@/components/ward-management/statistics/statistics-csv";
import { RELEASE_BANDS } from "@/components/ward-management/ward-bed-availability";

import {
  RELEASE_BAND_LABELS,
  type BedFigures,
  type ReleaseCounts,
  releasesOverdue,
} from "./statistics-proposal-figures";
import styles from "./statistics-proposal.module.css";

/** Where a proposal screen links to. Preview routes today; the real statistics routes on approval. */
export type ProposalScreen = "statewide" | "network" | "service" | "ward" | "ed" | "community" | "flow" | "compare";

export function proposalHref(screen: ProposalScreen, id?: string): string {
  const query = new URLSearchParams({ screen: `proposed-${screen}` });
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
  meter?: { value: number; tone?: "accent" | "good" | "warn" | "danger" };
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
          {item.meter ? <Meter value={item.meter.value} tone={item.meter.tone} /> : null}
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

/**
 * Saves the rows on screen as a CSV file, built in the browser from the same figures. Ward-level
 * figures only: no person appears in any export this proposal offers.
 */
export function ExportCsvButton({
  filename,
  rows,
  label = "Export CSV",
}: {
  filename: string;
  rows: (string | number)[][];
  label?: string;
}) {
  const save = () => {
    const url = URL.createObjectURL(
      new Blob([rows.map((row) => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button type="button" className={styles.exportButton} onClick={save}>
      {label}
    </button>
  );
}

/** A table that scrolls sideways on a narrow screen instead of being cut off by its panel. */
export function TableScroll({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.tableScroll} role="region" aria-label={`${label} table`} tabIndex={0}>
      {children}
    </div>
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
    <dl id="definitions" className={styles.definitions} aria-label="How these figures are counted">
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

/** One square per bed, in the ruled order, so a ward's state reads at a glance. */
export function BedGrid({ figures, size = "md" }: { figures: BedFigures; size?: "sm" | "md" }) {
  const cells: { key: string; className: string; title: string }[] = [];
  const push = (count: number, className: string, title: string) => {
    for (let index = 0; index < count; index += 1) cells.push({ key: `${title}-${index}`, className, title });
  };
  push(figures.occupied - figures.onLeave, styles.cellOccupied, "Occupied");
  push(figures.onLeave, `${styles.cellOccupied} ${styles.cellLeave}`, "Occupied, patient on leave");
  push(figures.pulled, styles.cellPulled, "Pulled");
  push(figures.closed, styles.cellClosed, "Closed");
  push(figures.ready - figures.beingMadeReady, styles.cellReady, "Ready");
  push(figures.beingMadeReady, `${styles.cellReady} ${styles.cellPreparing}`, "Ready, being made ready");
  return (
    <div
      className={`${styles.bedGrid} ${size === "sm" ? styles.bedGridSm : ""}`}
      role="img"
      aria-label={`${figures.beds} beds: ${figures.occupied} occupied (${figures.onLeave} on leave), ${figures.pulled} pulled, ${figures.closed} closed, ${figures.ready} ready`}
    >
      {cells.map((cell) => (
        <span key={cell.key} className={`${styles.cell} ${cell.className}`} title={cell.title} />
      ))}
    </div>
  );
}

export function BedGridLegend() {
  return (
    <ul className={styles.legend}>
      <li>
        <span className={`${styles.cell} ${styles.cellOccupied}`} aria-hidden="true" />
        Occupied
      </li>
      <li>
        <span className={`${styles.cell} ${styles.cellOccupied} ${styles.cellLeave}`} aria-hidden="true" />
        On leave (bed held)
      </li>
      <li>
        <span className={`${styles.cell} ${styles.cellPulled}`} aria-hidden="true" />
        Pulled
      </li>
      <li>
        <span className={`${styles.cell} ${styles.cellClosed}`} aria-hidden="true" />
        Closed
      </li>
      <li>
        <span className={`${styles.cell} ${styles.cellReady}`} aria-hidden="true" />
        Ready
      </li>
      <li>
        <span className={`${styles.cell} ${styles.cellReady} ${styles.cellPreparing}`} aria-hidden="true" />
        Being made ready
      </li>
    </ul>
  );
}

/** Beds expected to come free, by the ward's own release bands. Confirmed solid, expected pale. */
export function ReleaseTimeline({ releases }: { releases: ReleaseCounts }) {
  const max = Math.max(1, ...RELEASE_BANDS.map((band) => releases[band].confirmed + releases[band].expected));
  const overdue = releasesOverdue(releases);
  return (
    <>
      <div className={styles.timeline}>
        {RELEASE_BANDS.map((band) => {
          const { confirmed, expected } = releases[band];
          return (
            <div className={styles.timelineCol} key={band}>
              <span className={styles.columnValue}>{confirmed + expected}</span>
              <span className={styles.timelineStack} aria-hidden="true">
                <span className={styles.timelineExpected} style={{ height: `${(expected / max) * 6}rem` }} />
                <span className={styles.timelineConfirmed} style={{ height: `${(confirmed / max) * 6}rem` }} />
              </span>
              <span className={styles.timelineLabel}>{RELEASE_BAND_LABELS[band]}</span>
              <span className={styles.rowSub}>
                {confirmed} confirmed
                <br />
                {expected} expected
              </span>
            </div>
          );
        })}
      </div>
      {overdue ? (
        <p className={styles.overdueNote}>
          <strong>Not counted above: {overdue}</strong> {overdue === 1 ? "discharge was" : "discharges were"} dated an
          earlier day and {overdue === 1 ? "has" : "have"} not happened, so {overdue === 1 ? "it is" : "they are"} not
          counted as free today.{" "}
          <a className={styles.link} href={proposalHref("flow")}>
            Who is past their date ›
          </a>
        </p>
      ) : null}
    </>
  );
}

/** A thin proportion meter for a headline tile. */
export function Meter({ value, tone = "accent" }: { value: number; tone?: "accent" | "good" | "warn" | "danger" }) {
  const fill = {
    accent: styles.segOccupied,
    good: styles.segReady,
    warn: styles.segPulled,
    danger: styles.meterDanger,
  };
  return (
    <span className={styles.meter} aria-hidden="true">
      <span className={fill[tone]} style={{ width: `${Math.min(1, Math.max(0, value)) * 100}%` }} />
    </span>
  );
}
