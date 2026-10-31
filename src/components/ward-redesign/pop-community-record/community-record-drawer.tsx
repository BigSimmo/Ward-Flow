"use client";

// Preview copy of src/components/ward-redesign/community-team/community-screen-drawer-redesign.tsx (itself a
// copy of src/components/ward-management/community/community-screen-drawer.tsx with the record named surname
// first): the dossier, referral triage and illustrative drawers on the kit Sheet, a side sheet on a computer
// and a full-height sheet on a phone. State, handlers, text and element ids are today's; the frame, the
// head, the cards and the footer are the redesign.
/*
 * The community team screen's drawer: the patient dossier, the referral triage view and the
 * illustrative activity, tasks and tools drawers.
 */

import { useCallback, useId, type ReactNode } from "react";
import { X } from "lucide-react";

import { Button, Sheet, cx } from "@/components/wf";
import { DischargeCareJourney } from "@/components/ward-management/discharges/discharge-care-journey";
import { referralWaitLine } from "@/components/ward-management/referrals/referral-wait";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { patientIdentityLine } from "@/components/ward-management/ward-patient-resolver";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import type { Patient } from "@/components/ward-management/ward-patients";
import { NOT_RECORDED_IN_WARD_FLOW, unitName } from "@/components/ward-management/community/community-screen-helpers";
import type { CommunityScreenView } from "@/components/ward-management/community/community-screen";

import d from "./community-record-drawer.module.css";

/** Surname first, as every Ward Flow list names a person (D-83). */
function formalNameOf(patient: Patient): string {
  return `${patient.familyName}, ${patient.givenName}`;
}

/** One card: a small heading, then label and value rows or other content. */
function Card({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className={d.card} aria-label={title}>
      <div className={d.cardHead}>
        <h3 className={d.cardTitle}>{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** One label and value row. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={d.row}>
      <dt className={d.rowLabel}>{label}</dt>
      <dd className={d.rowValue}>{children}</dd>
    </div>
  );
}

/** The dossier, referral triage and illustrative drawers. Renders nothing while closed. */
export function CommunityRecordDrawer({ view }: { view: CommunityScreenView }) {
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
  const fallbackHeadingId = useId();
  // The page's own modal-focus hook (inert page, Tab wrap, Escape, focus return) holds these two
  // refs; they point at the kit Sheet's panel and its backdrop, so that hook keeps working round the new frame.
  const bindPage = useCallback(
    (node: HTMLDivElement | null) => {
      const panel = node?.closest<HTMLDivElement>('[role="dialog"]') ?? null;
      drawerPanelRef.current = panel;
      drawerScrimRef(panel?.parentElement ?? null);
    },
    [drawerPanelRef, drawerScrimRef],
  );
  if (activeDrawer === null) return null;
  const isPx = activeDrawer === "px" || activeDrawer === "pxDrawer";
  const isReferral = activeDrawer === "referral" || activeDrawer === "referralDrawer";
  const isActivity = activeDrawer === "activity" || activeDrawer === "activityDrawer";
  const isTasks = activeDrawer === "tasks" || activeDrawer === "tasksDrawer";
  const isTools = activeDrawer === "tools" || activeDrawer === "toolsDrawer";
  const close = () => setActiveDrawer(null);
  const headingId = isReferral ? "refDrawerTitle" : isPx ? "pxDrawerTitle" : fallbackHeadingId;
  const panelId = isReferral
    ? "refDrawer"
    : isPx
      ? "pxDrawer"
      : isActivity
        ? "activityDrawer"
        : isTasks
          ? "tasksDrawer"
          : isTools
            ? "toolsDrawer"
            : undefined;

  // Redesign: the head names what the drawer is in a small line, then the person (surname first) or
  // the sample's name, then the record number. The legal status sits beside it exactly as recorded.
  const kicker = isPx ? "Patient record" : isReferral ? "Referral triage" : "Sample";
  const heading = isPx ? (
    <span id="pxDrawerHeading">
      {selectedPatient
        ? formalNameOf(selectedPatient)
        : patientIdentityLine({ formalName: "", umrn: demoUmrnOf(selectedPatientId || "PT-4409") })}
    </span>
  ) : isReferral ? (
    <span id="refDrawerHeading">{selectedReferral ? identityOf(selectedReferral) : "Referral unavailable"}</span>
  ) : isActivity ? (
    "Illustrative catchment activity"
  ) : isTasks ? (
    "Illustrative coordination tasks"
  ) : (
    "Prototype display tools"
  );
  const subline =
    isPx && selectedPatient ? (
      <>
        <span className={d.mono}>{selectedPatient.umrn}</span> · DOB{" "}
        <span className={d.mono}>{selectedPatient.dateOfBirth}</span>
      </>
    ) : null;
  const chip = isPx ? (
    <span id="pxLegalChip" className={d.chip}>
      {selectedPatient ? (selectedPatient.legalStatus ?? "Legal status not recorded") : "Illustrative record"}
    </span>
  ) : isReferral ? (
    <span id="refDrawerUrgencyBadge" className={cx(d.chip, d.chipStrong)}>
      {selectedReferral ? urgencyTierLabel(selectedReferral.urgency) : "Urgency not recorded"}
    </span>
  ) : null;

  const acceptDisabledReason = !selectedReferral
    ? "Referral is unavailable."
    : pendingAcceptance?.id === selectedReferral.id && acceptedAddressing?.state === "accepted"
      ? "This referral is accepted."
      : undefined;

  const footer = isPx ? (
    // Edit dossier removed: it was not wired (simplification A5, 19 Oct 2026, supersedes D-16).
    <div className={d.foot}>
      <Button variant="sec" onClick={() => openPatientCare()}>
        Record contact
      </Button>
      <Button variant="pri" id="pxConfirmFollowupBtn" onClick={openPatientCare}>
        Arrange follow-up
      </Button>
    </div>
  ) : isReferral ? (
    <div className={d.foot}>
      <Button
        variant="sec"
        id="refDrawerDeclineBtn"
        onClick={() => {
          if (selectedReferral) {
            handleToggleDecline(selectedReferral.id);
          }
          setActiveDrawer(null);
        }}
      >
        Decline / redirect
      </Button>
      <Button
        variant="pri"
        id="refDrawerAcceptBtn"
        disabledReason={acceptDisabledReason}
        reasonDisplay="tooltip"
        onClick={() => {
          if (selectedReferral) handleConfirmAccept(selectedReferral.id);
          else setAcceptanceError("Referral is unavailable. No acceptance was recorded.");
        }}
      >
        Accept referral
      </Button>
    </div>
  ) : undefined;

  return (
    <Sheet
      open
      onClose={close}
      labelledBy={headingId}
      id={panelId}
      placement="responsive-right"
      mobilePlacement="bottom"
      mobileSize="viewport"
      contentClassName={d.panel}
      bodyClassName={d.body}
      footer={footer}
      footerClassName={d.footer}
    >
      <div ref={bindPage} className={d.head}>
        <div className={d.who}>
          <p className={d.kicker}>{kicker}</p>
          <h2 id={headingId} className={d.name}>
            {heading}
          </h2>
          {subline ? <p className={d.subline}>{subline}</p> : null}
          {chip ? <div className={d.chips}>{chip}</div> : null}
        </div>
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          icon={X}
          aria-label="Close drawer"
          data-sheet-autofocus="true"
          onClick={close}
        />
      </div>

      <div className={d.content} id={isPx ? "pxDrawerBody" : isReferral ? "refDrawerBody" : undefined}>
        {isReferral && !selectedReferral && (
          <p role="alert" className={d.alert}>
            Referral is unavailable. No patient or clinical information has been inferred.
          </p>
        )}
        {isReferral && acceptanceMessage && (
          <p
            role={acceptanceError || acceptanceRefusal ? "alert" : "status"}
            data-testid="community-acceptance-result"
            className={d.alert}
          >
            {acceptanceMessage}
          </p>
        )}

        {isPx &&
          (selectedPatient ? (
            <>
              <Card title="Demographics & allocation">
                <dl className={d.rows}>
                  <Row label="Name">{formalNameOf(selectedPatient)}</Row>
                  <Row label="UMRN">
                    <span id="pxUmrn" className={d.mono}>
                      {selectedPatient.umrn}
                    </span>
                  </Row>
                  <Row label="DOB">
                    <span id="pxDobAge" className={d.mono}>
                      {selectedPatient.dateOfBirth}
                    </span>
                  </Row>
                  <Row label="Community team">{selectedPatient.catchmentCommunityTeam ?? "Not recorded"}</Row>
                </dl>
              </Card>

              <Card title="Key information">
                <dl className={d.rows}>
                  <Row label="Key clinician">
                    <span id="pxClinician">{NOT_RECORDED_IN_WARD_FLOW}</span>
                  </Row>
                  <Row label="Care tier">
                    <span id="pxCareTier">{NOT_RECORDED_IN_WARD_FLOW}</span>
                  </Row>
                  <Row label="Next scheduled review">{NOT_RECORDED_IN_WARD_FLOW}</Row>
                </dl>
              </Card>

              <p className={d.footnote}>
                Catchment record view for clinical coordination. Not connected to any health record.
              </p>
            </>
          ) : (
            <>
              <Card title="Demographics & allocation">
                <dl className={d.rows}>
                  <Row label="UMRN">
                    <span id="pxUmrn" className={d.mono}>
                      {selectedPatientId === "PT-3712" ? "982314" : "981023"}
                    </span>
                  </Row>
                  <Row label="DOB / age">
                    <span id="pxDobAge" className={d.mono}>
                      {selectedPatientId === "PT-3712" ? "12/03/1967 (59y)" : "14/05/1992 (34y)"}
                    </span>
                  </Row>
                  <Row label="Assigned clinician">
                    <span id="pxClinician">{selectedPatientId === "PT-3712" ? "SW M. Davies" : "RN K. Vance"}</span>
                  </Row>
                  <Row label="Supervising psychiatrist">
                    <span id="pxPsychiatrist">
                      {selectedPatientId === "PT-3712" ? "Dr J. Lim" : teamConfig.consultant}
                    </span>
                  </Row>
                  <Row label="Current placement">
                    <span id="pxPlacement">
                      {selectedPatientId === "PT-3712" ? "SCGH Adult Open" : `${teamConfig.campus} secure (bed 03)`}
                    </span>
                  </Row>
                  <Row label="Admitted length of stay">
                    <span id="pxLos" className={d.mono}>
                      {selectedPatientId === "PT-3712" ? "6 days" : "14 days"}
                    </span>
                  </Row>
                </dl>
              </Card>

              <Card title="Recent timeline & clinical contacts" aside={<span className={d.chip}>Last 7 days</span>}>
                <ul id="pxTimeline" className={d.timeline}>
                  <li>
                    <span className={d.when}>3d ago</span>
                    <span>
                      <b>Ward bed:</b> Admitted in{" "}
                      {selectedPatientId === "PT-3712" ? "SCGH Adult Open" : "FSH Adult Secure bed 03"}. Joint MDT
                      conference scheduled.
                    </span>
                  </li>
                  <li>
                    <span className={d.when}>5d ago</span>
                    <span>
                      <b>Community liaison contact:</b> Key clinician attended ward huddle; patient tolerating care plan
                      well.
                    </span>
                  </li>
                  <li>
                    <span className={d.when}>10d ago</span>
                    <span>
                      <b>Inpatient admission:</b> Transferred under Form 1A MHA.
                    </span>
                  </li>
                </ul>
              </Card>
            </>
          ))}

        {isPx && showCareEditor && (
          <section aria-label="Patient follow-up and contact" data-testid="community-patient-care" className={d.care}>
            {patientAdmissions.length === 0 ? (
              <p role="alert" className={d.alert}>
                No matching admission is available to this team. Follow-up and patient contact cannot be recorded here.
              </p>
            ) : (
              <>
                {patientAdmissions.length > 1 && (
                  <p className={d.note}>Choose the admission for this follow-up or contact.</p>
                )}
                {(patientAdmissions.length > 1 || !careAccess) && (
                  <div className={d.choices}>
                    {patientAdmissions.map((admission) => (
                      <Button
                        key={admission.id}
                        variant="sec"
                        size="sm"
                        onClick={() =>
                          setCareAccess({
                            admissionId: admission.id,
                            handle: openDischargeRecord(careActor, admission.id),
                          })
                        }
                      >
                        Open admission · {unitName(admission.unitId, units)} · {admission.state}
                      </Button>
                    ))}
                  </div>
                )}
                {careRead?.status === "allowed" ? (
                  <DischargeCareJourney key={careRead.value.id} record={careRead.value} actor={careActor} />
                ) : careAccess ? (
                  <p role="alert" className={d.alert}>
                    Care record access is unavailable. Reopen the current admission before recording.
                  </p>
                ) : null}
              </>
            )}
          </section>
        )}

        {isReferral && (
          <>
            <p className={d.footnote}>Priority triage assessment and referral routing record.</p>
            <Card title="Referral demographics & urgency">
              <dl className={d.rows}>
                <Row label="Patient">
                  <span id="refDrawerPatient">{selectedReferral ? identityOf(selectedReferral) : "Not recorded"}</span>
                </Row>
                <Row label="Referring service">
                  <span id="refDrawerService">{selectedReferral?.originSiteCode ?? "Not recorded"}</span>
                </Row>
                <Row label="Referring clinician">
                  <span id="refDrawerClinician">{selectedReferral?.sendingTeamName ?? "Not recorded"}</span>
                </Row>
                <Row label="Statutory status">
                  {/* As recorded, never a countdown. */}
                  <span id="refDrawerLegalBadge">
                    {selectedReferral?.patientId
                      ? (patients.find((p) => p.id === selectedReferral.patientId)?.legalStatus ?? "Not recorded")
                      : "Not recorded"}
                  </span>
                </Row>
                <Row label="Elapsed wait">
                  <span className={d.mono} id="refDrawerWait">
                    {selectedReferral ? referralWaitLine(selectedReferral, now) : "Not recorded"}
                  </span>
                </Row>
              </dl>
            </Card>

            <Card title="Triage assessment & clinical notes">
              <dl className={d.rows}>
                <Row label="Presenting symptoms">
                  <span id="refDrawerSymptoms">{selectedReferral?.history || "History not recorded"}</span>
                </Row>
                <Row label="Medical clearance">
                  <span id="refDrawerClearance">
                    {selectedReferral?.medicalClearance
                      ? `${selectedReferral.medicalClearance.cleared ? "Recorded as medically cleared" : "Recorded as not medically cleared"} · ${formatInstantWithDay(selectedReferral.medicalClearance.at, now)}`
                      : "Medical clearance not recorded"}
                  </span>
                </Row>
                <Row label="Next recorded step">
                  <span id="refDrawerAction">
                    None recorded in this record. Review the referring team&apos;s information.
                  </span>
                </Row>
              </dl>
            </Card>

            <Card title="Clinician allocation & decision">
              <p className={d.cardText}>
                Accepting records this team&apos;s referral decision only. It does not assign a clinician or confirm an
                appointment.
              </p>
            </Card>
          </>
        )}

        {isActivity && (
          <>
            <p className={d.footnote}>
              Illustrative interface content only. This is not a live activity stream for {team.name}.
            </p>
            {/* No named patient here: an example event attached to a sample patient's name reads
                as that person's record, and contradicted it (25 Sept 2026). */}
            <Card title="Example entries">
              <ul className={d.list}>
                <li>
                  <b>Referral:</b> a priority referral arrives from an emergency department.
                </li>
                <li>
                  <b>Discharge:</b> a discharge summary arrives from an inpatient ward.
                </li>
                <li>
                  <b>Team huddle:</b> the morning allocations are completed.
                </li>
              </ul>
            </Card>
          </>
        )}

        {isTasks && (
          <>
            <p className={d.footnote}>
              Illustrative interface content only. These are not recorded tasks for this catchment shift.
            </p>
            <ul className={d.tasks}>
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
                  <li key={task.id} id={task.id} className={d.task} data-dim={isDismissed ? "true" : undefined}>
                    <span className={d.taskText}>
                      <span className={d.taskLabel}>{task.label}</span>
                      <span className={d.taskPrio}>{task.prio}</span>
                    </span>
                    <Button
                      variant="sec"
                      size="sm"
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
                    </Button>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {isTools && (
          <Card title="Prototype state simulation">
            {/* Redesign: plain buttons with the state shown in words, so the drawer keeps no filled button
                and no choice reads as already made. */}
            <p className={d.cardText} aria-live="polite">
              Showing:{" "}
              {uiState === "populated"
                ? "populated console"
                : uiState === "skeleton"
                  ? "skeleton loading"
                  : uiState === "empty"
                    ? "empty catchment"
                    : "network simulation error"}
            </p>
            <div className={d.choices}>
              <Button
                variant="sec"
                size="sm"
                aria-pressed={uiState === "populated"}
                onClick={() => {
                  setUiState("populated");
                  setToastMessage("State: populated console");
                }}
              >
                Populated
              </Button>
              <Button
                variant="sec"
                size="sm"
                aria-pressed={uiState === "skeleton"}
                onClick={() => {
                  setUiState("skeleton");
                  setToastMessage("State: skeleton loading");
                }}
              >
                Skeleton
              </Button>
              <Button
                variant="sec"
                size="sm"
                aria-pressed={uiState === "empty"}
                onClick={() => {
                  setUiState("empty");
                  setToastMessage("State: empty catchment");
                }}
              >
                Empty
              </Button>
              <Button
                variant="sec"
                size="sm"
                aria-pressed={uiState === "error"}
                onClick={() => {
                  setUiState("error");
                  setToastMessage("State: network simulation error");
                }}
              >
                Error banner
              </Button>
            </div>
          </Card>
        )}
      </div>
    </Sheet>
  );
}
