import type { WfTone } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { isMissingContactMessage } from "./referral-submission";
import { recipientSummary } from "./ward-referral-drawer-model";

/** What the referral slide-out's footer says, from the inbox through to Send. Moved out of the drawer state hook. */
export function drawerFootStatus(f: {
  view: "new" | "inbox";
  inboxWard: { unit: { name: string }; toDecide: number } | undefined;
  inboxWardCount: number;
  sentReferralId: string | null;
  sentAt: Instant | null;
  now: Instant;
  recipientLabels: string[];
  submissionAwaitingRecord: boolean;
  flowError: string | null;
  confirmationOpen: boolean;
  contactNeeded: number;
  contactAttempted: boolean;
  itemsLeft: number;
  itemsTotal: number;
}): { tone: WfTone; first: string; second: string; alert?: boolean } {
  if (f.view === "inbox") {
    return {
      tone: "info",
      first: f.inboxWard
        ? `${f.inboxWard.unit.name} inbox · ${f.inboxWard.toDecide} to decide`
        : "No referrals waiting",
      second: `${f.inboxWardCount} ${f.inboxWardCount === 1 ? "ward has" : "wards have"} referrals`,
    };
  }
  if (f.sentReferralId) {
    return {
      tone: "success",
      first: `Sent ${f.sentAt === null ? "" : formatInstantWithDay(f.sentAt, f.now)} · ${f.sentReferralId}`,
      second: `${f.recipientLabels.length} ${f.recipientLabels.length === 1 ? "location" : "locations"} notified`,
    };
  }
  if (f.submissionAwaitingRecord) {
    return {
      tone: "info",
      first: "Referral saved. Its record is not visible yet.",
      second: "Check the Referrals board before sending again.",
    };
  }
  const second = recipientSummary(f.recipientLabels);
  // #823: a refused Send's "Enter your name…" line is a snapshot. The live contact count below takes
  // its place, so the warning goes as soon as the contact fields are valid, not at the next Send.
  const contactSnapshot = f.flowError !== null && isMissingContactMessage(f.flowError);
  if (f.flowError && !contactSnapshot) return { tone: "danger", first: f.flowError, second, alert: true };
  if (f.confirmationOpen) {
    return {
      tone: f.contactNeeded ? (f.contactAttempted ? "danger" : "neutral") : "success",
      first: f.contactNeeded
        ? `${f.contactNeeded} contact ${f.contactNeeded === 1 ? "detail" : "details"} needed`
        : "Ready to send",
      second,
    };
  }
  return {
    tone: f.itemsLeft ? "neutral" : "success",
    // Audit 11 Oct 2026: the same unit as Ready to send, so "4 of 9" and this line agree.
    // P155: once every step is done only the contact details asked at Send remain, so say that.
    first:
      f.itemsLeft > 0 && f.itemsLeft === f.contactNeeded
        ? `${f.contactNeeded} contact ${f.contactNeeded === 1 ? "detail" : "details"} needed at Send`
        : f.itemsLeft > 0
          ? `${f.itemsLeft} of ${f.itemsTotal} items still needed`
          : "All items in",
    second,
  };
}

/** P051: the rail heading only claims "Ready to send" once nothing is left. */
export function drawerRailHeading(itemsLeft: number): string {
  return itemsLeft > 0 ? "Before you send" : "Ready to send";
}
