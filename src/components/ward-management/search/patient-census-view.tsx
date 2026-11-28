"use client";

import Link from "next/link";
import {
  memo,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type Ref,
} from "react";
import {
  ChevronDown,
  ChevronLeft,
  Clock,
  Copy,
  Download,
  Printer,
  Search,
  SearchCheck,
  SearchX,
  Share2,
  UserPlus,
  X,
} from "lucide-react";

import { type ListPrintChoice } from "@/components/ward-management/ward-list-print-menu";
import { DownloadRefusedError } from "@/components/ward-management/ward-download";
import { usePatientNameDisplay } from "@/components/ward-management/settings/discreet-names";
import { printPage, usePrinting } from "@/components/ward-management/use-printing";
import {
  Avatar,
  Button,
  DrawerFootRow,
  FactGrid,
  FilterChip,
  Icon,
  Menu,
  PanelDrawer,
  PhoneSheet,
  Segmented,
  ShowMoreRow,
  StatusGlyph,
  StatusPill,
  Timeline,
  buttonClass,
  tableClasses,
  cx,
  SrOnly,
  heroChipClassName,
  type DrawerPagerProps,
  type MenuItem,
  type WfTone,
} from "@/components/wf";
import {
  dayOf,
  formatInstant,
  formatInstantWithDay,
  MINUTES_PER_DAY,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { typedClock } from "@/components/ward-management/ward-legal-time-as-typed";
import type { AccessEntry } from "./access-record";
import {
  CENSUS_GROUPS,
  CENSUS_HIGHLIGHTS,
  dobText,
  type CensusGlyph,
  type CensusGroup,
  type CensusHighlight,
  type CensusRow,
  type CensusSort,
  type ClosedTodayRow,
} from "./patient-census";

import { censusSections } from "./patient-states";
import {
  CENSUS_COLS,
  CensusColumns,
  CensusHeadRow,
  CensusPrintGroups,
  CensusPrintTitle,
  TierPill,
} from "./census-print";
import styles from "./census.module.css";
import { movementHref, patientHref } from "@/components/ward-management/shell/ward-facade";
import { referralBoardHref } from "@/components/ward-management/ed/ed-bed-search-step";
import { requestToolsTool } from "@/components/ward-management/tools/ward-tools-open";

/** The census step a drawer can take itself (audit three #12): `patient-census.ts` names it. */
const FIND_A_BED = "Find a bed";

const TONE: Record<Exclude<CensusGlyph, "off">, WfTone> = {
  act: "danger",
  risk: "warning",
  done: "success",
  move: "info",
  wait: "neutral",
};

/** The status shape for a row. `off` is a short bar: a record with nothing open. */
function CensusGlyphMark({ glyph, size = 10 }: { glyph: CensusGlyph; size?: number }) {
  if (glyph === "off") return <span className={styles.offGlyph} aria-hidden="true" />;
  return <StatusGlyph tone={TONE[glyph]} size={size} />;
}

function ageSex(row: CensusRow): string {
  const sex = row.sex ? (row.sex === "Female" ? "F" : row.sex === "Male" ? "M" : row.sex) : "Sex not recorded";
  return `${row.age === null ? "Age not recorded" : `${row.age}y`} · ${sex}`;
}

function initials(name: string): string {
  // shell-8: rows read "Family, Given", so the given name's initial leads.
  const [family, given] = name.includes(",") ? name.split(",", 2) : [undefined, name];
  return `${given} ${family ?? ""}`
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join("");
}

/** Wraps the typed text where it appears in a name or UMRN, so a reader sees why the row matched. */
function Marked({ text, needle }: { text: string; needle: string }) {
  if (!needle) return <>{text}</>;
  const at = text.toLowerCase().indexOf(needle.toLowerCase());
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className={styles.mark}>{text.slice(at, at + needle.length)}</mark>
      {text.slice(at + needle.length)}
    </>
  );
}

/* ───────────────────────── search bar 1 ───────────────────────── */

/* ───────────────────────── the census table ───────────────────────── */

export type CensusScrollPosition = { identity: string; top: number; left: number };
export type CensusTableProps = {
  readScrollPosition?: () => CensusScrollPosition;
  recordScrollPosition?: (position: CensusScrollPosition) => void;
  scrollIdentity?: string;
  rows: readonly CensusRow[];
  /** PS1: a register state is chosen, so empty groups hide and the rest open, as in a search. */
  narrowed?: boolean;
  totalPeople: number;
  searching: boolean;
  needle: string;
  sort: CensusSort;
  onSort: (sort: CensusSort) => void;
  highlight: CensusHighlight | null;
  onHighlight: (next: CensusHighlight | null) => void;
  highlightCounts: Record<CensusHighlight, number>;
  lifted: (row: CensusRow) => boolean;
  openGroups: Record<CensusGroup, boolean>;
  onToggleGroup: (group: CensusGroup, open: boolean) => void;
  showAllWard: boolean;
  onShowAllWard: () => void;
  selectedKey: string | null;
  flashKey: string | null;
  onSelect: (row: CensusRow, trigger: HTMLElement) => void;
  tab: "now" | "history";
  onTab: (tab: "now" | "history") => void;
  liveCount: number;
  /** Absent while a search is on: History does not follow the search, so it shows no count (shell-16). */
  historyCount: number | undefined;
  history: ReactNode;
  onCopyList: () => void;
  /** Export (feature 44): the rows on screen as a spreadsheet. */
  onExportList?: () => Promise<void>;
  /** The Print menu's choices: the whole list, or the short ED and placement sheet. */
  printChoices?: readonly ListPrintChoice[];
  /** The print time under the printed list's title, on the 24-hour sheet face. */
  printedAt?: string;
  copyNote: string | null;
  empty: ReactNode;
  notice?: ReactNode;
};

/**
 * #28 (audit two, 27 Nov 2026): the list's outputs under one Share menu (Chronology's part): Copy
 * list, Export (the spreadsheet) and the print choices under their own heading. `look="chip"` draws
 * the trigger as a hero quick chip (the phone top). Export's refusal or failure is a status line.
 */
export function CensusShareMenu({
  onCopyList,
  onExportList,
  exportDisabled,
  printChoices,
  look = "button",
  testId,
}: {
  onCopyList: () => void;
  onExportList?: () => Promise<void>;
  exportDisabled?: boolean;
  printChoices?: readonly ListPrintChoice[];
  look?: "button" | "chip";
  testId?: string;
}) {
  const [note, setNote] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const runExport = () => {
    if (!onExportList || pending) return;
    setNote(null);
    setPending(true);
    onExportList()
      .catch((error: unknown) => {
        if (error instanceof DownloadRefusedError) {
          setNote("Export is not available in this browser");
          return;
        }
        console.error("List export failed", error);
        setNote("Export failed. Try again.");
      })
      .finally(() => setPending(false));
  };
  const items: MenuItem[] = [
    {
      id: "copy",
      label: <span data-testid="ward-census-copy-list">Copy list</span>,
      icon: Copy,
      onSelect: onCopyList,
    },
    ...(onExportList
      ? [
          {
            id: "export",
            label: <span data-testid="ward-census-export">Export list</span>,
            icon: Download,
            disabled: exportDisabled || pending,
            onSelect: runExport,
          },
        ]
      : []),
    ...(printChoices && printChoices.length > 0
      ? [
          { kind: "heading" as const, id: "print-heading", label: "Print" },
          ...printChoices.map((choice) => ({
            id: `print-${choice.id}`,
            label: choice.label,
            icon: Printer,
            meta: choice.meta,
            disabled: choice.disabled,
            onSelect: () => printPage(choice.scope ?? null),
          })),
        ]
      : []),
  ];
  return (
    <>
      <Menu
        label="Share"
        align="end"
        items={items}
        trigger={(triggerProps) =>
          look === "chip" ? (
            <button {...triggerProps} type="button" className={heroChipClassName} data-print-hide data-testid={testId}>
              <Icon icon={Share2} size={16} />
              <span>Share</span>
            </button>
          ) : (
            <button
              {...triggerProps}
              type="button"
              className={buttonClass({ variant: "ghost", size: "sm" })}
              data-print-hide
              data-testid={testId}
            >
              <Share2 size={16} strokeWidth={1.75} aria-hidden="true" />
              Share
            </button>
          )
        }
      />
      {/* Always present, so a screen reader hears the note; hidden while empty so it takes no gap. */}
      <span role="status" className={note ? undefined : "sr-only"}>
        {note}
      </span>
    </>
  );
}

/** #86: the hover text of the Highlight chips whose rows left the This shift card. */
const HIGHLIGHT_HINT: Partial<Record<CensusHighlight, string>> = {
  long: "Your default",
  edd: "On a ward, date passed",
  aed: "Bed kept on the ward",
};

export const countPeople = (rows: readonly CensusRow[]) =>
  new Set(rows.map((row) => row.patientRecordId ?? row.key)).size;

const WARD_CAP = 40;
/** Waiting, Bed found and Moving fold after this many rows on the desktop table, like phone. */
const GROUP_CAP = 10;

function rowTestId(row: CensusRow): string {
  return row.kind === "movement" || row.kind === "referral"
    ? `ward-patient-search-case-${row.key}`
    : `ward-patient-search-row-${row.key}`;
}

export function CensusTable(props: CensusTableProps) {
  const { rows, searching, highlight, lifted, openGroups, tab } = props;
  const deferredNeedle = useDeferredValue(props.needle);
  const effectiveNeedle = props.needle === "" ? "" : deferredNeedle;
  const lifting = highlight !== null;
  // INV-PRINT-005: the paper holds every row the screen can show, so print opens every group and every "Show all".
  const printing = usePrinting();
  const groups = censusSections(rows);
  const groupsFound = groups.filter((entry) => entry.rows.length > 0).length;
  // Device audit 11 Oct 2026: 51 Waiting and 41 Bed found fully open made the page 4,630px; each
  // open group shows its first ten with "Show all N" (On a ward keeps its own wider cap).
  const [shownAll, setShownAll] = useState<ReadonlySet<CensusGroup>>(() => new Set());
  // Table polish (Josh, 9 Nov 2026): Where and Heading to are one column, "ARM ED → Maali", so no
  // group repeats "No ward yet" down a column of its own and tablets see where a person is heading.
  const cols = CENSUS_COLS;
  const scrollRef = useRef<HTMLDivElement>(null);
  const { readScrollPosition, recordScrollPosition } = props;
  useLayoutEffect(() => {
    const element = scrollRef.current;
    let held = readScrollPosition?.();
    if (!held || !recordScrollPosition) return;
    const retired = held.identity !== props.scrollIdentity;
    if (retired) {
      held = { identity: props.scrollIdentity ?? "", top: 0, left: 0 };
      recordScrollPosition(held);
    }
    if (!element) return;
    if (!retired && held.top === 0 && held.left === 0) {
      // Nothing to restore. The table can already be scrolled before hydration attaches onScroll;
      // keep that newer position rather than jumping back to the top (responsive audit flake).
      recordScrollPosition({ identity: held.identity, top: element.scrollTop, left: element.scrollLeft });
    } else {
      element.scrollTop = held.top;
      element.scrollLeft = held.left;
    }
    return () => {
      // Capture synchronously before responsive unmount, even if its final scroll event is queued.
      if (readScrollPosition?.().identity === (props.scrollIdentity ?? ""))
        recordScrollPosition({
          identity: props.scrollIdentity ?? "",
          top: element.scrollTop,
          left: element.scrollLeft,
        });
    };
  }, [readScrollPosition, recordScrollPosition, props.scrollIdentity, rows.length, tab]);

  return (
    <section
      className={styles.tableCard}
      aria-labelledby="ward-patient-search-results-console-title"
      data-testid="ward-patient-search-results-console"
    >
      {/* On paper the list carries its own title and print time; the screen keeps the hidden one. */}
      {printing ? (
        <CensusPrintTitle id="ward-patient-search-results-console-title" title="Patients" printedAt={props.printedAt} />
      ) : (
        <h2 id="ward-patient-search-results-console-title" className="sr-only">
          Patients
        </h2>
      )}
      <div className={styles.toolbar}>
        {/* PS1 (3 Nov 2026): the state switch on the band picks who is listed, so the table says how
            many it lists instead of a second Now or History switch. History opens from the hero's
            Today chip, and comes back here. */}
        {tab === "now" ? (
          <p className={styles.registerCount}>
            <b>{countPeople(rows)}</b> {countPeople(rows) === 1 ? "person" : "people"}
          </p>
        ) : (
          <Button variant="ghost" size="sm" icon={ChevronLeft} onClick={() => props.onTab("now")}>
            Back to the register
          </Button>
        )}
        <span className={styles.spacer} />
        {tab === "now" ? (
          <>
            <Segmented
              label="Sort patients"
              size="sm"
              items={[
                { id: "wait", label: "Longest wait" },
                { id: "tier", label: "Tier" },
                { id: "name", label: "Name" },
              ]}
              value={props.sort}
              onChange={props.onSort}
            />
            {/* #28 (audit two, 27 Nov 2026): Copy list, Export and Print are one Share menu at the
                right end of the list head, as on Chronology and Statistics. */}
            <CensusShareMenu
              onCopyList={props.onCopyList}
              onExportList={props.onExportList}
              exportDisabled={rows.length === 0}
              printChoices={props.printChoices}
              testId="ward-census-share"
            />
          </>
        ) : null}
      </div>
      {tab === "now" ? (
        <div className={styles.chipBar} role="group" aria-label="Highlight">
          <span className={styles.chipLead}>Highlight</span>
          {CENSUS_HIGHLIGHTS.map((chip) => (
            // #86 (audit two): the words the This shift rows carried for these chips are their hover text.
            <span key={chip.id} className={styles.chipHint} title={HIGHLIGHT_HINT[chip.id]}>
              <FilterChip
                pressed={highlight === chip.id}
                onPressedChange={(pressed) => props.onHighlight(pressed ? chip.id : null)}
                count={props.highlightCounts[chip.id]}
                tone={chip.glyph ? TONE[chip.glyph] : undefined}
              >
                {chip.label}
              </FilterChip>
            </span>
          ))}
          {props.copyNote ? (
            <span className={styles.copyNote} role="status" aria-live="polite">
              {props.copyNote}
            </span>
          ) : null}
        </div>
      ) : null}
      {props.notice}

      {tab === "history" ? (
        props.history
      ) : rows.length === 0 ? (
        props.empty
      ) : (
        <div
          ref={scrollRef}
          className={styles.scroll}
          role="region"
          aria-label="Patient census rows"
          tabIndex={0}
          onScroll={(event) => {
            recordScrollPosition?.({
              identity: props.scrollIdentity ?? "",
              top: event.currentTarget.scrollTop,
              left: event.currentTarget.scrollLeft,
            });
          }}
        >
          {printing ? (
            <CensusPrintGroups
              sections={groups.filter((entry) => entry.rows.length > 0 || !(searching || props.narrowed))}
              renderRow={(row) => (
                <CensusTableRow
                  key={row.key}
                  row={row}
                  needle={effectiveNeedle}
                  selected={row.key === props.selectedKey}
                  lifted={lifting && lifted(row)}
                  flash={false}
                  onSelect={props.onSelect}
                />
              )}
            />
          ) : null}
          {printing ? null : (
            <table className={cx(tableClasses.table, styles.censusTable)} aria-label="Patients by where they are now">
              <CensusColumns />
              <thead>
                <CensusHeadRow />
              </thead>
              {groups.map(({ key: sectionKey, group, label: sectionLabel, rows: groupRows }) => {
                if ((searching || props.narrowed) && groupRows.length === 0) return null;
                const litCount = lifting ? groupRows.filter(lifted).length : 0;
                const open = printing || searching || props.narrowed || openGroups[group.id] || litCount > 0;
                const cap =
                  printing || searching || lifting
                    ? groupRows.length
                    : group.id === "ward"
                      ? props.showAllWard
                        ? groupRows.length
                        : WARD_CAP
                      : group.id === "off" || shownAll.has(group.id)
                        ? groupRows.length
                        : GROUP_CAP;
                return (
                  <tbody key={sectionKey} id={`ward-patient-search-group-${sectionKey}`} className={styles.group}>
                    <tr className={cx(styles.groupRow, group.id === "off" && styles.groupQuiet)}>
                      <th colSpan={cols} scope="rowgroup">
                        <button
                          type="button"
                          className={styles.groupButton}
                          aria-expanded={open}
                          onClick={() => props.onToggleGroup(group.id, !open)}
                        >
                          <ChevronDown className={styles.chev} size={14} aria-hidden="true" />
                          <CensusGlyphMark glyph={group.glyph} />
                          <span className={styles.groupLabel}>{sectionLabel}</span>
                          <span className={styles.groupCount}>{groupRows.length}</span>
                          {litCount > 0 ? <span className={styles.groupHint}>{litCount} highlighted</span> : null}
                          <span className={styles.spacer} />
                          {!open ? (
                            <span className={styles.groupHint}>Show {groupRows.length}</span>
                          ) : sectionKey === "off" && !searching ? (
                            <span className={styles.groupHint}>Records with nothing open</span>
                          ) : sectionKey === "team" && !searching ? (
                            <span className={styles.groupHint}>Nothing open, followed by a team</span>
                          ) : null}
                        </button>
                      </th>
                    </tr>
                    {open
                      ? groupRows
                          .slice(0, cap)
                          .map((row) => (
                            <CensusTableRow
                              key={row.key}
                              row={row}
                              needle={effectiveNeedle}
                              selected={row.key === props.selectedKey}
                              lifted={lifting && lifted(row)}
                              flash={row.key === props.flashKey}
                              onSelect={props.onSelect}
                            />
                          ))
                      : null}
                    {open && cap < groupRows.length ? (
                      <tr className={styles.moreRow}>
                        <td colSpan={cols}>
                          <ShowMoreRow
                            onClick={
                              group.id === "ward"
                                ? props.onShowAllWard
                                : () => setShownAll((current) => new Set(current).add(group.id))
                            }
                          >
                            Show all {groupRows.length}
                          </ShowMoreRow>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                );
              })}
            </table>
          )}
        </div>
      )}
      <div className={styles.foot}>
        <span>
          {/* D-218 / FIGS-M1: a count line only while searching; the full list needs no total. */}
          {searching
            ? `${countPeople(rows)} found across ${groupsFound} ${groupsFound === 1 ? "group" : "groups"}`
            : null}
        </span>
        <span className={styles.spacer} />
        <span>Names are invented</span>
      </div>
    </section>
  );
}

const CensusTableRow = memo(function CensusTableRow({
  row,
  needle,
  selected,
  lifted,
  flash,
  onSelect,
}: {
  row: CensusRow;
  needle: string;
  selected: boolean;
  lifted: boolean;
  flash: boolean;
  onSelect: (row: CensusRow, trigger: HTMLElement) => void;
}) {
  return (
    <tr
      className={cx(
        styles.row,
        selected && styles.selected,
        selected && "selected",
        lifted && styles.lifted,
        flash && styles.flash,
        row.group === "off" && styles.quietRow,
      )}
      data-testid={rowTestId(row)}
      data-id={row.key}
      tabIndex={0}
      aria-selected={selected}
      onClick={(event) => onSelect(row, event.currentTarget)}
      onKeyDown={(event: ReactKeyboardEvent<HTMLTableRowElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(row, event.currentTarget);
        }
      }}
    >
      <td>
        <TierPill tier={row.tier} />
      </td>
      <td>
        {/* The row itself takes the keyboard; this names its action for a screen reader's browse mode. */}
        <button
          type="button"
          className="sr-only"
          tabIndex={-1}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(row, event.currentTarget.closest("tr") ?? event.currentTarget);
          }}
        >
          Open {row.name}
        </button>
        <span className={styles.two}>
          <b className={styles.name}>
            <span className={styles.truncate}>
              <Marked text={row.name} needle={needle} />
            </span>
            {row.confidential ? <span className={styles.restricted}>Restricted</span> : null}
          </b>
          <span>
            <span className={styles.mono}>
              <Marked text={row.umrn} needle={needle} />
            </span>{" "}
            · {ageSex(row)}
          </span>
        </span>
      </td>
      <td className={styles.whereTo}>
        {/* "No ward asked yet" rows say only where the person is; the group heading says the rest. */}
        <span className={styles.two}>
          <b>
            {row.where}
            {row.group === "ask" ? null : (
              <>
                <span aria-hidden="true"> → </span>
                <SrOnly>, heading to </SrOnly>
                {row.to}
              </>
            )}
          </b>
          <span>{[row.whereSub, row.group === "ask" ? "" : row.toSub].filter(Boolean).join(" · ")}</span>
        </span>
      </td>
      <td>
        <span className={styles.next}>
          <CensusGlyphMark glyph={row.glyph} />
          <span className={styles.two}>
            <b>{row.next}</b>
            <span>{row.nextWho || (row.group === "ward" ? "Nothing open" : "No open record")}</span>
          </span>
        </span>
      </td>
      <td>
        <span className={styles.two}>
          <b>{row.legal}</b>
          <span>{row.legalSub}</span>
        </span>
      </td>
      <td className={styles.num}>
        <TimeCell row={row} />
      </td>
    </tr>
  );
});

function TimeCell({ row }: { row: CensusRow }) {
  if (!row.timeText) return <CensusGlyphMark glyph="off" />;
  return (
    <span className={styles.time}>
      <span className={styles.timeValue}>
        {row.longWait ? <StatusGlyph tone="warning" size={9} /> : null}
        {row.timeText}
      </span>
      <span className={styles.timeSub}>{row.timeSub}</span>
    </span>
  );
}

/* ───────────────────────── side panel ───────────────────────── */

export type ShiftSummaryProps = {
  rows: readonly CensusRow[];
  closedToday: readonly ClosedTodayRow[];
  now: Instant;
  /** The board's day 0, so the next typed form time on another day prints its date (D1, D-93). */
  dayZero: Date;
  highlight: CensusHighlight | null;
  highlightCounts: Record<CensusHighlight, number>;
  onSelect: (row: CensusRow) => void;
  onHighlight: (chip: CensusHighlight) => void;
  onHistory: () => void;
};

/** What the panel shows while nobody is selected: the few things worth a look this shift. */
export function ShiftSummary(props: ShiftSummaryProps) {
  const { rows, now } = props;
  const reserved = rows.filter((row) => row.reservedTimePassed);
  const longest = rows
    .filter((row) => row.waitMinutes !== null)
    .reduce<CensusRow | null>(
      (best, row) => (best && (best.waitMinutes ?? 0) >= (row.waitMinutes ?? 0) ? best : row),
      null,
    );
  const dues = rows.filter((row) => row.formDueAt !== null).sort((a, b) => (a.formDueAt ?? 0) - (b.formDueAt ?? 0));
  // #86 (audit two, 27 Nov 2026): three tiles on equal thirds. Over 24h, Past expected date and
  // Away at ED repeat the Highlight chips (their words are the chips' hover text); Arrived today is
  // the hero's Today band, which opens History; the foot line goes.
  type Item = {
    id: string;
    glyph: CensusGlyph;
    title: string;
    sub: string;
    value: ReactNode;
    onPress?: () => void;
    chip?: CensusHighlight;
  };
  const items: Item[] = [
    {
      id: "reserved",
      glyph: "act",
      title: "Pull expired",
      sub: reserved[0] ? `${reserved[0].name} · ${reserved[0].acceptedUnitName ?? reserved[0].to}` : "None",
      value: reserved.length,
      onPress: reserved[0] ? () => props.onSelect(reserved[0]!) : undefined,
    },
    {
      id: "longest",
      glyph: "risk",
      title: "Longest wait",
      sub: longest ? `${longest.name} · ${longest.where}` : "Nobody waiting",
      value: longest ? longest.timeText : "None",
      onPress: longest ? () => props.onSelect(longest) : undefined,
    },
    {
      id: "form",
      glyph: "wait",
      title: "Forms with a due time",
      sub: dues[0] ? `Next ${typedClock(dues[0].formDueAt ?? now, now, props.dayZero)} · ${dues[0].name}` : "None",
      value: dues.length,
      chip: "form",
    },
  ];
  return (
    <div className={styles.summary}>
      <div className={styles.panelHead}>
        <Icon icon={Clock} size={16} />
        <h2 className={styles.panelTitle}>This shift</h2>
        <span className={styles.spacer} />
        <span className={styles.mono}>{formatInstant(now)}</span>
      </div>
      <ul className={styles.summaryList}>
        {items.map((item) => {
          const chip = item.chip;
          const press = chip ? () => props.onHighlight(chip) : item.onPress;
          return (
            <li key={item.id}>
              <button
                type="button"
                className={styles.summaryItem}
                onClick={press}
                disabled={!press}
                aria-pressed={chip ? props.highlight === chip : undefined}
              >
                <CensusGlyphMark glyph={item.glyph} />
                <span className={styles.two}>
                  <b>{item.title}</b>
                  <span>{item.sub}</span>
                </span>
                <span className={styles.summaryValue}>{item.value}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function when(at: Instant, now: Instant): string {
  const startOfToday = dayOf(now) * MINUTES_PER_DAY;
  if (at >= startOfToday) return formatInstantWithDay(at, now);
  const days = Math.ceil((startOfToday - at) / MINUTES_PER_DAY);
  return days === 1 ? "Yday" : `${days}d`;
}

export type CensusDetailProps = {
  row: CensusRow;
  now: Instant;
  onClose?: () => void;
  onNavigate?: () => void;
  onCopy: (row: CensusRow) => void;
  copyNote: string | null;
};

// H-0345: a blocked sessionStorage throws; the bed-link focus marker is only a convenience, so a
// failed read or write is skipped rather than sending Search detail to the error boundary.
function readCensusMarker(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeCensusMarker(key: string, value: string | null): void {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    // A blocked store: the ward bed simply closes without returning to Census.
  }
}

/** Puts focus back on the Ward bed link when the reader returns from that bed. */
function useCensusBedLinkReturn(rowKey: string) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (readCensusMarker("wardflow:census-bed-opener") !== rowKey) return;
    const link = Array.from(document.querySelectorAll<HTMLElement>("[data-census-bed-link]")).find(
      (element) => element.dataset.censusBedLink === rowKey,
    );
    if (link) {
      link.focus({ preventScroll: true });
      writeCensusMarker("wardflow:census-bed-opener", null);
    }
  }, [rowKey]);
}

function censusFacts(row: CensusRow): [string, string, string][] {
  return row.kind === "admission" && row.group === "ward"
    ? [
        ["Ward", row.where, row.whereSub],
        [
          "Expected discharge",
          row.to,
          row.next.startsWith("Waiting on") ? row.next : row.pastExpected ? "Date has passed" : "",
        ],
        ["Legal", row.legal, "As recorded"],
        ["Community team", row.communityTeam ?? "Not recorded", ""],
      ]
    : row.kind === "person"
      ? [
          ["Date of birth", dobText(row.dob), row.age === null ? "Age not recorded" : `${row.age}y`],
          ["Community team", row.communityTeam ?? "Not recorded", ""],
          ["Legal", row.legal, "As recorded"],
          ["Open records", "None", ""],
        ]
      : [
          ["Where now", row.where, row.whereSub],
          ["Heading to", row.to, row.toSub],
          ["Legal", row.legal, row.legalSub],
          row.kind === "movement"
            ? ["Transport", row.transport ?? "Not recorded", row.escort ? "Nurse escort" : ""]
            : ["Community team", row.communityTeam ?? "Not recorded", ""],
        ];
}

function hasCensusRecordLink(row: CensusRow): boolean {
  return (
    row.kind === "movement" ||
    row.kind === "referral" ||
    (row.kind === "admission" && Boolean(row.unitId) && row.bedNumber !== undefined) ||
    row.group === "off"
  );
}

/** The row's own record: its movement, referral, ward bed, or a new referral for a quiet record. */
/** The words of the row's own record link, the same on the drawer and the phone sheet (#45). */
function censusRecordLabel(row: CensusRow): string | null {
  if (row.kind === "movement") return "Movement";
  if (row.kind === "referral") return "Referral";
  if (row.kind === "admission" && row.unitId && row.bedNumber !== undefined) return "Ward bed";
  if (row.group === "off") return "New referral";
  return null;
}

function CensusRecordLink({
  row,
  onNavigate,
  variant,
  size,
  linkRef,
  hidden = false,
}: {
  row: CensusRow;
  onNavigate?: () => void;
  variant?: "pri" | "sec";
  size?: "sm";
  /** The phone sheet's footer button follows this link (#45), as Patient page follows its own. */
  linkRef?: Ref<HTMLAnchorElement>;
  /** Drawn for the footer button to follow only: out of sight, the Tab order and the tree. */
  hidden?: boolean;
}) {
  const className = hidden ? "sr-only" : buttonClass({ variant, size });
  const hide = hidden ? { ref: linkRef, tabIndex: -1, "aria-hidden": true as const } : { ref: linkRef };
  if (row.kind === "movement") {
    return (
      <Link {...hide} className={className} href={movementHref(row.key)}>
        Movement
      </Link>
    );
  }
  if (row.kind === "referral") {
    return (
      <Link {...hide} className={className} href={referralBoardHref(row.key)}>
        Referral
      </Link>
    );
  }
  if (row.kind === "admission" && row.unitId && row.bedNumber !== undefined) {
    return (
      <Link
        {...hide}
        className={className}
        data-census-bed-link={row.key}
        href={`/bedchart/ward/${encodeURIComponent(row.unitId)}?bed=${row.bedNumber}`}
        onClick={() => {
          writeCensusMarker("wardflow:census-bed-opener", row.key);
          // ward-screen.tsx returns to Census on close only for this exact unit and bed.
          writeCensusMarker("wardflow:census-bed-opener-target", `${row.unitId}:${row.bedNumber}`);
          onNavigate?.();
        }}
      >
        Ward bed
      </Link>
    );
  }
  if (row.group === "off") {
    return (
      <Link {...hide} className={className} href="/bedchart/referrals/new">
        New referral
      </Link>
    );
  }
  return null;
}

/** What happens next, the facts and the latest entries: shared by the card and the drawer. */
function CensusDetailFacts({
  row,
  now,
  neutral = false,
  stepInFoot = false,
}: {
  row: CensusRow;
  now: Instant;
  neutral?: boolean;
  /** Audit three #12: the step is the drawer's filled foot button, so the body does not say it again. */
  stepInFoot?: boolean;
}) {
  const quiet = row.group === "off";
  return (
    <>
      <div className={cx(neutral ? styles.drawerStatus : styles.statusCard, !neutral && quiet && styles.statusQuiet)}>
        {stepInFoot ? null : (
          <span className={styles.statusLine}>
            <CensusGlyphMark glyph={row.glyph} />
            {row.next}
          </span>
        )}
        <span className={styles.statusSub}>
          {row.nextWho ? `${row.nextWho} · ` : ""}
          {row.timeText ? (
            <>
              <span className={styles.mono}>{row.timeText}</span> {row.timeSub}
            </>
          ) : quiet ? (
            "No open movement, referral or bed"
          ) : (
            "Nothing open"
          )}
        </span>
      </div>
      <dl className={styles.facts}>
        {censusFacts(row).map(([term, value, sub]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{value}</dd>
            {sub ? <dd className={styles.factSub}>{sub}</dd> : null}
          </div>
        ))}
      </dl>
      {row.timeline.length > 0 ? (
        <div className={styles.section}>
          <span className={styles.sectionHead}>Latest</span>
          <Timeline
            label="Latest for this patient"
            holdNew={false}
            items={row.timeline.slice(0, 3).map((entry, index) => ({
              id: `${row.key}-${index}`,
              at: when(entry.at, now),
              tone: entry.glyph === "off" ? "neutral" : TONE[entry.glyph],
              text: entry.text,
            }))}
          />
        </div>
      ) : null}
    </>
  );
}

/** The selected person. Every fact is the record's own; a missing one says so. */
export function CensusDetail({ row, now, onClose, onNavigate, onCopy, copyNote }: CensusDetailProps) {
  useCensusBedLinkReturn(row.key);
  const quiet = row.group === "off";
  return (
    <div className={styles.detail}>
      <div className={styles.detailHead}>
        <Avatar
          name={row.name}
          initials={initials(row.name)}
          size="lg"
          decorative
          className={cx(quiet && styles.avatarQuiet)}
        />
        <div className={styles.two}>
          <h2 className={styles.detailName}>{row.name}</h2>
          <span>
            <span className={styles.mono}>{row.umrn}</span> · {ageSex(row)}
          </span>
        </div>
        {row.tier !== null ? <TierPill tier={row.tier} /> : null}
        {onClose ? (
          <Button variant="ghost" size="sm" icon={X} iconOnly aria-label="Back to this shift" onClick={onClose} />
        ) : null}
      </div>
      <CensusDetailFacts row={row} now={now} />
      <div className={styles.actions}>
        <Button
          variant="ghost"
          size="sm"
          icon={Copy}
          iconOnly
          aria-label="Copy to notes"
          title="Copy to notes"
          onClick={() => onCopy(row)}
        />
        {copyNote ? (
          <span className={styles.copyNote} role="status" aria-live="polite">
            {copyNote}
          </span>
        ) : null}
        <span className={styles.spacer} />
        <CensusRecordLink row={row} onNavigate={onNavigate} size="sm" />
        {row.patientRecordId ? (
          <Link className={buttonClass({ variant: "pri", size: "sm" })} href={patientHref(row.patientRecordId)}>
            Patient page
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export type CensusDetailDrawerProps = {
  row: CensusRow | null;
  open: boolean;
  now: Instant;
  onClose: () => void;
  onNavigate: () => void;
  onCopy: (row: CensusRow) => void;
  copyNote: string | null;
  testId?: string;
  /** Audit three #34: the list pager in the drawer head. */
  pager?: DrawerPagerProps;
};

/**
 * Drawer review (6 Nov 2026): the chosen person opens in the kit right drawer at every width above
 * the phone, so the census keeps the page's one scroll and its full width. One quiet subtitle (UMRN,
 * age and sex, tier), the group as the tag, one scroll body, and a light foot with one filled action.
 */
export function CensusDetailDrawer({
  row,
  open,
  now,
  onClose,
  onNavigate,
  onCopy,
  copyNote,
  testId,
  pager,
}: CensusDetailDrawerProps) {
  if (row === null) return null;
  const group = CENSUS_GROUPS.find((entry) => entry.id === row.group);
  // Audit three #12 (Josh, 28 Nov 2026): where the row names a step this drawer can take (Find a
  // bed), that step is the one filled button and Patient page goes quiet. Otherwise one filled
  // action: Patient page when there is a person record, else the row's own record.
  const findBed = row.next === FIND_A_BED;
  const recordLeads = !findBed && !row.patientRecordId;
  return (
    <PanelDrawer
      open={open}
      onClose={onClose}
      title={row.name}
      subtitle={
        <span className={styles.drawerSubtitle}>
          <span className={styles.mono}>{row.umrn}</span>
          <span aria-hidden="true">·</span>
          <span>{ageSex(row)}</span>
          {row.tier !== null ? (
            <>
              <span aria-hidden="true">·</span>
              <span>Tier {row.tier}</span>
            </>
          ) : null}
        </span>
      }
      tag={
        group ? (
          <StatusPill tone={group.glyph === "off" ? "neutral" : TONE[group.glyph]}>{group.short}</StatusPill>
        ) : null
      }
      closeLabel="Close patient details"
      testId={testId}
      pager={pager}
      bodyClassName={styles.drawerBody}
      foot={
        <>
          {copyNote ? (
            <span className={styles.copyNote} role="status" aria-live="polite">
              {copyNote}
            </span>
          ) : null}
          {findBed ? (
            <Button
              variant="pri"
              icon={SearchCheck}
              onClick={(event) => requestToolsTool("bed-finder", event.currentTarget)}
              data-testid="census-drawer-find-bed"
            >
              Find a bed
            </Button>
          ) : row.patientRecordId ? (
            <Link className={buttonClass({ variant: "pri" })} href={patientHref(row.patientRecordId)}>
              Patient page
            </Link>
          ) : null}
          <DrawerFootRow className={styles.drawerTools}>
            {findBed && row.patientRecordId ? (
              <Link className={buttonClass({ variant: "sec" })} href={patientHref(row.patientRecordId)}>
                Patient page
              </Link>
            ) : null}
            {hasCensusRecordLink(row) ? (
              <CensusRecordLink row={row} onNavigate={onNavigate} variant={recordLeads ? "pri" : "sec"} />
            ) : null}
            <Button variant="sec" icon={Copy} onClick={() => onCopy(row)}>
              Copy summary
            </Button>
          </DrawerFootRow>
        </>
      }
    >
      <CensusDrawerBody row={row} now={now} stepInFoot={findBed} />
    </PanelDrawer>
  );
}

function CensusDrawerBody({ row, now, stepInFoot }: { row: CensusRow; now: Instant; stepInFoot: boolean }) {
  useCensusBedLinkReturn(row.key);
  return <CensusDetailFacts row={row} now={now} neutral stepInFoot={stepInFoot} />;
}

/* ───────────────────────── history ───────────────────────── */

export function CensusHistory({
  searches,
  closed,
  onRerun,
  now,
}: {
  searches: readonly AccessEntry[];
  closed: readonly ClosedTodayRow[];
  onRerun: (entry: AccessEntry) => void;
  now: Instant;
}) {
  return (
    <ul className={styles.history}>
      <li className={styles.historyHead}>
        Searched this session
        <span className={styles.groupCount}>{searches.length}</span>
        <span className={styles.spacer} />
        <span className={styles.historyNote}>Kept in memory only, gone on reload</span>
      </li>
      {searches.length > 0 ? (
        searches.map((entry) => (
          <li key={`${entry.at}-${entry.words}`} className={styles.historyRow}>
            <span className={styles.mono}>{formatInstantWithDay(entry.at, now)}</span>
            <Icon icon={Search} size={14} />
            <span className={styles.wrap}>{entry.words}</span>
            <Button variant="ghost" size="sm" onClick={() => onRerun(entry)}>
              Search again
            </Button>
          </li>
        ))
      ) : (
        <li className={styles.historyEmpty}>No searches yet. Press Enter in the search to keep one here.</li>
      )}
      <li className={styles.historyHead}>
        Closed today
        <span className={styles.groupCount}>{closed.length}</span>
      </li>
      {closed.map((row) => (
        <li key={row.key} className={styles.historyRow}>
          <span className={styles.mono}>{formatInstantWithDay(row.at, now)}</span>
          <StatusGlyph tone={row.outcome === "Arrived" ? "success" : "closed"} size={10} />
          <span className={styles.wrap}>
            <b>{row.name}</b> <span className={styles.mono}>{row.umrn}</span> · {row.outcome}, {row.detail}
          </span>
          {row.patientRecordId ? (
            <Link className={buttonClass({ variant: "ghost", size: "sm" })} href={patientHref(row.patientRecordId)}>
              Open
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function CensusEmpty({
  query,
  onReset,
  addHref,
  onAdd,
  nothingHeld = false,
}: {
  query: string;
  onReset: () => void;
  /**
   * Q277 (pre-launch review E5, 2 Nov 2026): nobody is on the census and no search or filter is set,
   * so the line says so plainly instead of blaming a search, and there is no Clear search to press.
   */
  nothingHeld?: boolean;
  /** Absent for a desk whose role cannot add a patient (P165): no link to a refusal page. */
  addHref?: string;
  onAdd: (event: ReactMouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <div className={styles.empty}>
      <Icon icon={SearchX} size={20} />
      <span>
        {nothingHeld
          ? "No patients yet."
          : query
            ? `No patient matches “${query}”`
            : "No patient matches the current search"}
      </span>
      <span className={styles.emptyActions}>
        {nothingHeld ? null : (
          <Button size="sm" onClick={onReset}>
            Clear search
          </Button>
        )}
        {addHref ? (
          <Link className={buttonClass({ variant: "pri", size: "sm" })} href={addHref} onClick={onAdd}>
            <Icon icon={UserPlus} size={14} />
            Add patient
          </Link>
        ) : null}
      </span>
    </div>
  );
}

/* ───────────────────────── phone ───────────────────────── */

export type PhoneCensusProps = {
  /** PS1: the register's state switch, drawn under the hero. */
  stateSwitch?: ReactNode;
  rows: readonly CensusRow[];
  totals: Record<CensusGroup, number>;
  matched: Record<CensusGroup, number>;
  searching: boolean;
  needle: string;
  highlight: CensusHighlight | null;
  onHighlight: (next: CensusHighlight | null) => void;
  highlightCounts: Record<CensusHighlight, number>;
  lifted: (row: CensusRow) => boolean;
  expandedKey: string | null;
  onExpand: (row: CensusRow) => void;
  onCopy: (row: CensusRow) => void;
  copyNote: string | null;
  tab: "now" | "history";
  onTab: (tab: "now" | "history") => void;
  history: ReactNode;
  /** Absent while a search is on: History does not follow the search, so it shows no count (shell-16). */
  historyCount: number | undefined;
  empty: ReactNode;
  /** Scrolls the list to a group's band. */
  onJump: (group: CensusGroup) => void;
};

/** Rows a group shows before "Show all". */
const PHONE_GROUP_ROWS = 5;

/** The quiet word under a row's time, by where the person is. */
const TIME_WORD: Record<CensusGroup, string> = {
  ask: "waiting",
  wait: "waiting",
  found: "since found",
  move: "on the road",
  ward: "on the ward",
  off: "",
};

/**
 * The phone's own census (v10, 390 by 844): highlight chips that scroll sideways, Now and History
 * as pill tabs that stay under the header, then every group as a band in one inset list, five rows
 * each until Show all. A row opens the person as a tall sheet with Open patient pinned at its foot.
 */
export function PhoneCensus(props: PhoneCensusProps) {
  const [allShown, setAllShown] = useState<ReadonlySet<CensusGroup>>(() => new Set());
  // A2-20: initials plus UMRN when Discreet names on phone is on.
  const nameFor = usePatientNameDisplay();
  const openLink = useRef<HTMLAnchorElement>(null);
  const recordLink = useRef<HTMLAnchorElement>(null);
  const { rows, searching, highlight } = props;
  const open = props.expandedKey === null ? null : (rows.find((row) => row.key === props.expandedKey) ?? null);
  const phoneRecordLabel = open ? censusRecordLabel(open) : null;
  const [offShown, setOffShown] = useState(false);
  // PS1: people followed by a community team list as their own section; only those with no team wait.
  const offCount = rows.filter((row) => row.group === "off" && row.communityTeam === null).length;
  // Not active records wait behind one button under the list unless a search is running.
  // A state switch that leaves only Not active rows shows them straight away.
  const offInList = searching || offShown || (offCount > 0 && offCount === rows.length);
  const groups = censusSections(rows)
    .map((section) => ({ ...section.group, key: section.key, label: section.label, rows: section.rows }))
    .filter((entry) => entry.rows.length > 0 && (entry.key !== "off" || offInList));
  return (
    <section className={styles.phone} data-testid="ward-patient-search-results-console" aria-label="Patients">
      {/* PS1 (3 Nov 2026): the state switch replaces the six group jump buttons. */}
      {props.stateSwitch ? <div className={styles.phoneStates}>{props.stateSwitch}</div> : null}
      {/* Audit four #107: on a phone the five highlight chips are one Highlight menu, counts in the menu. */}
      <div className={styles.phoneHighlight}>
        <Menu
          label="Highlight"
          align="start"
          items={CENSUS_HIGHLIGHTS.map((chip) => ({
            id: chip.id,
            label: chip.label,
            checked: highlight === chip.id,
            meta: props.highlightCounts[chip.id],
            onSelect: () => {
              props.onTab("now");
              props.onHighlight(highlight === chip.id ? null : chip.id);
            },
          }))}
          trigger={(triggerProps) => (
            <button
              {...triggerProps}
              type="button"
              className={buttonClass({ variant: "sec", size: "md" })}
              data-active={highlight !== null ? "true" : undefined}
            >
              Highlight
              {highlight !== null ? (
                <b className={styles.phoneChipCount}>
                  {CENSUS_HIGHLIGHTS.find((chip) => chip.id === highlight)?.label}
                </b>
              ) : null}
              <ChevronDown size={14} aria-hidden="true" />
            </button>
          )}
        />
        {/* Gate r10 look upgrade 1: the people count ends the Highlight line, as on desktop, so the
            button is not left alone on its row. */}
        {props.tab === "history" ? null : (
          <span className={styles.phoneHighlightCount}>
            {(() => {
              const n = countPeople(rows);
              return n === 1 ? "1 person" : `${n} people`;
            })()}
          </span>
        )}
      </div>
      {/* PS1 (3 Nov 2026): no Now or History switch under the state switch. History is one link at
          the foot of the list, and a Back button here while it is open. */}
      {props.tab === "history" ? (
        <div className={styles.phoneSeg}>
          <Button variant="ghost" size="sm" icon={ChevronLeft} onClick={() => props.onTab("now")}>
            Back to the register
          </Button>
        </div>
      ) : null}
      {props.tab === "history" ? (
        props.history
      ) : rows.length === 0 ? (
        props.empty
      ) : (
        <div className={styles.phoneList}>
          {groups.map((group) => {
            const full = allShown.has(group.id) || group.rows.length <= PHONE_GROUP_ROWS + 1;
            const shown = full ? group.rows : group.rows.slice(0, PHONE_GROUP_ROWS);
            return (
              <section
                key={group.key}
                id={`ward-patient-search-group-${group.key}`}
                className={styles.phoneGroupBlock}
                aria-label={group.label}
              >
                <h2 className={styles.phoneGroupHead}>
                  <CensusGlyphMark glyph={group.glyph} size={8} />
                  <span>{group.label}</span>
                  {searching ? <span className={styles.phoneGroupCount}>{countPeople(group.rows)}</span> : null}
                </h2>
                <ul className={styles.phoneRows}>
                  {shown.map((row) => {
                    const lit = highlight !== null && props.lifted(row);
                    return (
                      <li key={row.key} className={cx(styles.phoneRow, lit && styles.phoneRowLit)}>
                        <button
                          type="button"
                          className={styles.phoneRowButton}
                          aria-expanded={props.expandedKey === row.key}
                          aria-haspopup="dialog"
                          data-testid={rowTestId(row)}
                          /* Return to your place: Back focuses the row that was opened. The table
                             row above carries the same `data-id` at wider widths. */
                          data-id={row.key}
                          onClick={() => props.onExpand(row)}
                        >
                          <span className={styles.phoneTier}>
                            {row.tier !== null ? <TierPill tier={row.tier} /> : null}
                          </span>
                          <span className={styles.phoneText}>
                            <b className={styles.phoneName}>
                              {/* Names wrap in full, never cut with "…". */}
                              <span className={styles.wrap}>
                                <Marked text={nameFor(row.name, row.umrn)} needle={props.needle} />
                              </span>
                              {row.confidential ? <span className={styles.restricted}>Restricted</span> : null}
                            </b>
                            <span className={cx(styles.phoneMeta, styles.phoneMetaWrap)}>
                              <span className={styles.mono}>
                                <Marked text={row.umrn} needle={props.needle} />
                              </span>{" "}
                              {/* Date of birth tells near-spelling names apart while a search runs. */}
                              {searching ? <span>· {dobText(row.dob)} </span> : null}
                              {/* Redesign: the step line below already says "In transit"; say it once. */}
                              {row.next.startsWith(row.where) ? null : <>· {row.where}</>}
                            </span>
                            {/* Redesign: wraps, so a legal line and a place are never cut with "…". */}
                            <span className={cx(styles.phoneMeta, styles.phoneMetaWrap)}>
                              {row.next}
                              {row.formCode ? ` · Form ${row.formCode}` : ""}
                            </span>
                          </span>
                          <span className={styles.phoneEnd}>
                            <span className={styles.phoneTime}>
                              {row.longWait ? <StatusGlyph tone="warning" size={9} /> : null}
                              {row.waitMinutes !== null || row.group === "ward" ? row.timeText : ""}
                            </span>
                            <span className={styles.phoneTimeWord}>{TIME_WORD[row.group]}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {full ? null : (
                  <ShowMoreRow onClick={() => setAllShown((current) => new Set(current).add(group.id))}>
                    Show all {group.rows.length}
                  </ShowMoreRow>
                )}
              </section>
            );
          })}
          {/* Redesign: the same plain link as each group's "Show all", at the foot of the list. */}
          {offCount > 0 && !offInList ? (
            <ShowMoreRow onClick={() => setOffShown(true)}>Show {offCount} not active records</ShowMoreRow>
          ) : null}
          {props.historyCount ? (
            <ShowMoreRow onClick={() => props.onTab("history")}>Closed today, {props.historyCount}</ShowMoreRow>
          ) : null}
        </div>
      )}
      <PhoneSheet
        open={open !== null}
        onClose={() => {
          if (open) props.onExpand(open);
        }}
        title={open?.name ?? "Patient"}
        description={
          open ? (
            <span className={styles.phoneSheetMeta}>
              <span className={styles.mono}>{open.umrn}</span> · {ageSex(open)}
            </span>
          ) : undefined
        }
        // #45 (audit two, 27 Nov 2026): the drawer's labels and its three actions. Patient page leads
        // when there is a person record, else the row's own record; Copy summary beside it; the other
        // record link (when both exist) closes the body.
        // Audit three review: where the next step is Find a bed, it is the filled action and Patient page
        // goes outlined beside it, as on the desktop drawer; Copy to notes moves into the body.
        pager={
          open
            ? (() => {
                const index = rows.findIndex((row) => row.key === open.key);
                return {
                  index,
                  total: rows.length,
                  noun: "person",
                  onStep: (delta: -1 | 1) => {
                    const next = rows[(Math.max(index, 0) + delta + rows.length) % rows.length];
                    if (next && next.key !== open.key) props.onExpand(next);
                  },
                };
              })()
            : undefined
        }
        primary={
          open?.next === FIND_A_BED
            ? { label: FIND_A_BED, onAction: () => requestToolsTool("bed-finder") }
            : open?.patientRecordId
              ? {
                  label: "Patient page",
                  // A real link does the navigation, so it stays client side and keeps the session.
                  onAction: () => openLink.current?.click(),
                }
              : open && phoneRecordLabel
                ? { label: phoneRecordLabel, onAction: () => recordLink.current?.click() }
                : undefined
        }
        secondary={
          open?.next === FIND_A_BED && open.patientRecordId
            ? { label: "Patient page", onAction: () => openLink.current?.click() }
            : open
              ? { label: "Copy to notes", onAction: () => props.onCopy(open) }
              : undefined
        }
        data-testid="ward-patient-search-phone-sheet"
      >
        {open ? (
          <div className={styles.phoneSheet}>
            {open.tier !== null ? (
              <span>
                <TierPill tier={open.tier} />
              </span>
            ) : null}
            <FactGrid
              facts={[
                { id: "where", label: "Where now", value: open.where },
                {
                  id: "time",
                  label: open.group === "ward" ? "On the ward" : open.waitMinutes !== null ? "Waiting" : "Time",
                  value: <span className={styles.mono}>{open.timeText || "Not recorded"}</span>,
                },
                { id: "to", label: "Heading to", value: open.to },
                { id: "legal", label: "Legal", value: open.legal },
              ]}
            />
            <dl className={styles.phoneSheetList}>
              <div>
                <dt>Status</dt>
                <dd>{CENSUS_GROUPS.find((entry) => entry.id === open.group)?.label}</dd>
              </div>
              <div>
                <dt>Next step</dt>
                <dd>
                  {open.next}
                  {open.nextWho ? ` · ${open.nextWho}` : ""}
                </dd>
              </div>
              <div>
                <dt>Region</dt>
                <dd>{open.service ?? "Not recorded"}</dd>
              </div>
              <div>
                <dt>Date of birth</dt>
                <dd>{dobText(open.dob)}</dd>
              </div>
            </dl>
            {props.copyNote ? (
              <span className={styles.copyNote} role="status" aria-live="polite">
                {props.copyNote}
              </span>
            ) : null}
            {(open.patientRecordId || open.next === FIND_A_BED) && phoneRecordLabel ? (
              <div className={styles.phoneSheetRecord}>
                <CensusRecordLink row={open} variant="sec" />
              </div>
            ) : null}
            {open.next === FIND_A_BED && open.patientRecordId ? (
              <div className={styles.phoneSheetRecord}>
                <Button variant="sec" onClick={() => props.onCopy(open)}>
                  Copy to notes
                </Button>
              </div>
            ) : null}
            <p className={styles.phoneSheetNote}>Names are invented. Identity is the UMRN.</p>
            {!open.patientRecordId && open.next !== FIND_A_BED && phoneRecordLabel ? (
              <CensusRecordLink row={open} linkRef={recordLink} hidden />
            ) : null}
            {open.patientRecordId ? (
              <Link
                ref={openLink}
                href={patientHref(open.patientRecordId)}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
              >
                Open patient
              </Link>
            ) : null}
          </div>
        ) : null}
      </PhoneSheet>
    </section>
  );
}
