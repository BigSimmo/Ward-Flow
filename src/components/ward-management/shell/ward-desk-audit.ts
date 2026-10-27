"use client";

/**
 * P056: the Activity feed from the server audit, so every desk sees the same recorded changes for
 * its place, not only what this tab has done. The server sends, for a ward or ED desk, only the
 * kind of change, whether it was recorded and when (`backend/ward-flow/desk-audit.mjs`). Until the
 * first read arrives, when it fails, and in the local demo, the feed keeps this tab's own events.
 */
import { useContext, useEffect, useMemo, useState } from "react";

import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { refusedActionText } from "@/components/ward-management/ward-refusal-words";
import type { SharedActivityAuditEvent, SharedWorkspaceClient } from "@/components/ward-management/ward-shared-client";

import type { CommandActivity, WardActivityEventTone } from "./ward-command-activity";
import { SharedAccessContext } from "./ward-shared-access-context";

/** How often an open shell asks again for new audit rows. */
export const ACTIVITY_AUDIT_REFRESH_MS = 60_000;
const SHOWN = 20;

type ReadActivityAudit = SharedWorkspaceClient["readActivityAudit"];
export type DeskAuditState =
  { status: "unavailable" | "loading" | "failed" } | { status: "ready"; events: readonly SharedActivityAuditEvent[] };

/** The feed's lines from audit rows, newest first; a row with an unreadable time is left out. */
export function auditActivity(
  events: readonly SharedActivityAuditEvent[],
  now: Instant,
): Pick<CommandActivity, "lastEventAt" | "tones"> & { changes: CommandActivity["content"]["changes"] } {
  const rows = events
    .map((event) => ({ event, at: Date.parse(event.committed_at) }))
    .filter(({ event, at }) => Number.isFinite(at) && typeof event.action === "string")
    .sort((left, right) => right.at - left.at);
  const shown = rows.slice(0, SHOWN);
  const tones: Record<string, WardActivityEventTone> = {};
  const changes = shown.map(({ event, at }) => {
    const id = `audit:${event.sequence}`;
    const refused = event.outcome === "rejected";
    tones[id] = refused ? "danger" : "info";
    const action = refusedActionText(event.action);
    return {
      id,
      time: formatInstantWithDay(at, now),
      text: refused ? `${action} was refused.` : `${action}.`,
      category: "other" as const,
    };
  });
  return { changes, tones, lastEventAt: rows[0]?.at };
}

/** Reads this desk's audit while the shell is open; `unavailable` in the local demo. */
export function useWardDeskAudit(): DeskAuditState {
  const api = useContext(SharedAccessContext)?.api as { readActivityAudit?: ReadActivityAudit } | undefined;
  const read = api?.readActivityAudit;
  const [state, setState] = useState<DeskAuditState>({ status: "loading" });
  useEffect(() => {
    if (!read) return;
    let live = true;
    const load = () =>
      read().then(
        (events) => live && setState({ status: "ready", events }),
        () => live && setState((previous) => (previous.status === "ready" ? previous : { status: "failed" })),
      );
    void load();
    const timer = setInterval(load, ACTIVITY_AUDIT_REFRESH_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [read]);
  return read ? state : { status: "unavailable" };
}

/** The Command feed with its events from the audit once read; this tab's own events otherwise. */
export function useActivityFromAudit(derived: CommandActivity, now: Instant): CommandActivity {
  const audit = useWardDeskAudit();
  return useMemo(() => {
    if (audit.status !== "ready") return derived;
    const { changes, tones, lastEventAt } = auditActivity(audit.events, now);
    return { ...derived, content: { ...derived.content, changes }, tones, lastEventAt };
  }, [audit, derived, now]);
}
