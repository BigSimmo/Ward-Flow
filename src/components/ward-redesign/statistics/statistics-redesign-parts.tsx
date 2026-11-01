"use client";

/**
 * The shared pieces of the statistics pages (redesign approved by Josh, 1 Nov 2026, Q135), built
 * from the app's own kit (Card, CardHead, Segmented, FilterChip, BarList, Meter, StackBar,
 * StatusGlyph, the table class) and the Capacity page's tile strip and card foot. Nothing here
 * calculates: every figure is handed in by the page that owns it.
 */
import { type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import {
  BarList,
  Card,
  CardHead,
  Meter,
  StackBar,
  StatusGlyph,
  cx,
  tableClasses,
  type BarListRow,
  type StackSegment,
  type WfTone,
} from "@/components/wf";
import { HowWorkedOut } from "@/components/ward-management/capacity/capacity-how-worked-out";
import cap from "@/components/ward-management/capacity/capacity-page.module.css";

import s from "./statistics-redesign.module.css";

export { s as redesignStyles };

export function Glyph({ tone }: { tone: WfTone }) {
  return <StatusGlyph tone={tone} size={9} />;
}

export function MoreLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={s.link}>
      {children}
      <ChevronRight size={14} aria-hidden="true" />
    </Link>
  );
}

/** The Capacity card foot: one short line, the method folded away, one link. */
export function Foot({ children, how, link }: { children?: ReactNode; how?: ReactNode[]; link?: ReactNode }) {
  return (
    <div className={cx(cap.cardFoot, s.foot)}>
      <span className={s.footLead}>{children}</span>
      {how ? (
        <div className={s.how}>
          <HowWorkedOut label="How this is counted">
            {how.map((line, index) => (
              <p key={index}>{line}</p>
            ))}
          </HowWorkedOut>
        </div>
      ) : null}
      {link}
    </div>
  );
}

export function StatCardR({
  id,
  title,
  meta,
  aside,
  foot,
  className,
  children,
}: {
  id: string;
  title: string;
  meta?: ReactNode;
  aside?: ReactNode;
  foot?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cx(s.card, className)} aria-labelledby={id} data-ward-primitive="panel">
      <CardHead id={id} title={title} meta={meta} action={aside} />
      {children}
      {foot}
    </Card>
  );
}

export function Strip({ cols, label, children }: { cols?: number; label: string; children: ReactNode }) {
  return (
    <ul
      className={cx(cap.mmStrip, s.strip)}
      aria-label={label}
      style={cols ? ({ "--cols": cols } as CSSProperties) : undefined}
    >
      {children}
    </ul>
  );
}

export function Now({ tone, children }: { tone?: "warning" | "danger" | "success"; children: ReactNode }) {
  const ink =
    tone === "warning" ? cap.warnInk : tone === "danger" ? s.dangerInk : tone === "success" ? s.okInk : s.nowMuted;
  return (
    <span className={cx(cap.mmTileNow, ink)}>
      {tone ? <Glyph tone={tone} /> : null}
      {children}
    </span>
  );
}

export function Tile({
  title,
  now,
  fig,
  unit,
  sub,
  muted = false,
  testId,
  children,
}: {
  title: ReactNode;
  now?: ReactNode;
  fig?: ReactNode;
  unit?: ReactNode;
  sub?: ReactNode;
  muted?: boolean;
  testId?: string;
  children?: ReactNode;
}) {
  return (
    <li className={cx(cap.mmTile, s.tile, muted && s.muted)} data-testid={testId}>
      <div className={cap.mmTileHead}>
        <h3 className={cx(cap.mmTileTitle, s.tileTitle)}>{title}</h3>
        {now}
      </div>
      {fig != null ? (
        <p className={s.fig}>
          <b>{fig}</b>
          {unit ? <span>{unit}</span> : null}
        </p>
      ) : null}
      {children}
      {sub ? <p className={cap.mmSub}>{sub}</p> : null}
    </li>
  );
}

export function Facts({ items }: { items: { value: ReactNode; label: string; tone?: WfTone; warn?: boolean }[] }) {
  return (
    <span className={s.facts}>
      {items.map((item) => (
        <span key={item.label} className={item.warn ? s.warnInk : undefined}>
          {item.tone ? <Glyph tone={item.tone} /> : null}
          <b>{item.value}</b> {item.label}
        </span>
      ))}
    </span>
  );
}

/** Beds in use, pulled, closed and ready, as one stacked bar (the kit's StackBar). */
export function BedStack({
  label,
  used,
  pulled,
  closed = 0,
  ready,
  beds,
}: {
  label: string;
  used: number;
  pulled: number;
  closed?: number;
  ready: number;
  beds: number;
}) {
  const segments: StackSegment[] = [
    { id: "used", value: used - pulled, fill: "data-1", label: "Occupied" },
    { id: "pulled", value: pulled, fill: "data-2", label: "Pulled" },
    { id: "closed", value: closed, fill: "closed", label: "Closed" },
    { id: "ready", value: ready, fill: "ready", label: "Ready" },
    { id: "rest", value: Math.max(0, beds - used - closed - ready), fill: "track", label: "Other" },
  ];
  return <StackBar segments={segments} label={label} className={s.stackGap} />;
}

type BarRow = { name: string; value: number; display?: string; sub?: string; flag?: WfTone };

/** One series, value at the tip, recessive track (the kit's BarList). */
export function Bars({
  rows,
  label,
  max,
  mean,
  meanLabel,
  axis = false,
}: {
  rows: BarRow[];
  label: string;
  max?: number;
  mean?: number;
  meanLabel?: string;
  axis?: boolean;
}) {
  const list: BarListRow[] = rows.map((row) => ({
    id: row.name,
    label: row.name,
    sub: row.sub,
    value: row.value,
    display: row.display ?? String(row.value),
    flag: row.flag,
  }));
  return (
    <div className={s.bars}>
      <BarList rows={list} label={label} max={max} mean={mean} meanLabel={meanLabel} axis={axis} track />
    </div>
  );
}

export function Name({ name, sub }: { name: string; sub?: string }) {
  return (
    <span className={s.name}>
      {name}
      {sub ? <small>{sub}</small> : null}
    </span>
  );
}

/** Occupancy with the kit's Meter and its alert line; at or over the line takes the warning glyph. */
export function Occ({ pct, threshold, label }: { pct: number; threshold: number; label: string }) {
  const hot = pct >= threshold;
  return (
    <span className={s.occ}>
      <Meter
        value={pct}
        max={100}
        threshold={threshold}
        fill={hot ? "warning" : "data-1"}
        label={label}
        valueText={null}
      />
      <b className={s.gv}>
        {hot ? <Glyph tone="warning" /> : null}
        {pct}%
      </b>
    </span>
  );
}

type Cell = ReactNode;
type Row = { cells: Cell[]; kind?: "total" | "group"; key?: string };

/** A plain table with the kit's table class: first cell is the row header, ">" marks a number column. */
export function DataTable({
  cols,
  rows,
  caption,
  className,
}: {
  cols: string[];
  rows: Row[];
  caption: string;
  className?: string;
}) {
  const right = cols.map((col) => col.startsWith(">"));
  return (
    <div className={s.tableWrap}>
      <table className={cx(tableClasses.table, s.table, className)}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {cols.map((col, index) => (
              <th key={col} scope="col" className={right[index] ? s.r : undefined}>
                {col.replace(/^>/, "")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) =>
            row.kind === "group" ? (
              <tr key={row.key ?? rowIndex} className={s.group}>
                <th scope="rowgroup" colSpan={cols.length}>
                  {row.cells[0]}
                </th>
              </tr>
            ) : (
              <tr key={row.key ?? rowIndex} className={row.kind === "total" ? s.total : undefined}>
                {row.cells.map((cell, index) =>
                  index === 0 ? (
                    <th key={index} scope="row">
                      {cell}
                    </th>
                  ) : (
                    <td key={index} className={right[index] ? cx(s.r, tableClasses.num) : undefined}>
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Grid({
  layout = "halves",
  top = false,
  children,
}: {
  layout?: "halves" | "thirds" | "wide";
  top?: boolean;
  children: ReactNode;
}) {
  return <div className={cx(s.grid, s[layout], top && s.top)}>{children}</div>;
}
