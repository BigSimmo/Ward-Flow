"use client";

import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { defaultWardConfiguration, type WardConfiguration } from "@/components/ward-management/ward-configuration";

import { ruleChanges } from "./settings-rule-catalogue";

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

/** The line for the current configuration, or nothing. Styled by the caller's own As-at class. */
export function LocalSettingsNote({
  className,
  testId = "ward-local-settings",
  as: Tag = "p",
}: {
  className?: string;
  testId?: string;
  as?: "p" | "span";
}) {
  const flow = useOptionalWardFlowSelect("configuration");
  const line = flow === null ? null : localSettingsInUse(flow.configuration);
  if (line === null) return null;
  return (
    <Tag className={className} data-testid={testId}>
      {line}
    </Tag>
  );
}
