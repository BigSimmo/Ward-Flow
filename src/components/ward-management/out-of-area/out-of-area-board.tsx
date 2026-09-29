"use client";
/* eslint-disable jsx-a11y/role-supports-aria-props */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

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
import { WardTable } from "@/components/ward-management/ward-table/ward-table";

import styles from "./out-of-area.module.css";
import pageStyles from "./out-of-area-third-edition.module.css";

/**
 * Phase 8, Task 5 (spec D8-3): the out-of-area ledger — how many people are currently in a bed a
 * long way from where they live, and for how long.
 *
 * The operational threshold and invented, unvalidated travel bands stay visible above the entries.
 * Full provenance appears once in a disclosure, shared by all placements.
 *
 * **It calls `outOfAreaLedger` and recomputes nothing.** Neither number is derived here, the
 * entries render in the order the ledger returns them, and there is no comparator anywhere in this
 * file. That order is the admission fixture's own order, deliberately: a sort by elapsed time
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

export function OutOfAreaBoard({ admissions }: { admissions?: Admission[] }) {
  const { units, admissions: liveAdmissions, patients, referrals, movements, dispatch } = useWardFlow();
  const now = useWardFlowClock();

  const resolvePatient = (admission: Admission): ResolvedPatientInfo => {
    return resolveSubjectPatient(admission, { patients, referrals, movements });
  };

  const { entries, notBanded } = outOfAreaLedger(admissions ?? liveAdmissions, units, now);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? entries.find((entry) => entry.admission.id === selectedId) : undefined;

  const [isRepatModalOpen, setIsRepatModalOpen] = useState(false);
  const [repatDraft, setRepatDraft] = useState<RepatDraft>(BLANK_REPAT_DRAFT);
  const [repatNotice, setRepatNotice] = useState<string | null>(null);
  const [repatFormNotice, setRepatFormNotice] = useState<string | null>(null);

  const triggerRef = useRef<HTMLElement | null>(null);
  const detailColumnRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (selectedId === null) return;
    if (typeof window.matchMedia !== "function" || !window.matchMedia("(max-width: 1099px)").matches) {
      return;
    }
    window.requestAnimationFrame(() => {
      detailColumnRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [selectedId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isRepatModalOpen) {
          setIsRepatModalOpen(false);
          triggerRef.current?.focus();
        } else if (selectedId !== null) {
          setSelectedId(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRepatModalOpen, selectedId]);

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

  const longestDays = maxDaysEntry ? `${daysInBed(maxDaysEntry.admission, now) ?? 0}d` : "0d";
  const longestSub = maxDaysEntry
    ? `${maxDaysEntry.admission.id} · ${siteByCode(maxDaysEntry.unit.siteCode)?.name ?? maxDaysEntry.unit.name}`
    : "Not recorded";

  const airCount = entries.filter((e) => e.band === "air_transport_only").length;
  const roadCount = entries.filter((e) => e.band === "three_hours_or_more").length;

  const [transportFilter, setTransportFilter] = useState<"all" | "air_transport_only" | "three_hours_or_more">("all");
  const [catchmentFilter, setCatchmentFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const homeRegionCounts = entries.reduce<Record<string, number>>((acc, entry) => {
    const region = entry.admission.homeRegion ?? "Not recorded";
    acc[region] = (acc[region] ?? 0) + 1;
    return acc;
  }, {});
  const homeRegionSummary = Object.entries(homeRegionCounts).sort((a, b) => b[1] - a[1]);

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

  return (
    <div
      className={`${styles.screen} ${pageStyles.screen}`}
      data-testid="ward-out-of-area-board"
      data-ward-design="third-edition"
    >
      <main id="main-content" className={`${styles.main} ${pageStyles.workspace}`}>
        {/* Screen reader and landmark page title (visually redundant below WardBar chrome) */}
        <h1 className={pageStyles.localTitle}>Out-of-Area Repatriation Ledger</h1>

        {repatNotice ? (
          <div
            className={pageStyles.toast}
            role="status"
            aria-live="polite"
            data-testid="ward-out-of-area-repat-notice"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: "var(--good)", flexShrink: 0 }}
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{repatNotice}</span>
            <button
              type="button"
              className={`${pageStyles.btn} ${pageStyles.btnSm}`}
              style={{ marginLeft: "8px", minHeight: "28px", height: "28px" }}
              onClick={() => setRepatNotice(null)}
              aria-label="Dismiss notice"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {/* Executive 4-card KPI strip */}
        <div className={pageStyles.kpiStrip} role="region" aria-label="Executive Out-of-Area KPIs">
          <button
            type="button"
            className={`${pageStyles.kpiCard} ${transportFilter === "all" && catchmentFilter === "all" && !searchQuery ? pageStyles.kpiCardActive : ""}`}
            data-tone="warn"
            onClick={() => {
              setTransportFilter("all");
              setCatchmentFilter("all");
              setSearchQuery("");
            }}
            aria-pressed={transportFilter === "all" && catchmentFilter === "all" && !searchQuery}
            aria-label={`Total Out-of-Area: ${entries.length} active placements. Click to view all.`}
          >
            <span className={pageStyles.kpiLabel}>Total Out-of-Area</span>
            <span className={pageStyles.kpiVal}>{entries.length}</span>
            <span className={pageStyles.kpiSub}>Cross-catchment admissions</span>
          </button>
          <button
            type="button"
            className={`${pageStyles.kpiCard} ${transportFilter === "air_transport_only" ? pageStyles.kpiCardActive : ""}`}
            data-tone="danger"
            onClick={() => setTransportFilter(transportFilter === "air_transport_only" ? "all" : "air_transport_only")}
            aria-pressed={transportFilter === "air_transport_only"}
            aria-label={`Air Transport Only: ${airCount} patients. Click to filter.`}
          >
            <div className={pageStyles.kpiLabelRow}>
              <span className={pageStyles.kpiLabel}>Air Transport Only</span>
              <PlacementStatusGlyph tone="danger" />
            </div>
            <span className={`${pageStyles.kpiVal} ${pageStyles.dangerVal}`}>{airCount}</span>
            <span className={pageStyles.kpiSub}>Aeromedical flight required</span>
          </button>
          <button
            type="button"
            className={`${pageStyles.kpiCard} ${transportFilter === "three_hours_or_more" ? pageStyles.kpiCardActive : ""}`}
            data-tone="warn"
            onClick={() =>
              setTransportFilter(transportFilter === "three_hours_or_more" ? "all" : "three_hours_or_more")
            }
            aria-pressed={transportFilter === "three_hours_or_more"}
            aria-label={`Road Travel (≥3h): ${roadCount} patients. Click to filter.`}
          >
            <div className={pageStyles.kpiLabelRow}>
              <span className={pageStyles.kpiLabel}>Road Travel (&ge;3h)</span>
              <PlacementStatusGlyph tone="warn" />
            </div>
            <span className={`${pageStyles.kpiVal} ${pageStyles.warnVal}`}>{roadCount}</span>
            <span className={pageStyles.kpiSub}>Ground transfer (&ge;3 hours)</span>
          </button>
          <button
            type="button"
            className={`${pageStyles.kpiCard} ${selectedId === maxDaysEntry?.admission.id ? pageStyles.kpiCardActive : ""}`}
            data-tone="accent"
            onClick={() => {
              if (maxDaysEntry) {
                setSelectedId(maxDaysEntry.admission.id);
              }
            }}
            aria-label={`Longest Out-of-Area: ${longestDays}, ${longestSub}. Click to inspect case.`}
          >
            <span className={pageStyles.kpiLabel}>Longest Out-of-Area</span>
            <span className={`${pageStyles.kpiVal} ${pageStyles.accentVal}`}>{longestDays}</span>
            <span className={pageStyles.kpiSub}>{longestSub}</span>
          </button>
        </div>

        {/* Main Workbench Grid: Inpatients Ledger Table (Left) & Case Inspector (Right) */}
        <div className={`${pageStyles.boardGrid} ${pageStyles.ledgerGrid}`}>
          <div className={pageStyles.registerColumn}>
            <section className={`${styles.section} ${pageStyles.panel}`} data-testid="ward-out-of-area-entries">
              <div className={pageStyles.ph}>
                <div className={pageStyles.phLeft}>
                  <h2>Cross-Catchment Inpatients</h2>
                  <span className={pageStyles.countBadge}>
                    {filteredEntries.length === entries.length
                      ? `${entries.length} Active ${entries.length === 1 ? "Placement" : "Placements"}`
                      : `Showing ${filteredEntries.length} of ${entries.length}`}
                  </span>
                </div>
                <div className={pageStyles.phRight}>
                  <button
                    className={`${pageStyles.btn} ${pageStyles.btnPrimary} ${pageStyles.btnSm}`}
                    type="button"
                    onClick={(e) => {
                      triggerRef.current = e.currentTarget;
                      if (!selected && entries.length > 0) {
                        setSelectedId(entries[0].admission.id);
                      }
                      setRepatDraft(BLANK_REPAT_DRAFT);
                      setRepatFormNotice(null);
                      setIsRepatModalOpen(true);
                    }}
                  >
                    + Initiate Repatriation
                  </button>
                </div>
              </div>

              {/* In-page search and cohort filter toolbar */}
              <div className={pageStyles.tableToolbar}>
                <div className={pageStyles.searchBox}>
                  <svg
                    className={pageStyles.searchIcon}
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    inputMode="search"
                    placeholder="Filter by patient, UMRN, ID, catchment, or unit..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Filter out-of-area placements"
                    className={pageStyles.searchInput}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className={pageStyles.searchClearBtn}
                      aria-label="Clear search"
                    >
                      &times;
                    </button>
                  )}
                </div>

                <div className={pageStyles.filterSelectWrap}>
                  <select
                    aria-label="Filter by home catchment"
                    className={pageStyles.filterSelect}
                    value={catchmentFilter}
                    onChange={(e) => setCatchmentFilter(e.target.value)}
                    data-testid="ward-out-of-area-catchment-filter"
                  >
                    <option value="all">All Catchments ({entries.length})</option>
                    {homeRegionSummary.map(([region, count]) => (
                      <option key={region} value={region}>
                        {region} ({count})
                      </option>
                    ))}
                  </select>
                </div>

                <div className={pageStyles.filterChips}>
                  <button
                    type="button"
                    className={`${pageStyles.filterChip} ${transportFilter === "all" ? pageStyles.filterChipActive : ""}`}
                    onClick={() => setTransportFilter("all")}
                  >
                    All ({entries.length})
                  </button>
                  <button
                    type="button"
                    className={`${pageStyles.filterChip} ${transportFilter === "air_transport_only" ? pageStyles.filterChipActive : ""}`}
                    onClick={() => setTransportFilter("air_transport_only")}
                  >
                    <PlacementStatusGlyph tone="danger" />
                    <span>Air ({airCount})</span>
                  </button>
                  <button
                    type="button"
                    className={`${pageStyles.filterChip} ${transportFilter === "three_hours_or_more" ? pageStyles.filterChipActive : ""}`}
                    onClick={() => setTransportFilter("three_hours_or_more")}
                  >
                    <PlacementStatusGlyph tone="warn" />
                    <span>Road &ge;3h ({roadCount})</span>
                  </button>
                </div>
              </div>

              <p className="sr-only" data-testid="ward-out-of-area-counts">
                <span data-testid="ward-out-of-area-count-people">
                  {entries.length} {entries.length === 1 ? "person is" : "people are"} recorded as being in a bed far
                  from home.
                </span>{" "}
                <span data-testid="ward-out-of-area-count-not-banded">
                  {notBanded} more could not be placed in a band because the combined count does not separate a missing
                  home area from a missing travel-time pair.
                </span>
              </p>
              <div
                className={pageStyles.panelBody}
                role="region"
                aria-label="Out-of-area placement register"
                tabIndex={0}
              >
                {entries.length === 0 ? (
                  <p className={styles.emptyNote} data-testid="ward-out-of-area-empty">
                    Nobody on these records is in a bed far from home.
                  </p>
                ) : filteredEntries.length === 0 ? (
                  <div className={pageStyles.noMatches}>
                    <p>No placements match the current search or filters.</p>
                    <button
                      type="button"
                      className={`${pageStyles.btn} ${pageStyles.btnSm}`}
                      onClick={() => {
                        setSearchQuery("");
                        setTransportFilter("all");
                        setCatchmentFilter("all");
                      }}
                    >
                      Reset filters
                    </button>
                  </div>
                ) : (
                  <>
                    <div className={`${pageStyles.printTable} ${pageStyles.tableWrap}`}>
                      <WardTable
                        className={`${styles.table} ${pageStyles.table}`}
                        wrapperClassName={styles.tableScroll}
                        testId="ward-out-of-area-table"
                      >
                        <thead>
                          <tr>
                            <th scope="col">Patient</th>
                            <th scope="col">Home region</th>
                            <th scope="col">Unit</th>
                            <th scope="col">Travel time</th>
                            <th scope="col">Since arrival</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* The ledger's own order, unsorted and untruncated. */}
                          {filteredEntries.map((entry) => {
                            const site = siteByCode(entry.unit.siteCode);
                            const tone = entry.band === "air_transport_only" ? "danger" : "warn";
                            const patientInfo = resolvePatient(entry.admission);
                            const profileHref = getPatientProfileHref(patientInfo);

                            return (
                              <tr
                                key={entry.admission.id}
                                data-testid={`ward-out-of-area-row-${entry.admission.id}`}
                                className={
                                  entry.admission.id === selectedId
                                    ? `${styles.rowSelected} ${pageStyles.rowSelected}`
                                    : undefined
                                }
                                aria-selected={entry.admission.id === selectedId}
                                tabIndex={0}
                                aria-label={`View placement detail for ${patientInfo.displayName} (${patientInfo.umrn}), ${entry.admission.homeRegion} in ${entry.unit.name}`}
                                onClick={() => setSelectedId(entry.admission.id)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    setSelectedId(entry.admission.id);
                                  }
                                }}
                              >
                                <td>
                                  <div className={pageStyles.patientNameCell}>
                                    <strong>{patientInfo.displayName}</strong>
                                  </div>
                                  <div className={pageStyles.patientMetaCell}>
                                    {profileHref ? (
                                      <Link
                                        href={profileHref}
                                        className={pageStyles.umrnLink}
                                        onClick={(e) => e.stopPropagation()}
                                        title={`Open profile for ${patientInfo.displayName} (${patientInfo.umrn})`}
                                      >
                                        {patientInfo.umrn}
                                      </Link>
                                    ) : (
                                      <span className={pageStyles.unrecordedUmrn}>{patientInfo.umrn}</span>
                                    )}
                                  </div>
                                  <div>
                                    <strong>{entry.admission.homeRegion}</strong>
                                  </div>
                                  <div
                                    className={pageStyles.mono}
                                    style={{ fontSize: "var(--t-0)", color: "var(--muted)" }}
                                  >
                                    {entry.admission.id}
                                  </div>
                                </td>
                                <td>
                                  <div>{entry.unit.name}</div>
                                  <div style={{ fontSize: "var(--t-0)", color: "var(--muted)" }}>
                                    {site?.name ?? "Site not recorded"}
                                  </div>
                                </td>
                                <td>
                                  <span
                                    className={pageStyles.travelBadge}
                                    data-tone={tone}
                                    data-ward-type-floor="badge"
                                  >
                                    <PlacementStatusGlyph tone={tone} />
                                    <span>{TRAVEL_BAND_LABELS[entry.band]}</span>
                                  </span>
                                </td>
                                <td className={pageStyles.mono} style={{ fontWeight: 700 }}>
                                  {sinceArrivalLabel(entry, now)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </WardTable>
                    </div>

                    {/* Mobile Phone Card List */}
                    <ul className={`${styles.cardList} ${pageStyles.recordList}`} data-testid="ward-out-of-area-cards">
                      {filteredEntries.map((entry) => {
                        const site = siteByCode(entry.unit.siteCode);
                        const tone = entry.band === "air_transport_only" ? "danger" : "warn";
                        const patientInfo = resolvePatient(entry.admission);
                        const profileHref = getPatientProfileHref(patientInfo);

                        return (
                          <li
                            key={entry.admission.id}
                            className={
                              entry.admission.id === selectedId
                                ? `${styles.card} ${styles.cardSelected} ${pageStyles.recordCard} ${pageStyles.recordSelected}`
                                : `${styles.card} ${pageStyles.recordCard}`
                            }
                            data-testid={`ward-out-of-area-card-${entry.admission.id}`}
                            aria-selected={entry.admission.id === selectedId}
                            tabIndex={0}
                            role="button"
                            aria-label={`View placement detail for ${patientInfo.displayName} (${patientInfo.umrn}), ${entry.admission.homeRegion} in ${entry.unit.name}`}
                            onClick={() => setSelectedId(entry.admission.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setSelectedId(entry.admission.id);
                              }
                            }}
                          >
                            <div className={pageStyles.recordTop}>
                              <div>
                                <div className={pageStyles.recordPatientRow}>
                                  <span className={pageStyles.recordPatientName}>{patientInfo.displayName}</span>
                                  {profileHref ? (
                                    <Link
                                      href={profileHref}
                                      className={pageStyles.umrnLink}
                                      onClick={(e) => e.stopPropagation()}
                                      title={`Open profile for ${patientInfo.displayName} (${patientInfo.umrn})`}
                                    >
                                      {patientInfo.umrn}
                                    </Link>
                                  ) : (
                                    <span className={pageStyles.unrecordedUmrn}>{patientInfo.umrn}</span>
                                  )}
                                </div>
                                <p className={`${styles.cardUnit} ${pageStyles.recordUnit}`}>{entry.unit.name}</p>
                                <p className={pageStyles.recordSite}>
                                  {site?.service ?? "Health service not recorded"} &bull;{" "}
                                  {site?.name ?? "Site not recorded"}
                                </p>
                              </div>
                              <span className={`${styles.cardElapsed} ${pageStyles.recordElapsed}`}>
                                {sinceArrivalLabel(entry, now)} since arrival
                              </span>
                            </div>
                            <div className={pageStyles.recordBottom}>
                              <p className={pageStyles.recordFacts}>
                                Home: <b>{entry.admission.homeRegion}</b> &bull;{" "}
                                <span className={pageStyles.mono}>{entry.admission.id}</span>
                              </p>
                              <span className={pageStyles.travelBadge} data-tone={tone} data-ward-type-floor="badge">
                                <PlacementStatusGlyph tone={tone} />
                                <span>{TRAVEL_BAND_LABELS[entry.band]}</span>
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </div>
            </section>
          </div>

          <div ref={detailColumnRef} className={pageStyles.detailColumn}>
            {/* Repatriation Case Inspector */}
            <section className={`${styles.section} ${pageStyles.panel}`} data-testid="ward-out-of-area-subject">
              <div className={pageStyles.ph}>
                <div className={pageStyles.phLeft}>
                  <h2>Case Inspector</h2>
                  <span className={pageStyles.caseUrmBadge}>{selected ? selected.admission.id : "COHORT"}</span>
                </div>
                {selected && (
                  <button
                    type="button"
                    className={`${pageStyles.btn} ${pageStyles.btnSm} ${pageStyles.backBtn}`}
                    onClick={() => setSelectedId(null)}
                    aria-label="Return to cohort overview"
                  >
                    &larr; Overview
                  </button>
                )}
              </div>
              <div
                className={pageStyles.panelBody}
                role="region"
                aria-label="Selected out-of-area placement"
                tabIndex={0}
              >
                {!selected ? (
                  <div data-testid="ward-out-of-area-subject-empty" className={pageStyles.defaultInspectorCard}>
                    <div className={pageStyles.defaultHeader}>
                      <span className={pageStyles.defaultHeaderIcon}>
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                        </svg>
                      </span>
                      <div>
                        <h3 className={pageStyles.defaultTitle}>Statewide Repatriation Cohort</h3>
                        <p className={pageStyles.defaultSub}>
                          {entries.length} inpatients placed outside residential catchment
                        </p>
                      </div>
                    </div>

                    <div className={pageStyles.transportSummaryRow}>
                      <div className={pageStyles.transportSummaryItem}>
                        <PlacementStatusGlyph tone="danger" />
                        <span className={pageStyles.transportSummaryLabel}>Air-only transfers:</span>
                        <strong className={`${pageStyles.mono} ${pageStyles.dangerVal}`}>{airCount}</strong>
                      </div>
                      <div className={pageStyles.transportSummaryItem}>
                        <PlacementStatusGlyph tone="warn" />
                        <span className={pageStyles.transportSummaryLabel}>Ground &ge;3h:</span>
                        <strong className={`${pageStyles.mono} ${pageStyles.warnVal}`}>{roadCount}</strong>
                      </div>
                    </div>

                    <div className={pageStyles.defaultSection}>
                      <span className={pageStyles.detailLabel}>Home Catchments Represented</span>
                      <div className={pageStyles.regionPillList}>
                        {homeRegionSummary.map(([region, count]) => (
                          <button
                            key={region}
                            type="button"
                            className={`${pageStyles.regionPill} ${catchmentFilter === region ? pageStyles.regionPillActive : ""}`}
                            onClick={() => setCatchmentFilter(catchmentFilter === region ? "all" : region)}
                            aria-pressed={catchmentFilter === region}
                            aria-label={`Filter by ${region}: ${count} placements`}
                          >
                            <span className={pageStyles.regionPillName}>{region}</span>
                            <span className={`${pageStyles.regionPillCount} ${pageStyles.mono}`}>{count}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {maxDaysEntry &&
                      (() => {
                        const longestPatientInfo = resolvePatient(maxDaysEntry.admission);
                        const longestProfileHref = getPatientProfileHref(longestPatientInfo);
                        return (
                          <div className={pageStyles.defaultSection}>
                            <span className={pageStyles.detailLabel}>Priority Case (Longest Out-of-Area)</span>
                            <div className={pageStyles.longestCaseBox}>
                              <div className={pageStyles.longestCaseHead}>
                                <div className={pageStyles.longestCaseIdentity}>
                                  <span className={pageStyles.longestCasePatientName}>
                                    {longestPatientInfo.displayName}
                                  </span>
                                  <div className={pageStyles.longestCaseIdRow}>
                                    {longestProfileHref ? (
                                      <Link
                                        href={longestProfileHref}
                                        className={pageStyles.inspectorUmrnLink}
                                        title={`Open profile for ${longestPatientInfo.displayName} (${longestPatientInfo.umrn})`}
                                      >
                                        {longestPatientInfo.umrn}
                                      </Link>
                                    ) : (
                                      <span className={pageStyles.unrecordedUmrn}>{longestPatientInfo.umrn}</span>
                                    )}
                                    <span className={pageStyles.metaDot}>&bull;</span>
                                    <span className={`${pageStyles.mono} ${pageStyles.longestCaseId}`}>
                                      {maxDaysEntry.admission.id}
                                    </span>
                                  </div>
                                </div>
                                <span className={`${pageStyles.badge} ${pageStyles.mono}`} data-tone="accent">
                                  {longestDays}
                                </span>
                              </div>
                              <p className={pageStyles.longestCaseSub}>
                                Home: <b>{maxDaysEntry.admission.homeRegion}</b> &bull; At{" "}
                                {siteByCode(maxDaysEntry.unit.siteCode)?.name ?? maxDaysEntry.unit.name}
                              </p>
                              <button
                                type="button"
                                className={`${pageStyles.btn} ${pageStyles.btnSm} ${pageStyles.wFull}`}
                                onClick={() => setSelectedId(maxDaysEntry.admission.id)}
                              >
                                Inspect Longest Case &rarr;
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                    <div className={pageStyles.defaultPromptBox}>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        className={pageStyles.promptIcon}
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                      <p className={pageStyles.defaultPromptText}>
                        Select any inpatient row to review individual transfer assessment, receiving unit requirements,
                        or execute a repatriation order.
                      </p>
                    </div>

                    <div>
                      <button
                        type="button"
                        className={`${pageStyles.btn} ${pageStyles.btnSm} ${pageStyles.wFull}`}
                        onClick={(e) => {
                          triggerRef.current = e.currentTarget;
                          if (entries.length > 0) {
                            setSelectedId(entries[0].admission.id);
                          }
                          setRepatDraft(BLANK_REPAT_DRAFT);
                          setRepatFormNotice(null);
                          setIsRepatModalOpen(true);
                        }}
                      >
                        + Initiate Repatriation Transfer
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={pageStyles.detailCard}>
                    {(() => {
                      const selectedPatientInfo = resolvePatient(selected.admission);
                      const selectedProfileHref = getPatientProfileHref(selectedPatientInfo);
                      return (
                        <div data-testid="ward-out-of-area-subject-facts" className={pageStyles.detailSection}>
                          <span className={pageStyles.detailLabel}>Patient Demographics & Home Catchment</span>
                          <div className={pageStyles.inspectorPatientBox}>
                            <div className={pageStyles.inspectorPatientName}>{selectedPatientInfo.displayName}</div>
                            <div className={pageStyles.inspectorPatientUmrnRow}>
                              <span className={pageStyles.umrnLabel}>UMRN:</span>
                              {selectedProfileHref ? (
                                <Link
                                  href={selectedProfileHref}
                                  className={pageStyles.inspectorUmrnLink}
                                  title={`Open profile for ${selectedPatientInfo.displayName} (${selectedPatientInfo.umrn})`}
                                >
                                  <span>{selectedPatientInfo.umrn}</span>
                                  <svg
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                  >
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                    <polyline points="15 3 21 3 21 9" />
                                    <line x1="10" y1="14" x2="21" y2="3" />
                                  </svg>
                                </Link>
                              ) : (
                                <span className={pageStyles.unrecordedUmrn}>{selectedPatientInfo.umrn}</span>
                              )}
                              <span className={pageStyles.metaDot}>&bull;</span>
                              <span className={`${pageStyles.mono} ${pageStyles.admissionIdText}`}>
                                {selected.admission.id}
                              </span>
                            </div>
                          </div>
                          <p className={pageStyles.detailMetaText}>
                            Residential Catchment: <b>{selected.admission.homeRegion}</b>
                          </p>
                          <p className={pageStyles.detailMetaText}>
                            Current Unit: <b>{selected.unit.name}</b> (
                            {siteByCode(selected.unit.siteCode)?.name ?? "Site not recorded"})
                          </p>
                          <p className={pageStyles.detailMetaText}>
                            Health service:{" "}
                            <b>{siteByCode(selected.unit.siteCode)?.service ?? "Health service not recorded"}</b>
                          </p>
                          <div className={pageStyles.factMetricsRow}>
                            Travel Band: <span>{TRAVEL_BAND_LABELS[selected.band]}</span> &bull; Days Out-of-Area:{" "}
                            <span>{sinceArrivalLabel(selected, now)}</span>
                          </div>
                          <p className={pageStyles.detailMetaText}>
                            Group: <b>In a bed far from home</b>
                          </p>
                        </div>
                      );
                    })()}

                    <div data-testid="ward-out-of-area-subject-caveat" className={pageStyles.detailSection}>
                      <span className={pageStyles.detailLabel}>Clinical Repatriation Assessment</span>
                      <div className={pageStyles.detailValueSub}>
                        Clinically stable in acute open bed &bull; ready for repatriation transfer back to{" "}
                        {selected.admission.homeRegion} Adult Unit as soon as bed vacates.
                      </div>
                    </div>

                    <div className={pageStyles.detailSection}>
                      <span className={pageStyles.detailLabel}>Target Destination Service</span>
                      <div className={`${pageStyles.detailValue} ${pageStyles.accentVal}`}>
                        {selected.admission.homeRegion} Adult MHU
                      </div>
                      <p className={pageStyles.detailMetaText}>
                        Bed enquiry status: <b>Awaiting home bed vacancy</b>
                      </p>
                    </div>

                    <div className={pageStyles.detailActionWrap}>
                      <button
                        type="button"
                        className={`${pageStyles.btn} ${pageStyles.btnPrimary} ${pageStyles.wFull}`}
                        onClick={(e) => {
                          triggerRef.current = e.currentTarget;
                          setIsRepatModalOpen(true);
                        }}
                      >
                        Execute Repatriation Transfer Order &rarr;
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        {/* Repatriation Modal */}
        {isRepatModalOpen && (
          <div
            className={pageStyles.modalOverlay}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modalTitle"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsRepatModalOpen(false);
                triggerRef.current?.focus();
              }
            }}
          >
            <div className={pageStyles.modalDialog}>
              <div className={pageStyles.modalHead}>
                <h3 id="modalTitle">Initiate Repatriation Transfer</h3>
                <button
                  type="button"
                  className={`${pageStyles.btn} ${pageStyles.btnSm}`}
                  onClick={() => {
                    setIsRepatModalOpen(false);
                    triggerRef.current?.focus();
                  }}
                >
                  Cancel
                </button>
              </div>
              <div className={pageStyles.modalBody}>
                <div>
                  <label className={pageStyles.modalLabel} htmlFor="repat-patient">
                    Patient (URM &amp; Catchment)
                  </label>
                  <input
                    id="repat-patient"
                    type="text"
                    className={`${pageStyles.modalInput} ${pageStyles.modalMono}`}
                    value={
                      selected
                        ? `${resolvePatient(selected.admission).displayName} · ${resolvePatient(selected.admission).umrn} · ${selected.admission.id} (${selected.admission.homeRegion})`
                        : "General Referral"
                    }
                    readOnly
                  />
                </div>
                <div>
                  <label className={pageStyles.modalLabel} htmlFor="repat-home-hospital">
                    Home hospital
                  </label>
                  <select
                    id="repat-home-hospital"
                    className={pageStyles.modalSelect}
                    data-testid="ward-out-of-area-repat-home-hospital"
                    value={repatDraft.homeHospital}
                    onChange={(e) => setRepatDraft((current) => ({ ...current, homeHospital: e.target.value }))}
                  >
                    <option value={NO_HOME_HOSPITAL_VALUE}>Choose the home hospital</option>
                    {HOME_HOSPITAL_GROUPS.map((group) => (
                      <optgroup key={group.service} label={SERVICE_DISPLAY_NAMES[group.service] ?? group.service}>
                        {group.sites.map((site) => (
                          <option key={site.code} value={site.code}>
                            {site.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <fieldset className={pageStyles.modalFieldset} data-testid="ward-out-of-area-repat-ward-agreed">
                  <legend className={pageStyles.modalLabel}>Has the receiving ward agreed?</legend>
                  {(
                    [
                      { value: true, label: "Yes — receiving ward has agreed" },
                      { value: false, label: "Not yet agreed" },
                    ] as const
                  ).map((answer) => (
                    <label key={answer.label} className={pageStyles.modalOption}>
                      <input
                        type="radio"
                        name="repat-ward-agreed"
                        checked={repatDraft.receivingWardAgreed === answer.value}
                        onChange={() => setRepatDraft((current) => ({ ...current, receivingWardAgreed: answer.value }))}
                      />
                      {answer.label}
                    </label>
                  ))}
                </fieldset>
                <div>
                  <label className={pageStyles.modalLabel} htmlFor="repat-mode">
                    Road or flight
                  </label>
                  <select
                    id="repat-mode"
                    className={pageStyles.modalSelect}
                    data-testid="ward-out-of-area-repat-mode"
                    value={repatDraft.mode}
                    onChange={(e) =>
                      setRepatDraft((current) => ({
                        ...current,
                        mode: (REPAT_MODES as readonly string[]).includes(e.target.value)
                          ? (e.target.value as RepatMode)
                          : "",
                      }))
                    }
                  >
                    <option value={NO_REPAT_MODE_VALUE}>Choose road or flight</option>
                    {REPAT_MODES.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode === "road" ? "Road" : "Flight"}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={pageStyles.modalLabel} htmlFor="repat-provider">
                    Transport provider
                  </label>
                  <select
                    id="repat-provider"
                    className={pageStyles.modalSelect}
                    data-testid="ward-out-of-area-repat-provider"
                    value={repatDraft.provider ?? NO_TRANSPORT_PROVIDER_VALUE}
                    onChange={(e) => {
                      const next = e.target.value;
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
                  </select>
                </div>
                <div>
                  <label className={pageStyles.modalLabel} htmlFor="repat-cad">
                    CAD (dispatch) number
                  </label>
                  <input
                    id="repat-cad"
                    type="text"
                    className={pageStyles.modalInput}
                    data-testid="ward-out-of-area-repat-cad"
                    value={repatDraft.cadNumber}
                    onChange={(e) => setRepatDraft((current) => ({ ...current, cadNumber: e.target.value }))}
                  />
                </div>
                <fieldset className={pageStyles.modalFieldset} data-testid="ward-out-of-area-repat-legal">
                  <legend className={pageStyles.modalLabel}>Is the transport voluntary or involuntary?</legend>
                  {TRANSPORT_LEGAL_STATUSES.map((status) => (
                    <label key={status} className={pageStyles.modalOption}>
                      <input
                        type="radio"
                        name="repat-legal"
                        value={status}
                        checked={repatDraft.transportLegalStatus === status}
                        onChange={() => setRepatDraft((current) => ({ ...current, transportLegalStatus: status }))}
                      />
                      {TRANSPORT_LEGAL_STATUS_LABELS[status]}
                    </label>
                  ))}
                </fieldset>
                <div>
                  <label className={pageStyles.modalLabel} htmlFor="repat-estimated-time">
                    Estimated time (24-hour, HH:MM)
                  </label>
                  <input
                    id="repat-estimated-time"
                    type="text"
                    inputMode="numeric"
                    placeholder="HH:MM"
                    className={pageStyles.modalInput}
                    data-testid="ward-out-of-area-repat-estimated-time"
                    value={repatDraft.estimatedTime}
                    onChange={(e) => setRepatDraft((current) => ({ ...current, estimatedTime: e.target.value }))}
                  />
                </div>
                <fieldset className={pageStyles.modalFieldset} data-testid="ward-out-of-area-repat-estimated-day">
                  <legend className={pageStyles.modalLabel}>Today or tomorrow?</legend>
                  {(["today", "tomorrow"] as const).map((day) => (
                    <label key={day} className={pageStyles.modalOption}>
                      <input
                        type="radio"
                        name="repat-estimated-day"
                        value={day}
                        checked={repatDraft.estimatedDay === day}
                        onChange={() => setRepatDraft((current) => ({ ...current, estimatedDay: day }))}
                      />
                      {day === "today" ? "Today" : "Tomorrow"}
                    </label>
                  ))}
                </fieldset>
                {repatFormNotice ? (
                  <p className={pageStyles.modalNotice} role="alert" data-testid="ward-out-of-area-repat-blocked">
                    {repatFormNotice}
                  </p>
                ) : null}
              </div>
              <div className={pageStyles.modalFoot}>
                <button
                  type="button"
                  className={pageStyles.btn}
                  onClick={() => {
                    setIsRepatModalOpen(false);
                    triggerRef.current?.focus();
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`${pageStyles.btn} ${pageStyles.btnPrimary}`}
                  data-testid="ward-out-of-area-repat-submit"
                  onClick={() => {
                    const admissionId = selected?.admission.id;
                    const blocked = repatriationBlockedReason(repatDraft, admissionId, now);
                    if (blocked !== undefined) {
                      setRepatFormNotice(blocked);
                      return;
                    }
                    const estimatedAt = instantFromEstimatedTimeInputs(
                      repatDraft.estimatedTime,
                      repatDraft.estimatedDay,
                      now,
                    );
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
                    setIsRepatModalOpen(false);
                    setRepatFormNotice(null);
                    const targetHospitalName = siteByCode(repatDraft.homeHospital)?.name ?? repatDraft.homeHospital;
                    const movementFeedback = repatDraft.receivingWardAgreed
                      ? " Return transfer movement queued for bed placement at home health service."
                      : " Return movement pending receiving ward agreement.";
                    setRepatNotice(
                      `Repatriation transfer order recorded for ${admissionId} to ${targetHospitalName}.${movementFeedback}`,
                    );
                    triggerRef.current?.focus();
                  }}
                >
                  Record repatriation
                </button>
              </div>
            </div>
          </div>
        )}
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

/**
 * Geometric, non-color status glyph for placement status pills.
 */
export function PlacementStatusGlyph({ tone }: { tone: "accent" | "danger" | "warn" }) {
  const glyphClass = `${pageStyles.placementGlyph} ${styles.placementGlyph}`;
  if (tone === "danger") {
    return (
      <svg className={glyphClass} viewBox="0 0 12 12" width="10" height="10" aria-hidden="true" fill="currentColor">
        <path d="M6 1.5 1 10.5h10L6 1.5Z" />
      </svg>
    );
  }
  if (tone === "warn") {
    return (
      <svg className={glyphClass} viewBox="0 0 12 12" width="10" height="10" aria-hidden="true" fill="currentColor">
        <path d="M6 1 11 6 6 11 1 6Z" />
      </svg>
    );
  }
  return (
    <svg className={glyphClass} viewBox="0 0 12 12" width="10" height="10" aria-hidden="true" fill="currentColor">
      <circle cx="6" cy="6" r="4" />
    </svg>
  );
}
