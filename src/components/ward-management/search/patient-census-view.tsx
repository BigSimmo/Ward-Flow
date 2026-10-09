"use client";

import Link from "next/link";
import {
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { CalendarDays, ChevronDown, Clock, Copy, Eye, History, Search, SearchX, UserPlus, X } from "lucide-react";

import {
  Avatar,
  Button,
  FilterChip,
  HeroStat,
  Icon,
  Segmented,
  Sheet,
  StatusGlyph,
  Tabs,
  Timeline,
  buttonClass,
  tableClasses,
  cx,
  type WfTone,
} from "@/components/wf";
import {
  formatInstant,
  formatInstantWithDay,
  MINUTES_PER_DAY,
  type Instant,
} from "@/components/ward-management/ward-clock";
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

import styles from "./census.module.css";

const TONE: Record<Exclude<CensusGlyph, "off">, WfTone> = {
  act: "danger",
  risk: "warning",
  done: "success",
  move: "info",
  wait: "neutral",
};

/** The status shape for a row. `off` is a short bar: a record with nothing open. */
export function CensusGlyphMark({ glyph, size = 10 }: { glyph: CensusGlyph; size?: number }) {
  if (glyph === "off") return <span className={styles.offGlyph} aria-hidden="true" />;
  return <StatusGlyph tone={TONE[glyph]} size={size} />;
}

export function TierPill({ tier }: { tier: CensusRow["tier"] }) {
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
  return name
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
 * What sits inside the 36px search pill after the typed text: the date of birth slot when it is on,
 * the live count of people found, the DOB switch, and the "/" hint while the field is empty.
 */
export function SearchAdornment({
  dobOn,
  onDobToggle,
  dob,
  onDob,
  count,
  empty,
  phone = false,
}: {
  dobOn: boolean;
  onDobToggle: () => void;
  dob: string;
  onDob: (next: string) => void;
  count: number | null;
  empty: boolean;
  phone?: boolean;
}) {
  return (
    <>
      {dobOn && !phone ? (
        <span className={styles.dobSeg}>
          <Icon icon={CalendarDays} size={14} />
          <input
            className={styles.dobInput}
            value={dob}
            onChange={(event) => onDob(event.target.value)}
            placeholder="DD/MM/YYYY"
            aria-label="Date of birth"
            inputMode="numeric"
            autoComplete="off"
          />
        </span>
      ) : null}
      {count !== null ? (
        <span className={styles.count} title="People found">
          {count}
          <span className="sr-only"> found</span>
        </span>
      ) : null}
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
      {empty && !phone ? (
        <kbd className={styles.kbd} aria-hidden="true">
          /
        </kbd>
      ) : null}
    </>
  );
}

/** The phone's own second field for a date of birth, a full 48px row under the search. */
export function PhoneDobField({ dob, onDob }: { dob: string; onDob: (next: string) => void }) {
  return (
    <label className={styles.phoneDob}>
      <Icon icon={CalendarDays} size={16} />
      <span className="sr-only">Date of birth</span>
      <input
        value={dob}
        onChange={(event) => onDob(event.target.value)}
        placeholder="Date of birth, DD/MM/YYYY"
        inputMode="numeric"
        autoComplete="off"
      />
    </label>
  );
}

/** "Today ✓ 6 arrived ✕ 2 left – 1 did not proceed". Opens History. */
export function FlowChip({ closed, onOpen }: { closed: readonly ClosedTodayRow[]; onOpen: () => void }) {
  const arrived = closed.filter((row) => row.outcome === "Arrived").length;
  const left = closed.filter((row) => row.outcome === "Discharged" || row.outcome === "Transferred").length;
  const stopped = closed.filter((row) => row.outcome === "Did not proceed").length;
  return (
    <button type="button" className={styles.flow} onClick={onOpen} title="Opens History">
      <span className={styles.flowLead}>Today</span>
      <span className={styles.flowPart}>
        <StatusGlyph tone="success" size={9} />
        <b>{arrived}</b> arrived
      </span>
      <span className={styles.flowPart}>
        <StatusGlyph tone="closed" size={9} />
        <b>{left}</b> left
      </span>
      <span className={styles.flowPart}>
        <CensusGlyphMark glyph="off" />
        <b>{stopped}</b> did not proceed
      </span>
    </button>
  );
}

/**
 * The five group counts on the hero. While a search runs each becomes a match map, "8 of 47", and
 * a group with nothing found dims. Pressing one opens that group and scrolls to it.
 */
export function CensusMapPills({
  totals,
  matched,
  searching,
  onJump,
}: {
  totals: Record<CensusGroup, number>;
  matched: Record<CensusGroup, number>;
  searching: boolean;
  onJump: (group: CensusGroup) => void;
}) {
  return (
    <div className={styles.mapPills} role="group" aria-label="Where patients are now">
      {CENSUS_GROUPS.map((group) => {
        const shown = searching ? matched[group.id] : totals[group.id];
        return (
          <HeroStat
            key={group.id}
            inline
            command
            onToggle={() => onJump(group.id)}
            className={cx(styles.mapPill, searching && shown === 0 && styles.mapPillZero)}
            value={
              <>
                {shown}
                {searching ? <span className={styles.of}>of {totals[group.id]}</span> : null}
              </>
            }
            label={
              <span className={styles.mapLabel}>
                <CensusGlyphMark glyph={group.glyph} size={9} />
                {group.short}
              </span>
            }
          />
        );
      })}
    </div>
  );
}

/* ───────────────────────── the census table ───────────────────────── */

export type CensusTableProps = {
  rows: readonly CensusRow[];
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
  historyCount: number;
  history: ReactNode;
  onCopyList: () => void;
  copyNote: string | null;
  empty: ReactNode;
  notice?: ReactNode;
};

const WARD_CAP = 40;

export function rowTestId(row: CensusRow): string {
  return row.kind === "movement" || row.kind === "referral"
    ? `ward-patient-search-case-${row.key}`
    : `ward-patient-search-row-${row.key}`;
}

export function CensusTable(props: CensusTableProps) {
  const { rows, searching, highlight, lifted, openGroups, tab } = props;
  const lifting = highlight !== null;
  const groups = CENSUS_GROUPS.map((group) => ({ group, rows: rows.filter((row) => row.group === group.id) }));
  const groupsFound = groups.filter((entry) => entry.rows.length > 0).length;

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
        <Tabs
          label="Now or history"
          items={[
            { id: "now", label: "Now", count: props.liveCount },
            { id: "history", label: "History", count: props.historyCount },
          ]}
          value={tab}
          onChange={props.onTab}
        />
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
        <div className={styles.scroll}>
          <table className={cx(tableClasses.table, styles.censusTable)} aria-label="Patients by where they are now">
            <colgroup>
              <col className={styles.colTier} />
              <col className={styles.colWho} />
              <col className={styles.colWhere} />
              <col className={styles.colTo} />
              <col className={styles.colNext} />
              <col className={styles.colLegal} />
              <col className={styles.colTime} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Tier</th>
                <th scope="col">Patient</th>
                <th scope="col">Where now</th>
                <th scope="col">Heading to</th>
                <th scope="col">Next step</th>
                <th scope="col">Legal</th>
                <th scope="col" className={styles.num}>
                  Time
                </th>
              </tr>
            </thead>
            {groups.map(({ group, rows: groupRows }) => {
              if (searching && groupRows.length === 0) return null;
              const litCount = lifting ? groupRows.filter(lifted).length : 0;
              const open = searching || openGroups[group.id] || litCount > 0;
              const cap =
                group.id === "ward" && !searching && !lifting && !props.showAllWard ? WARD_CAP : groupRows.length;
              return (
                <tbody key={group.id} id={`ward-patient-search-group-${group.id}`} className={styles.group}>
                  <tr className={cx(styles.groupRow, group.id === "off" && styles.groupQuiet)}>
                    <th colSpan={7} scope="rowgroup">
                      <button
                        type="button"
                        className={styles.groupButton}
                        aria-expanded={open}
                        onClick={() => props.onToggleGroup(group.id, !open)}
                      >
                        <ChevronDown className={styles.chev} size={14} aria-hidden="true" />
                        <CensusGlyphMark glyph={group.glyph} />
                        <span className={styles.groupLabel}>{group.label}</span>
                        <span className={styles.groupCount}>{groupRows.length}</span>
                        {litCount > 0 ? <span className={styles.groupHint}>{litCount} highlighted</span> : null}
                        <span className={styles.spacer} />
                        {!open ? (
                          <span className={styles.groupHint}>Show {groupRows.length}</span>
                        ) : group.id === "off" && !searching ? (
                          <span className={styles.groupHint}>Records with nothing open</span>
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
                            needle={props.needle}
                            selected={row.key === props.selectedKey}
                            lifted={lifting && lifted(row)}
                            flash={row.key === props.flashKey}
                            onSelect={props.onSelect}
                          />
                        ))
                    : null}
                  {open && cap < groupRows.length ? (
                    <tr className={styles.moreRow}>
                      <td colSpan={7}>
                        <Button variant="ghost" size="sm" onClick={props.onShowAllWard}>
                          Show all {groupRows.length}
                        </Button>
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
            ? `${rows.length} found across ${groupsFound} ${groupsFound === 1 ? "group" : "groups"}`
            : `${props.totalPeople} people. Every person the app holds, by where they are now`}
        </span>
        <span className={styles.spacer} />
        <span>Names are invented</span>
      </div>
    </section>
  );
}

function CensusTableRow({
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
      <td>
        <span className={styles.two}>
          <b>{row.where}</b>
          <span>{row.whereSub}</span>
        </span>
      </td>
      <td>
        <span className={styles.two}>
          <b>{row.to}</b>
          <span>{row.toSub}</span>
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
}

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
      title: "Reserved time passed",
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
      title: "Over 24 hours",
      sub: "Your default, not a legal limit",
      value: props.highlightCounts.long,
      chip: "long",
    },
    {
      id: "form",
      glyph: "wait",
      title: "Forms with a due time",
      sub: dues[0] ? `Next ${formatInstantWithDay(dues[0].formDueAt ?? now, now)} · ${dues[0].name}` : "None",
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
      <p className={styles.panelFoot}>Choose a row to see the patient here</p>
    </div>
  );
}

function when(at: Instant, now: Instant): string {
  const startOfToday = now - (now % MINUTES_PER_DAY);
  if (at >= startOfToday) return formatInstantWithDay(at, now);
  const days = Math.ceil((startOfToday - at) / MINUTES_PER_DAY);
  return days === 1 ? "Yday" : `${days}d`;
}

export type CensusDetailProps = {
  row: CensusRow;
  now: Instant;
  onClose?: () => void;
  onCopy: (row: CensusRow) => void;
  copyNote: string | null;
};

/** The selected person. Every fact is the record's own; a missing one says so. */
export function CensusDetail({ row, now, onClose, onCopy, copyNote }: CensusDetailProps) {
  const [previewNote, setPreviewNote] = useState(false);
  const quiet = row.group === "off";
  const facts: [string, string, string][] =
    row.kind === "admission" && row.group === "ward"
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
  const record =
    row.kind === "movement" ? (
      <Link className={buttonClass({ size: "sm" })} href={`/mockups/ward-flow/movements/${row.key}`}>
        Movement
      </Link>
    ) : row.kind === "referral" ? (
      <Link className={buttonClass({ size: "sm" })} href="/mockups/ward-flow/referrals">
        Referral
      </Link>
    ) : quiet ? (
      <Link className={buttonClass({ size: "sm" })} href="/mockups/ward-flow/referrals/new">
        New referral
      </Link>
    ) : null;
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
      <div className={cx(styles.statusCard, quiet && styles.statusQuiet)}>
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
        {facts.map(([term, value, sub]) => (
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
      <div className={styles.previewRow}>
        <button
          type="button"
          className={styles.previewButton}
          onClick={() => setPreviewNote(true)}
          title="Needs a watch list the app does not hold"
        >
          <Icon icon={Eye} size={14} />
          Watch this shift
        </button>
        <span className={styles.previewTag}>Preview</span>
        {previewNote ? <span className={styles.previewNote}>Needs a watch list the app does not hold</span> : null}
      </div>
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
        {record}
        {row.patientRecordId ? (
          <Link
            className={buttonClass({ variant: "pri", size: "sm" })}
            href={`/mockups/ward-flow/people/${row.patientRecordId}`}
          >
            Open patient
          </Link>
        ) : null}
      </div>
    </div>
  );
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
  onRerun: (words: string) => void;
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
            <span className={styles.truncate}>{entry.words}</span>
            <Button variant="ghost" size="sm" onClick={() => onRerun(entry.words)}>
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
          <span className={styles.truncate}>
            <b>{row.name}</b> <span className={styles.mono}>{row.umrn}</span> · {row.outcome}, {row.detail}
          </span>
          {row.patientRecordId ? (
            <Link
              className={buttonClass({ variant: "ghost", size: "sm" })}
              href={`/mockups/ward-flow/people/${row.patientRecordId}`}
            >
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
}: {
  query: string;
  onReset: () => void;
  addHref: string;
  onAdd: (event: ReactMouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <div className={styles.empty}>
      <Icon icon={SearchX} size={20} />
      <span>{query ? `No patient matches “${query}”` : "No patient matches the current search"}</span>
      <span className={styles.emptyActions}>
        <Button size="sm" onClick={onReset}>
          Clear search
        </Button>
        <Link className={buttonClass({ variant: "pri", size: "sm" })} href={addHref} onClick={onAdd}>
          <Icon icon={UserPlus} size={14} />
          Add patient
        </Link>
      </span>
    </div>
  );
}

/* ───────────────────────── phone ───────────────────────── */

export type PhoneCensusProps = {
  rows: readonly CensusRow[];
  totals: Record<CensusGroup, number>;
  matched: Record<CensusGroup, number>;
  searching: boolean;
  needle: string;
  group: CensusGroup;
  onGroup: (group: CensusGroup) => void;
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
  historyCount: number;
  empty: ReactNode;
};

/**
 * The phone's own census (390 by 844): one group at a time from a five-way control, card rows that
 * open in place with four facts and 48px actions, and the highlight chips in a bottom sheet.
 */
export function PhoneCensus(props: PhoneCensusProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { rows, searching, group, highlight } = props;
  const shown = rows.filter((row) => row.group === group);
  const active = CENSUS_HIGHLIGHTS.find((chip) => chip.id === highlight);
  return (
    <section className={styles.phone} data-testid="ward-patient-search-results-console" aria-label="Patients">
      <div className={styles.phoneGroups} role="radiogroup" aria-label="Where patients are now">
        {CENSUS_GROUPS.map((entry) => {
          const n = searching ? props.matched[entry.id] : props.totals[entry.id];
          return (
            <button
              key={entry.id}
              type="button"
              role="radio"
              aria-checked={group === entry.id && props.tab === "now"}
              className={cx(styles.phoneGroup, searching && n === 0 && styles.mapPillZero)}
              onClick={() => {
                props.onTab("now");
                props.onGroup(entry.id);
              }}
            >
              <b>{n}</b>
              <span>{entry.short}</span>
            </button>
          );
        })}
      </div>
      <div className={styles.phoneTools}>
        <button
          type="button"
          className={cx(styles.phoneTool, active && styles.phoneToolOn)}
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
        >
          {active ? <span className={styles.phoneToolDot} aria-hidden="true" /> : null}
          {active ? active.label : "Highlight"}
        </button>
        <button
          type="button"
          className={cx(styles.phoneTool, props.tab === "history" && styles.phoneToolOn)}
          onClick={() => props.onTab(props.tab === "history" ? "now" : "history")}
          aria-pressed={props.tab === "history"}
        >
          <Icon icon={History} size={14} />
          History <span className={styles.groupCount}>{props.historyCount}</span>
        </button>
      </div>
      {props.tab === "history" ? (
        props.history
      ) : shown.length === 0 ? (
        props.empty
      ) : (
        <ul className={styles.phoneList}>
          {shown.map((row) => {
            const open = props.expandedKey === row.key;
            const lit = highlight !== null && props.lifted(row);
            return (
              <li key={row.key} className={cx(styles.phoneRow, lit && styles.lifted, open && styles.phoneRowOpen)}>
                <button
                  type="button"
                  className={styles.phoneRowButton}
                  aria-expanded={open}
                  data-testid={rowTestId(row)}
                  onClick={() => props.onExpand(row)}
                >
                  <span
                    className={cx(styles.phoneAvatar, row.group === "off" && styles.avatarQuiet)}
                    aria-hidden="true"
                  >
                    {initials(row.name)}
                  </span>
                  <span className={styles.two}>
                    <b className={styles.name}>
                      <span className={styles.truncate}>
                        <Marked text={row.name} needle={props.needle} />
                      </span>
                    </b>
                    <span>
                      <span className={styles.mono}>
                        <Marked text={row.umrn} needle={props.needle} />
                      </span>{" "}
                      · {row.tier !== null ? `T${row.tier}` : ageSex(row)}
                    </span>
                  </span>
                  <span className={styles.phoneTime}>
                    {row.longWait ? <StatusGlyph tone="warning" size={9} /> : null}
                    {row.waitMinutes !== null ? row.timeText : ""}
                  </span>
                  <span className={styles.phoneLine}>
                    {row.where} · <CensusGlyphMark glyph={row.glyph} size={9} />
                    <span className={styles.truncate}>{row.next}</span>
                  </span>
                </button>
                {open ? (
                  <div className={styles.phoneMore}>
                    <dl className={styles.phoneFacts}>
                      <div>
                        <dt>Where now</dt>
                        <dd>{row.where}</dd>
                        <dd className={styles.factSub}>{row.whereSub}</dd>
                      </div>
                      <div>
                        <dt>Heading to</dt>
                        <dd>{row.to}</dd>
                        <dd className={styles.factSub}>{row.toSub}</dd>
                      </div>
                      <div>
                        <dt>Next step</dt>
                        <dd>{row.next}</dd>
                        <dd className={styles.factSub}>{row.nextWho || "Nothing open"}</dd>
                      </div>
                      <div>
                        <dt>Legal</dt>
                        <dd>{row.legal}</dd>
                        <dd className={styles.factSub}>{row.legalSub}</dd>
                      </div>
                    </dl>
                    <div className={styles.phoneActions}>
                      <Button
                        variant="sec"
                        icon={Copy}
                        iconOnly
                        aria-label="Copy summary"
                        onClick={() => props.onCopy(row)}
                      />
                      {row.kind === "movement" ? (
                        <Link
                          className={buttonClass({ className: styles.tap })}
                          href={`/mockups/ward-flow/movements/${row.key}`}
                        >
                          Movement
                        </Link>
                      ) : row.kind === "referral" ? (
                        <Link className={buttonClass({ className: styles.tap })} href="/mockups/ward-flow/referrals">
                          Referral
                        </Link>
                      ) : null}
                      {row.patientRecordId ? (
                        <Link
                          className={buttonClass({ variant: "pri", className: cx(styles.tap, styles.grow) })}
                          href={`/mockups/ward-flow/people/${row.patientRecordId}`}
                        >
                          Open patient
                        </Link>
                      ) : null}
                    </div>
                    {props.copyNote ? (
                      <span className={styles.copyNote} role="status" aria-live="polite">
                        {props.copyNote}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Highlight"
        description="Lifts and tints rows. Nothing is hidden."
        mobilePlacement="bottom"
        mobileSize="content"
        footer={
          <div className={styles.sheetFoot}>
            <Button
              variant="sec"
              className={styles.grow}
              onClick={() => props.onHighlight(null)}
              disabled={highlight === null}
            >
              Clear
            </Button>
            <Button variant="pri" className={styles.grow} onClick={() => setSheetOpen(false)}>
              Done
            </Button>
          </div>
        }
      >
        <ul className={styles.sheetList}>
          {CENSUS_HIGHLIGHTS.map((chip) => (
            <li key={chip.id}>
              <button
                type="button"
                className={styles.sheetOption}
                aria-pressed={highlight === chip.id}
                onClick={() => {
                  props.onHighlight(highlight === chip.id ? null : chip.id);
                  setSheetOpen(false);
                }}
              >
                {chip.glyph ? <CensusGlyphMark glyph={chip.glyph} /> : <span className={styles.glyphSpace} />}
                <span>{chip.label}</span>
                <span className={styles.spacer} />
                <span className={styles.groupCount}>{props.highlightCounts[chip.id]}</span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </section>
  );
}
