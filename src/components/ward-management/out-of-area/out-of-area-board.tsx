"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Copy, Download, Map as MapIcon, Printer, Route, Search, X } from "lucide-react";

import {
  Button,
  Card,
  CardFoot,
  EmptyState,
  Hero,
  LiveChip,
  Segmented,
  SrOnly,
  StatusGlyph,
  Tabs,
  TextInput,
  cx,
  tableClasses,
  type WfTone,
} from "@/components/wf";
import { daysInBed, type Admission } from "@/components/ward-management/ward-admissions";
import { formatInstant, formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { TRAVEL_BAND_LABELS } from "@/components/ward-management/ward-distance";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import type { RepatriationRecord } from "@/components/ward-management/ward-flow-reducer";
import { resolveSubjectPatient, type ResolvedPatientInfo } from "@/components/ward-management/ward-patient-resolver";
import { outOfAreaLedger, type OutOfAreaEntry } from "@/components/ward-management/ward-referrals";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";
import { csvCell } from "@/components/ward-management/statistics/statistics-csv";
import { dateOf } from "@/components/ward-management/statistics/statistics-dates";

import {
  BLANK_REPAT_DRAFT,
  DAYS_AWAY_GROUPS,
  RETURN_STATUS_SHORT,
  TRAVEL_SHORT,
  closerBedOptions,
  daysAway,
  dischargeOffsetDays,
  dischargeShort,
  dischargeText,
  homeRegionBeds,
  inDaysAwayGroup,
  instantFromEstimatedTimeInputs,
  departureDayLabel,
  leavesToday,
  missingAnswers,
  returnStatus,
  shiftLabel,
  shortSiteName,
  currentShiftStart,
  type DaysAwayGroupId,
  type RepatDraft,
  type ReturnStatus,
} from "./out-of-area-model";
import { OutOfAreaPhone, type PhonePerson } from "./out-of-area-phone";
import { ReturnPlan, TravelIcon, whoseMove, type PlanPatient } from "./out-of-area-return-plan";
import { HomeBedsCard, ReadyCard, ShiftCard, type ReadyRow, type ShiftReturnRow } from "./out-of-area-side";
import styles from "./out-of-area-board.module.css";

/**
 * Phase 8, Task 5 (spec D8-3): the out-of-area ledger — how many people are currently in a bed a
 * long way from where they live, and for how long. Rebuilt as option A, 9 October 2026.
 *
 * **It calls `outOfAreaLedger` and recomputes nothing.** Neither number is derived here, and the
 * register defaults to the order the ledger returns. Sorting by days away or by name is an
 * explicit view choice the coordinator makes; the default never ranks anybody, because a sort by
 * elapsed time would read as a repatriation priority nobody has decided.
 *
 * **In whole days, via `daysInBed`.** Counted from `arrivedAt`, floored at zero, and `null` rather
 * than a substituted fallback when there is no arrival. The length of stay carries no target and no
 * countdown. The discharge column is a different fact: the date the WARD recorded
 * (`expectedDischargeAt`) and the ward's own delay reason (`blockReason`), shown as they are.
 *
 * **The admissions come from the provider.** The optional `admissions` parameter survives so a
 * test can render the states the seed cannot produce (nobody away, or only an unclassified count);
 * omitting it, which is what the route does, reads live state on the same clock as `now`.
 *
 * **Highlights, never hides.** The hero counts, the days away strip, the home region rows and the
 * search all mark matching rows; every person stays in the register.
 *
 * **Return status** reads the coordinator's recorded `RECORD_REPATRIATION` first, then the page's own
 * unsaved draft. Drafts live in React state only and are never written to browser storage.
 */

const PHONE_QUERY = "(max-width: 48rem)";

/** Phone is its own layout, not a reflow: the screen renders a different tree under 48rem. */
function useIsPhone(): boolean {
  return useSyncExternalStore(
    (notify) => {
      if (typeof window.matchMedia !== "function") return () => undefined;
      const query = window.matchMedia(PHONE_QUERY);
      query.addEventListener?.("change", notify);
      return () => query.removeEventListener?.("change", notify);
    },
    () => typeof window.matchMedia === "function" && window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}

function getPatientProfileHref(info: ResolvedPatientInfo): string | null {
  if (info.patient?.id) {
    return `/mockups/ward-flow/people/${encodeURIComponent(info.patient.id)}`;
  }
  if (info.umrn && info.umrn !== "UMRN not recorded") {
    return `/mockups/ward-flow/search?q=${encodeURIComponent(info.umrn)}`;
  }
  return null;
}

type SortOrder = "ledger" | "days" | "patient";
type HighlightKey = "due" | "air" | "road" | "noplan" | "notagreed" | "bed" | `age:${DaysAwayGroupId}`;

const STATUS_TONE: Record<ReturnStatus, WfTone> = {
  none: "closed",
  started: "neutral",
  not_agreed: "neutral",
  agreed: "neutral",
};

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName);
}

export function OutOfAreaBoard({ admissions }: { admissions?: Admission[] }) {
  const {
    units,
    admissions: liveAdmissions,
    patients,
    referrals,
    movements,
    dispatch,
    dayZero,
    repatriations: liveRepatriations,
  } = useWardFlow();
  const now = useWardFlowClock();
  const isPhone = useIsPhone();
  const repatriations: RepatriationRecord[] = liveRepatriations ?? [];

  const { entries, notBanded } = outOfAreaLedger(admissions ?? liveAdmissions, units, now);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, RepatDraft>>({});
  const [repatNotice, setRepatNotice] = useState<string | null>(null);
  const [toolNote, setToolNote] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<HighlightKey | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("ledger");
  const [tab, setTab] = useState<"now" | "history">("now");

  const selectionOriginRef = useRef<HTMLElement | null>(null);
  const detailColumnRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const people = new Map<string, ResolvedPatientInfo>(
    entries.map((entry) => [
      entry.admission.id,
      resolveSubjectPatient(entry.admission, { patients, referrals, movements }),
    ]),
  );
  const patientOf = (entry: OutOfAreaEntry): ResolvedPatientInfo =>
    people.get(entry.admission.id) ?? resolveSubjectPatient(entry.admission, { patients, referrals, movements });
  const recordOf = (id: string) => repatriations.find((record) => record.admissionId === id);
  const statusOf = (entry: OutOfAreaEntry) =>
    returnStatus(recordOf(entry.admission.id), drafts[entry.admission.id], now);
  const offsetOf = (entry: OutOfAreaEntry) => dischargeOffsetDays(entry, now);
  const returnMovementOf = (id: string) => movements.find((movement) => movement.sourceAdmissionId === id)?.id;

  const sorted = [...entries];
  if (sortOrder === "days") sorted.sort((a, b) => daysAway(b, now) - daysAway(a, now));
  if (sortOrder === "patient") {
    sorted.sort((a, b) => patientOf(a).displayName.localeCompare(patientOf(b).displayName, "en-AU"));
  }

  const selected = selectedId ? entries.find((entry) => entry.admission.id === selectedId) : undefined;
  const selectedIndex = sorted.findIndex((entry) => entry.admission.id === selectedId);

  /* ---- highlight ---- */
  const matchesHighlight = (entry: OutOfAreaEntry, key: HighlightKey | null): boolean => {
    if (!key) return false;
    const offset = offsetOf(entry);
    const status = statusOf(entry);
    if (key === "due") return offset !== null && offset < 0;
    if (key === "air") return entry.band === "air_transport_only";
    if (key === "road") return entry.band === "three_hours_or_more";
    if (key === "noplan") return status === "none";
    if (key === "notagreed") return status === "not_agreed";
    if (key === "bed") return status === "agreed";
    return inDaysAwayGroup(entry, now, key.slice(4) as DaysAwayGroupId);
  };
  const query = searchQuery.trim().toLowerCase();
  const matchesQuery = (entry: OutOfAreaEntry): boolean => {
    if (!query) return false;
    const info = patientOf(entry);
    const site = siteByCode(entry.unit.siteCode);
    return [
      info.displayName,
      info.formalName,
      info.umrn,
      entry.admission.homeRegion ?? "",
      entry.unit.name,
      site?.name ?? "",
      site?.service ?? "",
    ].some((value) => value.toLowerCase().includes(query));
  };
  const anyHighlight = highlight !== null || region !== null || query.length > 0;
  const isHighlighted = (entry: OutOfAreaEntry) =>
    matchesHighlight(entry, highlight) ||
    (region !== null && entry.admission.homeRegion === region) ||
    matchesQuery(entry);
  const highlightedCount = sorted.filter(isHighlighted).length;
  const clearHighlights = () => {
    setHighlight(null);
    setRegion(null);
    setSearchQuery("");
  };
  const toggleHighlight = (key: HighlightKey) => setHighlight((current) => (current === key ? null : key));
  const toggleRegion = (next: string) => setRegion((current) => (current === next ? null : next));

  /* ---- counts ---- */
  const countOf = (key: HighlightKey) => entries.filter((entry) => matchesHighlight(entry, key)).length;
  const bedDays = entries.reduce((sum, entry) => sum + daysAway(entry, now), 0);
  const longest = entries.reduce((max, entry) => Math.max(max, daysAway(entry, now)), 0);

  const readyEntries = entries
    .filter((entry) => {
      const offset = offsetOf(entry);
      return offset !== null && offset < 0;
    })
    .sort((a, b) => (offsetOf(a) ?? 0) - (offsetOf(b) ?? 0));
  const nextUp =
    readyEntries.find((entry) => statusOf(entry) === "none") ?? sorted.find((entry) => statusOf(entry) === "none");

  /* ---- selection ---- */
  const selectPlacement = (id: string, origin?: HTMLElement) => {
    if (origin) selectionOriginRef.current = origin;
    setSelectedId(id);
  };
  const returnToOverview = () => {
    setSelectedId(null);
    selectionOriginRef.current?.focus();
  };
  const step = (delta: number) => {
    const next = sorted[selectedIndex + delta];
    if (next) setSelectedId(next.admission.id);
  };

  useEffect(() => {
    if (selectedId === null || isPhone) return;
    if (typeof window.matchMedia !== "function" || !window.matchMedia("(max-width: 1000px)").matches) return;
    window.requestAnimationFrame(() => {
      detailColumnRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [selectedId, isPhone]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && selectedId !== null) {
        setSelectedId(null);
        selectionOriginRef.current?.focus();
        return;
      }
      if (isPhone || isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (event.key === "j" || event.key === "k") {
        const index = sorted.findIndex((entry) => entry.admission.id === selectedId);
        const next = sorted[index < 0 ? 0 : index + (event.key === "j" ? 1 : -1)];
        if (next) setSelectedId(next.admission.id);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  useEffect(() => {
    if (!repatNotice) return;
    const timer = setTimeout(() => setRepatNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [repatNotice]);

  useEffect(() => {
    if (!toolNote) return;
    const timer = setTimeout(() => setToolNote(null), 4000);
    return () => clearTimeout(timer);
  }, [toolNote]);

  /* ---- the return plan ---- */
  const draftFor = (id: string) => drafts[id] ?? BLANK_REPAT_DRAFT;
  const updateDraft = (id: string, update: Partial<RepatDraft>) =>
    setDrafts((current) => ({ ...current, [id]: { ...(current[id] ?? BLANK_REPAT_DRAFT), ...update } }));

  function recordReturn(entry: OutOfAreaEntry) {
    const admissionId = entry.admission.id;
    const draft = draftFor(admissionId);
    if (missingAnswers(draft, now).length > 0) return;
    const estimatedAt = instantFromEstimatedTimeInputs(draft.estimatedTime, draft.estimatedDay, now);
    if (
      estimatedAt === undefined ||
      draft.receivingWardAgreed === undefined ||
      (draft.mode !== "road" && draft.mode !== "flight") ||
      draft.provider === undefined ||
      draft.transportLegalStatus === undefined
    ) {
      return;
    }
    dispatch({
      type: "RECORD_REPATRIATION",
      role: "coordinator",
      now,
      admissionId,
      homeHospital: draft.homeHospital,
      receivingWardAgreed: draft.receivingWardAgreed,
      mode: draft.mode,
      provider: draft.provider,
      cadNumber: draft.cadNumber.trim(),
      transportLegalStatus: draft.transportLegalStatus,
      estimatedAt,
    });
    setDrafts((current) => {
      const next = { ...current };
      delete next[admissionId];
      return next;
    });
    const targetHospitalName = siteByCode(draft.homeHospital)?.name ?? draft.homeHospital;
    const movementFeedback = draft.receivingWardAgreed
      ? " Return transfer movement queued for bed placement at home health service."
      : " Return movement pending receiving ward agreement.";
    setRepatNotice(`Return recorded for ${patientOf(entry).displayName} to ${targetHospitalName}.${movementFeedback}`);
  }

  const planPatient = (entry: OutOfAreaEntry): PlanPatient => {
    const info = patientOf(entry);
    return { displayName: info.displayName, umrn: info.umrn, profileHref: getPatientProfileHref(info) };
  };

  const renderPlan = (entry: OutOfAreaEntry, header: ReactNode | undefined, idPrefix: string) => (
    <ReturnPlan
      entry={entry}
      patient={planPatient(entry)}
      daysLabel={sinceArrivalLabel(entry, now)}
      dischargeOffset={offsetOf(entry)}
      now={now}
      draft={draftFor(entry.admission.id)}
      onDraft={(update) => updateDraft(entry.admission.id, update)}
      record={recordOf(entry.admission.id)}
      returnMovementId={returnMovementOf(entry.admission.id)}
      options={closerBedOptions(entry, units, now)}
      notice={repatNotice}
      onDismissNotice={() => setRepatNotice(null)}
      onRecord={() => recordReturn(entry)}
      header={header}
      idPrefix={idPrefix}
    />
  );

  /* ---- tools ---- */
  const summaryText = () => {
    const lines = [
      `Out of area: ${entries.length} away from home, ${bedDays} bed days, longest ${longest} days.`,
      `${countOf("due")} past their discharge date, ${countOf("noplan")} with no return plan.`,
      ...sorted.map((entry) => {
        const info = patientOf(entry);
        return `${info.displayName} (${info.umrn}), ${entry.admission.homeRegion}, ${sinceArrivalLabel(entry, now)}, ${dischargeText(offsetOf(entry))}, ${RETURN_STATUS_SHORT[statusOf(entry)]}`;
      }),
      "Synthetic demonstration figures. Not a medical device.",
    ];
    return lines.join("\n");
  };
  async function copySummary() {
    try {
      await navigator.clipboard.writeText(summaryText());
      setToolNote("Bed meeting summary copied");
    } catch {
      setToolNote("Copy is not available in this browser");
    }
  }

  function exportList() {
    const lines: (string | number)[][] = [
      ["UMRN", "Home region", "Unit", "Site", "Travel time", "Discharge", "Return", "Since arrival"],
    ];
    for (const entry of sorted) {
      lines.push([
        patientOf(entry).umrn,
        entry.admission.homeRegion ?? "",
        entry.unit.name,
        siteByCode(entry.unit.siteCode)?.name ?? "",
        TRAVEL_BAND_LABELS[entry.band],
        dischargeText(offsetOf(entry)),
        RETURN_STATUS_SHORT[statusOf(entry)],
        sinceArrivalLabel(entry, now),
      ]);
    }
    try {
      const url = URL.createObjectURL(
        new Blob([lines.map((line) => line.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "ward-flow-synthetic-out-of-area.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setToolNote("Export is not available in this browser");
    }
  }

  /* ---- right column rows ---- */
  const shiftStart = currentShiftStart(now);
  const shiftReturns: ShiftReturnRow[] = repatriations
    .filter((record) => record.at >= shiftStart)
    .map((record) => {
      const entry = entries.find((candidate) => candidate.admission.id === record.admissionId);
      return { record, entry };
    })
    .filter((row): row is { record: RepatriationRecord; entry: OutOfAreaEntry } => row.entry !== undefined)
    .sort((a, b) => a.record.estimatedAt - b.record.estimatedAt)
    .map(({ record, entry }) => ({
      id: entry.admission.id,
      name: patientOf(entry).displayName,
      to: shortSiteName(record.homeHospital),
      mode: record.mode === "road" ? "Road" : "Flight",
      time: formatInstant(record.estimatedAt),
      day: departureDayLabel(record, now),
    }));
  const leavingToday = repatriations.filter((record) => leavesToday(record, now) && record.estimatedAt >= now);
  const dueSoon = entries.filter((entry) => {
    const offset = offsetOf(entry);
    return offset === 0 || offset === 1;
  }).length;
  const regionRows = homeRegionBeds(entries, units, now);
  const readyRows: ReadyRow[] = readyEntries.map((entry) => ({
    id: entry.admission.id,
    name: patientOf(entry).displayName,
    detail: entry.admission.blockReason ?? `${entry.admission.homeRegion} · ${TRAVEL_SHORT[entry.band]}`,
    detailIsReason: entry.admission.blockReason !== null,
    overdue: dischargeShort(offsetOf(entry)),
    returnShort: RETURN_STATUS_SHORT[statusOf(entry)],
  }));
  const startedRows = entries
    .filter((entry) => statusOf(entry) === "started")
    .map((entry) => ({
      id: entry.admission.id,
      name: patientOf(entry).displayName,
      left: missingAnswers(draftFor(entry.admission.id), now).length,
    }));

  const counts = (
    <p className="sr-only" data-testid="ward-out-of-area-counts">
      <span data-testid="ward-out-of-area-count-people">
        {entries.length} {entries.length === 1 ? "person is" : "people are"} recorded as being in a bed far from home.
      </span>{" "}
      <span data-testid="ward-out-of-area-count-not-banded">
        {notBanded} more could not be placed in a band because the combined count does not separate a missing home area
        from a missing travel-time pair.
      </span>
    </p>
  );

  /* ---- phone ---- */
  if (isPhone) {
    const phonePeople: PhonePerson[] = sorted.map((entry) => {
      const info = patientOf(entry);
      const record = recordOf(entry.admission.id);
      return {
        entry,
        name: info.displayName,
        umrn: info.umrn,
        profileHref: getPatientProfileHref(info),
        daysLabel: sinceArrivalLabel(entry, now),
        offset: offsetOf(entry),
        status: statusOf(entry),
        record,
        highlighted: isHighlighted(entry),
        who: whoseMove(draftFor(entry.admission.id), record),
      };
    });
    return (
      <div className={styles.screen} data-testid="ward-out-of-area-board" data-ward-design="v8-a">
        <main id="main-content" className={cx(styles.main, styles.phoneMain)}>
          <OutOfAreaPhone
            people={phonePeople}
            totalAway={entries.length}
            dueCount={countOf("due")}
            noPlanCount={countOf("noplan")}
            highlight={highlight}
            onHighlight={(key) => toggleHighlight(key)}
            query={searchQuery}
            onQuery={setSearchQuery}
            anyHighlight={anyHighlight}
            highlightedCount={highlightedCount}
            onClear={clearHighlights}
            readyIds={readyEntries.map((entry) => entry.admission.id)}
            leavingToday={leavingToday}
            now={now}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(id)}
            onClose={() => setSelectedId(null)}
            nextUpId={nextUp?.admission.id}
            onCopy={copySummary}
            toolNote={toolNote}
            renderPlan={(entry) => renderPlan(entry, undefined, "ward-out-of-area-phone-plan")}
            shift={
              <ShiftCard
                idPrefix="ward-out-of-area-phone"
                label={shiftLabel(now)}
                returns={shiftReturns}
                leaving={leavingToday.length}
                dueSoon={dueSoon}
                onPick={(id) => setSelectedId(id)}
              />
            }
            beds={
              <HomeBedsCard
                idPrefix="ward-out-of-area-phone"
                rows={regionRows}
                region={region}
                onRegion={toggleRegion}
                notBanded={notBanded}
              />
            }
          />
          {counts}
          <WardPrototypeFooter
            testId="ward-out-of-area-governance"
            note="People in a bed away from home · Synthetic demonstration figures · Not a medical device"
          />
        </main>
      </div>
    );
  }

  /* ---- desktop ---- */
  const pill = (key: HighlightKey, label: string, tone?: WfTone) => (
    <button
      key={key}
      type="button"
      className={styles.pill}
      aria-pressed={highlight === key}
      data-testid={`ward-out-of-area-highlight-${key}`}
      onClick={() => toggleHighlight(key)}
    >
      <span className={styles.pillCount}>{countOf(key)}</span>
      {tone ? <StatusGlyph tone={tone} size={9} /> : null}
      {label}
    </button>
  );

  return (
    <div className={styles.screen} data-testid="ward-out-of-area-board" data-ward-design="v8-a">
      <main id="main-content" className={styles.main}>
        <Hero
          level={1}
          eyebrow="Out of area"
          title={`${entries.length} away from home`}
          titleMeta={
            <span className={styles.heroMeta}>
              <span>
                <b>{bedDays}</b> bed days
              </span>
              <span>
                Longest <b>{longest} days</b>
              </span>
            </span>
          }
          stats={<DaysAwayStrip entries={entries} now={now} highlight={highlight} onToggle={toggleHighlight} />}
          aside={
            <span className={styles.heroActs}>
              <LiveChip state="live" onHero />
              <Button
                variant="light"
                size="sm"
                icon={Route}
                disabledReason={nextUp ? undefined : "Everyone has a return plan."}
                reasonDisplay="tooltip"
                title={
                  nextUp ? `Opens ${patientOf(nextUp).displayName}, the longest past discharge with no plan` : undefined
                }
                onClick={() => nextUp && selectPlacement(nextUp.admission.id)}
              >
                Plan next return
              </Button>
              <Button
                variant="onHero"
                size="sm"
                iconOnly
                icon={Copy}
                aria-label="Copy bed meeting summary"
                title="Copy bed meeting summary"
                onClick={copySummary}
              />
              <Button
                variant="onHero"
                size="sm"
                iconOnly
                icon={Download}
                aria-label="Export list as CSV"
                title="Export list as CSV"
                onClick={exportList}
              />
              <Button
                variant="onHero"
                size="sm"
                iconOnly
                icon={Printer}
                aria-label="Print handover list"
                disabledReason="Not wired in this prototype."
                reasonDisplay="tooltip"
              />
            </span>
          }
          bar={
            <div className={styles.pills} role="group" aria-label="Highlight people">
              {pill("due", "Discharge date passed", "warning")}
              {pill("air", "Air only")}
              {pill("road", TRAVEL_SHORT.three_hours_or_more)}
              {pill("noplan", "No return plan", "closed")}
              {pill("notagreed", "Ward not agreed", "neutral")}
              {pill("bed", "Awaiting home bed", "neutral")}
            </div>
          }
          barAside={
            <span className={styles.heroNote} role="status">
              {toolNote}
            </span>
          }
        />

        <div className={styles.layout}>
          <Card
            className={styles.registerCard}
            aria-labelledby="ward-out-of-area-entries-title"
            data-testid="ward-out-of-area-entries"
          >
            <h2 id="ward-out-of-area-entries-title" className="sr-only">
              Away from home register
            </h2>
            <div className={styles.toolbar}>
              <Tabs
                label="Out of area view"
                idPrefix="ward-out-of-area-view"
                value={tab}
                onChange={setTab}
                items={[
                  { id: "now", label: "Away now", count: entries.length },
                  { id: "history", label: "History", count: repatriations.length },
                ]}
              />
              {tab === "now" ? (
                <span className={styles.toolbarTools}>
                  <TextInput
                    ref={searchRef}
                    icon={Search}
                    boxClassName={styles.searchBox}
                    placeholder="Name, UMRN or ward"
                    aria-label="Highlight people by name, UMRN or ward"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    onClear={() => setSearchQuery("")}
                  />
                  <Segmented
                    label="Sort placements"
                    value={sortOrder}
                    onChange={setSortOrder}
                    items={[
                      { id: "ledger", label: "Ledger" },
                      { id: "days", label: "Days away" },
                      { id: "patient", label: "Name" },
                    ]}
                  />
                </span>
              ) : null}
            </div>
            {counts}

            {tab === "history" ? (
              <div
                role="tabpanel"
                id="ward-out-of-area-view-panel-history"
                aria-labelledby="ward-out-of-area-view-tab-history"
              >
                <HistoryList records={repatriations} entries={entries} patientOf={patientOf} now={now} />
              </div>
            ) : (
              <div role="tabpanel" id="ward-out-of-area-view-panel-now" aria-labelledby="ward-out-of-area-view-tab-now">
                <div className={styles.hlLine}>
                  <span aria-live="polite">
                    {anyHighlight ? (
                      <>
                        <b className={styles.mono}>{highlightedCount}</b> highlighted
                      </>
                    ) : (
                      <>{entries.length} people</>
                    )}
                  </span>
                  {anyHighlight ? (
                    <Button variant="ghost" size="sm" onClick={clearHighlights}>
                      Clear
                    </Button>
                  ) : null}
                  <span className={styles.keys} aria-hidden="true">
                    Press <kbd>/</kbd> to search, <kbd>J</kbd> <kbd>K</kbd> to move
                  </span>
                </div>
                {entries.length === 0 ? (
                  <p className={styles.emptyNote} data-testid="ward-out-of-area-empty">
                    Nobody on these records is in a bed far from home.
                  </p>
                ) : (
                  <WardTable
                    className={cx(tableClasses.table, styles.table)}
                    wrapperClassName={styles.tableScroll}
                    testId="ward-out-of-area-table"
                    ariaLabel="Out-of-area placement register"
                  >
                    <colgroup>
                      <col className={styles.colPatient} />
                      <col className={styles.colRegion} />
                      <col className={styles.colPlace} />
                      <col className={styles.colDischarge} />
                      <col className={styles.colReturn} />
                      <col className={styles.colDays} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th scope="col">Patient</th>
                        <th scope="col">Home region</th>
                        <th scope="col">Placement</th>
                        <th scope="col">Discharge</th>
                        <th scope="col">Return</th>
                        <th scope="col" className={tableClasses.num}>
                          Days away
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((entry) => {
                        const info = patientOf(entry);
                        const href = getPatientProfileHref(info);
                        const site = siteByCode(entry.unit.siteCode);
                        const isSelected = entry.admission.id === selectedId;
                        const lit = isHighlighted(entry);
                        const offset = offsetOf(entry);
                        const status = statusOf(entry);
                        const record = recordOf(entry.admission.id);
                        return (
                          <tr
                            key={entry.admission.id}
                            data-testid={`ward-out-of-area-row-${entry.admission.id}`}
                            data-highlighted={lit || undefined}
                            className={cx(styles.row, isSelected && tableClasses.selected, lit && styles.rowLit)}
                            aria-selected={isSelected}
                            tabIndex={0}
                            aria-label={`View placement detail for ${info.displayName} (${info.umrn}), ${entry.admission.homeRegion} in ${entry.unit.name}`}
                            onClick={(event) => selectPlacement(entry.admission.id, event.currentTarget)}
                            onKeyDown={(event) => {
                              if (
                                event.target === event.currentTarget &&
                                (event.key === "Enter" || event.key === " ")
                              ) {
                                event.preventDefault();
                                selectPlacement(entry.admission.id, event.currentTarget);
                              }
                            }}
                          >
                            <td>
                              <span className={styles.two}>
                                <b title={info.displayName}>{info.displayName}</b>
                                {href ? (
                                  <Link
                                    href={href}
                                    className={styles.umrnLink}
                                    onClick={(event) => event.stopPropagation()}
                                    title={`Open profile for ${info.displayName} (${info.umrn})`}
                                  >
                                    {info.umrn}
                                  </Link>
                                ) : (
                                  <span className={styles.mono}>{info.umrn}</span>
                                )}
                              </span>
                            </td>
                            <td>
                              <span className={styles.two}>
                                <span className={styles.cellText}>{entry.admission.homeRegion}</span>
                                <span className={styles.travel} title={TRAVEL_BAND_LABELS[entry.band]}>
                                  <TravelIcon entry={entry} />
                                  <span aria-hidden="true">{TRAVEL_SHORT[entry.band]}</span>
                                  <SrOnly>{TRAVEL_BAND_LABELS[entry.band]}</SrOnly>
                                </span>
                              </span>
                            </td>
                            <td>
                              <span className={styles.two}>
                                <span className={styles.cellText} title={entry.unit.name}>
                                  {entry.unit.name}
                                </span>
                                <span title={site?.name}>{site ? shortSiteName(site.code) : "Site not recorded"}</span>
                              </span>
                            </td>
                            <td>
                              <span className={styles.two}>
                                <span className={cx(styles.status, offset !== null && offset < 0 && styles.inkWarning)}>
                                  {offset === null ? (
                                    <StatusGlyph tone="closed" size={9} />
                                  ) : offset < 0 ? (
                                    <StatusGlyph tone="warning" size={9} />
                                  ) : null}
                                  {dischargeText(offset)}
                                </span>
                                <span title={entry.admission.blockReason ?? undefined}>
                                  {entry.admission.blockReason ??
                                    (entry.admission.expectedDischargeAt === null
                                      ? "Not set"
                                      : dateOf(entry.admission.expectedDischargeAt, dayZero))}
                                </span>
                              </span>
                            </td>
                            <td>
                              <ReturnCell
                                status={status}
                                record={record}
                                left={missingAnswers(draftFor(entry.admission.id), now).length}
                              />
                            </td>
                            <td className={cx(tableClasses.num, styles.away)}>{sinceArrivalLabel(entry, now)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </WardTable>
                )}
                <CardFoot
                  meta={
                    <span className={styles.footNote}>
                      <StatusGlyph tone="closed" size={9} />
                      <span>
                        <b>{bedDays}</b> bed days across {entries.length} people · <b>{notBanded}</b> records lack a
                        home area or travel time
                      </span>
                    </span>
                  }
                >
                  <Button variant="sec" size="sm" icon={Download} onClick={exportList} disabled={entries.length === 0}>
                    Export list
                  </Button>
                </CardFoot>
              </div>
            )}
          </Card>

          <div ref={detailColumnRef} className={styles.side}>
            {selected ? (
              <Card
                className={cx(styles.sideCard, styles.planCard)}
                aria-labelledby="ward-out-of-area-plan-title"
                data-testid="ward-out-of-area-subject"
              >
                {renderPlan(
                  selected,
                  <div className={styles.planHead}>
                    <span className={styles.planWho}>
                      <h2 id="ward-out-of-area-plan-title" className={styles.planName}>
                        <SrOnly>Return plan for </SrOnly>
                        {planPatient(selected).displayName}
                      </h2>
                      <span className={styles.mono}>{planPatient(selected).umrn}</span>
                    </span>
                    <span role="status" className={styles.planPosition}>
                      <SrOnly>Synthetic patient </SrOnly>
                      {selectedIndex + 1} of {sorted.length}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      icon={ChevronLeft}
                      aria-label="Inspect previous patient"
                      disabled={selectedIndex <= 0}
                      onClick={() => step(-1)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      icon={ChevronRight}
                      aria-label="Inspect next patient"
                      disabled={selectedIndex < 0 || selectedIndex >= sorted.length - 1}
                      onClick={() => step(1)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      icon={X}
                      aria-label="Return to cohort overview"
                      title="Close (Escape)"
                      onClick={returnToOverview}
                    />
                  </div>,
                  "ward-out-of-area-plan",
                )}
              </Card>
            ) : (
              <>
                <ShiftCard
                  idPrefix="ward-out-of-area"
                  label={shiftLabel(now)}
                  returns={shiftReturns}
                  leaving={leavingToday.length}
                  dueSoon={dueSoon}
                  onPick={(id) => selectPlacement(id)}
                />
                <HomeBedsCard
                  idPrefix="ward-out-of-area"
                  rows={regionRows}
                  region={region}
                  onRegion={toggleRegion}
                  notBanded={notBanded}
                />
                <ReadyCard
                  idPrefix="ward-out-of-area"
                  testId="ward-out-of-area-subject"
                  bodyTestId="ward-out-of-area-subject-empty"
                  rows={readyRows}
                  started={startedRows}
                  onPick={(id) => selectPlacement(id)}
                />
              </>
            )}
          </div>
        </div>

        <WardPrototypeFooter
          testId="ward-out-of-area-governance"
          note="People in a bed away from home · Synthetic demonstration figures · Not a medical device"
        />
      </main>
    </div>
  );
}

function ReturnCell({
  status,
  record,
  left,
}: {
  status: ReturnStatus;
  record: RepatriationRecord | undefined;
  left: number;
}) {
  if (status === "none") {
    return (
      <span className={cx(styles.status, styles.quiet)}>
        <StatusGlyph tone={STATUS_TONE.none} size={9} />
        No plan
      </span>
    );
  }
  const head = status === "started" ? "Started" : status === "not_agreed" ? "Not agreed" : "Agreed";
  const sub =
    status === "started"
      ? left
        ? `${left} to answer`
        : "Ready to record"
      : status === "agreed"
        ? `${shortSiteName(record!.homeHospital)}, bed to place`
        : shortSiteName(record!.homeHospital);
  return (
    <span className={styles.two}>
      <span className={styles.status}>
        <StatusGlyph tone={STATUS_TONE[status]} size={9} />
        {head}
      </span>
      <span>{sub}</span>
    </span>
  );
}

/** Days away, in the four display groups, on the hero. Each segment and label highlights its rows. */
function DaysAwayStrip({
  entries,
  now,
  highlight,
  onToggle,
}: {
  entries: OutOfAreaEntry[];
  now: Instant;
  highlight: HighlightKey | null;
  onToggle: (key: HighlightKey) => void;
}) {
  const groups = DAYS_AWAY_GROUPS.map((group) => ({
    ...group,
    key: `age:${group.id}` as HighlightKey,
    n: entries.filter((entry) => inDaysAwayGroup(entry, now, group.id)).length,
  }));
  return (
    <div className={styles.ageStrip} role="group" aria-label="Days away, highlights rows">
      <span className={styles.ageEyebrow}>Days away</span>
      <span className={styles.ageBar} aria-hidden="true">
        {groups.map((group) =>
          group.n ? (
            <span
              key={group.id}
              className={cx(styles.ageSeg, styles[`age_${group.id}`], highlight === group.key && styles.ageSegOn)}
              style={{ flexGrow: group.n }}
            />
          ) : null,
        )}
      </span>
      <span className={styles.ageLabels}>
        {groups.map((group) => (
          <button
            key={group.id}
            type="button"
            aria-pressed={highlight === group.key}
            aria-label={`${group.label} days away: ${group.n}`}
            onClick={() => onToggle(group.key)}
          >
            <i className={styles[`age_${group.id}`]} aria-hidden="true" />
            {group.label}
            <b>{group.n}</b>
          </button>
        ))}
      </span>
    </div>
  );
}

function HistoryList({
  records,
  entries,
  patientOf,
  now,
}: {
  records: RepatriationRecord[];
  entries: OutOfAreaEntry[];
  patientOf: (entry: OutOfAreaEntry) => ResolvedPatientInfo;
  now: Instant;
}) {
  if (records.length === 0) {
    return (
      <div className={styles.noMatches}>
        <EmptyState icon={MapIcon} title="No returns recorded this session" />
      </div>
    );
  }
  return (
    <ul className={styles.rowList}>
      {[...records]
        .sort((a, b) => b.at - a.at)
        .map((record) => {
          const entry = entries.find((candidate) => candidate.admission.id === record.admissionId);
          const name = entry ? patientOf(entry).displayName : "Left the ledger";
          return (
            <li key={record.admissionId} className={styles.historyRow}>
              <span className={styles.mono}>{formatInstantWithDay(record.at, now)}</span>
              <StatusGlyph tone="success" size={10} />
              <span className={styles.two}>
                <b>{name}</b>
                <span>
                  {siteByCode(record.homeHospital)?.name ?? record.homeHospital} ·{" "}
                  {record.receivingWardAgreed ? "ward agreed" : "ward not yet agreed"}
                </span>
              </span>
              <span className={styles.sub}>Coordinator</span>
            </li>
          );
        })}
    </ul>
  );
}

/**
 * How long this person has been in this bed, in whole days.
 */
export function sinceArrivalLabel(entry: OutOfAreaEntry, now: Instant): string {
  const days = daysInBed(entry.admission, now);
  if (days === null) return "Arrival not recorded";
  if (days === 0) return "Under a day";
  return `${days} ${days === 1 ? "day" : "days"}`;
}
