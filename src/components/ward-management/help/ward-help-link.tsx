"use client";

import { CircleHelp } from "lucide-react";

import { useShellPersonaRole } from "@/components/ward-management/settings/persona-sync";

import { openWardHelp, useTourSeen } from "./ward-help-store";
import styles from "./ward-help.module.css";

/**
 * The rail's Help button. Until this desk's tour has been seen or dismissed on this device it says
 * "New" and opens the tour; after that it opens help for the current screen. The marker never
 * blocks the page: there is no automatic pop-up, so nothing covers a screen someone is working in.
 */
export function WardHelpLink({
  classes,
  showTitle,
}: {
  /** The rail's own row classes, so Help reads as one more rail row. */
  classes: { button: string; glyph: string; text: string; line: string; label: string };
  /** The closed strip shows the icon only, so it needs the hover title. */
  showTitle: boolean;
}) {
  const role = useShellPersonaRole();
  const seen = useTourSeen(role);
  return (
    <button
      type="button"
      className={classes.button}
      aria-label={seen ? "Help" : "Help, new: take the tour"}
      title={showTitle ? "Help" : undefined}
      onClick={() => openWardHelp(seen ? "screen" : "tour")}
      data-testid="ward-rail-help"
    >
      <CircleHelp aria-hidden="true" className={classes.glyph} strokeWidth={1.75} />
      <span className={classes.text}>
        <span className={classes.line}>
          <span className={classes.label}>Help</span>
          {seen ? null : (
            <span className={styles.newMark} aria-hidden="true">
              New
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

/** The same, as a row in the phone menu. `row` draws it like the menu's other rows. */
export function useWardHelpRow(): { label: string; isNew: boolean; open: () => void } {
  const role = useShellPersonaRole();
  const seen = useTourSeen(role);
  return {
    label: seen ? "Help" : "Help, new: take the tour",
    isNew: !seen,
    open: () => openWardHelp(seen ? "screen" : "tour"),
  };
}
