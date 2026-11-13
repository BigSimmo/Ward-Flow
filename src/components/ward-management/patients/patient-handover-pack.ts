/**
 * ED-to-ward handover pack (item 17): one printable page and one copy text for a movement a ward
 * has accepted. Built only from what the record holds; a field with nothing recorded says
 * "Not recorded". The request rows (urgency, legal status, clearance, risks) come from
 * `referralLetterModel`, so the pack and the referral letter read the same words.
 *
 * Never sent anywhere: the pack is printed or copied by a person. Copy goes through
 * `ward-clipboard`, which drops the UMRN and any date of birth. Legal times show only as typed
 * (D-93), never as a countdown. Ward Flow holds no medication list, and the pack says so.
 * Synthetic prototype, not a medical device.
 */
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { SYNTHETIC_COPY_LINE } from "@/components/ward-management/ward-clipboard";
import { FORM_RECORDED_ENDED, formRecordedEnded } from "@/components/ward-management/ward-legal-form-ended";
import { typedTimeLine } from "@/components/ward-management/legal-forms/legal-time-as-typed";
import { legalStatusFull } from "@/components/ward-management/ward-legal-forms";
import type { Movement } from "@/components/ward-management/ward-model";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import type { AdmissionChecklistItem } from "@/components/ward-management/ward-admission-checklist";
import { riskFlagLabel } from "@/components/ward-management/referrals/referral-risk-flags";
import {
  referralLetterModel,
  type ReferralLetterRow,
  type ReferralTextInput,
} from "@/components/ward-management/referrals/referral-letter";

const NOT_RECORDED = "Not recorded";

export type HandoverContact = { readonly name: string; readonly role: string; readonly number?: string | null };

export type HandoverPackInput = {
  readonly movement: Pick<
    Movement,
    | "id"
    | "urgency"
    | "legalStatus"
    | "legalForm"
    | "acceptedUnitId"
    | "acceptedAt"
    | "closure"
    | "allocatedBed"
    | "heldBedNumber"
    | "medicationChartDone"
  >;
  /** As the patient page shows them. */
  readonly patient: { readonly name: string; readonly umrn: string; readonly ageSex: string };
  /** The sending emergency department, as the page names it. */
  readonly fromName: string | undefined;
  /** The accepting ward's name. */
  readonly wardName: string | undefined;
  /**
   * Risk flags from `referralSafetyFacts` only (H10): the list as recorded, `undefined` when no
   * referral stands behind the movement, "not_shared" when this desk cannot see that referral.
   */
  readonly riskFlags: readonly string[] | undefined | "not_shared";
  /** `recordedMovementMedicalClearance`, the movement's or its referral's latest answer. */
  readonly clearance: { readonly cleared: boolean; readonly at: Instant } | undefined;
  /** The current paper's typed expiry (`currentLegalDueAt`), if one was typed. */
  readonly paperExpiryAt: Instant | undefined;
  readonly edContacts: readonly HandoverContact[];
  readonly careContacts: readonly HandoverContact[];
  /** `admissionChecklist` for the movement; only outstanding items are listed. */
  readonly checklist: readonly AdmissionChecklistItem[];
  readonly now: Instant;
};

type HandoverPackSection = {
  readonly id:
    "patient" | "legal" | "risks" | "clearance" | "medication" | "ed-contacts" | "care-contacts" | "outstanding";
  readonly heading: string;
  readonly rows: readonly ReferralLetterRow[];
  /** A plain line under the rows, such as the medication list note. */
  readonly note?: string;
};

export type HandoverPack = {
  readonly title: string;
  readonly patient: HandoverPackInput["patient"];
  readonly sections: readonly HandoverPackSection[];
};

/**
 * The pack is offered once a ward has accepted a movement that started in an emergency department,
 * while it is still open. A ward-to-ward transfer is not an ED handover, so it gets no pack.
 */
export function handoverPackAvailable(
  movement: Pick<Movement, "acceptedUnitId" | "closure" | "originEdId"> | undefined,
): movement is Pick<Movement, "acceptedUnitId" | "closure" | "originEdId"> & { acceptedUnitId: string } {
  return movement?.acceptedUnitId !== undefined && movement.originEdId !== undefined && movement.closure === undefined;
}

export const MEDICATION_LIST_NOTE =
  "Ward Flow holds no medication list. Read the medication chart itself; this only records whether it is ready.";

function medicationChartWords(done: boolean | undefined): string {
  if (done === true) return "Ready for the ward";
  if (done === false) return "To follow";
  return NOT_RECORDED;
}

function contactRows(contacts: readonly HandoverContact[]): ReferralLetterRow[] {
  if (contacts.length === 0) return [{ label: "Contact", value: NOT_RECORDED, missing: true }];
  return contacts.map((contact) => ({
    label: contact.role || "Contact",
    value: [contact.name, contact.number?.trim() || "number not recorded"].filter(Boolean).join(" · "),
  }));
}

function letterInput(input: HandoverPackInput): ReferralTextInput {
  const flags = Array.isArray(input.riskFlags) ? input.riskFlags : [];
  return {
    destinationPhrase: input.wardName ?? "a ward",
    patientName: input.patient.name,
    umrn: input.patient.umrn,
    ageSex: input.patient.ageSex,
    suburb: "",
    from: input.fromName ?? "",
    recipients: input.wardName ? [input.wardName] : [],
    urgency: urgencyTierLabel(input.movement.urgency),
    legalStatus: legalStatusFull(input.movement),
    reason: "",
    history: "",
    risks: flags.map(riskFlagLabel),
    clearance:
      input.clearance === undefined ? "Not answered" : input.clearance.cleared ? "Cleared" : "Recorded as not cleared",
    referrer: { name: "", role: "", phone: "" },
  };
}

function letterRow(rows: readonly ReferralLetterRow[], label: string): ReferralLetterRow {
  return rows.find((row) => row.label === label) ?? { label, value: NOT_RECORDED, missing: true };
}

/** `dayZero` dates a typed paper expiry on another day (D1, D-93); left out, it never shows an age. */
export function handoverPackModel(input: HandoverPackInput, dayZero?: Date): HandoverPack {
  const letter = referralLetterModel(letterInput(input));
  const { movement, now } = input;
  const bed = movement.allocatedBed ?? movement.heldBedNumber;

  const risks: ReferralLetterRow =
    input.riskFlags === "not_shared"
      ? { label: "Risks", value: "Not shared with this desk", missing: true }
      : input.riskFlags === undefined
        ? { label: "Risks", value: NOT_RECORDED, missing: true }
        : input.riskFlags.length === 0
          ? { label: "Risks", value: "None recorded on the referral" }
          : letterRow(letter.key, "Risks");

  const clearance: ReferralLetterRow =
    input.clearance === undefined
      ? { label: "Medical clearance", value: NOT_RECORDED, missing: true }
      : {
          label: "Medical clearance",
          value: `${letterRow(letter.key, "Medical clearance").value}, recorded ${formatInstantWithDay(input.clearance.at, now)}`,
        };

  const outstanding = input.checklist.filter((item) => item.state === "outstanding");

  const sections: HandoverPackSection[] = [
    {
      id: "patient",
      heading: "Patient",
      rows: [
        { label: "Patient", value: letter.patient.name },
        { label: "UMRN", value: letter.patient.umrn },
        { label: "Age and sex", value: letter.patient.ageSex },
        letterRow(letter.key, "Urgency"),
        { label: "From", value: input.fromName ?? NOT_RECORDED, missing: input.fromName === undefined },
        { label: "To", value: input.wardName ?? NOT_RECORDED, missing: input.wardName === undefined },
        {
          label: "Bed",
          value: bed === undefined ? NOT_RECORDED : `Bed ${bed}`,
          missing: bed === undefined,
        },
        {
          label: "Accepted",
          value: movement.acceptedAt === undefined ? NOT_RECORDED : formatInstantWithDay(movement.acceptedAt, now),
          missing: movement.acceptedAt === undefined,
        },
      ],
    },
    {
      id: "legal",
      heading: "Legal status",
      rows: [
        letterRow(letter.key, "Legal status"),
        {
          label: "Paper expiry",
          // M17 (10 Nov 2026): a form recorded as ended reads the same as on the TV and downtime pack.
          value: formRecordedEnded(input.movement)
            ? FORM_RECORDED_ENDED
            : input.paperExpiryAt === undefined
              ? NOT_RECORDED
              : typedTimeLine(input.paperExpiryAt, now, dayZero),
          missing: !formRecordedEnded(input.movement) && input.paperExpiryAt === undefined,
        },
      ],
    },
    { id: "risks", heading: "Recorded risks", rows: [risks] },
    { id: "clearance", heading: "Medical clearance", rows: [clearance] },
    {
      id: "medication",
      heading: "Medication chart",
      rows: [
        {
          label: "Medication chart",
          value: medicationChartWords(movement.medicationChartDone),
          missing: movement.medicationChartDone === undefined,
        },
      ],
      note: MEDICATION_LIST_NOTE,
    },
    { id: "ed-contacts", heading: "ED contacts", rows: contactRows(input.edContacts) },
    { id: "care-contacts", heading: "Care contacts", rows: contactRows(input.careContacts) },
    {
      id: "outstanding",
      heading: "Outstanding",
      rows: outstanding.length
        ? outstanding.map((item) => ({ label: item.label, value: item.detail }))
        : [{ label: "Arrival checklist", value: "Nothing outstanding on the record" }],
    },
  ];

  return {
    title: `ED to ward handover${input.wardName ? `, ${input.wardName}` : ""}`,
    patient: input.patient,
    sections,
  };
}

/** The copy text. `ward-clipboard` still strips the UMRN line and any date of birth on copy. */
export function handoverPackText(pack: HandoverPack, stamp: string): string {
  return [
    `${SYNTHETIC_COPY_LINE} Handover pack ${stamp}.`,
    pack.title.toUpperCase(),
    ...pack.sections.flatMap((section) => [
      "",
      section.heading.toUpperCase(),
      ...section.rows.map((row) => `${row.label}: ${row.value}`),
      ...(section.note ? [section.note] : []),
    ]),
  ].join("\n");
}
