"use client";

import React, { useCallback, useId, useMemo, useState } from "react";
import { AlertTriangle, Clock } from "lucide-react";

import { useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { LEGAL_LIMITS_NOT_CHECKED_NOTICE } from "@/components/ward-management/ward-legal-clock";
import { formTitleForCode } from "@/lib/form-register";
import styles from "./ward-mha-calculator.module.css";

export type MhaFormType = "1A" | "3A" | "4B";

/**
 * "Form 3A (Detention order)". The title is read from the Chief Psychiatrist register, never typed
 * here (tests/ward-form-labels-from-register.test.ts); a code the register lacks shows bare.
 */
export function officialFormLabel(code: MhaFormType): string {
  const title = formTitleForCode(code);
  return title === null ? `Form ${code}` : `Form ${code} (${title})`;
}

export interface SafeguardAlertResult {
  isAfterHours: boolean;
  isWeekend: boolean;
  alertRequired: boolean;
  message: string | null;
}

export interface FormDisplayRecord {
  form: MhaFormType;
  officialTitle: string;
  enteredDate: Date | null;
  expiryNotice: string;
  isAfterHours: boolean;
  isWeekend: boolean;
  safeguardAlert: boolean;
  safeguardMessage: string | null;
}

const perthDateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Australia/Perth",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  weekday: "short",
});

function perthParts(date: Date): Record<string, string> {
  return Object.fromEntries(perthDateTime.formatToParts(date).map(({ type, value }) => [type, value]));
}

/**
 * Checks if a moment falls outside standard business hours (17:00 to 08:00).
 * In WA hospital practice, normal day cover is 08:00 to 16:59:59.
 */
export function isAfterHours(date: Date): boolean {
  if (Number.isNaN(date.getTime())) return false;
  const hours = Number(perthParts(date).hour);
  return hours >= 17 || hours < 8;
}

/**
 * Checks if a date falls on a weekend (Saturday or Sunday).
 */
export function isWeekend(date: Date): boolean {
  if (Number.isNaN(date.getTime())) return false;
  return ["Sat", "Sun"].includes(perthParts(date).weekday);
}

/**
 * Evaluates whether On-Call Consultant Psychiatrist cover must be arranged.
 * Triggered if the entered date/time falls on a weekend or after-hours.
 */
export function checkSafeguardAlert(date: Date | null): SafeguardAlertResult {
  if (!date || Number.isNaN(date.getTime())) {
    return {
      isAfterHours: false,
      isWeekend: false,
      alertRequired: false,
      message: null,
    };
  }

  const afterHours = isAfterHours(date);
  const weekend = isWeekend(date);
  const alertRequired = afterHours || weekend;
  let message: string | null = null;

  if (alertRequired) {
    if (afterHours && weekend) {
      message =
        "Time written on form falls on a weekend and after-hours (17:00–08:00). On-Call Consultant Psychiatrist cover must be arranged.";
    } else if (weekend) {
      message = "Time written on form falls on a weekend. On-Call Consultant Psychiatrist cover must be arranged.";
    } else {
      message =
        "Time written on form falls after-hours (17:00–08:00). On-Call Consultant Psychiatrist cover must be arranged.";
    }
  }

  return {
    isAfterHours: afterHours,
    isWeekend: weekend,
    alertRequired,
    message,
  };
}

/**
 * Formats a Date into standard en-AU date & time: "Fri, 25 Sep 2026, 17:00" in AWST (Australia/Perth).
 */
export function formatStatutoryDateTime(d: Date): string {
  if (Number.isNaN(d.getTime())) return "Not recorded";
  const dayStr = d.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Perth",
  });
  const timeStr = d.toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Australia/Perth",
  });
  return `${dayStr}, ${timeStr}`;
}

export function toDateInputValue(d: Date): string {
  if (Number.isNaN(d.getTime())) return "";
  const { year, month, day } = perthParts(d);
  return `${year}-${month}-${day}`;
}

export function toTimeInputValue(d: Date): string {
  if (Number.isNaN(d.getTime())) return "";
  const { hour, minute } = perthParts(d);
  return `${hour}:${minute}`;
}

export function parseDateTimeInput(dateStr: string, timeStr: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || (timeStr && !/^\d{2}:\d{2}$/.test(timeStr))) return null;
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = (timeStr || "00:00").split(":").map(Number);
  if (year < 100 || month < 1 || month > 12 || day < 1 || day > 31 || hours > 23 || minutes > 59) return null;
  // Perth observes UTC+08:00 throughout the year. Interpret the typed wall time there.
  const parsed = new Date(Date.UTC(year, month - 1, day, hours - 8, minutes));
  return toDateInputValue(parsed) === dateStr && toTimeInputValue(parsed) === (timeStr || "00:00") ? parsed : null;
}

/**
 * Produces the human-typed expiry statement marked "Not legally checked".
 */
export function formatEnteredExpiryNotice(date: Date | null): string {
  if (!date || Number.isNaN(date.getTime())) {
    return "Not recorded";
  }
  return `Expiry written on form: ${formatStatutoryDateTime(date)}`;
}

export function getForm1ARecord(enteredDate: Date | null): FormDisplayRecord {
  const safeguard = checkSafeguardAlert(enteredDate);
  return {
    form: "1A",
    officialTitle: officialFormLabel("1A"),
    enteredDate,
    expiryNotice: formatEnteredExpiryNotice(enteredDate),
    isAfterHours: safeguard.isAfterHours,
    isWeekend: safeguard.isWeekend,
    safeguardAlert: safeguard.alertRequired,
    safeguardMessage: safeguard.message,
  };
}

export function getForm3ARecord(enteredDate: Date | null): FormDisplayRecord {
  const safeguard = checkSafeguardAlert(enteredDate);
  return {
    form: "3A",
    officialTitle: officialFormLabel("3A"),
    enteredDate,
    expiryNotice: formatEnteredExpiryNotice(enteredDate),
    isAfterHours: safeguard.isAfterHours,
    isWeekend: safeguard.isWeekend,
    safeguardAlert: safeguard.alertRequired,
    safeguardMessage: safeguard.message,
  };
}

export function getForm4BRecord(enteredDate: Date | null): FormDisplayRecord {
  const safeguard = checkSafeguardAlert(enteredDate);
  return {
    form: "4B",
    officialTitle: officialFormLabel("4B"),
    enteredDate,
    expiryNotice: formatEnteredExpiryNotice(enteredDate),
    isAfterHours: safeguard.isAfterHours,
    isWeekend: safeguard.isWeekend,
    safeguardAlert: safeguard.alertRequired,
    safeguardMessage: safeguard.message,
  };
}

// Backward-compatible named exports for callers/tests that do not compute legal statuses
export const calculateForm1A = getForm1ARecord;
export const calculateForm3A = getForm3ARecord;
export const calculateForm4B = getForm4BRecord;

/**
 * Safely resolves the current reference clock moment.
 * Reads `useWardFlowClock()` at top level when mounted inside `WardFlowProvider`,
 * or falls back to standard wall clock when mounted in tests or standalone.
 */
function useResolvedClock(override?: Date): Date {
  const demoInstant = useWardFlowClock(-1);

  return useMemo(() => {
    if (override) return override;
    if (demoInstant !== -1) {
      const today = new Date();
      const dayZero = parseDateTimeInput(toDateInputValue(today), "00:00") ?? today;
      return new Date(dayZero.getTime() + demoInstant * 60_000);
    }
    return new Date();
  }, [override, demoInstant]);
}

export interface WardMhaCalculatorProps {
  initialForm?: MhaFormType;
  initialStartDate?: Date;
  referenceNow?: Date;
  now?: Date;
  className?: string;
}

export function WardMhaCalculator({
  initialForm = "1A",
  initialStartDate,
  referenceNow,
  now: propNow,
  className,
}: WardMhaCalculatorProps) {
  const effectiveNow = propNow ?? referenceNow;
  const now = useResolvedClock(effectiveNow);
  const defaultDate = initialStartDate ?? now;

  const [selectedForm, setSelectedForm] = useState<MhaFormType>(initialForm);
  const [inputDate, setInputDate] = useState<string>(() => toDateInputValue(defaultDate));
  const [inputTime, setInputTime] = useState<string>(() => toTimeInputValue(defaultDate));

  const dateInputId = useId();
  const timeInputId = useId();

  const enteredDate = useMemo(() => parseDateTimeInput(inputDate, inputTime), [inputDate, inputTime]);

  const form1AData = useMemo(() => getForm1ARecord(enteredDate), [enteredDate]);
  const form3AData = useMemo(() => getForm3ARecord(enteredDate), [enteredDate]);
  const form4BData = useMemo(() => getForm4BRecord(enteredDate), [enteredDate]);

  const handleSetToNow = useCallback(() => {
    setInputDate(toDateInputValue(now));
    setInputTime(toTimeInputValue(now));
  }, [now]);

  const handleAdjustHours = useCallback(
    (offsetHours: number) => {
      const base = enteredDate ?? now;
      const next = new Date(base.getTime() + offsetHours * 60 * 60 * 1000);
      setInputDate(toDateInputValue(next));
      setInputTime(toTimeInputValue(next));
    },
    [enteredDate, now],
  );

  const handlePreset = useCallback(
    (preset: "today-0900" | "yesterday-1800" | "offset-48h" | "offset-70h" | "offset-20d") => {
      const target = new Date(now.getTime());
      if (preset === "today-0900") {
        target.setTime(parseDateTimeInput(toDateInputValue(now), "09:00")?.getTime() ?? now.getTime());
      } else if (preset === "yesterday-1800") {
        target.setTime(
          parseDateTimeInput(toDateInputValue(new Date(now.getTime() - 86_400_000)), "18:00")?.getTime() ??
            now.getTime(),
        );
      } else if (preset === "offset-48h") {
        target.setTime(target.getTime() - 48 * 60 * 60 * 1000);
      } else if (preset === "offset-70h") {
        target.setTime(target.getTime() - 70 * 60 * 60 * 1000);
      } else if (preset === "offset-20d") {
        target.setTime(target.getTime() - 20 * 24 * 60 * 60 * 1000);
      }
      setInputDate(toDateInputValue(target));
      setInputTime(toTimeInputValue(target));
    },
    [now],
  );

  return (
    <section
      className={`${styles.calculatorRoot} ${className ?? ""}`.trim()}
      aria-label="Mental Health Act Form Record"
    >
      <header className={styles.headerBlock}>
        <div className={styles.titleArea}>
          <h3 className={styles.title}>MHA Deadline Calculator</h3>
          <p className={styles.subtitle}>WA mental health forms · entered dates only</p>
          <p className={styles.subtitle} role="note" data-testid="legal-limits-not-checked">
            {LEGAL_LIMITS_NOT_CHECKED_NOTICE}
          </p>
        </div>
      </header>

      {/* Mode Selector Tabs with Official Titles Only */}
      <div role="tablist" aria-label="Statutory form selection" className={styles.modeTabs}>
        <button
          type="button"
          role="tab"
          id="tab-1A"
          aria-controls="panel-1A"
          aria-selected={selectedForm === "1A"}
          className={`${styles.tabButton} ${selectedForm === "1A" ? styles.tabButtonActive : ""}`}
          onClick={() => setSelectedForm("1A")}
        >
          <span className={styles.tabCode}>Form 1A</span>
          <span className={styles.tabDuration}>Referral for examination by a psychiatrist</span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-3A"
          aria-controls="panel-3A"
          aria-selected={selectedForm === "3A"}
          className={`${styles.tabButton} ${selectedForm === "3A" ? styles.tabButtonActive : ""}`}
          onClick={() => setSelectedForm("3A")}
        >
          <span className={styles.tabCode}>Form 3A</span>
          <span className={styles.tabDuration}>Detention order</span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-4B"
          aria-controls="panel-4B"
          aria-selected={selectedForm === "4B"}
          className={`${styles.tabButton} ${selectedForm === "4B" ? styles.tabButtonActive : ""}`}
          onClick={() => setSelectedForm("4B")}
        >
          <span className={styles.tabCode}>Form 4B</span>
          <span className={styles.tabDuration}>Extension of transport order</span>
        </button>
      </div>

      {/* Date & Time Input Section */}
      <div className={styles.inputSection}>
        <div className={styles.inputGroup}>
          <label htmlFor={dateInputId} className={styles.inputLabel}>
            Expiry Date and Time Written on Form
          </label>
          <div className={styles.dateTimeRow}>
            <input
              id={dateInputId}
              type="date"
              className={styles.dateInput}
              value={inputDate}
              onChange={(e) => setInputDate(e.target.value)}
              aria-label="Order expiry date written on form"
            />
            <input
              id={timeInputId}
              type="time"
              className={styles.timeInput}
              value={inputTime}
              onChange={(e) => setInputTime(e.target.value)}
              aria-label="Order expiry time written on form"
            />
          </div>
        </div>

        {/* Quick Adjustment Buttons */}
        <div className={styles.quickActionsRow}>
          <button
            type="button"
            className={`${styles.quickBtn} ${styles.quickBtnAccent}`}
            onClick={handleSetToNow}
            title="Set to current demo clock"
          >
            <Clock size={16} aria-hidden="true" />
            <span>Set to Now</span>
          </button>
          <button
            type="button"
            className={styles.quickBtn}
            onClick={() => handleAdjustHours(-1)}
            title="Subtract 1 hour"
          >
            -1h
          </button>
          <button type="button" className={styles.quickBtn} onClick={() => handleAdjustHours(1)} title="Add 1 hour">
            +1h
          </button>
        </div>

        {/* Fast Presets */}
        <div className={styles.presetsRow} aria-label="Fast presets">
          <button type="button" className={styles.presetChip} onClick={() => handlePreset("today-0900")}>
            Today 09:00
          </button>
          <button type="button" className={styles.presetChip} onClick={() => handlePreset("yesterday-1800")}>
            Yesterday 18:00
          </button>
          {selectedForm === "1A" && (
            <>
              <button type="button" className={styles.presetChip} onClick={() => handlePreset("offset-48h")}>
                48h reference
              </button>
              <button type="button" className={styles.presetChip} onClick={() => handlePreset("offset-70h")}>
                70h reference
              </button>
            </>
          )}
          {selectedForm === "3A" && (
            <button type="button" className={styles.presetChip} onClick={() => handlePreset("offset-20d")}>
              20d reference
            </button>
          )}
        </div>
      </div>

      {/* Display Panels */}
      <div className={styles.resultsContainer}>
        {selectedForm === "1A" && (
          <div role="tabpanel" id="panel-1A" aria-labelledby="tab-1A">
            {/* Status Banner */}
            <div className={`${styles.statusBanner} ${styles.statusActive}`} data-testid="status-banner-1a">
              <div className={styles.statusBannerHeader}>
                <span className={styles.statusLabel}>Form 1A Record</span>
                <span className={styles.statusCountdown}>Not legally checked</span>
              </div>
              <p className={styles.statusDescription}>
                {form1AData.enteredDate ? (
                  <>
                    <span>{form1AData.expiryNotice}</span>
                    {" — "}
                    <strong>Not legally checked</strong>
                  </>
                ) : (
                  "Not recorded"
                )}
              </p>
            </div>

            {/* Safeguard Alert for Weekend / After-Hours */}
            {form1AData.safeguardAlert && (
              <div className={styles.safeguardBanner} data-testid="safeguard-alert-1a">
                <div className={styles.safeguardHeader}>
                  <AlertTriangle size={18} aria-hidden="true" />
                  <span>After-Hours / Weekend Safeguard Alert</span>
                </div>
                <p style={{ margin: 0 }}>{form1AData.safeguardMessage ?? "Not recorded"}</p>
              </div>
            )}

            {/* Key Metrics Grid */}
            <div className={styles.metricsGrid} style={{ marginTop: "0.75rem" }}>
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>Expiry written on form</span>
                <span className={styles.metricValue}>
                  {form1AData.enteredDate ? formatStatutoryDateTime(form1AData.enteredDate) : "Not recorded"}
                </span>
                <span className={styles.metricSub}>
                  {form1AData.enteredDate ? "Not legally checked" : "Not recorded"}
                </span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>Cover schedule</span>
                <span className={styles.metricValue}>
                  {form1AData.enteredDate
                    ? form1AData.isWeekend
                      ? "Weekend"
                      : form1AData.isAfterHours
                        ? "After-Hours"
                        : "Business Hours"
                    : "Not recorded"}
                </span>
                <span className={styles.metricSub}>
                  {form1AData.enteredDate
                    ? form1AData.safeguardAlert
                      ? "On-call cover needed"
                      : "Regular roster"
                    : "Not recorded"}
                </span>
              </div>
            </div>

            {/* Reference Card */}
            <div className={styles.referenceCard} style={{ marginTop: "0.75rem" }}>
              <span className={styles.referenceTitle}>{officialFormLabel("1A")}</span>
              <span>
                Form 1A is a referral for examination by a psychiatrist. Deadlines and legal statuses are not computed
                by this application. Expiry dates and times must be confirmed directly from the physical or electronic
                form.
              </span>
            </div>
          </div>
        )}

        {selectedForm === "3A" && (
          <div role="tabpanel" id="panel-3A" aria-labelledby="tab-3A">
            {/* Status Banner */}
            <div className={`${styles.statusBanner} ${styles.statusActive}`} data-testid="status-banner-3a">
              <div className={styles.statusBannerHeader}>
                <span className={styles.statusLabel}>Form 3A Record</span>
                <span className={styles.statusCountdown}>Not legally checked</span>
              </div>
              <p className={styles.statusDescription}>
                {form3AData.enteredDate ? (
                  <>
                    <span>{form3AData.expiryNotice}</span>
                    {" — "}
                    <strong>Not legally checked</strong>
                  </>
                ) : (
                  "Not recorded"
                )}
              </p>
            </div>

            {/* Safeguard Alert */}
            {form3AData.safeguardAlert && (
              <div className={styles.safeguardBanner} data-testid="safeguard-alert-3a">
                <div className={styles.safeguardHeader}>
                  <AlertTriangle size={18} aria-hidden="true" />
                  <span>After-Hours / Weekend Safeguard Alert</span>
                </div>
                <p style={{ margin: 0 }}>{form3AData.safeguardMessage ?? "Not recorded"}</p>
              </div>
            )}

            {/* Metrics Grid */}
            <div className={styles.metricsGrid} style={{ marginTop: "0.75rem" }}>
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>Expiry written on form</span>
                <span className={styles.metricValue}>
                  {form3AData.enteredDate ? formatStatutoryDateTime(form3AData.enteredDate) : "Not recorded"}
                </span>
                <span className={styles.metricSub}>
                  {form3AData.enteredDate ? "Not legally checked" : "Not recorded"}
                </span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>Cover schedule</span>
                <span className={styles.metricValue}>
                  {form3AData.enteredDate
                    ? form3AData.isWeekend
                      ? "Weekend"
                      : form3AData.isAfterHours
                        ? "After-Hours"
                        : "Business Hours"
                    : "Not recorded"}
                </span>
                <span className={styles.metricSub}>
                  {form3AData.enteredDate
                    ? form3AData.safeguardAlert
                      ? "On-call cover needed"
                      : "Regular roster"
                    : "Not recorded"}
                </span>
              </div>
            </div>

            {/* Reference Card */}
            <div className={styles.referenceCard} style={{ marginTop: "0.75rem" }}>
              <span className={styles.referenceTitle}>{officialFormLabel("3A")}</span>
              <span>
                Form 3A is an order authorising detention to enable a person to be taken to an examination. It is not an
                order for examination detention. Statutory deadlines and legal statuses are not computed by this
                application. Expiry dates and times must be confirmed directly from the physical or electronic form.
              </span>
            </div>
          </div>
        )}

        {selectedForm === "4B" && (
          <div role="tabpanel" id="panel-4B" aria-labelledby="tab-4B">
            {/* Status Banner */}
            <div className={`${styles.statusBanner} ${styles.statusActive}`} data-testid="status-banner-4b">
              <div className={styles.statusBannerHeader}>
                <span className={styles.statusLabel}>Form 4B Record</span>
                <span className={styles.statusCountdown}>Not legally checked</span>
              </div>
              <p className={styles.statusDescription}>
                {form4BData.enteredDate ? (
                  <>
                    <span>{form4BData.expiryNotice}</span>
                    {" — "}
                    <strong>Not legally checked</strong>
                  </>
                ) : (
                  "Not recorded"
                )}
              </p>
            </div>

            {/* Safeguard Alert */}
            {form4BData.safeguardAlert && (
              <div className={styles.safeguardBanner} data-testid="safeguard-alert-4b">
                <div className={styles.safeguardHeader}>
                  <AlertTriangle size={18} aria-hidden="true" />
                  <span>After-Hours / Weekend Safeguard Alert</span>
                </div>
                <p style={{ margin: 0 }}>{form4BData.safeguardMessage ?? "Not recorded"}</p>
              </div>
            )}

            {/* Metrics */}
            <div className={styles.metricsGrid} style={{ marginTop: "0.75rem" }}>
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>Expiry written on form</span>
                <span className={styles.metricValue}>
                  {form4BData.enteredDate ? formatStatutoryDateTime(form4BData.enteredDate) : "Not recorded"}
                </span>
                <span className={styles.metricSub}>
                  {form4BData.enteredDate ? "Not legally checked" : "Not recorded"}
                </span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>Cover schedule</span>
                <span className={styles.metricValue}>
                  {form4BData.enteredDate
                    ? form4BData.isWeekend
                      ? "Weekend"
                      : form4BData.isAfterHours
                        ? "After-Hours"
                        : "Business Hours"
                    : "Not recorded"}
                </span>
                <span className={styles.metricSub}>
                  {form4BData.enteredDate
                    ? form4BData.safeguardAlert
                      ? "On-call cover needed"
                      : "Regular roster"
                    : "Not recorded"}
                </span>
              </div>
            </div>

            {/* Reference Card */}
            <div className={styles.referenceCard} style={{ marginTop: "0.75rem" }}>
              <span className={styles.referenceTitle}>{officialFormLabel("4B")}</span>
              <span>
                Form 4B is an extension of a transport order. Statutory deadlines and legal statuses are not computed by
                this application. Expiry dates and times must be confirmed directly from the physical or electronic
                form.
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
