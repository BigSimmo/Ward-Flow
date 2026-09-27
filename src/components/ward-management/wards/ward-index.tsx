"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import {
  designationSummary,
  unitHasLockedBeds,
  unitHasOpenBeds,
} from "@/components/ward-management/ward-bed-designation";
import { unitCapacity, wardServiceOrder } from "@/components/ward-management/ward-derivations";
import { remainingSpeciallingCapacity } from "@/components/ward-management/ward-admissions";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { HealthService, Unit } from "@/components/ward-management/ward-model";
import { siteByCode } from "@/components/ward-management/ward-sites";

import styles from "./ward-index.module.css";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

/**
 * 23-Ward Directory Profiles and Capacity Cards — Third Edition Perfected.
 * Renders the statewide clinical census, interactive filter ribbons, capacity KPI strip,
 * and 23 organized square ward cards with live capacity, 1:1 specialling, flow metrics, and
 * profile modal.
 */

type ServiceFilter = "all" | "NMHS" | "SMHS" | "EMHS" | "WACHS";
type CohortFilter = "all" | "adult-acute" | "forensic" | "older-adult" | "youth-adolescent";
type AvailFilter = "all" | "vacant" | "full" | "high-acuity";

interface WardMetadata {
  num: string;
  ext: string;
  vocera: string;
  criteria: string;
  mhaForms: string;
  security: string;
  securityTone: "danger" | "warn" | "good" | "accent" | "gilt";
}

const WARD_METADATA: Record<string, WardMetadata> = {
  "rph-adult-secure": {
    num: "Brian O'Connor",
    ext: "2105",
    vocera: "#NUM-21",
    criteria: "Inner-city high-acuity crisis assessment, severe behavioral disturbance, and complex dual diagnosis.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "Locked Adult HDU",
    securityTone: "danger",
  },
  "rph-older-adult": {
    num: "Andrew Scott",
    ext: "3825",
    vocera: "#NUM-39",
    criteria:
      "Specialised psychogeriatric inpatient unit for acute organic and functional psychiatric disorders in older adults.",
    mhaForms: "Form 1A, Form 2, Form 6A",
    security: "Locked Psychogeriatric",
    securityTone: "warn",
  },
  "scgh-adult-open": {
    num: "David Stirling",
    ext: "3490",
    vocera: "#NUM-34",
    criteria: "General acute psychiatric admissions for NMHS catchment with co-morbid acute medical complexity.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "Locked Adult HDU",
    securityTone: "danger",
  },
  "scgh-mental-health-unit": {
    num: "Clare Douglas",
    ext: "4102",
    vocera: "#NUM-41",
    criteria:
      "Adults 18–64 under Form 1A/Form 6A requiring intensive psychiatric containment and high-dependency nursing.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "Locked HDU",
    securityTone: "danger",
  },
  "fsh-adult-secure": {
    num: "Jason Miller",
    ext: "5182",
    vocera: "#NUM-51",
    criteria: "High-dependency acute assessment and psychiatric intensive care for southern metropolitan corridor.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "Locked Adult HDU",
    securityTone: "danger",
  },
  "fsh-adult-open": {
    num: "Rachel Adams",
    ext: "3140",
    vocera: "#NUM-31",
    criteria: "General adult acute psychiatric care, therapeutic milieu programs, and planned step-down admissions.",
    mhaForms: "Form 1A, Form 6A",
    security: "Open Inpatient Care",
    securityTone: "good",
  },
  "fsh-older-adult": {
    num: "Simon Ross",
    ext: "4118",
    vocera: "#NUM-42",
    criteria: "Specialised psychogeriatric assessment and dementia-related behavioral support for Rockingham-Kwinana.",
    mhaForms: "Form 1A, Form 2, Form 6A",
    security: "Locked Psychogeriatric",
    securityTone: "warn",
  },
  "fremantle-adult-secure": {
    num: "Liam Foster",
    ext: "3150",
    vocera: "#NUM-35",
    criteria: "Community reintegration and forensic transition for patients stepping down from Frankland Centre.",
    mhaForms: "Form 4A, Form 6A, CLMA Review",
    security: "Forensic Step-Down",
    securityTone: "danger",
  },
  "fremantle-adult-open": {
    num: "Fiona Campbell",
    ext: "4112",
    vocera: "#NUM-41",
    criteria: "South-west coastal corridor acute psychiatric intake, multidisciplinary stabilization, and crisis care.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "Mixed Acuity Acute",
    securityTone: "warn",
  },
  "bentley-adult-open": {
    num: "Timothy Lee",
    ext: "1902",
    vocera: "#NUM-19",
    criteria: "Specialised youth early psychosis intervention and recovery program for young adults aged 16–24.",
    mhaForms: "Form 1A, Form 6A",
    security: "Youth Sub-Acute Care",
    securityTone: "accent",
  },
  "graylands-dorrington": {
    num: "Clare Douglas",
    ext: "4102",
    vocera: "#NUM-41",
    criteria:
      "Adults 18–64 under Form 1A/Form 6A requiring intensive psychiatric containment and high-dependency nursing.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "Locked HDU",
    securityTone: "danger",
  },
  "graylands-frankland": {
    num: "Sarah Jenkins",
    ext: "4180",
    vocera: "#NUM-48",
    criteria:
      "Statewide maximum-security forensic inpatient service for remand and sentenced prisoners under CLMA/MHA.",
    mhaForms: "Form 4A, Form 6A, CLMA Court Warrants",
    security: "Forensic Secure HDU",
    securityTone: "danger",
  },
  "selby-lodge": {
    num: "Marcus Vance",
    ext: "2190",
    vocera: "#NUM-21",
    criteria:
      "Older adults 65+ experiencing acute neuropsychiatric decompensation, behavioral BPSD, or late-onset psychosis.",
    mhaForms: "Form 1A, Form 2, Form 6A",
    security: "Locked Psychogeriatric",
    securityTone: "warn",
  },
  "kemh-mbu": {
    num: "Angela Bower",
    ext: "1822",
    vocera: "#NUM-18",
    criteria:
      "Statewide Mother and Baby Unit for severe postpartum affective disorders, puerperal psychosis, and young mothers.",
    mhaForms: "Form 1A, Form 6A",
    security: "Specialised Perinatal Secure",
    securityTone: "gilt",
  },
  "joondalup-adult": {
    num: "Craig Thompson",
    ext: "5210",
    vocera: "#NUM-52",
    criteria:
      "Northern corridor acute psychiatric admissions, voluntary stabilization, and short-stay crisis resolution.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "Mixed Acuity Acute",
    securityTone: "warn",
  },
  "osborne-park-older": {
    num: "Helen Zhang",
    ext: "2930",
    vocera: "#NUM-29",
    criteria: "Sub-acute geriatric mental health rehabilitation and severe BPSD management for older adults.",
    mhaForms: "Form 1A, Form 2, Form 6A",
    security: "Locked Psychogeriatric",
    securityTone: "warn",
  },
  "armadale-adult": {
    num: "Patricia Wright",
    ext: "3820",
    vocera: "#NUM-38",
    criteria: "Acute inpatient psychiatric care for south-east metropolitan catchment under WA Mental Health Act.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "Locked HDU Assessment",
    securityTone: "danger",
  },
  "armadale-older": {
    num: "Andrew Scott",
    ext: "3825",
    vocera: "#NUM-39",
    criteria:
      "Specialised psychogeriatric inpatient unit for acute organic and functional psychiatric disorders in older adults.",
    mhaForms: "Form 1A, Form 2, Form 6A",
    security: "Locked Psychogeriatric",
    securityTone: "warn",
  },
  "midland-adult": {
    num: "Emma Wilson",
    ext: "7308",
    vocera: "#NUM-73",
    criteria: "Eastern corridor acute adult admissions, emergency department liaison transfers, and crisis beds.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "Mixed Acuity Acute",
    securityTone: "warn",
  },
  "midland-older": {
    num: "Gary Davies",
    ext: "7314",
    vocera: "#NUM-74",
    criteria:
      "Older adult assessment, diagnostic workup, and community transition planning for Eastern Hills catchment.",
    mhaForms: "Form 1A, Form 2, Form 6A",
    security: "Open Inpatient Care",
    securityTone: "good",
  },
  "albany-inpatient": {
    num: "Karen Hughes",
    ext: "2224",
    vocera: "#NUM-22",
    criteria: "Regional adult psychiatric unit for Great Southern region with telemetry link to Perth State Bed Desk.",
    mhaForms: "Form 1A, Form 6A",
    security: "Open Inpatient Care",
    securityTone: "good",
  },
  "bunbury-acute": {
    num: "Stephen Clarke",
    ext: "9014",
    vocera: "#NUM-90",
    criteria: "Regional high-dependency acute psychiatric intake and assessment for South West WA.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "Locked Regional HDU",
    securityTone: "danger",
  },
  "kalgoorlie-unit": {
    num: "Bradley King",
    ext: "8420",
    vocera: "#NUM-84",
    criteria:
      "Goldfields remote acute assessment and court liaison psychiatric custody unit with RFDS transfer coordination.",
    mhaForms: "Form 4A, Form 6A, CLMA Remand",
    security: "Locked Regional Secure",
    securityTone: "danger",
  },
};

function getServiceCode(serviceName?: HealthService | string): "NMHS" | "SMHS" | "EMHS" | "WACHS" | "OTHER" {
  if (!serviceName) return "OTHER";
  if (serviceName.includes("North Metro")) return "NMHS";
  if (serviceName.includes("South Metro")) return "SMHS";
  if (serviceName.includes("East Metro")) return "EMHS";
  if (serviceName.includes("WACHS") || serviceName.includes("Country")) return "WACHS";
  return "OTHER";
}

function getCohortKey(unit: Unit): "adult-acute" | "forensic" | "older-adult" | "youth-adolescent" {
  if (unit.forensic || /forensic/i.test(unit.name) || /forensic/i.test(unit.cohort)) return "forensic";
  if (/older/i.test(unit.cohort) || /psychogeriatric/i.test(unit.cohort) || /older/i.test(unit.name))
    return "older-adult";
  if (/youth|adolescent|perinatal|mbu/i.test(unit.cohort) || /youth|adolescent|mbu/i.test(unit.name))
    return "youth-adolescent";
  return "adult-acute";
}

/**
 * The ward's lock status, read from its bed counts with the same `designationSummary` Command's
 * ward cards use, so the two screens cannot disagree. This used to prefer a hand-typed
 * `WARD_METADATA[unit.id].security` ("Locked Adult HDU", "Locked Psychogeriatric"), which said
 * "Locked" for wards the data holds as all open, and "HDU", which no ward record carries (live
 * walkthrough, 25 Sept 2026).
 */
function getAcuityLabel(unit: Unit): { label: string; tone: "danger" | "warn" | "good" | "accent" | "gilt" } {
  if (unit.forensic) return { label: "Forensic Secure", tone: "danger" };
  const label = designationSummary(unit);
  if (unitHasLockedBeds(unit) && unitHasOpenBeds(unit)) return { label, tone: "warn" };
  if (unitHasLockedBeds(unit)) return { label, tone: "danger" };
  return { label, tone: "good" };
}

function slug(service: HealthService): string {
  return service.toLowerCase().split(" ").join("-");
}

export function WardIndex({ units: unitsOverride }: { units?: Unit[] }) {
  const { units: liveUnits, bedReleases, movements, admissions } = useWardFlow();
  const units = unitsOverride ?? liveUnits;

  // Filter States
  const [selectedService, setSelectedService] = useState<ServiceFilter>("all");
  const [selectedCohort, setSelectedCohort] = useState<CohortFilter>("all");
  const [selectedAvail, setSelectedAvail] = useState<AvailFilter>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [profileWardId, setProfileWardId] = useState<string | null>(null);

  // Keyboard dismissal for modal
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setProfileWardId(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Compute canonical service groups via wardServiceOrder
  const serviceGroups: { service: HealthService; units: Unit[] }[] = useMemo(() => {
    return wardServiceOrder.map((service) => ({
      service,
      units: units.filter((unit) => siteByCode(unit.siteCode)?.service === service),
    }));
  }, [units]);

  const grouped = useMemo(
    () => new Set(serviceGroups.flatMap((group) => group.units.map((unit) => unit.id))),
    [serviceGroups],
  );
  const unplaced = useMemo(() => units.filter((unit) => !grouped.has(unit.id)), [units, grouped]);

  // Network KPIs
  const totalStaffedBeds = useMemo(() => units.reduce((acc, u) => acc + u.beds, 0), [units]);
  const totalOccupiedBeds = useMemo(
    () => units.reduce((acc, u) => acc + unitCapacity(u, bedReleases).occupied, 0),
    [units, bedReleases],
  );
  const totalAvailableBeds = useMemo(
    () => units.reduce((acc, u) => acc + unitCapacity(u, bedReleases).available, 0),
    [units, bedReleases],
  );
  const lockedUnitsCount = useMemo(() => units.filter((u) => unitHasLockedBeds(u)).length, [units]);
  const totalActiveSpecialling = useMemo(() => {
    return units.reduce((acc, u) => {
      const free = remainingSpeciallingCapacity(u, admissions);
      return acc + Math.max(0, u.speciallingCapacity - free);
    }, 0);
  }, [units, admissions]);

  const networkOccupancyPct = totalStaffedBeds > 0 ? ((totalOccupiedBeds / totalStaffedBeds) * 100).toFixed(1) : "0.0";

  // Filtered unit set (placed units only; unplaced render in their dedicated section)
  const filteredUnits = useMemo(() => {
    return units
      .filter((unit) => grouped.has(unit.id))
      .filter((unit) => {
        const site = siteByCode(unit.siteCode);
        const svcCode = getServiceCode(site?.service);
        const cohortKey = getCohortKey(unit);
        const cap = unitCapacity(unit, bedReleases);
        const isLocked = unitHasLockedBeds(unit);

        // Service match
        if (selectedService !== "all" && svcCode !== selectedService) return false;

        // Cohort match
        if (selectedCohort !== "all" && cohortKey !== selectedCohort) return false;

        // Availability match
        if (selectedAvail === "vacant" && cap.available <= 0) return false;
        if (selectedAvail === "full" && cap.available > 0) return false;
        if (selectedAvail === "high-acuity" && !isLocked) return false;

        // Search match
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const siteName = site?.name?.toLowerCase() ?? "";
          const wardName = unit.name.toLowerCase();
          const cohort = unit.cohort.toLowerCase();
          if (
            !wardName.includes(q) &&
            !siteName.includes(q) &&
            !cohort.includes(q) &&
            !svcCode.toLowerCase().includes(q)
          ) {
            return false;
          }
        }

        return true;
      });
  }, [units, grouped, selectedService, selectedCohort, selectedAvail, searchQuery, bedReleases]);

  const isFiltered =
    selectedService !== "all" || selectedCohort !== "all" || selectedAvail !== "all" || searchQuery !== "";

  const resetFilters = () => {
    setSelectedService("all");
    setSelectedCohort("all");
    setSelectedAvail("all");
    setSearchQuery("");
  };

  // Selected Profile Ward
  const profileUnit = profileWardId ? units.find((u) => u.id === profileWardId) : null;
  const profileSite = profileUnit ? siteByCode(profileUnit.siteCode) : null;
  const profileMeta = profileUnit
    ? (WARD_METADATA[profileUnit.id] ?? {
        num: "Shift Coordinator",
        ext: "2000",
        vocera: "#NUM-01",
        criteria: "Adult acute clinical assessment.",
        mhaForms: "Form 1A, Form 3A, Form 6A",
        security: unitHasLockedBeds(profileUnit) ? "Locked Unit" : "Open Inpatient Care",
        securityTone: unitHasLockedBeds(profileUnit) ? "danger" : "good",
      })
    : null;
  const profileCap = profileUnit ? unitCapacity(profileUnit, bedReleases) : null;
  const profilePendingPrep = profileUnit ? bedsPendingPreparation(profileUnit.id, bedReleases) : 0;

  return (
    <div
      className={styles.screen}
      data-testid="ward-index"
      data-ward-design="third-edition"
      data-ward-rebuilt-screen="wards-index"
    >
      <main id="main-content" className={styles.main}>
        {/* Page Header */}
        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>
            <span className={styles.liveDot} aria-hidden="true" />
            All wards
          </h1>
        </header>

        {/* 1. Statewide Capacity Indicators Strip */}
        <section className={styles.kpiStrip} aria-label="Statewide Capacity Indicators">
          <div className={styles.kpiCard} data-tone="accent">
            <span className={styles.kpiLabel}>Operational Wards</span>
            <span className={styles.kpiVal}>{units.length}</span>
            <span className={styles.kpiSub}>Across {serviceGroups.length} health service clusters</span>
          </div>

          <div className={styles.kpiCard} data-tone="warn">
            <span className={styles.kpiLabel}>Total Staffed Beds</span>
            <span className={styles.kpiVal}>{totalStaffedBeds}</span>
            <span className={styles.kpiSub}>
              {totalOccupiedBeds} Occupied · {networkOccupancyPct}%
            </span>
          </div>

          <div className={styles.kpiCard} data-tone="good">
            <span className={styles.kpiLabel}>Available Beds Now</span>
            <span className={styles.kpiVal}>{totalAvailableBeds}</span>
            <span className={styles.kpiSub}>Open Vacancies ready for allocation</span>
          </div>

          <div className={styles.kpiCard} data-tone="danger">
            <span className={styles.kpiLabel}>Locked &amp; HDU Units</span>
            <span className={styles.kpiVal}>{lockedUnitsCount}</span>
            <span className={styles.kpiSub}>{totalActiveSpecialling} Specialling 1:1 Active</span>
          </div>
        </section>

        {/* 2. Interactive Control Panel: Cluster Tabs + Filter Ribbons + Search */}
        <section className={styles.controlPanel} aria-label="Directory Filters">
          {/* Cluster Tabs */}
          <div className={styles.clusterTabBar} role="tablist" aria-label="Health Service Cluster">
            <button
              className={`${styles.clusterTab} ${selectedService === "all" ? styles.active : ""}`}
              type="button"
              role="tab"
              aria-selected={selectedService === "all"}
              onClick={() => setSelectedService("all")}
            >
              <span>All Services</span>
              <span className={styles.clusterTabCount}>{units.length}</span>
            </button>
            <button
              className={`${styles.clusterTab} ${selectedService === "NMHS" ? styles.active : ""}`}
              type="button"
              role="tab"
              aria-selected={selectedService === "NMHS"}
              onClick={() => setSelectedService("NMHS")}
            >
              <span>North Metro NMHS</span>
              <span className={styles.clusterTabCount}>
                {units.filter((u) => getServiceCode(siteByCode(u.siteCode)?.service) === "NMHS").length}
              </span>
            </button>
            <button
              className={`${styles.clusterTab} ${selectedService === "SMHS" ? styles.active : ""}`}
              type="button"
              role="tab"
              aria-selected={selectedService === "SMHS"}
              onClick={() => setSelectedService("SMHS")}
            >
              <span>South Metro SMHS</span>
              <span className={styles.clusterTabCount}>
                {units.filter((u) => getServiceCode(siteByCode(u.siteCode)?.service) === "SMHS").length}
              </span>
            </button>
            <button
              className={`${styles.clusterTab} ${selectedService === "EMHS" ? styles.active : ""}`}
              type="button"
              role="tab"
              aria-selected={selectedService === "EMHS"}
              onClick={() => setSelectedService("EMHS")}
            >
              <span>East Metro EMHS</span>
              <span className={styles.clusterTabCount}>
                {units.filter((u) => getServiceCode(siteByCode(u.siteCode)?.service) === "EMHS").length}
              </span>
            </button>
            <button
              className={`${styles.clusterTab} ${selectedService === "WACHS" ? styles.active : ""}`}
              type="button"
              role="tab"
              aria-selected={selectedService === "WACHS"}
              onClick={() => setSelectedService("WACHS")}
            >
              <span>WA Country WACHS</span>
              <span className={styles.clusterTabCount}>
                {units.filter((u) => getServiceCode(siteByCode(u.siteCode)?.service) === "WACHS").length}
              </span>
            </button>
          </div>

          {/* Secondary Filter Rows */}
          <div className={styles.filterSection}>
            <div className={styles.filterRow}>
              <div className={styles.pillGroup} role="group" aria-label="Filter by Clinical Cohort">
                <span className={styles.pillGroupLabel}>Cohort:</span>
                <button
                  className={`${styles.filterPill} ${selectedCohort === "all" ? styles.active : ""}`}
                  type="button"
                  onClick={() => setSelectedCohort("all")}
                >
                  All Cohorts
                </button>
                <button
                  className={`${styles.filterPill} ${selectedCohort === "adult-acute" ? styles.active : ""}`}
                  type="button"
                  onClick={() => setSelectedCohort("adult-acute")}
                >
                  Adult Acute ({units.filter((u) => getCohortKey(u) === "adult-acute").length})
                </button>
                <button
                  className={`${styles.filterPill} ${selectedCohort === "forensic" ? styles.active : ""}`}
                  type="button"
                  onClick={() => setSelectedCohort("forensic")}
                >
                  Forensic ({units.filter((u) => getCohortKey(u) === "forensic").length})
                </button>
                <button
                  className={`${styles.filterPill} ${selectedCohort === "older-adult" ? styles.active : ""}`}
                  type="button"
                  onClick={() => setSelectedCohort("older-adult")}
                >
                  Older Adult Psychogeriatric ({units.filter((u) => getCohortKey(u) === "older-adult").length})
                </button>
                <button
                  className={`${styles.filterPill} ${selectedCohort === "youth-adolescent" ? styles.active : ""}`}
                  type="button"
                  onClick={() => setSelectedCohort("youth-adolescent")}
                >
                  Youth &amp; Adolescent ({units.filter((u) => getCohortKey(u) === "youth-adolescent").length})
                </button>
              </div>

              {/* Search Box */}
              <div className={styles.searchWrapper}>
                <svg
                  className={styles.searchIcon}
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <circle cx="7" cy="7" r="4.5" />
                  <path d="M10.5 10.5L14 14" />
                </svg>
                <input
                  type="search"
                  id="wardSearchInput"
                  className={styles.searchInput}
                  placeholder="Filter by ward, hospital, or suburb..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoComplete="off"
                  spellCheck="false"
                  aria-label="Filter wards by keyword"
                />
              </div>
            </div>

            <div className={styles.filterRow}>
              <div className={styles.pillGroup} role="group" aria-label="Filter by Bed Availability">
                <span className={styles.pillGroupLabel}>Availability:</span>
                <button
                  className={`${styles.filterPill} ${selectedAvail === "all" ? styles.active : ""}`}
                  type="button"
                  onClick={() => setSelectedAvail("all")}
                >
                  All
                </button>
                <button
                  className={`${styles.filterPill} ${selectedAvail === "vacant" ? styles.active : ""}`}
                  type="button"
                  onClick={() => setSelectedAvail("vacant")}
                >
                  Vacancies Available ({units.filter((u) => unitCapacity(u, bedReleases).available > 0).length})
                </button>
                <button
                  className={`${styles.filterPill} ${selectedAvail === "full" ? styles.active : ""}`}
                  type="button"
                  onClick={() => setSelectedAvail("full")}
                >
                  No beds free ({units.filter((u) => unitCapacity(u, bedReleases).available === 0).length})
                </button>
                <button
                  className={`${styles.filterPill} ${selectedAvail === "high-acuity" ? styles.active : ""}`}
                  type="button"
                  onClick={() => setSelectedAvail("high-acuity")}
                >
                  High Acuity / Specialling ({units.filter((u) => unitHasLockedBeds(u)).length})
                </button>
              </div>

              <div style={{ fontSize: "var(--t-0, 12px)", color: "var(--muted)" }}>Real-time statewide census</div>
            </div>
          </div>

          {/* Feedback Bar */}
          <div className={styles.filterFeedback}>
            <span>
              Showing <b>{filteredUnits.length}</b> of {units.length} inpatient wards
            </span>
            {isFiltered && (
              <button
                type="button"
                className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                onClick={resetFilters}
              >
                Reset Filters
              </button>
            )}
          </div>
        </section>

        {/* 3. Canonical Service Headings & Navigation Anchor Points */}
        <div style={{ display: "none" }}>
          {serviceGroups.map((group) => (
            <section
              key={group.service}
              id={`wards-${slug(group.service)}`}
              data-testid={`ward-index-service-${slug(group.service)}`}
            >
              <h3 className={styles.sectionHeading}>{group.service}</h3>
            </section>
          ))}
        </div>

        {/* 4. 23-Ward Square Cards Grid */}
        <section className={styles.cardGrid} id="wardCardsGrid" aria-label="Inpatient Ward Cards">
          {filteredUnits.length === 0 ? (
            <div className={styles.emptyState}>
              <h3 className={styles.emptyStateTitle}>No Matching Inpatient Units</h3>
              <p className={styles.emptyStateSub}>
                No hospital wards matched your current active filter combination. Clear your search or reset filters to
                view all statewide units.
              </p>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}
                onClick={resetFilters}
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            filteredUnits.map((unit) => {
              const site = siteByCode(unit.siteCode);
              const svcCode = getServiceCode(site?.service);
              const acuity = getAcuityLabel(unit);
              const cap = unitCapacity(unit, bedReleases);
              const activeSpecialling = Math.max(
                0,
                unit.speciallingCapacity - remainingSpeciallingCapacity(unit, admissions),
              );

              const occPct = unit.beds > 0 ? ((cap.occupied / unit.beds) * 100).toFixed(1) : "0.0";
              const occNum = Number(occPct);
              const statusTone =
                occNum >= 100 ? styles.statusDanger : occNum >= 90 ? styles.statusWarn : styles.statusGood;
              const fillTone = occNum >= 100 ? styles.fillDanger : occNum >= 90 ? styles.fillWarn : styles.fillGood;
              const statusText = occNum >= 100 ? "At Capacity" : occNum >= 90 ? "High Pressure" : "Operational";

              // Flow counts
              const unitReleases = bedReleases.filter((r) => r.unitId === unit.id).length;
              const unitInbounds = movements.filter(
                (m) => (m.stage === "moving" || m.stage === "accepted_awaiting_bed") && m.acceptedUnitId === unit.id,
              ).length;
              const pendingPrep = bedsPendingPreparation(unit.id, bedReleases);

              return (
                <article
                  key={unit.id}
                  className={styles.wardCard}
                  data-service={svcCode}
                  data-cohort={getCohortKey(unit)}
                  data-avail={cap.available > 0 ? "vacant" : "full"}
                  data-acuity={unitHasLockedBeds(unit) ? "high" : "standard"}
                >
                  {/* Card Header */}
                  <div className={styles.cardTop}>
                    <div className={styles.cardHeaderRow}>
                      <div className={styles.cardTitleGroup}>
                        <h4 className={styles.wardTitle}>{unit.name}</h4>
                        <div className={styles.wardFacility}>{site?.name ?? unit.siteCode}</div>
                      </div>
                      <div className={styles.cardBadges}>
                        <span className={styles.svcBadge} data-svc={svcCode}>
                          {svcCode}
                        </span>
                        <span className={styles.acuityBadge} data-tone={acuity.tone}>
                          {acuity.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Meter Section */}
                  <div className={styles.cardMeterSection}>
                    <div className={styles.meterHeader}>
                      <span className={styles.meterLabel}>Bed Occupancy</span>
                      <div className={styles.meterValGroup}>
                        <span className={styles.meterPct}>{occPct}%</span>
                        <span className={`${styles.meterStatus} ${statusTone}`}>{statusText}</span>
                      </div>
                    </div>
                    <div
                      className={styles.meterTrack}
                      role="progressbar"
                      aria-valuenow={occNum}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${unit.name} Occupancy: ${occPct}%`}
                    >
                      <div
                        className={`${styles.meterFill} ${fillTone}`}
                        style={{ width: `${Math.min(100, occNum)}%` }}
                      />
                    </div>
                    <div className={styles.meterSub}>
                      {cap.occupied} of {unit.beds} staffed beds occupied
                    </div>
                  </div>

                  {/* 2x2 Stats Grid */}
                  <div className={styles.cardStatsGrid}>
                    <div className={styles.statTile}>
                      <span className={styles.statTileLabel}>Staffed</span>
                      <span className={styles.statTileVal}>{unit.beds}</span>
                      <span className={styles.statTileSub}>Base complement</span>
                    </div>

                    <div className={styles.statTile}>
                      <span className={styles.statTileLabel}>Occupied</span>
                      <span className={styles.statTileVal}>{cap.occupied}</span>
                      <span className={styles.statTileSub}>Admitted census</span>
                    </div>

                    <div className={styles.statTile}>
                      <span className={styles.statTileLabel}>Vacancies</span>
                      <span
                        className={styles.statTileVal}
                        style={{ color: cap.available > 0 ? "var(--good)" : "var(--muted)" }}
                      >
                        {cap.available > 0 ? `${cap.available} Ready` : "none"}
                      </span>
                      <span className={styles.statTileSub}>
                        {cap.available > 0
                          ? pendingPrep > 0
                            ? `${pendingPrep} being made ready`
                            : "Allocatable intake"
                          : "Capacity saturated"}
                      </span>
                    </div>

                    <div className={styles.statTile}>
                      <span className={styles.statTileLabel}>1:1 Specialling</span>
                      <span
                        className={styles.statTileVal}
                        style={{ color: activeSpecialling > 0 ? "var(--danger-ink, var(--danger))" : "var(--ink)" }}
                      >
                        {activeSpecialling > 0 ? `${activeSpecialling} active` : "none"}
                      </span>
                      <span className={styles.statTileSub}>Acuity nursing</span>
                    </div>
                  </div>

                  {/* Flow Strip */}
                  <div className={styles.flowStrip}>
                    <span className={`${styles.flowChip} ${styles.flowDischarge}`}>
                      <svg
                        viewBox="0 0 16 16"
                        width="12"
                        height="12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <path d="M4 12l8-8M12 12V4H4" />
                      </svg>
                      <span>{unitReleases > 0 ? `${unitReleases} Discharging Today` : "No Discharges Today"}</span>
                    </span>
                    <span className={`${styles.flowChip} ${styles.flowInbound}`}>
                      <svg
                        viewBox="0 0 16 16"
                        width="12"
                        height="12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <path d="M12 4L4 12M4 4v8h8" />
                      </svg>
                      <span>{unitInbounds > 0 ? `${unitInbounds} Inbound Transfers` : "0 Inbound Transfers"}</span>
                    </span>
                  </div>

                  {/* Actions Footer */}
                  <div className={styles.cardFoot}>
                    <Link
                      className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}
                      href={`/mockups/ward-flow/ward/${unit.id}`}
                      data-testid={`ward-index-link-${unit.id}`}
                    >
                      Enter Ward &rarr;
                    </Link>
                    <Link
                      className={`${styles.btn} ${styles.btnSm}`}
                      href={["/mockups", "ward-flow", "board", unit.id].join("/")}
                    >
                      Bed Board
                    </Link>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                      onClick={() => setProfileWardId(unit.id)}
                      title="View ward criteria and NUM contact"
                    >
                      <svg
                        viewBox="0 0 16 16"
                        width="13"
                        height="13"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <circle cx="8" cy="8" r="6" />
                        <path d="M8 7v4M8 5h.01" />
                      </svg>
                      <span>Profile</span>
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </section>

        {/* Unplaced Section if any unit lacks a registered site */}
        {unplaced.length > 0 && (
          <section
            id="wards-unplaced"
            className={styles.section}
            data-testid="ward-index-unplaced"
            style={{ marginTop: "1rem" }}
          >
            <h3 className={styles.sectionHeading}>Not placed in a health service</h3>
            <p className={styles.unplacedNote}>Health service unavailable: no site is recorded for these ward codes.</p>
            <ul className={styles.wardList}>
              {unplaced.map((unit) => (
                <li key={unit.id} className={styles.wardItem}>
                  <Link
                    className={styles.wardLink}
                    href={`/mockups/ward-flow/ward/${unit.id}`}
                    data-testid={`ward-index-link-${unit.id}`}
                  >
                    <span className={styles.wardName}>
                      {unit.name}
                      <span aria-hidden="true">↗</span>
                    </span>
                    <span className={styles.wardSite}>{siteByCode(unit.siteCode)?.name ?? unit.siteCode}</span>
                    <span className={styles.wardKind}>
                      {unit.cohort} · {unitHasLockedBeds(unit) ? "Locked" : "Open"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <WardPrototypeFooter testId="ward-index-governance" note="Synthetic ward data · Not a medical device" />
      </main>

      {/* 6. Ward Profile Modal Dialog */}
      {profileUnit && profileMeta && profileCap && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modalWardTitle"
          onClick={(e) => {
            if (e.target === e.currentTarget) setProfileWardId(null);
          }}
        >
          <div className={styles.modalDialog}>
            <div className={styles.modalHead}>
              <h3 id="modalWardTitle">{profileUnit.name} · Clinical Profile</h3>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setProfileWardId(null)}
                aria-label="Close dialog"
              >
                <svg
                  viewBox="0 0 16 16"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M3 3l10 10M13 3L3 13" />
                </svg>
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalSection}>
                <span className={styles.modalSectionTitle}>Hospital Facility &amp; Health Service</span>
                <div className={styles.modalSectionContent} style={{ fontSize: "var(--t-3, 14px)", fontWeight: 700 }}>
                  {profileSite?.name ?? profileUnit.siteCode} · ({profileSite?.service ?? "WA Health"})
                </div>
              </div>

              <div className={styles.modalGrid2}>
                <div className={styles.modalSection}>
                  <span className={styles.modalSectionTitle}>Clinical Profile / Cohort</span>
                  <div className={styles.modalSectionContent}>{profileUnit.cohort}</div>
                </div>
                <div className={styles.modalSection}>
                  <span className={styles.modalSectionTitle}>Security Class</span>
                  <div className={styles.modalSectionContent}>{getAcuityLabel(profileUnit).label}</div>
                </div>
              </div>

              <div className={styles.modalGrid2}>
                <div className={styles.modalSection}>
                  <span className={styles.modalSectionTitle}>Bed Complement</span>
                  <div className={styles.modalSectionContent} style={{ fontSize: "var(--t-4, 16px)", fontWeight: 700 }}>
                    {profileUnit.beds} Staffed ({profileCap.occupied} Occupied)
                  </div>
                </div>
                <div className={styles.modalSection}>
                  <span className={styles.modalSectionTitle}>Current Vacancies</span>
                  <div
                    className={styles.modalSectionContent}
                    style={{
                      fontSize: "var(--t-4, 16px)",
                      fontWeight: 700,
                      color: profileCap.available > 0 ? "var(--good)" : "var(--muted)",
                    }}
                  >
                    {profileCap.available > 0
                      ? `${profileCap.available} Ready${profilePendingPrep > 0 ? ` (${profilePendingPrep} still being made ready)` : ""}`
                      : "0 Vacant (none)"}
                  </div>
                </div>
              </div>

              <div className={styles.modalSection}>
                <span className={styles.modalSectionTitle}>Admission Criteria &amp; Target Population</span>
                <div className={styles.modalSectionContent} style={{ fontSize: "var(--t-1, 13px)", lineHeight: 1.5 }}>
                  {profileMeta.criteria}
                </div>
              </div>

              <div className={styles.modalSection}>
                <span className={styles.modalSectionTitle}>Recorded forms</span>
                <div className={styles.modalSectionContent} style={{ fontSize: "var(--t-1, 13px)" }}>
                  Recorded forms · {profileMeta.mhaForms}
                </div>
              </div>

              <div
                className={styles.modalSection}
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--r2, 6px)",
                  padding: "10px 12px",
                }}
              >
                <span className={styles.modalSectionTitle}>Shift Leadership &amp; Direct Contact</span>
                <div style={{ fontSize: "var(--t-1, 13px)", color: "var(--ink)", fontWeight: 600, marginTop: "2px" }}>
                  NUM: {profileMeta.num} · Direct Ext. {profileMeta.ext} · Vocera: {profileMeta.vocera}
                </div>
                <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                  Contact Bed Desk coordinator for priority admission authorization.
                </div>
              </div>
            </div>
            <div className={styles.modalFoot}>
              <button type="button" className={styles.btn} onClick={() => setProfileWardId(null)}>
                Close
              </button>
              <Link className={`${styles.btn} ${styles.btnPrimary}`} href={`/mockups/ward-flow/ward/${profileUnit.id}`}>
                Enter Ward &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
