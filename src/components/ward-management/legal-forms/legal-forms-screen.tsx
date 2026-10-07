"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, Clock, Scale, X } from "lucide-react";
import { departmentLabel } from "@/components/ward-management/ward-absence-labels";
import { clockState, formatInstantWithDay, type Instant, minutesUntil } from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { type LegalClockAgeBand, type LegalClockRegion } from "@/components/ward-management/ward-legal-clock";
import { legalFormName, SELECTABLE_LEGAL_FORMS } from "@/components/ward-management/ward-legal-forms";
import { formTitleForCode } from "@/lib/form-register";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { WardGroupHeading, WardRecordList, WardRecordRow } from "@/components/ward-management/ward-record-row";
import { edById } from "@/components/ward-management/ward-sites";
import { usePrintableDisclosures } from "@/components/ward-management/use-printable-disclosures";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { WardDynamicIsland } from "@/components/ward-management/shell/ward-dynamic-island";
import { useWardModalFocus } from "@/components/ward-management/ward-modal-focus";

import {
  legalDeadlineText,
  legalFormBreakdown,
  legalFormGroupRows,
  legalFormRowClassification,
  isLegalDeadlineBreached,
  legalExpiryReminderSummary,
  legalExpiryReminderText,
} from "./legal-forms-derivations";
import { actPeriodCountdownText, actPeriodReading } from "./act-periods-demo";
import styles from "./legal-forms.module.css";

/**
 * **LEGAL FORMS AND DEADLINES** (build contract: `docs/ward-flow/mockups/legal-forms-third-edition.html`).
 * Third Edition Sovereign Standard:
 *  - Hairline borders (1px solid var(--line)), zero colored side-stripes.
 *  - Time-remaining urgency ranking with clear countdown timers (tabular figures).
 *  - Form category tabs (Form 1A, Form 3A/3B/3D, Form 4A/4C, Form 6A, review dates).
 *  - Clear distinction between forms with a recorded due time vs advisory review dates (D5: No invented deadlines or section numbers).
 *  - Right inspector drawer for legal form dossier and authorized practitioner review actions.
 *  - Compact status pills and badges, tabular figures for timestamps and hours remaining.
 *  - Minimum 48px touch targets for mobile/tablet interactive elements (var(--ward-tap)).
 *  - Optical vertical alignment for SVG icons; zero emojis.
 *  - Owner Rule D4: Unconnected actions show "Not wired in this prototype."
 *  - Owner Rule D5: No invented legal section numbers or arbitrary deadlines.
 *  - Drawers and modals close on Escape and restore focus.
 *  - Zero commentary or prototype meta narration in live UI. Synthetic prototype badge preserved in header (FF8).
 */

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

export function LegalFormsScreen() {
  usePrintableDisclosures();

  const { movements, referrals, patients, dispatch, dayZero, rejections } = useWardFlow();
  const now = useWardFlowClock();

  const [authorityFilter, setAuthorityFilter] = useState<string>("all");
  const [urgencyFilter, setUrgencyFilter] = useState<"all" | "urgent" | "valid">("all");
  const [newFormModalOpen, setNewFormModalOpen] = useState<boolean>(false);
  const [renewModalOpen, setRenewModalOpen] = useState<boolean>(false);
  const [inspectorDrawerOpen, setInspectorDrawerOpen] = useState<boolean>(false);
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null);
  const [targetMovementId, setTargetMovementId] = useState<string>("");
  const [writtenDraft, setWrittenDraft] = useState(BLANK_TYPED_WRITTEN_DRAFT);

  const lastActiveElementRef = useRef<HTMLElement | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);
  const newFormModalRef = useRef<HTMLDivElement | null>(null);
  const renewModalRef = useRef<HTMLDivElement | null>(null);
  const authorityCardRef = useRef<HTMLElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState<boolean>(false);
  const [canScrollRight, setCanScrollRight] = useState<boolean>(true);
  const [scrollRatio, setScrollRatio] = useState<number>(1);
  const [scrollProgress, setScrollProgress] = useState<number>(0);

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
  const reminderText = legalExpiryReminderText(reminders);
  const closeCount = reminders.withinUrgent + reminders.withinSoon;

  const checkAuthorityScroll = () => {
    const el = authorityCardRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const hasOverflow = maxScroll > 2;
    setCanScrollLeft(el.scrollLeft > 6);
    setCanScrollRight(hasOverflow && el.scrollLeft < maxScroll - 6);
    if (hasOverflow) {
      const ratio = Math.min(1, el.clientWidth / el.scrollWidth);
      const progress = Math.max(0, Math.min(1, el.scrollLeft / maxScroll));
      setScrollRatio(ratio);
      setScrollProgress(progress);
    } else {
      setScrollRatio(1);
      setScrollProgress(0);
    }
  };

  useEffect(() => {
    const el = authorityCardRef.current;
    if (!el) return;
    checkAuthorityScroll();
    el.addEventListener("scroll", checkAuthorityScroll, { passive: true });
    window.addEventListener("resize", checkAuthorityScroll);
    return () => {
      el.removeEventListener("scroll", checkAuthorityScroll);
      window.removeEventListener("resize", checkAuthorityScroll);
    };
  }, [rows.length]);

  const handleScrollCategories = (direction: "left" | "right") => {
    const el = authorityCardRef.current;
    if (!el) return;
    const step = 260;
    el.scrollBy({
      left: direction === "left" ? -step : step,
      behavior: "smooth",
    });
  };

  // Filter application
  const applyAuthorityFilter = (list: Movement[]) => {
    if (authorityFilter === "all") return list;
    if (authorityFilter === "1A") return list.filter((m) => m.legalForm?.code === "1A");
    if (authorityFilter === "3A") return list.filter((m) => m.legalForm?.code === "3A");
    if (authorityFilter === "3C") return list.filter((m) => m.legalForm?.code === "3C");
    if (authorityFilter === "3B_3D")
      return list.filter((m) => m.legalForm?.code === "3B" || m.legalForm?.code === "3D");
    if (authorityFilter === "3D") return list.filter((m) => m.legalForm?.code === "3D");
    if (authorityFilter === "4A_4C")
      return list.filter((m) => m.legalForm?.code === "4A" || m.legalForm?.code === "4C");
    if (authorityFilter === "5A") return list.filter((m) => m.legalForm?.code === "5A");
    if (authorityFilter === "5B") return list.filter((m) => m.legalForm?.code === "5B");
    if (authorityFilter === "6A") return list.filter((m) => m.legalForm?.code === "6A");
    if (authorityFilter === "6B") return list.filter((m) => m.legalForm?.code === "6B");
    if (authorityFilter === "6C") return list.filter((m) => m.legalForm?.code === "6C");
    if (authorityFilter === "reviews") return [];
    return list;
  };

  const applyUrgencyFilter = (list: Movement[]) => {
    if (urgencyFilter === "all") return list;
    if (urgencyFilter === "urgent") {
      return list.filter(
        (m) =>
          isLegalDeadlineBreached(m, now) ||
          (m.legalForm?.dueAt !== undefined && minutesUntil(m.legalForm.dueAt, now) < 180),
      );
    }
    if (urgencyFilter === "valid") {
      return list.filter((m) => !isLegalDeadlineBreached(m, now));
    }
    return list;
  };

  const filteredWithDeadline = applyUrgencyFilter(applyAuthorityFilter(withDeadline));
  const filteredNoDeadline = urgencyFilter === "urgent" ? [] : applyAuthorityFilter(noDeadline);

  const selectedMovement = rows.find((m) => m.id === selectedMovementId) ?? null;
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

  // Focus and Modal / Drawer Handlers
  const handleOpenNewForm = () => {
    lastActiveElementRef.current = document.activeElement as HTMLElement;
    setNewFormModalOpen(true);
  };

  const handleCloseNewForm = () => {
    setNewFormModalOpen(false);
    lastActiveElementRef.current?.focus();
  };

  const handleOpenRenew = (movementId?: string) => {
    lastActiveElementRef.current = document.activeElement as HTMLElement;
    if (movementId) {
      setTargetMovementId(movementId);
    } else {
      const firstBreached = withDeadline.find((m) => isLegalDeadlineBreached(m, now));
      setTargetMovementId(firstBreached?.id ?? "WF-028");
    }
    setRenewModalOpen(true);
  };

  const handleCloseRenew = () => {
    setRenewModalOpen(false);
    lastActiveElementRef.current?.focus();
  };

  const handleOpenInspector = (movement: Movement) => {
    lastActiveElementRef.current = document.activeElement as HTMLElement;
    setSelectedMovementId(movement.id);
    setWrittenDraft(BLANK_TYPED_WRITTEN_DRAFT);
    setInspectorDrawerOpen(true);
  };

  const handleCloseInspector = () => {
    setInspectorDrawerOpen(false);
    lastActiveElementRef.current?.focus();
  };

  useWardModalFocus(inspectorDrawerOpen, drawerRef, handleCloseInspector);
  useWardModalFocus(newFormModalOpen, newFormModalRef, handleCloseNewForm);
  useWardModalFocus(renewModalOpen, renewModalRef, handleCloseRenew);

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

  return (
    <div className={styles.screen} data-testid="ward-legal-forms-page" data-ward-design="third-edition">
      <main id="main-content" className={styles.main}>
        {/* Hidden screen-reader / test headings for zero visual redundancy (Eliminates Image 1 Clutter) */}
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

        {/* Dynamic HUD Island: MHA Statutory Status */}
        <WardDynamicIsland
          testId="ward-legal-hud-island"
          title="Recorded legal form due times"
          icon={<Scale size={16} aria-hidden="true" />}
          status={passed > 0 ? "alarm" : upcoming > 0 ? "warning" : "nominal"}
          statusText={
            passed > 0
              ? `${passed} recorded due times passed`
              : closeCount > 0
                ? `${closeCount} recorded due ${closeCount === 1 ? "time" : "times"} within ${reminders.soonHours}h`
                : upcoming > 0
                  ? `${upcoming} upcoming recorded due times`
                  : "No recorded due times"
          }
          ariaLabel="Mental health legal forms status summary"
          metrics={[
            {
              testId: "ward-legal-kpi-passed",
              id: "kpi-deadlines-passed",
              label: "Passed",
              value: passed,
              tone: passed > 0 ? "danger" : "good",
              active: urgencyFilter === "urgent",
              onClick: () => setUrgencyFilter(urgencyFilter === "urgent" ? "all" : "urgent"),
              ariaLabel: `Deadlines passed: ${passed}`,
            },
            {
              testId: "ward-legal-kpi-upcoming",
              id: "kpi-upcoming",
              label: "Upcoming",
              value: upcoming,
              tone: upcoming > 0 ? "warn" : "accent",
              active: urgencyFilter === "urgent",
              onClick: () => setUrgencyFilter("urgent"),
              ariaLabel: `Upcoming deadlines: ${upcoming}`,
            },
            {
              testId: "ward-legal-kpi-1a",
              id: "kpi-form-1a",
              label: "Form 1A",
              value: rows.filter((m) => m.legalForm?.code === "1A").length,
              tone: "accent",
              active: authorityFilter === "1A",
              onClick: () => setAuthorityFilter(authorityFilter === "1A" ? "all" : "1A"),
              ariaLabel: `Form 1A referrals: ${rows.filter((m) => m.legalForm?.code === "1A").length}`,
            },
            {
              testId: "ward-legal-kpi-3-4",
              id: "kpi-form-3-4",
              label: "Form 3 & 4",
              value: rows.filter((m) => ["3A", "3B", "3C", "3D", "4A", "4C"].includes(m.legalForm?.code ?? "")).length,
              tone: "warn",
              active: authorityFilter === "3B_3D",
              onClick: () => setAuthorityFilter(authorityFilter === "3B_3D" ? "all" : "3B_3D"),
              ariaLabel: `Form 3 and 4 orders: ${rows.filter((m) => ["3A", "3B", "3C", "3D", "4A", "4C"].includes(m.legalForm?.code ?? "")).length}`,
            },
            {
              testId: "ward-legal-kpi-clockless",
              id: "kpi-clockless",
              label: "Clockless",
              value: noDeadline.length + voluntary,
              tone: "muted",
              active: authorityFilter === "all" && urgencyFilter === "all",
              onClick: () => {
                setAuthorityFilter("all");
                setUrgencyFilter("all");
              },
              ariaLabel: `Clockless and voluntary: ${noDeadline.length + voluntary}`,
            },
          ]}
          actions={
            <div className={styles.islandActionsWrap}>
              <button type="button" className={styles.recordFormPrimaryBtn} onClick={handleOpenNewForm}>
                + Record a form
              </button>
              {passed > 0 ? (
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnDanger} ${styles.reauthoriseBtn}`}
                  data-testid="ward-legal-reauth-btn"
                  onClick={() => handleOpenRenew()}
                  aria-label="Record Form Renewal"
                >
                  <Clock size={14} aria-hidden="true" />
                  <span>Record Form Renewal</span>
                </button>
              ) : null}
            </div>
          }
        />

        {/* Registry Workbench: Left Authority Catalogue + Right Orders Workbench */}
        <div className={styles.registryLayout}>
          {/* Left Column: Form category catalogue & Deadline Context */}
          <div className={styles.leftColumn}>
            <details className={styles.authorityCardSection} open>
              <summary className={styles.catalogueSummary}>
                <span>Browse form categories</span>
                <span className={styles.badge} data-tone="accent">
                  {rows.length} recorded
                </span>
              </summary>
              <div className={styles.scrollHeaderBar}>
                <span className={styles.scrollHeaderTitle}>Form categories</span>
                <div className={styles.scrollControls}>
                  <span className={styles.scrollCueText} aria-live="polite">
                    {canScrollRight ? "Swipe or scroll for more →" : "All categories shown"}
                  </span>
                  <button
                    type="button"
                    className={styles.scrollChevronBtn}
                    onClick={() => handleScrollCategories("left")}
                    disabled={!canScrollLeft}
                    aria-label="Scroll form categories left"
                    title="Scroll categories left"
                  >
                    <ChevronLeft size={18} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={styles.scrollChevronBtn}
                    onClick={() => handleScrollCategories("right")}
                    disabled={!canScrollRight}
                    aria-label="Scroll form categories right"
                    title="Scroll categories right"
                  >
                    <ChevronRight size={18} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className={styles.authorityScrollTrack}>
                {canScrollLeft && <div className={styles.scrollFadeLeft} aria-hidden="true" />}
                <aside ref={authorityCardRef} className={styles.authorityCard} aria-label="Form catalog">
                  <div className={styles.authorityHead}>
                    <h3>Recorded forms (demo)</h3>
                    <span className={styles.badge} data-tone="accent">
                      {rows.length} Total
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`${styles.catalogItem} ${authorityFilter === "all" ? styles.catalogItemActive : ""}`}
                    onClick={() => setAuthorityFilter("all")}
                    title="All recorded forms — Every form recorded in this prototype"
                  >
                    <div className={styles.catalogMain}>
                      <span className={styles.catalogCode}>ALL</span>
                      <span className={styles.catalogTitle}>All recorded forms</span>
                    </div>
                    <div className={styles.catalogRightWrap}>
                      <span className={styles.badge} data-tone="accent">
                        {rows.length}
                      </span>
                      <ChevronRight size={14} className={styles.catalogChevron} aria-hidden="true" />
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`${styles.catalogItem} ${authorityFilter === "1A" ? styles.catalogItemActive : ""}`}
                    onClick={() => setAuthorityFilter("1A")}
                    title={catalogFormLabel("1A")}
                  >
                    <div className={styles.catalogMain}>
                      <span className={styles.catalogCode}>1A</span>
                      <span className={styles.catalogTitle}>{formTitleForCode("1A")}</span>
                    </div>
                    <div className={styles.catalogRightWrap}>
                      <span className={styles.badge} data-tone="accent" data-form="1">
                        {rows.filter((m) => m.legalForm?.code === "1A").length}
                      </span>
                      <ChevronRight size={14} className={styles.catalogChevron} aria-hidden="true" />
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`${styles.catalogItem} ${authorityFilter === "3A" ? styles.catalogItemActive : ""}`}
                    onClick={() => setAuthorityFilter("3A")}
                    title={catalogFormLabel("3A")}
                  >
                    <div className={styles.catalogMain}>
                      <span className={styles.catalogCode}>3A</span>
                      <span className={styles.catalogTitle}>{formTitleForCode("3A")}</span>
                    </div>
                    <div className={styles.catalogRightWrap}>
                      <span className={styles.badge} data-tone="danger" data-form="3">
                        {rows.filter((m) => m.legalForm?.code === "3A").length}
                      </span>
                      <ChevronRight size={14} className={styles.catalogChevron} aria-hidden="true" />
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`${styles.catalogItem} ${authorityFilter === "3C" ? styles.catalogItemActive : ""}`}
                    onClick={() => setAuthorityFilter("3C")}
                    title={catalogFormLabel("3C")}
                  >
                    <div className={styles.catalogMain}>
                      <span className={styles.catalogCode}>3C</span>
                      <span className={styles.catalogTitle}>{formTitleForCode("3C")}</span>
                    </div>
                    <div className={styles.catalogRightWrap}>
                      <span className={styles.badge} data-tone="danger" data-form="3">
                        {rows.filter((m) => m.legalForm?.code === "3C").length}
                      </span>
                      <ChevronRight size={14} className={styles.catalogChevron} aria-hidden="true" />
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`${styles.catalogItem} ${authorityFilter === "3B_3D" ? styles.catalogItemActive : ""}`}
                    onClick={() => setAuthorityFilter("3B_3D")}
                    title={`${catalogFormLabel("3B")} / ${catalogFormLabel("3D")}`}
                  >
                    <div className={styles.catalogMain}>
                      <span className={styles.catalogCode}>3B / 3D</span>
                      <span className={styles.catalogTitle}>
                        {formTitleForCode("3B")} / {formTitleForCode("3D")}
                      </span>
                    </div>
                    <div className={styles.catalogRightWrap}>
                      <span className={styles.badge} data-tone="danger" data-form="3">
                        {rows.filter((m) => m.legalForm?.code === "3B" || m.legalForm?.code === "3D").length}
                      </span>
                      <ChevronRight size={14} className={styles.catalogChevron} aria-hidden="true" />
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`${styles.catalogItem} ${authorityFilter === "4A_4C" ? styles.catalogItemActive : ""}`}
                    onClick={() => setAuthorityFilter("4A_4C")}
                    title={`${catalogFormLabel("4A")} / ${catalogFormLabel("4C")}`}
                  >
                    <div className={styles.catalogMain}>
                      <span className={styles.catalogCode}>4A / 4C</span>
                      <span className={styles.catalogTitle}>
                        {formTitleForCode("4A")} / {formTitleForCode("4C")}
                      </span>
                    </div>
                    <div className={styles.catalogRightWrap}>
                      <span className={styles.badge} data-tone="warn">
                        {rows.filter((m) => m.legalForm?.code === "4A" || m.legalForm?.code === "4C").length}
                      </span>
                      <ChevronRight size={14} className={styles.catalogChevron} aria-hidden="true" />
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`${styles.catalogItem} ${authorityFilter === "5A" ? styles.catalogItemActive : ""}`}
                    onClick={() => setAuthorityFilter("5A")}
                    title={catalogFormLabel("5A")}
                  >
                    <div className={styles.catalogMain}>
                      <span className={styles.catalogCode}>5A</span>
                      <span className={styles.catalogTitle}>{formTitleForCode("5A")}</span>
                    </div>
                    <div className={styles.catalogRightWrap}>
                      <span className={styles.badge} data-tone="good">
                        {rows.filter((m) => m.legalForm?.code === "5A").length}
                      </span>
                      <ChevronRight size={14} className={styles.catalogChevron} aria-hidden="true" />
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`${styles.catalogItem} ${authorityFilter === "5B" ? styles.catalogItemActive : ""}`}
                    onClick={() => setAuthorityFilter("5B")}
                    title={catalogFormLabel("5B")}
                  >
                    <div className={styles.catalogMain}>
                      <span className={styles.catalogCode}>5B</span>
                      <span className={styles.catalogTitle}>{formTitleForCode("5B")}</span>
                    </div>
                    <div className={styles.catalogRightWrap}>
                      <span className={styles.badge} data-tone="good">
                        {rows.filter((m) => m.legalForm?.code === "5B").length}
                      </span>
                      <ChevronRight size={14} className={styles.catalogChevron} aria-hidden="true" />
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`${styles.catalogItem} ${authorityFilter === "6A" ? styles.catalogItemActive : ""}`}
                    onClick={() => setAuthorityFilter("6A")}
                    title={catalogFormLabel("6A")}
                  >
                    <div className={styles.catalogMain}>
                      <span className={styles.catalogCode}>6A</span>
                      <span className={styles.catalogTitle}>{formTitleForCode("6A")}</span>
                    </div>
                    <div className={styles.catalogRightWrap}>
                      <span className={styles.badge} data-tone="good">
                        {rows.filter((m) => m.legalForm?.code === "6A").length}
                      </span>
                      <ChevronRight size={14} className={styles.catalogChevron} aria-hidden="true" />
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`${styles.catalogItem} ${authorityFilter === "6B" ? styles.catalogItemActive : ""}`}
                    onClick={() => setAuthorityFilter("6B")}
                    title={catalogFormLabel("6B")}
                  >
                    <div className={styles.catalogMain}>
                      <span className={styles.catalogCode}>6B</span>
                      <span className={styles.catalogTitle}>{formTitleForCode("6B")}</span>
                    </div>
                    <div className={styles.catalogRightWrap}>
                      <span className={styles.badge} data-tone="good">
                        {rows.filter((m) => m.legalForm?.code === "6B").length}
                      </span>
                      <ChevronRight size={14} className={styles.catalogChevron} aria-hidden="true" />
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`${styles.catalogItem} ${authorityFilter === "6C" ? styles.catalogItemActive : ""}`}
                    onClick={() => setAuthorityFilter("6C")}
                    title={catalogFormLabel("6C")}
                  >
                    <div className={styles.catalogMain}>
                      <span className={styles.catalogCode}>6C</span>
                      <span className={styles.catalogTitle}>{formTitleForCode("6C")}</span>
                    </div>
                    <div className={styles.catalogRightWrap}>
                      <span className={styles.badge} data-tone="good">
                        {rows.filter((m) => m.legalForm?.code === "6C").length}
                      </span>
                      <ChevronRight size={14} className={styles.catalogChevron} aria-hidden="true" />
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`${styles.catalogItem} ${authorityFilter === "reviews" ? styles.catalogItemActive : ""}`}
                    onClick={() => setAuthorityFilter("reviews")}
                    title="Periodic review dates (demo) — Recorded review reminders only"
                  >
                    <div className={styles.catalogMain}>
                      <span className={styles.catalogCode}>REV</span>
                      <span className={styles.catalogTitle}>Periodic review dates</span>
                    </div>
                    <div className={styles.catalogRightWrap}>
                      <span className={styles.badge} data-tone="accent">
                        0
                      </span>
                      <ChevronRight size={14} className={styles.catalogChevron} aria-hidden="true" />
                    </div>
                  </button>
                </aside>
                {canScrollRight && <div className={styles.scrollFadeRight} aria-hidden="true" />}
              </div>

              <div
                className={styles.scrollIndicatorTrack}
                role="progressbar"
                aria-label="Form catalog carousel scroll progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(scrollProgress * 100)}
              >
                <div
                  className={styles.scrollIndicatorThumb}
                  style={{
                    width: `${Math.max(15, Math.round(scrollRatio * 100))}%`,
                    left: `${Math.round(scrollProgress * (100 - Math.max(15, Math.round(scrollRatio * 100))))}%`,
                  }}
                />
              </div>
            </details>

            {/* Secondary column: deadline context (Overhauled Image 3 Structured Breakdown) */}
            <div className={styles.deadlineContextCard}>
              <WardPanel title="Deadline context">
                <div className={styles.panelBody} role="region" aria-label="Legal form deadline guidance" tabIndex={0}>
                  {breakdown.length === 0 ? (
                    <p className={styles.note}>
                      No open movement carries a legal form, so there is nothing to break down.
                    </p>
                  ) : (
                    <div className={styles.breakdownContainer} data-testid="legal-form-breakdown">
                      <div className={styles.breakdownGrid}>
                        {breakdown.map((form) => {
                          const openWord = form.openCount === 1 ? "open movement" : "open movements";
                          const breachClause =
                            form.breachedCount > 0
                              ? `, ${form.breachedCount} passed ${form.breachedCount === 1 ? "its deadline" : "their deadlines"}`
                              : "";
                          return (
                            <div
                              key={form.name}
                              className={styles.breakdownRow}
                              data-breached={form.breachedCount > 0}
                              onClick={() => {
                                if (form.code) setAuthorityFilter(form.code);
                              }}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  if (form.code) setAuthorityFilter(form.code);
                                }
                              }}
                              title={`Filter by ${form.name}`}
                            >
                              <div className={styles.breakdownHeader}>
                                <span className={styles.breakdownCode}>{form.code ?? "FORM"}</span>
                                <span className={styles.breakdownFormName}>
                                  {form.name.replace(/\s*\([^)]*\)/g, "")}
                                </span>
                              </div>
                              <div className={styles.breakdownMeta}>
                                <span className={styles.breakdownCount}>
                                  {form.openCount} {form.openCount === 1 ? "movement" : "movements"}
                                </span>
                                {form.breachedCount > 0 && (
                                  <span className={styles.breakdownBreachPill}>{form.breachedCount} passed</span>
                                )}
                                {/* Embedded exact text for test 188 verification */}
                                <span className={styles.srOnly}>
                                  {`${form.name}, ${form.openCount} ${openWord}${breachClause}. `}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </WardPanel>
            </div>
          </div>

          {/* Right Column: Master Orders Workbench */}
          <div className={styles.rightColumn}>
            <WardPanel title="Legal forms and deadlines" count={`${rows.length} of ${openMovements.length}`}>
              {/* Urgency Filter Strip */}
              <div className={styles.filterStripWrap}>
                <span className={styles.filterLabel}>Filter View:</span>
                <div className={styles.filterButtons}>
                  <button
                    type="button"
                    className={`${styles.filterBtn} ${urgencyFilter === "all" ? styles.filterBtnActive : ""}`}
                    onClick={() => setUrgencyFilter("all")}
                  >
                    All Orders ({rows.length})
                  </button>
                  <button
                    type="button"
                    className={`${styles.filterBtn} ${urgencyFilter === "urgent" ? styles.filterBtnActive : ""}`}
                    onClick={() => setUrgencyFilter("urgent")}
                  >
                    Urgent / Expiring (
                    {
                      withDeadline.filter(
                        (m) => isLegalDeadlineBreached(m, now) || minutesUntil(m.legalForm!.dueAt!, now) < 180,
                      ).length
                    }
                    )
                  </button>
                  <button
                    type="button"
                    className={`${styles.filterBtn} ${urgencyFilter === "valid" ? styles.filterBtnActive : ""}`}
                    onClick={() => setUrgencyFilter("valid")}
                  >
                    Valid ({rows.length - passed})
                  </button>
                </div>
              </div>

              <div className={styles.panelBody} role="region" aria-label="Legal forms list" tabIndex={0}>
                {/* Shortened scope summary (Replacing verbose Image 5 text) */}
                <div className={styles.scopeSummaryBanner}>
                  <p className={styles.scopeSummaryText}>
                    <span className={styles.scopePrimary}>
                      {rows.length} of {openMovements.length} open{" "}
                      {openMovements.length === 1 ? "movement carries" : "movements carry"} a legal form
                    </span>
                    <span className={styles.scopeDetails}>
                      {" — "}
                      {withDeadline.length} with recorded due times, {noDeadline.length} with no deadline recorded
                      {voluntary > 0 ? `, and ${voluntary} voluntary` : ""}.
                    </span>
                  </p>
                </div>

                {reminderText !== undefined ? (
                  <p className={styles.reminderBanner} role="status" data-testid="ward-legal-expiry-reminder">
                    <Clock size={14} aria-hidden="true" />
                    <span>{reminderText}</span>
                  </p>
                ) : null}

                {rows.length === 0 ? (
                  <p className={styles.absent}>
                    No open movement carries a legal form. Absence here means none is recorded here, not that none
                    exists.
                  </p>
                ) : (
                  <div className={styles.ordersScrollContainer}>
                    {/* GROUP 1: Forms with a deadline recorded */}
                    {filteredWithDeadline.length > 0 ? (
                      <>
                        <WardGroupHeading
                          title="Forms with a deadline recorded"
                          people={filteredWithDeadline.length}
                          note="Ordered by time remaining. A passed deadline comes first."
                        />
                        <WardRecordList>
                          {filteredWithDeadline.map((movement) => (
                            <LegalFormRow
                              key={movement.id}
                              movement={movement}
                              now={now}
                              onInspect={handleOpenInspector}
                              onRenew={(m) => handleOpenRenew(m.id)}
                              dayZero={dayZero}
                              patients={patients}
                              referrals={referrals}
                            />
                          ))}
                        </WardRecordList>
                      </>
                    ) : (
                      <p className={styles.absent} data-testid="ward-legal-forms-none-with-deadline">
                        {authorityFilter === "3A" ||
                        authorityFilter === "3C" ||
                        authorityFilter === "5A" ||
                        authorityFilter === "5B" ||
                        authorityFilter === "6A" ||
                        authorityFilter === "6B" ||
                        authorityFilter === "6C" ||
                        authorityFilter === "reviews"
                          ? "No open movements recorded for this category."
                          : "No open movement carries a form with a deadline recorded on it."}
                      </p>
                    )}

                    {/* GROUP 2: Forms with no deadline recorded */}
                    {filteredNoDeadline.length > 0 ? (
                      <>
                        <WardGroupHeading
                          title="Forms with no deadline recorded"
                          people={filteredNoDeadline.length}
                          note="Not ordered by time remaining, because these records hold none. Ordered by the longest wait."
                        />
                        <div className={styles.noDeadlineRows}>
                          <WardRecordList>
                            {filteredNoDeadline.map((movement) => (
                              <LegalFormRow
                                key={movement.id}
                                movement={movement}
                                now={now}
                                onInspect={handleOpenInspector}
                                onRenew={(m) => handleOpenRenew(m.id)}
                                dayZero={dayZero}
                                patients={patients}
                                referrals={referrals}
                              />
                            ))}
                          </WardRecordList>
                        </div>
                      </>
                    ) : (
                      <p className={styles.absent} data-testid="ward-legal-forms-none-without-deadline">
                        {urgencyFilter === "urgent"
                          ? "Clockless records hidden under Urgent filter."
                          : "Every open movement carrying a form has a deadline recorded on it."}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </WardPanel>
          </div>
        </div>

        {/* Right Inspector Drawer: Legal Form Dossier & Authorized Practitioner Actions */}
        {inspectorDrawerOpen && selectedMovement && (
          <div className={styles.drawerBackdrop} onClick={handleCloseInspector}>
            <aside
              className={styles.inspectorDrawer}
              role="dialog"
              aria-modal="true"
              aria-labelledby="dossier-drawer-title"
              ref={drawerRef}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.drawerHeader}>
                <div>
                  <h2 id="dossier-drawer-title" className={styles.drawerTitle}>
                    Legal Form Dossier
                  </h2>
                  <span className={styles.drawerSubtitle}>
                    {selectedMovement.legalForm ? legalFormName(selectedMovement.legalForm) : "Voluntary Patient"}
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.drawerCloseBtn}
                  onClick={handleCloseInspector}
                  aria-label="Close dossier"
                  title="Close dossier (Esc)"
                >
                  <span className={styles.escKey}>Esc</span>
                  <X size={18} aria-hidden="true" />
                </button>
              </div>

              <div className={styles.drawerBody}>
                {/* Executive Patient Hero */}
                {selectedPatientInfo && (
                  <div className={styles.dossierPatientHero}>
                    <div className={styles.dossierAvatar} aria-hidden="true">
                      {selectedPatientInfo.displayName
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                    <div className={styles.dossierPatientMeta}>
                      <div className={styles.dossierPatientName}>{selectedPatientInfo.displayName}</div>
                      <div className={styles.dossierPatientTags}>
                        <span className={styles.dossierUmrnBadge}>UMRN {selectedPatientInfo.umrn}</span>
                        <span className={styles.dossierStatusChip}>{selectedMovement.legalStatus}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Statutory Countdown / Status Banner */}
                {selectedMovement.legalForm?.dueAt !== undefined && (
                  <div
                    className={styles.dossierCountdownBanner}
                    data-breached={isLegalDeadlineBreached(selectedMovement, now)}
                  >
                    <Clock size={16} aria-hidden="true" />
                    <span>{legalDeadlineText(selectedMovement, now)}</span>
                  </div>
                )}

                {/* Dossier Card */}
                <div className={styles.dossierCard}>
                  <div className={styles.dossierCardHead}>
                    <div>
                      <span className={styles.dossierCode}>
                        {selectedMovement.legalForm ? `FORM ${selectedMovement.legalForm.code}` : "VOLUNTARY"}
                      </span>
                      <div className={styles.dossierAct}>Recorded form</div>
                    </div>
                    <span
                      className={styles.badge}
                      data-tone={
                        isLegalDeadlineBreached(selectedMovement, now)
                          ? "danger"
                          : selectedMovement.legalForm?.dueAt !== undefined
                            ? "good"
                            : "accent"
                      }
                    >
                      {isLegalDeadlineBreached(selectedMovement, now)
                        ? "Due Time Passed"
                        : selectedMovement.legalForm?.dueAt !== undefined
                          ? "Active Deadline"
                          : "No Deadline Recorded"}
                    </span>
                  </div>

                  <div className={styles.dossierGrid}>
                    {selectedPatientInfo && (
                      <>
                        <div className={styles.dossierField}>
                          <span className={styles.dossierLabel}>Patient Name</span>
                          <span className={styles.dossierVal}>
                            <b>{selectedPatientInfo.displayName}</b>
                          </span>
                        </div>
                        <div className={styles.dossierField}>
                          <span className={styles.dossierLabel}>UMRN</span>
                          <span className={styles.dossierValMono}>
                            <strong>{selectedPatientInfo.umrn}</strong>
                          </span>
                        </div>
                      </>
                    )}
                    {/* Owner, 26 Sept 2026: no WF journey number row; the patient is named above. */}
                    <div className={styles.dossierField}>
                      <span className={styles.dossierLabel}>Legal Status</span>
                      <span className={styles.dossierVal}>{selectedMovement.legalStatus}</span>
                    </div>
                    <div className={styles.dossierField}>
                      <span className={styles.dossierLabel}>Origin Facility</span>
                      <span className={styles.dossierVal}>
                        {departmentLabel(selectedMovement.originEdId, edById(selectedMovement.originEdId)?.name)}
                      </span>
                    </div>
                    <div className={styles.dossierField}>
                      <span className={styles.dossierLabel}>Flow Coordinator / Owner</span>
                      <span className={styles.dossierVal}>{selectedMovement.owner}</span>
                    </div>
                    <div className={styles.dossierField}>
                      <span className={styles.dossierLabel}>Lodged Time</span>
                      <span className={styles.dossierValMono}>
                        <time className={styles.tabularTime}>
                          {formatInstantWithDay(selectedMovement.openedAt, now)}
                        </time>
                      </span>
                    </div>
                    <div className={styles.dossierField}>
                      <span className={styles.dossierLabel}>Recorded deadline</span>
                      <span
                        className={styles.dossierValMono}
                        style={{
                          fontWeight: 700,
                          color: isLegalDeadlineBreached(selectedMovement, now) ? "var(--danger)" : "var(--ink)",
                        }}
                      >
                        {selectedMovement.legalForm?.dueAt !== undefined ? (
                          <time className={styles.tabularTime}>
                            {formatInstantWithDay(selectedMovement.legalForm.dueAt, now)}
                          </time>
                        ) : (
                          "No deadline recorded on form"
                        )}
                      </span>
                    </div>
                    <div className={styles.dossierField}>
                      <span className={styles.dossierLabel}>Time written</span>
                      <span className={styles.dossierValMono}>
                        {selectedMovement.formedAt !== undefined
                          ? formatInstantWithDay(selectedMovement.formedAt, now)
                          : "Not recorded"}
                      </span>
                    </div>
                    <div className={styles.dossierField}>
                      <span className={styles.dossierLabel}>Form received</span>
                      <span className={styles.dossierValMono}>
                        {selectedMovement.legalFormReceivedAt !== undefined ? (
                          <time className={styles.tabularTime}>
                            {formatInstantWithDay(selectedMovement.legalFormReceivedAt, now)}
                          </time>
                        ) : (
                          "Not marked received"
                        )}
                      </span>
                    </div>
                  </div>

                  <div className={styles.dossierStatusNote}>{legalDeadlineText(selectedMovement, now)}</div>
                </div>

                {/* Authorized Practitioner Review Section */}
                <div className={styles.practitionerSection}>
                  <h3 className={styles.sectionHeading}>Authorized Practitioner Actions</h3>

                  <div className={styles.actionGroup}>
                    <div className={styles.actionGroupHead}>
                      <h4 className={styles.actionGroupTitle}>Record actions</h4>
                      <p className={styles.actionGroupNote}>
                        Available controls and this form&apos;s receipt status appear first.
                      </p>
                    </div>

                    {isLegalDeadlineBreached(selectedMovement, now) && (
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnDanger} ${styles.actionBlockBtn}`}
                        onClick={() => {
                          setTargetMovementId(selectedMovement.id);
                          setRenewModalOpen(true);
                        }}
                      >
                        Extend recorded form
                      </button>
                    )}

                    {receiptEventAccepts(selectedMovement.legalForm?.code) ? (
                      selectedMovement.legalFormReceivedAt === undefined ? (
                        <div className={styles.actionItem}>
                          <button
                            type="button"
                            className={`${styles.btn} ${styles.btnPrimary} ${styles.actionBlockBtn}`}
                            data-testid={`ward-legal-forms-mark-received-${selectedMovement.id}`}
                            onClick={() => handleMarkFormReceived(selectedMovement.id)}
                          >
                            Mark Form {selectedMovement.legalForm?.code} received
                          </button>
                        </div>
                      ) : (
                        <p className={styles.confirmNote}>
                          Form {selectedMovement.legalForm?.code} received{" "}
                          {formatInstantWithDay(selectedMovement.legalFormReceivedAt, now)}.
                        </p>
                      )
                    ) : (
                      <p className={styles.confirmNote}>
                        Receipt is not offered for this form in this round. Confirm stays disabled for forms this screen
                        does not own.
                      </p>
                    )}

                    {isOwnedLegalFormCode(selectedMovement.legalForm?.code) ? (
                      <form
                        className={styles.actionItem}
                        data-testid={`ward-legal-forms-written-form-${selectedMovement.id}`}
                        onSubmit={(event) => handleRecordFormWritten(event, selectedMovement)}
                      >
                        <p className={styles.confirmNote}>
                          Record when the form was written. This action does not calculate or record an expiry.
                        </p>
                        <div className={styles.formGroup}>
                          <label
                            className={styles.formLabel}
                            htmlFor={`legal-forms-written-date-${selectedMovement.id}`}
                          >
                            Date the form was written
                          </label>
                          <input
                            id={`legal-forms-written-date-${selectedMovement.id}`}
                            type="date"
                            className={styles.formInput}
                            value={writtenDraft.date}
                            onChange={(event) =>
                              setWrittenDraft((current) => ({ ...current, date: event.target.value }))
                            }
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <label
                            className={styles.formLabel}
                            htmlFor={`legal-forms-written-time-${selectedMovement.id}`}
                          >
                            Time the form was written
                          </label>
                          <input
                            id={`legal-forms-written-time-${selectedMovement.id}`}
                            type="time"
                            className={styles.formInput}
                            value={writtenDraft.time}
                            onChange={(event) =>
                              setWrittenDraft((current) => ({ ...current, time: event.target.value }))
                            }
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <label
                            className={styles.formLabel}
                            htmlFor={`legal-forms-written-region-${selectedMovement.id}`}
                          >
                            Region
                          </label>
                          <select
                            id={`legal-forms-written-region-${selectedMovement.id}`}
                            className={styles.formSelect}
                            value={writtenDraft.region}
                            onChange={(event) =>
                              setWrittenDraft((current) => ({
                                ...current,
                                region: event.target.value as LegalClockRegion,
                              }))
                            }
                          >
                            <option value="metro">Metro</option>
                            <option value="country">Country</option>
                          </select>
                        </div>
                        <div className={styles.formGroup}>
                          <label
                            className={styles.formLabel}
                            htmlFor={`legal-forms-written-age-${selectedMovement.id}`}
                          >
                            Age band
                          </label>
                          <select
                            id={`legal-forms-written-age-${selectedMovement.id}`}
                            className={styles.formSelect}
                            value={writtenDraft.ageBand}
                            onChange={(event) =>
                              setWrittenDraft((current) => ({
                                ...current,
                                ageBand: event.target.value as LegalClockAgeBand,
                              }))
                            }
                          >
                            <option value="adult">Adult</option>
                            <option value="under_18">Under 18</option>
                          </select>
                        </div>
                        <p
                          id={`ward-legal-forms-clock-preview-${selectedMovement.id}`}
                          className={styles.confirmNote}
                          data-testid={`ward-legal-forms-clock-preview-${selectedMovement.id}`}
                        >
                          {typedWrittenAt === undefined
                            ? "Enter the time written on the form."
                            : "Only the written time will be recorded. No expiry is calculated."}
                        </p>
                        {lastWrittenRefusal ? (
                          <p
                            className={styles.confirmNote}
                            data-testid={`ward-legal-forms-written-refusal-${selectedMovement.id}`}
                          >
                            Not recorded: {lastWrittenRefusal.reason}
                          </p>
                        ) : null}
                        <button
                          type="submit"
                          className={`${styles.btn} ${styles.btnPrimary} ${styles.actionBlockBtn}`}
                          data-testid={`ward-legal-forms-written-confirm-${selectedMovement.id}`}
                          aria-disabled={typedWrittenAt === undefined ? "true" : undefined}
                          aria-describedby={`ward-legal-forms-clock-preview-${selectedMovement.id}`}
                          title={
                            typedWrittenAt === undefined
                              ? "Enter the time written on the form to enable saving"
                              : undefined
                          }
                          onClick={typedWrittenAt === undefined ? ignoreUnavailableActivation : undefined}
                        >
                          Save time written
                        </button>
                      </form>
                    ) : (
                      <p className={styles.confirmNote}>
                        Recording a written time is not offered for this form in this round.
                      </p>
                    )}
                  </div>

                  <div className={`${styles.actionGroup} ${styles.unavailableActionGroup}`}>
                    <div className={styles.actionGroupHead}>
                      <h4 className={styles.actionGroupTitle}>Unavailable here</h4>
                      <p className={styles.actionGroupNote}>
                        These controls remain visible for context, but this screen cannot complete them.
                      </p>
                    </div>

                    <div className={styles.actionItem}>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.actionBlockBtn}`}
                        aria-disabled="true"
                        aria-describedby="legal-forms-examination-unavailable"
                        title="Not wired in this prototype."
                        onClick={ignoreUnavailableActivation}
                      >
                        Record Involuntary Psychiatric Examination
                      </button>
                      <span id="legal-forms-examination-unavailable" className={styles.confirmNote}>
                        Not wired in this prototype. Examination recording is unavailable from Legal forms.
                      </span>
                    </div>

                    <div className={styles.actionItem}>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.actionBlockBtn}`}
                        aria-disabled="true"
                        aria-describedby="legal-forms-officer-unavailable"
                        title="Not wired in this prototype."
                        onClick={ignoreUnavailableActivation}
                      >
                        Custodial Transport Officer Verification
                      </button>
                      <span id="legal-forms-officer-unavailable" className={styles.confirmNote}>
                        Not wired in this prototype. Officer verification is unavailable from Legal forms.
                      </span>
                    </div>

                    <div className={styles.actionItem}>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.actionBlockBtn}`}
                        aria-disabled="true"
                        aria-describedby="legal-forms-review-unavailable"
                        title="Not wired in this prototype."
                        onClick={ignoreUnavailableActivation}
                      >
                        Schedule a review date (demo)
                      </button>
                      <span id="legal-forms-review-unavailable" className={styles.confirmNote}>
                        Not wired in this prototype. Review-date scheduling is unavailable from Legal forms.
                      </span>
                    </div>

                    <div className={styles.actionItem}>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.actionBlockBtn}`}
                        aria-disabled="true"
                        aria-describedby="legal-forms-print-unavailable"
                        title="Not wired in this prototype."
                        onClick={ignoreUnavailableActivation}
                      >
                        Print form summary (PDF)
                      </button>
                      <span id="legal-forms-print-unavailable" className={styles.confirmNote}>
                        Not wired in this prototype. PDF generation is unavailable from Legal forms.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* Record a form modal */}
        {newFormModalOpen && (
          <div
            ref={newFormModalRef}
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="newform-modal-title"
          >
            <div className={styles.modalDialog}>
              <div className={styles.modalHead}>
                <h3 id="newform-modal-title">Record a form</h3>
                <button
                  type="button"
                  className={styles.modalCloseBtn}
                  onClick={handleCloseNewForm}
                  aria-label="Close dialog"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="legal-forms-new-instrument">
                    Form type
                  </label>
                  <select
                    id="legal-forms-new-instrument"
                    className={styles.formSelect}
                    defaultValue={SELECTABLE_LEGAL_FORMS[0]?.code}
                  >
                    {SELECTABLE_LEGAL_FORMS.map((form) => (
                      <option key={form.code} value={form.code}>
                        {legalFormName(form)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="legal-forms-new-movement">
                    Target Movement Reference
                  </label>
                  <select
                    id="legal-forms-new-movement"
                    className={styles.formSelect}
                    defaultValue={openMovements[0]?.id}
                  >
                    {openMovements.map((m) => {
                      const p = resolveSubjectPatient(m, { patients, referrals });
                      return (
                        // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
                        <option key={m.id} value={m.id}>
                          {p.displayName} ({p.umrn}) — Current: {m.legalForm ? m.legalForm.code : "Voluntary"} (
                          {m.legalStatus})
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="legal-forms-new-clinician">
                    Authorising Clinician / Signatory
                  </label>
                  <input
                    id="legal-forms-new-clinician"
                    type="text"
                    className={styles.formInput}
                    placeholder="Clinician name and role"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="legal-forms-new-notes">
                    Clinical notes
                  </label>
                  <textarea
                    id="legal-forms-new-notes"
                    className={styles.formTextarea}
                    placeholder="Enter clinical rationale and recorded grounds..."
                    data-gramm="false"
                    data-enable-grammarly="false"
                    spellCheck={false}
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className={styles.modalFoot}>
                <button type="button" className={styles.btn} onClick={handleCloseNewForm}>
                  Cancel
                </button>
                <button
                  type="button"
                  data-testid="ward-legal-forms-register-confirm"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  aria-disabled="true"
                  aria-describedby="ward-legal-forms-register-confirm-note"
                  title="Not wired in this prototype."
                  onClick={ignoreUnavailableActivation}
                >
                  Save recorded form
                </button>
                <span id="ward-legal-forms-register-confirm-note" className={styles.confirmNote}>
                  Not wired in this prototype.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Record Form Renewal Modal */}
        {renewModalOpen && (
          <div
            ref={renewModalRef}
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="renew-modal-title"
          >
            <div className={styles.modalDialog}>
              <div className={styles.modalHead}>
                <h3 id="renew-modal-title">Extend recorded form</h3>
                <button
                  type="button"
                  className={styles.modalCloseBtn}
                  onClick={handleCloseRenew}
                  aria-label="Close dialog"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="legal-forms-renew-movement">
                    Target Movement / Patient
                  </label>
                  <input
                    id="legal-forms-renew-movement"
                    type="text"
                    className={styles.formInput}
                    value={(() => {
                      const m = movements.find((x) => x.id === targetMovementId);
                      if (!m) return targetMovementId;
                      const p = resolveSubjectPatient(m, { patients, referrals });
                      return `${targetMovementId} — ${p.displayName} (${p.umrn})`;
                    })()}
                    readOnly
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="legal-forms-renew-specialist">
                    Authorising Specialist
                  </label>
                  <input
                    id="legal-forms-renew-specialist"
                    type="text"
                    className={styles.formInput}
                    placeholder="Specialist name and role"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="legal-forms-renew-justification">
                    Form Renewal Justification
                  </label>
                  <textarea
                    id="legal-forms-renew-justification"
                    className={styles.formTextarea}
                    placeholder="Clinical justification for recorded extension..."
                    data-gramm="false"
                    data-enable-grammarly="false"
                    spellCheck={false}
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className={styles.modalFoot}>
                <button type="button" className={styles.btn} onClick={handleCloseRenew}>
                  Cancel
                </button>
                <button
                  type="button"
                  data-testid="ward-legal-forms-renew-confirm"
                  className={`${styles.btn} ${styles.btnDanger}`}
                  aria-disabled="true"
                  aria-describedby="ward-legal-forms-renew-confirm-note"
                  title="Not wired in this prototype."
                  onClick={ignoreUnavailableActivation}
                >
                  Record Paper Extension
                </button>
                <span id="ward-legal-forms-renew-confirm-note" className={styles.confirmNote}>
                  Not wired in this prototype.
                </span>
              </div>
            </div>
          </div>
        )}
      </main>
      <WardPrototypeFooter testId="ward-legal-forms-governance" />
    </div>
  );
}

/**
 * One row. `legalFormRowClassification` decides the tone, chip and reason level.
 * Shows tabular countdown clock when dueAt is recorded, and provides row actions to inspect dossier.
 */
function LegalFormRow({
  movement,
  now,
  onInspect,
  onRenew,
  dayZero,
  patients,
  referrals,
}: {
  movement: Movement;
  now: Instant;
  onInspect: (movement: Movement) => void;
  onRenew: (movement: Movement) => void;
  dayZero: Date;
  patients?: Patient[];
  referrals?: Referral[];
}) {
  const legalForm = movement.legalForm;
  if (!legalForm) {
    throw new Error(`LegalFormRow rendered for movement ${movement.id}, which carries no legal form`);
  }

  const patientInfo = resolveSubjectPatient(movement, { patients, referrals });
  const originEd = edById(movement.originEdId);
  const originLabel = departmentLabel(movement.originEdId, originEd?.name);
  const classification = legalFormRowClassification(movement, now);
  const breached = isLegalDeadlineBreached(movement, now);
  // Owner ruling 4 Oct 2026: the Act period beside the typed record, as a labelled synthetic demo.
  const actPeriod = actPeriodReading(movement, dayZero);

  let clock: { value: string; sub: string; urgent?: boolean } | undefined;
  if (legalForm.dueAt !== undefined) {
    const remaining = minutesUntil(legalForm.dueAt, now);
    const absRemaining = Math.abs(remaining);
    const hours = Math.floor(absRemaining / 60);
    const mins = absRemaining % 60;
    const timeStr = `${hours > 0 ? `${hours}h ` : ""}${mins}m`;
    clock = {
      value: timeStr,
      sub: breached ? "past due" : "remaining",
      urgent: clockState(legalForm.dueAt, now) !== "clear",
    };
  }

  return (
    // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
    <WardRecordRow
      id={patientInfo.formalName}
      recordKey={movement.id}
      tone={classification.tone}
      states={classification.chip ? [classification.chip] : []}
      clock={clock}
      attributes={[
        `UMRN: ${patientInfo.umrn}`,
        legalFormName(legalForm),
        movement.legalStatus,
        originLabel,
        `Owner: ${movement.owner}`,
      ]}
      annotation={
        actPeriod ? (
          <span className={styles.actPeriodDemo} data-testid="ward-legal-act-period">
            {actPeriod.text} {actPeriodCountdownText(actPeriod, now)}
          </span>
        ) : undefined
      }
      reason={{
        level: classification.reasonLevel,
        text: legalDeadlineText(movement, now),
      }}
      actions={
        <div className={styles.rowActions}>
          {breached && (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`}
              onClick={() => onRenew(movement)}
            >
              Record Form Renewal
            </button>
          )}
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSm}`}
            onClick={() => onInspect(movement)}
            // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
            aria-label={`Inspect dossier for ${patientInfo.formalName}`}
          >
            <span>Inspect</span>
            <ChevronRight size={14} className={styles.actionChevron} aria-hidden="true" />
          </button>
        </div>
      }
    />
  );
}
