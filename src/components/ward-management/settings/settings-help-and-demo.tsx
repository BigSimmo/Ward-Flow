"use client";
// Settings by role (Josh, 3 Nov 2026, ST1, "yes to all"). Help, the tour and shortcuts live in Help,
// so Settings no longer repeats them; the Page tips switch moved to Display. What was one closed
// "Demo tools" fold is now three plain parts:
// - the rules file, beside the coordinator's rule editor (and Save only in the access admin's Data);
// - Data, the access admin's: the rules file, a bug report copy, About and the reference tables;
// - Demo tools, on the demo site only: reset the demo, a bug report copy, About and the feature switches.

import Link from "next/link";
import { type ChangeEvent, type ReactNode } from "react";
import {
  BookOpen,
  Copy,
  Database,
  DoorOpen,
  Download,
  Info,
  RotateCcw,
  ShieldCheck,
  Upload,
  Wrench,
} from "lucide-react";

import { digestHref } from "@/components/ward-management/shell/ward-facade";
import { FeatureFlagsCard } from "@/components/ward-management/settings/feature-flags-card";
import { requestToolsTool } from "@/components/ward-management/tools/ward-tools-open";
import { useCanLeaveDemo, useLeaveDemo } from "@/components/ward-management/shell/leave-demo";
import { Button, Card, CardHead, StateLine, buttonClass } from "@/components/wf";

import styles from "@/components/ward-management/settings/settings.module.css";
import { SettingsFold } from "./settings-fold";
import { SettingRow } from "./settings-rows";

/** The saved rules as a file. Load sits only with the rule editor, where a loaded file lands in review. */
export function SettingsRulesFileCard({
  onDownload,
  onLoad,
  loadUnavailable,
  loadError,
}: {
  onDownload: () => void;
  /** Left out where the desk cannot change the rules (the access admin's Data). */
  onLoad?: (event: ChangeEvent<HTMLInputElement>) => void;
  loadUnavailable?: string;
  /** C09: why the last file was not loaded. It stays beside Load until the next file is chosen. */
  loadError?: string | null;
}) {
  return (
    <Card aria-labelledby="rules-file-title" data-testid="ward-settings-rules-file">
      <CardHead iconPlain id="rules-file-title" icon={Database} title="Rules file" />
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
      {onLoad ? (
        <>
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
          {/* C09: the reason stays under Load, in the kit's error line, until the next file is chosen. */}
          {loadError ? (
            <StateLine kind="error" compact title={loadError} data-testid="ward-settings-load-error" />
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

/** Copy details for a bug report, records masked. */
function DiagnosticsRow({ onCopyDiagnostics }: { onCopyDiagnostics: () => void }) {
  return (
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
  );
}

/** About: the policy version, how this site signs in, and where rule saves are recorded. */
function AboutCard({
  shared,
  auditAvailable,
  governanceOpen,
  children,
}: {
  shared: boolean;
  auditAvailable: boolean;
  governanceOpen: boolean;
  children?: ReactNode;
}) {
  return (
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
        {auditAvailable ? "Every rule save is recorded in the audit." : "Rule-save history is not shown on this desk."}
        {auditAvailable && governanceOpen ? (
          <Link className={styles.inlineLink} href="/ward-flow/governance">
            Governance
          </Link>
        ) : null}
      </p>
      {/* F-77 (A15-25): what the demo is, what this browser keeps and sends, how to leave. */}
      <p className={styles.cardNote}>
        <Info size={14} aria-hidden="true" />
        Invented records, what this browser keeps, how to leave
        <Link className={styles.inlineLink} href="/ward-flow/about" data-testid="settings-about-demo-link">
          About this demo
        </Link>
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
      {children}
    </Card>
  );
}

type AboutProps = { shared: boolean; auditAvailable: boolean; governanceOpen: boolean };

/** Data, the access admin's section: the rules file, a bug report copy, About and the reference tables. */
export function SettingsDataSection({
  onDownload,
  onCopyDiagnostics,
  reference,
  about,
}: {
  onDownload: () => void;
  onCopyDiagnostics: () => void;
  /** The Reference card, drawn by the screen (it holds the reference tab Find a setting opens). */
  reference: ReactNode;
  about: AboutProps;
}) {
  return (
    <>
      <div className={styles.demoStack}>
        <div className={styles.demoStack}>
          <SettingsRulesFileCard onDownload={onDownload} />
        </div>
        <div className={styles.demoStack}>
          <AboutCard {...about}>
            <DiagnosticsRow onCopyDiagnostics={onCopyDiagnostics} />
          </AboutCard>
        </div>
      </div>
      {reference}
    </>
  );
}

/**
 * Demo tools, on the demo site only (Josh, 3 Nov 2026): reset the demo in this tab and the feature
 * switches, plus About and the bug report copy on a desk that has no Data section.
 */
export function SettingsDemoTools({
  movementCount,
  eventCount,
  onClearSession,
  onCopyDiagnostics,
  about,
}: {
  movementCount: number | null;
  eventCount: number | null;
  onClearSession: () => void;
  /** Left out where Data already holds the bug report copy and About. */
  onCopyDiagnostics?: () => void;
  about?: AboutProps;
}) {
  const canLeave = useCanLeaveDemo();
  const leave = useLeaveDemo();
  return (
    <div className={styles.demoStack} data-setting="demo-tools" data-testid="ward-settings-demo-tools">
      <div className={styles.demoStack}>
        <div className={styles.demoStack}>
          <Card aria-labelledby="demo-title" data-testid="ward-settings-storage-telemetry">
            <CardHead
              iconPlain
              id="demo-title"
              icon={Wrench}
              title="This demo"
              meta={
                movementCount === null || eventCount === null
                  ? "Aggregate reports only"
                  : `${movementCount} movements held · ${eventCount} events this session`
              }
            />
            <SettingRow setting="demo-controls" title="Demo controls" sub="Clock, scenario and practice">
              <button
                type="button"
                className={buttonClass({ variant: "ghost", className: styles.pill })}
                onClick={(event) => requestToolsTool("demo", event.currentTarget)}
                data-testid="btn-open-demo-controls"
              >
                Open Demo
              </button>
            </SettingRow>
            <SettingRow setting="clear-session" title="Reset the demo in this tab" sub="Saved demo state and drafts">
              <button
                type="button"
                className={buttonClass({ variant: "ghost", className: styles.pill })}
                onClick={onClearSession}
                data-testid="btn-clear-cache"
              >
                <RotateCcw size={14} aria-hidden="true" />
                Reset
              </button>
            </SettingRow>
            {onCopyDiagnostics ? <DiagnosticsRow onCopyDiagnostics={onCopyDiagnostics} /> : null}
            {/* Live audit item 22 (11 Nov 2026): the public demo's way out. */}
            {canLeave ? (
              <SettingRow setting="leave-demo" title="Leave the demo" sub="Clears this demo and ends the demo code">
                <button
                  type="button"
                  className={buttonClass({ variant: "ghost", className: styles.pill })}
                  onClick={leave}
                  data-testid="btn-leave-demo"
                >
                  <DoorOpen size={14} aria-hidden="true" />
                  Leave
                </button>
              </SettingRow>
            ) : null}
          </Card>
        </div>
        {about ? (
          <div className={styles.demoStack}>
            <AboutCard {...about} />
          </div>
        ) : null}
      </div>
      {/* Simplify Settings (Josh, 8 Nov 2026): the switches for unfinished features sit closed. */}
      <SettingsFold
        title="Feature switches"
        sub="Turn unfinished features on or off on this device"
        testId="ward-settings-feature-switches"
      >
        <div data-setting="feature-flags">
          <FeatureFlagsCard />
        </div>
      </SettingsFold>
    </div>
  );
}
