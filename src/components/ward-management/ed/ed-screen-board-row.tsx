"use client";

// One board row: what the row knows about its person, and how it is put together as a board table
// row (wider screens) or a phone list row. Split out of `ed-screen.tsx` unchanged (fix list 2.5 and
// 9.6, 15 Oct 2026).
import type { ReactNode } from "react";
import { communityTeamOptionsForSuburb } from "@/components/ward-management/referrals/referral-destination-options";
import { openReferralSheet } from "@/components/ward-management/shell/ward-drawer-bus";
import type { Movement } from "@/components/ward-management/ward-model";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { transportAnswersBlockedReason } from "@/components/ward-management/ward-transport-checks";
import { edReferralSheetHref } from "../referrals/open-referral-sheet";
import { edBedSearchStep, openWardReferralFor, referredToLabel } from "./ed-bed-search-step";
import {
  bookTransportBlockedReason,
  communityReferralBlockedReason,
  dischargeChoiceBlockedReason,
  edOutcomeBlockedReason,
  examinationBlockedReason,
  handoverBlockedReason,
  transportLegalFormNotice,
  withdrawReferralBlockedReason,
} from "./ed-blocked-reasons";
import type { EdScreenContext } from "./ed-screen-context";
import { renderEdBoardTableRow } from "./ed-screen-desktop";
import {
  formExpiryLine,
  formExpiryWarning,
  instantFromDateAndTimeInputs,
  isEdInitiatedWithdrawal,
  movementMedicalClearance,
  outstandingItem,
} from "./ed-screen-model";
import { renderEdPersonSheet } from "./ed-screen-person-sheet";
import { renderEdBoardPhoneRow } from "./ed-screen-phone";
import { renderEdRowControls, renderEdRowExpandedCards, renderEdRowFacts } from "./ed-screen-row-facts";
import { renderEdRowForms } from "./ed-screen-row-forms";
import { renderEdRowMenuItems, renderEdRowNextGroup } from "./ed-screen-row-menu";

/** What one board row knows about its person: clocks, blocked reasons, open panels and its next step. */
function edBoardRowModel(movement: Movement, ctx: EdScreenContext) {
  const {
    now,
    thresholds,
    dayZero,
    movements,
    units,
    referrals,
    registryPatients,
    thisEdId,
    recordEdStep,
    examinationOpenFor,
    edOutcomeOpenFor,
    setEdOutcomeOpenFor,
    urgencyChangeOpenFor,
    legalStatusChangeOpenFor,
    transportOpenFor,
    transportDraft,
    withdrawOpenFor,
    legalFormExpiryOpenFor,
    legalFormExpiryDraft,
    receiptCorrectionOpenFor,
    toggleExamination,
    toggleBookTransport,
  } = ctx;
  const minutesInDepartment = Math.max(now - movement.openedAt, 0);
  const medicalClearance = movementMedicalClearance(movement, referrals);
  const formExpiryText = movement.legalForm ? formExpiryLine(movement.legalForm, now) : undefined;
  const formExpiryWarningText = movement.legalForm ? formExpiryWarning(movement.legalForm, now, thresholds) : undefined;
  const item = outstandingItem(movement);
  // Owner, 26 Sept 2026: resolved early so the blocked-reason sentences below can
  // name the patient instead of the WF journey number.
  const patientInfo = resolveSubjectPatient(movement, {
    patients: registryPatients,
    referrals,
    movements,
  });
  const examBlocked = examinationBlockedReason(movement, patientInfo.displayName);
  const handoverBlocked = handoverBlockedReason(movement, patientInfo.displayName);
  const transportBlocked = bookTransportBlockedReason(movement, patientInfo.displayName);
  const transportLegalFormWarning = transportLegalFormNotice(movement);
  const transportOpen = transportOpenFor === movement.id;
  const withdrawBlocked = withdrawReferralBlockedReason(movement, patientInfo.displayName);
  const withdrawOpen = withdrawOpenFor === movement.id;
  const transportAnswersBlocked = transportAnswersBlockedReason(transportDraft, now);
  const examOpen = examinationOpenFor === movement.id;
  const edOutcomeOpen = edOutcomeOpenFor === movement.id;
  const edOutcomeBlocked = edOutcomeBlockedReason(movement);
  const dischargeBlocked = dischargeChoiceBlockedReason(movement);
  const cmhtBlocked = communityReferralBlockedReason(movement);
  const linkedReferral = movement.referralId ? referrals.find((r) => r.id === movement.referralId) : undefined;
  // D-14 (default-deny on the patient link): this used to fall back to
  // `allPatients.find(...).suburb` via `linkedReferral.patientId`, which put
  // `.patientId` in a file `tests/ward-patient-link-default-deny.test.ts`'s
  // ALLOWLIST does not name — and item 14 never asked for that fallback.
  // RB4's own wording is "a linked suburb lists that team first" — the suburb
  // RECORDED ON THE REFERRAL, which every referral already carries (`RECEIVE_
  // REFERRAL` refuses one with no suburb answer). No patient lookup is needed
  // to satisfy it.
  const recordedSuburb = linkedReferral?.suburb?.kind === "named" ? linkedReferral.suburb.name : null;
  const teamOptions = communityTeamOptionsForSuburb(recordedSuburb);
  const urgencyChangeOpen = urgencyChangeOpenFor === movement.id;
  const legalStatusChangeOpen = legalStatusChangeOpenFor === movement.id;
  // T3: "Record expiry from the form" once `legalForm` carries no `dueAt` yet,
  // "Record an extension" once it does — read from the movement itself, never
  // from a flag the draft carries (`toggleLegalFormExpiry`'s own comment).
  // Hidden entirely, rather than disabled, when there is no legal form at all:
  // the reducer's own refusal for that case ("There is no legal form on this
  // record to add an expiry to.") is then structurally unreachable from here,
  // the same reasoning `isForm1A`'s "Mark Form 1A received" button above follows.
  const legalFormExpiryOpen = legalFormExpiryOpenFor === movement.id;
  const legalFormExpiryIsExtension = movement.legalForm?.dueAt !== undefined;
  const legalFormExpiryDraftInstant = legalFormExpiryOpen
    ? instantFromDateAndTimeInputs(legalFormExpiryDraft.date, legalFormExpiryDraft.time, dayZero)
    : undefined;
  // Why Save is unavailable, worded for the reason: a missing date or time, or an extension that is
  // not later than the expiry already recorded.
  const legalFormExpirySaveBlockedReason =
    legalFormExpiryDraftInstant === undefined
      ? "Enter both date and time from the paper record."
      : movement.legalForm?.dueAt !== undefined && legalFormExpiryDraftInstant <= movement.legalForm.dueAt
        ? "The extension must be later than the expiry already recorded."
        : undefined;
  const legalFormExpirySaveBlocked = legalFormExpirySaveBlockedReason !== undefined;
  // T4: offered only once a receipt is actually recorded — the reducer's own
  // "no recorded legal form receipt to correct" refusal is then structurally
  // unreachable from here, the same reasoning `isForm1A`'s "Mark Form 1A
  // received" button below follows for its own precondition.
  const receiptCorrectionOpen = receiptCorrectionOpenFor === movement.id;
  // Whole-branch review Critical 1: resolved from the live `units`, not `unitById`.
  const acceptedUnit = movement.acceptedUnitId ? units.find((unit) => unit.id === movement.acceptedUnitId) : undefined;
  // The three disjuncts this dropped never fired: `LegalForm` has no `form`
  // field (only `code`) and `LegalStatus` is a closed union of four clinical
  // sentences ("Voluntary" | "Referred for psychiatric examination" |
  // "Detained awaiting examination" | "Involuntary inpatient") that never
  // includes "1A"/"form_1a"/"3D"/"form_3d" — both facts checked against the
  // real types, not assumed. Each `as any`/`as string` cast existed only to get
  // past the compiler correctly reporting those comparisons as impossible.
  const isForm1A = movement.legalForm?.code === "1A";

  // S-7 (audit 13 Oct 2026): after an inpatient order the bed search carries on.
  // "Record outcome" (discharge or community follow-up, which withdraws requests and
  // releases beds) stays in the menu but is no longer the primary.
  const openWardReferral = openWardReferralFor(patientInfo.patient?.id, referrals);
  const referredTo = openWardReferral
    ? referredToLabel(openWardReferral.unitIds, (unitId) => units.find((unit) => unit.id === unitId)?.name)
    : undefined;
  const bedSearch = edBedSearchStep(movement, openWardReferral !== undefined);
  const primaryAction =
    movement.edOutcome !== undefined && !movement.leftDepartmentAt
      ? "left"
      : movement.closure
        ? "closure"
        : movement.examination === undefined
          ? "exam"
          : movement.stage === "pulled" && movement.transport === undefined
            ? "transport"
            : movement.stage === "pulled" && movement.transport !== undefined
              ? "handover"
              : bedSearch === "refer"
                ? "refer"
                : bedSearch === "underway"
                  ? undefined
                  : movement.edOutcome === undefined
                    ? "outcome"
                    : undefined;
  const nextAction:
    | {
        label: string;
        blocked: string | undefined;
        describedBy: string;
        expanded?: boolean;
        run: () => void;
      }
    | undefined =
    primaryAction === "exam"
      ? {
          label: "Record exam",
          blocked: examBlocked,
          describedBy: `ward-ed-examine-unavailable-${movement.id}`,
          expanded: examOpen,
          run: () => toggleExamination(movement.id),
        }
      : primaryAction === "refer"
        ? {
            label: "Refer to a ward",
            blocked: undefined,
            describedBy: `ward-ed-refer-ward-${movement.id}`,
            run: () => openReferralSheet(edReferralSheetHref(patientInfo.patient?.id, thisEdId)),
          }
        : primaryAction === "outcome"
          ? {
              label: "Record outcome",
              blocked: edOutcomeBlocked,
              describedBy: `ward-ed-outcome-unavailable-${movement.id}`,
              expanded: edOutcomeOpen,
              run: () => setEdOutcomeOpenFor((current) => (current === movement.id ? undefined : movement.id)),
            }
          : primaryAction === "transport"
            ? {
                label: "Transport booked",
                blocked: transportBlocked,
                describedBy: `ward-ed-book-transport-unavailable-${movement.id}`,
                expanded: transportOpen,
                run: () => toggleBookTransport(movement.id),
              }
            : primaryAction === "handover"
              ? {
                  label: "Handover ready",
                  blocked: handoverBlocked,
                  describedBy: `ward-ed-handover-unavailable-${movement.id}`,
                  run: () =>
                    recordEdStep({
                      type: "HANDOVER_READY",
                      role: "ed",
                      now,
                      movementId: movement.id,
                    }),
                }
              : undefined;

  const destinationLabel = isEdInitiatedWithdrawal(movement)
    ? // Ward Lead audit (2026-09-17): `WITHDRAW_REFERRAL`'s
      // post-acceptance branch does not clear `acceptedUnitId`
      // (`ward-flow-reducer.ts` — a separate defect, out of this
      // fix's scope), so `acceptedUnit` below can still resolve for a
      // withdrawn movement. Checked first so this column never shows a
      // ward name beside "Withdrawn: ..." in the actions column on the
      // same row.
      "Withdrawn"
    : movement.edOutcome === "for_community_follow_up"
      ? "For community follow-up"
      : movement.edOutcome === "for_discharge"
        ? "For discharge"
        : acceptedUnit
          ? acceptedUnit.name
          : movement.referredUnitIds.length > 0
            ? "Awaiting bed placement"
            : (referredTo ?? "In department");
  return {
    movement,
    minutesInDepartment,
    medicalClearance,
    formExpiryText,
    formExpiryWarningText,
    item,
    patientInfo,
    examBlocked,
    handoverBlocked,
    transportBlocked,
    transportLegalFormWarning,
    transportOpen,
    withdrawBlocked,
    withdrawOpen,
    transportAnswersBlocked,
    examOpen,
    edOutcomeOpen,
    edOutcomeBlocked,
    dischargeBlocked,
    cmhtBlocked,
    recordedSuburb,
    teamOptions,
    urgencyChangeOpen,
    legalStatusChangeOpen,
    legalFormExpiryOpen,
    legalFormExpiryIsExtension,
    legalFormExpirySaveBlocked,
    legalFormExpirySaveBlockedReason,
    receiptCorrectionOpen,
    acceptedUnit,
    isForm1A,
    openWardReferral,
    referredTo,
    bedSearch,
    primaryAction,
    nextAction,
    destinationLabel,
  };
}

export type EdBoardRowModel = ReturnType<typeof edBoardRowModel>;

/**
 * One board row. On the board table it returns the table row and hands an open person sheet to
 * `onTableSheet`, because A2's sheet renders after the table, never inside a table row; on a phone
 * it returns the list row with its sheet after it.
 */
export function renderEdBoardRow(
  movement: Movement,
  ctx: EdScreenContext,
  onTableSheet: (sheet: ReactNode) => void,
): ReactNode {
  const row = edBoardRowModel(movement, ctx);
  const {
    transportOpen,
    transportBlocked,
    withdrawOpen,
    withdrawBlocked,
    examOpen,
    examBlocked,
    edOutcomeOpen,
    edOutcomeBlocked,
    cmhtBlocked,
    urgencyChangeOpen,
    legalStatusChangeOpen,
    legalFormExpiryOpen,
    receiptCorrectionOpen,
  } = row;
  const {
    boardTable,
    patientBay,
    phoneSheetFor,
    setPhoneSheetFor,
    setPhoneSheetReason,
    setExaminationOpenFor,
    setEdOutcomeOpenFor,
    setUrgencyChangeOpenFor,
    setLegalStatusChangeOpenFor,
    setTransportOpenFor,
    setWithdrawOpenFor,
    setLegalFormExpiryOpenFor,
    setReceiptCorrectionOpenFor,
    communityReferralOpenFor,
    setCommunityReferralOpenFor,
  } = ctx;
  const menuItems = renderEdRowMenuItems(row, ctx);
  const facts = renderEdRowFacts(row, ctx);
  const controls = renderEdRowControls(row, ctx, facts);
  const nextGroupBody = renderEdRowNextGroup(row, ctx, menuItems, facts);
  const expandedCards = renderEdRowExpandedCards(row, ctx);
  const subFormContent = renderEdRowForms(row, ctx);
  const subFormOpen =
    (communityReferralOpenFor === movement.id && !cmhtBlocked) ||
    (withdrawOpen && !withdrawBlocked) ||
    (transportOpen && !transportBlocked) ||
    (examOpen && !examBlocked) ||
    (edOutcomeOpen && !edOutcomeBlocked) ||
    urgencyChangeOpen ||
    legalStatusChangeOpen ||
    legalFormExpiryOpen ||
    receiptCorrectionOpen;
  const phoneBay = patientBay(movement.id);
  // An action that opens a form opens the person sheet, so edits happen there.
  const sheetOpen = phoneSheetFor === movement.id || subFormOpen;
  const closeSheet = () => {
    setPhoneSheetFor(undefined);
    setPhoneSheetReason(undefined);
    if (!subFormOpen) return;
    setExaminationOpenFor(undefined);
    setEdOutcomeOpenFor(undefined);
    setUrgencyChangeOpenFor(undefined);
    setLegalStatusChangeOpenFor(undefined);
    setTransportOpenFor(undefined);
    setWithdrawOpenFor(undefined);
    setLegalFormExpiryOpenFor(undefined);
    setReceiptCorrectionOpenFor(undefined);
    setCommunityReferralOpenFor(undefined);
  };
  const personSheet = sheetOpen
    ? renderEdPersonSheet(row, ctx, {
        closeSheet,
        phoneBay,
        subFormOpen,
        subFormContent,
        nextGroupBody,
        expandedCards,
        controls,
      })
    : null;
  if (boardTable) {
    if (sheetOpen) onTableSheet(personSheet);
    return renderEdBoardTableRow(row, ctx, { facts, menuItems, nextGroupBody, sheetOpen, phoneBay });
  }
  return renderEdBoardPhoneRow(row, ctx, { personSheet, phoneBay });
}
