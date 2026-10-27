"use client";

import type { ReactNode } from "react";
import { useWardFlowClock, useWardFlowSelect, type WardFlowContextValue } from "../ward-flow-provider";
import { useWardRaise, type WardRaise } from "../ward-flow-raise";
import { useRouteRole } from "../ward-role-gate";
import { useWardRecordActors } from "../shell/ward-access";
import { useWardShellAuthority, useWardShellPublic } from "../shell/ward-shell-public-context";
import { useExecutiveStatistics, useExecutiveStatisticsControl } from "../statistics/executive-statistics-context";
import type { WardConfiguration } from "../ward-configuration";
import { isConfigurationEvent, type ConfigurationAuditEvent } from "./settings-screen-model";
import { copyTextToClipboard } from "../ward-clipboard";

/** Own-browser diagnostics describe the available public data without invented record counts. */
export function copyExecutiveSettingsDiagnostics(configuration: WardConfiguration) {
  return copyTextToClipboard(
    JSON.stringify(
      {
        product: "Ward Flow Statewide Bed Coordination",
        version: 6,
        exportedAt: new Date().toISOString(),
        configuration,
        dataAccess: "aggregate-only",
        individualRecords: "unavailable",
        activity: "unavailable",
      },
      null,
      2,
    ),
  );
}

type OperationalSource = Pick<
  WardFlowContextValue,
  "movements" | "configuration" | "patients" | "eventLog" | "shared" | "resetDemoState"
> & { kind: "operational"; now: number; raise: WardRaise; ruleChanges: ConfigurationAuditEvent[] };
type ExecutiveSource = {
  kind: "executive";
  configuration: WardConfiguration;
  now: number;
  authenticated: boolean;
  switchRole?: () => void;
};
export type SettingsSource = OperationalSource | ExecutiveSource;

/** Only this mounted bridge reads operational selectors. An executive never mounts it. */
function OperationalSettingsSource({ children }: { children: (source: SettingsSource) => ReactNode }) {
  const source = useWardFlowSelect("movements", "configuration", "patients", "eventLog", "shared", "resetDemoState");
  const { readAuditEvents } = useWardFlowSelect("readAuditEvents");
  const now = useWardFlowClock();
  const raise = useWardRaise(useRouteRole());
  const [actor] = useWardRecordActors();
  const audit = readAuditEvents(actor ?? { role: "demo" });
  const ruleChanges = audit.status === "allowed" ? audit.value.filter(isConfigurationEvent).slice(-5).reverse() : [];
  return children({ ...source, kind: "operational", now, raise, ruleChanges });
}

export function SettingsSourceHost({ children }: { children: (source: SettingsSource) => ReactNode }) {
  const authority = useWardShellAuthority();
  const shell = useWardShellPublic();
  const report = useExecutiveStatistics();
  const reporting = useExecutiveStatisticsControl();
  if (authority?.role === "executive" || reporting.executive) {
    if (!report?.publicConfiguration)
      return (
        <main id="main-content">
          <h1>Settings</h1>
          <p role="status">Public settings are unavailable. Reconnect to confirm your executive report.</p>
        </main>
      );
    return children({
      kind: "executive",
      configuration: report.publicConfiguration,
      now: shell?.now ?? report.network.asAt.now,
      authenticated: shell?.authenticated === true,
      switchRole: shell?.switchRole,
    });
  }
  return <OperationalSettingsSource>{children}</OperationalSettingsSource>;
}
