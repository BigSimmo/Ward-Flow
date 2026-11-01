"use client";

// The transport officer's job panel: the selected job's detail and its phone stage buttons. Split
// out of `officer-screen.tsx`; each helper is called during `OfficerScreen`'s render with the screen
// state it reads, passed as `OfficerJobDetailContext`.

import { CAD_TO_FOLLOW, cadNumberToFollow, providerNeedsCadNumber } from "@/components/ward-management/ward-cad-number";
import { TransportCadToFollow } from "@/components/ward-management/transport/transport-cad-to-follow";
import { Check, Lock } from "lucide-react";

import { Button, Icon, Select, StatusGlyph, TabPanel, Tabs, Timeline, type TimelineItem } from "@/components/wf";
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

import { FormsPack, PACK_SLOTS, packCount, packRequired } from "./officer-forms-pack";
import { HowWorkedOut } from "@/components/ward-management/capacity/capacity-how-worked-out";
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

export type OfficerDetailTab = "details" | "forms" | "activity";

/** The `OfficerScreen` state and handlers the job panel's helpers read, passed in on every render. */
export type OfficerJobDetailContext = {
  blockedNote: (movement: Movement) => string | undefined;
  destinationLabelFor: (movement: Movement) => string;
  /** Transport mock-up: the job panel's open tab, kept by the screen and reset per job. */
  detailTab: OfficerDetailTab;
  setDetailTab: (tab: OfficerDetailTab) => void;
  originShortFor: (movement: Movement) => string;
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
    detailTab,
    setDetailTab,
    originShortFor,
    diversionOpen,
    diversionPlace,
    diversionReason,
    identityChecked,
    identityFor,
    now,
    officerPatientName,
    originLabelFor,
    raise,
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
  const leg = officerLeg(transport);
  const legIndex = leg ? OFFICER_LEG_STEPS.indexOf(leg) : -1;
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

  // Transport mock-up (Josh, 1 Nov 2026): one panel at every width. Route and progress at the top,
  // then Details, Forms and Activity as tabs, and the one next step pinned in the foot.
  const roadRoute = referenceDistance(
    edById(movement.originEdId)?.referenceEdId,
    destinationUnit ? siteByCode(destinationUnit.siteCode)?.referenceSiteId : undefined,
  );
  const stepLabels = ["Accepted", "En route", "Collected", "Arrived"] as const;
  const stepTimes = [transport.acceptedAt, transport.enRouteAt, transport.collectedAt, transport.arrivedAt];
  const packOpen = packRequired(movement) ? PACK_SLOTS.length - packCount(movement) : 0;
  const tab = detailTab;
  const transportLoggedRecorded = transportLegalStatusLabel(transport) !== "Not recorded";

  return (
    <>
      <div className={styles.routeCard}>
        <span className={styles.routePin} aria-hidden="true" />
        <span className={styles.routeStop}>
          <b>{originShortFor(movement)}</b>
          <span>{originLabelFor(movement)}</span>
        </span>
        <span className={styles.routeStopTime}>
          {transport.collectedAt !== undefined
            ? `Left ${formatInstantWithDay(transport.collectedAt, now)}`
            : "Not collected"}
        </span>
        <span className={styles.routePin} data-to="" aria-hidden="true" />
        <span className={styles.routeStop}>
          <b>{destinationLabelFor(movement)}</b>
          <span>
            {transport.provider}
            {roadRoute ? ` · about ${roadRoute.min} min by road` : ""}
          </span>
        </span>
        <span className={styles.routeStopTime}>
          {eta !== undefined ? (
            <>
              <b>{formatInstantWithDay(eta, now)}</b> {transportEtaRemainingLabel(eta, now)}
            </>
          ) : (
            "No ETA yet"
          )}
        </span>
      </div>
      {/* As Capacity's road-time card (Josh's rebuild): the caveat folds to one line. */}
      {roadRoute ? (
        <HowWorkedOut label="Road time is an estimate">
          <p>{REFERENCE_DISTANCE_CAVEAT}</p>
        </HowWorkedOut>
      ) : null}

      <ol className={styles.progress} aria-label={`Progress, ${Math.max(0, legIndex)} of 4 done`}>
        {stepLabels.map((label, index) => {
          const done = legIndex >= index + 1;
          const current = index === legIndex;
          const at = stepTimes[index];
          return (
            <li key={label} className={styles.progressStep} data-state={done ? "done" : current ? "now" : undefined}>
              <span className={styles.progressDot} aria-hidden="true">
                {done ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : null}
              </span>
              {label}
              <small>{done && at !== undefined ? formatInstantWithDay(at, now) : current ? "next" : " "}</small>
            </li>
          );
        })}
      </ol>

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

      <Tabs
        label="Job details"
        idPrefix={`ward-officer-detail-${movement.id}`}
        className={styles.detailTabs}
        value={tab}
        onChange={setDetailTab}
        items={[
          { id: "details", label: "Details" },
          { id: "forms", label: "Forms", count: packOpen > 0 ? packOpen : undefined },
          { id: "activity", label: "Activity", count: activity.length > 0 ? activity.length : undefined },
        ]}
      />

      <TabPanel idPrefix={`ward-officer-detail-${movement.id}`} id="details" hidden={tab !== "details"}>
        <section className={styles.detailTab} aria-label="Booking">
          {packOpen > 0 ? (
            <button type="button" className={styles.formsLine} onClick={() => setDetailTab("forms")}>
              <StatusGlyph tone="warning" size={8} />
              <span>
                <b>
                  {packOpen} {packOpen === 1 ? "form" : "forms"} to upload
                </b>{" "}
                before collection
              </span>
              <span className={styles.formsLineGo}>View</span>
            </button>
          ) : null}
          <dl className={styles.factList}>
            <div>
              <dt>Provider</dt>
              <dd>{transport.provider}</dd>
            </div>
            <div data-testid={`ward-officer-cad-number-${movement.id}`}>
              <dt>CAD number</dt>
              <dd className={styles.glyphLine}>
                {cadNumberToFollow(transport) ? (
                  <span className={styles.detailTag} data-tone="warning">
                    <StatusGlyph tone="warning" size={8} />
                    {CAD_TO_FOLLOW}
                  </span>
                ) : (
                  <span className={styles.mono}>
                    {transport.cadNumber ??
                      (providerNeedsCadNumber(transport.provider) ? cadNumberLabel(transport) : "Not needed")}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt>Escort</dt>
              <dd>{transport.escortRequired ? "Required" : "Not required"}</dd>
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
            <div data-testid={`ward-officer-transport-legal-status-${movement.id}`}>
              <dt>Transport logged as</dt>
              <dd className={transportLoggedRecorded ? undefined : styles.factMuted}>
                {transportStatusClashes(movement, transport.transportLegalStatus) ? (
                  <StatusGlyph tone="warning" size={9} />
                ) : null}
                {transportLegalStatusLabel(transport)}
                {transportStatusClashes(movement, transport.transportLegalStatus)
                  ? `, Legal now ${legalNowText(movement)}`
                  : null}
              </dd>
            </div>
            <div data-testid={`ward-officer-estimated-at-${movement.id}`}>
              <dt>Estimated time</dt>
              <dd className={transport.estimatedAt === undefined ? styles.factMuted : undefined}>
                {transport.estimatedAt === undefined ? "Not recorded" : estimatedTimeLabel(transport, now)}
              </dd>
            </div>
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
            {movement.arrivalDetails ? (
              <div data-testid={`ward-officer-arrival-details-${movement.id}`}>
                <dt>Ward ETA</dt>
                <dd title={OPERATIONAL_DEFAULT_LABEL}>
                  {formatInstantWithDay(movement.arrivalDetails.estimatedArrivalAt, now)} AWST ·{" "}
                  {movement.arrivalDetails.mode} · late after{" "}
                  {formatInstantWithDay(movement.arrivalDetails.estimatedArrivalAt + LATE_ARRIVAL_GRACE_MINUTES, now)}
                </dd>
              </div>
            ) : null}
            {(transport.exceptions ?? []).map((exception) => (
              <div key={`${exception.step}-${exception.at}`} data-testid={`ward-officer-exception-${movement.id}`}>
                <dt>
                  {exception.step === "collected" ? "Collected" : "Booked"} {formatInstantWithDay(exception.at, now)}{" "}
                  with
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
      </TabPanel>

      <TabPanel idPrefix={`ward-officer-detail-${movement.id}`} id="forms" hidden={tab !== "forms"}>
        {packRequired(movement) ? (
          <FormsPack movement={movement} now={now} who={officerPatientName(movement)} />
        ) : (
          <section className={styles.section} aria-label="Forms">
            <span className={styles.muted}>None needed for a voluntary transfer.</span>
          </section>
        )}
      </TabPanel>

      <TabPanel idPrefix={`ward-officer-detail-${movement.id}`} id="activity" hidden={tab !== "activity"}>
        {activity.length > 0 ? (
          <Timeline items={activity} holdNew={false} label={`Activity for ${officerPatientName(movement)}`} />
        ) : (
          <span className={styles.muted}>Nothing recorded yet.</span>
        )}
      </TabPanel>
    </>
  );
}
