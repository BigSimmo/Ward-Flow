"use client";

// Settings' second rules column: decision targets, more thresholds (preview) and recent rule
// changes. Moved out of `settings-screen.tsx` to keep it under the line cap.
import Link from "next/link";
import { History, SlidersHorizontal, Timer } from "lucide-react";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { type WardConfiguration } from "@/components/ward-management/ward-configuration";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import {
  DECISION_TARGET_RANGE_MINUTES,
  OVERDUE_AFTER_MINUTES_BY_TIER,
  SILENT_WARD_FIRST_REMINDER_MINUTES,
} from "@/components/ward-management/ward-operational-defaults";
import { BED_ALERT_THRESHOLD_PERCENT } from "@/components/ward-management/shell/ward-service-bed-alerts";
import { DECISION_TARGET_STEPS } from "@/components/ward-management/ward-decision-targets";
import { Card, CardHead, StatusGlyph, buttonClass } from "@/components/wf";
import { PreviewTag, RuleRow } from "./settings-rows";
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
  onPreview,
  ruleChanges,
  now,
  unavailableReason,
}: {
  rules: ReturnType<typeof fullRules>;
  saved: ReturnType<typeof fullRules>;
  setRule: (patch: Partial<WardConfiguration>) => void;
  onPreview: (name: string) => void;
  ruleChanges: ConfigurationAuditEvent[];
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
                  ? "Referral to ward answer"
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

      <Card aria-labelledby="more-title">
        <CardHead iconPlain id="more-title" icon={SlidersHorizontal} title="More thresholds" aside={<PreviewTag />} />
        <RuleRow
          unavailableReason={unavailableReason}
          setting="occupancy"
          title="Occupancy alert"
          sub="Bed alerts dot from"
          value={BED_ALERT_THRESHOLD_PERCENT}
          saved={BED_ALERT_THRESHOLD_PERCENT}
          display={`${BED_ALERT_THRESHOLD_PERCENT}%`}
          noun="occupancy alert"
          range={{
            min: 80,
            max: 95,
            step: 1,
            minLabel: "80%",
            maxLabel: "95%",
          }}
          onChange={() => onPreview("Occupancy alert")}
          preview
          previewTag={false}
        />
        <RuleRow
          unavailableReason={unavailableReason}
          setting="tier-one"
          title="Tier 1 overdue after"
          sub="Referral queue"
          value={OVERDUE_AFTER_MINUTES_BY_TIER[1]}
          saved={OVERDUE_AFTER_MINUTES_BY_TIER[1]}
          display={shortDuration(OVERDUE_AFTER_MINUTES_BY_TIER[1])}
          noun="tier 1 overdue time"
          range={{
            min: 30,
            max: 240,
            step: 30,
            minLabel: "30m",
            maxLabel: "4h",
          }}
          onChange={() => onPreview("Tier 1 overdue after")}
          preview
          previewTag={false}
        />
        <RuleRow
          unavailableReason={unavailableReason}
          setting="ward-silent"
          title="Ward not answering"
          sub="First reminder after"
          value={SILENT_WARD_FIRST_REMINDER_MINUTES}
          saved={SILENT_WARD_FIRST_REMINDER_MINUTES}
          display={shortDuration(SILENT_WARD_FIRST_REMINDER_MINUTES)}
          noun="ward reminder time"
          range={{
            min: 30,
            max: 240,
            step: 30,
            minLabel: "30m",
            maxLabel: "4h",
          }}
          onChange={() => onPreview("Ward not answering")}
          preview
          previewTag={false}
        />
      </Card>

      <Card aria-labelledby="changes-title" data-testid="ward-settings-recent-changes" data-setting="recent-changes">
        <CardHead
          iconPlain
          id="changes-title"
          icon={History}
          title="Recent changes"
          action={
            <Link
              className={buttonClass({ variant: "ghost", size: "sm", className: styles.pill })}
              href="/mockups/ward-flow/governance"
            >
              Full audit
            </Link>
          }
        />
        {ruleChanges.length === 0 ? (
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
