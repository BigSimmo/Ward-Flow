"use client";
// Settings by login (Josh, 31 Oct 2026, "yes to all"): a desk that cannot change the rules sees a
// short read-only card of only the rules that change what it sees, instead of twelve locked
// steppers. The values are read from the one rule list (settings-rule-catalogue.ts), so the card can
// never disagree with the coordinator's editor. The statewide coordinator edits the rules in full.

import { Clock } from "lucide-react";

import type { WardAccessRole } from "@/components/ward-management/ward-role-access";
import type { WardConfiguration } from "@/components/ward-management/ward-configuration";
import { fullRules } from "@/components/ward-management/settings/settings-screen-model";
import { Card, CardHead } from "@/components/wf";

import styles from "@/components/ward-management/settings/settings.module.css";
import rx from "./settings-layout.module.css";
import { RULES, type RuleKey } from "./settings-rule-catalogue";
import { SettingRow } from "./settings-rows";

/** The rules that change what each desk sees. A desk not listed has none (the access admin). */
export const RULES_FOR_DESK: Partial<Record<WardAccessRole, readonly RuleKey[]>> = {
  bed_manager: ["morning", "cap", "hold", "transferTarget", "forecastShort"],
  ward: ["morning", "referralTarget", "hold", "soon", "urgent"],
  ed: ["ed", "hold", "transportTarget", "soon", "urgent"],
  community: ["referralTarget", "soon", "urgent"],
  officer: ["transportTarget"],
  executive: ["ed", "forecastEdLead", "forecastShort"],
};

/** Plain names for the read-only card. The coordinator's editor keeps the rule list's own names. */
const PLAIN_LABEL: Partial<Record<RuleKey, string>> = {
  cap: "Wards a referral goes to at once",
  hold: "How long a pulled bed is held",
  soon: "Form due-soon warning",
  urgent: "Form final warning",
  referralTarget: "Answer a referral within",
  transferTarget: "Acceptance to bed pulled",
  transportTarget: "Book transport within",
  forecastShort: "Warn when a bed type is short tomorrow by",
  forecastEdLead: "Warn when someone will pass the ED target within",
};

const BEFORE_DUE: ReadonlySet<RuleKey> = new Set(["soon", "urgent"]);

export function SettingsRulesSummary({
  role,
  configuration,
}: {
  role: WardAccessRole;
  configuration: WardConfiguration;
}) {
  const keys = RULES_FOR_DESK[role];
  if (!keys || keys.length === 0) return null;
  const values = fullRules(configuration);
  const executive = role === "executive";
  return (
    <Card aria-labelledby="rules-summary-title" data-setting="rules-summary" data-testid="ward-settings-rules-summary">
      <CardHead
        iconPlain
        id="rules-summary-title"
        icon={Clock}
        title={executive ? "How the figures are worked out" : "Rules that affect you"}
        meta="Set by the bed coordinator"
      />
      {keys.map((key) => {
        const entry = RULES.find((rule) => rule.key === key)!;
        const value = entry.display(values[key]);
        return (
          <SettingRow key={key} setting={entry.setting} title={PLAIN_LABEL[key] ?? entry.label}>
            <span className={rx.summaryValue} data-testid={`ward-settings-rule-${entry.setting}`}>
              {BEFORE_DUE.has(key) ? `${value} before` : value}
            </span>
          </SettingRow>
        );
      })}
      <p className={styles.cardNote}>Ask the bed coordinator if one of these seems wrong.</p>
    </Card>
  );
}
