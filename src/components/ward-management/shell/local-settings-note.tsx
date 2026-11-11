"use client";

import { useEffect, useSyncExternalStore } from "react";

import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { defaultWardConfiguration, type WardConfiguration } from "@/components/ward-management/ward-configuration";

import { useExecutiveStatistics } from "../statistics/executive-statistics-context";
import { ruleChanges } from "../settings/settings-rule-catalogue";

/**
 * Audit M123 (Josh, 10 Nov 2026): a shared view (TV, print, weekly report) says when any of the
 * twelve shared rules is away from its default, so a room reading the figures knows the targets
 * behind them were changed here. One line, rule names and words from the Settings catalogue.
 * Null when every rule is at its default.
 */
export function localSettingsInUse(configuration: WardConfiguration): string | null {
  const changes = ruleChanges(defaultWardConfiguration(), configuration);
  if (changes.length === 0) return null;
  return `Local settings in use: ${changes
    .map((change) => `${change.entry.label} ${change.entry.display(change.after)}`)
    .join(", ")}`;
}

// A page whose figures are not the live ones (a paused weekly report) names their settings here,
// so the shell's print footer prints the same settings as the figures above it.
let pageConfiguration: WardConfiguration | null = null;
const listeners = new Set<() => void>();
function setPageConfiguration(next: WardConfiguration | null) {
  pageConfiguration = next;
  for (const listener of listeners) listener();
}
function subscribePageConfiguration(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The settings behind this page's figures, for the print footer while the page is open. */
export function usePageSettingsConfiguration(configuration: WardConfiguration | null) {
  useEffect(() => {
    setPageConfiguration(configuration);
    return () => setPageConfiguration(null);
  }, [configuration]);
}

/**
 * The line for the given configuration, else the page's, the live board's or (signed-in executives,
 * who have no operational provider) the executive report's. Styled by the caller's own As-at class.
 */
export function LocalSettingsNote({
  className,
  testId = "ward-local-settings",
  as: Tag = "p",
  configuration,
}: {
  className?: string;
  testId?: string;
  as?: "p" | "span";
  configuration?: WardConfiguration | null;
}) {
  const flow = useOptionalWardFlowSelect("configuration");
  const report = useExecutiveStatistics();
  const page = useSyncExternalStore(
    subscribePageConfiguration,
    () => pageConfiguration,
    () => null,
  );
  const source = configuration ?? page ?? flow?.configuration ?? report?.publicConfiguration ?? null;
  const line = source === null ? null : localSettingsInUse(source);
  if (line === null) return null;
  return (
    <Tag className={className} data-testid={testId}>
      {line}
    </Tag>
  );
}
