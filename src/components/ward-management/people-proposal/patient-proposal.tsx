"use client";

import { useMemo, useState } from "react";

import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { calendarDateOf, formatInstant, formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { MOVEMENT_STAGES } from "@/components/ward-management/ward-model";
import { movementTimeline } from "@/components/ward-management/ward-derivations";
import { isAwaitingAnswer, referralState } from "@/components/ward-management/ward-referrals";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import { patientAgeYears } from "@/components/ward-management/ward-patients";
import { OVERRIDE_REASONS, type OverrideReason } from "@/components/ward-management/ward-change-reasons";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import { stageCopy } from "@/components/ward-management/ward-stage-copy";
import { edById, edShortName, siteByCode } from "@/components/ward-management/ward-sites";
import { waitedHours } from "@/components/ward-management/search/search-filters";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

import { journeyFor, journeySentence, LONG_WAIT_HOURS } from "./people-proposal-figures";
import { Panel, PeopleProposalBar, ProposalHeader, plural } from "./people-proposal-parts";
import styles from "./people-proposal.module.css";

/** Proposed one-patient screen: who, where they are up to, the one next step, and what happened. */
export function PatientProposal({ id }: { id: string }) {
  const { movements, referrals, patients, units, dispatch, rejections, dayZero, admissions, bedReleases, leaveBeds } =
    useWardFlow();
  const now = useWardFlowClock();
  const [attemptFrom, setAttemptFrom] = useState<number | null>(null);
  const [numConsulted, setNumConsulted] = useState(false);
  const [overrideReason, setOverrideReason] = useState<OverrideReason | "">("");

  const { movement, patient, open } = useMemo(
    () => journeyFor(id, { movements, referrals, patients }),
    [id, movements, referrals, patients],
  );
  const currentHref = `/mockups/ward-flow/people/${id}`;

  if (!patient && !movement) {
    return (
      <div className={styles.screen}>
        <PeopleProposalBar active="patient" current={currentHref} />
        <main id="main-content" className={styles.page} data-testid="patient-proposal-missing">
          <ProposalHeader
            crumbs={[{ label: "Patients", href: "/mockups/ward-flow/search/proposal" }]}
            title="No patient with this record"
            asAt={`${formatInstant(now)} AWST`}
          />
          <p className={styles.note}>
            Ward Flow has no patient or journey with the id <span className={styles.num}>{id}</span>. It may have been
            typed wrongly. Search for the patient by record number instead.
          </p>
          <p>
            <a className={styles.primary} href="/mockups/ward-flow/search/proposal">
              Search patients
            </a>
          </p>
          <WardPrototypeFooter />
        </main>
      </div>
    );
  }

  const name = patient ? `${patient.givenName} ${patient.familyName}` : "Patient not linked to a record";
  const initials = patient ? `${patient.givenName[0] ?? ""}${patient.familyName[0] ?? ""}` : "?";
  const age = patient ? patientAgeYears(patient, calendarDateOf(now, dayZero)) : null;
  const ward = movement?.acceptedUnitId ? units.find((unit) => unit.id === movement.acceptedUnitId) : undefined;
  const wardReady = ward ? bedStates(ward, admissions, bedReleases, leaveBeds).ready : 0;
  const ed = movement ? edById(movement.originEdId) : undefined;
  const service = ed ? siteByCode(ed.siteCode)?.service : undefined;
  const stageIndex = movement ? MOVEMENT_STAGES.indexOf(movement.stage) : -1;
  const hours = movement
    ? movement.closure
      ? Math.max(0, (movement.closure.at - movement.openedAt) / 60)
      : waitedHours(movement, now)
    : 0;
  // The reducer appends refusals, so only entries after this attempt's starting count belong to it.
  const lastRejection =
    attemptFrom !== null && movement
      ? rejections
          .slice(attemptFrom)
          .filter((entry) => entry.movementId === movement.id && entry.attempted === "PULL_PATIENT")
          .at(-1)
      : undefined;
  // Only these refusals accept a recorded reason; the engine refuses every other one again.
  const acuityRefusal = lastRejection ? /nurse unit manager consulted/i.test(lastRejection.reason) : false;
  const overridable = lastRejection
    ? acuityRefusal || /specialling capacity|no locked bed is free/i.test(lastRejection.reason)
    : false;
  const queuedReferrals = referrals.filter(
    (referral) =>
      referralState(referral) === "queued" &&
      referral.destinations.some(isAwaitingAnswer) &&
      resolveSubjectPatient(referral, { patients, referrals, movements }).patient?.id === patient?.id,
  );

  const recordPanel = (
    <Panel title="Record">
      <dl className={styles.facts}>
        <dt>Community team</dt>
        <dd>{patient?.catchmentCommunityTeam ?? <span className={styles.mutedText}>Not recorded</span>}</dd>
        <dt>Interpreter</dt>
        <dd>{patient?.interpreterLanguage ?? <span className={styles.mutedText}>Not recorded</span>}</dd>
        <dt>Clinical note</dt>
        <dd>
          <span className={styles.mutedText}>Clinical details are on the full record.</span>
        </dd>
      </dl>
      <div className={styles.panelFoot}>
        <a className={styles.textLink} href={`${currentHref}?view=governed`}>
          Open the full record
        </a>
      </div>
    </Panel>
  );

  const identityLine = patient
    ? [
        `UMRN ${patient.umrn}`,
        patient.dateOfBirth ? `born ${patient.dateOfBirth}` : "date of birth not recorded",
        Number.isFinite(age) && age !== null && age >= 0 ? `${age} y` : "age not recorded",
        patient.sex ?? patient.gender ?? "sex not recorded",
        patient.preferredName ? `known as ${patient.preferredName}` : undefined,
      ]
        .filter(Boolean)
        .join(" · ")
    : "No patient record is linked to this journey.";

  return (
    <div className={styles.screen}>
      <PeopleProposalBar active="patient" current={currentHref} />
      <main id="main-content" className={styles.page} data-testid="patient-proposal">
        <ProposalHeader
          crumbs={[{ label: "Patients", href: "/mockups/ward-flow/search/proposal" }, { label: initials }]}
          title={
            <span className={styles.identity}>
              <span className={`${styles.avatar} ${styles.avatarLarge}`} aria-hidden="true">
                {initials}
              </span>
              <span>
                {name}
                <p className={styles.identityLine}>{identityLine}</p>
              </span>
            </span>
          }
          asAt={`${formatInstant(now)} AWST`}
        />

        {movement ? (
          <>
            <p className={styles.answer} data-testid="patient-proposal-answer">
              {journeySentence(movement, ward?.name)}
            </p>

            <section className={styles.panel} aria-label="Journey">
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}>Journey</h2>
                <span className={styles.panelMeta}>
                  {open ? `Step ${stageIndex + 1} of ${MOVEMENT_STAGES.length}` : "Closed"}
                </span>
              </div>
              <ol className={styles.stepper}>
                {MOVEMENT_STAGES.map((stage, index) => (
                  <li
                    key={stage}
                    className={`${styles.step} ${index < stageIndex ? styles.stepDone : ""} ${index === stageIndex ? styles.stepNow : ""}`}
                    aria-current={index === stageIndex ? "step" : undefined}
                  >
                    {stageCopy[stage].label}
                  </li>
                ))}
              </ol>
            </section>

            <div className={styles.splitWide}>
              <div className={styles.stack}>
                <Panel title="Next step">
                  <div className={styles.nextAction}>
                    {movement.stage === "accepted_awaiting_bed" && ward && open ? (
                      <>
                        <p>
                          Confirm the bed with {ward.name}, then pull the patient into it. {ward.name} has{" "}
                          <span className={styles.num}>{wardReady}</span> ready bed{wardReady === 1 ? "" : "s"} now.
                        </p>
                        <div>
                          <button
                            type="button"
                            className={styles.primary}
                            onClick={() => {
                              setAttemptFrom(rejections.length);
                              dispatch({
                                type: "PULL_PATIENT",
                                role: "coordinator",
                                now,
                                movementId: movement.id,
                                unitId: ward.id,
                              });
                            }}
                          >
                            Pull patient into bed at {ward.name}
                          </button>
                        </div>
                        {lastRejection ? (
                          <>
                            <p className={`${styles.note} ${styles.noteWarn}`} role="alert">
                              Not done: {lastRejection.reason}
                            </p>
                            {overridable ? (
                              <div className={styles.formFoot}>
                                <label className={styles.srOnly} htmlFor="patient-proposal-override">
                                  Reason for going ahead anyway
                                </label>
                                <select
                                  id="patient-proposal-override"
                                  className={styles.select}
                                  value={overrideReason}
                                  onChange={(event) => setOverrideReason(event.target.value as OverrideReason | "")}
                                >
                                  <option value="">Choose a reason to go ahead anyway</option>
                                  {OVERRIDE_REASONS.map((reason) => (
                                    <option key={reason} value={reason}>
                                      {reason}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  className={styles.textLink}
                                  disabled={!overrideReason}
                                  onClick={() => {
                                    if (!overrideReason) return;
                                    setAttemptFrom(rejections.length);
                                    dispatch({
                                      type: "PULL_PATIENT",
                                      role: "coordinator",
                                      now,
                                      movementId: movement.id,
                                      unitId: ward.id,
                                      overrideReason,
                                      ...(acuityRefusal && numConsulted ? { numConsulted: true as const } : {}),
                                    });
                                  }}
                                >
                                  Pull anyway with this reason
                                </button>
                                {acuityRefusal ? (
                                  <label className={styles.toggle}>
                                    <input
                                      type="checkbox"
                                      checked={numConsulted}
                                      onChange={(event) => setNumConsulted(event.target.checked)}
                                    />
                                    Nurse unit manager consulted
                                  </label>
                                ) : null}
                              </div>
                            ) : (
                              <p className={styles.mutedText}>
                                This refusal cannot be overridden here. Choose another ward on the current patient
                                screen.
                              </p>
                            )}
                          </>
                        ) : null}
                      </>
                    ) : (
                      <>
                        {open ? (
                          <p className={styles.mutedText}>
                            The controls for this step stay on the current patient screen in this preview.{" "}
                            <a className={styles.textLink} href={currentHref}>
                              Open coordination controls
                            </a>
                          </p>
                        ) : (
                          <p className={styles.mutedText}>Nothing more to do on this journey.</p>
                        )}
                      </>
                    )}
                  </div>
                </Panel>

                <Panel title="What has happened" meta={plural(movementTimeline(movement).length, "event")}>
                  <ol className={styles.timeline}>
                    {movementTimeline(movement).map((event, index) => (
                      <li key={`${event.at}-${index}`}>
                        <time>{formatInstantWithDay(event.at, now)}</time>
                        <span>{event.label}</span>
                      </li>
                    ))}
                  </ol>
                </Panel>
              </div>

              <div className={styles.stack}>
                <Panel title={open ? "Now" : "Summary"}>
                  <dl className={styles.facts}>
                    <dt>In</dt>
                    <dd>
                      {ed?.name ?? "Not recorded"}
                      <span className={styles.rowSub}>
                        {edShortName(ed)} · {service ?? "service not recorded"} · arrived{" "}
                        <span className={styles.num}>{formatInstantWithDay(movement.openedAt, now)}</span>
                      </span>
                    </dd>
                    <dt>{open ? "Waited" : "Journey took"}</dt>
                    <dd>
                      <span className={styles.num}>{hours.toFixed(1)} h</span>{" "}
                      {open && hours >= LONG_WAIT_HOURS ? (
                        <span className={styles.warnText}>Over {LONG_WAIT_HOURS} hours</span>
                      ) : null}
                    </dd>
                    <dt>Tier</dt>
                    <dd>
                      <span className={`${styles.tier} ${movement.urgency === 1 ? styles.tier1 : ""}`}>
                        Tier {movement.urgency}
                      </span>
                    </dd>
                    <dt>Legal status</dt>
                    <dd>
                      {movement.legalStatus}
                      {movement.legalForm ? (
                        <span className={styles.rowSub}>
                          {legalFormName(movement.legalForm)}
                          {movement.legalForm.dueAt !== undefined
                            ? ` · time written on the form ${formatInstantWithDay(movement.legalForm.dueAt, now)}`
                            : " · no time written on the form"}
                        </span>
                      ) : (
                        <span className={styles.rowSub}>No legal form recorded</span>
                      )}
                    </dd>
                    <dt>Ward</dt>
                    <dd>{ward ? ward.name : <span className={styles.mutedText}>No ward yet</span>}</dd>
                    <dt>Transport</dt>
                    <dd>
                      {movement.transport ? (
                        `${movement.transport.provider}${movement.transport.escortRequired ? " · escort required" : ""}`
                      ) : (
                        <span className={styles.mutedText}>Not booked</span>
                      )}
                    </dd>
                    <dt>Blocker</dt>
                    <dd>{movement.blocker || <span className={styles.mutedText}>None recorded</span>}</dd>
                  </dl>
                </Panel>

                {recordPanel}
              </div>
            </div>
          </>
        ) : (
          <>
            {queuedReferrals.length > 0 ? (
              <>
                <p className={styles.answer} data-testid="patient-proposal-referral">
                  Referred, awaiting a decision from{" "}
                  {plural(queuedReferrals[0].destinations.filter(isAwaitingAnswer).length, "ward")}. No bed-flow journey
                  is open yet.
                </p>
                <p className={styles.mutedText}>
                  <a className={styles.textLink} href="/mockups/ward-flow/referrals">
                    Open the referral board
                  </a>
                </p>
                <div className={styles.narrow}>{recordPanel}</div>
              </>
            ) : (
              <>
                <p className={styles.answer}>No bed-flow journey or referral is open for this patient.</p>
                <p className={styles.note}>
                  Their identity record is held in Ward Flow. A journey starts when an emergency department raises one.
                </p>
                <div className={styles.narrow}>{recordPanel}</div>
              </>
            )}
          </>
        )}
        <WardPrototypeFooter />
      </main>
    </div>
  );
}
