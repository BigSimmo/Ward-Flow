"use client";

import { settledWardCommand } from "../ward-command-completion";
import { useWardRaise } from "../ward-flow-raise";

import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useLegalFormsCopy } from "./use-legal-forms-copy";
import { BookOpen, ClipboardCopy, ClipboardList, Ellipsis, Plus } from "lucide-react";
import {
  Button,
  Card,
  CardBody,
  CardHead,
  DataRow,
  Drawer,
  FolderTabs,
  Hero,
  HeroAct,
  HeroFigures,
  HeroQuickChips,
  HeroTop,
  LiveChip,
  Menu,
  PhoneListRow,
  PhoneSheet,
  Segmented,
  StackBar,
  SrOnly,
  StatusGlyph,
  cx,
  folderTabClasses,
  tableClasses,
  type StackSegment,
  type WfFill,
  useIsPhone,
} from "@/components/wf";
import { movementOriginLabel } from "@/components/ward-management/ward-movement-origin";
import {
  formatInstant,
  formatInstantWithDay,
  formatSheetMoment,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { ListExportButton } from "@/components/ward-management/ward-list-export-button";
import { ListPrintButton } from "@/components/ward-management/ward-list-print-button";
import { isOpen } from "@/components/ward-management/ward-derivations";
import {
  useDueSoonThresholds,
  useWardFlowClock,
  useWardFlowSelect,
} from "@/components/ward-management/ward-flow-provider";
import { useRoleGate, useRouteRole } from "@/components/ward-management/ward-role-gate";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { ROLE_SCREENS } from "@/components/ward-management/ward-role-access";
import { SeclusionFormsView } from "@/components/ward-management/restrictive-practice/seclusion-forms-view-lazy";
import type { SeclusionAsk } from "@/components/ward-management/restrictive-practice/seclusion-forms-view";
import { SeclusionTop } from "@/components/ward-management/restrictive-practice/seclusion-top";
import pageTopStyles from "@/components/ward-management/page-top-title.module.css";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { journeySentByKind } from "@/components/ward-management/ward-journey-sender";
import { journeySentByDesk } from "@/components/ward-management/ward-referral-sender";
import { movementRefuses3C } from "@/components/ward-management/ward-legal-clock";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import type { Movement } from "@/components/ward-management/ward-model";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { edById, edShortName } from "@/components/ward-management/ward-sites";
import {
  SUPPORT_NOTIFICATION_PARTIES,
  SUPPORT_NOTIFICATION_PARTY_SHORT,
  type SupportNotificationParty,
} from "@/components/ward-management/ward-support-notifications";
import { usePrintableDisclosures } from "@/components/ward-management/use-printable-disclosures";
import { useUndoableStep } from "@/components/ward-management/use-undoable-step";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { useWardBarPageTitle } from "@/components/ward-management/shell/ward-bar-page-tools";

import {
  currentLegalDueAt,
  formatReminderHours,
  legalDeadlineText,
  legalExpiryReminderSummary,
  legalFormBreakdown,
  legalFormGroupRows,
  isLegalDeadlineBreached,
} from "./legal-forms-derivations";
import {
  admittedOnAForm,
  legalFormsListPopulation,
  LegalFormsAdmitted,
  WARD_RECORDS_ADMITTED,
} from "./legal-forms-admitted";
import { FocusPanel, typedReceipt } from "./legal-forms-panel";
import { AddTimeDialog } from "./legal-forms-add-time";
import { ChecklistView, FormRow, GAP_LABEL, PhoneFormRow, ROW_COLUMNS } from "./legal-form-rows";
import type { WrittenSave } from "./legal-forms-written-time";
import {
  ExtendSheet,
  RecordFormSheet,
  RequirementsSheet,
  TellSheet,
  movementPickerLabel,
  type RecordDraft,
} from "./legal-forms-sheets";
import {
  CATALOGUE,
  clockStanding,
  formTitle,
  handoverLines,
  hasGap,
  isActNow,
  isOwnedLegalFormCode,
  receiptEventAccepts,
  recentTellSubjects,
  type RecordGap,
} from "./legal-forms-view";
import { TYPED_TIME_KEY } from "./legal-time-as-typed";
import { LegalLimitsNotChecked } from "../legal-limits-not-checked";
import { PhoneChecklist } from "./legal-forms-phone-checklist";
import type { LegalFormDetailsSave } from "./legal-form-details";
import styles from "./legal-forms.module.css";
import { SAVE_NOT_CONFIRMED } from "@/components/ward-management/ward-save-failure";

/**
 * FORMS (renamed from Legal forms, owner 9 Oct 2026; built from the approved v4 mockup). Live work for each
 * patient on a Mental Health Act form. The hero answers and carries the highlight chips; three cards under it
 * count what is still to record on the form and who is still to be told; the table lists everyone on a form in
 * two groups that are never ordered against each other. Desktop shows the hero and the list at full width (D-77
 * change 5): the record-and-tell strip sits behind the phone's sheet only, and a chosen patient's form opens in
 * a drawer over the list. Form times live in Tools. Review,
 * rates, audit, registers and reports live on Governance. Owner rules kept: no invented deadlines or section
 * numbers (D5), an unconnected action says "Not wired in this prototype." (D4), and a highlight never hides a row.
 */

const CHART_WINDOW_MINUTES = 8 * 60;

// FS3 (Josh, 3 Nov 2026): seclusion and restraint in use now is a view of Forms.
type View = "clocks" | "checklist" | "history" | "seclusion";
type Highlight =
  | { kind: "act" }
  | { kind: "soon" }
  | { kind: "none" }
  | { kind: "code"; code: string }
  | { kind: "gap"; gap: RecordGap }
  | null;

const CODE_FILLS: WfFill[] = ["data-1", "data-2", "data-3", "neutral", "closed"];
/** Form type chips shown before "+N" in Forms in force, so the chips stay on one line. */
const CODE_CHIPS_SHOWN = 3;

const GAP_ACTION: Record<RecordGap, string> = {
  written: "Add time",
  // "Mark received" truncated in the task strip (device audit 11 Oct 2026).
  received: "Received",
  examination: "Record exam",
};

// A form save whose confirmation never arrived: the sheet keeps its draft and says why.
const UNCONFIRMED_SAVE = {
  commandId: "",
  status: "failed",
  message: SAVE_NOT_CONFIRMED,
} as const;

function sameHighlight(a: Highlight, b: Highlight): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind !== b.kind) return false;
  if (a.kind === "code" && b.kind === "code") return a.code === b.code;
  if (a.kind === "gap" && b.kind === "gap") return a.gap === b.gap;
  return true;
}

type WorkspaceProps = { initialMovementId?: string; recordOnOpen?: boolean };

export function LegalFormsScreen(props: WorkspaceProps = {}) {
  const { worldGeneration } = useWardFlowSelect("worldGeneration");
  return <LegalFormsWorkspace key={worldGeneration} {...props} />;
}

function LegalFormsWorkspace({ initialMovementId, recordOnOpen = false }: WorkspaceProps) {
  const thresholds = useDueSoonThresholds();
  usePrintableDisclosures();

  const { movements, referrals, patients, admissions, units, supportNotifications, dispatch, dayZero, rejections } =
    useWardFlowSelect(
      "movements",
      "referrals",
      "patients",
      "admissions",
      "units",
      "supportNotifications",
      "dispatch",
      "dayZero",
      "rejections",
    );
  const now = useWardFlowClock();
  const gate = useRoleGate();
  // B2 (site review, 12 Oct 2026): every step is recorded as the route's own role, so history names
  // who acted (the coordinator here) rather than a borrowed "ED".
  const routeRole = useRouteRole();
  const raise = useWardRaise(routeRole);
  // v10 pass 3: a recorded form time and a Tell record each offer Undo on the toast.
  const { run: runStep, offer: offerStep } = useUndoableStep({
    dispatch,
    rejections,
    now,
    routeRole,
  });

  // FS3: `?view=seclusion` opens the seclusion and restraint view (the old Seclusion page sends
  // people here), and `&admission=` (a synthetic stay id, never a name) opens Start for that patient.
  const params = useSearchParams();
  const startFor = params?.get("admission") ?? undefined;
  const [view, setView] = useState<View>(() => (params?.get("view") === "seclusion" ? "seclusion" : "clocks"));
  const [highlight, setHighlight] = useState<Highlight>(null);
  // Governance links a gap here with ?movement=, so that patient opens selected.
  const [selectedId, setSelectedId] = useState<string | null>(initialMovementId ?? null);
  const [focusGap, setFocusGap] = useState<{ gap: RecordGap; nonce: number } | null>(null);
  // Gap list item 1: the typed receipt time, shared by the panel and the phone's pinned action.
  const [receivedDraft, setReceivedDraft] = useState<{ id: string; text: string } | null>(null);
  const [requirementsCode, setRequirementsCode] = useState<string | null>(null);
  const [recordOpen, setRecordOpen] = useState(
    () => recordOnOpen && initialMovementId !== undefined && gate("RECORD_LEGAL_FORM_WRITTEN", "record-a-form").allowed,
  );
  // MHA forms are never prefilled: the form type opens blank and is chosen from the paper.
  const [recordDraft, setRecordDraft] = useState<RecordDraft>({
    form: "",
    movement: recordOnOpen ? (initialMovementId ?? "") : "",
  });
  const [extendId, setExtendId] = useState<string | null>(null);
  // Add the time (redesign): the row's link opens the written-time form as its own pop-up.
  const [addTimeId, setAddTimeId] = useState<string | null>(null);
  const [addTimeRefusalsAtOpen, setAddTimeRefusalsAtOpen] = useState(0);
  const [tell, setTell] = useState<{ party: SupportNotificationParty | null; key: string | null } | null>(null);
  const { copied, copyNotice, copyText } = useLegalFormsCopy();
  const [tasksOpen, setTasksOpen] = useState(false);
  // Page tops: Start, Record incident and Change a room in the top open the seclusion view's dialogs.
  // `seen` drops the ask once the view has acted on it, so a remounted view does not reopen it.
  const [seclusionAsk, setSeclusionAsk] = useState<(SeclusionAsk & { seen?: boolean }) | undefined>(undefined);
  const seclusionView = (
    <SeclusionFormsView
      startFor={startFor}
      ask={seclusionAsk?.seen ? undefined : seclusionAsk}
      onAskSeen={() => setSeclusionAsk((ask) => ask && { ...ask, seen: true })}
    />
  );
  const isPhone = useIsPhone();
  // Forms in force (v10): the three most common types as chips on one line, the rest behind "+N".
  const [allCodes, setAllCodes] = useState(false);
  const openMovements = movements.filter(isOpen);
  // WT-03 (Josh, 26 Oct 2026): a person admitted on a form stays here, and the ward records the next one.
  const admitted = admittedOnAForm(movements, admissions);
  const recordable =
    routeRole === "ed" ? openMovements : routeRole === "ward" ? admitted : [...openMovements, ...admitted];
  const withDeadline = legalFormGroupRows(movements, now, "with-deadline");
  // "Time not written" is never folded (audit A3-6, 13 Oct 2026) and keeps the longest wait in ED
  // first (`legalFormGroupRows`). Owner, 20 Oct 2026: nothing here works out an Act period, so no
  // computed time orders it.
  const patientOf = (movement: Movement) => resolveSubjectPatient(movement, { patients, referrals });
  const noDeadline = legalFormGroupRows(movements, now, "no-deadline");
  const rows = [...withDeadline, ...noDeadline];
  // D-157: Print, Export and their disabled state use the same people as the on-screen list,
  // including "Admitted on a form" (same `admitted` set the admitted group shows).
  const listPopulation = legalFormsListPopulation(rows, admitted);
  const withoutForm = openMovements.length - rows.length;
  const breakdown = legalFormBreakdown(rows, now);
  const reminders = legalExpiryReminderSummary(movements, now, thresholds);
  const passed = withDeadline.filter((movement) => isLegalDeadlineBreached(movement, now)).length;
  const upcoming = withDeadline.length - passed;
  const actNow = withDeadline.filter((movement) => isActNow(clockStanding(movement, now, thresholds))).length;

  const nameOf = (movement: Movement) => patientOf(movement).formalName;
  const umrnOf = (movement: Movement) => patientOf(movement).umrn;
  const edNameOf = (movement: Movement) => {
    const ed = edById(movement.originEdId);
    return ed ? edShortName(ed) : movementOriginLabel(movement, undefined);
  };
  const wardNameOf = (movement: Movement) =>
    movement.acceptedUnitId ? (units.find((unit) => unit.id === movement.acceptedUnitId)?.name ?? null) : null;

  // A gap this page can close: a written time is only recordable for the forms it owns.
  const offersGap = (movement: Movement, gap: RecordGap) =>
    hasGap(movement, gap) && (gap !== "written" || isOwnedLegalFormCode(movement.legalForm?.code));
  const matches = (movement: Movement): boolean => {
    if (highlight === null) return false;
    const standing = clockStanding(movement, now, thresholds);
    if (highlight.kind === "act") return isActNow(standing);
    if (highlight.kind === "soon") return standing === "soon";
    if (highlight.kind === "none") return currentLegalDueAt(movement) === undefined;
    if (highlight.kind === "code") return movement.legalForm?.code === highlight.code;
    return offersGap(movement, highlight.gap);
  };
  const toggleHighlight = (next: Highlight) => setHighlight((current) => (sameHighlight(current, next) ? null : next));

  const selected = rows.find((movement) => movement.id === selectedId) ?? null;
  const lastWrittenRefusal = selected
    ? rejections.findLast(
        (entry) => entry.movementId === selected.id && entry.attempted === "RECORD_LEGAL_FORM_WRITTEN",
      )
    : undefined;

  const select = (movement: Movement) => {
    setSelectedId(movement.id);
    setFocusGap(null);
  };

  const gapCount = (gap: RecordGap) => rows.filter((movement) => offersGap(movement, gap)).length;
  // Desktop: a task opens its own drawer or sheet, so the Record and tell drawer steps aside.
  const leaveTasks = () => setTasksOpen((open) => open && isPhone);

  const startGap = (gap: RecordGap) => {
    const first = rows.find((movement) => offersGap(movement, gap));
    if (!first) return;
    leaveTasks();
    select(first);
    setFocusGap((previous) => ({ gap, nonce: (previous?.nonce ?? 0) + 1 }));
  };

  // Carer, PSP and MHAS apply to completed moves of involuntary patients (PR #159), so this card
  // reads recent arrivals, transfers and discharges, not the open moves in the table.
  const tellInput = { movements, admissions, patients, referrals, units, supportNotifications };
  const tellSubjects = recentTellSubjects(tellInput, now, false).filter(
    (subject) => subject.missing.length > 0 || subject.key === tell?.key,
  );
  const partyCount = (party: SupportNotificationParty) =>
    tellSubjects.filter((subject) => subject.missing.includes(party)).length;
  const tellNext = (party: SupportNotificationParty) => {
    const first = tellSubjects.find((subject) => subject.missing.includes(party));
    leaveTasks();
    setTell({ party, key: first?.key ?? null });
  };

  const handover = handoverLines(withDeadline, now, nameOf, CHART_WINDOW_MINUTES);

  const openRecord = (movementId?: string) => {
    // An explicit subject wins; the generic entry resumes its unsent synthetic draft.
    if (movementId) setRecordDraft((current) => ({ ...current, movement: movementId }));
    setRecordOpen(true);
  };

  // Feature 11: Mark received is raised as the route's role by the place holding the form. A ward
  // or team holds it only on a journey it sent (D-80), the same rule the server checks.
  const receivedGate = gate("RECORD_LEGAL_FORM_RECEIVED");
  const access = useEffectiveWardAccess();
  // FS3: only the desks that may open seclusion (D-72: ward, site bed manager, coordinator) see the view.
  const seesSeclusion = ROLE_SCREENS[access.role].seclusion !== undefined;
  const shownView: View = view === "seclusion" && !seesSeclusion ? "clocks" : view;
  // D-157: Checklist Print is window.print() of this view, so Admitted on a form stays on
  // Checklist as well as On a form (clocks), and the printed page includes those people.
  const showAdmittedOnAForm = shownView === "clocks" || shownView === "checklist";
  // Page tops (10 Nov 2026): the bar names the Seclusion tab, as the old Seclusion page did.
  const pathname = usePathname() ?? "";
  useWardBarPageTitle(pathname, shownView === "seclusion" ? "Seclusion" : undefined);
  const seclusionItem = seesSeclusion ? [{ id: "seclusion" as const, label: "Seclusion and restraint" }] : [];
  const receivedUnavailable = (movement: Movement): string | undefined =>
    receivedGate.reason ??
    ((routeRole === "ward" || routeRole === "community") &&
    !(
      journeySentByKind(referrals, movement, routeRole) &&
      journeySentByDesk({ referrals, admissions }, movement, access, wardPlaceLookup(units))
    )
      ? "Only the place that sent this journey marks its form received."
      : undefined);
  // Record a form: the coordinator always may; another route sees it greyed with the reason.
  const writtenGate = gate("RECORD_LEGAL_FORM_WRITTEN", "record-a-form");
  // WT-03: a ward records only for a person admitted to its bed, never on an open journey.
  const recordGate = routeRole === "ward" ? { allowed: false, reason: WARD_RECORDS_ADMITTED } : writtenGate;
  const sheetReason = routeRole === "ward" && admitted.length === 0 ? WARD_RECORDS_ADMITTED : writtenGate.reason;
  const extendGate = gate("RECORD_LEGAL_FORM_EXPIRY");
  const receivedTextOf = (movementId: string) => (receivedDraft?.id === movementId ? receivedDraft.text : "");
  const markReceived = (movement: Movement, receivedAt?: Instant) => {
    if (receivedUnavailable(movement) !== undefined) return;
    if (!receiptEventAccepts(movement.legalForm?.code) || movement.legalFormReceivedAt !== undefined) return;
    runStep(
      {
        type: "RECORD_LEGAL_FORM_RECEIVED",
        role: routeRole,
        now,
        movementId: movement.id,
        ...(receivedAt === undefined ? {} : { receivedAt }),
      },
      {
        success: `Form marked received for ${nameOf(movement)}`,
        undo: (at) => ({ type: "UNDO_LEGAL_FORM_RECORD", role: routeRole, now: at, movementId: movement.id }),
        undone: `Received mark undone for ${nameOf(movement)}.`,
      },
    );
  };

  // Form types in force, most first, each with its own data fill.
  const codeTotals = new Map<string, number>();
  for (const movement of rows) {
    const code = movement.legalForm!.code;
    codeTotals.set(code, (codeTotals.get(code) ?? 0) + 1);
  }
  const codeCounts = [...codeTotals.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([code, count], index) => ({ code, count, fill: CODE_FILLS[index % CODE_FILLS.length]! }));
  const codeSegments: StackSegment[] = codeCounts.map((entry) => ({
    id: entry.code,
    value: entry.count,
    fill: entry.fill,
    label: `Form ${entry.code}`,
  }));
  // Ward role: with nobody admitted on a form the ward cannot record here. The Admitted on a form
  // group says so, so the greyed Record a form is left out rather than repeated.
  const recordOffered = !(routeRole === "ward" && admitted.length === 0);
  // Ward role: the ward's own place, named in the title.
  const ownUnitIds = access.scope.kind === "ward" ? access.scope.unitIds : [];
  const ownWardName = units.find((unit) => ownUnitIds.includes(unit.id))?.name;
  const onFormLabel = routeRole === "ward" && ownWardName ? `on moves to ${ownWardName}` : "on a form";
  // Every count names its noun ("1 form to act on", not "1 Act now"; Josh, 30 Oct 2026).
  const forms = (count: number) => (count === 1 ? "form" : "forms");
  const closedWithForms = movements
    .filter((movement) => !isOpen(movement) && movement.legalForm !== undefined)
    .sort((a, b) => (b.closure?.at ?? b.openedAt) - (a.closure?.at ?? a.openedAt));

  const highlightCount = rows.filter(matches).length;
  const rowProps = (movement: Movement) => ({
    movement,
    now,
    name: nameOf(movement),
    umrn: umrnOf(movement),
    edName: edNameOf(movement),
    wardName: wardNameOf(movement),
    selected: movement.id === selectedId,
    highlighted: matches(movement),
    dimmed: highlight !== null && !matches(movement),
    onSelect: select,
    onAddTime: (target: Movement) => {
      setAddTimeRefusalsAtOpen(rejections.length);
      setAddTimeId(target.id);
    },
  });

  // Ward role: with nobody admitted on a form the group still shows, saying where the ward records one.
  const admittedList =
    routeRole === "ward" && admitted.length === 0 ? (
      <section aria-label="Admitted on a form" data-testid="ward-legal-forms-admitted">
        <div className={styles.groupHead}>
          <span>Admitted on a form</span>
          <span className={styles.groupCount}>0</span>
        </div>
        <p className={styles.absent}>{WARD_RECORDS_ADMITTED}</p>
      </section>
    ) : (
      <LegalFormsAdmitted
        {...{ rows: admitted, now, nameOf, umrnOf, wardNameOf, onRecord: openRecord }}
        recordUnavailable={
          writtenGate.reason ?? (routeRole === "ed" ? "The admitting ward records the next form." : undefined)
        }
      />
    );
  const historyList =
    isPhone && closedWithForms.length > 0 ? (
      // v10 phone: one row per closed move, the code chip first and the closing time at the end.
      <ul className={styles.phoneList} aria-label="Closed moves with a form">
        {closedWithForms.map((movement) => {
          const outcome = movement.closure?.outcome;
          const ward = wardNameOf(movement);
          const closedAt = movement.closure?.at;
          const face = closedAt !== undefined ? formatInstant(closedAt) : "";
          const full = closedAt !== undefined ? formatInstantWithDay(closedAt, now) : "";
          return (
            <PhoneListRow
              key={movement.id}
              as="li"
              className={styles.phoneRow}
              leading={<span className={styles.code}>{movement.legalForm?.code}</span>}
              name={nameOf(movement)}
              meta={
                outcome === "arrived"
                  ? `Arrived at ${ward ?? "the receiving ward"}`
                  : outcome === "did_not_proceed"
                    ? "Did not proceed"
                    : `Closed · ${edNameOf(movement)}`
              }
              value={face}
              time={
                closedAt === undefined
                  ? undefined
                  : full === face
                    ? "today"
                    : full.slice(face.length).replace(/^,?\s*/u, "")
              }
            />
          );
        })}
      </ul>
    ) : closedWithForms.length > 0 ? (
      <ul className={styles.historyList} aria-label="Closed moves with a form">
        {closedWithForms.map((movement) => (
          <li key={movement.id} className={styles.historyRow}>
            <span className={styles.cellStack}>
              <span className={styles.name}>{nameOf(movement)}</span>
              <span className={cx(styles.sub, styles.mono)}>{umrnOf(movement)}</span>
            </span>
            <span className={styles.formCell}>
              <span className={styles.code}>{movement.legalForm?.code}</span>
              <span className={styles.formTitle}>{formTitle(movement.legalForm!.code)}</span>
            </span>
            <span className={styles.cellStack}>
              <span className={styles.truncate}>{edNameOf(movement)}</span>
              <span className={cx(styles.sub, styles.truncate)}>{wardNameOf(movement) ?? "No receiving ward"}</span>
            </span>
            <span className={styles.cellStack}>
              <span>
                {movement.closure?.outcome === "arrived"
                  ? "Arrived"
                  : movement.closure?.outcome === "did_not_proceed"
                    ? "Did not proceed"
                    : "Closed"}
              </span>
              <span className={cx(styles.sub, styles.mono)}>
                {movement.closure ? formatInstantWithDay(movement.closure.at, now) : ""}
              </span>
            </span>
          </li>
        ))}
      </ul>
    ) : (
      <p className={styles.absent}>No closed move carries a form yet.</p>
    );

  const copySelectedSummary = () => {
    if (!selected) return;
    copyText(
      "summary",
      `${nameOf(selected)} (${umrnOf(selected)})\n${
        selected.legalForm ? legalFormName(selected.legalForm) : "Voluntary"
      }\n${legalDeadlineText(selected, now)}`,
    );
  };

  // The panel's form and the Add the time pop-up record the written time the same way.
  const saveWritten = (target: Movement, { writtenAt, region, ageBand }: WrittenSave) => {
    if (!recordGate.allowed) return;
    const formCode = target.legalForm?.code;
    if (!isOwnedLegalFormCode(formCode)) return;
    const movementId = target.id;
    const written = { movementId, formCode, writtenAt, ...(region ? { region } : {}), ageBand };
    const completion = raise("RECORD_LEGAL_FORM_WRITTEN", written);
    offerStep(
      {
        success: `Form time recorded for ${nameOf(target)}`,
        undo: (at) => ({ type: "UNDO_LEGAL_FORM_RECORD", role: routeRole, now: at, movementId }),
        undone: `Form time undone for ${nameOf(target)}.`,
      },
      { completion },
    );
    return completion;
  };
  const saveDetails = (target: Movement, details: LegalFormDetailsSave) => {
    if (!recordGate.allowed) return;
    const formCode = target.legalForm?.code;
    if (!formCode) return;
    return raise("RECORD_LEGAL_FORM_DETAILS", { movementId: target.id, formCode, ...details });
  };
  // Export (feature 44, D-157): everyone on a form on the list, including admitted on a form;
  // never names; legal times exactly as typed (D-93, D-102).
  const exportList = async () =>
    (await import("./legal-forms-export")).downloadLegalFormsList(
      listPopulation,
      { umrnOf, edName: edNameOf, wardName: wardNameOf, now, dayZero },
      {
        asAt: formatSheetMoment(now, dayZero, { includeYearAndZone: true }),
        scope:
          "Legal forms; everyone on a form on the list, including admitted on a form, expiry typed first (highlights do not narrow it)",
      },
    );
  const addTimeTarget = rows.find((movement) => movement.id === addTimeId) ?? null;
  const addTimeRefusal = addTimeTarget
    ? rejections
        .slice(addTimeRefusalsAtOpen)
        .findLast((entry) => entry.movementId === addTimeTarget.id && entry.attempted === "RECORD_LEGAL_FORM_WRITTEN")
    : undefined;

  const focusPanel = selected ? (
    <FocusPanel
      key={selected.id}
      movement={selected}
      name={nameOf(selected)}
      umrn={umrnOf(selected)}
      edName={edNameOf(selected)}
      wardName={wardNameOf(selected)}
      now={now}
      dayZero={dayZero}
      onClose={() => setSelectedId(null)}
      focusGap={focusGap}
      refusal={lastWrittenRefusal?.reason}
      onSaveWritten={(written) => saveWritten(selected, written)}
      recordUnavailable={recordGate.reason}
      onMarkReceived={(receivedAt) => markReceived(selected, receivedAt)}
      receivedText={receivedTextOf(selected.id)}
      onReceivedTextChange={(text) => setReceivedDraft({ id: selected.id, text })}
      markReceivedUnavailable={receivedUnavailable(selected)}
      onExtend={() => setExtendId(selected.id)}
      extendUnavailable={extendGate.reason}
      onRecordNext={() => openRecord(selected.id)}
      onSaveDetails={(details) => saveDetails(selected, details)}
      detailsUnavailable={recordGate.reason}
      onRequirements={(code) => setRequirementsCode(code)}
      onCopy={copySelectedSummary}
      copied={copied === "summary"}
    />
  ) : null;

  // The record-and-tell tasks sit one tap away on both layouts; the phone sheet foot pins the next one to record.
  const phoneTaskCount =
    (["written", "received", "examination"] as const).reduce((sum, gap) => sum + gapCount(gap), 0) +
    SUPPORT_NOTIFICATION_PARTIES.reduce((sum, party) => sum + partyCount(party), 0);
  const phoneTaskForms = rows.filter((movement) =>
    (["written", "received", "examination"] as const).some((gap) => offersGap(movement, gap)),
  ).length;
  const nextGap = selected
    ? (["written", "received", "examination"] as const).find((gap) => offersGap(selected, gap))
    : undefined;
  const phonePrimary =
    selected && nextGap
      ? {
          label: GAP_ACTION[nextGap],
          disabledReason:
            nextGap === "received"
              ? (receivedUnavailable(selected) ?? typedReceipt(receivedTextOf(selected.id), now).problem)
              : nextGap === "written"
                ? recordGate.reason
                : undefined,
          onAction: () => {
            if (nextGap === "received") {
              const receipt = typedReceipt(receivedTextOf(selected.id), now);
              if (receipt.problem === undefined) markReceived(selected, receipt.at ?? undefined);
            } else setFocusGap((previous) => ({ gap: nextGap, nonce: (previous?.nonce ?? 0) + 1 }));
          },
        }
      : undefined;
  // v10 phone: the sheet foot always pins the next step. With no gap left to record it is the
  // panel's own "Record next form", and Copy sits beside it, so neither floats mid-sheet.
  const phoneSheetPrimary =
    phonePrimary ??
    (selected
      ? {
          label: "Record next form",
          disabledReason: recordGate.reason,
          onAction: () => openRecord(selected.id),
        }
      : undefined);
  const phoneSheetSecondary = selected
    ? { label: copied === "summary" ? "Copied" : "Copy", onAction: copySelectedSummary }
    : undefined;

  // Read aloud on both layouts: desktop no longer shows the strip that used to carry it (D-77 change 5).
  const breakdownNote = (
    <div className={styles.srOnly} data-testid="legal-form-breakdown">
      {breakdown.map((form) => {
        const openWord = form.openCount === 1 ? "open movement" : "open movements";
        const breachClause =
          form.breachedCount > 0
            ? `, ${form.breachedCount} passed ${form.breachedCount === 1 ? "its deadline" : "their deadlines"}`
            : "";
        return <span key={form.name}>{`${form.name}, ${form.openCount} ${openWord}${breachClause}. `}</span>;
      })}
    </div>
  );

  const taskStrip = (
    <div className={styles.strip}>
      <Card aria-label="Forms in force">
        <CardHead
          title="Forms in force"
          level={2}
          action={
            <button
              type="button"
              className={styles.textLink}
              onClick={() => {
                leaveTasks();
                setRequirementsCode(CATALOGUE[0]!.code);
              }}
            >
              <BookOpen size={14} aria-hidden="true" /> Requirements
            </button>
          }
        />
        <CardBody className={styles.stripBody}>
          <StackBar segments={codeSegments} label="Forms in force by type" thin />
          <div className={styles.codeChips} role="group" aria-label="Highlight a form type">
            {(allCodes
              ? codeCounts
              : codeCounts.filter(
                  (entry, index) =>
                    index < CODE_CHIPS_SHOWN || (highlight?.kind === "code" && highlight.code === entry.code),
                )
            ).map((entry) => (
              <button
                key={entry.code}
                type="button"
                className={styles.codeChip}
                aria-pressed={highlight?.kind === "code" && highlight.code === entry.code}
                title={formTitle(entry.code)}
                onClick={() => toggleHighlight({ kind: "code", code: entry.code })}
              >
                <span className={styles.codeChipKey} data-fill={entry.fill} aria-hidden="true" />
                <span className={styles.codeChipCode}>{entry.code}</span>
                <span className={styles.codeChipCount}>{entry.count}</span>
              </button>
            ))}
            {codeCounts.length > CODE_CHIPS_SHOWN ? (
              <button
                type="button"
                className={styles.codeChip}
                aria-expanded={allCodes}
                onClick={() => setAllCodes((open) => !open)}
              >
                {allCodes ? "Fewer" : `+${codeCounts.length - CODE_CHIPS_SHOWN}`}
                <SrOnly>{allCodes ? " form types" : " more form types"}</SrOnly>
              </button>
            ) : null}
            <span className={styles.stripTotal}>{rows.length} total</span>
          </div>
          {breakdownNote}
        </CardBody>
      </Card>

      <Card aria-label="Record on the form">
        <CardHead title="Record on the form" level={2} aside={<span className={styles.meta}>Open moves</span>} />
        <CardBody className={styles.stripBody}>
          <ul className={styles.taskList}>
            {(["written", "received", "examination"] as const).map((gap) => {
              const count = gapCount(gap);
              return (
                <li key={gap} className={styles.taskRow}>
                  <button
                    type="button"
                    className={styles.taskLabel}
                    aria-pressed={highlight?.kind === "gap" && highlight.gap === gap}
                    onClick={() => toggleHighlight({ kind: "gap", gap })}
                  >
                    <StatusGlyph tone={count > 0 ? "neutral" : "success"} size={9} />
                    {GAP_LABEL[gap]}
                  </button>
                  <span className={styles.taskCount}>
                    <strong>{count}</strong> to do
                  </span>
                  <Button
                    variant="sec"
                    size="sm"
                    disabledReason={count === 0 ? "Nothing to record" : undefined}
                    reasonDisplay="tooltip"
                    onClick={() => startGap(gap)}
                  >
                    {GAP_ACTION[gap]}
                  </Button>
                </li>
              );
            })}
          </ul>
        </CardBody>
      </Card>

      <Card aria-label="Tell people">
        <CardHead
          title="Tell people"
          level={2}
          aside={<span className={styles.meta}>Recent moves, oldest first</span>}
        />
        <CardBody className={styles.stripBody}>
          <ul className={styles.taskList}>
            {SUPPORT_NOTIFICATION_PARTIES.map((party) => {
              const count = partyCount(party);
              return (
                <li key={party} className={styles.taskRow}>
                  <span className={styles.taskLabel}>
                    <StatusGlyph tone={count > 0 ? "neutral" : "success"} size={9} />
                    {SUPPORT_NOTIFICATION_PARTY_SHORT[party]}
                  </span>
                  <span className={styles.taskCount}>
                    <strong>{count}</strong> to do
                  </span>
                  <Button
                    variant="sec"
                    size="sm"
                    disabledReason={count === 0 ? "Everyone is recorded" : undefined}
                    reasonDisplay="tooltip"
                    onClick={() => tellNext(party)}
                  >
                    Tell next
                  </Button>
                </li>
              );
            })}
          </ul>
        </CardBody>
      </Card>
    </div>
  );

  /*
   * Page tops (Josh, 9 Nov 2026): one top on every size, matched to Home. Forms: what is on a form and
   * what ends first, as typed (times are never presented as checked). Seclusion: what is in use now,
   * the rooms and the last day's incidents, from the view's own counts.
   */
  const urgentWords = formatReminderHours(reminders.urgentHours);
  const firstActNow = withDeadline.find((movement) => isActNow(clockStanding(movement, now, thresholds)));
  const actUrgent = actNow - passed;
  const actTitle =
    passed === 0
      ? `${actNow} ${forms(actNow)} ${actNow === 1 ? "ends" : "end"} within ${urgentWords}`
      : actUrgent === 0
        ? `${passed} ${forms(passed)} passed, as typed`
        : `${passed} passed · ${actUrgent} within ${urgentWords}, as typed`;
  const formsTop = (
    <HeroTop
      figures={
        <HeroFigures
          items={[
            { id: "on", value: rows.length, label: onFormLabel, testId: "ward-legal-figure-on" },
            {
              id: "soon",
              value: reminders.withinSoon,
              label: `within ${formatReminderHours(reminders.soonHours)}`,
              // Highlights those rows (all rows stay); the list head says how many and clears it.
              onClick: () => toggleHighlight({ kind: "soon" }),
              pressed: highlight?.kind === "soon",
              testId: "ward-legal-figure-soon",
            },
            {
              id: "none",
              value: noDeadline.length,
              label: "no time written",
              onClick: () => toggleHighlight({ kind: "none" }),
              pressed: highlight?.kind === "none",
              testId: "ward-legal-figure-none",
            },
            ...(isPhone
              ? []
              : [
                  { id: "no-form", value: withoutForm, label: "no form recorded", testId: "ward-legal-figure-no-form" },
                ]),
          ]}
        />
      }
      act={
        actNow > 0 ? (
          <HeroAct
            tone="danger"
            title={isPhone || !firstActNow || routeRole === "ward" ? actTitle : `${actTitle} · ${nameOf(firstActNow)}`}
            testId="ward-legal-act"
            action={
              firstActNow
                ? { label: "Open", testId: "ward-legal-act-open", onClick: () => select(firstActNow) }
                : undefined
            }
          />
        ) : (
          <HeroAct tone="calm" title={`None passed or within ${urgentWords}, as typed`} testId="ward-legal-act" />
        )
      }
      chips={
        <HeroQuickChips
          label="Form actions"
          items={[
            ...(recordOffered && !sheetReason
              ? [
                  {
                    id: "record",
                    label: "Record a form",
                    icon: <Plus strokeWidth={1.75} aria-hidden="true" />,
                    testId: "ward-legal-record-chip",
                    onClick: () => openRecord(),
                  },
                ]
              : []),
            // Ward role: with nothing to record or tell, the ward skips it.
            ...(routeRole === "ward" && phoneTaskCount === 0
              ? []
              : [
                  {
                    id: "tasks",
                    label: "Record and tell",
                    icon: <ClipboardList strokeWidth={1.75} aria-hidden="true" />,
                    count: phoneTaskCount,
                    countTone: "quiet" as const,
                    countLabel: `items to record across ${phoneTaskForms} forms`,
                    testId: "ward-legal-tasks-chip",
                    onClick: () => setTasksOpen(true),
                  },
                ]),
            ...(handover.length === 0
              ? []
              : [
                  {
                    id: "handover",
                    label: copied === "handover" ? "Copied" : "Copy for handover",
                    icon: <ClipboardCopy strokeWidth={1.75} aria-hidden="true" />,
                    count: handover.length,
                    countTone: "quiet" as const,
                    testId: "ward-legal-copy-chip",
                    onClick: () => copyText("handover", handover.join("\n")),
                  },
                ]),
          ]}
        />
      }
    />
  );
  const pageTop = (
    <Hero
      testId="ward-legal-hud-island"
      className={cx(pageTopStyles.hero, folderTabClasses.hero)}
      title={
        shownView === "seclusion" ? (
          <>
            Seclusion <span className={pageTopStyles.soft}>and restraint</span>
          </>
        ) : (
          <>
            <SrOnly>Legal forms, </SrOnly>
            Form deadlines <span className={pageTopStyles.soft}>as typed</span>
          </>
        )
      }
      aside={<LiveChip state="live" onHero age={formatInstant(now)} />}
    >
      {shownView === "seclusion" ? (
        <SeclusionTop phone={isPhone} onAsk={(kind) => setSeclusionAsk((ask) => ({ kind, n: (ask?.n ?? 0) + 1 }))} />
      ) : (
        formsTop
      )}
    </Hero>
  );
  const viewTabs = (
    <FolderTabs
      // A phone shows three tabs, a wider screen four: remount so the folder measures the row it shows.
      key={isPhone ? "phone" : "wide"}
      label="Legal forms views"
      value={shownView}
      testId="ward-legal-tabs"
      more={
        // Phone: three tabs and More, as on Home (History moves behind More).
        isPhone && shownView !== "history" ? (
          <Menu
            label="More legal forms views"
            align="end"
            items={[
              { id: "history", label: `History (${closedWithForms.length})`, onSelect: () => setView("history") },
            ]}
            trigger={(props) => (
              <Button
                {...props}
                variant="ghost"
                size="sm"
                iconOnly
                icon={Ellipsis}
                className={folderTabClasses.more}
                aria-label="More legal forms views"
              />
            )}
          />
        ) : undefined
      }
    >
      <Segmented<View>
        className={folderTabClasses.switch}
        label="View"
        value={shownView}
        onChange={setView}
        items={[
          { id: "clocks", label: "On a form" },
          { id: "checklist", label: "Checklist" },
          ...(isPhone && shownView !== "history"
            ? []
            : [{ id: "history" as const, label: "History", count: closedWithForms.length }]),
          ...seclusionItem.map((item) => ({ ...item, label: "Seclusion" })),
        ]}
      />
    </FolderTabs>
  );

  return (
    <div className={styles.screen} data-testid="ward-legal-forms-page" data-ward-design="v8">
      <main id="main-content" className={styles.main}>
        {copyNotice ? <p role="status">{copyNotice}</p> : null}
        <h1 className={styles.srOnly}>{shownView === "seclusion" ? "Seclusion and restraint" : "Legal forms"}</h1>
        <p className={styles.srOnly}>Recorded forms and deadlines for open movements.</p>
        <span className={`${styles.prototypeBadge} ${styles.srOnly}`} data-ward-type-floor="badge">
          Synthetic prototype
        </span>
        <dl className={styles.srOnly} aria-label="Legal forms summary">
          <div data-tone={passed > 0 ? "danger" : "quiet"}>
            <dt>Deadline passed</dt>
            <dd>{passed}</dd>
          </div>
          <div>
            <dt>Upcoming deadlines</dt>
            <dd>{upcoming}</dd>
          </div>
          <div>
            <dt>No deadline recorded</dt>
            <dd>{noDeadline.length}</dd>
          </div>
          <div>
            <dt>No form recorded</dt>
            <dd>{withoutForm}</dd>
          </div>
        </dl>

        {/* The three unlabelled top-bar tools (Requirements, Tell PSP, Handover) only repeated the
            Requirements link, the Tell task card and Copy for handover (device audit 11 Oct 2026). */}

        {isPhone ? (
          <>
            {pageTop}
            {viewTabs}
            {shownView === "seclusion" ? seclusionView : null}
            <Card className={styles.listCard} aria-label="Everyone on a form" hidden={shownView === "seclusion"}>
              {/* One phone rule with Movements and Leave: Print and Export stay, icon-only, named. */}
              {shownView === "history" ? null : (
                <CardHead
                  title="Everyone on a form"
                  level={2}
                  action={
                    <>
                      <ListPrintButton iconOnly disabled={listPopulation.length === 0} testId="ward-legal-print" />
                      <ListExportButton
                        iconOnly
                        load={exportList}
                        disabled={listPopulation.length === 0}
                        testId="ward-legal-export"
                      />
                    </>
                  }
                />
              )}
              {highlight ? (
                <p className={styles.phoneNote}>
                  {highlightCount} of {rows.length} highlighted, all rows stay
                </p>
              ) : null}
              {/* The one colour key, near the list (Josh, 30 Oct 2026). */}
              {shownView === "clocks" && !highlight ? <p className={styles.phoneNote}>{TYPED_TIME_KEY}</p> : null}
              {shownView === "clocks" ? (
                <section aria-label="Legal forms and deadlines" data-testid="ward-legal-forms-groups">
                  {rows.length === 0 ? (
                    <p className={styles.absent}>No open movement carries a legal form.</p>
                  ) : (
                    <>
                      <div className={styles.groupHead}>
                        <span>Expiry typed</span>
                        <span className={styles.groupCount}>{withDeadline.length}</span>
                        <span className={styles.groupOrder}>earliest typed time first</span>
                      </div>
                      <ul className={styles.phoneList}>
                        {withDeadline.map((movement) => (
                          <PhoneFormRow key={movement.id} {...rowProps(movement)} />
                        ))}
                      </ul>
                      <div className={styles.groupHead}>
                        <span>Time not written</span>
                        <span className={styles.groupCount}>{noDeadline.length}</span>
                        <span className={styles.groupOrder}>longest open first</span>
                      </div>
                      <ul className={styles.phoneList}>
                        {noDeadline.map((movement) => (
                          <PhoneFormRow key={movement.id} {...rowProps(movement)} />
                        ))}
                      </ul>
                    </>
                  )}
                </section>
              ) : null}
              {shownView === "checklist" ? (
                <PhoneChecklist
                  rows={rows}
                  nameOf={nameOf}
                  umrnOf={umrnOf}
                  isHighlighted={matches}
                  highlightOn={highlight !== null}
                  onSelect={select}
                />
              ) : null}
              {showAdmittedOnAForm ? admittedList : null}
              {shownView === "history" ? historyList : null}
              {/* FS1: as on desktop, the full notice closes the list it qualifies, so the phone reaches
                  the people on a form first. */}
              <div className={styles.listFoot}>
                <LegalLimitsNotChecked />
              </div>
            </Card>
            <PhoneSheet open={tasksOpen} onClose={() => setTasksOpen(false)} title="Record and tell">
              {taskStrip}
            </PhoneSheet>
            <PhoneSheet
              open={selected !== null}
              onClose={() => setSelectedId(null)}
              title={selected ? nameOf(selected) : "Form"}
              description={
                selected ? (
                  <>
                    <span className={styles.mono}>{umrnOf(selected)}</span>
                    {selected.legalForm ? ` · ${formTitle(selected.legalForm.code)}` : ""}
                  </>
                ) : undefined
              }
              height="tall"
              primary={phoneSheetPrimary}
              secondary={phoneSheetSecondary}
            >
              {/* v10 phone: the sheet's own header names the person, so the panel drops its head. */}
              <div className={styles.phoneFocus}>{focusPanel}</div>
            </PhoneSheet>
          </>
        ) : (
          <>
            {pageTop}
            {viewTabs}

            {shownView === "seclusion" ? seclusionView : breakdownNote}

            <div className={styles.work} hidden={shownView === "seclusion"}>
              <Card className={styles.listCard} aria-label="Everyone on a form">
                <CardHead
                  title={shownView === "history" ? "Closed moves with a form" : "Everyone on a form"}
                  level={2}
                  // The note sits under the title and wraps, so the list's tools keep the right edge.
                  meta={
                    highlight || shownView === "clocks" ? (
                      <span className={styles.meta}>
                        {highlight
                          ? `${highlightCount} of ${rows.length} highlighted, all rows stay`
                          : // The one colour key, near the list (Josh, 30 Oct 2026). The group heads say the order.
                            TYPED_TIME_KEY}
                      </span>
                    ) : undefined
                  }
                  action={
                    // Page tops (Josh, 9 Nov 2026): Record a form, Record and tell and Copy for handover are
                    // the top's chips; the list keeps its own Clear highlight, Print and Export.
                    <>
                      {highlight ? (
                        <Button variant="ghost" size="sm" onClick={() => setHighlight(null)}>
                          Clear highlight
                        </Button>
                      ) : null}
                      {shownView === "history" ? null : (
                        <>
                          <ListPrintButton disabled={listPopulation.length === 0} testId="ward-legal-print" />
                          <ListExportButton
                            load={exportList}
                            disabled={listPopulation.length === 0}
                            testId="ward-legal-export"
                          />
                        </>
                      )}
                    </>
                  }
                />

                {shownView === "clocks" ? (
                  <section
                    className={styles.groups}
                    aria-label="Legal forms and deadlines"
                    data-testid="ward-legal-forms-groups"
                  >
                    <p className={styles.srOnly}>
                      {rows.length} of {openMovements.length} open{" "}
                      {openMovements.length === 1 ? "movement carries" : "movements carry"} a legal form
                    </p>
                    <div role="region" aria-label="Legal forms list" className={styles.table}>
                      {rows.length === 0 ? (
                        <p className={styles.absent}>No open movement carries a legal form.</p>
                      ) : (
                        <>
                          <DataRow head columns={ROW_COLUMNS} aria-hidden="true" className={styles.headRow}>
                            <span className={tableClasses.th}>Patient</span>
                            <span className={tableClasses.th}>Form</span>
                            <span className={tableClasses.th}>Where</span>
                            <span className={tableClasses.th}>Ends, as typed</span>
                            <span className={tableClasses.th}>Next step</span>
                          </DataRow>
                          <div className={styles.groupHead}>
                            <span>Expiry typed</span>
                            <span className={styles.groupCount}>{withDeadline.length}</span>
                            <span className={styles.groupOrder}>earliest typed time first</span>
                            <span className={styles.srOnly}>Forms with a deadline recorded</span>
                          </div>
                          {withDeadline.length > 0 ? (
                            <ul className={styles.rowList}>
                              {withDeadline.map((movement) => (
                                <FormRow key={movement.id} {...rowProps(movement)} />
                              ))}
                            </ul>
                          ) : (
                            <p className={styles.absent} data-testid="ward-legal-forms-none-with-deadline">
                              No open movement carries a form with a deadline recorded on it.
                            </p>
                          )}
                          <div className={styles.groupHead}>
                            <span>Time not written</span>
                            <span className={styles.groupCount}>{noDeadline.length}</span>
                            <span className={styles.groupOrder}>longest open first</span>
                            <span className={styles.srOnly}>Forms with no deadline recorded</span>
                          </div>
                          {noDeadline.length > 0 ? (
                            <>
                              <ul className={styles.rowList}>
                                {noDeadline.map((movement) => (
                                  <FormRow key={movement.id} {...rowProps(movement)} />
                                ))}
                              </ul>
                            </>
                          ) : (
                            <p className={styles.absent} data-testid="ward-legal-forms-none-without-deadline">
                              Every open movement carrying a form has a deadline recorded on it.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </section>
                ) : null}

                {shownView === "checklist" ? (
                  <ChecklistView
                    rows={rows}
                    now={now}
                    nameOf={nameOf}
                    umrnOf={umrnOf}
                    selectedId={selectedId}
                    isHighlighted={matches}
                    highlightOn={highlight !== null}
                    onSelect={select}
                  />
                ) : null}

                {showAdmittedOnAForm ? admittedList : null}
                {shownView === "history" ? historyList : null}
                {/* The full notice closes the list it qualifies, not a loose line under the hero. */}
                <div className={styles.listFoot}>
                  <LegalLimitsNotChecked />
                </div>
              </Card>

              {selected ? (
                // D-77 change 5: the list keeps the full width and the form opens as a drawer over it.
                <Drawer
                  open
                  onClose={() => setSelectedId(null)}
                  title={nameOf(selected)}
                  description={`${umrnOf(selected)}${selected.legalForm ? ` · ${formTitle(selected.legalForm.code)}` : ""}`}
                  testId="ward-legal-form-sheet"
                  // The panel runs edge to edge and anchors its own action bar at the bottom.
                  bodyClassName="flex flex-col p-0 sm:p-0"
                >
                  {/* As on the phone sheet, the drawer's own header names the person, so the panel drops its head. */}
                  <div className={cx(styles.phoneFocus, "flex flex-1 flex-col")}>{focusPanel}</div>
                </Drawer>
              ) : null}
              <Drawer
                open={tasksOpen}
                onClose={() => setTasksOpen(false)}
                title="Record and tell"
                description={`${phoneTaskCount} items to record across ${phoneTaskForms} forms`}
                testId="ward-legal-tasks-sheet"
              >
                <div className={styles.taskDrawer}>{taskStrip}</div>
              </Drawer>
            </div>
          </>
        )}

        <RequirementsSheet
          code={requirementsCode}
          onCode={setRequirementsCode}
          onClose={() => setRequirementsCode(null)}
        />
        <RecordFormSheet
          open={recordOpen}
          onClose={() => setRecordOpen(false)}
          draft={recordDraft}
          onDraft={setRecordDraft}
          openMovements={recordable}
          labelOf={(movement) => movementPickerLabel(nameOf(movement), umrnOf(movement), movement)}
          now={now}
          recordUnavailable={sheetReason}
          targetMovement={recordOnOpen ? initialMovementId : undefined}
          onSaveForm={({ movementId, formCode, writtenAt, region }) => {
            if (!writtenGate.allowed || !isOwnedLegalFormCode(formCode)) return false;
            const movement = recordable.find((candidate) => candidate.id === movementId);
            if (!movement || (formCode === "3C" && movementRefuses3C(movement))) return false;
            const written = { movementId, formCode, writtenAt, ...(region ? { region } : {}) };
            const completion = settledWardCommand(raise("RECORD_LEGAL_FORM_WRITTEN", written));
            const accepted = (outcome: Awaited<typeof completion>) => {
              offerStep(
                {
                  success: `Form ${formCode} recorded for ${nameOf(movement)}`,
                  undo: (at) => ({ type: "UNDO_LEGAL_FORM_RECORD", role: routeRole, now: at, movementId }),
                  undone: `Form ${formCode} record undone for ${nameOf(movement)}.`,
                },
                { completion: outcome },
              );
              if (outcome?.status === "accepted") return outcome.isCurrent?.() ?? true;
              // The sheet shows the refusal itself, so the person is not left with a Save that did nothing.
              return outcome?.status === "refused"
                ? `Not recorded: ${outcome.message ?? "The action was refused."}`
                : (outcome?.message ?? SAVE_NOT_CONFIRMED);
            };
            const unconfirmed = () => accepted(UNCONFIRMED_SAVE);
            return completion && "then" in completion ? completion.then(accepted, unconfirmed) : accepted(completion);
          }}
        />
        {addTimeTarget ? (
          <AddTimeDialog
            key={addTimeTarget.id}
            movement={addTimeTarget}
            name={nameOf(addTimeTarget)}
            umrn={umrnOf(addTimeTarget)}
            now={now}
            dayZero={dayZero}
            recordUnavailable={recordGate.reason}
            refusal={addTimeRefusal?.reason}
            onClose={() => setAddTimeId(null)}
            onSave={(written) => saveWritten(addTimeTarget, written)}
          />
        ) : null}
        <ExtendSheet
          target={movements.find((movement) => movement.id === extendId) ?? null}
          label={(() => {
            const target = movements.find((movement) => movement.id === extendId);
            return target ? `${nameOf(target)} · ${umrnOf(target)}` : "";
          })()}
          now={now}
          dayZero={dayZero}
          onClose={() => setExtendId(null)}
          extendUnavailable={extendGate.reason}
          onExtendForm={(movement, dueAt) => {
            if (!extendGate.allowed) return false;
            if (!openMovements.some((candidate) => candidate.id === movement.id)) return false;
            const completion = settledWardCommand(
              raise("RECORD_LEGAL_FORM_EXPIRY", { movementId: movement.id, dueAt }),
            );
            const accepted = (outcome: Awaited<typeof completion>) => {
              offerStep(
                {
                  success: `Form ${movement.legalForm?.code ?? ""} extended for ${nameOf(movement)}`,
                  undo: (at) => ({ type: "UNDO_LEGAL_FORM_RECORD", role: routeRole, now: at, movementId: movement.id }),
                  undone: `Form extension undone for ${nameOf(movement)}.`,
                },
                { completion: outcome },
              );
              return outcome?.status === "accepted" && (outcome.isCurrent?.() ?? true);
            };
            const unconfirmed = () => accepted(UNCONFIRMED_SAVE);
            return completion && "then" in completion ? completion.then(accepted, unconfirmed) : accepted(completion);
          }}
        />
        <TellSheet
          open={tell !== null}
          party={tell?.party ?? null}
          subjects={tellSubjects}
          subjectKey={tell?.key ?? null}
          onSubject={(key) => setTell((current) => (current ? { ...current, key } : current))}
          onClose={() => setTell(null)}
          now={now}
        />
      </main>
      <WardPrototypeFooter testId="ward-legal-forms-governance" />
    </div>
  );
}
