/*
 * Form rule (design audit FORM-REF and LEGAL-REF, Josh, 5 Nov 2026): a new referral blocks only on
 * identity (and the existing-bed check), gender, legal status, medical clearance, age band and
 * urgency. Every other gap is listed here and shown in "Before you send" as a warning, and Send goes
 * ahead.
 */
import type { WfTone } from "@/components/wf";
import type { DocumentationDraft } from "./referral-flow-panels";
import type { ReferralContact } from "./referral-submission";

/** What a referral sends, and every letter shows, for a legal status nobody has recorded yet. */
const LEGAL_STATUS_SENT_NOT_RECORDED = "Not recorded";

/**
 * LEGAL-REF: the explicit "Not yet recorded" answer, kept apart from "" (nobody has answered), the
 * same split as the gender picker (WS-01). It counts as an answer and sends as "Not recorded".
 */
export const LEGAL_STATUS_NOT_YET_RECORDED = "Not yet recorded";

/** LEGAL-REF: the Send refusal while the legal status is unanswered. */
export const LEGAL_STATUS_UNANSWERED = 'Choose the legal status, or "Not yet recorded".';

/** The drawer's answer for a recorded status. A record's "Not recorded" is not an answer. */
export function legalStatusAnswer(recorded: string): string {
  return recorded === LEGAL_STATUS_SENT_NOT_RECORDED ? "" : recorded;
}

/** The legal status a referral sends for the drawer's answer. */
export function sentLegalStatus(answer: string): string {
  return answer === "" || answer === LEGAL_STATUS_NOT_YET_RECORDED ? LEGAL_STATUS_SENT_NOT_RECORDED : answer;
}

/** The clearance answer as the summary and letter show it. */
export function clearanceLabel(medical: DocumentationDraft["medical"]): { label: string; tone: WfTone } {
  if (medical === "yes") return { label: "Cleared", tone: "success" };
  return medical === "no" ? { label: "Pending", tone: "warning" } : { label: "Not answered", tone: "neutral" };
}

/** A medical clearance still to come with its time or clarification contact left blank. */
function clearanceGaps(draft: DocumentationDraft): string[] {
  if (draft.medical !== "no") return [];
  return [
    draft.expectedAt ? "" : "expected clearance time",
    draft.contactName.trim() ? "" : "clarification contact",
    draft.contactPhone.trim() ? "" : "clarification phone",
  ].filter(Boolean);
}

/** The referrer's own details still blank (or a phone number that cannot be rung). */
function contactGaps(contact: ReferralContact): string[] {
  return [
    contact.name.trim() ? "" : "your name",
    /^[+\d\s().-]+$/.test(contact.phone) && contact.phone.replace(/\D/g, "").length >= 8 ? "" : "your phone number",
    contact.role.trim() ? "" : "your role",
    contact.location.trim() ? "" : "your location or service",
  ].filter(Boolean);
}

/** Every warning, in the form's order. None of them stops Send. */
export function referralSendWarnings(f: {
  catchmentAnswered: boolean;
  homeRegion: string;
  reasonMissing: boolean;
  documentation: DocumentationDraft;
  contact: ReferralContact;
}): string[] {
  return [
    f.catchmentAnswered ? "" : "catchment",
    f.homeRegion ? "" : "home region",
    // Josh, 5 Nov 2026 (finding 2): the location and referring service block, so they are not here.
    f.reasonMissing ? "reason for referral" : "",
    ...clearanceGaps(f.documentation),
    ...contactGaps(f.contact),
  ].filter(Boolean);
}

/** The one warning line: "Not recorded: catchment, home region. You can still send." */
export function sendWarningsLine(warnings: readonly string[]): string {
  return warnings.length ? `Not recorded: ${warnings.join(", ")}. You can still send.` : "";
}
