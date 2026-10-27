"use client";
import type { WardGlobalSearchProps } from "./ward-global-search";
import styles from "./ward-global-search.module.css";
import { WARD_REFERRAL_INTAKE_HREF } from "./ward-nav";
type DeskRole = "coordinator" | "ward" | "ed" | "officer";
export function WardSearchCommands({
  demoOff,
  demoOffId,
  demoOffText,
  resultsCurrent,
  canRunAction,
  canOpenHref,
  onAdvanceClock,
  onSwitchDesk,
  onHandover,
  shortcutsExpanded,
  onToggleShortcuts,
}: {
  demoOff: boolean;
  demoOffId: string;
  demoOffText: string;
  resultsCurrent: boolean;
  canRunAction: NonNullable<WardGlobalSearchProps["canRunAction"]>;
  canOpenHref: NonNullable<WardGlobalSearchProps["canOpenHref"]>;
  onAdvanceClock: () => void;
  onSwitchDesk: (role: DeskRole, href: string) => void;
  onHandover: () => void;
  shortcutsExpanded: boolean;
  onToggleShortcuts: () => void;
}) {
  return (
    <div
      role="group"
      aria-label="Quick commands"
      className={styles.quickCommands}
      data-testid="ward-global-search-quick-commands"
    >
      <span className={styles.group} data-testid="ward-global-search-group-commands">
        <span>Quick commands</span>
      </span>
      {demoOff ? (
        <p id={demoOffId} className={styles.commandNote} data-testid="ward-global-search-demo-off">
          {demoOffText}
        </p>
      ) : null}
      <div className={styles.commandList}>
        {canRunAction("advance-clock") ? (
          <button
            type="button"
            className={styles.commandBtn}
            disabled={!resultsCurrent || demoOff}
            aria-describedby={demoOff ? demoOffId : undefined}
            data-testid="ward-global-search-cmd-advance-clock"
            onClick={onAdvanceClock}
          >
            <span className={styles.commandLabel}>Advance demo clock +15m</span>
            <kbd className={styles.hintKbd}>+15m</kbd>
          </button>
        ) : null}
        {canOpenHref("/ward-flow") ? (
          <button
            type="button"
            className={styles.commandBtn}
            disabled={!resultsCurrent}
            data-testid="ward-global-search-cmd-desk-coordinator"
            onClick={() => onSwitchDesk("coordinator", "/ward-flow")}
          >
            <span className={styles.commandLabel}>Switch to Coordinator desk</span>
            <kbd className={styles.hintKbd}>Coordinator</kbd>
          </button>
        ) : null}
        {canOpenHref("/ward-flow/wards") ? (
          <button
            type="button"
            className={styles.commandBtn}
            disabled={!resultsCurrent}
            data-testid="ward-global-search-cmd-desk-ward"
            onClick={() => onSwitchDesk("ward", "/ward-flow/wards")}
          >
            <span className={styles.commandLabel}>Switch to Ward desk</span>
            <kbd className={styles.hintKbd}>Ward</kbd>
          </button>
        ) : null}
        {canOpenHref("/ward-flow/ed") ? (
          <button
            type="button"
            className={styles.commandBtn}
            disabled={!resultsCurrent}
            data-testid="ward-global-search-cmd-desk-ed"
            onClick={() => onSwitchDesk("ed", "/ward-flow/ed")}
          >
            <span className={styles.commandLabel}>Switch to ED desk</span>
            <kbd className={styles.hintKbd}>ED</kbd>
          </button>
        ) : null}
        {canOpenHref("/ward-flow/transport/officer") ? (
          <button
            type="button"
            className={styles.commandBtn}
            disabled={!resultsCurrent}
            data-testid="ward-global-search-cmd-desk-officer"
            onClick={() => onSwitchDesk("officer", "/ward-flow/transport/officer")}
          >
            <span className={styles.commandLabel}>Switch to Transport desk</span>
            <kbd className={styles.hintKbd}>Transport</kbd>
          </button>
        ) : null}
        {canOpenHref("/ward-flow/handover") ? (
          <button
            type="button"
            className={styles.commandBtn}
            disabled={!resultsCurrent}
            data-testid="ward-global-search-cmd-handover"
            onClick={onHandover}
          >
            <span className={styles.commandLabel}>Open Handover sheet</span>
            <kbd className={styles.hintKbd}>/handover</kbd>
          </button>
        ) : null}
        <button
          type="button"
          className={styles.commandBtn}
          disabled={!resultsCurrent}
          aria-expanded={shortcutsExpanded}
          data-testid="ward-global-search-cmd-shortcuts"
          onClick={onToggleShortcuts}
        >
          <span className={styles.commandLabel}>Keyboard shortcuts (?)</span>
          <kbd className={styles.hintKbd}>?</kbd>
        </button>
      </div>
      {shortcutsExpanded ? (
        <div
          className={styles.shortcutsSheet}
          role="region"
          aria-label="Keyboard shortcuts"
          data-testid="ward-global-search-shortcuts-sheet"
        >
          <span className={styles.shortcutRow}>
            <span>Global search &amp; commands</span>
            <span>
              <kbd className={styles.hintKbd}>Ctrl+K</kbd> <kbd className={styles.hintKbd}>/</kbd>
            </span>
          </span>
          {canRunAction("new-referral") && canOpenHref(WARD_REFERRAL_INTAKE_HREF) ? (
            <span className={styles.shortcutRow}>
              <span>New referral</span>
              <kbd className={styles.hintKbd}>Shift+R</kbd>
            </span>
          ) : null}
          <span className={styles.shortcutRow}>
            <span>Tasks drawer</span>
            <kbd className={styles.hintKbd}>Shift+T</kbd>
          </span>
          <span className={styles.shortcutRow}>
            <span>Activity drawer</span>
            <kbd className={styles.hintKbd}>Shift+A</kbd>
          </span>
          <span className={styles.shortcutRow}>
            <span>Toggle navigation rail</span>
            <kbd className={styles.hintKbd}>[</kbd>
          </span>
          <span className={styles.shortcutRow}>
            <span>Dismiss / clear</span>
            <kbd className={styles.hintKbd}>Esc</kbd>
          </span>
        </div>
      ) : null}
    </div>
  );
}
