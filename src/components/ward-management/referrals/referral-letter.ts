/**
 * The referral as plain text: the letter the slide-out previews before sending, and the ISBAR
 * note it offers to copy once sent. Built only from what the referrer entered or the record holds,
 * so the copy says exactly what the referral says. Synthetic prototype, not a medical device.
 */

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
  readonly referrer: { readonly name: string; readonly role: string; readonly phone: string };
};

const NOT_RECORDED = "Not recorded";

function value(text: string): string {
  return text.trim() || NOT_RECORDED;
}

/** The letter, headed by the time it was drafted (AWST clock face). */
export function referralLetterText(input: ReferralTextInput, draftedAt: string): string {
  const referrer = [input.referrer.name, input.referrer.role, input.referrer.phone].map((part) => part.trim());
  return [
    `Mental health referral to ${input.destinationPhrase}`,
    `Synthetic prototype. Draft ${draftedAt} AWST.`,
    "",
    "PERSON",
    `Name: ${value(input.patientName)}`,
    `UMRN: ${value(input.umrn)}`,
    `Age and sex: ${value(input.ageSex)}`,
    `Suburb: ${value(input.suburb)}`,
    `From: ${value(input.from)}`,
    "",
    "REQUEST",
    `Refer to: ${input.recipients.length ? input.recipients.join(", ") : "None chosen yet"}`,
    `Urgency: ${value(input.urgency)}`,
    `Legal status: ${value(input.legalStatus)}`,
    `Reason: ${value(input.reason)}`,
    `Risks: ${input.risks.length ? input.risks.join(", ") : "None selected"}`,
    `Medical clearance: ${value(input.clearance)}`,
    ...(input.clearanceChecklist?.trim() ? [`Clearance checklist: ${input.clearanceChecklist.trim()}`] : []),
    ...(input.needs?.length ? [`Needs: ${input.needs.join(", ")}`] : []),
    "",
    "HISTORY",
    value(input.history),
    "",
    `Referrer: ${referrer.filter(Boolean).join(", ") || NOT_RECORDED}`,
  ].join("\n");
}

/** The ISBAR note for the clinical record, once the referral has been sent. */
export function referralIsbarText(
  input: ReferralTextInput,
  sent: { readonly referralId: string; readonly sentAt: string; readonly decisionDue?: string },
): string {
  const to = input.recipients.length ? input.recipients.join(" and ") : NOT_RECORDED;
  return [
    `I: ${value(input.patientName)}, ${value(input.ageSex)}, UMRN ${value(input.umrn)}. ${sent.referralId} sent ${sent.sentAt} to ${to}.`,
    `S: ${value(input.urgency)}. ${value(input.legalStatus)}.`,
    `B: ${value(input.history)}`,
    `A: Risks ${input.risks.length ? input.risks.join(", ").toLowerCase() : "none selected"}. Medical clearance ${value(input.clearance).toLowerCase()}${input.clearanceChecklist?.trim() ? ` (${input.clearanceChecklist.trim().toLowerCase()})` : ""}.`,
    `R: ${value(input.reason)}.${input.needs?.length ? ` ${input.needs.join(", ")}.` : ""}${sent.decisionDue ? ` Decision due ${sent.decisionDue}.` : ""}`,
  ].join("\n");
}
