"use client";

/**
 * **THE ACCESS TAB IN THE SHARED WORKSPACE — its lists read from the server (role access plan,
 * later pass, Josh's go 16 Oct 2026).**
 *
 * The server decides every change and answers "step-up" when the sign-in is too old, which the
 * step-up dialog handles. Lists are read when the tab opens and again after each change. The
 * server sends times as minutes from its own now, so they are placed on the demo clock here and
 * the browser's clock is never compared with the server's. Nothing here is stored.
 */
import { useCallback, useEffect, useMemo, useState } from "react";

import type { AccessMembership, AccessRequest } from "@/components/ward-management/ward-access-admin";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardAccess, WardAccessScope } from "@/components/ward-management/ward-role-access";
import type {
  SharedAccessRequest,
  SharedChangeResult,
  SharedMembership,
} from "@/components/ward-management/ward-shared-client";
import type { SharedAccessApi } from "@/components/ward-management/shell/ward-shared-access-context";
import { parseStoredAccess } from "@/components/ward-management/shell/ward-access-store";
import type { StepUpResult } from "@/components/ward-management/shell/ward-step-up";

const NOT_REACHED = "The server was not reached. Nothing was confirmed.";

/** An account in words: "You", or the start of its id. Names are not held by Ward Flow. */
function accountLabel(actorId: string, self: string | null): string {
  return actorId === self ? "You" : `Account ${actorId.slice(0, 8)}`;
}

function accessOf(role: string, scope: unknown): WardAccess | null {
  return parseStoredAccess(JSON.stringify({ role, scope }));
}

/** A role from the server, on the demo clock. A row the access table would not allow is dropped. */
export function sharedMembership(row: SharedMembership, now: Instant): AccessMembership | null {
  const access = accessOf(row.role, row.scope);
  const minutes = row.minutes;
  if (!access || typeof minutes?.granted !== "number" || typeof minutes.expires !== "number") return null;
  return {
    id: row.id,
    actorId: row.actorId,
    access,
    kind: row.kind === "cover" ? "cover" : "role",
    grantedBy: row.grantedBy,
    grantedAt: now + minutes.granted,
    expiresAt: now + minutes.expires,
    approvedBy: row.approved ? (row.approvedBy ?? row.grantedBy) : null,
    lastUsedAt: typeof minutes.lastUsed === "number" ? now + minutes.lastUsed : null,
    revokedAt: null,
  };
}

export function sharedRequest(row: SharedAccessRequest, now: Instant): AccessRequest | null {
  const access = accessOf(row.role, row.scope);
  if (!access || typeof row.minutes?.requested !== "number") return null;
  return { id: row.id, actorId: row.actorId, access, requestedAt: now + row.minutes.requested, decision: row.decision };
}

function present<T>(value: T | null): value is T {
  return value !== null;
}

/**
 * Reads a list once per `round`, so a change can ask for a fresh read. `at` is the demo clock when
 * the list arrived: the server's minutes are placed from it, so times age as the clock runs.
 */
function useServerList<T>(
  api: SharedAccessApi | null,
  read: ((api: SharedAccessApi) => Promise<T>) | null,
  now: Instant,
) {
  const [loaded, setLoaded] = useState<{
    api: SharedAccessApi;
    round: number;
    value: T | null;
    at: Instant | null;
  } | null>(null);
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (!api || !read) return;
    let cancelled = false;
    read(api).then(
      (value) => {
        if (!cancelled) setLoaded({ api, round, value, at: null });
      },
      () => {
        if (!cancelled) setLoaded({ api, round, value: null, at: null });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [api, read, round]);
  // Stamped with the clock on the first render after it arrives.
  if (loaded && loaded.at === null) setLoaded({ ...loaded, at: now });
  const current = loaded?.api === api ? loaded : null;
  const after = useCallback((result: SharedChangeResult): StepUpResult => {
    if (result === null) setRound((value) => value + 1);
    return result;
  }, []);
  return {
    value: current?.value ?? null,
    at: current?.at ?? now,
    problem: current && current.value === null ? "The list could not be read from the server." : null,
    after,
  };
}

const readAccess = (api: SharedAccessApi) => api.listAccess();
const readCovers = (api: SharedAccessApi) => api.listCovers();

/** What `AccessSettings` needs for the admin's lists, from the server. */
export type SharedAdminSource = {
  readonly memberships: readonly AccessMembership[];
  readonly requests: readonly AccessRequest[];
  readonly people: null;
  readonly problem: string | null;
  readonly label: (actorId: string) => string;
  readonly grant: (input: { actorId: string; access: WardAccess; expiresAt: Instant }) => Promise<StepUpResult>;
  readonly approve: (id: string) => Promise<StepUpResult>;
  readonly revoke: (id: string) => Promise<StepUpResult>;
  readonly decide: (id: string, decision: "approved" | "declined", expiresAt: Instant) => Promise<StepUpResult>;
};

export function useSharedAdminSource(
  shared: { api: SharedAccessApi; actorId: string | null } | null,
  now: Instant,
  enabled: boolean,
): SharedAdminSource | null {
  const api = enabled ? (shared?.api ?? null) : null;
  const self = shared?.actorId ?? null;
  const { value, at, problem, after } = useServerList(api, api ? readAccess : null, now);
  return useMemo(() => {
    if (!api) return null;
    const settle = (change: Promise<SharedChangeResult>) => change.then(after, () => NOT_REACHED);
    return {
      memberships: (value?.memberships ?? []).map((row) => sharedMembership(row, at)).filter(present),
      requests: (value?.requests ?? []).map((row) => sharedRequest(row, at)).filter(present),
      people: null,
      problem,
      label: (actorId) => accountLabel(actorId, self),
      grant: ({ actorId, access, expiresAt }) =>
        settle(api.grantAccess({ actorId, role: access.role, scope: access.scope, expiresInMinutes: expiresAt - now })),
      approve: (id) => settle(api.approveAccess(id)),
      revoke: (id) => settle(api.revokeAccess(id)),
      decide: (id, decision, expiresAt) => settle(api.decideRequest(id, decision, expiresAt - now)),
    };
  }, [api, value, at, problem, now, self, after]);
}

/** One cover from the server, on the demo clock. */
type SharedCover = {
  readonly id: string;
  readonly actorId: string;
  readonly grantedBy: string;
  readonly scope: WardAccessScope;
  readonly until: Instant;
};

export type SharedCoverSource = {
  readonly covers: readonly SharedCover[];
  readonly problem: string | null;
  readonly self: string | null;
  readonly label: (actorId: string) => string;
  readonly give: (input: { actorId: string; scope: WardAccessScope; minutes: number }) => Promise<StepUpResult>;
  readonly end: (id: string) => Promise<StepUpResult>;
};

export function useSharedCoverSource(
  shared: { api: SharedAccessApi; actorId: string | null } | null,
  now: Instant,
  enabled: boolean,
): SharedCoverSource | null {
  const api = enabled ? (shared?.api ?? null) : null;
  const self = shared?.actorId ?? null;
  const { value, at, problem, after } = useServerList(api, api ? readCovers : null, now);
  return useMemo(() => {
    if (!api) return null;
    const settle = (change: Promise<SharedChangeResult>) => change.then(after, () => NOT_REACHED);
    return {
      covers: (value ?? [])
        .map((row) => {
          const membership = sharedMembership(row, at);
          return membership
            ? {
                id: membership.id,
                actorId: membership.actorId,
                grantedBy: membership.grantedBy,
                scope: membership.access.scope,
                until: membership.expiresAt,
              }
            : null;
        })
        .filter(present),
      problem,
      self,
      label: (actorId) => accountLabel(actorId, self),
      give: (input) => settle(api.giveCover(input)),
      end: (id) => settle(api.revokeAccess(id)),
    };
  }, [api, value, at, problem, self, after]);
}
