"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { OverlayPortal, useIsPhone } from "@/components/wf";
import { hasOpenSheet, openSheetHandles, subscribeToSheetStack } from "@/components/wf/sheet-focus";
import { railEntries } from "../shell/ward-rail-entries";
import { ROLE_SCREENS, screenForPath } from "../ward-role-access";
import { WARD_HOME_HREF } from "../ward-nav";
import { ADMIN_SETTINGS_HELP, screenHelpFor } from "../help/ward-help-content";
import { openWardHelp } from "../help/ward-help-events";
import { parseTourSeen, useTourRole, useTourSeen } from "../help/ward-help-store";
import type { WardTourRole } from "../help/ward-help-store";
import { ACCESSIBILITY_HELP } from "./ward-help-reference";
import styles from "./ward-help-hints.module.css";

export const HELP_HINTS_KEY = "ward_flow_choice_help_hints_seen";
// Only static Help topic ids may enter storage. No paths, record ids or typed words.
const TOPICS = new Set([
  "command",
  "capacity",
  "movements",
  "referrals",
  "handover",
  "ward",
  "ed",
  "community",
  "officer",
  "statistics",
  "governance",
  "settings",
  "legal-forms",
  "downtime",
  "patient",
  "ed-board",
  "community-team",
  "bed-meeting-agenda",
]);
export function parseHelpHints(raw: string): string[] {
  return [
    ...new Set(
      raw.split(",").filter((key) => {
        const [role, topic, extra] = key.split(":");
        return !extra && parseTourSeen(role).length === 1 && TOPICS.has(topic);
      }),
    ),
  ];
}
export function markHelpHint(role: WardTourRole, topic: string): boolean {
  if (!TOPICS.has(topic)) return false;
  const key = `${role}:${topic}`;
  try {
    const seen = parseHelpHints(window.localStorage.getItem(HELP_HINTS_KEY) ?? "");
    if (seen.includes(key)) return false;
    window.localStorage.setItem(HELP_HINTS_KEY, [...seen, key].join(","));
    return true;
  } catch {
    return false;
  }
}
function hintsAllowed(toured: boolean, role: WardTourRole, topic: string | undefined) {
  if (toured) return true;
  // A declined tour still permits hints on later screens, never another prompt on its home.
  if (!topic || topic === "command") return false;
  try {
    return parseTourSeen(window.localStorage.getItem("ward_flow_choice_tour_auto_done") ?? "").includes(role);
  } catch {
    return false;
  }
}
function obstructed() {
  return (
    hasOpenSheet() ||
    openSheetHandles().length > 0 ||
    Boolean(
      document.querySelector(
        '[data-testid="ward-tour-offer"], [data-testid="ward-whats-new"], [data-testid="ward-tour"]',
      ),
    ) ||
    Boolean(document.activeElement?.closest('input, textarea, select, [contenteditable="true"]'))
  );
}
/** A quiet once-per-topic card. Existing screen instructions only; never moves focus or opens a tour. */
export function WardHelpHints() {
  const pathname = usePathname() ?? "";
  const role = useTourRole();
  const toured = useTourSeen(role);
  const phone = useIsPhone();
  const [blocked, setBlocked] = useState(true);
  const [offered, setOffered] = useState<string | null>(null);
  const screen = screenForPath(pathname)?.screen;
  const help =
    role === "admin" && screen === "settings"
      ? ADMIN_SETTINGS_HELP
      : screenHelpFor(
          pathname,
          railEntries().filter((entry) => entry.href !== WARD_HOME_HREF || pathname === WARD_HOME_HREF),
          role === "admin" ? undefined : role,
        );
  const topic = help?.id;
  const key = `${role}:${topic}`;
  useEffect(() => {
    const update = () => setBlocked(obstructed());
    update();
    const release = subscribeToSheetStack(update);
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      release();
      observer.disconnect();
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
    };
  }, []);
  useEffect(() => {
    if (blocked || !topic || !screen || !ROLE_SCREENS[role][screen] || !hintsAllowed(toured, role, topic)) return;
    const timer = window.setTimeout(() => {
      if (!obstructed() && markHelpHint(role, topic)) setOffered(key);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [toured, blocked, topic, screen, role, key]);
  if (!help || blocked || offered !== key || !hintsAllowed(toured, role, topic)) return null;
  return (
    <OverlayPortal layer="overlay" name="ward-help-hint">
      <aside className={styles.hint} aria-label={`${help.title} help`} data-testid="ward-help-hint">
        <strong>{help.title}</strong>
        <p>
          {topic === "settings" && role !== "admin"
            ? ACCESSIBILITY_HELP[1].text
            : ((phone ? (help.phoneActions ?? help.actions) : help.actions)[0] ?? help.purpose)}
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => {
              setOffered(null);
              openWardHelp("screen");
            }}
          >
            More in Help
          </button>
          <button type="button" onClick={() => setOffered(null)}>
            Got it
          </button>
        </div>
      </aside>
    </OverlayPortal>
  );
}
