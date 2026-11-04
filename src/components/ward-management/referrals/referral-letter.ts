/**
 * The referral as plain text: the letter the slide-out previews before sending, and the ISBAR
 * note it offers to copy once sent. Built only from what the referrer entered or the record holds,
 * so the copy says exactly what the referral says, less the UMRN, which `ward-clipboard` keeps off
 * the clipboard. Synthetic prototype, not a medical device.
 */

import { SYNTHETIC_COPY_LINE } from "@/components/ward-management/ward-clipboard";
import type { FollowableChartKind, ReferralChart } from "./referral-submission";

export type ReferralTextInput = {
  /** "a ward", "a community team" or "an emergency department". */
  readonly destinationPhrase: string;
  readonly patientName: string;
  readonly umrn: string;
  /** "41, female", or the record's own "age not recorded". */
  readonly ageSex: string;
  readonly suburb: string;
  /** The referring site, or "Not recorded". */
  readonly from: string;
  readonly recipients: readonly string[];
  /** "Tier 2, urgent". */
  readonly urgency: string;
  readonly legalStatus: string;
  readonly reason: string;
  readonly history: string;
  readonly risks: readonly string[];
  /** "Cleared", "Pending" or "Not answered". */
  readonly clearance: string;
  /** "Physical examination done, Bloods to follow", or blank when no item was answered. */
  readonly clearanceChecklist?: string;
  /** What the receiving team or ED asked to know, one phrase each. */
  readonly needs?: readonly string[];
  /** Document kinds only: file contents and names never enter handover text. */
  readonly chartKinds?: readonly ReferralChart["kind"][];
  readonly chartsToFollow?: readonly FollowableChartKind[];
  readonly referrer: { readonly name: string; readonly role: string; readonly phone: string };
  /** Finding 40: the catchment line, "Catchment not known" when the referrer said so. Left out when absent. */
  readonly catchment?: string;
};

const NOT_RECORDED = "Not recorded";

/** The letter's own header words: the first line of every Ward Flow copy, kept in `ward-clipboard`. */
export { SYNTHETIC_COPY_LINE };

function value(text: string): string {
  return text.trim() || NOT_RECORDED;
}

function chartStatusText(input: ReferralTextInput): string {
  const attached = input.chartKinds ?? [];
  const labels = { medication: "Medication chart", observation: "Observation chart", other: "Additional document" };
  return [
    ...attached.map((kind) => `${labels[kind]} attached`),
    ...(input.chartsToFollow ?? [])
      .filter((kind) => !attached.includes(kind))
      .map((kind) => `${labels[kind]} to follow, not attached yet`),
  ].join("; ");
}

/** One labelled line of the letter. `missing` lines are left out of the copy and listed once instead. */
export type ReferralLetterRow = { readonly label: string; readonly value: string; readonly missing?: boolean };

/**
 * RF2 (Current Issues, 4 Nov 2026): one model for the styled letter, its PDF and its copy text, so
 * the three never disagree. Answered fields are written out; unanswered ones are gathered into one
 * "Still to confirm" list at the top instead of a "Not recorded" on every line.
 */
export type ReferralLetterModel = {
  readonly title: string;
  readonly toConfirm: readonly string[];
  readonly patient: { readonly name: string; readonly umrn: string; readonly ageSex: string; readonly suburb: string };
  readonly key: readonly ReferralLetterRow[];
  readonly details: readonly ReferralLetterRow[];
  readonly reason: string;
  readonly history: string;
  readonly referrer: { readonly name: string; readonly role: string; readonly phone: string };
};

function row(label: string, text: string | undefined, missingWord = NOT_RECORDED): ReferralLetterRow {
  const trimmed = (text ?? "").trim();
  return trimmed && trimmed !== NOT_RECORDED ? { label, value: trimmed } : { label, value: missingWord, missing: true };
}

export function referralLetterModel(input: ReferralTextInput): ReferralLetterModel {
  const charts = chartStatusText(input);
  const key = [
    row("Urgency", input.urgency),
    row("Legal status", input.legalStatus),
    row("Medical clearance", input.clearance === "Not answered" ? "" : input.clearance, "Not answered"),
    { label: "Risks", value: input.risks.length ? input.risks.join(", ") : "None selected" },
  ];
  const details = [
    row("Refer to", input.recipients.join(", "), "None chosen yet"),
    row("From", input.from),
    ...(input.catchment?.trim() ? [row("Catchment", input.catchment)] : []),
    ...(input.clearanceChecklist?.trim() ? [row("Clearance checklist", input.clearanceChecklist)] : []),
    ...(input.needs?.length ? [row("Needs", input.needs.join(", "))] : []),
    ...(charts ? [row("Documents", charts)] : []),
  ];
  const reason = input.reason.trim();
  const history = input.history.trim();
  const referrer = {
    name: input.referrer.name.trim(),
    role: input.referrer.role.trim(),
    phone: input.referrer.phone.trim(),
  };
  const toConfirm = [
    ...[...key, ...details].filter((item) => item.missing).map((item) => item.label),
    ...(reason ? [] : ["Reason"]),
    ...(history ? [] : ["History"]),
    ...(referrer.name && referrer.phone ? [] : ["Referrer contact"]),
  ];
  return {
    title: `Mental health referral to ${input.destinationPhrase}`,
    toConfirm,
    patient: {
      name: value(input.patientName),
      umrn: value(input.umrn),
      ageSex: value(input.ageSex),
      suburb: input.suburb.trim(),
    },
    key,
    details,
    reason,
    history,
    referrer,
  };
}

function sentenceList(labels: readonly string[]): string {
  const lower = labels.map((label, index) => (index === 0 ? label : label.charAt(0).toLowerCase() + label.slice(1)));
  return lower.length > 1 ? `${lower.slice(0, -1).join(", ")} and ${lower.at(-1)}` : (lower[0] ?? "");
}

/** The copy text: answered fields only, missing ones named once at the top. */
export function referralLetterText(input: ReferralTextInput, draftedAt: string): string {
  const model = referralLetterModel(input);
  const answered = (rows: readonly ReferralLetterRow[]) =>
    rows.filter((item) => !item.missing).map((item) => `${item.label}: ${item.value}`);
  // " · " separators, so the clipboard's UMRN strip leaves a clean line.
  const person = [model.patient.name, `UMRN ${model.patient.umrn}`, model.patient.ageSex, model.patient.suburb]
    .filter(Boolean)
    .join(" · ");
  const referrer = [model.referrer.name, model.referrer.role, model.referrer.phone].filter(Boolean).join(", ");
  return [
    `${SYNTHETIC_COPY_LINE} Draft ${draftedAt} AWST.`,
    model.title.toUpperCase(),
    ...(model.toConfirm.length ? [`Still to confirm: ${sentenceList(model.toConfirm)}.`] : []),
    "",
    "PATIENT",
    person,
    "",
    "REQUEST",
    ...answered(model.key),
    ...answered(model.details),
    ...(model.reason ? ["", "REASON", model.reason] : []),
    ...(model.history ? ["", "HISTORY", model.history] : []),
    "",
    "REFERRER",
    referrer || NOT_RECORDED,
  ].join("\n");
}

/** The ISBAR note for the clinical record, once the referral has been sent. */
export function referralIsbarText(
  input: ReferralTextInput,
  sent: { readonly referralId: string; readonly sentAt: string; readonly decisionDue?: string },
): string {
  const to = input.recipients.length ? input.recipients.join(" and ") : NOT_RECORDED;
  const charts = chartStatusText(input);
  return [
    SYNTHETIC_COPY_LINE,
    `I: ${value(input.patientName)}, ${value(input.ageSex)}, UMRN ${value(input.umrn)}. Referral sent ${sent.sentAt} to ${to}.`,
    `S: ${value(input.urgency)}. ${value(input.legalStatus)}.`,
    `B: ${value(input.history)}`,
    // Walk-through WT-40: the risk and clearance words keep their case ("ECG done", not "ecg done").
    `A: Risks: ${input.risks.length ? input.risks.join(", ") : "None selected"}. Medical clearance: ${value(input.clearance)}${input.clearanceChecklist?.trim() ? ` (${input.clearanceChecklist.trim()})` : ""}.${charts ? ` Documents: ${charts}.` : ""}`,
    `R: ${value(input.reason)}.${input.needs?.length ? ` ${input.needs.join(", ")}.` : ""}${sent.decisionDue ? ` Decision due ${sent.decisionDue}.` : ""}`,
  ].join("\n");
}
