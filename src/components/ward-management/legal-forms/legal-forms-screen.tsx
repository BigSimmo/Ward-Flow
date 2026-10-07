"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Clock, Copy, FileText, Info, Plus } from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardFoot,
  CardHead,
  Count,
  DataRow,
  Drawer,
  HeroTrack,
  Hero,
  HeroStat,
  LiveChip,
  Segmented,
  Select,
  Sheet,
  StatGroup,
  Stat,
  StatusGlyph,
  TextInput,
  Textarea,
  Checkbox,
  Field,
  Timer,
  Timeline,
  buttonClass,
  cx,
  tableClasses,
  type TimelineItem,
  type WfTone,
} from "@/components/wf";
import { departmentLabel } from "@/components/ward-management/ward-absence-labels";
import {
  currentDueSoonThresholds,
  dayOf,
  formatInstantWithDay,
  type Instant,
  minutesUntil,
} from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { type LegalClockAgeBand, type LegalClockRegion } from "@/components/ward-management/ward-legal-clock";
import { legalFormName, SELECTABLE_LEGAL_FORMS } from "@/components/ward-management/ward-legal-forms";
import { formTitleForCode } from "@/lib/form-register";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { edById, edShortName } from "@/components/ward-management/ward-sites";
import { usePrintableDisclosures } from "@/components/ward-management/use-printable-disclosures";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

import {
  legalDeadlineText,
  legalExpiryReminderOf,
  legalExpiryReminderSummary,
  legalFormBreakdown,
  legalFormGroupRows,
  legalFormRowClassification,
  isLegalDeadlineBreached,
  reminderHours,
} from "./legal-forms-derivations";
import { actPeriodCountdownText, actPeriodReading, type ActPeriodReading } from "./act-periods-demo";
import styles from "./legal-forms.module.css";

/**
 * LEGAL FORMS (v6, `design/pages-v6/LegalForms.png` and its `--dossier`, `--expiring`, `--extend`
 * states). One hero band with the counts by warning window; form types, warning windows and forms
 * by emergency department on the left; the expiring timeline and the two groups (time written on
 * the form, no time written) in the middle; the selected form, the record-a-form card and today's
 * recorded form events on the right. The dossier is a right drawer; extend is a dialog.
 *
 * Owner rules kept from the third edition: no invented deadlines or section numbers (D5), an
 * unconnected action says "Not wired in this prototype." (D4), and the two groups are never ordered
 * against each other.
 */

const MS_PER_MINUTE = 60_000;
const NOT_WIRED = "Not wired in this prototype.";
const CHART_WINDOW_MINUTES = 8 * 60;

function catalogFormLabel(code: string): string {
  const form = SELECTABLE_LEGAL_FORMS.find((entry) => entry.code === code);
  return form ? legalFormName(form) : legalFormName({ code });
}

/**
 * Form codes this wave may mark written or received on this screen. Confirm stays disabled for
 * every other catalogue entry (3B, 4A, 4C, review dates).
 */
const OWNED_LEGAL_FORM_CODES = ["1A", "3A", "3C", "3D", "6A", "6B", "6C", "5A", "5B"] as const;
type OwnedLegalFormCode = (typeof OWNED_LEGAL_FORM_CODES)[number];

/** Form codes `RECORD_LEGAL_FORM_RECEIVED` accepts — the same set this screen may mark received. */
const RECEIPT_EVENT_ACCEPTS = OWNED_LEGAL_FORM_CODES;

const BLANK_TYPED_WRITTEN_DRAFT: {
  date: string;
  time: string;
  region: LegalClockRegion;
  ageBand: LegalClockAgeBand;
} = { date: "", time: "", region: "metro", ageBand: "adult" };

function isOwnedLegalFormCode(code: string | undefined): code is OwnedLegalFormCode {
  return code !== undefined && (OWNED_LEGAL_FORM_CODES as readonly string[]).includes(code);
}

function receiptEventAccepts(code: string | undefined): boolean {
  return code !== undefined && (RECEIPT_EVENT_ACCEPTS as readonly string[]).includes(code);
}

/** Same HH:MM parser the ED legal-form panel uses — local copy so this screen does not import from ed-screen. */
function minutesFromTimeInput(value: string): number | undefined {
  const parts = value.split(":");
  if (parts.length !== 2) return undefined;
  const [rawHours, rawMinutes] = parts;
  if (rawHours?.length !== 2 || rawMinutes?.length !== 2) return undefined;
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return undefined;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return undefined;
  return hours * 60 + minutes;
}

/**
 * Typed date + time → Instant, counted from the provider's `dayZero`. Copied from the ED panel
 * rather than imported: that helper is file-private, and this screen must not invent a duration.
 */
function instantFromDateAndTimeInputs(dateValue: string, timeValue: string, dayZero: Date): number | undefined {
  if (dateValue === "" || timeValue === "") return undefined;
  const minuteOfDayValue = minutesFromTimeInput(timeValue);
  if (minuteOfDayValue === undefined) return undefined;
  const dateParts = dateValue.split("-");
  if (dateParts.length !== 3) return undefined;
  const [rawYear, rawMonth, rawDay] = dateParts;
  if (rawYear?.length !== 4 || rawMonth?.length !== 2 || rawDay?.length !== 2) return undefined;
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const day = Number(rawDay);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return undefined;
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const typedDate = new Date(year, month - 1, day);
  if (typedDate.getFullYear() !== year || typedDate.getMonth() !== month - 1 || typedDate.getDate() !== day) {
    return undefined;
  }
  const dayOffsetMinutes = Math.round((typedDate.getTime() - dayZero.getTime()) / 60_000);
  return dayOffsetMinutes + minuteOfDayValue;
}

/** The authority catalogue, in the order the left card lists it. */
type CatalogueEntry = { id: string; code: string; codes: string[]; title: string; tip: string };
const CATALOGUE: CatalogueEntry[] = [
  { id: "1A", code: "1A", codes: ["1A"], title: formTitleForCode("1A") ?? "Form 1A", tip: catalogFormLabel("1A") },
  { id: "3A", code: "3A", codes: ["3A"], title: formTitleForCode("3A") ?? "Form 3A", tip: catalogFormLabel("3A") },
  { id: "3C", code: "3C", codes: ["3C"], title: formTitleForCode("3C") ?? "Form 3C", tip: catalogFormLabel("3C") },
  {
    id: "3B_3D",
    code: "3B/3D",
    codes: ["3B", "3D"],
    title: `${formTitleForCode("3B")} / ${formTitleForCode("3D")}`,
    tip: `${catalogFormLabel("3B")} / ${catalogFormLabel("3D")}`,
  },
  {
    id: "4A_4C",
    code: "4A/4C",
    codes: ["4A", "4C"],
    title: `${formTitleForCode("4A")} / ${formTitleForCode("4C")}`,
    tip: `${catalogFormLabel("4A")} / ${catalogFormLabel("4C")}`,
  },
  { id: "5A", code: "5A", codes: ["5A"], title: formTitleForCode("5A") ?? "Form 5A", tip: catalogFormLabel("5A") },
  { id: "5B", code: "5B", codes: ["5B"], title: formTitleForCode("5B") ?? "Form 5B", tip: catalogFormLabel("5B") },
  { id: "6A", code: "6A", codes: ["6A"], title: formTitleForCode("6A") ?? "Form 6A", tip: catalogFormLabel("6A") },
  { id: "6B", code: "6B", codes: ["6B"], title: formTitleForCode("6B") ?? "Form 6B", tip: catalogFormLabel("6B") },
  { id: "6C", code: "6C", codes: ["6C"], title: formTitleForCode("6C") ?? "Form 6C", tip: catalogFormLabel("6C") },
];

/** The status of one form against the warning windows: glyph tone and the short word beside it. */
function windowState(movement: Movement, now: Instant): { tone: WfTone; text: string } | undefined {
  const legalForm = movement.legalForm;
  if (legalForm?.dueAt === undefined) return undefined;
  if (isLegalDeadlineBreached(movement, now)) return { tone: "danger", text: "Passed" };
  const reminder = legalExpiryReminderOf(movement, now);
  if (reminder === "within-urgent") return { tone: "danger", text: `Within ${reminderHours(reminder)}h` };
  if (reminder === "within-soon") return { tone: "warning", text: `Within ${reminderHours(reminder)}h` };
  return { tone: "neutral", text: "Later" };
}

/** "72h period", from the labelled synthetic Act-period demo. Undefined when the demo has none. */
function periodShort(reading: ActPeriodReading | undefined): string | undefined {
  if (!reading) return undefined;
  const length = reading.period.adult;
  if ("hours" in length) return `${length.hours}h period`;
  if ("days" in length) return `${length.days} day period`;
  return `${length.months} month period`;
}

type FormEvent_ = { id: string; sortAt: Instant; tone: WfTone; text: string };

/** Recorded legal-form facts on one movement, newest first: what the record holds and nothing more. */
function formEvents(movement: Movement, edName: string): FormEvent_[] {
  const code = movement.legalForm?.code;
  if (code === undefined) return [];
  const items: FormEvent_[] = [
    { id: `${movement.id}-lodged`, sortAt: movement.openedAt, tone: "success", text: `Lodged on the move, ${edName}` },
  ];
  if (movement.formedAt !== undefined) {
    items.push({
      id: `${movement.id}-written`,
      sortAt: movement.formedAt,
      tone: "info",
      text: `Form ${code} made, time written on form`,
    });
  }
  if (movement.legalFormReceivedAt !== undefined) {
    items.push({
      id: `${movement.id}-received`,
      sortAt: movement.legalFormReceivedAt,
      tone: "success",
      text: `Form ${code} received`,
    });
  }
  for (const [index, entry] of (movement.legalFormExpiryHistory ?? []).entries()) {
    items.push({
      id: `${movement.id}-expiry-${index}`,
      sortAt: entry.at,
      tone: "info",
      text: entry.basis === "extension" ? `Form ${code} extended` : `Expiry typed from form ${code}`,
    });
  }
  return items.sort((a, b) => b.sortAt - a.sortAt);
}

function asTimeline(events: FormEvent_[], now: Instant): TimelineItem[] {
  return events.map(({ id, sortAt, tone, text }) => ({ id, at: formatInstantWithDay(sortAt, now), tone, text }));
}

export function LegalFormsScreen() {
  usePrintableDisclosures();

  const { movements, referrals, patients, dispatch, dayZero, rejections } = useWardFlow();
  const now = useWardFlowClock();
  const nowMs = now * MS_PER_MINUTE;

  const [authorityFilter, setAuthorityFilter] = useState<string>("all");
  const [urgencyFilter, setUrgencyFilter] = useState<"all" | "urgent">("all");
  const [renewModalOpen, setRenewModalOpen] = useState<boolean>(false);
  const [inspectorDrawerOpen, setInspectorDrawerOpen] = useState<boolean>(false);
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null);
  const [targetMovementId, setTargetMovementId] = useState<string>("");
  const [writtenDraft, setWrittenDraft] = useState(BLANK_TYPED_WRITTEN_DRAFT);
  const [recordDraft, setRecordDraft] = useState({ form: SELECTABLE_LEGAL_FORMS[0]?.code ?? "", movement: "" });
  // Bumped by Clear to remount the uncontrolled clinician, time and notes fields.
  const [recordFormKey, setRecordFormKey] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const recordFormTypeRef = useRef<HTMLSelectElement | null>(null);

  const openMovements = movements.filter(isOpen);

  // Grouped by record: with-deadline (countdown clock) and no-deadline (longest wait)
  const withDeadline = legalFormGroupRows(movements, now, "with-deadline");
  const noDeadline = legalFormGroupRows(movements, now, "no-deadline");
  const rows = [...withDeadline, ...noDeadline];
  const voluntary = openMovements.length - rows.length;
  const breakdown = legalFormBreakdown(rows, now);
  const passed = withDeadline.filter((movement) => isLegalDeadlineBreached(movement, now)).length;
  const upcoming = withDeadline.length - passed;
  const reminders = legalExpiryReminderSummary(movements, now);
  const later = upcoming - reminders.withinUrgent - reminders.withinSoon;
  const expiring = passed + reminders.withinUrgent + reminders.withinSoon;
  const thresholds = currentDueSoonThresholds();

  const applyAuthorityFilter = (list: Movement[]) => {
    if (authorityFilter === "all") return list;
    if (authorityFilter === "reviews") return [];
    const entry = CATALOGUE.find((item) => item.id === authorityFilter);
    const codes = entry ? entry.codes : [authorityFilter];
    return list.filter((m) => codes.includes(m.legalForm?.code ?? ""));
  };

  const isExpiring = (m: Movement) => windowState(m, now)?.text !== "Later";
  const filteredWithDeadline = applyAuthorityFilter(
    urgencyFilter === "urgent" ? withDeadline.filter(isExpiring) : withDeadline,
  );
  const filteredNoDeadline = urgencyFilter === "urgent" ? [] : applyAuthorityFilter(noDeadline);

  const selectedMovement =
    // Resolve only within the active filters, so a filtered-out row never stays selected.
    [...filteredWithDeadline, ...filteredNoDeadline].find((m) => m.id === selectedMovementId) ??
    filteredWithDeadline[0] ??
    filteredNoDeadline[0] ??
    null;
  const selectedPatientInfo = selectedMovement
    ? resolveSubjectPatient(selectedMovement, { patients, referrals })
    : null;
  const typedWrittenAt =
    selectedMovement === null ? undefined : instantFromDateAndTimeInputs(writtenDraft.date, writtenDraft.time, dayZero);
  const lastWrittenRefusal =
    selectedMovement === null
      ? undefined
      : rejections.findLast(
          (entry) => entry.movementId === selectedMovement.id && entry.attempted === "RECORD_LEGAL_FORM_WRITTEN",
        );

  const edNameOf = (movement: Movement) => {
    const ed = edById(movement.originEdId);
    return ed ? edShortName(ed) : departmentLabel(movement.originEdId, undefined);
  };

  const handleOpenRecordForm = (movementId?: string) => {
    if (movementId) setRecordDraft((current) => ({ ...current, movement: movementId }));
    const field = recordFormTypeRef.current;
    field?.scrollIntoView?.({ block: "nearest" });
    field?.focus();
  };

  const handleOpenRenew = (movementId?: string) => {
    if (movementId) {
      setTargetMovementId(movementId);
    } else {
      const firstBreached = withDeadline.find((m) => isLegalDeadlineBreached(m, now));
      setTargetMovementId(firstBreached?.id ?? withDeadline[0]?.id ?? "");
    }
    setRenewModalOpen(true);
  };

  const handleSelect = (movement: Movement) => {
    if (movement.id !== selectedMovement?.id) setWrittenDraft(BLANK_TYPED_WRITTEN_DRAFT);
    setSelectedMovementId(movement.id);
  };

  const handleOpenInspector = (movement: Movement) => {
    if (movement.id !== selectedMovement?.id) setWrittenDraft(BLANK_TYPED_WRITTEN_DRAFT);
    setSelectedMovementId(movement.id);
    setInspectorDrawerOpen(true);
  };

  const handleMarkFormReceived = (movementId: string) => {
    const movement = movements.find((entry) => entry.id === movementId);
    if (!receiptEventAccepts(movement?.legalForm?.code)) return;
    if (movement?.legalFormReceivedAt !== undefined) return;
    dispatch({ type: "RECORD_LEGAL_FORM_RECEIVED", role: "ed", now, movementId });
  };

  const handleRecordFormWritten = (event: FormEvent<HTMLFormElement>, movement: Movement) => {
    event.preventDefault();
    const formCode = movement.legalForm?.code;
    if (!isOwnedLegalFormCode(formCode)) return;
    const writtenAt = instantFromDateAndTimeInputs(writtenDraft.date, writtenDraft.time, dayZero);
    if (writtenAt === undefined) return;
    dispatch({
      type: "RECORD_LEGAL_FORM_WRITTEN",
      role: "coordinator",
      now,
      movementId: movement.id,
      formCode,
      writtenAt,
      region: writtenDraft.region,
      ageBand: writtenDraft.ageBand,
    });
  };

  const copyText = (key: string, text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text).catch(() => undefined);
    }
    setCopied(key);
    window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 2000);
  };

  const patientOf = (movement: Movement) => resolveSubjectPatient(movement, { patients, referrals });

  const expiringSoon = withDeadline.filter((m) => {
    const left = minutesUntil(m.legalForm!.dueAt!, now);
    return left >= 0 && left <= CHART_WINDOW_MINUTES;
  });
  const handoverText = expiringSoon
    .map(
      (m) => `${formatInstantWithDay(m.legalForm!.dueAt!, now)} Form ${m.legalForm!.code}, ${patientOf(m).formalName}`,
    )
    .join("\n");

  // Forms by emergency department, most first.
  const byEd = new Map<string, { name: string; count: number; tone?: WfTone }>();
  for (const movement of rows) {
    const name = edNameOf(movement);
    const entry = byEd.get(movement.originEdId) ?? { name, count: 0 };
    entry.count += 1;
    const state = windowState(movement, now);
    if (state?.tone === "danger") entry.tone = "danger";
    else if (state?.tone === "warning" && entry.tone !== "danger") entry.tone = "warning";
    byEd.set(movement.originEdId, entry);
  }
  const edRows = [...byEd.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  // Recorded today, across every form on an open move: written, received and expiry entries.
  const today: TimelineItem[] = asTimeline(
    rows
      .flatMap((movement) =>
        formEvents(movement, edNameOf(movement))
          .filter((event) => !event.id.endsWith("-lodged"))
          .map((event) => ({ ...event, text: `${event.text}, ${edNameOf(movement)}` })),
      )
      .filter((event) => event.sortAt <= now && dayOf(event.sortAt) === dayOf(now))
      .sort((a, b) => b.sortAt - a.sortAt)
      .slice(0, 5),
    now,
  );

  const catalogueCount = (codes: string[]) => rows.filter((m) => codes.includes(m.legalForm?.code ?? "")).length;

  return (
    <div className={styles.screen} data-testid="ward-legal-forms-page" data-ward-design="v6">
      <main id="main-content" className={styles.main}>
        <h1 className={styles.srOnly}>Legal forms</h1>
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

        <div data-testid="ward-legal-hud-island">
          <Hero
            eyebrow="Statutory forms"
            title={`${rows.length} forms on open moves`}
            stats={
              <>
                <HeroStat
                  className={styles.heroStat}
                  value={passed}
                  label="Passed"
                  tone={passed > 0 ? "danger" : undefined}
                />
                <HeroStat
                  className={styles.heroStat}
                  value={reminders.withinUrgent}
                  label={`Within ${reminders.urgentHours}h`}
                  tone="danger"
                />
                <HeroStat
                  className={styles.heroStat}
                  value={reminders.withinSoon}
                  label={`Within ${reminders.soonHours}h`}
                  tone="warning"
                />
                <HeroStat className={styles.heroStat} value={Math.max(later, 0)} label="Later" tone="neutral" />
                <HeroStat
                  className={styles.heroStat}
                  value={noDeadline.length}
                  label="No time written"
                  tone="neutral"
                />
                <HeroStat className={styles.heroStat} value={voluntary} label="Voluntary" />
              </>
            }
            aside={
              <div className={styles.heroAside}>
                <LiveChip state="live" onHero />
                <div className={styles.heroControls}>
                  <HeroTrack
                    label="Forms shown"
                    value={urgencyFilter}
                    onChange={setUrgencyFilter}
                    items={[
                      { id: "all", label: "All", count: rows.length },
                      { id: "urgent", label: "Expiring", count: expiring },
                    ]}
                  />
                  <Button variant="light" icon={Plus} onClick={() => handleOpenRecordForm()}>
                    Record a form
                  </Button>
                </div>
              </div>
            }
          />
        </div>

        <div className={styles.layout}>
          {/* Left: form types, warning windows, by emergency department */}
          <div className={styles.column}>
            <Card aria-label="Form types">
              <CardHead title="Form types" level={2} aside={<span className={styles.meta}>{rows.length} total</span>} />
              <CardBody className={styles.catalogue}>
                <ul className={styles.catalogueList} aria-label="Form catalog">
                  <li>
                    <button
                      type="button"
                      className={cx(styles.catalogItem, authorityFilter === "all" && styles.catalogItemOn)}
                      aria-pressed={authorityFilter === "all"}
                      onClick={() => setAuthorityFilter("all")}
                    >
                      <span className={styles.code}>All</span>
                      <span className={styles.catalogTitle}>All forms</span>
                      <Count n={rows.length} />
                    </button>
                  </li>
                  {CATALOGUE.map((entry) => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        className={cx(styles.catalogItem, authorityFilter === entry.id && styles.catalogItemOn)}
                        aria-pressed={authorityFilter === entry.id}
                        onClick={() => setAuthorityFilter(authorityFilter === entry.id ? "all" : entry.id)}
                        title={entry.tip}
                      >
                        <span className={styles.code}>{entry.code}</span>
                        <span className={styles.catalogTitle}>{entry.title}</span>
                        <Count n={catalogueCount(entry.codes)} />
                      </button>
                    </li>
                  ))}
                  <li>
                    <button
                      type="button"
                      className={cx(styles.catalogItem, authorityFilter === "reviews" && styles.catalogItemOn)}
                      aria-pressed={authorityFilter === "reviews"}
                      onClick={() => setAuthorityFilter(authorityFilter === "reviews" ? "all" : "reviews")}
                    >
                      <span className={styles.code}>REV</span>
                      <span className={styles.catalogTitle}>Periodic review dates</span>
                      <Count n={0} />
                    </button>
                  </li>
                </ul>
                <div className={styles.srOnly} data-testid="legal-form-breakdown">
                  {breakdown.map((form) => {
                    const openWord = form.openCount === 1 ? "open movement" : "open movements";
                    const breachClause =
                      form.breachedCount > 0
                        ? `, ${form.breachedCount} passed ${form.breachedCount === 1 ? "its deadline" : "their deadlines"}`
                        : "";
                    return (
                      <span key={form.name}>{`${form.name}, ${form.openCount} ${openWord}${breachClause}. `}</span>
                    );
                  })}
                </div>
              </CardBody>
            </Card>

            <Card aria-label="Warning windows" data-testid="ward-legal-expiry-reminder">
              <CardHead
                title="Warning windows"
                level={2}
                action={
                  <Link href="/mockups/ward-flow/settings" className={styles.textLink}>
                    Settings
                  </Link>
                }
              />
              <CardBody>
                <StatGroup>
                  <Stat value={`${reminders.urgentHours}h`} label="First" tone="danger" size="sm" />
                  <Stat value={`${reminders.soonHours}h`} label="Second" tone="warning" size="sm" />
                </StatGroup>
                <WindowScale urgentMinutes={thresholds.urgentMinutes} soonMinutes={thresholds.soonMinutes} />
                <p className={styles.footnote}>Your defaults, not legal limits</p>
              </CardBody>
            </Card>

            <Card aria-label="By emergency dept">
              <CardHead title="By emergency dept" level={2} aside={<span className={styles.meta}>Forms</span>} />
              <CardBody flush>
                <ul className={styles.edList}>
                  {edRows.map((ed) => (
                    <li key={ed.name} className={styles.edRow}>
                      <span className={styles.edName}>{ed.name}</span>
                      {ed.tone ? (
                        <StatusGlyph tone={ed.tone} size={9} />
                      ) : (
                        <span className={styles.glyphSpace} aria-hidden="true" />
                      )}
                      <span className={styles.edCount}>{ed.count}</span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          </div>

          {/* Middle: expiring timeline and the two groups */}
          <div className={styles.column}>
            <Card aria-label="Expiring next 8h">
              <CardHead
                title="Expiring next 8h"
                level={2}
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Copy}
                    onClick={() => copyText("handover", handoverText)}
                    disabledReason={expiringSoon.length === 0 ? "Nothing expiring" : undefined}
                    reasonDisplay="tooltip"
                  >
                    {copied === "handover" ? "Copied" : "Copy for handover"}
                  </Button>
                }
              />
              <CardBody>
                <ExpiryStrip
                  rows={expiringSoon.map((m) => ({
                    id: m.id,
                    dueAt: m.legalForm!.dueAt!,
                    label: `${m.legalForm!.code} ${patientOf(m).formalName.split(",")[0]}`,
                    tone: windowState(m, now)?.tone ?? "neutral",
                  }))}
                  now={now}
                  soonMinutes={thresholds.soonMinutes}
                />
              </CardBody>
            </Card>

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
              <div role="region" aria-label="Legal forms list" className={styles.groupStack}>
                {rows.length === 0 ? (
                  <Card>
                    <CardBody>
                      <p className={styles.absent}>No open movement carries a legal form.</p>
                    </CardBody>
                  </Card>
                ) : (
                  <>
                    <Card aria-labelledby="legal-group-written">
                      <CardHead
                        id="legal-group-written"
                        title="Time written on form"
                        level={2}
                        aside={
                          <span className={styles.meta}>
                            {filteredWithDeadline.length} people · least time left first
                          </span>
                        }
                      />
                      <span className={styles.srOnly}>Forms with a deadline recorded</span>
                      {filteredWithDeadline.length > 0 ? (
                        <>
                          <DataRow head columns={ROW_COLUMNS} aria-hidden="true" className={styles.headRow}>
                            <span className={tableClasses.th}>Patient</span>
                            <span className={tableClasses.th}>Form · site</span>
                            <span className={cx(tableClasses.th, styles.end)}>Left</span>
                          </DataRow>
                          <ul className={styles.rowList}>
                            {filteredWithDeadline.map((movement) => (
                              <LegalFormRow
                                key={movement.id}
                                movement={movement}
                                now={now}
                                selected={movement.id === selectedMovement?.id}
                                onSelect={handleSelect}
                                onRecordTime={handleOpenInspector}
                                dayZero={dayZero}
                                patients={patients}
                                referrals={referrals}
                                edName={edNameOf(movement)}
                              />
                            ))}
                          </ul>
                        </>
                      ) : (
                        <p className={styles.absent} data-testid="ward-legal-forms-none-with-deadline">
                          {authorityFilter === "all"
                            ? "No open movement carries a form with a deadline recorded on it."
                            : "No open movements recorded for this category."}
                        </p>
                      )}
                    </Card>

                    {urgencyFilter === "urgent" ? null : (
                      <Card aria-labelledby="legal-group-unwritten">
                        <CardHead
                          id="legal-group-unwritten"
                          title="No time written"
                          level={2}
                          aside={
                            <span className={styles.meta}>
                              {filteredNoDeadline.length} people · longest in ED first
                            </span>
                          }
                        />
                        <span className={styles.srOnly}>Forms with no deadline recorded</span>
                        {filteredNoDeadline.length > 0 ? (
                          <>
                            <DataRow head columns={ROW_COLUMNS_CLOCKLESS} aria-hidden="true" className={styles.headRow}>
                              <span className={tableClasses.th}>Patient</span>
                              <span className={tableClasses.th}>Form · site</span>
                              <span className={cx(tableClasses.th, styles.end)}>In ED</span>
                              <span />
                            </DataRow>
                            <ul className={styles.rowList}>
                              {filteredNoDeadline.map((movement) => (
                                <LegalFormRow
                                  key={movement.id}
                                  movement={movement}
                                  now={now}
                                  selected={movement.id === selectedMovement?.id}
                                  onSelect={handleSelect}
                                  onRecordTime={handleOpenInspector}
                                  dayZero={dayZero}
                                  patients={patients}
                                  referrals={referrals}
                                  edName={edNameOf(movement)}
                                />
                              ))}
                            </ul>
                          </>
                        ) : (
                          <p className={styles.absent} data-testid="ward-legal-forms-none-without-deadline">
                            Every open movement carrying a form has a deadline recorded on it.
                          </p>
                        )}
                      </Card>
                    )}
                  </>
                )}
              </div>
            </section>
          </div>

          {/* Right: the selected form, record a form, recorded today */}
          <div className={styles.column}>
            {selectedMovement && selectedPatientInfo ? (
              <SelectedFormCard
                movement={selectedMovement}
                name={selectedPatientInfo.formalName}
                umrn={selectedPatientInfo.umrn}
                edName={edNameOf(selectedMovement)}
                now={now}
                nowMs={nowMs}
                dayZero={dayZero}
                onDossier={() => handleOpenInspector(selectedMovement)}
                onExtend={() => handleOpenRenew(selectedMovement.id)}
                onRecordNext={() => handleOpenRecordForm(selectedMovement.id)}
              />
            ) : null}

            <Card aria-label="Record a form">
              <CardHead title="Record a form" icon={FileText} level={2} />
              <CardBody key={recordFormKey} className={styles.recordForm}>
                <Field label="Form type" id="legal-forms-new-instrument">
                  <Select
                    ref={recordFormTypeRef}
                    value={recordDraft.form}
                    onChange={(event) => setRecordDraft((current) => ({ ...current, form: event.target.value }))}
                  >
                    {SELECTABLE_LEGAL_FORMS.map((form) => (
                      <option key={form.code} value={form.code}>
                        {legalFormName(form)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Movement" id="legal-forms-new-movement">
                  <Select
                    value={recordDraft.movement}
                    onChange={(event) => setRecordDraft((current) => ({ ...current, movement: event.target.value }))}
                  >
                    <option value="">Choose a movement</option>
                    {openMovements.map((m) => {
                      const p = patientOf(m);
                      return (
                        // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
                        <option key={m.id} value={m.id}>
                          {p.formalName} ({p.umrn}), {m.legalForm ? `Form ${m.legalForm.code}` : "Voluntary"}
                        </option>
                      );
                    })}
                  </Select>
                </Field>
                <div className={styles.fieldPair}>
                  <Field label="Clinician" id="legal-forms-new-clinician">
                    <TextInput placeholder="Name and role" autoComplete="off" />
                  </Field>
                  <Field label="Time on form" id="legal-forms-new-time">
                    <TextInput icon={Clock} placeholder="HH:MM" inputMode="numeric" autoComplete="off" />
                  </Field>
                </div>
                <Field label="Notes" id="legal-forms-new-notes">
                  <Textarea
                    maxLength={280}
                    rows={2}
                    placeholder="Grounds as written on the form"
                    data-gramm="false"
                    data-enable-grammarly="false"
                    spellCheck={false}
                    autoComplete="off"
                  />
                </Field>
              </CardBody>
              <CardFoot>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setRecordDraft({ form: SELECTABLE_LEGAL_FORMS[0]?.code ?? "", movement: "" });
                    setRecordFormKey((key) => key + 1);
                  }}
                >
                  Clear
                </Button>
                <Button
                  variant="pri"
                  size="sm"
                  data-testid="ward-legal-forms-register-confirm"
                  disabledReason={NOT_WIRED}
                  title={NOT_WIRED}
                >
                  Save form
                </Button>
              </CardFoot>
            </Card>

            <Card aria-label="Recorded today">
              <CardHead
                title="Recorded today"
                level={2}
                aside={<span className={styles.meta}>{today.length} today</span>}
              />
              <CardBody>
                {today.length > 0 ? (
                  <Timeline items={today} label="Legal forms recorded today" holdNew={false} />
                ) : (
                  <p className={styles.absent}>Nothing recorded today</p>
                )}
              </CardBody>
            </Card>
          </div>
        </div>

        {/* Legal form dossier drawer */}
        {selectedMovement && selectedPatientInfo ? (
          <Drawer
            open={inspectorDrawerOpen}
            onClose={() => setInspectorDrawerOpen(false)}
            ariaLabel="Legal form dossier"
            headerHidden
            portal={false}
            contentClassName={styles.drawer}
            testId="ward-legal-dossier"
            footer={
              <div className={styles.drawerFoot}>
                <Button
                  variant="ghost"
                  icon={Copy}
                  onClick={() =>
                    copyText(
                      "summary",
                      `${selectedPatientInfo.formalName} (${selectedPatientInfo.umrn})\n${
                        selectedMovement.legalForm ? legalFormName(selectedMovement.legalForm) : "Voluntary"
                      }\n${legalDeadlineText(selectedMovement, now)}`,
                    )
                  }
                >
                  {copied === "summary" ? "Copied" : "Copy summary"}
                </Button>
                <span className={styles.footSpacer} />
                <Button variant="sec" onClick={() => setInspectorDrawerOpen(false)}>
                  Close
                </Button>
              </div>
            }
          >
            <div className={styles.drawerBody}>
              <div className={styles.drawerHead}>
                <Avatar name={selectedPatientInfo.formalName} initials={selectedPatientInfo.initials} decorative />
                <div className={styles.drawerTitleBlock}>
                  <span className={styles.eyebrow}>Legal form dossier</span>
                  <h2 className={styles.drawerTitle}>{selectedPatientInfo.formalName}</h2>
                  <span className={styles.drawerSub}>
                    <span className={styles.mono}>{selectedPatientInfo.umrn}</span> ·{" "}
                    {selectedMovement.legalForm ? legalFormName(selectedMovement.legalForm) : "Voluntary"}
                  </span>
                </div>
              </div>

              {selectedMovement.legalForm?.dueAt !== undefined ? (
                <div className={styles.dueLine}>
                  {(() => {
                    const state = windowState(selectedMovement, now);
                    return state ? (
                      <Badge tone={state.tone === "neutral" ? "neutral" : state.tone}>{state.text}</Badge>
                    ) : null;
                  })()}
                  <span className={styles.dueValue}>
                    <Timer
                      at={selectedMovement.legalForm.dueAt * MS_PER_MINUTE}
                      now={nowMs}
                      direction="left"
                      hideFlagWord
                    />
                    <span className={styles.meta}>
                      expires {formatInstantWithDay(selectedMovement.legalForm.dueAt, now)}
                    </span>
                  </span>
                </div>
              ) : null}

              <dl className={styles.kv}>
                <div>
                  <dt>Legal status</dt>
                  <dd>{selectedMovement.legalStatus}</dd>
                </div>
                <div>
                  <dt>Origin</dt>
                  <dd>{edNameOf(selectedMovement)}</dd>
                </div>
                <div>
                  {/* Owner, 26 Sept 2026: no WF journey number row; the patient is named above. */}
                  <dt>Owner</dt>
                  <dd>{selectedMovement.owner}</dd>
                </div>
                <div>
                  <dt>Lodged</dt>
                  <dd className={styles.mono}>{formatInstantWithDay(selectedMovement.openedAt, now)}</dd>
                </div>
                <div>
                  <dt>Recorded deadline</dt>
                  <dd className={styles.mono}>
                    {selectedMovement.legalForm?.dueAt !== undefined
                      ? formatInstantWithDay(selectedMovement.legalForm.dueAt, now)
                      : "No deadline recorded on form"}
                  </dd>
                </div>
                <div>
                  <dt>Time written</dt>
                  <dd className={styles.mono}>
                    {selectedMovement.formedAt !== undefined
                      ? `${formatInstantWithDay(selectedMovement.formedAt, now)} on form`
                      : "Not recorded"}
                  </dd>
                </div>
                <div>
                  <dt>Form received</dt>
                  <dd>
                    {selectedMovement.legalFormReceivedAt !== undefined ? (
                      <span className={styles.mono}>
                        {formatInstantWithDay(selectedMovement.legalFormReceivedAt, now)}
                      </span>
                    ) : (
                      <span className={styles.withGlyph}>
                        <StatusGlyph tone="neutral" size={9} />
                        Not marked received
                      </span>
                    )}
                  </dd>
                </div>
              </dl>

              {(() => {
                const reading = actPeriodReading(selectedMovement, dayZero);
                return reading ? (
                  <p className={styles.note}>
                    {reading.text} {actPeriodCountdownText(reading, now)}
                  </p>
                ) : null;
              })()}

              <section aria-labelledby="dossier-history" className={styles.drawerSection}>
                <h3 id="dossier-history" className={styles.sectionHead}>
                  Form history
                </h3>
                <Timeline
                  items={asTimeline(formEvents(selectedMovement, edNameOf(selectedMovement)), now)}
                  label="Form history"
                  holdNew={false}
                />
              </section>

              <section aria-labelledby="dossier-actions" className={styles.drawerSection}>
                <h3 id="dossier-actions" className={styles.sectionHead}>
                  Practitioner actions
                </h3>
                {isLegalDeadlineBreached(selectedMovement, now) ? (
                  <Button variant="danger" onClick={() => handleOpenRenew(selectedMovement.id)}>
                    Extend recorded form
                  </Button>
                ) : null}
                {receiptEventAccepts(selectedMovement.legalForm?.code) ? (
                  selectedMovement.legalFormReceivedAt === undefined ? (
                    <div>
                      <Button
                        variant="pri"
                        data-testid={`ward-legal-forms-mark-received-${selectedMovement.id}`}
                        onClick={() => handleMarkFormReceived(selectedMovement.id)}
                      >
                        Mark Form {selectedMovement.legalForm?.code} received
                      </Button>
                    </div>
                  ) : (
                    <p className={styles.note}>
                      Form {selectedMovement.legalForm?.code} received{" "}
                      {formatInstantWithDay(selectedMovement.legalFormReceivedAt, now)}.
                    </p>
                  )
                ) : (
                  <p className={styles.note}>Receipt is not offered for this form here.</p>
                )}

                {isOwnedLegalFormCode(selectedMovement.legalForm?.code) ? (
                  <form
                    className={styles.writtenForm}
                    data-testid={`ward-legal-forms-written-form-${selectedMovement.id}`}
                    onSubmit={(event) => handleRecordFormWritten(event, selectedMovement)}
                  >
                    <h4 className={styles.subHead}>Record the time written</h4>
                    <div className={styles.dateTime}>
                      <Field label="Date written" id={`legal-forms-written-date-${selectedMovement.id}`}>
                        <TextInput
                          type="date"
                          value={writtenDraft.date}
                          onChange={(event) => setWrittenDraft((current) => ({ ...current, date: event.target.value }))}
                        />
                      </Field>
                      <Field label="Time" id={`legal-forms-written-time-${selectedMovement.id}`}>
                        <TextInput
                          type="time"
                          icon={Clock}
                          value={writtenDraft.time}
                          onChange={(event) => setWrittenDraft((current) => ({ ...current, time: event.target.value }))}
                        />
                      </Field>
                    </div>
                    <div className={styles.choiceRow}>
                      <span className={styles.choiceLabel} id={`legal-forms-written-region-${selectedMovement.id}`}>
                        Region
                      </span>
                      <Segmented
                        label="Region"
                        value={writtenDraft.region}
                        onChange={(region) => setWrittenDraft((current) => ({ ...current, region }))}
                        items={[
                          { id: "metro", label: "Metro" },
                          { id: "country", label: "Country" },
                        ]}
                      />
                    </div>
                    <div className={styles.choiceRow}>
                      <span className={styles.choiceLabel}>Age band</span>
                      <Segmented
                        label="Age band"
                        value={writtenDraft.ageBand}
                        onChange={(ageBand) => setWrittenDraft((current) => ({ ...current, ageBand }))}
                        items={[
                          { id: "adult", label: "Adult" },
                          { id: "under_18", label: "Under 18" },
                        ]}
                      />
                    </div>
                    <div className={styles.writtenFoot}>
                      <p
                        id={`ward-legal-forms-clock-preview-${selectedMovement.id}`}
                        className={styles.note}
                        data-testid={`ward-legal-forms-clock-preview-${selectedMovement.id}`}
                      >
                        {typedWrittenAt === undefined
                          ? "Enter the time written on the form."
                          : "Only the written time is recorded. No expiry is calculated."}
                      </p>
                      <Button
                        type="submit"
                        variant="sec"
                        data-testid={`ward-legal-forms-written-confirm-${selectedMovement.id}`}
                        aria-describedby={`ward-legal-forms-clock-preview-${selectedMovement.id}`}
                        disabledReason={typedWrittenAt === undefined ? "Enter the time written on the form" : undefined}
                        reasonDisplay="tooltip"
                      >
                        Save time written
                      </Button>
                    </div>
                    {lastWrittenRefusal ? (
                      <p
                        className={styles.note}
                        data-testid={`ward-legal-forms-written-refusal-${selectedMovement.id}`}
                      >
                        Not recorded: {lastWrittenRefusal.reason}
                      </p>
                    ) : null}
                  </form>
                ) : (
                  <p className={styles.note}>Recording a written time is not offered for this form here.</p>
                )}

                <div className={styles.unavailable}>
                  <p className={styles.note}>Unavailable here, not wired in this prototype</p>
                  {[
                    "Record involuntary examination",
                    "Transport officer verification",
                    "Schedule a review date",
                    "Print form summary",
                  ].map((label) => (
                    <Button
                      key={label}
                      variant="sec"
                      disabledReason={NOT_WIRED}
                      reasonDisplay="tooltip"
                      title={NOT_WIRED}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </section>
            </div>
          </Drawer>
        ) : null}

        {/* Extend recorded form dialog */}
        <Sheet
          open={renewModalOpen}
          onClose={() => setRenewModalOpen(false)}
          title="Extend recorded form"
          description="Extension is recorded, not legally checked"
          portal={false}
          testId="ward-legal-extend"
          footer={
            <div className={styles.drawerFoot}>
              <Button variant="ghost" onClick={() => setRenewModalOpen(false)}>
                Cancel
              </Button>
              <span className={styles.footSpacer} />
              <Button
                variant="pri"
                data-testid="ward-legal-forms-renew-confirm"
                disabledReason={NOT_WIRED}
                title={NOT_WIRED}
              >
                Confirm extension
              </Button>
            </div>
          }
        >
          {(() => {
            const target = movements.find((x) => x.id === targetMovementId);
            if (!target) return <p className={styles.note}>Choose a form first.</p>;
            const p = patientOf(target);
            const state = windowState(target, now);
            return (
              <div className={styles.extendBody}>
                {target.legalForm?.dueAt !== undefined ? (
                  <div className={styles.dueLine}>
                    {state ? <Badge tone={state.tone}>{state.text}</Badge> : null}
                    <Timer at={target.legalForm.dueAt * MS_PER_MINUTE} now={nowMs} direction="left" hideFlagWord />
                    <span className={styles.meta}>{target.legalForm ? legalFormName(target.legalForm) : ""}</span>
                  </div>
                ) : null}
                <Field label="Target movement" id="legal-forms-renew-movement">
                  <TextInput locked readOnly value={`${target.id} · ${p.formalName} · ${p.umrn}`} />
                </Field>
                <Field label="Authorising specialist" id="legal-forms-renew-specialist">
                  <TextInput placeholder="Specialist name and role" autoComplete="off" />
                </Field>
                <Field label="Justification" id="legal-forms-renew-justification">
                  <Textarea
                    maxLength={280}
                    rows={3}
                    placeholder="Clinical justification for the recorded extension"
                    data-gramm="false"
                    data-enable-grammarly="false"
                    spellCheck={false}
                    autoComplete="off"
                  />
                </Field>
                <Checkbox label={`Tell the owner, ${target.owner}`} defaultChecked />
              </div>
            );
          })()}
        </Sheet>
      </main>
      <WardPrototypeFooter testId="ward-legal-forms-governance" />
    </div>
  );
}

const ROW_COLUMNS = "minmax(0, 1.1fr) minmax(0, 1.4fr) 96px";
const ROW_COLUMNS_CLOCKLESS = "minmax(0, 1.1fr) minmax(0, 1.4fr) 84px 36px";

/** The warning windows on an 8h-to-now scale, with a tick at each window. */
function WindowScale({ urgentMinutes, soonMinutes }: { urgentMinutes: number; soonMinutes: number }) {
  const span = CHART_WINDOW_MINUTES;
  const pos = (minutes: number) => `${Math.max(0, Math.min(100, 100 - (minutes / span) * 100))}%`;
  return (
    <div className={styles.scale} aria-hidden="true">
      <div className={styles.scaleTrack}>
        <span className={styles.scaleTick} style={{ left: pos(soonMinutes) }} />
        <span className={styles.scaleTick} style={{ left: pos(urgentMinutes) }} />
      </div>
      <div className={styles.scaleLabels}>
        <span style={{ left: "0%" }}>8h</span>
        <span style={{ left: pos(soonMinutes) }}>{Math.round(soonMinutes / 60)}h</span>
        <span style={{ left: pos(urgentMinutes) }}>{Math.round(urgentMinutes / 60)}h</span>
        <span style={{ left: "100%" }}>0</span>
      </div>
    </div>
  );
}

/**
 * The next eight hours as one axis: a glyph at each recorded expiry, labelled with the form code
 * and family name, the second warning window dashed. Page-local; no shared chart draws a strip.
 */
/** Axis tick: the clock face, with the day named once, on the first tick of a day other than today. */
function hourTick(h: Instant, previous: Instant | undefined, now: Instant): string {
  const label = formatInstantWithDay(h, now);
  const face = label.slice(0, 5);
  const day = label.slice(5).trim();
  const previousDay = previous === undefined ? "" : formatInstantWithDay(previous, now).slice(5).trim();
  return day !== "" && day !== previousDay ? label : face;
}

function ExpiryStrip({
  rows,
  now,
  soonMinutes,
}: {
  rows: { id: string; dueAt: Instant; label: string; tone: WfTone }[];
  now: Instant;
  soonMinutes: number;
}) {
  if (rows.length === 0) return <p className={styles.absent}>Nothing expires in the next 8h</p>;
  const start = Math.ceil(now / 60) * 60 - 60;
  const end = start + CHART_WINDOW_MINUTES + 60;
  const x = (instant: Instant) => ((instant - start) / (end - start)) * 100;
  const hours: Instant[] = [];
  for (let h = start + 60; h < end; h += 60) hours.push(h);
  return (
    <figure className={styles.strip}>
      <div className={styles.stripPlot} aria-hidden="true">
        <span className={styles.stripAxis} />
        <span className={styles.stripWindow} style={{ left: `${x(now + soonMinutes)}%` }}>
          <span className={styles.stripWindowLabel}>{Math.round(soonMinutes / 60)}h</span>
        </span>
        {rows.map((row, index) => (
          <span
            key={row.id}
            className={styles.stripMark}
            style={{ left: `${x(row.dueAt)}%`, ["--lane" as string]: index % 3 }}
          >
            <span className={styles.stripLabel}>{row.label}</span>
            <span className={styles.stripStem} />
            <StatusGlyph tone={row.tone} size={9} />
          </span>
        ))}
        {hours.map((h, index) => (
          <span key={h} className={styles.stripHour} style={{ left: `${x(h)}%` }}>
            {hourTick(h, index === 0 ? undefined : hours[index - 1], now)}
          </span>
        ))}
      </div>
      <ul className={styles.srOnly} aria-label="Expiring next 8h">
        {rows.map((row) => (
          <li key={row.id}>
            {row.label} expires {formatInstantWithDay(row.dueAt, now)}
          </li>
        ))}
      </ul>
    </figure>
  );
}

function SelectedFormCard({
  movement,
  name,
  umrn,
  edName,
  now,
  nowMs,
  dayZero,
  onDossier,
  onExtend,
  onRecordNext,
}: {
  movement: Movement;
  name: string;
  umrn: string;
  edName: string;
  now: Instant;
  nowMs: number;
  dayZero: Date;
  onDossier: () => void;
  onExtend: () => void;
  onRecordNext: () => void;
}) {
  const legalForm = movement.legalForm;
  const state = windowState(movement, now);
  const breached = isLegalDeadlineBreached(movement, now);
  const reading = actPeriodReading(movement, dayZero);
  const history = asTimeline(formEvents(movement, edName).slice(0, 3), now);
  return (
    <Card aria-label="Selected form" data-testid="ward-legal-selected">
      <div className={styles.selHead}>
        <div className={styles.selName}>
          <h2 className={styles.selTitle}>{name}</h2>
          <span className={styles.meta}>
            <span className={styles.mono}>{umrn}</span> · {edName}
          </span>
        </div>
        {state && state.text !== "Later" ? <Badge tone={state.tone}>{state.text}</Badge> : null}
      </div>
      <CardBody className={styles.selBody}>
        <StatGroup>
          {legalForm?.dueAt !== undefined ? (
            <>
              <Stat
                value={
                  <Timer
                    at={legalForm.dueAt * MS_PER_MINUTE}
                    now={nowMs}
                    direction="left"
                    hideFlagWord
                    hideDirection
                    className={styles.bigTimer}
                  />
                }
                label={breached ? "Overdue" : "Left"}
              />
              <Stat value={formatInstantWithDay(legalForm.dueAt, now)} label="Expires" />
            </>
          ) : (
            <Stat
              value={
                <Timer
                  at={movement.openedAt * MS_PER_MINUTE}
                  now={nowMs}
                  direction="waiting"
                  hideDirection
                  className={styles.bigTimer}
                />
              }
              label="In ED"
            />
          )}
          {legalForm ? (
            <Stat value={legalForm.code} label={formTitleForCode(legalForm.code) ?? `Form ${legalForm.code}`} />
          ) : null}
        </StatGroup>
        {reading ? (
          <p className={styles.demoNote} data-testid="ward-legal-act-period">
            <Info size={14} aria-hidden="true" />
            <span>
              {reading.text} {actPeriodCountdownText(reading, now)}
            </span>
          </p>
        ) : null}
        <h3 className={styles.sectionHead}>Form history</h3>
        <Timeline items={history} label={`Form history for ${name}`} holdNew={false} />
        <p className={styles.ownerLine}>
          <span>
            Owner <strong>{movement.owner}</strong>
          </span>
        </p>
      </CardBody>
      <CardFoot>
        <Button variant="sec" size="sm" icon={FileText} onClick={onDossier} aria-label={`Open dossier for ${name}`}>
          Dossier
        </Button>
        {breached ? (
          <Button variant="danger" size="sm" onClick={onExtend} aria-label="Extend recorded form">
            Extend
          </Button>
        ) : (
          <Link
            href={`/mockups/ward-flow/people/${movement.id}`}
            className={buttonClass({ variant: "ghost", size: "sm" })}
          >
            Open move
          </Link>
        )}
        <span className={styles.footSpacer} />
        <Button variant="pri" size="sm" onClick={onRecordNext}>
          Record next form
        </Button>
      </CardFoot>
    </Card>
  );
}

/**
 * One row. `legalFormRowClassification` decides the tone; the row keeps the record-row hooks
 * (`data-record-key` for the movement id, `record-id` for the patient's formal name) that the
 * population tests read.
 */
function LegalFormRow({
  movement,
  now,
  selected,
  onSelect,
  onRecordTime,
  dayZero,
  patients,
  referrals,
  edName,
}: {
  movement: Movement;
  now: Instant;
  selected: boolean;
  onSelect: (movement: Movement) => void;
  onRecordTime: (movement: Movement) => void;
  dayZero: Date;
  patients?: Patient[];
  referrals?: Referral[];
  edName: string;
}) {
  const legalForm = movement.legalForm;
  if (!legalForm) {
    throw new Error(`LegalFormRow rendered for movement ${movement.id}, which carries no legal form`);
  }

  const patientInfo = resolveSubjectPatient(movement, { patients, referrals });
  const classification = legalFormRowClassification(movement, now);
  const state = windowState(movement, now);
  // Owner ruling 4 Oct 2026: the Act period beside the typed record, as a labelled synthetic demo.
  const period = periodShort(actPeriodReading(movement, dayZero));
  const title = formTitleForCode(legalForm.code) ?? `Form ${legalForm.code}`;
  const clockless = legalForm.dueAt === undefined;
  const reason = legalDeadlineText(movement, now);

  let left: ReactNode = null;
  if (legalForm.dueAt !== undefined) {
    const remaining = minutesUntil(legalForm.dueAt, now);
    left = (
      <>
        <span className={styles.leftValue}>{remaining < 0 ? `${durText(-remaining)} over` : durText(remaining)}</span>
        {state ? (
          <span className={styles.leftState}>
            <StatusGlyph tone={state.tone} size={9} />
            {state.text}
          </span>
        ) : null}
      </>
    );
  } else {
    left = <span className={styles.leftValue}>{durText(now - movement.openedAt)}</span>;
  }

  return (
    <DataRow
      as="li"
      columns={clockless ? ROW_COLUMNS_CLOCKLESS : ROW_COLUMNS}
      selected={selected}
      interactive
      className={styles.row}
      data-ward-primitive="record-row"
      data-record-key={movement.id}
      data-tone={classification.tone}
    >
      <button
        type="button"
        className={styles.rowButton}
        aria-pressed={selected}
        aria-label={`${patientInfo.formalName}, ${legalFormName(legalForm)}, ${reason}`}
        onClick={() => onSelect(movement)}
      />
      <div className={styles.cellStack}>
        <span className={styles.name} data-ward-primitive="record-id">
          {patientInfo.formalName}
        </span>
        <span className={cx(styles.sub, styles.mono)}>{patientInfo.umrn}</span>
      </div>
      <div className={styles.cellStack}>
        <span className={styles.formLine}>
          <strong>{legalForm.code}</strong> {title}
        </span>
        <span className={styles.sub}>
          {edName}
          {clockless && period ? ` · ${period}` : ""}
        </span>
      </div>
      <div className={cx(styles.cellStack, styles.end)}>
        {left}
        <span className={styles.srOnly}>{reason}</span>
      </div>
      {clockless ? (
        <div className={styles.rowAction}>
          <Button
            variant="sec"
            size="sm"
            iconOnly
            icon={Clock}
            aria-label={`Record time written for ${patientInfo.formalName}`}
            onClick={() => onRecordTime(movement)}
          />
        </div>
      ) : null}
    </DataRow>
  );
}

/** Minutes as `1h 28m`, `58m`, `2d 22h`: the v6 duration format, minute precision. */
function durText(minutes: number): string {
  const v = Math.max(0, Math.round(minutes));
  if (v < 60) return `${v}m`;
  if (v < 24 * 60) return `${Math.floor(v / 60)}h ${String(v % 60).padStart(2, "0")}m`;
  return `${Math.floor(v / (24 * 60))}d ${Math.floor((v % (24 * 60)) / 60)}h`;
}
