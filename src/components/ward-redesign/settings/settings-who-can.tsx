"use client";
// Settings round 3 (mock-up, 30 Oct 2026): a read-only "Who can change what" table under Access, the
// one useful idea in the third-edition HTML drawings (their statutory switches are not taken: D5,
// D-70, D-71). Each row is read from where the app decides it, so the table cannot drift from the
// rule: EVENT_ROLE for the rules, the configuration gate's statewide rule, showsAccessTab and
// AccessSettings for cover and roles.

import { Users } from "lucide-react";

import { EVENT_ROLE } from "@/components/ward-management/ward-flow-event-roles";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import { Card, CardHead } from "@/components/wf";

import styles from "@/components/ward-management/settings/settings.module.css";
import rx from "./settings-redesign.module.css";
import { RULES } from "./settings-rule-catalogue";

const ruleSetters = EVENT_ROLE.SET_CONFIGURATION.map((role) => WARD_FLOW_ROLE_LABELS[role]).join(", ");

const ROWS: readonly { readonly what: string; readonly who: string; readonly how: string }[] = [
  {
    what: `The ${RULES.length} rules`,
    who: `${ruleSetters}, statewide desk only`,
    how: "Saved with a review, recorded in the audit",
  },
  {
    what: "Cover for a second ward or ED",
    who: `${WARD_FLOW_ROLE_LABELS.ward}, ${WARD_FLOW_ROLE_LABELS.ed}, ${WARD_FLOW_ROLE_LABELS.coordinator}`,
    how: "4, 8 or 12 hours, to someone who already holds a ward or ED role",
  },
  {
    what: "Give and remove roles",
    who: `Access admin, statewide ${WARD_FLOW_ROLE_LABELS.coordinator.toLowerCase()}`,
    how: "Up to 12 months, never to yourself, password asked again",
  },
  { what: "Access log", who: "Access admin", how: "Read only" },
  { what: "This browser's display and alerts", who: "Anyone, on their own browser", how: "Applies at once" },
];

export function SettingsWhoCan() {
  return (
    <Card aria-labelledby="who-can-title" data-setting="who-can" data-testid="ward-settings-who-can">
      <CardHead iconPlain id="who-can-title" icon={Users} title="Who can change what" meta="Read only" />
      <div className={styles.tableWrap} role="region" aria-label="Who can change what" tabIndex={0}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Setting</th>
              <th scope="col">Who</th>
              <th scope="col">How</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.what}>
                <td className={styles.cellStrong}>{row.what}</td>
                <td>{row.who}</td>
                <td className={rx.quietCell}>{row.how}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
