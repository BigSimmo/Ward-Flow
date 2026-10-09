"use client";

/**
 * The print sheet builder (approved option C, refined Handover, 9 Oct 2026). An options rail on
 * the left and a live A4 preview on the right that is exactly what prints. Rows and paper text come
 * from the shared handover columns so the board and the paper never disagree. Patients are named
 * by record and UMRN only; the journey id is a key and a callback argument, never shown.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { ChevronLeft, Printer } from "lucide-react";
import { Button, Card, Segmented, StatusGlyph, Switch, cx, type WfTone } from "@/components/wf";
import { formatInstant, formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { rowTone, type ColumnContext, type HandoverColumn } from "./handover-columns";
import {
  groupOf,
  handoverGroups,
  isActNow,
  isbarLines,
  isMoving,
  isWaitingForBed,
  type HandoverGroupId,
  type HandoverRow,
  type HandoverWard,
  type HeldDischarge,
  type RowGroup,
} from "./handover-model";
import styles from "./handover-print-sheet.module.css";

/* ------------------------------------------------------------------ options */

export type PrintOptions = {
  isbar: boolean;
  beds: boolean;
  holds: boolean;
  signatures: boolean;
  highlightFirst: boolean;
  orientation: "landscape" | "portrait";
};

export const DEFAULT_PRINT_OPTIONS: PrintOptions = {
  isbar: false,
  beds: true,
  holds: true,
  signatures: true,
  highlightFirst: false,
  orientation: "landscape",
};

/** A4 in CSS pixels at 96 dpi. */
const PAPER = {
  landscape: { width: 1123, height: 794 },
  portrait: { width: 794, height: 1123 },
} as const;

/* ------------------------------------------------------------------ pagination */

type PaperItem =
  | { kind: "group"; group: RowGroup; continued: boolean }
  | { kind: "row"; row: HandoverRow }
  | { kind: "isbar"; row: HandoverRow };

function paperItems(
  groups: RowGroup[],
  options: PrintOptions,
  isHighlighted: (row: HandoverRow) => boolean,
  anyHighlight: boolean,
) {
  const out: PaperItem[] = [];
  for (const group of groups) {
    if (group.rows.length === 0) continue;
    out.push({ kind: "group", group, continued: false });
    const rows =
      options.highlightFirst && anyHighlight
        ? [...group.rows.filter(isHighlighted), ...group.rows.filter((row) => !isHighlighted(row))]
        : group.rows;
    for (const row of rows) {
      out.push({ kind: "row", row });
      if (options.isbar) out.push({ kind: "isbar", row });
    }
  }
  return out;
}

const itemHeight = (item: PaperItem) => (item.kind === "group" ? 22 : item.kind === "isbar" ? 20 : 23);

/**
 * Split the items into pages, as the approved mockup estimates them: page height less the margins,
 * header, footer and table head, balanced so the last page is not a stub. A group that carries over
 * repeats its header marked "continued"; an ISBAR line stays with its patient.
 */
function paginate(items: PaperItem[], orientation: PrintOptions["orientation"]): PaperItem[][] {
  const height = PAPER[orientation].height;
  const avail = height - 30 - 24 - 58 - 34 - 22;
  const total = items.reduce((sum, item) => sum + itemHeight(item), 34);
  const count = Math.max(1, Math.ceil(total / avail));
  const target = Math.min(avail, Math.ceil(total / count) + 30);
  const pages: PaperItem[][] = [[]];
  let used = 34;
  let current: RowGroup | null = null;
  items.forEach((item, index) => {
    if (item.kind === "group") current = item.group;
    const next = items[index + 1];
    const need =
      itemHeight(item) + (item.kind === "group" ? 23 : item.kind === "row" && next?.kind === "isbar" ? 20 : 0);
    const page = pages[pages.length - 1]!;
    if (item.kind !== "isbar" && used + need > target && page.length > 0) {
      pages.push([]);
      used = 0;
      if (item.kind !== "group" && current !== null) {
        pages[pages.length - 1]!.push({ kind: "group", group: current, continued: true });
        used += 22;
      }
    }
    pages[pages.length - 1]!.push(item);
    used += itemHeight(item);
  });
  return pages;
}

type ExtraEntry =
  { kind: "ward"; ward: HandoverWard } | { kind: "hold"; hold: HeldDischarge } | { kind: "noHolds" } | { kind: "sigs" };
type ExtraSectionId = "beds" | "holds" | "sigs";
type ExtraSection = { id: ExtraSectionId; entries: ExtraEntry[]; continued: boolean };

const EXTRA_SECTION: Record<ExtraEntry["kind"], ExtraSectionId> = {
  ward: "beds",
  hold: "holds",
  noHolds: "holds",
  sigs: "sigs",
};
/* Heading plus table head, one table row, and the two signature lines with their heading. */
const EXTRA_HEAD = 50;
const extraHeight = (entry: ExtraEntry) => (entry.kind === "sigs" ? 105 : 23);

/**
 * Flow Beds by ward, Discharges held up and the signature lines over as many pages as they need.
 * Landscape keeps two columns (beds left, holds and signatures right); portrait stacks them. A
 * section that carries over repeats its heading marked "continued". Returns pages of columns.
 */
function paginateExtra(streams: ExtraEntry[][], orientation: PrintOptions["orientation"]): ExtraSection[][][] {
  const avail = PAPER[orientation].height - 30 - 24 - 58 - 22;
  const columns = streams.map((stream) => {
    const pages: ExtraSection[][] = [[]];
    const seen = new Set<ExtraSectionId>();
    let used = 0;
    for (const entry of stream) {
      const id = EXTRA_SECTION[entry.kind];
      let page = pages[pages.length - 1]!;
      let section = page[page.length - 1]?.id === id ? page[page.length - 1]! : null;
      const need = (section ? 0 : EXTRA_HEAD) + extraHeight(entry);
      if (used + need > avail && page.length > 0) {
        page = [];
        pages.push(page);
        section = null;
        used = 0;
      }
      if (section === null) {
        section = { id, entries: [], continued: seen.has(id) };
        seen.add(id);
        page.push(section);
        used += EXTRA_HEAD;
      }
      section.entries.push(entry);
      used += extraHeight(entry);
    }
    return pages;
  });
  const count = Math.max(...columns.map((pages) => pages.length));
  return Array.from({ length: count }, (_, index) => columns.map((pages) => pages[index] ?? []));
}

const GROUP_TONE: Record<HandoverGroupId, WfTone> = {
  act: "danger",
  due: "warning",
  bed: "neutral",
  acc: "neutral",
  mov: "info",
};

/** Paper column widths in pixels; the route column takes what is left. */
function paperWidth(column: HandoverColumn, landscape: boolean): string | undefined {
  switch (column.id) {
    case "route":
      return undefined;
    case "next":
      return `${landscape ? 180 : 140}px`;
    case "lo":
      return `${landscape ? 136 : 104}px`;
    case "pt":
      return `${landscape ? 210 : 170}px`;
    case "st":
      return `${landscape ? 146 : 130}px`;
    case "due":
      return `${landscape ? 112 : 96}px`;
    default:
      return `${Math.round(column.width * (landscape ? 0.82 : 0.6))}px`;
  }
}

/* ------------------------------------------------------------------ component */

export type HandoverPrintSheetProps = {
  groups: RowGroup[];
  columns: HandoverColumn[];
  ctx: ColumnContext;
  wards: HandoverWard[];
  held: HeldDischarge[];
  /** Act-now patients the scope leaves out; the copy names them so narrowing never hides them. */
  outsideAct: HandoverRow[];
  isHighlighted: (row: HandoverRow) => boolean;
  anyHighlight: boolean;
  scopeLabel: string;
  shiftLabel: string;
  densityLabel: string;
  sheetDate: string;
  options: PrintOptions;
  onOptionsChange: (next: PrintOptions) => void;
  controls: ReactNode;
  highlightControls: ReactNode;
  onOpenPatient: (movementId: string) => void;
  onBack: () => void;
  onPrinted: (takenAt: Instant) => void;
  takenAt: Instant | null;
  now: Instant;
};

const INCLUDE: { key: "isbar" | "beds" | "holds" | "signatures" | "highlightFirst"; label: string }[] = [
  { key: "isbar", label: "ISBAR line under each patient" },
  { key: "beds", label: "Beds by ward" },
  { key: "holds", label: "Discharges held up" },
  { key: "signatures", label: "Handover signatures" },
  { key: "highlightFirst", label: "Highlighted rows first in group" },
];

export function HandoverPrintSheet({
  groups,
  columns,
  ctx,
  wards,
  held,
  outsideAct,
  isHighlighted,
  anyHighlight,
  scopeLabel,
  shiftLabel,
  densityLabel,
  sheetDate,
  options,
  onOptionsChange,
  controls,
  highlightControls,
  onOpenPatient,
  onBack,
  onPrinted,
  takenAt,
  now,
}: HandoverPrintSheetProps) {
  const landscape = options.orientation === "landscape";
  const paper = PAPER[options.orientation];

  /* Fit the A4 pages to the preview width. Scale with a transform, never zoom. */
  const stackRef = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState<number | null>(null);
  useEffect(() => {
    const node = stackRef.current;
    if (node === null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width !== undefined && width > 0) setPreviewWidth(width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const scale = Math.min(1, (previewWidth ?? paper.width * 0.75) / paper.width);

  const pages = useMemo(
    () => paginate(paperItems(groups, options, isHighlighted, anyHighlight), options.orientation),
    [groups, options, isHighlighted, anyHighlight],
  );
  const extraPages = useMemo(() => {
    if (!options.beds && !options.holds && !options.signatures) return [];
    const beds: ExtraEntry[] = options.beds ? wards.map((ward) => ({ kind: "ward", ward })) : [];
    const rest: ExtraEntry[] = [
      ...(options.holds
        ? held.length === 0
          ? [{ kind: "noHolds" } as const]
          : held.map((hold) => ({ kind: "hold", hold }) as const)
        : []),
      ...(options.signatures ? [{ kind: "sigs" } as const] : []),
    ];
    return paginateExtra(landscape ? [beds, rest] : [[...beds, ...rest]], options.orientation);
  }, [options.beds, options.holds, options.signatures, options.orientation, landscape, wards, held]);
  const totalPages = pages.length + extraPages.length;

  const rows = useMemo(() => {
    const seen = new Map<string, HandoverRow>();
    for (const group of groups) for (const row of group.rows) seen.set(row.id, row);
    return [...seen.values()];
  }, [groups]);
  const dueTitle = handoverGroups(ctx.cutoff, ctx.now)[1].title;
  const summary: [string, number][] = [
    ["Open", rows.length],
    ["Act now", rows.filter((row) => isActNow(row, ctx.now)).length],
    [dueTitle, rows.filter((row) => groupOf(row, ctx.now, ctx.cutoff) === "due").length],
    ["Waiting for a bed", rows.filter(isWaitingForBed).length],
    ["Moving", rows.filter(isMoving).length],
    ["Beds ready", wards.reduce((sum, ward) => sum + ward.ready, 0)],
    ["Being made ready", wards.reduce((sum, ward) => sum + ward.pendingPreparation, 0)],
  ];

  const taken = formatInstantWithDay(takenAt ?? now, now);
  const meta = `${scopeLabel} · ${shiftLabel} · ${densityLabel} columns${anyHighlight ? " · highlighted rows marked" : ""}`;

  const header = (pageNumber: number) => (
    <header className={styles.ph}>
      <div className={styles.phTitle}>
        <h2>Handover sheet</h2>
        <div className={styles.meta}>{meta}</div>
      </div>
      <div className={styles.stamp}>
        Taken {taken} {sheetDate} AWST
        <span>
          Page {pageNumber} of {totalPages} · Synthetic data, not a medical record
        </span>
      </div>
    </header>
  );

  const footer = (
    <footer className={styles.pf}>
      <span>Copy taken {taken}. Check the live board before acting.</span>
      <span className={styles.spacer} />
      <span>Form times as typed, not legally checked</span>
      <span>Ward Flow prototype</span>
    </footer>
  );

  const paperCell = (column: HandoverColumn, row: HandoverRow, marked: boolean): ReactNode => {
    const text = column.paper(row, ctx);
    if (column.id === "pt") {
      const rest = text.startsWith(row.name) ? text.slice(row.name.length) : ` ${text}`;
      return (
        <button
          type="button"
          className={styles.rowButton}
          aria-label={`Open ${row.name} ${row.umrn}`}
          onClick={(event) => {
            event.stopPropagation();
            onOpenPatient(row.id);
          }}
        >
          {marked ? <b>{row.name}</b> : row.name}
          {rest}
        </button>
      );
    }
    if (column.id === "st") {
      return (
        <>
          <StatusGlyph tone={rowTone(row, ctx)} size={9} className={styles.gl} />
          {text}
        </>
      );
    }
    return text;
  };

  const tableHead = (
    <thead>
      <tr>
        {columns.map((column) => (
          <th key={column.id} scope="col" style={{ width: paperWidth(column, landscape) }}>
            {column.header}
          </th>
        ))}
      </tr>
    </thead>
  );

  const renderItem = (item: PaperItem, index: number) => {
    if (item.kind === "group") {
      return (
        <tr key={`g-${item.group.id}-${index}`} className={styles.pg}>
          <td colSpan={columns.length}>
            {item.group.tone ? <StatusGlyph tone={GROUP_TONE[item.group.tone]} size={9} className={styles.gl} /> : null}
            {item.group.title} · {item.group.rows.length}
            {item.continued ? " continued" : ""}
          </td>
        </tr>
      );
    }
    if (item.kind === "isbar") {
      return (
        <tr key={`i-${item.row.id}`} className={styles.ib2}>
          <td colSpan={columns.length}>
            {isbarLines(item.row, ctx.now)
              .slice(1)
              .map((line) => (
                <span key={line.key}>
                  <b>{line.key}</b>
                  {line.text}
                </span>
              ))}
          </td>
        </tr>
      );
    }
    const row = item.row;
    const marked = anyHighlight && isHighlighted(row);
    return (
      <tr
        key={`r-${row.id}`}
        className={cx(styles.patientRow, marked && styles.hlr)}
        onClick={() => onOpenPatient(row.id)}
      >
        {columns.map((column) => (
          <td key={column.id} className={column.mono ? styles.mn : undefined}>
            {paperCell(column, row, marked)}
          </td>
        ))}
      </tr>
    );
  };

  const pageNodes: ReactNode[] = pages.map((items, index) => (
    <article
      key={`p-${index}`}
      className={cx("day", styles.paper, !landscape && styles.port)}
      aria-label={`Page ${index + 1}`}
    >
      {header(index + 1)}
      {index === 0 ? (
        <div className={styles.sum}>
          {summary.map(([label, value]) => (
            <div key={label}>
              <b>{value}</b>
              {label}
            </div>
          ))}
        </div>
      ) : null}
      {index === 0 && outsideAct.length ? (
        <p className={styles.outside}>
          <b>Act now outside this scope:</b> {outsideAct.map((row) => `${row.name} ${row.umrn}`).join(", ")}
        </p>
      ) : null}
      <table>
        {tableHead}
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>No open patients in this scope</td>
            </tr>
          ) : (
            items.map(renderItem)
          )}
        </tbody>
      </table>
      {footer}
    </article>
  ));

  const continued = (section: ExtraSection, title: string) => (section.continued ? `${title}, continued` : title);
  const renderSection = (section: ExtraSection) => {
    if (section.id === "beds") {
      return (
        <div key="beds">
          <h3>{continued(section, "Beds by ward")}</h3>
          <table>
            <thead>
              <tr>
                <th scope="col">Ward</th>
                <th scope="col" style={{ width: 70 }}>
                  In beds
                </th>
                <th scope="col" style={{ width: 56 }}>
                  Ready
                </th>
                <th scope="col" style={{ width: 80 }}>
                  Updated
                </th>
                <th scope="col" style={{ width: 50 }}>
                  Held
                </th>
                <th scope="col" style={{ width: 70 }}>
                  Past EDD
                </th>
              </tr>
            </thead>
            <tbody>
              {section.entries.map((entry) =>
                entry.kind === "ward" ? (
                  <tr key={entry.ward.id}>
                    <td>{entry.ward.name}</td>
                    <td className={styles.mn}>
                      {entry.ward.occupied}/{entry.ward.beds}
                    </td>
                    <td className={styles.mn}>{entry.ward.ready}</td>
                    <td className={styles.mn}>{formatInstantWithDay(entry.ward.confirmedAt, now)}</td>
                    <td className={styles.mn}>{entry.ward.held}</td>
                    <td className={styles.mn}>{entry.ward.pastEdd}</td>
                  </tr>
                ) : null,
              )}
            </tbody>
          </table>
        </div>
      );
    }
    if (section.id === "holds") {
      return (
        <div key="holds">
          <h3>{continued(section, "Discharges held up")}</h3>
          <table>
            <thead>
              <tr>
                <th scope="col">Patient</th>
                <th scope="col" style={{ width: 150 }}>
                  Ward
                </th>
                <th scope="col" style={{ width: 180 }}>
                  Hold
                </th>
              </tr>
            </thead>
            <tbody>
              {section.entries.map((entry) =>
                entry.kind === "noHolds" ? (
                  <tr key="none">
                    <td colSpan={3}>No discharges held up</td>
                  </tr>
                ) : entry.kind === "hold" ? (
                  <tr key={entry.hold.admission.id}>
                    <td>
                      {entry.hold.name} <span className={styles.mnInline}>{entry.hold.umrn}</span>
                    </td>
                    <td>{entry.hold.ward}</td>
                    <td>{entry.hold.reason}</td>
                  </tr>
                ) : null,
              )}
            </tbody>
          </table>
        </div>
      );
    }
    return (
      <div key="sigs">
        <h3>Handover</h3>
        {[0, 1].map((line) => (
          <div key={line} className={styles.sig}>
            <div>Given by</div>
            <div>Received by</div>
            <div>Time</div>
          </div>
        ))}
      </div>
    );
  };

  extraPages.forEach((columnsOnPage, index) => {
    const pageNumber = pages.length + index + 1;
    pageNodes.push(
      <article
        key={`p-extra-${index}`}
        className={cx("day", styles.paper, !landscape && styles.port)}
        aria-label={`Page ${pageNumber}`}
      >
        {header(pageNumber)}
        <div className={landscape ? styles.cols2 : styles.cols1}>
          {columnsOnPage.map((sections, column) => (
            <div key={column}>{sections.map(renderSection)}</div>
          ))}
        </div>
        {footer}
      </article>,
    );
  });

  const print = () => {
    flushSync(() => onPrinted(now));
    window.print();
  };

  const set = <K extends keyof PrintOptions>(key: K, value: PrintOptions[K]) =>
    onOptionsChange({ ...options, [key]: value });

  const pageWord = (count: number) => `${count} page${count === 1 ? "" : "s"}`;

  return (
    <div data-testid="ward-handover-print-sheet" className={styles.build}>
      <style>{printCss(options.orientation)}</style>
      <Card as="div" className={styles.rail}>
        <div className={styles.opt}>
          <Button variant="sec" size="sm" icon={ChevronLeft} onClick={onBack} className={styles.back}>
            Back to handover
          </Button>
          <p className={styles.sub}>The sheet follows the board. Printing freezes a copy with the time it was taken.</p>
        </div>
        <div className={styles.controls}>{controls}</div>
        <section className={styles.opt} aria-labelledby="wf-print-include">
          <h3 id="wf-print-include" className={styles.lab}>
            Include
          </h3>
          {INCLUDE.map((item) => (
            <Switch
              key={item.key}
              block
              checked={options[item.key]}
              onCheckedChange={(checked) => set(item.key, checked)}
              label={item.label}
            />
          ))}
        </section>
        <section className={styles.opt} aria-labelledby="wf-print-paper">
          <h3 id="wf-print-paper" className={styles.lab}>
            Paper
          </h3>
          <Segmented
            label="Paper"
            items={[
              { id: "landscape", label: "A4 landscape" },
              { id: "portrait", label: "A4 portrait" },
            ]}
            value={options.orientation}
            onChange={(id) => set("orientation", id)}
          />
          <span className={styles.sub}>{pageWord(totalPages)}. Save as PDF from the print dialog.</span>
        </section>
        <section className={styles.opt} aria-labelledby="wf-print-highlight">
          <h3 id="wf-print-highlight" className={styles.lab}>
            Highlight
          </h3>
          {highlightControls}
        </section>
        <div className={styles.opt}>
          <Button variant="pri" icon={Printer} onClick={print} className={styles.printButton}>
            Print or save PDF
          </Button>
          {takenAt !== null ? (
            <span className={styles.sub}>Last copy taken {formatInstantWithDay(takenAt, now)}</span>
          ) : null}
        </div>
      </Card>
      <div className={styles.deskPaper}>
        <p className={styles.scopeline}>
          <StatusGlyph tone="info" size={9} />
          <span>
            Live sheet, <b>{pageWord(totalPages)}</b> at {formatInstant(now)}. Click a patient to open their flow.
          </span>
        </p>
        <div ref={stackRef} className={styles.stack} data-wf-print-stack="">
          {pageNodes.map((node, index) => (
            <div
              key={index}
              className={styles.frame}
              style={{ width: paper.width * scale, height: paper.height * scale }}
            >
              <div className={styles.pscale} style={{ transform: `scale(${scale})`, width: paper.width }}>
                {node}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Page size and the print isolation. CSS Modules only allow scoped selectors, so the global part
 * (hide everything but the paper stack) lives here, keyed by the stack's data attribute.
 */
function printCss(orientation: PrintOptions["orientation"]): string {
  const stack = "[data-wf-print-stack]";
  return `@page { size: A4 ${orientation}; margin: 0; }
@media print {
  html, body { margin: 0 !important; padding: 0 !important; height: auto !important; min-height: 0 !important; overflow: visible !important; background: none !important; }
  body * { visibility: hidden !important; }
  ${stack}, ${stack} * { visibility: visible !important; }
  body *:not(:has(${stack})):not(${stack}):not(${stack} *) { display: none !important; }
  body *:has(${stack}) { position: static !important; transform: none !important; overflow: visible !important; height: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; border: 0 !important; box-shadow: none !important; contain: none !important; }
  ${stack} { position: absolute !important; left: 0 !important; top: 0 !important; }
}`;
}
