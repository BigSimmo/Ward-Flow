"use client";

// PT1 (Current Issues, Josh 3 Nov 2026, "yes to all recommendations"): the patient page leads with
// the facts a psychiatric team must check before acting. Round 2 (Josh's brief, 21:40Z: action led,
// no information overload): only the safety facts lead. Legal, observation and risk always show,
// and Alerts shows only when there is one. Community team, care coordinator and GP are people you
// call, so they live once, in Who to call, with their numbers. Diagnosis sits in Details. Every
// value is a recorded fact shown as recorded, never scored or inferred.
import { CircleAlert, Eye, Flag, Scale } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { StatusGlyph, type WfTone } from "@/components/wf";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { LeaveBed, Movement } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { observationSummary } from "@/components/ward-management/ward-observation";
import { riskFlagLabel } from "@/components/ward-management/referrals/referral-risk-flags";
import type { FormTimeLeft } from "@/components/ward-management/legal-forms/legal-form-time-left";
import {
  FORM_RECORDED_ENDED,
  formProgressionPhrase,
  legalFormEnd,
  NEXT_FORM_TO_RECORD,
} from "@/components/ward-management/ward-legal-form-progression";
import type { PatientMode } from "./patient-mode";
import { patientLegalNow, type PatientLegalNow } from "./patient-now-adapter";
import { interpreterRequired } from "./patient-flight-header";
import styles from "./patient-glance.module.css";

/** The five state tags Josh asked for (PT1). The mode words still say the finer state. */
export type PatientStateTag = "In ED" | "Inpatient" | "In placement" | "Community active" | "Referred" | "Not active";

export function patientStateTag({
  mode,
  movement,
  communityActive,
  openWork,
}: {
  mode: PatientMode;
  movement?: Movement;
  communityActive: boolean;
  /**
   * A16-11 (Josh, 13 Nov 2026): open records the journey and ward stay do not show. "bed" is a
   * referral awaiting a ward's answer, an accepted ward referral with no movement yet, or a booked
   * planned admission; "community" is a referral awaiting only a community team's answer.
   */
  openWork?: "bed" | "community";
}): { tag: PatientStateTag; tone: WfTone } {
  if (mode === "find" || mode === "held") {
    // Still waiting at the emergency department until the bed is pulled and they move.
    return movement?.originEdId !== undefined
      ? { tag: "In ED", tone: "warning" }
      : { tag: "In placement", tone: "info" };
  }
  if (mode === "transit") return { tag: "In placement", tone: "info" };
  if (mode === "ward" || mode === "leave" || mode === "awol" || mode === "ed") {
    return { tag: "Inpatient", tone: mode === "awol" ? "danger" : "success" };
  }
  // A person with an open referral or booking is never "Not active" (A16-11). A bed being sought
  // leads; a community team caring for them comes before a community referral awaiting an answer.
  if (openWork === "bed") return { tag: "In placement", tone: "info" };
  if (communityActive) return { tag: "Community active", tone: "success" };
  if (openWork === "community") return { tag: "Referred", tone: "info" };
  return { tag: "Not active", tone: "neutral" };
}

type GlanceTile = {
  key: string;
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** Glyph tone only; the words stay neutral. */
  tone?: WfTone;
  /** Quiet ink for a value that says nothing is recorded. */
  quiet?: boolean;
  /** Opens where the fact is kept (Forms, Details). */
  onOpen?: () => void;
  /** A quiet text action under the fact, above the tile's open cover (Record CTO). */
  action?: { label: string; onClick: () => void; disabledReason?: string; testId: string };
  openLabel?: string;
};

export type PatientGlanceProps = {
  mode: PatientMode;
  patient?: Patient & { confidential?: boolean };
  movement?: Movement;
  /** D-186 Q7: the page's one legal reading, shared with the Legal now card. */
  legalNow?: PatientLegalNow;
  admission?: Admission;
  leaveBed?: LeaveBed;
  /** The stay is shown with ward and dates only to this desk (H-0096). */
  stayWithheld?: boolean;
  /** The form's typed expiry, when one is in force ("Ends 15:42 as typed"). */
  formTimeLeft?: FormTimeLeft;
  /** Risk flags as the referral recorded them. Undefined when no referral is on record. */
  riskFlags?: readonly string[];
  /** When the referral holding the flags was raised, in words ("Sun 1 Nov"). Always shown (H10). */
  riskFlagsWhen?: string;
  /** The movement names a referral this desk cannot see (H10): say so, show nothing from it. */
  riskNotShared?: boolean;
  /** Health alerts the record holds (allergies and the like), in their own words. */
  healthAlerts?: readonly string[];
  onOpenForms?: () => void;
  onOpenDetails?: () => void;
  /** Note 5 (Josh, 9 Nov 2026): Record CTO is a quiet line in Legal, not a button in the header. */
  recordCto?: { onClick: () => void; reason?: string };
};

const PLACING: readonly PatientMode[] = ["find", "held", "transit"];
const ON_STAY: readonly PatientMode[] = ["ward", "leave", "awol", "ed"];

function legalTile({
  patient,
  movement,
  legalNow,
  formTimeLeft,
  mode,
  onOpenForms,
  recordCto,
}: PatientGlanceProps): GlanceTile {
  // D-186 Q7 (audit A9-31): the status, form and community order come from the page's one legal
  // reading, the same value the Legal now card reads. A band drawn on its own (tests) reads its
  // movement through the same rule.
  const legal = legalNow ?? patientLegalNow({ liveMovement: movement, patient });
  const status = legal.status;
  const cto = legal.communityOrder;
  const open = (PLACING.includes(mode) || ON_STAY.includes(mode)) && mode !== "idle";
  const base = { key: "legal", icon: Scale, label: "Legal", onOpen: onOpenForms, openLabel: "Open legal forms" };
  // Stress test (round 2): with nothing open, a stale "Involuntary inpatient" in the band would read
  // as an order in force. A record with nothing open says what is in force, and the last status
  // follows in quiet words (Q118: last recorded, never current).
  if (!open) {
    if (cto) return { ...base, value: "Community treatment order", sub: `Form ${cto.form} in force` };
    return {
      ...base,
      value: "No order in force",
      quiet: true,
      sub: status ? `last recorded ${status}` : undefined,
      // Note 5 (Josh, 9 Nov 2026): a CTO in force shows here by itself; recording one is a quiet
      // line under the fact, not a header button.
      action:
        mode === "idle" && recordCto
          ? {
              label: "Record CTO",
              onClick: recordCto.onClick,
              disabledReason: recordCto.reason,
              testId: "ward-person-record-cto",
            }
          : undefined,
    };
  }
  // Audit S-6, D-170 item 1 and A1: after the examination or arrival the band keeps the form as
  // recorded and prompts "Next form to record", with no form number and no inferred end.
  // A form recorded as ended is read before the neutral 5A/5B arrival wording (as the Legal forms page).
  const end = legalFormEnd(legal.movement);
  if (end?.kind === "progressed")
    return {
      ...base,
      value: status ?? "Not recorded",
      quiet: status === undefined,
      sub: `${formProgressionPhrase(end.progression)} · ${NEXT_FORM_TO_RECORD}`,
      tone: "warning",
    };
  if (end?.kind === "recorded" && legal.form)
    return {
      ...base,
      value: status ?? "Not recorded",
      quiet: status === undefined,
      sub: `Form ${legal.form.code} ${FORM_RECORDED_ENDED.toLowerCase()}`,
    };
  const form = legal.form ? `Form ${legal.form.code}` : cto ? `Form ${cto.form}` : undefined;
  return {
    ...base,
    value: status ?? "Not recorded",
    quiet: status === undefined,
    // D-93: a form's end time only as typed, never a countdown.
    sub: formTimeLeft ? `${formTimeLeft.code} · ${formTimeLeft.text}` : form ? `${form} in force` : undefined,
    tone: formTimeLeft && formTimeLeft.standing !== "later" ? formTimeLeft.tone : undefined,
  };
}

function observationTile({ mode, movement, admission, stayWithheld }: PatientGlanceProps): GlanceTile | null {
  const placing = PLACING.includes(mode);
  if (!placing && !ON_STAY.includes(mode)) return null;
  const base = { key: "obs", icon: Eye, label: "Obs" };
  if (!placing && stayWithheld) return { ...base, value: "Withheld", quiet: true, sub: "ward and dates only" };
  const observation = placing ? movement?.observation : admission?.observation;
  return {
    ...base,
    value: observation ? observationSummary(observation) : "Not recorded",
    quiet: !observation,
    sub: mode === "leave" ? "before leave" : admission?.highAcuity ? "high acuity" : undefined,
    tone: admission?.highAcuity ? "warning" : undefined,
  };
}

function riskTile({ riskFlags, riskFlagsWhen, riskNotShared }: PatientGlanceProps): GlanceTile {
  if (riskNotShared) return { key: "risk", icon: Flag, label: "Risk", value: "Not shared with this desk", quiet: true };
  const flags = riskFlags ?? [];
  const source = riskFlagsWhen ? `referral ${riskFlagsWhen}` : "on the referral";
  if (flags.length === 0)
    return {
      key: "risk",
      icon: Flag,
      label: "Risk",
      value: "None recorded",
      quiet: true,
      sub: riskFlags ? source : undefined,
    };
  return {
    key: "risk",
    icon: Flag,
    label: "Risk",
    value: flags.map(riskFlagLabel).join(", "),
    sub: source,
    tone: "warning",
  };
}

function alertsTile({ mode, patient, leaveBed, healthAlerts, onOpenDetails }: PatientGlanceProps): GlanceTile | null {
  const alerts: { text: string; tone: WfTone }[] = [];
  if (mode === "awol" && leaveBed?.absentWithoutLeave) alerts.push({ text: "Absent without leave", tone: "danger" });
  for (const alert of healthAlerts ?? []) alerts.push({ text: alert, tone: "warning" });
  const interpreter = interpreterRequired(patient);
  if (interpreter) alerts.push({ text: `${interpreter} interpreter`, tone: "info" });
  if (patient?.confidential) alerts.push({ text: "Restricted record", tone: "neutral" });
  // Round 2: an empty Alerts tile was noise. It shows only when there is something to know.
  if (alerts.length === 0) return null;
  return {
    key: "alerts",
    icon: CircleAlert,
    label: "Alert",
    value: alerts.map((alert) => alert.text).join(", "),
    tone: alerts[0].tone,
    onOpen: healthAlerts && healthAlerts.length > 0 ? onOpenDetails : undefined,
    openLabel: "Open health alerts in Details",
  };
}

/** The band's safety facts. Presentation only; the screen supplies every fact. */
export function PatientGlance(props: PatientGlanceProps) {
  const tiles = [legalTile(props), observationTile(props), riskTile(props), alertsTile(props)].filter(
    (tile): tile is GlanceTile => tile !== null,
  );
  return (
    <dl className={styles.glance} data-testid="ward-patient-glance" aria-label="Safety at a glance">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <div
            key={tile.key}
            className={styles.tile}
            data-testid={`ward-patient-glance-${tile.key}`}
            data-quiet={tile.quiet || undefined}
            data-action={tile.onOpen ? true : undefined}
            data-flag={tile.tone === "warning" || tile.tone === "danger" || undefined}
          >
            <dt className={styles.label}>
              <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
              {tile.label}
            </dt>
            <dd className={styles.value}>
              {tile.tone && tile.tone !== "neutral" ? <StatusGlyph tone={tile.tone} size={9} /> : null}
              <span>{tile.value}</span>
              {/* The whole tile opens where the fact is kept. The button sits in the dd (a dl's
                  div may hold only dt and dd) and covers the tile: one tab stop, a full tap area. */}
              {tile.onOpen ? (
                <button type="button" className={styles.cover} onClick={tile.onOpen} aria-label={tile.openLabel} />
              ) : null}
            </dd>
            {tile.sub ? (
              <dd className={styles.sub} data-keep={tile.key === "legal" || tile.key === "risk" || undefined}>
                {tile.sub}
              </dd>
            ) : null}
            {tile.action ? (
              <dd className={styles.act}>
                <button
                  type="button"
                  className={styles.actButton}
                  onClick={tile.action.disabledReason ? undefined : tile.action.onClick}
                  aria-disabled={tile.action.disabledReason ? true : undefined}
                  title={tile.action.disabledReason}
                  data-testid={tile.action.testId}
                >
                  {tile.action.label}
                </button>
              </dd>
            ) : null}
          </div>
        );
      })}
    </dl>
  );
}
