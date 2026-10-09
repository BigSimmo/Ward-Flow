/**
 * The handover table's columns, shared by the screen table and the printed sheet so the two never
 * disagree. `cell` renders the screen cell; `paper` is the plain text the printed copy carries.
 */
import type { ReactNode } from "react";
import { durMinutes, StatusGlyph, type WfTone } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import {
  destinationText,
  dueShort,
  groupOf,
  isMoving,
  legalShort,
  nextStep,
  obsLong,
  STAGE_LABEL,
  type HandoverRow,
} from "./handover-model";
import styles from "./handover-refined.module.css";

export type ColumnContext = { now: Instant; cutoff: Instant; readyBeds: (unitId: string) => number };

export type HandoverColumnId = "pt" | "st" | "wait" | "route" | "lo" | "legal" | "obs" | "due" | "next" | "dec" | "tr";

export type HandoverColumn = {
  id: HandoverColumnId;
  header: string;
  /** Screen width in pixels. */
  width: number;
  /** Always shown (the patient). */
  locked?: boolean;
  mono?: boolean;
  cell: (row: HandoverRow, ctx: ColumnContext) => ReactNode;
  paper: (row: HandoverRow, ctx: ColumnContext) => string;
};

export type HandoverDensity = "min" | "std" | "full";

export const DENSITY_LABEL: Record<HandoverDensity, string> = { min: "Compact", std: "Standard", full: "Full" };

/** Status shape for a row: act now, due, moving, or waiting. Shape and colour, never colour alone. */
export function rowTone(row: HandoverRow, ctx: ColumnContext): WfTone {
  const group = groupOf(row, ctx.now, ctx.cutoff);
  if (group === "act") return "danger";
  if (group === "due") return "warning";
  if (isMoving(row)) return "info";
  return "neutral";
}

const off = <span className={styles.off}>None</span>;

export const HANDOVER_COLUMNS: HandoverColumn[] = [
  {
    id: "pt",
    header: "Patient",
    width: 188,
    locked: true,
    cell: (row) => (
      <span className={styles.two}>
        <b className={styles.trunc}>{row.name}</b>
        <span className={styles.sub}>
          <span className={styles.mono}>{row.umrn}</span>
          <span className={styles.tier} aria-label={`Tier ${row.tier}`}>
            T{row.tier}
          </span>
        </span>
      </span>
    ),
    paper: (row) => `${row.name} ${row.umrn} T${row.tier}`,
  },
  {
    id: "st",
    header: "Status",
    width: 168,
    cell: (row, ctx) => (
      <span className={styles.two}>
        <span className={styles.glyphText}>
          <StatusGlyph tone={rowTone(row, ctx)} />
          <span className={styles.trunc}>{STAGE_LABEL[row.stage]}</span>
        </span>
        <span className={styles.sub}>{row.ownerShort}</span>
      </span>
    ),
    paper: (row) => `${STAGE_LABEL[row.stage]}, ${row.ownerShort}`,
  },
  {
    id: "wait",
    header: "Waiting",
    width: 92,
    mono: true,
    cell: (row, ctx) => (
      <span className={styles.two}>
        <b className={styles.mono}>{durMinutes(ctx.now - row.openedAt)}</b>
        <span className={`${styles.sub} ${styles.mono}`}>{formatInstantWithDay(row.openedAt, ctx.now)}</span>
      </span>
    ),
    paper: (row, ctx) => durMinutes(ctx.now - row.openedAt),
  },
  {
    id: "route",
    header: "From and to",
    width: 172,
    cell: (row) => (
      <span className={styles.two}>
        <span className={styles.trunc}>{row.edShort}</span>
        <span className={`${styles.sub} ${styles.trunc}`}>{destinationText(row)}</span>
      </span>
    ),
    paper: (row) => `${row.edShort} to ${destinationText(row)}`,
  },
  {
    id: "lo",
    header: "Legal and obs",
    width: 132,
    cell: (row) => (
      <span className={styles.two}>
        <span className={styles.trunc}>{legalShort(row)}</span>
        {row.obs === "Standard" ? (
          <span className={styles.sub}>Standard obs</span>
        ) : (
          <span className={`${styles.sub} ${styles.glyphText}`}>
            <StatusGlyph tone={row.obs === "Urgent" ? "danger" : "warning"} size={8} />
            {obsLong(row)}
          </span>
        )}
      </span>
    ),
    paper: (row) => `${legalShort(row)}, ${obsLong(row).toLowerCase()}`,
  },
  {
    id: "legal",
    header: "Legal",
    width: 116,
    cell: (row) => <span className={styles.trunc}>{legalShort(row)}</span>,
    paper: (row) => legalShort(row),
  },
  {
    id: "obs",
    header: "Obs",
    width: 92,
    cell: (row) =>
      row.obs === "Standard" ? (
        <span className={styles.sub}>Standard</span>
      ) : (
        <span className={styles.glyphText}>
          <StatusGlyph tone={row.obs === "Urgent" ? "danger" : "warning"} size={8} />
          {row.obs === "Urgent" ? "Urgent" : "1:1"}
        </span>
      ),
    paper: (row) => (row.obs === "Standard" ? "Standard" : row.obs === "Urgent" ? "Urgent" : "1:1"),
  },
  {
    id: "due",
    header: "Due",
    width: 128,
    mono: true,
    cell: (row, ctx) => {
      const due = dueShort(row, ctx.now);
      return due ? <span className={`${styles.mono} ${styles.trunc}`}>{due}</span> : off;
    },
    paper: (row, ctx) => dueShort(row, ctx.now) ?? "",
  },
  {
    id: "next",
    header: "Next step",
    width: 168,
    cell: (row, ctx) => {
      const step = nextStep(row, ctx.now, ctx.cutoff, ctx.readyBeds);
      return (
        <span className={`${styles.next} ${styles[`next_${step.tone}`]}`} title={step.text}>
          {step.text}
        </span>
      );
    },
    paper: (row, ctx) => nextStep(row, ctx.now, ctx.cutoff, ctx.readyBeds).text,
  },
  {
    id: "dec",
    header: "Declined",
    width: 92,
    mono: true,
    cell: (row) => (row.declines.length ? <span className={styles.mono}>{row.declines.length}</span> : off),
    paper: (row) => String(row.declines.length),
  },
  {
    id: "tr",
    header: "Transport",
    width: 156,
    cell: (row) =>
      row.transport ? (
        <span className={styles.trunc}>
          {row.transport.leg ?? "Booked"}, {row.transport.escort ? "escort" : "no escort"}
        </span>
      ) : (
        <span className={styles.off}>Not booked</span>
      ),
    paper: (row) =>
      row.transport ? `${row.transport.leg ?? "Booked"}, ${row.transport.escort ? "escort" : "no escort"}` : "",
  },
];

export const DENSITY_COLUMNS: Record<HandoverDensity, HandoverColumnId[]> = {
  min: ["pt", "st", "wait", "route", "due", "next"],
  std: ["pt", "st", "wait", "route", "lo", "due", "next"],
  full: ["pt", "st", "wait", "route", "legal", "obs", "due", "next", "dec", "tr"],
};

export function columnsFor(ids: HandoverColumnId[]): HandoverColumn[] {
  return HANDOVER_COLUMNS.filter((column) => ids.includes(column.id));
}
