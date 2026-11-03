"use client";

// PT1 (Current Issues, Josh 3 Nov 2026, "yes to all recommendations"): the patient page leads with
// the facts a psychiatric team checks first. One row in the band for every state: legal status,
// observation level, risk flags, community care, GP and alerts. Diagnosis is not here; it sits in
// Details. Every value is a recorded fact shown as recorded, never scored or inferred.
import { Eye, Flag, House, Scale, Stethoscope, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { StatusGlyph, type WfTone } from "@/components/wf";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { LeaveBed, Movement } from "@/components/ward-management/ward-model";
import { activeCommunityTreatmentOrder, type Patient } from "@/components/ward-management/ward-patients";
import { observationSummary } from "@/components/ward-management/ward-observation";
import { riskFlagLabel } from "@/components/ward-management/referrals/referral-risk-flags";
import type { FormTimeLeft } from "@/components/ward-management/legal-forms/legal-form-time-left";
import type { CommunityEngagement } from "./patient-record-extras";
import type { PatientMode } from "./patient-mode";
import { interpreterRequired } from "./patient-flight-header";
import styles from "./patient-glance.module.css";

/** The five state tags Josh asked for (PT1). The mode words still say the finer state. */
export type PatientStateTag = "In ED" | "Inpatient" | "In placement" | "Community active" | "Not active";

export function patientStateTag({
  mode,
  movement,
  communityActive,
}: {
  mode: PatientMode;
  movement?: Movement;
  communityActive: boolean;
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
  return communityActive ? { tag: "Community active", tone: "success" } : { tag: "Not active", tone: "neutral" };
}

type GlanceTile = {
  key: string;
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: WfTone;
  /** Opens where the fact is kept (Forms, Details). */
  onOpen?: () => void;
  openLabel?: string;
};

export type PatientGlanceProps = {
  mode: PatientMode;
  patient?: Patient & { confidential?: boolean };
  movement?: Movement;
  admission?: Admission;
  leaveBed?: LeaveBed;
  /** The stay is shown with ward and dates only to this desk (H-0096). */
  stayWithheld?: boolean;
  /** The form's typed expiry, when one is in force ("Ends 15:42 as typed"). */
  formTimeLeft?: FormTimeLeft;
  /** Risk flags as the referral recorded them. Undefined when no referral is on record. */
  riskFlags?: readonly string[];
  community?: CommunityEngagement;
  /** Health alerts the record holds (allergies and the like), in their own words. */
  healthAlerts?: readonly string[];
  onOpenForms?: () => void;
  onOpenDetails?: () => void;
};

function legalTile(props: PatientGlanceProps): GlanceTile {
  const { patient, movement, formTimeLeft, mode, onOpenForms } = props;
  const status = movement?.legalStatus ?? patient?.legalStatus;
  const cto = activeCommunityTreatmentOrder(patient);
  const placing = mode === "find" || mode === "held" || mode === "transit";
  const form =
    placing && movement?.legalForm ? `Form ${movement.legalForm.code}` : cto ? `Form ${cto.form}` : undefined;
  const sub = formTimeLeft
    ? `${formTimeLeft.code} · ${formTimeLeft.text}`
    : form
      ? `${form} recorded`
      : mode === "idle"
        ? "Last recorded, no open stay"
        : undefined;
  return {
    key: "legal",
    icon: Scale,
    label: "Legal",
    value: status ?? "Not recorded",
    sub,
    tone: formTimeLeft && formTimeLeft.standing !== "later" ? formTimeLeft.tone : undefined,
    onOpen: onOpenForms,
    openLabel: "Open legal forms",
  };
}

function observationTile({ mode, movement, admission, stayWithheld }: PatientGlanceProps): GlanceTile | null {
  const placing = mode === "find" || mode === "held" || mode === "transit";
  const onStay = mode === "ward" || mode === "leave" || mode === "awol" || mode === "ed";
  if (!placing && !onStay) return null;
  if (onStay && stayWithheld) {
    return { key: "obs", icon: Eye, label: "Observation", value: "Withheld", sub: "Ward and dates only" };
  }
  const observation = placing ? movement?.observation : admission?.observation;
  return {
    key: "obs",
    icon: Eye,
    label: "Observation",
    value: observation ? observationSummary(observation) : "Not recorded",
    sub: mode === "leave" ? "On the ward, before leave" : admission?.highAcuity ? "High acuity recorded" : undefined,
    tone: admission?.highAcuity ? "warning" : undefined,
  };
}

function riskTile({ riskFlags }: PatientGlanceProps): GlanceTile {
  const flags = riskFlags ?? [];
  return {
    key: "risk",
    icon: Flag,
    label: "Risk flags",
    value:
      flags.length > 0 ? flags.map(riskFlagLabel).join(", ") : riskFlags ? "None recorded" : "No referral on record",
    sub: riskFlags ? "From the referral" : undefined,
    tone: flags.length > 0 ? "warning" : undefined,
  };
}

function communityTile({ patient, community, onOpenDetails }: PatientGlanceProps): GlanceTile {
  const team = community?.team ?? patient?.catchmentCommunityTeam?.trim();
  return {
    key: "community",
    icon: House,
    label: "Community team",
    value: team || "Not recorded",
    sub: community
      ? `Care coordinator ${community.caseManager.name}`
      : team
        ? "Catchment only, care not confirmed"
        : undefined,
    onOpen: onOpenDetails,
    openLabel: "Open care links in Details",
  };
}

function gpTile({ patient }: PatientGlanceProps): GlanceTile {
  return {
    key: "gp",
    icon: Stethoscope,
    label: "GP",
    value: patient?.generalPractitioner?.trim() || "Not recorded",
  };
}

function alertsTile({
  mode,
  patient,
  leaveBed,
  formTimeLeft,
  healthAlerts,
  onOpenDetails,
}: PatientGlanceProps): GlanceTile {
  const alerts: { text: string; tone: WfTone }[] = [];
  if (mode === "awol" && leaveBed?.absentWithoutLeave) alerts.push({ text: "Absent without leave", tone: "danger" });
  if (formTimeLeft && formTimeLeft.standing !== "later")
    alerts.push({ text: `Form ${formTimeLeft.code} ${formTimeLeft.text}`, tone: formTimeLeft.tone });
  const interpreter = interpreterRequired(patient);
  if (interpreter) alerts.push({ text: `${interpreter} interpreter`, tone: "info" });
  if (patient?.confidential) alerts.push({ text: "Confidential record", tone: "neutral" });
  for (const alert of healthAlerts ?? []) alerts.push({ text: alert, tone: "warning" });
  return {
    key: "alerts",
    icon: TriangleAlert,
    label: "Alerts",
    value: alerts.length > 0 ? alerts.map((alert) => alert.text).join(", ") : "None recorded",
    tone: alerts[0]?.tone,
    onOpen: healthAlerts && healthAlerts.length > 0 ? onOpenDetails : undefined,
    openLabel: "Open health alerts in Details",
  };
}

/** The band's first-screen facts. Presentation only; the screen supplies every fact. */
export function PatientGlance(props: PatientGlanceProps) {
  const tiles = [
    legalTile(props),
    observationTile(props),
    riskTile(props),
    communityTile(props),
    gpTile(props),
    alertsTile(props),
  ].filter((tile): tile is GlanceTile => tile !== null);
  return (
    <dl className={styles.glance} data-testid="ward-patient-glance" aria-label="At a glance">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        const body = (
          <>
            <dt className={styles.label}>
              <Icon size={13} aria-hidden="true" />
              {tile.label}
            </dt>
            <dd className={styles.value}>
              {tile.tone && tile.tone !== "neutral" ? <StatusGlyph tone={tile.tone} size={9} /> : null}
              <span>{tile.value}</span>
            </dd>
            {tile.sub ? (
              <dd className={styles.sub} data-keep={tile.key === "legal" || undefined}>
                {tile.sub}
              </dd>
            ) : null}
          </>
        );
        return (
          <div key={tile.key} className={styles.tile} data-testid={`ward-patient-glance-${tile.key}`}>
            {body}
            {tile.onOpen ? (
              <button type="button" className={styles.cover} onClick={tile.onOpen} aria-label={tile.openLabel} />
            ) : null}
          </div>
        );
      })}
    </dl>
  );
}
