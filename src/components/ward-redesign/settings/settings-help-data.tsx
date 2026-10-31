"use client";
// Settings round 3 (mock-up, 30 Oct 2026): the Help and data tab. Copied from DataPane and the Help
// and Shortcuts cards of DisplayPane (src/components/ward-management/settings/settings-panes.tsx).
// Today's "Data and about" mixed rule files, developer switches, reference tables and About, and Help
// sat under Display. Here: Help first; then the rules file (Download writes the saved rules, Load
// opens the review before anything changes); then About; the Reference tables; and the developer
// feature switches folded at the foot.

import Link from "next/link";
import type { ChangeEvent, ReactNode } from "react";
import { BookOpen, CircleHelp, Copy, Database, Download, Info, ShieldCheck, Upload, Wrench } from "lucide-react";

import { openWardHelp } from "@/components/ward-management/help/ward-help-events";
import { saveTourStep, useTourRole } from "@/components/ward-management/help/ward-help-store";
import { digestHref } from "@/components/ward-management/shell/ward-facade";
import { FeatureFlagsCard } from "@/components/ward-management/settings/feature-flags-card";
import { Button, Card, CardHead, Kbd, buttonClass } from "@/components/wf";

import styles from "@/components/ward-management/settings/settings.module.css";
import rx from "./settings-redesign.module.css";
import { SettingRow } from "./settings-rows";

const SHORTCUTS: readonly { readonly label: string; readonly keys: readonly string[] }[] = [
  { label: "Find a patient", keys: ["Ctrl", "K"] },
  { label: "Find a setting", keys: ["/"] },
  { label: "Open or close the sidebar", keys: ["["] },
  { label: "Close, dismiss", keys: ["Esc"] },
];

export function SettingsHelpData({
  movementCount,
  eventCount,
  shared,
  auditAvailable,
  onDownload,
  onCopyDiagnostics,
  onLoad,
  loadUnavailable,
  onClearSession,
  onRestore,
  reference,
}: {
  movementCount: number | null;
  eventCount: number | null;
  shared: boolean;
  auditAvailable: boolean;
  onDownload: () => void;
  onCopyDiagnostics: () => void;
  onLoad: (event: ChangeEvent<HTMLInputElement>) => void;
  loadUnavailable?: string;
  onClearSession: () => void;
  onRestore: () => void;
  /** The Reference card, drawn by the screen (it holds the reference tab Find a setting opens). */
  reference: ReactNode;
}) {
  const tourRole = useTourRole();
  return (
    <>
      <div className={styles.columns}>
        <div className={styles.column}>
          <Card aria-labelledby="help-title" data-setting="help">
            <CardHead iconPlain id="help-title" icon={CircleHelp} title="Help and tour" />
            <SettingRow setting="help-screen" title="Help" sub="Your desk's guide and a glossary">
              <Button variant="ghost" size="sm" onClick={() => openWardHelp("desk")} data-testid="settings-open-help">
                Open help
              </Button>
            </SettingRow>
            <SettingRow setting="tour" title="First-run tour" sub="Runs once per desk on this device">
              <Button
                variant="ghost"
                size="sm"
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
            <SettingRow setting="export" title="Download rules file" sub="The saved rules, as a file">
              <button
                type="button"
                className={buttonClass({ variant: "sec", size: "sm", className: styles.pill })}
                onClick={onDownload}
                data-testid="btn-export-config"
              >
                <Download size={14} aria-hidden="true" />
                Download
              </button>
            </SettingRow>
            <SettingRow setting="import" title="Load rules file" sub="Shows every change before anything is saved">
              {loadUnavailable ? (
                <Button variant="sec" size="sm" className={styles.pill} disabledReason={loadUnavailable}>
                  <Upload size={14} aria-hidden="true" />
                  Load
                </Button>
              ) : (
                <label className={buttonClass({ variant: "sec", size: "sm", className: styles.pill })}>
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
            <SettingRow setting="copy-diagnostics" title="Copy diagnostics" sub="For a fault report. Records masked">
              <button
                type="button"
                className={buttonClass({ variant: "ghost", size: "sm", className: styles.pill })}
                onClick={onCopyDiagnostics}
                data-testid="btn-copy-diagnostics"
              >
                <Copy size={14} aria-hidden="true" />
                Copy
              </button>
            </SettingRow>
            <SettingRow setting="clear-session" title="Clear this tab" sub="Saved demo state and drafts">
              <button
                type="button"
                className={buttonClass({ variant: "ghost", size: "sm", className: styles.pill })}
                onClick={onClearSession}
                data-testid="btn-clear-cache"
              >
                Clear
              </button>
            </SettingRow>
            <SettingRow setting="restore" title="Restore defaults" sub="Rules, and this browser if you choose">
              <Button
                variant="sec"
                size="sm"
                className={styles.pill}
                onClick={onRestore}
                aria-haspopup="dialog"
                data-testid="btn-restore-baseline"
              >
                Restore…
              </Button>
            </SettingRow>
            <p className={styles.cardNote}>
              <Wrench size={14} aria-hidden="true" />
              Demo clock, scenario and reset are in Tools in the bar.
            </p>
          </Card>
        </div>

        <div className={styles.column}>
          <Card aria-labelledby="about-title" data-setting="about">
            <CardHead iconPlain id="about-title" icon={Info} title="About" />
            <dl className={styles.aboutGrid}>
              <div>
                <dt>Records</dt>
                <dd>Synthetic only</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>Not approved for clinical use</dd>
              </div>
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
              {auditAvailable ? "Every rule save is recorded in the audit." : "Audit entries unavailable here."}
              {auditAvailable ? (
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

      {/* Round 3: nine developer switches are not a ward task; they stay one tap away, folded. */}
      <details className={rx.devFold} data-setting="feature-flags">
        <summary className={rx.devSummary}>For developers: feature switches on this device</summary>
        <FeatureFlagsCard />
      </details>
    </>
  );
}
