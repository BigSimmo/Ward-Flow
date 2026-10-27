"use client";

// Settings' second rules column: decision targets and recent rule changes. Moved out of `settings-screen.tsx` to keep it under the line cap.
import Link from "next/link";
import { History, Telescope, Timer } from "lucide-react";
import {
  FORECAST_ED_RISK_LEAD_RANGE_MINUTES,
  FORECAST_SHORT_ALERT_RANGE_BEDS,
  FORECAST_WORSE_ALERT_RANGE_BEDS,
} from "@/components/ward-management/ward-operational-defaults";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { type WardConfiguration } from "@/components/ward-management/ward-configuration";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import { DECISION_TARGET_RANGE_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { DECISION_TARGET_STEPS } from "@/components/ward-management/ward-decision-targets";
import { Card, CardHead, StatusGlyph, buttonClass } from "@/components/wf";
import { RuleRow } from "./settings-rows";
import styles from "./settings.module.css";
import {
  CHANGE_OUTCOME_PREFIX,
  CHANGE_OUTCOME_TONE,
  configurationChangeText,
  shortDuration,
  type ConfigurationAuditEvent,
  type fullRules,
} from "./settings-screen-model";

export function SettingsTargetsColumn({
  rules,
  saved,
  setRule,
  ruleChanges,
  now,
  unavailableReason,
}: {
  rules: ReturnType<typeof fullRules>;
  saved: ReturnType<typeof fullRules>;
  setRule: (patch: Partial<WardConfiguration>) => void;
  ruleChanges: ConfigurationAuditEvent[] | null;
  now: Instant;
  /** Why the rules are read-only for this desk; unset when it may change them. */
  unavailableReason?: string;
}) {
  return (
    <div className={styles.column}>
      <Card aria-labelledby="targets-title" data-setting="decision-targets">
        <CardHead
          iconPlain
          id="targets-title"
          icon={Timer}
          title="Decision targets"
          meta="Your defaults, not clinical standards"
        />
        {DECISION_TARGET_STEPS.map((step) => {
          const ruleKey =
            step.configKey === "referralDecisionTargetMinutes"
              ? "referralTarget"
              : step.configKey === "transferAcceptanceTargetMinutes"
                ? "transferTarget"
                : "transportTarget";
          return (
            <RuleRow
              unavailableReason={unavailableReason}
              key={step.step}
              setting={`target-${step.step}`}
              testId={`setting-target-${step.step}`}
              title={step.label}
              sub={
                step.step === "referral_decision"
                  ? "Referral to ward answer. Past this, a referral shows Stuck: no reply"
                  : step.step === "transfer_acceptance"
                    ? "Acceptance to bed pulled"
                    : "Bed pulled to transport booked"
              }
              value={rules[ruleKey]}
              saved={saved[ruleKey]}
              savedDisplay={shortDuration(saved[ruleKey])}
              display={shortDuration(rules[ruleKey])}
              noun={`${step.label.toLowerCase()} target`}
              range={{
                id: `setting-target-${step.step}-range`,
                ...DECISION_TARGET_RANGE_MINUTES,
                minLabel: shortDuration(DECISION_TARGET_RANGE_MINUTES.min),
                maxLabel: shortDuration(DECISION_TARGET_RANGE_MINUTES.max),
              }}
              onChange={(minutes) => {
                setRule({ [step.configKey]: minutes });
              }}
              onReset={() => {
                setRule({ [step.configKey]: saved[ruleKey] });
              }}
              usedBy="Alerts, Tasks"
            />
          );
        })}
      </Card>

      {/* Forecasting build (Josh, 23 Oct 2026, screen 7): the three Forecast alert rules. */}
      <Card aria-labelledby="forecast-alerts-title" data-setting="forecast-alerts">
        <CardHead
          iconPlain
          id="forecast-alerts-title"
          icon={Telescope}
          title="Forecast alerts"
          meta="Coordinators only. Your defaults"
        />
        <RuleRow
          unavailableReason={unavailableReason}
          setting="forecast-short"
          testId="setting-forecast-short"
          title="Bed type short tomorrow"
          sub="Likely this many short"
          value={rules.forecastShort}
          saved={saved.forecastShort}
          savedDisplay={bedsText(saved.forecastShort)}
          display={bedsText(rules.forecastShort)}
          noun="bed type short alert"
          range={{
            id: "setting-forecast-short-range",
            ...FORECAST_SHORT_ALERT_RANGE_BEDS,
            minLabel: bedsText(FORECAST_SHORT_ALERT_RANGE_BEDS.min),
            maxLabel: bedsText(FORECAST_SHORT_ALERT_RANGE_BEDS.max),
          }}
          onChange={(beds) => setRule({ forecastShortBeds: beds })}
          onReset={() => setRule({ forecastShortBeds: saved.forecastShort })}
          usedBy="Alerts"
        />
        <RuleRow
          unavailableReason={unavailableReason}
          setting="forecast-ed-lead"
          testId="setting-forecast-ed-lead"
          title="Access target forecast"
          sub="Passes the ED target within"
          value={rules.forecastEdLead}
          saved={saved.forecastEdLead}
          savedDisplay={shortDuration(saved.forecastEdLead)}
          display={shortDuration(rules.forecastEdLead)}
          noun="Access target forecast alert"
          range={{
            id: "setting-forecast-ed-lead-range",
            ...FORECAST_ED_RISK_LEAD_RANGE_MINUTES,
            minLabel: shortDuration(FORECAST_ED_RISK_LEAD_RANGE_MINUTES.min),
            maxLabel: shortDuration(FORECAST_ED_RISK_LEAD_RANGE_MINUTES.max),
          }}
          onChange={(minutes) => setRule({ forecastEdLeadMinutes: minutes })}
          onReset={() => setRule({ forecastEdLeadMinutes: saved.forecastEdLead })}
          usedBy="Alerts"
        />
        <RuleRow
          unavailableReason={unavailableReason}
          setting="forecast-worse"
          testId="setting-forecast-worse"
          title="Forecast got worse"
          sub="Drop since you looked"
          value={rules.forecastWorse}
          saved={saved.forecastWorse}
          savedDisplay={bedsText(saved.forecastWorse)}
          display={bedsText(rules.forecastWorse)}
          noun="forecast worse alert"
          range={{
            id: "setting-forecast-worse-range",
            ...FORECAST_WORSE_ALERT_RANGE_BEDS,
            minLabel: bedsText(FORECAST_WORSE_ALERT_RANGE_BEDS.min),
            maxLabel: bedsText(FORECAST_WORSE_ALERT_RANGE_BEDS.max),
          }}
          onChange={(beds) => setRule({ forecastWorseBeds: beds })}
          onReset={() => setRule({ forecastWorseBeds: saved.forecastWorse })}
          usedBy="Alerts"
        />
      </Card>

      <Card aria-labelledby="changes-title" data-testid="ward-settings-recent-changes" data-setting="recent-changes">
        <CardHead
          iconPlain
          id="changes-title"
          icon={History}
          title="Recent changes"
          action={
            ruleChanges === null ? undefined : (
              <Link
                className={buttonClass({ variant: "ghost", size: "sm", className: styles.pill })}
                href="/ward-flow/governance"
              >
                Full audit
              </Link>
            )
          }
        />
        {ruleChanges === null ? (
          <p className={styles.cardEmpty}>
            Individual changes and audit entries are unavailable for executive reporting.
          </p>
        ) : ruleChanges.length === 0 ? (
          <p className={styles.cardEmpty}>No rule saves this session.</p>
        ) : (
          <ol className={styles.changeList}>
            {ruleChanges.map((change) => (
              <li key={change.id} className={styles.changeRow}>
                <span className={styles.changeTime}>
                  {change.at === null ? "No time" : formatInstantWithDay(change.at, now)}
                </span>
                <StatusGlyph tone={CHANGE_OUTCOME_TONE[change.outcome]} size={9} />
                <span className={styles.changeText}>
                  {CHANGE_OUTCOME_PREFIX[change.outcome]}
                  {configurationChangeText(
                    change.details.before,
                    change.outcome === "accepted" ? change.details.after : change.details.requested,
                  )}
                </span>
                <span className={styles.changeActor}>
                  {change.actor.role ? WARD_FLOW_ROLE_LABELS[change.actor.role] : "Role not recorded"}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

function bedsText(beds: number): string {
  return `${beds} ${beds === 1 ? "bed" : "beds"}`;
}
