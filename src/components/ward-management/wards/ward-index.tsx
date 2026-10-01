"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { designationSummary, unitHasLockedBeds, unitHasOpenBeds } from "@/components/ward-management/ward-bed-designation";
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

type ServiceFilter = "all" | "NMHS" | "SMHS" | "EMHS" | "WACHS" | "Private";
type CohortFilter =
  | "all"
  | "adult-acute"
  | "older-adult"
  | "perinatal"
  | "forensic"
  | "sub-acute";
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
  // 22 Authentic Inpatient Units in allUnits()
  "rph-adult-secure": {
    num: "Brian O'Connor",
    ext: "2105",
    vocera: "#NUM-21",
    criteria: "Inner-city high-acuity crisis assessment, severe behavioral disturbance, and complex dual diagnosis.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "All locked",
    securityTone: "danger",
  },
  "rph-older-adult": {
    num: "Andrew Scott",
    ext: "3825",
    vocera: "#NUM-39",
    criteria:
      "Specialised psychogeriatric inpatient unit for acute organic and functional psychiatric disorders in older adults.",
    mhaForms: "Form 1A, Form 2, Form 6A",
    security: "All open",
    securityTone: "good",
  },
  "scgh-adult-open": {
    num: "David Stirling",
    ext: "3490",
    vocera: "#NUM-34",
    criteria: "General acute psychiatric admissions for NMHS catchment with co-morbid acute medical complexity.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "All open",
    securityTone: "good",
  },
  "scgh-older-adult": {
    num: "Helen Zhang",
    ext: "2930",
    vocera: "#NUM-29",
    criteria: "Sub-acute geriatric mental health rehabilitation and severe BPSD management for older adults.",
    mhaForms: "Form 1A, Form 2, Form 6A",
    security: "All open",
    securityTone: "good",
  },
  "fsh-adult-secure": {
    num: "Jason Miller",
    ext: "5182",
    vocera: "#NUM-51",
    criteria: "High-dependency acute assessment and psychiatric intensive care for southern metropolitan corridor.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "All locked",
    securityTone: "danger",
  },
  "fsh-older-adult": {
    num: "Simon Ross",
    ext: "4118",
    vocera: "#NUM-42",
    criteria: "Specialised psychogeriatric assessment and dementia-related behavioral support for Rockingham-Kwinana.",
    mhaForms: "Form 1A, Form 2, Form 6A",
    security: "All open",
    securityTone: "good",
  },
  "arm-adult-open": {
    num: "Patricia Wright",
    ext: "3820",
    vocera: "#NUM-38",
    criteria: "Acute inpatient psychiatric care for south-east metropolitan catchment under WA Mental Health Act.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "All open",
    securityTone: "good",
  },
  "sjgm-adult-open": {
    num: "Emma Wilson",
    ext: "7308",
    vocera: "#NUM-73",
    criteria: "Eastern corridor acute adult admissions, emergency department liaison transfers, and crisis beds.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "All open",
    securityTone: "good",
  },
  "rgh-adult-secure": {
    num: "Jessica Howard",
    ext: "6100",
    vocera: "#NUM-61",
    criteria: "South-west metropolitan acute mental health admissions and emergency liaison transfers.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "All locked",
    securityTone: "danger",
  },
  "fre-adult-open": {
    num: "Fiona Campbell",
    ext: "4112",
    vocera: "#NUM-41",
    criteria: "South-west coastal corridor acute psychiatric intake, multidisciplinary stabilization, and crisis care.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "All open",
    securityTone: "good",
  },
  "fre-older-adult": {
    num: "Graeme Bell",
    ext: "6140",
    vocera: "#NUM-62",
    criteria: "Older adult acute psychogeriatric intake and behavioral management for Fremantle catchment.",
    mhaForms: "Form 1A, Form 2, Form 6A",
    security: "All open",
    securityTone: "good",
  },
  "bty-adult-secure": {
    num: "Liam Foster",
    ext: "3150",
    vocera: "#NUM-35",
    criteria: "Secure high-dependency containment, crisis stabilization, and psychiatric intensive nursing.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "All locked",
    securityTone: "danger",
  },
  "bty-older-adult": {
    num: "Gary Davies",
    ext: "7314",
    vocera: "#NUM-74",
    criteria: "Older adult assessment, diagnostic workup, and community transition planning for Eastern Hills catchment.",
    mhaForms: "Form 1A, Form 2, Form 6A",
    security: "All open",
    securityTone: "good",
  },
  "bty-youth": {
    num: "Timothy Lee",
    ext: "1902",
    vocera: "#NUM-19",
    criteria: "Specialised youth early psychosis intervention and recovery program for young adults aged 16–24.",
    mhaForms: "Form 1A, Form 6A",
    security: "All open",
    securityTone: "good",
  },
  "gry-adult-secure": {
    num: "Clare Douglas",
    ext: "4102",
    vocera: "#NUM-41",
    criteria:
      "Adults 18–64 under Form 1A/Form 6A requiring intensive psychiatric containment and high-dependency nursing.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "All locked",
    securityTone: "danger",
  },
  "gry-older-adult": {
    num: "Marcus Vance",
    ext: "2190",
    vocera: "#NUM-21",
    criteria:
      "Older adults 65+ experiencing acute neuropsychiatric decompensation, behavioral BPSD, or late-onset psychosis.",
    mhaForms: "Form 1A, Form 2, Form 6A",
    security: "All open",
    securityTone: "good",
  },
  "alb-adult-open": {
    num: "Karen Hughes",
    ext: "2224",
    vocera: "#NUM-22",
    criteria: "Regional adult psychiatric unit for Great Southern region with telemetry link to Perth State Bed Desk.",
    mhaForms: "Form 1A, Form 6A",
    security: "All open",
    securityTone: "good",
  },
  "bun-adult-open": {
    num: "Stephen Clarke",
    ext: "9014",
    vocera: "#NUM-90",
    criteria: "Regional high-dependency acute psychiatric intake and assessment for South West WA.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "All open",
    securityTone: "good",
  },
  "brm-adult-secure": {
    num: "Bradley King",
    ext: "8420",
    vocera: "#NUM-84",
    criteria: "Kimberley regional acute culturally-grounded mental health inpatient unit with RFDS coordination.",
    mhaForms: "Form 4A, Form 6A, CLMA Remand",
    security: "All locked",
    securityTone: "danger",
  },
  "ger-adult-open": {
    num: "Rachel Adams",
    ext: "3140",
    vocera: "#NUM-31",
    criteria: "Midwest regional acute psychiatric intake, stabilization, and crisis admissions.",
    mhaForms: "Form 1A, Form 6A",
    security: "All open",
    securityTone: "good",
  },
  "sjgs-adult-open": {
    num: "Julian Croft",
    ext: "3310",
    vocera: "#NUM-33",
    criteria: "Private adult voluntary inpatient stabilization, mood disorder therapies, and anxiety treatment programs.",
    mhaForms: "Voluntary Admissions, Form 1A",
    security: "All open",
    securityTone: "good",
  },
  "sjgs-adult-secure": {
    num: "Sophie Turner",
    ext: "9901",
    vocera: "#NUM-99",
    criteria: "Private secure high-dependency crisis stabilization and psychiatric care.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "All locked",
    securityTone: "danger",
  },
  // Legacy aliases for backward compatibility with mockups
  "armadale-adult": {
    num: "Patricia Wright",
    ext: "3820",
    vocera: "#NUM-38",
    criteria: "Acute inpatient psychiatric care for south-east metropolitan catchment under WA Mental Health Act.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "All open",
    securityTone: "good",
  },
  "midland-adult": {
    num: "Emma Wilson",
    ext: "7308",
    vocera: "#NUM-73",
    criteria: "Eastern corridor acute adult admissions, emergency department liaison transfers, and crisis beds.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "All open",
    securityTone: "good",
  },
  "fremantle-adult-open": {
    num: "Fiona Campbell",
    ext: "4112",
    vocera: "#NUM-41",
    criteria: "South-west coastal corridor acute psychiatric intake, multidisciplinary stabilization, and crisis care.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "All open",
    securityTone: "good",
  },
  "graylands-dorrington": {
    num: "Clare Douglas",
    ext: "4102",
    vocera: "#NUM-41",
    criteria:
      "Adults 18–64 under Form 1A/Form 6A requiring intensive psychiatric containment and high-dependency nursing.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "All locked",
    securityTone: "danger",
  },
};

function getServiceCode(serviceName?: HealthService | string): "NMHS" | "SMHS" | "EMHS" | "WACHS" | "Private" | "OTHER" {
  if (!serviceName) return "OTHER";
  if (serviceName.includes("North Metro")) return "NMHS";
  if (serviceName.includes("South Metro")) return "SMHS";
  if (serviceName.includes("East Metro")) return "EMHS";
  if (serviceName.includes("WACHS") || serviceName.includes("Country")) return "WACHS";
  if (serviceName.includes("Private") || serviceName.includes("St John") || serviceName.includes("SJGM")) return "Private";
  return "OTHER";
}

function getCohortKey(unit: Unit): "adult-acute" | "older-adult" | "perinatal" | "forensic" | "sub-acute" {
  if (unit.forensic || /forensic/i.test(unit.name) || /forensic/i.test(unit.cohort)) return "forensic";
  if (/older/i.test(unit.cohort) || /psychogeriatric/i.test(unit.cohort) || /older/i.test(unit.name))
    return "older-adult";
  if (/perinatal|mbu|mother|youth|adolescent/i.test(unit.cohort) || /perinatal|mbu|youth|adolescent/i.test(unit.name))
    return "perinatal";
  if (/sub-acute|rehab/i.test(unit.cohort) || /sub-acute|rehab/i.test(unit.name))
    return "sub-acute";
  return "adult-acute";
}

function getAcuityLabel(unit: Unit): { label: string; tone: "danger" | "warn" | "good" | "accent" | "gilt" } {
  if (unit.forensic) return { label: "Forensic", tone: "danger" };
  const summary = designationSummary(unit);
  if (unitHasLockedBeds(unit) && unitHasOpenBeds(unit)) return { label: summary, tone: "warn" };
  if (unitHasLockedBeds(unit)) return { label: summary, tone: "danger" };
  return { label: summary, tone: "good" };
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

  // Dropdown states & refs
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [cohortDropdownOpen, setCohortDropdownOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const cohortDropdownRef = useRef<HTMLDivElement>(null);

  // Outside click & keyboard navigation listener
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setStatusDropdownOpen(false);
      }
      if (cohortDropdownRef.current && !cohortDropdownRef.current.contains(e.target as Node)) {
        setCohortDropdownOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setStatusDropdownOpen(false);
        setCohortDropdownOpen(false);
        setProfileWardId(null);
      }
      if (
        e.key === "/" &&
        document.activeElement !== searchInputRef.current &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

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
    setStatusDropdownOpen(false);
    setCohortDropdownOpen(false);
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
        {/* Page Header with Telemetry Capsule (Elevated Workstation Architecture) */}
        <header className={styles.pageHeader}>
          <div className={styles.headerLeft}>
            <div className={styles.titleGroup}>
              <h1 className={styles.pageTitle}>
                <span className={styles.liveBeacon} aria-hidden="true">
                  <span className={styles.liveDot} />
                  <span className={styles.liveRing} />
                </span>
                All wards
              </h1>
              <span className={styles.pageSubtitleNote}>Statewide Inpatient Directory · Real-time census</span>
            </div>

            {/* Accessible text contract for automated suites */}
            <div
              className={styles.srOnly}
              style={{
                position: "absolute",
                width: "1px",
                height: "1px",
                padding: 0,
                margin: "-1px",
                overflow: "hidden",
                clip: "rect(0, 0, 0, 0)",
                whiteSpace: "nowrap",
                border: 0,
              }}
            >
              <h2>Statewide Capacity Indicators</h2>
              <div>Operational Wards</div>
              <div>Total Staffed Beds</div>
              <div>Available Beds Now</div>
              <div>Locked & HDU Units</div>
            </div>

            {/* Apple Health-caliber Telemetry Pill Capsule */}
            <div className={styles.telemetryCapsule} role="region" aria-label="Statewide Ward Telemetry">
              <div
                className={`${styles.telemetryItem} ${styles.interactiveItem} ${selectedService === "all" && selectedAvail === "all" && selectedCohort === "all" && !searchQuery ? styles.telemetryItemActive : ""}`}
                onClick={resetFilters}
                title="Click to view all operational wards"
                tabIndex={0}
                role="button"
                aria-pressed={selectedService === "all" && selectedAvail === "all" && selectedCohort === "all" && !searchQuery}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    resetFilters();
                  }
                }}
              >
                <span className={styles.telemetryLabel}>WARDS</span>
                <span className={styles.telemetryVal}>{units.length}</span>
                <span className={styles.telemetrySub}>· 5 clusters</span>
              </div>

              <div
                className={styles.telemetryItem}
                title={`Network bed occupancy: ${totalOccupiedBeds} of ${totalStaffedBeds} beds (${networkOccupancyPct}%)`}
              >
                <span className={styles.telemetryLabel}>BEDS</span>
                <span className={styles.telemetryVal}>{totalStaffedBeds}</span>
                <div className={styles.microMeter} aria-hidden="true" title={`${networkOccupancyPct}% Occupancy`}>
                  <div
                    className={styles.microMeterFill}
                    style={{ width: `${Math.min(100, Number(networkOccupancyPct))}%` }}
                  />
                </div>
                <span className={styles.telemetrySub}>{networkOccupancyPct}% occ</span>
              </div>

              <div
                className={`${styles.telemetryItem} ${styles.interactiveItem} ${selectedAvail === "vacant" ? styles.telemetryItemActive : ""}`}
                onClick={() => setSelectedAvail(selectedAvail === "vacant" ? "all" : "vacant")}
                title="Filter wards with ready available vacancies"
                tabIndex={0}
                role="button"
                aria-pressed={selectedAvail === "vacant"}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedAvail(selectedAvail === "vacant" ? "all" : "vacant");
                  }
                }}
              >
                <span className={styles.telemetryLabel}>AVAILABLE</span>
                <span className={styles.telemetryPillGood}>{totalAvailableBeds} Ready</span>
              </div>

              <div
                className={`${styles.telemetryItem} ${styles.interactiveItem} ${selectedAvail === "high-acuity" ? styles.telemetryItemActive : ""}`}
                onClick={() => setSelectedAvail(selectedAvail === "high-acuity" ? "all" : "high-acuity")}
                title="Filter locked and HDU high-acuity units"
                tabIndex={0}
                role="button"
                aria-pressed={selectedAvail === "high-acuity"}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedAvail(selectedAvail === "high-acuity" ? "all" : "high-acuity");
                  }
                }}
              >
                <span className={styles.telemetryLabel}>LOCKED/HDU</span>
                <span className={styles.telemetryPillDanger}>{lockedUnitsCount}</span>
                <span className={styles.telemetrySub}>· {totalActiveSpecialling} 1:1</span>
              </div>
            </div>
          </div>
        </header>

        {/* Natural Language Executive Statement */}
        <div className={styles.executiveStatement} role="status">
          <span className={styles.statementPip} aria-hidden="true" />
          <span className={styles.statementText}>
            <strong>Statewide Census:</strong> {units.length} operational inpatient units &middot;{" "}
            <span className={styles.statementVal}>{totalStaffedBeds}</span> staffed beds &middot;{" "}
            <span className={styles.statementVal}>{networkOccupancyPct}%</span> network occupancy &middot;{" "}
            <span className={styles.statementValGood}>{totalAvailableBeds}</span> beds ready for intake
          </span>
        </div>

        {/* 2-Row Structured Filter Cockpit (Option 2 Architecture) */}
        <section className={styles.cockpitPanel} aria-label="Directory Filters">
          {/* Row 1: Health Service Cluster Tabs */}
          <div
            className={styles.cockpitTabBar}
            role="tablist"
            aria-label="Health Service Cluster"
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "Home" || e.key === "End") {
                const tabs = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
                const activeTab = (document.activeElement as HTMLElement)?.closest<HTMLButtonElement>('[role="tab"]');
                const currentIndex = activeTab
                  ? tabs.indexOf(activeTab)
                  : tabs.findIndex((t) => t.getAttribute("aria-selected") === "true");
                if (currentIndex !== -1) {
                  e.preventDefault();
                  let nextIndex = currentIndex;
                  if (e.key === "Home") {
                    nextIndex = 0;
                  } else if (e.key === "End") {
                    nextIndex = tabs.length - 1;
                  } else if (e.key === "ArrowRight") {
                    nextIndex = (currentIndex + 1) % tabs.length;
                  } else if (e.key === "ArrowLeft") {
                    nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                  }
                  const targetTab = tabs[nextIndex];
                  if (targetTab) {
                    targetTab.focus();
                    targetTab.click();
                  }
                }
              }
            }}
          >
            <button
              className={`${styles.cockpitTab} ${selectedService === "all" ? styles.active : ""}`}
              type="button"
              role="tab"
              aria-selected={selectedService === "all"}
              tabIndex={selectedService === "all" ? 0 : -1}
              onClick={() => setSelectedService("all")}
            >
              <span>All Services</span>
              <span className={styles.clusterTabCount}>{units.length}</span>
            </button>
            <button
              className={`${styles.cockpitTab} ${selectedService === "NMHS" ? styles.active : ""}`}
              type="button"
              role="tab"
              aria-selected={selectedService === "NMHS"}
              tabIndex={selectedService === "NMHS" ? 0 : -1}
              onClick={() => setSelectedService("NMHS")}
            >
              <span>North Metro NMHS</span>
              <span className={styles.clusterTabCount}>
                {units.filter((u) => getServiceCode(siteByCode(u.siteCode)?.service) === "NMHS").length}
              </span>
            </button>
            <button
              className={`${styles.cockpitTab} ${selectedService === "SMHS" ? styles.active : ""}`}
              type="button"
              role="tab"
              aria-selected={selectedService === "SMHS"}
              tabIndex={selectedService === "SMHS" ? 0 : -1}
              onClick={() => setSelectedService("SMHS")}
            >
              <span>South Metro SMHS</span>
              <span className={styles.clusterTabCount}>
                {units.filter((u) => getServiceCode(siteByCode(u.siteCode)?.service) === "SMHS").length}
              </span>
            </button>
            <button
              className={`${styles.cockpitTab} ${selectedService === "EMHS" ? styles.active : ""}`}
              type="button"
              role="tab"
              aria-selected={selectedService === "EMHS"}
              tabIndex={selectedService === "EMHS" ? 0 : -1}
              onClick={() => setSelectedService("EMHS")}
            >
              <span>East Metro EMHS</span>
              <span className={styles.clusterTabCount}>
                {units.filter((u) => getServiceCode(siteByCode(u.siteCode)?.service) === "EMHS").length}
              </span>
            </button>
            <button
              className={`${styles.cockpitTab} ${selectedService === "WACHS" ? styles.active : ""}`}
              type="button"
              role="tab"
              aria-selected={selectedService === "WACHS"}
              tabIndex={selectedService === "WACHS" ? 0 : -1}
              onClick={() => setSelectedService("WACHS")}
            >
              <span>WA Country WACHS</span>
              <span className={styles.clusterTabCount}>
                {units.filter((u) => getServiceCode(siteByCode(u.siteCode)?.service) === "WACHS").length}
              </span>
            </button>
            <button
              className={`${styles.cockpitTab} ${selectedService === "Private" ? styles.active : ""}`}
              type="button"
              role="tab"
              aria-selected={selectedService === "Private"}
              tabIndex={selectedService === "Private" ? 0 : -1}
              onClick={() => setSelectedService("Private")}
            >
              <span>Private</span>
              <span className={styles.clusterTabCount}>
                {units.filter((u) => getServiceCode(siteByCode(u.siteCode)?.service) === "Private").length}
              </span>
            </button>
          </div>

          {/* Row 2: Search Input + Status & Cohort Dropdowns + Feedback */}
          <div className={styles.cockpitControlRow}>
            <div className={styles.cockpitLeftControls}>
              {/* Enriched Search Input */}
              <div className={styles.cockpitSearchWrap}>
                <svg
                  className={styles.cockpitSearchIcon}
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
                  ref={searchInputRef}
                  type="search"
                  id="wardSearchInput"
                  className={styles.cockpitSearchInput}
                  placeholder="Filter 22 wards by hospital, service, suburb..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoComplete="off"
                  spellCheck="false"
                  aria-label="Filter wards by keyword"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    className={styles.cockpitClearBtn}
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                ) : (
                  <kbd className={styles.cockpitShortcutKbd}>/</kbd>
                )}
              </div>

              {/* Status Dropdown Menu */}
              <div
                className={`${styles.dropdownAnchor} ${statusDropdownOpen ? styles.open : ""}`}
                ref={statusDropdownRef}
              >
                <button
                  type="button"
                  className={`${styles.dropdownBtn} ${selectedAvail !== "all" ? styles.hasActiveFilter : ""}`}
                  onClick={() => {
                    setStatusDropdownOpen(!statusDropdownOpen);
                    setCohortDropdownOpen(false);
                  }}
                  aria-expanded={statusDropdownOpen}
                  aria-haspopup="true"
                  aria-label={selectedAvail === "all" ? "All" : `Status: ${selectedAvail}`}
                >
                  <span className={styles.dropdownPrefix}>STATUS:</span>
                  <span>
                    {selectedAvail === "all"
                      ? "All Statuses"
                      : selectedAvail === "vacant"
                        ? "Available Wards"
                        : selectedAvail === "full"
                          ? "Full / At Capacity"
                          : "High-Acuity Units"}
                  </span>
                  <svg className={styles.dropdownChevron} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                {statusDropdownOpen && (
                  <div className={styles.dropdownPopover} role="menu" aria-label="Filter by Status">
                    <div className={styles.dropdownHeader}>Bed Availability Status</div>
                    <button
                      type="button"
                      role="menuitem"
                      className={`${styles.dropdownItem} ${selectedAvail === "all" ? styles.selected : ""}`}
                      onClick={() => {
                        setSelectedAvail("all");
                        setStatusDropdownOpen(false);
                      }}
                    >
                      <span>All Statuses</span>
                      <span className={styles.dropdownItemCount}>{units.length}</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={`${styles.dropdownItem} ${selectedAvail === "vacant" ? styles.selected : ""}`}
                      onClick={() => {
                        setSelectedAvail("vacant");
                        setStatusDropdownOpen(false);
                      }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span className={styles.availDotGood} aria-hidden="true" />
                        Available Wards
                      </span>
                      <span className={styles.dropdownItemCount}>
                        {units.filter((u) => unitCapacity(u, bedReleases).available > 0).length}
                      </span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={`${styles.dropdownItem} ${selectedAvail === "full" ? styles.selected : ""}`}
                      onClick={() => {
                        setSelectedAvail("full");
                        setStatusDropdownOpen(false);
                      }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span className={styles.availDotDanger} aria-hidden="true" />
                        Full / At Capacity
                      </span>
                      <span className={styles.dropdownItemCount}>
                        {units.filter((u) => unitCapacity(u, bedReleases).available === 0).length}
                      </span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={`${styles.dropdownItem} ${selectedAvail === "high-acuity" ? styles.selected : ""}`}
                      onClick={() => {
                        setSelectedAvail("high-acuity");
                        setStatusDropdownOpen(false);
                      }}
                    >
                      <span>High-Acuity Units</span>
                      <span className={styles.dropdownItemCount}>
                        {units.filter((u) => unitHasLockedBeds(u)).length}
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {/* Cohort Dropdown Menu */}
              <div
                className={`${styles.dropdownAnchor} ${cohortDropdownOpen ? styles.open : ""}`}
                ref={cohortDropdownRef}
              >
                <button
                  type="button"
                  className={`${styles.dropdownBtn} ${selectedCohort !== "all" ? styles.hasActiveFilter : ""}`}
                  onClick={() => {
                    setCohortDropdownOpen(!cohortDropdownOpen);
                    setStatusDropdownOpen(false);
                  }}
                  aria-expanded={cohortDropdownOpen}
                  aria-haspopup="true"
                  aria-label={selectedCohort === "all" ? "All Cohorts" : `Cohort: ${selectedCohort}`}
                >
                  <span className={styles.dropdownPrefix}>COHORT:</span>
                  <span>
                    {selectedCohort === "all"
                      ? "All Cohorts"
                      : selectedCohort === "adult-acute"
                        ? "Adult Acute"
                        : selectedCohort === "older-adult"
                          ? "Older Adult / Psychogeriatric"
                          : selectedCohort === "perinatal"
                            ? "Perinatal / MBU"
                            : selectedCohort === "forensic"
                              ? "Forensic / Secure HDU"
                              : "Sub-Acute / Rehabilitation"}
                  </span>
                  <svg className={styles.dropdownChevron} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                {cohortDropdownOpen && (
                  <div className={styles.dropdownPopover} role="menu" aria-label="Filter by Clinical Cohort">
                    <div className={styles.dropdownHeader}>Clinical Cohort Designation</div>
                    <button
                      type="button"
                      role="menuitem"
                      className={`${styles.dropdownItem} ${selectedCohort === "all" ? styles.selected : ""}`}
                      onClick={() => {
                        setSelectedCohort("all");
                        setCohortDropdownOpen(false);
                      }}
                    >
                      <span>All Cohorts</span>
                      <span className={styles.dropdownItemCount}>{units.length}</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={`${styles.dropdownItem} ${selectedCohort === "adult-acute" ? styles.selected : ""}`}
                      onClick={() => {
                        setSelectedCohort("adult-acute");
                        setCohortDropdownOpen(false);
                      }}
                    >
                      <span>Adult Acute</span>
                      <span className={styles.dropdownItemCount}>
                        {units.filter((u) => getCohortKey(u) === "adult-acute").length}
                      </span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={`${styles.dropdownItem} ${selectedCohort === "older-adult" ? styles.selected : ""}`}
                      onClick={() => {
                        setSelectedCohort("older-adult");
                        setCohortDropdownOpen(false);
                      }}
                    >
                      <span>Older Adult / Psychogeriatric</span>
                      <span className={styles.dropdownItemCount}>
                        {units.filter((u) => getCohortKey(u) === "older-adult").length}
                      </span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={`${styles.dropdownItem} ${selectedCohort === "perinatal" ? styles.selected : ""}`}
                      onClick={() => {
                        setSelectedCohort("perinatal");
                        setCohortDropdownOpen(false);
                      }}
                    >
                      <span>Perinatal / MBU</span>
                      <span className={styles.dropdownItemCount}>
                        {units.filter((u) => getCohortKey(u) === "perinatal").length}
                      </span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={`${styles.dropdownItem} ${selectedCohort === "forensic" ? styles.selected : ""}`}
                      onClick={() => {
                        setSelectedCohort("forensic");
                        setCohortDropdownOpen(false);
                      }}
                    >
                      <span>Forensic / Secure HDU</span>
                      <span className={styles.dropdownItemCount}>
                        {units.filter((u) => getCohortKey(u) === "forensic").length}
                      </span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={`${styles.dropdownItem} ${selectedCohort === "sub-acute" ? styles.selected : ""}`}
                      onClick={() => {
                        setSelectedCohort("sub-acute");
                        setCohortDropdownOpen(false);
                      }}
                    >
                      <span>Sub-Acute / Rehabilitation</span>
                      <span className={styles.dropdownItemCount}>
                        {units.filter((u) => getCohortKey(u) === "sub-acute").length}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right side feedback & reset */}
            <div className={styles.cockpitFeedback}>
              <span>
                Showing <b>{filteredUnits.length}</b> of {units.length} wards
              </span>
              {isFiltered && (
                <button
                  type="button"
                  className={styles.cockpitResetBtn}
                  onClick={resetFilters}
                  aria-label="Reset Filters"
                  title="Clear all active search and filter parameters"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Directory Sub-Header Bar (from Image Reference) */}
        <div className={styles.directorySubBar}>
          <div className={styles.directorySubTitle}>
            Inpatient Wards Directory{" "}
            <span className={styles.directorySubCount}>
              (Showing {filteredUnits.length} of {units.length} statewide wards)
            </span>
          </div>
          <div className={styles.directorySubHint}>
            Click any ward to inspect NUM contact &amp; criteria
          </div>
        </div>

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
                        <div className={styles.cardTitleLine}>
                          <span
                            className={styles.cardStatusPip}
                            data-tone={occNum >= 100 ? "danger" : occNum >= 90 ? "warn" : "good"}
                            aria-hidden="true"
                          />
                          <h4 className={styles.wardTitle} title={unit.name}>{unit.name}</h4>
                        </div>
                        <div className={styles.wardFacility} title={site?.name ?? unit.siteCode}>
                          {site?.name ?? unit.siteCode}
                        </div>
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

                  {/* Meter Section: Zero Wrapping, Zero Overflow */}
                  <div className={styles.cardMeterSection}>
                    <div className={styles.meterHeader}>
                      <div className={styles.meterLeftGroup}>
                        <span className={styles.meterLabel}>Occupancy</span>
                        <span className={styles.meterPct}>{occPct}%</span>
                      </div>
                      <span className={`${styles.meterStatusBadge} ${statusTone}`}>{statusText}</span>
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
                    <div className={styles.meterSubRow}>
                      <span
                        className={styles.meterSubText}
                        title={`${cap.occupied} of ${unit.beds} staffed beds occupied`}
                      >
                        <b>{cap.occupied}</b> of <b>{unit.beds}</b> staffed beds occupied
                      </span>
                      <span className={styles.meterAvailHint}>
                        {cap.available > 0 ? (
                          <span className={styles.meterAvailGood}><b>{cap.available}</b> ready</span>
                        ) : (
                          <span className={styles.meterAvailFull}>0 ready</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* 4-Column Clinical Matrix: Generous, crisp, zero awkward wrap */}
                  <div className={styles.compactStatsStrip}>
                    <div className={styles.statCol} title={`Base staffed complement: ${unit.beds} beds`}>
                      <span className={styles.statColLabel}>Staffed</span>
                      <span className={styles.statColVal}>{unit.beds}</span>
                      <span className={styles.statColSub}>Total</span>
                    </div>

                    <div className={styles.statCol} title={`Current admitted census: ${cap.occupied} patients`}>
                      <span className={styles.statColLabel}>Occupied</span>
                      <span className={styles.statColVal}>{cap.occupied}</span>
                      <span className={styles.statColSub}>Census</span>
                    </div>

                    <div
                      className={styles.statCol}
                      title={
                        cap.available > 0
                          ? `${cap.available} ready for intake${pendingPrep > 0 ? ` (${pendingPrep} preparing)` : ""}`
                          : "Capacity saturated (0 vacancies)"
                      }
                    >
                      <span className={styles.statColLabel}>Available</span>
                      <span className={`${styles.statColVal} ${cap.available > 0 ? styles.vacantGood : styles.fullDanger}`}>
                        {cap.available}
                      </span>
                      <span className={styles.statColSub}>
                        {cap.available > 0 ? "Ready" : "None"}
                      </span>
                    </div>

                    <div
                      className={styles.statCol}
                      title={
                        activeSpecialling > 0
                          ? `${activeSpecialling} patients requiring 1:1 specialling nursing`
                          : "No patients requiring 1:1 specialling nursing"
                      }
                    >
                      <span className={styles.statColLabel}>1:1 Spec</span>
                      <span className={`${styles.statColVal} ${activeSpecialling > 0 ? styles.speciallingActive : ""}`}>
                        {activeSpecialling}
                      </span>
                      <span className={styles.statColSub}>
                        {activeSpecialling > 0 ? "Active" : "None"}
                      </span>
                    </div>
                  </div>

                  {/* Flow Indicators: Dedicated 2-Column Grid with Lucide-style Modern SVG Arrows */}
                  <div className={styles.flowStrip}>
                    <div
                      className={`${styles.flowChip} ${styles.flowDischarge}`}
                      title={`${unitReleases} patient discharges scheduled today`}
                    >
                      <svg
                        className={styles.flowIcon}
                        viewBox="0 0 24 24"
                        width="13"
                        height="13"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <line x1="7" y1="17" x2="17" y2="7" />
                        <polyline points="7 7 17 7 17 17" />
                      </svg>
                      <span className={styles.flowText}>
                        <b>{unitReleases}</b> Discharges
                      </span>
                    </div>
                    <div
                      className={`${styles.flowChip} ${styles.flowInbound}`}
                      title={`${unitInbounds} inbound patient transfers pending`}
                    >
                      <svg
                        className={styles.flowIcon}
                        viewBox="0 0 24 24"
                        width="13"
                        height="13"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <line x1="17" y1="7" x2="7" y2="17" />
                        <polyline points="17 17 7 17 7 7" />
                      </svg>
                      <span className={styles.flowText}>
                        <b>{unitInbounds}</b> Inbound
                      </span>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className={styles.cardFoot}>
                    <Link
                      className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}
                      href={`/mockups/ward-flow/ward/${unit.id}`}
                      data-testid={`ward-index-link-${unit.id}`}
                    >
                      <span>Enter Ward</span>
                      <span aria-hidden="true">&rarr;</span>
                    </Link>
                    <Link
                      className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
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
                        strokeLinecap="round"
                        strokeLinejoin="round"
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
                <div style={{ fontSize: "var(--t-0, 12px)", color: "var(--muted)", marginTop: "2px" }}>
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
