"use client";

/**
 * **THE LOCAL DEMO'S ACCESS ADMIN — who holds which role, held for this tab (role access plan,
 * later pass, Josh's go 16 Oct 2026).**
 *
 * A short synthetic list of demonstration staff, their roles and two requests for access, so the
 * Access admin screen can be shown without the shared backend. Every change goes through the same
 * rules the server uses (`ward-access-admin.ts`). Memory only: nothing here reaches browser storage,
 * and a reload starts the list again. The shared workspace keeps these on the server instead.
 */
import { useSyncExternalStore } from "react";
import {
  approveRefusal,
  grantRefusal,
  managesAccess,
  requestRefusal,
  revokeRefusal,
  scopeWithinScope,
  type AccessMembership,
  type AccessPlaces,
  type AccessRequest,
} from "@/components/ward-management/ward-access-admin";
import { MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { COMMUNITY_TEAMS } from "@/components/ward-management/ward-teams";

/** The person at an Access admin desk in the demo. */
export const DEMO_ADMIN_ID = "demo-admin-you";
/** A second demonstration admin, who granted a role waiting for your approval. */
const OTHER_ADMIN_ID = "demo-admin-second";

/** Demonstration staff. Made up, and labelled so nobody mistakes them for real accounts. */
export const DEMO_STAFF: readonly { readonly id: string; readonly label: string }[] = [
  { id: DEMO_ADMIN_ID, label: "You (demo access admin)" },
  { id: OTHER_ADMIN_ID, label: "Demo access admin 2" },
  { id: "demo-staff-a", label: "Demo staff A" },
  { id: "demo-staff-b", label: "Demo staff B" },
  { id: "demo-staff-c", label: "Demo staff C" },
  { id: "demo-staff-d", label: "Demo staff D" },
  { id: "demo-staff-e", label: "Demo staff E" },
  { id: "demo-staff-f", label: "Demo staff F" },
  { id: "demo-staff-g", label: "Demo staff G" },
  { id: "demo-staff-h", label: "Demo staff H" },
];

export function demoStaffLabel(id: string): string {
  return DEMO_STAFF.find((person) => person.id === id)?.label ?? "Demo staff";
}

type Snapshot = {
  readonly memberships: readonly AccessMembership[];
  readonly requests: readonly AccessRequest[];
};

let snapshot: Snapshot | null = null;
let sequence = 1;
const listeners = new Set<() => void>();

const day = MINUTES_PER_DAY;

/** The demo's starting list, placed around `now` so its review notes read the same every time. */
function seed(now: Instant): Snapshot {
  const role = (
    actorId: string,
    access: WardAccess,
    over: Partial<Pick<AccessMembership, "grantedBy" | "grantedAt" | "expiresAt" | "approvedBy" | "lastUsedAt">>,
  ): AccessMembership => ({
    id: `demo-role-${sequence++}`,
    actorId,
    access,
    kind: "role",
    grantedBy: OTHER_ADMIN_ID,
    grantedAt: now - 30 * day,
    expiresAt: now + 120 * day,
    approvedBy: null,
    lastUsedAt: now - day,
    revokedAt: null,
    ...over,
  });
  return {
    memberships: [
      role(DEMO_ADMIN_ID, { role: "admin", scope: { kind: "statewide" } }, { approvedBy: "demo-staff-h" }),
      role("demo-staff-a", { role: "ward", scope: { kind: "ward", unitIds: ["fsh-adult-secure"] } }, {}),
      role("demo-staff-b", { role: "ed", scope: { kind: "ed", edId: "fsh-ed" } }, { expiresAt: now + 10 * day }),
      role(
        "demo-staff-c",
        { role: "bed_manager", scope: { kind: "site", siteCode: "FSH" } },
        { grantedAt: now - 200 * day, lastUsedAt: now - 100 * day },
      ),
      role(
        "demo-staff-d",
        { role: "coordinator", scope: { kind: "service", service: "South Metro" } },
        {
          grantedAt: now - 60,
          lastUsedAt: null,
        },
      ),
      role("demo-staff-e", { role: "executive", scope: { kind: "statewide" } }, { expiresAt: now + 200 * day }),
    ],
    requests: [
      {
        id: `demo-request-${sequence++}`,
        actorId: "demo-staff-f",
        access: { role: "community", scope: { kind: "team", teamName: COMMUNITY_TEAMS.Peel } },
        requestedAt: now - 3 * 60,
        decision: null,
      },
      {
        id: `demo-request-${sequence++}`,
        actorId: "demo-staff-g",
        access: { role: "ward", scope: { kind: "ward", unitIds: ["rph-adult-secure"] } },
        requestedAt: now - 26 * 60,
        decision: null,
      },
    ],
  };
}

function current(now: Instant): Snapshot {
  snapshot ??= seed(now);
  return snapshot;
}

function emit(next: Snapshot): void {
  snapshot = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const EMPTY: Snapshot = { memberships: [], requests: [] };

/** The demo's roles and requests. Seeded on first read against the demo clock. */
export function useLocalAccessAdmin(now: Instant): Snapshot {
  return useSyncExternalStore(
    subscribe,
    () => current(now),
    () => EMPTY,
  );
}

/** The same list outside React, for tests and event handlers. */
export function readLocalAccessAdmin(now: Instant): Snapshot {
  return current(now);
}

/** What an Access admin desk in the demo is: its access, and who is at it. */
export type LocalAdminDesk = { readonly access: WardAccess; readonly actorId: string };

/** Grant a role. Returns why not, or `null` when it was given. */
export function localGrant(
  desk: LocalAdminDesk,
  input: { actorId: string; access: WardAccess; expiresAt: Instant; now: Instant; places: AccessPlaces },
): string | null {
  const state = current(input.now);
  const refusal = grantRefusal({ granter: desk.access, granterId: desk.actorId, ...input });
  if (refusal) return refusal;
  emit({
    ...state,
    memberships: [
      ...state.memberships,
      {
        id: `demo-role-${sequence++}`,
        actorId: input.actorId,
        access: input.access,
        kind: "role",
        grantedBy: desk.actorId,
        grantedAt: input.now,
        expiresAt: input.expiresAt,
        approvedBy: null,
        lastUsedAt: null,
        revokedAt: null,
      },
    ],
  });
  return null;
}

function change(
  id: string,
  now: Instant,
  check: (membership: AccessMembership) => string | null,
  apply: (membership: AccessMembership) => AccessMembership,
): string | null {
  const state = current(now);
  const membership = state.memberships.find((candidate) => candidate.id === id);
  if (!membership || membership.revokedAt !== null || membership.expiresAt <= now) return "That role is not active.";
  const refusal = check(membership);
  if (refusal) return refusal;
  emit({
    ...state,
    memberships: state.memberships.map((candidate) => (candidate.id === id ? apply(candidate) : candidate)),
  });
  return null;
}

/** A second person approves a coordinator or access admin role. */
export function localApprove(desk: LocalAdminDesk, id: string, now: Instant, places: AccessPlaces): string | null {
  return change(
    id,
    now,
    (membership) => approveRefusal({ approver: desk.access, approverId: desk.actorId, membership, places }),
    (membership) => ({ ...membership, approvedBy: desk.actorId }),
  );
}

/** End a role now. */
export function localRevoke(desk: LocalAdminDesk, id: string, now: Instant, places: AccessPlaces): string | null {
  return change(
    id,
    now,
    (membership) => revokeRefusal({ remover: desk.access, removerId: desk.actorId, membership, places }),
    (membership) => ({ ...membership, revokedAt: now }),
  );
}

/**
 * Answer a request. Approving grants the asked-for role until `expiresAt`, through the same grant
 * rules, so an admin never approves a role wider than their own.
 */
export function localDecide(
  desk: LocalAdminDesk,
  id: string,
  decision: "approved" | "declined",
  input: { expiresAt: Instant; now: Instant; places: AccessPlaces },
): string | null {
  const state = current(input.now);
  const request = state.requests.find((candidate) => candidate.id === id && candidate.decision === null);
  if (!request) return "That request has already been answered.";
  if (decision === "approved") {
    const refusal = localGrant(desk, { actorId: request.actorId, access: request.access, ...input });
    if (refusal) return refusal;
  } else {
    if (!managesAccess(desk.access)) return "Granting and removing roles is not part of your role.";
    if (!scopeWithinScope(request.access.scope, desk.access.scope, input.places))
      return "That role is wider than your own.";
  }
  const after = current(input.now);
  emit({
    ...after,
    requests: after.requests.map((candidate) => (candidate.id === id ? { ...candidate, decision } : candidate)),
  });
  return null;
}

/** A person with no role asks for one (feature 7). One open request each. */
export function localRequest(input: {
  actorId: string;
  access: WardAccess;
  now: Instant;
  places: AccessPlaces;
}): string | null {
  const state = current(input.now);
  const open = state.requests.filter((request) => request.actorId === input.actorId && request.decision === null);
  const refusal = requestRefusal({ access: input.access, openRequests: open.length, places: input.places });
  if (refusal) return refusal;
  emit({
    ...state,
    requests: [
      ...state.requests,
      {
        id: `demo-request-${sequence++}`,
        actorId: input.actorId,
        access: input.access,
        requestedAt: input.now,
        decision: null,
      },
    ],
  });
  return null;
}

/** Test seam: forget everything. */
export function resetLocalAccessAdminForTests(): void {
  snapshot = null;
  sequence = 1;
  for (const listener of listeners) listener();
}
