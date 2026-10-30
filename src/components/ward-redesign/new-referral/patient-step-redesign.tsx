"use client";

import { useContext, useEffect, useState } from "react";
import { CheckCircle2, MapPin, Search, User, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { LegalLimitsNotChecked } from "@/components/ward-management/legal-limits-not-checked";
import {
  COHORTS,
  HEALTH_SERVICES,
  HOME_REGIONS,
  type HomeRegion,
  type Cohort,
  type HealthService,
} from "@/components/ward-management/ward-model";
import { GENDERS, type Gender } from "@/components/ward-management/ward-patients";
import { RECORDED_SEXES, type RecordedSex } from "@/components/ward-management/ward-model-vocabulary";
import {
  NOT_ON_SENDING_WARD_REASONS,
  type NotOnSendingWardReason,
} from "@/components/ward-management/ward-change-reasons";
import styles from "@/components/ward-management/referrals/ward-referral-drawer.module.css";
import { cx } from "@/components/wf";
import redesign from "./new-referral-redesign.module.css";
import { catchmentRoutingDestinations, lookupCatchment } from "@/components/ward-management/ward-catchment";
import {
  communityTeamOptions,
  suburbOptions,
} from "@/components/ward-management/referrals/referral-destination-options";
import { ErrorSummary, StatusGlyph, type ErrorSummaryItem } from "@/components/wf";
import { revealWardOption } from "@/components/ward-management/ward-scroll";
import { ReadmissionFlag } from "@/components/ward-management/ward-readmission-flag";
import {
  ageSexLabel,
  RISK_FLAG_LABELS,
  formatDob,
} from "@/components/ward-management/referrals/ward-referral-drawer-model";
import { Field, SelectBox, CardHead } from "@/components/ward-management/referrals/ward-referral-drawer-fields";
import type { WardReferralDrawerState } from "@/components/ward-management/referrals/use-ward-referral-drawer-state";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import { siteDirectory } from "@/components/ward-management/ward-sites";
import { SharedSessionContext } from "@/components/ward-management/shell/ward-shared-session-context";

/** Step 1, Patient: find or add the person, the priority grid and the catchment card. */
/** Preview only: a fork of `ReferralPatientStep` with the calmer Catchment card. */
export function ReferralPatientStepRedesign({
  s,
  alreadyOpen,
  alreadyOpenHref,
}: {
  s: WardReferralDrawerState;
  alreadyOpen: string | undefined;
  alreadyOpenHref: string | undefined;
}) {
  const {
    onClose,
    searchId,
    searchInputRef,
    addPatientGate,
    fromEntryPoint,
    activePatientKey,
    searchQuery,
    setSearchQuery,
    isSearchOpen,
    setIsSearchOpen,
    noPatientChosen,
    sectionId,
    ageBand,
    setAgeBand,
    ageBandNote,
    previewOpen,
    setGuardOpen,
    newPatientOpen,
    setNewPatientOpen,
    newPatient,
    setNewPatient,
    newPatientError,
    setNewPatientError,
    confirmationOpen,
    setFlowError,
    isPhone,
    liveMovement,
    patientRecord,
    effectiveCohort,
    isMedicalCleared,
    catchmentSuburb,
    setCatchmentSuburb,
    catchmentTeam,
    setCatchmentTeam,
    catchmentService,
    setCatchmentService,
    catchmentConfirmed,
    setCatchmentConfirmed,
    catchmentNotKnown,
    setCatchmentNotKnown,
    catchmentEditing,
    setCatchmentEditing,
    homeRegion,
    setHomeRegion,
    activeSection,
    setActiveSection,
    unidentified,
    setUnidentified,
    destType,
    security,
    provisionalDiag,
    dirty,
    currentPatient,
    handleSelectPatient,
    filteredPatients,
    addNewPatient,
    realTimeMatch,
    tierLabel,
    recordedFlags,
    clearance,
    patientShowErrors,
    suburbKnown,
    readmissionFlag,
    sendingWard,
    notOnSendingWard,
    notOnWardReason,
    setNotOnWardReason,
    heldBedWardName,
    openJourney,
    originSiteCode,
    setOriginSiteCode,
    setSourceKind,
  } = s;
  // WS-08 (H-0973): this person already has an open ED journey that starts somewhere else.
  const journeyElsewhere = openJourney && openJourney.siteCode !== originSiteCode ? openJourney : undefined;
  const originName = siteDirectory.find((site) => site.code === originSiteCode)?.emergencyDepartment?.name;
  const someoneChosen = !!patientRecord || unidentified !== null;
  // H-0731: choosing a person to refer opens their record, which shows its recorded address. In the
  // signed-in shared workspace the server logs that opening and only then sends the address. Logged
  // as the patient record: a first referral has no referral or journey for the server to match yet.
  // A missing address is "not recorded" only once the server has sent this record's detail.
  const session = useContext(SharedSessionContext);
  const chosenId = patientRecord?.id;
  const [addressReply, setAddressReply] = useState<{ id: string; sent: boolean }>();
  useEffect(() => {
    if (!chosenId || !session) return;
    let current = true;
    void Promise.resolve(session.logRecordView(chosenId, "patient"))
      .then((sent) => sent === true)
      .catch(() => false)
      .then((sent) => {
        if (current) setAddressReply({ id: chosenId, sent });
      });
    return () => {
      current = false;
    };
  }, [session, chosenId]);
  const addressReplied = addressReply?.id === chosenId ? addressReply : undefined;
  const addressUnknown = !!session && !!chosenId && !addressReplied?.sent;
  // Audit A-4: the search keeps the typeahead's keys (search/patient-typeahead.tsx). Nothing is
  // highlighted until an Arrow key moves there, and a new list starts with nothing highlighted.
  const [highlight, setHighlight] = useState(-1);
  const resultsKey = filteredPatients.map((p) => p.id).join("|");
  const [seenResultsKey, setSeenResultsKey] = useState(resultsKey);
  if (resultsKey !== seenResultsKey) {
    setSeenResultsKey(resultsKey);
    setHighlight(-1);
  }
  // Change patient opens the full list before anything is typed; "No patient matches" needs a search.
  const searching = isSearchOpen && searchQuery.trim().length > 0;
  const showResults = isSearchOpen && filteredPatients.length > 0;
  const resultsId = `${searchId}-results`;
  useEffect(() => {
    if (showResults && highlight >= 0) revealWardOption(document.getElementById(`${searchId}-opt-${highlight}`));
  }, [highlight, showResults, searchId]);
  // The step's faults in field order, worded as the fields word them, for the error summary.
  const problems: ErrorSummaryItem[] = patientShowErrors
    ? [
        ...(!someoneChosen
          ? [{ id: searchId, text: "Find a patient, add a new patient, or choose Not yet identified" }]
          : []),
        ...(!patientRecord && unidentified !== null && !unidentified.trim()
          ? [{ id: `${sectionId}-unidentified`, text: "Describe the person" }]
          : []),
        ...(sendingWard && notOnSendingWard && someoneChosen && !heldBedWardName && !notOnWardReason
          ? [{ id: `${sectionId}-not-on-ward`, text: "Choose why the ward is referring them" }]
          : []),
        ...(!liveMovement && someoneChosen && !ageBand
          ? [{ id: `${sectionId}-age-band`, text: "Choose the age band" }]
          : []),
        ...(!catchmentNotKnown && !catchmentTeam.trim()
          ? [{ id: `${sectionId}-team`, text: "Choose the catchment" }]
          : []),
        ...(!homeRegion ? [{ id: `${sectionId}-region`, text: "Choose the home region" }] : []),
        ...(!catchmentNotKnown && !catchmentConfirmed
          ? [{ id: `${sectionId}-confirm-catchment`, text: "Confirm the catchment before continuing" }]
          : []),
      ]
    : [];
  return (
    <div
      id={`${sectionId}-patient`}
      className={styles.sectionPanel}
      hidden={previewOpen || confirmationOpen || activeSection !== "patient"}
    >
      <ErrorSummary items={problems} action="before the next step" />
      <section className={styles.refCard}>
        <CardHead icon={User} title="Patient">
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGhost}`}
            aria-expanded={newPatientOpen}
            aria-controls={`${sectionId}-new-patient`}
            data-testid="ward-referral-new-patient-toggle"
            onClick={() => {
              setNewPatientOpen((open) => !open);
              setNewPatientError(null);
            }}
          >
            <UserPlus aria-hidden="true" />
            New patient
          </button>
        </CardHead>
        <div className={styles.cardBody}>
          {newPatientOpen ? (
            <form
              id={`${sectionId}-new-patient`}
              className={styles.newPatient}
              onSubmit={addNewPatient}
              noValidate
              data-testid="ward-referral-new-patient"
            >
              <div className={styles.fieldGrid} data-layout="three">
                <Field label="Family name" htmlFor={`${sectionId}-np-family`} required>
                  <input
                    id={`${sectionId}-np-family`}
                    className={styles.fieldInput}
                    value={newPatient.familyName}
                    maxLength={100}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="words"
                    spellCheck={false}
                    enterKeyHint="done"
                    onChange={({ target: { value } }) => setNewPatient((p) => ({ ...p, familyName: value }))}
                  />
                </Field>
                <Field label="Given name" htmlFor={`${sectionId}-np-given`} required>
                  <input
                    id={`${sectionId}-np-given`}
                    className={styles.fieldInput}
                    value={newPatient.givenName}
                    maxLength={100}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="words"
                    spellCheck={false}
                    enterKeyHint="done"
                    onChange={({ target: { value } }) => setNewPatient((p) => ({ ...p, givenName: value }))}
                  />
                </Field>
                <Field label="Date of birth" htmlFor={`${sectionId}-np-dob`} required>
                  <input
                    id={`${sectionId}-np-dob`}
                    type="date"
                    className={styles.fieldInput}
                    value={newPatient.dateOfBirth}
                    onChange={({ target: { value } }) => setNewPatient((p) => ({ ...p, dateOfBirth: value }))}
                  />
                </Field>
                <Field label="UMRN" htmlFor={`${sectionId}-np-umrn`} required>
                  <input
                    id={`${sectionId}-np-umrn`}
                    className={styles.fieldInput}
                    value={newPatient.umrn}
                    maxLength={20}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    enterKeyHint="done"
                    onChange={({ target: { value } }) => setNewPatient((p) => ({ ...p, umrn: value }))}
                  />
                </Field>
                {/* WT-05 (walk-through, 26 Oct 2026): recorded sex is asked once, here, and the referral
                    and placement start from it instead of "Not recorded". */}
                <Field label="Recorded sex" htmlFor={`${sectionId}-np-sex`} hint="optional">
                  <SelectBox>
                    <select
                      id={`${sectionId}-np-sex`}
                      className={styles.fieldSelect}
                      value={newPatient.sex ?? ""}
                      onChange={({ target: { value } }) =>
                        setNewPatient((p) => ({ ...p, sex: value as RecordedSex | "" }))
                      }
                    >
                      <option value="">Not recorded</option>
                      {RECORDED_SEXES.filter((sex) => sex !== "Not recorded").map((sex) => (
                        <option key={sex}>{sex}</option>
                      ))}
                    </select>
                  </SelectBox>
                </Field>
                <Field label="Gender" htmlFor={`${sectionId}-np-gender`} hint="optional">
                  <SelectBox>
                    <select
                      id={`${sectionId}-np-gender`}
                      className={styles.fieldSelect}
                      value={newPatient.gender}
                      onChange={({ target: { value } }) =>
                        setNewPatient((p) => ({ ...p, gender: value as Gender | "" }))
                      }
                    >
                      <option value="">Not recorded</option>
                      {GENDERS.map((gender) => (
                        <option key={gender}>{gender}</option>
                      ))}
                    </select>
                  </SelectBox>
                </Field>
                <Field label="Suburb" htmlFor={`${sectionId}-np-suburb`} hint="optional">
                  <input
                    id={`${sectionId}-np-suburb`}
                    className={styles.fieldInput}
                    list={`${sectionId}-suburbs`}
                    value={newPatient.suburb}
                    maxLength={100}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="words"
                    onChange={({ target: { value } }) => setNewPatient((p) => ({ ...p, suburb: value }))}
                  />
                </Field>
              </div>
              {newPatientError ? (
                <p className={styles.fieldError} role="alert">
                  <StatusGlyph tone="danger" size={9} />
                  {newPatientError}
                </p>
              ) : null}
              <div className={styles.confirmRow}>
                <button type="submit" className={`${styles.btn} ${styles.btnTint}`} {...addPatientGate.buttonProps}>
                  <UserPlus aria-hidden="true" />
                  Add patient
                </button>
                {addPatientGate.note}
                <button type="button" className={styles.btn} onClick={() => setNewPatientOpen(false)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
          {fromEntryPoint && patientRecord && !isSearchOpen && !searchQuery ? null : (
            <div className={styles.patientSearchWrap}>
              <Search className={styles.patientSearchIcon} aria-hidden="true" />
              <input
                ref={searchInputRef}
                type="search"
                id={searchId}
                className={styles.patientSearchInput}
                aria-label="Find a patient"
                aria-invalid={patientShowErrors && !patientRecord && unidentified === null ? true : undefined}
                aria-haspopup="listbox"
                aria-autocomplete="list"
                aria-controls={showResults ? resultsId : undefined}
                aria-activedescendant={showResults && highlight >= 0 ? `${searchId}-opt-${highlight}` : undefined}
                placeholder="Find a patient by name or UMRN"
                autoCorrect="off"
                autoCapitalize="none"
                enterKeyHint="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
                onFocus={() => {
                  if (searchQuery.trim().length > 0) setIsSearchOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    // Closes the list only; the drawer's own Escape stays for the next press.
                    if (!showResults) return;
                    event.preventDefault();
                    event.stopPropagation();
                    setIsSearchOpen(false);
                    setHighlight(-1);
                    return;
                  }
                  if (!showResults) {
                    if (event.key === "ArrowDown" && searchQuery.trim().length > 0) {
                      event.preventDefault();
                      setIsSearchOpen(true);
                    }
                    return;
                  }
                  const last = filteredPatients.length - 1;
                  if (event.key === "ArrowDown") setHighlight((i) => (i >= last ? 0 : i + 1));
                  else if (event.key === "ArrowUp") setHighlight((i) => (i <= 0 ? last : i - 1));
                  else if (event.key === "Home") setHighlight(0);
                  else if (event.key === "End") setHighlight(last);
                  else if (event.key === "Enter" && highlight >= 0) {
                    setHighlight(-1);
                    handleSelectPatient(filteredPatients[highlight]!.id);
                  } else return;
                  event.preventDefault();
                }}
                autoComplete="off"
                spellCheck="false"
                data-gramm="false"
                data-enable-grammarly="false"
              />
              {searchQuery ? (
                <button
                  type="button"
                  className={styles.patientSearchClear}
                  onClick={() => {
                    setSearchQuery("");
                    setIsSearchOpen(false);
                  }}
                  aria-label="Clear search input"
                >
                  <X aria-hidden="true" />
                </button>
              ) : null}
              {isPhone ? null : <kbd className={styles.kbd}>/</kbd>}

              <p className="sr-only" role="status" aria-live="polite">
                {showResults || searching
                  ? filteredPatients.length > 0
                    ? `${filteredPatients.length} ${filteredPatients.length === 1 ? "synthetic patient matches" : "synthetic patients match"}.`
                    : "No patient matches."
                  : ""}
              </p>
              {searching && filteredPatients.length === 0 ? (
                <p className={styles.patientSearchResults} data-testid="referral-patient-no-match">
                  No patient matches. Check the name or UMRN, or add a new patient.
                </p>
              ) : null}
              {showResults ? (
                <div
                  id={resultsId}
                  className={styles.patientSearchResults}
                  role="listbox"
                  aria-label="Matching patients"
                >
                  {filteredPatients.map((p, index) => (
                    <button
                      key={p.id}
                      id={`${searchId}-opt-${index}`}
                      type="button"
                      role="option"
                      tabIndex={-1}
                      aria-selected={highlight === index}
                      className={styles.patientSearchResultItem}
                      data-active={highlight === index || activePatientKey === p.id}
                      onClick={() => handleSelectPatient(p.id)}
                    >
                      <span className={styles.resultAvatar} aria-hidden="true">
                        {p.initials}
                      </span>
                      <span className={styles.resultText}>
                        <span className={styles.searchResultName}>
                          {p.name} ({ageSexLabel(p)})
                        </span>
                        <span className={styles.searchResultMeta}>
                          <span className={styles.mono}>{p.umrn}</span> · {p.origin.split("·")[0].trim()}
                        </span>
                      </span>
                      <span className={styles.searchResultBadge}>{p.legalStatus.split("·")[0].trim()}</span>
                      {activePatientKey === p.id ? <StatusGlyph tone="success" size={10} /> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {patientRecord ? (
            <div className={styles.patientIdentity}>
              <span className={styles.patientAvatar} aria-hidden="true">
                {currentPatient.initials}
              </span>
              <div className={styles.patientIdentityText}>
                <p className={styles.patientName}>
                  {currentPatient.name} ({ageSexLabel(currentPatient)})
                </p>
                <p className={styles.patientSub}>
                  {isPhone ? null : "UMRN "}
                  <span className={styles.mono}>{currentPatient.umrn}</span> · DOB {formatDob(currentPatient.dob)} ·
                  Medicare {currentPatient.medicare}
                </p>
                <ReadmissionFlag flag={readmissionFlag} testId="ward-referral-readmission" />
              </div>
              <button
                type="button"
                className={styles.btn}
                aria-label="Change patient"
                onClick={() => {
                  setSearchQuery("");
                  setIsSearchOpen(true);
                  requestAnimationFrame(() => searchInputRef.current?.focus());
                }}
              >
                Change
              </button>
            </div>
          ) : unidentified === null ? (
            <div className={styles.confirmRow}>
              {noPatientChosen ? (
                // Redesign: the search, New patient and Not yet identified already say how, so the
                // line says only what is true.
                <p className={`${styles.patientSub} ${styles.patientSubWrap}`} data-testid="ward-referral-no-patient">
                  No patient chosen
                </p>
              ) : null}
              <button
                type="button"
                className={styles.btn}
                data-testid="ward-referral-unidentified"
                onClick={() => setUnidentified("")}
              >
                Not yet identified
              </button>
            </div>
          ) : (
            <div className={styles.fieldGrid}>
              <Field
                label="Describe the person"
                htmlFor={`${sectionId}-unidentified`}
                required
                hint="name if known, or a description"
                error={patientShowErrors && !unidentified.trim() ? "Describe the person" : null}
                wide
              >
                <input
                  id={`${sectionId}-unidentified`}
                  className={styles.fieldInput}
                  data-testid="ward-referral-unidentified-description"
                  value={unidentified}
                  maxLength={120}
                  autoComplete="off"
                  placeholder='For example, "J. Smith (unconfirmed)" or man about 30, brought in by police'
                  onChange={(e) => setUnidentified(e.target.value)}
                />
              </Field>
              <div className={styles.confirmRow}>
                <button
                  type="button"
                  className={styles.btn}
                  onClick={() => {
                    setUnidentified(null);
                    setIsSearchOpen(true);
                    requestAnimationFrame(() => searchInputRef.current?.focus());
                  }}
                >
                  Find a patient instead
                </button>
              </div>
            </div>
          )}

          {alreadyOpen ? (
            <div className={styles.suggestion} data-testid="ward-referral-already-open">
              <StatusGlyph tone="warning" size={9} />
              <span className={styles.suggestionText}>
                <strong>{alreadyOpen}</strong>
                <small>Check where this case is before sending another</small>
              </span>
              <Link
                className={styles.btn}
                href={alreadyOpenHref ?? "/ward-flow/referrals"}
                data-own-leave-guard="true"
                onClick={(event) => {
                  if (dirty) {
                    event.preventDefault();
                    setGuardOpen(true);
                    return;
                  }
                  onClose();
                }}
              >
                Where this case is
              </Link>
            </div>
          ) : null}
          {journeyElsewhere ? (
            <div className={styles.suggestion} data-testid="ward-referral-open-journey">
              <StatusGlyph tone="warning" size={9} />
              <span className={styles.suggestionText}>
                <strong>Already on an open ED journey at {journeyElsewhere.edName}</strong>
                <small>
                  {originName
                    ? `Sending from ${originName} starts a second journey.`
                    : "Sending starts a second journey."}
                </small>
              </span>
              <button
                type="button"
                className={styles.btn}
                onClick={() => {
                  setSourceKind("ed");
                  setOriginSiteCode(journeyElsewhere.siteCode);
                  announceToWardShell(`Referring from ${journeyElsewhere.edName}.`);
                }}
              >
                Refer from {journeyElsewhere.edName}
              </button>
            </div>
          ) : null}
          {sendingWard && notOnSendingWard && (patientRecord || unidentified !== null) ? (
            <div data-testid="ward-referral-not-on-sending-ward">
              <div className={styles.suggestion}>
                <StatusGlyph tone={heldBedWardName ? "danger" : "warning"} size={9} />
                <span className={styles.suggestionText}>
                  <strong>Not in a bed on {sendingWard.name}</strong>
                  <small>
                    {heldBedWardName
                      ? `They already have a bed, or a pulled bed, on ${heldBedWardName}, so this ward cannot send them as a new admission.`
                      : destType === "ward"
                        ? "A ward usually refers its own inpatients. This goes as a new admission, not a transfer."
                        : "A ward usually refers its own inpatients."}
                  </small>
                </span>
              </div>
              {heldBedWardName ? null : (
                <div className={styles.fieldGrid}>
                  <Field
                    label="Why is the ward referring them?"
                    htmlFor={`${sectionId}-not-on-ward`}
                    required
                    error={patientShowErrors && !notOnWardReason ? "Choose why the ward is referring them" : null}
                  >
                    <SelectBox>
                      <select
                        id={`${sectionId}-not-on-ward`}
                        className={styles.fieldSelect}
                        value={notOnWardReason}
                        onChange={(e) => setNotOnWardReason(e.target.value as NotOnSendingWardReason | "")}
                      >
                        <option value="">Choose a reason</option>
                        {NOT_ON_SENDING_WARD_REASONS.map((reason) => (
                          <option key={reason}>{reason}</option>
                        ))}
                      </select>
                    </SelectBox>
                  </Field>
                </div>
              )}
            </div>
          ) : null}
          {!liveMovement && (patientRecord || unidentified !== null) ? (
            <div className={styles.fieldGrid}>
              <Field
                label="Age band"
                htmlFor={`${sectionId}-age-band`}
                required
                error={patientShowErrors && !ageBand ? "Choose the age band" : null}
              >
                <SelectBox>
                  <select
                    id={`${sectionId}-age-band`}
                    className={styles.fieldSelect}
                    value={ageBand}
                    onChange={(e) => setAgeBand(e.target.value as Cohort | "")}
                  >
                    <option value="">Choose age band</option>
                    {COHORTS.map((cohort) => (
                      <option key={cohort}>{cohort}</option>
                    ))}
                  </select>
                </SelectBox>
                {ageBand === "Adult" && ageBandNote ? (
                  <p className={styles.fieldHint} data-testid="ward-referral-age-band-note">
                    {ageBandNote}
                  </p>
                ) : null}
              </Field>
            </div>
          ) : null}

          <div
            className={styles.priorityGrid}
            role="region"
            aria-label="Clinical priority grid"
            hidden={noPatientChosen}
          >
            <div className={styles.priorityCell}>
              <p className={styles.eyebrow}>Legal order</p>
              <p className={styles.priorityValue}>{currentPatient.legalStatus}</p>
              <p className={styles.priorityMeta}>Expiry {currentPatient.recordedExpiry}</p>
              <p className={styles.priorityMeta}>
                <StatusGlyph tone="neutral" size={9} />
                <LegalLimitsNotChecked variant="tag" />
              </p>
            </div>
            <div className={styles.priorityCell}>
              <p className={styles.eyebrow}>Clinical acuity</p>
              <p className={styles.priorityValue}>{tierLabel}</p>
              <p className={styles.priorityMeta}>
                {provisionalDiag ? `Diagnosis ${provisionalDiag}` : "Diagnosis not recorded"}
              </p>
              <p className={styles.priorityMeta}>
                {recordedFlags.length
                  ? recordedFlags
                      .map((key, index) => (index === 0 ? RISK_FLAG_LABELS[key] : RISK_FLAG_LABELS[key].toLowerCase()))
                      .join(", ")
                  : "No risk flags selected"}
              </p>
            </div>
            <div className={styles.priorityCell}>
              <p className={styles.eyebrow}>Bed fit</p>
              <p className={styles.priorityValue}>
                {effectiveCohort || "Age band not chosen"} · {security.toLowerCase()}
              </p>

              <p className={styles.priorityMeta}>Origin {currentPatient.origin.split("·")[0].trim()}</p>
              <p className={styles.priorityMeta}>
                {destType === "ward" ? (
                  <>
                    <StatusGlyph tone={realTimeMatch.readyBedsCount > 0 ? "success" : "danger"} size={9} />
                    {realTimeMatch.readyBedsCount} ready · {realTimeMatch.pulledBedsCount} pulled
                  </>
                ) : destType === "community" ? (
                  <>
                    <StatusGlyph tone="success" size={9} />
                    Community team, no bed requested
                  </>
                ) : (
                  <>
                    <StatusGlyph tone="neutral" size={9} />
                    Observation beds not recorded
                  </>
                )}
              </p>
            </div>
            <div className={styles.priorityCell} data-testid="ward-referral-medical-clearance-card">
              <p className={styles.eyebrow}>Medical clearance</p>
              <p className={styles.priorityValue} data-testid="ward-referral-clearance-status">
                <StatusGlyph tone={clearance.tone} size={9} />
                {clearance.label}
              </p>
              <p className={styles.priorityMeta}>
                {isMedicalCleared ? "Fit for admission & travel" : "Pre-admission exam needed"}
              </p>
              <button
                type="button"
                className={styles.textLink}
                data-cleared={isMedicalCleared}
                data-testid="ward-referral-medical-clearance-toggle"
                onClick={() => setActiveSection(destType === "community" ? "referral" : "documentation")}
              >
                Review clearance
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.refCard}>
        <CardHead icon={MapPin} title="Catchment">
          <span className={styles.asideText}>
            {catchmentNotKnown ? (
              "Not known"
            ) : catchmentConfirmed ? (
              <>
                <StatusGlyph tone="success" size={9} /> Confirmed
              </>
            ) : (
              "Needs confirming"
            )}
          </span>
        </CardHead>
        <div className={styles.cardBody}>
          {/* Redesign: one line says what is known. The old card said "not known" three ways
              (address, suggestion box, suburb note) before the first field. */}
          <p className={redesign.catchmentStatus} data-testid="ward-referral-suburb-note">
            <StatusGlyph tone={catchmentConfirmed ? "success" : "warning"} size={9} />
            <span>
              {patientRecord?.address
                ? `Recorded address ${patientRecord.address}`
                : !addressUnknown
                  ? "No recorded address"
                  : addressReplied
                    ? "Address not available"
                    : "Checking the recorded address"}
              {" · "}
              {suburbKnown ? `suburb ${catchmentSuburb} on the referral` : "suburb not on the referral"}
            </span>
          </p>
          {catchmentTeam && !catchmentEditing ? (
            <div className={styles.suggestion}>
              <StatusGlyph tone={catchmentConfirmed ? "success" : "warning"} size={9} />
              <span className={styles.suggestionText}>
                <strong>{catchmentTeam}</strong>
                <small>
                  {catchmentConfirmed
                    ? "Catchment confirmed"
                    : catchmentSuburb
                      ? `Suggested from suburb ${catchmentSuburb}, confirm before continuing`
                      : "Confirm before continuing"}
                </small>
              </span>
              <button
                type="button"
                className={styles.btn}
                onClick={() => {
                  setCatchmentEditing(true);
                  setCatchmentConfirmed(false);
                  window.requestAnimationFrame(() => document.getElementById(`${sectionId}-suburb`)?.focus());
                }}
              >
                Change
              </button>
            </div>
          ) : null}
          {(!catchmentTeam || catchmentEditing) && (
            <div className={styles.fieldGrid}>
              <Field label="Patient suburb" htmlFor={`${sectionId}-suburb`}>
                <input
                  id={`${sectionId}-suburb`}
                  className={styles.fieldInput}
                  list={`${sectionId}-suburbs`}
                  autoComplete="off"
                  autoCorrect="off"
                  placeholder="Type a suburb"
                  value={catchmentSuburb}
                  onChange={(e) => {
                    setCatchmentSuburb(e.target.value);
                    setCatchmentConfirmed(false);
                    const teams = catchmentRoutingDestinations(lookupCatchment(e.target.value));
                    setCatchmentTeam(teams?.length === 1 ? teams[0] : "");
                  }}
                />
              </Field>
              <Field
                label="Catchment team"
                htmlFor={`${sectionId}-team`}
                error={patientShowErrors && !catchmentTeam.trim() ? "Choose the catchment" : null}
              >
                <input
                  id={`${sectionId}-team`}
                  className={styles.fieldInput}
                  list={`${sectionId}-teams`}
                  autoComplete="off"
                  autoCorrect="off"
                  placeholder="Filled from the suburb, or search"
                  value={catchmentTeam}
                  maxLength={200}
                  onChange={(e) => {
                    setCatchmentTeam(e.target.value);
                    setCatchmentConfirmed(false);
                  }}
                />
              </Field>
            </div>
          )}
          <datalist id={`${sectionId}-suburbs`}>
            {suburbOptions().map((suburb) => (
              <option key={suburb} value={suburb} />
            ))}
          </datalist>
          <datalist id={`${sectionId}-teams`}>
            {communityTeamOptions().map((team) => (
              <option key={team} value={team} />
            ))}
          </datalist>
          {lookupCatchment(catchmentSuburb).state === "contested" && (
            <p className={styles.fieldError}>
              <StatusGlyph tone="warning" size={9} />
              Catchment sources disagree for this suburb. Select and confirm the catchment manually.
            </p>
          )}
          <div className={styles.fieldGrid}>
            <Field
              label="Home region"
              htmlFor={`${sectionId}-region`}
              required
              error={patientShowErrors && !homeRegion ? "Choose the home region" : null}
            >
              <SelectBox>
                <select
                  id={`${sectionId}-region`}
                  className={styles.fieldSelect}
                  value={homeRegion}
                  aria-invalid={patientShowErrors && !homeRegion ? true : undefined}
                  onChange={(e) => {
                    setHomeRegion(e.target.value as HomeRegion);
                    // The region is its own answer; a team already confirmed stays so,
                    // so choosing it does not ask for the catchment a second time.
                    if (!catchmentTeam.trim()) setCatchmentConfirmed(false);
                  }}
                >
                  <option value="">Choose region</option>
                  {HOME_REGIONS.map((region) => (
                    <option key={region}>{region}</option>
                  ))}
                </select>
              </SelectBox>
            </Field>
            <Field label="Service area" htmlFor={`${sectionId}-service`} hint="optional">
              <SelectBox>
                <select
                  id={`${sectionId}-service`}
                  className={styles.fieldSelect}
                  value={catchmentService}
                  onChange={(e) => {
                    // Finding 39: the optional service area never un-confirms the catchment.
                    setCatchmentService(e.target.value as HealthService | "");
                  }}
                >
                  <option value="">Not known, confirm later</option>
                  {HEALTH_SERVICES.map((service) => (
                    <option key={service}>{service}</option>
                  ))}
                </select>
              </SelectBox>
            </Field>
          </div>
          <div className={redesign.catchmentFoot}>
            {destType !== "community" ? (
              <label
                className={styles.checkChip}
                data-checked={catchmentNotKnown}
                data-testid="ward-referral-catchment-not-known"
              >
                <input
                  type="checkbox"
                  checked={catchmentNotKnown}
                  onChange={(e) => {
                    setCatchmentNotKnown(e.target.checked);
                    setFlowError(null);
                  }}
                />
                Catchment not known
              </label>
            ) : null}
            <div className={cx(styles.confirmRow, redesign.confirmEnd)}>
              {catchmentNotKnown ? (
                <span className={styles.confirmedNote} data-testid="ward-referral-catchment-not-known-note">
                  <StatusGlyph tone="warning" size={10} />
                  Catchment not known. The referral letter says so.
                </span>
              ) : catchmentConfirmed ? (
                <span className={styles.confirmedNote}>
                  <StatusGlyph tone="success" size={10} />
                  Catchment confirmed
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    id={`${sectionId}-confirm-catchment`}
                    className={`${styles.btn} ${styles.btnTint}`}
                    aria-disabled={!catchmentTeam.trim() || !homeRegion ? "true" : undefined}
                    // A button cannot carry aria-invalid; this marks it as the step's fault for the focus move.
                    data-referral-invalid={patientShowErrors && catchmentTeam.trim() && homeRegion ? "" : undefined}
                    aria-describedby={
                      !catchmentTeam.trim() || !homeRegion
                        ? `${sectionId}-catchment-why`
                        : patientShowErrors
                          ? `${sectionId}-catchment-error`
                          : undefined
                    }
                    onClick={() => {
                      if (!catchmentTeam.trim() || !homeRegion) return;
                      setCatchmentConfirmed(true);
                      setCatchmentEditing(false);
                      setFlowError(null);
                    }}
                  >
                    <CheckCircle2 aria-hidden="true" />
                    Confirm catchment
                  </button>
                  {!catchmentTeam.trim() || !homeRegion ? (
                    <span className={styles.bodyMeta} id={`${sectionId}-catchment-why`}>
                      {!catchmentTeam.trim() ? "Choose the catchment first" : "Choose the home region first"}
                    </span>
                  ) : null}
                </>
              )}
            </div>
          </div>
          {patientShowErrors && !catchmentConfirmed && !catchmentNotKnown ? (
            <p className={styles.fieldError} id={`${sectionId}-catchment-error`}>
              <StatusGlyph tone="danger" size={9} />
              Confirm the catchment before continuing
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
