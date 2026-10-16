/*
 * The community team screen's fourth desktop list: the caseload and recorded community treatment
 * orders.
 *
 * Split out of `community-screen.tsx` (fix list 2.5 and 9.6, 15 Oct 2026) as a pure refactor:
 * the markup, text, class names and behaviour are unchanged. Comments moved with the code, so
 * "this file" or "this screen" in them still means the community team screen as a whole.
 */

import { NAME_NOT_RECORDED, UMRN_NOT_RECORDED } from "@/components/ward-management/ward-patient-resolver";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import styles from "./community.module.css";
import { DEMO_COMMUNITY_CASELOAD } from "./community-demo-cohort";
import { caseloadStatutoryFormCode, caseloadRecordedExpiryLabel } from "./community-screen-helpers";
import type { CommunityScreenView } from "./community-screen";

/** Tab 4: the caseload and recorded community treatment orders. */
export function CommunityScreenCaseloadTab({ view }: { view: CommunityScreenView }) {
  const {
    now,
    team,
    setActiveDrawer,
    setSelectedPatientId,
    caseloadFilter,
    setCaseloadFilter,
    isDemoMode,
    demoVisibleCaseload,
    caseloadRows,
    form5ACount,
    form5BCount,
    visibleCaseload,
    activeTab,
    phonePerson,
    phoneName,
  } = view;
  return (
    <div
      className={activeTab === "tab-caseload" ? styles.tabPanelActive : styles.tabPanelHidden}
      id="tab-caseload"
      role="tabpanel"
      aria-labelledby="tabBtn-caseload"
    >
      {isDemoMode ? (
        <>
          <div className={styles.filterToolbar}>
            <div className={styles.filterChipsGroup}>
              <button
                type="button"
                className={styles.chipFilterBtn}
                aria-pressed={caseloadFilter === "all"}
                onClick={() => setCaseloadFilter("all")}
              >
                <span>All Active Caseload</span>
                <span className={styles.badgePill} id="chipAllCaseloadBadge">
                  {DEMO_COMMUNITY_CASELOAD.length}
                </span>
              </button>
              <button
                type="button"
                className={styles.chipFilterBtn}
                aria-pressed={caseloadFilter === "cto" || caseloadFilter === "5A"}
                onClick={() => setCaseloadFilter("cto")}
              >
                <span>Active CTO (Form 5A)</span>
                <span className={`${styles.badgePill} ${styles.inkGood}`} id="chipCtoBadge">
                  {DEMO_COMMUNITY_CASELOAD.filter((c) => c.category.includes("cto")).length}
                </span>
              </button>
              <button
                type="button"
                className={styles.chipFilterBtn}
                aria-pressed={caseloadFilter === "high"}
                onClick={() => setCaseloadFilter("high")}
              >
                <span>High Acuity / Assertive Outreach</span>
                <span className={styles.badgePill} id="chipHighAcuityBadge">
                  {DEMO_COMMUNITY_CASELOAD.filter((c) => c.category.includes("high")).length}
                </span>
              </button>
              <button
                type="button"
                className={styles.chipFilterBtn}
                aria-pressed={caseloadFilter === "depot"}
                onClick={() => setCaseloadFilter("depot")}
              >
                <span>Depot Clinic Due</span>
                <span className={styles.badgePill} id="chipDepotBadge">
                  {DEMO_COMMUNITY_CASELOAD.filter((c) => c.category.includes("depot")).length}
                </span>
              </button>
            </div>
            <div className={styles.filterMeta}>
              <span id="caseloadSectorNote">{team.name} / Sector Catchment</span>
            </div>
          </div>

          <div className={styles.cardPanel}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>
                <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="8" cy="8" r="6" />
                  <path d="M8 5v3l2 2" />
                </svg>
                <span>Community Treatment Orders (Form 5A) &amp; High Acuity Caseload</span>
              </h2>
              <span className={styles.badgePill} id="caseloadHeadBadge">
                {demoVisibleCaseload.length} Active Records
              </span>
            </div>
            <div className={styles.tableScroll}>
              <table className={styles.table} id="caseloadTable">
                <thead>
                  <tr>
                    <th scope="col">UMRN / Patient</th>
                    <th scope="col">Age / Sex</th>
                    <th scope="col">Statutory Status</th>
                    <th scope="col">Care Plan Tier</th>
                    <th scope="col">Key Clinician</th>
                    <th scope="col">Last Contact</th>
                    <th scope="col">Next Scheduled Contact / Review</th>
                    <th scope="col" className={styles.cellEnd}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {demoVisibleCaseload.map((row) => (
                    <tr
                      key={row.id}
                      data-cat={row.category}
                      onClick={() => {
                        setSelectedPatientId(row.patientId);
                        setActiveDrawer("pxDrawer");
                      }}
                      className={styles.clickable}
                    >
                      <td>
                        <b>{row.umrn}</b>
                      </td>
                      <td>{row.ageSex}</td>
                      <td>
                        <span className={`${styles.statusPillBadge} ${styles[row.statutoryTone]}`}>
                          {row.statutoryStatus}
                        </span>
                      </td>
                      <td>{row.tier}</td>
                      <td>{row.keyClinician}</td>
                      <td>{row.lastContact}</td>
                      <td>{row.nextReview}</td>
                      <td className={styles.cellEnd} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className={styles.btnSmSec}
                          onClick={() => {
                            setSelectedPatientId(row.patientId);
                            setActiveDrawer("pxDrawer");
                          }}
                        >
                          Open dossier
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      {/* ── Active Caseload & CTO Statutory Register Table ── */}
      <div style={{ display: isDemoMode ? "none" : "block" }} aria-hidden={isDemoMode ? "true" : undefined}>
        <section
          className={styles.caseloadSection}
          id="section-caseload"
          aria-label="Catchment Active Caseload and Statutory CTO Register"
        >
          <div className={styles.caseloadHead}>
            <h3 className={styles.caseloadTitle}>
              <span>Catchment Active Caseload &amp; Statutory Register</span>
              <span id="caseloadHeadBadge" className={styles.badgePill}>
                {caseloadRows.length} Patients
              </span>
              <span id="caseloadSectorNote" className={styles.displayNone}>
                {team.name}
              </span>
              <span id="chipDepotBadge" className={styles.displayNone}>
                Depot
              </span>
              <span id="chipHighAcuityBadge" className={styles.displayNone}>
                High Acuity
              </span>
            </h3>
            <div className={styles.filterChipsGroup}>
              <button
                type="button"
                className={styles.chipFilterBtn}
                aria-pressed={caseloadFilter === "all"}
                onClick={() => setCaseloadFilter("all")}
              >
                <span>All Active</span>
                <span id="chipAllCaseloadBadge" className={styles.badgePill}>
                  {caseloadRows.length}
                </span>
              </button>
              <button
                type="button"
                className={styles.chipFilterBtn}
                aria-pressed={caseloadFilter === "5A"}
                onClick={() => setCaseloadFilter("5A")}
              >
                <span>Recorded Form 5A</span>
                <span id="chipCtoBadge" className={styles.badgePill}>
                  {form5ACount}
                </span>
              </button>
              <button
                type="button"
                className={styles.chipFilterBtn}
                aria-pressed={caseloadFilter === "5B"}
                onClick={() => setCaseloadFilter("5B")}
              >
                <span>Recorded Form 5B</span>
                <span className={styles.badgePill}>{form5BCount}</span>
              </button>
            </div>
          </div>
          <div className={styles.tableScroll}>
            <table id="caseloadTable" className={styles.table} data-testid="ward-community-caseload-table">
              <thead>
                <tr>
                  <th scope="col">Person</th>
                  <th scope="col">Statutory status</th>
                  <th scope="col">Recorded expiry</th>
                  <th scope="col">Follow-up</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleCaseload.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <p className={styles.emptyNote} data-testid="ward-community-caseload-empty">
                        {caseloadFilter === "all"
                          ? "No accepted follow-up or matched admission is on this team's caseload yet."
                          : `No recorded Form ${caseloadFilter} on this team's caseload.`}
                      </p>
                    </td>
                  </tr>
                ) : (
                  visibleCaseload.map((row) => {
                    const formCode = caseloadStatutoryFormCode(row);
                    const formLabel = formCode ? legalFormName({ code: formCode }) : "No form recorded";
                    const expiryLabel = caseloadRecordedExpiryLabel(row, now);
                    const formTone = formCode === "5A" || formCode === "5B" ? "danger" : formCode ? "warn" : "neutral";
                    return (
                      <tr key={row.key} data-testid={`ward-community-caseload-${row.referralId}`}>
                        <td>
                          <strong>
                            {row.patientId === undefined || row.patientId === null
                              ? "No person on file"
                              : phoneName(phonePerson(row.patientId), NAME_NOT_RECORDED)}
                          </strong>
                          {/* The age band sits under the person, as the v6 table carries it. */}
                          <span className={styles.caseloadMeta}>
                            {row.umrn ?? UMRN_NOT_RECORDED} · {row.ageBand}
                          </span>
                        </td>
                        <td>
                          <span className={styles.statusPillBadge} data-tone={formTone}>
                            {formLabel}
                          </span>
                        </td>
                        <td>{expiryLabel}</td>
                        <td>{row.addressingState === "accepted" ? "Accepted" : "From matched admission"}</td>
                        <td>
                          {row.patientId !== undefined ? (
                            <button
                              type="button"
                              className={styles.btnSmSec}
                              onClick={() => {
                                setSelectedPatientId(row.patientId!);
                                setActiveDrawer("pxDrawer");
                              }}
                            >
                              View dossier
                            </button>
                          ) : (
                            <span className={styles.footnote}>No dossier without a person on file.</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
