"use client";

import { CheckCircle2, MapPin, Search, User, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { LegalLimitsNotChecked } from "@/components/ward-management/legal-limits-not-checked";
import {
  COHORTS,
  HEALTH_SERVICES,
  HOME_REGIONS,
  suburbUnknownLabels,
  type HomeRegion,
  type Cohort,
  type HealthService,
} from "@/components/ward-management/ward-model";
import { GENDERS, type Gender } from "@/components/ward-management/ward-patients";
import {
  NOT_ON_SENDING_WARD_REASONS,
  type NotOnSendingWardReason,
} from "@/components/ward-management/ward-change-reasons";
import styles from "./ward-referral-drawer.module.css";
import { catchmentRoutingDestinations, lookupCatchment } from "../ward-catchment";
import { communityTeamOptions, suburbOptions } from "./referral-destination-options";
import { StatusGlyph } from "@/components/wf";
import { ReadmissionFlag } from "@/components/ward-management/ward-readmission-flag";
import { ageSexLabel, RISK_FLAG_LABELS, formatDob } from "./ward-referral-drawer-model";
import { Field, SelectBox, CardHead } from "./ward-referral-drawer-fields";
import type { WardReferralDrawerState } from "./use-ward-referral-drawer-state";

/** Step 1, Patient: find or add the person, the priority grid and the catchment card. */
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
  } = s;
  return (
    <div
      id={`${sectionId}-patient`}
      className={styles.sectionPanel}
      hidden={previewOpen || confirmationOpen || activeSection !== "patient"}
    >
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
                    onChange={(e) => setNewPatient((p) => ({ ...p, familyName: e.target.value }))}
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
                    onChange={(e) => setNewPatient((p) => ({ ...p, givenName: e.target.value }))}
                  />
                </Field>
                <Field label="Date of birth" htmlFor={`${sectionId}-np-dob`} required>
                  <input
                    id={`${sectionId}-np-dob`}
                    type="date"
                    className={styles.fieldInput}
                    value={newPatient.dateOfBirth}
                    onChange={(e) => setNewPatient((p) => ({ ...p, dateOfBirth: e.target.value }))}
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
                    onChange={(e) => setNewPatient((p) => ({ ...p, umrn: e.target.value }))}
                  />
                </Field>
                <Field label="Gender" htmlFor={`${sectionId}-np-gender`} hint="optional">
                  <SelectBox>
                    <select
                      id={`${sectionId}-np-gender`}
                      className={styles.fieldSelect}
                      value={newPatient.gender}
                      onChange={(e) => setNewPatient((p) => ({ ...p, gender: e.target.value as Gender | "" }))}
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
                    onChange={(e) => setNewPatient((p) => ({ ...p, suburb: e.target.value }))}
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

              {isSearchOpen && filteredPatients.length > 0 ? (
                <div className={styles.patientSearchResults} role="listbox" aria-label="Matching patients">
                  {filteredPatients.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      role="option"
                      aria-selected={activePatientKey === p.id}
                      className={styles.patientSearchResultItem}
                      data-active={activePatientKey === p.id}
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
                <p className={styles.patientSub} data-testid="ward-referral-no-patient">
                  No patient chosen. Find them by name or UMRN, add a new patient, or choose Not yet identified.
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
                hint="no name on file"
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
                  placeholder="For example, man about 30, brought in by police"
                  onChange={(e) => setUnidentified(e.target.value)}
                />
              </Field>
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
          {sendingWard && notOnSendingWard && (patientRecord || unidentified !== null) ? (
            <div data-testid="ward-referral-not-on-sending-ward">
              <div className={styles.suggestion}>
                <StatusGlyph tone={heldBedWardName ? "danger" : "warning"} size={9} />
                <span className={styles.suggestionText}>
                  <strong>Not in a bed on {sendingWard.name}</strong>
                  <small>
                    {heldBedWardName
                      ? `They already hold a bed on ${heldBedWardName}, so this ward cannot send them as a new admission.`
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
              </Field>
            </div>
          ) : null}

          <div
            className={styles.priorityGrid}
            role="region"
            aria-label="Clinical Priority Grid"
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
                onClick={() => setActiveSection("documentation")}
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
            {catchmentConfirmed ? (
              <>
                <StatusGlyph tone="success" size={9} /> Confirmed
              </>
            ) : (
              "Needs confirming"
            )}
          </span>
        </CardHead>
        <div className={styles.cardBody}>
          <p className={styles.bodyMeta}>
            {patientRecord?.address
              ? `Recorded address ${patientRecord.address}`
              : "Address not recorded, search the suburb"}
          </p>
          <div className={styles.suggestion}>
            <StatusGlyph tone={catchmentConfirmed ? "success" : "warning"} size={9} />
            <span className={styles.suggestionText}>
              <strong>{catchmentTeam || "Catchment needs confirmation"}</strong>
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
              }}
            >
              Change
            </button>
          </div>
          <p className={styles.bodyMeta} data-testid="ward-referral-suburb-note">
            Suburb on the referral: <strong>{suburbKnown ? catchmentSuburb : suburbUnknownLabels.not_known}</strong>
          </p>
          {(!catchmentTeam || catchmentEditing) && (
            <div className={styles.fieldGrid}>
              <Field label="Patient suburb" htmlFor={`${sectionId}-suburb`}>
                <input
                  id={`${sectionId}-suburb`}
                  className={styles.fieldInput}
                  list={`${sectionId}-suburbs`}
                  autoComplete="off"
                  autoCorrect="off"
                  value={catchmentSuburb}
                  onChange={(e) => {
                    setCatchmentSuburb(e.target.value);
                    setCatchmentConfirmed(false);
                    const teams = catchmentRoutingDestinations(lookupCatchment(e.target.value));
                    setCatchmentTeam(teams?.length === 1 ? teams[0] : "");
                  }}
                />
              </Field>
              <Field label="Search catchment" htmlFor={`${sectionId}-team`}>
                <input
                  id={`${sectionId}-team`}
                  className={styles.fieldInput}
                  list={`${sectionId}-teams`}
                  autoComplete="off"
                  autoCorrect="off"
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
                    setCatchmentService(e.target.value as HealthService | "");
                    setCatchmentConfirmed(false);
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
          <div className={styles.confirmRow}>
            {catchmentConfirmed ? (
              <span className={styles.confirmedNote}>
                <StatusGlyph tone="success" size={10} />
                Catchment confirmed
              </span>
            ) : (
              <>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnTint}`}
                  aria-disabled={!catchmentTeam.trim() || !homeRegion ? "true" : undefined}
                  aria-describedby={!catchmentTeam.trim() || !homeRegion ? `${sectionId}-catchment-why` : undefined}
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
          {patientShowErrors && !catchmentConfirmed ? (
            <p className={styles.fieldError}>
              <StatusGlyph tone="danger" size={9} />
              Confirm the catchment before continuing
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
