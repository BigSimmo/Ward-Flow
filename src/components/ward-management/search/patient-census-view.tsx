"use client";

import Link from "next/link";
import { waitingHref } from "@/components/ward-management/delays/waiting-href";
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
} from "react";
import { CalendarDays, ChevronDown, ChevronLeft, Clock, Copy, Search, SearchX, UserPlus, X } from "lucide-react";

import { ListExportButton } from "@/components/ward-management/ward-list-export-button";
import { usePatientNameDisplay } from "@/components/ward-management/settings/discreet-names";
import { usePrinting } from "@/components/ward-management/use-printing";
import {
  Avatar,
  Button,
  DateField,
  DrawerFootRow,
  FactGrid,
  FilterChip,
  Icon,
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
  phoneRows,
  SrOnly,
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
import styles from "./census.module.css";
import { movementHref, patientHref } from "@/components/ward-management/shell/ward-facade";
import { referralBoardHref } from "@/components/ward-management/ed/ed-bed-search-step";

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

function TierPill({ tier }: { tier: CensusRow["tier"] }) {
  if (tier === null) {
    return (
      <span className={styles.noTier}>
        <span className="sr-only">No tier</span>
        <span aria-hidden="true">–</span>
      </span>
    );
  }
  return (
    <span className={cx(styles.tier, tier === 1 && styles.tier1)} title={`Tier ${tier}`}>
      <span className="sr-only">Tier {tier}</span>
      <span aria-hidden="true">T{tier}</span>
    </span>
  );
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

/**
 * D-91 ("Every page search box has one look"): the census search is the kit's one page search field
 * (`SearchField`), so the date of birth switch and box sit beside it rather than inside a hand-made
 * pill. The switch.
 */
export function DobToggle({ dobOn, onDobToggle }: { dobOn: boolean; onDobToggle: () => void }) {
  return (
    <button
      type="button"
      className={styles.dobToggle}
      aria-pressed={dobOn}
      onClick={onDobToggle}
      title={dobOn ? "Remove the date of birth" : "Add a date of birth"}
    >
      <Icon icon={CalendarDays} size={14} />
      DOB
    </button>
  );
}

/**
 * The date of birth box: beside the search on a laptop, a row of its own under it on a phone. The
 * kit's typed DD/MM/YYYY box, so `dob` is YYYY-MM-DD once a real day is typed and "" until then
 * (`parseDob` reads both). Clear also empties a half-typed date, which the box keeps to itself.
 */
export function DobField({
  dob,
  onDob,
  phone = false,
}: {
  dob: string;
  onDob: (next: string) => void;
  phone?: boolean;
}) {
  const [fresh, setFresh] = useState(0);
  return (
    <DateField
      key={fresh}
      icon={CalendarDays}
      boxClassName={phone ? styles.phoneDobField : styles.dobField}
      value={dob}
      onValueChange={onDob}
      onClear={() => {
        onDob("");
        setFresh((count) => count + 1);
      }}
      placeholder={phone ? "Date of birth, DD/MM/YYYY" : "DD/MM/YYYY"}
      aria-label="Date of birth"
      enterKeyHint="search"
    />
  );
}

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
  copyNote: string | null;
  empty: ReactNode;
  notice?: ReactNode;
};

const countPeople = (rows: readonly CensusRow[]) => new Set(rows.map((row) => row.patientRecordId ?? row.key)).size;

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
  const cols = 6;
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
      <h2 id="ward-patient-search-results-console-title" className="sr-only">
        Patients
      </h2>
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
            <Button
              variant="ghost"
              size="sm"
              icon={Copy}
              onClick={props.onCopyList}
              title="Copies the highlighted rows, or every open row, as plain text"
            >
              Copy list
            </Button>
            {props.onExportList ? (
              <ListExportButton
                load={props.onExportList}
                variant="ghost"
                disabled={rows.length === 0}
                testId="ward-census-export"
              />
            ) : null}
          </>
        ) : null}
      </div>
      {tab === "now" ? (
        <div className={styles.chipBar} role="group" aria-label="Highlight">
          <span className={styles.chipLead}>Highlight</span>
          {CENSUS_HIGHLIGHTS.map((chip) => (
            <FilterChip
              key={chip.id}
              pressed={highlight === chip.id}
              onPressedChange={(pressed) => props.onHighlight(pressed ? chip.id : null)}
              count={props.highlightCounts[chip.id]}
              tone={chip.glyph ? TONE[chip.glyph] : undefined}
            >
              {chip.label}
            </FilterChip>
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
          <table className={cx(tableClasses.table, styles.censusTable)} aria-label="Patients by where they are now">
            <colgroup>
              <col className={styles.colTier} />
              <col className={styles.colWho} />
              <col className={styles.colWhere} />
              <col className={styles.colNext} />
              <col className={styles.colLegal} />
              <col className={styles.colTime} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Tier</th>
                <th scope="col">Patient</th>
                {/* Redesign: one word, so the header stays on one line like the others. Table polish
                    (9 Nov 2026): the cell also says where the person is heading. */}
                <th scope="col" aria-label="Where now">
                  Where
                </th>
                <th scope="col">Next step</th>
                <th scope="col">Legal</th>
                <th scope="col" className={styles.num}>
                  Time
                </th>
              </tr>
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
        </div>
      )}
      <div className={styles.foot}>
        <span>
          {searching
            ? `${countPeople(rows)} found across ${groupsFound} ${groupsFound === 1 ? "group" : "groups"}`
            : `${props.totalPeople} people. Every person the app holds, by where they are now`}
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
          Open details for {row.name}
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
  const arrived = props.closedToday.filter((row) => row.outcome === "Arrived").length;
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
      id: "long",
      glyph: "risk",
      title: "Past 24 hours",
      sub: "Your default, not a legal limit",
      value: props.highlightCounts.long,
      chip: "long",
    },
    {
      id: "form",
      glyph: "wait",
      title: "Forms with a due time",
      sub: dues[0] ? `Next ${typedClock(dues[0].formDueAt ?? now, now, props.dayZero)} · ${dues[0].name}` : "None",
      value: dues.length,
      chip: "form",
    },
    {
      id: "edd",
      glyph: "risk",
      title: "Past expected date",
      sub: "On a ward, date passed",
      value: props.highlightCounts.edd,
      chip: "edd",
    },
    {
      id: "aed",
      glyph: "move",
      title: "Away at ED",
      sub: "Bed kept on the ward",
      value: props.highlightCounts.aed,
      chip: "aed",
    },
    {
      id: "arrived",
      glyph: "done",
      title: "Arrived today",
      sub: "Closed movements go to History",
      value: arrived,
      onPress: props.onHistory,
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
      <div className={styles.summaryFoot}>
        <p>Choose a row to open the patient</p>
        {/* B4: everyone waiting, with why, is the Delays list. */}
        <Link href={waitingHref()} className={buttonClass({ variant: "ghost", size: "sm" })}>
          Waiting list
        </Link>
      </div>
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
function CensusRecordLink({
  row,
  onNavigate,
  variant,
  size,
}: {
  row: CensusRow;
  onNavigate?: () => void;
  variant?: "pri" | "sec";
  size?: "sm";
}) {
  const className = buttonClass({ variant, size });
  if (row.kind === "movement") {
    return (
      <Link className={className} href={movementHref(row.key)}>
        Movement
      </Link>
    );
  }
  if (row.kind === "referral") {
    return (
      <Link className={className} href={referralBoardHref(row.key)}>
        Referral
      </Link>
    );
  }
  if (row.kind === "admission" && row.unitId && row.bedNumber !== undefined) {
    return (
      <Link
        className={className}
        data-census-bed-link={row.key}
        href={`/ward-flow/ward/${encodeURIComponent(row.unitId)}?bed=${row.bedNumber}`}
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
      <Link className={className} href="/ward-flow/referrals/new">
        New referral
      </Link>
    );
  }
  return null;
}

/** What happens next, the facts and the latest entries: shared by the card and the drawer. */
function CensusDetailFacts({ row, now, neutral = false }: { row: CensusRow; now: Instant; neutral?: boolean }) {
  const quiet = row.group === "off";
  return (
    <>
      <div className={cx(neutral ? styles.drawerStatus : styles.statusCard, !neutral && quiet && styles.statusQuiet)}>
        <span className={styles.statusLine}>
          <CensusGlyphMark glyph={row.glyph} />
          {row.next}
        </span>
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
          aria-label="Copy summary"
          title="Copy summary"
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
            Open patient
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
}: CensusDetailDrawerProps) {
  if (row === null) return null;
  const group = CENSUS_GROUPS.find((entry) => entry.id === row.group);
  // One filled action: Open patient when there is a person record, otherwise the row's own record.
  const recordLeads = !row.patientRecordId;
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
      bodyClassName={styles.drawerBody}
      foot={
        <>
          {copyNote ? (
            <span className={styles.copyNote} role="status" aria-live="polite">
              {copyNote}
            </span>
          ) : null}
          {row.patientRecordId ? (
            <Link className={buttonClass({ variant: "pri" })} href={patientHref(row.patientRecordId)}>
              Open patient
            </Link>
          ) : null}
          <DrawerFootRow className={styles.drawerTools}>
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
      <CensusDrawerBody row={row} now={now} />
    </PanelDrawer>
  );
}

function CensusDrawerBody({ row, now }: { row: CensusRow; now: Instant }) {
  useCensusBedLinkReturn(row.key);
  return <CensusDetailFacts row={row} now={now} neutral />;
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
  const { rows, searching, highlight } = props;
  const open = props.expandedKey === null ? null : (rows.find((row) => row.key === props.expandedKey) ?? null);
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
      <div className={cx(styles.phoneChips, phoneRows.chipRow)} role="group" aria-label="Highlight">
        {CENSUS_HIGHLIGHTS.map((chip) => (
          <FilterChip
            key={chip.id}
            className={cx(styles.phoneChip, phoneRows.chip, props.highlightCounts[chip.id] === 0 && phoneRows.zero)}
            pressed={highlight === chip.id}
            onPressedChange={() => {
              props.onTab("now");
              props.onHighlight(highlight === chip.id ? null : chip.id);
            }}
          >
            {chip.glyph ? <CensusGlyphMark glyph={chip.glyph} size={8} /> : null}
            {/* D-91 (Josh, 31 Oct 2026): the count comes first, as Home's and Referrals' chips. */}
            <b className={styles.phoneChipCount}>{props.highlightCounts[chip.id]}</b>
            {chip.label}
          </FilterChip>
        ))}
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
        primary={
          open?.patientRecordId
            ? {
                label: "Open patient",
                // A real link does the navigation, so it stays client side and keeps the session.
                onAction: () => openLink.current?.click(),
              }
            : undefined
        }
        secondary={open ? { label: "Copy", onAction: () => props.onCopy(open) } : undefined}
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
            <p className={styles.phoneSheetNote}>Names are invented. Identity is the UMRN.</p>
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
