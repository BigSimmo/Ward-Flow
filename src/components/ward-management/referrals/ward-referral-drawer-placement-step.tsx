"use client";

import { FileText, Stethoscope, Truck, Users } from "lucide-react";
import { useState } from "react";
import {
  arrivalEtaLabel,
  arrivalModeLabel,
  canSetArrivalPlan,
  isArrivalLate,
} from "@/components/ward-management/referrals/arrival-time-modal";
import {
  LATE_ARRIVAL_GRACE_MINUTES,
  OPERATIONAL_DEFAULT_LABEL,
} from "@/components/ward-management/ward-operational-defaults";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";
import { waitlistStands } from "@/components/ward-management/ward-waitlist";
import styles from "./ward-referral-drawer.module.css";
import { communityTeamOptions } from "./referral-destination-options";
import { communityReferralPurposeLabel } from "@/components/ward-management/ward-referrals";
import { communityTeamsMatching } from "./community-short-form";
import { DocumentationPanel, documentationProblems } from "./referral-flow-panels";
import { chartsCountText } from "./referral-document-links";
import { ErrorSummary, StatusGlyph } from "@/components/wf";
import {
  CLEARANCE_CHECKS,
  CLEARANCE_CHECK_LABELS,
  CLEARANCE_STATUSES,
  CLEARANCE_STATUS_LABELS,
} from "./referral-submission";
import { Field, SelectBox, Choice, CardHead } from "./ward-referral-drawer-fields";
import type { WardReferralDrawerState } from "./use-ward-referral-drawer-state";
import {
  HOME_REGIONS,
  TRAVEL_MODES,
  type Cohort,
  type Referral,
  type Unit,
  type WardReferralDestination,
} from "@/components/ward-management/ward-model";
import { referralEligibility } from "@/components/ward-management/ward-eligibility";
import { isConfirmationFresh } from "@/components/ward-management/capacity/capacity-gap-words";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { wardReferralDestinations } from "./ward-referral-drawer-model";

/**
 * Audit 1 (CS-06, Josh 20 Oct): the engine's own referral check for one listed ward, in plain words,
 * so the list never says "Bed ready" for a ward that will refuse this person. `undefined` when no
 * suitability gate fails. The ready count says capacity, so it is not repeated here; a stale count
 * reads "Count out of date" so it never shows as a green "Bed ready". The probe is a question about a bed, never stored, as in
 * `referral-destination-options.ts`.
 */
export function wardRefusalWords(
  unit: Unit,
  ward: WardReferralDestination,
  ageBand: Cohort,
  now: Instant,
): string | undefined {
  const probe: Referral = {
    id: "drawer-ward-probe",
    destinations: [{ destination: ward, state: "queued" }],
    ageBand,
    homeRegion: HOME_REGIONS[0],
    suburb: { kind: "named", name: "Armadale" },
    source: "community",
    raisedAt: now,
    urgency: 2,
    originSiteCode: "",
    transportNeeded: false,
    history: "",
  };
  const failed = referralEligibility(probe, ward, unit, now).gates.find((gate) => !gate.pass);
  const designation = unit.sexDesignation === "Female only" ? "Female-only ward" : "Male-only ward";
  switch (failed?.gate) {
    case "age":
      return `${unit.cohort} ward`;
    case "legal_status":
      return "Not set up for involuntary admissions";
    case "gender_designation":
      return ward.gender === "Female" || ward.gender === "Male"
        ? designation
        : `${designation}; gender not recorded as female or male`;
    case "forensic":
      return "Forensic ward, not offered";
    case "security":
      return "No locked bed free";
    case "sex_mix":
      return "No same-sex patients and only one bed ready";
    // Codex review of #504: a stale count is not "Bed ready". The confirmed time beside it says when.
    case "capacity_freshness":
      return "Count out of date";
    default:
      return undefined;
  }
}

/** CS-10: when the ward last confirmed its count, by the Capacity screen's freshness rule. */
function confirmedWords(unit: Unit, now: Instant): string {
  const at = formatInstantWithDay(unit.allocatable.confirmedAt, now);
  return isConfirmationFresh(unit, now) ? `confirmed ${at}` : `not confirmed since ${at}`;
}

/** Step 3, Clearance or Documents: the ward clearance checklist and the documentation panel. */
export function ReferralDocumentationStep({ s }: { s: WardReferralDrawerState }) {
  const {
    activePatientKey,
    sectionId,
    previewOpen,
    confirmationOpen,
    documentation,
    setDocumentation,
    activeSection,
    destType,
    clearanceChecks,
    setClearanceChecks,
    checksDone,
    attempted,
  } = s;
  const problems = attempted.documentation ? documentationProblems(documentation, `${sectionId}-docs`) : [];
  return (
    <div
      id={`${sectionId}-documentation`}
      className={styles.sectionPanel}
      hidden={previewOpen || confirmationOpen || activeSection !== "documentation"}
    >
      <ErrorSummary items={problems} action="before the next step" />
      {destType === "ward" && (
        <section className={styles.refCard} data-testid="ward-referral-clearance-checklist">
          <CardHead icon={Stethoscope} title="Medical clearance checklist">
            <span className={styles.chip}>
              {/* A2-9: recorded for the letter, not counted in the items left. */}
              Optional · <span className={styles.mono}>{checksDone ?? 0}</span> of {CLEARANCE_CHECKS.length} done
            </span>
          </CardHead>
          <div className={styles.cardBody} data-tight="true">
            <div className={styles.checkList}>
              {CLEARANCE_CHECKS.map((check) => (
                <Choice
                  key={check}
                  legend={CLEARANCE_CHECK_LABELS[check]}
                  name={`${sectionId}-clearance-${check}`}
                  options={CLEARANCE_STATUSES}
                  labels={CLEARANCE_STATUS_LABELS}
                  value={clearanceChecks[check]}
                  onChange={(status) => setClearanceChecks((c) => ({ ...c, [check]: status }))}
                />
              ))}
            </div>
          </div>
        </section>
      )}
      <DocumentationPanel
        key={activePatientKey}
        draft={documentation}
        onChange={setDocumentation}
        idBase={`${sectionId}-docs`}
      />
    </div>
  );
}

/** D-77 mock-up: the team list opens on this many rows, with Show all and a search for the rest. */
const COMMUNITY_TEAMS_SHOWN = 6;

/** Step 4, Wards, Teams or EDs: the places to refer to, the summary and the arrival plan. */
export function ReferralPlacementStep({ s }: { s: WardReferralDrawerState }) {
  const {
    movements,
    referrals,
    configuration,
    now,
    sectionId,
    selectedUnitIds,
    setSelectedUnitIds,
    selectedRecipient,
    setSelectedRecipient,
    communityPurpose,
    communityNeeds,
    previewOpen,
    confirmationOpen,
    setFlowError,
    setArrivalPlanOpen,
    liveMovement,
    effectiveCohort,
    documentation,
    catchmentTeam,
    catchmentService,
    catchmentConfirmed,
    activeSection,
    arrivalEta,
    setArrivalEta,
    destType,
    security,
    transport,
    setTransport,
    transitNote,
    setTransitNote,
    currentPatient,
    realTimeMatch,
    selectedDestinations,
    recipientLabels,
    clearance,
    units,
    referralSex,
    referralGender,
    legalStatus,
    highAcuity,
    attempted,
  } = s;
  // The person's own needs, as the send will carry them, for the engine's check on each ward.
  const [needs] = wardReferralDestinations([""], {
    sex: referralSex,
    gender: referralGender,
    security,
    legalStatus,
    highAcuity,
  });
  const [teamSearch, setTeamSearch] = useState("");
  const [allTeams, setAllTeams] = useState(false);
  const community = destType === "community";
  const teams = community
    ? Array.from(new Set([catchmentTeam, ...communityTeamOptions()].filter(Boolean))).sort(
        (a, b) => Number(b === catchmentTeam) - Number(a === catchmentTeam) || a.localeCompare(b),
      )
    : [];
  const matchingTeams = communityTeamsMatching(teams, teamSearch);
  const teamsCut = !allTeams && !teamSearch.trim() && matchingTeams.length > COMMUNITY_TEAMS_SHOWN;
  const shownTeams = teamsCut
    ? [
        ...matchingTeams.slice(0, COMMUNITY_TEAMS_SHOWN),
        ...(matchingTeams.indexOf(selectedRecipient) >= COMMUNITY_TEAMS_SHOWN ? [selectedRecipient] : []),
      ]
    : matchingTeams;
  return (
    <div
      id={`${sectionId}-placement`}
      className={styles.sectionPanel}
      hidden={previewOpen || confirmationOpen || activeSection !== "placement"}
    >
      <ErrorSummary
        items={
          attempted.placement && !selectedDestinations.length
            ? [
                {
                  id: `${sectionId}-destination`,
                  text: community ? "Choose the community team" : "Select at least one referral location",
                },
              ]
            : []
        }
        action="before sending"
      />
      {destType === "ward" ? (
        <section className={styles.refCard}>
          <CardHead icon={Users} title="Wards to refer">
            <span className={styles.asideText}>Up to {configuration.parallelReferralCap}</span>
            <span className={styles.chip}>
              <span className={styles.mono}>{selectedUnitIds.length}</span> selected
            </span>
          </CardHead>
          <div className={styles.cardBody} data-tight="true">
            <div className={styles.legendRow}>
              <span>
                <StatusGlyph tone="success" size={9} />
                <strong className={styles.mono}>{realTimeMatch.readyBedsCount}</strong> ready
              </span>
              <span>
                <StatusGlyph tone="info" size={9} />
                <strong className={styles.mono}>{realTimeMatch.pulledBedsCount}</strong> pulled
              </span>
              {/* Audit round 2 (A2-8): no closed total. No listed ward shows a closed bed,
                              so the figure matched nothing on the step. */}
              <span className={styles.legendAside}>
                {effectiveCohort || currentPatient.cohort} · {security.toLowerCase()} ·{" "}
                {realTimeMatch.sortedUnits.length} {realTimeMatch.sortedUnits.length === 1 ? "ward" : "wards"}
              </span>
            </div>
            {/*
                        Its OWN line, never appended to the figures above: "Ready 2" immediately followed by
                        "1 still being made ready" reads as 21. Renders only when there is one.
                      */}
            {realTimeMatch.pendingPreparationCount > 0 ? (
              <p className={styles.beingMadeReady} data-testid="referral-drawer-pending-preparation">
                <StatusGlyph tone="neutral" size={9} />
                <strong className={styles.mono}>{realTimeMatch.pendingPreparationCount}</strong> of them still being
                made ready, offered and counted
              </p>
            ) : null}
          </div>
          <div className={styles.wardTable}>
            <div className={styles.wardTableHead} aria-hidden="true">
              <span>Ward</span>
              <span>Ready</span>
              <span>Waitlist</span>
            </div>
            <div role="list" aria-label="Placement Destination Options">
              {realTimeMatch.sortedUnits.map((unit, index) => {
                const selected = selectedUnitIds.includes(unit.unitId);
                const model = units.find((candidate) => candidate.id === unit.unitId);
                const cohort = effectiveCohort || undefined;
                const refusal =
                  model && needs && cohort
                    ? wardRefusalWords(model, { ...needs, unitId: model.id }, cohort, now)
                    : undefined;
                const inCatchment =
                  catchmentConfirmed && catchmentService ? unit.healthService === catchmentService : null;
                const waiting =
                  referrals.filter((referral) =>
                    referral.destinations.some(
                      (arm) =>
                        arm.destination.kind === "psychiatric_ward" &&
                        arm.destination.unitId === unit.unitId &&
                        arm.state === "queued" &&
                        arm.waitlistedAt !== undefined &&
                        arm.withdrawnAt === undefined,
                    ),
                  ).length +
                  movements.filter((movement) => !movement.closure && waitlistStands(movement, unit.unitId)).length;
                return (
                  <label
                    key={unit.unitId}
                    role="listitem"
                    className={styles.wardRow}
                    data-catchment={inCatchment === null ? "unknown" : inCatchment ? "in" : "out"}
                    data-selected={selected}
                  >
                    <input
                      id={index === 0 ? `${sectionId}-destination` : undefined}
                      type="checkbox"
                      checked={selected}
                      onChange={() => {
                        if (!selected && selectedUnitIds.length >= configuration.parallelReferralCap) {
                          setFlowError(`Choose up to ${configuration.parallelReferralCap} referral locations.`);
                          return;
                        }
                        setSelectedUnitIds((ids) =>
                          selected ? ids.filter((id) => id !== unit.unitId) : [...ids, unit.unitId],
                        );
                        setFlowError(null);
                      }}
                    />
                    <span className={styles.wardIdentity}>
                      <span className={styles.wardTitle}>
                        <strong>{unit.name}</strong> <span className={styles.wardHospital}>{unit.hospital}</span>
                      </span>
                      <span className={styles.wardMeta}>
                        {/* Audit 1 (CS-06, Josh 20 Oct): green only when the engine's own check passes;
                                        a refusal is said in words, and the ward stays listed. */}
                        <span className={styles.fit} data-fit={unit.readyBeds > 0 && !refusal ? "bed" : "none"}>
                          <StatusGlyph tone={unit.readyBeds > 0 && !refusal ? "success" : "warning"} size={9} />
                          {refusal ?? (unit.readyBeds > 0 ? "Bed ready" : "No bed now")}
                        </span>
                        {/* CS-10: the count's age, by the Capacity screen's freshness rule. */}
                        {model ? ` · ${confirmedWords(model, now)}` : null}
                        {/* Audit round 2 (A2-7): once the catchment is confirmed this never
                                        says "not confirmed". With no service area given there is no
                                        match to show, so the part is left out. */}
                        {inCatchment !== null
                          ? ` · ${inCatchment ? "In catchment" : "Outside catchment"}`
                          : catchmentConfirmed
                            ? null
                            : " · Catchment not confirmed"}
                        <span className={styles.wardMetaMore}>
                          {unit.healthService ? ` · ${unit.healthService}` : ""}
                          {/* Walk-through WT-27: the site code only, never the internal ward id. */}
                          {unit.siteCode ? (
                            <>
                              {" · "}
                              <span className={styles.mono}>{unit.siteCode}</span>
                            </>
                          ) : null}
                        </span>
                      </span>
                    </span>
                    <span className={styles.wardFigure}>
                      <strong className={styles.mono}>{unit.readyBeds}</strong>
                      {/* Audit round 2 (A2-8): the phone card has no column head either. */}
                      <small className={styles.wardFigureName}>ready</small>
                      {(unit.pendingPreparation ?? 0) > 0 ? (
                        <small>{unit.pendingPreparation} prep</small>
                      ) : unit.pulledBeds > 0 ? (
                        <small>{unit.pulledBeds} pulled</small>
                      ) : null}
                    </span>
                    <span className={styles.wardFigure}>
                      <strong className={styles.mono}>{waiting}</strong>
                      {/* v10 phone: the card has no column head, so the figure names itself. */}
                      <small className={styles.wardFigureName}>waitlist</small>
                    </span>
                  </label>
                );
              })}
            </div>
            {!realTimeMatch.sortedUnits.length && (
              <p className={styles.bodyMeta}>No wards match this cohort and bed security.</p>
            )}
          </div>
        </section>
      ) : (
        <section className={styles.refCard}>
          <CardHead icon={Users} title={destType === "community" ? "Community team" : "Emergency department"}>
            <span className={styles.asideText}>Choose one</span>
            <span className={styles.chip}>
              <span className={styles.mono}>{selectedRecipient ? 1 : 0}</span> selected
            </span>
          </CardHead>
          <div className={styles.cardBody} data-tight="true">
            <p className={styles.bodyMeta}>
              <StatusGlyph tone="info" size={8} />
              {destType === "community"
                ? "Community referrals request no bed"
                : "Goes to psychiatry, observation beds not recorded"}
            </p>
          </div>
          {community ? (
            <div className={styles.cardBody} data-tight="true">
              <input
                type="search"
                className={styles.fieldInput}
                placeholder="Search teams or suburbs"
                aria-label="Search community teams"
                autoComplete="off"
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
              />
            </div>
          ) : null}
          <div
            role="radiogroup"
            aria-label={destType === "community" ? "Community team to refer to" : "Emergency department to refer to"}
          >
            {(community
              ? shownTeams.map((team) => ({ value: team, name: team, inCatchment: team === catchmentTeam }))
              : allEmergencyDepartments().map((ed) => ({
                  value: ed.id,
                  name: ed.name,
                  inCatchment: null,
                  inEd: movements.filter(
                    (movement) => movement.originEdId === ed.id && !movement.closure && movement.stage !== "arrived",
                  ).length,
                }))
            ).map((option, index) => (
              <label
                key={option.value}
                className={styles.wardRow}
                data-variant="radio"
                data-selected={selectedRecipient === option.value}
              >
                <input
                  id={index === 0 ? `${sectionId}-destination` : undefined}
                  type="radio"
                  name={`${sectionId}-recipient`}
                  value={option.value}
                  checked={selectedRecipient === option.value}
                  onChange={() => {
                    setSelectedRecipient(option.value);
                    setFlowError(null);
                  }}
                />
                <span className={styles.wardIdentity}>
                  <span className={styles.wardTitle}>
                    <strong>{option.name}</strong>
                  </span>
                  <span className={styles.wardMeta}>
                    {destType === "community"
                      ? "Community team · no bed requested"
                      : "Emergency department · psychiatry"}
                  </span>
                </span>
                {"inEd" in option ? (
                  <span className={styles.rowAside}>
                    <strong className={styles.mono}>{option.inEd}</strong> in ED
                  </span>
                ) : null}
                {option.inCatchment === null ? null : (
                  <span className={styles.rowAside}>
                    {option.inCatchment ? (
                      <>
                        <StatusGlyph tone="success" size={9} /> In catchment
                      </>
                    ) : (
                      "Outside catchment"
                    )}
                  </span>
                )}
              </label>
            ))}
          </div>
          {community && (teamsCut || !matchingTeams.length) ? (
            <div className={styles.cardBody}>
              {matchingTeams.length ? (
                <button type="button" className={styles.textLink} onClick={() => setAllTeams(true)}>
                  Show all {matchingTeams.length} teams
                </button>
              ) : (
                <p className={styles.bodyMeta}>No team or suburb matches the search.</p>
              )}
            </div>
          ) : null}
        </section>
      )}

      <section className={styles.refCard}>
        <CardHead icon={FileText} title="Referral summary" />
        <div className={styles.cardBody}>
          <dl className={styles.factGrid}>
            <div>
              <dt>Patient</dt>
              <dd>{currentPatient.name}</dd>
            </div>
            <div>
              <dt>Catchment</dt>
              <dd>{catchmentConfirmed ? catchmentTeam : "Needs confirming"}</dd>
            </div>
            {community ? (
              <>
                <div>
                  <dt>Purpose</dt>
                  <dd>{communityPurpose ? communityReferralPurposeLabel(communityPurpose) : "Not chosen"}</dd>
                </div>
                <div>
                  <dt>First contact</dt>
                  <dd>{communityNeeds.firstContact ? `Within ${communityNeeds.firstContact}` : "Not chosen"}</dd>
                </div>
              </>
            ) : (
              <>
                <div>
                  <dt>Documents</dt>
                  <dd>{chartsCountText(documentation.charts.length, documentation.toFollow?.length ?? 0)}</dd>
                </div>
                <div>
                  <dt>Clearance</dt>
                  <dd>{clearance.label}</dd>
                </div>
              </>
            )}
          </dl>
          {recipientLabels.length ? (
            <ul className={styles.tickList}>
              {recipientLabels.map((label) => (
                <li key={label}>
                  <StatusGlyph tone="success" size={10} />
                  {label}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>
      {destType === "ward" && selectedDestinations.length > 0 && (
        <section className={styles.refCard}>
          <CardHead icon={Truck} title="Arrival plan">
            <span className={styles.chip}>Proposed</span>
          </CardHead>
          <div className={styles.cardBody}>
            <div className={styles.fieldGrid} data-layout="three">
              <Field label="Transport" htmlFor={`${sectionId}-refTransportSelect`}>
                <SelectBox>
                  <select
                    className={styles.fieldSelect}
                    id={`${sectionId}-refTransportSelect`}
                    value={transport}
                    onChange={(e) => setTransport(e.target.value)}
                  >
                    {/* WT-13: opens blank; nothing is chosen for the person. */}
                    <option value="">Not chosen</option>
                    {TRAVEL_MODES.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </select>
                </SelectBox>
              </Field>
              <Field label="Arrival, AWST" htmlFor={`${sectionId}-eta`}>
                <input
                  id={`${sectionId}-eta`}
                  type="datetime-local"
                  className={styles.fieldInput}
                  value={arrivalEta}
                  onChange={(e) => setArrivalEta(e.target.value)}
                />
              </Field>
              <Field label="Dispatch ref" htmlFor={`${sectionId}-refTransitInput`}>
                <input
                  type="text"
                  className={styles.fieldInput}
                  id={`${sectionId}-refTransitInput`}
                  placeholder="Dispatch or staging bay"
                  value={transitNote}
                  onChange={(e) => setTransitNote(e.target.value)}
                  data-gramm="false"
                  data-enable-grammarly="false"
                  spellCheck={false}
                  autoComplete="off"
                />
              </Field>
            </div>
            {liveMovement && canSetArrivalPlan(liveMovement) ? (
              <div className={styles.suggestion} data-testid="ward-referral-arrival-plan-card">
                <StatusGlyph tone="info" size={9} />
                <span className={styles.suggestionText}>
                  {liveMovement.arrivalDetails ? (
                    <>
                      <strong>
                        Current journey, ETA {arrivalEtaLabel(liveMovement.arrivalDetails.estimatedArrivalAt, now)}
                      </strong>
                      <small>
                        {arrivalModeLabel(liveMovement.arrivalDetails.mode)}
                        {liveMovement.arrivalDetails.trackingNumber
                          ? ` · ${liveMovement.arrivalDetails.trackingNumber}`
                          : ""}
                      </small>
                    </>
                  ) : (
                    <>
                      <strong>No arrival plan recorded</strong>
                      <small>Setting one records the mode and ward time, and clears the pull clock</small>
                    </>
                  )}
                  {isArrivalLate(liveMovement, now) ? (
                    <small
                      className={styles.lateNote}
                      role="status"
                      data-testid="ward-referral-arrival-late"
                      title={OPERATIONAL_DEFAULT_LABEL}
                    >
                      <StatusGlyph tone="warning" size={9} />
                      Late, more than {LATE_ARRIVAL_GRACE_MINUTES}m past the ward time. Not marked arrived.
                    </small>
                  ) : null}
                </span>
                <button
                  type="button"
                  className={styles.btn}
                  data-testid="ward-referral-arrival-plan-toggle"
                  onClick={() => setArrivalPlanOpen(true)}
                >
                  {liveMovement.arrivalDetails ? "Edit arrival plan" : "Set arrival plan"}
                </button>
              </div>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}
