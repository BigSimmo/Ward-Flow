"use client";

/**
 * P056: the Activity feed from the server audit, so every desk sees the same recorded changes for
 * its place, not only what this tab has done. The server sends, for a ward or ED desk, only the
 * kind of change, whether it was recorded and when (`backend/ward-flow/desk-audit.mjs`). Until the
 * first read arrives, when it fails, and in the local demo, the feed keeps this tab's own events.
 */
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { refusedActionText } from "@/components/ward-management/ward-refusal-words";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type {
  SharedActivityAuditEvent,
  SharedActivityAuditPage,
  SharedWorkspaceClient,
} from "@/components/ward-management/ward-shared-client";

import type { CommandActivity, WardActivityEventTone } from "./ward-command-activity";
import { useWardAccessSnapshot } from "./ward-access-store";
import { SharedAccessContext } from "./ward-shared-access-context";

/** How often an open shell asks again for new audit rows. */
const ACTIVITY_AUDIT_REFRESH_MS = 60_000;
const SHOWN = 20;
/** The audit actions that fill the Activity filters, as the tab's own feed files them; any other is `other`. */
const ACTION_CATEGORY: Readonly<Record<string, CommandActivity["content"]["changes"][number]["category"]>> = {
  DECLINE: "decline",
  RECORD_ESCALATION: "escalation",
  RAISE_REFERRAL: "referral",
  RECEIVE_REFERRAL: "referral",
  PULL_PATIENT: "transfer",
};

type ReadActivityAudit = SharedWorkspaceClient["readActivityAudit"];
type ReadActivityAuditPage = SharedWorkspaceClient["readActivityAuditPage"];
type DeskAuditState =
  | { status: "unavailable" | "loading" | "failed" }
  | {
      status: "ready";
      events: readonly SharedActivityAuditEvent[];
      complete: boolean;
      cursor: string | null;
      shown: number;
      loading: boolean;
      error?: string;
    };

/** The feed's lines from audit rows, newest first; a row with an unreadable time is left out. */
export function auditActivity(
  events: readonly SharedActivityAuditEvent[],
  now: Instant,
  dayZero: Date,
  limit = SHOWN,
): Pick<CommandActivity, "lastEventAt" | "tones"> & { changes: CommandActivity["content"]["changes"] } {
  const rows = events
    .map((event) => ({ event, at: Math.floor((Date.parse(event.committed_at) - dayZero.getTime()) / 60_000) }))
    .filter(
      ({ event, at }) =>
        Number.isFinite(at) &&
        typeof event.action === "string" &&
        ["accepted", "rejected", "stale", "denied"].includes(event.outcome),
    )
    .sort((left, right) => right.at - left.at);
  const shown = rows.slice(0, limit);
  const tones: Record<string, WardActivityEventTone> = {};
  const changes = shown.map(({ event, at }) => {
    const id = `audit:${event.sequence}`;
    const refused = event.outcome !== "accepted";
    tones[id] = refused ? "danger" : "info";
    const action = refusedActionText(event.action);
    return {
      id,
      time: formatInstantWithDay(at, now),
      text: refused ? `${action} was refused.` : `${action}.`,
      category: refused ? "other" : (ACTION_CATEGORY[event.action] ?? "other"),
      ...(event.ownCommandId ? { ownCommandId: event.ownCommandId } : {}),
    };
  });
  return { changes, tones, lastEventAt: rows[0]?.at };
}

/** Fill one visible batch, following sparse permitted pages. Work is bounded; the cursor remains usable. */
export async function readAuditBatch(read: ReadActivityAuditPage, before?: string): Promise<SharedActivityAuditPage> {
  const events: SharedActivityAuditEvent[] = [];
  let cursor = before;
  const visited = new Set<string>();
  for (let page = 0; page < 20; page += 1) {
    const next = await read(cursor);
    events.push(...next.events);
    if (next.complete) return { events, complete: true, nextCursor: null };
    if (!next.nextCursor || visited.has(next.nextCursor) || next.nextCursor === cursor)
      throw new Error("Activity continuation did not advance");
    visited.add(next.nextCursor);
    cursor = next.nextCursor;
    if (events.length >= SHOWN) break;
  }
  return { events, complete: false, nextCursor: cursor ?? null };
}

/** Reads this desk's audit while open. A late reply cannot survive an account/API lifetime change. */
function useWardDeskAudit(): { state: DeskAuditState; loadMore: () => void } {
  const context = useContext(SharedAccessContext);
  const api = context?.api as
    { readActivityAudit?: ReadActivityAudit; readActivityAuditPage?: ReadActivityAuditPage } | undefined;
  const access = useWardAccessSnapshot().access;
  const read = api?.readActivityAudit;
  const pageRead = api?.readActivityAuditPage;
  const owner = useMemo(() => ({ api, actorId: context?.actorId, access }), [api, context?.actorId, access]);
  const [owned, setOwned] = useState<{ owner: typeof owner; state: DeskAuditState }>({
    owner,
    state: { status: "loading" },
  });
  // The previous desk's held rows must not paint while the new lifetime effect starts.
  const state: DeskAuditState = owned.owner === owner ? owned.state : { status: "loading" };
  const more = useRef<() => void>(() => {});
  const loadMore = useCallback(() => more.current(), []);
  useEffect(() => {
    if (!read && !pageRead) return;
    const setState = (next: DeskAuditState) => setOwned({ owner, state: next });
    let live = true;
    let serial = 0;
    let held: Extract<DeskAuditState, { status: "ready" }> | undefined;
    let loadingMore = false;
    let expanded = false;
    setState({ status: "loading" });
    const load = async (append = false) => {
      if (append) {
        if (!held || loadingMore) return;
        expanded = true;
        if (held.shown < held.events.length) {
          held = { ...held, shown: held.shown + SHOWN };
          setState(held);
          return;
        }
        if (held.complete) return;
      }
      const request = ++serial;
      const previous = held;
      loadingMore = append;
      if (append) expanded = true;
      if (previous && append) setState({ ...previous, loading: true, error: undefined });
      try {
        const page = pageRead
          ? await readAuditBatch(pageRead.bind(api), append ? (held?.cursor ?? undefined) : undefined)
          : { events: await read!.call(api), complete: true, nextCursor: null };
        if (!live || request !== serial) return;
        const bySequence = new Map((append ? (previous?.events ?? []) : []).map((event) => [event.sequence, event]));
        for (const event of page.events) bySequence.set(event.sequence, event);
        held = {
          status: "ready",
          events: [...bySequence.values()],
          complete: page.complete,
          cursor: page.nextCursor,
          shown: append ? (previous?.shown ?? 0) + SHOWN : SHOWN,
          loading: false,
        };
        setState(held);
      } catch {
        if (!live || request !== serial) return;
        if (previous) {
          held = { ...previous, loading: false, error: "Older activity could not be read. Try again." };
          setState(held);
        } else setState({ status: "failed" });
      } finally {
        if (live && request === serial) loadingMore = false;
      }
    };
    more.current = () => {
      void load(true);
    };
    void load();
    // Keep an explicitly extended history stable until the panel is reopened.
    const timer = setInterval(() => {
      if (!loadingMore && !expanded) void load();
    }, ACTIVITY_AUDIT_REFRESH_MS);
    return () => {
      live = false;
      more.current = () => {};
      clearInterval(timer);
    };
  }, [api, read, pageRead, owner]);
  return { state: read || pageRead ? state : { status: "unavailable" }, loadMore };
}

/** The Command feed with its events from the audit once read; this tab's own events otherwise. */
export function useActivityFromAudit(derived: CommandActivity, now: Instant): CommandActivity {
  const { state: audit, loadMore } = useWardDeskAudit();
  const dayZero = useOptionalWardFlowSelect("dayZero")?.dayZero;
  return useMemo(() => {
    if (audit.status !== "ready" || !dayZero) return derived;
    const { changes, tones, lastEventAt } = auditActivity(audit.events, now, dayZero, audit.shown);
    return {
      ...derived,
      content: { ...derived.content, changes },
      tones,
      lastEventAt,
      auditFeed: {
        hasOlder: !audit.complete || audit.shown < audit.events.length,
        loading: audit.loading,
        loadMore,
        error: audit.error,
      },
    };
  }, [audit, derived, now, dayZero, loadMore]);
}
