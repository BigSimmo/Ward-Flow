"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, ChevronRight, ClipboardCopy, ClipboardList, Plus } from "lucide-react";
import {
  Button,
  Card,
  CardBody,
  CardHead,
  DataRow,
  Drawer,
  Hero,
  HeroStat,
  HeroTrack,
  LiveChip,
  PhoneHero,
  PhoneListRow,
  PhoneSheet,
  Segmented,
  StackBar,
  SrOnly,
  StatusGlyph,
  cx,
  tableClasses,
  type StackSegment,
  type WfFill,
  useIsPhone,
  useIsTabletPortrait,
} from "@/components/wf";
import { departmentLabel } from "@/components/ward-management/ward-absence-labels";
import { formatInstant, formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { useRoleGate, useRouteRole } from "@/components/ward-management/ward-role-gate";
import { legalFormName, SELECTABLE_LEGAL_FORMS } from "@/components/ward-management/ward-legal-forms";
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

import {
  legalDeadlineText,
  legalExpiryReminderSummary,
  legalFormBreakdown,
  legalFormGroupRows,
  legalFormRowClassification,
  isLegalDeadlineBreached,
} from "./legal-forms-derivations";
import { FocusPanel, SummaryPanel, type FocusTab } from "./legal-forms-panel";
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
  STANDING_TONE,
  clockStanding,
  durText,
  elapsedFraction,
  formTitle,
  handoverLines,
  hasGap,
  isActNow,
  isOwnedLegalFormCode,
  leftText,
  receiptEventAccepts,
  recentTellSubjects,
  recordedFacts,
  standingWord,
  type RecordGap,
} from "./legal-forms-view";
import styles from "./legal-forms.module.css";

/**
 * FORMS (renamed from Legal forms, owner 9 Oct 2026; built from the approved v4 mockup). Live work
 * for each patient on a Mental Health Act form. The hero answers and carries the highlight chips;
 * three cards under it count what is still to record on the form and who is still to be told; the
 * table lists everyone on a form in two groups that are never ordered against each other; the side
 * panel is Board now (v10: the clock rail with its Passed bay, no ring) until a patient is chosen,
 * then that patient's form.
 * Desktop has no drawer. Review, rates, audit, registers and reports live on Governance.
 *
 * Owner rules kept: no invented deadlines or section numbers (D5), an unconnected action says
 * "Not wired in this prototype." (D4), and a highlight never hides a row.
 */

const CHART_WINDOW_MINUTES = 8 * 60;

type View = "clocks" | "checklist" | "history";
type Highlight =
  | { kind: "act" }
  | { kind: "soon" }
  | { kind: "none" }
  | { kind: "code"; code: string }
  | { kind: "gap"; gap: RecordGap }
  | null;

const CODE_FILLS: WfFill[] = ["data-1", "data-2", "data-3", "neutral", "closed"];
const GAP_LABEL: Record<RecordGap, string> = {
  written: "Time written",
  received: "Form received",
  examination: "Examination",
};
/** Form type chips shown before "+N" in Forms in force, so the chips stay on one line. */
const CODE_CHIPS_SHOWN = 3;

const GAP_ACTION: Record<RecordGap, string> = {
  written: "Add time",
  // "Mark received" truncated in the task strip (device audit 11 Oct 2026).
  received: "Received",
  examination: "Record exam",
};

function sameHighlight(a: Highlight, b: Highlight): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind !== b.kind) return false;
  if (a.kind === "code" && b.kind === "code") return a.code === b.code;
  if (a.kind === "gap" && b.kind === "gap") return a.gap === b.gap;
  return true;
}

export function LegalFormsScreen({ initialMovementId }: { initialMovementId?: string } = {}) {
  usePrintableDisclosures();

  const { movements, referrals, patients, admissions, units, supportNotifications, dispatch, dayZero, rejections } =
    useWardFlow();
  const now = useWardFlowClock();
  const gate = useRoleGate();
  // B2 (site review, 12 Oct 2026): every step is recorded as the route's own role, so history names
  // who acted (the coordinator here) rather than a borrowed "ED".
  const routeRole = useRouteRole();
  // v10 pass 3: a recorded form time and a Tell record each offer Undo on the toast.
  const { run: runStep, offer: offerUndo } = useUndoableStep({
    dispatch,
    rejections,
    now,
    routeRole,
  });

  const [view, setView] = useState<View>("clocks");
  const [highlight, setHighlight] = useState<Highlight>(null);
  // Governance links a gap here with ?movement=, so that patient opens selected.
  const [selectedId, setSelectedId] = useState<string | null>(initialMovementId ?? null);
  const [tab, setTab] = useState<FocusTab>("now");
  const [focusGap, setFocusGap] = useState<{ gap: RecordGap; nonce: number } | null>(null);
  const [requirementsCode, setRequirementsCode] = useState<string | null>(null);
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordDraft, setRecordDraft] = useState<RecordDraft>({
    form: SELECTABLE_LEGAL_FORMS[0]?.code ?? "",
    movement: "",
  });
  const [extendId, setExtendId] = useState<string | null>(null);
  const [tell, setTell] = useState<{ party: SupportNotificationParty | null; key: string | null } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [phoneTasks, setPhoneTasks] = useState(false);
  const isPhone = useIsPhone();
  const isTabletPortrait = useIsTabletPortrait();
  // Forms in force (v10): the three most common types as chips on one line, the rest behind "+N".
  const [allCodes, setAllCodes] = useState(false);
  // Device audit 11 Oct 2026: "No expiry typed" folds after 5 on a phone and 10 elsewhere.
  const [allNoDeadline, setAllNoDeadline] = useState(false);

  const openMovements = movements.filter(isOpen);
  const withDeadline = legalFormGroupRows(movements, now, "with-deadline");
  const noDeadline = legalFormGroupRows(movements, now, "no-deadline");
  const noDeadlineCap = isPhone ? 5 : 10;
  // A highlight or a chosen row past the fold opens the whole group, so nothing marked is hidden.
  const noDeadlineOpen =
    allNoDeadline ||
    highlight !== null ||
    noDeadline.findIndex((movement) => movement.id === selectedId) >= noDeadlineCap;
  const noDeadlineShown = noDeadlineOpen ? noDeadline : noDeadline.slice(0, noDeadlineCap);
  const showAllNoDeadline =
    noDeadline.length > noDeadlineShown.length ? (
      <div className={styles.showAll}>
        <Button variant="ghost" size="sm" onClick={() => setAllNoDeadline(true)}>
          Show all {noDeadline.length}
        </Button>
      </div>
    ) : null;
  const rows = [...withDeadline, ...noDeadline];
  const voluntary = openMovements.length - rows.length;
  const breakdown = legalFormBreakdown(rows, now);
  const reminders = legalExpiryReminderSummary(movements, now);
  const passed = withDeadline.filter((movement) => isLegalDeadlineBreached(movement, now)).length;
  const upcoming = withDeadline.length - passed;
  const actNow = withDeadline.filter((movement) => isActNow(clockStanding(movement, now))).length;

  const patientOf = (movement: Movement) => resolveSubjectPatient(movement, { patients, referrals });
  const nameOf = (movement: Movement) => patientOf(movement).formalName;
  const umrnOf = (movement: Movement) => patientOf(movement).umrn;
  const edNameOf = (movement: Movement) => {
    const ed = edById(movement.originEdId);
    return ed ? edShortName(ed) : departmentLabel(movement.originEdId, undefined);
  };
  const wardNameOf = (movement: Movement) =>
    movement.acceptedUnitId ? (units.find((unit) => unit.id === movement.acceptedUnitId)?.name ?? null) : null;

  // A gap this page can close: a written time is only recordable for the forms it owns.
  const offersGap = (movement: Movement, gap: RecordGap) =>
    hasGap(movement, gap) && (gap !== "written" || isOwnedLegalFormCode(movement.legalForm?.code));
  const matches = (movement: Movement): boolean => {
    if (highlight === null) return false;
    const standing = clockStanding(movement, now);
    if (highlight.kind === "act") return isActNow(standing);
    if (highlight.kind === "soon") return standing === "soon";
    if (highlight.kind === "none") return movement.legalForm?.dueAt === undefined;
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
    if (movement.id !== selectedId) setTab("now");
    setSelectedId(movement.id);
    setFocusGap(null);
  };

  const gapCount = (gap: RecordGap) => rows.filter((movement) => offersGap(movement, gap)).length;
  const startGap = (gap: RecordGap) => {
    const first = rows.find((movement) => offersGap(movement, gap));
    if (!first) return;
    select(first);
    setTab("now");
    setFocusGap((previous) => ({ gap, nonce: (previous?.nonce ?? 0) + 1 }));
  };

  // Carer, PSP and MHAS apply to completed moves of involuntary patients (PR #159), so this card
  // reads recent arrivals, transfers and discharges, not the open moves in the table.
  const tellSubjects = recentTellSubjects(
    { movements, admissions, patients, referrals, units, supportNotifications },
    now,
  );
  const partyCount = (party: SupportNotificationParty) =>
    tellSubjects.filter((subject) => subject.missing.includes(party)).length;
  // A Tell record is made inside the sheet's checklist; Undo is offered here once it lands.
  const tellOpen = tell !== null;
  const tellCountRef = useRef(supportNotifications?.length ?? 0);
  useEffect(() => {
    const records = supportNotifications ?? [];
    const grew = tellOpen && records.length > tellCountRef.current;
    tellCountRef.current = records.length;
    const record = grew ? records[records.length - 1] : undefined;
    if (!record) return;
    const target =
      record.occasion === "discharge" ? { admissionId: record.subjectId } : { movementId: record.subjectId };
    offerUndo({
      success: `${SUPPORT_NOTIFICATION_PARTY_SHORT[record.party]} record saved`,
      undo: (at) => ({ type: "UNDO_SUPPORT_NOTIFICATION", role: record.by, now: at, ...target }),
      undone: "Tell record undone.",
    });
    // Only a new record while the sheet is open offers Undo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supportNotifications, tellOpen]);
  const tellNext = (party: SupportNotificationParty) => {
    const first = tellSubjects.find((subject) => subject.missing.includes(party));
    setTell({ party, key: first?.key ?? null });
  };

  const copyText = (key: string, text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text).catch(() => undefined);
    }
    setCopied(key);
    window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 2000);
  };
  const handover = handoverLines(withDeadline, now, nameOf, CHART_WINDOW_MINUTES);

  const openRecord = (movementId?: string) => {
    // The generic button starts with no patient, so an earlier shortcut never carries over.
    setRecordDraft((current) => ({ ...current, movement: movementId ?? "" }));
    setRecordOpen(true);
  };

  // Feature 11: Mark received is the ED's or the coordinator's event, raised as the route's role.
  const receivedGate = gate("RECORD_LEGAL_FORM_RECEIVED");
  // Record a form: the coordinator always may; another route sees it greyed with the reason.
  const recordGate = gate("RECORD_LEGAL_FORM_WRITTEN", "record-a-form");
  const markReceived = (movement: Movement) => {
    if (!receivedGate.allowed) return;
    if (!receiptEventAccepts(movement.legalForm?.code) || movement.legalFormReceivedAt !== undefined) return;
    runStep(
      { type: "RECORD_LEGAL_FORM_RECEIVED", role: routeRole, now, movementId: movement.id },
      {
        success: "Form marked received",
        undo: (at) => ({ type: "UNDO_LEGAL_FORM_RECORD", role: routeRole, now: at, movementId: movement.id }),
        undone: "Received mark undone.",
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
  const next = withDeadline[0];
  const nextStanding = next ? clockStanding(next, now) : "none";
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
      select(target);
      setTab("now");
      setFocusGap((previous) => ({ gap: "written", nonce: (previous?.nonce ?? 0) + 1 }));
    },
  });

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
      tab={tab}
      onTab={setTab}
      onClose={() => setSelectedId(null)}
      focusGap={focusGap}
      refusal={lastWrittenRefusal?.reason}
      onSaveWritten={({ writtenAt, region, ageBand }) => {
        const formCode = selected.legalForm?.code;
        if (!isOwnedLegalFormCode(formCode)) return;
        const movementId = selected.id;
        runStep(
          {
            type: "RECORD_LEGAL_FORM_WRITTEN",
            role: routeRole,
            now,
            movementId,
            formCode,
            writtenAt,
            region,
            ageBand,
          },
          {
            success: "Form time recorded",
            undo: (at) => ({ type: "UNDO_LEGAL_FORM_RECORD", role: routeRole, now: at, movementId }),
            undone: "Form time undone.",
          },
        );
      }}
      onMarkReceived={() => markReceived(selected)}
      markReceivedUnavailable={receivedGate.reason}
      onExtend={() => setExtendId(selected.id)}
      onRecordNext={() => openRecord(selected.id)}
      onRequirements={(code) => setRequirementsCode(code)}
      onCopy={copySelectedSummary}
      copied={copied === "summary"}
    />
  ) : null;

  // Phone: the record-and-tell tasks sit one tap away; the sheet foot pins the next one to record.
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
          disabledReason: nextGap === "received" && !receivedGate.allowed ? receivedGate.reason : undefined,
          onAction: () => {
            if (nextGap === "received") markReceived(selected);
            else {
              setTab("now");
              setFocusGap((previous) => ({ gap: nextGap, nonce: (previous?.nonce ?? 0) + 1 }));
            }
          },
        }
      : undefined;
  // v10 phone: the sheet foot always pins the next step. With no gap left to record it is the
  // panel's own "Record next form", and Copy sits beside it, so neither floats mid-sheet.
  const phoneSheetPrimary =
    phonePrimary ?? (selected ? { label: "Record next form", onAction: () => openRecord(selected.id) } : undefined);
  const phoneSheetSecondary = selected
    ? { label: copied === "summary" ? "Copied" : "Copy", onAction: copySelectedSummary }
    : undefined;

  const taskStrip = (
    <div className={styles.strip}>
      <Card aria-label="Forms in force">
        <CardHead
          title="Forms in force"
          level={2}
          action={
            <button type="button" className={styles.textLink} onClick={() => setRequirementsCode(CATALOGUE[0]!.code)}>
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

  return (
    <div className={styles.screen} data-testid="ward-legal-forms-page" data-ward-design="v8">
      <main id="main-content" className={styles.main}>
        <h1 className={styles.srOnly}>Forms</h1>
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
            <dt>Voluntary, no form</dt>
            <dd>{voluntary}</dd>
          </div>
        </dl>

        {/* The three unlabelled top-bar tools (Requirements, Tell PSP, Handover) only repeated the
            Requirements link, the Tell task card and Copy for handover (device audit 11 Oct 2026). */}

        {isPhone ? (
          <>
            <PhoneHero
              data-testid="ward-legal-hud-island"
              eyebrow="Mental Health Act forms"
              chip={<LiveChip state="live" onHero age={formatInstant(now)} />}
              title={`${rows.length} forms on open moves`}
              sub={`${voluntary} voluntary, no form · warnings at ${reminders.soonHours}h and ${reminders.urgentHours}h`}
              figures={[
                { id: "act", value: actNow, label: "Act now", tone: "danger" },
                { id: "soon", value: reminders.withinSoon, label: `Within ${reminders.soonHours}h`, tone: "warning" },
                { id: "none", value: noDeadline.length, label: "No expiry", tone: "closed" },
              ]}
              actions={
                <>
                  <Button
                    variant="onHero"
                    icon={Plus}
                    className={styles.phoneHeroAction}
                    disabledReason={recordGate.allowed ? undefined : recordGate.reason}
                    reasonDisplay="tooltip"
                    onClick={() => openRecord()}
                  >
                    Record a form
                  </Button>
                  <Button
                    variant="onHero"
                    icon={ClipboardCopy}
                    className={styles.phoneHeroAction}
                    disabledReason={handover.length === 0 ? "No typed expiry is coming up" : undefined}
                    reasonDisplay="tooltip"
                    onClick={() => copyText("handover", handover.join("\n"))}
                  >
                    {copied === "handover" ? "Copied" : `Copy for handover ${handover.length}`}
                  </Button>
                </>
              }
            />
            <button type="button" className={styles.phoneTasks} onClick={() => setPhoneTasks(true)}>
              <ClipboardList size={16} aria-hidden="true" />
              <span className={styles.cellStack}>
                <span className={styles.name}>Record and tell</span>
                <span className={styles.sub}>
                  <strong className={styles.mono}>{phoneTaskCount}</strong> items to record across {phoneTaskForms}{" "}
                  forms
                </span>
              </span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
            <Segmented<View>
              className={styles.phoneViews}
              label="View"
              value={view}
              onChange={setView}
              items={[
                { id: "clocks", label: "Clocks" },
                { id: "checklist", label: "Checklist" },
                { id: "history", label: "History", count: closedWithForms.length },
              ]}
            />
            <Card className={styles.listCard} aria-label="Everyone on a form">
              {highlight ? (
                <p className={styles.phoneNote}>
                  {highlightCount} of {rows.length} highlighted, all rows stay
                </p>
              ) : null}
              {view === "clocks" ? (
                <section aria-label="Legal forms and deadlines" data-testid="ward-legal-forms-groups">
                  {rows.length === 0 ? (
                    <p className={styles.absent}>No open movement carries a legal form.</p>
                  ) : (
                    <>
                      <div className={styles.groupHead}>
                        <span>Expiry typed</span>
                        <span className={styles.groupCount}>{withDeadline.length}</span>
                        <span className={styles.groupOrder}>least time left</span>
                      </div>
                      <ul className={styles.phoneList}>
                        {withDeadline.map((movement) => (
                          <PhoneFormRow key={movement.id} {...rowProps(movement)} />
                        ))}
                      </ul>
                      <div className={styles.groupHead}>
                        <span>No expiry typed</span>
                        <span className={styles.groupCount}>{noDeadline.length}</span>
                        <span className={styles.groupOrder}>longest in ED</span>
                      </div>
                      <ul className={styles.phoneList}>
                        {noDeadlineShown.map((movement) => (
                          <PhoneFormRow key={movement.id} {...rowProps(movement)} />
                        ))}
                      </ul>
                      {showAllNoDeadline}
                    </>
                  )}
                </section>
              ) : null}
              {view === "checklist" ? (
                <PhoneChecklist
                  rows={rows}
                  nameOf={nameOf}
                  umrnOf={umrnOf}
                  isHighlighted={matches}
                  highlightOn={highlight !== null}
                  onSelect={select}
                />
              ) : null}
              {view === "history" ? historyList : null}
            </Card>
            <PhoneSheet open={phoneTasks} onClose={() => setPhoneTasks(false)} title="Record and tell" height="tall">
              {taskStrip}
            </PhoneSheet>
            <PhoneSheet
              open={selected !== null}
              onClose={() => setSelectedId(null)}
              title={selected ? nameOf(selected) : "Form"}
              description={
                selected ? (
                  <>
                    <span className={styles.mono}>{umrnOf(selected)}</span> · {edNameOf(selected)}
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
            <div data-testid="ward-legal-hud-island">
              <Hero
                className={styles.heroBand}
                eyebrow="Mental Health Act forms"
                title={`${rows.length} forms on open moves`}
                titleMeta={
                  voluntary > 0 ? <span className={styles.heroMeta}>{voluntary} voluntary, no form</span> : undefined
                }
                aside={
                  <div className={styles.heroAside}>
                    {next ? (
                      <button type="button" className={styles.nextCard} onClick={() => select(next)}>
                        <span className={styles.nextEyebrow}>
                          <StatusGlyph tone={STANDING_TONE[nextStanding]} size={9} />
                          {nextStanding === "passed" ? "Passed" : "Next to end"}
                        </span>
                        <span className={styles.nextName}>
                          {nameOf(next)} <span className={styles.heroCode}>{next.legalForm?.code}</span>
                        </span>
                        <span className={styles.nextTime}>{leftText(next, now)}</span>
                      </button>
                    ) : null}
                    <Button
                      variant="light"
                      icon={Plus}
                      disabledReason={recordGate.allowed ? undefined : recordGate.reason}
                      reasonDisplay="tooltip"
                      onClick={() => openRecord()}
                    >
                      Record a form
                    </Button>
                  </div>
                }
                bar={
                  <div className={styles.heroFilters}>
                    <HeroStat
                      inline
                      value={actNow}
                      label="Act now"
                      tone="danger"
                      pressed={highlight?.kind === "act"}
                      onToggle={() => toggleHighlight({ kind: "act" })}
                    />
                    <HeroStat
                      inline
                      value={reminders.withinSoon}
                      label={`Within ${reminders.soonHours}h`}
                      tone="warning"
                      pressed={highlight?.kind === "soon"}
                      onToggle={() => toggleHighlight({ kind: "soon" })}
                    />
                    <HeroStat
                      inline
                      value={noDeadline.length}
                      label="No expiry typed"
                      tone="neutral"
                      pressed={highlight?.kind === "none"}
                      onToggle={() => toggleHighlight({ kind: "none" })}
                    />
                    <button
                      type="button"
                      className={styles.heroCopy}
                      aria-disabled={handover.length === 0 ? "true" : undefined}
                      title={
                        handover.length === 0 ? "No typed expiry is coming up" : "Copy upcoming expiries for handover"
                      }
                      onClick={() => {
                        if (handover.length > 0) copyText("handover", handover.join("\n"));
                      }}
                    >
                      <ClipboardCopy size={14} aria-hidden="true" />
                      <span>{copied === "handover" ? "Copied" : "Copy for handover"}</span>
                      <span className={styles.heroCopyCount}>{handover.length}</span>
                    </button>
                  </div>
                }
                barAside={
                  <HeroTrack<View>
                    label="View"
                    value={view}
                    onChange={setView}
                    items={[
                      { id: "clocks", label: "Clocks", count: rows.length },
                      { id: "checklist", label: "Checklist" },
                      { id: "history", label: "History", count: closedWithForms.length },
                    ]}
                  />
                }
              />
            </div>

            {taskStrip}

            <div className={styles.work}>
              <Card className={styles.listCard} aria-label="Everyone on a form">
                <CardHead
                  title={view === "history" ? "Closed moves with a form" : "Everyone on a form"}
                  level={2}
                  aside={
                    <span className={styles.meta}>
                      {highlight
                        ? `${highlightCount} of ${rows.length} highlighted, all rows stay`
                        : view === "clocks"
                          ? "Act now first, then least time left"
                          : null}
                    </span>
                  }
                  action={
                    highlight ? (
                      <Button variant="ghost" size="sm" onClick={() => setHighlight(null)}>
                        Clear highlight
                      </Button>
                    ) : undefined
                  }
                />

                {view === "clocks" ? (
                  <section
                    className={styles.groups}
                    role="region"
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
                            <span className={tableClasses.th}>Time left</span>
                            <span className={tableClasses.th}>To record</span>
                          </DataRow>
                          <div className={styles.groupHead}>
                            <span>Expiry typed</span>
                            <span className={styles.groupCount}>{withDeadline.length}</span>
                            <span className={styles.groupOrder}>least time left first</span>
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
                            <span>No expiry typed</span>
                            <span className={styles.groupCount}>{noDeadline.length}</span>
                            <span className={styles.groupOrder}>longest in ED first</span>
                            <span className={styles.srOnly}>Forms with no deadline recorded</span>
                          </div>
                          {noDeadline.length > 0 ? (
                            <>
                              <ul className={styles.rowList}>
                                {noDeadlineShown.map((movement) => (
                                  <FormRow key={movement.id} {...rowProps(movement)} />
                                ))}
                              </ul>
                              {showAllNoDeadline}
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

                {view === "checklist" ? (
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

                {view === "history" ? historyList : null}
              </Card>

              <div className={styles.aside} data-wf-rail>
                {selected && !isTabletPortrait ? (
                  focusPanel
                ) : (
                  <SummaryPanel
                    rows={rows}
                    now={now}
                    dayZero={dayZero}
                    soonHours={reminders.soonHours}
                    urgentHours={reminders.urgentHours}
                    onSelect={select}
                  />
                )}
              </div>
              {isTabletPortrait && selected ? (
                // Tablet portrait (v10): the form opens as a drawer over the list.
                <Drawer
                  open
                  onClose={() => setSelectedId(null)}
                  title={nameOf(selected)}
                  description={selected.legalForm ? formTitle(selected.legalForm.code) : undefined}
                  testId="ward-legal-form-sheet"
                >
                  {focusPanel}
                </Drawer>
              ) : null}
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
          openMovements={openMovements}
          labelOf={(movement) => movementPickerLabel(nameOf(movement), umrnOf(movement), movement)}
        />
        <ExtendSheet
          target={movements.find((movement) => movement.id === extendId) ?? null}
          label={(() => {
            const target = movements.find((movement) => movement.id === extendId);
            return target ? `${nameOf(target)} · ${umrnOf(target)}` : "";
          })()}
          now={now}
          onClose={() => setExtendId(null)}
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

const ROW_COLUMNS = "minmax(0,1.25fr) minmax(0,1.3fr) minmax(0,1.15fr) minmax(0,1.1fr) minmax(0,0.95fr)";
/** The short word for a fact still to record, as the To record column names it. */
const TO_RECORD_WORD: Record<RecordGap, string> = {
  written: "Time written",
  received: "Received",
  examination: "Examined",
};
const CHECK_COLUMNS = "minmax(0,1.4fr) 56px minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)";

type FormRowProps = {
  movement: Movement;
  now: Instant;
  name: string;
  umrn: string;
  edName: string;
  wardName: string | null;
  selected: boolean;
  highlighted: boolean;
  dimmed: boolean;
  onSelect: (movement: Movement) => void;
  onAddTime: (movement: Movement) => void;
};

/**
 * One row. `legalFormRowClassification` decides the tone; the row keeps the record-row hooks
 * (`data-record-key` for the movement id, `record-id` for the patient's formal name) that the
 * population tests read. A highlight marks the row and never hides it.
 */
function FormRow({
  movement,
  now,
  name,
  umrn,
  edName,
  wardName,
  selected,
  highlighted,
  dimmed,
  onSelect,
  onAddTime,
}: FormRowProps) {
  const legalForm = movement.legalForm;
  if (!legalForm) {
    throw new Error(`FormRow rendered for movement ${movement.id}, which carries no legal form`);
  }
  const classification = legalFormRowClassification(movement, now);
  const standing = clockStanding(movement, now);
  const reason = legalDeadlineText(movement, now);
  const facts = recordedFacts(movement);
  const done = facts.filter((fact) => fact.at !== undefined).length;
  const missing = facts.filter((fact) => fact.at === undefined).map((fact) => TO_RECORD_WORD[fact.gap]);
  const canAddTime = movement.formedAt === undefined && isOwnedLegalFormCode(legalForm.code);

  return (
    <DataRow
      as="li"
      columns={ROW_COLUMNS}
      selected={selected}
      actNow={isActNow(standing)}
      dim={dimmed}
      interactive
      className={styles.row}
      data-highlighted={highlighted ? "true" : undefined}
      data-ward-primitive="record-row"
      data-record-key={movement.id}
      data-tone={classification.tone}
    >
      <button
        type="button"
        className={styles.rowButton}
        aria-pressed={selected}
        aria-label={`${name}, ${legalFormName(legalForm)}, ${reason}`}
        onClick={() => onSelect(movement)}
      />
      <span className={styles.cellStack}>
        <span className={styles.name} data-ward-primitive="record-id">
          {name}
        </span>
        <span className={cx(styles.sub, styles.mono)}>{umrn}</span>
      </span>
      <span className={styles.formCell}>
        <span className={styles.code}>{legalForm.code}</span>
        <span className={styles.formTitle} title={formTitle(legalForm.code)}>
          {formTitle(legalForm.code)}
        </span>
      </span>
      <span className={styles.cellStack}>
        <span className={styles.truncate}>{edName}</span>
        <span className={cx(styles.sub, styles.truncate)}>{wardName ? `to ${wardName}` : "No receiving ward"}</span>
      </span>
      <span className={styles.cellStack}>
        {legalForm.dueAt !== undefined ? (
          <>
            <span className={styles.leftLine}>
              <StatusGlyph tone={STANDING_TONE[standing]} size={9} />
              <strong className={styles.leftValue}>{leftText(movement, now)}</strong>
              <span className={styles.sub}>{standingWord(standing)}</span>
            </span>
            <span className={styles.progress} data-tone={STANDING_TONE[standing]} aria-hidden="true">
              <span style={{ width: `${Math.round(elapsedFraction(movement, now) * 100)}%` }} />
            </span>
          </>
        ) : (
          <>
            <span className={styles.leftLine}>
              <StatusGlyph tone="closed" size={9} />
              <span className={styles.sub}>
                {movement.formedAt === undefined ? "No time written" : "No expiry typed"}
              </span>
            </span>
            {canAddTime ? (
              <button
                type="button"
                className={styles.rowLink}
                aria-label={`Record time written for ${name}`}
                onClick={() => onAddTime(movement)}
              >
                Add the time
              </button>
            ) : (
              <span className={cx(styles.sub, styles.mono)}>In ED {durText(now - movement.openedAt)}</span>
            )}
          </>
        )}
        <span className={styles.srOnly}>{reason}</span>
      </span>
      <span className={styles.recorded}>
        {facts.length === 0 ? (
          <span className={styles.sub}>Not tracked</span>
        ) : missing.length === 0 ? (
          <>
            <StatusGlyph tone="success" size={9} />
            <span className={styles.recordedText}>All recorded</span>
          </>
        ) : (
          <>
            <StatusGlyph tone="neutral" size={9} />
            {/* One fact names itself; more show as a count so the cell never cuts a word. */}
            <span className={styles.recordedText} title={missing.join(", ")}>
              {missing.length === 1 ? missing[0] : `${missing.length} to record`}
            </span>
          </>
        )}
        <span className={styles.srOnly}>
          {done} of {facts.length} recorded
        </span>
      </span>
    </DataRow>
  );
}

/**
 * Phone row (v10): the code chip, the name, the form and where, with the time left at the end.
 * The whole row opens the form sheet; an act now row takes the thin red edge, a dimmed row recedes
 * by colour only.
 */
function PhoneFormRow({ movement, now, name, umrn, edName, wardName, dimmed, onSelect }: FormRowProps) {
  const legalForm = movement.legalForm!;
  const standing = clockStanding(movement, now);
  const facts = recordedFacts(movement);
  const missing = facts.filter((fact) => fact.at === undefined).length;
  const where = wardName ? `${edName} to ${wardName}` : edName;
  return (
    <PhoneListRow
      as="li"
      className={styles.phoneRow}
      data-testid={`ward-legal-phone-row-${movement.id}`}
      {...(dimmed ? { "data-dim": "true" } : {})}
      actNow={isActNow(standing)}
      leading={<span className={styles.code}>{legalForm.code}</span>}
      name={name}
      meta={
        <>
          <span className={styles.phoneMetaLine}>{formTitle(legalForm.code)}</span>
          <span className={styles.phoneMetaLine}>
            {where}
            {missing > 0 ? ` · ${missing} to record` : ""}
          </span>
        </>
      }
      value={
        legalForm.dueAt !== undefined ? (
          <span className={styles.leftLine}>
            <StatusGlyph tone={STANDING_TONE[standing]} size={9} />
            {leftText(movement, now)}
          </span>
        ) : (
          <span className={styles.leftLine}>{durText(now - movement.openedAt)}</span>
        )
      }
      time={legalForm.dueAt !== undefined ? (standing === "passed" ? "passed" : "left") : "in ED"}
      aria-label={`${name}, ${umrn}, ${legalFormName(legalForm)}, ${legalDeadlineText(movement, now)}`}
      onSelect={() => onSelect(movement)}
    />
  );
}

/**
 * Phone checklist (v10): one row per person, the code chip first, what is still to record under
 * the name and the recorded count at the end. The whole row opens the form sheet.
 */
function PhoneChecklist({
  rows,
  nameOf,
  umrnOf,
  isHighlighted,
  highlightOn,
  onSelect,
}: {
  rows: Movement[];
  nameOf: (movement: Movement) => string;
  umrnOf: (movement: Movement) => string;
  isHighlighted: (movement: Movement) => boolean;
  highlightOn: boolean;
  onSelect: (movement: Movement) => void;
}) {
  return (
    <ul className={styles.phoneList} aria-label="Checklist">
      {rows.map((movement) => {
        const facts = recordedFacts(movement);
        const missing = facts.filter((fact) => fact.at === undefined);
        const done = facts.length - missing.length;
        const dimmed = highlightOn && !isHighlighted(movement);
        return (
          <PhoneListRow
            key={movement.id}
            as="li"
            className={styles.phoneRow}
            {...(dimmed ? { "data-dim": "true" } : {})}
            leading={<span className={styles.code}>{movement.legalForm?.code}</span>}
            name={nameOf(movement)}
            meta={
              facts.length === 0
                ? "Not tracked"
                : missing.length === 0
                  ? "Everything recorded"
                  : `To do ${missing.map((fact) => fact.label).join(", ")}`
            }
            value={
              facts.length === 0 ? undefined : (
                <span className={styles.leftLine}>
                  <StatusGlyph tone={missing.length === 0 ? "success" : "neutral"} size={9} />
                  {done}/{facts.length}
                </span>
              )
            }
            time={facts.length === 0 ? undefined : "recorded"}
            aria-label={`${nameOf(movement)}, ${umrnOf(movement)}, ${done} of ${facts.length} recorded`}
            onSelect={() => onSelect(movement)}
          />
        );
      })}
    </ul>
  );
}

/** Checklist view: who still needs what recorded, one column per fact. */
function ChecklistView({
  rows,
  now,
  nameOf,
  umrnOf,
  selectedId,
  isHighlighted,
  highlightOn,
  onSelect,
}: {
  rows: Movement[];
  now: Instant;
  nameOf: (movement: Movement) => string;
  umrnOf: (movement: Movement) => string;
  selectedId: string | null;
  isHighlighted: (movement: Movement) => boolean;
  highlightOn: boolean;
  onSelect: (movement: Movement) => void;
}) {
  const gaps: RecordGap[] = ["written", "received", "examination"];
  return (
    <div className={styles.table} role="region" aria-label="Checklist">
      <DataRow head columns={CHECK_COLUMNS} aria-hidden="true" className={styles.headRow}>
        <span className={tableClasses.th}>Patient</span>
        <span className={tableClasses.th}>Form</span>
        {gaps.map((gap) => (
          <span key={gap} className={tableClasses.th}>
            {GAP_LABEL[gap]}
          </span>
        ))}
      </DataRow>
      <ul className={styles.rowList}>
        {rows.map((movement) => {
          const facts = recordedFacts(movement);
          const on = isHighlighted(movement);
          return (
            <DataRow
              key={movement.id}
              as="li"
              columns={CHECK_COLUMNS}
              selected={movement.id === selectedId}
              interactive
              dim={highlightOn && !on}
              className={cx(styles.row, styles.checkRow)}
              data-highlighted={on ? "true" : undefined}
            >
              <button
                type="button"
                className={styles.rowButton}
                aria-pressed={movement.id === selectedId}
                aria-label={`${nameOf(movement)}, ${legalFormName(movement.legalForm!)}`}
                onClick={() => onSelect(movement)}
              />
              <span className={styles.cellStack}>
                <span className={styles.name}>{nameOf(movement)}</span>
                <span className={cx(styles.sub, styles.mono)}>{umrnOf(movement)}</span>
              </span>
              <span className={styles.code}>{movement.legalForm?.code}</span>
              {gaps.map((gap) => {
                const fact = facts.find((entry) => entry.gap === gap);
                if (!fact) {
                  return (
                    <span key={gap} className={styles.sub} data-label={GAP_LABEL[gap]}>
                      {gap === "written" ? "Not recorded here" : "Not needed"}
                    </span>
                  );
                }
                return (
                  <span key={gap} className={styles.leftLine} data-label={GAP_LABEL[gap]}>
                    <StatusGlyph tone={fact.at !== undefined ? "success" : "neutral"} size={9} />
                    <span className={cx(styles.sub, fact.at !== undefined && styles.mono)}>
                      {fact.at !== undefined ? formatInstantWithDay(fact.at, now) : "To record"}
                    </span>
                  </span>
                );
              })}
            </DataRow>
          );
        })}
      </ul>
    </div>
  );
}
