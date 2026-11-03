"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { Search, User, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { LegalLimitsNotChecked } from "@/components/ward-management/legal-limits-not-checked";
import { COHORTS, type Cohort } from "@/components/ward-management/ward-model";
import { GENDERS, type Gender } from "@/components/ward-management/ward-patients";
import { RECORDED_SEXES, type RecordedSex } from "@/components/ward-management/ward-model-vocabulary";
import {
  NOT_ON_SENDING_WARD_REASONS,
  type NotOnSendingWardReason,
} from "@/components/ward-management/ward-change-reasons";
import styles from "./ward-referral-drawer.module.css";
import {
  DateField,
  ErrorSummary,
  Segmented,
  StatusGlyph,
  type ChoiceItem,
  type ErrorSummaryItem,
} from "@/components/wf";
import { revealWardOption } from "@/components/ward-management/ward-scroll";
import { ReadmissionFlag } from "@/components/ward-management/ward-readmission-flag";
import { ageSexLabel, RISK_FLAG_LABELS, formatDob } from "./ward-referral-drawer-model";
import { Field, SelectBox, CardHead } from "./ward-referral-drawer-fields";
import { ReferralCatchmentCard } from "./ward-referral-drawer-catchment";
import type { WardReferralDrawerState } from "./use-ward-referral-drawer-state";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import { siteDirectory } from "@/components/ward-management/ward-sites";
import { SharedSessionContext } from "@/components/ward-management/shell/ward-shared-session-context";

/** Step 1, Patient: find or add the person, the priority grid and the catchment card. */
/** RF3: kit segments instead of the browser's drop-downs. Nothing is chosen until someone picks. */
const NEW_PATIENT_SEX_ITEMS: ChoiceItem<RecordedSex | "">[] = RECORDED_SEXES.filter(
  (sex) => sex !== "Not recorded",
).map((sex) => ({ id: sex, label: sex }));
const NEW_PATIENT_GENDER_ITEMS: ChoiceItem<Gender | "">[] = GENDERS.map((gender) => ({ id: gender, label: gender }));

export function ReferralPatientStep({
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
    isPhone,
    liveMovement,
    patientRecord,
    effectiveCohort,
    isMedicalCleared,
    catchmentTeam,
    catchmentConfirmed,
    catchmentNotKnown,
    homeRegion,
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
  // D-95 (3 Nov 2026): a press outside the search closes its results, as Escape does.
  const searchWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isSearchOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const wrap = searchWrapRef.current;
      if (wrap && event.target instanceof Node && !wrap.contains(event.target)) {
        setIsSearchOpen(false);
        setHighlight(-1);
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [isSearchOpen, setIsSearchOpen]);
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
        <CardHead icon={newPatientOpen ? UserPlus : User} title={newPatientOpen ? "New patient" : "Patient"}>
          {/* RF3 (Current Issues, 3 Nov 2026): while a new patient is being added, the card is only that
              form, with its own close; the search and the chosen person come back when it closes. */}
          <button
            type="button"
            hidden={newPatientOpen}
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
            Add patient
          </button>
        </CardHead>
        <div className={styles.cardBody} data-adding={newPatientOpen || undefined}>
          {newPatientOpen ? (
            <form
              id={`${sectionId}-new-patient`}
              className={styles.newPatient}
              onSubmit={addNewPatient}
              noValidate
              data-testid="ward-referral-new-patient"
            >
              <div className={styles.newPatientHead}>
                <p className={styles.bodyMeta}>
                  Not found in search? Add them here and they are used for this referral.
                </p>
                <button
                  type="button"
                  className={styles.newPatientClose}
                  aria-label="Close new patient"
                  onClick={() => setNewPatientOpen(false)}
                >
                  <X aria-hidden="true" />
                </button>
              </div>
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
                  {/* Typed as DD/MM/YYYY in the kit's date box, never the browser's picker (bug list row 25).
                      The draft still holds YYYY-MM-DD, as Add a patient's does. */}
                  <DateField
                    id={`${sectionId}-np-dob`}
                    value={newPatient.dateOfBirth}
                    onValueChange={(dateOfBirth) => setNewPatient((p) => ({ ...p, dateOfBirth }))}
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
                    // One word in capitals, as Add a patient writes it (31 Oct 2026).
                    onChange={({ target: { value } }) =>
                      setNewPatient((p) => ({ ...p, umrn: value.replace(/\s+/g, "").toUpperCase() }))
                    }
                  />
                </Field>
                {/* WT-05 (walk-through, 26 Oct 2026): recorded sex is asked once, here, and the referral
                    and placement start from it instead of "Not recorded". */}
                <div className={styles.npChoices}>
                  <div className={styles.npChoice}>
                    <span className={styles.npChoiceLabel} id={`${sectionId}-np-sex`}>
                      Recorded sex <small>optional</small>
                    </span>
                    <Segmented
                      label="Recorded sex"
                      items={NEW_PATIENT_SEX_ITEMS}
                      value={newPatient.sex ?? ""}
                      onChange={(sex) => setNewPatient((p) => ({ ...p, sex: sex as RecordedSex | "" }))}
                    />
                  </div>
                  <div className={styles.npChoice}>
                    <span className={styles.npChoiceLabel} id={`${sectionId}-np-gender`}>
                      Gender <small>optional, bed matching</small>
                    </span>
                    <Segmented
                      label="Gender"
                      items={NEW_PATIENT_GENDER_ITEMS}
                      value={newPatient.gender}
                      onChange={(gender) => setNewPatient((p) => ({ ...p, gender: gender as Gender | "" }))}
                    />
                  </div>
                </div>
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
                  Add and use for this referral
                </button>
                {addPatientGate.note}
                <button type="button" className={styles.btn} onClick={() => setNewPatientOpen(false)}>
                  Back to search
                </button>
              </div>
            </form>
          ) : null}
          {fromEntryPoint && patientRecord && !isSearchOpen && !searchQuery ? null : (
            <div ref={searchWrapRef} className={styles.patientSearchWrap}>
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
                  <span className={styles.mono}>{currentPatient.umrn}</span> · DOB {formatDob(currentPatient.dob)}
                  {/* RF4: "Medicare Not recorded" was a third fact that told the referrer nothing. */}
                  {currentPatient.medicare && currentPatient.medicare !== "Not recorded"
                    ? ` · Medicare ${currentPatient.medicare}`
                    : null}
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
                // The search, Add patient and Not yet identified already say how, so the
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
                        ? "This goes as a new admission, not a transfer."
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

      <ReferralCatchmentCard
        s={s}
        addressLine={
          patientRecord?.address
            ? `Recorded address ${patientRecord.address}`
            : !addressUnknown
              ? "No recorded address"
              : addressReplied
                ? "Address not available"
                : "Checking the recorded address"
        }
      />
    </div>
  );
}
