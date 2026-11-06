"use client";

import { CircleCheck, MapPin } from "lucide-react";
import {
  HEALTH_SERVICES,
  HOME_REGIONS,
  type HomeRegion,
  type HealthService,
} from "@/components/ward-management/ward-model";
import styles from "./ward-referral-drawer.module.css";
import { cx, StatusGlyph } from "@/components/wf";
import { catchmentRoutingDestinations, lookupCatchment } from "../ward-catchment";
import { communityTeamOptions, suburbOptions } from "./referral-destination-options";
import { catchmentForSuburb } from "./referral-catchment-suggestion";
import { Field, SelectBox, CardHead } from "./ward-referral-drawer-fields";
import type { WardReferralDrawerState } from "./use-ward-referral-drawer-state";

/**
 * The Catchment card of the referral's Patient step.
 *
 * RF1 (Current Issues, Josh 3 Nov 2026): when the suburb on the record points to one community team,
 * the card offers the whole catchment as one suggestion (team, service area and home region) with
 * "Use this catchment". Nothing is filled silently (Q223): the suggestion is accepted with one tap,
 * or Change opens the fields. The region and service area fields only show while there is something
 * for the referrer to choose.
 */
export function ReferralCatchmentCard({ s, addressLine }: { s: WardReferralDrawerState; addressLine: string }) {
  const {
    sectionId,
    destType,
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
    setFlowError,
    suburbKnown,
  } = s;
  const suggestion = catchmentTeam && !catchmentEditing ? catchmentForSuburb(catchmentSuburb, catchmentTeam) : null;
  // A confirmed team with no stored region is not finished: the region field shows for it rather
  // than the suggestion's region reading as confirmed.
  const region = homeRegion || (catchmentConfirmed ? "" : suggestion?.region) || "";
  const service = catchmentService || suggestion?.service || "";
  const offering = !!suggestion && !catchmentConfirmed && !catchmentNotKnown;
  // The fields show when there is no team yet, when Change is pressed, or when the region is still
  // to choose because the sources could not suggest one.
  const showFields = !catchmentTeam || catchmentEditing || !region;
  const facts = [region, service].filter(Boolean).join(" · ");

  const useSuggestion = () => {
    if (!homeRegion && suggestion?.region) setHomeRegion(suggestion.region);
    if (!catchmentService && suggestion?.service) setCatchmentService(suggestion.service);
    setCatchmentConfirmed(true);
    setCatchmentEditing(false);
    setFlowError(null);
  };
  const openFields = () => {
    // Move focus into the catchment fields opened by Change.
    setCatchmentEditing(true);
    setCatchmentConfirmed(false);
    window.requestAnimationFrame(() => document.getElementById(`${sectionId}-suburb`)?.focus());
  };

  return (
    <section className={styles.refCard}>
      <CardHead icon={MapPin} title="Catchment">
        <span className={styles.asideText}>
          {catchmentNotKnown ? (
            "Not known"
          ) : catchmentConfirmed ? (
            <>
              <StatusGlyph tone="success" size={9} /> Confirmed
            </>
          ) : offering ? (
            "Suggested"
          ) : (
            "Needs confirming"
          )}
        </span>
      </CardHead>
      <div className={styles.cardBody}>
        <p className={styles.catchmentStatus} data-testid="ward-referral-suburb-note">
          <MapPin aria-hidden="true" className={styles.catchmentStatusIcon} />
          <span>
            {!suburbKnown
              ? `${addressLine} · no suburb on the record`
              : addressLine.toLowerCase().includes(catchmentSuburb.trim().toLowerCase())
                ? addressLine
                : `${addressLine} · suburb ${catchmentSuburb.trim()}`}
          </span>
        </p>
        {catchmentTeam && !catchmentEditing ? (
          <div className={styles.suggestion} data-state={catchmentConfirmed ? "confirmed" : "suggested"}>
            {catchmentConfirmed ? <CircleCheck aria-hidden="true" className={styles.suggestionIcon} /> : null}
            <span className={styles.suggestionText}>
              <strong>{catchmentTeam}</strong>
              <small>
                {facts ? `${facts} · ` : ""}
                {catchmentConfirmed
                  ? "Catchment confirmed"
                  : catchmentSuburb
                    ? `Suggested from suburb ${catchmentSuburb}`
                    : "Check before continuing"}
              </small>
            </span>
            <div className={styles.suggestionActions}>
              {offering && region ? (
                <button
                  type="button"
                  className={cx(styles.btn, styles.btnTint)}
                  id={`${sectionId}-use-catchment`}
                  data-testid="ward-referral-use-catchment"
                  onClick={useSuggestion}
                >
                  <CircleCheck aria-hidden="true" />
                  Use this catchment
                </button>
              ) : null}
              <button type="button" className={styles.btn} onClick={openFields}>
                Change
              </button>
            </div>
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
            <Field label="Community team" htmlFor={`${sectionId}-team`}>
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
        {showFields ? (
          <>
            <div className={styles.fieldGrid}>
              <Field label="Home region" htmlFor={`${sectionId}-region`}>
                <SelectBox>
                  <select
                    id={`${sectionId}-region`}
                    className={styles.fieldSelect}
                    value={homeRegion}
                    onChange={(e) => {
                      setHomeRegion(e.target.value as HomeRegion);
                      // The region is its own answer; a team already confirmed stays so,
                      // so choosing it does not ask for the catchment a second time.
                      if (!catchmentTeam.trim()) setCatchmentConfirmed(false);
                    }}
                  >
                    <option value="">Choose region</option>
                    {HOME_REGIONS.map((option) => (
                      <option key={option}>{option}</option>
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
                    {HEALTH_SERVICES.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </SelectBox>
              </Field>
            </div>
            <div className={styles.catchmentFoot}>
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
              <div className={cx(styles.confirmRow, styles.confirmEnd)}>
                {catchmentNotKnown ? (
                  <span className={styles.confirmedNote} data-testid="ward-referral-catchment-not-known-note">
                    <StatusGlyph tone="warning" size={10} />
                    Catchment not known.
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
                      aria-describedby={!catchmentTeam.trim() || !homeRegion ? `${sectionId}-catchment-why` : undefined}
                      onClick={() => {
                        if (!catchmentTeam.trim() || !homeRegion) return;
                        setCatchmentConfirmed(true);
                        setCatchmentEditing(false);
                        setFlowError(null);
                      }}
                    >
                      <CircleCheck aria-hidden="true" />
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
          </>
        ) : null}
        {/* FORM-REF (Josh, 5 Nov 2026): the catchment and home region warn in Before you send and
            never block, so another step error marks nothing here invalid. */}
      </div>
    </section>
  );
}
