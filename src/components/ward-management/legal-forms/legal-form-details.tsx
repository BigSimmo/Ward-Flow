"use client";

import { useState } from "react";
import { useWardFormSave } from "../use-ward-form-save";
import type { WardCommandDispatch } from "../ward-shared-client";
import { useWardDraftAcceptance } from "../use-ward-draft-acceptance";
import { useKeepLayoutDraft, useKeptLayoutDraft } from "../use-layout-draft";

import { Button, DateField, Field, ListPicker, parseTypedDate, Segmented } from "@/components/wf";
import { calendarDateOf, type Instant, perthIsoDay } from "@/components/ward-management/ward-clock";
import type {
  LegalFormConsentState,
  LegalFormCopyState,
  LegalFormEnding,
  LegalFormMakerRole,
  Movement,
} from "@/components/ward-management/ward-model";

import { instantFromDateAndTimeInputs } from "./legal-forms-view";
import styles from "./legal-forms.module.css";
import p from "./legal-forms-panel.module.css";

/**
 * DETAILS FROM THE PAPER (gap list items 3 to 7, Josh 4 Nov 2026).
 *
 * Who made the form (a role, never a name), whether the person was given a copy, how the form
 * ended, the Chief Psychiatrist's consent for a Form 6B, and a review by date typed from the paper.
 * Each is optional and recorded by a person. Nothing here is checked against the Act or worked out
 * from it (D-72, D-93): the review date is the one written on the form.
 */

const MAKER_LABEL: Record<LegalFormMakerRole, string> = {
  medical_practitioner: "Medical practitioner",
  amhp: "Authorised mental health practitioner",
  psychiatrist: "Psychiatrist",
  mental_health_practitioner: "Mental health practitioner",
  person_in_charge: "Person in charge of the ward",
};
const COPY_LABEL: Record<LegalFormCopyState, string> = { yes: "Given", declined: "Declined", not_yet: "Not yet" };
const ENDING_LABEL: Record<LegalFormEnding, string> = {
  revoked: "Revoked",
  form_3e: "Form 3E made",
  replaced: "Replaced by a new form",
  ended_as_typed: "Ended at the typed time",
};
const CONSENT_LABEL: Record<LegalFormConsentState, string> = { yes: "Given", not_yet: "Not yet" };

/** What the save sends: omitted keeps a value, null clears it. */
export type LegalFormDetailsSave = {
  madeBy?: LegalFormMakerRole | null;
  copyGiven?: LegalFormCopyState | null;
  endedBy?: LegalFormEnding | null;
  consent?: LegalFormConsentState | null;
  reviewBy?: Instant | null;
};

const NOT_RECORDED = "Not recorded";

/** C19: an open details form's unsaved entries, kept across the phone and wide layouts. */
type DetailsDraft = {
  madeBy: string | null;
  copyGiven: string;
  endedBy: string | null;
  consent: string;
  review: string;
  reviewUnread: boolean;
};

/**
 * The Perth calendar day of a recorded review date, as the ISO value the date box holds. From the
 * clock's own helpers, not a Canadian locale's date order, which no standard promises (time audit D12).
 */
function isoDay(instant: Instant | undefined, dayZero: Date): string {
  if (instant === undefined) return "";
  return perthIsoDay(calendarDateOf(instant, dayZero));
}

/** DD/MM/YYYY for reading. */
function shownDay(instant: Instant, dayZero: Date): string {
  const [year, month, day] = isoDay(instant, dayZero).split("-");
  return `${day}/${month}/${year}`;
}

export function LegalFormDetailsSection({
  movement,
  dayZero,
  unavailable,
  onSave,
}: {
  movement: Movement;
  dayZero: Date;
  /** Why this desk may not record details, if it may not. */
  unavailable?: string;
  onSave: (details: LegalFormDetailsSave, onAccepted: () => void) => ReturnType<WardCommandDispatch>;
}) {
  const form = movement.legalForm;
  // C19: the twin form in the other layout, open at the moment the screen crossed the phone width.
  const draftKey = `legal-details:${movement.id}`;
  const kept = useKeptLayoutDraft<DetailsDraft>(draftKey);
  const [editing, setEditing] = useState(kept !== undefined);
  const [madeBy, setMadeBy] = useState<string | null>(kept ? kept.madeBy : (form?.madeBy ?? null));
  const [copyGiven, setCopyGiven] = useState<string>(kept?.copyGiven ?? form?.copyGiven ?? "not_recorded");
  const [endedBy, setEndedBy] = useState<string | null>(kept ? kept.endedBy : (form?.endedBy ?? null));
  const [consent, setConsent] = useState<string>(kept?.consent ?? form?.consent ?? "not_recorded");
  const [review, setReview] = useState(kept?.review ?? isoDay(form?.reviewBy, dayZero));
  // Text in the date box that is not yet a real day. It never counts as blank, so a typo cannot clear
  // a recorded review date.
  const [reviewUnread, setReviewUnread] = useState(kept?.reviewUnread ?? false);
  useKeepLayoutDraft<DetailsDraft>(
    draftKey,
    editing ? { madeBy, copyGiven, endedBy, consent, review, reviewUnread } : undefined,
  );
  const command = useWardFormSave(`legal-details:${movement.id}`);
  const acceptDraft = useWardDraftAcceptance(
    JSON.stringify([madeBy, copyGiven, endedBy, consent, review, reviewUnread]),
    editing,
  );
  if (!form) return null;

  const is6B = form.code === "6B";
  const reviewTyped = review.trim() !== "";
  // A review by date is a day on the paper. It is held as that day's start, Perth time, as typed.
  const reviewAt = reviewTyped ? (instantFromDateAndTimeInputs(review, "00:00", dayZero) ?? null) : null;
  const reviewProblem =
    reviewUnread || (reviewTyped && reviewAt === null) ? "Type the review date as DD/MM/YYYY" : undefined;

  const rows: Array<{ label: string; value: string }> = [
    { label: "Made by", value: form.madeBy ? MAKER_LABEL[form.madeBy] : NOT_RECORDED },
    { label: "Copy to the person", value: form.copyGiven ? COPY_LABEL[form.copyGiven] : NOT_RECORDED },
    {
      label: "Review by",
      value: form.reviewBy === undefined ? NOT_RECORDED : shownDay(form.reviewBy, dayZero),
    },
    ...(is6B
      ? [{ label: "Chief Psychiatrist consent", value: form.consent ? CONSENT_LABEL[form.consent] : NOT_RECORDED }]
      : []),
    ...(form.endedBy ? [{ label: "How it ended", value: ENDING_LABEL[form.endedBy] }] : []),
  ];

  const save = () => {
    if (reviewProblem || unavailable || command.pending) return;
    const accepted = acceptDraft(() => setEditing(false));
    command.submit(
      () =>
        onSave(
          {
            madeBy: (madeBy as LegalFormMakerRole | null) ?? null,
            copyGiven: copyGiven === "not_recorded" ? null : (copyGiven as LegalFormCopyState),
            endedBy: (endedBy as LegalFormEnding | null) ?? null,
            ...(is6B ? { consent: consent === "not_recorded" ? null : (consent as LegalFormConsentState) } : {}),
            reviewBy: reviewAt,
          },
          accepted,
        ),
      accepted,
    );
  };

  return (
    <div className={p.section} data-testid="ward-legal-form-details">
      <div className={p.sectionHead}>
        <h3 className={p.eyebrow}>From the paper</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            // Start each edit from the record as it stands now, never an earlier form's draft.
            if (!editing) {
              setMadeBy(form.madeBy ?? null);
              setCopyGiven(form.copyGiven ?? "not_recorded");
              setEndedBy(form.endedBy ?? null);
              setConsent(form.consent ?? "not_recorded");
              setReview(isoDay(form.reviewBy, dayZero));
              setReviewUnread(false);
            }
            setEditing((value) => !value);
          }}
          disabledReason={editing ? undefined : unavailable}
          reasonDisplay="tooltip"
          data-testid="ward-legal-form-details-edit"
        >
          {editing ? "Keep" : "Edit"}
        </Button>
      </div>
      {editing ? (
        <div className={p.detailsForm}>
          <ListPicker
            label="Made by"
            placeholder="Choose a role"
            value={madeBy}
            onChange={setMadeBy}
            options={Object.entries(MAKER_LABEL).map(([value, label]) => ({ value, label }))}
            testId="ward-legal-form-details-made-by"
          />
          <div className={p.choice}>
            <span className={p.choiceLabel} aria-hidden="true">
              Copy to the person
            </span>
            <Segmented
              label="Copy to the person"
              size="sm"
              value={copyGiven}
              onChange={setCopyGiven}
              items={[
                { id: "not_recorded", label: NOT_RECORDED },
                { id: "yes", label: "Given" },
                { id: "declined", label: "Declined" },
                { id: "not_yet", label: "Not yet" },
              ]}
            />
          </div>
          {is6B ? (
            <div className={p.choice}>
              <span className={p.choiceLabel} aria-hidden="true">
                Chief Psychiatrist consent
              </span>
              <Segmented
                label="Chief Psychiatrist consent"
                size="sm"
                value={consent}
                onChange={setConsent}
                items={[
                  { id: "not_recorded", label: NOT_RECORDED },
                  { id: "yes", label: "Given" },
                  { id: "not_yet", label: "Not yet" },
                ]}
              />
            </div>
          ) : null}
          <Field
            label="Review by, as on the form"
            id={`legal-form-details-review-${movement.id}`}
            hint="DD/MM/YYYY"
            error={reviewProblem}
          >
            <DateField
              value={review}
              onValueChange={setReview}
              onInput={(event) =>
                setReviewUnread(
                  parseTypedDate(event.currentTarget.value) === null && event.currentTarget.value.trim() !== "",
                )
              }
            />
          </Field>
          <ListPicker
            label="How it ended"
            placeholder="Still in force"
            value={endedBy}
            onChange={setEndedBy}
            // D-210 (Josh, 14 Nov 2026), ruling 6: a Form 3E is recorded as a new form, so "Form 3E
            // made" is offered only where an old record already holds it.
            options={Object.entries(ENDING_LABEL)
              .filter(([value]) => value !== "form_3e" || form?.endedBy === "form_3e")
              .map(([value, label]) => ({ value, label }))}
            testId="ward-legal-form-details-ended"
          />
          {command.error ? (
            <p className={styles.note} role="alert">
              {command.error}
            </p>
          ) : null}
          <div className={styles.writtenFoot}>
            <Button
              variant="sec"
              size="sm"
              onClick={save}
              disabledReason={command.pending ? "Saving" : (unavailable ?? reviewProblem)}
              reasonDisplay="tooltip"
              data-testid="ward-legal-form-details-save"
            >
              Save details
            </Button>
          </div>
        </div>
      ) : (
        <dl className={p.detailsList}>
          {rows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
