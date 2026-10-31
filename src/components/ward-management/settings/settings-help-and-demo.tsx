"use client";
// Settings by login (Josh, 31 Oct 2026, "yes to all"): Help is its own short section on every desk.
// The rules file, Copy diagnostics, Clear this tab, About, the Reference tables and the feature
// switches are builder tools, so they sit in one closed "Demo tools" section that only the
// coordinator and the access admin see. Restore defaults moved to This device, where every desk has it.

import Link from "next/link";
import type { ChangeEvent, ReactNode } from "react";
import { BookOpen, CircleHelp, Copy, Database, Download, Info, ShieldCheck, Upload, Wrench } from "lucide-react";

import { openWardHelp } from "@/components/ward-management/help/ward-help-events";
import { saveTourStep, useTourRole } from "@/components/ward-management/help/ward-help-store";
import { digestHref } from "@/components/ward-management/shell/ward-facade";
import { FeatureFlagsCard } from "@/components/ward-management/settings/feature-flags-card";
import { Button, Card, CardHead, Kbd, buttonClass } from "@/components/wf";

import styles from "@/components/ward-management/settings/settings.module.css";
import rx from "./settings-layout.module.css";
import { SettingRow } from "./settings-rows";

const SHORTCUTS: readonly { readonly label: string; readonly keys: readonly string[] }[] = [
  { label: "Find a patient", keys: ["Ctrl", "K"] },
  { label: "Find a setting", keys: ["/"] },
  { label: "Open or close the sidebar", keys: ["["] },
  { label: "Close, dismiss", keys: ["Esc"] },
];

/** Help and the tour, on every desk. */
export function SettingsHelpCard() {
  const tourRole = useTourRole();
  return (
    <Card aria-labelledby="help-title" data-setting="help">
      <CardHead iconPlain id="help-title" icon={CircleHelp} title="Help" />
      <SettingRow setting="help-screen" title="Open Help" sub="Tasks for your desk, and the words Ward Flow uses">
        <Button variant="ghost" onClick={() => openWardHelp("desk")} data-testid="settings-open-help">
          Open help
        </Button>
      </SettingRow>
      <SettingRow setting="tour" title="Take the tour again" sub="About 3 minutes">
        <Button
          variant="ghost"
          onClick={() => {
            // Replay starts from the first step, not the step the tour was left at.
            saveTourStep(tourRole, 0);
            openWardHelp("tour");
          }}
          data-testid="settings-replay-tour"
        >
          Replay the tour
        </Button>
      </SettingRow>
      <ul className={styles.shortcuts} aria-label="Keyboard shortcuts" data-setting="shortcuts">
        {SHORTCUTS.map((shortcut) => (
          <li key={shortcut.label}>
            <span>{shortcut.label}</span>
            <span className={styles.keys}>
              {shortcut.keys.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * Demo tools: closed until opened, coordinator and access admin only. Builder and demonstration
 * controls that a ward, ED, community, officer, bed manager or executive desk has no use for.
 */
export function SettingsDemoTools({
  movementCount,
  eventCount,
  shared,
  auditAvailable,
  governanceOpen,
  onDownload,
  onCopyDiagnostics,
  onLoad,
  loadUnavailable,
  onClearSession,
  reference,
  open,
  onOpenChange,
}: {
  movementCount: number | null;
  eventCount: number | null;
  shared: boolean;
  auditAvailable: boolean;
  /** This desk may open Governance, so the audit line links to it. */
  governanceOpen: boolean;
  onDownload: () => void;
  onCopyDiagnostics: () => void;
  onLoad: (event: ChangeEvent<HTMLInputElement>) => void;
  loadUnavailable?: string;
  onClearSession: () => void;
  /** The Reference card, drawn by the screen (it holds the reference tab Find a setting opens). */
  reference: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <details
      className={rx.devFold}
      data-setting="demo-tools"
      data-testid="ward-settings-demo-tools"
      open={open}
      onToggle={(event) => onOpenChange((event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className={rx.devSummary}>
        <Wrench size={16} aria-hidden="true" />
        Demo tools
      </summary>
      <div className={rx.demoBody}>
        <div className={styles.columns}>
          <div className={styles.column}>
            <Card aria-labelledby="data-title" data-testid="ward-settings-storage-telemetry">
              <CardHead
                iconPlain
                id="data-title"
                icon={Database}
                title="Rules file and this browser"
                meta={
                  movementCount === null || eventCount === null
                    ? "Aggregate reports only"
                    : `${movementCount} movements held · ${eventCount} events this session`
                }
              />
              <SettingRow setting="export" title="Save the rules as a file" sub="The saved rules only">
                <button
                  type="button"
                  className={buttonClass({ variant: "sec", className: styles.pill })}
                  onClick={onDownload}
                  data-testid="btn-export-config"
                >
                  <Download size={14} aria-hidden="true" />
                  Download
                </button>
              </SettingRow>
              <SettingRow setting="import" title="Load a rules file" sub="Shows every change before anything is saved">
                {loadUnavailable ? (
                  <Button variant="sec" className={styles.pill} disabledReason={loadUnavailable}>
                    <Upload size={14} aria-hidden="true" />
                    Load
                  </Button>
                ) : (
                  <label className={buttonClass({ variant: "sec", className: styles.pill })}>
                    <Upload size={14} aria-hidden="true" />
                    Load
                    <input
                      type="file"
                      accept=".json,application/json"
                      className={styles.fileInput}
                      onChange={onLoad}
                      data-testid="input-import-config"
                    />
                  </label>
                )}
              </SettingRow>
              <SettingRow setting="copy-diagnostics" title="Copy details for a bug report" sub="Records masked">
                <button
                  type="button"
                  className={buttonClass({ variant: "ghost", className: styles.pill })}
                  onClick={onCopyDiagnostics}
                  data-testid="btn-copy-diagnostics"
                >
                  <Copy size={14} aria-hidden="true" />
                  Copy
                </button>
              </SettingRow>
              <SettingRow setting="clear-session" title="Reset the demo in this tab" sub="Saved demo state and drafts">
                <button
                  type="button"
                  className={buttonClass({ variant: "ghost", className: styles.pill })}
                  onClick={onClearSession}
                  data-testid="btn-clear-cache"
                >
                  Reset
                </button>
              </SettingRow>
            </Card>
          </div>

          <div className={styles.column}>
            <Card aria-labelledby="about-title" data-setting="about">
              <CardHead iconPlain id="about-title" icon={Info} title="About" />
              <dl className={styles.aboutGrid}>
                <div data-testid="ward-settings-policy-version">
                  <dt>Policy</dt>
                  <dd>2026.3</dd>
                </div>
                <div>
                  <dt>Sign-in</dt>
                  <dd>{shared ? "Signed-in shared workspace" : "Local synthetic demo"}</dd>
                </div>
              </dl>
              <p className={styles.cardNote}>
                <ShieldCheck size={14} aria-hidden="true" />
                {auditAvailable
                  ? "Every rule save is recorded in the audit."
                  : "Rule-save history is not shown on this desk."}
                {auditAvailable && governanceOpen ? (
                  <Link className={styles.inlineLink} href="/ward-flow/governance">
                    Governance
                  </Link>
                ) : null}
              </p>
              {process.env.NODE_ENV !== "production" ? (
                <p className={styles.cardNote}>
                  <BookOpen size={14} aria-hidden="true" />
                  Product design reference
                  <a className={styles.inlineLink} href={digestHref()} target="_blank" rel="noopener noreferrer">
                    Ward Flow Digest
                  </a>
                </p>
              ) : null}
            </Card>
          </div>
        </div>

        {/* The reference tables are four columns wide, so they take the full width below. */}
        {reference}

        <div data-setting="feature-flags">
          <FeatureFlagsCard />
        </div>
      </div>
    </details>
  );
}
