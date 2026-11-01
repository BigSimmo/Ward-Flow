"use client";

// The transport officer's job panel: the selected job's detail and its phone stage buttons. Split
// out of `officer-screen.tsx`; each helper is called during `OfficerScreen`'s render with the screen
// state it reads, passed as `OfficerJobDetailContext`.

import { CAD_TO_FOLLOW, cadNumberToFollow, providerNeedsCadNumber } from "@/components/ward-management/ward-cad-number";
import { TransportCadToFollow } from "@/components/ward-management/transport/transport-cad-to-follow";
import { Check, Lock } from "lucide-react";

import { Button, Icon, Select, StatusGlyph, Timeline, type TimelineItem } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { transportEtaRemainingLabel } from "@/components/ward-management/ward-board-time-features";
import { type Movement, type Unit } from "@/components/ward-management/ward-model";
import { uploadedFileLabel } from "@/components/ward-management/ward-uploaded-file";
import { edById, siteByCode } from "@/components/ward-management/ward-sites";
import {
  referenceDistance,
  REFERENCE_DISTANCE_CAVEAT,
} from "@/components/ward-management/reference/ward-reference-distances";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import {
  DIVERSION_REASONS,
  TRANSPORT_WHEREABOUTS,
  type DiversionReason,
  type TransportWhereabouts,
} from "@/components/ward-management/ward-change-reasons";

import {
  LATE_ARRIVAL_GRACE_MINUTES,
  OPERATIONAL_DEFAULT_LABEL,
} from "@/components/ward-management/ward-operational-defaults";

import { FormsPack, packRequired } from "./officer-forms-pack";
import styles from "./officer.module.css";
import {
  holdEndsBeforeEta,
  legalNowText,
  transportExceptionText,
  transportStatusClashes,
} from "@/components/ward-management/ward-transport-checks";
import {
  OFFICER_LEG_STEPS,
  acceptedBlockedReason,
  arrivedBlockedReason,
  cadNumberLabel,
  collectedBlockedReason,
  enRouteBlockedReason,
  estimatedTimeLabel,
  expectedArrival,
  formRequiredLabel,
  officerLeg,
  pastWardEta,
  transportLegalStatusLabel,
} from "./officer-screen-helpers";
import type { Dispatch, SetStateAction } from "react";
import type { WardRaise } from "@/components/ward-management/ward-flow-raise";
import { RISK_FLAG_LABELS } from "@/components/ward-management/referrals/referral-risk-flags";

/** The `OfficerScreen` state and handlers the job panel's helpers read, passed in on every render. */
export type OfficerJobDetailContext = {
  blockedNote: (movement: Movement) => string | undefined;
  destinationLabelFor: (movement: Movement) => string;
  diversionOpen: boolean;
  diversionPlace: TransportWhereabouts | undefined;
  diversionReason: DiversionReason | undefined;
  /** #236: whether the crew has tapped the identity check for this job, sent with Collected. */
  identityChecked: (movement: Movement) => boolean;
  /** The name, UMRN and date of birth the crew checks with the sending team. */
  identityFor: (movement: Movement) => { name: string; umrn: string; dob: string };
  isPhone: boolean;
  now: Instant;
  officerPatientName: (movement: Movement) => string;
  originLabelFor: (movement: Movement) => string;
  raise: WardRaise;
  resolvedPatientName: (movement: Movement) => string | undefined;
  runAccepted: (movement: Movement) => void;
  runCollected: (movement: Movement) => void;
  runDelivered: (movement: Movement) => void;
  runEnRoute: (movement: Movement) => void;
  setDiversionOpen: Dispatch<SetStateAction<boolean>>;
  setDiversionPlace: Dispatch<SetStateAction<TransportWhereabouts | undefined>>;
  setDiversionReason: Dispatch<SetStateAction<DiversionReason | undefined>>;
  showToast: (msg: string) => void;
  toggleIdentityChecked: (movement: Movement) => void;
  unitFor: (movement: Movement) => Unit | undefined;
};

/** v10 phone: the job sheet's four stage buttons, pinned to its foot; the next one is primary and
 * an unavailable one is greyed with its reason (build guide: "the four stage buttons pinned"). */
export function renderPhoneNextStep(movement: Movement, ctx: OfficerJobDetailContext) {
  const { blockedNote, resolvedPatientName, runAccepted, runCollected, runDelivered, runEnRoute, unitFor } = ctx;
  const transport = movement.transport;
  if (!transport || movement.closure) return null;
  const leg = officerLeg(transport);
  const index = leg ? OFFICER_LEG_STEPS.indexOf(leg) : -1;
  if (index < 0) return null;
  const patientName = resolvedPatientName(movement);
  const steps = [
    {
      label: "Accepted",
      testId: "ward-officer-accept",
      run: () => runAccepted(movement),
      blocked: () => acceptedBlockedReason(movement, patientName),
    },
    {
      label: "En route",
      testId: "ward-officer-enroute",
      run: () => runEnRoute(movement),
      blocked: () => enRouteBlockedReason(movement, patientName),
    },
    {
      label: "Collected",
      testId: "ward-officer-collect",
      run: () => runCollected(movement),
      blocked: () => collectedBlockedReason(movement, patientName),
    },
    {
      label: "Arrived at ward",
      testId: "ward-officer-arrive",
      run: () => runDelivered(movement),
      blocked: () => arrivedBlockedReason(movement, unitFor(movement), patientName),
    },
  ];
  // Device audit, 11 Oct 2026: one pinned primary for the next step, not four equal pills; the
  // Steps list above stays the record of what is done.
  const step = steps[index];
  if (!step) return null;
  const blocked = step.blocked();
  return (
    <div className={styles.phStageRow}>
      <Button
        variant="pri"
        size="lg"
        className={styles.phNextStep}
        data-testid={`${step.testId}-${movement.id}`}
        aria-disabled={blocked ? "true" : undefined}
        aria-describedby={blocked ? `${step.testId}-unavailable-${movement.id}` : undefined}
        title={blocked ?? undefined}
        onClick={blocked ? ignoreUnavailableActivation : step.run}
      >
        Mark {step.label.toLowerCase()}
      </Button>
      {/* Audit round 2, S-14: the reason is printed, since a touch user cannot see a title. */}
      {blocked ? (
        <p id={`${step.testId}-unavailable-${movement.id}`} className={styles.nextNote}>
          <Icon icon={Lock} size={14} />
          {blockedNote(movement) ?? blocked}
        </p>
      ) : null}
    </div>
  );
}

export function renderDetail(movement: Movement, ctx: OfficerJobDetailContext) {
  const {
    destinationLabelFor,
    diversionOpen,
    diversionPlace,
    diversionReason,
    identityChecked,
    identityFor,
    isPhone,
    now,
    officerPatientName,
    originLabelFor,
    raise,
    resolvedPatientName,
    runAccepted,
    runCollected,
    runDelivered,
    runEnRoute,
    setDiversionOpen,
    setDiversionPlace,
    setDiversionReason,
    showToast,
    toggleIdentityChecked,
    unitFor,
  } = ctx;
  const transport = movement.transport;
  if (!transport) return null;
  const destinationUnit = unitFor(movement);
  const patientName = resolvedPatientName(movement);
  const acceptedBlocked = acceptedBlockedReason(movement, patientName);
  const enRouteBlocked = enRouteBlockedReason(movement, patientName);
  const collectedBlocked = collectedBlockedReason(movement, patientName);
  const arrivedBlocked = arrivedBlockedReason(movement, destinationUnit, patientName);
  const leg = officerLeg(transport);
  const legIndex = leg ? OFFICER_LEG_STEPS.indexOf(leg) : -1;
  const nextBlocked =
    leg === "Requested"
      ? acceptedBlocked
      : leg === "Accepted"
        ? enRouteBlocked
        : leg === "En route"
          ? collectedBlocked
          : leg === "Collected"
            ? arrivedBlocked
            : undefined;
  const arrival = expectedArrival(movement);
  const eta = arrival?.at;
  const canDivert =
    !movement.closure &&
    transport.collectedAt !== undefined &&
    transport.arrivedAt === undefined &&
    transport.diversion === undefined;
  const diversionReady = diversionReason !== undefined && diversionPlace !== undefined;

  const activity: TimelineItem[] = [];
  if (transport.diversion) {
    activity.push({
      id: "diverted",
      at: "Diverted",
      tone: "warning",
      text: `Diverted, ${transport.diversion.reason.toLowerCase()}`,
    });
  }
  if (transport.collectedAt !== undefined) {
    activity.push({
      id: "collected",
      at: formatInstantWithDay(transport.collectedAt, now),
      tone: "success",
      text: `Collected from ${originLabelFor(movement)}`,
    });
  }
  if (transport.enRouteAt !== undefined) {
    activity.push({
      id: "en-route",
      at: formatInstantWithDay(transport.enRouteAt, now),
      tone: "info",
      text: "Crew en route",
    });
  }
  if (transport.acceptedAt !== undefined) {
    activity.push({
      id: "accepted",
      at: formatInstantWithDay(transport.acceptedAt, now),
      tone: "info",
      text: `Accepted by ${transport.provider}`,
    });
  }
  for (const form of [...(movement.uploadedForms ?? [])].reverse()) {
    activity.push({
      id: form.id,
      at: formatInstantWithDay(form.uploadedAt, now),
      tone: "success",
      text: `${form.formName} recorded (${uploadedFileLabel(form)})`,
    });
  }

  const step = (index: number, label: string, testId: string, blocked: string | undefined, onRun: () => void) => {
    // Action `index` moves the leg to OFFICER_LEG_STEPS[index + 1]; it is done once the leg is there.
    const done = legIndex >= index + 1;
    const isNext = index === legIndex;
    return (
      <Button
        variant={isNext && !blocked ? "pri" : "sec"}
        // Final round (31 Oct 2026): a done step (`actionDone`) has a solid quiet edge, plain surface
        // and green check, so only a step not open yet keeps the dashed unavailable edge.
        className={done ? `${styles.actionButton} ${styles.actionDone}` : styles.actionButton}
        data-testid={`${testId}-${movement.id}`}
        aria-disabled={blocked ? "true" : undefined}
        aria-describedby={blocked ? `${testId}-unavailable-${movement.id}` : undefined}
        title={blocked ?? undefined}
        icon={done ? Check : undefined}
        onClick={blocked ? ignoreUnavailableActivation : onRun}
      >
        {label}
      </Button>
    );
  };

  // v10 phone: the four facts as a 2x2 grid and the leg as a Steps list; the four stage buttons
  // are pinned to the sheet's foot (see the panel foot).
  const roadRoute = referenceDistance(
    edById(movement.originEdId)?.referenceEdId,
    destinationUnit ? siteByCode(destinationUnit.siteCode)?.referenceSiteId : undefined,
  );
  const stepLabels = ["Accepted", "En route", "Collected", "Arrived at ward"] as const;
  // Redesign: the booking facts the call did not record, named once on one line.
  const transportLoggedRecorded = transportLegalStatusLabel(transport) !== "Not recorded";
  // Final check (30 Oct 2026): each fact is named in full ("the transport's legal status"), not by
  // its field label, so the line reads as a sentence.
  const notRecorded = [
    transportLoggedRecorded ? null : "the transport's legal status",
    transport.estimatedAt === undefined ? "estimated time" : null,
  ].filter((fact): fact is string => fact !== null);
  const phoneTop = (
    <>
      <dl className={styles.phGrid}>
        <div>
          {/* A booking estimate is the transport provider's, not a time the ward recorded. */}
          <dt>{arrival?.booked ? "Transport ETA" : "Ward ETA"}</dt>
          <dd className={styles.mono}>{eta !== undefined ? formatInstantWithDay(eta, now) : "Not recorded"}</dd>
        </div>
        <div>
          <dt>By road</dt>
          <dd className={styles.mono}>{roadRoute ? `${roadRoute.min} min` : "Not recorded"}</dd>
        </div>
        <div>
          <dt>Provider</dt>
          <dd>{transport.provider}</dd>
        </div>
        <div>
          <dt>CAD</dt>
          <dd className={styles.mono}>
            {cadNumberToFollow(transport) ? (
              <>
                <StatusGlyph tone="warning" size={9} /> {CAD_TO_FOLLOW}
              </>
            ) : (
              (transport.cadNumber ?? (providerNeedsCadNumber(transport.provider) ? "Not recorded" : "Not needed"))
            )}
          </dd>
        </div>
      </dl>
      {roadRoute ? <p className={styles.muted}>{REFERENCE_DISTANCE_CAVEAT}</p> : null}
      <section className={styles.phCard} aria-label="Steps">
        <h3 className={styles.phCardHead}>
          Steps <span className={styles.mono}>{Math.max(0, legIndex)} of 4</span>
        </h3>
        <ol className={styles.phSteps}>
          {stepLabels.map((label, index) => {
            const done = legIndex >= index + 1;
            const current = index === legIndex;
            return (
              <li key={label} className={styles.phStep} data-state={done ? "done" : current ? "now" : undefined}>
                <StatusGlyph tone={done ? "success" : current ? "info" : "neutral"} size={10} />
                <span className={styles.phStepText}>
                  <span className={styles.phStepTitle}>{label}</span>
                </span>
                {done ? <span className={styles.phStepDone}>Done</span> : null}
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );

  return (
    <>
      {isPhone ? phoneTop : null}
      {isPhone ? null : (
        <div className={styles.route}>
          <div className={styles.routeLeg}>
            <StatusGlyph tone="neutral" size={9} />
            <span className={styles.routePlace}>{originLabelFor(movement)}</span>
            <span className={styles.routeTime}>
              {transport.collectedAt !== undefined ? `Left ${formatInstantWithDay(transport.collectedAt, now)}` : null}
            </span>
          </div>
          <div className={styles.routeLeg}>
            <StatusGlyph tone="info" size={9} />
            <span className={styles.routePlace}>{destinationLabelFor(movement)}</span>
            <span className={styles.routeTime}>
              {eta !== undefined ? (
                <>
                  {formatInstantWithDay(eta, now)} <span>{transportEtaRemainingLabel(eta, now)}</span>
                </>
              ) : (
                "No ETA recorded"
              )}
            </span>
          </div>
        </div>
      )}

      {isPhone ? null : (
        // Redesign (31 Oct 2026): two by two, so "Arrived at ward" is never cut to "Arrived at w…".
        <div className={styles.actionRow}>
          {step(0, "Accepted", "ward-officer-accept", acceptedBlocked, () => runAccepted(movement))}
          {step(1, "En route", "ward-officer-enroute", enRouteBlocked, () => runEnRoute(movement))}
          {step(2, "Collected", "ward-officer-collect", collectedBlocked, () => runCollected(movement))}
          {step(3, "Arrived at ward", "ward-officer-arrive", arrivedBlocked, () => runDelivered(movement))}
        </div>
      )}
      {nextBlocked && !isPhone ? (
        <p className={styles.nextNote}>
          <Icon icon={Lock} size={14} />
          {nextBlocked}
        </p>
      ) : null}
      {/* Audit round 2, A4-14: on phone only the pinned next step is a button, and it prints its
          own reason, so these reasons for done and future steps are desktop only. */}
      {acceptedBlocked && !isPhone ? (
        <span id={`ward-officer-accept-unavailable-${movement.id}`} className="sr-only">
          {acceptedBlocked}
        </span>
      ) : null}
      {enRouteBlocked && !isPhone ? (
        <span id={`ward-officer-enroute-unavailable-${movement.id}`} className="sr-only">
          {enRouteBlocked}
        </span>
      ) : null}
      {collectedBlocked && !isPhone ? (
        <span id={`ward-officer-collect-unavailable-${movement.id}`} className="sr-only">
          {collectedBlocked}
        </span>
      ) : null}
      {arrivedBlocked && !isPhone ? (
        <span id={`ward-officer-arrive-unavailable-${movement.id}`} className="sr-only">
          {arrivedBlocked}
        </span>
      ) : null}

      {/* #236 (Josh, 27 Oct 2026): one tap before Collected, with the facts to check. Never a gate. */}
      {leg === "En route" && !movement.closure
        ? (() => {
            const identity = identityFor(movement);
            const checked = identityChecked(movement);
            return (
              <section
                className={styles.section}
                aria-label="Identity at collection"
                data-testid={`ward-officer-identity-${movement.id}`}
              >
                <h3 className={styles.sectionTitle}>Identity at collection</h3>
                <p>
                  {identity.name} · {identity.umrn} · DOB {identity.dob}
                </p>
                <Button
                  size="sm"
                  variant={checked ? "pri" : "sec"}
                  icon={checked ? Check : undefined}
                  aria-pressed={checked}
                  data-testid={`ward-officer-identity-check-${movement.id}`}
                  onClick={() => toggleIdentityChecked(movement)}
                >
                  Identity checked with the sending team
                </Button>
              </section>
            );
          })()
        : null}

      {pastWardEta(movement, now) && movement.arrivalDetails ? (
        <div
          className={styles.overdue}
          role="alert"
          data-testid={`ward-officer-overdue-alert-${movement.id}`}
          title={OPERATIONAL_DEFAULT_LABEL}
        >
          <StatusGlyph tone="warning" size={9} />
          <span>
            <strong>Arrival overdue.</strong> More than {LATE_ARRIVAL_GRACE_MINUTES}m past the ward ETA (
            {formatInstantWithDay(movement.arrivalDetails.estimatedArrivalAt, now)} AWST).
          </span>
        </div>
      ) : null}

      {packRequired(movement) ? (
        <FormsPack movement={movement} now={now} who={officerPatientName(movement)} />
      ) : (
        <section className={styles.section} aria-label="Forms">
          <h3 className={styles.sectionTitle}>Forms</h3>
          <span className={styles.muted}>None needed for a voluntary transfer.</span>
        </section>
      )}

      <section className={styles.section} aria-label="Booking">
        <h3 className={styles.sectionTitle}>Booking</h3>
        {/* Redesign: facts the booking did not record share one line instead of a box each. */}
        {notRecorded.length > 0 ? (
          <p className={styles.notRecorded} data-testid={`ward-officer-not-recorded-${movement.id}`}>
            Not recorded: {notRecorded.join(" and ")}
          </p>
        ) : null}
        <dl className={styles.facts}>
          {isPhone ? null : (
            <>
              <div>
                <dt>Provider</dt>
                <dd>{transport.provider}</dd>
              </div>
              <div data-testid={`ward-officer-cad-number-${movement.id}`}>
                <dt>CAD (dispatch) number</dt>
                {/* Redesign: a gap between the glyph and its words. */}
                <dd className={styles.glyphLine}>
                  {cadNumberToFollow(transport) ? <StatusGlyph tone="warning" size={9} /> : null}
                  {cadNumberLabel(transport)}
                </dd>
              </div>
            </>
          )}
          {transportLoggedRecorded ? (
            <div data-testid={`ward-officer-transport-legal-status-${movement.id}`}>
              <dt>Transport logged as</dt>
              <dd>
                {transportStatusClashes(movement, transport.transportLegalStatus) ? (
                  <StatusGlyph tone="warning" size={9} />
                ) : null}
                {transportLegalStatusLabel(transport)}
                {transportStatusClashes(movement, transport.transportLegalStatus)
                  ? `, Legal now ${legalNowText(movement)}`
                  : null}
              </dd>
            </div>
          ) : null}
          <div>
            <dt>Escort required</dt>
            <dd>{transport.escortRequired ? "Yes" : "No"}</dd>
          </div>
          {/* D-80 item 7: the referral's risk categories. Shown only when the referrer recorded some. */}
          {movement.collectionRiskFlags?.length ? (
            <div data-testid={`ward-officer-risk-flags-${movement.id}`}>
              <dt>Risk flags</dt>
              <dd>{movement.collectionRiskFlags.map((flag) => RISK_FLAG_LABELS[flag]).join(", ")}</dd>
            </div>
          ) : null}
          <div>
            <dt>Form named at booking</dt>
            <dd>{formRequiredLabel(transport)}</dd>
          </div>
          {transport.estimatedAt !== undefined ? (
            <div data-testid={`ward-officer-estimated-at-${movement.id}`}>
              <dt>Estimated time</dt>
              <dd>{estimatedTimeLabel(transport, now)}</dd>
            </div>
          ) : null}
          {/* Audit A4-2: the officer sees when the bed hold ends, and whether the ETA is after it. */}
          {movement.pullExpiresAt !== undefined && transport.collectedAt === undefined ? (
            <div data-testid={`ward-officer-hold-ends-${movement.id}`}>
              <dt>Bed pulled until</dt>
              <dd>
                {holdEndsBeforeEta(movement, transport.estimatedAt) !== undefined ? (
                  <StatusGlyph tone="warning" size={9} />
                ) : null}
                {formatInstantWithDay(movement.pullExpiresAt, now)}
                {holdEndsBeforeEta(movement, transport.estimatedAt) !== undefined ? ", before the ETA" : null}
              </dd>
            </div>
          ) : null}
          {(transport.exceptions ?? []).map((exception) => (
            <div key={`${exception.step}-${exception.at}`} data-testid={`ward-officer-exception-${movement.id}`}>
              <dt>
                {exception.step === "collected" ? "Collected" : "Booked"} {formatInstantWithDay(exception.at, now)} with
              </dt>
              <dd>{transportExceptionText(exception)}</dd>
            </div>
          ))}
          {transport.identityChecked ? (
            <div data-testid={`ward-officer-identity-checked-${movement.id}`}>
              <dt>Identity checked</dt>
              <dd>With the sending team, {formatInstantWithDay(transport.identityChecked.at, now)}</dd>
            </div>
          ) : null}
        </dl>
        {/* CAD to follow (Josh, 27 Oct 2026): the officer often hears the number first. */}
        {cadNumberToFollow(transport) && !movement.closure ? (
          <TransportCadToFollow
            movementId={movement.id}
            role="officer"
            testId={`ward-officer-cad-to-follow-${movement.id}`}
          />
        ) : null}
      </section>

      {movement.arrivalDetails ? (
        <section className={styles.section} aria-label="Arrival plan">
          <h3 className={styles.sectionTitle}>Arrival plan</h3>
          <dl className={styles.planGrid} data-testid={`ward-officer-arrival-details-${movement.id}`}>
            <div>
              <dt>Ward ETA</dt>
              <dd>{formatInstantWithDay(movement.arrivalDetails.estimatedArrivalAt, now)} AWST</dd>
            </div>
            <div>
              <dt>Mode</dt>
              <dd>{movement.arrivalDetails.mode}</dd>
            </div>
            <div title={OPERATIONAL_DEFAULT_LABEL}>
              <dt>Late after</dt>
              <dd>
                {formatInstantWithDay(movement.arrivalDetails.estimatedArrivalAt + LATE_ARRIVAL_GRACE_MINUTES, now)}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      {transport.diversion ? (
        <p className={styles.diverted} data-testid={`ward-officer-diverted-${movement.id}`}>
          <StatusGlyph tone="warning" size={9} />
          Diverted — {transport.diversion.reason}. Where they are: {transport.diversion.place}.
        </p>
      ) : null}

      {canDivert && diversionOpen ? (
        <section className={styles.section} aria-label="Record a diversion">
          <h3 className={styles.sectionTitle}>Why divert</h3>
          <div className={styles.divertForm} data-testid={`ward-officer-diversion-${movement.id}`}>
            <label htmlFor={`ward-officer-diversion-reason-${movement.id}`}>Why was the journey diverted?</label>
            <Select
              id={`ward-officer-diversion-reason-${movement.id}`}
              data-testid={`ward-officer-diversion-reason-${movement.id}`}
              value={diversionReason ?? ""}
              onChange={(chosen) => {
                const value = chosen.target.value;
                setDiversionReason(
                  DIVERSION_REASONS.includes(value as DiversionReason) ? (value as DiversionReason) : undefined,
                );
              }}
            >
              <option value="">Choose a reason…</option>
              {DIVERSION_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </Select>
            <label htmlFor={`ward-officer-diversion-place-${movement.id}`}>Where is the patient now?</label>
            <Select
              id={`ward-officer-diversion-place-${movement.id}`}
              data-testid={`ward-officer-diversion-place-${movement.id}`}
              value={diversionPlace ?? ""}
              onChange={(chosen) => {
                const value = chosen.target.value;
                setDiversionPlace(
                  TRANSPORT_WHEREABOUTS.includes(value as TransportWhereabouts)
                    ? (value as TransportWhereabouts)
                    : undefined,
                );
              }}
            >
              <option value="">Choose a place…</option>
              {TRANSPORT_WHEREABOUTS.map((place) => (
                <option key={place} value={place}>
                  {place}
                </option>
              ))}
            </Select>
            <span className={styles.divertActions}>
              <Button variant="ghost" size="sm" onClick={() => setDiversionOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="pri"
                size="sm"
                data-testid={`ward-officer-record-diversion-${movement.id}`}
                aria-disabled={diversionReady ? undefined : "true"}
                aria-describedby={diversionReady ? undefined : `ward-officer-diversion-blocked-${movement.id}`}
                title={diversionReady ? undefined : "Choose a reason and where the patient is first."}
                onClick={
                  diversionReady
                    ? () => {
                        raise("RECORD_DIVERSION", {
                          movementId: movement.id,
                          reason: diversionReason,
                          place: diversionPlace,
                        });
                        setDiversionReason(undefined);
                        setDiversionPlace(undefined);
                        setDiversionOpen(false);
                        // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
                        showToast(`Diversion recorded for ${officerPatientName(movement)}.`);
                      }
                    : ignoreUnavailableActivation
                }
              >
                Record diversion
              </Button>
            </span>
            {diversionReady ? null : (
              <span id={`ward-officer-diversion-blocked-${movement.id}`} className="sr-only">
                Choose a reason and where the patient is first.
              </span>
            )}
          </div>
        </section>
      ) : null}

      {activity.length > 0 ? (
        <section className={styles.section} aria-label="Activity">
          <h3 className={styles.sectionTitle}>Activity</h3>
          <Timeline items={activity} holdNew={false} label={`Activity for ${officerPatientName(movement)}`} />
        </section>
      ) : null}
    </>
  );
}
