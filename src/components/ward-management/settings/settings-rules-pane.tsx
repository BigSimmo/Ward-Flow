"use client";
// Settings round 3 (mock-up, 30 Oct 2026): the Rules tab, moved out of settings-screen.tsx. Built
// from the round 2 rules content and the forked targets column, regrouped by job into four cards:
// ED and placement, Form warnings, Deadlines and reply targets, Forecast alerts. Morning bed numbers
// joins the reply targets (a one-row "Daily rhythm" card would be an almost empty panel). Each rule
// shows what it reaches on today's records where the app has a predicate for it, its default when it
// sits away from it, and the five-row Recent changes card becomes one line at the top.

import Link from "next/link";
import { useState } from "react";
import { Clock, Gavel, Telescope, Timer } from "lucide-react";

import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { WardConfiguration } from "@/components/ward-management/ward-configuration";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import type { Movement } from "@/components/ward-management/ward-model";
import {
  ED_ACCESS_TARGET_RANGE_MINUTES,
  MORNING_ROLLUP_TIME_RANGE_MINUTES,
  PARALLEL_REFERRAL_CAP_RANGE,
  PULL_HOLD_RANGE_MINUTES,
} from "@/components/ward-management/ward-model";
import {
  DECISION_TARGET_RANGE_MINUTES,
  DUE_SOON_RANGE_MINUTES,
  DUE_SOON_URGENT_RANGE_MINUTES,
  FORECAST_ED_RISK_LEAD_RANGE_MINUTES,
  FORECAST_SHORT_ALERT_RANGE_BEDS,
  FORECAST_WORSE_ALERT_RANGE_BEDS,
} from "@/components/ward-management/ward-operational-defaults";
import {
  clampDueSoonUrgent,
  configurationChangeText,
  fullRules,
  type ConfigurationAuditEvent,
} from "@/components/ward-management/settings/settings-screen-model";
import { Card, CardHead, Segmented, StatusGlyph, Switch, cx } from "@/components/wf";

import styles from "@/components/ward-management/settings/settings.module.css";
import rx from "./settings-layout.module.css";
import { DEFAULT_RULES, RULES, rulesAwayFromDefault, surgeChanges, type RuleKey } from "./settings-rule-catalogue";
import { IMPACT_NOUNS, bedsPulledNow, impactText, ruleImpact } from "./settings-rule-impact";
import { RuleRow, type RuleRange } from "./settings-rows";

function rangeOf(
  key: RuleKey,
  id: string,
  bounds: { readonly min: number; readonly max: number; readonly step: number },
): RuleRange {
  const entry = RULES.find((rule) => rule.key === key)!;
  return { id, ...bounds, minLabel: entry.display(bounds.min), maxLabel: entry.display(bounds.max) };
}

export function SettingsRulesPane({
  draft,
  configuration,
  movements,
  now,
  ruleChanges,
  setRule,
  isSurge,
  onSurge,
  blockReason,
  readOnlyWords,
}: {
  draft: WardConfiguration;
  /** The saved rules. */
  configuration: WardConfiguration;
  /** Today's records, or null on the executive view, which holds no individual records. */
  movements: readonly Movement[] | null;
  now: Instant;
  ruleChanges: readonly ConfigurationAuditEvent[] | null;
  setRule: (patch: Partial<WardConfiguration>) => void;
  isSurge: boolean;
  onSurge: (choice: "standard" | "surge") => void;
  /** Why this desk cannot change the rules; unset when it may. */
  blockReason: string | undefined;
  /** The read-only line for a desk that cannot change the rules (executive, nurse in charge, a coordinator who is not statewide). */
  readOnlyWords: string | null;
}) {
  const rules = fullRules(draft);
  const saved = fullRules(configuration);
  const [changedOnly, setChangedOnly] = useState(false);
  const awayFromDefault = rulesAwayFromDefault(draft);
  const surge = surgeChanges();

  /** "2 forms in Early warning now", or "1 if saved (now 2)" while the draft moves the rule. */
  const effectFor = (key: RuleKey) => {
    // The executive view holds no individual records; the line above the cards already says so.
    if (!movements) return undefined;
    if (key === "hold") {
      const pulled = bedsPulledNow(movements);
      return (
        <>
          <StatusGlyph tone="neutral" size={9} />
          {`${pulled} ${pulled === 1 ? "bed" : "beds"} pulled now`}
        </>
      );
    }
    const atDraft = ruleImpact(key, movements, now, draft);
    if (!atDraft) return undefined;
    const atSaved = ruleImpact(key, movements, now, configuration)!;
    const noun = IMPACT_NOUNS[key] ?? null;
    const moved = rules[key] !== saved[key];
    const delta = atDraft.count - atSaved.count;
    return (
      <>
        <StatusGlyph tone={atDraft.count > 0 ? "warning" : "success"} size={9} />
        {moved ? `${impactText(atDraft, noun)} if saved` : `${impactText(atDraft, noun)} now`}
        {moved && delta !== 0 ? <span className={styles.delta}>{`${delta > 0 ? "+" : ""}${delta}`}</span> : null}
      </>
    );
  };

  /** The props every rule row shares, read from the one rule list. */
  const common = (key: RuleKey) => {
    const entry = RULES.find((rule) => rule.key === key)!;
    return {
      setting: entry.setting,
      title: entry.label,
      value: rules[key],
      saved: saved[key],
      display: entry.display(rules[key]),
      savedDisplay: entry.display(saved[key]),
      defaultValue: DEFAULT_RULES[key],
      defaultDisplay: entry.display(DEFAULT_RULES[key]),
      usedBy: entry.shownOn,
      unavailableReason: blockReason,
      effect: effectFor(key),
    };
  };

  const lastAccepted = ruleChanges?.find((change) => change.outcome === "accepted" && change.at !== null);

  return (
    <>
      {readOnlyWords !== null ? (
        <p className={styles.scopeLine}>
          <span className={cx(styles.scopeTag, rx.scopeTagPlain)}>Read only</span>
          <span>{readOnlyWords}</span>
        </p>
      ) : (
        <p className={cx(styles.scopeLine, rx.scopeWords)}>
          <strong>Changes wait for Save.</strong>
          <span>Each save is recorded in the audit.</span>
        </p>
      )}

      {/* The five-row Recent changes card, as one line: the last save, who made it, what moved. */}
      <div className={rx.rulesTopLine}>
        <span className={rx.lastChange} data-testid="ward-settings-recent-changes" data-setting="recent-changes">
          {ruleChanges === null ? (
            "Rule-save history is not shown on this desk."
          ) : lastAccepted?.at != null ? (
            <>
              <StatusGlyph tone="success" size={9} />
              <span>
                Changed {formatInstantWithDay(lastAccepted.at, now)} by{" "}
                {lastAccepted.actor.role ? WARD_FLOW_ROLE_LABELS[lastAccepted.actor.role] : "a desk not recorded"}:{" "}
                {configurationChangeText(lastAccepted.details.before, lastAccepted.details.after)}
              </span>
              <Link className={rx.inlineLink} href="/ward-flow/governance">
                Full audit
              </Link>
            </>
          ) : (
            "No rule saves this session."
          )}
        </span>
        <span data-setting="changed-only">
          <Switch
            checked={changedOnly}
            onCheckedChange={setChangedOnly}
            className={rx.changedOnlySwitch}
            label={
              awayFromDefault === 0
                ? "Show changed only · every rule at its default"
                : `Show changed only · ${awayFromDefault} ${awayFromDefault === 1 ? "rule differs" : "rules differ"} from the defaults`
            }
          />
        </span>
      </div>

      {changedOnly && awayFromDefault === 0 ? (
        <p className={rx.calmLine} role="status">
          <StatusGlyph tone="success" size={9} />
          Every rule is at its default.
        </p>
      ) : null}

      <div className={cx(styles.columns, changedOnly && rx.changedOnly)}>
        <div className={styles.column}>
          <Card aria-labelledby="timings-title" data-setting="surge" data-rule-card>
            <CardHead
              iconPlain
              id="timings-title"
              icon={Clock}
              title="ED and placement"
              action={
                // A desk that cannot change the rules reads the timing set as words, not a greyed switch.
                readOnlyWords !== null ? (
                  <span className={rx.timingWords}>{isSurge ? "Surge timings" : "Standard timings"}</span>
                ) : (
                  <Segmented
                    className={styles.pillSeg}
                    label="Timing set"
                    items={[
                      { id: "standard", label: "Standard" },
                      { id: "surge", label: "Surge" },
                    ]}
                    value={isSurge ? "surge" : "standard"}
                    onChange={onSurge}
                  />
                )
              }
            />
            {/* Round 3: Surge set the wards-asked limit to 3, which is already the default, so it
                really moves two rules. The card says which, from the same values the choice writes. */}
            {readOnlyWords !== null ? null : (
              <p className={rx.surgeLine} data-testid="ward-settings-surge-explained">
                Surge changes {surge.length} {surge.length === 1 ? "rule" : "rules"}:{" "}
                {surge
                  .map(
                    (change) =>
                      `${change.entry.label} ${change.entry.display(change.before)} → ${change.entry.display(change.after)}`,
                  )
                  .join(", ")}
                .
              </p>
            )}
            <RuleRow
              {...common("ed")}
              sub="Access measure only"
              noun="ED access target"
              range={rangeOf("ed", "setting-ed-threshold", ED_ACCESS_TARGET_RANGE_MINUTES)}
              onChange={(minutes) => setRule({ edAccessTargetMinutes: minutes })}
              onReset={() => setRule({ edAccessTargetMinutes: saved.ed })}
            />
            <RuleRow
              {...common("cap")}
              sub="Per referral"
              noun="parallel referral enquiry limit"
              range={rangeOf("cap", "setting-parallel-cap", PARALLEL_REFERRAL_CAP_RANGE)}
              onChange={(units) => setRule({ parallelReferralCap: units })}
              onReset={() => setRule({ parallelReferralCap: saved.cap })}
            />
            <RuleRow
              {...common("hold")}
              sub="Applies from the next pull"
              noun="pull time limit"
              range={rangeOf("hold", "setting-hold-duration", PULL_HOLD_RANGE_MINUTES)}
              onChange={(minutes) => setRule({ pullHoldMinutes: minutes })}
              onReset={() => setRule({ pullHoldMinutes: saved.hold })}
            />
          </Card>

          <Card aria-labelledby="warnings-title" data-rule-card>
            <CardHead
              iconPlain
              id="warnings-title"
              icon={Gavel}
              title="Form warnings"
              meta="Your defaults, not legal limits"
            />
            <RuleRow
              {...common("soon")}
              testId="setting-due-soon-row"
              sub="Shown as due soon"
              subTestId="setting-due-soon-desc"
              displayTestId="due-soon-display"
              noun="early warning before a legal due time"
              range={rangeOf("soon", "setting-due-soon", DUE_SOON_RANGE_MINUTES)}
              onChange={(minutes) =>
                setRule({ dueSoonMinutes: minutes, dueSoonUrgentMinutes: clampDueSoonUrgent(rules.urgent, minutes) })
              }
              onReset={() =>
                setRule({
                  dueSoonMinutes: saved.soon,
                  dueSoonUrgentMinutes: clampDueSoonUrgent(rules.urgent, saved.soon),
                })
              }
            />
            <RuleRow
              {...common("urgent")}
              testId="setting-due-soon-urgent-row"
              sub="Before a legal due time"
              subTestId="setting-due-soon-urgent-desc"
              displayTestId="due-soon-urgent-display"
              noun="final warning before a legal due time"
              max={clampDueSoonUrgent(DUE_SOON_URGENT_RANGE_MINUTES.max, rules.soon)}
              range={rangeOf("urgent", "setting-due-soon-urgent", DUE_SOON_URGENT_RANGE_MINUTES)}
              onChange={(minutes) => setRule({ dueSoonUrgentMinutes: clampDueSoonUrgent(minutes, rules.soon) })}
              onReset={() => setRule({ dueSoonUrgentMinutes: clampDueSoonUrgent(saved.urgent, rules.soon) })}
            />
            {/* The two warnings on one window, read from the draft: calm, early warning, final warning. */}
            <div className={styles.cascade} aria-hidden="true">
              <div className={styles.cascadeTrack}>
                <span style={{ flexGrow: Math.max(0, DUE_SOON_RANGE_MINUTES.max - rules.soon) }} />
                <span className={styles.cascadeSoon} style={{ flexGrow: Math.max(0, rules.soon - rules.urgent) }} />
                <span className={styles.cascadeUrgent} style={{ flexGrow: rules.urgent }} />
              </div>
              <div className={styles.cascadeEnds}>
                <span className={styles.cascadeStart}>Due in {RULES[3].display(DUE_SOON_RANGE_MINUTES.max)}</span>
                <span style={{ flexGrow: Math.max(0, DUE_SOON_RANGE_MINUTES.max - rules.soon) }}>
                  {RULES[3].display(rules.soon)}
                </span>
                <span style={{ flexGrow: Math.max(0, rules.soon - rules.urgent) }}>
                  {RULES[3].display(rules.urgent)}
                </span>
                <span style={{ flexGrow: rules.urgent }}>Due</span>
              </div>
            </div>
          </Card>
        </div>

        <div className={styles.column}>
          <Card aria-labelledby="targets-title" data-setting="decision-targets" data-rule-card>
            <CardHead
              iconPlain
              id="targets-title"
              icon={Timer}
              title="Deadlines and reply targets"
              meta="Your defaults, not clinical standards"
            />
            <RuleRow
              {...common("morning")}
              testId="setting-morning-rollup-row"
              sub="Not a legal limit"
              subTestId="setting-morning-rollup-desc"
              displayTestId="morning-rollup-display"
              noun="morning bed numbers due time"
              range={rangeOf("morning", "setting-morning-rollup-slider", MORNING_ROLLUP_TIME_RANGE_MINUTES)}
              onChange={(minutes) => setRule({ morningRollupDeadlineMinutes: minutes })}
              onReset={() => setRule({ morningRollupDeadlineMinutes: saved.morning })}
            />
            <RuleRow
              {...common("referralTarget")}
              testId="setting-target-referral_decision"
              sub="Referral to ward answer. Past this, a referral shows Stuck: no reply"
              noun="referral decision target"
              range={rangeOf("referralTarget", "setting-target-referral_decision-range", DECISION_TARGET_RANGE_MINUTES)}
              onChange={(minutes) => setRule({ referralDecisionTargetMinutes: minutes })}
              onReset={() => setRule({ referralDecisionTargetMinutes: saved.referralTarget })}
            />
            <RuleRow
              {...common("transferTarget")}
              testId="setting-target-transfer_acceptance"
              sub="Acceptance to bed pulled"
              noun="transfer acceptance target"
              range={rangeOf(
                "transferTarget",
                "setting-target-transfer_acceptance-range",
                DECISION_TARGET_RANGE_MINUTES,
              )}
              onChange={(minutes) => setRule({ transferAcceptanceTargetMinutes: minutes })}
              onReset={() => setRule({ transferAcceptanceTargetMinutes: saved.transferTarget })}
            />
            <RuleRow
              {...common("transportTarget")}
              testId="setting-target-transport_booked"
              sub="Bed pulled to transport booked"
              noun="transport booked target"
              range={rangeOf("transportTarget", "setting-target-transport_booked-range", DECISION_TARGET_RANGE_MINUTES)}
              onChange={(minutes) => setRule({ transportBookedTargetMinutes: minutes })}
              onReset={() => setRule({ transportBookedTargetMinutes: saved.transportTarget })}
            />
          </Card>

          {/* Forecasting build (Josh, 23 Oct 2026, screen 7): the three Forecast alert rules. */}
          <Card aria-labelledby="forecast-alerts-title" data-setting="forecast-alerts" data-rule-card>
            <CardHead
              iconPlain
              id="forecast-alerts-title"
              icon={Telescope}
              title="Forecast alerts"
              meta="Coordinators only. Your defaults"
            />
            <RuleRow
              {...common("forecastShort")}
              testId="setting-forecast-short"
              sub="Likely this many short"
              noun="bed type short alert"
              range={rangeOf("forecastShort", "setting-forecast-short-range", FORECAST_SHORT_ALERT_RANGE_BEDS)}
              onChange={(beds) => setRule({ forecastShortBeds: beds })}
              onReset={() => setRule({ forecastShortBeds: saved.forecastShort })}
            />
            <RuleRow
              {...common("forecastEdLead")}
              testId="setting-forecast-ed-lead"
              sub="Passes the ED target within"
              noun="Access target forecast alert"
              range={rangeOf("forecastEdLead", "setting-forecast-ed-lead-range", FORECAST_ED_RISK_LEAD_RANGE_MINUTES)}
              onChange={(minutes) => setRule({ forecastEdLeadMinutes: minutes })}
              onReset={() => setRule({ forecastEdLeadMinutes: saved.forecastEdLead })}
            />
            <RuleRow
              {...common("forecastWorse")}
              testId="setting-forecast-worse"
              sub="Drop since you looked"
              noun="forecast worse alert"
              range={rangeOf("forecastWorse", "setting-forecast-worse-range", FORECAST_WORSE_ALERT_RANGE_BEDS)}
              onChange={(beds) => setRule({ forecastWorseBeds: beds })}
              onReset={() => setRule({ forecastWorseBeds: saved.forecastWorse })}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
