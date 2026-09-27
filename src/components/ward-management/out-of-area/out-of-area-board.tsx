"use client";

import { useEffect, useRef, useState } from "react";

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
  if (draft.cadNumber.trim().length === 0) missing.push("enter the tracking or CAD number");
  if (draft.transportLegalStatus === undefined) {
    missing.push("state whether the transport is voluntary or involuntary");
  }
  if (instantFromEstimatedTimeInputs(draft.estimatedTime, draft.estimatedDay, now) === undefined) {
    missing.push("enter the estimated time");
  }
  if (missing.length === 0) return undefined;
  return `Before recording, ${missing.join(", ")}. None is filled in for you.`;
}

export function OutOfAreaBoard({ admissions }: { admissions?: Admission[] }) {
  const { units, admissions: liveAdmissions, dispatch } = useWardFlow();
  const now = useWardFlowClock();
  const { entries, notBanded } = outOfAreaLedger(admissions ?? liveAdmissions, units, now);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? entries.find((entry) => entry.admission.id === selectedId) : undefined;

  const [isRepatModalOpen, setIsRepatModalOpen] = useState(false);
  const [repatDraft, setRepatDraft] = useState<RepatDraft>(BLANK_REPAT_DRAFT);
  const [repatNotice, setRepatNotice] = useState<string | null>(null);
  const [repatFormNotice, setRepatFormNotice] = useState<string | null>(null);

  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isRepatModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsRepatModalOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRepatModalOpen]);

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
    ? `${maxDaysEntry.admission.id} at ${siteByCode(maxDaysEntry.unit.siteCode)?.name ?? maxDaysEntry.unit.name}`
    : "Not recorded";

  // "Far Placements (>35km)" and "Repatriation Ready" say "Not recorded" (25 Sept 2026): no record
  // holds a distance in km or a readiness to go home. They counted air-only-or-7-days and
  // 3-days-in-bed, thresholds with no source.

  return (
    <div
      className={`${styles.screen} ${pageStyles.screen}`}
      data-testid="ward-out-of-area-board"
      data-ward-design="third-edition"
    >
      <main id="main-content" className={`${styles.main} ${pageStyles.workspace}`}>
        <header className={pageStyles.pageHeader}>
          <div className={pageStyles.pageHeaderRow}>
            <div className={pageStyles.hdrTitle}>
              <h1 className={`${styles.pageTitle} ${pageStyles.hdrTitleText}`}>Out-of-Area Repatriation Ledger</h1>
              <span className={pageStyles.chipMark} title="Catchment Egress">
                Catchment Egress
              </span>
            </div>
            <div className={pageStyles.pageHeaderActions}>
              <button
                className={`${pageStyles.btn} ${pageStyles.btnPrimary}`}
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
        </header>

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
        <div className={pageStyles.kpiStrip}>
          <div className={pageStyles.kpiCard} data-tone="warn">
            <span className={pageStyles.kpiLabel}>Total Out-of-Area</span>
            <span className={pageStyles.kpiVal}>{entries.length}</span>
            <span className={pageStyles.kpiSub}>Cross-HSP Admissions</span>
          </div>
          <div className={pageStyles.kpiCard} data-tone="danger">
            <span className={pageStyles.kpiLabel}>Far Placements (&gt;35km)</span>
            <span className={pageStyles.kpiVal}>Not recorded</span>
            <span className={pageStyles.kpiSub}>Family Travel Barrier</span>
          </div>
          <div className={pageStyles.kpiCard} data-tone="good">
            <span className={pageStyles.kpiLabel}>Repatriation Ready</span>
            <span className={pageStyles.kpiVal} id="kpiRepatReady">
              Not recorded
            </span>
            <span className={pageStyles.kpiSub}>Awaiting Home Bed Vacancy</span>
          </div>
          <div className={pageStyles.kpiCard} data-tone="accent">
            <span className={pageStyles.kpiLabel}>Longest Out-of-Area</span>
            <span className={pageStyles.kpiVal}>{longestDays}</span>
            <span className={pageStyles.kpiSub}>{longestSub}</span>
          </div>
        </div>

        {/* Main Workbench Grid: Inpatients Ledger Table (Left) & Case Inspector (Right) */}
        <div className={`${pageStyles.boardGrid} ${pageStyles.ledgerGrid}`}>
          <div className={pageStyles.registerColumn}>
            <section className={`${styles.section} ${pageStyles.panel}`} data-testid="ward-out-of-area-entries">
              <div className={pageStyles.ph}>
                <h2>Cross-Catchment Inpatients</h2>
                <span className={pageStyles.mono} style={{ fontSize: "var(--t-0)", color: "var(--muted)" }}>
                  {entries.length} Active {entries.length === 1 ? "Placement" : "Placements"}
                </span>
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
                            <th scope="col">Home region</th>
                            <th scope="col">Unit</th>
                            <th scope="col">Travel time</th>
                            <th scope="col">Since arrival</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* The ledger's own order, unsorted and untruncated. */}
                          {entries.map((entry) => {
                            const site = siteByCode(entry.unit.siteCode);
                            const tone = entry.band === "air_transport_only" ? "danger" : "warn";
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
                                role="button"
                                aria-label={`View placement detail for ${entry.admission.homeRegion} in ${entry.unit.name}`}
                                onClick={() => setSelectedId(entry.admission.id)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    setSelectedId(entry.admission.id);
                                  }
                                }}
                              >
                                <td>
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
                                    className={`${pageStyles.badge} ${styles.placementPill} ${pageStyles.mono}`}
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
                      {entries.map((entry) => {
                        const site = siteByCode(entry.unit.siteCode);
                        const tone = entry.band === "air_transport_only" ? "danger" : "warn";

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
                            aria-label={`View placement detail for ${entry.admission.homeRegion} in ${entry.unit.name}`}
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
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginTop: "4px",
                              }}
                            >
                              <p className={pageStyles.recordFacts}>
                                Home: <b>{entry.admission.homeRegion}</b> &bull;{" "}
                                <span className={pageStyles.mono}>{entry.admission.id}</span>
                              </p>
                              <span
                                className={`${pageStyles.badge} ${pageStyles.mono}`}
                                data-tone={tone}
                                data-ward-type-floor="badge"
                              >
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

          <div className={pageStyles.detailColumn}>
            {/* Repatriation Case Inspector */}
            <section className={`${styles.section} ${pageStyles.panel}`} data-testid="ward-out-of-area-subject">
              <div className={pageStyles.ph}>
                <h2>Repatriation Case Inspector</h2>
                <span className={pageStyles.caseUrmBadge}>{selected ? selected.admission.id : "NO SELECTION"}</span>
              </div>
              <div
                className={pageStyles.panelBody}
                role="region"
                aria-label="Selected out-of-area placement"
                tabIndex={0}
              >
                {!selected ? (
                  <div data-testid="ward-out-of-area-subject-empty" className={pageStyles.inspectorEmpty}>
                    <svg
                      className={pageStyles.inspectorEmptyIcon}
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <h3>No placement selected</h3>
                    <p>Select a person in the list above to see the detail for one placement here.</p>
                  </div>
                ) : (
                  <div className={pageStyles.detailCard}>
                    <div data-testid="ward-out-of-area-subject-facts" className={pageStyles.detailSection}>
                      <span className={pageStyles.detailLabel}>Patient Demographics & Home Catchment</span>
                      <div className={pageStyles.detailValue}>{selected.admission.id}</div>
                      <div style={{ fontSize: "var(--t-0)", color: "var(--muted)", marginTop: "2px" }}>
                        Residential Catchment: <b>{selected.admission.homeRegion}</b>
                      </div>
                      <div style={{ fontSize: "var(--t-0)", color: "var(--muted)", marginTop: "2px" }}>
                        Current Unit: <b>{selected.unit.name}</b> (
                        {siteByCode(selected.unit.siteCode)?.name ?? "Site not recorded"})
                      </div>
                      <div style={{ fontSize: "var(--t-0)", color: "var(--muted)", marginTop: "2px" }}>
                        Health service:{" "}
                        <b>{siteByCode(selected.unit.siteCode)?.service ?? "Health service not recorded"}</b>
                      </div>
                      <div className={pageStyles.factMetricsRow}>
                        Travel Band: <span>{TRAVEL_BAND_LABELS[selected.band]}</span> &bull; Days Out-of-Area:{" "}
                        <span>{sinceArrivalLabel(selected, now)}</span>
                      </div>
                      <div style={{ fontSize: "var(--t-0)", color: "var(--muted)", marginTop: "2px" }}>
                        Group: <b>In a bed far from home</b>
                      </div>
                    </div>

                    <div data-testid="ward-out-of-area-subject-caveat" className={pageStyles.detailSection}>
                      <span className={pageStyles.detailLabel}>Clinical Repatriation Assessment</span>
                      <div className={pageStyles.detailValue} style={{ fontSize: "var(--t-1)", lineHeight: "1.4" }}>
                        Clinically stable in acute open bed &bull; ready for repatriation transfer back to{" "}
                        {selected.admission.homeRegion} Adult Unit as soon as bed vacates.
                      </div>
                    </div>

                    <div className={pageStyles.detailSection}>
                      <span className={pageStyles.detailLabel}>Target Destination Service</span>
                      <div className={pageStyles.detailValue} style={{ color: "var(--accent)" }}>
                        {selected.admission.homeRegion} Adult MHU
                      </div>
                      <div style={{ fontSize: "var(--t-0)", color: "var(--muted)", marginTop: "2px" }}>
                        Bed enquiry status: <b>Awaiting home bed vacancy</b>
                      </div>
                    </div>

                    <div style={{ marginTop: "10px" }}>
                      <button
                        type="button"
                        className={`${pageStyles.btn} ${pageStyles.btnPrimary}`}
                        style={{ width: "100%", justifyContent: "center" }}
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
                      selected ? `${selected.admission.id} (${selected.admission.homeRegion})` : "General Referral"
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
                        mode: REPATRIATION_MODES.includes(e.target.value as (typeof REPATRIATION_MODES)[number])
                          ? (e.target.value as (typeof REPATRIATION_MODES)[number])
                          : "",
                      }))
                    }
                  >
                    <option value={NO_REPAT_MODE_VALUE}>Choose road or flight</option>
                    {REPATRIATION_MODES.map((mode) => (
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
                    Tracking or CAD number
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
  if (tone === "danger") {
    return (
      <svg
        className={styles.placementGlyph}
        viewBox="0 0 12 12"
        width="10"
        height="10"
        aria-hidden="true"
        fill="currentColor"
      >
        <path d="M6 1.5 1 10.5h10L6 1.5Z" />
      </svg>
    );
  }
  if (tone === "warn") {
    return (
      <svg
        className={styles.placementGlyph}
        viewBox="0 0 12 12"
        width="10"
        height="10"
        aria-hidden="true"
        fill="currentColor"
      >
        <path d="M6 1 11 6 6 11 1 6Z" />
      </svg>
    );
  }
  return (
    <svg
      className={styles.placementGlyph}
      viewBox="0 0 12 12"
      width="10"
      height="10"
      aria-hidden="true"
      fill="currentColor"
    >
      <circle cx="6" cy="6" r="4" />
    </svg>
  );
}
