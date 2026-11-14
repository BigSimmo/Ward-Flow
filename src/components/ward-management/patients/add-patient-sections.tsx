"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { RECORDED_SEXES, type RecordedSex } from "@/components/ward-management/ward-model-vocabulary";
import { ADMIN_DETAIL_FIELDS } from "@/components/ward-management/ward-patients";
import {
  ABORIGINAL_OR_TORRES_STRAIT_ISLANDER_STATUSES,
  type AboriginalOrTorresStraitIslanderStatus,
} from "@/components/ward-management/ward-patient-aboriginal-status";
import { type ChoiceItem, Field, Icon, Segmented, TextInput } from "@/components/wf";

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
 *
 * Note 3 (Josh, 8 Nov 2026): "add all other information healthcare administrators or clerks require
 * ... as optional additions rather than requirements", and make the page "streamlined, compact and
 * clear of the components that are optional". The optional card now holds every non-required field
 * (sex, gender and suburb moved in from Core details), in seven short folds. Each fold names its
 * contents in a few words and, once something is added, how many. The groups follow the WA Health
 * admitted-patient data items a clerk records at registration (contact, next of kin and nominated
 * person, Medicare and funding, GP, country of birth, interpreter, marital status) plus the advance
 * health directive and enduring guardian a psychiatric admission asks about.
 */

/** The optional typed details. A blank one is sent as absent, never stored as "". */
const EXTRA_FIELDS = [
  "suburb",
  "preferredName",
  "address",
  "generalPractitioner",
  "catchmentCommunityTeam",
  "interpreterLanguage",
  ...ADMIN_DETAIL_FIELDS,
] as const;

export type PatientExtras = Record<(typeof EXTRA_FIELDS)[number], string>;

export const EMPTY_EXTRAS: PatientExtras = Object.fromEntries(EXTRA_FIELDS.map((key) => [key, ""])) as PatientExtras;

/** The filled details only, trimmed, ready for the ADD_PATIENT payload. */
export function filledExtras(extras: PatientExtras): Partial<PatientExtras> {
  const out: Partial<PatientExtras> = {};
  for (const key of EXTRA_FIELDS) {
    const value = (extras[key] ?? "").trim();
    if (value !== "") out[key] = value;
  }
  return out;
}

export function extrasEntered(extras: PatientExtras): boolean {
  return EXTRA_FIELDS.some((key) => (extras[key] ?? "").trim() !== "");
}

/** Recorded sex (WT-05). "Not recorded" leaves the key absent; nothing starts chosen. */
/** The longest text the server accepts in one field; equals `MAX_TEXT` in backend/ward-flow/command-schemas.ts. */
export const PATIENT_TEXT_LIMIT = 4000;

/** The first optional text field over the server limit, named for a refusal ("Street address is too long"). */
export function overLimitFieldLabel(extras: PatientExtras): string | undefined {
  for (const fold of FOLDS) {
    for (const field of fold.fields) {
      if (!("choice" in field) && (extras[field.key] ?? "").length > PATIENT_TEXT_LIMIT) return field.label;
    }
  }
  return undefined;
}

export const SEX_UNCHOSEN = "" as const;
export type SexChoice = RecordedSex | typeof SEX_UNCHOSEN;
export const SEX_ITEMS: ChoiceItem<SexChoice>[] = RECORDED_SEXES.map((sex) => ({ id: sex, label: sex }));

/** Finding 51 (Josh, 27 Oct 2026): saved when answered. It opens blank and never blocks. */
export const INDIGENOUS_STATUS_UNANSWERED = "" as const;
export type IndigenousStatusChoice = AboriginalOrTorresStraitIslanderStatus | typeof INDIGENOUS_STATUS_UNANSWERED;

const INDIGENOUS_ITEMS: ChoiceItem<IndigenousStatusChoice>[] = ABORIGINAL_OR_TORRES_STRAIT_ISLANDER_STATUSES.map(
  (status) => ({ id: status, label: status }),
);

/** The listed answers for the chosen (not typed) details. Blank is "not recorded". */
const CHOICES = {
  maritalStatus: ["Never married", "Married", "De facto", "Separated", "Divorced", "Widowed", "Not stated"],
  supportPersonRole: ["Nominated person", "Carer", "Close family member", "Other personal support person"],
  healthFund: ["Public (no private cover)", "Private health insurance", "DVA", "Not stated"],
  interpreterRequired: ["Yes", "No"],
  advanceHealthDirective: ["Yes, sighted", "Yes, not sighted", "No", "Not known"],
} as const satisfies Partial<Record<keyof PatientExtras, readonly string[]>>;

type ChoiceKey = keyof typeof CHOICES;

type FieldSpec = {
  key: keyof PatientExtras;
  label: string;
  /** A short example of the expected form, shown as the placeholder. Never enforced. */
  hint?: string;
  wide?: boolean;
  mono?: boolean;
  inputMode?: "tel" | "email" | "numeric" | "text";
  capitalize?: "words" | "sentences" | "characters" | "none";
};

type FoldSpec = {
  id: string;
  title: string;
  holds: string;
  fields: readonly (FieldSpec | { choice: ChoiceKey; label: string })[];
};

const FOLDS: readonly FoldSpec[] = [
  {
    id: "contact",
    title: "Contact and address",
    holds: "Phones, email, address",
    fields: [
      { key: "preferredName", label: "Preferred name" },
      { key: "mobilePhone", label: "Mobile", hint: "04xx xxx xxx", inputMode: "tel", mono: true },
      { key: "otherPhone", label: "Other phone", hint: "Home or work", inputMode: "tel", mono: true },
      { key: "email", label: "Email", inputMode: "email", capitalize: "none" },
      { key: "address", label: "Street address", wide: true, capitalize: "sentences" },
      { key: "suburb", label: "Suburb" },
      { key: "postcode", label: "Postcode", hint: "6000", inputMode: "numeric", mono: true },
    ],
  },
  {
    id: "kin",
    title: "Next of kin and carer",
    holds: "Next of kin, nominated person or carer",
    fields: [
      { key: "nextOfKinName", label: "Next of kin" },
      { key: "nextOfKinRelationship", label: "Relationship", hint: "e.g. Sister" },
      { key: "nextOfKinPhone", label: "Their phone", inputMode: "tel", mono: true },
      { choice: "supportPersonRole", label: "Support person role" },
      { key: "supportPersonName", label: "Their name" },
      { key: "supportPersonPhone", label: "Their phone", inputMode: "tel", mono: true },
    ],
  },
  {
    id: "funding",
    title: "Medicare and funding",
    holds: "Medicare, DVA, health fund",
    fields: [
      { key: "medicareNumber", label: "Medicare number", hint: "0000 00000 0", inputMode: "numeric", mono: true },
      { key: "medicareReference", label: "Reference (IRN)", hint: "1", inputMode: "numeric", mono: true },
      { key: "medicareExpiry", label: "Card expiry", hint: "MM/YYYY", inputMode: "numeric", mono: true },
      { choice: "healthFund", label: "Funding" },
      { key: "dvaFileNumber", label: "DVA file number", mono: true, capitalize: "characters" },
      { key: "concessionCard", label: "Pension or concession card", mono: true, capitalize: "characters" },
    ],
  },
  {
    id: "care",
    title: "GP and community team",
    holds: "GP, practice phone, community team",
    fields: [
      { key: "generalPractitioner", label: "GP and practice", capitalize: "sentences" },
      { key: "gpPhone", label: "Practice phone", inputMode: "tel", mono: true },
      { key: "catchmentCommunityTeam", label: "Community mental health team" },
    ],
  },
  {
    id: "culture",
    title: "Culture and language",
    holds: "Aboriginal or Torres Strait Islander status, language, interpreter",
    fields: [
      { key: "countryOfBirth", label: "Country of birth" },
      { key: "interpreterLanguage", label: "Preferred language" },
      { choice: "interpreterRequired", label: "Interpreter needed" },
    ],
  },
  {
    id: "legal",
    title: "Personal and planning",
    holds: "Marital status, advance health directive, enduring guardian",
    fields: [
      { choice: "maritalStatus", label: "Marital status" },
      { choice: "advanceHealthDirective", label: "Advance health directive" },
      { key: "enduringGuardian", label: "Enduring guardian" },
    ],
  },
];

/** One fold: a title, a few words on what it holds, how many are added, and its fields. */
function AddPatientFold({
  title,
  holds,
  added,
  open,
  onToggle,
  testId,
  children,
}: {
  title: string;
  holds: string;
  added: number;
  open: boolean;
  onToggle: (open: boolean) => void;
  testId: string;
  children: ReactNode;
}) {
  return (
    <details
      className={styles.fold}
      data-testid={testId}
      data-fold={testId.replace("ward-add-patient-fold-", "")}
      open={open}
      onToggle={(event) => onToggle(event.currentTarget.open)}
    >
      <summary className={styles.foldHead}>
        <span className={styles.foldLines}>
          <span className={styles.foldTitle}>{title}</span>
          <span className={styles.foldSummary} data-testid={`${testId}-summary`}>
            {holds}
          </span>
        </span>
        {added > 0 ? (
          <span className={styles.foldCount} data-testid={`${testId}-count`}>
            {added} added
          </span>
        ) : null}
        <Icon icon={ChevronDown} size={16} className={styles.foldChevron} />
      </summary>
      <div className={styles.foldBody}>{children}</div>
    </details>
  );
}

/** A plain optional text field inside a fold. */
function ExtraText({
  id,
  spec,
  value,
  onChange,
  help,
}: {
  id: string;
  spec: FieldSpec;
  value: string;
  onChange: (value: string) => void;
  help?: ReactNode;
}) {
  return (
    <Field label={spec.label} id={id} className={spec.wide ? styles.span2 : undefined} help={help}>
      <TextInput
        data-testid={id}
        maxLength={PATIENT_TEXT_LIMIT}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize={spec.capitalize ?? "words"}
        spellCheck={false}
        enterKeyHint="done"
        inputMode={spec.inputMode}
        type={spec.inputMode === "email" ? "email" : "text"}
        placeholder={spec.hint}
        className={spec.mono ? styles.mono : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

/** A listed answer, as chips. Nothing chosen sends nothing. */
function ExtraChoice({
  id,
  label,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  // RF7 (Josh, 3 Nov 2026): no browser controls. Nothing starts chosen, and pressing the chosen
  // option again clears it back to not recorded.
  return (
    <div className={`${styles.choiceField} ${styles.spanAll}`} data-testid={id}>
      <span className={styles.choiceLabel}>{label}</span>
      <Segmented
        label={label}
        items={options.map((option) => ({ id: option, label: option }))}
        value={value}
        onChange={(next) => onChange(next === value ? "" : next)}
        className={`${styles.segmented} ${styles.segmentedWrap}`}
      />
    </div>
  );
}

const kebab = (key: string) => key.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`);

/** RF7's test ids for the fields that had them, so their checks keep their names. */
const LEGACY_IDS: Partial<Record<keyof PatientExtras, string>> = {
  generalPractitioner: "ward-add-patient-gp",
  catchmentCommunityTeam: "ward-add-patient-community-team",
  interpreterLanguage: "ward-add-patient-interpreter-language",
};
const fieldId = (key: keyof PatientExtras) => LEGACY_IDS[key] ?? `ward-add-patient-${kebab(key)}`;

export function AddPatientMoreDetails({
  extras,
  onExtra,
  indigenousStatus,
  onIndigenousStatus,
  aboutPerson,
  aboutAdded,
  suburbHelp,
  openFolds,
  onFold,
}: {
  extras: PatientExtras;
  onExtra: (key: keyof PatientExtras) => (value: string) => void;
  indigenousStatus: IndigenousStatusChoice;
  onIndigenousStatus: (status: IndigenousStatusChoice) => void;
  /** Gender, drawn by the page that holds their state. */
  aboutPerson: ReactNode;
  aboutAdded: number;
  suburbHelp?: ReactNode;
  openFolds: ReadonlySet<string>;
  onFold: (id: string, open: boolean) => void;
}) {
  const has = (key: keyof PatientExtras) => (extras[key] ?? "").trim() !== "";
  const foldProps = (id: string) => ({
    open: openFolds.has(id),
    onToggle: (open: boolean) => onFold(id, open),
    testId: `ward-add-patient-fold-${id}`,
  });
  return (
    <div id={ADD_PATIENT_FOLDS_ID} className={styles.folds} data-testid="ward-add-patient-more-details">
      <AddPatientFold title="Gender" holds="Gender is used for bed matching" added={aboutAdded} {...foldProps("about")}>
        {aboutPerson}
      </AddPatientFold>
      {FOLDS.map((fold) => {
        const keys = fold.fields.map((field) => ("choice" in field ? field.choice : field.key));
        const added =
          keys.filter(has).length +
          (fold.id === "culture" && indigenousStatus !== INDIGENOUS_STATUS_UNANSWERED ? 1 : 0);
        return (
          <AddPatientFold key={fold.id} title={fold.title} holds={fold.holds} added={added} {...foldProps(fold.id)}>
            {fold.id === "culture" ? (
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
            ) : null}
            {fold.fields.map((field) =>
              "choice" in field ? (
                <ExtraChoice
                  key={field.choice}
                  id={fieldId(field.choice)}
                  label={field.label}
                  options={CHOICES[field.choice]}
                  value={extras[field.choice] ?? ""}
                  onChange={onExtra(field.choice)}
                />
              ) : (
                <ExtraText
                  key={field.key}
                  id={fieldId(field.key)}
                  spec={field}
                  value={extras[field.key] ?? ""}
                  onChange={onExtra(field.key)}
                  help={field.key === "suburb" ? suburbHelp : undefined}
                />
              ),
            )}
          </AddPatientFold>
        );
      })}
    </div>
  );
}

/** The folds' ids, in order, for "Open all". */
/** The folds' wrapper, which the Open all button controls. */
export const ADD_PATIENT_FOLDS_ID = "ward-add-patient-folds";

export const FOLD_IDS = ["about", ...FOLDS.map((fold) => fold.id)] as const;
