// Forked from src/components/ward-redesign/community-team/community-team-in-bed.tsx (role view: community clinician).
/*
 * The community team screen's second desktop list: people referred to this team in a bed or
 * holding one, and those admitted while already with the team.
 *
 * Redesign mock-up fork of `community-screen-in-bed-tab.tsx`: the live (non-demo) list is one
 * table that carries both the bed and the "admitted while already with the team" figures.
 */

import { daysInBed, type Admission } from "@/components/ward-management/ward-admissions";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { SrOnly } from "@/components/wf";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { daysBetween, formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { transportEtaRemainingLabel } from "@/components/ward-management/ward-board-time-features";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";
import styles from "@/components/ward-management/community/community.module.css";
import { DEMO_COMMUNITY_INPATIENTS } from "@/components/ward-management/community/community-demo-cohort";
import {
  unitName,
  bedStateLabel,
  elapsedSinceOrUnderADay,
} from "@/components/ward-management/community/community-screen-helpers";
import type { CommunityScreenView } from "@/components/ward-management/community/community-screen";
import local from "@/components/ward-redesign/community-team/community-team.module.css";

/** Tab 2: people referred to this team in a bed or with one pulled. */
export function CommunityTeamInBedTab({ view }: { view: CommunityScreenView }) {
  // Role view (community clinician): the team's own list. The count already sits in the panel head,
  // so the sentence repeating it goes, and an "Excluded: 0 ... and 0" box with nothing excluded goes.
  const ownTeamDesk = useEffectiveWardAccess().role === "community";
  const {
    teamId,
    units,
    movements,
    patients,
    now,
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
    umrnLookup,
  } = view;
  // Redesign: the "before the bed" figures, looked up by admission so they sit on the same row.
  const acceptedById = new Map(admittedWhileAlreadyWithTeam.map((entry) => [entry.admission.id, entry]));
  const referredDuringIds = new Set(referredDuringThisAdmission.map((entry) => entry.admission.id));
  function transportFor(admission: Admission) {
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
    return { movement, transport, ownUncollectedBooking, otherBooking, canBook };
  }
  // The transport column shows only when a row has a transport control or note to carry.
  const anyTransport = lists.currentlyAdmitted.some((admission) => {
    const row = transportFor(admission);
    return row.canBook || row.ownUncollectedBooking || row.otherBooking;
  });
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
              {ownTeamDesk && lists.currentlyAdmitted.length > 0 ? null : (
                <p id="inpatientSummaryNote" className={styles.count} data-testid="ward-community-admitted-count">
                  {lists.currentlyAdmitted.length}{" "}
                  {lists.currentlyAdmitted.length === 1
                    ? "person referred to this team is"
                    : "people referred to this team are"}{" "}
                  in a bed or have one pulled for them.
                </p>
              )}
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
                /*
                 * Redesign: ONE table. "In a bed" and "Admitted while already with the team" listed
                 * the same people twice; their columns now sit side by side on one row. The whole row
                 * opens the record (the name is the keyboard target), so the nine "Open record"
                 * buttons are gone; transport controls stay in their own cell, as before.
                 */
                <WardTable
                  id="inpatientTable"
                  className={`${styles.table} ${local.table}`}
                  wrapperClassName={styles.tableScroll}
                  testId="ward-community-admitted-list"
                >
                  <caption>People referred to this team in a bed or with one pulled</caption>
                  <thead>
                    <tr>
                      <th scope="col">Person</th>
                      <th scope="col">Unit</th>
                      <th scope="col">Legal status</th>
                      <th scope="col" className={styles.n}>
                        In bed
                      </th>
                      <th scope="col">With team before bed</th>
                      <th scope="col">Since accepted</th>
                      {anyTransport ? (
                        <th scope="col" className={styles.actionsCol}>
                          Transport
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {lists.currentlyAdmitted.map((admission) => {
                      const row = transportFor(admission);
                      const { movement, transport, ownUncollectedBooking, otherBooking, canBook } = row;
                      const dossierPatientId = admission.patientId;
                      const pt = patients.find((p) => p.id === admission.patientId);
                      const person = resolveSubjectPatient(admission, umrnLookup);
                      const stayDays = daysInBed(admission, now);
                      const accepted = acceptedById.get(admission.id);
                      const openRecord =
                        dossierPatientId !== null
                          ? () => {
                              setSelectedPatientId(dossierPatientId);
                              setActiveDrawer("pxDrawer");
                            }
                          : undefined;
                      return (
                        <tr
                          key={admission.id}
                          data-testid={`ward-community-admitted-${admission.id}`}
                          className={openRecord ? local.rowOpens : undefined}
                          onClick={openRecord}
                        >
                          <td>
                            {openRecord ? (
                              <button
                                type="button"
                                className={local.personButton}
                                data-testid={`ward-community-open-dossier-${admission.id}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openRecord();
                                }}
                              >
                                <span className={local.personName}>{person.formalName}</span>
                                <SrOnly>, open record</SrOnly>
                              </button>
                            ) : (
                              <span className={local.personName}>{person.formalName}</span>
                            )}
                            <span className={local.personMeta}>
                              <span className={local.umrn}>{person.umrn}</span>
                              {pt ? ` · ${pt.sex === "Male" ? "M" : "F"}` : ""}
                            </span>
                          </td>
                          <td>
                            <span className={styles.cellLead}>{unitName(admission.unitId, units)}</span>
                            {/* Redesign: the panel is "In a bed or with one pulled", so only a bed that is not
                                simply occupied (pulled, or its person at an ED) says so. */}
                            {bedStateLabel(admission) === "In the bed" ? null : (
                              <span className={styles.cellSub}>{bedStateLabel(admission)}</span>
                            )}
                          </td>
                          <td>{pt?.legalStatus ?? "Not recorded"}</td>
                          <td className={styles.n}>{stayDays === null ? "Not arrived" : `${stayDays}d`}</td>
                          <td>
                            {accepted
                              ? elapsedSinceOrUnderADay(daysBetween(accepted.acceptedAt, accepted.arrivedAt))
                              : referredDuringIds.has(admission.id)
                                ? "Referred during this stay"
                                : "Not arrived"}
                          </td>
                          <td>
                            {accepted ? elapsedSinceOrUnderADay(daysBetween(accepted.acceptedAt, now)) : "Not counted"}
                          </td>
                          {anyTransport ? (
                            <td
                              className={styles.actionsCell}
                              data-testid={`ward-community-transport-cell-${admission.id}`}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <div className={styles.rowActions}>
                                {canBook && movement ? (
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
                              {ownUncollectedBooking && transport?.estimatedAt !== undefined ? (
                                <p
                                  className={styles.transportBookedNote}
                                  data-testid={`ward-community-transport-eta-${admission.movementId}`}
                                >
                                  Estimated {formatInstantWithDay(transport.estimatedAt, now)} ·{" "}
                                  {transportEtaRemainingLabel(transport.estimatedAt, now)}
                                </p>
                              ) : null}
                              {otherBooking && transport ? (
                                <p
                                  className={styles.transportBookedNote}
                                  data-testid={`ward-community-transport-booked-${admission.movementId}`}
                                >
                                  Transport already booked
                                  {transport.bookedBy?.role === "ed"
                                    ? " by the emergency department"
                                    : transport.bookedBy?.role === "ward"
                                      ? " by a ward"
                                      : transport.bookedBy?.role === "community" &&
                                          transport.bookedBy.placeId !== teamId
                                        ? " by another community team"
                                        : ""}
                                  {transport.estimatedAt !== undefined
                                    ? ` · estimated ${formatInstantWithDay(transport.estimatedAt, now)} · ${transportEtaRemainingLabel(transport.estimatedAt, now)}`
                                    : ""}
                                  .
                                </p>
                              ) : null}
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </WardTable>
              )}
              {/*
               * Kept from the second table, word for word: the groups the "before the bed" column
               * cannot speak for, named rather than silently dropped.
               */}
              {lists.currentlyAdmitted.length === 0 ? null : (
                <>
                  {ownTeamDesk && referredDuringThisAdmission.length + bedPulledNotYetArrived.length === 0 ? null : (
                    <p
                      className={styles.absenceNotice}
                      data-testid="ward-community-accepted-before-admission-other-groups"
                    >
                      Excluded: {referredDuringThisAdmission.length} referred during the current admission and{" "}
                      {bedPulledNotYetArrived.length} with a bed pulled but no arrival. Neither establishes care before
                      admission.
                    </p>
                  )}
                  <p
                    className={styles.footnote}
                    data-testid="ward-community-accepted-before-admission-not-active-claim"
                  >
                    Acceptance before admission does not establish current care; no community-team closure is recorded.
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
