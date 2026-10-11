"use client";

import { useId, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ListOrdered,
  MoreHorizontal,
  Printer,
  Search,
  X,
} from "lucide-react";

import {
  Button,
  Card,
  CardHead,
  Drawer,
  FactGrid,
  Hero,
  HeroChip,
  HeroChips,
  PhoneHero,
  PhoneListRow,
  PhoneSheet,
  PillTabs,
  Segmented,
  Select,
  StatusGlyph,
  TextInput,
  cx,
  tableClasses,
  useIsPhone,
  useOptionalToast,
  useIsTabletPortrait,
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
import { reportDay, reportMoment } from "./report-parts";
import phone from "./patient-chronology-phone.module.css";
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
/** The phone row's second line: what changed, else the kind of record it belongs to. */
function rowDetail(row: ChronologyRow): string {
  if (row.before && row.after) return `${row.before} → ${row.after}`;
  return row.after || row.before || row.record;
}

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
  const toast = useOptionalToast();
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
  // Phone only: the sheet that holds record kind and the role view, one tap from the list.
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Phone only: the patient name in the hero opens this list of people to choose from.
  const [pickerOpen, setPickerOpen] = useState(false);
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
  const portraitTablet = useIsTabletPortrait();
  // The side panel opens the event, except on a portrait tablet, where a drawer does.
  const sideEvent = portraitTablet ? null : open;

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
    // The shared wf toast (polite live region) confirms the copy; words stay neutral.
    const copied = () => toast?.push({ tone: "success", title: "Row copied", duration: 2600 });
    const failed = () => toast?.push({ tone: "warning", title: "Could not copy the row", duration: 4000 });
    try {
      if (!navigator.clipboard) throw new Error("no clipboard");
      void navigator.clipboard.writeText(text).then(copied, failed);
    } catch {
      failed();
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
    const kindSummary = `${kind === "all" ? "Every record kind" : `${kind} only`}${
      coordinator ? ` · ${nurseView ? "Ward nurse" : "Bed coordinator"}` : ""
    }`;
    return (
      <div className={cx(styles.page, styles.phonePage)} data-testid="ward-patient-chronology" data-ward-design="v10">
        <main id="main-content" className={styles.main}>
          <PhoneHero
            level={1}
            eyebrow={
              <span data-testid="ward-chronology-generated">
                PIR chronology · generated {formatInstant(now)}
                <span className={phone.srOnly}> · Synthetic demo data</span>
              </span>
            }
            title={
              <button
                type="button"
                className={phone.who}
                aria-haspopup="dialog"
                aria-label={name ? `${name}, change patient` : "Choose a patient"}
                onClick={() => setPickerOpen(true)}
                data-testid="ward-chronology-phone-who"
              >
                <span className={phone.whoName}>{name ?? "Choose a patient"}</span>
                <ChevronDown size={18} aria-hidden="true" />
              </button>
            }
            sub={
              chronology ? (
                <>
                  <b className={phone.mono}>{umrn}</b> · synthetic demo data, not a clinical record
                </>
              ) : (
                "Synthetic demo data · choose a patient to read their events"
              )
            }
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
          {chronology ? (
            <>
              <div className={phone.seg}>
                <PillTabs<SourceTab>
                  label="Source"
                  value={tab}
                  onChange={(next) => {
                    setTab(next);
                    setOpenKey(null);
                  }}
                  fill
                  items={[
                    { id: "all", label: "All" },
                    { id: "records", label: "Records" },
                    ...(auditShown ? [{ id: "audit" as const, label: "Audit" }] : []),
                    { id: "session", label: "Session" },
                  ]}
                />
              </div>
              {withheld}
              {emptyState}
              {rows.length ? (
                <div className={phone.list}>
                  {dayGroups(rows, dayZero).map((group) => (
                    <section key={group.key} aria-label={group.label}>
                      <h2 className={phone.dayHead}>
                        <span>{group.label}</span>
                        <b>
                          {group.rows.length}
                          <span className={phone.srOnly}> {group.rows.length === 1 ? "event" : "events"}</span>
                        </b>
                      </h2>
                      <ul className={phone.rows}>
                        {group.rows.map((row) => (
                          <li key={row.key}>
                            <button type="button" className={phone.row} onClick={() => setOpenKey(row.key)}>
                              <span className={phone.time}>
                                {row.occurredAt === null ? (
                                  <span className={phone.noTime}>No time</span>
                                ) : (
                                  formatInstant(row.occurredAt)
                                )}
                              </span>
                              <span className={phone.text}>
                                <span className={phone.action}>{row.action}</span>
                                <span className={phone.meta}>{rowDetail(row)}</span>
                              </span>
                              <SourceMark source={row.source} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              ) : null}
              <p className={phone.foot}>Synthetic prototype · invented person · not a clinical record</p>
              <div className={phone.bar}>
                <span data-testid="ward-chronology-phone-filters" className={phone.more}>
                  <button
                    type="button"
                    className={phone.moreButton}
                    aria-haspopup="dialog"
                    onClick={() => setFiltersOpen(true)}
                  >
                    <MoreHorizontal size={20} aria-hidden="true" />
                    <span className={phone.srOnly}>Record kind, view and print: {kindSummary}</span>
                  </button>
                </span>
                <Button
                  variant="pri"
                  icon={Download}
                  className={phone.barPrimary}
                  onClick={downloadCsv}
                  data-testid="ward-chronology-csv"
                >
                  Download CSV
                </Button>
              </div>
            </>
          ) : (
            <div className={phone.choose}>
              <p>No patient chosen.</p>
              <Button variant="pri" className={phone.barPrimary} onClick={() => setPickerOpen(true)}>
                Choose a patient
              </Button>
            </div>
          )}
          <PhoneSheet
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            title="Choose a patient"
            description="People with at least one record of their own"
            height="tall"
            data-testid="ward-chronology-phone-picker"
          >
            <ul className={styles.phoneList} aria-label="Patients">
              {people.map((patient) => (
                <PhoneListRow
                  key={patient.id}
                  as="li"
                  leading={
                    patient.id === patientId ? <Check size={16} aria-hidden="true" /> : <span aria-hidden="true" />
                  }
                  name={patientDisplayName(patient)}
                  aria-label={`${patientDisplayName(patient)}${patient.id === patientId ? ", chosen" : ""}`}
                  value={<span className={phone.mono}>{patient.umrn || "UMRN not recorded"}</span>}
                  onSelect={() => {
                    choosePatient(patient.id);
                    setPickerOpen(false);
                  }}
                />
              ))}
            </ul>
          </PhoneSheet>
          <PhoneSheet
            open={filtersOpen}
            onClose={() => setFiltersOpen(false)}
            title="Record kind and view"
            description="Filters the events listed; the counts are of this source"
            primary={{ label: "Done", onAction: () => setFiltersOpen(false) }}
            data-testid="ward-chronology-phone-filter-sheet"
          >
            <div className={styles.sheetBody}>
              <ul className={styles.phoneList} aria-label="Record kind">
                {[
                  { id: "all", label: "Every record kind" },
                  ...kinds.map((entry) => ({ id: entry, label: `${entry} only` })),
                ].map((entry) => (
                  <PhoneListRow
                    key={entry.id}
                    as="li"
                    leading={kind === entry.id ? <Check size={16} aria-hidden="true" /> : <span aria-hidden="true" />}
                    name={entry.label}
                    aria-label={`${entry.label}${kind === entry.id ? ", chosen" : ""}`}
                    value={
                      entry.id === "all"
                        ? sourceRows.filter((row) => tab === "all" || row.source === SOURCE_OF_TAB[tab]).length
                        : sourceRows.filter(
                            (row) => row.record === entry.id && (tab === "all" || row.source === SOURCE_OF_TAB[tab]),
                          ).length
                    }
                    onSelect={() => {
                      setKind(entry.id);
                      setOpenKey(null);
                    }}
                  />
                ))}
              </ul>
              {coordinator ? (
                <Segmented<ViewRole>
                  size="md"
                  className={styles.phoneSeg}
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
              <Button variant="sec" icon={Printer} onClick={() => window.print()} data-testid="ward-chronology-print">
                Print
              </Button>
            </div>
          </PhoneSheet>
          <PhoneSheet
            open={open !== null}
            onClose={() => setOpenKey(null)}
            title={open?.action ?? ""}
            description={open ? `${open.record} · ${open.source}` : undefined}
            primary={open ? { label: "Copy row", onAction: () => copyRow(open) } : undefined}
          >
            {open ? (
              <div className={styles.sheetBody}>
                <FactGrid facts={detailFacts(open)} />
                <EventChange row={open} />
              </div>
            ) : null}
          </PhoneSheet>
          <WardPrototypeFooter testId="ward-chronology-footer" note="Synthetic data" />
        </main>
      </div>
    );
  }

  /* The open event: times, who, before and after, reason, then Previous, Next and Copy row. Shown
     in the sticky side panel, or in a drawer from the right on a portrait tablet. */
  const eventBody = (row: ChronologyRow) => (
    <div className={styles.sideBody}>
      <FactGrid facts={detailFacts(row)} />
      <dl className={styles.sideList}>
        <div>
          <dt>Record</dt>
          <dd>{row.record}</dd>
        </div>
        <div>
          <dt>Before</dt>
          <dd>{row.before || NOT_RECORDED}</dd>
        </div>
        <div>
          <dt>After</dt>
          <dd>{row.after || NOT_RECORDED}</dd>
        </div>
        <div>
          <dt>Reason</dt>
          <dd>{row.reason || NOT_RECORDED}</dd>
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
        <Button size="sm" variant="ghost" icon={Copy} onClick={() => copyRow(row)}>
          Copy row
        </Button>
      </div>
    </div>
  );

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
                <HeroChip value={rows.length} label={rows.length === 1 ? "event" : "events"} />
                <HeroChip value={recordCount} label={recordCount === 1 ? "record" : "records"} />
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
              aria-label={sideEvent ? "Event" : "Summary"}
              data-wf-rail=""
            >
              {sideEvent ? (
                <Card aria-labelledby={`${baseId}-event-title`}>
                  <CardHead
                    id={`${baseId}-event-title`}
                    title={sideEvent.action}
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
                  {eventBody(sideEvent)}
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
            {/* Portrait tablet: the summary stays under the table and a clicked event slides over
                from the right, so every column of the table stays readable. */}
            <Drawer
              open={portraitTablet && open !== null}
              onClose={() => setOpenKey(null)}
              title={open?.action ?? "Event"}
              data-testid="ward-chronology-event-drawer"
            >
              {open ? eventBody(open) : null}
            </Drawer>
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
