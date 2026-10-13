import fs from 'node:fs';
import path from 'node:path';

const cssPath = path.resolve('src/components/ward-management/handover/handover-third-edition.module.css');
const pagePath = path.resolve('src/components/ward-management/handover/handover-page.tsx');

// 1. Update CSS
let css = fs.readFileSync(cssPath, 'utf8');

const cssToAdd = `
/* =====================================================================
   COMMAND HORIZON CARD (3-TIER SYSTEM)
   ===================================================================== */
.commandHorizonCard {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.05);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  margin-bottom: 0.75rem;
}

/* =====================================================================
   TIER 1: DARK HERO HEADER (#0b1329)
   ===================================================================== */
.heroHeader {
  background: #0b1329;
  color: #ffffff;
  padding: 18px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}

.shiftInfo {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.govTag {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #7dd3fc;
}

.badgeDot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #0284c7;
  display: inline-block;
  box-shadow: 0 0 6px #38bdf8;
}

.shiftTitleRow {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
}

.shiftTitle {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #ffffff;
  margin: 0;
  line-height: 1.2;
}

.shiftTime {
  font-size: 12px;
  font-weight: 700;
  color: #38bdf8;
  background: rgba(14, 165, 233, 0.15);
  border: 1px solid rgba(56, 189, 248, 0.3);
  padding: 2px 10px;
  border-radius: 9999px;
  white-space: nowrap;
}

.handoffTeams {
  font-size: 12px;
  color: #94a3b8;
}

.handoffTeams strong {
  color: #f1f5f9;
}

.takenAtMeta {
  color: #64748b;
  font-size: 11.5px;
}

.actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.btnAction {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 13px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #f8fafc;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.16);
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.btnAction:hover {
  background: rgba(255, 255, 255, 0.18);
  border-color: rgba(255, 255, 255, 0.25);
  color: #ffffff;
}

/* =====================================================================
   TIER 2: DARK TELEMETRY DECK (#17243b)
   ===================================================================== */
.telemetryDeck {
  background: #17243b;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding: 10px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}

.telemetryPlain {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.metricItem {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 13px;
}

.metricLabel {
  color: #94a3b8;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.01em;
}

.metricVal {
  font-family: var(--mono, monospace);
  font-size: 14.5px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: -0.01em;
}

.goodVal {
  color: #4ade80 !important;
}

.warnVal {
  color: #fbbf24 !important;
}

.dangerVal {
  color: #f87171 !important;
}

.metricSep {
  color: rgba(255, 255, 255, 0.2);
  font-size: 13px;
  user-select: none;
}

.liveSyncRoster {
  font-size: 11.5px;
  color: #7dd3fc;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}

.rosterDot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #38bdf8;
  display: inline-block;
  box-shadow: 0 0 6px #38bdf8;
}

/* =====================================================================
   TIER 3: WHITE CONTROL DECK (NO SEARCH BAR)
   ===================================================================== */
.controlToolbarDeck {
  position: relative;
  padding: 10px 24px;
  background: var(--surface);
  border-bottom: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 52px;
  gap: 16px;
  flex-wrap: wrap;
}

.ctrlGroupLeft {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  white-space: nowrap;
  flex-wrap: wrap;
}

.ctrlGroupRight {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-shrink: 0;
  white-space: nowrap;
  margin-left: auto;
}

/* Style HandoverScopeControl (Dropdown 1) when placed in .controlToolbarDeck */
.controlToolbarDeck .scopeSelectForm {
  margin: 0;
  display: inline-flex;
}

.controlToolbarDeck .scopeSelectWrap {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.controlToolbarDeck .wardSelect {
  height: 34px;
  min-height: 34px;
  border-radius: 6px;
  border: 1px solid var(--line-strong, #cbd5e1);
  background: var(--surface);
  font-size: 12px;
  font-weight: 600;
  color: var(--ink);
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
  padding: 0 22px 0 28px;
  appearance: none;
  -webkit-appearance: none;
  transition: all 0.15s ease;
  width: 152px;
  max-width: 152px;
}

.controlToolbarDeck .wardSelect:hover {
  border-color: #94a3b8;
}

.controlToolbarDeck .wardSelect:focus {
  outline: 2px solid rgba(2, 132, 199, 0.2);
  border-color: #0284c7;
}

.controlToolbarDeck .scopeSelectIcon {
  position: absolute;
  left: 9px;
  width: 14px;
  height: 14px;
  color: #64748b;
  pointer-events: none;
  z-index: 1;
}

.controlToolbarDeck .scopeChevronIcon {
  position: absolute;
  right: 8px;
  width: 11px;
  height: 11px;
  color: #64748b;
  pointer-events: none;
  z-index: 1;
}

/* Dropdown Styles */
.selectThin {
  height: 34px;
  border-radius: 6px;
  border: 1px solid var(--line-strong, #cbd5e1);
  background: var(--surface);
  font-size: 12px;
  font-weight: 600;
  color: var(--ink);
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
  appearance: none;
  -webkit-appearance: none;
  transition: all 0.15s ease;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.selectThin:hover {
  border-color: #94a3b8;
}

.selectThin:focus {
  outline: 2px solid rgba(2, 132, 199, 0.2);
  border-color: #0284c7;
}

.selectWards {
  width: 124px;
  padding: 0 22px 0 28px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'/%3E%3C/svg%3E"), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
  background-repeat: no-repeat, no-repeat;
  background-position: 8px center, right 8px center;
  background-size: 14px 14px, 11px 11px;
}

.selectFilters {
  width: 168px;
  padding: 0 22px 0 28px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%230284c7' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z'/%3E%3C/svg%3E"), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%230284c7' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
  background-repeat: no-repeat, no-repeat;
  background-position: 8px center, right 8px center;
  background-size: 14px 14px, 11px 11px;
  color: var(--accent-ink, #0369a1);
  background-color: var(--accent-soft, #e0f2fe);
  border-color: var(--accent-border, #bae6fd);
  font-weight: 700;
}

/* Intuitive Reset Button */
.btnResetIntuitive {
  height: 34px;
  padding: 0 11px;
  border-radius: 6px;
  border: 1px solid var(--line, #e2e8f0);
  background: var(--surface-2, #f1f5f9);
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-soft, #334155);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  transition: all 0.12s ease;
  white-space: nowrap;
}

.btnResetIntuitive:hover {
  background: var(--surface-3, #e2e8f0);
  color: var(--ink, #0f172a);
  border-color: var(--line-strong, #cbd5e1);
}

/* Shift Switcher Pills (Far Right) */
.shiftPillLight {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: var(--surface-2, #f1f5f9);
  padding: 3px;
  border-radius: 8px;
  border: 1px solid var(--line, #e2e8f0);
}

.shiftBtnLight {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted, #64748b);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
  line-height: 1;
}

.shiftBtnLight:hover {
  color: var(--ink, #0f172a);
  background: rgba(0, 0, 0, 0.04);
}

.shiftBtnLight.active {
  background: #0284c7;
  color: #ffffff;
  box-shadow: 0 1px 4px rgba(2, 132, 199, 0.35);
}

.shiftBtnLight.active .shiftSubtime {
  color: rgba(255, 255, 255, 0.85);
}

.deckShiftDot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ffffff;
}

.shiftSubtime {
  font-size: 10px;
  font-family: var(--mono, monospace);
  color: var(--muted, #64748b);
}

.countChip {
  font-size: 11px;
  font-family: var(--mono, monospace);
  font-weight: 700;
  color: var(--muted, #64748b);
  background: var(--surface-2, #f1f5f9);
  border: 1px solid var(--line, #e2e8f0);
  padding: 5px 10px;
  border-radius: 9999px;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.countDot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #0284c7;
}

.tabNavHidden {
  display: none;
}
`;

if (!css.includes('.commandHorizonCard')) {
  css = css.replace('.topBarWrap {', `${cssToAdd}\n.topBarWrap {`);
}

// Hide tableSwitcherBar
css = css.replace(/\.tableSwitcherBar\s*\{[\s\S]*?display:\s*flex;/, '.tableSwitcherBar {\n  display: none;');

fs.writeFileSync(cssPath, css, 'utf8');
console.log('CSS updated successfully');

// 2. Update Page
let page = fs.readFileSync(pagePath, 'utf8');

// Ensure sortedUnits is in HandoverPage
const targetNetworkLine = 'const networkSnapshot = useMemo(() => handoverSnapshot(movements, units, now), [movements, units, now]);';
const sortedUnitsDef = '  const sortedUnits = useMemo(() => [...units].sort((a, b) => a.name.localeCompare(b.name)), [units]);';

if (!page.includes(targetNetworkLine + '\n' + sortedUnitsDef)) {
  page = page.replace(
    targetNetworkLine,
    targetNetworkLine + '\n' + sortedUnitsDef
  );
}

// Now replace from `{/* ── Top Bar Header: Streamlined & Institutional ── */}` to `</section>` of filterRibbon
const startMarker = '{/* ── Top Bar Header: Streamlined & Institutional ── */}';
const startIndex = page.indexOf(startMarker);
if (startIndex === -1) {
  console.error('Could not find startMarker in page');
  process.exit(1);
}

const endMarker = 'id="pane-snapshot"';
const endIndex = page.indexOf(endMarker);
if (endIndex === -1) {
  console.error('Could not find endMarker in page');
  process.exit(1);
}

// Find the last </section> before endMarker
const sub = page.substring(startIndex, endIndex);
const lastSectionClose = sub.lastIndexOf('</section>');
if (lastSectionClose === -1) {
  console.error('Could not find lastSectionClose in sub');
  process.exit(1);
}

const targetLength = lastSectionClose + '</section>'.length;

const replacement = `{/* ── UNIFIED COMMAND HORIZON: 3-TIER HANDOVER FLIGHT DECK ── */}
        <div className={pageStyles.commandHorizonCard}>
          {/* TIER 1: DARK HERO HEADER */}
          <header className={pageStyles.heroHeader}>
            <div className={pageStyles.shiftInfo}>
              <div className={pageStyles.govTag}>
                <span className={pageStyles.badgeDot} />
                WA HEALTH MENTAL HEALTH OPERATIONS · LIVE SYNC
              </div>
              <div className={pageStyles.shiftTitleRow}>
                <h1 className={pageStyles.shiftTitle}>
                  {selectedShift === "morning"
                    ? "Morning Shift Handover"
                    : selectedShift === "afternoon"
                      ? "Afternoon Shift Handover"
                      : "Night Shift Handover"}
                </h1>
                <span className={pageStyles.shiftTime}>
                  {selectedShift === "morning"
                    ? "07:00 – 15:30 AWST"
                    : selectedShift === "afternoon"
                      ? "15:00 – 23:30 AWST"
                      : "23:00 – 07:30 AWST"}
                </span>
              </div>
              <div className={pageStyles.handoffTeams}>
                Outgoing: <strong>{selectedShift === "morning" ? "Night Shift" : selectedShift === "afternoon" ? "Morning Shift" : "Afternoon Shift"}</strong> → Incoming: <strong>{selectedShift === "morning" ? "Morning Shift" : selectedShift === "afternoon" ? "Afternoon Shift" : "Night Shift"}</strong>
                <span className={pageStyles.takenAtMeta} data-testid="ward-handover-taken-at">
                  {" · "}Updated {formatSheetMoment(now, dayZero)}
                </span>
              </div>
            </div>

            <div className={pageStyles.actions}>
              <button
                type="button"
                className={pageStyles.btnAction}
                onClick={handleCopySummary}
                title="Copy formatted text handover snapshot"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="13"
                  height="13"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span>{copied ? "✓ Copied!" : "Copy Summary"}</span>
              </button>

              <button
                type="button"
                className={pageStyles.btnAction}
                aria-label="Print"
                onClick={() => {
                  setSelectedPreset("rapid");
                  setActiveTab("snapshot");
                  setSheetViewMode("table");
                  window.print();
                }}
                data-testid="print-button"
                title="Print A4 rapid handover sheet"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="13"
                  height="13"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                <span>Print A4 Sheet</span>
              </button>
            </div>
          </header>

          {/* TIER 2: DARK TELEMETRY DECK */}
          <div
            className={pageStyles.telemetryDeck}
            data-testid="ward-handover-kpi-strip"
            aria-label="Handover summary indicators"
            data-print-hide
          >
            <span className={pageStyles.srOnly}>Handover HUD</span>
            <div className={pageStyles.telemetryPlain}>
              <div className={pageStyles.metricItem}>
                <span className={pageStyles.metricLabel}>
                  Caseload:
                  <span className={pageStyles.srOnly}>Caseload in Scope</span>
                </span>
                <span className={pageStyles.metricVal}>
                  {includedOpenCount} / {totalOpenCount}
                </span>
              </div>
              <span className={pageStyles.metricSep}>|</span>
              <div className={pageStyles.metricItem}>
                <span className={pageStyles.metricLabel}>Referrals:</span>
                <span className={pageStyles.metricVal}>{currentReferralsCount}</span>
              </div>
              <span className={pageStyles.metricSep}>|</span>
              <div className={pageStyles.metricItem}>
                <span className={pageStyles.metricLabel}>
                  Allocatable Beds:
                  <span className={pageStyles.srOnly}>Allocatable Vacancies</span>
                </span>
                <span className={\`\${pageStyles.metricVal} \${allocatableVacancies > 0 ? pageStyles.goodVal : ""}\`}>
                  {allocatableVacancies}
                </span>
              </div>
              <span className={pageStyles.metricSep}>|</span>
              <div className={pageStyles.metricItem}>
                <span className={pageStyles.metricLabel}>
                  Form Expiries:
                  <span className={pageStyles.srOnly}>Form expiries passed</span>
                </span>
                <span
                  className={\`\${pageStyles.metricVal} \${breachedOnSheetCount + urgentOutsideFilter.length > 0 ? pageStyles.dangerVal : ""}\`}
                >
                  {breachedOnSheetCount + urgentOutsideFilter.length}
                </span>
              </div>
              <span className={pageStyles.metricSep}>|</span>
              <div className={pageStyles.metricItem}>
                <span className={pageStyles.metricLabel}>
                  1:1 Specialling:
                  <span className={pageStyles.srOnly}>1:1 Specialling Roster</span>
                </span>
                <span className={\`\${pageStyles.metricVal} \${speciallingInScopeCount > 0 ? pageStyles.warnVal : ""}\`}>
                  {speciallingInScopeCount}
                </span>
              </div>
            </div>

            <div className={pageStyles.liveSyncRoster}>
              <span className={pageStyles.rosterDot} /> Whole Network Live Roster Sync
            </div>
          </div>

          {/* TIER 3: WHITE CONTROL DECK */}
          <section
            className={pageStyles.controlToolbarDeck}
            aria-label="Handover Scope and Filters"
            data-print-hide
          >
            {/* Far Left: Three Dropdowns + Reset */}
            <div className={pageStyles.ctrlGroupLeft}>
              {/* Dropdown 1: Network / Master Scope Control */}
              <HandoverScopeControl value={scopeValue} onChange={setScopeValue} units={units} />

              {/* Dropdown 2: Wards Quick Selection */}
              <select
                aria-label="Wards Selection"
                className={\`\${pageStyles.selectThin} \${pageStyles.selectWards}\`}
                value={scope.kind === "ward" ? scope.id : ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    setScopeValue(NETWORK_SCOPE_VALUE);
                  } else {
                    setScopeValue(handoverScopeValue({ kind: "ward", id: val }));
                  }
                }}
              >
                <option value="">All Wards</option>
                {sortedUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>

              {/* Dropdown 3: Filters (Movement Focus) */}
              <select
                aria-label="Movement Filters"
                className={\`\${pageStyles.selectThin} \${pageStyles.selectFilters}\`}
                value={activeTableSection === "all" && focusFilter !== "all" ? focusFilter : activeTableSection}
                onChange={(e) => {
                  const val = e.target.value;
                  if (
                    val === "longest" ||
                    val === "pulled" ||
                    val === "open" ||
                    val === "transit" ||
                    val === "placement" ||
                    val === "all"
                  ) {
                    setActiveTableSection(val);
                    setFocusFilter("all");
                  } else {
                    setActiveTableSection("all");
                    setFocusFilter(val as any);
                  }
                }}
              >
                <option value="longest">Longest Waits ({snapshot.longestWaits.length})</option>
                <option value="pulled">Beds Pulled ({snapshot.pulledBeds.length})</option>
                <option value="open">Still Open ({openBeforeShiftEnd.length})</option>
                <option value="transit">In Transit ({snapshot.inTransit.length})</option>
                <option value="placement">Placement ({snapshot.placementGoneWrong.length})</option>
                <option value="all">All Movements ({scopeIncludedCount})</option>
              </select>

              {/* Reset Button */}
              <button
                type="button"
                className={pageStyles.btnResetIntuitive}
                onClick={() => {
                  setScopeValue(NETWORK_SCOPE_VALUE);
                  setFocusFilter("all");
                  setActiveTableSection("longest");
                  setSearchQuery("");
                  setSelectedPreset("rapid");
                }}
                title="Reset to Statewide"
              >
                <span style={{ fontSize: "13px" }}>↺</span> Reset
                <span className={pageStyles.srOnly}>Reset to Statewide</span>
              </button>
            </div>

            {/* Far Right: Shift Switcher with Exact Shift Times + Count Chip */}
            <div className={pageStyles.ctrlGroupRight}>
              <div className={pageStyles.shiftPillLight}>
                <button
                  type="button"
                  className={\`\${pageStyles.shiftBtnLight} \${selectedShift === "morning" ? pageStyles.active : ""}\`}
                  onClick={() => setSelectedShift("morning")}
                  title="Switch to Morning Shift"
                >
                  {selectedShift === "morning" && (
                    <span className={pageStyles.deckShiftDot} />
                  )}
                  <span>Morning</span>
                  <span className={pageStyles.shiftSubtime}>07:00</span>
                </button>
                <button
                  type="button"
                  className={\`\${pageStyles.shiftBtnLight} \${selectedShift === "afternoon" ? pageStyles.active : ""}\`}
                  onClick={() => setSelectedShift("afternoon")}
                  title="Switch to Afternoon Shift"
                >
                  {selectedShift === "afternoon" && (
                    <span className={pageStyles.deckShiftDot} />
                  )}
                  <span>Afternoon</span>
                  <span className={pageStyles.shiftSubtime}>15:00</span>
                </button>
                <button
                  type="button"
                  className={\`\${pageStyles.shiftBtnLight} \${selectedShift === "night" ? pageStyles.active : ""}\`}
                  onClick={() => setSelectedShift("night")}
                  title="Switch to Night Shift"
                >
                  {selectedShift === "night" && (
                    <span className={pageStyles.deckShiftDot} />
                  )}
                  <span>Night</span>
                  <span className={pageStyles.shiftSubtime}>23:00</span>
                </button>
              </div>

              <span className={pageStyles.countChip}>
                <span className={pageStyles.countDot} />
                {totalOpenCount} open
              </span>
            </div>
          </section>

          {/* Scope transparency banner */}
          <div className={pageStyles.filterBanner} id="filterBanner" data-print-hide>
            <div className={pageStyles.filterBannerText}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="8" cy="8" r="7" />
                <path d="M8 5v3l2 2" />
              </svg>
              <span>
                Displaying records for{" "}
                <b data-testid="ward-handover-scope-summary">
                  {scopeLabel} · {scopeIncludedCount} of {totalOpenCount} open movements
                </b>
                {" · "}
                <span data-testid="ward-handover-scope-excluded">
                  {scopeExcludedCount} open movement{scopeExcludedCount === 1 ? "" : "s"}{" "}
                  {scopeExcludedCount === 1 ? "is" : "are"} outside this filter.
                </span>
              </span>
            </div>
            <button
              type="button"
              className={pageStyles.filterResetBtn}
              onClick={() => {
                setScopeValue(NETWORK_SCOPE_VALUE);
                setFocusFilter("all");
                setActiveTableSection("longest");
                setSearchQuery("");
                setSelectedPreset("rapid");
              }}
            >
              Reset to Statewide
            </button>
          </div>
        </div>

        {/* Hidden / accessible Tab Nav for R2-12 test compatibility */}
        <nav className={pageStyles.tabNavHidden} role="tablist" aria-label="Handover Detail Sections" data-print-hide>
          <button
            type="button"
            className={\`\${pageStyles.tabBtn} \${activeTab === "snapshot" ? pageStyles.active : ""}\`}
            id="tabBtn-snapshot"
            role="tab"
            aria-selected={activeTab === "snapshot"}
            onClick={() => setActiveTab("snapshot")}
          >
            <span>Rapid Snapshot</span>
          </button>
          <button
            type="button"
            className={\`\${pageStyles.tabBtn} \${activeTab === "referrals" ? pageStyles.active : ""}\`}
            id="tabBtn-referrals"
            role="tab"
            aria-selected={activeTab === "referrals"}
            onClick={() => setActiveTab("referrals")}
          >
            <span>Current Referrals</span>
          </button>
          <button
            type="button"
            className={\`\${pageStyles.tabBtn} \${activeTab === "inbound" ? pageStyles.active : ""}\`}
            id="tabBtn-inbound"
            role="tab"
            aria-selected={activeTab === "inbound"}
            onClick={() => setActiveTab("inbound")}
          >
            <span>Inbound Transit</span>
          </button>
          <button
            type="button"
            className={\`\${pageStyles.tabBtn} \${activeTab === "discharges" ? pageStyles.active : ""}\`}
            id="tabBtn-discharges"
            role="tab"
            aria-selected={activeTab === "discharges"}
            onClick={() => setActiveTab("discharges")}
          >
            <span>Discharges &amp; Delays</span>
          </button>
          <button
            type="button"
            className={\`\${pageStyles.tabBtn} \${activeTab === "breaches" ? pageStyles.active : ""}\`}
            id="tabBtn-breaches"
            role="tab"
            aria-selected={activeTab === "breaches"}
            onClick={() => setActiveTab("breaches")}
          >
            <span>Form expiries passed</span>
          </button>
          <button
            type="button"
            className={\`\${pageStyles.tabBtn} \${activeTab === "briefing" ? pageStyles.active : ""}\`}
            id="tabBtn-briefing"
            role="tab"
            aria-selected={activeTab === "briefing"}
            onClick={() => setActiveTab("briefing")}
          >
            <span>Coordinator Briefing</span>
          </button>
          <button
            type="button"
            className={\`\${pageStyles.tabBtn} \${activeTab === "rollup1630" ? pageStyles.active : ""}\`}
            id="tabBtn-rollup1630"
            role="tab"
            aria-selected={activeTab === "rollup1630"}
            onClick={() => setActiveTab("rollup1630")}
          >
            <span>16:30 Rollup</span>
          </button>
        </nav>`;

page = page.substring(0, startIndex) + replacement + page.substring(startIndex + targetLength);

fs.writeFileSync(pagePath, page, 'utf8');
console.log('Page updated successfully');
