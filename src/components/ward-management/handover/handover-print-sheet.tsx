"use client";

/**
 * The print sheet builder (approved option C, refined Handover, 9 Oct 2026). An options rail on
 * the left and a live A4 preview on the right that is exactly what prints. Rows and paper text come
 * from the shared handover columns so the board and the paper never disagree. Patients are named
 * by record and UMRN only; the journey id is a key and a callback argument, never shown.
 */
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { ChevronLeft, Printer } from "lucide-react";
import { Button, Card, Segmented, StatusGlyph, Switch, cx, type WfTone } from "@/components/wf";
import { WardPrintAttribution } from "@/components/ward-management/shell/ward-access";
import {
  formatInstant,
  formatInstantWithDay,
  formatSheetMoment,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { rowTone, type ColumnContext, type HandoverColumn } from "./handover-columns";
import {
  groupOf,
  handoverGroups,
  isActNow,
  isbarLines,
  type HandoverGroupId,
  type HandoverRow,
  type HandoverWard,
  type HeldDischarge,
  type RowGroup,
} from "./handover-model";
import {
  extraEntryKey,
  paperItemKey,
  paginateHandoverItems,
  paginateHandoverExtras,
  type ExtraEntry,
  type ExtraSection,
  type PaperItem,
  type PaperMeasurements,
} from "./handover-print-pagination";
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
  landscape: { width: (297 / 25.4) * 96, height: (210 / 25.4) * 96 },
  portrait: { width: (210 / 25.4) * 96, height: (297 / 25.4) * 96 },
} as const;

/* ------------------------------------------------------------------ pagination */

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

/** Page header allowance in px: title, stamp and the printed-by line, which may wrap. */
const PAGE_HEADER_HEIGHT = 80;

const GROUP_TONE: Record<HandoverGroupId, WfTone> = {
  act: "danger",
  urg: "danger",
  due: "warning",
  rel: "warning",
  bed: "neutral",
  acc: "neutral",
  mov: "info",
};

/** Relative widths always leave every selected column, including the route, usable space. */
function paperWidth(column: HandoverColumn, columns: HandoverColumn[]): string {
  const weight = (entry: HandoverColumn) => {
    if (entry.id === "pt") return 180;
    if (entry.id === "route" || entry.id === "next") return 160;
    if (entry.id === "lo") return 150;
    if (entry.id === "obs") return 130;
    return entry.width;
  };
  const total = columns.reduce((sum, entry) => sum + weight(entry), 0);
  return `${(weight(column) / total) * 100}%`;
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
  /** Calendar origin for a complete, unambiguous paper timestamp. */
  dayZero?: Date;
  /** Legacy fixture/date label; real sheets supply dayZero. */
  sheetDate?: string;
  options: PrintOptions;
  onOptionsChange: (next: PrintOptions) => void;
  controls: ReactNode;
  highlightControls: ReactNode;
  onOpenPatient: (movementId: string) => void;
  onBack: () => void;
  onPrintPrepared: (preparedAt: Instant) => void;
  preparedAt: Instant | null;
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
  dayZero,
  sheetDate = "",
  options,
  onOptionsChange,
  controls,
  highlightControls,
  onOpenPatient,
  onBack,
  onPrintPrepared,
  preparedAt,
  now,
}: HandoverPrintSheetProps) {
  const baseId = useId();
  const landscape = options.orientation === "landscape";
  const paper = PAPER[options.orientation];

  /* Fit the A4 pages to the preview width. Scale with a transform, never zoom. */
  const stackRef = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState<number | null>(null);
  const [measurements, setMeasurements] = useState<PaperMeasurements | null>(null);
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

  /* The outside-scope line wraps rather than truncates, so page 1 reserves its estimated height. */
  const outsideText = outsideAct.map((row) => `${row.name} ${row.umrn}`).join(", ");
  const outsideHeight = outsideText
    ? 4 + 16 * Math.ceil(((outsideText.length + 28) * 6.5) / (PAPER[options.orientation].width - 60))
    : 0;
  const pages = useMemo(
    () =>
      paginateHandoverItems(
        paperItems(groups, options, isHighlighted, anyHighlight),
        paper.height - 30 - 24 - PAGE_HEADER_HEIGHT - 34 - 22,
        34 + outsideHeight,
        measurements,
      ),
    [groups, options, isHighlighted, anyHighlight, outsideHeight, paper.height, measurements],
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
    return paginateHandoverExtras(
      landscape ? [beds, rest] : [[...beds, ...rest]],
      paper.height - 30 - 24 - PAGE_HEADER_HEIGHT - 22,
      measurements,
    );
  }, [options.beds, options.holds, options.signatures, landscape, wards, held, paper.height, measurements]);
  const totalPages = pages.length + extraPages.length;

  const rows = useMemo(() => {
    const seen = new Map<string, HandoverRow>();
    for (const group of groups) for (const row of group.rows) seen.set(row.id, row);
    return [...seen.values()];
  }, [groups]);
  const dueTitle = handoverGroups(ctx.cutoff, ctx.now).find((group) => group.id === "due")!.title;
  const summary: [string, number][] = [
    // NA3-07 (audit 26 Oct 2026): a stopped transport still waiting on its bed is listed, but it is
    // not an open journey, so "Open" leaves it out as the menu's Movements count and the screen do.
    ["Open", rows.filter((row) => isOpen(row.movement)).length],
    ["Act now", rows.filter((row) => isActNow(row, ctx.now)).length],
    ["Flagged urgent", rows.filter((row) => groupOf(row, ctx.now, ctx.cutoff) === "urg").length],
    [dueTitle, rows.filter((row) => groupOf(row, ctx.now, ctx.cutoff) === "due").length],
    ["Finding a ward", rows.filter((row) => groupOf(row, ctx.now, ctx.cutoff) === "bed").length],
    ["Moving", rows.filter((row) => groupOf(row, ctx.now, ctx.cutoff) === "mov").length],
    ["Beds ready", wards.reduce((sum, ward) => sum + ward.ready, 0)],
    ["Being made ready", wards.reduce((sum, ward) => sum + ward.pendingPreparation, 0)],
  ];

  const prepared = dayZero
    ? formatSheetMoment(preparedAt ?? now, dayZero, { includeYearAndZone: true })
    : `${formatInstantWithDay(preparedAt ?? now, now)} ${sheetDate} AWST`.trim();
  const meta = `${scopeLabel} · ${shiftLabel} · ${densityLabel} columns${anyHighlight ? " · highlighted rows marked" : ""}`;

  const header = (pageNumber: number) => (
    <header className={styles.ph}>
      <div className={styles.phTitle}>
        <h2>Handover sheet</h2>
        <div className={styles.meta}>{meta}</div>
      </div>
      <div className={styles.stamp}>
        {/* Until a copy is prepared (onPrintPrepared), the open sheet is a preview, never a prepared copy. */}
        {preparedAt === null ? "Preview" : "Prepared"} {prepared}
        <span>
          Page {pageNumber} of {totalPages} · Synthetic data, not a medical record
        </span>
        <WardPrintAttribution
          at={preparedAt ?? now}
          className={styles.attribution}
          lead={preparedAt === null ? "Preview opened by" : "Prepared for printing by"}
        />
      </div>
    </header>
  );

  const footer = (
    <footer className={styles.pf}>
      <span>
        {preparedAt === null ? `Preview at ${prepared}; no copy prepared yet.` : `Copy prepared ${prepared}.`} Check the
        live board before acting.
      </span>
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
          <th key={column.id} scope="col" style={{ width: paperWidth(column, columns) }}>
            {column.header}
          </th>
        ))}
      </tr>
    </thead>
  );

  const renderItem = (item: PaperItem, index: number) => {
    if (item.kind === "group") {
      return (
        <tr key={`g-${item.group.id}-${index}`} data-paper-item={paperItemKey(item)} className={styles.pg}>
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
        <tr key={`i-${item.row.id}`} data-paper-item={paperItemKey(item)} className={styles.ib2}>
          <td colSpan={columns.length}>
            {isbarLines(item.row, ctx.now, ctx.readyBeds)
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
        data-paper-item={paperItemKey(item)}
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
        <div className={styles.sum} data-paper-summary="">
          {summary.map(([label, value]) => (
            <div key={label}>
              <b>{value}</b>
              {label}
            </div>
          ))}
        </div>
      ) : null}
      {index === 0 && outsideAct.length ? (
        <p className={styles.outside} data-paper-outside="">
          <b>Act now outside this scope:</b> {outsideText}
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
        <div key="beds" data-extra-section="beds">
          <h3>{continued(section, "Beds by ward")}</h3>
          <table>
            <thead>
              <tr>
                <th scope="col">Ward</th>
                <th scope="col" className={styles.colNarrow}>
                  In beds
                </th>
                <th scope="col" className={styles.colReady}>
                  Ready
                </th>
                <th scope="col" className={styles.colUpdated}>
                  Updated
                </th>
                <th scope="col" className={styles.colHeld}>
                  Pulled
                </th>
                <th scope="col" className={styles.colNarrow}>
                  Past EDD
                </th>
              </tr>
            </thead>
            <tbody>
              {section.entries.map((entry) =>
                entry.kind === "ward" ? (
                  <tr key={entry.ward.id} data-extra-entry={extraEntryKey(entry)}>
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
        <div key="holds" data-extra-section="holds">
          <h3>{continued(section, "Discharges held up")}</h3>
          <table>
            <thead>
              <tr>
                <th scope="col">Patient</th>
                <th scope="col" className={styles.colWard}>
                  Ward
                </th>
                <th scope="col" className={styles.colHold}>
                  Hold
                </th>
              </tr>
            </thead>
            <tbody>
              {section.entries.map((entry) =>
                entry.kind === "noHolds" ? (
                  <tr key="none" data-extra-entry="noHolds">
                    <td colSpan={3}>No discharges held up</td>
                  </tr>
                ) : entry.kind === "hold" ? (
                  <tr key={entry.hold.admission.id} data-extra-entry={extraEntryKey(entry)}>
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
      <div key="sigs" data-extra-entry="sigs">
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

  const readMeasurements = (): PaperMeasurements | null => {
    const stack = stackRef.current;
    const first = stack?.querySelector<HTMLElement>("article");
    if (!stack || !first || first.offsetHeight === 0) return null;
    const style = getComputedStyle(first);
    const gap = Number.parseFloat(style.rowGap) || 0;
    const padding = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
    const heightOf = (selector: string) =>
      Math.max(0, ...Array.from(stack.querySelectorAll<HTMLElement>(selector), (node) => node.offsetHeight));
    // Leave 4px for fractional CSS-pixel rounding at the A4 physical page boundary.
    const extraBudget =
      paper.height - padding - heightOf("article > header") - heightOf("article > footer") - 2 * gap - 4;
    const itemHeights: Record<string, number> = {};
    const extraHeights: Record<string, number> = {};
    const extraHeads: Record<string, number> = {};
    for (const node of stack.querySelectorAll<HTMLElement>("[data-paper-item]")) {
      const key = node.dataset.paperItem!;
      itemHeights[key] = Math.max(itemHeights[key] ?? 0, node.offsetHeight);
    }
    for (const node of stack.querySelectorAll<HTMLElement>("[data-extra-entry]")) {
      extraHeights[node.dataset.extraEntry!] = node.offsetHeight;
    }
    for (const node of stack.querySelectorAll<HTMLElement>("[data-extra-section]")) {
      const rows = Array.from(node.querySelectorAll<HTMLElement>("[data-extra-entry]"));
      const ownMargin = Number.parseFloat(getComputedStyle(node.firstElementChild!).marginTop) || 0;
      extraHeads[node.dataset.extraSection!] = Math.max(
        extraHeads[node.dataset.extraSection!] ?? 0,
        node.offsetHeight - rows.reduce((sum, row) => sum + row.offsetHeight, 0) + ownMargin,
      );
    }
    const summary = first.querySelector<HTMLElement>("[data-paper-summary]");
    const outside = first.querySelector<HTMLElement>("[data-paper-outside]");
    return {
      mainBudget: extraBudget - heightOf("article > table > thead"),
      extraBudget,
      firstPageCost: (summary ? summary.offsetHeight + gap : 0) + (outside ? outside.offsetHeight + gap : 0),
      itemHeights,
      extraHeights,
      extraHeads,
    };
  };

  // H-0350: one ResizeObserver for the sheet's life. Each render only re-observes when the measured
  // nodes change, instead of tearing the observer down and building a new one every render.
  const readMeasurementsRef = useRef(readMeasurements);
  const measureRef = useRef<{ observer: ResizeObserver | null; schedule: () => void; observed: Element[] } | null>(
    null,
  );
  useEffect(() => {
    let active = true;
    let frame = 0;
    const update = () => {
      const next = readMeasurementsRef.current();
      if (active && next) setMeasurements((old) => (JSON.stringify(old) === JSON.stringify(next) ? old : next));
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    measureRef.current = { observer, schedule, observed: [] };
    void document.fonts?.ready.then(() => {
      if (active) schedule();
    });
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      measureRef.current = null;
    };
  }, []);
  useEffect(() => {
    readMeasurementsRef.current = readMeasurements;
    const measure = measureRef.current;
    if (!measure) return;
    const nodes = Array.from(
      stackRef.current?.querySelectorAll("article > *, [data-paper-item], [data-extra-entry]") ?? [],
    );
    // Without a ResizeObserver nothing reports a reflow, so measure after every render instead.
    if (
      measure.observer &&
      nodes.length === measure.observed.length &&
      nodes.every((node, index) => node === measure.observed[index])
    ) {
      return;
    }
    const kept = new Set(nodes);
    const had = new Set(measure.observed);
    for (const node of measure.observed) if (!kept.has(node)) measure.observer?.unobserve(node);
    for (const node of nodes) if (!had.has(node)) measure.observer?.observe(node);
    measure.observed = nodes;
    measure.schedule();
  });

  /* Audit 24-7 (CT-11): a browser print (Ctrl+P) must stamp the rows it prints, not an older Print-button time. */
  const latestPrepare = useRef(() => onPrintPrepared(now));
  latestPrepare.current = () => onPrintPrepared(now);
  useEffect(() => {
    const onBeforePrint = () => flushSync(() => latestPrepare.current());
    window.addEventListener("beforeprint", onBeforePrint);
    return () => window.removeEventListener("beforeprint", onBeforePrint);
  }, []);

  const print = () => {
    flushSync(() => onPrintPrepared(now));
    // Read synchronously as well: a quick click or a changed header must use its actual new size.
    const next = readMeasurements();
    if (next) flushSync(() => setMeasurements(next));
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
        </div>
        <div className={styles.controls}>{controls}</div>
        <section className={styles.opt} aria-labelledby={`${baseId}-wf-print-include`}>
          <h3 id={`${baseId}-wf-print-include`} className={styles.lab}>
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
        <section className={styles.opt} aria-labelledby={`${baseId}-wf-print-paper`}>
          <h3 id={`${baseId}-wf-print-paper`} className={styles.lab}>
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
          <span className={styles.sub}>{pageWord(totalPages)}</span>
        </section>
        <section className={styles.opt} aria-labelledby={`${baseId}-wf-print-highlight`}>
          <h3 id={`${baseId}-wf-print-highlight`} className={styles.lab}>
            Highlight
          </h3>
          {highlightControls}
        </section>
        <div className={styles.opt}>
          <Button variant="pri" icon={Printer} onClick={print} className={styles.printButton}>
            Print or save PDF
          </Button>
          {preparedAt !== null ? (
            <span className={styles.sub}>Last copy prepared {formatInstantWithDay(preparedAt, now)}</span>
          ) : null}
        </div>
      </Card>
      <div className={styles.deskPaper}>
        <p className={styles.scopeline}>
          <StatusGlyph tone="info" size={9} />
          <span>
            Live sheet, <b>{pageWord(totalPages)}</b> at {formatInstant(now)}.
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
