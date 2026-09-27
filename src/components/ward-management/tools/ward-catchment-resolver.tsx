"use client";

import React, { useState, useId } from "react";
import {
  CATCHMENT_DOCUMENTS,
  S2015_CATCHMENT_ROWS,
  lookupCatchment,
  normaliseSuburbKey,
  type CatchmentAnswer,
  type CatchmentLookup,
} from "@/components/ward-management/ward-catchment";
import { getHealthServiceBadgeStyle, getHealthServiceDotStyle } from "@/components/ward-management/ward-service-colors";
import { siteByCode } from "@/components/ward-management/ward-sites";
import styles from "./ward-catchment-resolver.module.css";

/** A hospital's name as the data layer holds it (`ward-sites.ts`), never restated here. */
function siteName(code: string): string {
  return siteByCode(code)?.name ?? code;
}

export type HealthServiceCode = "NMHS" | "EMHS" | "SMHS" | "WACHS";

export interface HealthServiceInfo {
  readonly code: HealthServiceCode;
  readonly name: string;
  readonly displayName: string;
}

export interface ServiceHospitalMapping extends HealthServiceInfo {
  readonly hospital: string;
}

export type CatchmentStatus = "Reviewed direct match" | "Contested / split" | "Unreviewed" | "Not found";

export interface ContestedAnswerDetail {
  readonly clinics: readonly string[];
  readonly documentId: string;
  readonly documentLabel: string;
  readonly hospital: string;
  readonly healthService: HealthServiceInfo;
  readonly postcodes: readonly string[];
}

export interface ResolvedCatchment {
  readonly suburb: string;
  readonly postcodes: readonly string[];
  readonly healthService: HealthServiceInfo;
  readonly primaryHospital: string;
  readonly communityClinic: string;
  readonly status: CatchmentStatus;
  readonly caveats?: string;
  readonly contestedAnswers?: readonly ContestedAnswerDetail[];
  readonly documentSources: readonly string[];
  readonly rawLookup?: CatchmentLookup;
}

export type QueryResolutionType = "suburb" | "postcode" | "not-found" | "empty";

export interface CatchmentQueryResult {
  readonly query: string;
  readonly type: QueryResolutionType;
  readonly results: readonly ResolvedCatchment[];
  readonly notFoundMessage?: string;
}

export const QUICK_PICK_SUBURBS = ["Perth", "Morley", "Fremantle", "Armadale", "Joondalup", "Rockingham"] as const;

/**
 * Authoritative mapping from a clinic string (and optional context) to its
 * governing Health Service (NMHS / EMHS / SMHS / WACHS) and Primary Admitting Hospital.
 */
export function mapClinicToServiceAndHospital(clinicStr: string): ServiceHospitalMapping {
  const norm = clinicStr.trim().toLowerCase();

  // 1. South Metropolitan Health Service (SMHS)
  if (norm.startsWith("alma street") || norm === "fremantle") {
    return {
      code: "SMHS",
      name: "South Metropolitan Health Service",
      displayName: "South Metro / SMHS",
      hospital: "Fiona Stanley Hospital (FSH) / Fremantle Hospital",
    };
  }
  if (norm.includes("peel") || norm.includes("rockingham") || norm.includes("kwinana")) {
    const isPeel = norm.includes("peel");
    return {
      code: "SMHS",
      name: "South Metropolitan Health Service",
      displayName: "South Metro / SMHS",
      hospital: isPeel ? `${siteName("RGH")} / ${siteName("PEEL")}` : siteName("RGH"),
    };
  }

  // 2. East Metropolitan Health Service (EMHS)
  if (norm.includes("armadale") || norm.includes("mead") || norm.includes("eudoria")) {
    return {
      code: "EMHS",
      name: "East Metropolitan Health Service",
      displayName: "East Metro / EMHS",
      hospital: "Armadale Health Service (Armadale Hospital)",
    };
  }
  if (norm.includes("bentley") || norm.includes("mills street")) {
    return {
      code: "EMHS",
      name: "East Metropolitan Health Service",
      displayName: "East Metro / EMHS",
      hospital: "Bentley Hospital / Royal Perth Hospital (RPH)",
    };
  }
  if (norm.includes("midland") || norm.includes("midalnd") || norm.includes("swan")) {
    return {
      code: "EMHS",
      name: "East Metropolitan Health Service",
      displayName: "East Metro / EMHS",
      hospital: siteName("SJGM"),
    };
  }
  if (norm.includes("inner city") || norm === "icc") {
    return {
      code: "EMHS",
      name: "East Metropolitan Health Service",
      displayName: "East Metro / EMHS",
      hospital: "Royal Perth Hospital (RPH) / Sir Charles Gairdner Hospital (SCGH)",
    };
  }

  // 3. North Metropolitan Health Service (NMHS)
  if (norm.includes("joondalup") || norm.includes("clarkson")) {
    return {
      code: "NMHS",
      name: "North Metropolitan Health Service",
      displayName: "North Metro / NMHS",
      hospital: siteName("JHC"),
    };
  }
  if (norm.includes("mirrabooka") || norm.includes("osborne") || norm.includes("subiaco")) {
    return {
      code: "NMHS",
      name: "North Metropolitan Health Service",
      displayName: "North Metro / NMHS",
      hospital: "Graylands Hospital / Sir Charles Gairdner Hospital (SCGH)",
    };
  }

  // 4. WA Country Health Service (WACHS)
  if (norm === "bunbury") {
    return {
      code: "WACHS",
      name: "WA Country Health Service",
      displayName: "Country Health (WACHS)",
      hospital: siteName("BUN"),
    };
  }
  if (norm.includes("albany") || norm.includes("lower great southern")) {
    return {
      code: "WACHS",
      name: "WA Country Health Service",
      displayName: "Country Health (WACHS)",
      hospital: siteName("ALB"),
    };
  }
  if (norm.includes("great south") || (norm.includes("southern") && !norm.includes("coastal"))) {
    return {
      code: "WACHS",
      name: "WA Country Health Service",
      displayName: "Country Health (WACHS)",
      hospital: `${siteName("ALB")} / Narrogin Hospital (Metro receiving: FSH)`,
    };
  }
  if (norm.includes("narrogin")) {
    return {
      code: "WACHS",
      name: "WA Country Health Service",
      displayName: "Country Health (WACHS)",
      hospital: "Narrogin Hospital (Metro receiving: FSH)",
    };
  }
  if (norm.includes("wheat") || norm.includes("northam") || norm.includes("merredin") || norm.includes("western")) {
    return {
      code: "WACHS",
      name: "WA Country Health Service",
      displayName: "Country Health (WACHS)",
      hospital: "Northam Hospital / Merredin Hospital (Metro receiving: RPH)",
    };
  }
  if (norm.includes("geraldton") || norm.includes("midwest")) {
    return {
      code: "WACHS",
      name: "WA Country Health Service",
      displayName: "Country Health (WACHS)",
      hospital: "Geraldton Hospital (Metro receiving: SCGH)",
    };
  }
  if (norm.includes("gascoyne") || norm.includes("murchison")) {
    return {
      code: "WACHS",
      name: "WA Country Health Service",
      displayName: "Country Health (WACHS)",
      hospital: "Carnarvon Hospital / Geraldton Hospital (Metro receiving: SCGH)",
    };
  }
  if (norm.includes("goldfield") || norm.includes("coastal")) {
    return {
      code: "WACHS",
      name: "WA Country Health Service",
      displayName: "Country Health (WACHS)",
      hospital: "Kalgoorlie Health Campus / Esperance Hospital (Metro receiving: FSH)",
    };
  }
  if (norm.includes("kimberley")) {
    return {
      code: "WACHS",
      name: "WA Country Health Service",
      displayName: "Country Health (WACHS)",
      hospital: "Broome Hospital / Kununurra Hospital (Metro receiving: RPH)",
    };
  }
  if (norm.includes("pilbara") || norm.includes("north west")) {
    return {
      code: "WACHS",
      name: "WA Country Health Service",
      displayName: "Country Health (WACHS)",
      hospital: "Hedland Health Campus / Nickol Bay Hospital (Metro receiving: RPH)",
    };
  }

  // Fallback for unrecognised country locality
  return {
    code: "WACHS",
    name: "WA Country Health Service",
    displayName: "Country Health (WACHS)",
    hospital: "Regional Health Campus (WACHS)",
  };
}

/** Pre-indexed lookup sets for postcodes and suburbs */
const ROWS_BY_POSTCODE: ReadonlyMap<string, readonly (typeof S2015_CATCHMENT_ROWS)[number][]> = (() => {
  const map = new Map<string, (typeof S2015_CATCHMENT_ROWS)[number][]>();
  for (const row of S2015_CATCHMENT_ROWS) {
    if (!row.postcode) continue;
    const bucket = map.get(row.postcode);
    if (bucket) bucket.push(row);
    else map.set(row.postcode, [row]);
  }
  return map;
})();

const POSTCODES_BY_SUBURB_KEY: ReadonlyMap<string, readonly string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const row of S2015_CATCHMENT_ROWS) {
    const key = normaliseSuburbKey(row.suburb);
    const bucket = map.get(key);
    if (bucket) {
      if (!bucket.includes(row.postcode)) bucket.push(row.postcode);
    } else {
      map.set(key, [row.postcode]);
    }
  }
  return map;
})();

/**
 * Resolves a single suburb name into a full ResolvedCatchment representation.
 */
export function resolveSuburb(suburbQuery: string): ResolvedCatchment | null {
  const lookup = lookupCatchment(suburbQuery);
  if (lookup.state === "unknown") {
    return null;
  }

  const suburbName = lookup.suburb;
  const suburbKey = normaliseSuburbKey(suburbName);
  const knownPostcodes = POSTCODES_BY_SUBURB_KEY.get(suburbKey) ?? [];

  // Extract distinct document sources
  const documentSources = Array.from(new Set(lookup.answers.map((a) => a.document.label || a.document.id)));

  if (lookup.state === "reviewed") {
    const primaryClinic = lookup.answers[0]?.clinics.join(", ") || "Clinic not recorded";
    const mapping = mapClinicToServiceAndHospital(primaryClinic);
    const postcodes = lookup.answers[0]?.postcodes.length > 0 ? lookup.answers[0].postcodes : knownPostcodes;

    return {
      suburb: suburbName,
      postcodes,
      healthService: {
        code: mapping.code,
        name: mapping.name,
        displayName: mapping.displayName,
      },
      primaryHospital: mapping.hospital,
      communityClinic: primaryClinic,
      status: "Reviewed direct match",
      documentSources,
      rawLookup: lookup,
    };
  }

  if (lookup.state === "unreviewed") {
    const primaryClinic = lookup.answers[0]?.clinics.join(", ") || "Clinic not recorded";
    const mapping = mapClinicToServiceAndHospital(primaryClinic);
    const postcodes = lookup.answers[0]?.postcodes.length > 0 ? lookup.answers[0].postcodes : knownPostcodes;

    return {
      suburb: suburbName,
      postcodes,
      healthService: {
        code: mapping.code,
        name: mapping.name,
        displayName: mapping.displayName,
      },
      primaryHospital: mapping.hospital,
      communityClinic: primaryClinic,
      status: "Unreviewed",
      caveats: lookup.note,
      documentSources,
      rawLookup: lookup,
    };
  }

  // Contested suburb
  const contestedAnswers: ContestedAnswerDetail[] = lookup.answers.map((ans) => {
    const clinicStr = ans.clinics.join(" / ");
    const mapping = mapClinicToServiceAndHospital(clinicStr);
    return {
      clinics: ans.clinics,
      documentId: ans.document.id,
      documentLabel: ans.document.label,
      hospital: mapping.hospital,
      healthService: {
        code: mapping.code,
        name: mapping.name,
        displayName: mapping.displayName,
      },
      postcodes: ans.postcodes,
    };
  });

  // Determine aggregate clinic string and hospital representation
  const clinicStrings = lookup.answers.map((a) => `${a.clinics.join(" / ")} (${a.document.id})`);
  const primaryClinic = clinicStrings.join(" vs ");

  // Aggregate hospital and health service
  const distinctServices = Array.from(new Set(contestedAnswers.map((a) => a.healthService.code)));
  const distinctHospitals = Array.from(new Set(contestedAnswers.map((a) => a.hospital)));

  const primaryServiceCode = distinctServices[0] ?? "SMHS";
  const primaryServiceName =
    distinctServices.length > 1
      ? `Split (${distinctServices.join(" / ")})`
      : (contestedAnswers[0]?.healthService.name ?? "South Metropolitan Health Service");
  const primaryServiceDisplay =
    distinctServices.length > 1
      ? `${distinctServices.join(" / ")} Split`
      : (contestedAnswers[0]?.healthService.displayName ?? "South Metro / SMHS");

  const allPostcodes = Array.from(new Set([...lookup.answers.flatMap((a) => a.postcodes), ...knownPostcodes]));

  return {
    suburb: suburbName,
    postcodes: allPostcodes,
    healthService: {
      code: primaryServiceCode,
      name: primaryServiceName,
      displayName: primaryServiceDisplay,
    },
    primaryHospital: distinctHospitals.join(" / "),
    communityClinic: primaryClinic,
    status: "Contested / split",
    caveats: lookup.note,
    contestedAnswers,
    documentSources,
    rawLookup: lookup,
  };
}

/**
 * Searches for all suburbs located within a specified 4-digit WA postcode.
 */
export function findSuburbsByPostcode(postcodeQuery: string): readonly ResolvedCatchment[] {
  const cleanPostcode = postcodeQuery.trim();
  const rows = ROWS_BY_POSTCODE.get(cleanPostcode);
  if (!rows || rows.length === 0) {
    return [];
  }

  // Deduplicate suburbs within this postcode
  const seenSuburbs = new Set<string>();
  const resolvedList: ResolvedCatchment[] = [];

  for (const row of rows) {
    const key = normaliseSuburbKey(row.suburb);
    if (seenSuburbs.has(key)) continue;
    seenSuburbs.add(key);

    const resolved = resolveSuburb(row.suburb);
    if (resolved) {
      resolvedList.push(resolved);
    }
  }

  return resolvedList;
}

/**
 * Main query resolver: parses either a suburb name or a postcode and produces
 * a structured resolution result.
 */
export function resolveCatchmentQuery(rawQuery: string): CatchmentQueryResult {
  const query = rawQuery.trim();
  if (!query) {
    return { query: "", type: "empty", results: [] };
  }

  // Check if query is a postcode (3 to 4 digits)
  if (/^\d{3,4}$/.test(query)) {
    const postcodeResults = findSuburbsByPostcode(query);
    if (postcodeResults.length > 0) {
      return {
        query,
        type: "postcode",
        results: postcodeResults,
      };
    }
    return {
      query,
      type: "not-found",
      results: [],
      notFoundMessage: `No WA catchment records found for postcode "${query}". Please check the 4-digit WA postcode or try searching by suburb name.`,
    };
  }

  // Attempt direct / aliased suburb resolution
  const suburbResult = resolveSuburb(query);
  if (suburbResult) {
    return {
      query,
      type: "suburb",
      results: [suburbResult],
    };
  }

  // Check if query matches a partial suburb name
  const norm = normaliseSuburbKey(query);
  const partialMatches = S2015_CATCHMENT_ROWS.filter((r) => normaliseSuburbKey(r.suburb).includes(norm));

  if (partialMatches.length > 0) {
    const seen = new Set<string>();
    const partialResults: ResolvedCatchment[] = [];

    for (const r of partialMatches) {
      const key = normaliseSuburbKey(r.suburb);
      if (seen.has(key)) continue;
      seen.add(key);

      const resolved = resolveSuburb(r.suburb);
      if (resolved) {
        partialResults.push(resolved);
      }
    }

    if (partialResults.length > 0) {
      return {
        query,
        type: "suburb",
        results: partialResults,
      };
    }
  }

  return {
    query,
    type: "not-found",
    results: [],
    notFoundMessage: `No WA catchment records found matching "${query}". Please check the spelling or search by 4-digit postcode.`,
  };
}

/**
 * Cleanly formats a catchment summary into a plain-text representation suitable
 * for copying to the clinical clipboard.
 */
export function formatCatchmentSummary(entry: ResolvedCatchment): string {
  const postcodesStr = entry.postcodes.length > 0 ? entry.postcodes.join(", ") : "Not recorded";
  const lines = [
    `WA Mental Health Catchment Summary`,
    `──────────────────────────────────`,
    `Suburb: ${entry.suburb}`,
    `Postcode: ${postcodesStr}`,
    `Health Service: ${entry.healthService.name} (${entry.healthService.code})`,
    `Primary Admitting Hospital: ${entry.primaryHospital}`,
    `Follow-up Community Clinic: ${entry.communityClinic}`,
    `Catchment Status: ${entry.status}`,
  ];

  if (entry.caveats) {
    lines.push(`Caveats / Notes: ${entry.caveats}`);
  }

  if (entry.contestedAnswers && entry.contestedAnswers.length > 0) {
    lines.push(`Discrepancy Details:`);
    for (const ans of entry.contestedAnswers) {
      lines.push(
        `  • ${ans.documentId}: ${ans.clinics.join(", ")} -> Hospital: ${ans.hospital} (${ans.healthService.code})`,
      );
    }
  }

  return lines.join("\n");
}

/** Safe clipboard copy helper */
async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to fallback below
    }
  }

  if (typeof document !== "undefined") {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textArea);
      return success;
    } catch {
      return false;
    }
  }

  return false;
}

export interface WardCatchmentResolverProps {
  readonly initialQuery?: string;
  readonly onSelectCatchment?: (entry: ResolvedCatchment) => void;
  readonly className?: string;
}

/**
 * WA Suburb-to-Catchment Resolver Component
 */
export function WardCatchmentResolver({
  initialQuery = "",
  onSelectCatchment,
  className = "",
}: WardCatchmentResolverProps) {
  const searchInputId = useId();
  const [query, setQuery] = useState(initialQuery);
  const [selectedSuburbIndex, setSelectedSuburbIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const queryResult = resolveCatchmentQuery(query);
  const hasResults = queryResult.results.length > 0;

  // Active result card
  const activeResult: ResolvedCatchment | undefined =
    queryResult.results[selectedSuburbIndex] ?? queryResult.results[0];

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setSelectedSuburbIndex(0);
  };

  const handleClear = () => {
    setQuery("");
    setSelectedSuburbIndex(0);
  };

  const handleQuickPick = (suburbName: string) => {
    setQuery(suburbName);
    setSelectedSuburbIndex(0);
  };

  const handleCopySummary = async () => {
    if (!activeResult) return;
    const text = formatCatchmentSummary(activeResult);
    const success = await copyTextToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const statusStyleClass = (() => {
    if (!activeResult) return "";
    switch (activeResult.status) {
      case "Reviewed direct match":
        return styles.statusReviewed;
      case "Contested / split":
        return styles.statusContested;
      case "Unreviewed":
        return styles.statusUnreviewed;
      default:
        return "";
    }
  })();

  const serviceBadgeStyle = activeResult ? getHealthServiceBadgeStyle(activeResult.healthService.code) : undefined;
  const serviceDotStyle = activeResult ? getHealthServiceDotStyle(activeResult.healthService.code) : undefined;

  return (
    <div className={`${styles.container} ${className}`.trim()} data-testid="ward-catchment-resolver">
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.titleIcon} aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </span>
          <h2 className={styles.title}>WA Suburb-to-Catchment Resolver</h2>
        </div>
        <p className={styles.subtitle}>
          Search Western Australian suburbs or 4-digit postcodes to determine Health Service jurisdiction, primary
          admitting hospital, and community mental health team.
        </p>
      </header>

      {/* Search Input Section */}
      <section className={styles.searchSection} aria-label="Catchment Search">
        <label htmlFor={searchInputId} className={styles.searchLabel}>
          Search by Suburb or Postcode
        </label>
        <div className={styles.inputWrapper}>
          <span className={styles.inputIcon} aria-hidden="true">
            <svg
              viewBox="0 0 20 20"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="9" cy="9" r="6" />
              <line x1="13.5" y1="13.5" x2="18" y2="18" />
            </svg>
          </span>
          <input
            id={searchInputId}
            type="text"
            className={styles.searchInput}
            placeholder="Enter WA suburb (e.g. Morley) or 4-digit postcode (e.g. 6064)..."
            value={query}
            onChange={handleQueryChange}
            aria-label="Search suburb or postcode"
            autoComplete="off"
            spellCheck={false}
          />
          {query.length > 0 && (
            <button
              type="button"
              className={styles.clearButton}
              onClick={handleClear}
              aria-label="Clear search query"
              title="Clear search"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </section>

      {/* Quick-Pick Suburbs */}
      <section className={styles.quickPickSection} aria-label="Quick-pick Suburbs">
        <span className={styles.quickPickLabel}>Quick-pick Suburbs:</span>
        <div className={styles.quickPickList} role="group" aria-label="Common suburbs">
          {QUICK_PICK_SUBURBS.map((suburb) => {
            const isActive = normaliseSuburbKey(query) === normaliseSuburbKey(suburb);
            return (
              <button
                key={suburb}
                type="button"
                className={`${styles.quickPickButton} ${isActive ? styles.quickPickButtonActive : ""}`}
                onClick={() => handleQuickPick(suburb)}
                aria-pressed={isActive}
              >
                {suburb}
              </button>
            );
          })}
        </div>
      </section>

      {/* Multiple Suburb Results (e.g. Postcode search with multiple suburbs) */}
      {queryResult.type === "postcode" && queryResult.results.length > 1 && (
        <nav className={styles.multipleMatchesBar} aria-label={`Suburbs found for postcode ${query}`}>
          <span className={styles.multipleMatchesTitle}>
            {queryResult.results.length} suburbs in postcode {query}:
          </span>
          <div className={styles.suburbTabList} role="tablist">
            {queryResult.results.map((item, index) => {
              const isSelected = index === selectedSuburbIndex;
              return (
                <button
                  key={item.suburb}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  className={`${styles.suburbTab} ${isSelected ? styles.suburbTabSelected : ""}`}
                  onClick={() => {
                    setSelectedSuburbIndex(index);
                    if (onSelectCatchment) onSelectCatchment(item);
                  }}
                >
                  {item.suburb}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* Results or Empty/Not-Found States */}
      <section className={styles.resultsSection} aria-live="polite">
        {hasResults && activeResult ? (
          <article className={styles.resultCard} data-testid="catchment-result-card">
            {/* Card Header */}
            <div className={styles.cardHeader}>
              <div className={styles.suburbHeadingGroup}>
                <h3 className={styles.suburbName}>{activeResult.suburb}</h3>
                {activeResult.postcodes.length > 0 && (
                  <span className={styles.postcodeBadge}>Postcode: {activeResult.postcodes.join(", ")}</span>
                )}
              </div>
              <span className={`${styles.statusBadge} ${statusStyleClass}`} data-testid="catchment-status-badge">
                {activeResult.status === "Reviewed direct match" && (
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
                    <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
                  </svg>
                )}
                {activeResult.status === "Contested / split" && (
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
                    <path d="M7.938 2.016A.13.13 0 0 0 7.818 2.1l-6.84 11.968a.13.13 0 0 0 .113.195h13.684a.13.13 0 0 0 .113-.195L8.062 2.1a.13.13 0 0 0-.124-.084zM8 4.75a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0V5.5A.75.75 0 0 1 8 4.75zm0 6.5a.875.875 0 1 1 0 1.75.875.875 0 0 1 0-1.75z" />
                  </svg>
                )}
                {activeResult.status === "Unreviewed" && (
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
                    <circle cx="8" cy="8" r="7" stroke="currentColor" fill="none" strokeWidth="1.5" />
                    <line x1="8" y1="7" x2="8" y2="12" stroke="currentColor" strokeWidth="1.5" />
                    <circle cx="8" cy="4.5" r="0.75" fill="currentColor" />
                  </svg>
                )}
                <span>{activeResult.status}</span>
              </span>
            </div>

            {/* Grid of details */}
            <div className={styles.detailsGrid}>
              {/* Health Service */}
              <div className={styles.factBlock}>
                <span className={styles.factLabel}>Health Service Jurisdiction</span>
                <div className={styles.servicePill} style={serviceBadgeStyle} data-testid="health-service-pill">
                  <span className={styles.serviceDot} style={serviceDotStyle} aria-hidden="true" />
                  <span>
                    {activeResult.healthService.name} ({activeResult.healthService.code})
                  </span>
                </div>
              </div>

              {/* Primary Admitting Hospital */}
              <div className={styles.factBlock}>
                <span className={styles.factLabel}>Primary Admitting Hospital</span>
                <span className={styles.factValue} data-testid="primary-hospital-value">
                  {activeResult.primaryHospital}
                </span>
              </div>

              {/* Follow-up Clinic */}
              <div className={styles.factBlock}>
                <span className={styles.factLabel}>Follow-up Community Mental Health Clinic</span>
                <span className={styles.factValue} data-testid="community-clinic-value">
                  {activeResult.communityClinic}
                </span>
              </div>

              {/* Data Provenance */}
              <div className={styles.factBlock}>
                <span className={styles.factLabel}>Catchment Data Source</span>
                <span className={styles.factValue}>{activeResult.documentSources.join(", ")}</span>
              </div>
            </div>

            {/* Caveats or Contested Notes */}
            {activeResult.caveats && (
              <div className={styles.caveatsBox} data-testid="catchment-caveats-box">
                <div className={styles.caveatsHeader}>
                  <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
                    <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
                    <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z" />
                  </svg>
                  <span>Clinical Caveat &amp; Source Discrepancy</span>
                </div>
                <p className={styles.caveatsText}>{activeResult.caveats}</p>
                {activeResult.contestedAnswers && activeResult.contestedAnswers.length > 0 && (
                  <ul className={styles.contestedReadingsList}>
                    {activeResult.contestedAnswers.map((ans, idx) => (
                      <li key={idx}>
                        <strong>{ans.documentId}:</strong> {ans.clinics.join(", ")} &rarr; Hospital: {ans.hospital} (
                        {ans.healthService.code})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Actions Bar */}
            <div className={styles.actionsBar}>
              <button
                type="button"
                className={`${styles.copyButton} ${copied ? styles.copyButtonCopied : ""}`}
                onClick={handleCopySummary}
                aria-label={copied ? "Summary copied to clipboard" : "Copy summary to clipboard"}
                data-testid="copy-summary-button"
              >
                {copied ? (
                  <>
                    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
                      <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
                    </svg>
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
                      <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z" />
                      <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z" />
                    </svg>
                    <span>Copy summary</span>
                  </>
                )}
              </button>
            </div>
          </article>
        ) : queryResult.type === "not-found" ? (
          <div className={styles.stateCard} data-testid="catchment-not-found">
            <span className={styles.stateIcon} aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                width="28"
                height="28"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </span>
            <h3 className={styles.stateTitle}>No Catchment Records Found</h3>
            <p className={styles.stateMessage}>{queryResult.notFoundMessage}</p>
            <div className={styles.stateSuggestions}>
              <span>Suggestions:</span>
              <span>&bull; Check for spelling errors or alternative suburb names.</span>
              <span>&bull; Search by 4-digit WA postcode (e.g. 6000, 6062, 6160).</span>
              <span>&bull; Try one of the major district centres in the quick-pick list above.</span>
            </div>
          </div>
        ) : (
          <div className={styles.stateCard} data-testid="catchment-empty-state">
            <span className={styles.stateIcon} aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                width="28"
                height="28"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
            </span>
            <h3 className={styles.stateTitle}>Ready to Resolve Catchment</h3>
            <p className={styles.stateMessage}>
              Type a suburb name or 4-digit WA postcode above, or tap one of the common quick-pick suburbs to look up
              the admitting hospital and community mental health team.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export default WardCatchmentResolver;
