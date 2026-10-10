"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Copy, Download, ListOrdered, Printer, Search, X } from "lucide-react";

import {
  Button,
  Card,
  CardHead,
  Hero,
  PhoneHero,
  PhoneListRow,
  PhoneSheet,
  Segmented,
  Select,
  StatusGlyph,
  TextInput,
  cx,
  tableClasses,
} from "@/components/wf";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { wardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { calendarDateOf, formatInstant, type Instant } from "@/components/ward-management/ward-clock";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { patientDisplayName } from "@/components/ward-management/ward-patients";

import {
  chronologyCsv,
  chronologyTime,
  patientChronology,
  patientIdsWithRecords,
  type ChronologyRow,
  type ChronologySource,
} from "./patient-chronology";
import { FactGrid, HeroChip, HeroChips, reportDay, reportMoment, useIsPhone } from "./report-parts";
import styles from "./reports.module.css";

const NOT_RECORDED = "Not recorded";

type SourceTab = "all" | "records" | "audit" | "session";
type ViewRole = "coordinator" | "nurse";

const SOURCE_OF_TAB: Record<Exclude<SourceTab, "all">, ChronologySource> = {
  records: "Record",
  audit: "Audit",
  session: "Session log",
};

/** One recorded event as a line of text, for Copy row. */
function rowText(row: ChronologyRow, dayZero: Date): string {
  return [
    `Occurred ${chronologyTime(row.occurredAt, dayZero)}`,
    `Recorded ${chronologyTime(row.recordedAt, dayZero)}`,
    row.who || "Who not recorded",
    row.action,
    row.record,
    row.before || row.after ? `${row.before || NOT_RECORDED} to ${row.after || NOT_RECORDED}` : "",
    row.reason,
    row.source,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Glyph per source, so the source reads without colour words: ring, bar or cross. */
function SourceMark({ source }: { source: ChronologySource }) {
  return (
    <span className={styles.sourceMark} data-source={source} aria-hidden="true">
      {source === "Session log" ? <X size={12} strokeWidth={2.5} aria-hidden="true" /> : null}
    </span>
  );
}

/** Rows grouped by the day each happened (occurred, else recorded), in table order. */
function dayGroups(rows: readonly ChronologyRow[], dayZero: Date) {
  const groups: Array<{ key: string; label: string; rows: ChronologyRow[] }> = [];
  for (const row of rows) {
    const at = row.occurredAt ?? row.recordedAt;
    const key = at === null ? "none" : calendarDateOf(at, dayZero).toDateString();
    const label = at === null ? "No time recorded" : reportDay(at, dayZero);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.rows.push(row);
    else groups.push({ key, label, rows: [row] });
  }
  return groups;
}

const clockOrMissing = (instant: Instant | null) => (instant === null ? NOT_RECORDED : formatInstant(instant));

/**
 * PIR CHRONOLOGY (D-37, WF-57). Choose one synthetic person and read every recorded event for them
 * in time order: occurred and recorded time, role, action, before and after, and any override or
 * change reason. Prints from the browser and downloads as CSV. The audit trail is coordinator-only,
 * so it is read only when the route's role is the coordinator; any other role sees records and the
 * session log with one line saying the audit is left out. Read-only; nothing here dispatches.
 *
 * v10: the event table groups by day; a side panel rests on a summary by source and record kind
 * and opens the clicked event with Previous, Next and Copy row. This page filters rows (it is a
 * record view) and the count line always equals the rows shown. Phone is its own layout.
 */
export function PatientChronologyScreen({ initialPatientId }: { initialPatientId?: string }) {
  const { patients, movements, referrals, admissions, units, eventLog, readAuditEvents, dayZero } = useWardFlow();
  const now = useWardFlowClock();
  const baseId = useId();
  const isPhone = useIsPhone();
  const [copyNote, setCopyNote] = useState<string | null>(null);
  const copyTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    },
    [],
  );
  // The role is the route (`ward-chrome-role.ts`); nothing else holds a current role.
  const coordinator = wardChromeRole(usePathname() ?? "") === "coordinator";

  // Only people with at least one record of their own can have a chronology.
  const people = useMemo(() => {
    const withRecords = patientIdsWithRecords(patients, movements, referrals, admissions);
    return patients
      .filter((patient) => withRecords.has(patient.id))
      .sort((a, b) => a.familyName.localeCompare(b.familyName) || a.givenName.localeCompare(b.givenName));
  }, [patients, movements, referrals, admissions]);

  const [patientId, setPatientId] = useState<string>(() =>
    initialPatientId && patients.some((patient) => patient.id === initialPatientId) ? initialPatientId : "",
  );
  const [tab, setTab] = useState<SourceTab>("all");
  const [kind, setKind] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [viewRole, setViewRole] = useState<ViewRole>("coordinator");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const tableScroll = useRef<HTMLDivElement>(null);

  // Read once per world (the read returns a fresh copy each call), and only for the coordinator.
  const auditEvents = useMemo(() => {
    if (!coordinator) return null;
    const read = readAuditEvents({ role: "coordinator" });
    return read.status === "allowed" ? read.value : null;
  }, [coordinator, readAuditEvents]);
  const chronology = useMemo(
    () =>
      patientId
        ? patientChronology({
            personId: patientId,
            patients,
            movements,
            referrals,
            admissions,
            units,
            auditEvents,
            eventLog: eventLog ?? [],
            dayZero,
          })
        : null,
    [patientId, patients, movements, referrals, admissions, units, auditEvents, eventLog, dayZero],
  );

  // The ward nurse view is a narrower set of sources: the coordinator audit is left out.
  const nurseView = coordinator && viewRole === "nurse";
  const sourceRows = useMemo(
    () => (chronology ? chronology.rows.filter((row) => !(nurseView && row.source === "Audit")) : []),
    [chronology, nurseView],
  );
  const kinds = useMemo(() => [...new Set(sourceRows.map((row) => row.record))].sort(), [sourceRows]);
  const needle = query.trim().toLowerCase();
  const rows = sourceRows.filter(
    (row) =>
      (tab === "all" || row.source === SOURCE_OF_TAB[tab]) &&
      (kind === "all" || row.record === kind) &&
      (!needle || `${row.action} ${row.who} ${row.reason} ${row.before} ${row.after}`.toLowerCase().includes(needle)),
  );
  const filtered = tab !== "all" || kind !== "all" || needle !== "";
  const clearFilters = () => {
    setTab("all");
    setKind("all");
    setQuery("");
  };

  const count = (source: ChronologySource) => rows.filter((row) => row.source === source).length;
  const name = chronology?.patient ? patientDisplayName(chronology.patient) : null;
  const umrn = chronology?.patient?.umrn || "UMRN not recorded";
  const recordCount = chronology
    ? chronology.recordIds.movements.length +
      chronology.recordIds.referrals.length +
      chronology.recordIds.admissions.length
    : 0;
  const auditShown = Boolean(chronology?.auditIncluded) && !nurseView;

  const openIndex = rows.findIndex((row) => row.key === openKey);
  const open = openIndex >= 0 ? rows[openIndex] : null;

  function choosePatient(next: string) {
    setPatientId(next);
    setOpenKey(null);
    clearFilters();
  }

  function downloadCsv() {
    if (!chronology) return;
    const url = URL.createObjectURL(
      new Blob(
        [
          chronologyCsv(
            rows,
            dayZero,
            now,
            chronology.patient ? `${patientDisplayName(chronology.patient)} · ${chronology.patient.umrn}` : undefined,
          ),
        ],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "ward-flow-synthetic-chronology.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function copyRow(row: ChronologyRow) {
    const text = rowText(row, dayZero);
    const say = (message: string) => {
      setCopyNote(message);
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopyNote(null), 2600);
    };
    try {
      if (!navigator.clipboard) throw new Error("no clipboard");
      void navigator.clipboard.writeText(text).then(
        () => say("Row copied"),
        () => say("Could not copy the row"),
      );
    } catch {
      say("Could not copy the row");
    }
  }

  // Opening an event never moves the table: remember and restore its scroll position.
  function openRow(key: string) {
    const top = tableScroll.current?.scrollTop ?? 0;
    setOpenKey((current) => (current === key ? null : key));
    window.requestAnimationFrame?.(() => {
      if (tableScroll.current) tableScroll.current.scrollTop = top;
    });
  }

  const generated = (
    <span data-testid="ward-chronology-generated">
      Generated {reportMoment(now, dayZero)} · Synthetic demo data, not a clinical record
    </span>
  );

  const patientPicker = (
    <Select
      aria-label="Patient"
      value={patientId}
      onChange={(event) => choosePatient(event.target.value)}
      data-testid="ward-chronology-patient"
      boxClassName={styles.patientPick}
    >
      <option value="">Choose a patient</option>
      {people.map((patient) => (
        <option key={patient.id} value={patient.id}>
          {patientDisplayName(patient)} · {patient.umrn || "UMRN not recorded"}
        </option>
      ))}
    </Select>
  );

  const sourceTabs = (size: "sm" | "md") => (
    <Segmented<SourceTab>
      size={size}
      className={size === "md" ? styles.phoneSeg : undefined}
      label="Source"
      value={tab}
      onChange={(next) => {
        setTab(next);
        setOpenKey(null);
      }}
      items={[
        { id: "all", label: "All" },
        { id: "records", label: "Records" },
        ...(auditShown ? [{ id: "audit" as const, label: "Audit" }] : []),
        { id: "session", label: "Session" },
      ]}
    />
  );

  const withheld = !coordinator ? (
    <p className={styles.cardNote} data-testid="ward-chronology-audit-withheld">
      Coordinator audit not shown for this role
    </p>
  ) : nurseView ? (
    <p className={styles.cardNote} data-testid="ward-chronology-nurse-view">
      Ward nurse view: records and session log only. The coordinator audit is left out.
    </p>
  ) : null;

  const emptyState = !chronology ? null : sourceRows.length === 0 ? (
    <p className={styles.cardNote}>No events yet. Nothing has been recorded for this person in this session.</p>
  ) : rows.length === 0 ? (
    <div className={styles.noMatch}>
      <p className={styles.cardNote}>No event matches these filters.</p>
      <Button size="sm" variant="ghost" onClick={clearFilters}>
        Clear filters
      </Button>
    </div>
  ) : null;

  const detailFacts = (row: ChronologyRow) => [
    { id: "occurred", label: "Occurred", value: chronologyTime(row.occurredAt, dayZero) },
    { id: "recorded", label: "Recorded", value: chronologyTime(row.recordedAt, dayZero) },
    { id: "who", label: "Who", value: row.who || NOT_RECORDED },
    { id: "source", label: "Source", value: row.source },
  ];

  /* ---------------------------------------------------------------- phone */
  if (isPhone) {
    return (
      <div className={cx(styles.page, styles.phonePage)} data-testid="ward-patient-chronology" data-ward-design="v10">
        <main id="main-content" className={styles.main}>
          <PhoneHero
            level={1}
            title={name ?? "Patient chronology"}
            sub={chronology ? umrn : "Choose a patient to read their events"}
            figures={
              chronology
                ? [
                    { id: "events", value: rows.length, label: "Events" },
                    { id: "records", value: recordCount, label: "Records" },
                    { id: "audit", value: count("Audit"), label: "Audit" },
                  ]
                : undefined
            }
          />
          {patientPicker}
          <p className={styles.phoneNote}>{generated}</p>
          {chronology ? (
            <>
              {sourceTabs("md")}
              {withheld}
              {emptyState}
              {dayGroups(rows, dayZero).map((group) => (
                <section key={group.key} className={styles.phoneGroup} aria-label={group.label}>
                  <h2 className={styles.dayHead}>
                    {group.label}
                    <span>
                      {group.rows.length} {group.rows.length === 1 ? "event" : "events"}
                    </span>
                  </h2>
                  <ul className={styles.phoneList}>
                    {group.rows.map((row) => (
                      <PhoneListRow
                        key={row.key}
                        as="li"
                        leading={<SourceMark source={row.source} />}
                        name={row.action}
                        meta={`${row.record} · ${row.who || "Who not recorded"}`}
                        value={clockOrMissing(row.occurredAt)}
                        onSelect={() => setOpenKey(row.key)}
                      />
                    ))}
                  </ul>
                </section>
              ))}
              <div className={styles.phoneActionBar}>
                <Button variant="pri" icon={Download} onClick={downloadCsv} data-testid="ward-chronology-csv">
                  Download CSV
                </Button>
                <Button variant="sec" icon={Printer} onClick={() => window.print()} data-testid="ward-chronology-print">
                  Print
                </Button>
              </div>
            </>
          ) : (
            <p className={styles.phoneNote}>No patient chosen. Choose one above.</p>
          )}
          <PhoneSheet open={open !== null} onClose={() => setOpenKey(null)} title={open?.action ?? ""}>
            {open ? (
              <div className={styles.sheetBody}>
                <FactGrid facts={detailFacts(open)} />
                <EventChange row={open} />
                <Button size="sm" variant="sec" icon={Copy} onClick={() => copyRow(open)}>
                  Copy row
                </Button>
                <p className={styles.copyNote} role="status">
                  {copyNote}
                </p>
              </div>
            ) : null}
          </PhoneSheet>
          <WardPrototypeFooter testId="ward-chronology-footer" note="Synthetic data" />
        </main>
      </div>
    );
  }

  /* -------------------------------------------------------------- desktop */
  return (
    <div className={styles.page} data-testid="ward-patient-chronology" data-ward-design="v10">
      <main id="main-content" className={styles.main}>
        <Hero
          level={1}
          eyebrow="Reports · PIR chronology"
          title={name ?? "Patient chronology"}
          titleMeta={chronology ? <span className={styles.umrn}>{umrn}</span> : undefined}
          aside={
            chronology ? (
              <span className={styles.heroActions} data-print-hide>
                <Button
                  variant="onHero"
                  icon={Printer}
                  onClick={() => window.print()}
                  data-testid="ward-chronology-print"
                >
                  Print
                </Button>
                <Button variant="light" icon={Download} onClick={downloadCsv} data-testid="ward-chronology-csv">
                  Download CSV
                </Button>
              </span>
            ) : undefined
          }
          bar={
            chronology ? (
              <HeroChips label="Counts of the events shown">
                <HeroChip value={rows.length} label="events" />
                <HeroChip value={recordCount} label="records" />
                <HeroChip value={count("Record")} label="from records" />
                {auditShown ? <HeroChip value={count("Audit")} label="audit" /> : null}
                <HeroChip value={count("Session log")} label="session log" />
              </HeroChips>
            ) : (
              <span className={styles.heroLine}>{generated}</span>
            )
          }
          barAside={chronology ? <span className={styles.heroLine}>{generated}</span> : undefined}
        />

        <div className={styles.filterBar} data-print-hide>
          <span className={styles.patientField}>
            <span className={styles.fieldWord}>Patient</span>
            {patientPicker}
          </span>
          {chronology ? (
            <>
              <TextInput
                type="search"
                icon={Search}
                boxClassName={styles.findBox}
                aria-label="Find an action, person or reason"
                placeholder="Find an action, person or reason"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {sourceTabs("sm")}
              <Select
                aria-label="Record kind"
                value={kind}
                onChange={(event) => setKind(event.target.value)}
                boxClassName={styles.kindPick}
              >
                <option value="all">Every record kind</option>
                {kinds.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry} only
                  </option>
                ))}
              </Select>
              {coordinator ? (
                <Segmented<ViewRole>
                  className={styles.roleSwitch}
                  label="View as"
                  value={viewRole}
                  onChange={(next) => {
                    setViewRole(next);
                    if (next === "nurse" && tab === "audit") setTab("all");
                    setOpenKey(null);
                  }}
                  items={[
                    { id: "coordinator", label: "Bed coordinator" },
                    { id: "nurse", label: "Ward nurse" },
                  ]}
                />
              ) : null}
            </>
          ) : null}
        </div>

        {chronology ? (
          <div className={styles.chronoSplit}>
            <Card aria-labelledby={`${baseId}-events`} className={styles.chronoCard}>
              <CardHead
                id={`${baseId}-events`}
                icon={ListOrdered}
                title={
                  <>
                    Every recorded event <span className={styles.countPill}>{rows.length}</span>
                  </>
                }
                aside={
                  <span className={styles.headMeta} data-testid="ward-chronology-count">
                    {filtered
                      ? `${rows.length} of ${sourceRows.length} shown`
                      : auditShown
                        ? "Records, audit trail and session log"
                        : "Records and session log"}
                  </span>
                }
              />
              {withheld}
              {emptyState ?? (
                <div
                  className={styles.chronoScroll}
                  ref={tableScroll}
                  tabIndex={0}
                  role="region"
                  aria-label="Chronology table"
                >
                  <table
                    className={`${tableClasses.table} ${styles.table} ${styles.chronoTable}`}
                    data-testid="ward-chronology-table"
                  >
                    <caption className={styles.srOnly}>
                      Chronology for {name ?? "the chosen patient"}, synthetic
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Occurred</th>
                        <th scope="col">Recorded</th>
                        <th scope="col">Action and change</th>
                        <th scope="col">Record and who</th>
                        <th scope="col">Source</th>
                      </tr>
                    </thead>
                    {dayGroups(rows, dayZero).map((group) => (
                      <tbody key={group.key}>
                        <tr className={styles.dayRow}>
                          <th scope="rowgroup" colSpan={5}>
                            <span className={styles.dayRowInner}>
                              {group.label}
                              <span>
                                {group.rows.length} {group.rows.length === 1 ? "event" : "events"}
                              </span>
                            </span>
                          </th>
                        </tr>
                        {group.rows.map((row) => {
                          const selected = row.key === openKey;
                          return (
                            <tr
                              key={row.key}
                              className={cx(styles.eventRow, selected && styles.eventSelected)}
                              aria-selected={selected}
                            >
                              <td className={styles.time}>{clockOrMissing(row.occurredAt)}</td>
                              <td className={styles.time}>{clockOrMissing(row.recordedAt)}</td>
                              <th scope="row">
                                <button
                                  type="button"
                                  className={styles.eventButton}
                                  aria-expanded={selected}
                                  aria-controls={`${baseId}-panel`}
                                  onClick={() => openRow(row.key)}
                                >
                                  {row.action}
                                </button>
                                <EventChange row={row} />
                              </th>
                              <td>
                                <span className={styles.cellMain}>{row.record}</span>
                                <span className={styles.cellSub}>{row.who || "Who not recorded"}</span>
                              </td>
                              <td>
                                <span className={styles.sourceCell}>
                                  <SourceMark source={row.source} />
                                  {row.source}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    ))}
                  </table>
                </div>
              )}
            </Card>

            <aside
              className={styles.chronoSide}
              id={`${baseId}-panel`}
              aria-label={open ? "Event" : "Summary"}
              data-wf-rail=""
            >
              {open ? (
                <Card aria-labelledby={`${baseId}-event-title`}>
                  <CardHead
                    id={`${baseId}-event-title`}
                    title={open.action}
                    aside={
                      <Button
                        size="sm"
                        variant="ghost"
                        iconOnly
                        icon={X}
                        aria-label="Close event"
                        onClick={() => setOpenKey(null)}
                      />
                    }
                  />
                  <div className={styles.sideBody}>
                    <FactGrid facts={detailFacts(open)} />
                    <dl className={styles.sideList}>
                      <div>
                        <dt>Record</dt>
                        <dd>{open.record}</dd>
                      </div>
                      <div>
                        <dt>Before</dt>
                        <dd>{open.before || NOT_RECORDED}</dd>
                      </div>
                      <div>
                        <dt>After</dt>
                        <dd>{open.after || NOT_RECORDED}</dd>
                      </div>
                      <div>
                        <dt>Reason</dt>
                        <dd>{open.reason || NOT_RECORDED}</dd>
                      </div>
                    </dl>
                    <div className={styles.sideActions}>
                      <Button
                        size="sm"
                        variant="sec"
                        icon={ChevronLeft}
                        disabled={openIndex <= 0}
                        onClick={() => openIndex > 0 && setOpenKey(rows[openIndex - 1].key)}
                      >
                        Previous
                      </Button>
                      <Button
                        size="sm"
                        variant="sec"
                        icon={ChevronRight}
                        disabled={openIndex >= rows.length - 1}
                        onClick={() => openIndex < rows.length - 1 && setOpenKey(rows[openIndex + 1].key)}
                      >
                        Next
                      </Button>
                      <Button size="sm" variant="ghost" icon={Copy} onClick={() => copyRow(open)}>
                        Copy row
                      </Button>
                    </div>
                    <p className={styles.copyNote} role="status">
                      {copyNote}
                    </p>
                  </div>
                </Card>
              ) : (
                <Card aria-labelledby={`${baseId}-summary-title`}>
                  <CardHead
                    id={`${baseId}-summary-title`}
                    title="Summary"
                    aside={<span className={styles.umrnQuiet}>{umrn}</span>}
                  />
                  <div className={styles.sideBody}>
                    <FactGrid
                      facts={[
                        { id: "events", label: "Events", value: String(rows.length) },
                        { id: "records", label: "Records", value: String(recordCount) },
                      ]}
                    />
                    <dl className={styles.sideList}>
                      <div>
                        <dt>First</dt>
                        <dd className={styles.time}>{firstLast(rows, dayZero, "first")}</dd>
                      </div>
                      <div>
                        <dt>Latest</dt>
                        <dd className={styles.time}>{firstLast(rows, dayZero, "last")}</dd>
                      </div>
                      <div>
                        <dt>No occurred time</dt>
                        <dd>{rows.filter((row) => row.occurredAt === null).length} show Not recorded</dd>
                      </div>
                    </dl>
                    <h3 className={styles.sideHead}>By source</h3>
                    <ul className={styles.tally}>
                      {(["Record", "Audit", "Session log"] as const)
                        .filter((source) => source !== "Audit" || auditShown)
                        .map((source) => (
                          <li key={source}>
                            <SourceMark source={source} />
                            <span>{source}</span>
                            <b>{count(source)}</b>
                          </li>
                        ))}
                    </ul>
                    <h3 className={styles.sideHead}>By record kind</h3>
                    <ul className={styles.tally}>
                      {kinds.map((entry) => (
                        <li key={entry}>
                          <StatusGlyph tone="neutral" size={7} />
                          <span>{entry}</span>
                          <b>{rows.filter((row) => row.record === entry).length}</b>
                        </li>
                      ))}
                    </ul>
                    <p className={styles.cardNote}>Select an event to open it here.</p>
                  </div>
                </Card>
              )}
            </aside>
          </div>
        ) : (
          <Card aria-labelledby={`${baseId}-none`}>
            <CardHead id={`${baseId}-none`} icon={ListOrdered} title="No patient chosen" />
            <p className={styles.cardNote}>Choose a patient above to read every recorded event for them, in order.</p>
          </Card>
        )}

        <p className={styles.disclosure}>
          Recorded or typed times only, nothing calculated. Audit trail and session log cover this browser session.
        </p>
        <WardPrototypeFooter testId="ward-chronology-footer" note="Synthetic data" />
      </main>
    </div>
  );
}

/** Before and after with the reason, as one quiet line under the action. */
function EventChange({ row }: { row: ChronologyRow }) {
  const change = row.before || row.after ? `${row.before || NOT_RECORDED} → ${row.after || NOT_RECORDED}` : "";
  const line = [change, row.reason].filter(Boolean).join(" · ");
  if (!line) return null;
  return (
    <span className={styles.cellSub} title={line}>
      {line}
    </span>
  );
}

function firstLast(rows: readonly ChronologyRow[], dayZero: Date, which: "first" | "last"): string {
  const times = rows
    .map((row) => row.occurredAt ?? row.recordedAt)
    .filter((at): at is Instant => at !== null)
    .sort((a, b) => a - b);
  const at = which === "first" ? times[0] : times[times.length - 1];
  return at === undefined ? NOT_RECORDED : reportMoment(at, dayZero);
}
