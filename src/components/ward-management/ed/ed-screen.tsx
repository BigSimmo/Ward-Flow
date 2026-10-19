"use client";
import { WardNotFoundBody } from "@/components/ward-management/shell/ward-not-found";

import { useMemo, useRef, type FormEvent } from "react";
import { createReadmissionIndex } from "@/components/ward-management/ward-readmission";
import { splitDuration } from "@/components/ward-management/ward-clock";
import {
  useDueSoonThresholds,
  useWardFlowClock,
  useWardFlowSelect,
} from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { referralDraftBlockedReason } from "./ed-blocked-reasons";
import { useUndoableStep } from "@/components/ward-management/use-undoable-step";
import { allEmergencyDepartments, edById, siteByCode } from "@/components/ward-management/ward-sites";
import { ArrivalTimeModal } from "@/components/ward-management/referrals/arrival-time-modal";
import { useIsPhone, useIsTabletPortrait, useMediaQuery, useOptionalToast } from "@/components/wf";
import { EdElsewhereLinks, EdNeedsYou } from "./ed-needs-you";
import styles from "./ed.module.css";
import { EdOverview } from "./ed-overview";
import { SinceLastLookPill } from "../since-last-look-pill";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { openReferralSheet } from "@/components/ward-management/shell/ward-drawer-bus";
import { raiseReferralHref } from "@/components/ward-management/shell/ward-facade";
import { edScreenActions } from "./ed-screen-actions";
import { EdBoardSection } from "./ed-screen-board";
import type { EdScreenContext } from "./ed-screen-context";
import { deriveEdScreen } from "./ed-screen-derivations";
import { EdListsSection } from "./ed-screen-lists";
import {
  DEFAULT_DRAFT,
  edStepSaid,
  instantFromDateAndTimeInputs,
  isEdInitiatedWithdrawal,
  waitLine,
  type EdStepEvent,
} from "./ed-screen-model";
import { EdPatientDialog } from "./ed-screen-patient-dialog";
import { EdPhonePanes } from "./ed-screen-phone";
import { EdRaiseIntoMovementSection } from "./ed-screen-raise-section";
import { useEdInboxDecline } from "./use-ed-screen-decline";
import {
  useEdBoardDrafts,
  useEdBoardView,
  useEdEscapeKey,
  useEdRaiseAnnouncement,
  useEdReferralDraft,
  useEdRowPanels,
} from "./use-ed-screen-state";

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
 *   ed-screen-raise-section.tsx  "Raise into a movement"
 *   ed-screen-board.tsx          the board, its filters and search
 *   ed-screen-board-row.tsx      one board row, put together
 *   ed-screen-desktop.tsx        a row of the board table (wider screens)
 *   ed-screen-phone.tsx          the phone panes switch and a phone list row
 *   ed-screen-row-*.tsx          a row's facts, menu and panels
 *   ed-screen-transport-dialog.tsx, ed-screen-person-sheet.tsx
 *   ed-screen-lists.tsx, ed-screen-inbox.tsx, ed-screen-referred.tsx   the Lists tabs
 *   ed-screen-patient-dialog.tsx the patient record dialog
 */
export { edBayAssignments, edReferralClockLines } from "./ed-screen-model";

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
export function EdScreen({ edId }: EdScreenProps) {
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
  const { draft, setDraft, setReferralOpen, raisingFromReferralId, setRaisingFromReferralId } = referralDraft;
  const boardDrafts = useEdBoardDrafts();
  const rowPanels = useEdRowPanels();
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
  // A2-1 (audit 13 Oct 2026): a raised referral used to land off screen with no word. The movement
  // ids held before the raise; the new one is announced with a toast that opens its row.
  const raisePendingRef = useRef<Set<string> | null>(null);
  function recordEdStep(event: EdStepEvent) {
    const subject = "referralId" in event ? { referralId: event.referralId } : { movementId: event.movementId };
    runStep(event, {
      success: edStepSaid(event),
      undo: (at) => ({ type: "UNDO_ED_STEP", role: "ed", now: at, ...subject }),
      undone: "Undone. Back as it was.",
    });
  }
  /** Phone: Board, Needs you and Lists are one tap apart (v10 ED page, phone). */
  const isPhone = useIsPhone();
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
    raisePendingRef,
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
    notReviewedCount,
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
  const actions = edScreenActions({ raise, now, dayZero, thisEdId, recordEdStep, panels: rowPanels });

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
    const { cohort, security, sex, gender, legalStatus, urgency } = draft;
    if (
      referralDraftBlockedReason({ ...draft, patientFound: draft.patientId !== undefined }) !== undefined ||
      cohort === undefined ||
      security === undefined ||
      sex === undefined ||
      gender === undefined ||
      legalStatus === undefined ||
      urgency === undefined ||
      draft.specialling === undefined ||
      draft.highAcuity === undefined ||
      (draft.legalFormDueAtDate !== "") !== (draft.legalFormDueAtTime !== "")
    ) {
      return;
    }
    raise("RAISE_REFERRAL", {
      edId: thisEdId,
      // Opus review round 2, 17 September 2026 (P2), item 6: `undefined` in the ordinary,
      // unlinked case (this form's existing behaviour) — set only when this form was opened via
      // the inbox row's own "Raise into a movement" button, which is also what supplied the
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
        specialling: draft.specialling,
        highAcuity: draft.highAcuity,
        legalStatus,
        urgency,
        legalFormCode: draft.legalFormCode,
        // `undefined` when the clinician typed nothing (or the guard above already refused
        // something incomplete) — the reducer then writes no deadline at all, which is the state
        // every ward surface already renders explicitly as absent.
        legalFormDueAt: instantFromDateAndTimeInputs(draft.legalFormDueAtDate, draft.legalFormDueAtTime, dayZero),
      },
    });
    raisePendingRef.current = new Set(movements.map((movement) => movement.id));
    setDraft(DEFAULT_DRAFT);
    setReferralOpen(false);
    setRaisingFromReferralId(undefined);
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
    ...referralDraft,
    ...boardDrafts,
    ...rowPanels,
    ...boardView,
    ...inboxDecline,
    ...derived,
    ...actions,
  };

  return (
    <div
      className={styles.screen}
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
              (movement) =>
                movement.originEdId === candidate.id &&
                movement.stage !== "arrived" &&
                (!movement.closure ||
                  (movement.edOutcome !== undefined && !movement.leftDepartmentAt) ||
                  isEdInitiatedWithdrawal(movement)),
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
              breaches: candidateMovements.filter((movement) => now - movement.openedAt > accessTarget).length,
            };
          })}
          onBoard={patients.length}
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
              value: longestHere === undefined ? 0 : splitDuration(longestHere),
              tone: longestHere !== undefined && longestHere > accessTarget ? "danger" : undefined,
            },
            { id: "held", label: "Bed held", value: waitingForBed },
            { id: "leaving", label: "Leaving for a ward", value: leavingForWard },
            { id: "unreviewed", label: "Not reviewed", value: notReviewedCount },
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

        <EdBoardSection ctx={ctx} />

        {isPhone ? (
          <EdNeedsYou items={needsYouItems} data-pane="needs" />
        ) : !needsRailSlides && !fullscreenBoard ? (
          <EdNeedsYou items={needsYouItems} data-pane="needs" data-rail="" />
        ) : null}
        {/* Device audit 11 Oct 2026: the Statewide capacity table and the 24 hour timeline left the
            page; each is one link to the page that owns it. */}
        {fullscreenBoard ? null : (
          <EdElsewhereLinks
            links={[
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
            ]}
          />
        )}
        {fullscreenBoard ? null : <EdListsSection ctx={ctx} />}

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
