"use client";

import React, { useState, useId } from "react";
import { normaliseSuburbKey } from "@/components/ward-management/ward-catchment";
import { getHealthServiceBadgeStyle, getHealthServiceDotStyle } from "@/components/ward-management/ward-service-colors";
import styles from "./ward-catchment-resolver.module.css";
import {
  QUICK_PICK_SUBURBS,
  formatCatchmentSummary,
  resolveCatchmentQuery,
  type ResolvedCatchment,
} from "./ward-catchment-query";

import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";

// The lookup itself lives in `ward-catchment-query.ts`; these stay importable from here.
export {
  QUICK_PICK_SUBURBS,
  findSuburbsByPostcode,
  formatCatchmentSummary,
  resolveCatchmentQuery,
  resolveSuburb,
  type CatchmentQueryResult,
  type CatchmentStatus,
  type ContestedAnswerDetail,
  type QueryResolutionType,
  type ResolvedCatchment,
} from "./ward-catchment-query";

export interface WardCatchmentResolverProps {
  readonly initialQuery?: string;
  readonly onSelectCatchment?: (entry: ResolvedCatchment) => void;
  readonly className?: string;
  /** Extra actions for the shown result, beside Copy summary (Tools sheet: refer and clinic phone). */
  readonly renderActions?: (entry: ResolvedCatchment) => React.ReactNode;
  /** Inside the Tools sheet: no title block and no outer frame, the sheet row already names it. */
  readonly compact?: boolean;
}

/**
 * WA Suburb-to-Catchment Resolver Component
 */
export function WardCatchmentResolver({
  initialQuery = "",
  onSelectCatchment,
  className = "",
  renderActions,
  compact = false,
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
    try {
      await copyTextToClipboard(text);
    } catch {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusStyleClass = (() => {
    if (!activeResult) return "";
    switch (activeResult.status) {
      case "Reviewed clinic match":
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
    <div
      className={`${styles.container} ${compact ? styles.compact : ""} ${className}`.trim()}
      data-testid="ward-catchment-resolver"
    >
      {/* Header */}
      <header className={styles.header} hidden={compact}>
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
          Look up community clinic records by Western Australian suburb or 4-digit postcode. Service and hospital
          suggestions are unverified prototype mappings; confirm any referral destination separately.
        </p>
      </header>

      {/* Search Input Section */}
      <section className={styles.searchSection} aria-label="Catchment search">
        <label htmlFor={searchInputId} className={styles.searchLabel}>
          Search by suburb or postcode
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
      <section className={styles.quickPickSection} aria-label="Quick-pick suburbs">
        <span className={styles.quickPickLabel}>Quick-pick suburbs:</span>
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
          {/* Plain toggle buttons, not tabs: picking one swaps the result card, not a panel (fresh audit A-6). */}
          <div className={styles.suburbTabList} role="group" aria-label={`Suburbs in postcode ${query}`}>
            {queryResult.results.map((item, index) => {
              const isSelected = index === selectedSuburbIndex;
              return (
                <button
                  key={item.suburb}
                  type="button"
                  aria-pressed={isSelected}
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
      {/* A short announcement only: the whole card as a live region was re-read on every keystroke (A-7). */}
      <p className="sr-only" role="status" data-testid="catchment-result-status">
        {hasResults && activeResult
          ? `Result: ${activeResult.suburb}, ${activeResult.healthService.name}`
          : queryResult.type === "not-found"
            ? "No catchment records found"
            : ""}
      </p>
      <section className={styles.resultsSection}>
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
                {activeResult.status === "Reviewed clinic match" && (
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
                <span className={styles.factLabel}>Health Service — unverified prototype mapping</span>
                <div className={styles.servicePill} style={serviceBadgeStyle} data-testid="health-service-pill">
                  <span className={styles.serviceDot} style={serviceDotStyle} aria-hidden="true" />
                  <span>
                    {activeResult.healthService.name} ({activeResult.healthService.code})
                  </span>
                </div>
              </div>

              {/* Primary Admitting Hospital */}
              <div className={styles.factBlock}>
                <span className={styles.factLabel}>Hospital — unverified prototype mapping</span>
                <span className={styles.factValue} data-testid="primary-hospital-value">
                  {activeResult.primaryHospital}
                </span>
              </div>

              {/* Follow-up Clinic */}
              <div className={styles.factBlock}>
                <span className={styles.factLabel}>Follow-up community mental health clinic</span>
                <span className={styles.factValue} data-testid="community-clinic-value">
                  {activeResult.communityClinic}
                </span>
              </div>

              {/* Data Provenance */}
              <div className={styles.factBlock}>
                <span className={styles.factLabel}>Clinic Data Sources — do not verify hospital mappings</span>
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
                  <span>Clinical caveat &amp; source discrepancy</span>
                </div>
                <p className={styles.caveatsText}>{activeResult.caveats}</p>
                {activeResult.contestedAnswers && activeResult.contestedAnswers.length > 0 && (
                  <ul className={styles.contestedReadingsList}>
                    {activeResult.contestedAnswers.map((ans, idx) => (
                      <li key={idx}>
                        <strong>{ans.documentId}:</strong> {ans.clinics.join(", ")} &rarr; Unverified prototype
                        hospital: {ans.hospital} ({ans.healthService.code})
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
              {renderActions ? renderActions(activeResult) : null}
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
            <h3 className={styles.stateTitle}>No catchment records found</h3>
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
            <h3 className={styles.stateTitle}>Ready to resolve catchment</h3>
            <p className={styles.stateMessage}>
              Type a suburb name or 4-digit WA postcode above, or tap one of the common quick-pick suburbs to look up
              community clinic records and unverified prototype hospital suggestions.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
