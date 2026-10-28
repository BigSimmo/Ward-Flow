/*
 * The community team screen's drawer: the patient dossier, the referral triage view and the
 * illustrative activity, tasks and tools drawers.
 *
 * Split out of `community-screen.tsx` (fix list 2.5 and 9.6, 15 Oct 2026) as a pure refactor:
 * the markup, text, class names and behaviour are unchanged. Comments moved with the code, so
 * "this file" or "this screen" in them still means the community team screen as a whole.
 */

import { DischargeCareJourney } from "../discharges/discharge-care-journey";
import { referralWaitLine } from "@/components/ward-management/referrals/referral-wait";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { patientIdentityLine } from "@/components/ward-management/ward-patient-resolver";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { patientDisplayName } from "@/components/ward-management/ward-patients";
import styles from "./community.module.css";
import { NOT_RECORDED_IN_WARD_FLOW, unitName } from "./community-screen-helpers";
import type { CommunityScreenView } from "./community-screen";

/** The dossier, referral triage and illustrative drawers. Renders nothing while closed. */
export function CommunityScreenDrawer({ view }: { view: CommunityScreenView }) {
  const {
    units,
    patients,
    openDischargeRecord,
    now,
    identityOf,
    demoUmrnOf,
    team,
    setToastMessage,
    activeDrawer,
    setActiveDrawer,
    selectedPatientId,
    pendingAcceptance,
    acceptanceError,
    setAcceptanceError,
    showCareEditor,
    careAccess,
    setCareAccess,
    selectedPatient,
    dismissedTaskIds,
    setDismissedTaskIds,
    uiState,
    setUiState,
    handleToggleDecline,
    handleConfirmAccept,
    drawerPanelRef,
    drawerScrimRef,
    selectedReferral,
    teamConfig,
    careActor,
    patientAdmissions,
    careRead,
    openPatientCare,
    acceptedAddressing,
    acceptanceRefusal,
    acceptanceMessage,
  } = view;
  if (activeDrawer === null) return null;
  return (
    <div
      ref={drawerScrimRef}
      className={styles.drawerScrim}
      id="drawerScrim"
      role="presentation"
      onClick={() => setActiveDrawer(null)}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- only stops a click inside the dialog reaching the backdrop that closes it */}
      <div
        ref={drawerPanelRef}
        className={styles.drawerPanel}
        id={
          activeDrawer === "referral" || activeDrawer === "referralDrawer"
            ? "refDrawer"
            : activeDrawer === "px" || activeDrawer === "pxDrawer"
              ? "pxDrawer"
              : activeDrawer === "activity" || activeDrawer === "activityDrawer"
                ? "activityDrawer"
                : activeDrawer === "tasks" || activeDrawer === "tasksDrawer"
                  ? "tasksDrawer"
                  : activeDrawer === "tools" || activeDrawer === "toolsDrawer"
                    ? "toolsDrawer"
                    : undefined
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby={
          activeDrawer === "referral" || activeDrawer === "referralDrawer"
            ? "refDrawerTitle"
            : activeDrawer === "px" || activeDrawer === "pxDrawer"
              ? "pxDrawerTitle"
              : "drawer-heading"
        }
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.drawerHead}>
          <h3
            id={
              activeDrawer === "referral" || activeDrawer === "referralDrawer"
                ? "refDrawerTitle"
                : activeDrawer === "px" || activeDrawer === "pxDrawer"
                  ? "pxDrawerTitle"
                  : "drawer-heading"
            }
            className={styles.drawerTitle}
          >
            {(activeDrawer === "px" || activeDrawer === "pxDrawer") && (
              <span id="pxDrawerHeading">
                {selectedPatient
                  ? `Patient record: ${patientDisplayName(selectedPatient)} · ${selectedPatient.umrn}`
                  : `Patient record: ${patientIdentityLine({ formalName: "", umrn: demoUmrnOf(selectedPatientId || "PT-4409") })}`}
              </span>
            )}
            {(activeDrawer === "referral" || activeDrawer === "referralDrawer") && (
              <span id="refDrawerHeading">
                {selectedReferral ? `Referral triage: ${identityOf(selectedReferral)}` : "Referral unavailable"}
              </span>
            )}
            {(activeDrawer === "activity" || activeDrawer === "activityDrawer") && "Illustrative catchment activity"}
            {(activeDrawer === "tasks" || activeDrawer === "tasksDrawer") && "Illustrative coordination tasks"}
            {(activeDrawer === "tools" || activeDrawer === "toolsDrawer") && "Prototype display tools"}
          </h3>
          <button
            type="button"
            className={styles.drawerClose}
            onClick={() => setActiveDrawer(null)}
            aria-label="Close drawer"
          >
            &times;
          </button>
        </div>
        <div
          className={styles.drawerBody}
          id={
            activeDrawer === "px" || activeDrawer === "pxDrawer"
              ? "pxDrawerBody"
              : activeDrawer === "referral" || activeDrawer === "referralDrawer"
                ? "refDrawerBody"
                : undefined
          }
        >
          {(activeDrawer === "referral" || activeDrawer === "referralDrawer") && !selectedReferral && (
            <p role="alert">Referral is unavailable. No patient or clinical information has been inferred.</p>
          )}
          {(activeDrawer === "referral" || activeDrawer === "referralDrawer") && acceptanceMessage && (
            <p
              role={acceptanceError || acceptanceRefusal ? "alert" : "status"}
              data-testid="community-acceptance-result"
            >
              {acceptanceMessage}
            </p>
          )}
          {(activeDrawer === "px" || activeDrawer === "pxDrawer") &&
            (selectedPatient ? (
              <>
                <div className={styles.cardPanel}>
                  <div className={styles.panelHead}>
                    <h4 className={`${styles.panelTitle} ${styles.titleMd}`}>Demographics &amp; allocation</h4>
                    <span id="pxLegalChip" className={`${styles.statusPillBadge} ${styles.neutral}`}>
                      {selectedPatient.legalStatus ?? "Legal status not recorded"}
                    </span>
                  </div>
                  <div className={`${styles.panelBody} ${styles.bodyText}`}>
                    <div className={styles.factGrid}>
                      <div>
                        <b>Name:</b> <span>{patientDisplayName(selectedPatient)}</span>
                      </div>
                      <div>
                        <b>UMRN:</b>{" "}
                        <span id="pxUmrn" className={styles.patientIdWrap}>
                          {selectedPatient.umrn}
                        </span>
                      </div>
                      <div>
                        <b>DOB:</b>{" "}
                        <span id="pxDobAge" className={styles.mono}>
                          {selectedPatient.dateOfBirth}
                        </span>
                      </div>
                      <div>
                        <b>Community team:</b> <span>{selectedPatient.catchmentCommunityTeam ?? "Not recorded"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.cardPanel}>
                  <div className={styles.panelHead}>
                    <h4 className={`${styles.panelTitle} ${styles.titleMd}`}>Key information</h4>
                  </div>
                  <div className={styles.panelBody}>
                    <dl className={styles.factsList}>
                      <div className={styles.factsRow}>
                        <dt>Key clinician</dt>
                        <dd id="pxClinician">{NOT_RECORDED_IN_WARD_FLOW}</dd>
                      </div>
                      <div className={styles.factsRow}>
                        <dt>Care tier</dt>
                        <dd id="pxCareTier">{NOT_RECORDED_IN_WARD_FLOW}</dd>
                      </div>
                      <div className={styles.factsRow}>
                        <dt>Next scheduled review</dt>
                        <dd>{NOT_RECORDED_IN_WARD_FLOW}</dd>
                      </div>
                    </dl>
                  </div>
                </div>

                <p className={styles.footnote}>
                  Catchment record view for clinical coordination. Not connected to any health record.
                </p>
              </>
            ) : (
              <>
                <div className={styles.cardPanel}>
                  <div className={styles.panelHead}>
                    <h4 className={`${styles.panelTitle} ${styles.titleMd}`}>Demographics &amp; allocation</h4>
                    <span id="pxLegalChip" className={`${styles.statusPillBadge} ${styles.neutral}`}>
                      Illustrative record
                    </span>
                  </div>
                  <div className={`${styles.panelBody} ${styles.bodyText}`}>
                    <div className={styles.factGridLoose}>
                      <div>
                        <b>UMRN:</b>{" "}
                        <span id="pxUmrn" className={styles.patientIdWrap}>
                          {selectedPatientId === "PT-3712" ? "982314" : "981023"}
                        </span>
                      </div>
                      <div>
                        <b>DOB / age:</b>{" "}
                        <span id="pxDobAge" className={styles.mono}>
                          {selectedPatientId === "PT-3712" ? "12/03/1967 (59y)" : "14/05/1992 (34y)"}
                        </span>
                      </div>
                      <div>
                        <b>Assigned clinician:</b>{" "}
                        <span id="pxClinician">{selectedPatientId === "PT-3712" ? "SW M. Davies" : "RN K. Vance"}</span>
                      </div>
                      <div>
                        <b>Supervising psychiatrist:</b>{" "}
                        <span id="pxPsychiatrist">
                          {selectedPatientId === "PT-3712" ? "Dr J. Lim" : teamConfig.consultant}
                        </span>
                      </div>
                      <div>
                        <b>Current placement:</b>{" "}
                        <span id="pxPlacement">
                          {selectedPatientId === "PT-3712" ? "SCGH Adult Open" : `${teamConfig.campus} secure (bed 03)`}
                        </span>
                      </div>
                      <div>
                        <b>Admitted length of stay:</b>{" "}
                        <span id="pxLos" className={styles.mono}>
                          {selectedPatientId === "PT-3712" ? "6 days" : "14 days"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.cardPanel}>
                  <div className={styles.panelHead}>
                    <h4 className={`${styles.panelTitle} ${styles.titleMd}`}>
                      Recent timeline &amp; clinical contacts
                    </h4>
                    <span className={styles.badgePill}>Last 7 days</span>
                  </div>
                  <div id="pxTimeline" className={`${styles.panelBody} ${styles.timeline}`}>
                    <div className={styles.timelineEntry}>
                      <span className={`${styles.mono} ${styles.microMuted}`}>3d ago</span> · <b>Ward bed:</b> Admitted
                      in {selectedPatientId === "PT-3712" ? "SCGH Adult Open" : "FSH Adult Secure bed 03"}. Joint MDT
                      conference scheduled.
                    </div>
                    <div className={styles.timelineEntry}>
                      <span className={`${styles.mono} ${styles.microMuted}`}>5d ago</span> ·{" "}
                      <b>Community liaison contact:</b> Key clinician attended ward huddle; patient tolerating care plan
                      well.
                    </div>
                    <div>
                      <span className={`${styles.mono} ${styles.microMuted}`}>10d ago</span> ·{" "}
                      <b>Inpatient admission:</b> Transferred under Form 1A MHA.
                    </div>
                  </div>
                </div>
              </>
            ))}

          {(activeDrawer === "px" || activeDrawer === "pxDrawer") && showCareEditor && (
            <section aria-label="Patient follow-up and contact" data-testid="community-patient-care">
              {patientAdmissions.length === 0 ? (
                <p role="alert">
                  No matching admission is available to this team. Follow-up and patient contact cannot be recorded
                  here.
                </p>
              ) : (
                <>
                  {patientAdmissions.length > 1 && <p>Choose the admission for this follow-up or contact.</p>}
                  {(patientAdmissions.length > 1 || !careAccess) &&
                    patientAdmissions.map((admission) => (
                      <button
                        key={admission.id}
                        type="button"
                        className={styles.btnSmSec}
                        onClick={() =>
                          setCareAccess({
                            admissionId: admission.id,
                            handle: openDischargeRecord(careActor, admission.id),
                          })
                        }
                      >
                        Open admission · {unitName(admission.unitId, units)} · {admission.state}
                      </button>
                    ))}
                  {careRead?.status === "allowed" ? (
                    <DischargeCareJourney key={careRead.value.id} record={careRead.value} actor={careActor} />
                  ) : careAccess ? (
                    <p role="alert">
                      Care record access is unavailable. Reopen the current admission before recording.
                    </p>
                  ) : null}
                </>
              )}
            </section>
          )}
          {(activeDrawer === "referral" || activeDrawer === "referralDrawer") && (
            <>
              <div className={styles.cardPanel}>
                <div className={styles.panelHead}>
                  <h4 className={`${styles.panelTitle} ${styles.titleMd}`}>Referral demographics &amp; urgency</h4>
                  <span className={`${styles.statusPillBadge} ${styles.danger}`} id="refDrawerUrgencyBadge">
                    {selectedReferral ? urgencyTierLabel(selectedReferral.urgency) : "Urgency not recorded"}
                  </span>
                </div>
                <div className={`${styles.panelBody} ${styles.bodyText}`}>
                  <div className={styles.factGrid}>
                    <div>
                      <b>Patient:</b>{" "}
                      <span id="refDrawerPatient">
                        {selectedReferral ? identityOf(selectedReferral) : "Not recorded"}
                      </span>
                    </div>
                    <div>
                      <b>Referring service:</b>{" "}
                      <span id="refDrawerService">{selectedReferral?.originSiteCode ?? "Not recorded"}</span>
                    </div>
                    <div>
                      <b>Referring clinician:</b>{" "}
                      <span id="refDrawerClinician">{selectedReferral?.sendingTeamName ?? "Not recorded"}</span>
                    </div>
                    <div>
                      <b>Statutory status:</b>{" "}
                      <span className={`${styles.statusPillBadge} ${styles.danger}`} id="refDrawerLegalBadge">
                        {selectedReferral?.patientId
                          ? (patients.find((p) => p.id === selectedReferral.patientId)?.legalStatus ?? "Not recorded")
                          : "Not recorded"}
                      </span>
                    </div>
                    <div>
                      <b>Elapsed wait:</b>{" "}
                      <span className={`${styles.mono} ${styles.inkDangerStrong}`} id="refDrawerWait">
                        {selectedReferral ? referralWaitLine(selectedReferral, now) : "Not recorded"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.cardPanel}>
                <div className={styles.panelHead}>
                  <h4 className={`${styles.panelTitle} ${styles.titleMd}`}>Triage assessment &amp; clinical notes</h4>
                </div>
                <div className={`${styles.panelBody} ${styles.bodyProse}`}>
                  <p>
                    <b>Presenting symptoms:</b>{" "}
                    <span id="refDrawerSymptoms">{selectedReferral?.history || "History not recorded"}</span>
                  </p>
                  <p>
                    <b>Medical clearance:</b>{" "}
                    <span id="refDrawerClearance">
                      {selectedReferral?.medicalClearance
                        ? `${selectedReferral.medicalClearance.cleared ? "Recorded as medically cleared" : "Recorded as not medically cleared"} · ${formatInstantWithDay(selectedReferral.medicalClearance.at, now)}`
                        : "Medical clearance not recorded"}
                    </span>
                  </p>
                  <p>
                    <b>Next recorded step:</b>{" "}
                    <span id="refDrawerAction">
                      None recorded in this record. Review the referring team&apos;s information.
                    </span>
                  </p>
                </div>
              </div>

              <div className={styles.cardPanel}>
                <div className={styles.panelHead}>
                  <h4 className={`${styles.panelTitle} ${styles.titleMd}`}>Clinician allocation &amp; decision</h4>
                </div>
                <div className={`${styles.panelBody} ${styles.bodyStack}`}>
                  <p>
                    Accepting records this team&apos;s referral decision only. It does not assign a clinician or confirm
                    an appointment.
                  </p>
                </div>
              </div>
            </>
          )}

          {(activeDrawer === "activity" || activeDrawer === "activityDrawer") && (
            <div className={styles.stackMd}>
              <p className={styles.footnote}>
                Illustrative interface content only. This is not a live activity stream for {team.name}.
              </p>
              <div className={styles.activityEntry}>
                {/* No named patient here: an example event attached to a sample patient's name reads
                          as that person's record, and contradicted it (25 Sept 2026). */}
                <span className={styles.entryLabel}>Example entry</span>
                <b>Referral:</b> a priority referral arrives from an emergency department.
              </div>
              <div className={styles.activityEntry}>
                <span className={styles.entryLabel}>Example entry</span>
                <b>Discharge:</b> a discharge summary arrives from an inpatient ward.
              </div>
              <div className={styles.activityEntry}>
                <span className={styles.entryLabel}>Example entry</span>
                <b>Team huddle:</b> the morning allocations are completed.
              </div>
            </div>
          )}

          {(activeDrawer === "tasks" || activeDrawer === "tasksDrawer") && (
            <div className={styles.stackMd}>
              <p className={styles.footnote}>
                Illustrative interface content only. These are not recorded tasks for this catchment shift.
              </p>
              {[
                {
                  id: "taskCard1",
                  label: "Example: review a Form 1A referral waiting for an answer",
                  prio: "Immediate",
                },
                { id: "taskCard2", label: "Example: coordinate the depot clinic list", prio: "Scheduled" },
                {
                  id: "taskCard3",
                  label: "Example: contact a person after their discharge",
                  prio: "Attention needed",
                },
              ].map((task) => {
                const isDismissed = dismissedTaskIds.has(task.id);
                return (
                  <div
                    key={task.id}
                    id={task.id}
                    data-dim={isDismissed ? "true" : undefined}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.625rem 0.75rem",
                      background: isDismissed ? "var(--surface-2)" : "var(--surface)",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--r2)",
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: "var(--t-1)",
                          textDecoration: isDismissed ? "line-through" : "none",
                        }}
                      >
                        {task.label}
                      </span>
                      <span className={styles.entryLabel}>{task.prio}</span>
                    </div>
                    <button
                      type="button"
                      className={styles.btnSmSec}
                      onClick={() => {
                        setDismissedTaskIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(task.id)) next.delete(task.id);
                          else next.add(task.id);
                          return next;
                        });
                      }}
                    >
                      {isDismissed ? "Undo" : "Mark done"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {(activeDrawer === "tools" || activeDrawer === "toolsDrawer") && (
            <div className={styles.stackLg}>
              <div>
                <h4 className={styles.toolsHeading}>Prototype state simulation</h4>
                <div className={styles.buttonRow}>
                  <button
                    type="button"
                    className={uiState === "populated" ? styles.btnSmPrimary : styles.btnSmSec}
                    onClick={() => {
                      setUiState("populated");
                      setToastMessage("State: populated console");
                    }}
                  >
                    Populated
                  </button>
                  <button
                    type="button"
                    className={uiState === "skeleton" ? styles.btnSmPrimary : styles.btnSmSec}
                    onClick={() => {
                      setUiState("skeleton");
                      setToastMessage("State: skeleton loading");
                    }}
                  >
                    Skeleton
                  </button>
                  <button
                    type="button"
                    className={uiState === "empty" ? styles.btnSmPrimary : styles.btnSmSec}
                    onClick={() => {
                      setUiState("empty");
                      setToastMessage("State: empty catchment");
                    }}
                  >
                    Empty
                  </button>
                  <button
                    type="button"
                    className={uiState === "error" ? styles.btnSmPrimary : styles.btnSmSec}
                    onClick={() => {
                      setUiState("error");
                      setToastMessage("State: network simulation error");
                    }}
                  >
                    Error banner
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {(activeDrawer === "px" || activeDrawer === "pxDrawer") && (
          <div className={styles.drawerFoot}>
            {/* Edit dossier removed: it was not wired (simplification A5, 19 Oct 2026, supersedes D-16). */}
            <div className={styles.footButtons}>
              <button
                type="button"
                className={styles.btnSmSec}
                onClick={() => {
                  openPatientCare();
                }}
              >
                Record contact
              </button>
              <button type="button" className={styles.btnSmPrimary} id="pxConfirmFollowupBtn" onClick={openPatientCare}>
                Arrange follow-up
              </button>
            </div>
          </div>
        )}

        {(activeDrawer === "referral" || activeDrawer === "referralDrawer") && (
          <div className={styles.drawerFoot}>
            <button
              type="button"
              className={styles.btnSmSec}
              id="refDrawerDeclineBtn"
              onClick={() => {
                if (selectedReferral) {
                  handleToggleDecline(selectedReferral.id);
                }
                setActiveDrawer(null);
              }}
            >
              Decline / redirect
            </button>
            <button
              type="button"
              className={styles.btnSmPrimary}
              id="refDrawerAcceptBtn"
              disabled={
                !selectedReferral ||
                (pendingAcceptance?.id === selectedReferral.id && acceptedAddressing?.state === "accepted")
              }
              onClick={() => {
                if (selectedReferral) handleConfirmAccept(selectedReferral.id);
                else setAcceptanceError("Referral is unavailable. No acceptance was recorded.");
              }}
            >
              Accept referral
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
