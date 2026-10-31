"use client";

import { CircleHelp } from "lucide-react";

import { openWardHelp } from "./ward-help-events";
import { useTourRole, useTourSeen } from "./ward-help-store";
import styles from "./ward-help.module.css";

/**
 * The rail's Help button. It always opens How do I…, the desk's common tasks, with this screen's
 * first (Josh, 30 Oct 2026); it never starts the tour, which is How do I…'s first row (Josh, 31 Oct
 * 2026). Until this desk's tour has been seen on this device it says "New". The tour is offered once,
 * on a signed-in desk's home screen, and starts only if chosen (`ward-tour-auto-start.tsx`).
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
  const role = useTourRole();
  const seen = useTourSeen(role);
  return (
    <button
      type="button"
      className={classes.button}
      aria-label={seen ? "Help" : "Help, new"}
      title={showTitle ? "Help" : undefined}
      onClick={() => openWardHelp("tasks")}
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
  const role = useTourRole();
  const seen = useTourSeen(role);
  return {
    label: seen ? "Help" : "Help, new",
    isNew: !seen,
    open: () => openWardHelp("tasks"),
  };
}
