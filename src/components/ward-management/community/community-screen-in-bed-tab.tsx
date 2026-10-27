/*
 * The community team screen's second desktop list: people referred to this team in a bed or
 * holding one, and those admitted while already with the team.
 *
 * Split out of `community-screen.tsx` (fix list 2.5 and 9.6, 15 Oct 2026) as a pure refactor:
 * the markup, text, class names and behaviour are unchanged. Comments moved with the code, so
 * "this file" or "this screen" in them still means the community team screen as a whole.
 */

import { daysInBed } from "@/components/ward-management/ward-admissions";
import { daysBetween, formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { transportEtaRemainingLabel } from "@/components/ward-management/ward-board-time-features";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";
import styles from "./community.module.css";
import { DEMO_COMMUNITY_INPATIENTS } from "./community-demo-cohort";
import { unitName, bedStateLabel, stayLabel, elapsedSinceOrUnderADay } from "./community-screen-helpers";
import type { CommunityScreenView } from "./community-screen";

/** Tab 2: people referred to this team in a bed or with one pulled. */
export function CommunityScreenInBedTab({ view }: { view: CommunityScreenView }) {
  const {
    teamId,
    units,
    movements,
    patients,
    now,
    identityOf,
    demoUmrnOf,
    team,
    setActiveDrawer,
    setSelectedPatientId,
    inpatientFilter,
    setInpatientFilter,
    isDemoMode,
    demoVisibleInpatients,
    openTransportBook,
    openTransportCancel,
    teamConfig,
    lists,
    cannotResolve,
    admittedWhileAlreadyWithTeam,
    referredDuringThisAdmission,
    bedPulledNotYetArrived,
    activeTab,
  } = view;
  return (
    <div
      className={activeTab === "tab-inpatients" ? styles.tabPanelActive : styles.tabPanelHidden}
      id="tab-inpatients"
      role="tabpanel"
      aria-labelledby="tabBtn-inpatients"
    >
      {/* ── List 2, moved — everyone of ours in a bed or with one pulled ─────────────────── */}
      <section
        className={styles.cardPanel}
        aria-label="In a bed or with one pulled"
        data-testid="ward-community-admitted"
      >
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}>
            <span>In a bed or with one pulled</span>
          </h2>
          <span className={styles.badgePill} data-ward-panel-count>
            {isDemoMode ? teamConfig.inpatients : lists.currentlyAdmitted.length}
          </span>
        </div>
        <div className={styles.panelBody} role="region" aria-label="In a bed or with one pulled details" tabIndex={0}>
          {isDemoMode ? (
            <>
              <div className={styles.filterToolbar}>
                <div className={`${styles.filterChipsGroup} ${styles.chipsSpaced}`}>
                  <button
                    type="button"
                    className={styles.chipFilterBtn}
                    aria-pressed={inpatientFilter === "all"}
                    onClick={() => setInpatientFilter("all")}
                  >
                    <span>All inpatients</span>
                    <span className={styles.badgePill} id="chipAllInpatBadge">
                      {DEMO_COMMUNITY_INPATIENTS.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.chipFilterBtn}
                    aria-pressed={inpatientFilter === "secure"}
                    onClick={() => setInpatientFilter("secure")}
                  >
                    <span>Secure / Locked Beds</span>
                    <span className={styles.badgePill}>
                      {DEMO_COMMUNITY_INPATIENTS.filter((i) => i.category === "secure").length}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.chipFilterBtn}
                    aria-pressed={inpatientFilter === "open"}
                    onClick={() => setInpatientFilter("open")}
                  >
                    <span>Open acute beds</span>
                    <span className={styles.badgePill}>
                      {DEMO_COMMUNITY_INPATIENTS.filter((i) => i.category === "open").length}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.chipFilterBtn}
                    aria-pressed={inpatientFilter === "older"}
                    onClick={() => setInpatientFilter("older")}
                  >
                    <span>Older adult units</span>
                    <span className={styles.badgePill}>
                      {DEMO_COMMUNITY_INPATIENTS.filter((i) => i.category === "older").length}
                    </span>
                  </button>
                </div>
                <p id="inpatientSummaryNote" className={`${styles.count} ${styles.summaryNote}`}>
                  14 Admitted Across 4 Hospital Sites
                </p>
              </div>

              <WardTable
                id="inpatientTable"
                className={styles.table}
                wrapperClassName={styles.tableScroll}
                testId="ward-community-admitted-list"
                hasScrollThreshold
              >
                <caption>People referred to this team in a bed or with one pulled</caption>
                <thead>
                  <tr>
                    <th scope="col">Patient</th>
                    <th scope="col">Admitting ward &amp; health service</th>
                    <th scope="col">Bed</th>
                    <th scope="col" className={styles.n}>
                      Days in bed
                    </th>
                    <th scope="col">Legal status</th>
                    <th scope="col">Community key clinician</th>
                    <th scope="col">Liaison / MDT Status</th>
                    <th scope="col" className={styles.actionsCol}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {demoVisibleInpatients.map((inp) => (
                    <tr
                      key={inp.id}
                      onClick={() => {
                        setSelectedPatientId(inp.patientId);
                        setActiveDrawer("pxDrawer");
                      }}
                      className={styles.clickable}
                    >
                      <td className={styles.cellNowrap}>
                        <b className={styles.patientIdWrap}>{demoUmrnOf(inp.patientId)}</b> ({inp.patientDetails})
                      </td>
                      <td>
                        {inp.wardName} ({inp.healthService})
                      </td>
                      <td>
                        <span className={`${styles.statusPillBadge} ${styles.neutral}`}>{inp.bedId}</span>
                      </td>
                      <td className={styles.n}>{inp.daysInBed}</td>
                      <td>
                        <span className={`${styles.statusPillBadge} ${styles[inp.legalStatusTone]}`}>
                          {inp.legalStatus}
                        </span>
                      </td>
                      <td>{inp.keyClinician}</td>
                      <td>{inp.mdtStatus}</td>
                      <td className={styles.actionsCol} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className={styles.btnSmSec}
                          onClick={() => {
                            setSelectedPatientId(inp.patientId);
                            setActiveDrawer("pxDrawer");
                          }}
                        >
                          Open record
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </WardTable>
            </>
          ) : (
            <>
              <p id="inpatientSummaryNote" className={styles.count} data-testid="ward-community-admitted-count">
                {lists.currentlyAdmitted.length}{" "}
                {lists.currentlyAdmitted.length === 1
                  ? "person referred to this team is"
                  : "people referred to this team are"}{" "}
                in a bed or have one pulled for them.
              </p>
              {lists.currentlyAdmitted.length === 0 ? (
                <p className={styles.emptyNote} data-testid="ward-community-admitted-empty">
                  {cannotResolve ? (
                    <>
                      A bed carries no link back to the referral that named this team, so this list cannot be built for{" "}
                      {team.name}. Its emptiness is a gap in the record rather than an answer about the team.
                    </>
                  ) : (
                    <>Nobody referred to this team is currently in a bed.</>
                  )}
                </p>
              ) : (
                <WardTable
                  id="inpatientTable"
                  className={styles.table}
                  wrapperClassName={styles.tableScroll}
                  testId="ward-community-admitted-list"
                  hasScrollThreshold
                >
                  <caption>People referred to this team in a bed or with one pulled</caption>
                  <thead>
                    <tr>
                      {/*
                              v6 columns (`CommunityTeam--in-a-bed`), where the record holds the
                              figure: no key clinician or liaison column, since nothing records
                              either, and no invented bed number.
                            */}
                      <th scope="col">Person</th>
                      <th scope="col">Unit</th>
                      <th scope="col">Legal status</th>
                      <th scope="col" className={styles.n}>
                        In bed
                      </th>
                      {/*
                          Drawing Actions column shows Open Dossier only. Owner decision 1
                          (22 Sep 2026): drawings own look; book/cancel stays as behaviour and
                          the Actions cluster adjusts to fit (dossier + transport controls).
                        */}
                      <th scope="col" className={styles.actionsCol}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lists.currentlyAdmitted.map((admission) => {
                      const movement =
                        admission.state === "pulled" && admission.movementId !== null
                          ? movements.find((candidate) => candidate.id === admission.movementId)
                          : undefined;
                      const transport = movement?.transport;
                      const ownUncollectedBooking =
                        transport !== undefined &&
                        transport.bookedBy?.role === "community" &&
                        transport.bookedBy.placeId === teamId &&
                        transport.collectedAt === undefined;
                      const otherBooking = transport !== undefined && !ownUncollectedBooking;
                      const canBook =
                        admission.state === "pulled" &&
                        admission.movementId !== null &&
                        movement !== undefined &&
                        transport === undefined;
                      const dossierPatientId = admission.patientId;
                      const pt = patients.find((p) => p.id === admission.patientId);
                      const stayDays = daysInBed(admission, now);
                      return (
                        <tr key={admission.id} data-testid={`ward-community-admitted-${admission.id}`}>
                          <td className={styles.cellNowrap}>
                            <b className={styles.patientIdWrap}>{identityOf(admission)}</b>
                            {pt ? ` (${pt.sex === "Male" ? "M" : "F"})` : ""}
                          </td>
                          <td>
                            <span className={styles.cellLead}>{unitName(admission.unitId, units)}</span>
                            <span className={styles.cellSub}>{bedStateLabel(admission)}</span>
                          </td>
                          <td>{pt?.legalStatus ?? "Not recorded"}</td>
                          <td className={styles.n}>{stayDays === null ? "Not arrived" : `${stayDays}d`}</td>
                          <td
                            className={styles.actionsCell}
                            data-testid={`ward-community-transport-cell-${admission.id}`}
                          >
                            <div className={styles.rowActions}>
                              {dossierPatientId !== null ? (
                                <button
                                  type="button"
                                  className={styles.btnSmSec}
                                  data-testid={`ward-community-open-dossier-${admission.id}`}
                                  onClick={() => {
                                    setSelectedPatientId(dossierPatientId);
                                    setActiveDrawer("pxDrawer");
                                  }}
                                >
                                  Open record
                                </button>
                              ) : null}
                              {canBook ? (
                                <button
                                  type="button"
                                  className={styles.btnSmPrimary}
                                  data-testid={`ward-community-book-transport-${admission.movementId}`}
                                  onClick={() => openTransportBook(admission.movementId!)}
                                >
                                  Log transport booking
                                </button>
                              ) : null}
                              {ownUncollectedBooking ? (
                                <button
                                  type="button"
                                  className={styles.transportCancelButton}
                                  data-testid={`ward-community-cancel-transport-${admission.movementId}`}
                                  onClick={() => openTransportCancel(admission.movementId!)}
                                >
                                  Cancel this team&apos;s booking
                                </button>
                              ) : null}
                            </div>
                            {ownUncollectedBooking && transport.estimatedAt !== undefined ? (
                              <p
                                className={styles.transportBookedNote}
                                data-testid={`ward-community-transport-eta-${admission.movementId}`}
                              >
                                Estimated {formatInstantWithDay(transport.estimatedAt, now)} ·{" "}
                                {transportEtaRemainingLabel(transport.estimatedAt, now)}
                              </p>
                            ) : null}
                            {otherBooking ? (
                              <p
                                className={styles.transportBookedNote}
                                data-testid={`ward-community-transport-booked-${admission.movementId}`}
                              >
                                Transport already booked
                                {transport.bookedBy?.role === "ed"
                                  ? " by the emergency department"
                                  : transport.bookedBy?.role === "ward"
                                    ? " by a ward"
                                    : transport.bookedBy?.role === "community" && transport.bookedBy.placeId !== teamId
                                      ? " by another community team"
                                      : ""}
                                {transport.estimatedAt !== undefined
                                  ? ` · estimated ${formatInstantWithDay(transport.estimatedAt, now)} · ${transportEtaRemainingLabel(transport.estimatedAt, now)}`
                                  : ""}
                                .
                              </p>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </WardTable>
              )}
            </>
          )}
        </div>
      </section>

      {/* ── Admitted while already with this team — the owner's most delicate request ──
                 See `categoriseTeamAdmission`'s doc comment above for the exact rule this table
                 draws on, and this file's header block (third edition) for why the wording below is
                 constrained the way it is. */}
      <div style={{ display: isDemoMode ? "none" : "block" }} aria-hidden={isDemoMode ? "true" : undefined}>
        <section
          className={styles.cardPanel}
          aria-label="Admitted while already with the team"
          data-testid="ward-community-accepted-before-admission"
        >
          <div className={styles.panelHead}>
            <h3 className={styles.panelTitle}>
              <span>Admitted while already with the team</span>
            </h3>
            <span className={styles.badgePill} data-ward-panel-count>
              {admittedWhileAlreadyWithTeam.length} of {lists.currentlyAdmitted.length}
            </span>
          </div>
          <div
            className={styles.panelBody}
            role="region"
            aria-label="Admitted while already with the team details"
            tabIndex={0}
          >
            {admittedWhileAlreadyWithTeam.length === 0 ? (
              <p className={styles.emptyNote} data-testid="ward-community-accepted-before-admission-empty">
                {cannotResolve ? (
                  <>
                    A bed carries no link back to the referral that named this team, so this list cannot be built for{" "}
                    {team.name}. Its emptiness is a gap in the record rather than an answer about the team.
                  </>
                ) : (
                  <>
                    Nobody this team can currently see in a bed or with one pulled was accepted before that bed began.
                  </>
                )}
              </p>
            ) : (
              <WardTable
                className={styles.table}
                wrapperClassName={styles.tableScroll}
                testId="ward-community-accepted-before-admission-table"
                hasScrollThreshold
              >
                <caption>Admissions this team had already accepted before the bed began</caption>
                <thead>
                  <tr>
                    <th scope="col">Admission</th>
                    <th scope="col">Unit</th>
                    <th scope="col">In a bed for</th>
                    <th scope="col">Accepted before the bed began</th>
                    <th scope="col">Accepted altogether</th>
                  </tr>
                </thead>
                <tbody>
                  {admittedWhileAlreadyWithTeam.map(({ admission, acceptedAt, arrivedAt }) => (
                    <tr key={admission.id} data-testid={`ward-community-accepted-before-admission-${admission.id}`}>
                      <th scope="row">
                        <span className={styles.patientIdWrap}>{identityOf(admission)}</span>
                      </th>
                      <td>{unitName(admission.unitId, units)}</td>
                      <td>{stayLabel(admission, now)}</td>
                      <td>{elapsedSinceOrUnderADay(daysBetween(acceptedAt, arrivedAt))} before the bed began</td>
                      <td>{elapsedSinceOrUnderADay(daysBetween(acceptedAt, now))} since acceptance</td>
                    </tr>
                  ))}
                </tbody>
              </WardTable>
            )}
            {/*
             * The two groups the table above deliberately excludes, named rather than silently
             * dropped — a referral made from the ward is the ward reaching out, not a relapse
             * under this team's care, and a pulled bed with nobody arrived yet has no admission
             * start to compare an acceptance against at all.
             */}
            <p className={styles.absenceNotice} data-testid="ward-community-accepted-before-admission-other-groups">
              Excluded: {referredDuringThisAdmission.length} referred during the current admission and{" "}
              {bedPulledNotYetArrived.length} with a bed pulled but no arrival. Neither establishes care before
              admission.
            </p>
            <p className={styles.footnote} data-testid="ward-community-accepted-before-admission-not-active-claim">
              Acceptance before admission does not establish current care; no community-team closure is recorded.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
