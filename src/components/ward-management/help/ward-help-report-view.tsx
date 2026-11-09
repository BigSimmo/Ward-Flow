"use client";

import { ArrowLeft, CircleCheck, Copy, ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button, Field, Textarea } from "@/components/wf";
import { copiedText, copyTextToClipboard } from "@/components/ward-management/ward-clipboard";

import {
  browserSummary,
  findPatientDetails,
  patientDetailRefusal,
  REPORT_MAX_LENGTH,
  reportLines,
  reportText,
  reportTime,
  supportEmail,
  type ReportContext,
} from "./ward-help-report";
import s from "./ward-help-panel.module.css";

type Status = "" | "copied" | "copy-failed";

const STATUS_WORDS: Readonly<Record<Status, string>> = {
  "": "",
  copied: "Report copied. Paste it into your email.",
  "copy-failed": "Could not copy. Select the report below and copy it yourself.",
};

/** "8 Nov 2026" from the What's new date "2026-11-08", for the preview only (the report keeps the id). */
function shortDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    Date.UTC(year, month - 1, day),
  );
}

/**
 * REPORT A PROBLEM, a view inside Help (Josh, 8 Nov 2026). The reporter types what happened; the
 * screen, desk, version, browser and time are added. Before it is copied, the words are checked for
 * likely patient details and refused while any is there. The app never composes the email (the
 * never-build rule): the reporter pastes the report into their own. The words stay in this view's
 * state: they go only to the clipboard, and are not logged or put in storage.
 */
export function HelpReport({
  screen,
  path,
  desk,
  version,
  onBack,
  email = supportEmail(),
}: {
  screen?: string;
  path: string;
  desk: string;
  version?: { id: string; date: string };
  onBack: () => void;
  /** The support address to paste the report to; null points to the pilot lead. */
  email?: string | null;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<Status>("");
  const [fallback, setFallback] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  // Arriving in the view moves focus to its heading, so a screen reader says where it is.
  useEffect(() => heading.current?.focus(), []);

  const context = (): ReportContext => ({
    screen,
    path,
    desk,
    version,
    browser: typeof navigator === "undefined" ? "Unknown browser" : browserSummary(navigator.userAgent),
    viewport: typeof window === "undefined" ? undefined : { width: window.innerWidth, height: window.innerHeight },
    time: reportTime(new Date()),
  });

  /** The report to copy, or undefined after saying why not (focus goes back to the box). */
  const checked = (): string | undefined => {
    const refusal = !text.trim()
      ? "Say what happened first."
      : findPatientDetails(text).length
        ? patientDetailRefusal(findPatientDetails(text))
        : "";
    setError(refusal);
    setStatus("");
    setFallback("");
    if (refusal) {
      field.current?.focus();
      return undefined;
    }
    return copiedText(reportText(text, context()));
  };

  const copy = async () => {
    const report = checked();
    if (!report) return;
    try {
      await copyTextToClipboard(report);
      setStatus("copied");
    } catch {
      setFallback(report);
      setStatus("copy-failed");
    }
  };

  // The preview says what will be added in words a reader can scan; the sent report keeps the exact
  // version id, browser, window size and time.
  const added = reportLines({
    screen,
    path,
    desk,
    version,
    browser: "This browser and window size",
    time: "When you copy it",
  }).map(([label, value]) =>
    label === "Version" && version ? ([label, `latest change ${shortDate(version.date)}`] as const) : [label, value],
  );
  const done = status === "copied";

  return (
    <>
      <Button variant="ghost" icon={ArrowLeft} onClick={onBack} className={s.back}>
        Back to Help
      </Button>
      <div>
        <h3 ref={heading} tabIndex={-1} className={s.viewTitle} data-testid="ward-help-report-title">
          Report a problem
        </h3>
        <p className={s.herePurpose}>Tell the pilot team what went wrong, so it can be fixed.</p>
      </div>
      <p className={s.safety} data-testid="ward-help-report-reminder">
        <ShieldAlert aria-hidden="true" strokeWidth={1.75} />
        Do not include patient names or details.
      </p>
      <Field label="What happened?" help="What you did, what you expected and what you saw." error={error || undefined}>
        <Textarea
          ref={field}
          value={text}
          rows={5}
          maxLength={REPORT_MAX_LENGTH}
          onChange={(event) => {
            setText(event.target.value);
            setStatus("");
          }}
          data-testid="ward-help-report-text"
        />
      </Field>
      {/* The actions sit straight under the box, so they show on a phone without scrolling. */}
      <div className={s.reportSend}>
        <div className={s.answerActions}>
          <Button variant="pri" icon={Copy} onClick={() => void copy()} data-testid="ward-help-report-copy">
            Copy report
          </Button>
        </div>
        <p className={s.note} data-testid="ward-help-report-destination">
          {email
            ? `Then paste it into an email to ${email}.`
            : "Then paste it into an email or message to your pilot lead."}
        </p>
        <p
          className={`${s.footStatus} ${s.reportStatus}`}
          role="status"
          aria-live="polite"
          data-done={done ? "" : undefined}
          data-testid="ward-help-report-status"
        >
          {done ? <CircleCheck aria-hidden="true" strokeWidth={1.75} /> : null}
          {STATUS_WORDS[status]}
        </p>
      </div>
      {fallback ? (
        <Field label="Report to copy">
          <Textarea readOnly value={fallback} rows={8} data-testid="ward-help-report-fallback" />
        </Field>
      ) : null}
      <section className={s.section} aria-label="Added for you">
        <h4 className={s.sectionHead}>Added for you</h4>
        <dl className={s.reportAdded} data-testid="ward-help-report-added">
          {added.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
