"use client";

import { Activity, Ambulance, BedDouble, HeartHandshake, MapPin, Shield, Target } from "lucide-react";
import { LegalLimitsNotChecked } from "@/components/ward-management/legal-limits-not-checked";
import {
  ATS_CATEGORIES,
  URGENCY_LEVELS,
  RECORDED_SEXES,
  REFERRAL_GENDERS,
  genderReviewNeeded,
  type RecordedSex,
} from "@/components/ward-management/ward-model";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { siteDirectory } from "@/components/ward-management/ward-sites";
import styles from "./ward-referral-drawer.module.css";
import { TENTATIVE_DIAGNOSIS_BLOCKS } from "../ward-diagnosis";
import { ErrorSummary, StatusGlyph, type ErrorSummaryItem } from "@/components/wf";
import { ED_ARRIVAL_MODES, FIRST_CONTACT_TARGETS } from "./referral-submission";
import {
  GENDER_UNANSWERED,
  LEGAL_STATUS_FORM_CODES,
  legalStatusOptionLabel,
  REFERRAL_GENDER_NOT_RECORDED,
  referralGenderOf,
  RISK_FLAG_LABELS,
  type ReferralGenderAnswer,
  YES_NO,
  yesNo,
} from "./ward-referral-drawer-model";
import { Field, SelectBox, Choice, CardHead } from "./ward-referral-drawer-fields";
import { NO_SENDING_WARD, type WardReferralDrawerState } from "./use-ward-referral-drawer-state";
import { COMMUNITY_REFERRAL_PURPOSES } from "@/components/ward-management/ward-model-referral-parts";
import { communityReferralPurposeLabel } from "@/components/ward-management/ward-referrals";
import { DocumentationPanel, documentationProblems } from "./referral-flow-panels";

const COMMUNITY_PURPOSE_LABELS = {
  follow_up: communityReferralPurposeLabel("follow_up"),
  assess_for_admission: communityReferralPurposeLabel("assess_for_admission"),
};

/** D-77 short form: what a community referral is for, then when the team should first make contact. */
function CommunityPurposeAndFollowUp({ s }: { s: WardReferralDrawerState }) {
  const { sectionId, communityPurpose, setCommunityPurpose, communityNeeds, setCommunityNeeds, setFlowError } = s;
  return (
    <>
      <section className={styles.refCard} data-testid="ward-referral-community-purpose">
        <CardHead icon={Target} title="Purpose">
          <span className={styles.asideText}>Required</span>
        </CardHead>
        <div className={styles.cardBody}>
          <Choice
            legend="What is this referral for?"
            name={`${sectionId}-community-purpose`}
            id={`${sectionId}-community-purpose`}
            options={COMMUNITY_REFERRAL_PURPOSES}
            labels={COMMUNITY_PURPOSE_LABELS}
            value={communityPurpose || undefined}
            required
            onChange={(purpose) => {
              setCommunityPurpose(purpose);
              setFlowError(null);
            }}
          />
          <p className={styles.bodyMeta}>
            No bed is asked for either way. The team sees the purpose in its inbox. Older referrals read as Community
            follow-up.
          </p>
        </div>
      </section>
      <section className={styles.refCard} data-testid="ward-referral-needs">
        <CardHead icon={HeartHandshake} title="Follow-up">
          <span className={styles.asideText}>First contact required</span>
        </CardHead>
        <div className={styles.cardBody}>
          <div className={styles.fieldGrid}>
            <Choice
              legend="First contact within"
              name={`${sectionId}-first-contact`}
              id={`${sectionId}-first-contact`}
              options={FIRST_CONTACT_TARGETS}
              value={communityNeeds.firstContact}
              required
              onChange={(firstContact) => {
                setCommunityNeeds((n) => ({ ...n, firstContact }));
                setFlowError(null);
              }}
            />
            <Choice
              legend="Home visit"
              name={`${sectionId}-home-visit`}
              options={YES_NO}
              value={yesNo(communityNeeds.homeVisit)}
              onChange={(v) => setCommunityNeeds((n) => ({ ...n, homeVisit: v === "Yes" }))}
            />
            <Choice
              legend="Interpreter"
              name={`${sectionId}-interpreter`}
              options={YES_NO}
              value={yesNo(communityNeeds.interpreter)}
              onChange={(v) => setCommunityNeeds((n) => ({ ...n, interpreter: v === "Yes" }))}
            />
            <Choice
              legend="Contact the carer"
              name={`${sectionId}-carer`}
              options={YES_NO}
              value={yesNo(communityNeeds.carerContact)}
              onChange={(v) => setCommunityNeeds((n) => ({ ...n, carerContact: v === "Yes" }))}
            />
          </div>
        </div>
      </section>
    </>
  );
}

/** Step 2, Referral: where it comes from, legal status and urgency, the presentation and the destination's needs. */
export function ReferralDetailsStep({ s }: { s: WardReferralDrawerState }) {
  const {
    sectionId,
    setSelectedUnitIds,
    previewOpen,
    confirmationOpen,
    attempted,
    activeSection,
    sourceKind,
    setSourceKind,
    originSiteCode,
    setOriginSiteCode,
    sendingTeam,
    setSendingTeam,
    referralSex,
    setReferralSex,
    referralGender,
    setReferralGender,
    highAcuity,
    setHighAcuity,
    destType,
    legalStatus,
    setLegalStatus,
    urgency,
    setUrgency,
    atsCategory,
    setAtsCategory,
    security,
    setSecurity,
    provisionalDiag,
    setProvisionalDiag,
    doctorNote,
    setDoctorNote,
    clinicalSummary,
    setClinicalSummary,
    riskFlags,
    edNeeds,
    setEdNeeds,
    toggleRisk,
    originValid,
    sendingWard,
    senderMissing,
    reasonRoom,
    reasonNoteRequired,
    activePatientKey,
    documentation,
    setDocumentation,
    communityPurpose,
    communityNeeds,
    storyError,
  } = s;
  const community = destType === "community";
  const fromAsked = !sendingWard && !senderMissing;
  const genderUnanswered = destType === "ward" && referralGender === "";
  // The step's faults in the order the step shows them, for the error summary.
  const problems: ErrorSummaryItem[] = attempted.referral
    ? [
        ...(community && !communityPurpose
          ? [{ id: `${sectionId}-community-purpose`, text: "Choose what the community referral is for" }]
          : []),
        ...(community && !communityNeeds.firstContact
          ? [{ id: `${sectionId}-first-contact`, text: "Choose when the team should first make contact" }]
          : []),
        ...(fromAsked && !originValid ? [{ id: `${sectionId}-origin`, text: "Choose the location of referral" }] : []),
        ...(fromAsked && sourceKind === "community" && !sendingTeam.trim()
          ? [{ id: `${sectionId}-sending`, text: "Record the referring community service" }]
          : []),
        ...(!community && !URGENCY_LEVELS.some((tier) => String(tier) === urgency)
          ? [{ id: `${sectionId}-urgency`, text: "Choose the referral urgency" }]
          : []),
        ...(community ? documentationProblems(documentation, `${sectionId}-refdocs`, true) : []),
        ...(reasonNoteRequired && !doctorNote.trim()
          ? [{ id: "refDocInput", text: "Give the reason for referral" }]
          : []),
        ...(doctorNote.length > reasonRoom
          ? [{ id: "refDocInput", text: `Shorten the reason for referral to ${reasonRoom} characters or fewer` }]
          : []),
        ...(storyError() ? [{ id: `${sectionId}-refSummaryText`, text: storyError()!.replace(/\.$/u, "") }] : []),
        ...(genderUnanswered ? [{ id: `${sectionId}-gender`, text: GENDER_UNANSWERED.replace(/\.$/u, "") }] : []),
      ]
    : [];
  // WS-01: said before Send, so the referrer knows the ward cannot accept until a coordinator reviews.
  const genderReview =
    destType === "ward" && !genderUnanswered && genderReviewNeeded(referralGenderOf(referralGender), referralSex);
  return (
    <div
      id={`${sectionId}-referral`}
      className={styles.sectionPanel}
      hidden={previewOpen || confirmationOpen || activeSection !== "referral"}
    >
      <ErrorSummary items={problems} action="before the next step" />
      {community ? <CommunityPurposeAndFollowUp s={s} /> : null}
      <section className={styles.refCard}>
        <CardHead icon={MapPin} title="From">
          <span className={styles.asideText}>
            {sendingWard || senderMissing
              ? "Ward referral"
              : sourceKind === "ed"
                ? "Emergency referral"
                : "Community referral"}
          </span>
        </CardHead>
        <div className={styles.cardBody}>
          {sendingWard ? (
            <p className={styles.asideText} data-testid="ward-referral-drawer-sending-ward">
              Sent from {sendingWard.name}, in this ward&apos;s own name.
            </p>
          ) : senderMissing ? (
            <p className={styles.asideText} data-testid="ward-referral-drawer-no-sending-ward">
              {NO_SENDING_WARD}
            </p>
          ) : (
            <div className={styles.fieldGrid}>
              <div className={styles.formField}>
                <div className={styles.fieldLabelRow}>
                  <span className={styles.required} id={`${sectionId}-source`}>
                    Source
                  </span>
                </div>
                <div className={styles.segmented} role="group" aria-labelledby={`${sectionId}-source`}>
                  {(["ed", "community"] as const).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      aria-pressed={sourceKind === kind}
                      onClick={() => {
                        setSourceKind(kind);
                        setOriginSiteCode("");
                      }}
                    >
                      {kind === "community" ? "Community" : "Emergency"}
                    </button>
                  ))}
                </div>
              </div>
              <Field
                label={sourceKind === "ed" ? "Referring emergency department" : "Referring service location"}
                htmlFor={`${sectionId}-origin`}
                required
                error={attempted.referral && !originValid ? "Choose the location of referral" : null}
              >
                <SelectBox>
                  <select
                    id={`${sectionId}-origin`}
                    className={styles.fieldSelect}
                    value={originSiteCode}
                    onChange={(e) => setOriginSiteCode(e.target.value)}
                  >
                    <option value="">Choose location</option>
                    {siteDirectory
                      .filter((site) => sourceKind !== "ed" || site.emergencyDepartment)
                      .map((site) => (
                        <option key={site.code} value={site.code}>
                          {sourceKind === "ed" ? site.emergencyDepartment?.name : site.name}
                        </option>
                      ))}
                  </select>
                </SelectBox>
              </Field>
              {sourceKind === "community" && (
                <Field
                  label="Referring community service"
                  htmlFor={`${sectionId}-sending`}
                  required
                  wide
                  error={attempted.referral && !sendingTeam.trim() ? "Record the referring community service" : null}
                >
                  <input
                    id={`${sectionId}-sending`}
                    className={styles.fieldInput}
                    list={`${sectionId}-teams`}
                    autoComplete="off"
                    autoCorrect="off"
                    value={sendingTeam}
                    maxLength={200}
                    onChange={(e) => setSendingTeam(e.target.value)}
                  />
                </Field>
              )}
            </div>
          )}
        </div>
      </section>

      <section className={styles.refCard}>
        <CardHead icon={Shield} title={community ? "Legal status" : "Legal status and urgency"}>
          <span className={styles.asideText}>
            <StatusGlyph tone="neutral" size={9} />
            <LegalLimitsNotChecked variant="tag" />
          </span>
        </CardHead>
        <div className={styles.cardBody}>
          <div className={styles.fieldGrid} data-layout={community ? undefined : "wide-narrow"}>
            <Field label="Legal status" htmlFor={`${sectionId}-refLegalSelect`} required>
              <SelectBox>
                <select
                  className={styles.fieldSelect}
                  id={`${sectionId}-refLegalSelect`}
                  value={legalStatus}
                  onChange={(e) => setLegalStatus(e.target.value)}
                >
                  {/* The record's own status stays selectable even when it is not one of the usual
                              choices, so the select never shows a different status from the one recorded. */}
                  {legalStatus !== "Voluntary" &&
                  !LEGAL_STATUS_FORM_CODES.some((code) => legalStatus === `Form ${code}`) ? (
                    <option value={legalStatus}>
                      {legalStatus.startsWith("Form ") ? legalStatusOptionLabel(legalStatus.slice(5)) : legalStatus}
                    </option>
                  ) : null}
                  {LEGAL_STATUS_FORM_CODES.map((code) => (
                    <option key={code} value={`Form ${code}`}>
                      {legalStatusOptionLabel(code)}
                    </option>
                  ))}
                  <option value="Voluntary">Voluntary</option>
                </select>
              </SelectBox>
            </Field>
            {community ? null : (
              <fieldset className={styles.radioField}>
                <legend className={styles.required}>Bed security</legend>
                <div className={styles.segmented}>
                  {(["Secure", "Open"] as const).map((level) => (
                    <label key={level} data-selected={security === level}>
                      <input
                        type="radio"
                        name={`${sectionId}-security`}
                        value={level}
                        checked={security === level}
                        onChange={() => {
                          setSecurity(level);
                          setSelectedUnitIds([]);
                        }}
                      />
                      {level}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          </div>
          {community ? null : (
            <>
              <fieldset className={styles.radioField}>
                <legend className={styles.required}>Urgency</legend>
                <div className={styles.tierGrid}>
                  {URGENCY_LEVELS.map((level, index) => {
                    const words = urgencyTierLabel(level).split(" · ")[1] ?? "";
                    return (
                      <label key={level} className={styles.tierTile} data-selected={urgency === String(level)}>
                        <input
                          id={index === 0 ? `${sectionId}-urgency` : undefined}
                          type="radio"
                          name={`${sectionId}-urgency`}
                          value={String(level)}
                          aria-label={urgencyTierLabel(level)}
                          checked={urgency === String(level)}
                          onChange={() => setUrgency(String(level))}
                        />
                        <span className={styles.tierDigit} data-tier={level} aria-hidden="true">
                          {level}
                        </span>
                        <span className={styles.tierWords}>{words.charAt(0).toUpperCase() + words.slice(1)}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <Field
                label="ATS category"
                htmlFor={`${sectionId}-atsCategory`}
                hint="optional — does not change Ward Flow urgency"
              >
                <SelectBox>
                  <select
                    id={`${sectionId}-atsCategory`}
                    data-testid="ward-referral-drawer-atsCategory"
                    className={styles.fieldSelect}
                    aria-label="ATS category (optional)"
                    value={atsCategory ?? ""}
                    onChange={(event) =>
                      setAtsCategory(ATS_CATEGORIES.find((category) => String(category) === event.target.value))
                    }
                  >
                    <option value="">ATS not recorded</option>
                    {ATS_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        ATS {category}
                      </option>
                    ))}
                  </select>
                </SelectBox>
              </Field>
            </>
          )}
        </div>
      </section>
      {community ? (
        <DocumentationPanel
          key={activePatientKey}
          draft={documentation}
          onChange={setDocumentation}
          clearanceOnly
          idBase={`${sectionId}-refdocs`}
        />
      ) : null}

      <section className={styles.refCard}>
        <CardHead icon={Activity} title="Clinical presentation" />
        <div className={styles.cardBody}>
          <div className={styles.fieldGrid}>
            <Field label="Provisional diagnosis" htmlFor={`${sectionId}-refDiagSelect`} hint="optional">
              <SelectBox>
                <select
                  className={styles.fieldSelect}
                  id={`${sectionId}-refDiagSelect`}
                  value={provisionalDiag}
                  onChange={(e) => setProvisionalDiag(e.target.value)}
                >
                  <option value="">Not recorded</option>
                  {TENTATIVE_DIAGNOSIS_BLOCKS.map((block) => (
                    <option key={block.code} value={block.code}>
                      {block.label}
                    </option>
                  ))}
                </select>
              </SelectBox>
            </Field>
            <Field
              label="Reason for referral"
              htmlFor="refDocInput"
              required={reasonNoteRequired}
              hint={reasonNoteRequired ? undefined : "optional"}
              error={
                doctorNote.length > reasonRoom
                  ? `Shorten to ${reasonRoom} characters or fewer`
                  : attempted.referral && reasonNoteRequired && !doctorNote.trim()
                    ? "Give the reason for referral"
                    : null
              }
            >
              <input
                type="text"
                className={styles.fieldInput}
                id="refDocInput"
                maxLength={reasonRoom}
                placeholder="Why this service is needed"
                autoCorrect="off"
                autoCapitalize="sentences"
                enterKeyHint="done"
                value={doctorNote}
                onChange={(e) => setDoctorNote(e.target.value)}
                data-gramm="false"
                data-enable-grammarly="false"
                spellCheck={false}
                autoComplete="off"
              />
            </Field>
            <Field
              label="Patient story"
              htmlFor={`${sectionId}-refSummaryText`}
              hint={`${clinicalSummary.length}/10000`}
              wide
            >
              <textarea
                className={styles.clinicalTextarea}
                id={`${sectionId}-refSummaryText`}
                maxLength={10000}
                rows={2}
                placeholder="What changed today, history, current treatment"
                value={clinicalSummary}
                onChange={(e) => setClinicalSummary(e.target.value)}
                data-gramm="false"
                data-enable-grammarly="false"
                spellCheck={false}
                autoComplete="off"
              />
            </Field>
          </div>
          <fieldset className={styles.radioField}>
            <legend>
              Risk flags <span className={styles.fieldHint}>select all active</span>
            </legend>
            <div className={styles.checkGrid}>
              {(Object.keys(RISK_FLAG_LABELS) as (keyof typeof RISK_FLAG_LABELS)[]).map((key) => (
                <label key={key} className={styles.checkChip} data-checked={!!riskFlags[key]}>
                  <input type="checkbox" checked={!!riskFlags[key]} onChange={() => toggleRisk(key)} />
                  {RISK_FLAG_LABELS[key]}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </section>
      {destType === "ward" && (
        <section className={styles.refCard}>
          <CardHead icon={BedDouble} title="Bed requirements" />
          <div className={styles.cardBody}>
            <div className={styles.fieldGrid} data-layout="three">
              <Field label="Recorded sex" htmlFor={`${sectionId}-sex`}>
                <SelectBox>
                  <select
                    id={`${sectionId}-sex`}
                    className={styles.fieldSelect}
                    value={referralSex}
                    onChange={(e) => setReferralSex(e.target.value as RecordedSex)}
                  >
                    {RECORDED_SEXES.map((sex) => (
                      <option key={sex}>{sex}</option>
                    ))}
                  </select>
                </SelectBox>
              </Field>
              {/* WS-01 (workflow speed audit, 26 Oct 2026): gender decides which bed, so it is asked
                  before Send. "Not yet recorded" is a real answer; leaving it unanswered is not. */}
              <Field
                label="Gender identity"
                htmlFor={`${sectionId}-gender`}
                required
                error={attempted.referral && genderUnanswered ? GENDER_UNANSWERED : null}
              >
                <SelectBox>
                  <select
                    id={`${sectionId}-gender`}
                    className={styles.fieldSelect}
                    value={referralGender}
                    onChange={(e) => setReferralGender(e.target.value as ReferralGenderAnswer)}
                    data-testid="ward-referral-gender"
                  >
                    <option value="">Choose a gender</option>
                    <option value={REFERRAL_GENDER_NOT_RECORDED}>Not yet recorded</option>
                    {REFERRAL_GENDERS.map((gender) => (
                      <option key={gender}>{gender}</option>
                    ))}
                  </select>
                </SelectBox>
              </Field>
              <div className={styles.formField}>
                <div className={styles.fieldLabelRow}>
                  <span id={`${sectionId}-acuity`}>High-acuity nursing</span>
                </div>
                <span className={styles.switchRow}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={highAcuity}
                    aria-labelledby={`${sectionId}-acuity`}
                    className={styles.switch}
                    onClick={() => setHighAcuity((on) => !on)}
                  />
                  <span aria-hidden="true">{highAcuity ? "On" : "Off"}</span>
                </span>
              </div>
            </div>
            {genderReview ? (
              <p className={styles.reviewNote} role="note" data-testid="ward-referral-gender-review">
                <StatusGlyph tone="warning" size={9} />
                Gender or recorded sex is not female or male, or not yet recorded. The ward cannot accept until a
                coordinator records a reason after checking with the ward.
              </p>
            ) : null}
          </div>
        </section>
      )}
      {destType === "ed" && (
        <section className={styles.refCard} data-testid="ward-referral-needs">
          <CardHead icon={Ambulance} title="ED needs">
            <span className={styles.asideText}>Optional</span>
          </CardHead>
          <div className={styles.cardBody}>
            <div className={styles.fieldGrid}>
              <Choice
                legend="Coming by"
                name={`${sectionId}-coming-by`}
                options={ED_ARRIVAL_MODES}
                labels={{ "Mental Health Transport": "MH Transport", "Family or carer": "Family" }}
                value={edNeeds.comingBy}
                onChange={(comingBy) => setEdNeeds((n) => ({ ...n, comingBy }))}
              />
              <Choice
                legend="Medical review before psychiatry"
                name={`${sectionId}-medical-first`}
                options={YES_NO}
                value={yesNo(edNeeds.medicalReviewFirst)}
                onChange={(v) => setEdNeeds((n) => ({ ...n, medicalReviewFirst: v === "Yes" }))}
              />
              <Field label="Expected arrival, AWST" htmlFor={`${sectionId}-ed-arrival`}>
                <input
                  id={`${sectionId}-ed-arrival`}
                  type="time"
                  className={styles.fieldInput}
                  value={edNeeds.expectedArrival ?? ""}
                  onChange={(e) => setEdNeeds((n) => ({ ...n, expectedArrival: e.target.value || undefined }))}
                />
              </Field>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
