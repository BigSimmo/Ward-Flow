"use client";

import { isWaitingInEd } from "@/components/ward-management/ward-ed-presence";
import { notWaitingParts, waitingSplit } from "@/components/ward-management/ward-shared-figures";
import { WardNotFoundBody } from "@/components/ward-management/shell/ward-not-found";

import { useMemo, type FormEvent } from "react";
import { createReadmissionIndex } from "@/components/ward-management/ward-readmission";
import { splitDuration } from "@/components/ward-management/ward-clock";
import {
  useDueSoonThresholds,
  useWardFlowClock,
  useWardFlowSelect,
} from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { referralDraftBlockedReason } from "@/components/ward-management/ed/ed-blocked-reasons";
import { useUndoableStep } from "@/components/ward-management/use-undoable-step";
import { allEmergencyDepartments, edById, siteByCode } from "@/components/ward-management/ward-sites";
import { ArrivalTimeModal } from "@/components/ward-management/referrals/arrival-time-modal";
import { useIsPhone, useIsTabletPortrait, useMediaQuery, useOptionalToast } from "@/components/wf";
import { EdNeedsYou } from "@/components/ward-management/ed/ed-needs-you";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import redesign from "./ed-board-redesign.module.css";
import styles from "@/components/ward-management/ed/ed.module.css";
import { EdOverview } from "@/components/ward-management/ed/ed-overview";
import { SinceLastLookPill } from "@/components/ward-management/since-last-look-pill";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { openReferralSheet } from "@/components/ward-management/shell/ward-drawer-bus";
import { raiseReferralHref } from "@/components/ward-management/shell/ward-facade";
import { edScreenActions } from "@/components/ward-management/ed/ed-screen-actions";
import { EdBoardSection } from "@/components/ward-management/ed/ed-screen-board";
import { EdAccessRiskCard } from "./ed-access-risk-redesign";
import type { EdScreenContext } from "@/components/ward-management/ed/ed-screen-context";
import { deriveEdScreen } from "@/components/ward-management/ed/ed-screen-derivations";
import { EdListsSection } from "@/components/ward-management/ed/ed-screen-lists";
import {
  edStepSaid,
  instantFromDateAndTimeInputs,
  waitLine,
  type EdStepEvent,
} from "@/components/ward-management/ed/ed-screen-model";
import { EdPatientDialog } from "@/components/ward-management/ed/ed-screen-patient-dialog";
import { EdPhonePanes } from "@/components/ward-management/ed/ed-screen-phone";
import { EdRaiseIntoMovementSection } from "@/components/ward-management/ed/ed-screen-raise-section";
import { useEdInboxDecline } from "@/components/ward-management/ed/use-ed-screen-decline";
import { useEdReferralSave } from "@/components/ward-management/ed/use-ed-referral-save";
import {
  useEdBoardDrafts,
  useEdBoardView,
  useEdEscapeKey,
  useEdRaiseAnnouncement,
  useEdReferralDraft,
  useEdRowPanels,
} from "@/components/ward-management/ed/use-ed-screen-state";
import { instantFromEstimatedTimeInputs } from "@/components/ward-management/ward-transport-checks";
import { useEdExpirySave } from "@/components/ward-management/ed/use-ed-expiry-save";
import { useEdRecordSave } from "@/components/ward-management/ed/use-ed-record-save";
import { useEdExaminationSave } from "@/components/ward-management/ed/use-ed-examination-save";

/*
 * Fix list 2.5 and 9.6 (15 Oct 2026): this screen was one 6,500 line file. It is now split into
 * sibling files with no change to behaviour, markup or appearance. This file keeps the records,
 * the hooks, the early return and the page's frame; the rest lives in:
 *
 *   ed-screen-model.ts           constants, draft shapes and pure helpers
 *   use-ed-screen-state.ts       the screen's state hooks (drafts, panels, board view)
 *   use-ed-screen-decline.ts     the inbox decline and its refusal check
 *   ed-screen-derivations.ts     who is on the board, the lists, counts and Needs you
 *   ed-screen-timeline.tsx       the department's recorded events
 *   ed-screen-actions.ts         the row panels' submit handlers
 *   ed-screen-context.ts         the one object every section reads
 *   ed-screen-raise-section.tsx  "Ask for a bed"
 *   ed-screen-board.tsx          the board, its filters and search
 *   ed-screen-board-row.tsx      one board row, put together
 *   ed-screen-desktop.tsx        a row of the board table (wider screens)
 *   ed-screen-phone.tsx          the phone panes switch and a phone list row
 *   ed-screen-row-*.tsx          a row's facts, menu and panels
 *   ed-screen-transport-dialog.tsx, ed-screen-person-sheet.tsx
 *   ed-screen-lists.tsx, ed-screen-inbox.tsx, ed-screen-referred.tsx   the Lists tabs
 *   ed-screen-patient-dialog.tsx the patient record dialog
 */
export { edBayAssignments, edReferralClockLines } from "@/components/ward-management/ed/ed-screen-model";

type EdScreenProps = {
  edId: string;
};

/**
 * Task 11: one emergency department's own view — its own patients, both clocks, the
 * departmental access target, and the single outstanding item for each. Never the coordinator's
 * statewide queue, shortlist or flow diagram filtered down (spec §7 says so explicitly).
 *
 * Resolved via `edById` (Task 9's addition to `ward-sites.ts`); an id that resolves to nothing
 * renders an explicit empty state naming the id (Global Constraint, addendum R40 — the same rule
 * `ward-screen.tsx` and `officer-screen.tsx`'s unit/department lookups already follow), never a
 * substituted department.
 */
/**
 * Preview only: a fork of `EdScreen`. One table: the Lists below it repeated the same people, so
 * they fold behind one closed row on desktop. The board's two links become one footer line, and
 * the Form column shows the form number, with its description in the record and the tooltip.
 */
export function EdBoardRedesign({ edId }: EdScreenProps) {
  const thresholds = useDueSoonThresholds();
  const {
    movements,
    units,
    referrals,
    rejections,
    dayZero,
    dispatch,
    configuration,
    patients: registryPatients,
    admissions,
  } = useWardFlowSelect(
    "movements",
    "units",
    "referrals",
    "rejections",
    "dayZero",
    "dispatch",
    "configuration",
    "patients",
    "admissions",
  );
  const now = useWardFlowClock();
  const raise = useWardRaise("ed");
  const { inboxSnoozes } = useWardFlowSelect("inboxSnoozes");
  // One index for the queue's 28 day readmission flags, built once per change of the records.
  const readmissionIndex = useMemo(
    () => createReadmissionIndex({ admissions, patients: registryPatients, referrals, movements, units }),
    [admissions, registryPatients, referrals, movements, units],
  );
  const accessTarget = configuration.edAccessTargetMinutes;
  // The configured pull hold; until 25 Sept 2026 the transit badges said "4h hold" whatever it was.
  const holdLabel =
    configuration.pullHoldMinutes % 60 === 0
      ? `${configuration.pullHoldMinutes / 60}h`
      : splitDuration(configuration.pullHoldMinutes);
  const department = edById(edId);
  const departments = allEmergencyDepartments();

  // Declared unconditionally, before the early return below — React hooks must run in the same
  // order on every render, the same discipline `ward-screen.tsx` holds to for its own hooks.
  const referralDraft = useEdReferralDraft();
  const { draft, raisingFromReferralId } = referralDraft;
  const boardDrafts = useEdBoardDrafts();
  const rowPanels = useEdRowPanels();
  const expirySave = useEdExpirySave({ dispatch, now, dayZero, panels: rowPanels });
  const recordSave = useEdRecordSave({ dispatch, now, panels: rowPanels });
  const { arrivalPlanOpenFor, setArrivalPlanOpenFor, transportOpenFor, closeTransportDialog, toggleBookTransport } =
    rowPanels;
  /**
   * v10 pass 3: a recorded decline shows a toast with Undo (`UNDO_REFERRAL_DECISION`, the ED's own
   * decision only, within the engine's undo window). `pendingDeclineRef` holds the referral just
   * declined until the rejection check says whether the reducer accepted it; the shared
   * `useUndoableStep` then offers Undo and says why a refused Undo was refused.
   */
  const toast = useOptionalToast();
  // v10 pass 3: an ED next step is recorded at once and Undo takes it back (UNDO_ED_STEP).
  const { run: runStep, offer: offerStep } = useUndoableStep({ dispatch, rejections, now, routeRole: "ed", toast });
  const referralSave = useEdReferralSave(referralDraft, edId);
  const examinationSave = useEdExaminationSave({ dispatch, movements, rejections, now, panels: rowPanels, offerStep });
  function recordEdStep(event: EdStepEvent) {
    const subject = "referralId" in event ? { referralId: event.referralId } : { movementId: event.movementId };
    runStep(event, {
      success: edStepSaid(event),
      // Audit 1 CS-07: a Form 1A receipt is taken back by the legal form undo, as on Legal forms.
      undo: (at) =>
        event.type === "RECORD_LEGAL_FORM_RECEIVED"
          ? { type: "UNDO_LEGAL_FORM_RECORD", role: "ed", now: at, movementId: event.movementId }
          : { type: "UNDO_ED_STEP", role: "ed", now: at, ...subject },
      undone: "Undone. Back as it was.",
    });
  }
  /** Phone: Board, Needs you and Lists are one tap apart (v10 ED page, phone). */
  const isPhone = useIsPhone();
  // DA-09: an ED desk cannot open Capacity or Governance, so those links are offered only to a desk that can.
  const canOpen = useCanOpenHref();
  const elsewhereLinks = [
    {
      href: "/ward-flow/capacity",
      title: "Statewide capacity",
      sub: "Every unit's beds, on the Capacity page",
    },
    {
      href: "/ward-flow/governance",
      title: "Seen in the last 24 hours",
      sub: "This department's recorded events, in the Governance audit",
    },
  ].filter((link) => canOpen(link.href));
  const isTabletPortrait = useIsTabletPortrait();
  /** Mockups: the board is list rows with one Next button on every width; edits live in the sheet. */
  /*
   * Device audit 11 Oct 2026, ED page (owner pick A2): phone reads the board as list rows; wider
   * screens read the full board table, read-only, with one Next button per row and every edit in
   * the person sheet. The Needs you rail sits beside the table only where all nine columns still
   * fit beside it; narrower, it opens from the board header as a slide-over.
   */
  const boardTable = !isPhone;
  const roomForRailBesideTable = useMediaQuery("(min-width: 100rem)");
  const needsRailSlides = isTabletPortrait || (boardTable && !roomForRailBesideTable);
  const boardView = useEdBoardView();
  const {
    phonePane,
    heroHighlight,
    setHeroHighlight,
    selectedPatientId,
    setSelectedPatientId,
    fullscreenBoard,
    setFullscreenBoard,
    setPhoneSheetFor,
  } = boardView;
  useEdEscapeKey({
    arrivalPlanOpenFor,
    setArrivalPlanOpenFor,
    transportOpenFor,
    closeTransportDialog,
    selectedPatientId,
    setSelectedPatientId,
    fullscreenBoard,
    setFullscreenBoard,
  });
  const inboxDecline = useEdInboxDecline({ rejections, raise, offerStep });
  useEdRaiseAnnouncement({
    accepted: referralSave.accepted,
    localBefore: referralSave.acceptedLocalBefore,
    movements,
    department,
    registryPatients,
    referrals,
    toast,
    setSelectedPatientId,
  });

  if (!department) {
    return (
      <div className={styles.screen} data-testid="ward-ed-screen">
        <main id="main-content" className={styles.main}>
          <WardNotFoundBody
            title="Emergency department not found"
            testId="ward-ed-unresolved"
            list={{ href: "/ward-flow/ed", label: "All emergency departments" }}
          >
            No emergency department matches this link. It never falls back to a different department.
          </WardNotFoundBody>
        </main>
      </div>
    );
  }

  const site = siteByCode(department.siteCode);
  // TypeScript's narrowing of `department` above does not reach into `submitReferral`'s closure
  // further down (the same reason `ward-screen.tsx`'s `wardUnitId` exists) — this plain string is
  // what it closes over instead.
  const thisEdId = department.id;

  const derived = deriveEdScreen({
    movements,
    units,
    referrals,
    registryPatients,
    configuration,
    inboxSnoozes,
    admissions,
    now,
    accessTarget,
    thisEdId,
    boardFilter: boardView.boardFilter,
    patientQuery: boardView.patientQuery,
    patientSort: boardView.patientSort,
    heroHighlight,
    selectedPatientId,
    arrivalPlanOpenFor,
    setSelectedPatientId,
    setPhoneSheetFor,
    setArrivalPlanOpenFor,
    toggleBookTransport,
    recordEdStep,
  });
  const {
    patients,
    heroHighlightMatch,
    selectedPatient,
    waitingForBed,
    longestHere,
    leavingForWard,
    heroChips,
    needsYouItems,
    activeHeroChip,
    arrivalPlanMovement,
  } = derived;
  const actions = edScreenActions({
    raise,
    now,
    dayZero,
    thisEdId,
    submitExamination: examinationSave.submitExamination,
    submitLegalFormExpiry: expirySave.submitLegalFormExpiry,
    recordSave,
    panels: rowPanels,
  });

  function submitReferral(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Guards the same fields `referralDraftBlockedReason` names, and does so with direct
    // `=== undefined` checks — not a call to that function — so TypeScript narrows each local
    // binding to its real, answered type below. This is the raise-referral form's own version of
    // `submitDecline`'s `if (declineDraft === undefined) return;` a few lines up: the button
    // being `aria-disabled` stops a click, but this form (unlike the decline panel) IS a real
    // `<form>`, so pressing Enter inside a field submits it regardless of what the button
    // advertises. Without this guard that keystroke would file the same fabricated cohort,
    // security level, sex, legal status or urgency tier the whole fix exists to stop — and, since
    // T3, the same half-typed expiry `referralDraftBlockedReason`'s last check refuses.
    // The patient check (A2-1) has no field to narrow, so it is read from
    // `referralDraftBlockedReason` itself: Enter must not raise a referral for nobody.
    const { cohort, security, sex, gender, legalStatus, urgency, observation, highAcuity } = draft;
    if (
      referralDraftBlockedReason({ ...draft, patientFound: draft.patientId !== undefined }) !== undefined ||
      cohort === undefined ||
      security === undefined ||
      sex === undefined ||
      gender === undefined ||
      legalStatus === undefined ||
      urgency === undefined ||
      observation === undefined ||
      highAcuity === undefined ||
      (draft.legalFormDueAtDate !== "") !== (draft.legalFormDueAtTime !== "")
    ) {
      return;
    }
    referralSave.saveReferral(
      () =>
        raise("RAISE_REFERRAL", {
          edId: thisEdId,
          // Opus review round 2, 17 September 2026 (P2), item 6: `undefined` in the ordinary,
          // unlinked case (this form's existing behaviour) — set only when this form was opened via
          // the inbox row's own "Ask for a bed" button, which is also what supplied the
          // gender prefill in `draft.gender` above.
          referralId: raisingFromReferralId,
          ...(draft.patientId === undefined ? {} : { patientId: draft.patientId }),
          draft: {
            cohort,
            security,
            sex,
            // T11 (item 8): widened from the three-state local draft — `"not_recorded"` becomes
            // `undefined` on the dispatched event, the model's own "not yet recorded" convention.
            gender: gender === "not_recorded" ? undefined : gender,
            // T15 (item 12): `"none"` becomes `undefined` on the dispatched event, the same widening
            // the gender field immediately above gets.
            tentativeDiagnosis: draft.tentativeDiagnosis === "none" ? undefined : draft.tentativeDiagnosis,
            observation: {
              level: observation,
              intervalMinutes: observation === "intermittent" ? draft.observationIntervalMinutes : null,
              reviewAt:
                draft.observationReviewTime.trim() === ""
                  ? null
                  : (instantFromEstimatedTimeInputs(draft.observationReviewTime, draft.observationReviewDay, now) ??
                    null),
            },
            highAcuity,
            legalStatus,
            urgency,
            legalFormCode: draft.legalFormCode,
            // `undefined` when the clinician typed nothing (or the guard above already refused
            // something incomplete) — the reducer then writes no deadline at all, which is the state
            // every ward surface already renders explicitly as absent.
            legalFormDueAt: instantFromDateAndTimeInputs(draft.legalFormDueAtDate, draft.legalFormDueAtTime, dayZero),
          },
        }),
      now,
      new Set(movements.map((movement) => movement.id)),
    );
  }

  const ctx: EdScreenContext = {
    thresholds,
    movements,
    units,
    referrals,
    dayZero,
    dispatch,
    raise,
    registryPatients,
    now,
    readmissionIndex,
    accessTarget,
    holdLabel,
    department,
    site,
    thisEdId,
    isPhone,
    isTabletPortrait,
    boardTable,
    needsRailSlides,
    recordEdStep,
    submitReferral,
    referralFieldsDisabled: referralSave.referralFieldsDisabled,
    referralSaveMessage: referralSave.referralSaveMessage,
    ...referralDraft,
    ...boardDrafts,
    ...rowPanels,
    ...boardView,
    ...inboxDecline,
    ...derived,
    ...examinationSave,
    ...actions,
    ...expirySave,
    ...recordSave,
  };

  const boardSplit = waitingSplit(patients);

  return (
    <div
      className={`${styles.screen} ${redesign.board}`}
      data-testid="ward-ed-screen"
      data-ward-design="third-edition"
      data-ward-rebuilt-screen="emergency-department"
    >
      <main
        id="main-content"
        className={styles.main}
        data-phone-pane={isPhone ? phonePane : undefined}
        data-layout={boardTable && !needsRailSlides && !fullscreenBoard ? "rail" : undefined}
        data-handover-view={boardTable && fullscreenBoard ? "true" : undefined}
      >
        <EdOverview
          key={department.id}
          sinceLastLook={<SinceLastLookPill scopeKey={`ed:${department.id}`} />}
          departmentId={department.id}
          departments={departments.map((candidate) => {
            const candidateSite = siteByCode(candidate.siteCode);
            const candidateMovements = movements.filter(
              (movement) => movement.originEdId === candidate.id && isWaitingInEd(movement),
            );
            return {
              id: candidate.id,
              name: candidate.name,
              code: candidateSite?.code ?? candidate.siteCode,
              service: candidateSite?.service ?? "Service not identified",
              waiting: candidateMovements.length,
              longest: candidateMovements.length
                ? splitDuration(Math.max(...candidateMovements.map((movement) => Math.max(now - movement.openedAt, 0))))
                : "—",
              // At or over: the one ED long-wait rule (ward-pressure.ts, ops-16) counts a wait that reaches the target.
              breaches: candidateMovements.filter((movement) => now - movement.openedAt >= accessTarget).length,
            };
          })}
          onBoard={patients.length}
          // Overall review, 20 Oct 2026: the board holds people still in transit and recorded
          // outcomes as well, so the title says how its count splits ("5 waiting, 1 in transit") and
          // the "waiting" part is this department's tile figure in the strip below.
          onBoardParts={[`${boardSplit.waiting} waiting`, ...notWaitingParts(boardSplit)]}
          chips={heroChips}
          highlight={heroHighlight}
          onHighlight={setHeroHighlight}
          highlightNote={
            activeHeroChip ? (
              <>
                <b>{patients.filter(heroHighlightMatch[activeHeroChip.id]).length}</b> of {patients.length}{" "}
                {activeHeroChip.word}, everyone stays on the board
              </>
            ) : undefined
          }
          checks={[
            {
              id: "longest",
              label: "Longest here",
              value: longestHere === undefined ? "—" : splitDuration(longestHere),
              tone: longestHere !== undefined && longestHere >= accessTarget ? "danger" : undefined,
            },
            { id: "held", label: "Accepted", value: waitingForBed },
            { id: "leaving", label: "Leaving for a ward", value: leavingForWard },
            { id: "target", label: "Access target", value: waitLine(accessTarget) },
          ]}
          // Option B (Josh, 13 Oct 2026): one referral flow. Raise referral opens the referral
          // slide-out from this department; the inline form below now only raises a movement from a
          // referral already in this department's inbox.
          onRaiseReferral={() =>
            openReferralSheet(raiseReferralHref({ source: "ed_medical", originEdId: thisEdId, refer: "ward" }))
          }
        />

        <EdRaiseIntoMovementSection ctx={ctx} />

        {isPhone ? <EdPhonePanes ctx={ctx} /> : null}

        {/* Forecasting build (Josh, 23 Oct 2026, screen 4), loaded lazily for the phone budget. */}
        <EdAccessRiskCard edId={thisEdId} now={now} />

        <EdBoardSection ctx={ctx} />

        {isPhone ? (
          <EdNeedsYou items={needsYouItems} data-pane="needs" />
        ) : !needsRailSlides && !fullscreenBoard ? (
          <EdNeedsYou items={needsYouItems} data-pane="needs" data-rail="" />
        ) : null}
        {/* Device audit 11 Oct 2026: the Statewide capacity table and the 24 hour timeline left the
            page; each is one link to the page that owns it. */}
        {fullscreenBoard || elsewhereLinks.length === 0 ? null : (
          <nav className={redesign.linksFoot} aria-label="Elsewhere" data-testid="ward-ed-elsewhere">
            {elsewhereLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.title}
                <ChevronRight size={14} aria-hidden="true" />
              </Link>
            ))}
          </nav>
        )}
        {fullscreenBoard ? null : isPhone ? (
          <EdListsSection ctx={ctx} />
        ) : (
          <details className={redesign.listsFold}>
            <summary>
              Lists by step <span>Medical clearance, Expects, Forms and Referred, the same people as the board</span>
            </summary>
            <EdListsSection ctx={ctx} />
          </details>
        )}

        {selectedPatient ? <EdPatientDialog ctx={ctx} selectedPatient={selectedPatient} /> : null}

        <WardPrototypeFooter
          testId="ward-ed-governance"
          note="Emergency department census · Not approved for clinical use"
        />
      </main>
      {arrivalPlanMovement ? (
        <ArrivalTimeModal
          isOpen
          onClose={() => {
            setArrivalPlanOpenFor(undefined);
            // Back to the patient record only when that record opened the plan.
            if (rowPanels.arrivalPlanFromRecord) setSelectedPatientId(arrivalPlanMovement.id);
          }}
          movement={arrivalPlanMovement}
          role="ed"
        />
      ) : null}
    </div>
  );
}
