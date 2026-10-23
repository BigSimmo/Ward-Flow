import type { WfTone } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
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
  if (f.flowError) return { tone: "danger", first: f.flowError, second, alert: true };
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
    first: f.itemsLeft > 0 ? `${f.itemsLeft} of ${f.itemsTotal} items still needed` : "All items in",
    second,
  };
}
