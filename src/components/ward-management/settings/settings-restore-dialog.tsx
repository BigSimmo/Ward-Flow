"use client";
// Restore defaults (Settings round 3, built 31 Oct 2026), on the kit's Dialog. It replaces the old
// restore dialog, which said "all nine rules" but restored twelve and reset only some of this
// browser's settings. This one lists every rule from the one rule list, and every setting this
// browser keeps, and asks whether this browser's settings come back too.

import { useState } from "react";

import { Dialog, Segmented } from "@/components/wf";

import rx from "./settings-layout.module.css";
import { DEFAULT_RULES, RULES } from "./settings-rule-catalogue";

export type RestoreScope = "rules" | "rules-and-browser";

/** This browser's settings a full restore puts back, with the value each returns to. */
const BROWSER_DEFAULTS: readonly (readonly [string, string])[] = [
  ["Theme", "Auto"],
  ["Sidebar", "Full"],
  ["Row density", "Comfortable"],
  ["Single-key shortcuts", "On"],
  ["Reduce motion", "Off"],
  ["High contrast", "Off"],
  ["Buzz sound", "On"],
];

export function SettingsRestoreDialog({
  open,
  onClose,
  onConfirm,
  pending,
  rulesUnavailable,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (scope: RestoreScope) => void;
  pending: boolean;
  /** Why this desk cannot restore the rules; it may still restore this browser's settings. */
  rulesUnavailable: string | undefined;
}) {
  const [scope, setScope] = useState<RestoreScope>("rules");
  const browserOnly = !!rulesUnavailable;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      data-testid="ward-reset-baseline-modal"
      title={browserOnly ? "Restore this browser's settings?" : "Restore defaults?"}
      description={
        browserOnly
          ? "Only this browser changes. The rules are set by the statewide coordinator."
          : `Saves all ${RULES.length} rules at their defaults and records it in the audit. You can undo it from the toast.`
      }
      primary={{
        label: pending ? "Restoring…" : browserOnly ? "Restore this browser" : "Restore defaults",
        onAction: () => onConfirm(browserOnly ? "rules-and-browser" : scope),
        loading: pending,
        tone: "danger",
      }}
      secondary={[{ label: "Cancel", onAction: onClose }]}
    >
      {browserOnly ? null : (
        <Segmented<RestoreScope>
          label="What comes back"
          value={scope}
          onChange={setScope}
          items={[
            { id: "rules", label: "Rules only" },
            { id: "rules-and-browser", label: "Rules and this browser" },
          ]}
        />
      )}
      <div className={rx.restoreLists}>
        {browserOnly ? null : (
          <section aria-label="Rules">
            <h3 className={rx.restoreHead}>{RULES.length} rules</h3>
            <ul className={rx.restoreList}>
              {RULES.map((entry) => (
                <li key={entry.key}>
                  <span>{entry.label}</span> <strong>{entry.display(DEFAULT_RULES[entry.key])}</strong>
                </li>
              ))}
            </ul>
          </section>
        )}
        {browserOnly || scope === "rules-and-browser" ? (
          <section aria-label="This browser">
            <h3 className={rx.restoreHead}>This browser</h3>
            <ul className={rx.restoreList}>
              {BROWSER_DEFAULTS.map(([name, value]) => (
                <li key={name}>
                  <span>{name}</span> <strong>{value}</strong>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </Dialog>
  );
}
