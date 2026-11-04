"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { RECORDED_SEXES, type RecordedSex } from "@/components/ward-management/ward-model-vocabulary";
import {
  ABORIGINAL_OR_TORRES_STRAIT_ISLANDER_STATUSES,
  type AboriginalOrTorresStraitIslanderStatus,
} from "@/components/ward-management/ward-patient-aboriginal-status";
import { type ChoiceItem, Field, Icon, Segmented, StatusGlyph, TextInput } from "@/components/wf";

import styles from "./add-patient.module.css";

/**
 * RF7 (Josh, 3 Nov 2026): "make this page more of an administrative page where there is an option
 * to add all the different information possible for a patient ... only include at the top the core
 * information required for a patient with the section underneath for added information."
 *
 * The folded sections under Core details. Each is closed when the page opens, says in one line what
 * it holds or what has been added, and never blocks adding the patient: only the four identity
 * fields are required. The groups follow the patient page's Details tab. Legal status is not here:
 * it belongs to the referral or the movement (D-77).
 */

/** The optional typed details. A blank one is sent as absent, never stored as "". */
export type PatientExtras = {
  suburb: string;
  preferredName: string;
  address: string;
  generalPractitioner: string;
  catchmentCommunityTeam: string;
  interpreterLanguage: string;
};

export const EMPTY_EXTRAS: PatientExtras = {
  suburb: "",
  preferredName: "",
  address: "",
  generalPractitioner: "",
  catchmentCommunityTeam: "",
  interpreterLanguage: "",
};

/** The filled details only, trimmed, ready for the ADD_PATIENT payload. */
export function filledExtras(extras: PatientExtras): Partial<PatientExtras> {
  const out: Partial<PatientExtras> = {};
  for (const key of Object.keys(extras) as (keyof PatientExtras)[]) {
    const value = extras[key].trim();
    if (value !== "") out[key] = value;
  }
  return out;
}

export function extrasEntered(extras: PatientExtras): boolean {
  return Object.values(extras).some((value) => value.trim() !== "");
}

/** Recorded sex (WT-05). "Not recorded" leaves the key absent; nothing starts chosen. */
export const SEX_UNCHOSEN = "" as const;
export type SexChoice = RecordedSex | typeof SEX_UNCHOSEN;
export const SEX_ITEMS: ChoiceItem<SexChoice>[] = RECORDED_SEXES.map((sex) => ({ id: sex, label: sex }));

/** Finding 51 (Josh, 27 Oct 2026): saved when answered. It opens blank and never blocks. */
export const INDIGENOUS_STATUS_UNANSWERED = "" as const;
export type IndigenousStatusChoice = AboriginalOrTorresStraitIslanderStatus | typeof INDIGENOUS_STATUS_UNANSWERED;
const INDIGENOUS_ITEMS: ChoiceItem<IndigenousStatusChoice>[] = ABORIGINAL_OR_TORRES_STRAIT_ISLANDER_STATUSES.map(
  (status) => ({ id: status, label: status }),
);

/** One folded section: a title, a line saying what it holds or what has been added, and its fields. */
function AddPatientFold({
  title,
  holds,
  added,
  testId,
  children,
}: {
  title: string;
  /** What the section holds, in words, shown while nothing is added. */
  holds: string;
  /** The names of the fields already filled in, in field order. */
  added: readonly string[];
  testId: string;
  children: ReactNode;
}) {
  return (
    <details className={styles.fold} data-testid={testId}>
      <summary className={styles.foldHead}>
        <span className={styles.foldLines}>
          <span className={styles.foldTitle}>{title}</span>
          <span className={styles.foldSummary} data-testid={`${testId}-summary`}>
            {added.length > 0 ? (
              <>
                <StatusGlyph tone="success" size={9} />
                Added: {added.join(", ")}
              </>
            ) : (
              `Optional · ${holds}`
            )}
          </span>
        </span>
        <Icon icon={ChevronDown} size={16} className={styles.foldChevron} />
      </summary>
      <div className={styles.foldBody}>{children}</div>
    </details>
  );
}

/** A plain optional text field inside a fold. */
function ExtraText({
  id,
  label,
  value,
  onChange,
  autoCapitalize = "words",
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoCapitalize?: "words" | "sentences";
  className?: string;
}) {
  return (
    <Field label={label} id={id} className={className}>
      <TextInput
        data-testid={id}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize={autoCapitalize}
        spellCheck={false}
        enterKeyHint="done"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

/** The names of the filled fields, in the order given. */
function addedNames(entries: readonly (readonly [string, boolean])[]): string[] {
  return entries.filter(([, on]) => on).map(([name]) => name);
}

export function AddPatientMoreDetails({
  extras,
  onExtra,
  indigenousStatus,
  onIndigenousStatus,
}: {
  extras: PatientExtras;
  onExtra: (key: keyof PatientExtras) => (value: string) => void;
  indigenousStatus: IndigenousStatusChoice;
  onIndigenousStatus: (status: IndigenousStatusChoice) => void;
}) {
  const has = (key: keyof PatientExtras) => extras[key].trim() !== "";
  return (
    <div className={styles.folds} data-testid="ward-add-patient-more-details">
      <AddPatientFold
        title="Contact and address"
        holds="preferred name, street address"
        added={addedNames([
          ["preferred name", has("preferredName")],
          ["street address", has("address")],
        ])}
        testId="ward-add-patient-fold-contact"
      >
        <ExtraText
          id="ward-add-patient-preferred-name"
          label="Preferred name"
          value={extras.preferredName}
          onChange={onExtra("preferredName")}
        />
        <ExtraText
          id="ward-add-patient-address"
          label="Street address"
          value={extras.address}
          onChange={onExtra("address")}
          autoCapitalize="sentences"
        />
      </AddPatientFold>
      <AddPatientFold
        title="Care links"
        holds="GP, community team"
        added={addedNames([
          ["GP", has("generalPractitioner")],
          ["community team", has("catchmentCommunityTeam")],
        ])}
        testId="ward-add-patient-fold-care"
      >
        <ExtraText
          id="ward-add-patient-gp"
          label="GP"
          value={extras.generalPractitioner}
          onChange={onExtra("generalPractitioner")}
          autoCapitalize="sentences"
        />
        <ExtraText
          id="ward-add-patient-community-team"
          label="Catchment community team"
          value={extras.catchmentCommunityTeam}
          onChange={onExtra("catchmentCommunityTeam")}
        />
      </AddPatientFold>
      <AddPatientFold
        title="Culture and language"
        holds="Aboriginal or Torres Strait Islander status, language"
        added={addedNames([
          ["Aboriginal or Torres Strait Islander status", indigenousStatus !== INDIGENOUS_STATUS_UNANSWERED],
          ["language", has("interpreterLanguage")],
        ])}
        testId="ward-add-patient-fold-culture"
      >
        <div className={`${styles.choiceField} ${styles.spanAll}`} data-testid="ward-add-patient-indigenous">
          <span className={styles.choiceLabel}>Aboriginal or Torres Strait Islander</span>
          <Segmented
            label="Aboriginal or Torres Strait Islander"
            items={INDIGENOUS_ITEMS}
            value={indigenousStatus}
            onChange={onIndigenousStatus}
            className={`${styles.segmented} ${styles.segmentedWrap}`}
          />
        </div>
        <ExtraText
          id="ward-add-patient-interpreter-language"
          label="Interpreter / preferred language"
          value={extras.interpreterLanguage}
          onChange={onExtra("interpreterLanguage")}
        />
      </AddPatientFold>
    </div>
  );
}
