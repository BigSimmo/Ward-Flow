"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Car, ChevronLeft, ChevronRight, Clock, Download, Map as MapIcon, Plane, Search, X } from "lucide-react";

import {
  Button,
  Card,
  CardBody,
  CardFoot,
  CardHead,
  EmptyState,
  Field,
  Hero,
  HeroStat,
  HeroTrack,
  Icon,
  Radio,
  Segmented,
  Select,
  SrOnly,
  StatusGlyph,
  StatusLine,
  TextInput,
  buttonClass,
  tableClasses,
} from "@/components/wf";
import { daysInBed, type Admission } from "@/components/ward-management/ward-admissions";
import type { Instant } from "@/components/ward-management/ward-clock";
import { TRAVEL_BAND_LABELS } from "@/components/ward-management/ward-distance";
import { REPATRIATION_MODES } from "@/components/ward-management/ward-flow-events";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import {
  TRANSPORT_LEGAL_STATUSES,
  TRANSPORT_PROVIDERS,
  type TransportLegalStatus,
  type TransportProvider,
} from "@/components/ward-management/ward-model";
import { resolveSubjectPatient, type ResolvedPatientInfo } from "@/components/ward-management/ward-patient-resolver";
import { outOfAreaLedger, type OutOfAreaEntry } from "@/components/ward-management/ward-referrals";
import { siteByCode, wardSites } from "@/components/ward-management/ward-sites";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";
import { csvCell } from "@/components/ward-management/statistics/statistics-csv";

import styles from "./out-of-area-v6.module.css";

/**
 * Phase 8, Task 5 (spec D8-3): the out-of-area ledger — how many people are currently in a bed a
 * long way from where they live, and for how long.
 *
 * The operational threshold and invented, unvalidated travel bands stay visible above the entries.
 * Full provenance appears once in a disclosure, shared by all placements.
 *
 * **It calls `outOfAreaLedger` and recomputes nothing.** Neither number is derived here, the
 * entries default to the order the ledger returns them. Optional alphabetical sorting changes
 * only the displayed register. The default is the admission fixture's own order: a sort by elapsed time
 * would be a ranking of people by how recently they were sent away, which reads as a repatriation
 * priority nobody has decided. `ward-referrals.ts` holds a sibling derivation that does sort
 * most-recent-first (`recentlyDecidedReferrals`); it answers a different question and must never
 * be reached for here.
 *
 * **Elapsed time and nothing else.** No countdown, no target, no deadline, and no colour that
 * changes at a threshold. `formatElapsed` is deliberately not reused — it appends "waiting", and
 * somebody in a bed far from home is not waiting for anything this prototype has recorded.
 *
 * **In whole days, via `daysInBed`.** The first version of this screen rendered minutes through
 * `splitDuration`, and on the seeded records that produced everything from `25h 30m` to
 * `5041h 30m`. Every assertion passed, because every number was correct — the FORMAT was
 * unreadable, and this screen's second headline fact is one nobody could read. Days are what a
 * length of stay is spoken in, and `daysInBed` (`ward-admissions.ts`) is the one place this
 * project computes them: counted from `arrivedAt` and never from `pulledAt`, floored at zero, and
 * `null` rather than a substituted fallback when there is no arrival. Reimplementing the division
 * here would be the second local copy this phase exists to prevent. It is still elapsed time and
 * nothing else — just readable.
 *
 * **THE ADMISSIONS COME FROM THE PROVIDER, AND UNTIL 2026-08-30 THEY CAME FROM THE SEED.** The
 * paragraph that used to sit here said `Admission` was not in the reducer's state and that no
 * event created one. Both had stopped being true: `seedWardFlowState` carries `admissions`, and the
 * reducer appends one (`ward-flow-reducer.ts`, `AD-ARR-…`). The comment was accurate when it was
 * written and nothing failed when it stopped being — which is how it went on justifying a read that
 * had become wrong.
 *
 * **WHICH EVENT APPENDS IT HAS MOVED TWICE, and this line has been wrong once already.** It said
 * `PATIENT_ARRIVED` after the record's creation had moved to `PULL_PATIENT`. Today `PULL_PATIENT`
 * creates it `pulled` with a null `arrivedAt`, and `PATIENT_ARRIVED` is what marks it `occupied` and
 * stamps the arrival. That matters HERE specifically: `daysInBed` reads `arrivedAt`, so a pulled
 * person correctly contributes no length of stay to this board until they actually get there.
 *
 * ⚠️ **TWO DEFECTS CAME OUT OF THAT ONE STALE PARAGRAPH, AND THE SMALLER-LOOKING ONE IS WORSE.**
 *
 *  1. **A length of stay counted across two clocks.** `now` is re-anchored to the hour the demo
 *     opens; the seed is not. One side of the subtraction moved, so every figure on a screen whose
 *     headline fact is DAYS IN A BED was inflated by the anchor offset. Ward Board found this exact
 *     shape on `edPressure` the same night: *a wrong clock looks wrong; a wrong length of stay
 *     looks PLAUSIBLE.* Out-of-area duration is a figure people escalate on.
 *  2. **The screen contradicted itself.** Its own provenance line says a patient who arrives during
 *     the session is added, and blames their absence on a missing home region. Reading the seed
 *     made that impossible for a different reason entirely — an arrival appends to state, and this
 *     screen was not looking at state. The stated reason was not the operative one, which is worse
 *     than no explanation: it sends the next reader to the wrong place.
 *
 * The override parameter SURVIVES, and that is deliberate. Board's lesson from `edPressure` is that
 * the injection point was never the problem — its OPTIONALITY pointing at a frozen fixture was. It
 * now falls back to live state, so omitting it (which is what the route does) is safe, and a test
 * can still render the two states the seeded records cannot produce: nobody out of area at all, and
 * an unclassified count standing alone as the only non-zero number.
 *
 * `units` and `now` come from the provider for the same reason they always did.
 *
 * **The "At a glance" panel (added from the third-edition drawing) is a SELECTION, never a second
 * derivation.** Clicking a row or a card only changes which already-computed `OutOfAreaEntry` this
 * component reads its facts from — `selectedId` never feeds back into `outOfAreaLedger`, and
 * nothing in the panel recomputes a band, a region or an elapsed time. The drawing's fuller
 * "five groups" summary asks for far / near / no-home / no-band / no-arrival. The existing ledger
 * exposes only the far entries and one combined `notBanded` count. This page renders all five
 * headings, gives a number only to the group the ledger actually returns, and keeps the combined
 * figure in its original sentence. The remaining headings state that the ledger does not expose
 * that population or separation. Reimplementing the admission branches here would be exactly the
 * second classifier this file's own header warns against.
 */
const WA_SERVICE_ORDER = ["North Metro", "South Metro", "East Metro", "WACHS", "CAHS", "Private"] as const;

const SERVICE_DISPLAY_NAMES: Record<string, string> = {
  "North Metro": "North Metropolitan Health Service (NMHS)",
  "South Metro": "South Metropolitan Health Service (SMHS)",
  "East Metro": "East Metropolitan Health Service (EMHS)",
  WACHS: "WA Country Health Service (WACHS)",
  CAHS: "Child and Adolescent Health Service (CAHS)",
  Private: "Authorised Private Services",
};

const NO_HOME_HOSPITAL_VALUE = "";
const NO_REPAT_MODE_VALUE = "";
const NO_TRANSPORT_PROVIDER_VALUE = "";

const TRANSPORT_LEGAL_STATUS_LABELS: Record<TransportLegalStatus, string> = {
  voluntary: "Voluntary",
  involuntary: "Involuntary",
};

const LOCAL_REPATRIATION_MODES = ["road", "flight"] as const;
const REPAT_MODES =
  typeof REPATRIATION_MODES !== "undefined" && Array.isArray(REPATRIATION_MODES)
    ? REPATRIATION_MODES
    : LOCAL_REPATRIATION_MODES;

type RepatMode = "road" | "flight";

type RepatDraft = {
  homeHospital: string;
  receivingWardAgreed: boolean | undefined;
  mode: "" | RepatMode;
  provider: TransportProvider | undefined;
  cadNumber: string;
  transportLegalStatus: TransportLegalStatus | undefined;
  estimatedTime: string;
  estimatedDay: "today" | "tomorrow";
};

const BLANK_REPAT_DRAFT: RepatDraft = {
  homeHospital: NO_HOME_HOSPITAL_VALUE,
  receivingWardAgreed: undefined,
  mode: NO_REPAT_MODE_VALUE,
  provider: undefined,
  cadNumber: "",
  transportLegalStatus: undefined,
  estimatedTime: "",
  estimatedDay: "today",
};

const HOME_HOSPITAL_GROUPS = (() => {
  const serviceGroups = new Map<string, { service: string; sites: { code: string; name: string }[] }>();
  for (const service of WA_SERVICE_ORDER) {
    serviceGroups.set(service, { service, sites: [] });
  }
  for (const site of wardSites) {
    if (!serviceGroups.has(site.service)) {
      serviceGroups.set(site.service, { service: site.service, sites: [] });
    }
    serviceGroups.get(site.service)!.sites.push({ code: site.code, name: site.name });
  }
  return Array.from(serviceGroups.values()).filter((group) => group.sites.length > 0);
})();

/** Same HH:MM parser the ED booking popup uses — local copy so this screen does not import from ed-screen. */
function minutesFromTimeInput(value: string): number | undefined {
  const parts = value.split(":");
  if (parts.length !== 2) return undefined;
  const [rawHours, rawMinutes] = parts;
  if (rawHours?.length !== 2 || rawMinutes?.length !== 2) return undefined;
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return undefined;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return undefined;
  return hours * 60 + minutes;
}

function instantFromEstimatedTimeInputs(
  timeValue: string,
  day: "today" | "tomorrow",
  now: Instant,
): number | undefined {
  const minuteOfDay = minutesFromTimeInput(timeValue);
  if (minuteOfDay === undefined) return undefined;
  const startOfToday = Math.floor(now / 1440) * 1440;
  return startOfToday + (day === "tomorrow" ? 1440 : 0) + minuteOfDay;
}

function repatriationBlockedReason(
  draft: RepatDraft,
  admissionId: string | undefined,
  now: Instant,
): string | undefined {
  const missing: string[] = [];
  if (!admissionId) missing.push("choose a person on the ledger");
  if (!wardSites.some((site) => site.code === draft.homeHospital)) missing.push("choose the home hospital");
  if (draft.receivingWardAgreed === undefined) missing.push("say whether the receiving ward has agreed");
  if (draft.mode !== "road" && draft.mode !== "flight") missing.push("choose road or flight");
  if (draft.provider === undefined) missing.push("choose the transport provider");
  if (draft.cadNumber.trim().length === 0) missing.push("enter the CAD (dispatch) number");
  if (draft.transportLegalStatus === undefined) {
    missing.push("state whether the transport is voluntary or involuntary");
  }
  if (instantFromEstimatedTimeInputs(draft.estimatedTime, draft.estimatedDay, now) === undefined) {
    missing.push("enter the estimated time");
  }
  if (missing.length === 0) return undefined;
  return `Before recording, ${missing.join(", ")}. None is filled in for you.`;
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

type TransportFilter = "all" | "air_transport_only" | "three_hours_or_more";
type SortOrder = "ledger" | "patient" | "catchment";

/** The short travel word for the hero, the plan's figures and the phone card. */
function travelWord(entry: OutOfAreaEntry): string {
  return entry.band === "air_transport_only" ? "Air" : "Road";
}

/**
 * THE V6 REBUILD, 7 October 2026 — `design/pages-v6/OutOfArea.png`. One hero band counts the people
 * away from home and switches the travel band; the "Away from home" card is the ledger with search,
 * sort and the home-catchment filter; the "Return plan" card holds the selected person's facts and
 * the repatriation form inline, so the form is a step of the plan rather than a separate dialog; the
 * "Home catchments" card counts people by home region and filters the ledger.
 *
 * **Left out, because the record cannot support it:** a return status per person (the reducer keeps
 * `repatriations` but the provider does not expose them to screens), whether a home bed is ready,
 * the next transport slot, how many can return now or declined home, and the time-away bands (any
 * band edge would be a threshold nobody has set, and this screen keeps "no colour that changes at a
 * threshold").
 */
export function OutOfAreaBoard({ admissions }: { admissions?: Admission[] }) {
  const { units, admissions: liveAdmissions, patients, referrals, movements, dispatch } = useWardFlow();
  const now = useWardFlowClock();

  const resolvePatient = (admission: Admission): ResolvedPatientInfo => {
    return resolveSubjectPatient(admission, { patients, referrals, movements });
  };

  const { entries, notBanded } = outOfAreaLedger(admissions ?? liveAdmissions, units, now);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? entries.find((entry) => entry.admission.id === selectedId) : undefined;

  const [repatDraft, setRepatDraft] = useState<RepatDraft>(BLANK_REPAT_DRAFT);
  const [repatNotice, setRepatNotice] = useState<string | null>(null);
  const [repatFormNotice, setRepatFormNotice] = useState<string | null>(null);

  const selectionOriginRef = useRef<HTMLElement | null>(null);
  const detailColumnRef = useRef<HTMLDivElement | null>(null);

  const selectPlacement = (id: string, origin?: HTMLElement) => {
    if (origin) selectionOriginRef.current = origin;
    if (id !== selectedId) {
      setRepatDraft(BLANK_REPAT_DRAFT);
      setRepatFormNotice(null);
    }
    setSelectedId(id);
  };

  const returnToOverview = () => {
    setSelectedId(null);
    selectionOriginRef.current?.focus();
  };

  useEffect(() => {
    if (selectedId === null) return;
    if (typeof window.matchMedia !== "function" || !window.matchMedia("(max-width: 1000px)").matches) {
      return;
    }
    window.requestAnimationFrame(() => {
      detailColumnRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [selectedId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && selectedId !== null) {
        setSelectedId(null);
        selectionOriginRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId]);

  useEffect(() => {
    if (!repatNotice) return;
    const timer = setTimeout(() => {
      setRepatNotice(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [repatNotice]);

  const maxDaysEntry = entries.reduce<OutOfAreaEntry | undefined>((max, current) => {
    const currentDays = daysInBed(current.admission, now) ?? 0;
    const maxDays = max ? (daysInBed(max.admission, now) ?? 0) : -1;
    return currentDays > maxDays ? current : max;
  }, undefined);

  const airCount = entries.filter((e) => e.band === "air_transport_only").length;
  const roadCount = entries.filter((e) => e.band === "three_hours_or_more").length;

  const [transportFilter, setTransportFilter] = useState<TransportFilter>("all");
  const [catchmentFilter, setCatchmentFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("ledger");

  const homeRegionCounts = entries.reduce<Record<string, number>>((acc, entry) => {
    const region = entry.admission.homeRegion ?? "Not recorded";
    acc[region] = (acc[region] ?? 0) + 1;
    return acc;
  }, {});
  const homeRegionSummary = Object.entries(homeRegionCounts).sort((a, b) => b[1] - a[1]);
  const largestRegion = homeRegionSummary[0]?.[1] ?? 0;

  const filteredEntries = entries.filter((entry) => {
    if (transportFilter !== "all" && entry.band !== transportFilter) {
      return false;
    }
    if (catchmentFilter !== "all" && (entry.admission.homeRegion ?? "Not recorded") !== catchmentFilter) {
      return false;
    }
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      const site = siteByCode(entry.unit.siteCode);
      const patientInfo = resolvePatient(entry.admission);
      const matchesId = entry.admission.id.toLowerCase().includes(q);
      const matchesName =
        patientInfo.displayName.toLowerCase().includes(q) || patientInfo.formalName.toLowerCase().includes(q);
      const matchesUmrn = patientInfo.umrn.toLowerCase().includes(q);
      const matchesRegion = (entry.admission.homeRegion ?? "").toLowerCase().includes(q);
      const matchesUnit = entry.unit.name.toLowerCase().includes(q);
      const matchesSite = (site?.name ?? "").toLowerCase().includes(q);
      const matchesService = (site?.service ?? "").toLowerCase().includes(q);
      return matchesId || matchesName || matchesUmrn || matchesRegion || matchesUnit || matchesSite || matchesService;
    }
    return true;
  });
  if (sortOrder !== "ledger") {
    filteredEntries.sort((a, b) => {
      const left = sortOrder === "patient" ? resolvePatient(a.admission).displayName : (a.admission.homeRegion ?? "");
      const right = sortOrder === "patient" ? resolvePatient(b.admission).displayName : (b.admission.homeRegion ?? "");
      return left.localeCompare(right, "en-AU");
    });
  }

  const selectedIndex = filteredEntries.findIndex((entry) => entry.admission.id === selectedId);
  const hasFilters = transportFilter !== "all" || catchmentFilter !== "all" || searchQuery.trim().length > 0;
  const resetFilters = () => {
    setSearchQuery("");
    setTransportFilter("all");
    setCatchmentFilter("all");
  };

  const patientInfo = selected ? resolvePatient(selected.admission) : undefined;
  const profileHref = patientInfo ? getPatientProfileHref(patientInfo) : null;
  const site = selected ? siteByCode(selected.unit.siteCode) : undefined;
  const longestPatientInfo = maxDaysEntry ? resolvePatient(maxDaysEntry.admission) : undefined;

  function recordReturn() {
    const admissionId = selected?.admission.id;
    const blocked = repatriationBlockedReason(repatDraft, admissionId, now);
    if (blocked !== undefined) {
      setRepatFormNotice(blocked);
      return;
    }
    const estimatedAt = instantFromEstimatedTimeInputs(repatDraft.estimatedTime, repatDraft.estimatedDay, now);
    if (
      admissionId === undefined ||
      estimatedAt === undefined ||
      repatDraft.receivingWardAgreed === undefined ||
      (repatDraft.mode !== "road" && repatDraft.mode !== "flight") ||
      repatDraft.provider === undefined ||
      repatDraft.transportLegalStatus === undefined
    ) {
      return;
    }
    dispatch({
      type: "RECORD_REPATRIATION",
      role: "coordinator",
      now,
      admissionId,
      homeHospital: repatDraft.homeHospital,
      receivingWardAgreed: repatDraft.receivingWardAgreed,
      mode: repatDraft.mode,
      provider: repatDraft.provider,
      cadNumber: repatDraft.cadNumber.trim(),
      transportLegalStatus: repatDraft.transportLegalStatus,
      estimatedAt,
    });
    setRepatFormNotice(null);
    setRepatDraft(BLANK_REPAT_DRAFT);
    const targetHospitalName = siteByCode(repatDraft.homeHospital)?.name ?? repatDraft.homeHospital;
    const movementFeedback = repatDraft.receivingWardAgreed
      ? " Return transfer movement queued for bed placement at home health service."
      : " Return movement pending receiving ward agreement.";
    setRepatNotice(
      `Repatriation transfer order recorded for ${admissionId} to ${targetHospitalName}.${movementFeedback}`,
    );
  }

  function exportList() {
    const lines: (string | number)[][] = [["Admission", "Home region", "Unit", "Site", "Travel time", "Since arrival"]];
    for (const entry of filteredEntries) {
      lines.push([
        entry.admission.id,
        entry.admission.homeRegion ?? "",
        entry.unit.name,
        siteByCode(entry.unit.siteCode)?.name ?? "",
        TRAVEL_BAND_LABELS[entry.band],
        sinceArrivalLabel(entry, now),
      ]);
    }
    const url = URL.createObjectURL(
      new Blob([lines.map((line) => line.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "ward-flow-synthetic-out-of-area.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const regionItems = [
    { id: "all", label: "All", count: entries.length },
    ...homeRegionSummary.map(([region, count]) => ({ id: region, label: region, count })),
  ];

  return (
    <div className={styles.screen} data-testid="ward-out-of-area-board" data-ward-design="v6">
      <main id="main-content" className={styles.main}>
        <Hero
          level={1}
          eyebrow="Out of area"
          title={`${entries.length} away from home`}
          stats={
            <>
              <HeroStat value={airCount} label="Air only" />
              <HeroStat value={roadCount} label="Road" />
              <HeroStat value={maxDaysEntry ? sinceArrivalLabel(maxDaysEntry, now) : "None"} label="Longest away" />
            </>
          }
          aside={
            <HeroTrack
              label="Travel band"
              value={transportFilter}
              onChange={setTransportFilter}
              items={[
                { id: "all", label: "All", count: entries.length },
                { id: "air_transport_only", label: "Air", count: airCount },
                { id: "three_hours_or_more", label: "Road", count: roadCount },
              ]}
            />
          }
        />

        <div className={styles.layout}>
          <Card
            className={styles.ledgerCard}
            aria-labelledby="ward-out-of-area-entries-title"
            data-testid="ward-out-of-area-entries"
          >
            <div className={styles.ledgerHead}>
              <CardHead id="ward-out-of-area-entries-title" icon={MapIcon} title="Away from home" />
              <div className={styles.headControls}>
                <TextInput
                  icon={Search}
                  boxClassName={styles.searchBox}
                  placeholder="Patient or UMRN"
                  aria-label="Filter out-of-area placements"
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
                    { id: "patient", label: "Name" },
                    { id: "catchment", label: "Region" },
                  ]}
                />
              </div>
            </div>
            <div className={styles.toolbar}>
              <div className={styles.segScroll}>
                <Segmented
                  label="Filter by home catchment"
                  value={catchmentFilter}
                  onChange={setCatchmentFilter}
                  items={regionItems}
                />
              </div>
              <span className={styles.resultLine}>
                <span aria-live="polite">
                  <b>{filteredEntries.length}</b> synthetic records shown
                </span>
                {hasFilters ? (
                  <Button variant="ghost" size="sm" onClick={resetFilters}>
                    Clear filters
                  </Button>
                ) : null}
              </span>
            </div>

            <p className="sr-only" data-testid="ward-out-of-area-counts">
              <span data-testid="ward-out-of-area-count-people">
                {entries.length} {entries.length === 1 ? "person is" : "people are"} recorded as being in a bed far from
                home.
              </span>{" "}
              <span data-testid="ward-out-of-area-count-not-banded">
                {notBanded} more could not be placed in a band because the combined count does not separate a missing
                home area from a missing travel-time pair.
              </span>
            </p>
            <div className={styles.registerBody}>
              {entries.length === 0 ? (
                <p className={styles.emptyNote} data-testid="ward-out-of-area-empty">
                  Nobody on these records is in a bed far from home.
                </p>
              ) : filteredEntries.length === 0 ? (
                <div className={styles.noMatches}>
                  <EmptyState
                    icon={Search}
                    title="No placements match the current search or filters."
                    action={
                      <Button variant="sec" size="sm" onClick={resetFilters}>
                        Reset filters
                      </Button>
                    }
                  />
                </div>
              ) : (
                <>
                  <div className={styles.tableWrap}>
                    <WardTable
                      className={`${tableClasses.table} ${styles.table}`}
                      wrapperClassName={styles.tableScroll}
                      testId="ward-out-of-area-table"
                      ariaLabel="Out-of-area placement register"
                    >
                      <thead>
                        <tr>
                          <th scope="col">Patient</th>
                          <th scope="col">Home region</th>
                          <th scope="col">Unit</th>
                          <th scope="col">Travel time</th>
                          <th scope="col" className={tableClasses.num}>
                            Since arrival
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* All matching entries; sorting by name or region is an explicit view choice. */}
                        {filteredEntries.map((entry) => {
                          const entrySite = siteByCode(entry.unit.siteCode);
                          const entryPatient = resolvePatient(entry.admission);
                          const entryProfileHref = getPatientProfileHref(entryPatient);
                          const isSelected = entry.admission.id === selectedId;
                          return (
                            <tr
                              key={entry.admission.id}
                              data-testid={`ward-out-of-area-row-${entry.admission.id}`}
                              className={isSelected ? `${tableClasses.selected} ${styles.row}` : styles.row}
                              aria-selected={isSelected}
                              tabIndex={0}
                              aria-label={`View placement detail for ${entryPatient.displayName} (${entryPatient.umrn}), ${entry.admission.homeRegion} in ${entry.unit.name}`}
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
                                <span className={styles.primary}>{entryPatient.displayName}</span>
                                <span className={styles.secondary}>
                                  {entryProfileHref ? (
                                    <Link
                                      href={entryProfileHref}
                                      className={styles.umrnLink}
                                      onClick={(event) => event.stopPropagation()}
                                      title={`Open profile for ${entryPatient.displayName} (${entryPatient.umrn})`}
                                    >
                                      {entryPatient.umrn}
                                    </Link>
                                  ) : (
                                    <span>{entryPatient.umrn}</span>
                                  )}
                                  <span aria-hidden="true"> · </span>
                                  <span className={styles.mono}>{entry.admission.id}</span>
                                </span>
                              </td>
                              <td>
                                <span className={styles.primaryPlain}>{entry.admission.homeRegion}</span>
                              </td>
                              <td>
                                <span className={styles.primaryPlain}>{entry.unit.name}</span>
                                <span className={styles.secondary}>{entrySite?.name ?? "Site not recorded"}</span>
                              </td>
                              <td>
                                <span className={styles.travel} title={TRAVEL_BAND_LABELS[entry.band]}>
                                  <Icon icon={entry.band === "air_transport_only" ? Plane : Car} size={14} />
                                  {TRAVEL_BAND_LABELS[entry.band]}
                                </span>
                              </td>
                              <td className={`${tableClasses.num} ${styles.away}`}>{sinceArrivalLabel(entry, now)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </WardTable>
                  </div>

                  {/* Phone card list: a second, independently keyed rendering of every entry. */}
                  <ul className={styles.cardList} data-testid="ward-out-of-area-cards">
                    {filteredEntries.map((entry) => {
                      const entrySite = siteByCode(entry.unit.siteCode);
                      const entryPatient = resolvePatient(entry.admission);
                      const entryProfileHref = getPatientProfileHref(entryPatient);
                      const isSelected = entry.admission.id === selectedId;
                      return (
                        <li
                          key={entry.admission.id}
                          className={isSelected ? `${styles.card} ${styles.cardSelected}` : styles.card}
                          data-testid={`ward-out-of-area-card-${entry.admission.id}`}
                          aria-selected={isSelected}
                          tabIndex={0}
                          role="button"
                          aria-label={`View placement detail for ${entryPatient.displayName} (${entryPatient.umrn}), ${entry.admission.homeRegion} in ${entry.unit.name}`}
                          onClick={(event) => selectPlacement(entry.admission.id, event.currentTarget)}
                          onKeyDown={(event) => {
                            if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                              event.preventDefault();
                              selectPlacement(entry.admission.id, event.currentTarget);
                            }
                          }}
                        >
                          <span className={styles.cardTop}>
                            <span className={styles.primary}>{entryPatient.displayName}</span>
                            <span className={styles.cardAway}>{sinceArrivalLabel(entry, now)} since arrival</span>
                          </span>
                          <span className={styles.secondary}>
                            {entryProfileHref ? (
                              <Link
                                href={entryProfileHref}
                                className={styles.umrnLink}
                                onClick={(event) => event.stopPropagation()}
                                title={`Open profile for ${entryPatient.displayName} (${entryPatient.umrn})`}
                              >
                                {entryPatient.umrn}
                              </Link>
                            ) : (
                              <span>{entryPatient.umrn}</span>
                            )}
                            <span aria-hidden="true"> · </span>
                            {entry.admission.homeRegion}
                          </span>
                          <span className={styles.secondary}>
                            {entry.unit.name} · {entrySite?.name ?? "Site not recorded"}
                          </span>
                          <span className={styles.travel}>
                            <Icon icon={entry.band === "air_transport_only" ? Plane : Car} size={14} />
                            {TRAVEL_BAND_LABELS[entry.band]}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
            <CardFoot
              meta={
                <span className={styles.footNote}>
                  <StatusGlyph tone="neutral" size={9} />
                  <b>{notBanded}</b> records lack a home area or travel time
                </span>
              }
            >
              <Button
                variant="sec"
                size="sm"
                icon={Download}
                onClick={exportList}
                disabled={filteredEntries.length === 0}
              >
                Export list
              </Button>
            </CardFoot>
          </Card>

          <div ref={detailColumnRef} className={styles.side}>
            <Card
              className={styles.planCard}
              aria-labelledby="ward-out-of-area-plan-title"
              data-testid="ward-out-of-area-subject"
            >
              <CardHead
                id="ward-out-of-area-plan-title"
                title="Return plan"
                eyebrow
                aside={
                  selected ? (
                    <span className={styles.planNav}>
                      <span role="status" className={styles.planPosition}>
                        {selectedIndex >= 0 ? (
                          <>
                            <SrOnly>Synthetic patient </SrOnly>
                            {selectedIndex + 1} of {filteredEntries.length}
                          </>
                        ) : (
                          "Outside current filters"
                        )}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        iconOnly
                        icon={ChevronLeft}
                        aria-label="Inspect previous patient"
                        disabled={selectedIndex <= 0}
                        onClick={() => selectPlacement(filteredEntries[selectedIndex - 1].admission.id)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        iconOnly
                        icon={ChevronRight}
                        aria-label="Inspect next patient"
                        disabled={selectedIndex < 0 || selectedIndex >= filteredEntries.length - 1}
                        onClick={() => selectPlacement(filteredEntries[selectedIndex + 1].admission.id)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        iconOnly
                        icon={X}
                        aria-label="Return to cohort overview"
                        title="Return to overview (Escape)"
                        onClick={returnToOverview}
                      />
                    </span>
                  ) : undefined
                }
              />
              {repatNotice ? (
                <div className={styles.notice} data-testid="ward-out-of-area-repat-notice">
                  <StatusLine
                    tone="success"
                    title={repatNotice}
                    actions={
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRepatNotice(null)}
                        aria-label="Dismiss notice"
                      >
                        Dismiss
                      </Button>
                    }
                  />
                </div>
              ) : null}
              {!selected || !patientInfo ? (
                <CardBody data-testid="ward-out-of-area-subject-empty" className={styles.planEmpty}>
                  <EmptyState icon={MapIcon} title="Select a person to plan their return" />
                  {maxDaysEntry && longestPatientInfo ? (
                    <button
                      type="button"
                      className={styles.longest}
                      onClick={(event) => selectPlacement(maxDaysEntry.admission.id, event.currentTarget)}
                      aria-label={`Inspect longest case: ${longestPatientInfo.displayName}`}
                    >
                      <span className={styles.longestText}>
                        <span className={styles.secondary}>Longest away</span>
                        <span className={styles.primary}>{longestPatientInfo.displayName}</span>
                        <span className={styles.secondary}>
                          {maxDaysEntry.admission.homeRegion} ·{" "}
                          {siteByCode(maxDaysEntry.unit.siteCode)?.name ?? maxDaysEntry.unit.name}
                        </span>
                      </span>
                      <span className={styles.longestFigure}>{sinceArrivalLabel(maxDaysEntry, now)}</span>
                    </button>
                  ) : null}
                </CardBody>
              ) : (
                <>
                  <div data-testid="ward-out-of-area-subject-facts" className={styles.planFacts}>
                    <div className={styles.planIdentity}>
                      <h3 className={styles.planName}>{patientInfo.displayName}</h3>
                      <span className={styles.secondary}>
                        {profileHref ? (
                          <Link href={profileHref} className={styles.umrnLink}>
                            {patientInfo.umrn}
                          </Link>
                        ) : (
                          <span>{patientInfo.umrn}</span>
                        )}
                        <span aria-hidden="true"> · </span>
                        <span className={styles.mono}>{selected.admission.id}</span>
                      </span>
                    </div>
                    <dl className={styles.planFigures}>
                      <div>
                        <dt>Away</dt>
                        <dd>{sinceArrivalLabel(selected, now)}</dd>
                      </div>
                      <div>
                        <dt>Travel</dt>
                        <dd>{travelWord(selected)}</dd>
                      </div>
                      <div>
                        <dt>Home catchment</dt>
                        <dd>{selected.admission.homeRegion}</dd>
                      </div>
                    </dl>
                    <dl className={styles.planFacts2}>
                      <div>
                        <dt>Current placement</dt>
                        <dd>
                          {selected.unit.name} · {site?.name ?? "Site not recorded"}
                        </dd>
                      </div>
                      <div>
                        <dt>Travel band</dt>
                        <dd>{TRAVEL_BAND_LABELS[selected.band]}</dd>
                      </div>
                    </dl>
                  </div>
                  <p data-testid="ward-out-of-area-subject-caveat" className={styles.caveat}>
                    Choose a receiving hospital and confirm ward agreement.
                  </p>
                  <CardBody className={styles.planForm}>
                    <Field label="Home hospital" className={styles.formRow}>
                      <Select
                        data-testid="ward-out-of-area-repat-home-hospital"
                        value={repatDraft.homeHospital}
                        onChange={(event) =>
                          setRepatDraft((current) => ({ ...current, homeHospital: event.target.value }))
                        }
                      >
                        <option value={NO_HOME_HOSPITAL_VALUE}>Choose the home hospital</option>
                        {HOME_HOSPITAL_GROUPS.map((group) => (
                          <optgroup key={group.service} label={SERVICE_DISPLAY_NAMES[group.service] ?? group.service}>
                            {group.sites.map((hospital) => (
                              <option key={hospital.code} value={hospital.code}>
                                {hospital.name}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </Select>
                    </Field>
                    <fieldset className={styles.choiceRow} data-testid="ward-out-of-area-repat-mode">
                      <legend>Travel by</legend>
                      <span className={styles.choices}>
                        {REPAT_MODES.map((mode) => (
                          <Radio
                            key={mode}
                            name="repat-mode"
                            value={mode}
                            label={mode === "road" ? "Road" : "Flight"}
                            checked={repatDraft.mode === mode}
                            onChange={() => setRepatDraft((current) => ({ ...current, mode }))}
                          />
                        ))}
                      </span>
                    </fieldset>
                    <Field label="Provider" className={styles.formRow}>
                      <Select
                        data-testid="ward-out-of-area-repat-provider"
                        value={repatDraft.provider ?? NO_TRANSPORT_PROVIDER_VALUE}
                        onChange={(event) => {
                          const next = event.target.value;
                          setRepatDraft((current) => ({
                            ...current,
                            provider: TRANSPORT_PROVIDERS.includes(next as TransportProvider)
                              ? (next as TransportProvider)
                              : undefined,
                          }));
                        }}
                      >
                        <option value={NO_TRANSPORT_PROVIDER_VALUE}>Choose the provider</option>
                        {TRANSPORT_PROVIDERS.map((provider) => (
                          <option key={provider} value={provider}>
                            {provider}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <fieldset className={styles.choiceRow} data-testid="ward-out-of-area-repat-ward-agreed">
                      <legend>Ward agreed</legend>
                      <span className={styles.choices}>
                        {(
                          [
                            { value: true, label: "Agreed" },
                            { value: false, label: "Not yet" },
                          ] as const
                        ).map((answer) => (
                          <Radio
                            key={answer.label}
                            name="repat-ward-agreed"
                            label={answer.label}
                            checked={repatDraft.receivingWardAgreed === answer.value}
                            onChange={() =>
                              setRepatDraft((current) => ({ ...current, receivingWardAgreed: answer.value }))
                            }
                          />
                        ))}
                      </span>
                    </fieldset>
                    <fieldset className={styles.choiceRow} data-testid="ward-out-of-area-repat-legal">
                      <legend>Legal status</legend>
                      <span className={styles.choices}>
                        {TRANSPORT_LEGAL_STATUSES.map((status) => (
                          <Radio
                            key={status}
                            name="repat-legal"
                            value={status}
                            label={TRANSPORT_LEGAL_STATUS_LABELS[status]}
                            checked={repatDraft.transportLegalStatus === status}
                            onChange={() => setRepatDraft((current) => ({ ...current, transportLegalStatus: status }))}
                          />
                        ))}
                      </span>
                    </fieldset>
                    <Field label="CAD number" className={styles.formRow}>
                      <TextInput
                        data-testid="ward-out-of-area-repat-cad"
                        placeholder="CAD number"
                        autoComplete="off"
                        value={repatDraft.cadNumber}
                        onChange={(event) =>
                          setRepatDraft((current) => ({ ...current, cadNumber: event.target.value }))
                        }
                      />
                    </Field>
                    <Field label="Depart" className={styles.formRow}>
                      <TextInput
                        icon={Clock}
                        inputMode="numeric"
                        placeholder="HH:MM"
                        data-testid="ward-out-of-area-repat-estimated-time"
                        value={repatDraft.estimatedTime}
                        onChange={(event) =>
                          setRepatDraft((current) => ({ ...current, estimatedTime: event.target.value }))
                        }
                      />
                    </Field>
                    <fieldset className={styles.choiceRow} data-testid="ward-out-of-area-repat-estimated-day">
                      <legend>Depart day</legend>
                      <span className={styles.choices}>
                        {(["today", "tomorrow"] as const).map((day) => (
                          <Radio
                            key={day}
                            name="repat-estimated-day"
                            value={day}
                            label={day === "today" ? "Today" : "Tomorrow"}
                            checked={repatDraft.estimatedDay === day}
                            onChange={() => setRepatDraft((current) => ({ ...current, estimatedDay: day }))}
                          />
                        ))}
                      </span>
                    </fieldset>
                    {repatFormNotice ? (
                      <p className={styles.blocked} role="alert" data-testid="ward-out-of-area-repat-blocked">
                        <StatusGlyph tone="warning" size={9} />
                        {repatFormNotice}
                      </p>
                    ) : null}
                  </CardBody>
                  <CardFoot>
                    {profileHref ? (
                      <Link
                        className={buttonClass({ variant: "ghost" })}
                        href={profileHref}
                        aria-label="Open patient profile"
                      >
                        Profile
                      </Link>
                    ) : null}
                    <Button variant="pri" data-testid="ward-out-of-area-repat-submit" onClick={recordReturn}>
                      Record return
                    </Button>
                  </CardFoot>
                </>
              )}
            </Card>

            <Card className={styles.sideCard} aria-labelledby="ward-out-of-area-catchments-title">
              <CardHead
                id="ward-out-of-area-catchments-title"
                title="Home catchments"
                aside={<span className={styles.headNote}>People away</span>}
              />
              <CardBody>
                {homeRegionSummary.length === 0 ? (
                  <p className={styles.emptyNote}>Nobody is away from a recorded home catchment.</p>
                ) : (
                  <ul className={styles.regionList}>
                    {homeRegionSummary.map(([region, count]) => (
                      <li key={region}>
                        <button
                          type="button"
                          className={styles.regionRow}
                          onClick={() => setCatchmentFilter(catchmentFilter === region ? "all" : region)}
                          aria-pressed={catchmentFilter === region}
                          aria-label={`Filter by ${region}: ${count} placements`}
                        >
                          <span className={styles.regionName}>{region}</span>
                          <span className={styles.regionBar} aria-hidden="true">
                            <span style={{ width: `${largestRegion ? (count / largestRegion) * 100 : 0}%` }} />
                          </span>
                          <b className={styles.regionCount}>{count}</b>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
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

/**
 * How long this person has been in this bed, in whole days.
 */
export function sinceArrivalLabel(entry: OutOfAreaEntry, now: Instant): string {
  const days = daysInBed(entry.admission, now);
  if (days === null) return "Arrival not recorded";
  if (days === 0) return "Under a day";
  return `${days} ${days === 1 ? "day" : "days"}`;
}
