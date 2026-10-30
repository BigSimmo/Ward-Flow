// Redesign fork of the ED row menu's item list (`ward-management/ed/ed-screen-row-menu.tsx`,
// `renderEdRowMenuItems` and `edUnavailableLines`), returned as data so the redesigned menu can
// show the actions available now in three groups and fold the greyed ones away with their reason.
// The items, their order, labels, conditions and short reasons are the menu's own. Each item
// carries the test id of the real control, which the menu presses to do the step.
import { MOVEMENT_STAGES, type Movement, type Referral } from "@/components/ward-management/ward-model";
import { edShortName } from "@/components/ward-management/ward-sites";
import { movementReferralLink, transportNeedState } from "@/components/ward-management/ward-derivations";
import { canSetArrivalPlan } from "@/components/ward-management/referrals/arrival-time-modal";
import { edBedSearchStep, openWardReferralFor } from "@/components/ward-management/ed/ed-bed-search-step";
import {
  bookTransportBlockedReason,
  communityReferralBlockedReason,
  edOutcomeBlockedReason,
  examinationBlockedReason,
  handoverBlockedReason,
  withdrawReferralBlockedReason,
} from "@/components/ward-management/ed/ed-blocked-reasons";

/** The menu's three groups, as `EdActionsMenu` names them. Redesign: "and" in plain words, not "&". */
export const ED_ACTION_GROUPS = ["Review and disposition", "Transfer and handover", "Legal and referral"] as const;

export type EdActionItem = {
  key: string;
  label: string;
  /** The real control's test id, pressed to do the step. */
  testId: string;
  group: 0 | 1 | 2;
  /** The row's next step (`primaryAction`): the menu's one filled button. */
  primary: boolean;
  /** Why it is greyed, in full (the button's title today). */
  blocked?: string;
  /** The same reason in a few words. */
  because?: string;
  why?: string;
  next?: string;
  /** The one fix on this row, as the greyed item's note offers it. */
  fix?: { label: string; testId: string };
};

const PULLED_STAGE_INDEX = MOVEMENT_STAGES.indexOf("pulled");
const COLLECTED = "Patient collected. The coordinator stops the journey";

/** Short words for a step that waits on a ward: before acceptance, or accepted but no bed pulled. */
function waitsOnWard(movement: Movement): string | undefined {
  const index = MOVEMENT_STAGES.indexOf(movement.stage);
  if (index >= PULLED_STAGE_INDEX) return undefined;
  return movement.stage === "accepted_awaiting_bed"
    ? "Needs the ward to pull a bed first"
    : "Needs a ward to accept first";
}

/** The group `EdActionsMenu` sorts an item into, read from its test id as the menu does. */
function groupOf(testId: string): 0 | 1 | 2 {
  return /examine|outcome/.test(testId) ? 0 : /handover|transport|arrival-plan/.test(testId) ? 1 : 2;
}

/** The row's next step, as `edBoardRowModel` works it out. */
function primaryActionOf(movement: Movement, patientId: string | undefined, referrals: readonly Referral[]) {
  const bedSearch = edBedSearchStep(movement, openWardReferralFor(patientId, referrals) !== undefined);
  return movement.edOutcome !== undefined && !movement.leftDepartmentAt
    ? "left"
    : movement.closure
      ? "closure"
      : movement.stage === "pulled" && movement.transport === undefined
        ? "transport"
        : movement.examination === undefined
          ? "exam"
          : movement.stage === "pulled" && movement.transport !== undefined
            ? "handover"
            : bedSearch === "refer"
              ? "refer"
              : bedSearch === "underway"
                ? undefined
                : movement.edOutcome === undefined
                  ? "outcome"
                  : undefined;
}

/** Every action the row's menu offers, in the menu's order. */
export function edActionItems({
  movement,
  who,
  patientId,
  referrals,
  department,
}: {
  movement: Movement;
  /** The name the blocked sentences use, as the board passes it. */
  who: string;
  patientId: string | undefined;
  referrals: readonly Referral[];
  department: { id?: string; siteCode?: string; name?: string } | undefined;
}): EdActionItem[] {
  const id = movement.id;
  const primaryAction = primaryActionOf(movement, patientId, referrals);
  const examBlocked = examinationBlockedReason(movement, who);
  const handoverBlocked = handoverBlockedReason(movement, who);
  const transportBlocked = bookTransportBlockedReason(movement, who);
  const withdrawBlocked = withdrawReferralBlockedReason(movement, who);
  const edOutcomeBlocked = edOutcomeBlockedReason(movement);
  const cmhtBlocked = communityReferralBlockedReason(movement);
  const isForm1A = movement.legalForm?.code === "1A";
  const collected = movement.transport?.collectedAt !== undefined;
  const ended = movement.closure ? "This movement has ended" : undefined;
  const edName = edShortName(department);
  const waitsOnTransport = movement.stage === "pulled" && !movement.transport;
  const waitsOnExam = !ended && !collected;

  const items: EdActionItem[] = [];
  const add = (item: Omit<EdActionItem, "group" | "primary"> & { primary?: boolean }) =>
    items.push({ ...item, group: groupOf(item.testId), primary: item.primary ?? false });

  add({
    key: "exam",
    label: "Record examination",
    testId: `ward-ed-examine-toggle-${id}`,
    primary: primaryAction === "exam",
    blocked: examBlocked,
    because: examBlocked ? "Already examined" : undefined,
  });
  add({
    key: "outcome",
    label: "Record outcome",
    testId: `ward-ed-outcome-toggle-${id}`,
    primary: primaryAction === "outcome",
    blocked: edOutcomeBlocked,
    because: edOutcomeBlocked ? (ended ?? (collected ? COLLECTED : edOutcomeBlocked)) : undefined,
  });
  add({
    key: "handover",
    label: "Mark handover ready",
    testId: `ward-ed-handover-${id}`,
    primary: primaryAction === "handover",
    blocked: handoverBlocked,
    because: handoverBlocked
      ? (waitsOnWard(movement) ??
        (waitsOnTransport
          ? "Transport not logged"
          : movement.stage === "handover_ready"
            ? "Already marked ready"
            : "Patient is already on the way"))
      : undefined,
    fix:
      handoverBlocked && waitsOnTransport && !transportBlocked
        ? { label: "Log transport booking", testId: `ward-ed-book-transport-toggle-${id}` }
        : undefined,
    ...(handoverBlocked && waitsOnTransport
      ? {
          why: "A handover is marked ready once the transport booking is logged.",
          next: `ED nurse in charge, ${edName}`,
        }
      : {}),
  });
  add({
    key: "transport",
    // Owner's third ruling, 17 Sept 2026: this logs a booking already made by phone.
    // Redesign: a verb, as the step's own fix label and popup say ("Transport booked" today).
    label: "Log transport booking",
    testId: `ward-ed-book-transport-toggle-${id}`,
    primary: primaryAction === "transport",
    blocked: transportBlocked,
    because: transportBlocked
      ? (waitsOnWard(movement) ??
        (movement.transport ? "Already logged. Cancel it before logging another" : "Patient is already on the way"))
      : undefined,
  });
  if (canSetArrivalPlan(movement))
    add({
      key: "arrival",
      label: movement.arrivalDetails ? "Edit arrival plan" : "Set arrival plan",
      testId: `ward-ed-arrival-plan-toggle-${id}`,
    });
  if (movement.transport === undefined && transportNeedState(movement) === "not_recorded")
    // Redesign: action words, not states ("No transport needed", "No referral raised" today).
    add({ key: "no-transport", label: "Record no transport needed", testId: `ward-ed-no-transport-needed-${id}` });
  if (movement.referralId === undefined && movementReferralLink(movement, [...referrals]).kind === "not_recorded")
    add({ key: "no-referral", label: "Record no referral", testId: `ward-ed-no-referral-raised-${id}` });
  add({ key: "urgency", label: "Change urgency", testId: `ward-change-urgency-toggle-${id}` });
  add({ key: "legal-status", label: "Change legal status", testId: `ward-change-legal-status-toggle-${id}` });
  add({
    key: "withdraw",
    label: "Withdraw referral",
    testId: `ward-ed-withdraw-referral-toggle-${id}`,
    blocked: withdrawBlocked,
    because: withdrawBlocked ? (ended ?? (collected ? COLLECTED : "No live referral to withdraw")) : undefined,
  });
  if (isForm1A && movement.legalFormReceivedAt === undefined)
    add({ key: "received", label: "Mark Form 1A received", testId: `ed-mark-form-received-${id}` });
  if (isForm1A && movement.legalFormReceivedAt !== undefined)
    add({ key: "receipt", label: "Correct receipt", testId: `ed-correct-form-receipt-toggle-${id}` });
  if (movement.legalForm)
    add({
      key: "expiry",
      label: movement.legalForm.dueAt !== undefined ? "Record an extension" : "Record expiry from the form",
      testId: `ward-ed-legal-form-expiry-toggle-${id}`,
    });
  add({
    key: "cmht",
    label: "Refer to a community team",
    testId: `ed-refer-cmht-${id}`,
    blocked: cmhtBlocked,
    because: cmhtBlocked
      ? (ended ??
        (collected
          ? COLLECTED
          : movement.examination?.outcome === "further_examination_ordered"
            ? "Further examination not recorded"
            : "Examination outcome not recorded"))
      : undefined,
    fix:
      cmhtBlocked && waitsOnExam && !examBlocked
        ? { label: "Record examination", testId: `ward-ed-examine-toggle-${id}` }
        : undefined,
    ...(cmhtBlocked && waitsOnExam
      ? {
          why: `${movement.legalForm ? `On Form ${movement.legalForm.code}` : `Recorded as ${movement.legalStatus.toLowerCase()}`}, so a community referral needs the outcome first.`,
          next: `ED clinician, ${edName}`,
        }
      : {}),
  });
  return items;
}
